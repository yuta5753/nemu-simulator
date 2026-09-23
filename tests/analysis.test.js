const A = Sim.analysis;
const sample = () => Sim.state.createSample();
test('portfolio: 2件は平均が境界。枕=主力、敷きもの=見直す', () => {
  const pf = A.portfolio(sample(), 3);
  ok(pf.available); approx(pf.xBoundary, 420000, 0.01); approx(pf.yBoundary, 16660, 0.01);
  eq(pf.points[0].quadrant, 'core'); eq(pf.points[0].label, '主力（伸ばす）'); eq(pf.points[1].quadrant, 'review');
  approx(pf.points[0].x, 480000, 0.01); approx(pf.points[0].y, 23120, 0.01);
});
test('portfolio: 3件は中央値が境界、母数10未満は判定保留', () => {
  const s = sample(); s.categories.push(Sim.state.newCategory({name:'小', entryPrice:20000, newCustomers:5, later:[{rate:0,aov:0},{rate:0,aov:0},{rate:90,aov:50000}]}));
  const pf = A.portfolio(s, 3); eq(pf.points[2].pending, true); eq(pf.points[2].quadrant, null); eq(pf.points[2].label, '判定保留');
  approx(pf.xBoundary, 420000, 0.01, '母数10未満を除いた2件の平均');
});
test('portfolio: 1件以下は available=false', () => {
  const s = sample(); s.categories = [s.categories[0]]; eq(A.portfolio(s, 3).available, false);
  s.categories = []; eq(A.portfolio(s, 3).available, false);
});
test('leverage: 枕は新規+10%が最も効く（+140,480）', () => {
  const lv = A.leverage(sample(), 3); const c = lv.perCategory[0];
  eq(c.top.lever, 'newPct'); approx(c.top.delta, 140480, 0.01);
  const d = Object.fromEntries(c.ranked.map(r => [r.lever, r.delta]));
  approx(d.laterPt, 68000, 0.01); approx(d.aovPct, 92480, 0.01); approx(d.entryPricePct, 24000, 0.01); approx(d.sameDayPt, 0, 0.01);
  eq(lv.store.top.lever, 'newPct'); approx(lv.store.top.delta, 237680, 0.01);
});
test('leverage: 売上0なら top は null', () => {
  const s = sample(); s.categories.forEach(c => { c.newCustomers = 0; }); eq(A.leverage(s, 3).store.top, null);
});
test('weakness: 目安値があれば benchmark モード、比率が最も低い項目が worst', () => {
  const s = sample(); s.benchmarks.laterRate[2] = 80; const w = A.weakness(s, 3);
  eq(w.mode, 'benchmark'); eq(w.worst.name, '枕（フィッティング）'); eq(w.worst.metric, '後日追加率'); approx(w.worst.ratio, 0.85, 0.001); eq(w.hint, null);
});
test('weakness: 日数は短いほど良い（比率は目安÷実績）', () => {
  const s = sample(); s.benchmarks.daysToAddon = 30; const w = A.weakness(s, 3);
  const item = w.items.find(i => i.metric === '初回→追加購入日数' && i.name === '敷きもの・カバー類'); approx(item.ratio, 30/90, 0.001);
});
test('weakness: 前期があれば prev モード', () => {
  const s = sample(); s.categories[0].prev = Sim.state.emptyPrev(); s.categories[0].prev.newCustomers = 50; s.categories[0].prev.later[2].rate = 70;
  const w = A.weakness(s, 3); eq(w.mode, 'prev'); eq(w.worst.metric, '新規獲得人数'); approx(w.worst.ratio, 0.8, 0.001);
});
test('weakness: どちらも無ければ relative モードで店平均より低い率を列挙し hint を出す', () => {
  const w = A.weakness(sample(), 3); eq(w.mode, 'relative'); ok(w.hint);
  eq(w.items.length, 1); eq(w.items[0].name, '枕（フィッティング）'); approx(w.items[0].reference, 78.2, 0.01);
});
test('timing: 3つの接触目安と期間超えの警告', () => {
  const t = A.timing(sample(), 3); eq(t.length, 2); eq(t[0].days, 45); eq(t[0].touchpoints.map(p => p.day), [0, 23, 45]); eq(t[0].warning, null);
  const s = sample(); s.categories[0].daysToAddon = 400; const t1 = A.timing(s, 1); ok(t1[0].warning);
  s.categories[1].daysToAddon = null; eq(A.timing(s, 1).length, 1);
});
test('checks: 累計の順序と母数不足', () => {
  const s = sample(); s.categories[0].later[1].rate = 30; s.categories[1].newCustomers = 5; const w = A.checks(s);
  eq(w.map(x => x.code), ['later_rate_order', 'small_base']);
});
test('comments: 文章が出る・カテゴリ名を含む・空なら案内文', () => {
  const cm = A.comments(sample(), 3); ok(cm.length >= 4); ok(cm.some(c => c.includes('枕（フィッティング）') && c.includes('主力')));
  ok(cm.some(c => c.includes('目安値か前期')));
  const e = A.comments(Sim.state.createEmpty(), 3); eq(e, ['間口カテゴリを入力すると診断コメントが出ます。']);
});
