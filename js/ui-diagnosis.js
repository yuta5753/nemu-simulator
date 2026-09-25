window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  function kpis(st) {
    const { yen, fmt } = U();
    return `<div class="kpis">
      <div class="kpi"><div class="klab">新規獲得（合計）</div><div class="kval">${fmt(st.newTotal)}<span class="yen"> 人</span></div><div class="ksub">全間口カテゴリの新規</div></div>
      <div class="kpi"><div class="klab">加重平均LTV（顧客あたり）</div><div class="kval">${yen(st.weightedLtv)}</div><div class="ksub">${U().PERIOD_LABEL(st.period)}累計</div></div>
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
    const { esc, fmt1 } = U(); const modeLabel = { benchmark: '目安値との比較', prev: '前期との比較', relative: '店内の相対比較' }[wk.mode] || '比較';
    return `<p class="note-p">物差し：${modeLabel}${wk.hint ? `　${esc(wk.hint)}` : ''}</p>` +
      (wk.items.length ? `<table class="ltable"><tr><th>間口カテゴリ</th><th>項目</th><th>実績</th><th>比較先</th><th>比率</th></tr>
        ${wk.items.map((it, i) => `<tr class="${i === 0 ? 'worst' : ''}"><td>${esc(it.name)}</td><td>${esc(it.metric)}</td><td>${fmt1(it.actual)}${it.unit}</td><td>${fmt1(it.reference)}${it.unit}</td><td>${fmt1(it.ratio * 100)}%</td></tr>`).join('')}</table>` : '<p class="note-p">比較できる項目がありません。</p>');
  }
  function timingBlock(tm) {
    const { esc } = U();
    if (!tm.length) return '<p class="note-p">②で「初回→追加購入までの期間」を入れると、フォローの打ち時が出ます。</p>';
    const max = Math.max(...tm.map(t => t.days), 1);
    return tm.map(t => `<div class="tm-row"><div class="tm-name">${esc(t.name)}</div>
      <div class="tm-bar"><div class="tm-fill" style="width:${Math.min(100, t.days / max * 100)}%"></div><span>${t.days}日（約${U().months(t.days)}ヶ月）</span></div>
      <div class="tm-touch">${t.touchpoints.map(p => `${p.label}：${p.day}日目`).join(' ／ ')}</div>${t.warning ? `<div class="warn-inline">${esc(t.warning)}</div>` : ''}</div>`).join('');
  }
  const pctS = v => (v == null ? '—' : (Math.round(v * 1000) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '%');
  function mgmtKpis(m) {
    const { yen } = U();
    return `<div class="mgkv">
      <div><div class="k">総売上（年）</div><div class="v">${yen(m.revenue)}</div></div>
      <div><div class="k">客単価</div><div class="v">${yen(m.aov)}</div></div>
      <div><div class="k">新規／既存の売上比</div><div class="v">${pctS(m.newShare)} ／ ${m.newShare == null ? '—' : pctS(1 - m.newShare)}</div></div>
      <div><div class="k">リピート率（2回以上）</div><div class="v">${pctS(m.repeatRate)}</div></div>
      <div><div class="k">粗利率</div><div class="v">${pctS(m.grossMarginPct)}</div></div>
      <div><div class="k">営業利益率</div><div class="v">${pctS(m.opMarginPct)}</div></div>
      <div><div class="k">損益分岐点売上</div><div class="v">${yen(m.breakEven)}</div></div>
      <div><div class="k">安全余裕率</div><div class="v">${pctS(m.safetyMargin)}</div></div>
    </div>`;
  }
  function waterfallSvg(m, extra) {
    const { yen } = U();
    if (m.revenue == null || m.cogs == null) return '<p class="note-p">総売上と仕入原価を入れると収益構造の図が出ます。</p>';
    const steps = [{ l: '売上', v: m.revenue, t: 'total' }, { l: '仕入原価', v: -m.cogs, t: 'minus' }, { l: '粗利', v: m.grossProfit, t: 'total' }];
    const c = m.costs; const add = (l, v) => { if (v != null) steps.push({ l, v: -v, t: 'minus' }); };
    add('人件費', c.labor); add('家賃', c.rent); add('広告費', c.ads); add('その他', c.other);
    if (m.operatingProfit != null) steps.push({ l: '営業利益', v: m.operatingProfit, t: m.operatingProfit >= 0 ? 'profit' : 'loss' });
    (extra || []).forEach(s => steps.push(s));
    const W = 720, H = 300, P = 40, bw = (W - 2 * P) / steps.length; const max = Math.max(m.revenue, 1);
    let levelCalc = 0; const allLevels = []; const totalsAndProfit = [];
    steps.forEach(s => {
      if (s.t === 'minus') { levelCalc = levelCalc + s.v; allLevels.push(levelCalc); }
      else { levelCalc = s.v; allLevels.push(levelCalc); totalsAndProfit.push(s.v); }
    });
    const minV = Math.min(0, ...allLevels, ...totalsAndProfit);
    const scale = (H - 2 * P) / (max - minV); const y0 = P + max * scale;
    let level = 0; const bars = steps.map((s, i) => {
      let top, bottom;
      if (s.t === 'minus') { top = level + s.v; bottom = level; level = top; }
      else { top = Math.max(0, s.v); bottom = Math.min(0, s.v); level = s.v; }
      const x = P + i * bw + bw * 0.15; const yTop = y0 - Math.max(top, bottom) * scale; const h = Math.max(1, Math.abs(top - bottom) * scale);
      return `<rect x="${x}" y="${yTop}" width="${bw * 0.7}" height="${h}" class="bar-${s.t}"/><text x="${x + bw * 0.35}" y="${yTop - 4}" class="val">${(s.v < 0 ? '−' : '') + yen(Math.abs(s.v))}</text><text x="${x + bw * 0.35}" y="${H - P + 16}" class="lbl">${s.l}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="wf" role="img" aria-label="収益構造"><line x1="${P}" y1="${y0}" x2="${W - P}" y2="${y0}" class="axis"/>${bars}</svg>`;
  }
  function costBars(h) {
    const rows = h.ratios.filter(r => r.value != null); if (!rows.length) return '<p class="note-p">費用を入れると比率が出ます。</p>';
    const max = Math.max(...rows.map(r => Math.max(r.value, r.prev || 0, r.bench || 0)), 0.05) * 1.25;
    const w = v => Math.min(100, v / max * 100);
    return rows.map(r => `<div class="hbar-row"><span>${r.label}</span><div class="hbar"><div class="cur" style="width:${w(r.value)}%"></div>${r.prev != null ? `<div class="prev" style="width:${w(r.prev)}%"></div>` : ''}${r.bench != null ? `<div class="bench" style="left:${w(r.bench)}%"></div>` : ''}</div><b>${pctS(r.value)}</b></div>`).join('') +
      `<div class="hbar-legend">金＝今期${rows.some(r => r.prev != null) ? '　青＝前期' : ''}${rows.some(r => r.bench != null) ? '　赤線＝目安値' : ''}</div>`;
  }
  function customerMix(m) {
    const { fmt } = U();
    const mix = m.newShare == null ? '<p class="note-p">新規客売上を入れると新規／既存の比率が出ます。</p>' :
      `<div class="mix"><span class="new" style="width:${Math.max(4, m.newShare * 100)}%">新規 ${pctS(m.newShare)}</span><span class="exist" style="width:${Math.max(4, (1 - m.newShare) * 100)}%">既存 ${pctS(1 - m.newShare)}</span></div>`;
    const v = m.visits; const tot = m.visitsTotal;
    const dist = tot ? `<div class="hbar-row"><span>来店1回</span><div class="hbar"><div class="cur" style="width:${v.once / tot * 100}%"></div></div><b>${fmt(v.once)}人</b></div>
      <div class="hbar-row"><span>来店2回</span><div class="hbar"><div class="cur" style="width:${v.twice / tot * 100}%"></div></div><b>${fmt(v.twice)}人</b></div>
      <div class="hbar-row"><span>3回以上</span><div class="hbar"><div class="cur" style="width:${v.threePlus / tot * 100}%"></div></div><b>${fmt(v.threePlus)}人</b></div>` : '<p class="note-p">来店回数別の客数を入れると分布が出ます。</p>';
    return mix + dist + `<div class="autovals"><span>リピート率<b>${pctS(m.repeatRate)}</b></span><span>年間来店頻度<b>${m.visitFrequency == null ? '—' : (Math.round(m.visitFrequency * 100) / 100) + '回'}</b></span><span>休眠客数<b>${m.dormant == null ? '—' : fmt(m.dormant) + '人'}</b></span></div>`;
  }
  function productTable(m, h) {
    const { esc, yen, fmt1 } = U(); if (!m.products.length) return '<p class="note-p">カテゴリ別の売上と粗利率を入れると粗利貢献が出ます。</p>';
    const low = new Set(h.lowContribution);
    return `<table class="ltable"><tr><th>カテゴリ</th><th>売上</th><th>売上シェア</th><th>粗利率</th><th>粗利貢献シェア</th><th></th></tr>
      ${m.products.map(p => `<tr><td>${esc(p.name)}</td><td>${yen(p.sales)}</td><td>${pctS(p.share)}</td><td>${p.grossMarginPct == null ? '—' : fmt1(p.grossMarginPct) + '%'}</td><td>${pctS(p.contributionShare)}</td><td>${low.has(p.name) ? '<span class="tag review">粗利貢献が小さい</span>' : ''}</td></tr>`).join('')}</table>
      <div class="autovals"><span>在庫回転<b>${m.inventoryTurnMonths == null ? '—' : (Math.round(m.inventoryTurnMonths * 10) / 10) + 'ヶ月分'}</b></span></div>`;
  }
  function funnelBlock(m, state) {
    const { esc, yen, fmt } = U(); let html = '';
    const f = m.funnel;
    if (f.reservations != null || f.visits != null || f.deals != null) html += `<div class="autovals"><span>予約→来店<b>${pctS(f.visitRate)}</b></span><span>来店→成約<b>${pctS(f.dealRate)}</b></span></div>`;
    if (m.replacement.length) html += `<h3 class="h3">買替の見込み（今後1年）</h3><table class="ltable"><tr><th>商品</th><th>見込み客数</th><th>見込み売上（②の間口単価×人数）</th></tr>${m.replacement.map(r => {
      const cat = state.categories.find(c => c.name === r.name);
      const rev = (cat && r.expectedBuyers != null) ? cat.entryPrice * r.expectedBuyers : null;
      const revMsg = !cat ? '—（②に同名のカテゴリがありません）' : (r.expectedBuyers == null ? '—（サイクル年数と購入者数を入れると出ます）' : yen(rev));
      return `<tr><td>${esc(r.name)}</td><td>${r.expectedBuyers == null ? '—' : fmt(Math.round(r.expectedBuyers)) + '人'}</td><td>${revMsg}</td></tr>`;
    }).join('')}</table>`;
    return html || '<p class="note-p">予約→成約・買替周期を入れると集客効率が出ます。</p>';
  }
  function consistencyBlock(cc) {
    const { fmt, yen, esc } = U();
    return `<table class="ltable"><tr><th></th><th>②間口カテゴリの合計</th><th>①経営数値</th><th>比</th></tr>
      <tr><td>新規人数</td><td>${fmt(cc.entryNewTotal)}人</td><td>${cc.newBuyers == null ? '—' : fmt(cc.newBuyers) + '人'}</td><td>${cc.newBuyersRatio == null ? '—' : pctS(cc.newBuyersRatio)}</td></tr>
      <tr><td>初回来店の売上</td><td>${yen(cc.entryNewRevenue)}</td><td>${yen(cc.newRevenue)}</td><td>${cc.newRevenueRatio == null ? '—' : pctS(cc.newRevenueRatio)}</td></tr></table>
      ${cc.flags.length ? `<ul class="warn">${cc.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="note-p">②と①のズレは許容範囲（80〜120%）です。</p>'}`;
  }
  function mgmtLeverageBlock(lv) {
    const { yen } = U(); if (!lv) return '<p class="note-p">費用の構造を入れると、営業利益への効きどころが出ます。</p>';
    return `<div class="lev-inline">${lv.items.map((it, i) => `<div class="${i === 0 ? 'top' : ''}">${it.label}<b>${(it.delta >= 0 ? '+' : '−') + yen(Math.abs(it.delta))}</b></div>`).join('')}</div><p class="note-p">現状の営業利益 ${yen(lv.base)} に対する増分の試算です（売上増は仕入原価も同率で増える前提、固定費は不変）。</p>`;
  }
  function render(el, state) {
    const { esc, guide } = U(); const period = state.store.period;
    const st = Sim.calc.store(state, period); const pf = Sim.analysis.portfolio(state, period); const lv = Sim.analysis.leverage(state, period);
    const wk = Sim.analysis.weakness(state, period); const tm = Sim.analysis.timing(state, period); const cm = Sim.analysis.comments(state, period);
    const h = Sim.analysis.mgmtHealth(state); const mlv = Sim.calc.mgmtLeverage(state); const cc = Sim.analysis.consistencyCheck(state); const mcm = Sim.analysis.mgmtComments(state);
    const mgmtHtml = h.available ? `
      <div class="sec-title"><span class="no">経</span><h2>経営数値サマリー</h2></div>${mgmtKpis(h.m)}
      <div class="sec-title"><span class="no">経</span><h2>収益構造</h2><span class="hint">売上から営業利益までの流れ</span></div><div class="card pad">${waterfallSvg(h.m)}</div>
      <div class="sec-title"><span class="no">経</span><h2>費用比率</h2><span class="hint">${guide('売上に対する各費用の割合です。前期を入れると薄い青、目安値を入れると赤い線で比較できます。業界の数字は入っていません。')}</span></div><div class="card pad">${costBars(h)}</div>
      <div class="sec-title"><span class="no">経</span><h2>顧客の構成</h2></div><div class="card pad">${customerMix(h.m)}</div>
      <div class="sec-title"><span class="no">経</span><h2>商品・粗利</h2></div><div class="card pad">${productTable(h.m, h)}</div>
      <div class="sec-title"><span class="no">経</span><h2>集客効率と買替</h2></div><div class="card pad">${funnelBlock(h.m, state)}</div>
      <div class="sec-title"><span class="no">経</span><h2>①と②の整合チェック</h2></div><div class="card pad">${consistencyBlock(cc)}</div>
      <div class="sec-title"><span class="no">経</span><h2>営業利益への効きどころ</h2></div><div class="card pad">${mgmtLeverageBlock(mlv)}</div>
      <div class="sec-title"><span class="no">経</span><h2>経営コメント</h2></div><div class="card pad"><ul class="cm">${mcm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      <hr class="sep">` : '<p class="note-p">①経営数値（総売上など）を入れると、ここに「経営の健康度」が出ます。以下は間口カテゴリの診断です。</p>';
    el.innerHTML = `
      ${mgmtHtml}
      <div class="sec-title"><span class="no">1</span><h2>現状サマリー（${U().PERIOD_LABEL(period)}で見た場合）</h2></div>${kpis(st)}<div class="card pad">${table(st)}</div>
      <div class="sec-title"><span class="no">2</span><h2>間口ポートフォリオ</h2><span class="hint">横＝集客力、縦＝展開力。境界は店内の中央値${guide('横軸は「新規×間口単価」（入口としてどれだけ売上を作るか）、縦軸は「LTV−間口単価」（入口の後に1人がどれだけ追加で買うか）です。境界は店内カテゴリの中央値なので、他店との比較ではなく自店内の相対的な位置づけです。')}</span></div><div class="card pad">${quadrantSvg(pf)}</div>
      <div class="sec-title"><span class="no">3</span><h2>効きどころ</h2><span class="hint">標準的な改善幅を当てたとき、どのレバーが売上を最も動かすか</span></div>${leverageBlock(lv)}
      <div class="sec-title"><span class="no">4</span><h2>弱点候補</h2><span class="hint">${guide('目安値（②の任意欄）があればそれと、前期の数字があればそれと比較します。どちらも無い場合は店内の加重平均より低い率を挙げます。')}</span></div><div class="card pad">${weaknessBlock(wk)}</div>
      <div class="sec-title"><span class="no">5</span><h2>購入までの期間とフォローの打ち時</h2></div><div class="card pad">${timingBlock(tm)}</div>
      <div class="sec-title"><span class="no">6</span><h2>診断コメント</h2></div><div class="card pad"><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  Sim.ui.diagnosis = { render, refresh: render, parts: { kpis, table, quadrantSvg, leverageBlock, weaknessBlock, timingBlock, mgmtKpis, waterfallSvg, costBars, customerMix, productTable, funnelBlock, consistencyBlock, mgmtLeverageBlock } };
})();
