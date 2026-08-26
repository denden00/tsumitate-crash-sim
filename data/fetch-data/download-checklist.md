# Yahoo Finance 手動ダウンロード チェックリスト

各URL（履歴データページ）をブラウザで開き、ページ内の「Download」ボタンをクリックしてCSVを取得してください。直接CSVリンクではありません。

## ITバブル崩壊 (dotcom)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=915148800&period2=1514678400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/dotcom/msci_kokusai.csv`

## リーマンショック (lehman)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=1136073600&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/lehman/msci_kokusai.csv`

## コロナショック (corona)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=1559347200&period2=1672444800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/corona/msci_kokusai.csv`

## トランプショック (trump2025)
> 2026-08-25時点で回復完了未確定の可能性あり。build-events-json.js が recovery_not_found と判定した場合は、後日データを取り直すか対象から一旦除外する。

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=1717200000&period2=1787616000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/trump2025/msci_kokusai.csv`

## ブラックマンデー (blackmonday)
> 古い時期のため、ETFで代用している指数（TOPIX/ACWI/新興国/コクサイ）は設定日前にあたり取得不可。

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=473385600&period2=725760000&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/blackmonday/msci_kokusai.csv`

## アジア通貨危機 (asian_currency)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=820454400&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/asian_currency/msci_kokusai.csv`

## ロシア危機・LTCM破綻 (russia_ltcm)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=865123200&period2=1009756800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/russia_ltcm/msci_kokusai.csv`

## チャイナショック (china_shock)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=1401580800&period2=1577750400&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/china_shock/msci_kokusai.csv`

## VIXショック (vix_shock)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=1496275200&period2=1609372800&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/vix_shock/msci_kokusai.csv`

## SVB破綻・米地銀危機 (svb)

- [ ] **S&P500**
  - URL: https://finance.yahoo.com/quote/%5EGSPC/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/sp500.csv`
- [ ] **TOPIX** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/1348.T/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/topix.csv`
- [ ] **日経平均**
  - URL: https://finance.yahoo.com/quote/%5EN225/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/nikkei225.csv`
- [ ] **NASDAQ100**
  - URL: https://finance.yahoo.com/quote/%5ENDX/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/nasdaq100.csv`
- [ ] **オルカン相当（ACWI）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/ACWI/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/acwi.csv`
- [ ] **MSCIエマージング** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/EEM/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/msci_em.csv`
- [ ] **MSCIコクサイ（除く日本の先進国）** ⚠confidence=verify
  - URL: https://finance.yahoo.com/quote/TOK/history?period1=1654041600&period2=1767139200&interval=1mo&filter=history&frequency=1mo
  - 保存先: `data/fetch-data/raw/svb/msci_kokusai.csv`
