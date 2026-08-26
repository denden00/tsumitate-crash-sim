/**
 * 積立投資シミュレーションのコアロジック。
 *
 * 計算モデル（docs/spec.md 4.2 ／ CLAUDE.md「計算ロジック」準拠）:
 *
 *  1. 通常期間（暴落発生前 ／ 実データでの回復完了後）
 *     ユーザー入力の想定利回り（年率）で複利計算する。
 *
 *  2. 暴落発生〜回復完了までの期間
 *     想定利回りは使わず、選択した暴落イベント×指数の実際の月次終値を
 *     そのまま資産推移に反映する。この期間も拠出（または取り崩し）は続き、
 *     その時点の実際の価格で口数を売買する（ドルコスト平均法効果の実データ再現）。
 *
 *  3. 「回復完了」の判定基準
 *     指数が暴落前の高値を上回った月（events.json の recovery）。
 *     資産評価額や積立元本は判定基準にしない。
 *
 * 拠出タイミングは「期末拠出」で統一している。
 * （その月の運用結果が出たあとに積立額を投入する。日本の積立シミュレーターで
 *  一般的な年金終価係数 {(1+r)^n - 1} / r と同じ前提。）
 *
 * 拡張（2026-08-26）:
 *  - 暴落は複数回指定できる（input.crashes）。期間が重なる指定はスキップして理由を返す。
 *  - 拠出プランは「積立 / 停止 / 取り崩し」のフェーズ列で指定する（input.phases）。
 *    取り崩しは負の拠出として扱い、資産が尽きたらそこで止まる。
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    global.Simulation = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PHASE_NORMAL = "normal";
  const PHASE_CRASH = "crash";

  const MODE_CONTRIBUTE = "contribute";
  const MODE_PAUSE = "pause";
  const MODE_WITHDRAW = "withdraw";
  const MODES = [MODE_CONTRIBUTE, MODE_PAUSE, MODE_WITHDRAW];

  /**
   * 年率利回りを月利に換算する。
   *
   * 幾何平均換算 (1+r)^(1/12)-1 ではなく 年率÷12 を使う。
   * 金融庁・各証券会社の積立シミュレーターがこの単純換算を採用しており、
   * ユーザーが他サイトの試算結果と見比べたときに数字が揃うことを優先する。
   */
  function toMonthlyRate(annualReturnPercent) {
    return annualReturnPercent / 100 / 12;
  }

  /** 積立開始からの経過月数を「N年Mヶ月」形式にする。 */
  function monthLabel(monthIndex) {
    const y = Math.floor(monthIndex / 12);
    const m = monthIndex % 12;
    return y + "年" + m + "ヶ月";
  }

  /**
   * 拠出プランを正規化する。
   *
   * phases が無ければ monthlyContribution から単一の積立フェーズを作る
   * （旧シグネチャとの互換のため）。
   */
  function normalizePhases(input, errors) {
    let phases = input.phases;

    if (!Array.isArray(phases) || phases.length === 0) {
      phases = [
        {
          startYear: 0,
          mode: MODE_CONTRIBUTE,
          monthlyAmount: input.monthlyContribution || 0,
        },
      ];
    }

    const normalized = phases.map(function (p, i) {
      const mode = p.mode || MODE_CONTRIBUTE;
      const amount = p.monthlyAmount != null ? p.monthlyAmount : p.amount;

      if (MODES.indexOf(mode) === -1) {
        errors.push(`${i + 1}番目の期間の種別「${mode}」は指定できません。`);
      }
      if (!(p.startYear >= 0)) {
        errors.push(`${i + 1}番目の期間の開始年は0以上で指定してください。`);
      }
      if (mode !== MODE_PAUSE && !(amount >= 0)) {
        errors.push(`${i + 1}番目の期間の金額は0以上で指定してください。`);
      }

      return {
        startYear: p.startYear,
        startMonth: Math.round((p.startYear || 0) * 12),
        mode: mode,
        monthlyAmount: mode === MODE_PAUSE ? 0 : amount || 0,
      };
    });

    normalized.sort(function (a, b) {
      return a.startMonth - b.startMonth;
    });
    return normalized;
  }

  /**
   * 月ごとの資金の出入り（円）を配列にする。
   * 正が拠出、負が取り崩し、0が停止。index は「その月の期末」を指す（1始まり）。
   */
  function buildMonthlyFlows(phases, totalMonths) {
    const flows = new Array(totalMonths + 1).fill(0);
    const modes = new Array(totalMonths + 1).fill(MODE_PAUSE);

    for (let m = 1; m <= totalMonths; m++) {
      // 「N年後から」= N*12ヶ月目の期末から適用する
      let active = null;
      for (const phase of phases) {
        if (phase.startMonth < m) active = phase;
        else break;
      }
      if (!active) continue;

      modes[m] = active.mode;
      if (active.mode === MODE_CONTRIBUTE) flows[m] = active.monthlyAmount;
      else if (active.mode === MODE_WITHDRAW) flows[m] = -active.monthlyAmount;
    }
    return { flows: flows, modes: modes };
  }

  /**
   * 暴落の指定を正規化し、適用できるものと弾いたものに分ける。
   *
   * 弾く条件:
   *   - out_of_range … 発生タイミングが積立期間より後
   *   - overlap      … ひとつ前の暴落が回復し終わる前に発生する指定
   *                    （実データを2つ重ねて適用する意味のある方法が無いため）
   */
  function normalizeCrashes(input, totalMonths, errors) {
    let raw = input.crashes;

    if (!Array.isArray(raw)) {
      raw =
        input.crashStartYear != null || input.crashData
          ? [{ startYear: input.crashStartYear, data: input.crashData }]
          : [];
    }

    const candidates = [];
    raw.forEach(function (c, i) {
      const data = c.data || c.crashData;
      const startYear = c.startYear != null ? c.startYear : c.crashStartYear;

      if (startYear == null) return;
      if (!(startYear >= 0)) {
        errors.push(`${i + 1}番目の暴落の発生タイミングは0以上で指定してください。`);
        return;
      }
      if (!data) {
        errors.push(`${i + 1}番目の暴落に実データ（crashData）が指定されていません。`);
        return;
      }
      if (!Array.isArray(data.monthlyReturns) || data.monthlyReturns.length === 0) {
        errors.push(`${i + 1}番目の暴落の monthlyReturns が空です。`);
        return;
      }
      if (!data.preCrashHigh || !(data.preCrashHigh.close > 0)) {
        errors.push(`${i + 1}番目の暴落の preCrashHigh.close が不正です。`);
        return;
      }

      candidates.push({ order: i, startYear: startYear, peakMonth: Math.round(startYear * 12), data: data });
    });

    candidates.sort(function (a, b) {
      return a.peakMonth - b.peakMonth;
    });

    const applied = [];
    const skipped = [];
    let previousEnd = 0;

    for (const c of candidates) {
      if (c.peakMonth >= totalMonths) {
        skipped.push({ order: c.order, data: c.data, startYear: c.startYear, reason: "out_of_range" });
        continue;
      }
      if (c.peakMonth < previousEnd) {
        skipped.push({
          order: c.order,
          data: c.data,
          startYear: c.startYear,
          reason: "overlap",
          // 前の暴落が回復し終わる年。UIの「何年後以降なら指定できるか」に使う
          earliestStartYear: previousEnd / 12,
        });
        continue;
      }

      const endMonth = Math.min(c.peakMonth + c.data.monthlyReturns.length, totalMonths);
      applied.push({
        order: c.order,
        data: c.data,
        startYear: c.startYear,
        peakMonth: c.peakMonth,
        endMonth: endMonth,
        appliedMonths: endMonth - c.peakMonth,
        truncated: endMonth - c.peakMonth < c.data.monthlyReturns.length,
      });
      previousEnd = endMonth;
    }

    return { applied: applied, skipped: skipped };
  }

  function validateBaseInput(input, errors) {
    if (!(input.years > 0)) {
      errors.push("積立期間は1以上の数値で指定してください。");
    }
    if (typeof input.annualReturnPercent !== "number" || Number.isNaN(input.annualReturnPercent)) {
      errors.push("想定利回りは数値で指定してください。");
    }
    if (input.initialPrincipal != null && !(input.initialPrincipal >= 0)) {
      errors.push("初期投資元本は0以上の数値で指定してください。");
    }
  }

  /**
   * 取り崩し額を、その時点の資産で賄える範囲に丸める。
   * 資産を超えて引き出すことはできない（マイナス残高にはしない）。
   */
  function clampFlow(flow, available) {
    if (flow >= 0) return flow;
    return -Math.min(-flow, Math.max(0, available));
  }

  /**
   * ひとつの暴落について、資産評価額のドローダウンと回復月数を測る。
   *
   * ピークは「暴落開始直前の月」に固定せず、暴落期間の中を走査して更新する。
   * 積立を続けていると暴落の初月はまだ評価額が伸びることがあり、直前月に
   * 固定すると下落幅を取りこぼすうえ、回復判定が初月で成立してしまうため。
   *
   * 取り崩し期間中はそもそも資産が減っていくので、この数字は暴落単独の影響では
   * ない点に注意（UI側で注記する）。
   */
  function measureCrash(series, crash) {
    const windowEnd = Math.min(crash.endMonth, series.length - 1);

    let runningPeakValue = -Infinity;
    let runningPeakMonth = crash.peakMonth;
    let peakValue = series[crash.peakMonth].value;
    let peakMonthIndex = crash.peakMonth;
    let troughValue = peakValue;
    let troughMonthIndex = crash.peakMonth;
    let ratio = 0;

    for (let m = crash.peakMonth; m <= windowEnd; m++) {
      const v = series[m].value;
      if (v > runningPeakValue) {
        runningPeakValue = v;
        runningPeakMonth = m;
      }
      if (runningPeakValue > 0) {
        const candidate = (runningPeakValue - v) / runningPeakValue;
        if (candidate > ratio) {
          ratio = candidate;
          peakValue = runningPeakValue;
          peakMonthIndex = runningPeakMonth;
          troughValue = v;
          troughMonthIndex = m;
        }
      }
    }

    const amount = peakValue - troughValue;

    let assetRecoveryMonths = null;
    if (ratio <= 0) {
      assetRecoveryMonths = 0;
    } else {
      for (let m = peakMonthIndex + 1; m < series.length; m++) {
        if (series[m].value >= peakValue) {
          assetRecoveryMonths = m - peakMonthIndex;
          break;
        }
      }
    }

    // この暴落の期間に取り崩し（＝資産を減らす動き）が重なっていたか。
    // 重なっていると資産のドローダウンは暴落単独の影響ではなくなるので、UIで注記する
    let includesWithdrawal = false;
    for (let m = crash.peakMonth + 1; m <= windowEnd; m++) {
      if (series[m].mode === MODE_WITHDRAW) {
        includesWithdrawal = true;
        break;
      }
    }

    // 指数そのものの下落率（実データ）。資産評価額と違い、拠出の影響を受けない
    let lowestClose = crash.data.preCrashHigh.close;
    let troughDate = crash.data.preCrashHigh.date;
    for (let i = 0; i < crash.appliedMonths; i++) {
      const entry = crash.data.monthlyReturns[i];
      if (entry.close < lowestClose) {
        lowestClose = entry.close;
        troughDate = entry.date;
      }
    }

    return {
      eventId: crash.data.eventId,
      eventName: crash.data.eventName,
      indexId: crash.data.indexId,
      indexName: crash.data.indexName,
      startYear: crash.startYear,
      peakMonthIndex: crash.peakMonth,
      endMonthIndex: crash.endMonth,
      truncated: crash.truncated,
      indexRecoveryMonths: crash.data.monthlyReturns.length,
      indexDropRatio: 1 - lowestClose / crash.data.preCrashHigh.close,
      indexTroughDate: troughDate,
      preCrashHighDate: crash.data.preCrashHigh.date,
      recoveryDate: crash.data.recovery ? crash.data.recovery.date : null,
      assetDrawdown: {
        ratio: ratio,
        amount: amount,
        peakMonthIndex: peakMonthIndex,
        troughMonthIndex: troughMonthIndex,
        peakValue: peakValue,
        troughValue: troughValue,
      },
      assetRecoveryMonths: assetRecoveryMonths,
      includesWithdrawal: includesWithdrawal,
    };
  }

  /**
   * 積立シミュレーションを実行する。
   *
   * @param {Object} input
   * @param {number} input.years                 積立期間（年）
   * @param {number} input.annualReturnPercent   想定利回り（年率%）
   * @param {number} [input.initialPrincipal=0]  初期投資元本（円）
   * @param {Array}  [input.phases]              拠出プラン
   *        [{ startYear, mode: "contribute"|"pause"|"withdraw", monthlyAmount }]
   *        省略時は input.monthlyContribution による単一の積立フェーズとして扱う
   * @param {Array}  [input.crashes]             暴落の指定 [{ startYear, data }]
   *        省略時は input.crashStartYear / input.crashData を1件として扱う
   */
  function simulate(input) {
    const errors = [];
    validateBaseInput(input, errors);

    const totalMonths = Math.round((input.years || 0) * 12);
    const phases = normalizePhases(input, errors);
    const crashPlan = totalMonths > 0 ? normalizeCrashes(input, totalMonths, errors) : { applied: [], skipped: [] };

    if (errors.length) throw new Error(errors.join("\n"));

    const initialPrincipal = input.initialPrincipal || 0;
    const monthlyRate = toMonthlyRate(input.annualReturnPercent);
    const schedule = buildMonthlyFlows(phases, totalMonths);
    const flows = schedule.flows;
    const flowModes = schedule.modes;

    // 月 → その月に適用する暴落データ（何番目の暴落の、何ヶ月目か）
    const crashAt = new Array(totalMonths + 1).fill(null);
    crashPlan.applied.forEach(function (crash, crashIndex) {
      for (let m = crash.peakMonth + 1; m <= crash.endMonth; m++) {
        crashAt[m] = { crashIndex: crashIndex, offset: m - crash.peakMonth, crash: crash };
      }
    });

    const series = [];
    const baselineSeries = [];

    let value = initialPrincipal;
    let baselineValue = initialPrincipal;
    let contributed = 0;
    let withdrawn = 0;

    // 暴落期間中だけ「口数×単価」で資産を追跡する
    let units = null;
    let unitPrice = null;
    let depletedMonthIndex = null;

    function push(monthIndex, phase, indexPrice, dataDate, crashIndex, mode) {
      series.push({
        monthIndex: monthIndex,
        label: monthLabel(monthIndex),
        phase: phase,
        mode: mode,
        // 純拠出額（初期元本 + 累計拠出 − 累計取り崩し）。取り崩しが進むと減る
        principal: initialPrincipal + contributed - withdrawn,
        contributed: contributed,
        withdrawn: withdrawn,
        value: value,
        indexPrice: indexPrice,
        dataDate: dataDate,
        crashIndex: crashIndex,
      });
    }

    push(0, PHASE_NORMAL, null, null, null, flowModes[1] || MODE_PAUSE);
    baselineSeries.push({ monthIndex: 0, principal: initialPrincipal, value: baselineValue });

    for (let m = 1; m <= totalMonths; m++) {
      const requestedFlow = flows[m];

      // 暴落なしの比較系列は常に想定利回りで回す（拠出プランは同じ）
      const baselineGrown = baselineValue * (1 + monthlyRate);
      baselineValue = baselineGrown + clampFlow(requestedFlow, baselineGrown);

      const hit = crashAt[m];
      let dataDate = null;
      let actualFlow;

      if (hit) {
        if (hit.offset === 1) {
          // 暴落開始。直前月の評価額を暴落前高値の価格で口数に換算する
          unitPrice = hit.crash.data.preCrashHigh.close;
          units = unitPrice > 0 ? value / unitPrice : 0;
        }
        const entry = hit.crash.data.monthlyReturns[hit.offset - 1];
        unitPrice = entry.close;
        // まずその月の実際の価格まで評価額を動かし、そのあと期末に売買する
        value = units * unitPrice;
        actualFlow = clampFlow(requestedFlow, value);
        units += actualFlow / unitPrice;
        if (units < 0) units = 0;
        value = units * unitPrice;
        dataDate = entry.date;
      } else {
        const grown = value * (1 + monthlyRate);
        actualFlow = clampFlow(requestedFlow, grown);
        value = grown + actualFlow;
        units = null;
        unitPrice = null;
      }

      if (actualFlow > 0) contributed += actualFlow;
      else if (actualFlow < 0) withdrawn += -actualFlow;

      // 取り崩したい額を出せなくなった時点＝資産が尽きた月
      if (depletedMonthIndex === null && requestedFlow < 0 && actualFlow > requestedFlow + 0.005) {
        depletedMonthIndex = m;
      }

      push(
        m,
        hit ? PHASE_CRASH : PHASE_NORMAL,
        hit ? unitPrice : null,
        dataDate,
        hit ? hit.crashIndex : null,
        flowModes[m]
      );
      baselineSeries.push({ monthIndex: m, principal: initialPrincipal + contributed - withdrawn, value: baselineValue });
    }

    const crashStats = crashPlan.applied.map(function (crash) {
      return measureCrash(series, crash);
    });

    // 代表値には「資産の下落がいちばん大きかった暴落」を採用する
    let worst = null;
    for (const stat of crashStats) {
      if (!worst || stat.assetDrawdown.ratio > worst.assetDrawdown.ratio) worst = stat;
    }

    const last = series[series.length - 1];
    const finalBaselineValue = baselineSeries[baselineSeries.length - 1].value;

    return {
      series: series,
      baselineSeries: baselineSeries,
      phases: phases,
      crashes: crashStats,
      skippedCrashes: crashPlan.skipped,
      summary: {
        finalValue: last.value,
        finalPrincipal: last.principal,
        finalProfit: last.value - last.principal,
        totalContributed: contributed,
        totalWithdrawn: withdrawn,
        finalBaselineValue: finalBaselineValue,
        // 暴落なしとの差額。暴落中の安値で口数を多く買えた結果、
        // プラスになることもある（このツールで見せたい示唆のひとつ）
        crashImpact: last.value - finalBaselineValue,
        hasCrash: crashStats.length > 0,
        crashCount: crashStats.length,
        depletedMonthIndex: depletedMonthIndex,
        hasWithdrawal: withdrawn > 0,
        // 以下は「いちばん下落が大きかった暴落」の値（単一暴落なら従来と同じ）
        maxDrawdown: worst
          ? worst.assetDrawdown
          : { ratio: 0, amount: 0, peakMonthIndex: 0, troughMonthIndex: 0, peakValue: 0, troughValue: 0 },
        assetRecoveryMonths: worst ? worst.assetRecoveryMonths : 0,
        indexRecoveryMonths: worst ? worst.indexRecoveryMonths : null,
        crashPeakMonthIndex: worst ? worst.peakMonthIndex : null,
        crashEndMonthIndex: worst ? worst.endMonthIndex : null,
        // 回復途中で積立期間が終わった暴落がひとつでもあれば true
        crashTruncated: crashStats.some(function (c) {
          return c.truncated;
        }),
      },
    };
  }

  /** events.json から指定のイベント×指数の組み合わせを取り出す。無ければ null。 */
  function findCombination(eventsJson, eventId, indexId) {
    if (!eventsJson || !Array.isArray(eventsJson.combinations)) return null;
    return (
      eventsJson.combinations.find(function (c) {
        return c.eventId === eventId && c.indexId === indexId;
      }) || null
    );
  }

  /**
   * 暴落の「大きさ」を実データから測る。イベント選択UIのラベルに使う。
   * 月次終値ベースなので、報道で見る日次ベースの下落率より小さく出る。
   */
  function describeCombination(combination) {
    if (!combination || !combination.monthlyReturns || !combination.monthlyReturns.length) return null;

    const high = combination.preCrashHigh.close;
    let lowest = high;
    let troughDate = combination.preCrashHigh.date;
    let troughIndex = 0;

    combination.monthlyReturns.forEach(function (entry, i) {
      if (entry.close < lowest) {
        lowest = entry.close;
        troughDate = entry.date;
        troughIndex = i + 1;
      }
    });

    return {
      dropRatio: 1 - lowest / high,
      troughDate: troughDate,
      // 高値 → 底 までの月数と、高値 → 高値回復 までの月数
      declineMonths: troughIndex,
      recoveryMonths: combination.monthlyReturns.length,
      preCrashHighDate: combination.preCrashHigh.date,
      recoveryDate: combination.recovery ? combination.recovery.date : null,
    };
  }

  return {
    simulate: simulate,
    findCombination: findCombination,
    describeCombination: describeCombination,
    toMonthlyRate: toMonthlyRate,
    monthLabel: monthLabel,
    PHASE_NORMAL: PHASE_NORMAL,
    PHASE_CRASH: PHASE_CRASH,
    MODE_CONTRIBUTE: MODE_CONTRIBUTE,
    MODE_PAUSE: MODE_PAUSE,
    MODE_WITHDRAW: MODE_WITHDRAW,
  };
});
