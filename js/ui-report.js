window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  function render(el, state, api) {
    const { esc, yen, fmt1, signed } = U(); const period = state.store.period;
    const D = Sim.ui.diagnosis.parts; const P = Sim.ui.plan.parts;
    const st = Sim.calc.store(state, period); const pf = Sim.analysis.portfolio(state, period); const lv = Sim.analysis.leverage(state, period);
    const wk = Sim.analysis.weakness(state, period); const tm = Sim.analysis.timing(state, period); const cm = Sim.analysis.comments(state, period);
    const plan = state.plan; const sc = plan.scenarios[plan.activeScenario]; const target = plan.targetRevenue[period - 1];
    const rv = Sim.calc.reverse(state, period, target); const now = Sim.calc.store(state, period, sc.levers);
    const today = new Date().toLocaleDateString('ja-JP'); const leverName = k => (P.TACTIC_LEVERS.find(x => x[0] === k) || ['', ''])[1];
    const leverRows = state.categories.map(c => { const l = sc.levers[c.id] || {}; return `<tr><td>${esc(c.name)}</td>${P.LEVERS.map(L => `<td>${signed(l[L.key] || 0, L.unit)}</td>`).join('')}</tr>`; }).join('');
    el.innerHTML = `
      <div class="report-tools no-print"><button type="button" class="sbtn primary" data-action="print">印刷／PDF保存</button><span class="note-p">A4縦・6ページ構成。印刷ダイアログで「PDFに保存」を選べます。内容は①〜③の最新状態です。</span></div>
      <div class="report">
        <section class="rpage cover"><div class="eyebrow">STORE SALES SIMULATOR</div><h1>${esc(state.store.name || '店舗')}<br>売上診断と戦略設計</h1>
          <p>${esc(state.store.fiscalLabel)}　／　${period}年で見た場合　／　シナリオ：${esc(sc.name)}</p><p class="small">作成日 ${today}</p></section>
        <section class="rpage"><h2>1. 現状サマリー（${period}年で見た場合）</h2>${D.kpis(st)}${D.table(st)}</section>
        <section class="rpage"><h2>2. 診断</h2><h3>間口ポートフォリオ</h3>${D.quadrantSvg(pf)}<h3>効きどころ</h3>${D.leverageBlock(lv)}<h3>弱点候補</h3>${D.weaknessBlock(wk)}<h3>購入までの期間</h3>${D.timingBlock(tm)}<h3>コメント</h3><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <section class="rpage"><h2>3. 目標とギャップ</h2>${P.reverseTable(rv)}</section>
        <section class="rpage"><h2>4. 戦略（${esc(sc.name)}）</h2><p>この配分での売上 ${yen(now.revenue)}（目標到達率 ${target > 0 ? fmt1(now.revenue / target * 100) + '%' : '—'}）</p>
          <table class="ltable"><tr><th>間口カテゴリ</th>${P.LEVERS.map(L => `<th>${L.label}</th>`).join('')}</tr>${leverRows}</table>
          <h3>打ち手</h3>${sc.tactics.length ? `<table class="ltable"><tr><th>レバー</th><th>打ち手</th><th>担当</th><th>期限</th></tr>${sc.tactics.map(t => `<tr><td>${leverName(t.lever)}</td><td>${esc(t.text)}</td><td>${esc(t.owner)}</td><td>${esc(t.due)}</td></tr>`).join('')}</table>` : '<p class="note-p">打ち手は未選択です。</p>'}
          ${sc.memo ? `<p>${esc(sc.memo)}</p>` : ''}<h3>シナリオ比較</h3>${P.comparison(state, period)}</section>
        <section class="rpage"><h2>5. 前提と計算式</h2><ul class="cm">
          <li>間口＝新規のお客様が最初に買う商品のくくりです。新規獲得人数は1年分を1つの集団として扱い、その集団が1年／2年／3年で生む売上を「期間累計売上」と呼びます。</li>
          <li>顧客あたりLTV（期間）＝間口単価＋同日追加率×同日追加単価＋後日追加率（期間）×後日追加単価（期間）。</li>
          <li>期間累計売上＝新規獲得人数×LTV。粗利＝売上×（1−原価率）。固定費を入れた場合、営業利益＝粗利−固定費×12×年数。</li>
          <li>ポートフォリオの境界は店内の中央値（相対比較）です。弱点候補は目安値・前期がある場合にその比較で、無い場合は店内平均との比較で示します。</li>
          <li>新規獲得人数が10人未満のカテゴリは判定保留です。</li>
          <li>数字の出所：手入力または貼り付け（最終更新 ${esc((state.meta.updatedAt || '').slice(0, 10))}）。すべて試算であり、実数値を入れるほど精度が上がります。</li></ul></section>
      </div>`;
    U().bindPanel(el, api, { print: () => window.print() });
  }
  Sim.ui.report = { render, refresh: render };
})();
