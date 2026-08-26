// data/fetch-data/raw/<eventId>/<indexId>.csv を読み込み、
// 「暴落前の高値」「回復完了月」「その間の月次騰落率」を算出して
// data/events.json を生成する。
//
// 使い方: node build-events-json.js
//
// 判定ロジック（CLAUDE.md / docs/spec.md 4.2 に準拠）:
//   - peakWindow 内の月次終値の最大値を「暴落前の高値」とする
//   - 暴落前の高値の月より後で、初めて終値がその高値を上回った月を「回復完了」とする
//   - 「暴落前の高値の月の翌月」〜「回復完了月」までの月次騰落率（前月比）を
//     monthlyReturns として記録する

const fs = require("fs");
const path = require("path");
const indices = require("./config/indices");
const events = require("./config/events");
const { parseMonthlyCsv } = require("./lib/csv");

const RAW_DIR = path.join(__dirname, "raw");
const OUT_PATH = path.join(__dirname, "..", "events.json");

function findPeak(rows, peakWindow) {
  const inWindow = rows.filter((r) => r.date >= peakWindow.start && r.date <= peakWindow.end);
  if (inWindow.length === 0) return null;
  return inWindow.reduce((max, r) => (r.close > max.close ? r : max), inWindow[0]);
}

function findRecovery(rows, peak) {
  const peakIdx = rows.findIndex((r) => r.date === peak.date);
  for (let i = peakIdx + 1; i < rows.length; i++) {
    if (rows[i].close > peak.close) return { row: rows[i], index: i };
  }
  return null;
}

function buildMonthlyReturns(rows, peakIndex, recoveryIndex) {
  const returns = [];
  for (let i = peakIndex + 1; i <= recoveryIndex; i++) {
    const prev = rows[i - 1].close;
    const curr = rows[i].close;
    returns.push({
      date: rows[i].date,
      close: curr,
      changePct: (curr - prev) / prev,
    });
  }
  return returns;
}

function main() {
  const results = [];
  const problems = [];

  for (const ev of events) {
    for (const idx of indices) {
      const key = `${ev.id} × ${idx.id}（${ev.name} / ${idx.name}）`;

      if (!idx.ticker) {
        problems.push({ event: ev.id, index: idx.id, reason: "ticker_unresolved", detail: key });
        continue;
      }

      const csvPath = path.join(RAW_DIR, ev.id, `${idx.id}.csv`);
      if (!fs.existsSync(csvPath)) {
        problems.push({ event: ev.id, index: idx.id, reason: "csv_missing", detail: `${key}: ${csvPath}` });
        continue;
      }

      let rows;
      try {
        rows = parseMonthlyCsv(csvPath);
      } catch (e) {
        problems.push({ event: ev.id, index: idx.id, reason: "csv_parse_error", detail: `${key}: ${e.message}` });
        continue;
      }

      if (rows.length < 3) {
        problems.push({ event: ev.id, index: idx.id, reason: "insufficient_rows", detail: key });
        continue;
      }

      const peak = findPeak(rows, ev.peakWindow);
      if (!peak) {
        problems.push({ event: ev.id, index: idx.id, reason: "peak_not_found", detail: key });
        continue;
      }

      const recovery = findRecovery(rows, peak);
      if (!recovery) {
        problems.push({ event: ev.id, index: idx.id, reason: "recovery_not_found", detail: key });
        continue;
      }

      const peakIndex = rows.findIndex((r) => r.date === peak.date);
      const monthlyReturns = buildMonthlyReturns(rows, peakIndex, recovery.index);

      results.push({
        eventId: ev.id,
        eventName: ev.name,
        indexId: idx.id,
        indexName: idx.name,
        preCrashHigh: { date: peak.date, close: peak.close },
        recovery: { date: recovery.row.date, close: recovery.row.close },
        monthlyReturns,
      });
    }
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), combinations: results }, null, 2),
    "utf-8"
  );

  console.log(`OK: ${results.length} 件の組み合わせを ${OUT_PATH} に書き出しました。`);
  console.log(`未取得/判定不可: ${problems.length} 件`);
  if (problems.length) {
    const byReason = {};
    for (const p of problems) {
      byReason[p.reason] = byReason[p.reason] || [];
      byReason[p.reason].push(p.detail);
    }
    for (const [reason, list] of Object.entries(byReason)) {
      console.log(`\n--- ${reason} (${list.length}件) ---`);
      for (const d of list) console.log(`  - ${d}`);
    }
  }
}

main();
