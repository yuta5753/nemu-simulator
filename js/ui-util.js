window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split('.'); let o = obj;
    for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = value;
  }
  function parseValue(el) {
    const t = (el.dataset && el.dataset.type) || 'str'; const v = el.type === 'checkbox' ? el.checked : el.value;
    if (t === 'num') { const n = +v; return (v === '' || isNaN(n)) ? 0 : n; }
    if (t === 'optnum') { if (v === '' || v == null) return null; const n = +v; return isNaN(n) ? null : n; }
    if (t === 'bool') return !!v;
    return v;
  }
  function bindPanel(el, api, actions) {
    if (el.dataset.bound) { el._actions = actions; return; }
    el.dataset.bound = '1'; el._actions = actions;
    el.addEventListener('input', e => {
      const t = e.target.closest('[data-path]'); if (!t || t.type === 'checkbox') return;
      const v = parseValue(t); api.update(s => setPath(s, t.dataset.path, v));
    });
    el.addEventListener('change', e => {
      const t = e.target.closest('[data-path]'); if (!t || t.type !== 'checkbox') return;
      const v = parseValue(t); api.update(s => setPath(s, t.dataset.path, v));
    });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-action]'); if (!t || !el.contains(t)) return;
      const fn = el._actions && el._actions[t.dataset.action]; if (fn) fn(t.dataset, t, e);
    });
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('ja-JP');
  const fmt1 = n => (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  const yen = n => (n == null || isNaN(n)) ? '—' : '¥' + fmt(n);
  const signed = (n, unit, digits) => { if (n == null || isNaN(n)) return '—'; const v = digits ? fmt1(n) : fmt(n); return (n >= 0 ? '+' : '') + v + (unit || ''); };
  const val = v => (v == null ? '' : v);
  const guide = text => `<details class="guide"><summary aria-label="説明">？</summary><div>${text}</div></details>`;
  Sim.ui.util = { getPath, setPath, parseValue, bindPanel, esc, fmt, fmt1, yen, signed, val, guide };
})();
