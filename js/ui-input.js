window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  const PER = ['1年で', '2年で', '3年で'];
  let pendingRows = null;

  function prevFields(c, i) {
    const { val } = U(); const p = c.prev;
    return `<div class="basebox">
      <div class="field"><span class="flabel">前期 間口単価</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.entryPrice" value="${val(p.entryPrice)}"></div>
      <div class="field"><span class="flabel">前期 新規獲得人数</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.newCustomers" value="${val(p.newCustomers)}"></div>
      <div class="field"><span class="flabel">前期 同日追加率 %</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.sameDay.rate" value="${val(p.sameDay.rate)}"></div>
      <div class="field"><span class="flabel">前期 初回→追加購入日数</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.daysToAddon" value="${val(p.daysToAddon)}"></div>
    </div>
    <table class="yrtable"><tr><th>前期 後日追加</th>${PER.map(p2 => `<th>${p2}</th>`).join('')}</tr>
      <tr><td>追加率<span class="note"> %</span></td>${[0, 1, 2].map(y => `<td><input type="number" data-type="optnum" data-path="categories.${i}.prev.later.${y}.rate" value="${val(p.later[y].rate)}"></td>`).join('')}</tr>
      <tr><td>追加単価<span class="note"> 円</span></td>${[0, 1, 2].map(y => `<td><input type="number" data-type="optnum" data-path="categories.${i}.prev.later.${y}.aov" value="${val(p.later[y].aov)}"></td>`).join('')}</tr></table>
    <button type="button" class="sbtn" data-action="del-prev" data-index="${i}">前期の欄を消す</button>`;
  }
  function categoryCard(c, i, period) {
    const { esc, val, guide } = U(); const yi = period - 1;
    return `<div class="card pcard" data-cat="${c.id}">
      <div class="pcard-head"><input class="pname" data-path="categories.${i}.name" value="${esc(c.name)}" aria-label="間口カテゴリ名"><button type="button" class="del" data-action="del-category" data-index="${i}" title="削除">✕</button></div>
      <div class="pcard-body">
        <div class="basebox">
          <div class="field"><span class="flabel">間口単価<span class="q">最初に買う商品の単価（円・単品）</span></span><input class="inp" type="number" min="0" data-type="num" data-path="categories.${i}.entryPrice" value="${val(c.entryPrice)}"></div>
          <div class="field"><span class="flabel">新規獲得人数<span class="q">この間口で初めて買う人数（1年分）</span></span><input class="inp" type="number" min="0" data-type="num" data-path="categories.${i}.newCustomers" value="${val(c.newCustomers)}"></div>
        </div>
        <div class="subttl">後日追加（初回より後・期間ごとの累計）${guide('初回購入日より後に買った分です。率の母数は新規獲得人数、単価は「追加した人1人あたりの合計額」です。1年→2年→3年と累計なので、通常は増えていきます。')}</div>
        <table class="yrtable"><tr><th></th>${PER.map((p, y) => `<th class="${y === yi ? 'activecol' : ''}">${p}</th>`).join('')}</tr>
          <tr><td>追加率<span class="note"> %</span></td>${[0, 1, 2].map(y => `<td class="${y === yi ? 'activecol' : ''}"><input type="number" min="0" max="100" data-type="num" data-path="categories.${i}.later.${y}.rate" value="${val(c.later[y].rate)}"></td>`).join('')}</tr>
          <tr><td>追加単価<span class="note"> 円</span></td>${[0, 1, 2].map(y => `<td class="${y === yi ? 'activecol' : ''}"><input type="number" min="0" data-type="num" data-path="categories.${i}.later.${y}.aov" value="${val(c.later[y].aov)}"></td>`).join('')}</tr>
        </table>
        <details class="opt"><summary>同日追加・購入までの日数・展開商品（任意）</summary>
          <div class="basebox">
            <div class="field"><span class="flabel">同日追加率<span class="q">初回購入日に間口以外も買った人の割合（%）</span></span><input class="inp" type="number" min="0" max="100" data-type="num" data-path="categories.${i}.sameDay.rate" value="${val(c.sameDay.rate)}"></div>
            <div class="field"><span class="flabel">同日追加単価<span class="q">同日に追加した人1人あたりの額（円）</span></span><input class="inp" type="number" min="0" data-type="num" data-path="categories.${i}.sameDay.aov" value="${val(c.sameDay.aov)}"></div>
            <div class="field"><span class="flabel">初回→追加購入までの日数<span class="q">最初の後日追加までの平均日数</span></span><input class="inp" type="number" min="0" data-type="optnum" data-path="categories.${i}.daysToAddon" value="${val(c.daysToAddon)}"></div>
            <div class="field"><span class="flabel">主な展開商品<span class="q">この間口の次に売れる商品</span></span><input class="inp" type="text" data-path="categories.${i}.nextProducts" value="${esc(c.nextProducts)}"></div>
          </div>
        </details>
        <details class="opt"><summary>前期の数字（任意・入れると前期比の診断が出ます）</summary>
          ${c.prev ? prevFields(c, i) : `<button type="button" class="sbtn" data-action="add-prev" data-index="${i}">前期の欄を追加</button>`}
        </details>
        <div class="pltv" data-out="ltv-${c.id}"></div>
      </div></div>`;
  }
  function render(el, state, api) {
    const { esc, val, guide } = U(); const s = state.store; const b = state.benchmarks; const period = s.period;
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>店舗の前提</h2><span class="hint">店全体の数字</span></div>
      <div class="card globals">
        <div class="gbox"><label>店名</label><input type="text" data-path="store.name" value="${esc(s.name)}" placeholder="○○店"></div>
        <div class="gbox"><label>決算期（表示用）</label><input type="text" data-path="store.fiscalLabel" value="${esc(s.fiscalLabel)}" placeholder="2026年度（4月〜3月）"></div>
        <div class="gbox"><label>原価率（物販）${guide('売上に対する仕入原価の割合です。粗利＝売上×（1−原価率）で計算します。')}</label><div class="row"><input type="number" min="0" max="100" data-type="num" data-path="store.cogsRate" value="${val(s.cogsRate)}"><span class="unit">%</span></div></div>
        <div class="gbox"><label>固定費（任意・月額）</label><div class="row"><input type="number" min="0" step="10000" data-type="num" data-path="store.fixedCostMonthly" value="${val(s.fixedCostMonthly)}"><span class="unit">円/月</span></div></div>
      </div>
      <div class="sec-title"><span class="no">2</span><h2>間口カテゴリ</h2><span class="hint">最初に買ってもらう商品のくくりごとに入力${guide('「間口」＝新規のお客様が最初に買う商品のくくりです。レジや帳簿で「初めてのお客様が最初に買った物」を数えると出せます。人数が10人未満のカテゴリは診断を保留します。')}</span></div>
      <div class="products">${state.categories.map((c, i) => categoryCard(c, i, period)).join('')}</div>
      <button type="button" class="addbtn" data-action="add-category">＋ 間口カテゴリを追加</button>
      <div class="warnings" data-out="warnings"></div>
      <details class="card optblock"><summary>集客経路（任意）— 経路ごとの新規人数と費用からCPAを出します</summary>
        <div class="optbody"><table class="ltable"><tr><th>経路名</th><th>新規人数</th><th>費用（円・期間合計）</th><th>CPA</th><th></th></tr>
          ${state.channels.map((ch, i) => `<tr><td><input type="text" data-path="channels.${i}.name" value="${esc(ch.name)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.newCustomers" value="${val(ch.newCustomers)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.cost" value="${val(ch.cost)}"></td><td data-out="cpa-${ch.id}"></td><td><button type="button" class="del dark" data-action="del-channel" data-index="${i}">✕</button></td></tr>`).join('')}
        </table><button type="button" class="sbtn" data-action="add-channel">＋ 経路を追加</button>
        <p class="note-p">経路の新規合計と間口カテゴリの新規合計は一致しなくて構いません（経路＝入口の話、カテゴリ＝買った物の話です）。</p></div>
      </details>
      <details class="card optblock"><summary>目安値（任意）— 業界平均や自社の目標など、比べたい数字があれば</summary>
        <div class="optbody basebox">
          <div class="field"><span class="flabel">同日追加率の目安 %</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.sameDayRate" value="${val(b.sameDayRate)}"></div>
          <div class="field"><span class="flabel">初回→追加購入日数の目安</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.daysToAddon" value="${val(b.daysToAddon)}"></div>
          ${[0, 1, 2].map(y => `<div class="field"><span class="flabel">後日追加率の目安（${PER[y]}）%</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.laterRate.${y}" value="${val(b.laterRate[y])}"></div>`).join('')}
          ${[0, 1, 2].map(y => `<div class="field"><span class="flabel">後日追加単価の目安（${PER[y]}）円</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.laterAov.${y}" value="${val(b.laterAov[y])}"></div>`).join('')}
        </div>
      </details>
      <details class="card optblock" id="paste-block"><summary>CRM／表から貼り付け — ExcelやCRMの実測表をコピーして貼ると各欄に振り分けます</summary>
        <div class="optbody">
          <p class="note-p">1行目に見出し（間口カテゴリ／期間／新規獲得数／間口単価／同日追加率／後日追加率…、または entry_category / period_years / new_customers …）を含めてください。同じカテゴリの行が複数ある場合は人数で加重平均します。「初回→追加購入までの日数」は貼り付け対象外のため手入力です。</p>
          <textarea id="paste-text" rows="6" placeholder="ここに貼り付け"></textarea>
          <button type="button" class="sbtn" data-action="paste-preview">プレビュー</button>
          <div id="paste-preview"></div>
        </div>
      </details>`;
    outputs(el, state);
    U().bindPanel(el, api, actions(api, el));
  }
  function renderPreview(res, api, el) {
    const { esc, fmt, fmt1 } = U(); const box = el.querySelector('#paste-preview'); if (!box) return;
    const names = new Set(api.getState().categories.map(c => c.name));
    box.innerHTML = (res.warnings.length ? `<ul class="warn">${res.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '') +
      (res.rows.length ? `<table class="ltable"><tr><th>カテゴリ</th><th>期間</th><th>新規</th><th>間口単価</th><th>同日率</th><th>同日単価</th><th>後日率</th><th>後日単価</th><th>実測LTV（参考）</th><th>扱い</th></tr>
        ${res.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.period}年</td><td>${fmt(r.newCustomers)}</td><td>${fmt(r.entryPrice)}</td><td>${fmt1(r.sameDayRate)}</td><td>${fmt(r.sameDayAov)}</td><td>${fmt1(r.laterRate)}</td><td>${fmt(r.laterAov)}</td><td>${fmt(r.measuredLtv)}</td><td>${names.has(r.name) ? '上書き' : '追加'}</td></tr>`).join('')}</table>
        <button type="button" class="sbtn primary" data-action="paste-apply">取り込む</button>` : '<p class="note-p">取り込める行がありません。</p>');
  }
  function actions(api, el) {
    return {
      'add-category': () => api.update(s => { s.categories.push(Sim.state.newCategory({ name: '新しい間口カテゴリ' })); }, { structural: true }),
      'del-category': d => { if (!confirm('この間口カテゴリを削除しますか？')) return; api.update(s => { s.categories.splice(+d.index, 1); }, { structural: true }); },
      'add-prev': d => api.update(s => { s.categories[+d.index].prev = Sim.state.emptyPrev(); }, { structural: true }),
      'del-prev': d => api.update(s => { s.categories[+d.index].prev = null; }, { structural: true }),
      'add-channel': () => api.update(s => { s.channels.push(Sim.state.newChannel()); }, { structural: true }),
      'del-channel': d => api.update(s => { s.channels.splice(+d.index, 1); }, { structural: true }),
      'paste-preview': () => { const text = el.querySelector('#paste-text').value; const res = Sim.paste.parse(text, { period: api.period }); pendingRows = res.rows; renderPreview(res, api, el); },
      'paste-apply': () => { if (!pendingRows || !pendingRows.length) return; const rows = pendingRows; pendingRows = null; api.update(s => { const r = Sim.paste.apply(s, rows); Object.assign(s, r.state); }, { structural: true }); }
    };
  }
  function outputs(el, state) {
    const { yen, fmt, esc } = U(); const period = state.store.period; const st = Sim.calc.store(state, period);
    st.categories.forEach(c => {
      const box = el.querySelector(`[data-out="ltv-${c.id}"]`);
      if (box) box.innerHTML = `<div class="pltv-row"><span>間口購入</span><span>${yen(c.entryPrice)}</span></div><div class="pltv-row"><span>同日追加ぶん</span><span>${yen(c.sameDayPart)}</span></div><div class="pltv-row"><span>後日追加ぶん（${period}年累計）</span><span>${yen(c.laterPart)}</span></div><div class="pltv-row pltv-total"><span>顧客あたりLTV（${period}年）</span><span>${yen(c.ltv)}</span></div>`;
    });
    st.channels.forEach(ch => { const td = el.querySelector(`[data-out="cpa-${ch.id}"]`); if (td) td.textContent = ch.cpa == null ? '—' : '¥' + fmt(ch.cpa); });
    const w = Sim.analysis.checks(state); const wb = el.querySelector('[data-out="warnings"]');
    if (wb) wb.innerHTML = w.length ? `<ul class="warn">${w.map(x => `<li>${esc(x.message)}</li>`).join('')}</ul>` : '';
  }
  Sim.ui.input = { render, refresh: outputs };
})();
