// 対象指数の定義。
// ticker: Yahoo Finance のシンボル（https://finance.yahoo.com/quote/<ticker>/history）
// ticker が null のものは未確認。Yahoo Finance の検索窓で手動検索し、
// 正しいシンボルが分かったら埋めること。
//
// confidence:
//   "high"   … 一般的に知られているシンボル。ほぼそのまま使える想定。
//   "verify" … おそらく合っているが、実データ取得時に値の妥当性を必ず確認すること。
//   "unknown" … シンボル未確定。手動検索が必須。

module.exports = [
  {
    id: "sp500",
    name: "S&P500",
    ticker: "^GSPC",
    confidence: "high",
    note: null,
  },
  {
    id: "topix",
    name: "TOPIX",
    ticker: "1348.T",
    confidence: "verify",
    note:
      "直接指数のシンボル(^TOPX)はYahoo Finance上に価格系列が存在しなかったため、" +
      "東証上場のMAXIS TOPIX ETF(1348.T)で代用。設定日が2009-05のため、それ以前のイベントには使えない。",
  },
  {
    id: "nikkei225",
    name: "日経平均",
    ticker: "^N225",
    confidence: "high",
    note: null,
  },
  {
    id: "nasdaq100",
    name: "NASDAQ100",
    ticker: "^NDX",
    confidence: "high",
    note: null,
  },
  {
    id: "acwi",
    name: "オルカン相当（ACWI）",
    ticker: "ACWI",
    confidence: "verify",
    note: "MSCI ACWI指数そのものではなく iShares MSCI ACWI ETF で代用。設定日が2008年なので、それ以前のイベントには使えない。",
  },
  {
    id: "msci_em",
    name: "MSCIエマージング",
    ticker: "EEM",
    confidence: "verify",
    note: "MSCI EM指数そのものではなく iShares MSCI Emerging Markets ETF で代用。設定日が2003年なので、それ以前のイベントには使えない。",
  },
  {
    id: "msci_kokusai",
    name: "MSCIコクサイ（除く日本の先進国）",
    ticker: "TOK",
    confidence: "verify",
    note:
      "iShares MSCI Kokusai ETF(NYSEArca: TOK)で代用。設定日が2007-12のため、それ以前のイベントには使えない。",
  },
];
