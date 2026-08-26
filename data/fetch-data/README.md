# data/fetch-data — データ取得スクリプト（サイト本体には含めない）

Stooq (`https://stooq.com/q/d/l/`) は自動取得・手動ダウンロードのどちらもアクセス拒否／
ダウンロード導線なしで断念し、**Yahoo Finance** に切り替えた（2026-08-25、詳細は `docs/spec.md` 5.2節）。

Yahoo Financeは `query1.finance.yahoo.com/v8/finance/chart/<ticker>` という内部chart APIが
crumb等の認証なしでJSONを返すことを確認できたため、**`fetch.js` による自動取得**を主経路とする。
ブラウザ手動ダウンロード用の `generate-urls.js` / `download-checklist.md` は、自動取得が
使えない環境向けのフォールバックとして残してある。

## 手順（自動取得・推奨）

1. `node fetch.js` を実行する
   - 特定イベント/指数だけ絞りたい場合: `node fetch.js --event=lehman --index=sp500,topix`
   - `config/indices.js` のティッカーと `config/events.js` の取得期間に基づき、
     `raw/<eventId>/<indexId>.csv` を自動生成する
   - リクエスト間に400msのウェイトを入れている（Yahoo側への配慮。間隔を削らないこと）
   - ティッカーがそのイベント期間より後に設定されたETF等の場合は `http_400` で失敗する
     （そのイベントを再現するデータが存在しないという意味で、想定内の失敗）
2. `node build-events-json.js` を実行する
   - 取得できたデータから「暴落前の高値」「回復完了月」「月次騰落率」を算出し、
     `data/events.json` を生成する
   - 取得できなかった／判定できなかった組み合わせは理由付きでコンソールに一覧表示される
     （`csv_missing`: 未取得, `peak_not_found`: 高値がpeakWindow内に見つからない,
     `recovery_not_found`: データ範囲内で回復未確認, `ticker_unresolved`: シンボル未確定）
3. `recovery_not_found` が出た場合は、実際にまだ回復していない可能性がある
   （例: MSCIエマージングはリーマン高値からの回復にリーマン後10年以上かかっており、
   直近まで期間を延ばしてようやく回復を確認できたケースがあった）。
   `config/events.js` の該当イベントの `fetchEnd` を伸ばして再取得すると解消することがある

## 手順（手動ダウンロード・フォールバック）

自動取得がブロックされる環境では、以下を代わりに使う。

1. `node generate-urls.js` を実行し、`download-checklist.md` にURL一覧を生成する
2. 各URL（Yahoo Financeの履歴データページ）をブラウザで開き、
   ページ内の「Download」ボタンをクリックしてCSVを取得する（直接CSVリンクではない）。
   ダウンロードしたファイルを、チェックリストに書かれた保存先パス
   （`raw/<eventId>/<indexId>.csv`）に配置する
3. `node build-events-json.js` を実行する（上記と同じ）

## 既知の未確定事項・注意点

- `confidence: "verify"` が付いた指数（TOPIX / ACWI / MSCIエマージング / MSCIコクサイ）は
  ETFによる代用のため、実際の指数推移と厳密には一致しない。値の妥当性を目視確認すること
  - TOPIX: MAXIS TOPIX ETF (1348.T)、設定日2009-05
  - MSCIコクサイ: iShares MSCI Kokusai ETF (TOK)、設定日2007-12
  - ACWI: iShares MSCI ACWI ETF (ACWI)、設定日2008
  - MSCIエマージング: iShares MSCI Emerging Markets ETF (EEM)、設定日2003
- 上記ETFの設定日より前に発生したイベント（ブラックマンデー・アジア通貨危機・
  ロシア危機/LTCM破綻・ITバブル崩壊の一部・リーマンショックの一部）では、該当指数の
  組み合わせが取得不可（`csv_missing`または`peak_not_found`）になる。これは仕様上の
  想定内の間引きであり、バグではない
- 各イベント×指数の実際に採用する組み合わせは `data/events.json` を正とする
  （CLAUDE.md の方針どおり）
