window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  function kpis(st) {
    const { yen, fmt } = U();
    return `<div class="kpis">
      <div class="kpi"><div class="klab">新規獲得（合計）</div><div class="kval">${fmt(st.newTotal)}<span class="yen"> 人</span></div><div class="ksub">全間口カテゴリの新規</div></div>
      <div class="kpi"><div class="klab">加重平均LTV（顧客あたり）</div><div class="kval">${yen(st.weightedLtv)}</div><div class="ksub">${st.period}年で見た累計</div></div>
      <div class="kpi"><div class="klab">期間累計 売上</div><div class="kval">${yen(st.revenue)}</div><div class="ksub">新規 × LTV</div></div>
      <div class="kpi accent"><div class="klab">期間累計 粗利</div><div class="kval">${yen(st.grossProfit)}</div><div class="ksub">${st.operatingProfit != null ? `固定費 ${yen(st.fixedTotal)} → 営業利益 <b>${yen(st.operatingProfit)}</b>` : '売上 ×（1 − 原価率）'}</div></div>
    </div>`;
  }
  function table(st) {
    const { yen, fmt, fmt1, esc } = U();
    let html = `<table class="ltable"><tr><th>間口カテゴリ</th><th>新規</th><th>間口単価</th><th>同日追加/人</th><th>後日追加/人</th><th>LTV</th><th>売上</th><th>構成比</th></tr>
      ${st.categories.map(c => `<tr><td>${esc(c.name)}</td><td>${fmt(c.newN)}</td><td>${yen(c.entryPrice)}</td><td>${yen(c.sameDayPart)}</td><td>${yen(c.laterPart)}</td><td>${yen(c.ltv)}</td><td>${yen(c.revenue)}</td><td>${fmt1(c.share * 100)}%</td></tr>`).join('')}</table>`;
    if (st.channels.length) html += `<h3 class="h3">集客経路</h3><table class="ltable"><tr><th>経路</th><th>新規</th><th>費用</th><th>CPA</th><th>粗利LTV ÷ CPA</th></tr>
      ${st.channels.map(ch => `<tr><td>${esc(ch.name)}</td><td>${fmt(ch.newCustomers)}</td><td>${yen(ch.cost)}</td><td>${yen(ch.cpa)}</td><td>${ch.payback == null ? '—' : fmt1(ch.payback) + '倍'}</td></tr>`).join('')}</table>`;
    return html;
  }
  function quadrantSvg(pf) {
    const { esc, yen } = U();
    if (!pf.available) return `<p class="note-p">${esc(pf.reason)}</p>`;
    const W = 560, H = 400, P = 50;
    const maxX = Math.max(...pf.points.map(p => p.x), pf.xBoundary) * 1.15 || 1, maxY = Math.max(...pf.points.map(p => p.y), pf.yBoundary) * 1.15 || 1;
    const sx = x => P + (x / maxX) * (W - 2 * P), sy = y => H - P - (y / maxY) * (H - 2 * P);
    const bx = sx(pf.xBoundary), by = sy(pf.yBoundary);
    const lab = (x, y, t, cls) => `<text x="${x}" y="${y}" class="qlab ${cls || ''}">${t}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="quad" role="img" aria-label="間口ポートフォリオ">
      <rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" class="qbg"/>
      <line x1="${bx}" y1="${P}" x2="${bx}" y2="${H - P}" class="qline"/><line x1="${P}" y1="${by}" x2="${W - P}" y2="${by}" class="qline"/>
      ${lab(W - P - 4, P + 14, '主力（伸ばす）', 'end')}${lab(W - P - 4, H - P - 6, '入口止まり（育てる）', 'end')}${lab(P + 4, P + 14, '隠れた優良間口（集客を寄せる）', '')}${lab(P + 4, H - P - 6, '見直す', '')}
      <text x="${W / 2}" y="${H - 12}" class="qaxis">集客力（新規 × 間口単価）→</text>
      <text x="14" y="${H / 2}" class="qaxis" transform="rotate(-90 14 ${H / 2})">展開力（新規1人あたりの追加額）→</text>
      ${pf.points.map(p => { const r = 8 + Math.sqrt(p.share) * 28; return `<g><circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${r}" class="qdot ${p.pending ? 'pending' : p.quadrant}"/><text x="${sx(p.x)}" y="${sy(p.y) - r - 4}" class="qname">${esc(p.name)}</text></g>`; }).join('')}
    </svg>
    <table class="ltable"><tr><th>間口カテゴリ</th><th>位置づけ</th><th>集客力</th><th>展開力</th></tr>
      ${pf.points.map(p => `<tr><td>${esc(p.name)}</td><td><span class="tag ${p.pending ? 'pending' : p.quadrant}">${p.label}</span></td><td>${yen(p.x)}</td><td>${yen(p.y)}</td></tr>`).join('')}</table>`;
  }
  function leverageBlock(lv) {
    const { esc, yen } = U();
    return `<div class="lev-grid">${lv.perCategory.map(c => `<div class="card lev"><div class="lev-name">${esc(c.name)}${c.pending ? '<span class="tag pending">判定保留</span>' : ''}</div>
        ${c.top ? `<div class="lev-top">最も効く：<b>${c.top.label}</b>（${yen(c.top.delta)} 増）</div>` : '<div class="lev-top">効くレバーがありません（入力をご確認ください）</div>'}
        <ol class="lev-list">${c.ranked.map(r => `<li><span>${r.label}</span><span>${yen(r.delta)}</span></li>`).join('')}</ol></div>`).join('')}</div>
      <div class="impact"><div class="il">店全体で最も効くレバー（標準幅：新規+10%／同日率+5pt／後日率+5pt／追加単価+10%／間口単価+5%）</div>
        <div class="iv">${lv.store.top ? `${esc(lv.store.top.label)}<span class="delta up">${yen(lv.store.top.delta)} 増</span>` : '—'}</div></div>`;
  }
  function weaknessBlock(wk) {
    const { esc, fmt1 } = U(); const modeLabel = { benchmark: '目安値との比較', prev: '前期との比較', relative: '店内の相対比較' }[wk.mode];
    return `<p class="note-p">物差し：${modeLabel}${wk.hint ? `　${esc(wk.hint)}` : ''}</p>` +
      (wk.items.length ? `<table class="ltable"><tr><th>間口カテゴリ</th><th>項目</th><th>実績</th><th>比較先</th><th>比率</th></tr>
        ${wk.items.map((it, i) => `<tr class="${i === 0 ? 'worst' : ''}"><td>${esc(it.name)}</td><td>${esc(it.metric)}</td><td>${fmt1(it.actual)}${it.unit}</td><td>${fmt1(it.reference)}${it.unit}</td><td>${fmt1(it.ratio * 100)}%</td></tr>`).join('')}</table>` : '<p class="note-p">比較できる項目がありません。</p>');
  }
  function timingBlock(tm) {
    const { esc } = U();
    if (!tm.length) return '<p class="note-p">①で「初回→追加購入までの日数」を入れると、フォローの打ち時が出ます。</p>';
    const max = Math.max(...tm.map(t => t.days), 1);
    return tm.map(t => `<div class="tm-row"><div class="tm-name">${esc(t.name)}</div>
      <div class="tm-bar"><div class="tm-fill" style="width:${Math.min(100, t.days / max * 100)}%"></div><span>${t.days}日</span></div>
      <div class="tm-touch">${t.touchpoints.map(p => `${p.label}：${p.day}日目`).join(' ／ ')}</div>${t.warning ? `<div class="warn-inline">${esc(t.warning)}</div>` : ''}</div>`).join('');
  }
  function render(el, state) {
    const { esc, guide } = U(); const period = state.store.period;
    const st = Sim.calc.store(state, period); const pf = Sim.analysis.portfolio(state, period); const lv = Sim.analysis.leverage(state, period);
    const wk = Sim.analysis.weakness(state, period); const tm = Sim.analysis.timing(state, period); const cm = Sim.analysis.comments(state, period);
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>現状サマリー（${period}年で見た場合）</h2></div>${kpis(st)}<div class="card pad">${table(st)}</div>
      <div class="sec-title"><span class="no">2</span><h2>間口ポートフォリオ</h2><span class="hint">横＝集客力、縦＝展開力。境界は店内の中央値${guide('横軸は「新規×間口単価」（入口としてどれだけ売上を作るか）、縦軸は「LTV−間口単価」（入口の後に1人がどれだけ追加で買うか）です。境界は店内カテゴリの中央値なので、他店との比較ではなく自店内の相対的な位置づけです。')}</span></div><div class="card pad">${quadrantSvg(pf)}</div>
      <div class="sec-title"><span class="no">3</span><h2>効きどころ</h2><span class="hint">標準的な改善幅を当てたとき、どのレバーが売上を最も動かすか</span></div>${leverageBlock(lv)}
      <div class="sec-title"><span class="no">4</span><h2>弱点候補</h2><span class="hint">${guide('目安値（①の任意欄）があればそれと、前期の数字があればそれと比較します。どちらも無い場合は店内の加重平均より低い率を挙げます。')}</span></div><div class="card pad">${weaknessBlock(wk)}</div>
      <div class="sec-title"><span class="no">5</span><h2>購入までの期間とフォローの打ち時</h2></div><div class="card pad">${timingBlock(tm)}</div>
      <div class="sec-title"><span class="no">6</span><h2>診断コメント</h2></div><div class="card pad"><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  Sim.ui.diagnosis = { render, refresh: render, parts: { kpis, table, quadrantSvg, leverageBlock, weaknessBlock, timingBlock } };
})();
