const T = Sim.tactics;
test('LIBRARY: 5レバー全てに定型があり、業種固有語を含まない', () => {
  ['new', 'sameDay', 'later', 'aov', 'entryPrice'].forEach(k => ok(T.LIBRARY[k].length >= 2, k));
  const all = Object.values(T.LIBRARY).flat().join('');
  ok(!/枕|布団|マットレス|寝具/.test(all));
});
test('avgDays / resolve: 平均日数の半分を差し込む・無ければ○', () => {
  const s = Sim.state.createSampleStore(); eq(T.avgDays(s), 68);
  eq(T.resolve('購入後{days}日を目安にフォロー連絡', s), '購入後34日を目安にフォロー連絡');
  eq(T.resolve('購入後{days}日を目安にフォロー連絡', Sim.state.createEmptyStore()), '購入後○日を目安にフォロー連絡');
  eq(T.resolve('日数なし', s), '日数なし');
});
