window.Sim = window.Sim || {};
(function () {
  const $ = id => document.getElementById(id);
  const app = { company: null, step: 1, storage: null, filePick: null };
  let reportDirty = true;
  function getStorage() { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch (e) { return null; } }
  const active = () => Sim.state.activeStore(app.company);
  const isCompanyView = () => active() == null;
  const storeMods = () => ({ 1: Sim.ui.mgmt, 2: Sim.ui.input, 3: Sim.ui.diagnosis, 4: Sim.ui.plan, 5: Sim.ui.report });
  const companyMods = () => ({ 1: Sim.ui.company && Sim.ui.company.mgmt, 2: Sim.ui.company && Sim.ui.company.entry, 3: Sim.ui.companyDiag, 4: Sim.ui.companyPlan && Sim.ui.companyPlan.plan, 5: Sim.ui.companyPlan && Sim.ui.companyPlan.report });
  const currentMod = step => (isCompanyView() ? companyMods() : storeMods())[step];
  const currentState = () => (isCompanyView() ? app.company : active());
  const currentApi = () => (isCompanyView() ? companyApi : api);
  const periodOf = () => (active() || app.company.stores[0]).store.period;
  function persist() { if (app.storage) Sim.state.save(app.company, app.storage); }
  function touch() { app.company.meta.updatedAt = new Date().toISOString(); persist(); reportDirty = true; }
  function applyGuide(el) { if (document.body.classList.contains('guide-open')) el.querySelectorAll('details.guide').forEach(d => { d.open = true; }); }
  function update(fn, opts) {
    opts = opts || {}; const s = active(); if (!s) return;
    fn(s); Sim.state.syncScenarios(s); Sim.state.syncShared(app.company, app.company.stores.indexOf(s)); touch(); renderStoreBar();
    if (opts.structural) renderStep(); else refreshStep();
  }
  function updateCompany(fn, opts) {
    opts = opts || {}; fn(app.company); app.company.stores.forEach(s => Sim.state.syncScenarios(s)); Sim.state.syncShared(app.company, 0); touch();
    renderStoreBar(); if (opts.structural) renderStep(); else refreshStep();
  }
  const api = { update, setStep, getState: () => active(), getCompany: () => app.company, get period() { return periodOf(); }, setStore, exportStore, pickStoreFile };
  const companyApi = { update: updateCompany, setStep, getState: () => app.company, getCompany: () => app.company, get period() { return periodOf(); }, setStore, exportStore, pickStoreFile };
  function renderHeader() {
    const s = active(); const multi = app.company.stores.length > 1;
    const parts = [multi ? app.company.company.name : '', s ? s.store.name : (multi ? '全社' : '')].filter(Boolean);
    $('head-title').textContent = parts.concat('売上シミュレーター').join('｜'); document.title = parts.concat('店舗 売上シミュレーター').join('｜');
    const p = periodOf(); document.querySelectorAll('#periodbar button, #floatp button').forEach(b => b.classList.toggle('active', +b.dataset.p === p));
  }
  function renderStoreBar() {
    const c = app.company; const esc = Sim.ui.util.esc; const multi = c.stores.length > 1;
    $('storebar').innerHTML = (multi ? `<button type="button" data-store="" class="${c.activeStoreId == null ? 'active' : ''}"><span class="no">全</span>全社</button>` : '') +
      c.stores.map((s, i) => `<button type="button" data-store="${esc(s.store.id)}" class="${c.activeStoreId === s.store.id ? 'active' : ''}">${esc(Sim.state.storeLabel(c, i))}</button>`).join('') +
      `<span class="spacer"></span><button type="button" class="add" data-store-add="empty">＋ 空の店舗</button><button type="button" class="add" data-store-add="file">＋ ファイルから店舗</button>`;
  }
  function renderStep() {
    const el = $('panel-' + app.step); const m = currentMod(app.step);
    if (!m) el.innerHTML = '<p class="note-p">この画面は準備中です。</p>'; else { m.render(el, currentState(), currentApi()); applyGuide(el); }
    renderHeader();
  }
  function refreshStep() { const el = $('panel-' + app.step); const m = currentMod(app.step); if (!m) return renderStep(); (m.refresh || m.render)(el, currentState(), currentApi()); renderHeader(); }
  function setStep(n) {
    app.step = n;
    document.querySelectorAll('.step-panel').forEach(p => { p.hidden = +p.dataset.step !== n; });
    document.querySelectorAll('#stepper button').forEach(b => b.classList.toggle('active', +b.dataset.step === n));
    renderStep(); window.scrollTo({ top: 0 });
    if (n === 5) reportDirty = false;
  }
  function setStore(id) {
    app.company.activeStoreId = id || null; if (app.company.stores.length === 1) app.company.activeStoreId = app.company.stores[0].store.id;
    reportDirty = true; persist(); renderStoreBar(); renderStep(); window.scrollTo({ top: 0 });
  }
  function setPeriod(p) { const src = active() || app.company.stores[0]; src.store.period = p; Sim.state.syncShared(app.company, app.company.stores.indexOf(src)); touch(); renderStep(); }
  function replaceCompany(next) { app.company = next; app.company.stores.forEach(s => Sim.state.syncScenarios(s)); persist(); reportDirty = true; renderStoreBar(); renderStep(); }
  function download(text, name) {
    const blob = new Blob([text], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportJson() { download(Sim.state.serialize(app.company), Sim.state.exportFilename(app.company)); }
  function exportStore(id) { const s = app.company.stores.find(x => x.store.id === id); if (s) download(Sim.state.serializeStore(s), Sim.state.exportStoreFilename(s)); }
  function readFile(file, onText) { const r = new FileReader(); r.onload = () => onText(r.result); r.onerror = () => alert('ファイルを読み込めませんでした。'); r.readAsText(file); }
  function errMsg(e) {
    if (e.message === 'unsupported version') return 'このファイルは新しい形式のため読み込めません。';
    if (e.message === 'company file') return 'これは会社全体のファイルです。店舗ファイルを選んでください。';
    return 'ファイルの形式が違います。';
  }
  function importJson(file) {
    readFile(file, text => {
      try {
        const next = Sim.state.parse(text); let raw = null; try { raw = JSON.parse(text); } catch (e) { raw = null; }
        const isStoreFile = !(raw && Array.isArray(raw.stores)) || raw.stores.length === 1;
        const msg = (isStoreFile && app.company.stores.length > 1)
          ? '店舗ファイルです。今の内容（全店舗）をこの店舗1つに置き換えます。店舗として追加したい場合は「＋ ファイルから店舗」をお使いください。よろしいですか？'
          : '今の内容を、読み込んだ内容で置き換えます。よろしいですか？';
        if (!confirm(msg)) return; replaceCompany(next);
      } catch (e) { alert(errMsg(e)); }
    });
  }
  function pickStoreFile(mode, id) { app.filePick = { mode: mode || 'add', id: id || null }; $('store-file').click(); }
  function importStoreFile(file) {
    const pick = app.filePick || { mode: 'add', id: null }; app.filePick = null;
    readFile(file, text => {
      try {
        const bundle = Sim.state.parseStore(text);
        if (pick.mode === 'replace') { if (!confirm('この店舗の内容をファイルで置き換えます。よろしいですか？')) return; updateCompany(c => { Sim.state.replaceStore(c, pick.id, bundle); }, { structural: true }); }
        else { let nid = null; updateCompany(c => { nid = Sim.state.addStore(c, bundle); }, { structural: true }); setStore(nid); }
      } catch (e) { alert(errMsg(e)); }
    });
  }
  function init() {
    app.storage = getStorage(); if (!app.storage) $('storage-notice').hidden = false;
    app.company = (app.storage && Sim.state.load(app.storage)) || Sim.state.createSample(); app.company.stores.forEach(s => Sim.state.syncScenarios(s));
    document.querySelectorAll('#stepper button').forEach(b => { b.onclick = () => setStep(+b.dataset.step); });
    document.querySelectorAll('#periodbar button, #floatp button').forEach(b => { b.onclick = () => setPeriod(+b.dataset.p); });
    document.querySelectorAll('[data-app]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.app;
        if (a === 'export') exportJson();
        if (a === 'sample' && confirm('サンプルデータ（2店舗）を読み込み、今の内容を置き換えます。よろしいですか？')) replaceCompany(Sim.state.createSample());
        if (a === 'reset' && confirm('空の状態から始めます。今の内容は消えます。よろしいですか？')) replaceCompany(Sim.state.createEmpty());
        if (a === 'guide') { const open = document.body.classList.toggle('guide-open'); document.querySelectorAll('details.guide').forEach(d => { d.open = open; }); b.textContent = open ? 'ガイドをすべて閉じる' : 'ガイドをすべて開く'; }
      };
    });
    $('import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; });
    $('store-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importStoreFile(f); e.target.value = ''; });
    $('storebar').addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.storeAdd === 'empty') { let nid = null; updateCompany(c => { nid = Sim.state.addStore(c); }, { structural: true }); setStore(nid); return; }
      if (t.dataset.storeAdd === 'file') { pickStoreFile('add'); return; }
      if ('store' in t.dataset) setStore(t.dataset.store || null);
    });
    const fp = $('floatp'), anchor = $('periodbar');
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => fp.classList.toggle('hide', e.isIntersecting)), { threshold: 0 }).observe(anchor);
    window.addEventListener('beforeprint', () => { const m = currentMod(5); if (reportDirty && m) { m.render($('panel-5'), currentState(), currentApi()); applyGuide($('panel-5')); reportDirty = false; } });
    renderStoreBar(); setStep(1);
  }
  document.addEventListener('DOMContentLoaded', init);
  Sim.app = { api, companyApi, setStep, setPeriod, update, updateCompany, setStore };
})();
