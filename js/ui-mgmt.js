window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  let pendingKv = null;
  function nf(labelHtml, path, value, opts) {
    const { val, man } = U(); opts = opts || {}; const isMan = !!opts.man;
    return `<div class="field"><span class="flabel">${labelHtml}</span><input class="inp" type="number" min="0"${opts.max != null ? ` max="${opts.max}"` : ''}${opts.step ? ` step="${opts.step}"` : (isMan ? ' step="0.1"' : '')} data-type="${isMan ? 'man' : 'optnum'}" data-path="${path}" value="${isMan ? man(value) : val(value)}"></div>`;
  }
  function numericBlocks(prefix, m, tag) {
    const g = p => `${prefix}.${p}`; const { guide } = U(); const t = tag || '';
    return `
      <div class="sec-title"><span class="no">1</span><h2>売上の全体像${t}</h2><span class="hint">年次（直近の決算期）${guide('レジの年間集計や決算書から。「新規客数」「新規客売上」は顧客IDで初回購入を判定できることが前提です。無ければ新規会員登録数で代用してください。')}</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('総売上（年）<span class="q">万円。税込／税抜は店内で統一</span>', g('revenue'), m.revenue, { man: true })}
        ${nf('購入客数（延べ）<span class="q">人</span>', g('buyers'), m.buyers)}
        ${nf('新規客数<span class="q">人</span>', g('newBuyers'), m.newBuyers)}
        ${nf('新規客売上<span class="q">万円</span>', g('newRevenue'), m.newRevenue, { man: true })}
        ${nf('買上点数（任意）<span class="q">1人あたり</span>', g('itemsPerBuyer'), m.itemsPerBuyer, { step: '0.1' })}
      </div><div class="autovals" data-out="${prefix}-auto-sales"></div></div>
      <div class="sec-title"><span class="no">2</span><h2>顧客の構成${t}</h2><span class="hint">${guide('アクティブ顧客＝過去2年以内に購入した人。来店回数別はその内訳です（合計がアクティブ顧客数と一致するのが理想）。')}</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('アクティブ顧客数<span class="q">過去2年以内に購入</span>', g('activeCustomers'), m.activeCustomers)}
        ${nf('来店1回の客数', g('visits.once'), m.visits.once)}
        ${nf('来店2回の客数', g('visits.twice'), m.visits.twice)}
        ${nf('来店3回以上の客数', g('visits.threePlus'), m.visits.threePlus)}
        ${nf('休眠客数（任意）<span class="q">2年以上来店なし</span>', g('dormant'), m.dormant)}
      </div><div class="autovals" data-out="${prefix}-auto-cust"></div></div>
      <div class="sec-title"><span class="no">3</span><h2>費用の構造${t}</h2><span class="hint">年額${guide('決算書・試算表から。粗利率＝（売上−仕入原価）÷売上、損益分岐点売上＝固定費÷粗利率で計算します。')}</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('仕入原価<span class="q">万円</span>', g('costs.cogs'), m.costs.cogs, { man: true })}
        ${nf('人件費<span class="q">万円</span>', g('costs.labor'), m.costs.labor, { man: true })}
        ${nf('家賃<span class="q">万円</span>', g('costs.rent'), m.costs.rent, { man: true })}
        ${nf('広告宣伝費<span class="q">万円</span>', g('costs.ads'), m.costs.ads, { man: true })}
        ${nf('その他経費<span class="q">万円</span>', g('costs.other'), m.costs.other, { man: true })}
        ${nf('期末在庫金額（任意）<span class="q">万円</span>', g('inventory'), m.inventory, { man: true })}
      </div><div class="autovals" data-out="${prefix}-auto-cost"></div></div>
      <div class="sec-title"><span class="no">4</span><h2>集客効率${t}</h2><span class="hint">任意</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('予約数', g('funnel.reservations'), m.funnel.reservations)}
        ${nf('来店数', g('funnel.visits'), m.funnel.visits)}
        ${nf('成約数', g('funnel.deals'), m.funnel.deals)}
      </div><div class="autovals" data-out="${prefix}-auto-funnel"></div></div>`;
  }
  function productsBlock(m) {
    const { esc, val, man, guide } = U();
    return `<div class="sec-title"><span class="no">5</span><h2>商品・粗利</h2><span class="hint">カテゴリ別の売上と粗利率${guide('売上の内訳と粗利率をカテゴリごとに。②の間口カテゴリ名を取り込んでから、足りない行を追加できます。')}</span></div>
      <div class="card pad"><table class="ltable"><tr><th>カテゴリ</th><th>売上（年・万円）</th><th>粗利率（%）</th><th>売上シェア</th><th>粗利貢献</th><th></th></tr>
        ${m.products.map((p, i) => `<tr><td><input type="text" data-path="mgmt.products.${i}.name" value="${esc(p.name)}" placeholder="カテゴリ名"></td><td><input type="number" min="0" step="0.1" data-type="man" data-path="mgmt.products.${i}.sales" value="${man(p.sales)}"></td><td><input type="number" min="0" max="100" data-type="optnum" data-path="mgmt.products.${i}.grossMarginPct" value="${val(p.grossMarginPct)}"></td><td data-out="mg-prod-share-${p.id}"></td><td data-out="mg-prod-contrib-${p.id}"></td><td><button type="button" class="del dark" data-action="mg-del-product" data-index="${i}">✕</button></td></tr>`).join('')}
      </table>
      <button type="button" class="sbtn" data-action="mg-import-categories">②の間口カテゴリ名を取り込む</button><button type="button" class="sbtn" data-action="mg-add-product">＋ 行を追加</button>
      <div class="autovals" data-out="mg-auto-inv"></div></div>`;
  }
  function replacementBlock(m) {
    const { esc, val, guide } = U();
    return `<div class="sec-title"><span class="no">6</span><h2>買替周期</h2><span class="hint">任意・高額品${guide('「サイクル年数」はその商品を買い替える目安の年数、「直近サイクル分の購入者数」はその年数のあいだに買った人数です。年数で割ると、今後1年に買替時期を迎える人数の目安になります。')}</span></div>
      <div class="card pad"><table class="ltable"><tr><th>商品（②の間口カテゴリ名と同じにすると見込み売上が出ます）</th><th>サイクル年数</th><th>直近サイクル分の購入者数</th><th>今後1年の買替見込み</th><th></th></tr>
        ${m.replacement.map((r, i) => `<tr><td><input type="text" data-path="mgmt.replacement.${i}.name" value="${esc(r.name)}"></td><td><input type="number" min="0" step="0.5" data-type="optnum" data-path="mgmt.replacement.${i}.cycleYears" value="${val(r.cycleYears)}"></td><td><input type="number" min="0" data-type="optnum" data-path="mgmt.replacement.${i}.pastBuyers" value="${val(r.pastBuyers)}"></td><td data-out="mg-rep-${r.id}"></td><td><button type="button" class="del dark" data-action="mg-del-rep" data-index="${i}">✕</button></td></tr>`).join('')}
      </table><button type="button" class="sbtn" data-action="mg-add-rep">＋ 行を追加</button></div>`;
  }
  function channelsBlock(state) {
    const { esc, val, man } = U();
    return `<div class="card pad" style="margin-top:14px"><h3 class="h3">集客経路（任意）— 経路ごとの新規人数と費用からCPAを出します</h3>
      <table class="ltable"><tr><th>経路名</th><th>新規人数</th><th>費用（万円・年）</th><th>CPA</th><th></th></tr>
        ${state.channels.map((ch, i) => `<tr><td><input type="text" data-path="channels.${i}.name" value="${esc(ch.name)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.newCustomers" value="${val(ch.newCustomers)}"></td><td><input type="number" min="0" step="0.1" data-type="man0" data-path="channels.${i}.cost" value="${man(ch.cost)}"></td><td data-out="cpa-${ch.id}"></td><td><button type="button" class="del dark" data-action="del-channel" data-index="${i}">✕</button></td></tr>`).join('')}
      </table><button type="button" class="sbtn" data-action="add-channel">＋ 経路を追加</button>
      <p class="note-p">経路の新規合計と間口カテゴリの新規合計は一致しなくて構いません。</p></div>`;
  }
  function render(el, state, api) {
    const { esc, val } = U(); const m = state.mgmt; const b = state.benchmarks;
    el.innerHTML = `
      <p class="note-p">店全体の数字を年次で入れます。すべて任意ですが、★の付いた「総売上・新規客数・新規客売上・仕入原価・人件費・家賃・広告宣伝費・その他経費」が揃うと診断が出ます。分からない項目は空欄のままで構いません。</p>
      ${numericBlocks('mgmt', m, '')}
      ${channelsBlock(state)}
      ${productsBlock(m)}
      ${replacementBlock(m)}
      <div class="warnings" data-out="mg-warn"></div>
      <details class="card optblock"><summary>前期の数字（任意・入れると前期比の診断が出ます）</summary><div class="optbody">
        ${m.prev ? numericBlocks('mgmt.prev', m.prev, '（前期）') + '<button type="button" class="sbtn" data-action="mg-del-prev">前期の欄を消す</button>' : '<button type="button" class="sbtn" data-action="mg-add-prev">前期の欄を追加</button>'}
      </div></details>
      <details class="card optblock"><summary>経営数値の目安値（任意）— 自社目標や過去平均など、比べたい基準があれば</summary><div class="optbody basebox mg4">
        ${nf('粗利率の目安 %', 'benchmarks.grossMarginPct', b.grossMarginPct, { max: 100 })}
        ${nf('人件費率の目安 %', 'benchmarks.laborPct', b.laborPct, { max: 100 })}
        ${nf('家賃比率の目安 %', 'benchmarks.rentPct', b.rentPct, { max: 100 })}
        ${nf('広告費率の目安 %', 'benchmarks.adsPct', b.adsPct, { max: 100 })}
        ${nf('リピート率の目安 %', 'benchmarks.repeatRate', b.repeatRate, { max: 100 })}
      </div></details>
      <details class="card optblock"><summary>貼り付け（項目名と値の2列）— 収集シートの「経営数値」をそのまま貼れます</summary><div class="optbody">
        <p class="note-p">1行に「項目名 TAB 値」。金額は<b>万円</b>で（円で貼っても自動で判定します）。項目名：総売上／購入客数／新規客数／新規客売上／買上点数／アクティブ顧客数／来店1回／来店2回／来店3回以上／休眠客数／期末在庫／仕入原価／人件費／家賃／広告宣伝費／その他経費／予約数／来店数／成約数。先頭に「前期 」を付けると前期の欄に入ります。カテゴリ別の売上・粗利率と買替は表に直接入力してください。</p>
        <textarea id="kv-text" rows="6" placeholder="総売上	4800&#10;仕入原価	2400"></textarea>
        <button type="button" class="sbtn" data-action="kv-preview">プレビュー</button><div id="kv-preview"></div>
      </div></details>`;
    outputs(el, state); U().bindPanel(el, api, actions(api, el));
  }
  function renderKvPreview(res, el) {
    const { esc, fmt } = U(); const box = el.querySelector('#kv-preview'); if (!box) return;
    const labelOf = p => (Sim.paste.KV_LABELS[p] || [p])[0];
    const rows = Object.keys(res.values).map(p => `<tr><td>${esc(labelOf(p))}</td><td>${fmt(res.values[p])}</td></tr>`).concat(Object.keys(res.prev).map(p => `<tr><td>前期 ${esc(labelOf(p))}</td><td>${fmt(res.prev[p])}</td></tr>`));
    box.innerHTML = (res.warnings.length ? `<ul class="warn">${res.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '') +
      (rows.length ? `<table class="ltable"><tr><th>項目</th><th>値</th></tr>${rows.join('')}</table><button type="button" class="sbtn primary" data-action="kv-apply">取り込む</button>` : '<p class="note-p">取り込める行がありません。</p>');
  }
  function actions(api, el) {
    return {
      'mg-add-product': () => api.update(s => { s.mgmt.products.push(Sim.state.newProductRow()); }, { structural: true }),
      'mg-del-product': d => api.update(s => { s.mgmt.products.splice(+d.index, 1); }, { structural: true }),
      'mg-import-categories': () => api.update(s => { const names = new Set(s.mgmt.products.map(p => p.name)); s.categories.forEach(c => { if (!names.has(c.name)) s.mgmt.products.push(Sim.state.newProductRow({ name: c.name })); }); }, { structural: true }),
      'mg-add-rep': () => api.update(s => { s.mgmt.replacement.push(Sim.state.newReplacementRow()); }, { structural: true }),
      'mg-del-rep': d => api.update(s => { s.mgmt.replacement.splice(+d.index, 1); }, { structural: true }),
      'add-channel': () => api.update(s => { s.channels.push(Sim.state.newChannel()); }, { structural: true }),
      'del-channel': d => api.update(s => { s.channels.splice(+d.index, 1); }, { structural: true }),
      'mg-add-prev': () => api.update(s => { s.mgmt.prev = Sim.state.normalizeMgmt({}, false); }, { structural: true }),
      'mg-del-prev': () => { if (!confirm('前期の数字を消しますか？')) return; api.update(s => { s.mgmt.prev = null; }, { structural: true }); },
      'kv-preview': () => { const res = Sim.paste.parseKeyValues(el.querySelector('#kv-text').value); pendingKv = res; renderKvPreview(res, el); },
      'kv-apply': () => { if (!pendingKv) return; const kv = pendingKv; pendingKv = null; let r = null;
        api.update(s => { r = Sim.paste.applyKeyValues(s, kv); Object.assign(s, r.state); }, { structural: true });
        alert(`取り込みました（今期${r.count}件・前期${r.prevCount}件）`); }
    };
  }
  function outputs(el, state) {
    const { yen, fmt, fmt1, esc } = U(); const m = Sim.calc.mgmt(state);
    const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    const pct = v => (v == null ? '—' : fmt1(v * 100) + '%'); const kv = (k, v) => `<span>${k}<b>${v}</b></span>`;
    const fill = (prefix, x) => {
      set(`${prefix}-auto-sales`, kv('既存客売上', yen(x.existingRevenue)) + kv('客単価', yen(x.aov)) + kv('新規売上比率', pct(x.newShare)));
      set(`${prefix}-auto-cust`, kv('リピート率（2回以上）', pct(x.repeatRate)) + kv('年間来店頻度', x.visitFrequency == null ? '—' : fmt1(x.visitFrequency) + '回'));
      set(`${prefix}-auto-cost`, kv('粗利率', pct(x.grossMarginPct)) + kv('人件費率', pct(x.laborPct)) + kv('家賃比率', pct(x.rentPct)) + kv('広告費率', pct(x.adsPct)) + kv('営業利益', yen(x.operatingProfit)) + kv('営業利益率', pct(x.opMarginPct)) + kv('損益分岐点売上', yen(x.breakEven)) + kv('安全余裕率', pct(x.safetyMargin)) + kv('在庫回転', x.inventoryTurnMonths == null ? '—' : fmt1(x.inventoryTurnMonths) + 'ヶ月'));
      set(`${prefix}-auto-funnel`, kv('予約→来店', pct(x.funnel.visitRate)) + kv('来店→成約', pct(x.funnel.dealRate)));
    };
    fill('mgmt', m); if (m.prev) fill('mgmt.prev', m.prev);
    m.products.forEach(p => { set(`mg-prod-share-${p.id}`, pct(p.share)); set(`mg-prod-contrib-${p.id}`, pct(p.contributionShare)); });
    set('mg-auto-inv', kv('粗利貢献の合計', yen(m.products.reduce((s, p) => s + (p.contribution || 0), 0))));
    m.replacement.forEach(r => set(`mg-rep-${r.id}`, r.expectedBuyers == null ? '—' : fmt1(r.expectedBuyers) + '人'));
    m.channels.forEach(ch => set(`cpa-${ch.id}`, ch.cpa == null ? '—' : yen(ch.cpa)));
    const w = Sim.analysis.mgmtChecks(state).map(x => x.message).concat(Sim.analysis.consistencyCheck(state).flags);
    set('mg-warn', w.length ? `<ul class="warn">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  }
  Sim.ui.mgmt = { render, refresh: outputs };
})();
