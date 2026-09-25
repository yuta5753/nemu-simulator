window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util; const CP = () => Sim.ui.company.parts; const D = () => Sim.ui.diagnosis.parts;
  function companyKpis(cm) {
    const { yen } = U(); const m = cm.m; const pctS = CP().pctS; const kv = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const opAfterPct = (m.revenue > 0 && cm.operatingProfitAfterHq != null) ? cm.operatingProfitAfterHq / m.revenue : null;
    return `<div class="mgkv">${kv('総売上（合算）', yen(m.revenue))}${kv('粗利率', pctS(m.grossMarginPct))}${kv('営業利益（本部費前）', yen(m.operatingProfit))}${kv('本部費', cm.hq.total == null ? '未入力' : yen(cm.hq.total))}${kv('全社 営業利益', yen(cm.operatingProfitAfterHq))}${kv('全社 営業利益率', pctS(opAfterPct))}${kv('損益分岐点（本部費込み）', yen(cm.breakEvenWithHq))}${kv('安全余裕率（本部費込み）', pctS(cm.safetyMarginWithHq))}</div>`;
  }
  function hqSteps(cm) {
    if (cm.hq.total == null || cm.m.operatingProfit == null) return [];
    return [{ l: '本部費', v: -cm.hq.total, t: 'minus' }, { l: '全社営業利益', v: cm.operatingProfitAfterHq, t: cm.operatingProfitAfterHq >= 0 ? 'profit' : 'loss' }];
  }
  function hqTable(cm) {
    const { yen } = U(); const rows = [['本部 人件費', cm.hq.labor], ['本部 家賃', cm.hq.rent], ['本部 広告宣伝費', cm.hq.ads], ['本部 その他経費', cm.hq.other]];
    return `<table class="ltable"><tr><th>本部費（年）</th><th>金額</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1] == null ? '—' : yen(r[1])}</td></tr>`).join('')}<tr class="total"><td>合計</td><td>${cm.hq.total == null ? '未入力' : yen(cm.hq.total)}</td></tr></table>`;
  }
  function render(el, company, api) {
    const { esc, guide } = U(); const h = Sim.analysis.companyHealth(company); const period = api.period; const cmp = Sim.calc.storeComparison(company, period); const cm = Sim.analysis.companyComments(company, period);
    const health = h.available ? `
      <div class="sec-title"><span class="no">経</span><h2>全社の経営数値</h2></div>${companyKpis(h.cm)}${h.coverageNote ? `<ul class="warn"><li>${esc(h.coverageNote)}</li></ul>` : ''}
      <div class="sec-title"><span class="no">経</span><h2>収益構造</h2><span class="hint">店舗合算 → 本部費 → 全社営業利益</span></div><div class="card pad">${D().waterfallSvg(h.m, hqSteps(h.cm))}</div>
      <div class="sec-title"><span class="no">経</span><h2>費用比率（店舗合算）</h2><span class="hint">${guide('店舗の費用の合算を合算売上で割った比率です。本部費は含みません。目安値は会社共通です。')}</span></div><div class="card pad">${D().costBars(h)}</div>
      <div class="sec-title"><span class="no">経</span><h2>本部費</h2></div><div class="card pad">${hqTable(h.cm)}</div>
      <hr class="sep">` : '<p class="note-p">店舗タブで経営数値を入れると、ここに全社の健康度が出ます。以下は店舗の横並び比較です。</p>';
    el.innerHTML = `${health}
      <div class="sec-title"><span class="no">1</span><h2>店舗横並び比較（経営）</h2><span class="hint">${guide('◎＝店舗内で最良、△＝最下位、○＝その間。費用比率と損益分岐点は低いほど良い向きで判定します。店舗別の営業利益には本部費を含めていません。目安値があれば右端に出ます。')}</span></div>
      <div class="card pad">${CP().comparisonTable(cmp, 'mgmt')}</div>
      <div class="sec-title"><span class="no">2</span><h2>店舗横並び比較（間口・${U().PERIOD_LABEL(period)}）</h2></div><div class="card pad">${CP().comparisonTable(cmp, 'entry')}</div>
      <div class="sec-title"><span class="no">3</span><h2>全社コメント</h2></div><div class="card pad"><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  Sim.ui.companyDiag = { render, refresh: render, parts: { companyKpis, hqSteps, hqTable } };
})();
