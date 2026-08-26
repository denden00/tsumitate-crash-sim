// ブラウザで手動ダウンロードするためのYahoo Finance 履歴データページURL一覧を生成する。
//
// 使い方:
//   node generate-urls.js                       すべての組み合わせを出力
//   node generate-urls.js --event=lehman         特定イベントのみ
//   node generate-urls.js --index=sp500,topix    特定指数のみ（カンマ区切り）
//
// 出力:
//   - コンソールに一覧を表示
//   - data/fetch-data/download-checklist.md にチェックリストを書き出す
//
// 手順:
//   1. このスクリプトを実行してURL一覧を得る
//   2. 各URL（Yahoo Financeの履歴データページ）をブラウザで開き、
//      ページ内の「Download」ボタンをクリックしてCSVを取得する
//      （直接CSVリンクではなく、必ずこのページ経由でダウンロードすること）
//   3. ダウンロードされたCSVを「保存先」のパスに置く（フォルダが無ければ作成する）
//   4. 全部揃ったら（揃わなくても）build-events-json.js を実行して data/events.json を作る

const fs = require("fs");
const path = require("path");
const indices = require("./config/indices");
const events = require("./config/events");

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

function buildUrl(ticker, fetchStart, fetchEnd) {
  const p1 = toUnixSeconds(fetchStart);
  const p2 = toUnixSeconds(fetchEnd);
  const encodedTicker = encodeURIComponent(ticker);
  return `https://finance.yahoo.com/quote/${encodedTicker}/history?period1=${p1}&period2=${p2}&interval=1mo&filter=history&frequency=1mo`;
}

function main() {
  const args = parseArgs(process.argv);
  const eventFilter = args.event ? args.event.split(",") : null;
  const indexFilter = args.index ? args.index.split(",") : null;

  const targetEvents = events.filter((e) => !eventFilter || eventFilter.includes(e.id));
  const targetIndices = indices.filter((i) => !indexFilter || indexFilter.includes(i.id));

  const lines = [];
  const skipped = [];
  let count = 0;

  lines.push("# Yahoo Finance 手動ダウンロード チェックリスト");
  lines.push("");
  lines.push(
    "各URL（履歴データページ）をブラウザで開き、ページ内の「Download」ボタンをクリックしてCSVを取得してください。" +
      "直接CSVリンクではありません。"
  );
  lines.push("");

  for (const ev of targetEvents) {
    lines.push(`## ${ev.name} (${ev.id})`);
    if (ev.note) lines.push(`> ${ev.note}`);
    lines.push("");

    for (const idx of targetIndices) {
      if (!idx.ticker) {
        skipped.push(`${ev.id} × ${idx.id}（${idx.name}）: ティッカー未確定のためスキップ`);
        continue;
      }
      const url = buildUrl(idx.ticker, ev.fetchStart, ev.fetchEnd);
      const savePath = path.join("data", "fetch-data", "raw", ev.id, `${idx.id}.csv`);
      const confidenceMark = idx.confidence === "high" ? "" : ` ⚠confidence=${idx.confidence}`;
      lines.push(`- [ ] **${idx.name}**${confidenceMark}`);
      lines.push(`  - URL: ${url}`);
      lines.push(`  - 保存先: \`${savePath.replace(/\\/g, "/")}\``);
      count++;
    }
    lines.push("");
  }

  if (skipped.length) {
    lines.push("## スキップされた組み合わせ（ティッカー未確定）");
    for (const s of skipped) lines.push(`- ${s}`);
    lines.push("");
  }

  const outPath = path.join(__dirname, "download-checklist.md");
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");

  console.log(lines.join("\n"));
  console.log(`\n合計 ${count} 件のURLを ${outPath} に書き出しました。`);
  if (skipped.length) {
    console.log(`${skipped.length} 件はティッカー未確定のためスキップしました（config/indices.js を参照）。`);
  }
}

main();
