/**
 * js/simulation.js の検証テスト。
 * テストフレームワークは使わない（ビルドツールを持ち込まない方針のため）。
 *
 * 実行: node test/simulation.test.js
 */
"use strict";

const path = require("path");
const Simulation = require(path.join(__dirname, "..", "js", "simulation.js"));
const events = require(path.join(__dirname, "..", "data", "events.json"));

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? "\n        " + detail : ""}`);
  }
}

function closeTo(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

// --- 1. 暴落なしのとき、年金終価係数による理論値と一致すること ---
console.log("\n[1] 暴落なし: 年金終価係数と一致するか");
{
  const monthlyContribution = 30000;
  const years = 20;
  const annualReturnPercent = 5;
  const initialPrincipal = 1000000;

  const result = Simulation.simulate({
    monthlyContribution,
    years,
    annualReturnPercent,
    initialPrincipal,
  });

  const r = annualReturnPercent / 100 / 12;
  const n = years * 12;
  const expected =
    initialPrincipal * Math.pow(1 + r, n) + monthlyContribution * ((Math.pow(1 + r, n) - 1) / r);

  check(
    "最終評価額が理論値と一致する",
    closeTo(result.summary.finalValue, expected, 1),
    `actual=${result.summary.finalValue.toFixed(2)} expected=${expected.toFixed(2)}`
  );
  check(
    "元本が 初期元本 + 毎月積立額×月数 と一致する",
    result.summary.finalPrincipal === initialPrincipal + monthlyContribution * n,
    `actual=${result.summary.finalPrincipal}`
  );
  check("暴落なしのときドローダウンは0", result.summary.maxDrawdown.ratio === 0);
  check("暴落なしのとき hasCrash=false", result.summary.hasCrash === false);
  check("系列の長さが 月数+1（0ヶ月目を含む）", result.series.length === n + 1);
}

// --- 2. 暴落期間中、実データの月次終値がそのまま反映されること ---
console.log("\n[2] 暴落期間: 実データが反映されるか");
{
  // 初期元本のみ・積立額0にすると、暴落期間の資産推移は指数の値動きそのものになる
  const crashData = Simulation.findCombination(events, "corona", "sp500");
  const crashStartYear = 5;

  const result = Simulation.simulate({
    monthlyContribution: 0,
    years: 20,
    annualReturnPercent: 5,
    initialPrincipal: 1000000,
    crashStartYear,
    crashData,
  });

  const peakMonth = crashStartYear * 12;
  const valueAtPeak = result.series[peakMonth].value;

  // 積立額0なら、暴落中の評価額は「ピーク時評価額 × (その月の終値 / 暴落前高値)」になるはず
  let allMatch = true;
  let firstMismatch = null;
  crashData.monthlyReturns.forEach((entry, i) => {
    const expected = valueAtPeak * (entry.close / crashData.preCrashHigh.close);
    const actual = result.series[peakMonth + 1 + i].value;
    if (!closeTo(actual, expected, 0.01)) {
      allMatch = false;
      if (!firstMismatch) firstMismatch = `月${peakMonth + 1 + i}: actual=${actual} expected=${expected}`;
    }
  });
  check("暴落期間の評価額が指数の値動きと一致する", allMatch, firstMismatch);

  check(
    "暴落期間のphaseがcrashになっている",
    result.series[peakMonth + 1].phase === Simulation.PHASE_CRASH,
    `phase=${result.series[peakMonth + 1].phase}`
  );
  check(
    "暴落前月のphaseはnormal",
    result.series[peakMonth].phase === Simulation.PHASE_NORMAL
  );
  check(
    "回復完了の翌月はnormalに戻る",
    result.series[peakMonth + crashData.monthlyReturns.length + 1].phase === Simulation.PHASE_NORMAL
  );
  check(
    "indexRecoveryMonthsが実データの月数と一致",
    result.summary.indexRecoveryMonths === crashData.monthlyReturns.length,
    `actual=${result.summary.indexRecoveryMonths}`
  );

  // コロナショック×S&P500は2020-01高値→2020-07回復（6ヶ月）
  check(
    "コロナショック×S&P500の回復は6ヶ月",
    result.summary.indexRecoveryMonths === 6,
    `actual=${result.summary.indexRecoveryMonths}`
  );
}

// --- 3. 暴落中も積立を継続し、安値で口数を買い増していること ---
console.log("\n[3] ドルコスト平均法: 暴落中の買い増し効果");
{
  const crashData = Simulation.findCombination(events, "lehman", "sp500");
  const base = {
    monthlyContribution: 50000,
    years: 25,
    annualReturnPercent: 5,
    initialPrincipal: 0,
    crashStartYear: 3,
  };

  const withCrash = Simulation.simulate({ ...base, crashData });
  const withoutCrash = Simulation.simulate({ ...base, crashStartYear: null, crashData: null });

  check(
    "元本は暴落あり／なしで同じ",
    withCrash.summary.finalPrincipal === withoutCrash.summary.finalPrincipal
  );
  check(
    "暴落ありの方がドローダウンが発生している",
    withCrash.summary.maxDrawdown.ratio > 0,
    `ratio=${withCrash.summary.maxDrawdown.ratio}`
  );
  check(
    "crashImpact = 最終評価額の差分",
    closeTo(
      withCrash.summary.crashImpact,
      withCrash.summary.finalValue - withoutCrash.summary.finalValue,
      0.01
    )
  );

  // 積立を続けている分、資産評価額は指数より早くピークを回復するはず
  check(
    "資産の回復月数 <= 指数の回復月数",
    withCrash.summary.assetRecoveryMonths !== null &&
      withCrash.summary.assetRecoveryMonths <= withCrash.summary.indexRecoveryMonths,
    `asset=${withCrash.summary.assetRecoveryMonths} index=${withCrash.summary.indexRecoveryMonths}`
  );

  console.log(
    `        [参考] リーマン×S&P500・3年後に暴落: ` +
      `最終${Math.round(withCrash.summary.finalValue).toLocaleString()}円 / ` +
      `暴落なし${Math.round(withoutCrash.summary.finalValue).toLocaleString()}円 / ` +
      `最大DD ${(withCrash.summary.maxDrawdown.ratio * 100).toFixed(1)}% / ` +
      `指数回復${withCrash.summary.indexRecoveryMonths}ヶ月 vs 資産回復${withCrash.summary.assetRecoveryMonths}ヶ月`
  );
}

// --- 4. 回復途中で積立期間が終わるケースの打ち切り ---
console.log("\n[4] 回復途中で積立期間が終わるケース");
{
  const crashData = Simulation.findCombination(events, "lehman", "sp500"); // 回復まで65ヶ月
  const result = Simulation.simulate({
    monthlyContribution: 30000,
    years: 10,
    annualReturnPercent: 5,
    initialPrincipal: 0,
    crashStartYear: 9, // 暴落発生の1年後に積立期間終了
    crashData,
  });

  check("crashTruncated=true になる", result.summary.crashTruncated === true);
  check(
    "系列は積立期間で打ち切られている",
    result.series.length === 10 * 12 + 1,
    `length=${result.series.length}`
  );
  check(
    "最終月まで暴落期間が続いている",
    result.series[result.series.length - 1].phase === Simulation.PHASE_CRASH
  );
  check(
    "期間内に資産が回復しない場合 assetRecoveryMonths=null",
    result.summary.assetRecoveryMonths === null,
    `actual=${result.summary.assetRecoveryMonths}`
  );
}

// --- 5. 暴落タイミングが積立期間外なら暴落なし扱い ---
console.log("\n[5] 暴落タイミングが積立期間外");
{
  const crashData = Simulation.findCombination(events, "corona", "sp500");
  const result = Simulation.simulate({
    monthlyContribution: 30000,
    years: 10,
    annualReturnPercent: 5,
    crashStartYear: 15, // 積立期間(10年)より後
    crashData,
  });
  check("hasCrash=false になる", result.summary.hasCrash === false);
  check("ドローダウンなし", result.summary.maxDrawdown.ratio === 0);
}

// --- 6. 入力バリデーション ---
console.log("\n[6] 入力バリデーション");
{
  const shouldThrow = (name, input) => {
    let threw = false;
    try {
      Simulation.simulate(input);
    } catch (e) {
      threw = true;
    }
    check(name, threw);
  };

  shouldThrow("積立期間0はエラー", { monthlyContribution: 10000, years: 0, annualReturnPercent: 5 });
  shouldThrow("積立額が負ならエラー", { monthlyContribution: -1, years: 10, annualReturnPercent: 5 });
  shouldThrow("crashStartYear指定でcrashData無しはエラー", {
    monthlyContribution: 10000,
    years: 10,
    annualReturnPercent: 5,
    crashStartYear: 3,
  });
}

// --- 7. events.json の全組み合わせでエラーなく計算できること ---
console.log("\n[7] events.json 全組み合わせのスモークテスト");
{
  let errorCount = 0;
  let firstError = null;
  for (const c of events.combinations) {
    try {
      const r = Simulation.simulate({
        monthlyContribution: 30000,
        years: 30,
        annualReturnPercent: 5,
        initialPrincipal: 0,
        crashStartYear: 5,
        crashData: c,
      });
      if (!Number.isFinite(r.summary.finalValue) || r.summary.finalValue <= 0) {
        errorCount++;
        if (!firstError) firstError = `${c.eventId}×${c.indexId}: finalValue=${r.summary.finalValue}`;
      }
    } catch (e) {
      errorCount++;
      if (!firstError) firstError = `${c.eventId}×${c.indexId}: ${e.message}`;
    }
  }
  check(
    `全${events.combinations.length}組み合わせが正常に計算できる`,
    errorCount === 0,
    firstError
  );
}

// --- 8. 暴落を複数回指定できること ---
console.log("\n[8] 複数の暴落イベント");
{
  const corona = Simulation.findCombination(events, "corona", "sp500"); // 回復6ヶ月
  const svb = Simulation.findCombination(events, "svb", "sp500");

  const base = { years: 30, annualReturnPercent: 5, initialPrincipal: 0, phases: [{ startYear: 0, mode: "contribute", monthlyAmount: 30000 }] };

  const two = Simulation.simulate({
    ...base,
    crashes: [
      { startYear: 5, data: corona },
      { startYear: 15, data: svb },
    ],
  });

  check("暴落2件が両方とも適用される", two.crashes.length === 2, `applied=${two.crashes.length}`);
  check("crashCount=2", two.summary.crashCount === 2);
  check(
    "1件目は5年後、2件目は15年後の月に始まる",
    two.crashes[0].peakMonthIndex === 60 && two.crashes[1].peakMonthIndex === 180,
    `${two.crashes[0].peakMonthIndex} / ${two.crashes[1].peakMonthIndex}`
  );
  check(
    "それぞれの暴落期間のphaseがcrashになっている",
    two.series[61].phase === Simulation.PHASE_CRASH &&
      two.series[181].phase === Simulation.PHASE_CRASH &&
      two.series[120].phase === Simulation.PHASE_NORMAL
  );

  // 2件目を外した結果と比べて、最終評価額が変わること（＝2件目もちゃんと効いている）
  const one = Simulation.simulate({ ...base, crashes: [{ startYear: 5, data: corona }] });
  check(
    "2件目の暴落が最終評価額に影響している",
    Math.abs(two.summary.finalValue - one.summary.finalValue) > 1,
    `two=${two.summary.finalValue} one=${one.summary.finalValue}`
  );
  check("元本は暴落の件数によらず同じ", two.summary.finalPrincipal === one.summary.finalPrincipal);

  console.log(
    `        [参考] コロナ(5年後)+SVB(15年後)×S&P500: 最終${Math.round(two.summary.finalValue).toLocaleString()}円 / ` +
      `暴落1件のみ${Math.round(one.summary.finalValue).toLocaleString()}円`
  );
}

// --- 9. 期間が重なる暴落はスキップされること ---
console.log("\n[9] 暴落期間の重なり");
{
  const lehman = Simulation.findCombination(events, "lehman", "sp500"); // 回復65ヶ月
  const corona = Simulation.findCombination(events, "corona", "sp500");

  const result = Simulation.simulate({
    years: 30,
    annualReturnPercent: 5,
    phases: [{ startYear: 0, mode: "contribute", monthlyAmount: 30000 }],
    crashes: [
      { startYear: 5, data: lehman }, // 60ヶ月目〜125ヶ月目
      { startYear: 8, data: corona }, // 96ヶ月目 → 重なる
    ],
  });

  check("重なった暴落は適用されない", result.crashes.length === 1, `applied=${result.crashes.length}`);
  check("スキップ理由が overlap", result.skippedCrashes.length === 1 && result.skippedCrashes[0].reason === "overlap");
  check(
    "何年後以降なら指定できるかを返す",
    Math.abs(result.skippedCrashes[0].earliestStartYear - 125 / 12) < 1e-9,
    `earliest=${result.skippedCrashes[0].earliestStartYear}`
  );

  const outOfRange = Simulation.simulate({
    years: 10,
    annualReturnPercent: 5,
    phases: [{ startYear: 0, mode: "contribute", monthlyAmount: 30000 }],
    crashes: [{ startYear: 20, data: corona }],
  });
  check(
    "積立期間より後の暴落は out_of_range でスキップ",
    outOfRange.crashes.length === 0 &&
      outOfRange.skippedCrashes.length === 1 &&
      outOfRange.skippedCrashes[0].reason === "out_of_range"
  );
}

// --- 10. 積立 → 停止 → 取り崩し のフェーズが反映されること ---
console.log("\n[10] 拠出プラン（積立・停止・取り崩し）");
{
  const monthly = 50000;
  const withdrawMonthly = 100000;

  const result = Simulation.simulate({
    years: 30,
    annualReturnPercent: 5,
    initialPrincipal: 0,
    phases: [
      { startYear: 0, mode: "contribute", monthlyAmount: monthly },
      { startYear: 20, mode: "pause", monthlyAmount: 0 },
      { startYear: 25, mode: "withdraw", monthlyAmount: withdrawMonthly },
    ],
  });

  check(
    "累計拠出額 = 毎月積立額 × 20年分",
    closeTo(result.summary.totalContributed, monthly * 240, 0.01),
    `actual=${result.summary.totalContributed}`
  );
  check(
    "累計取り崩し額 = 毎月取り崩し額 × 5年分",
    closeTo(result.summary.totalWithdrawn, withdrawMonthly * 60, 0.01),
    `actual=${result.summary.totalWithdrawn}`
  );
  check(
    "純拠出額 = 累計拠出 − 累計取り崩し",
    closeTo(result.summary.finalPrincipal, monthly * 240 - withdrawMonthly * 60, 0.01),
    `actual=${result.summary.finalPrincipal}`
  );
  check("hasWithdrawal=true", result.summary.hasWithdrawal === true);

  // 停止期間（20〜25年）は元本が増えないこと
  check(
    "停止期間は純拠出額が変わらない",
    result.series[20 * 12].principal === result.series[25 * 12].principal,
    `${result.series[20 * 12].principal} vs ${result.series[25 * 12].principal}`
  );
  check(
    "停止期間でも運用は続くので評価額は増える",
    result.series[25 * 12].value > result.series[20 * 12].value
  );

  // 手計算との突合: 停止期間は初期投資と同じ単純複利で伸びるはず
  const r = 5 / 100 / 12;
  const expectedAt25y = result.series[20 * 12].value * Math.pow(1 + r, 60);
  check(
    "停止期間の評価額が複利計算の理論値と一致する",
    closeTo(result.series[25 * 12].value, expectedAt25y, 1),
    `actual=${result.series[25 * 12].value} expected=${expectedAt25y}`
  );

  check(
    "取り崩し期間の phase mode が withdraw",
    result.series[26 * 12].mode === Simulation.MODE_WITHDRAW,
    `mode=${result.series[26 * 12].mode}`
  );

  console.log(
    `        [参考] 20年積立(月5万)→5年停止→5年取り崩し(月10万): ` +
      `最終${Math.round(result.summary.finalValue).toLocaleString()}円 / ` +
      `取り崩し累計${Math.round(result.summary.totalWithdrawn).toLocaleString()}円`
  );
}

// --- 11. 取り崩しで資産が尽きるケース ---
console.log("\n[11] 取り崩しで資産が尽きるケース");
{
  const result = Simulation.simulate({
    years: 20,
    annualReturnPercent: 0,
    initialPrincipal: 1200000,
    phases: [
      { startYear: 0, mode: "pause", monthlyAmount: 0 },
      { startYear: 1, mode: "withdraw", monthlyAmount: 100000 },
    ],
  });

  check("資産が尽きた月が記録される", result.summary.depletedMonthIndex !== null, `actual=${result.summary.depletedMonthIndex}`);
  check(
    "利回り0・120万円を月10万取り崩し → 13ヶ月目（1年後の12ヶ月分）で尽きる",
    result.summary.depletedMonthIndex === 25,
    `actual=${result.summary.depletedMonthIndex}`
  );
  check("評価額がマイナスにならない", result.series.every((p) => p.value >= -0.005));
  check(
    "取り崩し合計は初期元本を超えない",
    result.summary.totalWithdrawn <= 1200000 + 0.01,
    `actual=${result.summary.totalWithdrawn}`
  );

  // 暴落期間中の取り崩しでもマイナスにならないこと
  const crashData = Simulation.findCombination(events, "lehman", "sp500");
  const duringCrash = Simulation.simulate({
    years: 20,
    annualReturnPercent: 3,
    initialPrincipal: 3000000,
    phases: [{ startYear: 0, mode: "withdraw", monthlyAmount: 200000 }],
    crashes: [{ startYear: 1, data: crashData }],
  });
  check(
    "暴落期間中の取り崩しでも評価額がマイナスにならない",
    duringCrash.series.every((p) => p.value >= -0.005)
  );
}

// --- 12. 暴落の大きさ（コンボボックス表示用）が算出できること ---
console.log("\n[12] 暴落の大きさの算出");
{
  const lehman = Simulation.findCombination(events, "lehman", "sp500");
  const desc = Simulation.describeCombination(lehman);

  check("下落率が0〜1の範囲に収まる", desc.dropRatio > 0 && desc.dropRatio < 1, `dropRatio=${desc.dropRatio}`);
  check(
    "回復月数が monthlyReturns の長さと一致",
    desc.recoveryMonths === lehman.monthlyReturns.length
  );
  check("高値→底 は 高値→回復 より短い", desc.declineMonths < desc.recoveryMonths);
  check(
    "リーマン×S&P500の月次終値ベース下落率は40〜60%",
    desc.dropRatio > 0.4 && desc.dropRatio < 0.6,
    `actual=${(desc.dropRatio * 100).toFixed(1)}%`
  );

  let bad = null;
  for (const c of events.combinations) {
    const d = Simulation.describeCombination(c);
    if (!d || !Number.isFinite(d.dropRatio) || d.dropRatio < 0 || d.dropRatio >= 1) {
      bad = `${c.eventId}×${c.indexId}: ${d && d.dropRatio}`;
      break;
    }
  }
  check("全組み合わせで下落率が算出できる", bad === null, bad);
}

console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
