# 店舗 売上シミュレーター v2.2 複数店舗対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1店舗用のシミュレーターを、店舗切替タブ＋全社自動合算＋本部費別建て＋店舗横並び比較＋店舗ファイルの受け渡しに対応させる（店舗が1つのときは今と同じ画面）。

**Architecture:** 会社の箱 `{ company, stores[], activeStoreId }` の中に、今の1店舗分の保存データ（v3形式）をそのまま店舗バンドルとして並べる。既存の①〜⑤モジュールは店舗バンドルを受け取って動くので変更しない。全社ビューは新モジュール3本（`ui-company` ①②／`ui-company-diag` ③／`ui-company-plan` ④⑤）が、`calc.companyMgmt / companyRequired / storeComparison` の合算結果を表示する。`app.js` が店舗切替バーと2本のAPI（店舗用 `api`・全社用 `companyApi`）を持つ。

**Tech Stack:** HTML / CSS / JS（ES Modules 不使用・ライブラリなし・file:// で動く）。テストは `node tests/run.js`（自前ランナー）。ブラウザ確認は Playwright MCP（コントローラーが実施）。

**Spec:** `docs/superpowers/specs/2026-09-25-simulator-v2-2-multistore-design.md`

## Global Constraints

- ES Modules 不使用。`<script>` を順に読み込み `window.Sim.*` に登録する（file:// で動くこと）
- 外部ライブラリ・CDN 不使用
- 業界平均などの絶対的な目安値をコードに埋め込まない。物差しは目安値（任意入力）・前期・店舗内相対比較のみ
- localStorage キーは `storeSim:v2` のまま。既存の v3 保存データは自動で「店舗1つの会社」に変換され、店舗が1つのときは今と同じ画面
- 画面文言は日本語ですます調。押しつけ表現（「〜すべき」）を使わない
- 金額は万円表示（`Sim.ui.util.yen`）。本部費・必要営業利益の入力は万円（`data-type="man"`）
- 純粋モジュール（state / calc / analysis）は DOM に触らない。UI モジュールは `{ render(el, state, api), refresh(el, state, api) }` の契約に従う
- コミットメッセージは末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` を付ける。push は辻さんの承認後のみ

## Review Focus

仕様が暗に要求するが各タスクのテストが拾わないと困る入力。各行の担保テストを当該タスクに入れてある。

1. **店舗ファイルの id が既存店舗と同じ**（自店のファイルを複製して2号店として取り込む）→ 新しい id が振られ、既存店舗が上書きされない（Task 1 `addStore` テスト）
2. **一部店舗だけ費用が空欄** → 空欄は 0 扱いにせず合算から外し、率が歪まない。注記に「人件費 1／2店舗」と出る（Task 2・Task 3 テスト）
3. **本部費に負の値** → 0 扱い（Task 2 テスト）
4. **表示中の店舗を削除** → 全社（残り1店舗ならその店舗）に切り替わり、画面が壊れない（Task 1 `removeStore` テスト＋Task 4 ブラウザ確認）
5. **「ファイルから店舗」に会社ファイル（2店舗以上）を選ぶ** → `company file` として案内文が出て、何も壊れない（Task 1 `parseStore` テスト＋Task 4 ブラウザ確認）
6. **経営数値が空の3店舗目** → 横並びで値なし・マークなし、残り2店舗で順位が付く（Task 2 テスト）

---

### Task 1: state.js を v4（会社構造）にする

**Files:**
- Modify: `js/state.js`
- Modify: `tests/state.test.js`, `tests/calc.test.js`, `tests/analysis.test.js`, `tests/paste.test.js`, `tests/tactics.test.js`（既存テストの関数名を店舗版に置換）

**Interfaces:**
- Consumes: 既存の `newCategory / newChannel / newScenario / normalizeMgmt / migrateV1 / dedupeIds / safeId / uid`
- Produces（後続タスクが使う名前）:
  - `Sim.state.SCHEMA_VERSION = 4`, `STORE_VERSION = 3`
  - `createEmptyStore()` → 店舗バンドル（旧 `createEmpty`＋`store.id`）／`createSampleStore()` → 旧サンプル店舗
  - `createEmpty()` → 店舗1つの会社／`createSample()` → 2店舗（本店・2号店）＋本部費、`activeStoreId: null`
  - `normalizeStore(obj)` → 店舗バンドル／`normalize(obj)` → 会社（v3以前は店舗1つに包む）
  - `serialize(company)`, `serializeStore(store)`（`version: 3` で書き出し）, `parse(json)` → 会社, `parseStore(json)` → 店舗（会社ファイルは `company file` エラー）
  - `syncShared(company, sourceIdx)`, `activeStore(company)`, `storeLabel(company, i)`, `addStore(company, raw?) → id`, `removeStore(company, id) → bool`, `duplicateStore(company, id) → id|null`, `replaceStore(company, id, raw) → bool`
  - `exportFilename(company, date)`, `exportStoreFilename(store, date)`
  - `save(company, storage)`, `load(storage)` → 会社（v3 保存データも会社に変換）

- [ ] **Step 1: ブランチを切る**

```bash
cd /Users/tsujiyuuta/Desktop/claude-outputs/nemu-simulator
git checkout -b feature/v2-2-multistore
```

- [ ] **Step 2: 既存テストの関数名を店舗版に置換する**

v4 では `createSample / createEmpty / normalize / parse / serialize / exportFilename` が会社を扱うため、店舗を前提にしている既存テストを店舗版の名前に置き換える。

```bash
sed -i '' -e 's/S\.createSample()/S.createSampleStore()/g' -e 's/S\.createEmpty()/S.createEmptyStore()/g' -e 's/S\.normalize(/S.normalizeStore(/g' -e 's/S\.parse(S\.serialize(s))/S.parseStore(S.serializeStore(s))/g' -e 's/S\.exportFilename(/S.exportStoreFilename(/g' -e 's/{version: 4}/{version: 5}/' -e 's/version: 4 })/version: 5 })/' -e 's/eq(S\.load(storage)\.categories\.length, 2)/eq(S.load(storage).stores[0].categories.length, 2)/' tests/state.test.js
sed -i '' -e 's/Sim\.state\.createSample()/Sim.state.createSampleStore()/g' -e 's/Sim\.state\.createEmpty()/Sim.state.createEmptyStore()/g' tests/calc.test.js tests/analysis.test.js tests/paste.test.js tests/tactics.test.js
grep -n "createSample()\|createEmpty()\|S\.normalize(\|S\.exportFilename(" tests/*.test.js
```

Expected: 最後の grep が何も出力しない（置換漏れなし）。

- [ ] **Step 3: 新しいテストを `tests/state.test.js` の末尾に追加する**

```js
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
```

- [ ] **Step 4: テストを走らせて失敗を確認する**

Run: `node tests/run.js 2>&1 | tail -5`
Expected: `createSampleStore is not a function` 等で多数 FAIL（既存テストも新テストも）。

- [ ] **Step 5: `js/state.js` を書き換える**

先頭の定数と `createEmpty` / `createSample` / `normalize` / `serialize` 以降を次のとおりにする（`emptyLevers` 〜 `newScenario`、`V1_SAMPLE`、`dedupeIds` は変更なし）。

(1) 先頭の定数:

```js
  const SCHEMA_VERSION = 4;      // 会社ファイル
  const STORE_VERSION = 3;       // 店舗バンドル（単店版と互換）
  const STORAGE_KEY = 'storeSim:v2';
```

(2) `createEmpty` を `createEmptyStore` に改名し、`store.id` を足す。会社版 `createEmpty` を追加:

```js
  function createEmptyStore() {
    const now = new Date().toISOString();
    return {
      version: STORE_VERSION,
      store: { id: uid('s'), name: '', fiscalLabel: '', cogsRate: 50, fixedCostMonthly: 0, period: 3 },
      benchmarks: { sameDayRate: null, laterRate: [null, null, null], laterAov: [null, null, null], daysToAddon: null,
        grossMarginPct: null, laborPct: null, rentPct: null, adsPct: null, repeatRate: null },
      categories: [], channels: [],
      mgmt: emptyMgmt(),
      plan: { targetRevenue: [null, null, null], activeScenario: 0, scenarios: [newScenario('標準', [])], requiredProfit: null, existingGrowthPct: 0 },
      meta: { createdAt: now, updatedAt: now }
    };
  }
  function emptyHq() { return { labor: null, rent: null, ads: null, other: null }; }
  function createEmpty() {
    const st = createEmptyStore(); const now = st.meta.createdAt;
    return { version: SCHEMA_VERSION, company: { name: '', hq: emptyHq(), plan: { requiredProfit: null, existingGrowthPct: 0 } },
      stores: [st], activeStoreId: st.store.id, meta: { createdAt: now, updatedAt: now } };
  }
```

(3) `migrateV1` の中の `const s = createEmpty();` を `const s = createEmptyStore();` に変える。

(4) 既存の `createSample` を `createSampleStore` に改名（中身はそのまま）。会社版 `createSample` を追加:

```js
  function createSample() {
    const c = createEmpty(); const a = createSampleStore(); a.store.name = '本店';
    const b = migrateV1([
      { name: '枕（フィッティング）', front: 12000, new1: 24, aov: [15000, 26000, 34000], ret: [35, 55, 68] },
      { name: '敷きもの・カバー類', front: 6000, new1: 36, aov: [5000, 9000, 12000], ret: [50, 72, 85] }
    ], { cogs: 50, fixed: 0 });
    b.store.name = '2号店'; b.store.fiscalLabel = '2026年度';
    b.categories[0].nextProducts = 'マットレス・枕カバー'; b.categories[0].daysToAddon = 45;
    b.categories[1].nextProducts = '掛け布団・枕'; b.categories[1].daysToAddon = 90;
    b.plan.scenarios = [newScenario('保守', b.categories), newScenario('標準', b.categories), newScenario('強気', b.categories)]; b.plan.activeScenario = 1;
    b.channels = [newChannel({ name: 'Google広告', newCustomers: 24, cost: 600000 }), newChannel({ name: '紹介・口コミ', newCustomers: 20, cost: 0 }), newChannel({ name: 'チラシ', newCustomers: 16, cost: 200000 })];
    b.mgmt = normalizeMgmt({
      revenue: 28800000, buyers: 420, newBuyers: 60, newRevenue: 540000, itemsPerBuyer: 1.5,
      activeCustomers: 540, visits: { once: 300, twice: 150, threePlus: 90 }, dormant: 180,
      products: [{ name: '枕（フィッティング）', sales: 3000000, grossMarginPct: 55 }, { name: '敷きもの・カバー類', sales: 7200000, grossMarginPct: 45 },
        { name: 'マットレス', sales: 12000000, grossMarginPct: 40 }, { name: 'その他', sales: 6600000, grossMarginPct: 50 }],
      inventory: 3600000,
      costs: { cogs: 14400000, labor: 6000000, rent: 2400000, ads: 1200000, other: 2600000 },
      funnel: { reservations: 180, visits: 140, deals: 100 },
      replacement: [{ name: 'マットレス', cycleYears: 8, pastBuyers: 190 }]
    }, true);
    c.company.name = 'サンプル寝具株式会社'; c.company.hq = { labor: 3000000, rent: 900000, ads: null, other: 900000 };
    c.stores = [a, b]; c.activeStoreId = null; syncShared(c, 0);
    return c;
  }
```

(5) 既存の `normalize` を `normalizeStore` に改名し、`s.store` の行に `id` を足す:

```js
  function normalizeStore(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('invalid');
    if (num(obj.version, 0) > SCHEMA_VERSION) throw new Error('unsupported version');
    const s = createEmptyStore(); const st = obj.store || {}; const b = obj.benchmarks || {}; const p = obj.plan || {};
    s.store = { id: safeId(st.id, 's'), name: st.name == null ? '' : String(st.name), fiscalLabel: st.fiscalLabel == null ? '' : String(st.fiscalLabel),
      cogsRate: num(st.cogsRate, 50), fixedCostMonthly: num(st.fixedCostMonthly, 0), period: [1, 2, 3].includes(+st.period) ? +st.period : 3 };
    // …以下は旧 normalize と同じ（benchmarks / categories / channels / plan / mgmt / scenarios / meta / syncScenarios）…
    return s;
  }
```

(6) 会社版の `normalize` と店舗操作を追加（`syncScenarios` の直前に置く）:

```js
  function isCompany(obj) { return !!(obj && Array.isArray(obj.stores)); }
  function storeIndex(company, id) { return company.stores.findIndex(s => s.store.id === id); }
  function resolveActive(company, id) { if (company.stores.length === 1) return company.stores[0].store.id; return storeIndex(company, id) >= 0 ? id : null; }
  function normalize(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('invalid');
    if (num(obj.version, 0) > SCHEMA_VERSION) throw new Error('unsupported version');
    const c = createEmpty();
    if (!isCompany(obj)) {
      const st = normalizeStore(obj); c.stores = [st]; c.activeStoreId = st.store.id;
      c.meta = { createdAt: st.meta.createdAt, updatedAt: st.meta.updatedAt }; return c;
    }
    const co = obj.company || {}; const hq = co.hq || {}; const cp = co.plan || {};
    c.company = { name: co.name == null ? '' : String(co.name), hq: { labor: optNum(hq.labor), rent: optNum(hq.rent), ads: optNum(hq.ads), other: optNum(hq.other) },
      plan: { requiredProfit: optNum(cp.requiredProfit), existingGrowthPct: num(cp.existingGrowthPct, 0) } };
    c.stores = obj.stores.map(s => normalizeStore(s)); if (!c.stores.length) c.stores = [createEmptyStore()];
    const seen = new Set(); c.stores.forEach(s => { if (seen.has(s.store.id)) s.store.id = uid('s'); seen.add(s.store.id); });
    c.activeStoreId = resolveActive(c, obj.activeStoreId == null ? null : String(obj.activeStoreId));
    c.meta = { createdAt: (obj.meta && obj.meta.createdAt) || c.meta.createdAt, updatedAt: (obj.meta && obj.meta.updatedAt) || c.meta.updatedAt };
    syncShared(c, 0);
    return c;
  }
  function applyShared(target, source) { target.benchmarks = JSON.parse(JSON.stringify(source.benchmarks)); target.store.period = source.store.period; }
  function syncShared(company, sourceIdx) {
    const src = company.stores[sourceIdx] || company.stores[0]; if (!src) return company;
    company.stores.forEach(s => { if (s !== src) applyShared(s, src); }); return company;
  }
  function activeStore(company) { const i = storeIndex(company, company.activeStoreId); return i < 0 ? null : company.stores[i]; }
  function storeLabel(company, i) { const s = company.stores[i]; return (s && s.store.name) ? s.store.name : '店舗' + (i + 1); }
  function ensureUniqueId(company, bundle) { while (storeIndex(company, bundle.store.id) >= 0) bundle.store.id = uid('s'); return bundle; }
  function addStore(company, raw) {
    const b = raw ? normalizeStore(raw) : createEmptyStore(); ensureUniqueId(company, b);
    if (company.stores.length) applyShared(b, company.stores[0]); company.stores.push(b); return b.store.id;
  }
  function removeStore(company, id) {
    const i = storeIndex(company, id); if (i < 0 || company.stores.length <= 1) return false;
    company.stores.splice(i, 1); company.activeStoreId = resolveActive(company, company.activeStoreId === id ? null : company.activeStoreId); return true;
  }
  function duplicateStore(company, id) {
    const i = storeIndex(company, id); if (i < 0) return null;
    const copy = normalizeStore(JSON.parse(JSON.stringify(company.stores[i]))); copy.store.id = uid('s'); copy.store.name = storeLabel(company, i) + 'のコピー';
    ensureUniqueId(company, copy); company.stores.splice(i + 1, 0, copy); return copy.store.id;
  }
  function replaceStore(company, id, raw) {
    const i = storeIndex(company, id); if (i < 0) return false;
    const b = normalizeStore(raw); b.store.id = id; applyShared(b, company.stores[0]); company.stores[i] = b; return true;
  }
```

(7) `serialize` 以降を差し替える:

```js
  function serialize(company) {
    return JSON.stringify(Object.assign({}, company, { meta: Object.assign({}, company.meta, { updatedAt: new Date().toISOString() }) }), null, 2);
  }
  function serializeStore(store) {
    return JSON.stringify(Object.assign({}, store, { version: STORE_VERSION, meta: Object.assign({}, store.meta, { updatedAt: new Date().toISOString() }) }), null, 2);
  }
  function parseJson(json) { try { return JSON.parse(json); } catch (e) { throw new Error('invalid json'); } }
  function parse(json) { return normalize(parseJson(json)); }
  function parseStore(json) {
    const o = parseJson(json); if (!o || typeof o !== 'object') throw new Error('invalid');
    if (num(o.version, 0) > SCHEMA_VERSION) throw new Error('unsupported version');
    if (isCompany(o)) { if (o.stores.length !== 1) throw new Error('company file'); return normalizeStore(o.stores[0]); }
    return normalizeStore(o);
  }
  function save(company, storage) { try { storage.setItem(STORAGE_KEY, serialize(company)); return true; } catch (e) { return false; } }
  function load(storage) { try { const j = storage.getItem(STORAGE_KEY); return j ? parse(j) : null; } catch (e) { return null; } }
  const fileDate = date => { date = date || new Date(); const pad = v => String(v).padStart(2, '0'); return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()); };
  const fileSafe = s => String(s || '').replace(/[\\/:*?"<>|]/g, '_');
  function exportStoreFilename(store, date) { return (fileSafe(store.store.name) || 'store') + '_' + fileDate(date) + '.json'; }
  function exportFilename(company, date) {
    if (company.stores.length === 1) return exportStoreFilename(company.stores[0], date);
    return (fileSafe(company.company.name) || 'company') + '_全社_' + fileDate(date) + '.json';
  }
  Sim.state = { SCHEMA_VERSION, STORE_VERSION, STORAGE_KEY, createEmpty, createEmptyStore, createSample, createSampleStore, newCategory, newChannel, newScenario, emptyLevers, emptyPrev,
    emptyMgmt, normalizeMgmt, newProductRow, newReplacementRow, emptyHq,
    migrateV1, normalize, normalizeStore, syncScenarios, syncShared, activeStore, storeLabel, addStore, removeStore, duplicateStore, replaceStore,
    serialize, serializeStore, parse, parseStore, save, load, exportFilename, exportStoreFilename };
```

（仕様 §2.4 の補足: 店舗が1つの会社は `店名_日付.json` で書き出す。中身は v4 会社ファイルのまま。「全社」を付けるのは2店舗以上のときだけ）

- [ ] **Step 6: テストを走らせて全件通過を確認する**

Run: `node tests/run.js 2>&1 | tail -3`
Expected: `99 passed, 0 failed`（既存85＋新規14）

- [ ] **Step 7: コミット**

```bash
git add js/state.js tests/
git commit -m "feat(state): v4 会社構造（店舗バンドル・全社/店舗の読み書き・店舗操作・syncShared）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: calc.js に合算・全社逆算・店舗横並びを追加する

**Files:**
- Modify: `js/calc.js`（末尾の export の直前に追加）
- Test: `tests/calc.test.js`（末尾に追加）

**Interfaces:**
- Consumes: `mgmtCore(m)`, `mgmt(state)`, `store(state, period, levers)`, `reachRate`, `requiredRevenue`, `nn`, `Sim.state.emptyMgmt / newProductRow / newReplacementRow / storeLabel`
- Produces:
  - `Sim.calc.companyMgmt(company)` → `{ available, m, coverage, hq:{labor,rent,ads,other,total}, operatingProfitAfterHq, fixedCostsWithHq, breakEvenWithHq, safetyMarginWithHq, storeCount }`（`m` は `mgmtCore` の形＋`prev`＋`channels`）
  - `Sim.calc.companyRequired(company)` → `{ required, current, gap, existingForecast, newTarget, grossMarginPct, fixedCosts, hqTotal }` または `null`
  - `Sim.calc.storeComparison(company, period)` → `{ stores:[{id,name}], metrics:[{ key,label,unit:'yen'|'pct'|'num',better:'high'|'low'|null,group:'mgmt'|'entry',bench, values:[{storeId,value,mark:'◎'|'○'|'△'|null}], company }] }`
  - `Sim.calc.CMP_METRICS`

- [ ] **Step 1: テストを `tests/calc.test.js` の末尾に追加する**

```js
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
```

- [ ] **Step 2: 失敗を確認する**

Run: `node tests/run.js 2>&1 | grep -c "✗"`
Expected: `7`（`C.companyMgmt is not a function` 等）

- [ ] **Step 3: `js/calc.js` の `requiredRevenue` の後・export の前に追加する**

```js
  function sumOf(list, get) { let s = null, n = 0; list.forEach(x => { const v = get(x); if (typeof v === 'number' && !isNaN(v)) { s = (s || 0) + v; n++; } }); return { s, n }; }
  function mergeByName(lists, combine) {
    const map = new Map(); const order = [];
    lists.forEach(rows => (rows || []).forEach(r => { const key = String(r.name == null ? '' : r.name).trim(); if (!key) return; if (!map.has(key)) { map.set(key, []); order.push(key); } map.get(key).push(r); }));
    return order.map((key, i) => combine(key, map.get(key), i));
  }
  function wavg(rows, valKey, wKey) { let s = 0, w = 0; rows.forEach(r => { if (r[valKey] != null && r[wKey] > 0) { s += r[valKey] * r[wKey]; w += r[wKey]; } }); return w > 0 ? s / w : null; }
  function mergeMgmt(list) {
    const total = list.length; const m = Sim.state.emptyMgmt(); const coverage = {}; const cov = (k, n) => { coverage[k] = { n, total }; };
    ['revenue', 'buyers', 'newBuyers', 'newRevenue', 'activeCustomers', 'dormant', 'inventory'].forEach(k => { const r = sumOf(list, x => x[k]); m[k] = r.s; cov(k, r.n); });
    m.itemsPerBuyer = wavg(list, 'itemsPerBuyer', 'buyers');
    const V = ['once', 'twice', 'threePlus']; V.forEach(k => { m.visits[k] = sumOf(list, x => x.visits && x.visits[k]).s; }); cov('visits', list.filter(x => x.visits && V.every(k => x.visits[k] != null)).length);
    const F = ['reservations', 'visits', 'deals']; F.forEach(k => { m.funnel[k] = sumOf(list, x => x.funnel && x.funnel[k]).s; }); cov('funnel', list.filter(x => x.funnel && F.every(k => x.funnel[k] != null)).length);
    ['cogs', 'labor', 'rent', 'ads', 'other'].forEach(k => { const r = sumOf(list, x => x.costs && x.costs[k]); m.costs[k] = r.s; cov('costs.' + k, r.n); });
    m.products = mergeByName(list.map(x => x.products), (name, rows, i) => Sim.state.newProductRow({ id: 'agg_p' + i, name, sales: sumOf(rows, r => r.sales).s, grossMarginPct: wavg(rows, 'grossMarginPct', 'sales') }));
    m.replacement = mergeByName(list.map(x => x.replacement), (name, rows, i) => Sim.state.newReplacementRow({ id: 'agg_r' + i, name, cycleYears: wavg(rows, 'cycleYears', 'pastBuyers'), pastBuyers: sumOf(rows, r => r.pastBuyers).s }));
    const prevs = list.map(x => x.prev).filter(Boolean); m.prev = prevs.length ? mergeMgmt(prevs).mgmt : null;
    return { mgmt: m, coverage };
  }
  function companyMgmt(company) {
    const stores = (company && company.stores) || []; const merged = mergeMgmt(stores.map(s => s.mgmt || {}));
    const m = mgmtCore(merged.mgmt); m.available = m.revenue != null; m.prev = merged.mgmt.prev ? mgmtCore(merged.mgmt.prev) : null;
    const sts = stores.map(s => store(s, 1)); const newTotal = sts.reduce((a, x) => a + x.newTotal, 0); const cohort = sts.reduce((a, x) => a + x.revenue, 0);
    const weightedLtv = newTotal > 0 ? cohort / newTotal : 0; const cogsRate = m.grossMarginPct != null ? 1 - m.grossMarginPct : null;
    m.channels = mergeByName(stores.map(s => s.channels), (name, rows, i) => {
      const n = sumOf(rows, r => r.newCustomers).s || 0, cost = sumOf(rows, r => r.cost).s || 0; const cpa = n > 0 ? cost / n : null;
      return { id: 'agg_ch' + i, name, newCustomers: n, cost, cpa, payback: (cpa != null && cpa > 0 && cogsRate != null) ? weightedLtv * (1 - cogsRate) / cpa : null };
    });
    const hqRaw = (company && company.company && company.company.hq) || {}; const hqKeys = ['labor', 'rent', 'ads', 'other']; const hq = {};
    hqKeys.forEach(k => { hq[k] = nn(hqRaw[k]); }); const hqVals = hqKeys.map(k => hq[k]).filter(v => v != null); hq.total = hqVals.length ? hqVals.reduce((a, b) => a + b, 0) : null;
    const operatingProfitAfterHq = m.operatingProfit != null ? m.operatingProfit - (hq.total || 0) : null;
    const fixedCostsWithHq = m.fixedCosts != null ? m.fixedCosts + (hq.total || 0) : null;
    const breakEvenWithHq = (fixedCostsWithHq != null && m.grossMarginPct > 0) ? fixedCostsWithHq / m.grossMarginPct : null;
    return { available: m.available, m, coverage: merged.coverage, hq, operatingProfitAfterHq, fixedCostsWithHq, breakEvenWithHq,
      safetyMarginWithHq: (breakEvenWithHq != null && m.revenue > 0) ? (m.revenue - breakEvenWithHq) / m.revenue : null, storeCount: stores.length };
  }
  function companyRequired(company) {
    const cm = companyMgmt(company); const rp = company.company.plan.requiredProfit;
    if (rp == null || cm.fixedCostsWithHq == null || !(cm.m.grossMarginPct > 0) || cm.m.revenue == null) return null;
    const required = (cm.fixedCostsWithHq + rp) / cm.m.grossMarginPct; const g = company.company.plan.existingGrowthPct || 0;
    const existingForecast = cm.m.existingRevenue != null ? cm.m.existingRevenue * (1 + g / 100) : null;
    return { required, current: cm.m.revenue, gap: required - cm.m.revenue, existingForecast, newTarget: existingForecast != null ? Math.max(0, required - existingForecast) : null,
      grossMarginPct: cm.m.grossMarginPct, fixedCosts: cm.fixedCostsWithHq, hqTotal: cm.hq.total };
  }
  const CMP_METRICS = [
    { key: 'revenue', label: '総売上（年）', unit: 'yen', better: 'high', group: 'mgmt' },
    { key: 'grossMarginPct', label: '粗利率', unit: 'pct', better: 'high', group: 'mgmt', bench: 'grossMarginPct' },
    { key: 'operatingProfit', label: '営業利益（本部費前）', unit: 'yen', better: 'high', group: 'mgmt' },
    { key: 'opMarginPct', label: '営業利益率', unit: 'pct', better: 'high', group: 'mgmt' },
    { key: 'buyers', label: '購入客数', unit: 'num', better: 'high', group: 'mgmt' },
    { key: 'newBuyers', label: '新規客数', unit: 'num', better: 'high', group: 'mgmt' },
    { key: 'newShare', label: '新規客比率（売上）', unit: 'pct', better: 'high', group: 'mgmt' },
    { key: 'aov', label: '客単価', unit: 'yen', better: 'high', group: 'mgmt' },
    { key: 'repeatRate', label: 'リピート率', unit: 'pct', better: 'high', group: 'mgmt', bench: 'repeatRate' },
    { key: 'safetyMargin', label: '安全余裕率', unit: 'pct', better: 'high', group: 'mgmt' },
    { key: 'laborPct', label: '人件費率', unit: 'pct', better: 'low', group: 'mgmt', bench: 'laborPct' },
    { key: 'rentPct', label: '家賃比率', unit: 'pct', better: 'low', group: 'mgmt', bench: 'rentPct' },
    { key: 'adsPct', label: '広告費率', unit: 'pct', better: 'low', group: 'mgmt', bench: 'adsPct' },
    { key: 'breakEven', label: '損益分岐点売上', unit: 'yen', better: 'low', group: 'mgmt' },
    { key: 'categoryCount', label: '間口カテゴリ数', unit: 'num', better: null, group: 'entry' },
    { key: 'newTotal', label: '新規獲得人数（間口合計）', unit: 'num', better: 'high', group: 'entry' },
    { key: 'weightedLtv', label: '平均LTV（期間）', unit: 'yen', better: 'high', group: 'entry' },
    { key: 'cohortRevenue', label: '期間累計売上', unit: 'yen', better: 'high', group: 'entry' },
    { key: 'target', label: '間口の目標売上（期間）', unit: 'yen', better: null, group: 'entry' },
    { key: 'scenarioRevenue', label: '今の配分での売上（期間）', unit: 'yen', better: null, group: 'entry' }
  ];
  function marks(values, better) {
    const valid = values.filter(v => v.value != null); if (!better || valid.length < 2) return;
    const nums = valid.map(v => v.value); const best = better === 'high' ? Math.max(...nums) : Math.min(...nums); const worst = better === 'high' ? Math.min(...nums) : Math.max(...nums);
    valid.forEach(v => { v.mark = v.value === best ? '◎' : (v.value === worst ? '△' : '○'); });
  }
  function storeComparison(company, period) {
    const stores = company.stores || []; const cm = companyMgmt(company); const b = (stores[0] && stores[0].benchmarks) || {};
    const per = stores.map(s => {
      const mg = mgmt(s); const st = store(s, period); const sc = s.plan.scenarios[s.plan.activeScenario] || s.plan.scenarios[0];
      return Object.assign({}, mg, { categoryCount: s.categories.length, newTotal: st.newTotal, weightedLtv: st.newTotal > 0 ? st.weightedLtv : null,
        cohortRevenue: st.revenue, target: s.plan.targetRevenue[period - 1], scenarioRevenue: store(s, period, sc && sc.levers).revenue });
    });
    const sum = k => sumOf(per, x => x[k]).s; const coNew = sum('newTotal'); const coCohort = sum('cohortRevenue');
    const coEntry = { categoryCount: sum('categoryCount'), newTotal: coNew, weightedLtv: coNew > 0 ? coCohort / coNew : null, cohortRevenue: coCohort, target: sum('target'), scenarioRevenue: sum('scenarioRevenue') };
    const metrics = CMP_METRICS.map(def => {
      const values = per.map((p, i) => ({ storeId: stores[i].store.id, value: p[def.key] == null ? null : p[def.key], mark: null })); marks(values, def.better);
      const co = def.group === 'entry' ? coEntry[def.key] : cm.m[def.key];
      return Object.assign({}, def, { bench: (def.bench && b[def.bench] != null) ? b[def.bench] / 100 : null, values, company: co == null ? null : co });
    });
    return { stores: stores.map((s, i) => ({ id: s.store.id, name: Sim.state.storeLabel(company, i) })), metrics };
  }
```

export 行を差し替える:

```js
  Sim.calc = { STANDARD_DELTAS, applied, ltv, category, store, reverse, reachRate, evenSplit, crmTargets, effectiveCogsRate, mgmtCore, mgmt, consistency, mgmtLeverage, requiredRevenue,
    companyMgmt, companyRequired, storeComparison, CMP_METRICS };
```

- [ ] **Step 4: 全件通過を確認する**

Run: `node tests/run.js 2>&1 | tail -3`
Expected: `106 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/calc.js tests/calc.test.js
git commit -m "feat(calc): 全社合算 companyMgmt・本部費込み逆算 companyRequired・店舗横並び storeComparison

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: analysis.js に全社の健康度・コメントを追加する

**Files:**
- Modify: `js/analysis.js`（`mgmtHealth` を `healthOf` に分離して再利用）
- Test: `tests/analysis.test.js`（末尾に追加）

**Interfaces:**
- Consumes: `Sim.calc.companyMgmt / storeComparison / mgmt`, `Sim.ui.util.yen`
- Produces:
  - `Sim.analysis.companyHealth(company)` → `{ available:false, cm }` または `{ available:true, m, cm, mode, ratios, gross, repeat, lowContribution, coverageNote }`（`mgmtHealth` と同じキー＋`cm`・`coverageNote`）
  - `Sim.analysis.companyComments(company, period)` → 文字列の配列（最大5件）
  - `Sim.analysis.COVERAGE_LABELS`

- [ ] **Step 1: テストを `tests/analysis.test.js` の末尾に追加する**

```js
test('companyHealth: 合算の健康度と比較モード', () => {
  const c = Sim.state.createSample(); const h = A.companyHealth(c); ok(h.available); eq(h.mode, 'none'); approx(h.gross.value, 0.5, 1e-9); eq(h.coverageNote, null); eq(h.cm.hq.total, 4800000);
  eq(h.ratios.map(r => r.key), ['laborPct', 'rentPct', 'adsPct', 'otherPct']); approx(h.ratios[0].value, 15600000 / 76800000, 1e-9);
  c.stores[0].benchmarks.laborPct = 18; Sim.state.syncShared(c, 0); const h2 = A.companyHealth(c); eq(h2.mode, 'benchmark'); approx(h2.ratios[0].diffBench, 15600000 / 76800000 - 0.18, 1e-9);
  eq(A.companyHealth(Sim.state.createEmpty()).available, false);
});
test('companyHealth: カバレッジ注記', () => {
  const c = Sim.state.createSample(); c.stores[1].mgmt.costs.labor = null; eq(A.companyHealth(c).coverageNote, '空欄の店舗は合算に含めていません（人件費 1／2店舗）');
  c.stores[1].mgmt.visits.once = null; eq(A.companyHealth(c).coverageNote, '空欄の店舗は合算に含めていません（来店回数別 1／2店舗、人件費 1／2店舗）');
});
test('companyComments: 最大5件・本部費の文・未入力の文・空の案内', () => {
  const c = Sim.state.createSample(); const out = A.companyComments(c, 3); ok(out.length <= 5); ok(out.some(t => t.includes('粗利率'))); ok(out.some(t => t.includes('人件費率が最も高いのは2号店')));
  ok(out.some(t => t.includes('本部費480万円')), out.join('|')); ok(out.some(t => t.includes('損益分岐点売上は7,240万円')), out.join('|'));
  c.company.hq = { labor: null, rent: null, ads: null, other: null }; const o2 = A.companyComments(c, 3); ok(o2.some(t => t.includes('本部費が未入力'))); ok(!o2.some(t => t.includes('にあたります')));
  c.stores[1].mgmt.costs.labor = null; ok(A.companyComments(c, 3).some(t => t.includes('空欄の店舗は合算に含めていません')));
  eq(A.companyComments(Sim.state.createEmpty(), 3), ['店舗タブで経営数値を入れると、全社の合算とコメントが出ます。']);
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `node tests/run.js 2>&1 | grep -c "✗"`
Expected: `3`

- [ ] **Step 3: `js/analysis.js` を変更する**

(1) `mgmtHealth` を分離する。既存の `mgmtHealth` 本体（`const b = ...` から `return {...}` まで）を `healthOf(m, b)` に移し、`mgmtHealth` は薄い関数にする:

```js
  function healthOf(m, b) {
    const p = m.prev;
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
    return { mode, ratios, gross, repeat, lowContribution };
  }
  function mgmtHealth(state) {
    const m = Sim.calc.mgmt(state); if (!m.available) return { available: false };
    return Object.assign({ available: true, m }, healthOf(m, state.benchmarks || {}));
  }
```

(2) `mgmtComments` の後に追加:

```js
  const COVERAGE_LABELS = { revenue: '総売上', buyers: '購入客数', newBuyers: '新規客数', newRevenue: '新規客売上', activeCustomers: 'アクティブ顧客数', dormant: '休眠客数', inventory: '期末在庫',
    visits: '来店回数別', funnel: '集客', 'costs.cogs': '仕入原価', 'costs.labor': '人件費', 'costs.rent': '家賃', 'costs.ads': '広告宣伝費', 'costs.other': 'その他経費' };
  function coverageNote(cm) {
    const parts = Object.keys(cm.coverage).filter(k => { const c = cm.coverage[k]; return c.n > 0 && c.n < c.total; }).map(k => `${COVERAGE_LABELS[k] || k} ${cm.coverage[k].n}／${cm.coverage[k].total}店舗`);
    return parts.length ? `空欄の店舗は合算に含めていません（${parts.join('、')}）` : null;
  }
  function companyHealth(company) {
    const cm = Sim.calc.companyMgmt(company); if (!cm.available) return { available: false, cm };
    const b = (company.stores[0] && company.stores[0].benchmarks) || {};
    return Object.assign({ available: true, m: cm.m, cm, coverageNote: coverageNote(cm) }, healthOf(cm.m, b));
  }
  function companyComments(company, period) {
    const h = companyHealth(company); if (!h.available) return ['店舗タブで経営数値を入れると、全社の合算とコメントが出ます。'];
    const cmp = Sim.calc.storeComparison(company, period || 3); const out = []; const nameOf = id => (cmp.stores.find(s => s.id === id) || {}).name || '';
    const spread = key => { const mt = cmp.metrics.find(x => x.key === key); const vals = mt.values.filter(v => v.value != null); if (vals.length < 2) return null;
      const hi = vals.reduce((a, b) => (b.value > a.value ? b : a)); const lo = vals.reduce((a, b) => (b.value < a.value ? b : a)); return { hi, lo }; };
    const g = spread('grossMarginPct');
    if (g) out.push(g.hi.value === g.lo.value ? `粗利率は全店とも${pct1(g.hi.value)}です。` : `粗利率が最も高いのは${nameOf(g.hi.storeId)}（${pct1(g.hi.value)}）、最も低いのは${nameOf(g.lo.storeId)}（${pct1(g.lo.value)}）。差は${(Math.round((g.hi.value - g.lo.value) * 1000) / 10)}ptです。`);
    if (h.cm.breakEvenWithHq != null) out.push(`全社の損益分岐点売上は${yen(h.cm.breakEvenWithHq)}（本部費込み）で、安全余裕率は${pct1(h.cm.safetyMarginWithHq)}です。`);
    const l = spread('laborPct'); if (l) out.push(`人件費率が最も高いのは${nameOf(l.hi.storeId)}（${pct1(l.hi.value)}）です。店舗別の営業利益には本部費を含めていません。`);
    if (h.cm.hq.total == null) out.push('本部費が未入力のため、全社の営業利益は店舗合算の値をそのまま表示しています。');
    else if (h.m.operatingProfit > 0) out.push(`本部費${yen(h.cm.hq.total)}は、店舗合算の営業利益${yen(h.m.operatingProfit)}の${pct1(h.cm.hq.total / h.m.operatingProfit)}にあたります。`);
    if (h.coverageNote) out.push(h.coverageNote + '。');
    return out.slice(0, 5);
  }
```

(3) export 行に追加:

```js
  Sim.analysis = { MIN_BASE, LEVER_LABELS, QUADRANT_LABELS, COVERAGE_LABELS, portfolio, leverage, weakness, timing, checks, comments, mgmtHealth, consistencyCheck, mgmtChecks, mgmtComments, companyHealth, companyComments };
```

- [ ] **Step 4: 全件通過を確認する**

Run: `node tests/run.js 2>&1 | tail -3`
Expected: `109 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/analysis.js tests/analysis.test.js
git commit -m "feat(analysis): 全社の健康度 companyHealth・カバレッジ注記・全社コメント

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: app.js・index.html・CSS を会社構造に切り替える（店舗切替バー・2本のAPI・店舗ファイル取込）

**Files:**
- Modify: `js/app.js`（全面書き換え）
- Modify: `js/ui-util.js`（`bindPanel` が最新の `api` を使うよう修正）
- Modify: `index.html`（店舗切替バー・店舗ファイル用 input・script 3本）
- Modify: `css/style.css`, `css/print.css`

**Interfaces:**
- Consumes: Task 1 の `Sim.state.*`
- Produces（Task 5〜7 の全社モジュールが使う `companyApi`）:
  - `api`（店舗タブ用）: `{ update(fn,{structural}), setStep(n), getState() → 店舗バンドル, getCompany() → 会社, period, setStore(id|null), exportStore(id), pickStoreFile(mode:'add'|'replace', id?) }`
  - `companyApi`（全社タブ用）: 同じキーで `update(fn)` の `fn` には会社の箱、`getState()` は会社
  - 全社モジュールの登録先: `Sim.ui.company.mgmt / Sim.ui.company.entry / Sim.ui.companyDiag / Sim.ui.companyPlan.plan / Sim.ui.companyPlan.report`（未登録なら「準備中」を表示）
  - `Sim.app = { api, companyApi, setStep, setPeriod, update, updateCompany, setStore }`

- [ ] **Step 1: `js/ui-util.js` の `bindPanel` を修正する**

同じパネル要素を店舗モジュールと全社モジュールが交互に使うため、リスナーが最初に渡された `api` を掴んだままだと全社の入力が店舗に書かれてしまう。`el._api` に最新を持たせる。

```js
  function bindPanel(el, api, actions) {
    if (el.dataset.bound) { el._actions = actions; el._api = api; return; }
    el.dataset.bound = '1'; el._actions = actions; el._api = api;
    el.addEventListener('input', e => {
      const t = e.target.closest('[data-path]'); if (!t || t.type === 'checkbox') return;
      const v = parseValue(t); el._api.update(s => setPath(s, t.dataset.path, v));
    });
    el.addEventListener('change', e => {
      const t = e.target.closest('[data-path]'); if (!t || t.type !== 'checkbox') return;
      const v = parseValue(t); el._api.update(s => setPath(s, t.dataset.path, v));
    });
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-action]'); if (!t || !el.contains(t)) return;
      const fn = el._actions && el._actions[t.dataset.action]; if (fn) fn(t.dataset, t, e);
    });
  }
```

- [ ] **Step 2: `index.html` を変更する**

(1) ヘッダーの `head-tools` に店舗ファイル用 input を足す（`import-file` の label の直後）:

```html
        <input type="file" id="store-file" accept="application/json,.json" hidden>
```

(2) ステッパーの直前に店舗切替バーを足す:

```html
<nav class="storebar wrap" id="storebar" aria-label="店舗切替"></nav>
```

(3) `head-sub` の文言を差し替える:

```html
        <p id="head-sub">経営数値と間口カテゴリを入れて診断し、目標とレバー配分まで設計します。複数店舗は店舗タブで切り替え、「全社」で合算を見ます。入力は自動保存されます。</p>
```

(4) script を `ui-report.js` の後・`app.js` の前に3本追加:

```html
<script src="js/ui-company.js"></script>
<script src="js/ui-company-diag.js"></script>
<script src="js/ui-company-plan.js"></script>
```

- [ ] **Step 3: `css/style.css` の `@media` の直前に追加する**

```css
.storebar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:16px auto 0}
.storebar button{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;color:var(--text-soft);display:flex;align-items:center;gap:6px;transition:.15s}
.storebar button .no{font-family:"Times New Roman",serif;font-size:11px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:var(--line);color:var(--ink)}
.storebar button.active{background:var(--gold);color:var(--ink);border-color:var(--gold)}
.storebar button.active .no{background:var(--ink);color:#fff}
.storebar button:not(.active):hover{border-color:var(--gold)}
.storebar .spacer{flex:1}
.storebar button.add{border-style:dashed;font-weight:700;font-size:12px}
.cmp-wrap{overflow-x:auto}
.cmp-table th,.cmp-table td{white-space:nowrap;text-align:right}
.cmp-table th:first-child,.cmp-table td:first-child{text-align:left}
.cmp-table td.co{font-weight:800;background:rgba(58,90,140,.06)}
.mark{display:inline-block;margin-left:4px;font-size:11px;font-weight:800}
.mark.best{color:var(--good)}.mark.worst{color:var(--bad)}.mark.mid{color:var(--text-soft)}
.store-list td .sbtn{margin:0 4px 0 0;padding:4px 8px}
.ltable tr.total td{font-weight:800;border-top:2px solid var(--line);border-bottom:none}
.note-p.ok{color:var(--good);font-weight:700}
```

`css/print.css` の変更（2行）:

```css
  .site-head, #stepper, #storebar, #floatp, .no-print, .footnote, details.guide { display: none !important; }
  .cmp-table { font-size: 10px; } .cmp-wrap { overflow: visible; } .mark.best, .mark.worst, .mark.mid { color: #1a2236 !important; }
```

（1行目は既存の `.site-head, #stepper, ...` 行を置き換える。2行目は `.ltable { font-size: 11px; }` の次に足す）

- [ ] **Step 4: `js/app.js` を全面的に書き換える**

```js
window.Sim = window.Sim || {};
(function () {
  const $ = id => document.getElementById(id);
  const app = { company: null, step: 1, storage: null, filePick: null };
  let reportDirty = true;
  function getStorage() { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch (e) { return null; } }
  const active = () => Sim.state.activeStore(app.company);
  const isCompanyView = () => active() == null;
  const storeMods = () => ({ 1: Sim.ui.mgmt, 2: Sim.ui.input, 3: Sim.ui.diagnosis, 4: Sim.ui.plan, 5: Sim.ui.report });
  const companyMods = () => ({ 1: Sim.ui.company && Sim.ui.company.mgmt, 2: Sim.ui.company && Sim.ui.company.entry, 3: Sim.ui.companyDiag, 4: Sim.ui.companyPlan && Sim.ui.companyPlan.plan, 5: Sim.ui.companyPlan && Sim.ui.companyPlan.report });
  const currentMod = step => (isCompanyView() ? companyMods() : storeMods())[step];
  const currentState = () => (isCompanyView() ? app.company : active());
  const currentApi = () => (isCompanyView() ? companyApi : api);
  const periodOf = () => (active() || app.company.stores[0]).store.period;
  function persist() { if (app.storage) Sim.state.save(app.company, app.storage); }
  function touch() { app.company.meta.updatedAt = new Date().toISOString(); persist(); reportDirty = true; }
  function applyGuide(el) { if (document.body.classList.contains('guide-open')) el.querySelectorAll('details.guide').forEach(d => { d.open = true; }); }
  function update(fn, opts) {
    opts = opts || {}; const s = active(); if (!s) return;
    fn(s); Sim.state.syncScenarios(s); Sim.state.syncShared(app.company, app.company.stores.indexOf(s)); touch();
    if (opts.structural) renderStep(); else refreshStep();
  }
  function updateCompany(fn, opts) {
    opts = opts || {}; fn(app.company); app.company.stores.forEach(s => Sim.state.syncScenarios(s)); Sim.state.syncShared(app.company, 0); touch();
    renderStoreBar(); if (opts.structural) renderStep(); else refreshStep();
  }
  const api = { update, setStep, getState: () => active(), getCompany: () => app.company, get period() { return periodOf(); }, setStore, exportStore, pickStoreFile };
  const companyApi = { update: updateCompany, setStep, getState: () => app.company, getCompany: () => app.company, get period() { return periodOf(); }, setStore, exportStore, pickStoreFile };
  function renderHeader() {
    const s = active(); const multi = app.company.stores.length > 1;
    const parts = [app.company.company.name, s ? s.store.name : (multi ? '全社' : '')].filter(Boolean);
    $('head-title').textContent = parts.concat('売上シミュレーター').join('｜'); document.title = parts.concat('店舗 売上シミュレーター').join('｜');
    const p = periodOf(); document.querySelectorAll('#periodbar button, #floatp button').forEach(b => b.classList.toggle('active', +b.dataset.p === p));
  }
  function renderStoreBar() {
    const c = app.company; const esc = Sim.ui.util.esc; const multi = c.stores.length > 1;
    $('storebar').innerHTML = (multi ? `<button type="button" data-store="" class="${c.activeStoreId == null ? 'active' : ''}"><span class="no">全</span>全社</button>` : '') +
      c.stores.map((s, i) => `<button type="button" data-store="${esc(s.store.id)}" class="${c.activeStoreId === s.store.id ? 'active' : ''}">${esc(Sim.state.storeLabel(c, i))}</button>`).join('') +
      `<span class="spacer"></span><button type="button" class="add" data-store-add="empty">＋ 空の店舗</button><button type="button" class="add" data-store-add="file">＋ ファイルから店舗</button>`;
  }
  function renderStep() {
    const el = $('panel-' + app.step); const m = currentMod(app.step);
    if (!m) el.innerHTML = '<p class="note-p">この画面は準備中です。</p>'; else { m.render(el, currentState(), currentApi()); applyGuide(el); }
    renderHeader();
  }
  function refreshStep() { const el = $('panel-' + app.step); const m = currentMod(app.step); if (!m) return renderStep(); (m.refresh || m.render)(el, currentState(), currentApi()); renderHeader(); }
  function setStep(n) {
    app.step = n;
    document.querySelectorAll('.step-panel').forEach(p => { p.hidden = +p.dataset.step !== n; });
    document.querySelectorAll('#stepper button').forEach(b => b.classList.toggle('active', +b.dataset.step === n));
    renderStep(); window.scrollTo({ top: 0 });
    if (n === 5) reportDirty = false;
  }
  function setStore(id) {
    app.company.activeStoreId = id || null; if (app.company.stores.length === 1) app.company.activeStoreId = app.company.stores[0].store.id;
    persist(); renderStoreBar(); renderStep(); window.scrollTo({ top: 0 });
  }
  function setPeriod(p) { const src = active() || app.company.stores[0]; src.store.period = p; Sim.state.syncShared(app.company, app.company.stores.indexOf(src)); touch(); renderStep(); }
  function replaceCompany(next) { app.company = next; app.company.stores.forEach(s => Sim.state.syncScenarios(s)); persist(); reportDirty = true; renderStoreBar(); renderStep(); }
  function download(text, name) {
    const blob = new Blob([text], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportJson() { download(Sim.state.serialize(app.company), Sim.state.exportFilename(app.company)); }
  function exportStore(id) { const s = app.company.stores.find(x => x.store.id === id); if (s) download(Sim.state.serializeStore(s), Sim.state.exportStoreFilename(s)); }
  function readFile(file, onText) { const r = new FileReader(); r.onload = () => onText(r.result); r.onerror = () => alert('ファイルを読み込めませんでした。'); r.readAsText(file); }
  function errMsg(e) {
    if (e.message === 'unsupported version') return 'このファイルは新しい形式のため読み込めません。';
    if (e.message === 'company file') return 'これは会社全体のファイルです。店舗ファイルを選んでください。';
    return 'ファイルの形式が違います。';
  }
  function importJson(file) {
    readFile(file, text => {
      try {
        const next = Sim.state.parse(text); let raw = null; try { raw = JSON.parse(text); } catch (e) { raw = null; }
        const isStoreFile = !(raw && Array.isArray(raw.stores));
        const msg = (isStoreFile && app.company.stores.length > 1)
          ? '店舗ファイルです。今の内容（全店舗）をこの店舗1つに置き換えます。店舗として追加したい場合は「＋ ファイルから店舗」をお使いください。よろしいですか？'
          : '今の内容を、読み込んだ内容で置き換えます。よろしいですか？';
        if (!confirm(msg)) return; replaceCompany(next);
      } catch (e) { alert(errMsg(e)); }
    });
  }
  function pickStoreFile(mode, id) { app.filePick = { mode: mode || 'add', id: id || null }; $('store-file').click(); }
  function importStoreFile(file) {
    const pick = app.filePick || { mode: 'add', id: null }; app.filePick = null;
    readFile(file, text => {
      try {
        const bundle = Sim.state.parseStore(text);
        if (pick.mode === 'replace') { if (!confirm('この店舗の内容をファイルで置き換えます。よろしいですか？')) return; updateCompany(c => { Sim.state.replaceStore(c, pick.id, bundle); }, { structural: true }); }
        else { let nid = null; updateCompany(c => { nid = Sim.state.addStore(c, bundle); }, { structural: true }); setStore(nid); }
      } catch (e) { alert(errMsg(e)); }
    });
  }
  function init() {
    app.storage = getStorage(); if (!app.storage) $('storage-notice').hidden = false;
    app.company = (app.storage && Sim.state.load(app.storage)) || Sim.state.createSample(); app.company.stores.forEach(s => Sim.state.syncScenarios(s));
    document.querySelectorAll('#stepper button').forEach(b => { b.onclick = () => setStep(+b.dataset.step); });
    document.querySelectorAll('#periodbar button, #floatp button').forEach(b => { b.onclick = () => setPeriod(+b.dataset.p); });
    document.querySelectorAll('[data-app]').forEach(b => {
      b.onclick = () => {
        const a = b.dataset.app;
        if (a === 'export') exportJson();
        if (a === 'sample' && confirm('サンプルデータ（2店舗）を読み込み、今の内容を置き換えます。よろしいですか？')) replaceCompany(Sim.state.createSample());
        if (a === 'reset' && confirm('空の状態から始めます。今の内容は消えます。よろしいですか？')) replaceCompany(Sim.state.createEmpty());
        if (a === 'guide') { const open = document.body.classList.toggle('guide-open'); document.querySelectorAll('details.guide').forEach(d => { d.open = open; }); b.textContent = open ? 'ガイドをすべて閉じる' : 'ガイドをすべて開く'; }
      };
    });
    $('import-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importJson(f); e.target.value = ''; });
    $('store-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) importStoreFile(f); e.target.value = ''; });
    $('storebar').addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.storeAdd === 'empty') { let nid = null; updateCompany(c => { nid = Sim.state.addStore(c); }, { structural: true }); setStore(nid); return; }
      if (t.dataset.storeAdd === 'file') { pickStoreFile('add'); return; }
      if ('store' in t.dataset) setStore(t.dataset.store || null);
    });
    const fp = $('floatp'), anchor = $('periodbar');
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => fp.classList.toggle('hide', e.isIntersecting)), { threshold: 0 }).observe(anchor);
    window.addEventListener('beforeprint', () => { const m = currentMod(5); if (reportDirty && m) { m.render($('panel-5'), currentState(), currentApi()); applyGuide($('panel-5')); reportDirty = false; } });
    renderStoreBar(); setStep(1);
  }
  document.addEventListener('DOMContentLoaded', init);
  Sim.app = { api, companyApi, setStep, setPeriod, update, updateCompany, setStore };
})();
```

- [ ] **Step 5: Node テストが引き続き通ることを確認する**

Run: `node tests/run.js 2>&1 | tail -1`
Expected: `109 passed, 0 failed`

- [ ] **Step 6: ブラウザ確認（コントローラーが Playwright で実施。実装者は手順を README に書かず、この手順を報告に添える）**

新しいポートで起動してキャッシュを避ける: `python3 -m http.server 8771 --directory /Users/tsujiyuuta/Desktop/claude-outputs/nemu-simulator`（背景実行）。`http://localhost:8771/index.html?v=22a` を開き、次を確認する。

1. 初回（localStorage 空）はサンプル2店舗が読み込まれ、店舗バーに「全社／本店／2号店／＋空の店舗／＋ファイルから店舗」が出る。全社が選択中で ①〜⑤ は「この画面は準備中です。」（Task 5〜7 で置き換わる）
2. 「本店」を押すと ① が従来の経営数値入力になり、見出しが「サンプル寝具株式会社｜本店｜売上シミュレーター」
3. 「空で始める」→ 店舗1つ。店舗バーに「全社」が出ない。見出しは「売上シミュレーター」。① で総売上を入れると ③ に反映（従来どおり）
4. 「＋ 空の店舗」→ 2つ目のタブが増え、そちらに切り替わる。「全社」が現れる
5. 期間切替（24ヶ月）を店舗Aで押し、店舗Bに切り替えても 24ヶ月のまま
6. コンソールに JavaScript エラーがない

- [ ] **Step 7: コミット**

```bash
git add js/app.js js/ui-util.js index.html css/style.css css/print.css
git commit -m "feat(app): 会社構造への切替（店舗切替バー・店舗/全社の2API・店舗ファイル取込・bindPanelの最新api参照）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 全社①（本部費・合算サマリー・店舗一覧）と全社②（間口の横並び）— `ui-company.js`

**Files:**
- Create: `js/ui-company.js`

**Interfaces:**
- Consumes: `companyApi`（Task 4）、`Sim.calc.companyMgmt / storeComparison`、`Sim.analysis.companyHealth`、`Sim.state.storeLabel / addStore / removeStore / duplicateStore`、`Sim.ui.util`
- Produces: `Sim.ui.company = { mgmt:{render,refresh}, entry:{render,refresh}, parts:{ comparisonTable(cmp, group), fmtMetric(v, unit), summary(cm), pctS } }`

- [ ] **Step 1: `js/ui-company.js` を作成する**

```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  const pctS = v => (v == null ? '—' : (Math.round(v * 1000) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '%');
  function fmtMetric(v, unit) { const { yen, fmt } = U(); if (v == null) return '—'; if (unit === 'yen') return yen(v); if (unit === 'pct') return pctS(v); return fmt(v); }
  function comparisonTable(cmp, group) {
    const { esc } = U(); const rows = cmp.metrics.filter(m => m.group === group); const hasBench = rows.some(m => m.bench != null);
    const markHtml = mk => (mk ? `<span class="mark ${mk === '◎' ? 'best' : (mk === '△' ? 'worst' : 'mid')}">${mk}</span>` : '');
    return `<div class="cmp-wrap"><table class="ltable cmp-table"><tr><th>指標</th>${cmp.stores.map(s => `<th>${esc(s.name)}</th>`).join('')}<th>全社</th>${hasBench ? '<th>目安</th>' : ''}</tr>
      ${rows.map(m => `<tr><td>${esc(m.label)}</td>${m.values.map(v => `<td>${fmtMetric(v.value, m.unit)}${markHtml(v.mark)}</td>`).join('')}<td class="co">${fmtMetric(m.company, m.unit)}</td>${hasBench ? `<td>${m.bench == null ? '' : fmtMetric(m.bench, m.unit)}</td>` : ''}</tr>`).join('')}</table></div>`;
  }
  function hqField(label, key, value) { const { man } = U(); return `<div class="field"><span class="flabel">${label}<span class="q">万円／年</span></span><input class="inp" type="number" min="0" step="0.1" data-type="man" data-path="company.hq.${key}" value="${man(value)}"></div>`; }
  function summary(cm) {
    const { yen } = U(); const m = cm.m;
    if (!cm.available) return '<p class="note-p">店舗タブで経営数値（総売上など）を入れると、ここに全社の合算が出ます。</p>';
    const kv = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    return `<div class="mgkv">${kv('総売上（合算）', yen(m.revenue))}${kv('粗利', yen(m.grossProfit))}${kv('粗利率', pctS(m.grossMarginPct))}${kv('店舗の固定費（合算）', yen(m.fixedCosts))}${kv('営業利益（本部費前）', yen(m.operatingProfit))}${kv('本部費', cm.hq.total == null ? '未入力' : yen(cm.hq.total))}${kv('全社 営業利益', yen(cm.operatingProfitAfterHq))}${kv('損益分岐点（本部費込み）', yen(cm.breakEvenWithHq))}${kv('安全余裕率（本部費込み）', pctS(cm.safetyMarginWithHq))}</div>`;
  }
  function storeList(company) {
    const { esc, yen } = U(); const canDel = company.stores.length > 1;
    return `<table class="ltable store-list"><tr><th>店舗</th><th>総売上（年）</th><th>間口カテゴリ</th><th>最終更新</th><th></th></tr>
      ${company.stores.map((s, i) => `<tr><td><b>${esc(Sim.state.storeLabel(company, i))}</b></td><td>${yen(s.mgmt.revenue)}</td><td>${s.categories.length}件</td><td>${esc((s.meta.updatedAt || '').slice(0, 10))}</td>
        <td><button type="button" class="sbtn" data-action="co-open" data-id="${esc(s.store.id)}">開く</button><button type="button" class="sbtn" data-action="co-export" data-id="${esc(s.store.id)}">この店舗を書き出す</button><button type="button" class="sbtn" data-action="co-replace" data-id="${esc(s.store.id)}">ファイルで置き換え</button><button type="button" class="sbtn" data-action="co-dup" data-id="${esc(s.store.id)}">複製</button><button type="button" class="sbtn danger" data-action="co-del" data-id="${esc(s.store.id)}"${canDel ? '' : ' disabled title="店舗は1つ以上必要です"'}>削除</button></td></tr>`).join('')}</table>
      <button type="button" class="sbtn" data-action="co-add-empty">＋ 空の店舗を追加</button><button type="button" class="sbtn" data-action="co-add-file">＋ ファイルから店舗を追加</button>
      <p class="note-p">「この店舗を書き出す」で作ったファイルは単店版でもそのまま読めます。各店で入力してもらい、「ファイルで置き換え」で取り込む運用ができます。</p>`;
  }
  function renderMgmt(el, company, api) {
    const { esc, guide } = U(); const hq = company.company.hq;
    el.innerHTML = `
      <p class="note-p">全社ビューです。各店舗の①経営数値を合算して表示します（合算は保存せず、店舗の数字を直すと自動で変わります）。ここで入力するのは会社名と本部費だけです。</p>
      <div class="sec-title"><span class="no">1</span><h2>会社と本部費</h2><span class="hint">${guide('本部費＝本社の人件費・家賃など、どの店舗にも属さない費用（年額）。全社の営業利益と損益分岐点にだけ効き、店舗別の利益には含めません。')}</span></div>
      <div class="card globals"><div class="gbox"><label>会社名（任意）</label><input type="text" data-path="company.name" value="${esc(company.company.name)}" placeholder="○○株式会社"></div></div>
      <div class="card pad"><div class="basebox mg4">${hqField('本部 人件費', 'labor', hq.labor)}${hqField('本部 家賃', 'rent', hq.rent)}${hqField('本部 広告宣伝費', 'ads', hq.ads)}${hqField('本部 その他経費', 'other', hq.other)}</div><div class="autovals" data-out="co-hq-total"></div></div>
      <div class="sec-title"><span class="no">2</span><h2>店舗合算サマリー</h2><span class="hint">読み取り専用</span></div>
      <div data-out="co-summary"></div><div class="warnings" data-out="co-coverage"></div>
      <div class="sec-title"><span class="no">3</span><h2>店舗一覧</h2><span class="hint">追加・複製・削除・ファイルの受け渡し</span></div>
      <div class="card pad">${storeList(company)}</div>`;
    outputsMgmt(el, company); U().bindPanel(el, api, actions(api));
  }
  function outputsMgmt(el, company) {
    const { yen, esc } = U(); const cm = Sim.calc.companyMgmt(company); const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    set('co-hq-total', `<span>本部費 合計<b>${cm.hq.total == null ? '未入力' : yen(cm.hq.total)}</b></span>`);
    set('co-summary', summary(cm));
    const note = Sim.analysis.companyHealth(company).coverageNote; set('co-coverage', note ? `<ul class="warn"><li>${esc(note)}</li></ul>` : '');
  }
  function actions(api) {
    return {
      'co-open': d => api.setStore(d.id),
      'co-export': d => api.exportStore(d.id),
      'co-replace': d => api.pickStoreFile('replace', d.id),
      'co-dup': d => api.update(c => { Sim.state.duplicateStore(c, d.id); }, { structural: true }),
      'co-del': d => { if (!confirm('この店舗を削除しますか？（元に戻せません。必要なら先に「この店舗を書き出す」で保存してください）')) return; api.update(c => { Sim.state.removeStore(c, d.id); }, { structural: true }); },
      'co-add-empty': () => { let nid = null; api.update(c => { nid = Sim.state.addStore(c); }, { structural: true }); api.setStore(nid); },
      'co-add-file': () => api.pickStoreFile('add')
    };
  }
  function renderEntry(el, company, api) {
    const { esc, guide } = U(); const cmp = Sim.calc.storeComparison(company, api.period);
    el.innerHTML = `
      <p class="note-p">全社ビューでは間口カテゴリを編集しません（店舗をまたいだ合算もしません）。店舗ごとの間口の力を横並びで見ます。編集は各店舗タブで行います。</p>
      <div class="sec-title"><span class="no">1</span><h2>店舗横並び（間口・${U().PERIOD_LABEL(api.period)}で見た場合）</h2><span class="hint">${guide('◎＝店舗内で最良、△＝最下位、○＝その間。目標売上と今の配分での売上は計画値のためマークを付けません。')}</span></div>
      <div class="card pad">${comparisonTable(cmp, 'entry')}
        <div class="sc-tabs">${cmp.stores.map(s => `<button type="button" data-action="co-open2" data-id="${esc(s.id)}">${esc(s.name)} の②を開く</button>`).join('')}</div></div>`;
    U().bindPanel(el, api, { 'co-open2': d => { api.setStore(d.id); api.setStep(2); } });
  }
  Sim.ui.company = { mgmt: { render: renderMgmt, refresh: outputsMgmt }, entry: { render: renderEntry, refresh: renderEntry }, parts: { comparisonTable, fmtMetric, summary, pctS } };
})();
```

- [ ] **Step 2: Node テスト（回帰）**

Run: `node tests/run.js 2>&1 | tail -1`
Expected: `109 passed, 0 failed`

- [ ] **Step 3: ブラウザ確認（コントローラー）**

`http://localhost:8771/index.html?v=22b`、「サンプルを読み込む」→ 全社 ①:
1. 会社名「サンプル寝具株式会社」、本部費 300／90／空／90（万円）が入っている。合計「480万円」
2. サマリー: 総売上 7,680万円・粗利率 50%・営業利益（本部費前）700万円・全社営業利益 220万円・損益分岐点 7,240万円・安全余裕率 5.7%
3. 本部 広告宣伝費に 100 を入れると、フォーカスを保ったまま合計 580万円・全社営業利益 120万円に変わる（`bindPanel` の `_api` 修正の確認）
4. 店舗一覧: 本店（4,800万円・2件）、2号店（2,880万円・2件）。「開く」で店舗タブへ。「複製」で「本店のコピー」が2番目に入る。「削除」で確認→消える。1店舗になると「全社」タブが消え、削除ボタンが無効
5. 「この店舗を書き出す」でダウンロードが起きる（Playwright では `download` イベントで確認）。「ファイルで置き換え」でファイル選択が開く（`store-file` の click）
6. 全社 ②: 横並び表に間口6行（カテゴリ数・新規獲得人数・平均LTV・期間累計売上・目標売上・今の配分での売上）。新規獲得 100／60・◎△、全社 160。「本店 の②を開く」で本店②へ

- [ ] **Step 4: コミット**

```bash
git add js/ui-company.js
git commit -m "feat(ui): 全社①（本部費・合算サマリー・店舗一覧）と全社②（間口の店舗横並び）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 全社③（健康度・横並び比較・コメント）— `ui-company-diag.js`＋滝図の拡張

**Files:**
- Create: `js/ui-company-diag.js`
- Modify: `js/ui-diagnosis.js`（`waterfallSvg(m, extra)` の引数追加のみ）

**Interfaces:**
- Consumes: `Sim.ui.company.parts.comparisonTable / pctS`、`Sim.ui.diagnosis.parts.waterfallSvg / costBars`、`Sim.analysis.companyHealth / companyComments`、`Sim.calc.storeComparison`
- Produces: `Sim.ui.companyDiag = { render, refresh, parts:{ companyKpis(cm), hqSteps(cm), hqTable(cm) } }`; `Sim.ui.diagnosis.parts.waterfallSvg(m, extra)`（`extra` は `[{ l, v, t:'minus'|'profit'|'loss'|'total' }]`、省略可）

- [ ] **Step 1: `js/ui-diagnosis.js` の `waterfallSvg` を拡張する**

シグネチャを `function waterfallSvg(m, extra)` にし、`if (m.operatingProfit != null) steps.push(...)` の直後に1行足す:

```js
    (extra || []).forEach(s => steps.push(s));
```

（レベル計算・最小値・棒の描画は既存のまま。`minus` は直前のレベルから引く、`profit/loss/total` は 0 からの棒なので追加段もそのまま描ける）

- [ ] **Step 2: `js/ui-company-diag.js` を作成する**

```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util; const CP = () => Sim.ui.company.parts; const D = () => Sim.ui.diagnosis.parts;
  function companyKpis(cm) {
    const { yen } = U(); const m = cm.m; const pctS = CP().pctS; const kv = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    const opAfterPct = (m.revenue > 0 && cm.operatingProfitAfterHq != null) ? cm.operatingProfitAfterHq / m.revenue : null;
    return `<div class="mgkv">${kv('総売上（合算）', yen(m.revenue))}${kv('粗利率', pctS(m.grossMarginPct))}${kv('営業利益（本部費前）', yen(m.operatingProfit))}${kv('本部費', cm.hq.total == null ? '未入力' : yen(cm.hq.total))}${kv('全社 営業利益', yen(cm.operatingProfitAfterHq))}${kv('全社 営業利益率', pctS(opAfterPct))}${kv('損益分岐点（本部費込み）', yen(cm.breakEvenWithHq))}${kv('安全余裕率（本部費込み）', pctS(cm.safetyMarginWithHq))}</div>`;
  }
  function hqSteps(cm) {
    if (cm.hq.total == null || cm.m.operatingProfit == null) return [];
    return [{ l: '本部費', v: -cm.hq.total, t: 'minus' }, { l: '全社営業利益', v: cm.operatingProfitAfterHq, t: cm.operatingProfitAfterHq >= 0 ? 'profit' : 'loss' }];
  }
  function hqTable(cm) {
    const { yen } = U(); const rows = [['本部 人件費', cm.hq.labor], ['本部 家賃', cm.hq.rent], ['本部 広告宣伝費', cm.hq.ads], ['本部 その他経費', cm.hq.other]];
    return `<table class="ltable"><tr><th>本部費（年）</th><th>金額</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1] == null ? '—' : yen(r[1])}</td></tr>`).join('')}<tr class="total"><td>合計</td><td>${cm.hq.total == null ? '未入力' : yen(cm.hq.total)}</td></tr></table>`;
  }
  function render(el, company, api) {
    const { esc, guide } = U(); const h = Sim.analysis.companyHealth(company); const period = api.period; const cmp = Sim.calc.storeComparison(company, period); const cm = Sim.analysis.companyComments(company, period);
    const health = h.available ? `
      <div class="sec-title"><span class="no">経</span><h2>全社の経営数値</h2></div>${companyKpis(h.cm)}${h.coverageNote ? `<ul class="warn"><li>${esc(h.coverageNote)}</li></ul>` : ''}
      <div class="sec-title"><span class="no">経</span><h2>収益構造</h2><span class="hint">店舗合算 → 本部費 → 全社営業利益</span></div><div class="card pad">${D().waterfallSvg(h.m, hqSteps(h.cm))}</div>
      <div class="sec-title"><span class="no">経</span><h2>費用比率（店舗合算）</h2><span class="hint">${guide('店舗の費用の合算を合算売上で割った比率です。本部費は含みません。目安値は会社共通です。')}</span></div><div class="card pad">${D().costBars(h)}</div>
      <div class="sec-title"><span class="no">経</span><h2>本部費</h2></div><div class="card pad">${hqTable(h.cm)}</div>
      <hr class="sep">` : '<p class="note-p">店舗タブで経営数値を入れると、ここに全社の健康度が出ます。以下は店舗の横並び比較です。</p>';
    el.innerHTML = `${health}
      <div class="sec-title"><span class="no">1</span><h2>店舗横並び比較（経営）</h2><span class="hint">${guide('◎＝店舗内で最良、△＝最下位、○＝その間。費用比率と損益分岐点は低いほど良い向きで判定します。店舗別の営業利益には本部費を含めていません。目安値があれば右端に出ます。')}</span></div>
      <div class="card pad">${CP().comparisonTable(cmp, 'mgmt')}</div>
      <div class="sec-title"><span class="no">2</span><h2>店舗横並び比較（間口・${U().PERIOD_LABEL(period)}）</h2></div><div class="card pad">${CP().comparisonTable(cmp, 'entry')}</div>
      <div class="sec-title"><span class="no">3</span><h2>全社コメント</h2></div><div class="card pad"><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  Sim.ui.companyDiag = { render, refresh: render, parts: { companyKpis, hqSteps, hqTable } };
})();
```

- [ ] **Step 3: Node テスト（回帰）**

Run: `node tests/run.js 2>&1 | tail -1`
Expected: `109 passed, 0 failed`

- [ ] **Step 4: ブラウザ確認（コントローラー）**

`?v=22c`、サンプル → 全社 ③:
1. KPI 8枠。滝図に「本部費」「全社営業利益」の段が末尾に追加され、全社営業利益 220万円が緑
2. 費用比率4本（人件費率 20.3% など）。本部費表 4行＋合計 480万円
3. 横並び（経営）14行、本店・2号店・全社・（目安列は目安値なしなので非表示）。粗利率は両方◎。人件費率は本店◎・2号店△
4. 本店②の目安値（人件費率 18）を入れると全社③に「目安」列が現れる
5. コメント5件以内。「本部費480万円は、店舗合算の営業利益700万円の68.6%にあたります。」がある
6. 店舗③（本店）の滝図は従来どおり（引数なし）

- [ ] **Step 5: コミット**

```bash
git add js/ui-company-diag.js js/ui-diagnosis.js
git commit -m "feat(ui): 全社③（健康度・本部費段つき滝図・店舗横並び比較・全社コメント）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 全社④（逆算・ロールアップ・本部費吸収チェック）と全社⑤（全社サマリー）— `ui-company-plan.js`＋店舗④の注記

**Files:**
- Create: `js/ui-company-plan.js`
- Modify: `js/ui-plan.js`（2店舗以上のとき「必要利益からの逆算」に注記1行）

**Interfaces:**
- Consumes: `Sim.calc.companyRequired / requiredRevenue / mgmt / store / reachRate`、`Sim.ui.plan.parts.requiredTable`、`Sim.ui.companyDiag.parts.*`、`Sim.ui.company.parts.comparisonTable`、`Sim.ui.diagnosis.parts.waterfallSvg / costBars`
- Produces: `Sim.ui.companyPlan = { plan:{render,refresh}, report:{render,refresh}, parts:{ rollup(company, period), rollupTable(r, period), absorptionBlock(r) } }`

- [ ] **Step 1: `js/ui-plan.js` に注記を足す**

`render` 内、`<div class="card pad" data-out="required"></div>` の直後に:

```js
      ${(api.getCompany && api.getCompany().stores.length > 1) ? '<p class="note-p">ここは店舗単位の数字です。本部費を含めた全社の逆算は「全社」タブの④で行います。</p>' : ''}
```

- [ ] **Step 2: `js/ui-company-plan.js` を作成する**

```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util; const CP = () => Sim.ui.company.parts; const CD = () => Sim.ui.companyDiag.parts; const PP = () => Sim.ui.plan.parts; const D = () => Sim.ui.diagnosis.parts;
  function rollup(company, period) {
    const rows = company.stores.map((s, i) => {
      const m = Sim.calc.mgmt(s); const rq = Sim.calc.requiredRevenue(s); const sc = s.plan.scenarios[s.plan.activeScenario] || s.plan.scenarios[0];
      return { id: s.store.id, name: Sim.state.storeLabel(company, i), revenue: m.revenue, required: rq ? rq.required : null, target: s.plan.targetRevenue[period - 1],
        scenarioRevenue: Sim.calc.store(s, period, sc && sc.levers).revenue, reach: Sim.calc.reachRate(s, period, sc) };
    });
    const sum = k => (rows.some(r => r[k] != null) ? rows.reduce((a, r) => a + (r[k] || 0), 0) : null);
    const allRequired = rows.length > 0 && rows.every(r => r.required != null); const target = sum('target'); const scen = sum('scenarioRevenue');
    return { rows, allRequired, total: { revenue: sum('revenue'), required: allRequired ? sum('required') : null, target, scenarioRevenue: scen, reach: (target > 0 && scen != null) ? scen / target * 100 : null }, company: Sim.calc.companyRequired(company) };
  }
  function rollupTable(r, period) {
    const { esc, yen, fmt1 } = U(); const cell = v => (v == null ? '—' : yen(v)); const reach = v => (v == null ? '—' : fmt1(v) + '%');
    return `<div class="cmp-wrap"><table class="ltable cmp-table"><tr><th>店舗</th><th>現状売上（年）</th><th>店舗の必要売上</th><th>間口の目標売上（${U().PERIOD_LABEL(period)}）</th><th>今の配分での売上</th><th>到達率</th></tr>
      ${r.rows.map(x => `<tr><td>${esc(x.name)}</td><td>${cell(x.revenue)}</td><td>${cell(x.required)}</td><td>${cell(x.target)}</td><td>${cell(x.scenarioRevenue)}</td><td>${reach(x.reach)}</td></tr>`).join('')}
      <tr class="total"><td>合計</td><td>${cell(r.total.revenue)}</td><td>${r.allRequired ? cell(r.total.required) : '—（未入力の店舗あり）'}</td><td>${cell(r.total.target)}</td><td>${cell(r.total.scenarioRevenue)}</td><td>${reach(r.total.reach)}</td></tr></table></div>`;
  }
  function absorptionBlock(r) {
    const { yen } = U(); const co = r.company;
    if (!co) return '<p class="note-p">全社の必要営業利益と、各店舗の①費用の構造が揃うと「本部費を賄えるか」の判定が出ます。</p>';
    if (!r.allRequired) return `<p class="note-p">全社の必要売上は ${yen(co.required)}（本部費 ${co.hqTotal == null ? '未入力' : yen(co.hqTotal)} 込み）です。各店舗タブの④「必要利益からの逆算」を全店で入れると、店舗目標の合計と比べられます。</p>`;
    const diff = co.required - r.total.required;
    return diff > 0
      ? `<ul class="warn"><li>店舗ごとの必要売上の合計 ${yen(r.total.required)} では、本部費＋全社の必要利益（必要売上 ${yen(co.required)}）に届きません。差 ${yen(diff)} を各店舗の目標に上乗せする必要があります（割り振りは各店舗タブで行います）。</li></ul>`
      : `<p class="note-p ok">店舗ごとの必要売上の合計 ${yen(r.total.required)} は、全社の必要売上 ${yen(co.required)} を ${yen(-diff)} 上回っています。店舗目標を足し合わせれば本部費を賄える計算です。</p>`;
  }
  function renderPlan(el, company, api) {
    const { val, guide } = U(); const p = company.company.plan; const period = api.period;
    el.innerHTML = `
      <div class="sec-title"><span class="no">1</span><h2>必要利益からの逆算（全社）</h2><span class="hint">${guide('全社で出したい営業利益から、本部費を含めた固定費と合算粗利率で必要売上を逆算します。店舗への割り振りは自動では行いません。')}</span></div>
      <div class="card globals">
        <div class="gbox"><label>全社の必要営業利益（年）</label><div class="row"><input type="number" min="0" step="10" data-type="man" data-path="company.plan.requiredProfit" value="${U().man(p.requiredProfit)}"><span class="unit">万円</span></div></div>
        <div class="gbox"><label>既存客売上の見込み（現状比）</label><div class="row"><input type="number" step="1" data-type="num" data-path="company.plan.existingGrowthPct" value="${val(p.existingGrowthPct)}"><span class="unit">%</span></div></div>
      </div>
      <div class="card pad" data-out="co-required"></div>
      <div class="sec-title"><span class="no">2</span><h2>店舗目標のロールアップ（${U().PERIOD_LABEL(period)}で見た場合）</h2><span class="hint">各店舗タブの目標と選択中シナリオをそのまま合計します</span></div>
      <div class="card pad" data-out="co-rollup"></div>
      <div class="sec-title"><span class="no">3</span><h2>本部費を賄えるか</h2></div>
      <div class="card pad" data-out="co-absorb"></div>`;
    outputsPlan(el, company, api); U().bindPanel(el, api, {});
  }
  function outputsPlan(el, company, api) {
    const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    const r = rollup(company, api.period);
    set('co-required', PP().requiredTable(r.company) + (r.company ? '<p class="note-p">固定費には本部費を含めています。「間口で稼ぐべき売上」は全社合計の目安で、店舗の目標には自動反映しません。</p>' : ''));
    set('co-rollup', rollupTable(r, api.period)); set('co-absorb', absorptionBlock(r));
  }
  function renderReport(el, company, api) {
    const { esc } = U(); const period = api.period; const h = Sim.analysis.companyHealth(company); const cmp = Sim.calc.storeComparison(company, period); const cm = Sim.analysis.companyComments(company, period); const r = rollup(company, period);
    const today = new Date().toLocaleDateString('ja-JP'); let n = 0; const sec = () => ++n;
    el.innerHTML = `
      <div class="report-tools no-print"><button type="button" class="sbtn primary" data-action="print">印刷／PDF保存</button><span class="note-p">A4縦・表紙＋4ページ（全社サマリー）。店舗ごとの10ページは各店舗タブの⑤から印刷します。</span></div>
      <div class="report">
        <section class="rpage cover"><div class="eyebrow">STORE SALES SIMULATOR</div><h1>${esc(company.company.name || '全社')}<br>全社サマリー</h1><p>${company.stores.length}店舗　／　${U().PERIOD_LABEL(period)}で見た場合</p><p class="small">作成日 ${today}</p></section>
        <section class="rpage"><h2>${sec()}. 全社の経営数値</h2>${h.available ? `${CD().companyKpis(h.cm)}${h.coverageNote ? `<p class="note-p">${esc(h.coverageNote)}</p>` : ''}<h3>収益構造</h3>${D().waterfallSvg(h.m, CD().hqSteps(h.cm))}<h3>費用比率（店舗合算）</h3>${D().costBars(h)}` : '<p class="note-p">店舗の経営数値が未入力です。</p>'}</section>
        <section class="rpage"><h2>${sec()}. 店舗横並び比較</h2><h3>経営</h3>${CP().comparisonTable(cmp, 'mgmt')}<h3>間口（${U().PERIOD_LABEL(period)}）</h3>${CP().comparisonTable(cmp, 'entry')}<h3>コメント</h3><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <section class="rpage"><h2>${sec()}. 目標のロールアップ</h2><h3>本部費</h3>${h.available ? CD().hqTable(h.cm) : '<p class="note-p">—</p>'}<h3>必要利益からの逆算（全社）</h3>${PP().requiredTable(r.company)}<h3>店舗目標の合計</h3>${rollupTable(r, period)}<h3>本部費を賄えるか</h3>${absorptionBlock(r)}</section>
        <section class="rpage"><h2>${sec()}. 前提と計算式</h2><ul class="cm">
          <li>全社の数字は各店舗の①経営数値を合算したものです。金額・人数は足し算、率は合算後に再計算します（粗利率＝合算粗利÷合算売上、リピート率＝合算の2回以上÷合算の来店回数計）。空欄の店舗はその項目の合算に含めていません。</li>
          <li>本部費は全社の固定費にのみ加えます。店舗別の営業利益・損益分岐点には本部費を含めていません。全社営業利益＝店舗合算の営業利益−本部費、全社の損益分岐点売上＝（店舗固定費の合算＋本部費）÷合算粗利率。</li>
          <li>全社の必要売上＝（店舗固定費の合算＋本部費＋全社の必要営業利益）÷合算粗利率。店舗への割り振りは自動では行いません。</li>
          <li>横並びの◎○△は店舗内の相対順位です（費用比率と損益分岐点は低いほど良い向き）。目安値は会社共通で、業界の数字は含んでいません。</li>
          <li>間口の指標は各店舗の②間口カテゴリから期間（${U().PERIOD_LABEL(period)}）で計算しています。カテゴリの店舗横断の合算はしていません。</li>
          <li>数字の出所：各店舗の入力（最終更新 ${esc((company.meta.updatedAt || '').slice(0, 10))}）。すべて試算です。</li></ul></section>
      </div>`;
    U().bindPanel(el, api, { print: () => window.print() });
  }
  Sim.ui.companyPlan = { plan: { render: renderPlan, refresh: outputsPlan }, report: { render: renderReport, refresh: renderReport }, parts: { rollup, rollupTable, absorptionBlock } };
})();
```

- [ ] **Step 3: Node テスト（回帰）**

Run: `node tests/run.js 2>&1 | tail -1`
Expected: `109 passed, 0 failed`

- [ ] **Step 4: ブラウザ確認（コントローラー）**

`?v=22d`、サンプル → 全社 ④:
1. 必要営業利益 1,000（万円）→ 必要売上 9,240万円・ギャップ 1,560万円・既存客の見込み 7,536万円・間口で稼ぐべき 1,704万円。固定費の表示は 3,620万円（本部費込み）
2. ロールアップ: 本店 4,800万円／—／—／237.7万円（36ヶ月）／—、2号店 2,880万円…、合計行。必要売上は「—（未入力の店舗あり）」
3. 本店④で必要営業利益 600・2号店④で 300 を入れる → 全社④の合計「店舗の必要売上」が出て、「本部費を賄えるか」が差額つきで判定される（本店 5,040万＋2号店 (1,220万+300万)/0.5=3,040万 → 合計 8,080万 < 9,240万 → 差 1,160万円の警告）
4. 全社 ⑤: 表紙＋4ページ（本部費の表は3ページ目「目標のロールアップ」の先頭）。印刷ダイアログ（`window.print` を Playwright で差し替えて呼び出し確認）。印刷媒体で各ページの高さ ≤ 1017px（幅 794px でエミュレート）
5. 本店④に注記「ここは店舗単位の数字です…」が出る。「空で始める」（1店舗）では出ない

- [ ] **Step 5: コミット**

```bash
git add js/ui-company-plan.js js/ui-plan.js
git commit -m "feat(ui): 全社④（本部費込み逆算・ロールアップ・吸収チェック）と全社⑤（全社サマリー4ページ）

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: README・手動チェックリスト・収集シート v3

**Files:**
- Modify: `README.md`, `tests/manual-checklist.md`
- Create: `/Users/tsujiyuuta/Desktop/claude-outputs/04_店舗ビジネス支援/売上シミュレーター/20260925_事前収集シート_v3.xlsx`（v2 を読み込んでシート追加・別名保存。v2 は残す）

- [ ] **Step 1: `README.md` を更新する**

「使い方」の末尾（「入力はブラウザに自動保存されます…」の段落の後）に節を足す:

```markdown
## 複数店舗
- ステッパーの上の**店舗タブ**で店舗を切り替えます。「＋ 空の店舗」「＋ ファイルから店舗」で店舗を増やせます。店舗が1つのときは今までと同じ画面です。
- 2店舗以上になると**「全社」タブ**が現れます。①で会社名と本部費（本社の人件費・家賃など）を入れ、店舗の合算サマリーと店舗一覧（書き出し・置き換え・複製・削除）を扱います。②③は店舗横並び（◎○△は店舗内の順位）、④は本部費込みの必要売上と店舗目標のロールアップ、⑤は全社サマリー（表紙＋4ページ）です。
- 合算は保存せず毎回計算します。金額・人数は足し算、率は合算後に再計算し、空欄の店舗はその項目の合算に含めません。本部費は全社の利益にだけ効き、店舗別の利益には含めません。目安値と表示期間は会社共通です。
- **店舗ファイルの受け渡し**: 全社①の「この店舗を書き出す」で店舗ファイル（単店版でも読める形式）を作れます。各店で入力してもらい、「ファイルで置き換え」または「＋ ファイルから店舗」で取り込みます。ヘッダーの「書き出し」は会社全体（全店舗）のファイルです。
```

「開発」のテスト件数と設計書を更新:

```markdown
- テスト: `node tests/run.js`（純関数のみ、109件全件通過）。画面は `tests/manual-checklist.md` で確認します。
- 設計書（v2.2 複数店舗）: `docs/superpowers/specs/2026-09-25-simulator-v2-2-multistore-design.md`
```

- [ ] **Step 2: `tests/manual-checklist.md` の末尾に追加する**

```markdown
## 複数店舗（v2.2）
- [ ] 旧データ（v3）が残ったブラウザで開くと、店舗1つの会社に変換され、画面は従来どおり（全社タブなし）
- [ ] 「＋ 空の店舗」で店舗が増えて切り替わる。「全社」タブが現れる。②の店名を変えるとタブ名が変わる
- [ ] 期間切替と目安値が全店に効く（店舗A→B で同じ）
- [ ] 全社①: 会社名・本部費の入力でフォーカスを失わずサマリーが変わる。カバレッジ注記（店舗Bの人件費を空にすると「人件費 1／2店舗」）
- [ ] 店舗一覧: 開く／書き出す／ファイルで置き換え（確認あり）／複製／削除（確認あり・最後の1店舗は不可）。表示中の店舗を削除すると全社（1店舗なら店舗）に戻る
- [ ] 「＋ ファイルから店舗」に会社ファイル（2店舗以上）を選ぶと「これは会社全体のファイルです」。単店ファイル・v3ファイルは追加される
- [ ] ヘッダー「読み込み」に店舗ファイルを選ぶと、全店舗を置き換える旨の確認が出る
- [ ] 全社③: 滝図に本部費・全社営業利益の段。横並び（経営14行・間口6行）と◎○△。目安値を入れると目安列
- [ ] 全社④: 必要営業利益→必要売上（本部費込み）。ロールアップ合計行。全店の④に必要利益を入れると「本部費を賄えるか」が判定される
- [ ] 全社⑤: 表紙＋4ページが A4 に収まる。店舗タブの⑤は従来の10ページ
- [ ] 店舗④の逆算に「店舗単位の数字です」の注記（2店舗以上のときのみ）
- [ ] 幅400pxで横並び表が横スクロールになり、ページ全体は横スクロールしない
```

- [ ] **Step 3: 収集シート v3 を作る（Python・openpyxl）**

```bash
cd /Users/tsujiyuuta/Desktop/claude-outputs/04_店舗ビジネス支援/売上シミュレーター && python3 - <<'EOF'
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
src = '20260924_事前収集シート_v2.xlsx'; dst = '20260925_事前収集シート_v3.xlsx'
wb = openpyxl.load_workbook(src)
thin = Side(style='thin', color='999999'); border = Border(left=thin, right=thin, top=thin, bottom=thin)
head_fill = PatternFill('solid', fgColor='1A2236'); head_font = Font(bold=True, size=10, color='FFFFFF')
yellow = PatternFill('solid', fgColor='FFFF00'); blue = Font(size=10, color='0000FF')
ws = wb.create_sheet('本部（会社共通）', index=4)
ws['A1'] = '本部（会社共通）— 複数店舗の会社だけ使います。シミュレーターの「全社」タブ①に手で写します'; ws['A1'].font = Font(bold=True, size=13)
ws['A2'] = '店舗ごとの数字は、このブックを店舗の数だけコピーして各店で記入します（店舗ファイル1つ＝店舗1つ）。目安値は会社で1つに揃えます。'; ws['A2'].font = Font(size=9, color='555555')
rows = [('区分', '項目', '値', '単位', '拾う場所', 'メモ'),
        ('会社', '会社名', None, '—', '—', '任意'),
        ('本部費', '本部 人件費（年）', None, '万円', '本社の試算表', '店舗に属さない人件費のみ'),
        ('本部費', '本部 家賃（年）', None, '万円', '本社の試算表', '本社・倉庫など'),
        ('本部費', '本部 広告宣伝費（年）', None, '万円', '本社の試算表', '全社ブランド広告など。店舗の広告は店舗側に'),
        ('本部費', '本部 その他経費（年）', None, '万円', '本社の試算表', ''),
        ('全社目標', '全社の必要営業利益（年）', None, '万円', '経営計画', '全社④で使用。任意'),
        ('目安値', '粗利率／人件費率／家賃比率／広告費率／リピート率の目安', None, '%', '自社目標・過去平均', '会社で1つ。どこかの店舗の①目安値に入れると全店に共有されます')]
for r, row in enumerate(rows, start=4):
    for c, v in enumerate(row, start=1):
        cell = ws.cell(row=r, column=c, value=v); cell.border = border; cell.font = Font(size=10)
        if r == 4: cell.fill = head_fill; cell.font = head_font
        elif c == 3: cell.fill = yellow; cell.font = blue
ws.cell(row=13, column=1, value='店舗一覧（受け渡しの管理）').font = Font(bold=True, size=11)
hdr = ('店舗名', '記入担当', 'シート送付日', 'ファイル受領日', '取り込み日', 'メモ')
for c, v in enumerate(hdr, start=1):
    cell = ws.cell(row=14, column=c, value=v); cell.fill = head_fill; cell.font = head_font; cell.border = border
for r in range(15, 21):
    for c in range(1, 7):
        cell = ws.cell(row=r, column=c); cell.border = border; cell.font = Font(size=10)
        if c == 1: cell.fill = yellow; cell.font = blue
for col, w in zip('ABCDEF', (12, 46, 16, 8, 24, 40)): ws.column_dimensions[col].width = w
memo = wb['集め方メモ']; last = memo.max_row + 1
memo.cell(row=last, column=1, value='複数店舗の集め方（v2.2）').font = Font(bold=True, size=10)
memo.cell(row=last, column=2, value='店舗ごとにこのブックをコピーして記入 → 各店がシミュレーター（単店版でも可）に入力して「書き出し」 → 本部が「全社」タブ①の店舗一覧で「ファイルで置き換え」または「＋ファイルから店舗」で取り込む。本部費と会社名は「本部（会社共通）」シートから全社①に手で写す。')
memo.cell(row=last + 1, column=1, value='本部費の扱い').font = Font(bold=True, size=10)
memo.cell(row=last + 1, column=2, value='本部費は全社の営業利益と損益分岐点にだけ効き、店舗別の利益には含めません（配賦しません）。店舗目標の合計が本部費＋全社の必要利益に届くかは、全社④で確認できます。')
for r in (last, last + 1): memo.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical='top')
wb.save(dst); print('saved', dst, wb.sheetnames)
EOF
```

Expected: `saved 20260925_事前収集シート_v3.xlsx ['収集項目リスト', '貼り付け用テンプレ', '経営数値 貼り付け用（2列）', '店舗共通・任意（手入力）', '本部（会社共通）', '集め方メモ']`

- [ ] **Step 4: 最終確認とコミット**

Run: `node tests/run.js 2>&1 | tail -1`
Expected: `109 passed, 0 failed`

```bash
cd /Users/tsujiyuuta/Desktop/claude-outputs/nemu-simulator
git add README.md tests/manual-checklist.md
git commit -m "docs: v2.2 複数店舗の README・手動チェックリスト

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

（収集シートはリポジトリ外のため git 対象外）

---

## 全体の完了条件

- `node tests/run.js` が 109件通過
- ブラウザ確認（Task 4〜7 の項目＋手動チェックリスト「複数店舗」節）をコントローラーが Playwright で実施し、全社⑤の各ページが A4 本文（≈1017px）に収まる
- `feature/v2-2-multistore` を main に `--no-ff` でマージ（辻さん承認後）。push は別途承認
