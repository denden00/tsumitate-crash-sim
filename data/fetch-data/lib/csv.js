// 月次OHLCV CSV（Date,Open,High,Low,Close[,Adj Close],Volume）を読み込むだけの簡易パーサ。
// fetch.js が書き出す形式と、Yahoo Financeからブラウザで直接ダウンロードしたCSVの
// どちらも読める（値にカンマや引用符を含まない前提の割り切った実装）。

const fs = require("fs");

function parseMonthlyCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf-8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const closeIdx = header.indexOf("close");
  if (dateIdx === -1 || closeIdx === -1) {
    throw new Error(`${filePath}: 想定外のCSVヘッダー: ${lines[0]}`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = cols[dateIdx];
    const close = parseFloat(cols[closeIdx]);
    if (!date || Number.isNaN(close)) continue;
    rows.push({ date, close });
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

module.exports = { parseMonthlyCsv };
