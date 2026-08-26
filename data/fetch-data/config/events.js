// 対象暴落イベントの定義。
//
// fetchStart / fetchEnd: データ取得時に指定する期間（余裕を持たせた範囲）。
//   暴落前の高値と、回復完了月の両方がこの範囲に収まるように広めに取ってある。
// peakWindow: 「暴落前の高値」を自動検出する際に探索する期間。
//   このウィンドウ内の月次終値の最大値を「暴落前の高値」とみなす。
//
// 日付はすべて "YYYY-MM-DD" 形式（実際のリクエストではUNIX秒に変換する）。

module.exports = [
  {
    id: "dotcom",
    name: "ITバブル崩壊",
    fetchStart: "1999-01-01",
    fetchEnd: "2017-12-31",
    peakWindow: { start: "1999-06-01", end: "2000-12-31" },
  },
  {
    id: "lehman",
    name: "リーマンショック",
    fetchStart: "2006-01-01",
    fetchEnd: "2026-08-25",
    peakWindow: { start: "2007-06-01", end: "2007-12-31" },
  },
  {
    id: "corona",
    name: "コロナショック",
    fetchStart: "2019-06-01",
    fetchEnd: "2022-12-31",
    peakWindow: { start: "2020-01-01", end: "2020-02-29" },
  },
  {
    id: "trump2025",
    name: "トランプショック",
    fetchStart: "2024-06-01",
    fetchEnd: "2026-08-25",
    peakWindow: { start: "2025-01-01", end: "2025-03-31" },
    note: "2026-08-25時点で回復完了未確定の可能性あり。build-events-json.js が recovery_not_found と判定した場合は、後日データを取り直すか対象から一旦除外する。",
  },
  {
    id: "blackmonday",
    name: "ブラックマンデー",
    fetchStart: "1985-01-01",
    fetchEnd: "1992-12-31",
    peakWindow: { start: "1987-06-01", end: "1987-09-30" },
    note: "古い時期のため、ETFで代用している指数（TOPIX/ACWI/新興国/コクサイ）は設定日前にあたり取得不可。",
  },
  {
    id: "asian_currency",
    name: "アジア通貨危機",
    fetchStart: "1996-01-01",
    fetchEnd: "2020-12-31",
    peakWindow: { start: "1997-04-01", end: "1997-07-31" },
  },
  {
    id: "russia_ltcm",
    name: "ロシア危機・LTCM破綻",
    fetchStart: "1997-06-01",
    fetchEnd: "2001-12-31",
    peakWindow: { start: "1998-05-01", end: "1998-07-31" },
  },
  {
    id: "china_shock",
    name: "チャイナショック",
    fetchStart: "2014-06-01",
    fetchEnd: "2019-12-31",
    peakWindow: { start: "2015-04-01", end: "2015-07-31" },
  },
  {
    id: "vix_shock",
    name: "VIXショック",
    fetchStart: "2017-06-01",
    fetchEnd: "2020-12-31",
    peakWindow: { start: "2018-01-01", end: "2018-01-31" },
  },
  {
    id: "svb",
    name: "SVB破綻・米地銀危機",
    fetchStart: "2022-06-01",
    fetchEnd: "2025-12-31",
    peakWindow: { start: "2023-01-01", end: "2023-02-28" },
  },
];
