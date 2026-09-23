# 店舗 売上シミュレーター v2 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の1ページ試算ツールを「①現状入力 → ②診断 → ③目標と戦略 → ④レポート」の4ステップ1ページに組み替える。

**Architecture:** ページは `index.html` 1枚のまま。計算（calc）・診断（analysis）・貼り付け解析（paste）・状態（state）はDOMに触らない純関数ファイルに分け、`window.Sim.*` 名前空間に登録して `<script src>` を順番に読む。UIはステップごとのモジュール（ui-input / ui-diagnosis / ui-plan / ui-report）が `render(el, state, api)` と `refresh(el, state, api)` を持ち、`app.js` がステッパー・期間切替・保存を束ねる。入力欄は `data-path` 属性で state のパスに直結し、共通の委譲ハンドラが値を書き戻す。

**Tech Stack:** 素のHTML / CSS / JavaScript（ES2020、ES Modules不使用、外部ライブラリなし）。テストは Node 標準機能のみ（`node tests/run.js`）。

**Spec:** `docs/superpowers/specs/2026-09-23-simulator-v2-design.md`

## Global Constraints

- 外部ライブラリ・CDN読み込みなし。図はインラインSVG（spec §2-2, §10）
- ES Modules不使用。`file://` でダブルクリック起動できること（spec §2-2）
- 各JSは `window.Sim = window.Sim || {};` から始め、`Sim.<名前>` に登録（spec §2-2）
- `calc.js` / `analysis.js` / `paste.js` / `state.js` / `tactics.js` はDOM・`document`・`window`のプロパティ（`Sim`以外）に触らない（spec §2-2, §12）
- 業界の目安値をコードに埋め込まない（spec §5, §13）
- 判定保留の母数しきい値は **10人未満**（spec §4-3, §5-2）
- 期間は 1 / 2 / 3 年のみ。後日追加は期間ごとの累計（spec §3-1）
- 計画LTV ＝ 間口単価 ＋ 同日率×同日単価 ＋ 後日率(期間)×後日単価(期間)（spec §3-1）
- state の `version` は **2**。localStorage キーは `storeSim:v2`（spec §3, §8）
- シナリオは最大3本（spec §6-2）
- 画面・ガイド・コメントの文体は「ですます調」、押しつけ表現なし。用語は「間口カテゴリ」に統一（spec §9, §13）
- 配色・カード・角丸は現行 index.html のCSS変数（`--ink` `--indigo` `--gold` `--washi` 等）を継承（spec §10）
- 既存の `index.html` は上書き前に `docs/legacy/index-v1.html` へ複製を残す（CLAUDE.md ログ・証跡ルール）

## Review Focus

1. **新規獲得人数が0のカテゴリ／全カテゴリ0** — 構成比・加重平均LTV・CPAが NaN にならず「—」表示になること → Task 2 の `store` テスト「全カテゴリ新規0」で固定
2. **間口カテゴリを削除した後のシナリオ** — 削除済みIDのレバーが残らず、追加したカテゴリのレバーが自動で生えること → Task 1 の `syncScenarios` テストで固定
3. **貼り付けテキストの揺れ**（CRLF改行・`68%`・`¥12,000`・引用符付きセル）— 数値として取り込めること → Task 4 の「表記ゆれ」テストで固定
4. **目標が現状より低い（ギャップが負）** — 逆算が負の必要量を返し、画面は「達成済み」表示になること → Task 2 の `reverse` 負ギャップテスト＋Task 8 の手動確認で固定
5. **壊れた保存データ／未知の項目を含むJSON** — 読み込みで落ちず、`load` が null、`normalize` が欠損を補うこと → Task 1 の「壊れたJSON」「余分な項目」テストで固定

---

## ファイル構成（確定）

| ファイル | 責務 | 作るTask |
|---|---|---|
| `tests/run.js` | テストランナー（Nodeのみ・依存なし） | 1 |
| `tests/*.test.js` | 各純関数のテスト | 1〜5 |
| `js/state.js` | データ構造・初期値・保存/読込・変換・シナリオ同期 | 1 |
| `js/calc.js` | LTV・売上・粗利・逆算・CRM転記値 | 2 |
| `js/analysis.js` | 4象限・効きどころ・弱点・期間・整合チェック・コメント | 3 |
| `js/paste.js` | 貼り付けテキストの解析と反映 | 4 |
| `js/tactics.js` | 打ち手ライブラリ | 5 |
| `index.html` / `css/style.css` | 画面骨組み・スタイル | 6 |
| `js/ui-util.js` | パス書き戻し・イベント委譲・整形関数 | 6 |
| `js/app.js` | 起動・ステッパー・期間切替・保存/読込/書き出し | 6 |
| `js/ui-input.js` | ①現状入力 | 6 |
| `js/ui-diagnosis.js` | ②診断 | 7 |
| `js/ui-plan.js` | ③目標と戦略 | 8 |
| `js/ui-report.js` / `css/print.css` | ④レポート・印刷 | 9 |
| `tests/manual-checklist.md` / `README.md` | 手動確認・使い方 | 10 |

`spec §2-2` に無い `js/ui-util.js` を追加する（3つのUIモジュールが同じ入力バインディングを使うため）。

---

### Task 1: テストランナーと state.js

**Files:**
- Create: `tests/run.js`
- Create: `tests/state.test.js`
- Create: `js/state.js`

**Interfaces:**
- Consumes: なし
- Produces:
  - `Sim.state.SCHEMA_VERSION` (=2), `Sim.state.STORAGE_KEY` (='storeSim:v2')
  - `Sim.state.createEmpty()` → state
  - `Sim.state.createSample()` → state（寝具店サンプル。カテゴリ2件・シナリオ3本）
  - `Sim.state.newCategory(overrides?)` → category、`Sim.state.newChannel(overrides?)` → channel
  - `Sim.state.newScenario(name, categories, overrides?)` → scenario、`Sim.state.emptyLevers()` → `{newPct,sameDayPt,laterPt,aovPct,entryPricePct}` 全て0
  - `Sim.state.emptyPrev()` → 全項目 null の prev
  - `Sim.state.migrateV1(products, {cogs, fixed})` → state（旧 `{name,front,new1,aov[],ret[]}` を後日追加へ）
  - `Sim.state.normalize(obj)` → state（欠損補完。`version>2` は `Error('unsupported version')`）
  - `Sim.state.serialize(state)` → JSON文字列、`Sim.state.parse(json)` → state（不正は `Error('invalid json')`）
  - `Sim.state.save(state, storage)` → boolean、`Sim.state.load(storage)` → state|null
  - `Sim.state.exportFilename(state, date?)` → `"店名_YYYYMMDD.json"`
  - `Sim.state.syncScenarios(state)` → state（カテゴリ増減にレバーを追随）

- [ ] **Step 1: テストランナーを書く**

`tests/run.js`:
```js
// 依存なしのテストランナー。 node tests/run.js で実行。
const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.window = globalThis;               // ブラウザの window.Sim を再現
const JS = path.join(__dirname, '..', 'js');
for (const f of ['state', 'calc', 'analysis', 'paste', 'tactics', 'ui-util']) {
  const p = path.join(JS, f + '.js');
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: f + '.js' });
}
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('✓ ' + name); }
  catch (e) { fail++; console.log('✗ ' + name + '\n    ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n    ')); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
function approx(a, b, tol, msg) { tol = tol == null ? 0.5 : tol; if (a == null || Math.abs(a - b) > tol) throw new Error((msg || '') + ' expected ≈' + b + ' got ' + a); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy, got ' + JSON.stringify(v)); }
function throws(fn, msg) { let t = false; try { fn(); } catch (e) { t = true; } if (!t) throw new Error(msg || 'expected throw'); }
Object.assign(globalThis, { test, eq, approx, ok, throws });
for (const f of fs.readdirSync(__dirname).filter(n => n.endsWith('.test.js')).sort()) require(path.join(__dirname, f));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: state のテストを書く**

`tests/state.test.js`:
```js
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
test('exportFilename: 店名_日付.json（記号は置換）', () => {
  const s = S.createEmpty(); s.store.name = 'A/B店';
  eq(S.exportFilename(s, new Date('2026-09-23T00:00:00Z')), 'A_B店_20260923.json');
  eq(S.exportFilename(S.createEmpty(), new Date('2026-09-23T00:00:00Z')), 'store_20260923.json');
});
test('syncScenarios: カテゴリ追加でレバーが生え、削除で消える', () => {
  const s = S.createSample(); const c = S.newCategory({name:'新'}); s.categories.push(c); S.syncScenarios(s);
  ok(s.plan.scenarios.every(sc => sc.levers[c.id]), '追加分のレバー');
  const removed = s.categories.shift().id; S.syncScenarios(s);
  ok(s.plan.scenarios.every(sc => !sc.levers[removed]), '削除分のレバーが消えている');
});
test('emptyPrev: 全項目 null', () => {
  const p = S.emptyPrev(); eq(p.entryPrice, null); eq(p.later[2], {rate:null, aov:null}); eq(p.sameDay, {rate:null, aov:null});
});
```

- [ ] **Step 3: 失敗を確認**

Run: `node tests/run.js`
Expected: `Sim is not defined` 系のエラーで全件 ✗（`js/state.js` が無いため）

- [ ] **Step 4: state.js を書く**

`js/state.js`:
```js
window.Sim = window.Sim || {};
(function () {
  const SCHEMA_VERSION = 2;
  const STORAGE_KEY = 'storeSim:v2';
  let seq = 0;
  const uid = (prefix) => prefix + '_' + Date.now().toString(36) + '_' + (++seq);
  const num = (v, d) => (v === '' || v == null || isNaN(+v)) ? (d == null ? 0 : d) : +v;
  const optNum = (v) => (v === '' || v == null || isNaN(+v)) ? null : +v;

  function emptyLevers() { return { newPct: 0, sameDayPt: 0, laterPt: 0, aovPct: 0, entryPricePct: 0 }; }
  function emptyPrev() {
    return { entryPrice: null, newCustomers: null, sameDay: { rate: null, aov: null },
      later: [{ rate: null, aov: null }, { rate: null, aov: null }, { rate: null, aov: null }], daysToAddon: null };
  }
  function normalizePrev(p) {
    const e = emptyPrev(); if (!p || typeof p !== 'object') return e;
    e.entryPrice = optNum(p.entryPrice); e.newCustomers = optNum(p.newCustomers); e.daysToAddon = optNum(p.daysToAddon);
    e.sameDay = { rate: optNum(p.sameDay && p.sameDay.rate), aov: optNum(p.sameDay && p.sameDay.aov) };
    e.later = [0, 1, 2].map(i => ({ rate: optNum(p.later && p.later[i] && p.later[i].rate), aov: optNum(p.later && p.later[i] && p.later[i].aov) }));
    return e;
  }
  function newCategory(o) {
    o = o || {};
    return {
      id: o.id || uid('c'),
      name: o.name == null ? '新しい間口カテゴリ' : String(o.name),
      entryPrice: num(o.entryPrice, 0),
      newCustomers: num(o.newCustomers, 0),
      sameDay: { rate: num(o.sameDay && o.sameDay.rate, 0), aov: num(o.sameDay && o.sameDay.aov, 0) },
      later: [0, 1, 2].map(i => ({ rate: num(o.later && o.later[i] && o.later[i].rate, 0), aov: num(o.later && o.later[i] && o.later[i].aov, 0) })),
      daysToAddon: optNum(o.daysToAddon),
      nextProducts: o.nextProducts == null ? '' : String(o.nextProducts),
      prev: o.prev ? normalizePrev(o.prev) : null
    };
  }
  function newChannel(o) {
    o = o || {};
    return { id: o.id || uid('ch'), name: o.name == null ? '新しい経路' : String(o.name), newCustomers: num(o.newCustomers, 0), cost: num(o.cost, 0) };
  }
  function newScenario(name, categories, o) {
    o = o || {}; const levers = {};
    (categories || []).forEach(c => { levers[c.id] = Object.assign(emptyLevers(), (o.levers && o.levers[c.id]) || {}); });
    const tactics = Array.isArray(o.tactics) ? o.tactics.map(t => ({
      lever: t.lever || 'new', categoryId: t.categoryId == null ? null : t.categoryId, text: t.text == null ? '' : String(t.text),
      owner: t.owner == null ? '' : String(t.owner), due: t.due == null ? '' : String(t.due), fromLibrary: !!t.fromLibrary
    })) : [];
    return { name: name || o.name || 'シナリオ', levers, tactics, memo: o.memo == null ? '' : String(o.memo) };
  }
  function createEmpty() {
    const now = new Date().toISOString();
    return {
      version: SCHEMA_VERSION,
      store: { name: '', fiscalLabel: '', cogsRate: 50, fixedCostMonthly: 0, period: 3 },
      benchmarks: { sameDayRate: null, laterRate: [null, null, null], laterAov: [null, null, null], daysToAddon: null },
      categories: [], channels: [],
      plan: { targetRevenue: [null, null, null], activeScenario: 0, scenarios: [newScenario('標準', [])] },
      meta: { createdAt: now, updatedAt: now }
    };
  }
  const V1_SAMPLE = {
    products: [
      { name: '枕（フィッティング）', front: 12000, new1: 40, aov: [15000, 26000, 34000], ret: [35, 55, 68] },
      { name: '敷きもの・カバー類', front: 6000, new1: 60, aov: [5000, 9000, 12000], ret: [50, 72, 85] }
    ], cogs: 50, fixed: 0
  };
  function migrateV1(products, globals) {
    globals = globals || {}; const s = createEmpty();
    s.store.cogsRate = num(globals.cogs, 50); s.store.fixedCostMonthly = num(globals.fixed, 0);
    s.categories = (products || []).map(p => newCategory({
      name: p.name, entryPrice: p.front, newCustomers: p.new1,
      later: [0, 1, 2].map(i => ({ rate: p.ret && p.ret[i], aov: p.aov && p.aov[i] }))
    }));
    s.plan.scenarios = [newScenario('標準', s.categories)];
    return s;
  }
  function createSample() {
    const s = migrateV1(V1_SAMPLE.products, { cogs: V1_SAMPLE.cogs, fixed: V1_SAMPLE.fixed });
    s.store.name = 'サンプル寝具店'; s.store.fiscalLabel = '2026年度';
    s.categories[0].nextProducts = 'マットレス・枕カバー'; s.categories[0].daysToAddon = 45;
    s.categories[1].nextProducts = '掛け布団・枕'; s.categories[1].daysToAddon = 90;
    s.plan.scenarios = [newScenario('保守', s.categories), newScenario('標準', s.categories), newScenario('強気', s.categories)];
    s.plan.activeScenario = 1;
    return s;
  }
  function normalize(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('invalid');
    if (num(obj.version, 0) > SCHEMA_VERSION) throw new Error('unsupported version');
    const s = createEmpty(); const st = obj.store || {}; const b = obj.benchmarks || {}; const p = obj.plan || {};
    s.store = { name: st.name == null ? '' : String(st.name), fiscalLabel: st.fiscalLabel == null ? '' : String(st.fiscalLabel),
      cogsRate: num(st.cogsRate, 50), fixedCostMonthly: num(st.fixedCostMonthly, 0), period: [1, 2, 3].includes(+st.period) ? +st.period : 3 };
    s.benchmarks = { sameDayRate: optNum(b.sameDayRate), laterRate: [0, 1, 2].map(i => optNum(b.laterRate && b.laterRate[i])),
      laterAov: [0, 1, 2].map(i => optNum(b.laterAov && b.laterAov[i])), daysToAddon: optNum(b.daysToAddon) };
    s.categories = Array.isArray(obj.categories) ? obj.categories.map(c => newCategory(c)) : [];
    s.channels = Array.isArray(obj.channels) ? obj.channels.map(c => newChannel(c)) : [];
    s.plan.targetRevenue = [0, 1, 2].map(i => optNum(p.targetRevenue && p.targetRevenue[i]));
    const scs = (Array.isArray(p.scenarios) && p.scenarios.length) ? p.scenarios.slice(0, 3) : [{ name: '標準' }];
    s.plan.scenarios = scs.map(sc => newScenario(sc.name, s.categories, sc));
    s.plan.activeScenario = Math.min(Math.max(0, num(p.activeScenario, 0)), s.plan.scenarios.length - 1);
    s.meta = { createdAt: (obj.meta && obj.meta.createdAt) || s.meta.createdAt, updatedAt: (obj.meta && obj.meta.updatedAt) || s.meta.updatedAt };
    return s;
  }
  function syncScenarios(state) {
    if (!state.plan.scenarios.length) state.plan.scenarios.push(newScenario('標準', state.categories));
    const ids = new Set(state.categories.map(c => c.id));
    state.plan.scenarios.forEach(sc => {
      sc.levers = sc.levers || {};
      state.categories.forEach(c => { if (!sc.levers[c.id]) sc.levers[c.id] = emptyLevers(); });
      Object.keys(sc.levers).forEach(id => { if (!ids.has(id)) delete sc.levers[id]; });
    });
    if (state.plan.activeScenario >= state.plan.scenarios.length) state.plan.activeScenario = 0;
    return state;
  }
  function serialize(state) {
    return JSON.stringify(Object.assign({}, state, { meta: Object.assign({}, state.meta, { updatedAt: new Date().toISOString() }) }), null, 2);
  }
  function parse(json) { let o; try { o = JSON.parse(json); } catch (e) { throw new Error('invalid json'); } return normalize(o); }
  function save(state, storage) { try { storage.setItem(STORAGE_KEY, serialize(state)); return true; } catch (e) { return false; } }
  function load(storage) { try { const j = storage.getItem(STORAGE_KEY); return j ? parse(j) : null; } catch (e) { return null; } }
  function exportFilename(state, date) {
    date = date || new Date(); const d = date.toISOString().slice(0, 10).replace(/-/g, '');
    const n = (state.store.name || 'store').replace(/[\\/:*?"<>|]/g, '_');
    return n + '_' + d + '.json';
  }
  Sim.state = { SCHEMA_VERSION, STORAGE_KEY, createEmpty, createSample, newCategory, newChannel, newScenario, emptyLevers, emptyPrev,
    migrateV1, normalize, syncScenarios, serialize, parse, save, load, exportFilename };
})();
```

- [ ] **Step 5: テストが通ることを確認**

Run: `node tests/run.js`
Expected: `11 passed, 0 failed`

- [ ] **Step 6: コミット**

```bash
git add tests/run.js tests/state.test.js js/state.js
git commit -m "feat(v2): テストランナーと state（データ構造・保存・変換）"
```

---

### Task 2: calc.js（LTV・売上・逆算）

**Files:**
- Create: `js/calc.js`
- Create: `tests/calc.test.js`

**Interfaces:**
- Consumes: `Sim.state.createSample()`、category / state の形（Task 1）
- Produces:
  - `Sim.calc.STANDARD_DELTAS` = `{newPct:10, sameDayPt:5, laterPt:5, aovPct:10, entryPricePct:5}`
  - `Sim.calc.applied(cat, period, levers?)` → `{newN, entryPrice, sameRate(0-1), sameAov, laterRate(0-1), laterAov}`
  - `Sim.calc.ltv(cat, period, levers?)` → `{entry, sameDayPart, laterPart, ltv}`
  - `Sim.calc.category(cat, period, levers?)` → `{id, name, newN, entryPrice, ltv, sameDayPart, laterPart, addonPerCustomer, entryRevenue, addonRevenue, revenue}`
  - `Sim.calc.store(state, period, scenarioLevers?)` → `{period, newTotal, revenue, grossProfit, fixedTotal, operatingProfit|null, weightedLtv, categories:[category+share], channels:[{id,name,newCustomers,cost,cpa|null,payback|null}]}`
  - `Sim.calc.reverse(state, period, target)` → null | `{target, current, gap, levers:{new, sameDay, later, aov, entryPrice}}`（各レバーは null か `{neededCount|neededPt|neededPct, from?, to?, feasible}`）
  - `Sim.calc.reachRate(state, period, scenario)` → % | null
  - `Sim.calc.evenSplit(state, period, target)` → `{[categoryId]: levers}`
  - `Sim.calc.crmTargets(state, period, scenario?)` → `[{name, period, entryPrice, newCustomers, addonRate(%), addonAov}]`

- [ ] **Step 1: テストを書く**

`tests/calc.test.js`:
```js
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
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: calc の全件が `Cannot read properties of undefined` で ✗、state の11件は ✓

- [ ] **Step 3: calc.js を書く**

`js/calc.js`:
```js
window.Sim = window.Sim || {};
(function () {
  const STANDARD_DELTAS = { newPct: 10, sameDayPt: 5, laterPt: 5, aovPct: 10, entryPricePct: 5 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const L0 = () => ({ newPct: 0, sameDayPt: 0, laterPt: 0, aovPct: 0, entryPricePct: 0 });

  function applied(cat, period, levers) {
    const l = Object.assign(L0(), levers || {}); const later = cat.later[period - 1] || { rate: 0, aov: 0 };
    return {
      newN: cat.newCustomers * (1 + l.newPct / 100),
      entryPrice: cat.entryPrice * (1 + l.entryPricePct / 100),
      sameRate: clamp(cat.sameDay.rate + l.sameDayPt, 0, 100) / 100,
      sameAov: cat.sameDay.aov * (1 + l.aovPct / 100),
      laterRate: clamp(later.rate + l.laterPt, 0, 100) / 100,
      laterAov: later.aov * (1 + l.aovPct / 100)
    };
  }
  function ltv(cat, period, levers) {
    const a = applied(cat, period, levers); const sameDayPart = a.sameRate * a.sameAov, laterPart = a.laterRate * a.laterAov;
    return { entry: a.entryPrice, sameDayPart, laterPart, ltv: a.entryPrice + sameDayPart + laterPart };
  }
  function category(cat, period, levers) {
    const a = applied(cat, period, levers); const v = ltv(cat, period, levers); const addon = v.sameDayPart + v.laterPart;
    return { id: cat.id, name: cat.name, newN: a.newN, entryPrice: a.entryPrice, ltv: v.ltv, sameDayPart: v.sameDayPart, laterPart: v.laterPart,
      addonPerCustomer: addon, entryRevenue: a.newN * a.entryPrice, addonRevenue: a.newN * addon, revenue: a.newN * v.ltv };
  }
  function store(state, period, scenarioLevers) {
    const cogs = (state.store.cogsRate || 0) / 100;
    const cats = state.categories.map(c => category(c, period, scenarioLevers && scenarioLevers[c.id]));
    const revenue = cats.reduce((s, c) => s + c.revenue, 0); const newTotal = cats.reduce((s, c) => s + c.newN, 0);
    cats.forEach(c => { c.share = revenue > 0 ? c.revenue / revenue : 0; });
    const grossProfit = revenue * (1 - cogs); const fixedTotal = (state.store.fixedCostMonthly || 0) * 12 * period;
    const weightedLtv = newTotal > 0 ? revenue / newTotal : 0;
    const channels = (state.channels || []).map(ch => {
      const cpa = ch.newCustomers > 0 ? ch.cost / ch.newCustomers : null;
      return { id: ch.id, name: ch.name, newCustomers: ch.newCustomers, cost: ch.cost, cpa, payback: (cpa != null && cpa > 0) ? (weightedLtv * (1 - cogs)) / cpa : null };
    });
    return { period, newTotal, revenue, grossProfit, fixedTotal, operatingProfit: fixedTotal > 0 ? grossProfit - fixedTotal : null, weightedLtv, categories: cats, channels };
  }
  function reverse(state, period, target) {
    if (target == null || !(target > 0)) return null;
    const i = period - 1; const cats = state.categories; const sum = f => cats.reduce((s, c) => s + f(c), 0);
    const current = store(state, period).revenue; const gap = target - current; const totalNew = sum(c => c.newCustomers);
    const out = { target, current, gap, levers: {} };
    const k = current > 0 ? target / current : null;
    out.levers.new = k == null ? null : { neededCount: totalNew * (k - 1), from: totalNew, to: totalNew * k, feasible: true };
    const sdDen = sum(c => c.newCustomers * c.sameDay.aov); const wSd = totalNew > 0 ? sum(c => c.newCustomers * c.sameDay.rate) / totalNew : 0;
    out.levers.sameDay = sdDen > 0 ? { neededPt: gap * 100 / sdDen, from: wSd, to: wSd + gap * 100 / sdDen, feasible: wSd + gap * 100 / sdDen <= 100 } : null;
    const lt = c => c.later[i] || { rate: 0, aov: 0 };
    const ltDen = sum(c => c.newCustomers * lt(c).aov); const wLt = totalNew > 0 ? sum(c => c.newCustomers * lt(c).rate) / totalNew : 0;
    out.levers.later = ltDen > 0 ? { neededPt: gap * 100 / ltDen, from: wLt, to: wLt + gap * 100 / ltDen, feasible: wLt + gap * 100 / ltDen <= 100 } : null;
    const addonBase = sum(c => c.newCustomers * (c.sameDay.rate / 100 * c.sameDay.aov + lt(c).rate / 100 * lt(c).aov));
    out.levers.aov = addonBase > 0 ? { neededPct: gap / addonBase * 100, feasible: true } : null;
    const entryBase = sum(c => c.newCustomers * c.entryPrice);
    out.levers.entryPrice = entryBase > 0 ? { neededPct: gap / entryBase * 100, feasible: true } : null;
    return out;
  }
  function reachRate(state, period, scenario) {
    const t = state.plan.targetRevenue[period - 1]; if (!(t > 0)) return null;
    return store(state, period, scenario && scenario.levers).revenue / t * 100;
  }
  function evenSplit(state, period, target) {
    const r = reverse(state, period, target); const levers = {}; if (!r) return levers;
    const n = ['new', 'sameDay', 'later', 'aov', 'entryPrice'].filter(k => r.levers[k]).length;
    state.categories.forEach(c => {
      const l = L0();
      if (n) {
        if (r.levers.new && r.levers.new.from > 0) l.newPct = (r.levers.new.to / r.levers.new.from - 1) * 100 / n;
        if (r.levers.sameDay) l.sameDayPt = r.levers.sameDay.neededPt / n;
        if (r.levers.later) l.laterPt = r.levers.later.neededPt / n;
        if (r.levers.aov) l.aovPct = r.levers.aov.neededPct / n;
        if (r.levers.entryPrice) l.entryPricePct = r.levers.entryPrice.neededPct / n;
      }
      levers[c.id] = l;
    });
    return levers;
  }
  function crmTargets(state, period, scenario) {
    return state.categories.map(c => {
      const a = applied(c, period, scenario && scenario.levers && scenario.levers[c.id]);
      const rate = 1 - (1 - a.sameRate) * (1 - a.laterRate); const expected = a.sameRate * a.sameAov + a.laterRate * a.laterAov;
      return { name: c.name, period, entryPrice: Math.round(a.entryPrice), newCustomers: Math.round(a.newN),
        addonRate: Math.round(rate * 1000) / 10, addonAov: rate > 0 ? Math.round(expected / rate) : 0 };
    });
  }
  Sim.calc = { STANDARD_DELTAS, applied, ltv, category, store, reverse, reachRate, evenSplit, crmTargets };
})();
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node tests/run.js`
Expected: `26 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/calc.js tests/calc.test.js
git commit -m "feat(v2): calc（LTV・売上・逆算・CRM転記値）"
```

---

### Task 3: analysis.js（4象限・効きどころ・弱点・期間・コメント）

**Files:**
- Create: `js/analysis.js`
- Create: `tests/analysis.test.js`

**Interfaces:**
- Consumes: `Sim.calc.store / category / STANDARD_DELTAS`（Task 2）
- Produces:
  - `Sim.analysis.MIN_BASE` (=10)、`Sim.analysis.LEVER_LABELS`、`Sim.analysis.QUADRANT_LABELS`
  - `Sim.analysis.portfolio(state, period)` → `{available, reason?, xBoundary, yBoundary, points:[{id,name,x,y,share,newN,pending,quadrant:'core'|'entryOnly'|'hidden'|'review'|null,label}]}`
  - `Sim.analysis.leverage(state, period)` → `{perCategory:[{id,name,pending,ranked:[{lever,label,delta}],top|null}], store:{ranked,top|null}}`
  - `Sim.analysis.weakness(state, period)` → `{mode:'benchmark'|'prev'|'relative', items:[{id,name,metric,unit,actual,reference,ratio}], worst|null, hint|null}`（items は ratio 昇順）
  - `Sim.analysis.timing(state, period)` → `[{id,name,days,touchpoints:[{label,day}×3],warning|null}]`
  - `Sim.analysis.checks(state)` → `[{categoryId, code:'later_rate_order'|'later_aov_order'|'small_base', message}]`
  - `Sim.analysis.comments(state, period)` → `string[]`

- [ ] **Step 1: テストを書く**

`tests/analysis.test.js`:
```js
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
  approx(pf.xBoundary, 360000, 0.01, '中央値=敷きものの間口売上');
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
  const e = A.comments(Sim.state.createEmpty(), 3); eq(e.length, 1);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: analysis の12件が ✗（`Sim.analysis` 未定義）

- [ ] **Step 3: analysis.js を書く**

`js/analysis.js`:
```js
window.Sim = window.Sim || {};
(function () {
  const MIN_BASE = 10;
  const LEVER_KEYS = ['newPct', 'sameDayPt', 'laterPt', 'aovPct', 'entryPricePct'];
  const LEVER_LABELS = { newPct: '新規獲得人数', sameDayPt: '同日追加率', laterPt: '後日追加率', aovPct: '追加単価', entryPricePct: '間口単価' };
  const QUADRANT_LABELS = { core: '主力（伸ばす）', entryOnly: '入口止まり（育てる）', hidden: '隠れた優良間口（集客を寄せる）', review: '見直す' };
  const median = arr => { const a = arr.slice().sort((x, y) => x - y); const n = a.length; if (!n) return 0; return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2; };
  const yen = n => '¥' + Math.round(n).toLocaleString('ja-JP');

  function portfolio(state, period) {
    const cats = Sim.calc.store(state, period).categories;
    if (cats.length < 2) return { available: false, reason: cats.length ? '間口カテゴリが1件のため象限図は出しません（一覧をご覧ください）' : '間口カテゴリがありません', points: [] };
    const xs = cats.map(c => c.entryRevenue), ys = cats.map(c => c.addonPerCustomer);
    const xBoundary = cats.length === 2 ? (xs[0] + xs[1]) / 2 : median(xs);
    const yBoundary = cats.length === 2 ? (ys[0] + ys[1]) / 2 : median(ys);
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
      const d = c.daysToAddon; const later = c.later[period - 1] || { rate: 0 };
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
    });
    return w;
  }
  function comments(state, period) {
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
  Sim.analysis = { MIN_BASE, LEVER_LABELS, QUADRANT_LABELS, portfolio, leverage, weakness, timing, checks, comments };
})();
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node tests/run.js`
Expected: `38 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/analysis.js tests/analysis.test.js
git commit -m "feat(v2): analysis（4象限・効きどころ・弱点・期間・コメント）"
```

---

### Task 4: paste.js（貼り付け解析と反映）

**Files:**
- Create: `js/paste.js`
- Create: `tests/paste.test.js`

**Interfaces:**
- Consumes: `Sim.state.newCategory / syncScenarios`（Task 1）
- Produces:
  - `Sim.paste.HEADERS`（取り込み先 → 認識ヘッダーの配列）
  - `Sim.paste.toNum(v)` → number|null（`¥` `,` `%` `円` `人` 空白を除去）
  - `Sim.paste.mapHeaders(cells)` → `{取り込み先: 列番号}`
  - `Sim.paste.parse(text, {period})` → `{rows:[{name, period, newCustomers, entryPrice|null, sameDayRate|null, sameDayAov|null, laterRate|null, laterAov|null, measuredLtv|null}], warnings:string[]}`
  - `Sim.paste.apply(state, rows)` → `{state（深いコピー）, summary:[{name, action:'update'|'add'}]}`

- [ ] **Step 1: テストを書く**

`tests/paste.test.js`:
```js
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
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: paste の7件が ✗

- [ ] **Step 3: paste.js を書く**

`js/paste.js`:
```js
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
    const map = mapHeaders(split(lines[0]));
    if (map.name == null) return { rows: [], warnings: ['「間口カテゴリ」または「entry_category」の列が見つかりません'] };
    if (map.newCustomers == null) return { rows: [], warnings: ['「新規獲得数」または「new_customers」の列が見つかりません'] };
    const acc = new Map();
    lines.slice(1).forEach((line, li) => {
      const c = split(line); const ln = li + 2; const name = c[map.name];
      if (!name) { warnings.push(`${ln}行目：カテゴリ名が空のため飛ばしました`); return; }
      const p = map.period != null ? toNum(c[map.period]) : defPeriod;
      if (![1, 2, 3].includes(p)) { warnings.push(`${ln}行目：期間「${c[map.period]}」は1〜3ではないため飛ばしました`); return; }
      const n = toNum(c[map.newCustomers]);
      if (n == null || n < 0) { warnings.push(`${ln}行目：新規獲得数が数字でないため飛ばしました`); return; }
      const get = k => (map[k] != null ? toNum(c[map[k]]) : null);
      const rec = { entrySales: get('entrySales'), entryPrice: get('entryPrice'), sdRate: get('sameDayRate'), sdCust: get('sameDayCustomers'), sdSales: get('sameDaySales'),
        sdAov: get('sameDayAov'), ltRate: get('laterRate'), ltCust: get('laterCustomers'), ltSales: get('laterSales'), ltAov: get('laterAov'), ltv: get('measuredLtv') };
      Object.keys(rec).forEach(k => { if (rec[k] != null && rec[k] < 0) { warnings.push(`${ln}行目：${k} が負の値のため無視しました`); rec[k] = null; } });
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
  Sim.paste = { HEADERS, toNum, mapHeaders, parse, apply };
})();
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node tests/run.js`
Expected: `45 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/paste.js tests/paste.test.js
git commit -m "feat(v2): paste（CRM/表の貼り付け解析と反映）"
```

---

### Task 5: tactics.js（打ち手ライブラリ）

**Files:**
- Create: `js/tactics.js`
- Create: `tests/tactics.test.js`

**Interfaces:**
- Consumes: state.categories[].daysToAddon
- Produces:
  - `Sim.tactics.LIBRARY` = `{new:[], sameDay:[], later:[], aov:[], entryPrice:[]}`（文字列配列。`{days}` を含むものは日数差し込み用）
  - `Sim.tactics.avgDays(state)` → number|null（日数入力があるカテゴリの平均・四捨五入）
  - `Sim.tactics.resolve(text, state)` → `{days}` を「平均日数の半分」で置換。日数が無ければ「○」

- [ ] **Step 1: テストを書く**

`tests/tactics.test.js`:
```js
const T = Sim.tactics;
test('LIBRARY: 5レバー全てに定型があり、業種固有語を含まない', () => {
  ['new', 'sameDay', 'later', 'aov', 'entryPrice'].forEach(k => ok(T.LIBRARY[k].length >= 2, k));
  const all = Object.values(T.LIBRARY).flat().join('');
  ok(!/枕|布団|マットレス|寝具/.test(all));
});
test('avgDays / resolve: 平均日数の半分を差し込む・無ければ○', () => {
  const s = Sim.state.createSample(); eq(T.avgDays(s), 68);
  eq(T.resolve('購入後{days}日を目安にフォロー連絡', s), '購入後34日を目安にフォロー連絡');
  eq(T.resolve('購入後{days}日を目安にフォロー連絡', Sim.state.createEmpty()), '購入後○日を目安にフォロー連絡');
  eq(T.resolve('日数なし', s), '日数なし');
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: tactics の2件が ✗

- [ ] **Step 3: tactics.js を書く**

`js/tactics.js`:
```js
window.Sim = window.Sim || {};
(function () {
  const LIBRARY = {
    new: ['検索広告で入口商品を前面に出す', '来店前の不安を解く相談導線（LINE・電話・予約）を用意する', '紹介特典（ご家族・ご友人）を案内する', 'SNSの短い動画で入口商品の体験を見せる', '地域チラシ・ポスティングで入口商品を告知する'],
    sameDay: ['接客の提案手順（入口商品→付帯品）を台本にする', '入口商品と一緒に使う商品を「セット提案」にする', '入口商品の隣に相性のよい付帯品を陳列する', 'お会計前に「一緒に使うもの」を一言確認する'],
    later: ['購入後{days}日を目安にフォロー連絡（使い心地の確認）', 'LINE・DMで季節の定期接点を持つ', '点検・買替時期の案内を仕組みにする', '次回来店のきっかけ（調整・メンテナンス）を購入時に予約する'],
    aov: ['展開商品の上位グレードを比較提案する', 'まとめ買い・セット割で1回の購入額を上げる', '年間プラン・定期購入を用意する'],
    entryPrice: ['入口商品の価格帯を見直す（安すぎる入口の再設計）', '診断・フィッティングなどの付加価値を入口商品に付ける']
  };
  function avgDays(state) {
    const ds = state.categories.filter(c => c.daysToAddon != null).map(c => c.daysToAddon);
    return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null;
  }
  function resolve(text, state) {
    const d = avgDays(state); return String(text).replace('{days}', d == null ? '○' : String(Math.round(d / 2)));
  }
  Sim.tactics = { LIBRARY, avgDays, resolve };
})();
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node tests/run.js`
Expected: `47 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/tactics.js tests/tactics.test.js
git commit -m "feat(v2): tactics（打ち手ライブラリ）"
```

---

### Task 6: ページ骨組み・ui-util・app・①現状入力

このタスクで旧 `index.html` を新構成に置き換え、ステップ①が動く状態にする。②③④は次のTaskまで「準備中」の1行だけを表示する暫定モジュール（Task 7〜9 で置き換える）。

**Files:**
- Create: `docs/legacy/index-v1.html`（旧版の複製・証跡）
- Modify: `index.html`（全面書き換え）
- Create: `css/style.css`
- Create: `js/ui-util.js`
- Create: `js/app.js`
- Create: `js/ui-input.js`
- Create: `js/ui-diagnosis.js` / `js/ui-plan.js` / `js/ui-report.js`（暫定。Task 7〜9 で本実装）
- Create: `tests/ui-util.test.js`

**Interfaces:**
- Consumes: `Sim.state.*`（Task 1）、`Sim.calc.store`（Task 2）、`Sim.analysis.checks`（Task 3）、`Sim.paste.parse/apply`（Task 4）
- Produces:
  - `Sim.ui.util.getPath(obj, path)` / `setPath(obj, path, value)`（`"a.b.0.c"` 形式）
  - `Sim.ui.util.parseValue(el)`：`data-type` が `num`→数値（不正は0）、`optnum`→数値|null、`bool`→真偽、既定→文字列
  - `Sim.ui.util.bindPanel(el, api, actions)`：`[data-path]` の input → `api.update(s => setPath(...))`、`[data-action]` の click → `actions[name](dataset, element, event)`。二重登録防止
  - `Sim.ui.util.esc / fmt / fmt1 / yen / signed / val / guide`
  - `api`（app.js が各UIに渡す）: `{ update(fn, {structural?}), setStep(n), getState(), period }`
  - UIモジュール契約: `Sim.ui.<name> = { render(el, state, api), refresh(el, state, api) }`

- [ ] **Step 1: 旧版の複製を残す**

```bash
mkdir -p docs/legacy && cp index.html docs/legacy/index-v1.html && git add docs/legacy/index-v1.html && git commit -m "chore: 旧シミュレーター(v1)を docs/legacy に保存"
```

- [ ] **Step 2: ui-util のテストを書く**

`tests/ui-util.test.js`:
```js
const U = Sim.ui.util;
test('getPath/setPath: ドット区切りで配列も辿る', () => {
  const o = { a: { b: [{ c: 1 }] } }; eq(U.getPath(o, 'a.b.0.c'), 1);
  U.setPath(o, 'a.b.0.c', 5); eq(o.a.b[0].c, 5); U.setPath(o, 'x.y', 1); eq(o.x.y, 1); eq(U.getPath(o, 'nope.z'), undefined);
});
test('parseValue: data-type ごとの変換', () => {
  const el = (type, value) => ({ dataset: { type }, value, type: 'text' });
  eq(U.parseValue(el('num', '12')), 12); eq(U.parseValue(el('num', 'abc')), 0); eq(U.parseValue(el('num', '')), 0);
  eq(U.parseValue(el('optnum', '')), null); eq(U.parseValue(el('optnum', '3.5')), 3.5); eq(U.parseValue(el('optnum', 'x')), null);
  eq(U.parseValue(el(undefined, ' 店 ')), ' 店 ');
  eq(U.parseValue({ dataset: { type: 'bool' }, type: 'checkbox', checked: true }), true);
});
test('fmt/yen/signed/esc', () => {
  eq(U.fmt(1234.6), '1,235'); eq(U.fmt(null), '—'); eq(U.fmt(NaN), '—'); eq(U.yen(1000), '¥1,000'); eq(U.yen(null), '—');
  eq(U.fmt1(78.26), '78.3'); eq(U.signed(5, '%'), '+5%'); eq(U.signed(-3, 'pt'), '-3pt'); eq(U.signed(0, '%'), '+0%');
  eq(U.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'); eq(U.val(null), ''); eq(U.val(0), 0);
});
```

- [ ] **Step 3: 失敗を確認**

Run: `node tests/run.js`
Expected: ui-util の3件が ✗（`Sim.ui` 未定義）

- [ ] **Step 4: ui-util.js を書く**

`js/ui-util.js`:
```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const keys = path.split('.'); let o = obj;
    for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = value;
  }
  function parseValue(el) {
    const t = (el.dataset && el.dataset.type) || 'str'; const v = el.type === 'checkbox' ? el.checked : el.value;
    if (t === 'num') { const n = +v; return (v === '' || isNaN(n)) ? 0 : n; }
    if (t === 'optnum') { if (v === '' || v == null) return null; const n = +v; return isNaN(n) ? null : n; }
    if (t === 'bool') return !!v;
    return v;
  }
  function bindPanel(el, api, actions) {
    if (el.dataset.bound) { el._actions = actions; return; }
    el.dataset.bound = '1'; el._actions = actions;
    el.addEventListener('input', e => {
      const t = e.target.closest('[data-path]'); if (!t || t.type === 'checkbox') return;
      const v = parseValue(t); api.update(s => setPath(s, t.dataset.path, v));
    });
    el.addEventListener('change', e => {
      const t = e.target.closest('[data-path]'); if (!t || t.type !== 'checkbox') return;
      const v = parseValue(t); api.update(s => setPath(s, t.dataset.path, v));
    });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-action]'); if (!t || !el.contains(t)) return;
      const fn = el._actions && el._actions[t.dataset.action]; if (fn) fn(t.dataset, t, e);
    });
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('ja-JP');
  const fmt1 = n => (n == null || isNaN(n)) ? '—' : (Math.round(n * 10) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 });
  const yen = n => (n == null || isNaN(n)) ? '—' : '¥' + fmt(n);
  const signed = (n, unit, digits) => { if (n == null || isNaN(n)) return '—'; const v = digits ? fmt1(n) : fmt(n); return (n >= 0 ? '+' : '') + v + (unit || ''); };
  const val = v => (v == null ? '' : v);
  const guide = text => `<details class="guide"><summary aria-label="説明">？</summary><div>${text}</div></details>`;
  Sim.ui.util = { getPath, setPath, parseValue, bindPanel, esc, fmt, fmt1, yen, signed, val, guide };
})();
```

- [ ] **Step 5: テストが通ることを確認**

Run: `node tests/run.js`
Expected: `50 passed, 0 failed`

- [ ] **Step 6: index.html を書き換える**

`index.html`（全文置換）:
```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>店舗 売上シミュレーター</title>
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/print.css">
</head>
<body>
<header class="site-head">
  <div class="wrap">
    <div class="eyebrow">STORE SALES SIMULATOR</div>
    <div class="head-row">
      <div>
        <h1 id="head-title">店舗 売上シミュレーター</h1>
        <p id="head-sub">現状の数字を入れて診断し、目標とレバー配分まで設計します。入力は自動保存されます。</p>
      </div>
      <div class="head-tools">
        <button type="button" class="tbtn" data-app="export">書き出し（JSON）</button>
        <label class="tbtn">読み込み<input type="file" id="import-file" accept="application/json,.json" hidden></label>
        <button type="button" class="tbtn" data-app="sample">サンプルを読み込む</button>
        <button type="button" class="tbtn" data-app="reset">空で始める</button>
        <button type="button" class="tbtn" data-app="guide">ガイドを開く</button>
      </div>
    </div>
    <div class="periodbar" id="periodbar">
      <button type="button" data-p="1">1年で見る</button>
      <button type="button" data-p="2">2年で見る</button>
      <button type="button" data-p="3" class="active">3年で見る</button>
    </div>
    <div class="notice" id="storage-notice" hidden>自動保存が無効です（プライベートモード等）。「書き出し」でファイルに保存してください。</div>
  </div>
</header>
<nav class="stepper wrap" id="stepper" aria-label="ステップ">
  <button type="button" data-step="1" class="active"><span class="no">1</span>現状入力</button>
  <button type="button" data-step="2"><span class="no">2</span>診断</button>
  <button type="button" data-step="3"><span class="no">3</span>目標と戦略</button>
  <button type="button" data-step="4"><span class="no">4</span>レポート</button>
</nav>
<main class="wrap">
  <section class="step-panel" id="panel-1" data-step="1"></section>
  <section class="step-panel" id="panel-2" data-step="2" hidden></section>
  <section class="step-panel" id="panel-3" data-step="3" hidden></section>
  <section class="step-panel" id="panel-4" data-step="4" hidden></section>
  <div class="footnote">すべて試算です。実数値を入れるほど精度が上がります。ブラウザ内の自動保存は同じ端末・同じブラウザでしか残りません。持ち回るときは「書き出し」をお使いください。</div>
</main>
<div class="floatp hide" id="floatp">
  <div class="fpl">期間切替</div>
  <div class="fprow">
    <button type="button" data-p="1">1年</button>
    <button type="button" data-p="2">2年</button>
    <button type="button" data-p="3" class="active">3年</button>
  </div>
</div>
<script src="js/state.js"></script>
<script src="js/calc.js"></script>
<script src="js/analysis.js"></script>
<script src="js/paste.js"></script>
<script src="js/tactics.js"></script>
<script src="js/ui-util.js"></script>
<script src="js/ui-input.js"></script>
<script src="js/ui-diagnosis.js"></script>
<script src="js/ui-plan.js"></script>
<script src="js/ui-report.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 7: css/style.css を書く**

`css/style.css`（旧 index.html の `<style>` を基に、ステッパー等を追加）:
```css
:root{
  --ink:#1a2236;--ink-soft:#2e3a55;--indigo:#3a5a8c;--indigo-bright:#5b82c4;
  --gold:#b8924a;--gold-soft:#d9bd86;--washi:#f4efe4;--washi-deep:#ebe3d2;
  --card:#fbf8f1;--line:#dcd2bd;--text:#2a2f3d;--text-soft:#6a6f7d;
  --good:#3f8a6e;--bad:#c05a4a;--warn:#c9a227;
  --shadow:0 1px 2px rgba(26,34,54,.06),0 8px 24px rgba(26,34,54,.07);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic",system-ui,sans-serif;
  background:radial-gradient(1200px 600px at 80% -10%,rgba(91,130,196,.10),transparent 60%),radial-gradient(900px 500px at -10% 110%,rgba(184,146,74,.10),transparent 55%),var(--washi);
  color:var(--text);line-height:1.6;padding:0 0 80px}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
button,input,select,textarea{font-family:inherit}
.site-head{background:linear-gradient(135deg,var(--ink) 0%,var(--ink-soft) 60%,var(--indigo) 130%);color:#fff;padding:28px 0 24px;border-bottom:3px solid var(--gold);position:relative;overflow:hidden}
.site-head::after{content:"";position:absolute;right:-60px;top:-60px;width:280px;height:280px;background:radial-gradient(circle,rgba(217,189,134,.18),transparent 70%);border-radius:50%}
.eyebrow{font-size:12px;letter-spacing:.32em;color:var(--gold-soft);font-weight:700;margin-bottom:10px}
.head-row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.site-head h1{font-size:26px;font-weight:800;letter-spacing:.02em;line-height:1.3}
.site-head p{color:#c9d2e2;font-size:13px;margin-top:8px;max-width:720px}
.head-tools{display:flex;gap:6px;flex-wrap:wrap}
.tbtn{background:rgba(255,255,255,.1);border:1px solid rgba(217,189,134,.4);color:#fff;font-size:12px;font-weight:700;padding:7px 12px;border-radius:8px;cursor:pointer;transition:.15s;display:inline-block}
.tbtn:hover{background:var(--gold);color:var(--ink)}
.periodbar{display:inline-flex;gap:4px;margin-top:18px;background:rgba(255,255,255,.08);padding:5px;border-radius:12px;border:1px solid rgba(217,189,134,.3)}
.periodbar button{background:transparent;border:none;color:#c9d2e2;font-weight:800;font-size:14px;padding:9px 22px;border-radius:8px;cursor:pointer;transition:.15s}
.periodbar button.active{background:var(--gold);color:var(--ink)}
.periodbar button:not(.active):hover{color:#fff}
.notice{margin-top:12px;background:rgba(192,90,74,.25);border:1px solid var(--bad);padding:8px 12px;border-radius:8px;font-size:12px}
.stepper{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px auto 22px;position:sticky;top:0;z-index:40;background:var(--washi);padding-top:8px;padding-bottom:8px}
.stepper button{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 10px;font-weight:800;font-size:14px;color:var(--text-soft);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:.15s}
.stepper button .no{font-family:"Times New Roman",serif;font-size:12px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:var(--line);color:var(--ink)}
.stepper button.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.stepper button.active .no{background:var(--gold);color:var(--ink)}
.sec-title{display:flex;align-items:center;gap:12px;margin:30px 0 14px;flex-wrap:wrap}
.sec-title .no{font-family:"Times New Roman",serif;font-size:13px;font-weight:700;color:#fff;background:var(--indigo);width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex:none}
.sec-title h2{font-size:18px;font-weight:800;color:var(--ink)}
.sec-title .hint{font-size:12px;color:var(--text-soft);display:flex;align-items:center;gap:6px}
.h3{font-size:14px;font-weight:800;color:var(--ink-soft);margin:14px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
.card.pad{padding:16px 18px}
.globals{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));overflow:hidden}
.gbox{padding:16px 18px;border-right:1px solid var(--line)}
.gbox:last-child{border-right:none}
.gbox label{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-soft);font-weight:700;margin-bottom:8px}
.gbox .row{display:flex;align-items:baseline;gap:6px}
.gbox input{width:100%;font-size:20px;font-weight:800;color:var(--ink);border:none;background:transparent;border-bottom:2px solid var(--line);padding:2px 0}
.gbox input[type=text]{font-size:16px}
.gbox input:focus{outline:none;border-bottom-color:var(--gold)}
.gbox .unit{font-size:13px;color:var(--text-soft);font-weight:700;flex:none}
.bigval{font-size:20px;font-weight:800;color:var(--indigo)}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:18px}
.pcard{padding:0;overflow:hidden;display:flex;flex-direction:column}
.pcard-head{background:linear-gradient(100deg,var(--indigo),var(--indigo-bright));padding:12px 16px;display:flex;align-items:center;gap:10px}
.pcard-head .pname{flex:1;font-size:15px;font-weight:800;color:#fff;background:transparent;border:none;border-bottom:1px dashed rgba(255,255,255,.5);padding:2px 0}
.pcard-head .pname:focus{outline:none;border-bottom-color:#fff}
.pname-static{flex:1;font-size:15px;font-weight:800;color:#fff}
.del{background:rgba(255,255,255,.15);border:none;color:#fff;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:14px;line-height:1;flex:none;transition:.15s}
.del:hover{background:rgba(192,90,74,.85)}
.del.dark{background:var(--line);color:var(--ink)}
.pcard-body{padding:14px 16px 16px}
.basebox{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.field>.flabel{font-size:12px;font-weight:700;color:var(--ink-soft);margin-bottom:6px;display:block}
.field>.flabel .q{color:var(--text-soft);font-weight:500;font-size:10px;display:block;margin-top:1px}
.flabel{font-size:12px;font-weight:700;color:var(--ink-soft);display:block;margin:8px 0 4px}
.inp,textarea{width:100%;font-size:15px;font-weight:700;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#fff}
textarea{font-weight:500;font-size:13px;resize:vertical}
.inp:focus,textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,74,.15)}
.subttl{font-size:12px;font-weight:800;color:var(--ink-soft);margin:6px 0 6px;display:flex;align-items:center;gap:6px}
.subttl::before{content:"＞";color:var(--gold);font-weight:800}
.yrtable{width:100%;border-collapse:collapse;margin-bottom:8px}
.yrtable th{font-size:11px;color:var(--text-soft);font-weight:700;padding:4px;text-align:center;border-bottom:1px solid var(--line)}
.yrtable th:first-child{text-align:left}
.yrtable th.activecol{color:var(--gold);background:rgba(184,146,74,.12)}
.yrtable td{padding:5px 3px;text-align:center}
.yrtable td:first-child{text-align:left;font-size:12px;font-weight:700;color:var(--ink-soft);white-space:nowrap}
.yrtable td.activecol{background:rgba(184,146,74,.08)}
.yrtable input{width:100%;font-size:13px;font-weight:700;color:var(--ink);text-align:center;border:1px solid var(--line);border-radius:6px;padding:5px 2px;background:#fff}
.yrtable input:focus{outline:none;border-color:var(--gold)}
.yrtable .note{font-size:10px;color:var(--text-soft);font-weight:500}
details.opt{margin:8px 0;border-top:1px dashed var(--line);padding-top:8px}
details.opt>summary{font-size:12px;font-weight:700;color:var(--indigo);cursor:pointer}
details.opt>summary::marker{color:var(--gold)}
details.opt[open]>summary{margin-bottom:8px}
.pltv{background:var(--washi-deep);margin:12px -16px -16px;padding:12px 16px;border-top:1px solid var(--line)}
.pltv .pltv-row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
.pltv .pltv-row span:first-child{color:var(--text-soft);font-weight:600}
.pltv .pltv-row span:last-child{font-weight:800;color:var(--ink)}
.pltv .pltv-total{border-top:1px dashed var(--line);margin-top:6px;padding-top:7px}
.pltv .pltv-total span:last-child{color:var(--indigo);font-size:15px}
.addbtn{width:100%;padding:14px;border:2px dashed var(--line);background:transparent;border-radius:14px;color:var(--indigo);font-weight:800;font-size:14px;cursor:pointer;transition:.15s;margin-top:14px}
.addbtn:hover{border-color:var(--gold);background:rgba(184,146,74,.06)}
.sbtn{background:#fff;border:1px solid var(--line);color:var(--ink);font-size:12px;font-weight:700;padding:7px 14px;border-radius:8px;cursor:pointer;margin:6px 6px 0 0}
.sbtn:hover{border-color:var(--gold)}
.sbtn.primary{background:var(--indigo);color:#fff;border-color:var(--indigo)}
.sbtn.danger{color:var(--bad)}
.optblock{margin-top:14px}
.optblock>summary{padding:14px 18px;font-weight:800;font-size:13px;color:var(--ink-soft);cursor:pointer}
.optblock>summary::marker{color:var(--gold)}
.optbody{padding:0 18px 16px}
.ltable{width:100%;border-collapse:collapse;font-size:13px}
.ltable th{font-size:11px;color:var(--text-soft);font-weight:700;text-align:left;padding:6px 6px;border-bottom:1px solid var(--line);white-space:nowrap}
.ltable td{padding:6px 6px;border-bottom:1px dashed var(--line);vertical-align:middle}
.ltable td input{width:100%;min-width:60px;border:1px solid var(--line);border-radius:6px;padding:5px 6px;font-size:13px;font-weight:700;color:var(--ink);background:#fff}
.ltable tr.worst td{background:rgba(192,90,74,.08);font-weight:800}
.note-p{font-size:12px;color:var(--text-soft);margin:8px 0;line-height:1.7}
.warnings{margin-top:10px}
ul.warn{list-style:none;background:rgba(201,162,39,.12);border:1px solid var(--warn);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--ink-soft);margin:8px 0}
ul.warn li{padding:2px 0}
.warn-inline{font-size:12px;color:var(--bad);margin-top:4px}
details.guide{display:inline-block;vertical-align:middle;margin-left:4px;position:relative}
details.guide>summary{list-style:none;cursor:pointer;width:18px;height:18px;border-radius:50%;background:var(--indigo);color:#fff;font-size:11px;font-weight:800;display:inline-grid;place-items:center}
details.guide>summary::-webkit-details-marker{display:none}
details.guide>div{position:absolute;left:0;top:22px;z-index:30;width:280px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;font-weight:500;color:var(--text);box-shadow:var(--shadow);line-height:1.7}
body.guide-open details.guide{display:block;margin:6px 0}
body.guide-open details.guide>div{position:static;width:auto}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.kpi{padding:18px 18px 16px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
.kpi .klab{font-size:12px;color:var(--text-soft);font-weight:700;margin-bottom:8px}
.kpi .kval{font-size:24px;font-weight:800;color:var(--ink)}
.kpi .kval .yen{font-size:14px;color:var(--text-soft);font-weight:700}
.kpi .ksub{font-size:11px;color:var(--text-soft);margin-top:4px}
.kpi.accent{background:linear-gradient(135deg,var(--ink),var(--indigo));border-color:var(--ink)}
.kpi.accent .klab{color:var(--gold-soft)}
.kpi.accent .kval,.kpi.accent .kval .yen{color:#fff}
.kpi.accent .ksub{color:#c9d2e2}
.quad{width:100%;max-width:640px;height:auto;display:block;margin:0 auto 12px}
.qbg{fill:#fff;stroke:var(--line)}
.qline{stroke:var(--gold);stroke-dasharray:4 4}
.qlab{font-size:11px;font-weight:700;fill:var(--text-soft)}
.qlab.end{text-anchor:end}
.qaxis{font-size:11px;fill:var(--ink-soft);text-anchor:middle;font-weight:700}
.qdot{fill-opacity:.75;stroke:#fff;stroke-width:2}
.qdot.core{fill:var(--good)}.qdot.entryOnly{fill:var(--warn)}.qdot.hidden{fill:var(--indigo-bright)}.qdot.review{fill:var(--bad)}.qdot.pending{fill:#9aa0ad}
.qname{font-size:11px;font-weight:800;fill:var(--ink);text-anchor:middle}
.tag{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:800;color:#fff;background:#9aa0ad}
.tag.core{background:var(--good)}.tag.entryOnly{background:var(--warn)}.tag.hidden{background:var(--indigo-bright)}.tag.review{background:var(--bad)}
.lev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:14px}
.lev{padding:14px 16px}
.lev-name{font-weight:800;color:var(--ink);display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.lev-top{font-size:13px;color:var(--ink-soft);margin-bottom:6px}
.lev-list{font-size:12px;color:var(--text-soft);padding-left:18px}
.lev-list li{display:flex;justify-content:space-between;padding:1px 0}
.impact{background:linear-gradient(135deg,var(--ink),var(--indigo));border-radius:12px;padding:18px;color:#fff}
.impact .il{font-size:12px;color:var(--gold-soft);font-weight:700;margin-bottom:6px}
.impact .iv{font-size:22px;font-weight:800;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.impact .iv .delta{font-size:15px;padding:3px 10px;border-radius:20px;font-weight:800}
.impact .iv .delta.up{background:rgba(63,138,110,.35);color:#bdf0d8}
.tm-row{padding:8px 0;border-bottom:1px dashed var(--line)}
.tm-name{font-weight:800;font-size:13px}
.tm-bar{display:flex;align-items:center;gap:8px;margin:4px 0}
.tm-fill{height:10px;background:linear-gradient(90deg,var(--gold-soft),var(--indigo-bright));border-radius:5px;min-width:4px}
.tm-touch{font-size:12px;color:var(--text-soft)}
ul.cm{padding-left:20px;font-size:13px;line-height:1.9}
.slider-row{margin-bottom:12px}
.slider-row .sl-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.slider-row .sl-name{font-size:12px;font-weight:700;color:var(--ink-soft)}
.slider-row .sl-val{font-size:13px;font-weight:800;color:var(--gold)}
input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:6px;background:linear-gradient(90deg,var(--gold-soft),var(--indigo-bright));outline:none}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid var(--indigo);cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2)}
input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:3px solid var(--indigo);cursor:pointer}
.gapbox{display:flex;gap:16px;flex-wrap:wrap;font-weight:800;font-size:14px;margin-bottom:10px}
.gapbox .gap{color:var(--bad)}.gapbox .ok{color:var(--good)}
.reach{display:flex;align-items:center;gap:10px}
.reach-bar{flex:1;height:12px;background:var(--washi-deep);border-radius:6px;overflow:hidden}
.reach-fill{height:100%;background:linear-gradient(90deg,var(--gold-soft),var(--gold));width:0;transition:width .3s}
.reach-fill.ok{background:var(--good)}
.sc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.sc-tabs button{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;color:var(--text-soft)}
.sc-tabs button.active{background:var(--gold);color:var(--ink);border-color:var(--gold)}
.sc-tabs button.ghost{border-style:dashed}
.sc-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.sc-tools .inp{max-width:220px}
.tac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:14px}
.tac-lib{list-style:none;font-size:13px}
.tac-lib li{padding:3px 0}
.footnote{font-size:11px;color:var(--text-soft);margin-top:30px;line-height:1.8;padding:14px 18px;background:rgba(255,255,255,.5);border-radius:10px;border:1px solid var(--line)}
.floatp{position:fixed;right:18px;bottom:18px;z-index:50;background:rgba(26,34,54,.94);backdrop-filter:blur(6px);border:1px solid var(--gold);border-radius:14px;padding:8px;box-shadow:0 8px 30px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:6px;transition:opacity .25s,transform .25s}
.floatp .fpl{font-size:10px;color:var(--gold-soft);font-weight:700;text-align:center;letter-spacing:.1em}
.floatp .fprow{display:flex;gap:5px}
.floatp button{background:rgba(255,255,255,.08);border:none;color:#c9d2e2;font-weight:800;font-size:13px;padding:8px 12px;border-radius:8px;cursor:pointer;min-width:46px}
.floatp button.active{background:var(--gold);color:var(--ink)}
.floatp.hide{opacity:0;transform:translateY(12px);pointer-events:none}
.report-tools{display:flex;align-items:center;gap:12px;margin:10px 0}
.report .rpage{background:#fff;border:1px solid var(--line);border-radius:10px;padding:28px 32px;margin-bottom:18px}
.report .rpage h2{font-size:18px;color:var(--ink);border-left:4px solid var(--gold);padding-left:10px;margin-bottom:14px}
.report .rpage h3{font-size:14px;color:var(--ink-soft);margin:16px 0 8px}
.report .cover{text-align:center;padding:80px 32px}
.report .cover h1{font-size:28px;color:var(--ink);margin:12px 0}
.report .cover .small{font-size:12px;color:var(--text-soft)}
.placeholder{padding:40px;text-align:center;color:var(--text-soft);font-size:13px}
@media(max-width:880px){
  .stepper{grid-template-columns:repeat(2,1fr)}
  .globals{grid-template-columns:1fr}.gbox{border-right:none;border-bottom:1px solid var(--line)}.gbox:last-child{border-bottom:none}
  .kpis{grid-template-columns:1fr 1fr}.basebox{grid-template-columns:1fr}.products{grid-template-columns:1fr}
  .ltable{display:block;overflow-x:auto}
  .floatp{right:12px;bottom:12px}
}
```

- [ ] **Step 8: app.js を書く**

`js/app.js`:
```js
window.Sim = window.Sim || {};
(function () {
  const $ = id => document.getElementById(id);
  const app = { state: null, step: 1, storage: null };
  function getStorage() { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch (e) { return null; } }
  const mods = () => ({ 1: Sim.ui.input, 2: Sim.ui.diagnosis, 3: Sim.ui.plan, 4: Sim.ui.report });
  const api = { update, setStep, getState: () => app.state, get period() { return app.state.store.period; } };
  function persist() { if (app.storage) Sim.state.save(app.state, app.storage); }
  function applyGuide(el) { if (document.body.classList.contains('guide-open')) el.querySelectorAll('details.guide').forEach(d => { d.open = true; }); }
  function update(fn, opts) { opts = opts || {}; fn(app.state); Sim.state.syncScenarios(app.state); persist(); if (opts.structural) renderStep(); else refreshStep(); }
  function renderHeader() {
    const s = app.state.store; $('head-title').textContent = (s.name ? s.name + '｜' : '') + '売上シミュレーター';
    document.title = (s.name ? s.name + '｜' : '') + '店舗 売上シミュレーター';
    document.querySelectorAll('#periodbar button, #floatp button').forEach(b => b.classList.toggle('active', +b.dataset.p === s.period));
  }
  function renderReportPanel() { if (app.step !== 4) Sim.ui.report.render($('panel-4'), app.state, api); }
  function renderStep() { const el = $('panel-' + app.step); mods()[app.step].render(el, app.state, api); applyGuide(el); renderReportPanel(); renderHeader(); }
  function refreshStep() { const el = $('panel-' + app.step); const m = mods()[app.step]; (m.refresh || m.render)(el, app.state, api); renderReportPanel(); renderHeader(); }
  function setStep(n) {
    app.step = n;
    document.querySelectorAll('.step-panel').forEach(p => { p.hidden = +p.dataset.step !== n; });
    document.querySelectorAll('#stepper button').forEach(b => b.classList.toggle('active', +b.dataset.step === n));
    renderStep(); window.scrollTo({ top: 0 });
  }
  function setPeriod(p) { update(s => { s.store.period = p; }, { structural: true }); }
  function replaceState(next) { app.state = next; Sim.state.syncScenarios(app.state); persist(); renderStep(); }
  function exportJson() {
    const blob = new Blob([Sim.state.serialize(app.state)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = Sim.state.exportFilename(app.state);
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const next = Sim.state.parse(r.result);
        if (!confirm('今の内容を、読み込んだ内容で置き換えます。よろしいですか？')) return;
        replaceState(next);
      } catch (e) { alert(e.message === 'unsupported version' ? 'このファイルは新しい形式のため読み込めません。' : 'ファイルの形式が違います。'); }
    };
    r.readAsText(file);
  }
  function init() {
    app.storage = getStorage(); if (!app.storage) $('storage-notice').hidden = false;
    app.state = (app.storage && Sim.state.load(app.storage)) || Sim.state.createSample(); Sim.state.syncScenarios(app.state);
    document.querySelectorAll('#stepper button').forEach(b => { b.onclick = () => setStep(+b.dataset.step); });
    document.querySelectorAll('#periodbar button, #floatp button').forEach(b => { b.onclick = () => setPeriod(+b.dataset.p); });
    document.querySelectorAll('[data-app]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.app;
        if (a === 'export') exportJson();
        if (a === 'sample' && confirm('サンプルデータを読み込み、今の内容を置き換えます。よろしいですか？')) replaceState(Sim.state.createSample());
        if (a === 'reset' && confirm('空の状態から始めます。今の内容は消えます。よろしいですか？')) replaceState(Sim.state.createEmpty());
        if (a === 'guide') { const open = document.body.classList.toggle('guide-open'); document.querySelectorAll('details.guide').forEach(d => { d.open = open; }); b.textContent = open ? 'ガイドを閉じる' : 'ガイドを開く'; }
      };
    });
    $('import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; });
    const fp = $('floatp'), anchor = $('periodbar');
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => fp.classList.toggle('hide', e.isIntersecting)), { threshold: 0 }).observe(anchor);
    setStep(1);
  }
  document.addEventListener('DOMContentLoaded', init);
  Sim.app = { api, setStep, setPeriod, update };
})();
```

- [ ] **Step 9: 暫定モジュール（②③④）を置く**

`js/ui-diagnosis.js`（Task 7 で置換）:
```js
window.Sim = window.Sim || {}; Sim.ui = Sim.ui || {};
(function () { function render(el) { el.innerHTML = '<div class="card placeholder">診断は準備中です（Task 7）</div>'; } Sim.ui.diagnosis = { render, refresh: render }; })();
```
`js/ui-plan.js`（Task 8 で置換）:
```js
window.Sim = window.Sim || {}; Sim.ui = Sim.ui || {};
(function () { function render(el) { el.innerHTML = '<div class="card placeholder">目標と戦略は準備中です（Task 8）</div>'; } Sim.ui.plan = { render, refresh: render }; })();
```
`js/ui-report.js`（Task 9 で置換）:
```js
window.Sim = window.Sim || {}; Sim.ui = Sim.ui || {};
(function () { function render(el) { el.innerHTML = '<div class="card placeholder">レポートは準備中です（Task 9）</div>'; } Sim.ui.report = { render, refresh: render }; })();
```
`css/print.css`（Task 9 で本実装。今は空ファイルでよい）:
```css
/* Task 9 で実装 */
```

- [ ] **Step 10: ui-input.js を書く**

`js/ui-input.js`:
```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  const PER = ['1年で', '2年で', '3年で'];
  let pendingRows = null;

  function prevFields(c, i) {
    const { val } = U(); const p = c.prev;
    return `<div class="basebox">
      <div class="field"><span class="flabel">前期 間口単価</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.entryPrice" value="${val(p.entryPrice)}"></div>
      <div class="field"><span class="flabel">前期 新規獲得人数</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.newCustomers" value="${val(p.newCustomers)}"></div>
      <div class="field"><span class="flabel">前期 同日追加率 %</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.sameDay.rate" value="${val(p.sameDay.rate)}"></div>
      <div class="field"><span class="flabel">前期 初回→追加購入日数</span><input class="inp" type="number" data-type="optnum" data-path="categories.${i}.prev.daysToAddon" value="${val(p.daysToAddon)}"></div>
    </div>
    <table class="yrtable"><tr><th>前期 後日追加</th>${PER.map(p2 => `<th>${p2}</th>`).join('')}</tr>
      <tr><td>追加率<span class="note"> %</span></td>${[0, 1, 2].map(y => `<td><input type="number" data-type="optnum" data-path="categories.${i}.prev.later.${y}.rate" value="${val(p.later[y].rate)}"></td>`).join('')}</tr>
      <tr><td>追加単価<span class="note"> 円</span></td>${[0, 1, 2].map(y => `<td><input type="number" data-type="optnum" data-path="categories.${i}.prev.later.${y}.aov" value="${val(p.later[y].aov)}"></td>`).join('')}</tr></table>
    <button type="button" class="sbtn" data-action="del-prev" data-index="${i}">前期の欄を消す</button>`;
  }
  function categoryCard(c, i, period) {
    const { esc, val, guide } = U(); const yi = period - 1;
    return `<div class="card pcard" data-cat="${c.id}">
      <div class="pcard-head"><input class="pname" data-path="categories.${i}.name" value="${esc(c.name)}" aria-label="間口カテゴリ名"><button type="button" class="del" data-action="del-category" data-index="${i}" title="削除">✕</button></div>
      <div class="pcard-body">
        <div class="basebox">
          <div class="field"><span class="flabel">間口単価<span class="q">最初に買う商品の単価（円・単品）</span></span><input class="inp" type="number" min="0" data-type="num" data-path="categories.${i}.entryPrice" value="${val(c.entryPrice)}"></div>
          <div class="field"><span class="flabel">新規獲得人数<span class="q">この間口で初めて買う人数（1年分）</span></span><input class="inp" type="number" min="0" data-type="num" data-path="categories.${i}.newCustomers" value="${val(c.newCustomers)}"></div>
        </div>
        <div class="subttl">後日追加（初回より後・期間ごとの累計）${guide('初回購入日より後に買った分です。率の母数は新規獲得人数、単価は「追加した人1人あたりの合計額」です。1年→2年→3年と累計なので、通常は増えていきます。')}</div>
        <table class="yrtable"><tr><th></th>${PER.map((p, y) => `<th class="${y === yi ? 'activecol' : ''}">${p}</th>`).join('')}</tr>
          <tr><td>追加率<span class="note"> %</span></td>${[0, 1, 2].map(y => `<td class="${y === yi ? 'activecol' : ''}"><input type="number" min="0" max="100" data-type="num" data-path="categories.${i}.later.${y}.rate" value="${val(c.later[y].rate)}"></td>`).join('')}</tr>
          <tr><td>追加単価<span class="note"> 円</span></td>${[0, 1, 2].map(y => `<td class="${y === yi ? 'activecol' : ''}"><input type="number" min="0" data-type="num" data-path="categories.${i}.later.${y}.aov" value="${val(c.later[y].aov)}"></td>`).join('')}</tr>
        </table>
        <details class="opt"><summary>同日追加・購入までの日数・展開商品（任意）</summary>
          <div class="basebox">
            <div class="field"><span class="flabel">同日追加率<span class="q">初回購入日に間口以外も買った人の割合（%）</span></span><input class="inp" type="number" min="0" max="100" data-type="num" data-path="categories.${i}.sameDay.rate" value="${val(c.sameDay.rate)}"></div>
            <div class="field"><span class="flabel">同日追加単価<span class="q">同日に追加した人1人あたりの額（円）</span></span><input class="inp" type="number" min="0" data-type="num" data-path="categories.${i}.sameDay.aov" value="${val(c.sameDay.aov)}"></div>
            <div class="field"><span class="flabel">初回→追加購入までの日数<span class="q">最初の後日追加までの平均日数</span></span><input class="inp" type="number" min="0" data-type="optnum" data-path="categories.${i}.daysToAddon" value="${val(c.daysToAddon)}"></div>
            <div class="field"><span class="flabel">主な展開商品<span class="q">この間口の次に売れる商品</span></span><input class="inp" type="text" data-path="categories.${i}.nextProducts" value="${esc(c.nextProducts)}"></div>
          </div>
        </details>
        <details class="opt"><summary>前期の数字（任意・入れると前期比の診断が出ます）</summary>
          ${c.prev ? prevFields(c, i) : `<button type="button" class="sbtn" data-action="add-prev" data-index="${i}">前期の欄を追加</button>`}
        </details>
        <div class="pltv" data-out="ltv-${c.id}"></div>
      </div></div>`;
  }
  function render(el, state, api) {
    const { esc, val, guide } = U(); const s = state.store; const b = state.benchmarks; const period = s.period;
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>店舗の前提</h2><span class="hint">店全体の数字</span></div>
      <div class="card globals">
        <div class="gbox"><label>店名</label><input type="text" data-path="store.name" value="${esc(s.name)}" placeholder="○○店"></div>
        <div class="gbox"><label>決算期（表示用）</label><input type="text" data-path="store.fiscalLabel" value="${esc(s.fiscalLabel)}" placeholder="2026年度（4月〜3月）"></div>
        <div class="gbox"><label>原価率（物販）${guide('売上に対する仕入原価の割合です。粗利＝売上×（1−原価率）で計算します。')}</label><div class="row"><input type="number" min="0" max="100" data-type="num" data-path="store.cogsRate" value="${val(s.cogsRate)}"><span class="unit">%</span></div></div>
        <div class="gbox"><label>固定費（任意・月額）</label><div class="row"><input type="number" min="0" step="10000" data-type="num" data-path="store.fixedCostMonthly" value="${val(s.fixedCostMonthly)}"><span class="unit">円/月</span></div></div>
      </div>
      <div class="sec-title"><span class="no">2</span><h2>間口カテゴリ</h2><span class="hint">最初に買ってもらう商品のくくりごとに入力${guide('「間口」＝新規のお客様が最初に買う商品のくくりです。レジや帳簿で「初めてのお客様が最初に買った物」を数えると出せます。人数が10人未満のカテゴリは診断を保留します。')}</span></div>
      <div class="products">${state.categories.map((c, i) => categoryCard(c, i, period)).join('')}</div>
      <button type="button" class="addbtn" data-action="add-category">＋ 間口カテゴリを追加</button>
      <div class="warnings" data-out="warnings"></div>
      <details class="card optblock"><summary>集客経路（任意）— 経路ごとの新規人数と費用からCPAを出します</summary>
        <div class="optbody"><table class="ltable"><tr><th>経路名</th><th>新規人数</th><th>費用（円・期間合計）</th><th>CPA</th><th></th></tr>
          ${state.channels.map((ch, i) => `<tr><td><input type="text" data-path="channels.${i}.name" value="${esc(ch.name)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.newCustomers" value="${val(ch.newCustomers)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.cost" value="${val(ch.cost)}"></td><td data-out="cpa-${ch.id}"></td><td><button type="button" class="del dark" data-action="del-channel" data-index="${i}">✕</button></td></tr>`).join('')}
        </table><button type="button" class="sbtn" data-action="add-channel">＋ 経路を追加</button>
        <p class="note-p">経路の新規合計と間口カテゴリの新規合計は一致しなくて構いません（経路＝入口の話、カテゴリ＝買った物の話です）。</p></div>
      </details>
      <details class="card optblock"><summary>目安値（任意）— 業界平均や自社の目標など、比べたい数字があれば</summary>
        <div class="optbody basebox">
          <div class="field"><span class="flabel">同日追加率の目安 %</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.sameDayRate" value="${val(b.sameDayRate)}"></div>
          <div class="field"><span class="flabel">初回→追加購入日数の目安</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.daysToAddon" value="${val(b.daysToAddon)}"></div>
          ${[0, 1, 2].map(y => `<div class="field"><span class="flabel">後日追加率の目安（${PER[y]}）%</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.laterRate.${y}" value="${val(b.laterRate[y])}"></div>`).join('')}
          ${[0, 1, 2].map(y => `<div class="field"><span class="flabel">後日追加単価の目安（${PER[y]}）円</span><input class="inp" type="number" data-type="optnum" data-path="benchmarks.laterAov.${y}" value="${val(b.laterAov[y])}"></div>`).join('')}
        </div>
      </details>
      <details class="card optblock" id="paste-block"><summary>CRM／表から貼り付け — ExcelやCRMの実測表をコピーして貼ると各欄に振り分けます</summary>
        <div class="optbody">
          <p class="note-p">1行目に見出し（間口カテゴリ／期間／新規獲得数／間口単価／同日追加率／後日追加率…、または entry_category / period_years / new_customers …）を含めてください。同じカテゴリの行が複数ある場合は人数で加重平均します。「初回→追加購入までの日数」は貼り付け対象外のため手入力です。</p>
          <textarea id="paste-text" rows="6" placeholder="ここに貼り付け"></textarea>
          <button type="button" class="sbtn" data-action="paste-preview">プレビュー</button>
          <div id="paste-preview"></div>
        </div>
      </details>`;
    outputs(el, state);
    U().bindPanel(el, api, actions(api));
  }
  function renderPreview(res, api) {
    const { esc, fmt, fmt1 } = U(); const box = document.getElementById('paste-preview'); if (!box) return;
    const names = new Set(api.getState().categories.map(c => c.name));
    box.innerHTML = (res.warnings.length ? `<ul class="warn">${res.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '') +
      (res.rows.length ? `<table class="ltable"><tr><th>カテゴリ</th><th>期間</th><th>新規</th><th>間口単価</th><th>同日率</th><th>同日単価</th><th>後日率</th><th>後日単価</th><th>実測LTV（参考）</th><th>扱い</th></tr>
        ${res.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.period}年</td><td>${fmt(r.newCustomers)}</td><td>${fmt(r.entryPrice)}</td><td>${fmt1(r.sameDayRate)}</td><td>${fmt(r.sameDayAov)}</td><td>${fmt1(r.laterRate)}</td><td>${fmt(r.laterAov)}</td><td>${fmt(r.measuredLtv)}</td><td>${names.has(r.name) ? '上書き' : '追加'}</td></tr>`).join('')}</table>
        <button type="button" class="sbtn primary" data-action="paste-apply">取り込む</button>` : '<p class="note-p">取り込める行がありません。</p>');
  }
  function actions(api) {
    return {
      'add-category': () => api.update(s => { s.categories.push(Sim.state.newCategory({ name: '新しい間口カテゴリ', entryPrice: 8000, newCustomers: 30, later: [{ rate: 30, aov: 6000 }, { rate: 45, aov: 9000 }, { rate: 55, aov: 11000 }] })); }, { structural: true }),
      'del-category': d => { if (!confirm('この間口カテゴリを削除しますか？')) return; api.update(s => { s.categories.splice(+d.index, 1); }, { structural: true }); },
      'add-prev': d => api.update(s => { s.categories[+d.index].prev = Sim.state.emptyPrev(); }, { structural: true }),
      'del-prev': d => api.update(s => { s.categories[+d.index].prev = null; }, { structural: true }),
      'add-channel': () => api.update(s => { s.channels.push(Sim.state.newChannel()); }, { structural: true }),
      'del-channel': d => api.update(s => { s.channels.splice(+d.index, 1); }, { structural: true }),
      'paste-preview': () => { const text = document.getElementById('paste-text').value; const res = Sim.paste.parse(text, { period: api.period }); pendingRows = res.rows; renderPreview(res, api); },
      'paste-apply': () => { if (!pendingRows || !pendingRows.length) return; const rows = pendingRows; pendingRows = null; api.update(s => { const r = Sim.paste.apply(s, rows); Object.assign(s, r.state); }, { structural: true }); }
    };
  }
  function outputs(el, state) {
    const { yen, fmt, esc } = U(); const period = state.store.period; const st = Sim.calc.store(state, period);
    st.categories.forEach(c => {
      const box = el.querySelector(`[data-out="ltv-${c.id}"]`);
      if (box) box.innerHTML = `<div class="pltv-row"><span>間口購入</span><span>${yen(c.entryPrice)}</span></div><div class="pltv-row"><span>同日追加ぶん</span><span>${yen(c.sameDayPart)}</span></div><div class="pltv-row"><span>後日追加ぶん（${period}年累計）</span><span>${yen(c.laterPart)}</span></div><div class="pltv-row pltv-total"><span>顧客あたりLTV（${period}年）</span><span>${yen(c.ltv)}</span></div>`;
    });
    st.channels.forEach(ch => { const td = el.querySelector(`[data-out="cpa-${ch.id}"]`); if (td) td.textContent = ch.cpa == null ? '—' : '¥' + fmt(ch.cpa); });
    const w = Sim.analysis.checks(state); const wb = el.querySelector('[data-out="warnings"]');
    if (wb) wb.innerHTML = w.length ? `<ul class="warn">${w.map(x => `<li>${esc(x.message)}</li>`).join('')}</ul>` : '';
  }
  Sim.ui.input = { render, refresh: outputs };
})();
```

- [ ] **Step 11: ブラウザで手動確認**

`index.html` をダブルクリック（`file://`）で開き、次を確認する。

| 確認 | 期待 |
|---|---|
| 初回表示 | サンプル寝具店・カテゴリ2件・枕のLTV（3年）が ¥35,120 |
| 「2年で見る」を押す | 2年列が金色にハイライトされ、枕のLTVが ¥26,300（12000+0.55×26000） |
| 枕の新規獲得人数を 5 にする | 黄色の注意「新規獲得人数が10人未満…」が出る。入力のフォーカスは外れない |
| 後日追加率2年を 30 にする | 「1年≦2年≦3年 が通常です」の注意が出る |
| ＋間口カテゴリを追加 → ✕で削除 | 追加・確認ダイアログ・削除が動く |
| 貼り付け欄に `間口カテゴリ\t新規獲得数\t間口単価\n掛け布団\t12\t30000` を貼ってプレビュー→取り込む | 「掛け布団」が「追加」表示で入り、カードが増える |
| ページ再読み込み | 直前の入力が復元される |
| 書き出し → 空で始める → 読み込み | JSONが保存され、読み込むと元に戻る |
| 「ガイドを開く」 | ？の説明が全て展開される |
| ウィンドウ幅を 400px に | カードが1列、横スクロールが出ない |

- [ ] **Step 12: コミット**

```bash
git add index.html css/style.css css/print.css js/ui-util.js js/app.js js/ui-input.js js/ui-diagnosis.js js/ui-plan.js js/ui-report.js tests/ui-util.test.js
git commit -m "feat(v2): ページ骨組み・ステッパー・保存/読込・①現状入力"
```

---

### Task 7: ②診断画面（ui-diagnosis.js）

**Files:**
- Modify: `js/ui-diagnosis.js`（暫定を全面置換）

**Interfaces:**
- Consumes: `Sim.calc.store`、`Sim.analysis.portfolio / leverage / weakness / timing / comments`、`Sim.ui.util`
- Produces: `Sim.ui.diagnosis = { render, refresh, parts:{ kpis(st), table(st), quadrantSvg(pf), leverageBlock(lv), weaknessBlock(wk), timingBlock(tm) } }`（`parts` は Task 9 のレポートが再利用する）

- [ ] **Step 1: ui-diagnosis.js を書く**

`js/ui-diagnosis.js`（全文置換）:
```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  function kpis(st) {
    const { yen, fmt } = U();
    return `<div class="kpis">
      <div class="kpi"><div class="klab">新規獲得（合計）</div><div class="kval">${fmt(st.newTotal)}<span class="yen"> 人</span></div><div class="ksub">全間口カテゴリの新規</div></div>
      <div class="kpi"><div class="klab">加重平均LTV（顧客あたり）</div><div class="kval">${yen(st.weightedLtv)}</div><div class="ksub">${st.period}年で見た累計</div></div>
      <div class="kpi"><div class="klab">期間累計 売上</div><div class="kval">${yen(st.revenue)}</div><div class="ksub">新規 × LTV</div></div>
      <div class="kpi accent"><div class="klab">期間累計 粗利</div><div class="kval">${yen(st.grossProfit)}</div><div class="ksub">${st.operatingProfit != null ? `固定費 ${yen(st.fixedTotal)} → 営業利益 <b>${yen(st.operatingProfit)}</b>` : '売上 ×（1 − 原価率）'}</div></div>
    </div>`;
  }
  function table(st) {
    const { yen, fmt, fmt1, esc } = U();
    let html = `<table class="ltable"><tr><th>間口カテゴリ</th><th>新規</th><th>間口単価</th><th>同日追加/人</th><th>後日追加/人</th><th>LTV</th><th>売上</th><th>構成比</th></tr>
      ${st.categories.map(c => `<tr><td>${esc(c.name)}</td><td>${fmt(c.newN)}</td><td>${yen(c.entryPrice)}</td><td>${yen(c.sameDayPart)}</td><td>${yen(c.laterPart)}</td><td>${yen(c.ltv)}</td><td>${yen(c.revenue)}</td><td>${fmt1(c.share * 100)}%</td></tr>`).join('')}</table>`;
    if (st.channels.length) html += `<h3 class="h3">集客経路</h3><table class="ltable"><tr><th>経路</th><th>新規</th><th>費用</th><th>CPA</th><th>粗利LTV ÷ CPA</th></tr>
      ${st.channels.map(ch => `<tr><td>${esc(ch.name)}</td><td>${fmt(ch.newCustomers)}</td><td>${yen(ch.cost)}</td><td>${yen(ch.cpa)}</td><td>${ch.payback == null ? '—' : fmt1(ch.payback) + '倍'}</td></tr>`).join('')}</table>`;
    return html;
  }
  function quadrantSvg(pf) {
    const { esc, yen } = U();
    if (!pf.available) return `<p class="note-p">${esc(pf.reason)}</p>`;
    const W = 560, H = 400, P = 50;
    const maxX = Math.max(...pf.points.map(p => p.x), pf.xBoundary) * 1.15 || 1, maxY = Math.max(...pf.points.map(p => p.y), pf.yBoundary) * 1.15 || 1;
    const sx = x => P + (x / maxX) * (W - 2 * P), sy = y => H - P - (y / maxY) * (H - 2 * P);
    const bx = sx(pf.xBoundary), by = sy(pf.yBoundary);
    const lab = (x, y, t, cls) => `<text x="${x}" y="${y}" class="qlab ${cls || ''}">${t}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="quad" role="img" aria-label="間口ポートフォリオ">
      <rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" class="qbg"/>
      <line x1="${bx}" y1="${P}" x2="${bx}" y2="${H - P}" class="qline"/><line x1="${P}" y1="${by}" x2="${W - P}" y2="${by}" class="qline"/>
      ${lab(W - P - 4, P + 14, '主力（伸ばす）', 'end')}${lab(W - P - 4, H - P - 6, '入口止まり（育てる）', 'end')}${lab(P + 4, P + 14, '隠れた優良間口（集客を寄せる）', '')}${lab(P + 4, H - P - 6, '見直す', '')}
      <text x="${W / 2}" y="${H - 12}" class="qaxis">集客力（新規 × 間口単価）→</text>
      <text x="14" y="${H / 2}" class="qaxis" transform="rotate(-90 14 ${H / 2})">展開力（新規1人あたりの追加額）→</text>
      ${pf.points.map(p => { const r = 8 + Math.sqrt(p.share) * 28; return `<g><circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${r}" class="qdot ${p.pending ? 'pending' : p.quadrant}"/><text x="${sx(p.x)}" y="${sy(p.y) - r - 4}" class="qname">${esc(p.name)}</text></g>`; }).join('')}
    </svg>
    <table class="ltable"><tr><th>間口カテゴリ</th><th>位置づけ</th><th>集客力</th><th>展開力</th></tr>
      ${pf.points.map(p => `<tr><td>${esc(p.name)}</td><td><span class="tag ${p.pending ? 'pending' : p.quadrant}">${p.label}</span></td><td>${yen(p.x)}</td><td>${yen(p.y)}</td></tr>`).join('')}</table>`;
  }
  function leverageBlock(lv) {
    const { esc, yen } = U();
    return `<div class="lev-grid">${lv.perCategory.map(c => `<div class="card lev"><div class="lev-name">${esc(c.name)}${c.pending ? '<span class="tag pending">判定保留</span>' : ''}</div>
        ${c.top ? `<div class="lev-top">最も効く：<b>${c.top.label}</b>（${yen(c.top.delta)} 増）</div>` : '<div class="lev-top">効くレバーがありません（入力をご確認ください）</div>'}
        <ol class="lev-list">${c.ranked.map(r => `<li><span>${r.label}</span><span>${yen(r.delta)}</span></li>`).join('')}</ol></div>`).join('')}</div>
      <div class="impact"><div class="il">店全体で最も効くレバー（標準幅：新規+10%／同日率+5pt／後日率+5pt／追加単価+10%／間口単価+5%）</div>
        <div class="iv">${lv.store.top ? `${esc(lv.store.top.label)}<span class="delta up">${yen(lv.store.top.delta)} 増</span>` : '—'}</div></div>`;
  }
  function weaknessBlock(wk) {
    const { esc, fmt1 } = U(); const modeLabel = { benchmark: '目安値との比較', prev: '前期との比較', relative: '店内の相対比較' }[wk.mode];
    return `<p class="note-p">物差し：${modeLabel}${wk.hint ? `　${esc(wk.hint)}` : ''}</p>` +
      (wk.items.length ? `<table class="ltable"><tr><th>間口カテゴリ</th><th>項目</th><th>実績</th><th>比較先</th><th>比率</th></tr>
        ${wk.items.map((it, i) => `<tr class="${i === 0 ? 'worst' : ''}"><td>${esc(it.name)}</td><td>${esc(it.metric)}</td><td>${fmt1(it.actual)}${it.unit}</td><td>${fmt1(it.reference)}${it.unit}</td><td>${fmt1(it.ratio * 100)}%</td></tr>`).join('')}</table>` : '<p class="note-p">比較できる項目がありません。</p>');
  }
  function timingBlock(tm) {
    const { esc } = U();
    if (!tm.length) return '<p class="note-p">①で「初回→追加購入までの日数」を入れると、フォローの打ち時が出ます。</p>';
    const max = Math.max(...tm.map(t => t.days), 1);
    return tm.map(t => `<div class="tm-row"><div class="tm-name">${esc(t.name)}</div>
      <div class="tm-bar"><div class="tm-fill" style="width:${Math.min(100, t.days / max * 100)}%"></div><span>${t.days}日</span></div>
      <div class="tm-touch">${t.touchpoints.map(p => `${p.label}：${p.day}日目`).join(' ／ ')}</div>${t.warning ? `<div class="warn-inline">${esc(t.warning)}</div>` : ''}</div>`).join('');
  }
  function render(el, state) {
    const { esc, guide } = U(); const period = state.store.period;
    const st = Sim.calc.store(state, period); const pf = Sim.analysis.portfolio(state, period); const lv = Sim.analysis.leverage(state, period);
    const wk = Sim.analysis.weakness(state, period); const tm = Sim.analysis.timing(state, period); const cm = Sim.analysis.comments(state, period);
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>現状サマリー（${period}年で見た場合）</h2></div>${kpis(st)}<div class="card pad">${table(st)}</div>
      <div class="sec-title"><span class="no">2</span><h2>間口ポートフォリオ</h2><span class="hint">横＝集客力、縦＝展開力。境界は店内の中央値${guide('横軸は「新規×間口単価」（入口としてどれだけ売上を作るか）、縦軸は「LTV−間口単価」（入口の後に1人がどれだけ追加で買うか）です。境界は店内カテゴリの中央値なので、他店との比較ではなく自店内の相対的な位置づけです。')}</span></div><div class="card pad">${quadrantSvg(pf)}</div>
      <div class="sec-title"><span class="no">3</span><h2>効きどころ</h2><span class="hint">標準的な改善幅を当てたとき、どのレバーが売上を最も動かすか</span></div>${leverageBlock(lv)}
      <div class="sec-title"><span class="no">4</span><h2>弱点候補</h2><span class="hint">${guide('目安値（①の任意欄）があればそれと、前期の数字があればそれと比較します。どちらも無い場合は店内の加重平均より低い率を挙げます。')}</span></div><div class="card pad">${weaknessBlock(wk)}</div>
      <div class="sec-title"><span class="no">5</span><h2>購入までの期間とフォローの打ち時</h2></div><div class="card pad">${timingBlock(tm)}</div>
      <div class="sec-title"><span class="no">6</span><h2>診断コメント</h2></div><div class="card pad"><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  Sim.ui.diagnosis = { render, refresh: render, parts: { kpis, table, quadrantSvg, leverageBlock, weaknessBlock, timingBlock } };
})();
```

- [ ] **Step 2: テスト（純関数側）が引き続き通ることを確認**

Run: `node tests/run.js`
Expected: `50 passed, 0 failed`

- [ ] **Step 3: ブラウザで手動確認**

| 確認 | 期待 |
|---|---|
| ②診断タブ（サンプル・3年） | KPI：新規100人／LTV ¥23,768／売上 ¥2,376,800／粗利 ¥1,188,400 |
| 象限図 | 枕＝緑の点「主力（伸ばす）」右上、敷きもの＝赤「見直す」左下。点の上に名前 |
| 効きどころ | 枕の最上位＝新規獲得人数（¥140,480 増）。店全体＝新規獲得人数 ¥237,680 増 |
| 弱点候補 | 「店内の相対比較」＋案内文。枕の後日追加率（店平均比）68% / 78.2% |
| ①で目安値「後日追加率3年＝80」を入れて②へ | 物差しが「目安値との比較」になり、最下段の比率行が赤背景 |
| 期間の打ち時 | 枕 45日：同日0／中間23／目安45 |
| ①で枕の新規を5にして② | 枕がグレー「判定保留」、コメントに「判定は保留」 |
| ①でカテゴリを1件にして② | 象限図の代わりに「1件のため象限図は出しません」 |
| 幅400px | SVGが縮小され横スクロールなし |

- [ ] **Step 4: コミット**

```bash
git add js/ui-diagnosis.js
git commit -m "feat(v2): ②診断画面（サマリー・4象限・効きどころ・弱点・打ち時・コメント）"
```

---

### Task 8: ③目標と戦略（ui-plan.js）

**Files:**
- Modify: `js/ui-plan.js`（暫定を全面置換）

**Interfaces:**
- Consumes: `Sim.calc.store / reverse / evenSplit / crmTargets`、`Sim.state.newScenario / emptyLevers`、`Sim.tactics.LIBRARY / resolve`、`Sim.ui.util`
- Produces: `Sim.ui.plan = { render, refresh, parts:{ reverseTable(r), comparison(state, period), LEVERS, TACTIC_LEVERS } }`
  - `LEVERS` = `[{key:'newPct',label:'新規獲得人数',unit:'%',min:-50,max:100,step:5}, {key:'sameDayPt',label:'同日追加率',unit:'pt',min:-30,max:50,step:1}, {key:'laterPt',label:'後日追加率',unit:'pt',min:-30,max:50,step:1}, {key:'aovPct',label:'追加単価',unit:'%',min:-30,max:50,step:1}, {key:'entryPricePct',label:'間口単価',unit:'%',min:-30,max:50,step:1}]`
  - `TACTIC_LEVERS` = `[['new','新規獲得'],['sameDay','同日追加'],['later','後日追加'],['aov','追加単価'],['entryPrice','間口単価']]`

- [ ] **Step 1: ui-plan.js を書く**

`js/ui-plan.js`（全文置換）:
```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  const LEVERS = [
    { key: 'newPct', label: '新規獲得人数', unit: '%', min: -50, max: 100, step: 5 },
    { key: 'sameDayPt', label: '同日追加率', unit: 'pt', min: -30, max: 50, step: 1 },
    { key: 'laterPt', label: '後日追加率', unit: 'pt', min: -30, max: 50, step: 1 },
    { key: 'aovPct', label: '追加単価', unit: '%', min: -30, max: 50, step: 1 },
    { key: 'entryPricePct', label: '間口単価', unit: '%', min: -30, max: 50, step: 1 }
  ];
  const TACTIC_LEVERS = [['new', '新規獲得'], ['sameDay', '同日追加'], ['later', '後日追加'], ['aov', '追加単価'], ['entryPrice', '間口単価']];
  const leverLabel = k => (TACTIC_LEVERS.find(x => x[0] === k) || ['', ''])[1];

  function reverseTable(r) {
    const { fmt, fmt1, yen } = U();
    if (!r) return '<p class="note-p">目標売上を入れると、レバーごとの必要量が出ます。</p>';
    const L = r.levers; const na = '<td colspan="2">—（入力がないため計算できません）</td>'; const row = (name, cell) => `<tr><td>${name}</td>${cell}</tr>`;
    const nf = ok => (ok ? '' : '（このレバー単独では届きません）');
    const head = r.gap <= 0 ? `<div class="gapbox"><span>現状 ${yen(r.current)}</span><span>目標 ${yen(r.target)}</span><span class="ok">達成済み（余裕 ${yen(-r.gap)}）</span></div>`
      : `<div class="gapbox"><span>現状 ${yen(r.current)}</span><span>目標 ${yen(r.target)}</span><span class="gap">ギャップ ${yen(r.gap)}</span></div>`;
    return head + `<table class="ltable"><tr><th>レバー（単独で達成する場合）</th><th>必要量</th><th>今 → 必要値</th></tr>
      ${row('新規獲得人数', L.new ? `<td>${fmt(L.new.neededCount)}人 追加</td><td>${fmt(L.new.from)}人 → ${fmt(L.new.to)}人</td>` : na)}
      ${row('同日追加率', L.sameDay ? `<td>${fmt1(L.sameDay.neededPt)}pt</td><td>${fmt1(L.sameDay.from)}% → ${fmt1(L.sameDay.to)}%${nf(L.sameDay.feasible)}</td>` : na)}
      ${row('後日追加率', L.later ? `<td>${fmt1(L.later.neededPt)}pt</td><td>${fmt1(L.later.from)}% → ${fmt1(L.later.to)}%${nf(L.later.feasible)}</td>` : na)}
      ${row('追加単価', L.aov ? `<td>${fmt1(L.aov.neededPct)}%</td><td>同日・後日の追加単価を一律に引き上げ</td>` : na)}
      ${row('間口単価', L.entryPrice ? `<td>${fmt1(L.entryPrice.neededPct)}%</td><td>全カテゴリの間口単価を一律に引き上げ</td>` : na)}
    </table>`;
  }
  function scenarioTabs(plan) {
    const { esc } = U();
    return `<div class="sc-tabs">${plan.scenarios.map((sc, i) => `<button type="button" class="${i === plan.activeScenario ? 'active' : ''}" data-action="sc-select" data-index="${i}">${esc(sc.name)}</button>`).join('')}
      ${plan.scenarios.length < 3 ? '<button type="button" class="ghost" data-action="sc-add">＋ 追加</button>' : ''}</div>`;
  }
  function leverCards(state, sc, si) {
    const { esc, val } = U();
    return `<div class="products">${state.categories.map(c => { const l = sc.levers[c.id] || Sim.state.emptyLevers();
      return `<div class="card pcard"><div class="pcard-head"><span class="pname-static">${esc(c.name)}</span></div><div class="pcard-body">
        ${LEVERS.map(L => `<div class="slider-row"><div class="sl-top"><span class="sl-name">${L.label}</span><span class="sl-val" data-out="sv-${c.id}-${L.key}"></span></div>
          <input type="range" min="${L.min}" max="${L.max}" step="${L.step}" data-type="num" data-path="plan.scenarios.${si}.levers.${c.id}.${L.key}" value="${val(l[L.key])}" aria-label="${esc(c.name)} ${L.label}"></div>`).join('')}
        <div class="pltv" data-out="sc-cat-${c.id}"></div></div></div>`; }).join('')}</div>`;
  }
  function tacticsBlock(sc, si, state) {
    const { esc } = U(); const lib = Sim.tactics.LIBRARY;
    return `<div class="tac-grid">${TACTIC_LEVERS.map(([k, label]) => `<div class="card pad"><h3 class="h3">${label}</h3><ul class="tac-lib">
        ${lib[k].map(t => { const text = Sim.tactics.resolve(t, state); const chosen = sc.tactics.some(x => x.fromLibrary && x.lever === k && x.text === text);
          return `<li><label><input type="checkbox" data-action="tac-toggle" data-lever="${k}" data-text="${esc(text)}" ${chosen ? 'checked' : ''}> ${esc(text)}</label></li>`; }).join('')}</ul>
        <button type="button" class="sbtn" data-action="tac-add" data-lever="${k}">＋ 自由記述を追加</button></div>`).join('')}</div>
      <h3 class="h3">選んだ打ち手</h3>
      ${sc.tactics.length ? `<table class="ltable"><tr><th>レバー</th><th>打ち手</th><th>担当</th><th>期限</th><th></th></tr>
        ${sc.tactics.map((t, i) => `<tr><td>${leverLabel(t.lever)}</td><td><input type="text" data-path="plan.scenarios.${si}.tactics.${i}.text" value="${esc(t.text)}" placeholder="打ち手を書く"></td><td><input type="text" data-path="plan.scenarios.${si}.tactics.${i}.owner" value="${esc(t.owner)}" placeholder="担当"></td><td><input type="text" data-path="plan.scenarios.${si}.tactics.${i}.due" value="${esc(t.due)}" placeholder="例 11月末"></td><td><button type="button" class="del dark" data-action="tac-del" data-index="${i}">✕</button></td></tr>`).join('')}</table>` : '<p class="note-p">まだ打ち手がありません。上の定型から選ぶか、自由記述を追加してください。</p>'}
      <label class="flabel">メモ</label><textarea data-path="plan.scenarios.${si}.memo" rows="3">${esc(sc.memo)}</textarea>`;
  }
  function comparison(state, period) {
    const { esc, yen, fmt1 } = U(); const t = state.plan.targetRevenue[period - 1];
    return `<table class="ltable"><tr><th>シナリオ</th><th>売上（${period}年累計）</th><th>粗利</th><th>目標到達率</th></tr>
      ${state.plan.scenarios.map(sc => { const st = Sim.calc.store(state, period, sc.levers); return `<tr><td>${esc(sc.name)}</td><td>${yen(st.revenue)}</td><td>${yen(st.grossProfit)}</td><td>${t > 0 ? fmt1(st.revenue / t * 100) + '%' : '—'}</td></tr>`; }).join('')}</table>`;
  }
  function crmBlock(state, period, sc) {
    const { esc } = U(); const rows = Sim.calc.crmTargets(state, period, sc);
    return `<details class="card optblock"><summary>CRM転記用（ねむねむCRMの目標入力フォーム向け・他店は不要）</summary><div class="optbody">
      <table class="ltable" id="crm-table"><tr><th>間口カテゴリ</th><th>期間</th><th>間口単価</th><th>目標新規獲得人数</th><th>追加購入単価</th><th>追加購入率</th></tr>
        ${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.period}</td><td>${r.entryPrice}</td><td>${r.newCustomers}</td><td>${r.addonAov}</td><td>${r.addonRate}</td></tr>`).join('')}</table>
      <button type="button" class="sbtn" data-action="crm-copy">タブ区切りでコピー</button>
      <p class="note-p">追加購入率＝1−(1−同日率)(1−後日率)、追加購入単価＝期待追加額÷追加購入率（同日と後日が独立に起きる仮定で束ねた値です）。</p></div></details>`;
  }
  function render(el, state, api) {
    const { val, esc, guide } = U(); const period = state.store.period; const plan = state.plan; const si = plan.activeScenario; const sc = plan.scenarios[si];
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>目標設定と逆算（${period}年で見た場合）</h2><span class="hint">${guide('期間累計の目標売上を入れると、現状とのギャップと「レバー1本だけで埋める場合の必要量」が出ます。実際は複数のレバーを組み合わせるので、下のシナリオで配分します。')}</span></div>
      <div class="card globals">
        <div class="gbox"><label>目標売上（${period}年累計）</label><div class="row"><input type="number" min="0" step="100000" data-type="optnum" data-path="plan.targetRevenue.${period - 1}" value="${val(plan.targetRevenue[period - 1])}"><span class="unit">円</span></div></div>
        <div class="gbox"><label>現状の売上（${period}年累計）</label><div class="row"><span class="bigval" data-out="cur-rev"></span></div></div>
        <div class="gbox"><label>目標到達率（選択中シナリオ）</label><div class="reach"><div class="reach-bar"><div class="reach-fill" data-out="reach-fill"></div></div><span data-out="reach-val"></span></div></div>
      </div>
      <div class="card pad" data-out="reverse"></div>
      <div class="sec-title"><span class="no">2</span><h2>レバー配分（シナリオ）</h2><span class="hint">最大3本。「均等に割り振る」を出発点に手で調整</span></div>
      ${scenarioTabs(plan)}
      <div class="sc-tools"><input type="text" class="inp" data-path="plan.scenarios.${si}.name" value="${esc(sc.name)}" aria-label="シナリオ名">
        <button type="button" class="sbtn" data-action="sc-even">均等に割り振る</button><button type="button" class="sbtn" data-action="sc-reset">0に戻す</button>
        <button type="button" class="sbtn" data-action="sc-copy">複製</button>${plan.scenarios.length > 1 ? '<button type="button" class="sbtn danger" data-action="sc-del">削除</button>' : ''}</div>
      ${leverCards(state, sc, si)}
      <div class="sec-title"><span class="no">3</span><h2>打ち手</h2><span class="hint">レバーごとに定型から選ぶ＋自由記述。担当と期限を書けます</span></div>${tacticsBlock(sc, si, state)}
      <div class="sec-title"><span class="no">4</span><h2>シナリオ比較</h2></div><div class="card pad" data-out="compare"></div>
      ${crmBlock(state, period, sc)}`;
    outputs(el, state); U().bindPanel(el, api, actions(api));
  }
  function outputs(el, state) {
    const { yen, fmt1, signed } = U(); const period = state.store.period; const plan = state.plan; const sc = plan.scenarios[plan.activeScenario];
    const target = plan.targetRevenue[period - 1]; const base = Sim.calc.store(state, period); const now = Sim.calc.store(state, period, sc.levers);
    const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    set('cur-rev', yen(base.revenue));
    const reach = target > 0 ? now.revenue / target * 100 : null;
    set('reach-val', reach == null ? '目標未設定' : fmt1(reach) + '%（' + yen(now.revenue) + '）');
    const rf = el.querySelector('[data-out="reach-fill"]'); if (rf) { rf.style.width = (reach == null ? 0 : Math.min(100, reach)) + '%'; rf.classList.toggle('ok', reach != null && reach >= 100); }
    set('reverse', reverseTable(Sim.calc.reverse(state, period, target)));
    state.categories.forEach(c => {
      const l = sc.levers[c.id] || {}; LEVERS.forEach(L => set(`sv-${c.id}-${L.key}`, signed(l[L.key] || 0, L.unit)));
      const b = base.categories.find(x => x.id === c.id), n = now.categories.find(x => x.id === c.id); const d = n.revenue - b.revenue;
      set(`sc-cat-${c.id}`, `<div class="pltv-row"><span>売上（基準）</span><span>${yen(b.revenue)}</span></div><div class="pltv-row"><span>売上（この配分）</span><span>${yen(n.revenue)}</span></div><div class="pltv-row pltv-total"><span>差</span><span>${(d >= 0 ? '+' : '−') + yen(Math.abs(d))}</span></div>`);
    });
    set('compare', comparison(state, period));
  }
  function actions(api) {
    return {
      'sc-select': d => api.update(s => { s.plan.activeScenario = +d.index; }, { structural: true }),
      'sc-add': () => api.update(s => { if (s.plan.scenarios.length >= 3) return; s.plan.scenarios.push(Sim.state.newScenario('シナリオ' + (s.plan.scenarios.length + 1), s.categories)); s.plan.activeScenario = s.plan.scenarios.length - 1; }, { structural: true }),
      'sc-copy': () => api.update(s => { if (s.plan.scenarios.length >= 3) return; const src = s.plan.scenarios[s.plan.activeScenario]; s.plan.scenarios.push(JSON.parse(JSON.stringify(Object.assign({}, src, { name: src.name + 'のコピー' })))); s.plan.activeScenario = s.plan.scenarios.length - 1; }, { structural: true }),
      'sc-del': () => { if (!confirm('このシナリオを削除しますか？')) return; api.update(s => { if (s.plan.scenarios.length <= 1) return; s.plan.scenarios.splice(s.plan.activeScenario, 1); s.plan.activeScenario = Math.max(0, s.plan.activeScenario - 1); }, { structural: true }); },
      'sc-even': () => api.update(s => { const p = s.store.period; const lv = Sim.calc.evenSplit(s, p, s.plan.targetRevenue[p - 1]); const sc = s.plan.scenarios[s.plan.activeScenario];
        Object.keys(lv).forEach(id => { const L = lv[id]; sc.levers[id] = { newPct: Math.round(L.newPct), sameDayPt: Math.round(L.sameDayPt), laterPt: Math.round(L.laterPt), aovPct: Math.round(L.aovPct), entryPricePct: Math.round(L.entryPricePct) }; }); }, { structural: true }),
      'sc-reset': () => api.update(s => { const sc = s.plan.scenarios[s.plan.activeScenario]; s.categories.forEach(c => { sc.levers[c.id] = Sim.state.emptyLevers(); }); }, { structural: true }),
      'tac-toggle': (d, el) => api.update(s => { const sc = s.plan.scenarios[s.plan.activeScenario]; const idx = sc.tactics.findIndex(t => t.fromLibrary && t.lever === d.lever && t.text === d.text);
        if (el.checked && idx < 0) sc.tactics.push({ lever: d.lever, categoryId: null, text: d.text, owner: '', due: '', fromLibrary: true });
        if (!el.checked && idx >= 0) sc.tactics.splice(idx, 1); }, { structural: true }),
      'tac-add': d => api.update(s => { s.plan.scenarios[s.plan.activeScenario].tactics.push({ lever: d.lever, categoryId: null, text: '', owner: '', due: '', fromLibrary: false }); }, { structural: true }),
      'tac-del': d => api.update(s => { s.plan.scenarios[s.plan.activeScenario].tactics.splice(+d.index, 1); }, { structural: true }),
      'crm-copy': () => { const rows = Array.from(document.querySelectorAll('#crm-table tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim()).join('\t')).join('\n');
        if (navigator.clipboard) navigator.clipboard.writeText(rows).then(() => alert('コピーしました'), () => alert('コピーできませんでした。表を選択して手動でコピーしてください。')); else alert('この環境ではコピーできません。表を選択して手動でコピーしてください。'); }
    };
  }
  Sim.ui.plan = { render, refresh: outputs, parts: { reverseTable, comparison, LEVERS, TACTIC_LEVERS } };
})();
```

- [ ] **Step 2: テストが引き続き通ることを確認**

Run: `node tests/run.js`
Expected: `50 passed, 0 failed`

- [ ] **Step 3: ブラウザで手動確認**

| 確認 | 期待 |
|---|---|
| ③タブ（サンプル・3年） | 現状 ¥2,376,800。目標未設定の案内 |
| 目標に 2800000 を入力 | ギャップ ¥423,200。新規 18人追加（100→118）／同日「—」／後日 20.3pt（78.2%→98.5%）／追加単価 27.5%／間口単価 50.4% |
| 目標に 2000000 | 「達成済み（余裕 ¥376,800）」緑表示、到達率バーが緑 |
| 目標 2800000 →「均等に割り振る」 | 各カテゴリのスライダーが 新規+4／後日+5／単価+7／間口+13 前後に動き、到達率が100%前後 |
| スライダーを動かす | 値ラベル・カード下の売上差・到達率が即時更新。スライダーのつまみは指を離すまで追従 |
| 「0に戻す」 | 全スライダー0、到達率が現状値に |
| シナリオ「＋追加」→3本目まで | 4本目の追加ボタンが消える。名前を変えるとタブ名が変わる |
| 「複製」「削除」 | 複製は3本上限で無反応、削除は確認後に1本減る（1本のときは削除ボタンなし） |
| 打ち手の定型をチェック | 「選んだ打ち手」表に行が増える。後日追加の定型は「購入後34日を目安に…」（サンプルの平均68日の半分） |
| 「＋自由記述を追加」→文字入力→担当・期限入力 | 入力中にフォーカスが外れない |
| CRM転記用を開く | 枕：12000／40／34000／68。「タブ区切りでコピー」でクリップボードに入る |
| ①でカテゴリ追加→③ | 新カテゴリのスライダーカードが出る |

- [ ] **Step 4: コミット**

```bash
git add js/ui-plan.js
git commit -m "feat(v2): ③目標と戦略（逆算・シナリオ・レバー配分・打ち手・CRM転記）"
```

---

### Task 9: ④レポートと印刷（ui-report.js / print.css）

**Files:**
- Modify: `js/ui-report.js`（暫定を全面置換）
- Modify: `css/print.css`

**Interfaces:**
- Consumes: `Sim.ui.diagnosis.parts`、`Sim.ui.plan.parts`、`Sim.calc.*`、`Sim.analysis.*`
- Produces: `Sim.ui.report = { render, refresh }`（`refresh` は `render` と同じ）

- [ ] **Step 1: ui-report.js を書く**

`js/ui-report.js`（全文置換）:
```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  function render(el, state, api) {
    const { esc, yen, fmt1, signed } = U(); const period = state.store.period;
    const D = Sim.ui.diagnosis.parts; const P = Sim.ui.plan.parts;
    const st = Sim.calc.store(state, period); const pf = Sim.analysis.portfolio(state, period); const lv = Sim.analysis.leverage(state, period);
    const wk = Sim.analysis.weakness(state, period); const tm = Sim.analysis.timing(state, period); const cm = Sim.analysis.comments(state, period);
    const plan = state.plan; const sc = plan.scenarios[plan.activeScenario]; const target = plan.targetRevenue[period - 1];
    const rv = Sim.calc.reverse(state, period, target); const now = Sim.calc.store(state, period, sc.levers);
    const today = new Date().toLocaleDateString('ja-JP'); const leverName = k => (P.TACTIC_LEVERS.find(x => x[0] === k) || ['', ''])[1];
    const leverRows = state.categories.map(c => { const l = sc.levers[c.id] || {}; return `<tr><td>${esc(c.name)}</td>${P.LEVERS.map(L => `<td>${signed(l[L.key] || 0, L.unit)}</td>`).join('')}</tr>`; }).join('');
    el.innerHTML = `
      <div class="report-tools no-print"><button type="button" class="sbtn primary" data-action="print">印刷／PDF保存</button><span class="note-p">A4縦・6ページ構成。印刷ダイアログで「PDFに保存」を選べます。内容は①〜③の最新状態です。</span></div>
      <div class="report">
        <section class="rpage cover"><div class="eyebrow">STORE SALES SIMULATOR</div><h1>${esc(state.store.name || '店舗')}<br>売上診断と戦略設計</h1>
          <p>${esc(state.store.fiscalLabel)}　／　${period}年で見た場合　／　シナリオ：${esc(sc.name)}</p><p class="small">作成日 ${today}</p></section>
        <section class="rpage"><h2>1. 現状サマリー（${period}年で見た場合）</h2>${D.kpis(st)}${D.table(st)}</section>
        <section class="rpage"><h2>2. 診断</h2><h3>間口ポートフォリオ</h3>${D.quadrantSvg(pf)}<h3>効きどころ</h3>${D.leverageBlock(lv)}<h3>弱点候補</h3>${D.weaknessBlock(wk)}<h3>購入までの期間</h3>${D.timingBlock(tm)}<h3>コメント</h3><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <section class="rpage"><h2>3. 目標とギャップ</h2>${P.reverseTable(rv)}</section>
        <section class="rpage"><h2>4. 戦略（${esc(sc.name)}）</h2><p>この配分での売上 ${yen(now.revenue)}（目標到達率 ${target > 0 ? fmt1(now.revenue / target * 100) + '%' : '—'}）</p>
          <table class="ltable"><tr><th>間口カテゴリ</th>${P.LEVERS.map(L => `<th>${L.label}</th>`).join('')}</tr>${leverRows}</table>
          <h3>打ち手</h3>${sc.tactics.length ? `<table class="ltable"><tr><th>レバー</th><th>打ち手</th><th>担当</th><th>期限</th></tr>${sc.tactics.map(t => `<tr><td>${leverName(t.lever)}</td><td>${esc(t.text)}</td><td>${esc(t.owner)}</td><td>${esc(t.due)}</td></tr>`).join('')}</table>` : '<p class="note-p">打ち手は未選択です。</p>'}
          ${sc.memo ? `<p>${esc(sc.memo)}</p>` : ''}<h3>シナリオ比較</h3>${P.comparison(state, period)}</section>
        <section class="rpage"><h2>5. 前提と計算式</h2><ul class="cm">
          <li>間口＝新規のお客様が最初に買う商品のくくりです。新規獲得人数は1年分を1つの集団として扱い、その集団が1年／2年／3年で生む売上を「期間累計売上」と呼びます。</li>
          <li>顧客あたりLTV（期間）＝間口単価＋同日追加率×同日追加単価＋後日追加率（期間）×後日追加単価（期間）。</li>
          <li>期間累計売上＝新規獲得人数×LTV。粗利＝売上×（1−原価率）。固定費を入れた場合、営業利益＝粗利−固定費×12×年数。</li>
          <li>ポートフォリオの境界は店内の中央値（相対比較）です。弱点候補は目安値・前期がある場合にその比較で、無い場合は店内平均との比較で示します。</li>
          <li>新規獲得人数が10人未満のカテゴリは判定保留です。</li>
          <li>数字の出所：手入力または貼り付け（最終更新 ${esc((state.meta.updatedAt || '').slice(0, 10))}）。すべて試算であり、実数値を入れるほど精度が上がります。</li></ul></section>
      </div>`;
    U().bindPanel(el, api, { print: () => window.print() });
  }
  Sim.ui.report = { render, refresh: render };
})();
```

- [ ] **Step 2: print.css を書く**

`css/print.css`（全文置換）:
```css
@media print {
  @page { size: A4 portrait; margin: 14mm; }
  .site-head, #stepper, #floatp, .no-print, .footnote, details.guide { display: none !important; }
  .step-panel { display: none !important; }
  #panel-4 { display: block !important; }
  body { background: #fff; padding: 0; color: #1a2236; }
  .wrap { max-width: none; padding: 0; }
  .report .rpage { page-break-after: always; break-after: page; border: none; border-radius: 0; padding: 0; margin: 0; box-shadow: none; }
  .report .rpage:last-child { page-break-after: auto; break-after: auto; }
  .report .cover { padding: 120px 0; }
  .card, .kpi, .lev { box-shadow: none; }
  .kpi.accent, .impact { background: #eef1f6 !important; color: #1a2236 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .kpi.accent .kval, .kpi.accent .klab, .kpi.accent .ksub, .kpi.accent .kval .yen, .impact .il, .impact .iv, .impact .iv .delta { color: #1a2236 !important; }
  .kpis { grid-template-columns: repeat(4, 1fr); }
  .lev-grid { grid-template-columns: 1fr 1fr; }
  .quad { max-width: 150mm; }
  .ltable { font-size: 11px; }
  .tag { border: 1px solid #1a2236; color: #1a2236 !important; background: #fff !important; }
  .qdot { fill-opacity: .5; }
}
```

- [ ] **Step 3: テストが引き続き通ることを確認**

Run: `node tests/run.js`
Expected: `50 passed, 0 failed`

- [ ] **Step 4: ブラウザで手動確認**

| 確認 | 期待 |
|---|---|
| ④タブ | 表紙（店名・年度・3年・シナリオ名・作成日）＋5セクションが画面に並ぶ |
| ③でシナリオ名を変えて④ | 表紙のシナリオ名が変わる |
| 「印刷／PDF保存」→プレビュー | ヘッダー・ステッパー・フローティングボタンが消え、表紙が1ページ目、各セクションで改ページ。6ページ |
| ①〜③のタブで Cmd+P | 同じくレポートだけが印刷される |
| モノクロ印刷プレビュー | KPIの濃色カードが薄い背景＋濃い文字になって読める |

- [ ] **Step 5: コミット**

```bash
git add js/ui-report.js css/print.css
git commit -m "feat(v2): ④レポート（A4・6ページ）と印刷スタイル"
```

---

### Task 10: 手動チェックリスト・README・最終確認

**Files:**
- Create: `tests/manual-checklist.md`
- Create: `README.md`

- [ ] **Step 1: 手動チェックリストを書く**

`tests/manual-checklist.md`:
```markdown
# 手動確認リスト（ブラウザ）

前提: `index.html` をダブルクリック（file://）と GitHub Pages の両方で確認する。

## 起動・保存
- [ ] 初回表示でサンプル寝具店が出る（カテゴリ2件・3年・枕LTV ¥35,120）
- [ ] 入力→再読み込みで復元される
- [ ] 書き出し→「空で始める」→読み込みで元に戻る
- [ ] 壊れたJSON（拡張子だけ.json）を読み込むと「ファイルの形式が違います」
- [ ] プライベートウィンドウで開くと「自動保存が無効です」の帯が出る（Safariで確認）

## ① 現状入力
- [ ] 期間切替で該当列がハイライトされ、LTVが変わる（2年: 枕 ¥26,300）
- [ ] 新規5人で「10人未満」の注意、後日率の逆転で「累計」の注意
- [ ] カテゴリ追加／削除（確認ダイアログ）、経路追加／削除とCPA表示
- [ ] 前期の欄を追加→入力→②で「前期との比較」
- [ ] 貼り付け（日本語ヘッダー／CRM英語ヘッダー）→プレビュー→取り込み
- [ ] 入力中にフォーカスが外れない（文字入力・スライダー）

## ② 診断
- [ ] KPI4つ、カテゴリ表、経路表（経路がある時のみ）
- [ ] 象限図：2件＝平均境界、3件＝中央値境界、1件＝図なし、母数10未満＝グレー
- [ ] 効きどころの順位が①の入力に追随する
- [ ] 弱点：目安値→benchmark、前期→prev、無し→relative＋案内文
- [ ] 打ち時：日数入力あり／なし、期間超え警告

## ③ 目標と戦略
- [ ] 逆算5行（同日単価0なら「—」）、達成済み表示、到達率バー
- [ ] 均等配分／0に戻す／シナリオ追加・複製・削除（上限3・下限1）
- [ ] 打ち手の定型チェック・自由記述・担当・期限
- [ ] CRM転記表とコピー

## ④ レポート
- [ ] 6ページ構成、改ページ、ヘッダー類の非表示、モノクロで読める

## 表示
- [ ] 幅400px／768px／1200px で横スクロールなし
- [ ] 「ガイドを開く」で全「？」が展開され、閉じると戻る
```

- [ ] **Step 2: README を書く**

`README.md`:
```markdown
# 店舗 売上シミュレーター

現状の数字を入れて診断し、目標とレバー配分まで設計する1ページのツールです。
公開: https://yuta5753.github.io/nemu-simulator/

## 使い方
1. **① 現状入力** — 間口カテゴリごとに「間口単価・新規獲得人数・後日追加（1/2/3年）」を入れます。同日追加・購入までの日数・前期・目安値・集客経路は任意です。CRMやExcelの表は「貼り付け」から取り込めます。
2. **② 診断** — 間口ポートフォリオ（4象限）・効きどころ・弱点候補・フォローの打ち時・コメントが自動で出ます。
3. **③ 目標と戦略** — 目標売上を入れると逆算が出ます。シナリオ（最大3本）でレバーを配分し、打ち手を選びます。
4. **④ レポート** — A4・6ページに整形。「印刷／PDF保存」でPDFにできます。

入力はブラウザに自動保存されます（同じ端末・同じブラウザのみ）。店舗ごとに持ち回るときは「書き出し（JSON）」「読み込み」を使ってください。

## 開発
- 外部ライブラリなし。`index.html` をダブルクリックで動きます。
- テスト: `node tests/run.js`（純関数のみ）。画面は `tests/manual-checklist.md` で確認。
- 設計書: `docs/superpowers/specs/2026-09-23-simulator-v2-design.md`
- 旧版（v1）: `docs/legacy/index-v1.html`
```

- [ ] **Step 3: 全テストと手動チェックリストを一通り実行**

Run: `node tests/run.js`
Expected: `50 passed, 0 failed`

`tests/manual-checklist.md` を上から実行し、全項目にチェックを付ける。落ちた項目は該当Taskのファイルを直してから再確認する。

- [ ] **Step 4: コミット**

```bash
git add tests/manual-checklist.md README.md
git commit -m "docs(v2): 手動チェックリストとREADME"
```

**push は辻さんの承認後**（CLAUDE.md 破壊的操作ルール）。push すると GitHub Pages が自動で更新される。

---

## 自己レビュー結果（計画作成時に実施）

- **仕様カバー**: §1 成功条件6項目 → Task 7（診断文章）/ Task 8（逆算・シナリオ）/ Task 9（印刷）/ Task 6（JSON持ち回り・file://）。§4 入力ブロック5種＋§4-2 貼り付け＋§4-3 検証 → Task 4・6。§5 診断5ブロック → Task 3・7。§6 逆算5レバー・シナリオ3本・打ち手・CRM転記 → Task 2・5・8。§7 レポート6ページ → Task 9。§8 保存・読込・初期化 → Task 1・6。§9 ガイド折りたたみ → Task 6（`guide()`・「ガイドを開く」）。§11 エラー処理4件 → Task 1（load null）・Task 4（警告）・Task 6（読込失敗alert・storage帯）。§12 テスト → Task 1〜6 の自動テスト＋Task 10 手動。
- **仕様との差分**: `js/ui-util.js` を追加（§2-2 の一覧に無い）。§5-3(b) の relative モードは「弱点一覧＋案内文」を両方出す（analysis.comments で hint を常に付ける）。
- **型の整合**: `levers` のキー名（newPct/sameDayPt/laterPt/aovPct/entryPricePct）は state / calc / analysis / ui-plan / ui-report で同一。`Sim.ui.plan.parts.LEVERS` と `Sim.analysis.LEVER_LABELS` のラベルも同一。
- **Review Focus 5件**: 1→Task 2「全カテゴリ新規0」、2→Task 1「syncScenarios」、3→Task 4「toNum」「CRLF・引用符」、4→Task 2「負のギャップ」＋Task 8 手動「達成済み」、5→Task 1「壊れたJSON」「余分な項目」。
- **Task 1〜5 のコードは計画作成時に Node で実行し、47件すべて通ることを確認済み**（Task 6 の ui-util を含めて50件）。
