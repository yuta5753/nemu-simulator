const P = Sim.paste;
test('toNum: 表記ゆれを吸収', () => {
  eq(P.toNum('68%'), 68); eq(P.toNum('¥12,000'), 12000); eq(P.toNum(' 40人 '), 40); eq(P.toNum(''), null); eq(P.toNum('abc'), null); eq(P.toNum('1,234.5円'), 1234.5);
});
test('parse: 日本語ヘッダー・タブ区切り', () => {
  const r = P.parse('間口カテゴリ\t期間\t新規獲得数\t間口単価\t後日追加率\t後日追加単価\n枕\t3\t40\t12000\t68\t34000\n');
  eq(r.warnings, []); eq(r.rows.length, 1);
  eq(r.rows[0], {name:'枕', period:3, newCustomers:40, entryPrice:12000, sameDayRate:null, sameDayAov:null, laterRate:68, laterAov:34000, measuredLtv:null});
});
test('parse: CRM英語ヘッダー・コホート月2行を人数で加重平均', () => {
  const head = 'entry_category\tcohort_month\tperiod_years\tnew_customers\tentry_sales\tsameday_addon_customers\tsameday_addon_sales\tlater_addon_customers\tlater_addon_sales\tsameday_addon_rate\tlater_addon_rate\tmeasured_ltv';
  const r1 = '枕\t2026-04-01\t3\t10\t120000\t2\t10000\t6\t180000\t20\t60\t31000';
  const r2 = '枕\t2026-05-01\t3\t30\t360000\t3\t30000\t21\t735000\t10\t70\t37500';
  const r = P.parse([head, r1, r2].join('\r\n')); eq(r.warnings, []); eq(r.rows.length, 1); const x = r.rows[0];
  eq(x.newCustomers, 40); eq(x.entryPrice, 12000); eq(x.sameDayRate, 12.5); eq(x.sameDayAov, 8000); eq(x.laterRate, 67.5); eq(x.laterAov, 33889); eq(x.measuredLtv, 35875);
});
test('parse: カンマ区切り・引用符・%記号・期間列なしは opts.period', () => {
  const r = P.parse('"カテゴリ","新規","後日追加率"\n"枕","40","68%"', {period: 2});
  eq(r.rows[0].period, 2); eq(r.rows[0].laterRate, 68); eq(r.rows[0].newCustomers, 40);
});
test('parse: 必須列が無ければ rows 空＋警告', () => {
  ok(P.parse('a\tb\n1\t2').warnings.length); eq(P.parse('a\tb\n1\t2').rows, []);
  ok(P.parse('間口カテゴリ\tx\n枕\t1').warnings[0].includes('新規獲得数'));
  eq(P.parse('').rows, []);
});
test('parse: 不正値の行は飛ばし、負の値は無視して警告', () => {
  const r = P.parse('間口カテゴリ\t期間\t新規獲得数\t間口単価\n枕\t3\tabc\t100\n敷\t5\t10\t100\n\t3\t10\t100\n掛\t3\t10\t-5');
  eq(r.rows.length, 1); eq(r.rows[0].name, '掛'); eq(r.rows[0].entryPrice, null); eq(r.warnings.length, 4);
});
test('parse: 列数が見出しと合わない行は警告のうえ取り込める範囲で取り込む', () => {
  const r = P.parse('間口カテゴリ\t期間\t新規獲得数\t間口単価\t後日追加率\n枕\t3\t40');
  eq(r.rows.length, 1); eq(r.rows[0].entryPrice, null); eq(r.rows[0].laterRate, null);
  eq(r.warnings.length, 1); ok(r.warnings[0].includes('列数'));
});
test('parse: カンマ区切りで引用符の対応が崩れている行は警告のうえ飛ばす', () => {
  const r = P.parse('"カテゴリ","新規"\n"枕, 大",40');
  eq(r.rows, []); eq(r.warnings.length, 1); ok(r.warnings[0].includes('引用符'));
});
test('apply: 名前一致は上書き、無ければ追加、シナリオのレバーも同期', () => {
  const s = Sim.state.createSample();
  const rows = [{name:'枕（フィッティング）', period:3, newCustomers:50, entryPrice:13000, sameDayRate:10, sameDayAov:3000, laterRate:70, laterAov:null, measuredLtv:null},
                {name:'掛け布団', period:1, newCustomers:12, entryPrice:30000, sameDayRate:null, sameDayAov:null, laterRate:20, laterAov:8000, measuredLtv:null}];
  const r = P.apply(s, rows);
  eq(s.categories.length, 2, '元のstateは変えない'); eq(r.state.categories.length, 3);
  const c0 = r.state.categories[0]; eq(c0.newCustomers, 50); eq(c0.entryPrice, 13000); eq(c0.sameDay, {rate:10, aov:3000}); eq(c0.later[2], {rate:70, aov:34000});
  const c2 = r.state.categories[2]; eq(c2.name, '掛け布団'); eq(c2.later[0], {rate:20, aov:8000}); eq(c2.later[2], {rate:0, aov:0});
  eq(r.summary, [{name:'枕（フィッティング）', action:'update'}, {name:'掛け布団', action:'add'}]);
  ok(r.state.plan.scenarios.every(sc => sc.levers[c2.id]));
});
test('parseKeyValues: 万円で受ける・ラベル揺れ・記号・前期プレフィックス・未知行', () => {
  const r = P.parseKeyValues('総売上\t¥4,800\n購入客数,700\n広告費\t180\n期末在庫金額　600\n来店3回以上\t150\n前期 総売上\t4000\n前期　人件費\t900\n謎の項目\t1\n人件費\tabc');
  eq(r.values, { revenue: 48000000, buyers: 700, 'costs.ads': 1800000, inventory: 6000000, 'visits.threePlus': 150 });
  eq(r.prev, { revenue: 40000000, 'costs.labor': 9000000 });
  eq(r.warnings.length, 2); ok(r.warnings[0].includes('謎の項目')); ok(r.warnings[1].includes('人件費'));
  const y = P.parseKeyValues('総売上\t48,000,000\n人件費\t9,600,000\n購入客数\t700'); eq(y.values, { revenue: 48000000, 'costs.labor': 9600000, buyers: 700 }); ok(y.warnings.some(w => w.includes('円で貼られた')));
  eq(P.parseKeyValues('買上点数\t1.6').values, { itemsPerBuyer: 1.6 }, '人数・点数は変換しない');
  eq(P.parseKeyValues('').values, {});
  const e = P.parseKeyValues('前期 総売上\t\n家賃\t'); eq(e.values, {}); eq(e.prev, {}); eq(e.warnings, [], '値が空の行は警告なしで飛ばす');
});
test('applyKeyValues: 値を反映し、前期があれば prev を作る', () => {
  const s = Sim.state.createEmpty(); const r = P.applyKeyValues(s, P.parseKeyValues('総売上\t100\n仕入原価\t40\n前期 総売上\t90'));
  eq(s.mgmt.revenue, null, '元は変えない'); eq(r.state.mgmt.revenue, 1000000); eq(r.state.mgmt.costs.cogs, 400000); eq(r.state.mgmt.prev.revenue, 900000); eq(r.count, 2); eq(r.prevCount, 1);
  const r2 = P.applyKeyValues(s, P.parseKeyValues('総売上\t100')); eq(r2.state.mgmt.prev, null);
});
