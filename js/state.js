window.Sim = window.Sim || {};
(function () {
  const SCHEMA_VERSION = 3;
  const STORAGE_KEY = 'storeSim:v2';
  let seq = 0;
  const uid = (prefix) => prefix + '_' + Date.now().toString(36) + '_' + (++seq);
  const num = (v, d) => (v === '' || v == null || isNaN(+v)) ? (d == null ? 0 : d) : +v;
  const optNum = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;
  const safeId = (v, prefix) => { const s = String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, ''); return s || uid(prefix); };

  function emptyLevers() { return { newPct: 0, sameDayPt: 0, laterPt: 0, aovPct: 0, entryPricePct: 0 }; }
  function emptyPrev() {
    return { entryPrice: null, newCustomers: null, sameDay: { rate: null, aov: null },
      later: [{ rate: null, aov: null }, { rate: null, aov: null }, { rate: null, aov: null }], daysToAddon: null };
  }
  function newProductRow(o) {
    o = o || {};
    return { id: safeId(o.id, 'p'), name: o.name == null ? '' : String(o.name), sales: optNum(o.sales), grossMarginPct: optNum(o.grossMarginPct) };
  }
  function newReplacementRow(o) {
    o = o || {};
    return { id: safeId(o.id, 'r'), name: o.name == null ? '' : String(o.name), cycleYears: optNum(o.cycleYears), pastBuyers: optNum(o.pastBuyers) };
  }
  function emptyMgmt() {
    return {
      revenue: null, buyers: null, newBuyers: null, newRevenue: null, itemsPerBuyer: null,
      activeCustomers: null, visits: { once: null, twice: null, threePlus: null }, dormant: null,
      products: [], inventory: null,
      costs: { cogs: null, labor: null, rent: null, ads: null, other: null },
      funnel: { reservations: null, visits: null, deals: null },
      replacement: [], prev: null
    };
  }
  function normalizeMgmt(raw, allowPrev) {
    const m = emptyMgmt(); const r = (raw && typeof raw === 'object') ? raw : {};
    ['revenue', 'buyers', 'newBuyers', 'newRevenue', 'itemsPerBuyer', 'activeCustomers', 'dormant', 'inventory'].forEach(k => { m[k] = optNum(r[k]); });
    const v = r.visits || {}; m.visits = { once: optNum(v.once), twice: optNum(v.twice), threePlus: optNum(v.threePlus) };
    const c = r.costs || {}; m.costs = { cogs: optNum(c.cogs), labor: optNum(c.labor), rent: optNum(c.rent), ads: optNum(c.ads), other: optNum(c.other) };
    const f = r.funnel || {}; m.funnel = { reservations: optNum(f.reservations), visits: optNum(f.visits), deals: optNum(f.deals) };
    m.products = Array.isArray(r.products) ? r.products.map(p => newProductRow(p)) : [];
    m.replacement = Array.isArray(r.replacement) ? r.replacement.map(p => newReplacementRow(p)) : [];
    dedupeIds(m.products, 'p'); dedupeIds(m.replacement, 'r');
    if (allowPrev && r.prev && typeof r.prev === 'object') { m.prev = normalizeMgmt(r.prev, false); delete m.prev.prev; }
    else m.prev = null;
    return m;
  }
  function normalizePrev(p) {
    const e = emptyPrev(); if (!p || typeof p !== 'object') return e;
    e.entryPrice = optNum(p.entryPrice); e.newCustomers = optNum(p.newCustomers); e.daysToAddon = optNum(p.daysToAddon);
    e.sameDay = { rate: optNum(p.sameDay && p.sameDay.rate), aov: optNum(p.sameDay && p.sameDay.aov) };
    e.later = [0, 1, 2].map(i => ({ rate: optNum(p.later && p.later[i] && p.later[i].rate), aov: optNum(p.later && p.later[i] && p.later[i].aov) }));
    return e;
  }
  function newCategory(o) {
    o = o || {};
    return {
      id: safeId(o.id, 'c'),
      name: o.name == null ? '新しい間口カテゴリ' : String(o.name),
      entryPrice: num(o.entryPrice, 0),
      newCustomers: num(o.newCustomers, 0),
      sameDay: { rate: num(o.sameDay && o.sameDay.rate, 0), aov: num(o.sameDay && o.sameDay.aov, 0) },
      later: [0, 1, 2].map(i => ({ rate: num(o.later && o.later[i] && o.later[i].rate, 0), aov: num(o.later && o.later[i] && o.later[i].aov, 0) })),
      daysToAddon: optNum(o.daysToAddon),
      nextProducts: o.nextProducts == null ? '' : String(o.nextProducts),
      prev: o.prev ? normalizePrev(o.prev) : null
    };
  }
  function newChannel(o) {
    o = o || {};
    return { id: safeId(o.id, 'ch'), name: o.name == null ? '新しい経路' : String(o.name), newCustomers: num(o.newCustomers, 0), cost: num(o.cost, 0) };
  }
  const LEVER_KEYS = ['newPct', 'sameDayPt', 'laterPt', 'aovPct', 'entryPricePct'];
  const TACTIC_LEVERS = ['new', 'sameDay', 'later', 'aov', 'entryPrice'];
  function sanitizeLevers(raw) {
    const l = emptyLevers(); const r = raw || {};
    LEVER_KEYS.forEach(k => { l[k] = num(r[k], 0); });
    return l;
  }
  function newScenario(name, categories, o) {
    o = o || {}; const levers = {};
    (categories || []).forEach(c => { levers[c.id] = sanitizeLevers(o.levers && o.levers[c.id]); });
    const tactics = Array.isArray(o.tactics) ? o.tactics.map(t => ({
      lever: TACTIC_LEVERS.includes(t.lever) ? t.lever : 'new', categoryId: t.categoryId == null ? null : t.categoryId, text: t.text == null ? '' : String(t.text),
      owner: t.owner == null ? '' : String(t.owner), due: t.due == null ? '' : String(t.due), fromLibrary: !!t.fromLibrary,
      libId: t.libId == null ? null : String(t.libId)
    })) : [];
    return { name: name || o.name || 'シナリオ', levers, tactics, memo: o.memo == null ? '' : String(o.memo) };
  }
  function createEmpty() {
    const now = new Date().toISOString();
    return {
      version: SCHEMA_VERSION,
      store: { name: '', fiscalLabel: '', cogsRate: 50, fixedCostMonthly: 0, period: 3 },
      benchmarks: { sameDayRate: null, laterRate: [null, null, null], laterAov: [null, null, null], daysToAddon: null,
        grossMarginPct: null, laborPct: null, rentPct: null, adsPct: null, repeatRate: null },
      categories: [], channels: [],
      mgmt: emptyMgmt(),
      plan: { targetRevenue: [null, null, null], activeScenario: 0, scenarios: [newScenario('標準', [])], requiredProfit: null, existingGrowthPct: 0 },
      meta: { createdAt: now, updatedAt: now }
    };
  }
  const V1_SAMPLE = {
    products: [
      { name: '枕（フィッティング）', front: 12000, new1: 40, aov: [15000, 26000, 34000], ret: [35, 55, 68] },
      { name: '敷きもの・カバー類', front: 6000, new1: 60, aov: [5000, 9000, 12000], ret: [50, 72, 85] }
    ], cogs: 50, fixed: 0
  };
  function migrateV1(products, globals) {
    globals = globals || {}; const s = createEmpty();
    s.store.cogsRate = num(globals.cogs, 50); s.store.fixedCostMonthly = num(globals.fixed, 0);
    s.categories = (products || []).map(p => newCategory({
      name: p.name, entryPrice: p.front, newCustomers: p.new1,
      later: [0, 1, 2].map(i => ({ rate: p.ret && p.ret[i], aov: p.aov && p.aov[i] }))
    }));
    s.plan.scenarios = [newScenario('標準', s.categories)];
    return s;
  }
  function createSample() {
    const s = migrateV1(V1_SAMPLE.products, { cogs: V1_SAMPLE.cogs, fixed: V1_SAMPLE.fixed });
    s.store.name = 'サンプル寝具店'; s.store.fiscalLabel = '2026年度';
    s.categories[0].nextProducts = 'マットレス・枕カバー'; s.categories[0].daysToAddon = 45;
    s.categories[1].nextProducts = '掛け布団・枕'; s.categories[1].daysToAddon = 90;
    s.plan.scenarios = [newScenario('保守', s.categories), newScenario('標準', s.categories), newScenario('強気', s.categories)];
    s.channels = [newChannel({ name: 'Google広告', newCustomers: 40, cost: 900000 }), newChannel({ name: '紹介・口コミ', newCustomers: 35, cost: 0 }), newChannel({ name: 'チラシ', newCustomers: 25, cost: 300000 })];
    s.mgmt = normalizeMgmt({
      revenue: 48000000, buyers: 700, newBuyers: 100, newRevenue: 900000, itemsPerBuyer: 1.6,
      activeCustomers: 900, visits: { once: 500, twice: 250, threePlus: 150 }, dormant: 300,
      products: [{ name: '枕（フィッティング）', sales: 5000000, grossMarginPct: 55 }, { name: '敷きもの・カバー類', sales: 12000000, grossMarginPct: 45 },
        { name: 'マットレス', sales: 20000000, grossMarginPct: 40 }, { name: 'その他', sales: 11000000, grossMarginPct: 50 }],
      inventory: 6000000,
      costs: { cogs: 24000000, labor: 9600000, rent: 3600000, ads: 1800000, other: 4200000 },
      funnel: { reservations: 300, visits: 240, deals: 180 },
      replacement: [{ name: 'マットレス', cycleYears: 8, pastBuyers: 320 }]
    }, true);
    s.plan.activeScenario = 1;
    return s;
  }
  function dedupeIds(list, prefix) {
    const seen = new Set();
    list.forEach(item => { if (seen.has(item.id)) item.id = uid(prefix); seen.add(item.id); });
  }
  function normalize(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('invalid');
    if (num(obj.version, 0) > SCHEMA_VERSION) throw new Error('unsupported version');
    const s = createEmpty(); const st = obj.store || {}; const b = obj.benchmarks || {}; const p = obj.plan || {};
    s.store = { name: st.name == null ? '' : String(st.name), fiscalLabel: st.fiscalLabel == null ? '' : String(st.fiscalLabel),
      cogsRate: num(st.cogsRate, 50), fixedCostMonthly: num(st.fixedCostMonthly, 0), period: [1, 2, 3].includes(+st.period) ? +st.period : 3 };
    s.benchmarks = { sameDayRate: optNum(b.sameDayRate), laterRate: [0, 1, 2].map(i => optNum(b.laterRate && b.laterRate[i])),
      laterAov: [0, 1, 2].map(i => optNum(b.laterAov && b.laterAov[i])), daysToAddon: optNum(b.daysToAddon),
      grossMarginPct: optNum(b.grossMarginPct), laborPct: optNum(b.laborPct), rentPct: optNum(b.rentPct), adsPct: optNum(b.adsPct), repeatRate: optNum(b.repeatRate) };
    s.categories = Array.isArray(obj.categories) ? obj.categories.map(c => newCategory(c)) : [];
    s.channels = Array.isArray(obj.channels) ? obj.channels.map(c => newChannel(c)) : [];
    dedupeIds(s.categories, 'c'); dedupeIds(s.channels, 'ch');
    s.plan.targetRevenue = [0, 1, 2].map(i => optNum(p.targetRevenue && p.targetRevenue[i]));
    s.plan.requiredProfit = optNum(p.requiredProfit); s.plan.existingGrowthPct = num(p.existingGrowthPct, 0);
    s.mgmt = normalizeMgmt(obj.mgmt, true);
    const scs = (Array.isArray(p.scenarios) && p.scenarios.length) ? p.scenarios.slice(0, 3) : [{ name: '標準' }];
    s.plan.scenarios = scs.map(sc => newScenario(sc.name, s.categories, sc));
    s.plan.activeScenario = Math.min(Math.max(0, Math.round(num(p.activeScenario, 0))), s.plan.scenarios.length - 1);
    s.meta = { createdAt: (obj.meta && obj.meta.createdAt) || s.meta.createdAt, updatedAt: (obj.meta && obj.meta.updatedAt) || s.meta.updatedAt };
    syncScenarios(s);
    return s;
  }
  function syncScenarios(state) {
    if (!state.plan.scenarios.length) state.plan.scenarios.push(newScenario('標準', state.categories));
    const ids = new Set(state.categories.map(c => c.id));
    state.plan.scenarios.forEach(sc => {
      sc.levers = sc.levers || {};
      state.categories.forEach(c => { if (!sc.levers[c.id]) sc.levers[c.id] = emptyLevers(); });
      Object.keys(sc.levers).forEach(id => { if (!ids.has(id)) delete sc.levers[id]; });
    });
    if (state.plan.activeScenario >= state.plan.scenarios.length) state.plan.activeScenario = 0;
    return state;
  }
  function serialize(state) {
    return JSON.stringify(Object.assign({}, state, { meta: Object.assign({}, state.meta, { updatedAt: new Date().toISOString() }) }), null, 2);
  }
  function parse(json) { let o; try { o = JSON.parse(json); } catch (e) { throw new Error('invalid json'); } return normalize(o); }
  function save(state, storage) { try { storage.setItem(STORAGE_KEY, serialize(state)); return true; } catch (e) { return false; } }
  function load(storage) { try { const j = storage.getItem(STORAGE_KEY); return j ? parse(j) : null; } catch (e) { return null; } }
  function exportFilename(state, date) {
    date = date || new Date();
    const pad = v => String(v).padStart(2, '0');
    const d = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
    const n = (state.store.name || 'store').replace(/[\\/:*?"<>|]/g, '_');
    return n + '_' + d + '.json';
  }
  Sim.state = { SCHEMA_VERSION, STORAGE_KEY, createEmpty, createSample, newCategory, newChannel, newScenario, emptyLevers, emptyPrev,
    emptyMgmt, normalizeMgmt, newProductRow, newReplacementRow,
    migrateV1, normalize, syncScenarios, serialize, parse, save, load, exportFilename };
})();
