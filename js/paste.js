window.Sim = window.Sim || {};
(function () {
  const HEADERS = {
    name: ['間口カテゴリ', 'entry_category', 'カテゴリ', 'category'],
    period: ['期間', 'period_years', 'period'],
    newCustomers: ['新規獲得数', 'new_customers', '新規', '新規獲得人数'],
    entryPrice: ['間口単価', 'entry_unit_price'],
    entrySales: ['entry_sales', '間口売上'],
    sameDayRate: ['同日追加率', 'sameday_addon_rate'],
    sameDayCustomers: ['sameday_addon_customers'],
    sameDaySales: ['sameday_addon_sales'],
    sameDayAov: ['同日追加単価'],
    laterRate: ['後日追加率', 'later_addon_rate'],
    laterCustomers: ['later_addon_customers'],
    laterSales: ['later_addon_sales'],
    laterAov: ['後日追加単価'],
    measuredLtv: ['measured_ltv', '実測ltv'],
    cohortMonth: ['cohort_month', 'コホート月']
  };
  const NEG_LABELS = { entrySales: '間口売上', entryPrice: '間口単価', sdRate: '同日追加率', sdCust: '同日追加人数', sdSales: '同日追加売上', sdAov: '同日追加単価',
    ltRate: '後日追加率', ltCust: '後日追加人数', ltSales: '後日追加売上', ltAov: '後日追加単価', ltv: '実測LTV' };
  const norm = h => String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, '').replace(/^"|"$/g, '');
  function mapHeaders(cells) {
    const map = {};
    cells.forEach((h, i) => { const n = norm(h); Object.keys(HEADERS).forEach(key => { if (map[key] == null && HEADERS[key].some(a => norm(a) === n)) map[key] = i; }); });
    return map;
  }
  function toNum(v) {
    if (v == null) return null; const s = String(v).replace(/[¥￥,，%％円人\s"]/g, ''); if (s === '') return null;
    const n = Number(s); return isNaN(n) ? null : n;
  }
  function parse(text, opts) {
    opts = opts || {}; const defPeriod = opts.period || 3; const warnings = [];
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return { rows: [], warnings: ['ヘッダー行とデータ行が必要です'] };
    const delim = lines[0].includes('\t') ? '\t' : ',';
    const split = l => l.split(delim).map(s => s.trim().replace(/^"|"$/g, ''));
    const headerCells = split(lines[0]); const cols = headerCells.length;
    const map = mapHeaders(headerCells);
    if (map.name == null) return { rows: [], warnings: ['「間口カテゴリ」または「entry_category」の列が見つかりません'] };
    if (map.newCustomers == null) return { rows: [], warnings: ['「新規獲得数」または「new_customers」の列が見つかりません'] };
    const acc = new Map();
    lines.slice(1).forEach((line, li) => {
      const ln = li + 2;
      if (delim === ',') {
        const rawTokens = line.split(',');
        if (rawTokens.some(t => ((t.match(/"/g) || []).length % 2) !== 0)) {
          warnings.push(`${ln}行目：引用符の対応が取れていません。カテゴリ名にカンマが含まれる場合はタブ区切りで貼り付けてください`);
          return;
        }
      }
      const c = split(line);
      if (c.length !== cols) warnings.push(`${ln}行目：列数が見出しと合いません（${c.length}列／${cols}列）。足りない項目は取り込んでいません`);
      const name = c[map.name];
      if (!name) { warnings.push(`${ln}行目：カテゴリ名が空のため飛ばしました`); return; }
      const p = map.period != null ? toNum(c[map.period]) : defPeriod;
      if (![1, 2, 3].includes(p)) { warnings.push(`${ln}行目：期間「${c[map.period]}」は1〜3ではないため飛ばしました`); return; }
      const n = toNum(c[map.newCustomers]);
      if (n == null || n < 0) { warnings.push(`${ln}行目：新規獲得数が数字でない、または負の値のため飛ばしました`); return; }
      const get = k => (map[k] != null ? toNum(c[map[k]]) : null);
      const rec = { entrySales: get('entrySales'), entryPrice: get('entryPrice'), sdRate: get('sameDayRate'), sdCust: get('sameDayCustomers'), sdSales: get('sameDaySales'),
        sdAov: get('sameDayAov'), ltRate: get('laterRate'), ltCust: get('laterCustomers'), ltSales: get('laterSales'), ltAov: get('laterAov'), ltv: get('measuredLtv') };
      Object.keys(rec).forEach(k => { if (rec[k] != null && rec[k] < 0) { warnings.push(`${ln}行目：${NEG_LABELS[k] || k} が負の値のため無視しました`); rec[k] = null; } });
      const key = name + '|' + p;
      const a = acc.get(key) || { name, period: p, n: 0, entrySales: 0, w: {}, sdCust: 0, sdSales: 0, ltCust: 0, ltSales: 0 };
      const addW = (k, v) => { if (v == null) return; a.w[k] = a.w[k] || { sum: 0, n: 0 }; a.w[k].sum += v * n; a.w[k].n += n; };
      a.n += n; if (rec.entrySales != null) a.entrySales += rec.entrySales;
      addW('entryPrice', rec.entryPrice); addW('sdRate', rec.sdRate); addW('sdAov', rec.sdAov); addW('ltRate', rec.ltRate); addW('ltAov', rec.ltAov); addW('ltv', rec.ltv);
      if (rec.sdCust != null) a.sdCust += rec.sdCust; if (rec.sdSales != null) a.sdSales += rec.sdSales;
      if (rec.ltCust != null) a.ltCust += rec.ltCust; if (rec.ltSales != null) a.ltSales += rec.ltSales;
      acc.set(key, a);
    });
    const wavg = (a, k, digits) => { const w = a.w[k]; if (!w || !w.n) return null; const v = w.sum / w.n; const m = Math.pow(10, digits || 0); return Math.round(v * m) / m; };
    const rows = Array.from(acc.values()).map(a => {
      const r = { name: a.name, period: a.period, newCustomers: a.n, entryPrice: null, sameDayRate: null, sameDayAov: null, laterRate: null, laterAov: null, measuredLtv: null };
      r.entryPrice = wavg(a, 'entryPrice'); if (r.entryPrice == null && map.entrySales != null && a.n > 0) r.entryPrice = Math.round(a.entrySales / a.n);
      r.sameDayRate = wavg(a, 'sdRate', 1);
      r.sameDayAov = wavg(a, 'sdAov'); if (r.sameDayAov == null && map.sameDaySales != null && map.sameDayCustomers != null && a.sdCust > 0) r.sameDayAov = Math.round(a.sdSales / a.sdCust);
      r.laterRate = wavg(a, 'ltRate', 1);
      r.laterAov = wavg(a, 'ltAov'); if (r.laterAov == null && map.laterSales != null && map.laterCustomers != null && a.ltCust > 0) r.laterAov = Math.round(a.ltSales / a.ltCust);
      r.measuredLtv = wavg(a, 'ltv');
      return r;
    });
    return { rows, warnings };
  }
  function apply(state, rows) {
    const s = JSON.parse(JSON.stringify(state)); const summary = [];
    rows.forEach(r => {
      let cat = s.categories.find(c => c.name === r.name); let action = 'update';
      if (!cat) { cat = Sim.state.newCategory({ name: r.name }); s.categories.push(cat); action = 'add'; }
      cat.newCustomers = r.newCustomers;
      if (r.entryPrice != null) cat.entryPrice = r.entryPrice;
      if (r.sameDayRate != null) cat.sameDay.rate = r.sameDayRate;
      if (r.sameDayAov != null) cat.sameDay.aov = r.sameDayAov;
      const i = r.period - 1;
      if (r.laterRate != null) cat.later[i].rate = r.laterRate;
      if (r.laterAov != null) cat.later[i].aov = r.laterAov;
      if (!summary.some(x => x.name === r.name)) summary.push({ name: r.name, action });
    });
    Sim.state.syncScenarios(s);
    return { state: s, summary };
  }
  const KV_LABELS = {
    revenue: ['総売上', '売上高', '総売上高'], buyers: ['購入客数', '客数'], newBuyers: ['新規客数', '新規顧客数'], newRevenue: ['新規客売上', '新規売上'],
    itemsPerBuyer: ['買上点数'], activeCustomers: ['アクティブ顧客数', '顧客数'], 'visits.once': ['来店1回'], 'visits.twice': ['来店2回'], 'visits.threePlus': ['来店3回以上'],
    dormant: ['休眠客数'], inventory: ['期末在庫', '期末在庫金額', '在庫金額'], 'costs.cogs': ['仕入原価', '売上原価'], 'costs.labor': ['人件費'], 'costs.rent': ['家賃', '地代家賃'],
    'costs.ads': ['広告宣伝費', '広告費'], 'costs.other': ['その他経費', 'その他'], 'funnel.reservations': ['予約数'], 'funnel.visits': ['来店数'], 'funnel.deals': ['成約数']
  };
  const AMOUNT_KEYS = ['revenue', 'newRevenue', 'inventory', 'costs.cogs', 'costs.labor', 'costs.rent', 'costs.ads', 'costs.other'];
  const normLabel = s => String(s == null ? '' : s).replace(/[\s　"]/g, '').replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  function parseKeyValues(text) {
    const values = {}, prev = {}, warnings = [];
    const manValues = new Set(), manPrev = new Set();
    String(text || '').split(/\r?\n/).forEach((line, li) => {
      if (line.trim() === '') return;
      const m = line.match(/^([^\t,]+)[\t,]\s*(.*)$/) || line.match(/^(\S+)[\s　]+(\S+)$/);
      if (!m) { warnings.push(`${li + 1}行目：「項目名 TAB 値」の形になっていません`); return; }
      if (m[2].trim() === '') return;   // 値が空の行（テンプレの未記入行）は黙って飛ばす
      let label = normLabel(m[1]); let isPrev = false;
      if (label.startsWith('前期')) { isPrev = true; label = label.slice(2); }
      const path = Object.keys(KV_LABELS).find(k => KV_LABELS[k].some(a => normLabel(a) === label));
      if (!path) { warnings.push(`${li + 1}行目：「${m[1].trim()}」は認識できない項目のため飛ばしました`); return; }
      const rawVal = m[2].trim();
      const hasMan = /万円?$/.test(rawVal);
      const valStr = rawVal.replace(/万円?$/, '');
      const v = toNum(valStr);
      if (v == null) { warnings.push(`${li + 1}行目：「${m[1].trim()}」の値が数字ではありません`); return; }
      (isPrev ? prev : values)[path] = v;
      if (hasMan) (isPrev ? manPrev : manValues).add(path);
    });
    // 金額は万円で受ける。明示的な「万」表記を除いて1,000,000以上の金額があれば円で貼られたとみなす
    const amounts = [].concat(
      Object.keys(values).filter(k => AMOUNT_KEYS.includes(k) && !manValues.has(k)).map(k => values[k]),
      Object.keys(prev).filter(k => AMOUNT_KEYS.includes(k) && !manPrev.has(k)).map(k => prev[k])
    );
    if (amounts.some(v => v >= 1000000)) {
      warnings.push('金額が大きいため、円で貼られたものとして取り込みました（万円で貼ると小数も使えます）');
      Object.keys(values).forEach(k => { if (AMOUNT_KEYS.includes(k) && manValues.has(k)) values[k] = Math.round(values[k] * 10000); });
      Object.keys(prev).forEach(k => { if (AMOUNT_KEYS.includes(k) && manPrev.has(k)) prev[k] = Math.round(prev[k] * 10000); });
    } else {
      [values, prev].forEach(o => Object.keys(o).forEach(k => { if (AMOUNT_KEYS.includes(k)) o[k] = Math.round(o[k] * 10000); }));
    }
    return { values, prev, warnings };
  }
  function setDeep(obj, path, value) { const keys = path.split('.'); let o = obj; for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; } o[keys[keys.length - 1]] = value; }
  function applyKeyValues(state, parsed) {
    const s = JSON.parse(JSON.stringify(state)); s.mgmt = s.mgmt || Sim.state.emptyMgmt();
    Object.keys(parsed.values).forEach(p => setDeep(s.mgmt, p, parsed.values[p]));
    const prevKeys = Object.keys(parsed.prev);
    if (prevKeys.length) { if (!s.mgmt.prev) s.mgmt.prev = Sim.state.normalizeMgmt({}, false); prevKeys.forEach(p => setDeep(s.mgmt.prev, p, parsed.prev[p])); }
    s.mgmt = Sim.state.normalizeMgmt(s.mgmt, true);
    return { state: s, count: Object.keys(parsed.values).length, prevCount: prevKeys.length };
  }
  Sim.paste = { HEADERS, toNum, mapHeaders, parse, apply, KV_LABELS, AMOUNT_KEYS, parseKeyValues, applyKeyValues };
})();
