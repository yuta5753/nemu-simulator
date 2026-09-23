const C = Sim.calc;
const sample = () => Sim.state.createSample();
test('ltv: 枕3年 = 12000 + 0.68×34000 = 35120', () => {
  const s = sample(); const v = C.ltv(s.categories[0], 3);
  eq(v.entry, 12000); approx(v.laterPart, 23120, 0.01); eq(v.sameDayPart, 0); approx(v.ltv, 35120, 0.01);
});
test('ltv: 同日追加が加わる', () => {
  const c = Sim.state.newCategory({entryPrice:1000, newCustomers:10, sameDay:{rate:20, aov:500}, later:[{rate:50,aov:2000},{rate:0,aov:0},{rate:0,aov:0}]});
  approx(C.ltv(c, 1).ltv, 1000 + 100 + 1000, 0.01);
});
test('category/store: サンプル3年の売上 2,376,800・粗利 1,188,400・新規100・加重LTV 23,768', () => {
  const s = sample(); const st = C.store(s, 3);
  approx(st.categories[0].revenue, 1404800, 0.01); approx(st.categories[1].revenue, 972000, 0.01);
  approx(st.revenue, 2376800, 0.01); approx(st.grossProfit, 1188400, 0.01); eq(st.newTotal, 100);
  approx(st.weightedLtv, 23768, 0.01); eq(st.operatingProfit, null); approx(st.categories[0].share, 1404800/2376800, 1e-6);
});
test('store: 固定費があれば営業利益＝粗利−固定費×12×年', () => {
  const s = sample(); s.store.fixedCostMonthly = 10000; const st = C.store(s, 2);
  eq(st.fixedTotal, 240000); approx(st.operatingProfit, st.grossProfit - 240000, 0.01);
});
test('store: 全カテゴリ新規0でも NaN にならない', () => {
  const s = sample(); s.categories.forEach(c => c.newCustomers = 0); const st = C.store(s, 3);
  eq(st.revenue, 0); eq(st.weightedLtv, 0); eq(st.categories[0].share, 0);
});
test('store: 経路のCPAと回収倍率', () => {
  const s = sample(); s.channels = [Sim.state.newChannel({name:'広告', newCustomers:20, cost:100000}), Sim.state.newChannel({name:'紹介', newCustomers:0, cost:0})];
  const st = C.store(s, 3); eq(st.channels[0].cpa, 5000); approx(st.channels[0].payback, (23768*0.5)/5000, 0.001); eq(st.channels[1].cpa, null); eq(st.channels[1].payback, null);
});
test('levers: 新規+10%・後日率+5pt・単価+10%・間口+5%・上限クランプ', () => {
  const s = sample(); const c = s.categories[0];
  eq(C.applied(c, 3, {newPct:10}).newN, 44);
  approx(C.ltv(c, 3, {laterPt:5}).ltv, 12000 + 0.73*34000, 0.01);
  approx(C.ltv(c, 3, {aovPct:10}).ltv, 12000 + 0.68*37400, 0.01);
  approx(C.ltv(c, 3, {entryPricePct:5}).ltv, 12600 + 23120, 0.01);
  approx(C.ltv(c, 3, {laterPt:50}).ltv, 12000 + 34000, 0.01, '100%で頭打ち');
  approx(C.ltv(c, 3, {laterPt:-80}).ltv, 12000, 0.01, '0%で下限');
});
test('store: シナリオのレバーはカテゴリIDごとに効く', () => {
  const s = sample(); const lv = {}; lv[s.categories[0].id] = {newPct:10};
  approx(C.store(s, 3, lv).revenue, 2376800 + 140480, 0.01);
});
test('reverse: 目標280万（ギャップ423,200）の単独必要量', () => {
  const s = sample(); const r = C.reverse(s, 3, 2800000);
  approx(r.gap, 423200, 0.01);
  approx(r.levers.new.neededCount, 17.806, 0.01); eq(r.levers.new.from, 100); approx(r.levers.new.to, 117.806, 0.01);
  eq(r.levers.sameDay, null, '同日単価が全て0なら計算不能');
  approx(r.levers.later.neededPt, 20.346, 0.01); approx(r.levers.later.from, 78.2, 0.01); ok(r.levers.later.feasible);
  approx(r.levers.aov.neededPct, 27.54, 0.01); approx(r.levers.entryPrice.neededPct, 50.38, 0.01);
});
test('reverse: 届かない率は feasible=false', () => {
  const s = sample(); const r = C.reverse(s, 3, 4000000); eq(r.levers.later.feasible, false);
});
test('reverse: 目標なし/0は null、目標＜現状は負のギャップ', () => {
  const s = sample(); eq(C.reverse(s, 3, null), null); eq(C.reverse(s, 3, 0), null);
  const r = C.reverse(s, 3, 2000000); ok(r.gap < 0); ok(r.levers.new.neededCount < 0);
});
test('reverse: 現状売上0なら new は null', () => {
  const s = sample(); s.categories.forEach(c => c.newCustomers = 0); const r = C.reverse(s, 3, 100);
  eq(r.levers.new, null); eq(r.levers.later, null);
});
test('reachRate: 目標に対する到達率', () => {
  const s = sample(); s.plan.targetRevenue[2] = 2376800; approx(C.reachRate(s, 3, s.plan.scenarios[1]), 100, 0.01);
  s.plan.targetRevenue[2] = null; eq(C.reachRate(s, 3, s.plan.scenarios[1]), null);
});
test('evenSplit: 計算できるレバーで等分', () => {
  const s = sample(); const lv = C.evenSplit(s, 3, 2800000); const l = lv[s.categories[0].id];
  approx(l.newPct, 17.806/4, 0.01); eq(l.sameDayPt, 0); approx(l.laterPt, 20.346/4, 0.01); approx(l.aovPct, 27.54/4, 0.01); approx(l.entryPricePct, 50.38/4, 0.01);
  eq(C.evenSplit(s, 3, null), {});
});
test('crmTargets: 同日と後日を独立の仮定で1本に束ねる', () => {
  const s = sample(); const rows = C.crmTargets(s, 3, s.plan.scenarios[1]);
  eq(rows[0], {name:'枕（フィッティング）', period:3, entryPrice:12000, newCustomers:40, addonRate:68, addonAov:34000});
  const c = Sim.state.newCategory({name:'X', entryPrice:1000, newCustomers:10, sameDay:{rate:20, aov:500}, later:[{rate:50,aov:2000},{rate:0,aov:0},{rate:0,aov:0}]});
  s.categories = [c]; const r = C.crmTargets(s, 1)[0];
  eq(r.addonRate, 60); eq(r.addonAov, Math.round(1100/0.6));
});
