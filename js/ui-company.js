window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  const pctS = v => (v == null ? '—' : (Math.round(v * 1000) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '%');
  function fmtMetric(v, unit) { const { yen, fmt } = U(); if (v == null) return '—'; if (unit === 'yen') return yen(v); if (unit === 'pct') return pctS(v); return fmt(v); }
  function comparisonTable(cmp, group) {
    const { esc } = U(); const rows = cmp.metrics.filter(m => m.group === group); const hasBench = rows.some(m => m.bench != null);
    const markHtml = mk => (mk ? `<span class="mark ${mk === '◎' ? 'best' : (mk === '△' ? 'worst' : 'mid')}">${mk}</span>` : '');
    return `<div class="cmp-wrap"><table class="ltable cmp-table"><tr><th>指標</th>${cmp.stores.map(s => `<th>${esc(s.name)}</th>`).join('')}<th>全社</th>${hasBench ? '<th>目安</th>' : ''}</tr>
      ${rows.map(m => `<tr><td>${esc(m.label)}</td>${m.values.map(v => `<td>${fmtMetric(v.value, m.unit)}${markHtml(v.mark)}</td>`).join('')}<td class="co">${fmtMetric(m.company, m.unit)}</td>${hasBench ? `<td>${m.bench == null ? '' : fmtMetric(m.bench, m.unit)}</td>` : ''}</tr>`).join('')}</table></div>`;
  }
  function hqField(label, key, value) { const { man } = U(); return `<div class="field"><span class="flabel">${label}<span class="q">万円／年</span></span><input class="inp" type="number" min="0" step="0.1" data-type="man" data-path="company.hq.${key}" value="${man(value)}"></div>`; }
  function summary(cm) {
    const { yen } = U(); const m = cm.m;
    if (!cm.available) return '<p class="note-p">店舗タブで経営数値（総売上など）を入れると、ここに全社の合算が出ます。</p>';
    const kv = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    return `<div class="mgkv">${kv('総売上（合算）', yen(m.revenue))}${kv('粗利', yen(m.grossProfit))}${kv('粗利率', pctS(m.grossMarginPct))}${kv('店舗の固定費（合算）', yen(m.fixedCosts))}${kv('営業利益（本部費前）', yen(m.operatingProfit))}${kv('本部費', cm.hq.total == null ? '未入力' : yen(cm.hq.total))}${kv('全社 営業利益', yen(cm.operatingProfitAfterHq))}${kv('損益分岐点（本部費込み）', yen(cm.breakEvenWithHq))}${kv('安全余裕率（本部費込み）', pctS(cm.safetyMarginWithHq))}</div>`;
  }
  function storeList(company) {
    const { esc, yen } = U(); const canDel = company.stores.length > 1;
    return `<table class="ltable store-list"><tr><th>店舗</th><th>総売上（年）</th><th>間口カテゴリ</th><th>最終更新</th><th></th></tr>
      ${company.stores.map((s, i) => `<tr><td><b>${esc(Sim.state.storeLabel(company, i))}</b></td><td>${yen(s.mgmt.revenue)}</td><td>${s.categories.length}件</td><td>${esc((s.meta.updatedAt || '').slice(0, 10))}</td>
        <td><button type="button" class="sbtn" data-action="co-open" data-id="${esc(s.store.id)}">開く</button><button type="button" class="sbtn" data-action="co-export" data-id="${esc(s.store.id)}">この店舗を書き出す</button><button type="button" class="sbtn" data-action="co-replace" data-id="${esc(s.store.id)}">ファイルで置き換え</button><button type="button" class="sbtn" data-action="co-dup" data-id="${esc(s.store.id)}">複製</button><button type="button" class="sbtn danger" data-action="co-del" data-id="${esc(s.store.id)}"${canDel ? '' : ' disabled title="店舗は1つ以上必要です"'}>削除</button></td></tr>`).join('')}</table>
      <button type="button" class="sbtn" data-action="co-add-empty">＋ 空の店舗を追加</button><button type="button" class="sbtn" data-action="co-add-file">＋ ファイルから店舗を追加</button>
      <p class="note-p">「この店舗を書き出す」で作ったファイルは単店版でもそのまま読めます。各店で入力してもらい、「ファイルで置き換え」で取り込む運用ができます。</p>`;
  }
  function renderMgmt(el, company, api) {
    const { esc, guide } = U(); const hq = company.company.hq;
    el.innerHTML = `
      <p class="note-p">全社ビューです。各店舗の①経営数値を合算して表示します（合算は保存せず、店舗の数字を直すと自動で変わります）。ここで入力するのは会社名と本部費だけです。</p>
      <div class="sec-title"><span class="no">1</span><h2>会社と本部費</h2><span class="hint">${guide('本部費＝本社の人件費・家賃など、どの店舗にも属さない費用（年額）。全社の営業利益と損益分岐点にだけ効き、店舗別の利益には含めません。')}</span></div>
      <div class="card globals"><div class="gbox"><label>会社名（任意）</label><input type="text" data-path="company.name" value="${esc(company.company.name)}" placeholder="○○株式会社"></div></div>
      <div class="card pad"><div class="basebox mg4">${hqField('本部 人件費', 'labor', hq.labor)}${hqField('本部 家賃', 'rent', hq.rent)}${hqField('本部 広告宣伝費', 'ads', hq.ads)}${hqField('本部 その他経費', 'other', hq.other)}</div><div class="autovals" data-out="co-hq-total"></div></div>
      <div class="sec-title"><span class="no">2</span><h2>店舗合算サマリー</h2><span class="hint">読み取り専用</span></div>
      <div data-out="co-summary"></div><div class="warnings" data-out="co-coverage"></div>
      <div class="sec-title"><span class="no">3</span><h2>店舗一覧</h2><span class="hint">追加・複製・削除・ファイルの受け渡し</span></div>
      <div class="card pad">${storeList(company)}</div>`;
    outputsMgmt(el, company); U().bindPanel(el, api, actions(api));
  }
  function outputsMgmt(el, company) {
    const { yen, esc } = U(); const cm = Sim.calc.companyMgmt(company); const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    set('co-hq-total', `<span>本部費 合計<b>${cm.hq.total == null ? '未入力' : yen(cm.hq.total)}</b></span>`);
    set('co-summary', summary(cm));
    const note = Sim.analysis.companyHealth(company).coverageNote; set('co-coverage', note ? `<ul class="warn"><li>${esc(note)}</li></ul>` : '');
  }
  function actions(api) {
    return {
      'co-open': d => api.setStore(d.id),
      'co-export': d => api.exportStore(d.id),
      'co-replace': d => api.pickStoreFile('replace', d.id),
      'co-dup': d => api.update(c => { Sim.state.duplicateStore(c, d.id); }, { structural: true }),
      'co-del': d => { if (!confirm('この店舗を削除しますか？（元に戻せません。必要なら先に「この店舗を書き出す」で保存してください）')) return; api.update(c => { Sim.state.removeStore(c, d.id); }, { structural: true }); },
      'co-add-empty': () => { let nid = null; api.update(c => { nid = Sim.state.addStore(c); }, { structural: true }); api.setStore(nid); },
      'co-add-file': () => api.pickStoreFile('add')
    };
  }
  function renderEntry(el, company, api) {
    const { esc, guide } = U(); const cmp = Sim.calc.storeComparison(company, api.period);
    el.innerHTML = `
      <p class="note-p">全社ビューでは間口カテゴリを編集しません（店舗をまたいだ合算もしません）。店舗ごとの間口の力を横並びで見ます。編集は各店舗タブで行います。</p>
      <div class="sec-title"><span class="no">1</span><h2>店舗横並び（間口・${U().PERIOD_LABEL(api.period)}で見た場合）</h2><span class="hint">${guide('◎＝店舗内で最良、△＝最下位、○＝その間。目標売上と今の配分での売上は計画値のためマークを付けません。')}</span></div>
      <div class="card pad">${comparisonTable(cmp, 'entry')}
        <div class="sc-tabs">${cmp.stores.map(s => `<button type="button" data-action="co-open2" data-id="${esc(s.id)}">${esc(s.name)} の②を開く</button>`).join('')}</div></div>`;
    U().bindPanel(el, api, { 'co-open2': d => { api.setStore(d.id); api.setStep(2); } });
  }
  Sim.ui.company = { mgmt: { render: renderMgmt, refresh: outputsMgmt }, entry: { render: renderEntry, refresh: renderEntry }, parts: { comparisonTable, fmtMetric, summary, pctS } };
})();
