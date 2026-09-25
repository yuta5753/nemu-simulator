const U = Sim.ui.util;
test('getPath/setPath: ドット区切りで配列も辿る', () => {
  const o = { a: { b: [{ c: 1 }] } }; eq(U.getPath(o, 'a.b.0.c'), 1);
  U.setPath(o, 'a.b.0.c', 5); eq(o.a.b[0].c, 5); U.setPath(o, 'x.y', 1); eq(o.x.y, 1); eq(U.getPath(o, 'nope.z'), undefined);
  const o2 = {}; U.setPath(o2, 'a.0.b', 1); eq(Array.isArray(o2.a), true); eq(o2.a[0].b, 1);
});
test('parseValue: data-type ごとの変換', () => {
  const el = (type, value) => ({ dataset: { type }, value, type: 'text' });
  eq(U.parseValue(el('num', '12')), 12); eq(U.parseValue(el('num', 'abc')), 0); eq(U.parseValue(el('num', '')), 0);
  eq(U.parseValue(el('optnum', '')), null); eq(U.parseValue(el('optnum', '3.5')), 3.5); eq(U.parseValue(el('optnum', 'x')), null);
  eq(U.parseValue(el(undefined, ' 店 ')), ' 店 ');
  eq(U.parseValue({ dataset: { type: 'bool' }, type: 'checkbox', checked: true }), true);
  eq(U.parseValue(el('man', '4800')), 48000000); eq(U.parseValue(el('man', '')), null); eq(U.parseValue(el('man0', '')), 0); eq(U.parseValue(el('man', '1.5')), 15000);
  eq(U.parseValue(el('months', '1.5')), 45); eq(U.parseValue(el('months', '')), null);
});
test('fmt/yen/signed/esc', () => {
  eq(U.fmt(1234.6), '1,235'); eq(U.fmt(null), '—'); eq(U.fmt(NaN), '—');
  eq(U.yen(1000), '1,000円'); eq(U.yen(null), '—'); eq(U.yen(12000), '1.2万円'); eq(U.yen(4800000), '480万円'); eq(U.yen(35120), '3.5万円');
  eq(U.yen(480000000), '4.8億円'); eq(U.yen(-35000), '−3.5万円'); eq(U.yen(0), '0円');
  eq(U.man(48000000), 4800); eq(U.man(35120), 3.5); eq(U.man(null), ''); eq(U.months(45), 1.5); eq(U.months(null), ''); eq(U.PERIOD_LABEL(2), '24ヶ月');
  eq(U.fmt1(78.26), '78.3'); eq(U.signed(5, '%'), '+5%'); eq(U.signed(-3, 'pt'), '-3pt'); eq(U.signed(0, '%'), '+0%');
  eq(U.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'); eq(U.val(null), ''); eq(U.val(0), 0);
});
