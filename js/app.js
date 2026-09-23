window.Sim = window.Sim || {};
(function () {
  const $ = id => document.getElementById(id);
  const app = { state: null, step: 1, storage: null };
  let reportDirty = true;
  function getStorage() { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch (e) { return null; } }
  const mods = () => ({ 1: Sim.ui.input, 2: Sim.ui.diagnosis, 3: Sim.ui.plan, 4: Sim.ui.report });
  const api = { update, setStep, getState: () => app.state, get period() { return app.state.store.period; } };
  function persist() { if (app.storage) Sim.state.save(app.state, app.storage); }
  function applyGuide(el) { if (document.body.classList.contains('guide-open')) el.querySelectorAll('details.guide').forEach(d => { d.open = true; }); }
  function update(fn, opts) { opts = opts || {}; fn(app.state); Sim.state.syncScenarios(app.state); app.state.meta.updatedAt = new Date().toISOString(); persist(); reportDirty = true; if (opts.structural) renderStep(); else refreshStep(); }
  function renderHeader() {
    const s = app.state.store; $('head-title').textContent = (s.name ? s.name + '｜' : '') + '売上シミュレーター';
    document.title = (s.name ? s.name + '｜' : '') + '店舗 売上シミュレーター';
    document.querySelectorAll('#periodbar button, #floatp button').forEach(b => b.classList.toggle('active', +b.dataset.p === s.period));
  }
  function renderStep() { const el = $('panel-' + app.step); mods()[app.step].render(el, app.state, api); applyGuide(el); renderHeader(); }
  function refreshStep() { const el = $('panel-' + app.step); const m = mods()[app.step]; (m.refresh || m.render)(el, app.state, api); renderHeader(); }
  function setStep(n) {
    app.step = n;
    document.querySelectorAll('.step-panel').forEach(p => { p.hidden = +p.dataset.step !== n; });
    document.querySelectorAll('#stepper button').forEach(b => b.classList.toggle('active', +b.dataset.step === n));
    renderStep(); window.scrollTo({ top: 0 });
    if (n === 4) reportDirty = false;
  }
  function setPeriod(p) { update(s => { s.store.period = p; }, { structural: true }); }
  function replaceState(next) { app.state = next; Sim.state.syncScenarios(app.state); persist(); reportDirty = true; renderStep(); }
  function exportJson() {
    const blob = new Blob([Sim.state.serialize(app.state)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = Sim.state.exportFilename(app.state);
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const next = Sim.state.parse(r.result);
        if (!confirm('今の内容を、読み込んだ内容で置き換えます。よろしいですか？')) return;
        replaceState(next);
      } catch (e) { alert(e.message === 'unsupported version' ? 'このファイルは新しい形式のため読み込めません。' : 'ファイルの形式が違います。'); }
    };
    r.onerror = () => alert('ファイルを読み込めませんでした。');
    r.readAsText(file);
  }
  function init() {
    app.storage = getStorage(); if (!app.storage) $('storage-notice').hidden = false;
    app.state = (app.storage && Sim.state.load(app.storage)) || Sim.state.createSample(); Sim.state.syncScenarios(app.state);
    document.querySelectorAll('#stepper button').forEach(b => { b.onclick = () => setStep(+b.dataset.step); });
    document.querySelectorAll('#periodbar button, #floatp button').forEach(b => { b.onclick = () => setPeriod(+b.dataset.p); });
    document.querySelectorAll('[data-app]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.app;
        if (a === 'export') exportJson();
        if (a === 'sample' && confirm('サンプルデータを読み込み、今の内容を置き換えます。よろしいですか？')) replaceState(Sim.state.createSample());
        if (a === 'reset' && confirm('空の状態から始めます。今の内容は消えます。よろしいですか？')) replaceState(Sim.state.createEmpty());
        if (a === 'guide') { const open = document.body.classList.toggle('guide-open'); document.querySelectorAll('details.guide').forEach(d => { d.open = open; }); b.textContent = open ? 'ガイドをすべて閉じる' : 'ガイドをすべて開く'; }
      };
    });
    $('import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; });
    const fp = $('floatp'), anchor = $('periodbar');
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => fp.classList.toggle('hide', e.isIntersecting)), { threshold: 0 }).observe(anchor);
    window.addEventListener('beforeprint', () => { if (reportDirty) { Sim.ui.report.render($('panel-4'), app.state, api); applyGuide($('panel-4')); reportDirty = false; } });
    setStep(1);
  }
  document.addEventListener('DOMContentLoaded', init);
  Sim.app = { api, setStep, setPeriod, update };
})();
