/**
 * 資産推移グラフのSVG描画。
 *
 * 外部ライブラリは使わず、素のJSでSVGを組み立てる
 * （ビルドツール・CDN依存を持ち込まない方針のため）。
 *
 * 描画するもの:
 *   - 暴落あり／なしの資産推移（2系列）と純拠出額（参照線）
 *   - 実データを適用した暴落期間の帯（複数可）
 *   - 拠出プラン（積立／停止／取り崩し）を示す下部のレール
 *   - ポインタに追従する縦のクロスヘア＋全系列の値を出すツールチップ
 *
 * 系列色は --series-1 / --series-2 の2色のみ。暴落帯・レールは
 * カテゴリ色を増やさずに済むよう、インク色の濃淡だけで表現している。
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    global.Chart = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  // viewBox基準の描画領域。実際の表示サイズはCSSが決める
  const VIEW_W = 820;
  const VIEW_H = 420;
  const PAD = { top: 26, right: 22, bottom: 62, left: 72 };

  const PLOT_W = VIEW_W - PAD.left - PAD.right;
  const PLOT_H = VIEW_H - PAD.top - PAD.bottom;

  // 拠出プランを示す下部レール
  const RAIL_GAP = 10;
  const RAIL_H = 14;

  // 年齢を併記するときにX軸の下へ足す1行分の高さ
  const AGE_ROW_H = 15;

  // ユニークなグラデーションIDを振るための連番（同一ページに複数描画しても衝突しないように）
  let gradientSeq = 0;

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const key in attrs) {
        if (attrs[key] != null) node.setAttribute(key, attrs[key]);
      }
    }
    return node;
  }

  /** 金額を「◯億◯万円」形式の短い表記にする。 */
  function formatYen(value) {
    const sign = value < 0 ? "−" : "";
    const abs = Math.abs(value);
    if (abs >= 100000000) return sign + (abs / 100000000).toFixed(2) + "億円";
    if (abs >= 10000) return sign + Math.round(abs / 10000).toLocaleString("ja-JP") + "万円";
    return sign + Math.round(abs).toLocaleString("ja-JP") + "円";
  }

  /** 軸ラベル用に「万円」単位で短く表記する。 */
  function formatAxisYen(value) {
    if (value === 0) return "0";
    const sign = value < 0 ? "−" : "";
    const man = Math.abs(value) / 10000;
    if (man >= 10000) return sign + (man / 10000).toFixed(1) + "億";
    return sign + Math.round(man).toLocaleString("ja-JP") + "万";
  }

  /** 目盛りに使うキリの良い数値の刻み幅を選ぶ。 */
  function niceStep(rawStep) {
    if (!(rawStep > 0)) return 1;
    const exponent = Math.floor(Math.log10(rawStep));
    const base = Math.pow(10, exponent);
    const normalized = rawStep / base;
    let factor;
    if (normalized <= 1) factor = 1;
    else if (normalized <= 2) factor = 2;
    else if (normalized <= 2.5) factor = 2.5;
    else if (normalized <= 5) factor = 5;
    else factor = 10;
    return factor * base;
  }

  /**
   * Y軸の範囲と目盛りを決める。
   * 取り崩しで純拠出額がマイナスになることがあるので、下限は0に固定しない。
   */
  function buildYAxis(minValue, maxValue) {
    const low = Math.min(0, minValue);
    const high = Math.max(maxValue, low + 1);
    const step = niceStep((high - low) / 5);

    // 目盛りの外側にデータが出ないよう切り上げる
    const top = Math.ceil(high / step - 0.0001) * step;

    // マイナス側は刻み幅そのままで切り捨てると（取り崩しで純拠出額が少しだけ
    // マイナスになる程度のとき）下に大きな余白ができるので、1/4刻みで詰める
    const subStep = step / 4;
    const bottom = low < 0 ? Math.floor(low / subStep - 0.0001) * subStep : 0;

    // 目盛り線は 0 を基準にした刻み幅の倍数だけ引く（bottom 自身には引かない）
    const ticks = [];
    for (let v = 0; v <= top + step * 0.001; v += step) ticks.push(v);
    for (let v = -step; v >= bottom - step * 0.001; v -= step) ticks.unshift(v);

    return { ticks: ticks, top: top, bottom: bottom };
  }

  function buildXTicks(totalMonths) {
    const totalYears = totalMonths / 12;
    // 目盛りが多くなりすぎないよう、年単位でキリの良い間隔を選ぶ
    const candidates = [1, 2, 5, 10];
    let stepYears = candidates[candidates.length - 1];
    for (const c of candidates) {
      if (totalYears / c <= 8) {
        stepYears = c;
        break;
      }
    }
    const ticks = [];
    for (let y = 0; y <= totalYears + 0.0001; y += stepYears) ticks.push(y);
    return ticks;
  }

  /**
   * 資産推移グラフを描画する。
   *
   * @param {HTMLElement} container 描画先（中身は置き換えられる）
   * @param {Object} config
   * @param {number} config.totalMonths     積立期間の月数
   * @param {Array}  config.series          [{ id, name, colorVar, points: number[], dashed, muted, fill }]
   * @param {Array}  [config.crashBands]    [{ startMonth, endMonth, label }]
   * @param {Array}  [config.phaseSegments] [{ startMonth, endMonth, mode, label }]
   * @param {number|null} [config.depletedMonth] 資産が尽きた月（縦線で示す）
   * @param {number|null} [config.startAge]     開始時点の年齢（任意。X軸とツールチップに併記する）
   */
  function render(container, config) {
    container.textContent = "";

    const totalMonths = config.totalMonths;
    const series = config.series;
    const crashBands = config.crashBands || [];
    const phaseSegments = config.phaseSegments || [];

    // 年齢は任意入力。未入力なら年齢の行そのものを描かず、高さも元のままにする
    const startAge = Number.isFinite(config.startAge) ? config.startAge : null;
    const viewH = VIEW_H + (startAge != null ? AGE_ROW_H : 0);

    let maxValue = -Infinity;
    let minValue = Infinity;
    for (const s of series) {
      for (const v of s.points) {
        if (v > maxValue) maxValue = v;
        if (v < minValue) minValue = v;
      }
    }
    if (!Number.isFinite(maxValue)) maxValue = 1;
    if (!Number.isFinite(minValue)) minValue = 0;

    const yAxis = buildYAxis(minValue, maxValue);
    const ySpan = yAxis.top - yAxis.bottom || 1;

    const xOf = (monthIndex) => PAD.left + (monthIndex / totalMonths) * PLOT_W;
    const yOf = (value) => PAD.top + PLOT_H - ((value - yAxis.bottom) / ySpan) * PLOT_H;

    const svg = el("svg", {
      viewBox: `0 0 ${VIEW_W} ${viewH}`,
      preserveAspectRatio: "xMidYMid meet",
      class: "chart-svg",
      role: "img",
      "aria-label": config.ariaLabel || "資産推移グラフ",
    });

    // --- 主系列の下に敷くグラデーション定義 ---
    // グラデーションは参照元の要素ではなく defs 側の色を見るので、
    // currentColor ではなく系列の色変数を stop に直接書く
    const defs = el("defs");
    svg.appendChild(defs);

    function areaGradientFor(colorVar) {
      const id = "chart-area-gradient-" + ++gradientSeq;
      const gradient = el("linearGradient", { id: id, x1: "0", y1: "0", x2: "0", y2: "1" });
      const top = el("stop", { offset: "0%" });
      top.setAttribute("style", `stop-color: var(${colorVar}); stop-opacity: 0.22;`);
      const bottom = el("stop", { offset: "100%" });
      bottom.setAttribute("style", `stop-color: var(${colorVar}); stop-opacity: 0;`);
      gradient.appendChild(top);
      gradient.appendChild(bottom);
      defs.appendChild(gradient);
      return id;
    }

    // --- 暴落期間の帯（実データを適用した区間・複数可） ---
    crashBands.forEach(function (band, i) {
      if (!(band.endMonth > band.startMonth)) return;
      const x1 = xOf(band.startMonth);
      const x2 = xOf(band.endMonth);
      const width = Math.max(1.5, x2 - x1);

      svg.appendChild(
        el("rect", { x: x1, y: PAD.top, width: width, height: PLOT_H, class: "chart-crash-band" })
      );
      // 暴落の起点は帯の端だけだと読み取りにくいので、破線で明示する
      svg.appendChild(
        el("line", {
          x1: x1,
          y1: PAD.top,
          x2: x1,
          y2: PAD.top + PLOT_H,
          class: "chart-crash-start",
        })
      );

      // 帯が細いとラベルが潰れるので、そのときは通し番号だけ出す
      const wideEnough = width >= 84;
      const label = el("text", {
        x: wideEnough ? x1 + 6 : x1 + 3,
        // 帯が隣り合うときにラベルが重ならないよう、段を交互にずらす
        y: PAD.top + 13 + (i % 2) * 15,
        class: "chart-band-label",
      });
      label.textContent = wideEnough ? band.label : String(i + 1);
      svg.appendChild(label);
    });

    // --- グリッド線とY軸ラベル（1pxのヘアライン・実線） ---
    for (const tick of yAxis.ticks) {
      const y = yOf(tick);
      svg.appendChild(
        el("line", {
          x1: PAD.left,
          y1: y,
          x2: PAD.left + PLOT_W,
          y2: y,
          class: tick === 0 ? "chart-baseline" : "chart-gridline",
        })
      );
      const label = el("text", {
        x: PAD.left - 10,
        y: y + 4,
        class: "chart-axis-label chart-axis-label--y",
      });
      label.textContent = formatAxisYen(tick);
      svg.appendChild(label);
    }

    // --- X軸ラベル（年齢が入力されていれば、その下に何歳のときかを併記する） ---
    const xLabelY = PAD.top + PLOT_H + RAIL_GAP + RAIL_H + 17;
    for (const yearTick of buildXTicks(totalMonths)) {
      const x = xOf(yearTick * 12);
      const label = el("text", {
        x: x,
        y: xLabelY,
        class: "chart-axis-label chart-axis-label--x",
      });
      label.textContent = yearTick + "年";
      svg.appendChild(label);

      if (startAge != null) {
        const ageLabel = el("text", {
          x: x,
          y: xLabelY + AGE_ROW_H,
          class: "chart-axis-label chart-axis-label--x chart-axis-label--age",
        });
        ageLabel.textContent = Math.floor(startAge + yearTick) + "歳";
        svg.appendChild(ageLabel);
      }
    }

    // --- 主系列のエリア塗り（色は増やさず、線と同色の淡いグラデーション） ---
    const filled = series.filter((s) => s.fill);
    for (const s of filled) {
      const zeroY = yOf(Math.max(yAxis.bottom, 0));
      const path =
        `M ${xOf(0).toFixed(2)} ${zeroY.toFixed(2)} ` +
        s.points.map((v, i) => `L ${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)}`).join(" ") +
        ` L ${xOf(s.points.length - 1).toFixed(2)} ${zeroY.toFixed(2)} Z`;
      svg.appendChild(
        el("path", { d: path, class: "chart-area", fill: `url(#${areaGradientFor(s.colorVar)})` })
      );
    }

    // --- 各系列の折れ線 ---
    for (const s of series) {
      const points = s.points.map((v, i) => `${xOf(i).toFixed(2)},${yOf(v).toFixed(2)}`).join(" ");
      svg.appendChild(
        el("polyline", {
          points: points,
          class:
            "chart-line" +
            (s.dashed ? " chart-line--dashed" : "") +
            (s.muted ? " chart-line--muted" : ""),
          style: `stroke: var(${s.colorVar});`,
        })
      );
    }

    // --- 資産が尽きた月のマーカー ---
    if (config.depletedMonth != null) {
      const x = xOf(config.depletedMonth);
      svg.appendChild(
        el("line", { x1: x, y1: PAD.top, x2: x, y2: PAD.top + PLOT_H, class: "chart-depleted-line" })
      );
      const label = el("text", { x: x - 6, y: PAD.top + PLOT_H - 8, class: "chart-depleted-label" });
      label.textContent = "資産が尽きる";
      svg.appendChild(label);
    }

    // --- 終端のマーカー（サーフェス色の2pxリング付き） ---
    for (const s of series) {
      if (s.muted) continue;
      const lastIndex = s.points.length - 1;
      svg.appendChild(
        el("circle", {
          cx: xOf(lastIndex),
          cy: yOf(s.points[lastIndex]),
          r: 5,
          class: "chart-end-dot",
          style: `fill: var(${s.colorVar});`,
        })
      );
    }

    // --- 拠出プランのレール（積立／停止／取り崩し） ---
    if (phaseSegments.length) {
      const railY = PAD.top + PLOT_H + RAIL_GAP;
      for (const seg of phaseSegments) {
        const x1 = xOf(seg.startMonth);
        const x2 = xOf(seg.endMonth);
        const width = Math.max(1, x2 - x1);
        svg.appendChild(
          el("rect", {
            x: x1,
            y: railY,
            // セグメント同士が地続きに見えないよう2pxのすき間をあける
            width: Math.max(1, width - 2),
            height: RAIL_H,
            rx: 3,
            class: "chart-rail chart-rail--" + seg.mode,
          })
        );
        if (width >= 56) {
          const label = el("text", {
            x: x1 + width / 2 - 1,
            y: railY + RAIL_H - 3.5,
            class: "chart-rail-label",
          });
          label.textContent = seg.label;
          svg.appendChild(label);
        }
      }
    }

    // --- クロスヘアとホバー用の当たり判定 ---
    const crosshair = el("line", {
      x1: 0,
      y1: PAD.top,
      x2: 0,
      y2: PAD.top + PLOT_H,
      class: "chart-crosshair",
      "aria-hidden": "true",
    });
    crosshair.style.display = "none";
    svg.appendChild(crosshair);

    const hoverDots = series.map((s) => {
      const dot = el("circle", {
        r: 4.5,
        class: "chart-hover-dot",
        style: `fill: var(${s.colorVar});`,
        "aria-hidden": "true",
      });
      dot.style.display = "none";
      svg.appendChild(dot);
      return dot;
    });

    const hitArea = el("rect", {
      x: PAD.left,
      y: PAD.top,
      width: PLOT_W,
      height: PLOT_H,
      fill: "transparent",
      class: "chart-hit-area",
    });
    svg.appendChild(hitArea);

    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";
    wrapper.appendChild(svg);

    const tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    tooltip.setAttribute("role", "status");
    tooltip.hidden = true;
    wrapper.appendChild(tooltip);

    container.appendChild(wrapper);

    /** その月がどの暴落期間・どの拠出フェーズに属するかを引く。 */
    function contextAt(monthIndex) {
      const band = crashBands.find(
        (b) => monthIndex > b.startMonth && monthIndex <= b.endMonth
      );
      const seg = phaseSegments.find(
        (s) => monthIndex >= s.startMonth && monthIndex <= s.endMonth
      );
      return { band: band || null, segment: seg || null };
    }

    function monthFromClientX(clientX) {
      const rect = svg.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const viewX = ratio * VIEW_W;
      const monthFloat = ((viewX - PAD.left) / PLOT_W) * totalMonths;
      return Math.max(0, Math.min(totalMonths, Math.round(monthFloat)));
    }

    function showAt(monthIndex) {
      const x = xOf(monthIndex);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.style.display = "";

      series.forEach((s, i) => {
        const v = s.points[monthIndex];
        if (v == null) {
          hoverDots[i].style.display = "none";
          return;
        }
        hoverDots[i].setAttribute("cx", x);
        hoverDots[i].setAttribute("cy", yOf(v));
        hoverDots[i].style.display = "";
      });

      // ツールチップは untrusted な文字列を含みうるので textContent で組み立てる
      tooltip.textContent = "";
      const heading = document.createElement("div");
      heading.className = "chart-tooltip__heading";
      const years = Math.floor(monthIndex / 12);
      const months = monthIndex % 12;
      heading.textContent =
        years +
        "年" +
        months +
        "ヶ月後" +
        (startAge != null ? "（" + Math.floor(startAge + monthIndex / 12) + "歳）" : "");
      tooltip.appendChild(heading);

      const ctx = contextAt(monthIndex);
      if (ctx.band || ctx.segment) {
        const meta = document.createElement("div");
        meta.className = "chart-tooltip__meta";
        meta.textContent = [ctx.segment ? ctx.segment.label : null, ctx.band ? ctx.band.label + "の渦中" : null]
          .filter(Boolean)
          .join(" ／ ");
        tooltip.appendChild(meta);
      }

      for (const s of series) {
        const v = s.points[monthIndex];
        if (v == null) continue;
        const row = document.createElement("div");
        row.className = "chart-tooltip__row";

        const key = document.createElement("span");
        key.className = "chart-tooltip__key" + (s.dashed ? " chart-tooltip__key--dashed" : "");
        key.style.setProperty("--key-color", `var(${s.colorVar})`);
        row.appendChild(key);

        const value = document.createElement("span");
        value.className = "chart-tooltip__value";
        value.textContent = formatYen(v);
        row.appendChild(value);

        const name = document.createElement("span");
        name.className = "chart-tooltip__name";
        name.textContent = s.name;
        row.appendChild(name);

        tooltip.appendChild(row);
      }

      tooltip.hidden = false;
      // ツールチップがグラフ右端からはみ出さないよう左右に振り分ける
      const ratio = monthIndex / totalMonths;
      tooltip.style.left = (x / VIEW_W) * 100 + "%";
      tooltip.classList.toggle("chart-tooltip--flip", ratio > 0.62);
    }

    function hide() {
      crosshair.style.display = "none";
      for (const dot of hoverDots) dot.style.display = "none";
      tooltip.hidden = true;
    }

    hitArea.addEventListener("pointermove", (e) => showAt(monthFromClientX(e.clientX)));
    hitArea.addEventListener("pointerleave", hide);

    // キーボードでもホバーと同じ情報に到達できるようにする
    svg.setAttribute("tabindex", "0");
    let focusMonth = 0;
    svg.addEventListener("focus", () => showAt(focusMonth));
    svg.addEventListener("blur", hide);
    svg.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 12 : 1;
      if (e.key === "ArrowRight") {
        focusMonth = Math.min(totalMonths, focusMonth + step);
      } else if (e.key === "ArrowLeft") {
        focusMonth = Math.max(0, focusMonth - step);
      } else if (e.key === "Home") {
        focusMonth = 0;
      } else if (e.key === "End") {
        focusMonth = totalMonths;
      } else {
        return;
      }
      e.preventDefault();
      showAt(focusMonth);
    });
  }

  return {
    render: render,
    formatYen: formatYen,
  };
});
