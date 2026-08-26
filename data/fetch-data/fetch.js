// Yahoo Finance の chart API (query1.finance.yahoo.com) から月次データを自動取得し、
// raw/<eventId>/<indexId>.csv に保存する。
//
// ブラウザの「Download」ボタン経由の手動取得（generate-urls.js + download-checklist.md）の
// 代わりに使える自動版。chart API はブラウザ向けの `/quote/.../history` ページとは別の
// 内部エンドポイントで、crumb等の認証なしで直接JSONが取得できることを確認済み。
//
// 使い方:
//   node fetch.js                       すべての組み合わせを取得
//   node fetch.js --event=lehman        特定イベントのみ
//   node fetch.js --index=sp500,topix   特定指数のみ（カンマ区切り）
//
// 取得できなかった組み合わせ（ティッカー未確定 / データなし / 期間外）はスキップし、
// 最後に理由付きで一覧表示する。取得後は build-events-json.js を実行すること。

const fs = require("fs");
const path = require("path");
const indices = require("./config/indices");
const events = require("./config/events");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const RAW_DIR = path.join(__dirname, "raw");
const REQUEST_DELAY_MS = 400;

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

function toUnixSeconds(isoDate) {
  return Math.floor(new Date(`${isoDate}T00:00:00Z`).getTime() / 1000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchChart(ticker, fetchStart, fetchEnd) {
  const p1 = toUnixSeconds(fetchStart);
  const p2 = toUnixSeconds(fetchEnd);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?period1=${p1}&period2=${p2}&interval=1mo`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    return { ok: false, reason: `http_${res.status}` };
  }
  const data = await res.json();
  if (data.chart.error) {
    return { ok: false, reason: `api_error:${data.chart.error.description || data.chart.error.code}` };
  }
  const result = data.chart.result && data.chart.result[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    return { ok: false, reason: "no_data" };
  }
  return { ok: true, result };
}

function resultToCsv(result) {
  const { timestamp, indicators } = result;
  const q = indicators.quote[0];
  const lines = ["Date,Open,High,Low,Close,Volume"];
  for (let i = 0; i < timestamp.length; i++) {
    const close = q.close[i];
    if (close === null || close === undefined) continue;
    const date = new Date(timestamp[i] * 1000).toISOString().slice(0, 10);
    const open = q.open[i] ?? close;
    const high = q.high[i] ?? close;
    const low = q.low[i] ?? close;
    const volume = q.volume[i] ?? 0;
    lines.push(`${date},${open},${high},${low},${close},${volume}`);
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv);
  const eventFilter = args.event ? args.event.split(",") : null;
  const indexFilter = args.index ? args.index.split(",") : null;

  const targetEvents = events.filter((e) => !eventFilter || eventFilter.includes(e.id));
  const targetIndices = indices.filter((i) => !indexFilter || indexFilter.includes(i.id));

  const ok = [];
  const failed = [];

  for (const ev of targetEvents) {
    for (const idx of targetIndices) {
      const label = `${ev.id} × ${idx.id}（${ev.name} / ${idx.name}）`;

      if (!idx.ticker) {
        failed.push({ label, reason: "ticker_unresolved" });
        continue;
      }

      process.stdout.write(`fetching ${label} (${idx.ticker})... `);
      let outcome;
      try {
        outcome = await fetchChart(idx.ticker, ev.fetchStart, ev.fetchEnd);
      } catch (e) {
        outcome = { ok: false, reason: `exception:${e.message}` };
      }

      if (!outcome.ok) {
        console.log(`NG (${outcome.reason})`);
        failed.push({ label, reason: outcome.reason });
        await sleep(REQUEST_DELAY_MS);
        continue;
      }

      const csv = resultToCsv(outcome.result);
      const dir = path.join(RAW_DIR, ev.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${idx.id}.csv`), csv, "utf-8");
      const rowCount = csv.trim().split("\n").length - 1;
      console.log(`OK (${rowCount} rows)`);
      ok.push(label);

      await sleep(REQUEST_DELAY_MS);
    }
  }

  console.log(`\n取得成功: ${ok.length} 件 / 失敗・スキップ: ${failed.length} 件`);
  if (failed.length) {
    console.log("\n--- 失敗・スキップ一覧 ---");
    for (const f of failed) console.log(`  - ${f.label}: ${f.reason}`);
  }
  console.log("\n次に `node build-events-json.js` を実行して data/events.json を生成してください。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
