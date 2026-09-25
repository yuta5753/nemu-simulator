window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  const LEVERS = [
    { key: 'newPct', label: '新規獲得人数', unit: '%', min: -50, max: 100, step: 5 },
    { key: 'sameDayPt', label: '同日追加率', unit: 'pt', min: -30, max: 50, step: 1 },
    { key: 'laterPt', label: '後日追加率', unit: 'pt', min: -30, max: 50, step: 1 },
    { key: 'aovPct', label: '追加単価', unit: '%', min: -30, max: 50, step: 1 },
    { key: 'entryPricePct', label: '間口単価', unit: '%', min: -30, max: 50, step: 1 }
  ];
  const TACTIC_LEVERS = [['new', '新規獲得'], ['sameDay', '同日追加'], ['later', '後日追加'], ['aov', '追加単価'], ['entryPrice', '間口単価']];
  const leverLabel = k => (TACTIC_LEVERS.find(x => x[0] === k) || ['', ''])[1];

  function requiredTable(r) {
    const { yen } = U(); const pctS = v => (v == null ? '—' : (Math.round(v * 1000) / 10) + '%');
    if (!r) return '<p class="note-p">①経営数値の「費用の構造」と、上の必要営業利益を入れると必要売上が出ます。</p>';
    return `<table class="ltable"><tr><th>項目</th><th>金額</th><th>計算</th></tr>
      <tr><td>必要売上</td><td><b>${yen(r.required)}</b></td><td>（固定費 ${yen(r.fixedCosts)} ＋ 必要営業利益）÷ 粗利率 ${pctS(r.grossMarginPct)}</td></tr>
      <tr><td>現状の総売上</td><td>${yen(r.current)}</td><td></td></tr>
      <tr><td>ギャップ</td><td class="${r.gap > 0 ? 'gap' : 'ok'}">${yen(r.gap)}</td><td>必要売上 − 現状</td></tr>
      <tr><td>既存客の見込み売上</td><td>${yen(r.existingForecast)}</td><td>既存客売上 ×（1 ＋ 見込み％）</td></tr>
      <tr><td>間口（新規）で稼ぐべき売上（1年）</td><td><b>${yen(r.newTarget)}</b></td><td>必要売上 − 既存客の見込み（負なら0）</td></tr></table>`;
  }
  function reverseTable(r) {
    const { fmt, fmt1, yen } = U();
    if (!r) return '<p class="note-p">目標売上を入れると、レバーごとの必要量が出ます。</p>';
    const L = r.levers; const na = '<td colspan="2">—（入力がないため計算できません）</td>'; const row = (name, cell) => `<tr><td>${name}</td>${cell}</tr>`;
    const nf = ok => (ok ? '' : '　（このレバー単独では届きません）');
    const head = r.gap <= 0 ? `<div class="gapbox"><span>現状 ${yen(r.current)}</span><span>目標 ${yen(r.target)}</span><span class="ok">達成済み（余裕 ${yen(-r.gap)}）</span></div>`
      : `<div class="gapbox"><span>現状 ${yen(r.current)}</span><span>目標 ${yen(r.target)}</span><span class="gap">ギャップ ${yen(r.gap)}</span></div>`;
    return head + `<table class="ltable"><tr><th>レバー（単独で達成する場合）</th><th>必要量</th><th>今 → 必要値</th></tr>
      ${row('新規獲得人数', L.new ? `<td>${fmt(L.new.neededCount)}人 追加</td><td>${fmt(L.new.from)}人 → ${fmt(L.new.to)}人</td>` : na)}
      ${row('同日追加率', L.sameDay ? `<td>${fmt1(L.sameDay.neededPt)}pt</td><td>${fmt1(L.sameDay.from)}% → ${fmt1(L.sameDay.to)}%${nf(L.sameDay.feasible)}</td>` : na)}
      ${row('後日追加率', L.later ? `<td>${fmt1(L.later.neededPt)}pt</td><td>${fmt1(L.later.from)}% → ${fmt1(L.later.to)}%${nf(L.later.feasible)}</td>` : na)}
      ${row('追加単価', L.aov ? `<td>${fmt1(L.aov.neededPct)}%</td><td>同日・後日の追加単価を一律に引き上げ</td>` : na)}
      ${row('間口単価', L.entryPrice ? `<td>${fmt1(L.entryPrice.neededPct)}%</td><td>全カテゴリの間口単価を一律に引き上げ</td>` : na)}
    </table>`;
  }
  function scenarioTabs(plan) {
    return `<div class="sc-tabs">${plan.scenarios.map((sc, i) => `<button type="button" class="${i === plan.activeScenario ? 'active' : ''}" data-action="sc-select" data-index="${i}"><span data-out="sc-tabname-${i}"></span></button>`).join('')}
      ${plan.scenarios.length < 3 ? '<button type="button" class="ghost" data-action="sc-add">＋ 追加</button>' : ''}</div>`;
  }
  function leverCards(state, sc, si) {
    const { esc, val } = U();
    return `<div class="products">${state.categories.map(c => { const l = sc.levers[c.id] || Sim.state.emptyLevers();
      return `<div class="card pcard"><div class="pcard-head"><span class="pname-static">${esc(c.name)}</span></div><div class="pcard-body">
        ${LEVERS.map(L => `<div class="slider-row"><div class="sl-top"><span class="sl-name">${L.label}</span><span class="sl-val" data-out="sv-${c.id}-${L.key}"></span></div>
          <input type="range" min="${L.min}" max="${L.max}" step="${L.step}" data-type="num" data-path="plan.scenarios.${si}.levers.${c.id}.${L.key}" value="${val(l[L.key])}" aria-label="${esc(c.name)} ${L.label}"></div>`).join('')}
        <div class="pltv" data-out="sc-cat-${c.id}"></div></div></div>`; }).join('')}</div>`;
  }
  function tacticsBlock(sc, si, state) {
    const { esc } = U(); const lib = Sim.tactics.LIBRARY;
    return `<div class="tac-grid">${TACTIC_LEVERS.map(([k, label]) => `<div class="card pad"><h3 class="h3">${label}</h3><ul class="tac-lib">
        ${lib[k].map((t, idx) => { const tid = k + '-' + idx; const text = Sim.tactics.resolve(t, state); const chosen = sc.tactics.some(x => x.libId === tid);
          return `<li><label><input type="checkbox" data-action="tac-toggle" data-lever="${k}" data-tid="${tid}" ${chosen ? 'checked' : ''}> ${esc(text)}</label></li>`; }).join('')}</ul>
        <button type="button" class="sbtn" data-action="tac-add" data-lever="${k}">＋ 自由記述を追加</button></div>`).join('')}</div>
      <h3 class="h3">選んだ打ち手</h3>
      ${sc.tactics.length ? `<table class="ltable"><tr><th>レバー</th><th>打ち手</th><th>担当</th><th>期限</th><th></th></tr>
        ${sc.tactics.map((t, i) => `<tr><td>${leverLabel(t.lever)}</td><td><input type="text" data-path="plan.scenarios.${si}.tactics.${i}.text" data-demote="${i}" value="${esc(t.text)}" placeholder="打ち手を書く"></td><td><input type="text" data-path="plan.scenarios.${si}.tactics.${i}.owner" value="${esc(t.owner)}" placeholder="担当"></td><td><input type="text" data-path="plan.scenarios.${si}.tactics.${i}.due" value="${esc(t.due)}" placeholder="例 11月末"></td><td><button type="button" class="del dark" data-action="tac-del" data-index="${i}">✕</button></td></tr>`).join('')}</table>` : '<p class="note-p">まだ打ち手がありません。上の定型から選ぶか、自由記述を追加してください。</p>'}
      <label class="flabel">メモ<textarea data-path="plan.scenarios.${si}.memo" rows="3">${esc(sc.memo)}</textarea></label>`;
  }
  function comparison(state, period) {
    const { esc, yen, fmt1 } = U();
    return `<table class="ltable"><tr><th>シナリオ</th><th>売上（${U().PERIOD_LABEL(period)}累計）</th><th>粗利</th><th>目標到達率</th></tr>
      ${state.plan.scenarios.map(sc => { const st = Sim.calc.store(state, period, sc.levers); const r = Sim.calc.reachRate(state, period, sc); return `<tr><td>${esc(sc.name)}</td><td>${yen(st.revenue)}</td><td>${yen(st.grossProfit)}</td><td>${r == null ? '—' : fmt1(r) + '%'}</td></tr>`; }).join('')}</table>`;
  }
  function crmBlock(state, period, sc) {
    const { esc } = U(); const rows = Sim.calc.crmTargets(state, period, sc);
    return `<details class="card optblock"><summary>CRM転記用（ねむねむCRMの目標入力フォーム向け・他店は不要）</summary><div class="optbody">
      <table class="ltable" id="crm-table"><tr><th>間口カテゴリ</th><th>期間</th><th>間口単価</th><th>目標新規獲得人数</th><th>追加購入単価</th><th>追加購入率</th></tr>
        ${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.period}</td><td>${r.entryPrice}</td><td>${r.newCustomers}</td><td>${r.addonAov}</td><td>${r.addonRate}</td></tr>`).join('')}</table>
      <button type="button" class="sbtn" data-action="crm-copy">タブ区切りでコピー</button>
      <p class="note-p">追加購入率＝1−(1−同日率)(1−後日率)、追加購入単価＝期待追加額÷追加購入率（同日と後日が独立に起きる仮定で束ねた値です）。</p></div></details>`;
  }
  function render(el, state, api) {
    const { val, esc, guide } = U(); const period = state.store.period; const plan = state.plan;
    const si = plan.scenarios[plan.activeScenario] ? plan.activeScenario : 0; const sc = plan.scenarios[si] || plan.scenarios[0];
    sc.tactics.forEach(t => { if (t.libId) { const idx = +t.libId.split('-').pop(); const entry = Sim.tactics.LIBRARY[t.lever] && Sim.tactics.LIBRARY[t.lever][idx]; if (entry) t.text = Sim.tactics.resolve(entry, state); } });
    el.innerHTML = `
      <div class="sec-title"><span class="no">経</span><h2>必要利益からの逆算</h2><span class="hint">${guide('「この営業利益を出すには売上がいくら必要か」を費用構造から逆算します。既存客の見込みを引いた残りが、新規（間口）で稼ぐべき売上です。「反映」を押すと下の目標売上（1年）に入ります。')}</span></div>
      <div class="card globals">
        <div class="gbox"><label>必要営業利益（年）</label><div class="row"><input type="number" min="0" step="10" data-type="man" data-path="plan.requiredProfit" value="${U().man(plan.requiredProfit)}"><span class="unit">万円</span></div></div>
        <div class="gbox"><label>既存客売上の見込み（現状比）</label><div class="row"><input type="number" step="1" data-type="num" data-path="plan.existingGrowthPct" value="${val(plan.existingGrowthPct)}"><span class="unit">%</span></div></div>
        <div class="gbox"><label>反映</label><div class="row"><button type="button" class="sbtn primary" data-action="apply-required">間口の目標売上（1年）に反映</button></div></div>
      </div>
      <div class="card pad" data-out="required"></div>
      ${(api.getCompany && api.getCompany().stores.length > 1) ? '<p class="note-p">ここは店舗単位の数字です。本部費を含めた全社の逆算は「全社」タブの④で行います。</p>' : ''}
      <div class="sec-title"><span class="no">1</span><h2>目標設定と逆算（${U().PERIOD_LABEL(period)}で見た場合）</h2><span class="hint">${guide('期間累計の目標売上を入れると、現状とのギャップと「レバー1本だけで埋める場合の必要量」が出ます。実際は複数のレバーを組み合わせるので、下のシナリオで配分します。')}</span></div>
      <div class="card globals">
        <div class="gbox"><label>目標売上（${U().PERIOD_LABEL(period)}累計）</label><div class="row"><input type="number" min="0" step="10" data-type="man" data-path="plan.targetRevenue.${period - 1}" value="${U().man(plan.targetRevenue[period - 1])}"><span class="unit">万円</span></div></div>
        <div class="gbox"><label>現状の売上（${U().PERIOD_LABEL(period)}累計）</label><div class="row"><span class="bigval" data-out="cur-rev"></span></div></div>
        <div class="gbox"><label>目標到達率（選択中シナリオ）</label><div class="reach"><div class="reach-bar"><div class="reach-fill" data-out="reach-fill"></div></div><span data-out="reach-val"></span></div></div>
      </div>
      <div class="card pad" data-out="reverse"></div>
      <div class="sec-title"><span class="no">2</span><h2>レバー配分（シナリオ）</h2><span class="hint">最大3本。「均等に割り振る」を出発点に手で調整</span></div>
      ${scenarioTabs(plan)}
      <div class="sc-tools"><input type="text" class="inp" data-path="plan.scenarios.${si}.name" value="${esc(sc.name)}" aria-label="シナリオ名">
        <button type="button" class="sbtn" data-action="sc-even">均等に割り振る</button><button type="button" class="sbtn" data-action="sc-reset">0に戻す</button>
        <button type="button" class="sbtn" data-action="sc-copy">複製</button>${plan.scenarios.length > 1 ? '<button type="button" class="sbtn danger" data-action="sc-del">削除</button>' : ''}</div>
      ${leverCards(state, sc, si)}
      <div class="sec-title"><span class="no">3</span><h2>打ち手</h2><span class="hint">レバーごとに定型から選ぶ＋自由記述。担当と期限を書けます</span></div>${tacticsBlock(sc, si, state)}
      <div class="sec-title"><span class="no">4</span><h2>シナリオ比較</h2></div><div class="card pad" data-out="compare"></div>
      ${crmBlock(state, period, sc)}`;
    outputs(el, state); U().bindPanel(el, api, actions(api, el));
    if (!el.dataset.demoteBound) {
      el.dataset.demoteBound = '1';
      el.addEventListener('input', e => { const t = e.target.closest('[data-demote]'); if (!t) return; api.update(s => { const idx = s.plan.scenarios[s.plan.activeScenario] ? s.plan.activeScenario : 0; const tc = s.plan.scenarios[idx].tactics[+t.dataset.demote]; if (tc && tc.libId) { tc.libId = null; tc.fromLibrary = false; } }); }, { once: false });
    }
  }
  function outputs(el, state) {
    const { yen, fmt1, signed, esc } = U(); const period = state.store.period; const plan = state.plan;
    const si = plan.scenarios[plan.activeScenario] ? plan.activeScenario : 0; const sc = plan.scenarios[si] || plan.scenarios[0];
    const target = plan.targetRevenue[period - 1]; const base = Sim.calc.store(state, period); const now = Sim.calc.store(state, period, sc.levers);
    const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    plan.scenarios.forEach((s2, i) => set('sc-tabname-' + i, esc(s2.name)));
    set('required', requiredTable(Sim.calc.requiredRevenue(state)));
    set('cur-rev', yen(base.revenue));
    const reach = Sim.calc.reachRate(state, period, sc);
    set('reach-val', reach == null ? '目標未設定' : fmt1(reach) + '%（' + yen(now.revenue) + '）');
    const rf = el.querySelector('[data-out="reach-fill"]'); if (rf) { rf.style.width = (reach == null ? 0 : Math.min(100, reach)) + '%'; rf.classList.toggle('ok', reach != null && reach >= 100); }
    set('reverse', reverseTable(Sim.calc.reverse(state, period, target)));
    state.categories.forEach(c => {
      const l = sc.levers[c.id] || {}; LEVERS.forEach(L => set(`sv-${c.id}-${L.key}`, signed(l[L.key] || 0, L.unit)));
      const b = base.categories.find(x => x.id === c.id), n = now.categories.find(x => x.id === c.id); const d = n.revenue - b.revenue;
      set(`sc-cat-${c.id}`, `<div class="pltv-row"><span>売上（基準）</span><span>${yen(b.revenue)}</span></div><div class="pltv-row"><span>売上（この配分）</span><span>${yen(n.revenue)}</span></div><div class="pltv-row pltv-total"><span>差</span><span>${(d >= 0 ? '+' : '−') + yen(Math.abs(d))}</span></div>`);
    });
    set('compare', comparison(state, period));
  }
  function actions(api, el) {
    return {
      'apply-required': () => { const r = Sim.calc.requiredRevenue(api.getState()); if (!r || r.newTarget == null) { alert('①経営数値の費用の構造と必要営業利益を入れると反映できます。'); return; }
        api.update(s => { s.plan.targetRevenue[0] = Math.round(r.newTarget); s.store.period = 1; }, { structural: true }); },
      'sc-select': d => api.update(s => { s.plan.activeScenario = +d.index; }, { structural: true }),
      'sc-add': () => api.update(s => { if (s.plan.scenarios.length >= 3) return; s.plan.scenarios.push(Sim.state.newScenario('シナリオ' + (s.plan.scenarios.length + 1), s.categories)); s.plan.activeScenario = s.plan.scenarios.length - 1; }, { structural: true }),
      'sc-copy': () => { if (api.getState().plan.scenarios.length >= 3) { alert('シナリオは3本までです。'); return; }
        api.update(s => { const src = s.plan.scenarios[s.plan.activeScenario]; s.plan.scenarios.push(JSON.parse(JSON.stringify(Object.assign({}, src, { name: src.name + 'のコピー' })))); s.plan.activeScenario = s.plan.scenarios.length - 1; }, { structural: true }); },
      'sc-del': () => { if (!confirm('このシナリオを削除しますか？')) return; api.update(s => { if (s.plan.scenarios.length <= 1) return; s.plan.scenarios.splice(s.plan.activeScenario, 1); s.plan.activeScenario = Math.max(0, s.plan.activeScenario - 1); }, { structural: true }); },
      'sc-even': () => {
        const p0 = api.getState().store.period; if (!(api.getState().plan.targetRevenue[p0 - 1] > 0)) { alert('先に目標売上を入力してください。'); return; }
        const q = (v, L) => Math.max(L.min, Math.min(L.max, Math.round(v / L.step) * L.step));
        let clamped = false;
        api.update(s => { const p = s.store.period; const lv = Sim.calc.evenSplit(s, p, s.plan.targetRevenue[p - 1]); const sc = s.plan.scenarios[s.plan.activeScenario];
          Object.keys(lv).forEach(id => { sc.levers[id] = LEVERS.reduce((o, L) => {
            const raw = lv[id][L.key] || 0; const uq = Math.round(raw / L.step) * L.step; if (uq > L.max) clamped = true;
            o[L.key] = q(raw, L); return o;
          }, {}); }); }, { structural: true });
        if (clamped) alert('目標が大きいため、一部のレバーは上限で止めています。');
      },
      'sc-reset': () => api.update(s => { const sc = s.plan.scenarios[s.plan.activeScenario]; s.categories.forEach(c => { sc.levers[c.id] = Sim.state.emptyLevers(); }); }, { structural: true }),
      'tac-toggle': (d, chk) => api.update(s => { const sc = s.plan.scenarios[s.plan.activeScenario]; const idx = sc.tactics.findIndex(t => t.libId === d.tid);
        if (chk.checked && idx < 0) sc.tactics.push({ lever: d.lever, categoryId: null, libId: d.tid, text: Sim.tactics.resolve(Sim.tactics.LIBRARY[d.lever][+d.tid.split('-').pop()], s), owner: '', due: '', fromLibrary: true });
        if (!chk.checked && idx >= 0) sc.tactics.splice(idx, 1); }, { structural: true }),
      'tac-add': d => api.update(s => { s.plan.scenarios[s.plan.activeScenario].tactics.push({ lever: d.lever, categoryId: null, text: '', owner: '', due: '', fromLibrary: false }); }, { structural: true }),
      'tac-del': d => api.update(s => { s.plan.scenarios[s.plan.activeScenario].tactics.splice(+d.index, 1); }, { structural: true }),
      'crm-copy': () => { const rows = Array.from(el.querySelectorAll('#crm-table tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim()).join('\t')).join('\n');
        if (navigator.clipboard) navigator.clipboard.writeText(rows).then(() => alert('コピーしました'), () => alert('コピーできませんでした。表を選択して手動でコピーしてください。')); else alert('この環境ではコピーできません。表を選択して手動でコピーしてください。'); }
    };
  }
  Sim.ui.plan = { render, refresh: outputs, parts: { reverseTable, requiredTable, comparison, LEVERS, TACTIC_LEVERS } };
})();
