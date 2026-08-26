/**
 * エントリーポイント。
 * 静的同梱した data/events.json（暴落の実データ）と
 * data/index-stats.json（想定利回りの参考値）を読み込んでUIを初期化する。
 * 実行時に外部APIは叩かない（データは事前取得してリポジトリに同梱する方針）。
 */
(function () {
  "use strict";

  function showFatalError(message) {
    const el = document.getElementById("form-error");
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  }

  function loadJson(path) {
    return fetch(path).then(function (res) {
      if (!res.ok) throw new Error(path + ": HTTP " + res.status);
      return res.json();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // 参考値（index-stats.json）は無くてもシミュレーション自体は成立するので、
    // 読めなかった場合は null を渡して先に進む
    Promise.all([
      loadJson("data/events.json"),
      loadJson("data/index-stats.json").catch(function () {
        return null;
      }),
    ])
      .then(function (loaded) {
        window.UI.init(loaded[0], loaded[1]);
      })
      .catch(function (err) {
        showFatalError(
          "暴落データの読み込みに失敗しました（" +
            err.message +
            "）。ローカルで開いている場合は、ファイルを直接開くのではなくHTTPサーバー経由で表示してください。"
        );
      });
  });
})();
