const S = Sim.state;
test('createSample: version3・カテゴリ2件・シナリオ3本・旧値が後日追加に入る', () => {
  const s = S.createSampleStore();
  eq(s.version, 3); eq(s.categories.length, 2); eq(s.plan.scenarios.length, 3); eq(s.plan.activeScenario, 1);
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
  const s = S.createSampleStore(); const p = S.parseStore(S.serializeStore(s));
  p.meta.updatedAt = s.meta.updatedAt; eq(p, s);
});
test('normalize: 未来バージョンは拒否', () => { throws(() => S.normalizeStore({version: 5})); });
test('normalize: 欠損を補い、不正な period は 3', () => {
  const s = S.normalizeStore({version:2, store:{period:9}, categories:[{name:'X'}]});
  eq(s.store.period, 3); eq(s.categories[0].later.length, 3); eq(s.categories[0].later[2], {rate:0,aov:0});
  eq(s.plan.scenarios.length, 1); eq(s.benchmarks.laterRate, [null,null,null]); ok(s.categories[0].id);
});
test('normalize: 余分な項目があっても落ちず、既知の項目だけ残る', () => {
  const s = S.normalizeStore({version:2, foo:1, store:{name:'店', bar:2}, categories:[{name:'X', junk:true}]});
  eq(s.foo, undefined); eq(s.store.bar, undefined); eq(s.categories[0].junk, undefined); eq(s.store.name, '店');
});
test('parse: 壊れたJSONは invalid json', () => { throws(() => S.parse('{oops')); });
test('save/load: 保存して読める・storageが壊れていれば null/false', () => {
  const mem = {}; const storage = { setItem:(k,v)=>{mem[k]=v;}, getItem:(k)=>mem[k] ?? null };
  const s = S.createSampleStore(); ok(S.save(s, storage)); ok(mem['storeSim:v2']);
  eq(S.load(storage).stores[0].categories.length, 2);
  const broken = { setItem:()=>{throw new Error('x')}, getItem:()=>{throw new Error('x')} };
  eq(S.save(s, broken), false); eq(S.load(broken), null);
  eq(S.load({ getItem:()=>'{bad' }), null);
});
test('exportFilename: 店名_日付.json（記号は置換・ローカル日付）', () => {
  const s = S.createEmptyStore(); s.store.name = 'A/B店';
  eq(S.exportStoreFilename(s, new Date(2026, 8, 23)), 'A_B店_20260923.json');
  eq(S.exportStoreFilename(S.createEmptyStore(), new Date(2026, 8, 23)), 'store_20260923.json');
});
test('syncScenarios: カテゴリ追加でレバーが生え、削除で消える', () => {
  const s = S.createSampleStore(); const c = S.newCategory({name:'新'}); s.categories.push(c); S.syncScenarios(s);
  ok(s.plan.scenarios.every(sc => sc.levers[c.id]), '追加分のレバー');
  const removed = s.categories.shift().id; S.syncScenarios(s);
  ok(s.plan.scenarios.every(sc => !sc.levers[removed]), '削除分のレバーが消えている');
});
test('normalize: シナリオのレバーに不正値があっても数値に補正される', () => {
  const s = S.normalizeStore({version:2, categories:[{id:'c1', name:'X'}], plan:{scenarios:[{name:'S', levers:{c1:{newPct:'abc'}}}]}});
  eq(s.plan.scenarios[0].levers.c1.newPct, 0);
});
test('emptyPrev: 全項目 null', () => {
  const p = S.emptyPrev(); eq(p.entryPrice, null); eq(p.later[2], {rate:null, aov:null}); eq(p.sameDay, {rate:null, aov:null});
});
test('normalize: シナリオの打ち手はlibIdを保持する', () => {
  const s = S.normalizeStore({version:2, categories:[{id:'c1', name:'X'}], plan:{scenarios:[{name:'S', tactics:[{lever:'later', libId:'later-0', text:'x', fromLibrary:true}]}]}});
  eq(s.plan.scenarios[0].tactics[0].libId, 'later-0');
});
test('normalize: 不正なidは無害化される', () => {
  const s = S.normalizeStore({version:2, categories:[{id:'" onfocus=alert(1) x="', name:'A'}], channels:[{id:'a b'}]});
  ok(/^[A-Za-z0-9_-]+$/.test(s.categories[0].id), 'カテゴリidが無害化されている'); eq(s.channels[0].id, 'ab');
});
test('normalize: id重複は別idに振り直され、両方がレバーに残る', () => {
  const s = S.normalizeStore({version:2, categories:[{id:'c1', name:'A'}, {id:'c1', name:'B'}]});
  ok(s.categories[0].id !== s.categories[1].id, '重複idは別idになる');
  ok(s.plan.scenarios[0].levers[s.categories[0].id], '1件目のレバーがある');
  ok(s.plan.scenarios[0].levers[s.categories[1].id], '2件目のレバーがある');
});
test('normalize: activeScenarioは四捨五入して範囲内に丸める', () => {
  const s1 = S.normalizeStore({version:2, plan:{activeScenario:0.5, scenarios:[{name:'a'},{name:'b'}]}});
  eq(s1.plan.activeScenario, 1);
  const s2 = S.normalizeStore({version:2, plan:{activeScenario:7, scenarios:[{name:'a'},{name:'b'}]}});
  eq(s2.plan.activeScenario, 1);
});
test('v3: emptyMgmt の形と createEmpty の既定値', () => {
  const m = S.emptyMgmt();
  eq(m.revenue, null); eq(m.visits, { once: null, twice: null, threePlus: null }); eq(m.costs, { cogs: null, labor: null, rent: null, ads: null, other: null });
  eq(m.funnel, { reservations: null, visits: null, deals: null }); eq(m.products, []); eq(m.replacement, []); eq(m.prev, null);
  const s = S.createEmptyStore(); eq(s.version, 3); eq(s.mgmt.revenue, null); eq(s.plan.requiredProfit, null); eq(s.plan.existingGrowthPct, 0);
  eq(s.benchmarks.grossMarginPct, null); eq(s.benchmarks.repeatRate, null);
});
test('v3: v2 の保存データ（mgmt なし・version 2）を読める', () => {
  const s = S.normalizeStore({ version: 2, store: { name: '旧' }, categories: [{ name: 'A' }], plan: { scenarios: [{ name: 'x' }] } });
  eq(s.version, 3); eq(s.store.name, '旧'); eq(s.mgmt.revenue, null); eq(s.mgmt.products, []); eq(s.plan.existingGrowthPct, 0);
});
test('v3: normalizeMgmt は数値化・id 無害化・prev の入れ子を1段だけ', () => {
  const m = S.normalizeMgmt({ revenue: '48000000', buyers: 'abc', visits: { once: 500 }, products: [{ id: 'a b', name: '枕', sales: 5000000, grossMarginPct: '55' }],
    replacement: [{ id: '"x', name: 'マットレス', cycleYears: 8, pastBuyers: 320 }], prev: { revenue: 40000000, prev: { revenue: 1 } } }, true);
  eq(m.revenue, 48000000); eq(m.buyers, null); eq(m.visits, { once: 500, twice: null, threePlus: null });
  eq(m.products[0].id, 'ab'); eq(m.products[0].grossMarginPct, 55); ok(/^[A-Za-z0-9_-]+$/.test(m.replacement[0].id));
  eq(m.prev.revenue, 40000000); eq(m.prev.prev, undefined);
  eq(S.normalizeMgmt({ prev: { revenue: 1 } }, false).prev, null);
});
test('v3: createSample の経営数値と serialize/parse 往復', () => {
  const s = S.createSampleStore(); const m = s.mgmt;
  eq(m.revenue, 48000000); eq(m.buyers, 700); eq(m.newBuyers, 100); eq(m.newRevenue, 900000); eq(m.costs.cogs, 24000000); eq(m.products.length, 4); eq(m.replacement[0].cycleYears, 8);
  const p = S.parseStore(S.serializeStore(s)); p.meta.updatedAt = s.meta.updatedAt; eq(p, s);
});
test('v3: 未来バージョン 4 は拒否', () => { throws(() => S.normalizeStore({ version: 5 })); });
test('v4: createEmpty は店舗1つの会社。activeStoreId はその店舗', () => {
  const c = S.createEmpty(); eq(c.version, 4); eq(c.stores.length, 1); eq(c.activeStoreId, c.stores[0].store.id);
  eq(c.company.hq, { labor: null, rent: null, ads: null, other: null }); eq(c.company.plan, { requiredProfit: null, existingGrowthPct: 0 }); eq(c.company.name, '');
  eq(c.stores[0].version, 3); ok(c.stores[0].store.id);
});
test('v4: createSample は2店舗・全社表示・本部費入り・目安値と期間が揃う', () => {
  const c = S.createSample(); eq(c.stores.length, 2); eq(c.activeStoreId, null); eq(c.stores[0].store.name, '本店'); eq(c.stores[1].store.name, '2号店');
  eq(c.stores[0].mgmt.revenue, 48000000); eq(c.stores[1].mgmt.revenue, 28800000); eq(c.company.hq.labor, 3000000); eq(c.company.hq.ads, null);
  eq(c.stores[1].store.period, c.stores[0].store.period); eq(c.stores[1].benchmarks, c.stores[0].benchmarks); eq(c.stores[1].categories.length, 2);
});
test('v4: normalize は v3 ファイルを店舗1つの会社に包む', () => {
  const st = S.createSampleStore(); const c = S.normalize(JSON.parse(S.serializeStore(st)));
  eq(c.version, 4); eq(c.stores.length, 1); eq(c.activeStoreId, c.stores[0].store.id); eq(c.stores[0].categories.length, 2); eq(c.company.name, '');
});
test('v4: normalize は存在しない activeStoreId を全社（1店舗なら店舗）に倒す', () => {
  const c = S.createSample(); c.activeStoreId = 'nope'; eq(S.normalize(JSON.parse(S.serialize(c))).activeStoreId, null);
  const one = S.createEmpty(); one.activeStoreId = 'nope'; eq(S.normalize(JSON.parse(S.serialize(one))).activeStoreId, one.stores[0].store.id);
});
test('v4: normalize は stores が空なら空店舗を1つ作り、id の重複を除く', () => {
  const c = S.normalize({ version: 4, stores: [] }); eq(c.stores.length, 1); eq(c.activeStoreId, c.stores[0].store.id);
  const d = S.normalize({ version: 4, stores: [{ store: { id: 's1' } }, { store: { id: 's1' } }] }); ok(d.stores[0].store.id !== d.stores[1].store.id);
});
test('v4: parse/serialize 往復（会社）', () => { const c = S.createSample(); const p = S.parse(S.serialize(c)); p.meta.updatedAt = c.meta.updatedAt; eq(p, c); });
test('v4: 未来バージョン 5 は拒否', () => { throws(() => S.normalize({ version: 5, stores: [] })); throws(() => S.parseStore(JSON.stringify({ version: 5 }))); });
test('v4: addStore / removeStore / duplicateStore / replaceStore', () => {
  const c = S.createEmpty(); const first = c.stores[0].store.id; c.stores[0].benchmarks.grossMarginPct = 55; c.stores[0].store.period = 2;
  const id2 = S.addStore(c); eq(c.stores.length, 2); eq(c.stores[1].store.id, id2); eq(c.stores[1].benchmarks.grossMarginPct, 55); eq(c.stores[1].store.period, 2);
  const id3 = S.addStore(c, { version: 3, store: { id: first, name: '取込' }, categories: [{ name: 'X' }] });
  ok(id3 !== first, '同じidのファイルは新しいidになる'); eq(c.stores[2].store.name, '取込'); eq(c.stores[0].store.id, first);
  eq(S.removeStore(c, 'nope'), false); c.activeStoreId = id3; ok(S.removeStore(c, id3)); eq(c.stores.length, 2); eq(c.activeStoreId, null, '表示中の店舗を消すと全社');
  const dup = S.duplicateStore(c, first); eq(c.stores[1].store.id, dup); eq(c.stores[1].store.name, '店舗1のコピー'); ok(dup !== first); eq(S.duplicateStore(c, 'nope'), null);
  ok(S.replaceStore(c, dup, { version: 3, store: { id: 'zzz', name: '差替' }, benchmarks: { grossMarginPct: 10 } }));
  eq(c.stores[1].store.id, dup); eq(c.stores[1].store.name, '差替'); eq(c.stores[1].benchmarks.grossMarginPct, 55, '目安値は会社の値を保つ'); eq(S.replaceStore(c, 'nope', {}), false);
  ok(S.removeStore(c, dup)); ok(S.removeStore(c, id2)); eq(c.stores.length, 1); eq(S.removeStore(c, first), false, '最後の1店舗は削除できない'); eq(c.activeStoreId, first);
});
test('v4: syncShared は目安値と期間を全店に複製する（深いコピー）', () => {
  const c = S.createSample(); c.stores[1].benchmarks.laborPct = 20; c.stores[1].store.period = 1; S.syncShared(c, 1);
  eq(c.stores[0].benchmarks.laborPct, 20); eq(c.stores[0].store.period, 1);
  c.stores[0].benchmarks.laborPct = 30; S.syncShared(c, 0); eq(c.stores[1].benchmarks.laborPct, 30);
  ok(c.stores[0].benchmarks !== c.stores[1].benchmarks);
});
test('v4: parseStore は v3 と v4単店を受け、v4複数店は company file', () => {
  const st = S.createSampleStore(); eq(S.parseStore(S.serializeStore(st)).categories.length, 2);
  const one = S.createEmpty(); one.stores[0].store.name = '単'; eq(S.parseStore(S.serialize(one)).store.name, '単');
  let msg = ''; try { S.parseStore(S.serialize(S.createSample())); } catch (e) { msg = e.message; } eq(msg, 'company file');
  throws(() => S.parseStore('{oops'));
});
test('v4: serializeStore は version 3 で書き出し、normalizeStore で読める', () => {
  const c = S.createSample(); const j = JSON.parse(S.serializeStore(c.stores[1])); eq(j.version, 3); eq(S.normalizeStore(j).store.name, '2号店'); eq(S.normalizeStore(j).store.id, c.stores[1].store.id);
});
test('v4: activeStore / storeLabel', () => {
  const c = S.createSample(); eq(S.activeStore(c), null); c.activeStoreId = c.stores[1].store.id; eq(S.activeStore(c).store.name, '2号店');
  c.stores[1].store.name = ''; eq(S.storeLabel(c, 1), '店舗2'); eq(S.storeLabel(c, 0), '本店');
});
test('v4: exportFilename（会社）と exportStoreFilename', () => {
  const c = S.createSample(); c.company.name = 'A/B社'; eq(S.exportFilename(c, new Date(2026, 8, 25)), 'A_B社_全社_20260925.json');
  c.company.name = ''; eq(S.exportFilename(c, new Date(2026, 8, 25)), 'company_全社_20260925.json');
  const one = S.createEmpty(); one.stores[0].store.name = '単店'; eq(S.exportFilename(one, new Date(2026, 8, 25)), '単店_20260925.json');
  eq(S.exportStoreFilename(c.stores[1], new Date(2026, 8, 25)), '2号店_20260925.json');
});
test('v4: load は v3 の保存データを会社に変換して返す', () => {
  const mem = { 'storeSim:v2': S.serializeStore(S.createSampleStore()) }; const storage = { getItem: k => mem[k], setItem: (k, v) => { mem[k] = v; } };
  const c = S.load(storage); eq(c.version, 4); eq(c.stores[0].categories.length, 2); eq(c.activeStoreId, c.stores[0].store.id);
});
