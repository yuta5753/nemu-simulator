const C = Sim.calc;
const sample = () => Sim.state.createSampleStore();
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
test('reverse: 目標280万（ギャップ423,200）の単独必要量（後日追加率は上限クランプを考慮）', () => {
  const s = sample(); const r = C.reverse(s, 3, 2800000);
  approx(r.gap, 423200, 0.01);
  approx(r.levers.new.neededCount, 17.806, 0.01); eq(r.levers.new.from, 100); approx(r.levers.new.to, 117.806, 0.01);
  eq(r.levers.sameDay, null, '同日単価が全て0なら計算不能');
  approx(r.levers.later.neededPt, 23.176, 0.01); approx(r.levers.later.from, 78.2, 0.01); approx(r.levers.later.to, 96.47, 0.01); ok(r.levers.later.feasible);
  approx(r.levers.aov.neededPct, 27.54, 0.01); approx(r.levers.entryPrice.neededPct, 50.38, 0.01);
  const lv = {}; s.categories.forEach(c => { lv[c.id] = { laterPt: r.levers.later.neededPt }; });
  approx(C.store(s, 3, lv).revenue, 2800000, 1);
});
test('reverse: 届かない率は feasible=false（上限クランプで到達不能）', () => {
  const s = sample(); const r = C.reverse(s, 3, 4000000);
  eq(r.levers.later.feasible, false); ok(r.levers.later.to <= 100);
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
  approx(l.newPct, 17.806/4, 0.01); eq(l.sameDayPt, 0); approx(l.laterPt, 23.176/4, 0.01); approx(l.aovPct, 27.54/4, 0.01); approx(l.entryPricePct, 50.38/4, 0.01);
  eq(C.evenSplit(s, 3, null), {});
});
test('crmTargets: 同日と後日を独立の仮定で1本に束ねる', () => {
  const s = sample(); const rows = C.crmTargets(s, 3, s.plan.scenarios[1]);
  eq(rows[0], {name:'枕（フィッティング）', period:3, entryPrice:12000, newCustomers:40, addonRate:68, addonAov:34000});
  const c = Sim.state.newCategory({name:'X', entryPrice:1000, newCustomers:10, sameDay:{rate:20, aov:500}, later:[{rate:50,aov:2000},{rate:0,aov:0},{rate:0,aov:0}]});
  s.categories = [c]; const r = C.crmTargets(s, 1)[0];
  eq(r.addonRate, 60); eq(r.addonAov, Math.round(1100/0.6));
});
test('mgmt: サンプルの派生値', () => {
  const m = C.mgmt(sample());
  ok(m.available); eq(m.existingRevenue, 47100000); approx(m.aov, 68571.43, 0.01); approx(m.newShare, 0.01875, 1e-6);
  eq(m.visitsTotal, 900); approx(m.repeatRate, 400 / 900, 1e-6); approx(m.visitFrequency, 700 / 900, 1e-6);
  eq(m.grossProfit, 24000000); eq(m.grossMarginPct, 0.5); eq(m.laborPct, 0.2); eq(m.rentPct, 0.075); eq(m.adsPct, 0.0375); eq(m.otherPct, 0.0875);
  eq(m.fixedCosts, 19200000); eq(m.operatingProfit, 4800000); eq(m.opMarginPct, 0.1); eq(m.breakEven, 38400000); eq(m.safetyMargin, 0.2); eq(m.inventoryTurnMonths, 3);
  approx(m.products[0].share, 5 / 48, 1e-6); eq(m.products[0].contribution, 2750000); approx(m.products[0].contributionShare, 2750000 / 21650000, 1e-6);
  eq(m.funnel.visitRate, 0.8); eq(m.funnel.dealRate, 0.75); eq(m.replacement[0].expectedBuyers, 40); eq(m.prev, null); eq(m.channels.length, 3);
});
test('mgmt: 部分入力は計算できるものだけ・未入力は null', () => {
  const s = Sim.state.createEmptyStore(); s.mgmt.revenue = 10000000; const m = C.mgmt(s);
  ok(m.available); eq(m.aov, null); eq(m.grossProfit, null); eq(m.breakEven, null); eq(m.repeatRate, null); eq(m.products, []); eq(m.inventoryTurnMonths, null);
  eq(C.mgmt(Sim.state.createEmptyStore()).available, false);
});
test('mgmt: 粗利率が0以下なら損益分岐点・必要売上は null', () => {
  const s = sample(); s.mgmt.costs.cogs = 50000000; s.plan.requiredProfit = 1000000; const m = C.mgmt(s);
  ok(m.grossMarginPct < 0); eq(m.breakEven, null); eq(C.requiredRevenue(s), null);
});
test('mgmt: 前期があれば prev に同じ派生値', () => {
  const s = sample(); s.mgmt.prev = Sim.state.normalizeMgmt({ revenue: 40000000, costs: { cogs: 21000000, labor: 9000000, rent: 3600000, ads: 1500000, other: 4000000 } }, false);
  const m = C.mgmt(s); eq(m.prev.grossMarginPct, 0.475); eq(m.prev.operatingProfit, 900000);
});
test('effectiveCogsRate: 経営数値があれば仕入原価÷総売上、無ければ手入力', () => {
  const s = sample(); eq(C.effectiveCogsRate(s), 50); s.mgmt.costs.cogs = 19200000; eq(C.effectiveCogsRate(s), 40);
  approx(C.store(s, 3).grossProfit, 2376800 * 0.6, 0.01, 'store() も追随');
  s.mgmt.revenue = null; eq(C.effectiveCogsRate(s), 50);
});
test('effectiveCogsRate: 仕入原価が総売上を上回ると100%を超える（現状の仕様として記録）', () => {
  const s = sample(); s.mgmt.costs.cogs = 60000000; eq(C.effectiveCogsRate(s), 125);
});
test('mgmt: 負の入力は0として扱われる（fixedCosts・laborPctがクランプされる）', () => {
  const s = sample(); s.mgmt.costs.labor = -1000000; const m = C.mgmt(s);
  eq(m.fixedCosts, 19200000 - 9600000); eq(m.laborPct, 0);
});
test('consistency: ②の新規合計と初回来店売上を①と比べる', () => {
  const c = C.consistency(sample()); eq(c.entryNewTotal, 100); eq(c.entryNewRevenue, 840000); eq(c.newBuyersRatio, 1); approx(c.newRevenueRatio, 0.9333, 0.001);
  const s = sample(); s.mgmt.newBuyers = null; eq(C.consistency(s).newBuyersRatio, null);
});
test('mgmtLeverage: 営業利益への4本のインパクト', () => {
  const lv = C.mgmtLeverage(sample()); eq(lv.base, 4800000);
  const d = Object.fromEntries(lv.items.map(i => [i.key, i.delta])); eq(d.revenue, 2400000); eq(d.gm, 480000); eq(d.labor, 480000); eq(d.ads, 180000); eq(lv.top.key, 'revenue');
  eq(C.mgmtLeverage(Sim.state.createEmptyStore()), null);
});
test('requiredRevenue: 必要利益→必要売上→間口の目標', () => {
  const s = sample(); s.plan.requiredProfit = 6000000; const r = C.requiredRevenue(s);
  eq(r.required, 50400000); eq(r.gap, 2400000); eq(r.existingForecast, 47100000); eq(r.newTarget, 3300000);
  s.plan.existingGrowthPct = 10; eq(C.requiredRevenue(s).newTarget, 0, '既存で足りれば0（負にしない）');
  s.plan.requiredProfit = null; eq(C.requiredRevenue(s), null);
});
test('companyMgmt: サンプル2店舗の合算（足し算・率の再計算・本部費）', () => {
  const c = Sim.state.createSample(); const r = C.companyMgmt(c); const m = r.m;
  ok(r.available); eq(m.revenue, 76800000); eq(m.buyers, 1120); eq(m.newBuyers, 160); eq(m.cogs, 38400000);
  approx(m.grossMarginPct, 0.5, 1e-9); eq(m.fixedCosts, 31400000); eq(m.operatingProfit, 7000000);
  approx(m.itemsPerBuyer, 1.5625, 1e-9); eq(m.visitsTotal, 1440); approx(m.repeatRate, 640 / 1440, 1e-9); eq(m.funnel.reservations, 480);
  eq(r.hq.total, 4800000); eq(r.hq.ads, null); eq(r.operatingProfitAfterHq, 2200000); eq(r.fixedCostsWithHq, 36200000);
  approx(r.breakEvenWithHq, 72400000, 0.01); approx(r.safetyMarginWithHq, (76800000 - 72400000) / 76800000, 1e-9);
  eq(r.coverage.revenue, { n: 2, total: 2 }); eq(r.coverage['costs.labor'], { n: 2, total: 2 }); eq(r.coverage.visits, { n: 2, total: 2 }); eq(m.prev, null); eq(r.storeCount, 2);
});
test('companyMgmt: 名寄せ（商品・買替・経路）', () => {
  const r = C.companyMgmt(Sim.state.createSample()); const m = r.m;
  eq(m.products.length, 4); const p = m.products.find(x => x.name === '枕（フィッティング）'); eq(p.sales, 8000000); approx(p.grossMarginPct, 55, 1e-9); approx(p.share, 8000000 / 76800000, 1e-9);
  const mat = m.replacement.find(x => x.name === 'マットレス'); eq(mat.pastBuyers, 510); approx(mat.cycleYears, 8, 1e-9); approx(mat.expectedBuyers, 510 / 8, 1e-9);
  eq(m.channels.length, 3); const g = m.channels.find(x => x.name === 'Google広告'); eq(g.newCustomers, 64); eq(g.cost, 1500000); approx(g.cpa, 1500000 / 64, 1e-6); ok(g.payback > 0);
});
test('companyMgmt: 空欄の店舗は合算から除外しカバレッジに出る。率は歪まない', () => {
  const c = Sim.state.createSample(); c.stores[1].mgmt.costs.labor = null; c.stores[1].mgmt.revenue = null;
  const r = C.companyMgmt(c); eq(r.m.revenue, 48000000); eq(r.coverage.revenue, { n: 1, total: 2 }); eq(r.m.costs.labor, 9600000); eq(r.coverage['costs.labor'], { n: 1, total: 2 });
  approx(r.m.grossMarginPct, (48000000 - 38400000) / 48000000, 1e-9);
});
test('companyMgmt: 全店空欄なら available=false、本部費 null なら本部費前の値', () => {
  const c = Sim.state.createEmpty(); Sim.state.addStore(c); const r = C.companyMgmt(c); eq(r.available, false); eq(r.hq.total, null); eq(r.operatingProfitAfterHq, null); eq(r.m.products, []);
  const d = Sim.state.createSample(); d.company.hq = { labor: null, rent: null, ads: null, other: null }; const r2 = C.companyMgmt(d);
  eq(r2.hq.total, null); eq(r2.operatingProfitAfterHq, 7000000); eq(r2.fixedCostsWithHq, 31400000); approx(r2.breakEvenWithHq, 62800000, 0.01);
});
test('companyMgmt: 本部費の負値は0扱い、前期は値のある店舗だけで合算', () => {
  const c = Sim.state.createSample(); c.company.hq.labor = -100; eq(C.companyMgmt(c).hq.labor, 0); eq(C.companyMgmt(c).hq.total, 1800000);
  c.stores[0].mgmt.prev = Sim.state.normalizeMgmt({ revenue: 40000000, costs: { cogs: 21000000 } }, false);
  const r = C.companyMgmt(c); eq(r.m.prev.revenue, 40000000); approx(r.m.prev.grossMarginPct, 19 / 40, 1e-9);
});
test('companyRequired: 本部費込みの必要売上。条件不足なら null', () => {
  const c = Sim.state.createSample(); eq(C.companyRequired(c), null);
  c.company.plan.requiredProfit = 10000000; const r = C.companyRequired(c);
  approx(r.required, 92400000, 0.01); eq(r.current, 76800000); approx(r.gap, 15600000, 0.01); approx(r.existingForecast, 75360000, 0.01); approx(r.newTarget, 17040000, 0.01);
  eq(r.fixedCosts, 36200000); eq(r.hqTotal, 4800000); approx(r.grossMarginPct, 0.5, 1e-9);
  c.company.plan.existingGrowthPct = 10; approx(C.companyRequired(c).newTarget, Math.max(0, 92400000 - 75360000 * 1.1), 0.01);
});
test('storeComparison: 順位マーク（向き・同値・null）と全社列', () => {
  const c = Sim.state.createSample(); const r = C.storeComparison(c, 3); const get = k => r.metrics.find(m => m.key === k);
  eq(r.stores.map(s => s.name), ['本店', '2号店']);
  eq(get('revenue').values.map(v => v.mark), ['◎', '△']); eq(get('laborPct').values.map(v => v.mark), ['◎', '△'], '低いほど良い');
  eq(get('grossMarginPct').values.map(v => v.mark), ['◎', '◎'], '同値は同じマーク'); eq(get('target').values.map(v => v.mark), [null, null], '計画値はマークなし');
  eq(get('newTotal').values.map(v => v.value), [100, 60]); eq(get('newTotal').company, 160); approx(get('cohortRevenue').company, 3802880, 0.01); approx(get('weightedLtv').company, 23768, 0.01);
  eq(get('categoryCount').company, 4); eq(get('revenue').company, 76800000); eq(get('grossMarginPct').bench, null); eq(get('operatingProfit').company, 7000000);
  c.stores[0].benchmarks.laborPct = 18; approx(C.storeComparison(c, 3).metrics.find(m => m.key === 'laborPct').bench, 0.18, 1e-9);
  Sim.state.addStore(c); const r3 = C.storeComparison(c, 3); const v = r3.metrics.find(m => m.key === 'revenue').values;
  eq(v[2].value, null); eq(v[2].mark, null); eq(v.map(x => x.mark), ['◎', '△', null]);
  eq(r3.metrics.find(m => m.key === 'opMarginPct').values.map(x => x.mark), ['◎', '△', null]); eq(r3.metrics.find(m => m.key === 'weightedLtv').values[2].value, null);
});
