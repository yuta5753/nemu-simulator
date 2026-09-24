window.Sim = window.Sim || {};
(function () {
  const MIN_BASE = 10;
  const LEVER_KEYS = ['newPct', 'sameDayPt', 'laterPt', 'aovPct', 'entryPricePct'];
  const LEVER_LABELS = { newPct: '新規獲得人数', sameDayPt: '同日追加率', laterPt: '後日追加率', aovPct: '追加単価', entryPricePct: '間口単価' };
  const QUADRANT_LABELS = { core: '主力（伸ばす）', entryOnly: '入口止まり（育てる）', hidden: '隠れた優良間口（集客を寄せる）', review: '見直す' };
  const median = arr => { const a = arr.slice().sort((x, y) => x - y); const n = a.length; if (!n) return 0; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  const yen = n => Sim.ui.util.yen(n);

  function portfolio(state, period) {
    const cats = Sim.calc.store(state, period).categories;
    if (cats.length < 2) return { available: false, reason: cats.length ? '間口カテゴリが1件のため象限図は出しません（一覧をご覧ください）' : '間口カテゴリがありません', points: [] };
    const nonPending = cats.filter(c => c.newN >= MIN_BASE);
    const basis = nonPending.length >= 2 ? nonPending : cats;
    const xs = basis.map(c => c.entryRevenue), ys = basis.map(c => c.addonPerCustomer);
    const xBoundary = basis.length === 2 ? (xs[0] + xs[1]) / 2 : median(xs);
    const yBoundary = basis.length === 2 ? (ys[0] + ys[1]) / 2 : median(ys);
    const points = cats.map(c => {
      const pending = c.newN < MIN_BASE; const hiX = c.entryRevenue >= xBoundary, hiY = c.addonPerCustomer >= yBoundary;
      const q = hiX && hiY ? 'core' : hiX ? 'entryOnly' : hiY ? 'hidden' : 'review';
      return { id: c.id, name: c.name, x: c.entryRevenue, y: c.addonPerCustomer, share: c.share, newN: c.newN, pending,
        quadrant: pending ? null : q, label: pending ? '判定保留' : QUADRANT_LABELS[q] };
    });
    return { available: true, xBoundary, yBoundary, points };
  }
  function leverage(state, period) {
    const D = Sim.calc.STANDARD_DELTAS; const base = Sim.calc.store(state, period);
    const perCategory = state.categories.map((c, idx) => {
      const b = base.categories[idx].revenue;
      const ranked = LEVER_KEYS.map(k => { const lv = {}; lv[k] = D[k]; return { lever: k, label: LEVER_LABELS[k], delta: Sim.calc.category(c, period, lv).revenue - b }; })
        .sort((a, b2) => b2.delta - a.delta);
      return { id: c.id, name: c.name, pending: base.categories[idx].newN < MIN_BASE, ranked, top: ranked[0] && ranked[0].delta > 0 ? ranked[0] : null };
    });
    const storeRanked = LEVER_KEYS.map(k => {
      const lv = {}; state.categories.forEach(c => { lv[c.id] = {}; lv[c.id][k] = D[k]; });
      return { lever: k, label: LEVER_LABELS[k], delta: Sim.calc.store(state, period, lv).revenue - base.revenue };
    }).sort((a, b) => b.delta - a.delta);
    return { perCategory, store: { ranked: storeRanked, top: storeRanked[0] && storeRanked[0].delta > 0 ? storeRanked[0] : null } };
  }
  function weakness(state, period) {
    const i = period - 1; const b = state.benchmarks; const items = [];
    const hasBench = b.sameDayRate > 0 || b.laterRate[i] > 0 || b.laterAov[i] > 0 || b.daysToAddon > 0;
    const hasPrev = state.categories.some(c => c.prev);
    const mode = hasBench ? 'benchmark' : hasPrev ? 'prev' : 'relative';
    const item = (c, metric, unit, actual, reference, lowerIsBetter) =>
      ({ id: c.id, name: c.name, metric, unit, actual, reference, ratio: lowerIsBetter ? reference / actual : actual / reference });
    const lt = c => c.later[i] || { rate: 0, aov: 0 };
    if (mode === 'benchmark') {
      state.categories.forEach(c => {
        if (b.laterRate[i] > 0) items.push(item(c, '後日追加率', '%', lt(c).rate, b.laterRate[i]));
        if (b.laterAov[i] > 0) items.push(item(c, '後日追加単価', '円', lt(c).aov, b.laterAov[i]));
        if (b.sameDayRate > 0) items.push(item(c, '同日追加率', '%', c.sameDay.rate, b.sameDayRate));
        if (b.daysToAddon > 0 && c.daysToAddon > 0) items.push(item(c, '初回→追加購入日数', '日', c.daysToAddon, b.daysToAddon, true));
      });
    } else if (mode === 'prev') {
      state.categories.filter(c => c.prev).forEach(c => {
        const p = c.prev; const pl = (p.later && p.later[i]) || {};
        if (p.newCustomers > 0) items.push(item(c, '新規獲得人数', '人', c.newCustomers, p.newCustomers));
        if (p.entryPrice > 0) items.push(item(c, '間口単価', '円', c.entryPrice, p.entryPrice));
        if (pl.rate > 0) items.push(item(c, '後日追加率', '%', lt(c).rate, pl.rate));
        if (pl.aov > 0) items.push(item(c, '後日追加単価', '円', lt(c).aov, pl.aov));
        if (p.sameDay && p.sameDay.rate > 0) items.push(item(c, '同日追加率', '%', c.sameDay.rate, p.sameDay.rate));
        if (p.daysToAddon > 0 && c.daysToAddon > 0) items.push(item(c, '初回→追加購入日数', '日', c.daysToAddon, p.daysToAddon, true));
      });
    } else {
      const tot = state.categories.reduce((s, c) => s + c.newCustomers, 0);
      if (tot > 0) {
        const avgLater = state.categories.reduce((s, c) => s + c.newCustomers * lt(c).rate, 0) / tot;
        const avgSame = state.categories.reduce((s, c) => s + c.newCustomers * c.sameDay.rate, 0) / tot;
        state.categories.forEach(c => {
          if (avgLater > 0 && lt(c).rate < avgLater) items.push(item(c, '後日追加率（店平均比）', '%', lt(c).rate, avgLater));
          if (avgSame > 0 && c.sameDay.rate < avgSame) items.push(item(c, '同日追加率（店平均比）', '%', c.sameDay.rate, avgSame));
        });
      }
    }
    items.sort((a, b2) => a.ratio - b2.ratio);
    return { mode, items, worst: items[0] || null, hint: mode === 'relative' ? '目安値か前期の数字を入れると弱点判定が出ます' : null };
  }
  function timing(state, period) {
    const limit = 365 * period;
    return state.categories.filter(c => c.daysToAddon != null).map(c => {
      const d = Math.max(0, c.daysToAddon); const later = c.later[period - 1] || { rate: 0 };
      return { id: c.id, name: c.name, days: d,
        touchpoints: [{ label: '同日（接客中）', day: 0 }, { label: '中間フォロー', day: Math.round(d / 2) }, { label: '追加購入の目安', day: Math.round(d) }],
        warning: (d > limit && later.rate > 0) ? `${c.name}：平均日数（${d}日）が選択期間（${limit}日）を超えていますが後日追加率が${later.rate}%です。日数か率のどちらかが入力ミスの可能性があります` : null };
    });
  }
  function checks(state) {
    const w = [];
    state.categories.forEach(c => {
      const r = c.later.map(l => l.rate), a = c.later.map(l => l.aov);
      if (r[0] > r[1] || r[1] > r[2]) w.push({ categoryId: c.id, code: 'later_rate_order', message: `${c.name}：後日追加率は累計なので 1年≦2年≦3年 が通常です（${r.join('→')}%）。入力をご確認ください` });
      if (a[0] > a[1] || a[1] > a[2]) w.push({ categoryId: c.id, code: 'later_aov_order', message: `${c.name}：後日追加単価は累計なので 1年≦2年≦3年 が通常です。入力をご確認ください` });
      if (c.newCustomers < MIN_BASE) w.push({ categoryId: c.id, code: 'small_base', message: `${c.name}：新規獲得人数が${MIN_BASE}人未満のため、診断は判定保留になります` });
      const rateOutOfRange = c.sameDay.rate < 0 || c.sameDay.rate > 100 || r.some(v => v < 0 || v > 100);
      if (rateOutOfRange) w.push({ categoryId: c.id, code: 'out_of_range', message: `${c.name}：追加率は0〜100%の範囲で入力します（計算は上限・下限で丸めています）` });
      const negative = c.entryPrice < 0 || c.newCustomers < 0 || c.sameDay.aov < 0 || a.some(v => v < 0) || (c.daysToAddon != null && c.daysToAddon < 0);
      if (negative) w.push({ categoryId: c.id, code: 'out_of_range', message: `${c.name}：金額・人数・日数は0以上で入力します（計算は0として扱っています）` });
    });
    return w;
  }
  function comments(state, period) {
    if (!state.categories.length) return ['間口カテゴリを入力すると診断コメントが出ます。'];
    const out = []; const pf = portfolio(state, period); const lv = leverage(state, period); const wk = weakness(state, period); const tm = timing(state, period);
    if (pf.available) pf.points.forEach(p => {
      out.push(p.pending ? `${p.name}は新規獲得人数が${MIN_BASE}人未満のため、位置づけの判定は保留です。人数が増えてから判断してください。`
        : `${p.name}は「${p.label}」の位置です（間口売上${yen(p.x)}・新規1人あたりの追加額${yen(p.y)}）。`);
    });
    if (lv.store.top) out.push(`店全体では「${lv.store.top.label}」を動かすと売上が最も伸びる可能性があります（標準幅で${yen(lv.store.top.delta)}増の試算）。`);
    lv.perCategory.filter(c => c.top && !c.pending).forEach(c => out.push(`${c.name}は「${c.top.label}」が最も効きます（${yen(c.top.delta)}増の試算）。`));
    if (wk.worst) out.push(`弱点候補は${wk.worst.name}の${wk.worst.metric}です（実績${wk.worst.actual}${wk.worst.unit}／比較先${Math.round(wk.worst.reference * 10) / 10}${wk.worst.unit}）。ここが課題になりやすい構造です。`);
    if (wk.hint) out.push(wk.hint + '。');
    tm.forEach(t => out.push(t.warning ? t.warning : `${t.name}は初回から平均${t.days}日で追加購入が起きています。${t.touchpoints[1].day}日目前後のフォローが打ち時の目安です。`));
    if (!out.length) out.push('間口カテゴリを入力すると診断コメントが出ます。');
    return out;
  }
  const pctOf = v => (v == null ? null : v / 100);
  const pct1 = v => (v == null ? '—' : (Math.round(v * 1000) / 10) + '%');
  function mgmtHealth(state) {
    const m = Sim.calc.mgmt(state); if (!m.available) return { available: false };
    const b = state.benchmarks; const p = m.prev;
    const hasBench = b.grossMarginPct != null || b.laborPct != null || b.rentPct != null || b.adsPct != null || b.repeatRate != null;
    const mode = hasBench ? 'benchmark' : (p ? 'prev' : 'none');
    const mk = (key, label, value, prev, bench) => ({ key, label, value, prev, bench,
      diffPrev: (value != null && prev != null) ? value - prev : null, diffBench: (value != null && bench != null) ? value - bench : null });
    const ratios = [
      mk('laborPct', '人件費率', m.laborPct, p && p.laborPct, pctOf(b.laborPct)),
      mk('rentPct', '家賃比率', m.rentPct, p && p.rentPct, pctOf(b.rentPct)),
      mk('adsPct', '広告費率', m.adsPct, p && p.adsPct, pctOf(b.adsPct)),
      mk('otherPct', 'その他経費率', m.otherPct, p && p.otherPct, null)
    ];
    const gross = mk('grossMarginPct', '粗利率', m.grossMarginPct, p && p.grossMarginPct, pctOf(b.grossMarginPct));
    const repeat = mk('repeatRate', 'リピート率', m.repeatRate, p && p.repeatRate, pctOf(b.repeatRate));
    const lowContribution = m.products.filter(x => x.share != null && x.contributionShare != null && x.contributionShare < x.share * 0.9).map(x => x.name);
    return { available: true, m, mode, ratios, gross, repeat, lowContribution };
  }
  function consistencyCheck(state) {
    const c = Sim.calc.consistency(state); const flags = [];
    const chk = (ratio, label) => { if (ratio == null) return; if (ratio < 0.8 || ratio > 1.2) flags.push(`${label}：②の合計が①の${Math.round(ratio * 100)}%です。間口カテゴリの分け方か新規の数え方にズレがある可能性があります`); };
    chk(c.newBuyersRatio, '新規人数'); chk(c.newRevenueRatio, '新規客売上');
    return Object.assign({}, c, { flags });
  }
  function mgmtChecks(state) {
    const m = state.mgmt || {}; const w = []; const has = v => v != null;
    if (has(m.revenue) && has(m.newRevenue) && m.newRevenue > m.revenue) w.push({ code: 'new_gt_total', message: '新規客売上が総売上を超えています。どちらかの数字をご確認ください' });
    if (has(m.buyers) && has(m.newBuyers) && m.newBuyers > m.buyers) w.push({ code: 'new_gt_total', message: '新規客数が購入客数を超えています。どちらかの数字をご確認ください' });
    const v = m.visits || {}; const vs = [v.once, v.twice, v.threePlus];
    if (vs.every(has) && has(m.activeCustomers) && vs[0] + vs[1] + vs[2] > m.activeCustomers) w.push({ code: 'visits_gt_active', message: '来店回数別の客数の合計がアクティブ顧客数を超えています。数え方をご確認ください' });
    (m.products || []).forEach(x => { if (has(x.grossMarginPct) && (x.grossMarginPct < 0 || x.grossMarginPct > 100)) w.push({ code: 'gm_range', message: `${x.name || '商品'}：粗利率は0〜100%の範囲で入力します` }); });
    const negs = []; const scan = (obj, prefix) => Object.keys(obj || {}).forEach(k => { const val = obj[k]; if (typeof val === 'number' && val < 0) negs.push(prefix + k); });
    scan({ revenue: m.revenue, buyers: m.buyers, newBuyers: m.newBuyers, newRevenue: m.newRevenue, activeCustomers: m.activeCustomers, dormant: m.dormant, inventory: m.inventory }, ''); scan(m.costs, 'costs.'); scan(m.visits, 'visits.'); scan(m.funnel, 'funnel.');
    if (negs.length) w.push({ code: 'negative', message: '経営数値の金額・人数は0以上で入力します（計算では0として扱っています）' });
    return w;
  }
  function mgmtComments(state) {
    const h = mgmtHealth(state); if (!h.available) return ['①経営数値を入れると経営の健康度が出ます。'];
    const m = h.m; const out = []; const ref = (r, unitLabel) => {
      if (h.mode === 'benchmark' && r.diffBench != null) return `（目安${pct1(r.bench)}との差${(r.diffBench >= 0 ? '+' : '')}${pct1(r.diffBench)}）`;
      if (h.mode === 'prev' && r.diffPrev != null) return `（前期${pct1(r.prev)}から${(r.diffPrev >= 0 ? '+' : '')}${pct1(r.diffPrev)}）`;
      return '';
    };
    if (m.grossMarginPct != null) out.push(`粗利率${pct1(m.grossMarginPct)}${ref(h.gross)}。営業利益は${m.operatingProfit == null ? '費用を入れると出ます' : yen(m.operatingProfit) + '（営業利益率' + pct1(m.opMarginPct) + '）'}。`);
    if (m.breakEven != null) out.push(`損益分岐点売上は${yen(m.breakEven)}で、安全余裕率は${pct1(m.safetyMargin)}です。${m.safetyMargin < 0.1 ? '余裕が薄く、売上の小さな落ち込みが赤字に直結しやすい構造です。' : ''}`);
    const worstRatio = h.ratios.filter(r => r.value != null && (r.diffBench != null || r.diffPrev != null)).sort((a, b) => ((b.diffBench != null ? b.diffBench : b.diffPrev) - (a.diffBench != null ? a.diffBench : a.diffPrev)))[0];
    if (worstRatio) out.push(`費用比率で最も上振れているのは${worstRatio.label}${pct1(worstRatio.value)}${ref(worstRatio)}です。`);
    else h.ratios.filter(r => r.value != null).forEach(r => out.push(`${r.label}は${pct1(r.value)}です。`));
    if (m.newShare != null) out.push(`売上の${pct1(1 - m.newShare)}が既存客によるものです。${m.newShare < 0.2 ? '既存客の維持が売上の土台になっています。' : '新規依存が高く、リピートの仕組みで安定させる余地があります。'}`);
    if (m.repeatRate != null) out.push(`2回以上来店した方はアクティブ顧客の${pct1(m.repeatRate)}${ref(h.repeat)}です。`);
    if (h.lowContribution.length) out.push(`${h.lowContribution.join('・')}は売上シェアに比べて粗利貢献が小さく、値付けか仕入の見直し余地がある可能性があります。`);
    const lv = Sim.calc.mgmtLeverage(state); if (lv) out.push(`営業利益に最も効くのは「${lv.top.label}」で、${yen(lv.top.delta)}の増加になる試算です。`);
    consistencyCheck(state).flags.forEach(f => out.push(f + '。'));
    return out;
  }
  Sim.analysis = { MIN_BASE, LEVER_LABELS, QUADRANT_LABELS, portfolio, leverage, weakness, timing, checks, comments, mgmtHealth, consistencyCheck, mgmtChecks, mgmtComments };
})();
