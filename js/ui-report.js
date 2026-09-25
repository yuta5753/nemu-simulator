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
    const rv = Sim.calc.reverse(state, period, target); const now = Sim.calc.store(state, period, sc.levers); const reach = Sim.calc.reachRate(state, period, sc);
    const today = new Date().toLocaleDateString('ja-JP'); const leverName = k => (P.TACTIC_LEVERS.find(x => x[0] === k) || ['', ''])[1];
    const h = Sim.analysis.mgmtHealth(state); const cc = Sim.analysis.consistencyCheck(state); const mcm = Sim.analysis.mgmtComments(state); const mlv = Sim.calc.mgmtLeverage(state); const rq = Sim.calc.requiredRevenue(state);
    let n = 0; const sec = () => ++n;
    const mgmtPages = h.available ? `
        <section class="rpage"><h2>${sec()}. 経営数値サマリー</h2>${D.mgmtKpis(h.m)}<h3>収益構造</h3>${D.waterfallSvg(h.m)}<h3>費用比率</h3>${D.costBars(h)}</section>
        <section class="rpage"><h2>${sec()}. 経営の健康度</h2><h3>顧客の構成</h3>${D.customerMix(h.m)}<h3>商品・粗利</h3>${D.productTable(h.m, h)}</section>
        <section class="rpage"><h2>${n}. 経営の健康度（つづき：集客・整合・効きどころ・コメント）</h2><h3>集客効率と買替</h3>${D.funnelBlock(h.m, state)}<h3>①と②の整合</h3>${D.consistencyBlock(cc)}<h3>営業利益への効きどころ</h3>${D.mgmtLeverageBlock(mlv)}<h3>コメント</h3><ul class="cm">${mcm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : '';
    const leverRows = state.categories.map(c => { const l = sc.levers[c.id] || {}; return `<tr><td>${esc(c.name)}</td>${P.LEVERS.map(L => `<td>${signed(l[L.key] || 0, L.unit)}</td>`).join('')}</tr>`; }).join('');
    const tacticText = t => { if (t.libId) { const idx = +t.libId.split('-').pop(); const entry = Sim.tactics.LIBRARY[t.lever] && Sim.tactics.LIBRARY[t.lever][idx]; if (entry) return esc(Sim.tactics.resolve(entry, state)); } return esc(t.text); };
    el.innerHTML = `
      <div class="report-tools no-print"><button type="button" class="sbtn primary" data-action="print">印刷／PDF保存</button><span class="note-p">A4縦・${h.available ? '10' : '7'}ページ構成（内容量により前後します）。印刷ダイアログで「PDFに保存」を選べます。内容は①〜④の最新状態です。</span></div>
      <div class="report">
        <section class="rpage cover"><div class="eyebrow">STORE SALES SIMULATOR</div><h1>${esc(state.store.name || '店舗')}<br>売上診断と戦略設計</h1>
          <p>${esc(state.store.fiscalLabel)}　／　${U().PERIOD_LABEL(period)}で見た場合　／　シナリオ：${esc(sc.name)}</p><p class="small">作成日 ${today}</p></section>
        ${mgmtPages}
        <section class="rpage"><h2>${sec()}. 間口カテゴリの現状（${U().PERIOD_LABEL(period)}で見た場合）</h2>${D.kpis(st)}${D.table(st)}</section>
        <section class="rpage"><h2>${sec()}. 間口の診断（ポートフォリオ・効きどころ）</h2><h3>間口ポートフォリオ</h3>${D.quadrantSvg(pf)}<h3>効きどころ</h3>${D.leverageBlock(lv)}</section>
        <section class="rpage"><h2>${n}. 間口の診断（つづき：弱点・打ち時・コメント）</h2><h3>弱点候補</h3>${D.weaknessBlock(wk)}<h3>購入までの期間</h3>${D.timingBlock(tm)}<h3>コメント</h3><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <section class="rpage"><h2>${sec()}. 目標とギャップ</h2>${rq ? '<h3>必要利益からの逆算</h3>' + P.requiredTable(rq) : ''}<h3>間口の目標と逆算</h3>${P.reverseTable(rv)}</section>
        <section class="rpage"><h2>${sec()}. 戦略（${esc(sc.name)}）</h2><p>この配分での売上 ${yen(now.revenue)}（目標到達率 ${reach == null ? '—' : fmt1(reach) + '%'}）</p>
          <table class="ltable"><tr><th>間口カテゴリ</th>${P.LEVERS.map(L => `<th>${L.label}</th>`).join('')}</tr>${leverRows}</table>
          <h3>打ち手</h3>${sc.tactics.length ? `<table class="ltable"><tr><th>レバー</th><th>打ち手</th><th>担当</th><th>期限</th></tr>${sc.tactics.map(t => `<tr><td>${leverName(t.lever)}</td><td>${tacticText(t)}</td><td>${esc(t.owner)}</td><td>${esc(t.due)}</td></tr>`).join('')}</table>` : '<p class="note-p">打ち手は未選択です。</p>'}
          ${sc.memo ? `<p>${esc(sc.memo)}</p>` : ''}<h3>シナリオ比較</h3>${P.comparison(state, period)}</section>
        <section class="rpage"><h2>${sec()}. 前提と計算式</h2><ul class="cm">
          <li>経営数値は年次（直近の決算期）です。粗利率＝（総売上−仕入原価）÷総売上、営業利益＝粗利−（人件費＋家賃＋広告宣伝費＋その他経費）、損益分岐点売上＝固定費÷粗利率、安全余裕率＝（総売上−損益分岐点）÷総売上。</li>
          <li>必要売上＝（固定費＋必要営業利益）÷粗利率。間口で稼ぐべき売上＝必要売上−既存客の見込み売上。</li>
          <li>間口＝新規のお客様が最初に買う商品のくくりです。新規獲得人数は1年分を1つの集団として扱い、その集団が12ヶ月／24ヶ月／36ヶ月で生む売上を「期間累計売上」と呼びます。</li>
          <li>顧客あたりLTV（期間）＝間口単価＋同日追加率×同日追加単価＋後日追加率（期間）×後日追加単価（期間）。期間累計売上＝新規獲得人数×LTV。</li>
          <li>間口の粗利＝期間累計売上×（1−原価率）です。原価率は①経営数値の仕入原価÷総売上を優先して使います。固定費（月額）を入れている場合、間口の営業利益＝粗利−固定費×12×年数として参考表示します（店全体の固定費のため、間口だけの利益ではありません）。</li>
          <li>弱点候補は目安値・前期がある場合にその比較で、無い場合は店内平均との比較で示します。</li>
          <li>費用比率・粗利率の比較は前期または目安値がある場合のみ行います。業界の数字は含んでいません。</li>
          <li>ポートフォリオの境界は店内の中央値（相対比較）です。新規獲得人数が10人未満のカテゴリは判定保留です。</li>
          <li>数字の出所：手入力または貼り付け（最終更新 ${esc((state.meta.updatedAt || '').slice(0, 10))}）。すべて試算であり、実数値を入れるほど精度が上がります。</li></ul></section>
      </div>`;
    U().bindPanel(el, api, { print: () => window.print() });
  }
  Sim.ui.report = { render, refresh: render };
})();
