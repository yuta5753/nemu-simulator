window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util; const CP = () => Sim.ui.company.parts; const CD = () => Sim.ui.companyDiag.parts; const PP = () => Sim.ui.plan.parts; const D = () => Sim.ui.diagnosis.parts;
  function rollup(company, period) {
    const rows = company.stores.map((s, i) => {
      const m = Sim.calc.mgmt(s); const rq = Sim.calc.requiredRevenue(s); const sc = s.plan.scenarios[s.plan.activeScenario] || s.plan.scenarios[0];
      return { id: s.store.id, name: Sim.state.storeLabel(company, i), revenue: m.revenue, required: rq ? rq.required : null, target: s.plan.targetRevenue[period - 1],
        scenarioRevenue: Sim.calc.store(s, period, sc && sc.levers).revenue, reach: Sim.calc.reachRate(s, period, sc) };
    });
    const sum = k => (rows.some(r => r[k] != null) ? rows.reduce((a, r) => a + (r[k] || 0), 0) : null);
    const allRequired = rows.length > 0 && rows.every(r => r.required != null); const allTarget = rows.length > 0 && rows.every(r => r.target > 0);
    const allRevenue = rows.length > 0 && rows.every(r => r.revenue != null);
    const target = allTarget ? sum('target') : null; const scen = sum('scenarioRevenue');
    return { rows, allRequired, allTarget, allRevenue, total: { revenue: allRevenue ? sum('revenue') : null, required: allRequired ? sum('required') : null, target, scenarioRevenue: scen, reach: (allTarget && target > 0 && scen != null) ? scen / target * 100 : null }, company: Sim.calc.companyRequired(company) };
  }
  function rollupTable(r, period) {
    const { esc, yen, fmt1 } = U(); const cell = v => (v == null ? '—' : yen(v)); const reach = v => (v == null ? '—' : fmt1(v) + '%');
    return `<div class="cmp-wrap"><table class="ltable cmp-table"><tr><th>店舗</th><th>現状売上（年）</th><th>店舗の必要売上</th><th>間口の目標売上（${U().PERIOD_LABEL(period)}）</th><th>今の配分での売上</th><th>到達率</th></tr>
      ${r.rows.map(x => `<tr><td>${esc(x.name)}</td><td>${cell(x.revenue)}</td><td>${cell(x.required)}</td><td>${cell(x.target)}</td><td>${cell(x.scenarioRevenue)}</td><td>${reach(x.reach)}</td></tr>`).join('')}
      <tr class="total"><td>合計</td><td>${r.allRevenue ? cell(r.total.revenue) : '—（未入力の店舗あり）'}</td><td>${r.allRequired ? cell(r.total.required) : '—（未入力の店舗あり）'}</td><td>${r.allTarget ? cell(r.total.target) : '—（未入力の店舗あり）'}</td><td>${cell(r.total.scenarioRevenue)}</td><td>${reach(r.total.reach)}</td></tr></table></div>`;
  }
  function absorptionBlock(r) {
    const { yen } = U(); const co = r.company;
    if (!co) return '<p class="note-p">全社の必要営業利益と、各店舗の①費用の構造が揃うと「本部費を賄えるか」の判定が出ます。</p>';
    if (!r.allRequired) return `<p class="note-p">全社の必要売上は ${yen(co.required)}（本部費 ${co.hqTotal == null ? '未入力' : yen(co.hqTotal)} 込み）です。各店舗タブの④「必要利益からの逆算」を全店で入れると、店舗目標の合計と比べられます。</p>`;
    const diff = co.required - r.total.required;
    if (diff === 0) return `<p class="note-p ok">店舗ごとの必要売上の合計 ${yen(r.total.required)} は、全社の必要売上とちょうど同じです。店舗目標を足し合わせれば本部費を賄える計算です。</p>`;
    return diff > 0
      ? `<ul class="warn"><li>店舗ごとの必要売上の合計 ${yen(r.total.required)} では、本部費＋全社の必要利益（必要売上 ${yen(co.required)}）に届きません。差 ${yen(diff)} を各店舗の目標に上乗せすると届く計算です（割り振りは各店舗タブで行います）。</li></ul>`
      : `<p class="note-p ok">店舗ごとの必要売上の合計 ${yen(r.total.required)} は、全社の必要売上 ${yen(co.required)} を ${yen(-diff)} 上回っています。店舗目標を足し合わせれば本部費を賄える計算です。</p>`;
  }
  function renderPlan(el, company, api) {
    const { val, guide } = U(); const p = company.company.plan; const period = api.period;
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>必要利益からの逆算（全社）</h2><span class="hint">${guide('全社で出したい営業利益から、本部費を含めた固定費と合算粗利率で必要売上を逆算します。店舗への割り振りは自動では行いません。')}</span></div>
      <div class="card globals">
        <div class="gbox"><label>全社の必要営業利益（年）</label><div class="row"><input type="number" min="0" step="10" data-type="man" data-path="company.plan.requiredProfit" value="${U().man(p.requiredProfit)}"><span class="unit">万円</span></div></div>
        <div class="gbox"><label>既存客売上の見込み（現状比）</label><div class="row"><input type="number" step="1" data-type="num" data-path="company.plan.existingGrowthPct" value="${val(p.existingGrowthPct)}"><span class="unit">%</span></div></div>
      </div>
      <div class="card pad" data-out="co-required"></div>
      <div class="sec-title"><span class="no">2</span><h2>店舗目標のロールアップ（${U().PERIOD_LABEL(period)}で見た場合）</h2><span class="hint">各店舗タブの目標と選択中シナリオをそのまま合計します</span></div>
      <div class="card pad" data-out="co-rollup"></div>
      <div class="sec-title"><span class="no">3</span><h2>本部費を賄えるか</h2></div>
      <div class="card pad" data-out="co-absorb"></div>`;
    outputsPlan(el, company, api); U().bindPanel(el, api, {});
  }
  function outputsPlan(el, company, api) {
    const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    const r = rollup(company, api.period);
    set('co-required', r.company ? PP().requiredTable(r.company) + '<p class="note-p">固定費には本部費を含めています。「間口で稼ぐべき売上」は全社合計の目安で、店舗の目標には自動反映しません。</p>' : '<p class="note-p">上の必要営業利益を入れると、本部費込みの必要売上が出ます（各店舗の①で費用の構造が揃っていることが前提です）。</p>');
    set('co-rollup', rollupTable(r, api.period)); set('co-absorb', absorptionBlock(r));
  }
  function renderReport(el, company, api) {
    const { esc } = U(); const period = api.period; const h = Sim.analysis.companyHealth(company); const cmp = Sim.calc.storeComparison(company, period); const cm = Sim.analysis.companyComments(company, period); const r = rollup(company, period);
    const today = new Date().toLocaleDateString('ja-JP'); let n = 0; const sec = () => ++n;
    el.innerHTML = `
      <div class="report-tools no-print"><button type="button" class="sbtn primary" data-action="print">印刷／PDF保存</button><span class="note-p">A4縦・表紙＋4ページ（全社サマリー）。店舗ごとの10ページは各店舗タブの⑤から印刷します。</span></div>
      <div class="report">
        <section class="rpage cover"><div class="eyebrow">STORE SALES SIMULATOR</div><h1>${esc(company.company.name || '全社')}<br>全社サマリー</h1><p>${company.stores.length}店舗　／　${U().PERIOD_LABEL(period)}で見た場合</p><p class="small">作成日 ${today}</p></section>
        <section class="rpage"><h2>${sec()}. 全社の経営数値</h2>${h.available ? `${CD().companyKpis(h.cm)}${h.coverageNote ? `<p class="note-p">${esc(h.coverageNote)}</p>` : ''}<h3>収益構造</h3>${D().waterfallSvg(h.m, CD().hqSteps(h.cm))}<h3>費用比率（店舗合算）</h3>${D().costBars(h)}` : '<p class="note-p">店舗の経営数値が未入力です。</p>'}</section>
        <section class="rpage"><h2>${sec()}. 店舗横並び比較</h2><h3>経営</h3>${CP().comparisonTable(cmp, 'mgmt')}<h3>間口（${U().PERIOD_LABEL(period)}）</h3>${CP().comparisonTable(cmp, 'entry')}<h3>コメント</h3><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <section class="rpage"><h2>${sec()}. 目標のロールアップ</h2><h3>本部費</h3>${h.available ? CD().hqTable(h.cm) : '<p class="note-p">—</p>'}<h3>必要利益からの逆算（全社）</h3>${r.company ? PP().requiredTable(r.company) : '<p class="note-p">全社④で必要営業利益を入れると、ここに必要売上が出ます。</p>'}<h3>店舗目標の合計</h3>${rollupTable(r, period)}<h3>本部費を賄えるか</h3>${absorptionBlock(r)}</section>
        <section class="rpage"><h2>${sec()}. 前提と計算式</h2><ul class="cm">
          <li>全社の数字は各店舗の①経営数値を合算したものです。金額・人数は足し算、率は合算後に再計算します（粗利率＝合算粗利÷合算売上、リピート率＝合算の2回以上÷合算の来店回数計）。空欄の店舗はその項目の合算に含めていません。</li>
          <li>本部費は全社の固定費にのみ加えます。店舗別の営業利益・損益分岐点には本部費を含めていません。全社営業利益＝店舗合算の営業利益−本部費、全社の損益分岐点売上＝（店舗固定費の合算＋本部費）÷合算粗利率。</li>
          <li>全社の必要売上＝（店舗固定費の合算＋本部費＋全社の必要営業利益）÷合算粗利率。店舗への割り振りは自動では行いません。</li>
          <li>横並びの◎○△は店舗内の相対順位です（費用比率と損益分岐点は低いほど良い向き）。目安値は会社共通で、業界の数字は含んでいません。</li>
          <li>間口の指標は各店舗の②間口カテゴリから期間（${U().PERIOD_LABEL(period)}）で計算しています。カテゴリの店舗横断の合算はしていません。</li>
          <li>数字の出所：各店舗の入力（最終更新 ${esc((company.meta.updatedAt || '').slice(0, 10))}）。すべて試算です。</li></ul></section>
      </div>`;
    U().bindPanel(el, api, { print: () => window.print() });
  }
  Sim.ui.companyPlan = { plan: { render: renderPlan, refresh: outputsPlan }, report: { render: renderReport, refresh: renderReport }, parts: { rollup, rollupTable, absorptionBlock } };
})();
