// 各指数の「長期の年平均リターン」を算出して data/index-stats.json を生成する。
//
// 想定利回り入力欄の参考値として使うためのデータ。
// events.json（暴落期間の実データ）とは目的が違うので、別ファイル・別スクリプトにしている。
//
// 使い方: node fetch-index-stats.js
//
// 算出方針:
//   - Yahoo Finance chart API から取得できる全期間の月次データを使う
//   - 価格は **調整後終値（adjclose）** を使う。想定利回りは「配当込みで年に何%増えるか」の
//     入力なので、配当を除いた素の終値だと過小評価になるため
//   - 年平均リターンは CAGR（幾何平均）: (末値 / 初値)^(1/年数) - 1
//   - 全期間に加えて直近20年・10年も出す。指数ごとに取得できる期間が大きく違う
//     （ETF代用のものは設定日以降しかない）ので、比較できる窓を用意する
//   - 現地通貨ベース。為替の影響は含まない（UI側にその旨を明記すること）

const fs = require("fs");
const path = require("path");
const indices = require("./config/indices");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const OUT_PATH = path.join(__dirname, "..", "index-stats.json");
const REQUEST_DELAY_MS = 400;

// 指数の価格が円建てか外貨建てか。UIの注記の出し分けに使う
const CURRENCY = {
  sp500: "USD",
  nasdaq100: "USD",
  acwi: "USD",
  msci_em: "USD",
  msci_kokusai: "USD",
  topix: "JPY",
  nikkei225: "JPY",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMonthlySeries(ticker) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1mo&events=div%7Csplit`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`http_${res.status}`);

  const data = await res.json();
  if (data.chart.error) {
    throw new Error(`api_error:${data.chart.error.description || data.chart.error.code}`);
  }
  const result = data.chart.result && data.chart.result[0];
  if (!result || !result.timestamp) throw new Error("no_data");

  // 配当込みの調整後終値。無ければ素の終値にフォールバックする
  const close = result.indicators.quote[0].close;
  const adj =
    (result.indicators.adjclose && result.indicators.adjclose[0].adjclose) || close;

  // 指数そのもの（^GSPC 等）は adjclose === close で配当が入らない。ETFは分配金が反映される。
  // 数字を横並びで見せる以上この違いは注記が要るので、判定してデータに持たせる
  let dividendsIncluded = false;
  for (let i = 0; i < adj.length; i++) {
    if (adj[i] != null && close[i] != null && Math.abs(adj[i] - close[i]) > close[i] * 0.001) {
      dividendsIncluded = true;
      break;
    }
  }

  const rows = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const price = adj[i];
    if (price == null || !(price > 0)) continue;
    rows.push({
      date: new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10),
      price: price,
    });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { rows: rows, dividendsIncluded: dividendsIncluded };
}

/**
 * 月数を年に直したうえで CAGR を出す。期間が短すぎる場合は null。
 *
 * months を指定したとき、その月数分のデータが無ければ null を返す。
 * 足りないまま丸ごと使うと「直近20年」の見出しで17年分の数字を出すことになり、
 * 指数間の比較として成立しないため。
 */
function cagr(rows, months) {
  if (months != null && rows.length < months + 1) return null;
  const slice = months == null ? rows : rows.slice(-(months + 1));
  if (slice.length < 25) return null; // 2年未満は年率化しても意味がないので出さない

  const first = slice[0];
  const last = slice[slice.length - 1];
  const years = (slice.length - 1) / 12;
  const ratio = last.price / first.price;
  if (!(ratio > 0) || !(years > 0)) return null;

  return {
    percent: (Math.pow(ratio, 1 / years) - 1) * 100,
    from: first.date,
    to: last.date,
    years: years,
  };
}

/** 年率換算のボラティリティ（月次騰落率の標準偏差 × √12）。 */
function annualizedVolatility(rows) {
  if (rows.length < 25) return null;
  const returns = [];
  for (let i = 1; i < rows.length; i++) {
    returns.push(rows[i].price / rows[i - 1].price - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12) * 100;
}

async function main() {
  const stats = [];
  const failed = [];

  for (const idx of indices) {
    if (!idx.ticker) {
      failed.push({ id: idx.id, reason: "ticker_unresolved" });
      continue;
    }

    process.stdout.write(`fetching ${idx.id} (${idx.ticker})... `);
    let rows;
    let dividendsIncluded;
    try {
      const fetched = await fetchMonthlySeries(idx.ticker);
      rows = fetched.rows;
      dividendsIncluded = fetched.dividendsIncluded;
    } catch (e) {
      console.log(`NG (${e.message})`);
      failed.push({ id: idx.id, reason: e.message });
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    const all = cagr(rows, null);
    if (!all) {
      console.log("NG (insufficient_rows)");
      failed.push({ id: idx.id, reason: "insufficient_rows" });
      await sleep(REQUEST_DELAY_MS);
      continue;
    }

    stats.push({
      indexId: idx.id,
      indexName: idx.name,
      ticker: idx.ticker,
      currency: CURRENCY[idx.id] || "USD",
      isEtfProxy: idx.confidence !== "high",
      dividendsIncluded: dividendsIncluded,
      months: rows.length,
      full: all,
      last20y: cagr(rows, 240),
      last10y: cagr(rows, 120),
      volatilityPercent: annualizedVolatility(rows),
    });

    console.log(
      `OK (${rows.length} rows, 全期間 ${all.percent.toFixed(1)}%/年 ${all.from}〜${all.to})`
    );
    await sleep(REQUEST_DELAY_MS);
  }

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        basis:
          "現地通貨ベース。為替の影響は含まない。" +
          "ETFで代用している指数は分配金込み、指数そのもの（S&P500・日経平均・NASDAQ100）は" +
          "配当を含まない価格リターン（各要素の dividendsIncluded を参照）。",
        indices: stats,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\nOK: ${stats.length} 件を ${OUT_PATH} に書き出しました。`);
  if (failed.length) {
    console.log("\n--- 失敗・スキップ ---");
    for (const f of failed) console.log(`  - ${f.id}: ${f.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
