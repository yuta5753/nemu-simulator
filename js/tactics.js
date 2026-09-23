window.Sim = window.Sim || {};
(function () {
  const LIBRARY = {
    new: ['検索広告で入口商品を前面に出す', '来店前の不安を解く相談導線（LINE・電話・予約）を用意する', '紹介特典（ご家族・ご友人）を案内する', 'SNSの短い動画で入口商品の体験を見せる', '地域チラシ・ポスティングで入口商品を告知する'],
    sameDay: ['接客の提案手順（入口商品→付帯品）を台本にする', '入口商品と一緒に使う商品を「セット提案」にする', '入口商品の隣に相性のよい付帯品を陳列する', 'お会計前に「一緒に使うもの」を一言確認する'],
    later: ['購入後{days}日を目安にフォロー連絡（使い心地の確認）', 'LINE・DMで季節の定期接点を持つ', '点検・買替時期の案内を仕組みにする', '次回来店のきっかけ（調整・メンテナンス）を購入時に予約する'],
    aov: ['展開商品の上位グレードを比較提案する', 'まとめ買い・セット割で1回の購入額を上げる', '年間プラン・定期購入を用意する'],
    entryPrice: ['入口商品の価格帯を見直す（安すぎる入口の再設計）', '診断・フィッティングなどの付加価値を入口商品に付ける']
  };
  function avgDays(state) {
    const ds = state.categories.filter(c => c.daysToAddon != null).map(c => c.daysToAddon);
    return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null;
  }
  function resolve(text, state) {
    const d = avgDays(state); return String(text).replace('{days}', d == null ? '○' : String(Math.round(d / 2)));
  }
  Sim.tactics = { LIBRARY, avgDays, resolve };
})();
