const S = Sim.state;
test('createSample: version2・カテゴリ2件・シナリオ3本・旧値が後日追加に入る', () => {
  const s = S.createSample();
  eq(s.version, 2); eq(s.categories.length, 2); eq(s.plan.scenarios.length, 3); eq(s.plan.activeScenario, 1);
  eq(s.categories[0].name, '枕（フィッティング）'); eq(s.categories[0].entryPrice, 12000); eq(s.categories[0].newCustomers, 40);
  eq(s.categories[0].later, [{rate:35,aov:15000},{rate:55,aov:26000},{rate:68,aov:34000}]);
  eq(s.categories[0].sameDay, {rate:0, aov:0}); eq(s.store.cogsRate, 50); eq(s.store.period, 3);
});
test('migrateV1: ret/aov→later、同日は0、原価率・固定費を引き継ぐ', () => {
  const s = S.migrateV1([{name:'A', front:1000, new1:5, aov:[10,20,30], ret:[1,2,3]}], {cogs:40, fixed:1000});
  eq(s.categories[0].later, [{rate:1,aov:10},{rate:2,aov:20},{rate:3,aov:30}]);
  eq(s.categories[0].sameDay, {rate:0,aov:0}); eq(s.store.cogsRate, 40); eq(s.store.fixedCostMonthly, 1000);
  ok(s.plan.scenarios[0].levers[s.categories[0].id], 'シナリオにレバーが生えている');
});
test('serialize/parse 往復で内容が保たれる（updatedAt以外）', () => {
  const s = S.createSample(); const p = S.parse(S.serialize(s));
  p.meta.updatedAt = s.meta.updatedAt; eq(p, s);
});
test('normalize: 未来バージョンは拒否', () => { throws(() => S.normalize({version: 3})); });
test('normalize: 欠損を補い、不正な period は 3', () => {
  const s = S.normalize({version:2, store:{period:9}, categories:[{name:'X'}]});
  eq(s.store.period, 3); eq(s.categories[0].later.length, 3); eq(s.categories[0].later[2], {rate:0,aov:0});
  eq(s.plan.scenarios.length, 1); eq(s.benchmarks.laterRate, [null,null,null]); ok(s.categories[0].id);
});
test('normalize: 余分な項目があっても落ちず、既知の項目だけ残る', () => {
  const s = S.normalize({version:2, foo:1, store:{name:'店', bar:2}, categories:[{name:'X', junk:true}]});
  eq(s.foo, undefined); eq(s.store.bar, undefined); eq(s.categories[0].junk, undefined); eq(s.store.name, '店');
});
test('parse: 壊れたJSONは invalid json', () => { throws(() => S.parse('{oops')); });
test('save/load: 保存して読める・storageが壊れていれば null/false', () => {
  const mem = {}; const storage = { setItem:(k,v)=>{mem[k]=v;}, getItem:(k)=>mem[k] ?? null };
  const s = S.createSample(); ok(S.save(s, storage)); ok(mem['storeSim:v2']);
  eq(S.load(storage).categories.length, 2);
  const broken = { setItem:()=>{throw new Error('x')}, getItem:()=>{throw new Error('x')} };
  eq(S.save(s, broken), false); eq(S.load(broken), null);
  eq(S.load({ getItem:()=>'{bad' }), null);
});
test('exportFilename: 店名_日付.json（記号は置換・ローカル日付）', () => {
  const s = S.createEmpty(); s.store.name = 'A/B店';
  eq(S.exportFilename(s, new Date(2026, 8, 23)), 'A_B店_20260923.json');
  eq(S.exportFilename(S.createEmpty(), new Date(2026, 8, 23)), 'store_20260923.json');
});
test('syncScenarios: カテゴリ追加でレバーが生え、削除で消える', () => {
  const s = S.createSample(); const c = S.newCategory({name:'新'}); s.categories.push(c); S.syncScenarios(s);
  ok(s.plan.scenarios.every(sc => sc.levers[c.id]), '追加分のレバー');
  const removed = s.categories.shift().id; S.syncScenarios(s);
  ok(s.plan.scenarios.every(sc => !sc.levers[removed]), '削除分のレバーが消えている');
});
test('normalize: シナリオのレバーに不正値があっても数値に補正される', () => {
  const s = S.normalize({version:2, categories:[{id:'c1', name:'X'}], plan:{scenarios:[{name:'S', levers:{c1:{newPct:'abc'}}}]}});
  eq(s.plan.scenarios[0].levers.c1.newPct, 0);
});
test('emptyPrev: 全項目 null', () => {
  const p = S.emptyPrev(); eq(p.entryPrice, null); eq(p.later[2], {rate:null, aov:null}); eq(p.sameDay, {rate:null, aov:null});
});
test('normalize: シナリオの打ち手はlibIdを保持する', () => {
  const s = S.normalize({version:2, categories:[{id:'c1', name:'X'}], plan:{scenarios:[{name:'S', tactics:[{lever:'later', libId:'later-0', text:'x', fromLibrary:true}]}]}});
  eq(s.plan.scenarios[0].tactics[0].libId, 'later-0');
});
