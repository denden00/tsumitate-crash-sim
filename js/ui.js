/**
 * 入力フォーム・拠出プラン／暴落シナリオの編集・結果表示のUI制御。
 * 計算は js/simulation.js、グラフ描画は js/chart.js に委ねる。
 *
 * 金額の入力はすべて「万円」単位。内部計算は円なので、境界で ×10000 して渡す。
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./simulation.js"), null);
  } else {
    global.UI = factory(global.Simulation, global.Chart);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Simulation, Chart) {
  "use strict";

  const MAN = 10000;

  const MODE_LABELS = {
    contribute: "積立",
    pause: "停止",
    withdraw: "取り崩し",
  };

  /** events.json から、イベント／指数の一覧と組み合わせの有無を取り出す。 */
  function buildCatalog(eventsJson) {
    const events = [];
    const indices = [];
    const eventSeen = new Set();
    const indexSeen = new Set();
    const available = new Set();

    for (const c of eventsJson.combinations) {
      if (!eventSeen.has(c.eventId)) {
        eventSeen.add(c.eventId);
        events.push({ id: c.eventId, name: c.eventName });
      }
      if (!indexSeen.has(c.indexId)) {
        indexSeen.add(c.indexId);
        indices.push({ id: c.indexId, name: c.indexName });
      }
      available.add(c.eventId + "|" + c.indexId);
    }

    return {
      events,
      indices,
      has(eventId, indexId) {
        return available.has(eventId + "|" + indexId);
      },
      /** その指数で実データを取得できているイベントだけを返す。 */
      eventsFor(indexId) {
        return events.filter((e) => available.has(e.id + "|" + indexId));
      },
    };
  }

  /* ---------- 表示フォーマット ---------- */

  function formatYen(value) {
    const sign = value < 0 ? "−" : "";
    const abs = Math.abs(value);
    if (abs >= 100000000) return sign + (abs / 100000000).toFixed(2) + "億円";
    if (abs >= 10000) return sign + Math.round(abs / 10000).toLocaleString("ja-JP") + "万円";
    return sign + Math.round(abs).toLocaleString("ja-JP") + "円";
  }

  function formatSignedYen(value) {
    return (value >= 0 ? "+" : "−") + formatYen(Math.abs(value));
  }

  function formatMonths(months) {
    if (months == null) return "期間内に未回復";
    if (months === 0) return "0ヶ月";
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y === 0) return m + "ヶ月";
    if (m === 0) return y + "年";
    return y + "年" + m + "ヶ月";
  }

  function formatPercent(ratio, digits) {
    return (ratio * 100).toFixed(digits == null ? 1 : digits) + "%";
  }

  /** 数値入力欄から値を読む。空欄・不正値なら fallback を返す。 */
  function readNumber(input, fallback) {
    const v = parseFloat(input.value);
    return Number.isFinite(v) ? v : fallback;
  }

  function elem(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * 暴落イベントの選択肢ラベル。
   * 「どのくらいの暴落だったか」を選ぶ前に判断できるよう、
   * 選んだ指数での月次終値ベースの下落率と回復期間を添える。
   */
  function eventOptionLabel(eventName, combination) {
    const d = Simulation.describeCombination(combination);
    if (!d) return eventName;
    const drop = d.dropRatio > 0.005 ? "−" + formatPercent(d.dropRatio, 0) : "下落なし";
    return `${eventName}（${drop}・回復${formatMonths(d.recoveryMonths)}）`;
  }

  function setOptions(selectEl, items, preferredValue) {
    const previous = preferredValue != null ? preferredValue : selectEl.value;
    selectEl.textContent = "";
    for (const item of items) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label != null ? item.label : item.name;
      selectEl.appendChild(option);
    }
    const stillThere = items.some((i) => i.id === previous);
    selectEl.value = stillThere ? previous : items.length ? items[0].id : "";
    return selectEl.value;
  }

  function statTile(label, value, opts) {
    const options = opts || {};
    const tile = elem("div", "stat-tile" + (options.emphasis ? " stat-tile--emphasis" : ""));
    tile.appendChild(elem("div", "stat-tile__label", label));

    const valueEl = elem("div", "stat-tile__value", value);
    if (options.tone) valueEl.classList.add("stat-tile__value--" + options.tone);
    tile.appendChild(valueEl);

    if (options.note) tile.appendChild(elem("div", "stat-tile__note", options.note));
    return tile;
  }

  /* ---------- 結果の描画 ---------- */

  /** 年次サマリーの表（グラフを見なくても値に到達できるようにするため）。 */
  function buildTable(result) {
    const table = elem("table", "data-table");
    const hasWithdrawal = result.summary.hasWithdrawal;

    const headers = ["経過年数", "純拠出額", "資産評価額（暴落あり）", "資産評価額（暴落なし）"];
    if (hasWithdrawal) headers.splice(2, 0, "累計取り崩し額");

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const h of headers) {
      const th = elem("th", null, h);
      th.scope = "col";
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let m = 0; m < result.series.length; m += 12) {
      const point = result.series[m];
      const baseline = result.baselineSeries[m];
      const tr = document.createElement("tr");
      if (point.phase === Simulation.PHASE_CRASH) tr.className = "data-table__row--crash";

      const cells = [Math.floor(m / 12) + "年", formatYen(point.principal)];
      if (hasWithdrawal) cells.push(formatYen(point.withdrawn));
      cells.push(formatYen(point.value), formatYen(baseline.value));

      cells.forEach((text, i) => {
        const cell = elem(i === 0 ? "th" : "td", null, text);
        if (i === 0) cell.scope = "row";
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const caption = elem(
      "caption",
      null,
      result.crashes.length
        ? "網掛けの行は実データを適用した暴落期間。"
        : "暴落を設定していないため、全期間が想定利回りでの試算です。"
    );
    table.insertBefore(caption, table.firstChild);
    return table;
  }

  function renderSummary(container, result) {
    container.textContent = "";
    const s = result.summary;

    const grid = elem("div", "stat-grid");

    grid.appendChild(
      statTile("最終資産評価額", formatYen(s.finalValue), {
        emphasis: true,
        note:
          "純拠出額 " +
          formatYen(s.finalPrincipal) +
          (s.hasWithdrawal ? "（拠出 " + formatYen(s.totalContributed) + " − 取り崩し " + formatYen(s.totalWithdrawn) + "）" : ""),
      })
    );

    grid.appendChild(
      statTile("運用益", formatSignedYen(s.finalProfit), {
        tone: s.finalProfit >= 0 ? "positive" : "negative",
        note: "評価額 − 純拠出額",
      })
    );

    if (s.hasWithdrawal) {
      grid.appendChild(
        statTile("累計取り崩し額", formatYen(s.totalWithdrawn), {
          note: s.depletedMonthIndex != null ? "途中で資産が尽きています" : "手元に受け取った合計",
        })
      );
    }

    if (s.hasCrash) {
      grid.appendChild(
        statTile("暴落がなかった場合との差", formatSignedYen(s.crashImpact), {
          tone: s.crashImpact >= 0 ? "positive" : "negative",
          note: "暴落なし " + formatYen(s.finalBaselineValue),
        })
      );
    }

    container.appendChild(grid);
  }

  // 入力のたびに再描画するので、開閉状態は描画をまたいで覚えておく
  let breakdownOpen = true;

  /**
   * 暴落1件ごとの内訳。複数指定できるので、まとめてカードで並べる。
   * 暴落を何度も置くと縦に長くなるため、丸ごとたためるようにしてある。
   */
  function renderCrashBreakdown(container, result) {
    container.textContent = "";
    if (!result.crashes.length) return;

    const details = elem("details", "breakdown");
    details.open = breakdownOpen;
    details.addEventListener("toggle", function () {
      breakdownOpen = details.open;
    });

    const summary = elem("summary", "breakdown__summary");
    summary.appendChild(elem("h3", "section-subhead", "暴落ごとの内訳"));
    summary.appendChild(elem("span", "breakdown__count", result.crashes.length + "件"));
    const chevron = elem("span", "breakdown__chevron");
    chevron.setAttribute("aria-hidden", "true");
    summary.appendChild(chevron);
    details.appendChild(summary);

    const body = elem("div", "breakdown__body");
    const list = elem("div", "crash-cards");
    result.crashes.forEach(function (c, i) {
      const card = elem("article", "crash-card");

      const head = elem("div", "crash-card__head");
      head.appendChild(elem("span", "crash-card__index", String(i + 1)));
      const title = elem("div", "crash-card__title");
      title.appendChild(elem("strong", null, c.eventName));
      title.appendChild(elem("span", "crash-card__meta", `${c.indexName} ／ ${c.startYear}年後に発生`));
      head.appendChild(title);
      card.appendChild(head);

      const hasAssetDrawdown = c.assetDrawdown.ratio > 0.0005;
      const rows = [
        {
          label: "指数の下落率",
          value: c.indexDropRatio > 0.005 ? "−" + formatPercent(c.indexDropRatio) : "下落なし",
          notes: [`${c.preCrashHighDate} → ${c.indexTroughDate}`],
        },
        {
          label: "指数が高値を回復するまで",
          value: formatMonths(c.indexRecoveryMonths),
          notes: c.recoveryDate ? ["→ " + c.recoveryDate] : [],
        },
        {
          label: "資産評価額の最大下落",
          value: hasAssetDrawdown ? "−" + formatPercent(c.assetDrawdown.ratio) : "下落なし",
          notes: hasAssetDrawdown
            ? [
                formatYen(c.assetDrawdown.amount),
                // 取り崩し中は暴落と関係なく資産が減るので、暴落単独の影響と読まれないようにする
                c.includesWithdrawal ? "取り崩し期間を含む" : null,
              ].filter(Boolean)
            : [],
        },
        {
          label: "資産評価額がピークに戻るまで",
          // そもそも下がっていないときに「0ヶ月で回復」と書くと意味が通らない
          value: hasAssetDrawdown ? formatMonths(c.assetRecoveryMonths) : "―",
          notes: [],
        },
      ];

      const dl = elem("dl", "crash-card__stats");
      for (const row of rows) {
        const item = elem("div", "crash-card__stat");
        item.appendChild(elem("dt", null, row.label));
        const dd = elem("dd", null, row.value);
        for (const note of row.notes) dd.appendChild(elem("span", "crash-card__note", note));
        item.appendChild(dd);
        dl.appendChild(item);
      }
      card.appendChild(dl);

      if (c.truncated) {
        card.appendChild(
          elem("p", "crash-card__warn", "指数が高値を回復する前に期間が終了しています。")
        );
      }
      list.appendChild(card);
    });

    body.appendChild(list);
    details.appendChild(body);
    container.appendChild(details);
  }

  /** 数字だけでは伝わりにくい示唆を、条件がそろったときだけ1文で添える。 */
  function renderInsights(container, result) {
    container.textContent = "";
    const s = result.summary;
    const messages = [];

    for (const c of result.crashes) {
      // 1〜2ヶ月で終わる小さな調整では差が出ないので、はっきり出たものだけ書く。
      // 資産がそもそも下がっていない（＝残高0など）ケースも「早く戻った」とは言えないので除く
      if (
        c.assetRecoveryMonths != null &&
        c.assetDrawdown.ratio > 0.005 &&
        c.indexRecoveryMonths >= 6 &&
        c.indexRecoveryMonths - c.assetRecoveryMonths >= 3
      ) {
        messages.push(
          `${c.eventName}では指数が高値に戻るまで${formatMonths(c.indexRecoveryMonths)}かかりましたが、` +
            `拠出を続けたことで資産評価額は${formatMonths(c.assetRecoveryMonths)}でピークに戻っています。`
        );
      }
    }

    if (s.hasCrash && s.crashImpact > 0) {
      messages.push(
        "暴落中に安い価格で口数を買い増した効果で、最終資産は暴落がなかった場合を上回りました。"
      );
    }

    if (s.depletedMonthIndex != null) {
      messages.push(
        `${Simulation.monthLabel(s.depletedMonthIndex)}の時点で資産が尽き、以降は予定どおり取り崩せていません。`
      );
    }

    for (const skipped of result.skippedCrashes) {
      if (skipped.reason === "overlap") {
        messages.push(
          `「${skipped.data.eventName}」は前の暴落が回復し切る前の指定だったため、計算から除いています。` +
            `${Math.ceil(skipped.earliestStartYear)}年後以降にずらすと反映されます。`
        );
      } else if (skipped.reason === "out_of_range") {
        messages.push(
          `「${skipped.data.eventName}」は積立期間より後の指定のため、計算に反映されていません。`
        );
      }
    }

    for (const message of messages) {
      const p = elem("p", "insight", message);
      container.appendChild(p);
    }
  }

  function renderLegend(legendEl, result) {
    legendEl.textContent = "";

    const lineItems = [
      { name: "暴落あり", colorVar: "--series-1" },
      { name: "暴落なし（想定利回りのみ）", colorVar: "--series-2", dashed: true },
      { name: result.summary.hasWithdrawal ? "純拠出額" : "積立元本", colorVar: "--ink-muted" },
    ];

    for (const item of lineItems) {
      const li = elem("li", "legend__item");
      const key = elem("span", "legend__key" + (item.dashed ? " legend__key--dashed" : ""));
      key.style.setProperty("--key-color", `var(${item.colorVar})`);
      li.appendChild(key);
      li.appendChild(elem("span", null, item.name));
      legendEl.appendChild(li);
    }

    if (result.crashes.length) {
      const li = elem("li", "legend__item");
      li.appendChild(elem("span", "legend__key legend__key--band"));
      li.appendChild(elem("span", null, "暴落期間（実データ）"));
      legendEl.appendChild(li);
    }
  }

  function renderChart(container, result, startAge) {
    const s = result.summary;

    const series = [
      {
        id: "withCrash",
        name: "暴落あり",
        colorVar: "--series-1",
        points: result.series.map((p) => p.value),
        fill: true,
      },
      {
        id: "baseline",
        name: "暴落なし",
        colorVar: "--series-2",
        points: result.baselineSeries.map((p) => p.value),
        dashed: true,
      },
      {
        id: "principal",
        name: s.hasWithdrawal ? "純拠出額" : "積立元本",
        colorVar: "--ink-muted",
        points: result.series.map((p) => p.principal),
        muted: true,
      },
    ];

    const crashBands = result.crashes.map((c) => ({
      startMonth: c.peakMonthIndex,
      endMonth: c.endMonthIndex,
      label: c.eventName,
    }));

    const totalMonths = result.series.length - 1;
    const phaseSegments = result.phases
      .map(function (phase, i) {
        const next = result.phases[i + 1];
        const startMonth = Math.min(phase.startMonth, totalMonths);
        const endMonth = next ? Math.min(next.startMonth, totalMonths) : totalMonths;
        if (endMonth <= startMonth) return null;
        const amount = phase.monthlyAmount;
        return {
          startMonth: startMonth,
          endMonth: endMonth,
          mode: phase.mode,
          label:
            phase.mode === "pause"
              ? "停止"
              : MODE_LABELS[phase.mode] + " " + Math.round(amount / MAN * 10) / 10 + "万/月",
        };
      })
      .filter(Boolean);

    const eventNames = result.crashes.map((c) => c.eventName).join("・");

    Chart.render(container, {
      totalMonths: totalMonths,
      series: series,
      crashBands: crashBands,
      phaseSegments: phaseSegments,
      depletedMonth: s.depletedMonthIndex,
      startAge: startAge,
      ariaLabel: result.crashes.length
        ? `${eventNames}を織り込んだ資産推移グラフ。詳細は下の表を参照。`
        : "資産推移グラフ。詳細は下の表を参照。",
    });
  }

  /* ---------- 記事内のイベント一覧 ---------- */

  // イベントの「時期」と「特徴」は編集上の説明文なのでここに持つ。
  // 下落率・回復期間は events.json の実データから毎回計算する（表と実データをずらさないため）
  const EVENT_NOTES = {
    dotcom: { period: "2000年", note: "ハイテク株中心。回復が非常に長引いた" },
    lehman: { period: "2008年", note: "戦後最大級。世界同時株安" },
    corona: { period: "2020年", note: "急落・急回復。金融緩和が支えた" },
    trump2025: { period: "2025年", note: "関税政策をめぐる動揺。影響は限定的" },
    blackmonday: { period: "1987年", note: "1日での下落は史上最大級。回復は早い" },
    asian_currency: { period: "1997年", note: "米国株は軽微。日本株は長期低迷へ" },
    russia_ltcm: { period: "1998年", note: "急落したが短期で収束" },
    china_shock: { period: "2015年", note: "新興国指数への影響が大きい" },
    vix_shock: { period: "2018年", note: "変動率急騰による短期の急落" },
    svb: { period: "2023年", note: "金融不安に留まり株価への波及は小さい" },
  };

  /** 記事セクションのイベント一覧表を、実データの数値で埋め直す。 */
  function renderEventTable(tbody, eventsJson, catalog, referenceIndexId) {
    if (!tbody) return;
    tbody.textContent = "";

    for (const event of catalog.events) {
      const combination = Simulation.findCombination(eventsJson, event.id, referenceIndexId);
      const d = combination && Simulation.describeCombination(combination);
      const meta = EVENT_NOTES[event.id] || { period: "", note: "" };

      const tr = document.createElement("tr");
      const th = elem("th", null, event.name);
      th.scope = "row";
      tr.appendChild(th);

      const cells = [
        meta.period,
        d ? (d.dropRatio > 0.005 ? "−" + formatPercent(d.dropRatio, 0) : "下落なし") : "―",
        d ? formatMonths(d.recoveryMonths) : "―",
        meta.note,
      ];
      for (const text of cells) tr.appendChild(elem("td", null, text));
      tbody.appendChild(tr);
    }
  }

  /* ---------- 入力フォーム ---------- */

  /**
   * UIを初期化する。
   * @param {Object} eventsJson     data/events.json の中身
   * @param {Object} indexStatsJson data/index-stats.json の中身（想定利回りの参考値）
   */
  function init(eventsJson, indexStatsJson) {
    const catalog = buildCatalog(eventsJson);

    const form = document.getElementById("sim-form");
    const yearsInput = document.getElementById("input-years");
    const returnInput = document.getElementById("input-return");
    const initialInput = document.getElementById("input-initial");
    const ageInput = document.getElementById("input-age");

    const phaseList = document.getElementById("phase-list");
    const addPhaseButton = document.getElementById("add-phase");
    const crashList = document.getElementById("crash-list");
    const addCrashButton = document.getElementById("add-crash");
    const returnRefEl = document.getElementById("return-reference");

    const resultsSection = document.getElementById("results");
    const summaryEl = document.getElementById("result-summary");
    const breakdownEl = document.getElementById("result-breakdown");
    const insightEl = document.getElementById("result-insight");
    const chartEl = document.getElementById("result-chart");
    const legendEl = document.getElementById("result-legend");
    const tableEl = document.getElementById("result-table");
    const errorEl = document.getElementById("form-error");
    const sourceEl = document.getElementById("result-source");
    const simulatorSection = document.getElementById("simulator");
    const editConditionsButton = document.getElementById("edit-conditions");

    const digestBasicEl = document.getElementById("digest-basic");
    const digestPhasesEl = document.getElementById("digest-phases");
    const digestCrashesEl = document.getElementById("digest-crashes");

    // 画面上の並びと同じ順序で保持する。開始年は change のタイミングだけ並べ替える
    // 初期値は「S&P500に暴落が4回来る30年積立」。読み込み直後に run() で1回試算する
    const state = {
      phases: [{ startYear: 0, mode: "contribute", amountMan: 5 }],
      crashes: [
        { indexId: "sp500", eventId: "dotcom", startYear: 5 },
        { indexId: "sp500", eventId: "lehman", startYear: 15 },
        { indexId: "sp500", eventId: "corona", startYear: 22 },
        { indexId: "sp500", eventId: "trump2025", startYear: 24 },
      ],
    };

    /** 初期表示の想定利回りは、参考値のS&P500（実績CAGR）に合わせる。 */
    function applyDefaultReturn() {
      if (!indexStatsJson || !Array.isArray(indexStatsJson.indices)) return;
      const sp500 = indexStatsJson.indices.find((s) => s.indexId === "sp500");
      if (!sp500 || !sp500.full || !Number.isFinite(sp500.full.percent)) return;
      returnInput.value = sp500.full.percent.toFixed(1);
    }

    /** 閉じたパネルでも中身が分かるよう、見出し横の要約を更新する。 */
    function renderDigests() {
      if (digestBasicEl) {
        // run() と同じ既定値で読むので、空欄のときも試算に使われる値がそのまま出る
        digestBasicEl.textContent =
          `${readNumber(yearsInput, 30)}年 ／ 利回り ${readNumber(returnInput, 5)}%`;
      }

      if (digestPhasesEl) {
        if (state.phases.length === 1) {
          const only = state.phases[0];
          digestPhasesEl.textContent =
            only.mode === "pause"
              ? MODE_LABELS.pause
              : `${MODE_LABELS[only.mode]} 毎月${only.amountMan || 0}万円`;
        } else {
          digestPhasesEl.textContent = `${state.phases.length}期間（${state.phases
            .map((p) => MODE_LABELS[p.mode])
            .join("→")}）`;
        }
      }

      if (digestCrashesEl) {
        if (!state.crashes.length) {
          digestCrashesEl.textContent = "設定なし";
        } else {
          const names = state.crashes.map(function (crash) {
            const event = catalog.events.find((e) => e.id === crash.eventId);
            return event ? event.name : crash.eventId;
          });
          digestCrashesEl.textContent = `${state.crashes.length}件：${names.join("・")}`;
        }
      }
    }

    /* --- 想定利回りの参考値 --- */

    function renderReturnReference() {
      if (!returnRefEl) return;
      returnRefEl.textContent = "";
      if (!indexStatsJson || !Array.isArray(indexStatsJson.indices)) return;

      // いま選んでいる指数を先頭に出す（そのままクリックして入力に反映できるように）
      const selectedIds = state.crashes.map((c) => c.indexId);
      const sorted = indexStatsJson.indices.slice().sort(function (a, b) {
        const aSel = selectedIds.indexOf(a.indexId) !== -1 ? 0 : 1;
        const bSel = selectedIds.indexOf(b.indexId) !== -1 ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        return b.full.percent - a.full.percent;
      });

      const list = elem("ul", "ref-chips");
      for (const stat of sorted) {
        const li = elem("li");
        const button = elem("button", "ref-chip");
        button.type = "button";
        if (selectedIds.indexOf(stat.indexId) !== -1) button.classList.add("ref-chip--active");

        button.appendChild(elem("span", "ref-chip__name", stat.indexName));
        button.appendChild(elem("span", "ref-chip__value", stat.full.percent.toFixed(1) + "%"));
        button.appendChild(
          elem("span", "ref-chip__period", stat.full.from.slice(0, 4) + "〜" + stat.full.to.slice(0, 4))
        );
        button.title =
          `${stat.indexName}の年平均リターン ${stat.full.percent.toFixed(1)}%` +
          `（${stat.full.from}〜${stat.full.to}、${stat.dividendsIncluded ? "分配金込み" : "配当を含まない価格ベース"}）。` +
          "クリックすると想定利回りに入ります。";
        button.addEventListener("click", function () {
          returnInput.value = stat.full.percent.toFixed(1);
          run();
        });

        li.appendChild(button);
        list.appendChild(li);
      }
      returnRefEl.appendChild(list);
    }

    /* --- 拠出プラン --- */

    function renderPhases() {
      phaseList.textContent = "";

      state.phases.forEach(function (phase, i) {
        const row = elem("div", "plan-row");

        // 開始時期。1件目は必ず積立開始時点なので固定表示にする
        const whenField = elem("div", "plan-row__field plan-row__field--when");
        whenField.appendChild(elem("span", "plan-row__label", "開始"));
        if (i === 0) {
          whenField.appendChild(elem("span", "plan-row__fixed", "開始時から"));
        } else {
          const inputWrap = elem("div", "plan-row__inline");
          const yearInput = document.createElement("input");
          yearInput.type = "number";
          yearInput.min = "0";
          yearInput.step = "1";
          yearInput.inputMode = "numeric";
          yearInput.value = phase.startYear;
          yearInput.setAttribute("aria-label", `${i + 1}番目の期間の開始年`);
          yearInput.addEventListener("input", function () {
            phase.startYear = readNumber(yearInput, phase.startYear);
            run();
          });
          // 並べ替えは入力途中で行うと行が動いてしまうので、確定時だけにする
          yearInput.addEventListener("change", function () {
            sortPhases();
            renderPhases();
            run();
          });
          inputWrap.appendChild(yearInput);
          inputWrap.appendChild(elem("span", "plan-row__unit", "年後から"));
          whenField.appendChild(inputWrap);
        }
        row.appendChild(whenField);

        // 種別
        const modeField = elem("div", "plan-row__field");
        modeField.appendChild(elem("span", "plan-row__label", "種別"));
        const modeSelect = document.createElement("select");
        modeSelect.setAttribute("aria-label", `${i + 1}番目の期間の種別`);
        for (const mode of ["contribute", "pause", "withdraw"]) {
          const option = document.createElement("option");
          option.value = mode;
          option.textContent = MODE_LABELS[mode];
          modeSelect.appendChild(option);
        }
        modeSelect.value = phase.mode;
        modeField.appendChild(modeSelect);
        row.appendChild(modeField);

        // 金額（停止のときは入力不要）
        const amountField = elem("div", "plan-row__field");
        amountField.appendChild(elem("span", "plan-row__label", "毎月の金額"));
        const amountWrap = elem("div", "plan-row__inline");
        const amountInput = document.createElement("input");
        amountInput.type = "number";
        amountInput.min = "0";
        amountInput.step = "0.1";
        amountInput.inputMode = "decimal";
        amountInput.value = phase.amountMan;
        amountInput.setAttribute("aria-label", `${i + 1}番目の期間の毎月の金額（万円）`);
        amountInput.addEventListener("input", function () {
          phase.amountMan = readNumber(amountInput, phase.amountMan);
          run();
        });
        amountWrap.appendChild(amountInput);
        amountWrap.appendChild(elem("span", "plan-row__unit", "万円"));
        amountField.appendChild(amountWrap);
        row.appendChild(amountField);

        function syncAmountVisibility() {
          const disabled = phase.mode === "pause";
          amountInput.disabled = disabled;
          amountField.classList.toggle("plan-row__field--disabled", disabled);
        }
        syncAmountVisibility();

        modeSelect.addEventListener("change", function () {
          phase.mode = modeSelect.value;
          syncAmountVisibility();
          run();
        });

        row.appendChild(buildRemoveButton(i === 0 ? null : function () {
          state.phases.splice(i, 1);
          renderPhases();
          run();
        }, "この期間を削除"));

        phaseList.appendChild(row);
      });
    }

    function sortPhases() {
      state.phases.sort(function (a, b) {
        return a.startYear - b.startYear;
      });
      state.phases[0].startYear = 0;
    }

    function buildRemoveButton(onClick, label) {
      const button = elem("button", "plan-row__remove");
      button.type = "button";
      button.textContent = "×";
      button.title = label;
      button.setAttribute("aria-label", label);
      if (!onClick) {
        button.disabled = true;
      } else {
        button.addEventListener("click", onClick);
      }
      return button;
    }

    /* --- 暴落シナリオ --- */

    function renderCrashes() {
      crashList.textContent = "";

      state.crashes.forEach(function (crash, i) {
        const row = elem("div", "plan-row plan-row--crash");

        const badge = elem("span", "plan-row__badge", String(i + 1));
        row.appendChild(badge);

        // 指数を先に選ぶ。イベントの下落率はどの指数で見るかによって変わるため
        const indexField = elem("div", "plan-row__field");
        indexField.appendChild(elem("span", "plan-row__label", "指数"));
        const indexSelect = document.createElement("select");
        indexSelect.setAttribute("aria-label", `${i + 1}番目の暴落で使う指数`);
        setOptions(indexSelect, catalog.indices, crash.indexId);
        indexField.appendChild(indexSelect);
        row.appendChild(indexField);

        const eventField = elem("div", "plan-row__field plan-row__field--wide");
        eventField.appendChild(elem("span", "plan-row__label", "暴落イベント"));
        const eventSelect = document.createElement("select");
        eventSelect.setAttribute("aria-label", `${i + 1}番目の暴落イベント`);
        eventField.appendChild(eventSelect);
        row.appendChild(eventField);

        const whenField = elem("div", "plan-row__field plan-row__field--when");
        whenField.appendChild(elem("span", "plan-row__label", "発生"));
        const whenWrap = elem("div", "plan-row__inline");
        const yearInput = document.createElement("input");
        yearInput.type = "number";
        yearInput.min = "0";
        yearInput.step = "1";
        yearInput.inputMode = "numeric";
        yearInput.value = crash.startYear;
        yearInput.setAttribute("aria-label", `${i + 1}番目の暴落の発生タイミング（積立開始から何年後）`);
        yearInput.addEventListener("input", function () {
          crash.startYear = readNumber(yearInput, crash.startYear);
          run();
        });
        whenWrap.appendChild(yearInput);
        whenWrap.appendChild(elem("span", "plan-row__unit", "年後"));
        whenField.appendChild(whenWrap);
        row.appendChild(whenField);

        row.appendChild(
          buildRemoveButton(function () {
            state.crashes.splice(i, 1);
            renderCrashes();
            renderReturnReference();
            run();
          }, "この暴落を削除")
        );

        // 選択中の組み合わせの規模を、行の下にバーで示す
        const gauge = elem("div", "crash-gauge");
        row.appendChild(gauge);

        function refreshEventOptions() {
          const options = catalog.eventsFor(crash.indexId).map(function (event) {
            const combination = Simulation.findCombination(eventsJson, event.id, crash.indexId);
            return { id: event.id, label: eventOptionLabel(event.name, combination) };
          });
          crash.eventId = setOptions(eventSelect, options, crash.eventId);
          refreshGauge();
        }

        function refreshGauge() {
          gauge.textContent = "";
          const combination = Simulation.findCombination(eventsJson, crash.eventId, crash.indexId);
          const d = combination && Simulation.describeCombination(combination);
          if (!d) return;

          const bar = elem("div", "crash-gauge__bar");
          const fill = elem("div", "crash-gauge__fill");
          // 目盛りは下落80%を上限にした固定スケール。行をまたいで大きさを比べられるようにする
          fill.style.width = Math.max(1.5, Math.min(100, (d.dropRatio / 0.8) * 100)) + "%";
          bar.appendChild(fill);
          gauge.appendChild(bar);

          gauge.appendChild(
            elem(
              "span",
              "crash-gauge__text",
              (d.dropRatio > 0.005 ? "下落 −" + formatPercent(d.dropRatio) : "月次終値では下落なし") +
                ` ／ 高値回復まで ${formatMonths(d.recoveryMonths)}` +
                ` ／ ${d.preCrashHighDate.slice(0, 7)}〜${d.recoveryDate ? d.recoveryDate.slice(0, 7) : "―"}`
            )
          );
        }

        indexSelect.addEventListener("change", function () {
          crash.indexId = indexSelect.value;
          // その指数でデータが無いイベントを選んでいた場合は、先頭の候補に寄せる
          refreshEventOptions();
          renderReturnReference();
          run();
        });

        eventSelect.addEventListener("change", function () {
          crash.eventId = eventSelect.value;
          refreshGauge();
          run();
        });

        refreshEventOptions();
        crashList.appendChild(row);
      });

      addCrashButton.disabled = state.crashes.length >= 5;
    }

    /**
     * 追加する暴落の初期タイミングを決める。
     * 既存の暴落が回復し終わったあとに置くことで、いきなり重なりの警告が出ないようにする。
     */
    function nextCrashStartYear() {
      const years = readNumber(yearsInput, 30);
      let earliest = 5;
      for (const crash of state.crashes) {
        const combination = Simulation.findCombination(eventsJson, crash.eventId, crash.indexId);
        const months = combination ? combination.monthlyReturns.length : 0;
        earliest = Math.max(earliest, Math.ceil(crash.startYear + months / 12));
      }
      return Math.min(earliest, Math.max(0, Math.floor(years) - 1));
    }

    /* --- 実行 --- */

    function showError(message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      resultsSection.hidden = true;
    }

    function clearError() {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }

    /**
     * 現在の年齢は任意入力。未入力・範囲外なら null を返し、グラフに年齢を出さない。
     * 計算そのものには使わない（表示だけの値）。
     */
    function readStartAge() {
      const age = readNumber(ageInput, NaN);
      if (!Number.isFinite(age) || age < 0 || age > 120) return null;
      return Math.floor(age);
    }

    function run() {
      renderDigests();

      const years = readNumber(yearsInput, 30);
      if (!(years > 0)) return showError("運用期間は1年以上で入力してください。");
      if (years > 60) return showError("運用期間は60年以内で入力してください。");

      const phases = state.phases.map(function (phase) {
        return {
          startYear: Math.max(0, phase.startYear || 0),
          mode: phase.mode,
          monthlyAmount: Math.max(0, phase.amountMan || 0) * MAN,
        };
      });

      const crashes = [];
      for (const crash of state.crashes) {
        const data = Simulation.findCombination(eventsJson, crash.eventId, crash.indexId);
        if (!data) continue;
        crashes.push({ startYear: Math.max(0, crash.startYear || 0), data: data });
      }

      let result;
      try {
        result = Simulation.simulate({
          years: years,
          annualReturnPercent: readNumber(returnInput, 5),
          initialPrincipal: Math.max(0, readNumber(initialInput, 0)) * MAN,
          phases: phases,
          crashes: crashes,
        });
      } catch (e) {
        return showError(e.message);
      }

      clearError();
      resultsSection.hidden = false;

      renderChart(chartEl, result, readStartAge());
      renderLegend(legendEl, result);
      renderSummary(summaryEl, result);
      renderInsights(insightEl, result);
      renderCrashBreakdown(breakdownEl, result);

      tableEl.textContent = "";
      tableEl.appendChild(buildTable(result));

      sourceEl.textContent = result.crashes.length
        ? "暴落期間の値動きは " +
          result.crashes
            .map((c) => `${c.eventName}×${c.indexName}（${c.preCrashHighDate}〜${c.recoveryDate || "―"}）`)
            .join("、") +
          " の実際の月次終値を使用しています。"
        : "暴落を設定していないため、全期間を想定利回りで試算しています。";
    }

    /* --- 初期化 --- */

    addPhaseButton.addEventListener("click", function () {
      const last = state.phases[state.phases.length - 1];
      const years = readNumber(yearsInput, 30);
      const startYear = Math.min(Math.max(1, (last.startYear || 0) + 5), Math.max(1, Math.floor(years) - 1));
      // 「積立 → 停止 → 取り崩し」の順に足していくのが自然なので、その順で提案する
      const nextMode = last.mode === "contribute" ? "pause" : "withdraw";
      state.phases.push({ startYear: startYear, mode: nextMode, amountMan: nextMode === "withdraw" ? 10 : 0 });
      sortPhases();
      renderPhases();
      run();
    });

    addCrashButton.addEventListener("click", function () {
      const indexId = state.crashes.length ? state.crashes[state.crashes.length - 1].indexId : "sp500";
      const events = catalog.eventsFor(indexId);
      state.crashes.push({
        indexId: indexId,
        eventId: events.length ? events[0].id : "corona",
        startYear: nextCrashStartYear(),
      });
      renderCrashes();
      renderReturnReference();
      run();
    });

    function scrollToSection(target) {
      if (!target || typeof target.scrollIntoView !== "function") return;
      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }

    /** 実行ボタンはフォーム下端に貼り付いているので、押したらグラフまで戻す。 */
    function scrollToResults() {
      if (resultsSection.hidden) return;
      scrollToSection(resultsSection);
    }

    /** グラフ直下の「条件を変更する」。結果を見た流れで入力欄へ戻す導線。 */
    if (editConditionsButton) {
      editConditionsButton.addEventListener("click", function () {
        scrollToSection(simulatorSection);
        // スクロールだけだとキーボード操作の位置が結果側に残るので、フォーカスも移す
        if (simulatorSection && typeof simulatorSection.focus === "function") {
          simulatorSection.focus({ preventScroll: true });
        }
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      run();
      scrollToResults();
    });
    // 基本条件の入力欄は静的なので、それぞれに input を張れば足りる
    yearsInput.addEventListener("input", run);
    returnInput.addEventListener("input", run);
    initialInput.addEventListener("input", run);
    ageInput.addEventListener("input", run);

    applyDefaultReturn();
    renderPhases();
    renderCrashes();
    renderReturnReference();
    renderEventTable(document.getElementById("event-table-body"), eventsJson, catalog, "sp500");
    run();
  }

  return {
    init: init,
    buildCatalog: buildCatalog,
    formatYen: formatYen,
    formatMonths: formatMonths,
    eventOptionLabel: eventOptionLabel,
  };
});
