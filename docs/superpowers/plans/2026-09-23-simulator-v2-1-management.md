# 店舗 売上シミュレーター v2.1（経営数値）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開済みの v2（4ステップ）に「①経営数値」を追加して5ステップ化し、③診断に「経営の健康度」、④目標と戦略に「必要利益からの逆算」、⑤レポートに2ページを足す。

**Architecture:** 既存の構造を踏襲する。純関数（`state / calc / analysis / paste`）に経営数値の計算・診断・貼り付け解析を追加し、Node で検証。UI は新モジュール `js/ui-mgmt.js`（ステップ①）を足し、既存の `ui-input`（②に繰り下げ）・`ui-diagnosis`・`ui-plan`・`ui-report` にブロックを追加する。`app.js` はステップ番号のずれ（5ステップ・レポートは panel-5）だけを吸収する。

**Tech Stack:** 素の HTML / CSS / JavaScript（ES Modules 不使用・外部ライブラリなし）。テストは `node tests/run.js`。

**Spec:** `docs/superpowers/specs/2026-09-23-simulator-v2-1-management-design.md`（v2 の仕様 `2026-09-23-simulator-v2-design.md` も前提）

## Global Constraints

- 外部ライブラリ・CDN読み込みなし。図はインラインSVG。ES Modules不使用（`file://` で動く）
- 各JSは `window.Sim = window.Sim || {};` から始め、`Sim.<名前>` / `Sim.ui.<名前>` に登録
- `state.js / calc.js / analysis.js / paste.js / tactics.js` はDOMに触らない
- 業界の目安値をコードに埋め込まない。物差しは前期・目安値（任意入力）・自店内比較のみ
- 経営数値は**年次1本**＋前期は任意。`state.version` は **3**。localStorage キーは `storeSim:v2` のまま。v2 の保存データは `normalize` が欠損を補って読める
- 率は calc 内では **0〜1 の小数**、`benchmarks` と画面表示は **%（0〜100）**
- 入力が欠けている計算結果は `null`（0で誤診断しない）。画面は「—」
- 5ステップ：①経営数値 ②間口カテゴリ ③診断 ④目標と戦略 ⑤レポート。レポートのパネルは `#panel-5`
- 文体は「ですます調」、押しつけ表現なし。用語は「間口カテゴリ」
- 計画LTV・逆算など v2 の計算は変更しない。**変更点は1つだけ**：`store()` の原価率は経営数値（仕入原価÷総売上）があればそれを優先する。固定費（月額）は間口分析には流さない（仕様§3の「固定費も上書き」は採用しない — 間口コホートの売上から店全体の固定費を引くと誤った営業利益が出るため）

## Review Focus

1. **新規客売上 > 総売上、来店回数別の合計 > アクティブ顧客数** といった矛盾入力 — 黄色の注記が出て計算は続く → Task 3 `mgmtChecks` テストで固定
2. **経営数値が一部だけ入力された状態**（売上だけ・費用だけ） — 計算できる指標だけ出て、他は「—」。診断ブロックは落ちない → Task 2 「部分入力」テスト、Task 3 `mgmtHealth` の available 判定テストで固定
3. **v2 で保存したデータ（mgmt なし・version 2）を開く** — 空の経営数値として読め、①は空欄、③は「①経営数値を入れると表示されます」 → Task 1 テストで固定
4. **粗利率が 0 以下（仕入原価 ≥ 売上）** — 損益分岐点・必要売上は null（無限大や負数を出さない） → Task 2 テストで固定
5. **2列貼り付けのラベル揺れ**（「広告費」「期末在庫金額」、全角スペース、`¥` `,` 付き）と未知の行 — 認識できる行だけ取り込み、未知行は警告 → Task 4 テストで固定

---

## ファイル構成

| ファイル | 変更 | 責務 | Task |
|---|---|---|---|
| `js/state.js` | 修正 | `mgmt` 構造・version 3・benchmarks 拡張・サンプル値 | 1 |
| `js/calc.js` | 修正 | `effectiveCogsRate / mgmt / consistency / mgmtLeverage / requiredRevenue` | 2 |
| `js/analysis.js` | 修正 | `mgmtHealth / consistencyCheck / mgmtChecks / mgmtComments` | 3 |
| `js/paste.js` | 修正 | `parseKeyValues / applyKeyValues` | 4 |
| `index.html` / `js/app.js` / `css/print.css` / `css/style.css` | 修正 | 5ステップ化・panel-5・新しいCSS | 5 |
| `js/ui-mgmt.js` | 新規 | ①経営数値の画面 | 5 |
| `js/ui-input.js` | 修正 | ②へ繰り下げ・集客経路ブロックの撤去・原価率の自動表示 | 5 |
| `js/ui-diagnosis.js` | 修正 | 「経営の健康度」セクション（滝図ほか） | 6 |
| `js/ui-plan.js` | 修正 | 「必要利益からの逆算」ブロック | 7 |
| `js/ui-report.js` | 修正 | 2ページ追加・必要利益の表 | 8 |
| `README.md` / `tests/manual-checklist.md` | 修正 | 5ステップの記述 | 9 |
| `tests/*.test.js` | 修正 | 各Taskのテスト | 各Task |

---

### Task 1: state.js — `mgmt` 構造と version 3

**Files:**
- Modify: `js/state.js`
- Modify: `tests/state.test.js`

**Interfaces:**
- Produces:
  - `Sim.state.SCHEMA_VERSION === 3`
  - `Sim.state.emptyMgmt()` → `{ revenue, buyers, newBuyers, newRevenue, itemsPerBuyer, activeCustomers, visits:{once,twice,threePlus}, dormant, products:[], inventory, costs:{cogs,labor,rent,ads,other}, funnel:{reservations,visits,deals}, replacement:[], prev:null }`（数値は全て `null`）
  - `Sim.state.newProductRow(o?)` → `{ id, name, sales|null, grossMarginPct|null }`、`Sim.state.newReplacementRow(o?)` → `{ id, name, cycleYears|null, pastBuyers|null }`
  - `Sim.state.normalizeMgmt(raw, allowPrev)` → 上記構造（欠損は null、id は無害化）
  - `state.benchmarks` に `grossMarginPct, laborPct, rentPct, adsPct, repeatRate`（%・null 可）
  - `state.plan.requiredProfit`（null 可）、`state.plan.existingGrowthPct`（既定 0）
  - `createSample()` の経営数値（下記の値）

- [ ] **Step 1: テストを追加**

`tests/state.test.js` の末尾に追記:
```js
test('v3: emptyMgmt の形と createEmpty の既定値', () => {
  const m = S.emptyMgmt();
  eq(m.revenue, null); eq(m.visits, { once: null, twice: null, threePlus: null }); eq(m.costs, { cogs: null, labor: null, rent: null, ads: null, other: null });
  eq(m.funnel, { reservations: null, visits: null, deals: null }); eq(m.products, []); eq(m.replacement, []); eq(m.prev, null);
  const s = S.createEmpty(); eq(s.version, 3); eq(s.mgmt.revenue, null); eq(s.plan.requiredProfit, null); eq(s.plan.existingGrowthPct, 0);
  eq(s.benchmarks.grossMarginPct, null); eq(s.benchmarks.repeatRate, null);
});
test('v3: v2 の保存データ（mgmt なし・version 2）を読める', () => {
  const s = S.normalize({ version: 2, store: { name: '旧' }, categories: [{ name: 'A' }], plan: { scenarios: [{ name: 'x' }] } });
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
  const s = S.createSample(); const m = s.mgmt;
  eq(m.revenue, 48000000); eq(m.buyers, 700); eq(m.newBuyers, 100); eq(m.newRevenue, 900000); eq(m.costs.cogs, 24000000); eq(m.products.length, 4); eq(m.replacement[0].cycleYears, 8);
  const p = S.parse(S.serialize(s)); p.meta.updatedAt = s.meta.updatedAt; eq(p, s);
});
test('v3: 未来バージョン 4 は拒否', () => { throws(() => S.normalize({ version: 4 })); });
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: 新規5件が ✗（`S.emptyMgmt is not a function` 等）。既存58件は ✓

- [ ] **Step 3: state.js を修正**

(a) 先頭の定数を変更:
```js
  const SCHEMA_VERSION = 3;
```
(b) `emptyPrev()` の直後に追加:
```js
  function newProductRow(o) {
    o = o || {};
    return { id: safeId(o.id, 'p'), name: o.name == null ? '' : String(o.name), sales: optNum(o.sales), grossMarginPct: optNum(o.grossMarginPct) };
  }
  function newReplacementRow(o) {
    o = o || {};
    return { id: safeId(o.id, 'r'), name: o.name == null ? '' : String(o.name), cycleYears: optNum(o.cycleYears), pastBuyers: optNum(o.pastBuyers) };
  }
  function emptyMgmt() {
    return {
      revenue: null, buyers: null, newBuyers: null, newRevenue: null, itemsPerBuyer: null,
      activeCustomers: null, visits: { once: null, twice: null, threePlus: null }, dormant: null,
      products: [], inventory: null,
      costs: { cogs: null, labor: null, rent: null, ads: null, other: null },
      funnel: { reservations: null, visits: null, deals: null },
      replacement: [], prev: null
    };
  }
  function normalizeMgmt(raw, allowPrev) {
    const m = emptyMgmt(); const r = (raw && typeof raw === 'object') ? raw : {};
    ['revenue', 'buyers', 'newBuyers', 'newRevenue', 'itemsPerBuyer', 'activeCustomers', 'dormant', 'inventory'].forEach(k => { m[k] = optNum(r[k]); });
    const v = r.visits || {}; m.visits = { once: optNum(v.once), twice: optNum(v.twice), threePlus: optNum(v.threePlus) };
    const c = r.costs || {}; m.costs = { cogs: optNum(c.cogs), labor: optNum(c.labor), rent: optNum(c.rent), ads: optNum(c.ads), other: optNum(c.other) };
    const f = r.funnel || {}; m.funnel = { reservations: optNum(f.reservations), visits: optNum(f.visits), deals: optNum(f.deals) };
    m.products = Array.isArray(r.products) ? r.products.map(p => newProductRow(p)) : [];
    m.replacement = Array.isArray(r.replacement) ? r.replacement.map(p => newReplacementRow(p)) : [];
    dedupeIds(m.products, 'p'); dedupeIds(m.replacement, 'r');
    if (allowPrev && r.prev && typeof r.prev === 'object') { m.prev = normalizeMgmt(r.prev, false); delete m.prev.prev; }
    else m.prev = null;
    return m;
  }
```
（`dedupeIds` は既存関数。定義位置が後ろでも関数宣言なので呼べる）

(c) `createEmpty()` を置き換え:
```js
  function createEmpty() {
    const now = new Date().toISOString();
    return {
      version: SCHEMA_VERSION,
      store: { name: '', fiscalLabel: '', cogsRate: 50, fixedCostMonthly: 0, period: 3 },
      benchmarks: { sameDayRate: null, laterRate: [null, null, null], laterAov: [null, null, null], daysToAddon: null,
        grossMarginPct: null, laborPct: null, rentPct: null, adsPct: null, repeatRate: null },
      categories: [], channels: [],
      mgmt: emptyMgmt(),
      plan: { targetRevenue: [null, null, null], activeScenario: 0, scenarios: [newScenario('標準', [])], requiredProfit: null, existingGrowthPct: 0 },
      meta: { createdAt: now, updatedAt: now }
    };
  }
```
(d) `createSample()` の `s.plan.activeScenario = 1;` の直前に追加:
```js
    s.channels = [newChannel({ name: 'Google広告', newCustomers: 40, cost: 900000 }), newChannel({ name: '紹介・口コミ', newCustomers: 35, cost: 0 }), newChannel({ name: 'チラシ', newCustomers: 25, cost: 300000 })];
    s.mgmt = normalizeMgmt({
      revenue: 48000000, buyers: 700, newBuyers: 100, newRevenue: 900000, itemsPerBuyer: 1.6,
      activeCustomers: 900, visits: { once: 500, twice: 250, threePlus: 150 }, dormant: 300,
      products: [{ name: '枕（フィッティング）', sales: 5000000, grossMarginPct: 55 }, { name: '敷きもの・カバー類', sales: 12000000, grossMarginPct: 45 },
        { name: 'マットレス', sales: 20000000, grossMarginPct: 40 }, { name: 'その他', sales: 11000000, grossMarginPct: 50 }],
      inventory: 6000000,
      costs: { cogs: 24000000, labor: 9600000, rent: 3600000, ads: 1800000, other: 4200000 },
      funnel: { reservations: 300, visits: 240, deals: 180 },
      replacement: [{ name: 'マットレス', cycleYears: 8, pastBuyers: 320 }]
    }, true);
```
(e) `normalize()` の benchmarks 行を置き換え、mgmt と plan の項目を追加:
```js
    s.benchmarks = { sameDayRate: optNum(b.sameDayRate), laterRate: [0, 1, 2].map(i => optNum(b.laterRate && b.laterRate[i])),
      laterAov: [0, 1, 2].map(i => optNum(b.laterAov && b.laterAov[i])), daysToAddon: optNum(b.daysToAddon),
      grossMarginPct: optNum(b.grossMarginPct), laborPct: optNum(b.laborPct), rentPct: optNum(b.rentPct), adsPct: optNum(b.adsPct), repeatRate: optNum(b.repeatRate) };
```
`s.plan.targetRevenue = ...` の行の直後に:
```js
    s.plan.requiredProfit = optNum(p.requiredProfit); s.plan.existingGrowthPct = num(p.existingGrowthPct, 0);
    s.mgmt = normalizeMgmt(obj.mgmt, true);
```
(f) 末尾の export に追加:
```js
  Sim.state = { SCHEMA_VERSION, STORAGE_KEY, createEmpty, createSample, newCategory, newChannel, newScenario, emptyLevers, emptyPrev,
    emptyMgmt, normalizeMgmt, newProductRow, newReplacementRow,
    migrateV1, normalize, syncScenarios, serialize, parse, save, load, exportFilename };
```

- [ ] **Step 4: 既存テストの調整**

`tests/state.test.js` の `createSample` テストは `s.version` を 2 と比較している場合は 3 に直す（`eq(s.version, 2)` → `eq(s.version, 3)`）。`normalize: 未来バージョンは拒否` は `{version: 3}` を渡しているので `{version: 4}` に直す。

- [ ] **Step 5: 全テストが通ることを確認**

Run: `node tests/run.js`
Expected: `63 passed, 0 failed`

- [ ] **Step 6: コミット**

```bash
git add js/state.js tests/state.test.js
git commit -m "feat(v2.1): state に経営数値（mgmt）を追加・version 3"
```

---

### Task 2: calc.js — 経営数値の計算

**Files:**
- Modify: `js/calc.js`
- Modify: `tests/calc.test.js`

**Interfaces:**
- Consumes: `state.mgmt`（Task 1）
- Produces:
  - `Sim.calc.effectiveCogsRate(state)` → %（mgmt の仕入原価÷総売上があればそれ、無ければ `store.cogsRate`）。`store()` はこれを使う
  - `Sim.calc.mgmtCore(m)` → 派生値（下表）。`Sim.calc.mgmt(state)` → `mgmtCore(state.mgmt)` に `available`（revenue が入っているか）、`prev`（前期の派生値 or null）、`channels`（`store(state,1).channels`）を足したもの
  - `Sim.calc.consistency(state)` → `{ entryNewTotal, entryNewRevenue, newBuyers, newRevenue, newBuyersRatio|null, newRevenueRatio|null }`
  - `Sim.calc.mgmtLeverage(state)` → null | `{ base, items:[{key,label,delta}]（delta降順）, top }`
  - `Sim.calc.requiredRevenue(state)` → null | `{ required, current, gap, existingForecast|null, newTarget|null, grossMarginPct, fixedCosts }`

- [ ] **Step 1: テストを追加**

`tests/calc.test.js` の末尾に追記:
```js
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
  const s = Sim.state.createEmpty(); s.mgmt.revenue = 10000000; const m = C.mgmt(s);
  ok(m.available); eq(m.aov, null); eq(m.grossProfit, null); eq(m.breakEven, null); eq(m.repeatRate, null); eq(m.products, []); eq(m.inventoryTurnMonths, null);
  eq(C.mgmt(Sim.state.createEmpty()).available, false);
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
test('consistency: ②の新規合計と初回来店売上を①と比べる', () => {
  const c = C.consistency(sample()); eq(c.entryNewTotal, 100); eq(c.entryNewRevenue, 840000); eq(c.newBuyersRatio, 1); approx(c.newRevenueRatio, 0.9333, 0.001);
  const s = sample(); s.mgmt.newBuyers = null; eq(C.consistency(s).newBuyersRatio, null);
});
test('mgmtLeverage: 営業利益への4本のインパクト', () => {
  const lv = C.mgmtLeverage(sample()); eq(lv.base, 4800000);
  const d = Object.fromEntries(lv.items.map(i => [i.key, i.delta])); eq(d.revenue, 2400000); eq(d.gm, 480000); eq(d.labor, 480000); eq(d.ads, 180000); eq(lv.top.key, 'revenue');
  eq(C.mgmtLeverage(Sim.state.createEmpty()), null);
});
test('requiredRevenue: 必要利益→必要売上→間口の目標', () => {
  const s = sample(); s.plan.requiredProfit = 6000000; const r = C.requiredRevenue(s);
  eq(r.required, 50400000); eq(r.gap, 2400000); eq(r.existingForecast, 47100000); eq(r.newTarget, 3300000);
  s.plan.existingGrowthPct = 10; eq(C.requiredRevenue(s).newTarget, 0, '既存で足りれば0（負にしない）');
  s.plan.requiredProfit = null; eq(C.requiredRevenue(s), null);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: 新規8件が ✗（`C.mgmt is not a function`）

- [ ] **Step 3: calc.js を修正**

(a) `store()` の1行目を置き換え:
```js
    const cogs = effectiveCogsRate(state) / 100;
```
(b) `crmTargets` の後（`Sim.calc = ...` の前）に追加:
```js
  function effectiveCogsRate(state) {
    const m = state.mgmt;
    if (m && m.revenue > 0 && m.costs && m.costs.cogs != null) return m.costs.cogs / m.revenue * 100;
    return state.store.cogsRate || 0;
  }
  const nz = v => (v == null || isNaN(v)) ? null : v;
  const div = (a, b) => (a == null || b == null || !(b > 0)) ? null : a / b;
  function mgmtCore(m) {
    m = m || {};
    const revenue = nz(m.revenue), buyers = nz(m.buyers), newBuyers = nz(m.newBuyers), newRevenue = nz(m.newRevenue);
    const existingRevenue = (revenue != null && newRevenue != null) ? revenue - newRevenue : null;
    const v = m.visits || {}; const vs = [nz(v.once), nz(v.twice), nz(v.threePlus)];
    const visitsTotal = vs.every(x => x != null) ? vs[0] + vs[1] + vs[2] : null;
    const c = m.costs || {}; const cogs = nz(c.cogs);
    const grossProfit = (revenue != null && cogs != null) ? revenue - cogs : null; const grossMarginPct = div(grossProfit, revenue);
    const costKeys = ['labor', 'rent', 'ads', 'other'];
    const fixedCosts = costKeys.every(k => nz(c[k]) != null) ? costKeys.reduce((s, k) => s + c[k], 0) : null;
    const operatingProfit = (grossProfit != null && fixedCosts != null) ? grossProfit - fixedCosts : null;
    const breakEven = (fixedCosts != null && grossMarginPct > 0) ? fixedCosts / grossMarginPct : null;
    const prods = (m.products || []); const salesSum = prods.reduce((s, p) => s + (nz(p.sales) || 0), 0);
    const products = prods.map(p => {
      const sales = nz(p.sales), gm = nz(p.grossMarginPct);
      return { id: p.id, name: p.name, sales, grossMarginPct: gm, share: div(sales, salesSum), contribution: (sales != null && gm != null) ? sales * gm / 100 : null, contributionShare: null };
    });
    const contribSum = products.reduce((s, p) => s + (p.contribution || 0), 0);
    products.forEach(p => { p.contributionShare = (p.contribution != null && contribSum > 0) ? p.contribution / contribSum : null; });
    const f = m.funnel || {};
    const funnel = { reservations: nz(f.reservations), visits: nz(f.visits), deals: nz(f.deals), visitRate: div(nz(f.visits), nz(f.reservations)), dealRate: div(nz(f.deals), nz(f.visits)) };
    const replacement = (m.replacement || []).map(r => ({ id: r.id, name: r.name, cycleYears: nz(r.cycleYears), pastBuyers: nz(r.pastBuyers),
      expectedBuyers: (nz(r.cycleYears) > 0 && nz(r.pastBuyers) != null) ? r.pastBuyers / r.cycleYears : null }));
    return {
      revenue, buyers, newBuyers, newRevenue, itemsPerBuyer: nz(m.itemsPerBuyer), existingRevenue, aov: div(revenue, buyers), newShare: div(newRevenue, revenue),
      activeCustomers: nz(m.activeCustomers), visits: { once: vs[0], twice: vs[1], threePlus: vs[2] }, visitsTotal,
      repeatRate: visitsTotal > 0 ? (vs[1] + vs[2]) / visitsTotal : null, visitFrequency: div(buyers, nz(m.activeCustomers)), dormant: nz(m.dormant),
      cogs, grossProfit, grossMarginPct, costs: { labor: nz(c.labor), rent: nz(c.rent), ads: nz(c.ads), other: nz(c.other) },
      laborPct: div(nz(c.labor), revenue), rentPct: div(nz(c.rent), revenue), adsPct: div(nz(c.ads), revenue), otherPct: div(nz(c.other), revenue),
      fixedCosts, operatingProfit, opMarginPct: div(operatingProfit, revenue), breakEven, safetyMargin: (breakEven != null && revenue > 0) ? (revenue - breakEven) / revenue : null,
      inventory: nz(m.inventory), inventoryTurnMonths: (nz(m.inventory) != null && cogs > 0) ? m.inventory / (cogs / 12) : null,
      products, funnel, replacement
    };
  }
  function mgmt(state) {
    const m = state.mgmt || {}; const cur = mgmtCore(m);
    cur.available = cur.revenue != null; cur.prev = m.prev ? mgmtCore(m.prev) : null; cur.channels = store(state, 1).channels;
    return cur;
  }
  function consistency(state) {
    const m = mgmt(state);
    const entryNewTotal = state.categories.reduce((s, c) => s + Math.max(0, c.newCustomers), 0);
    const entryNewRevenue = state.categories.reduce((s, c) => { const a = applied(c, 1); return s + a.newN * (a.entryPrice + a.sameRate * a.sameAov); }, 0);
    return { entryNewTotal, entryNewRevenue, newBuyers: m.newBuyers, newRevenue: m.newRevenue,
      newBuyersRatio: div(entryNewTotal, m.newBuyers), newRevenueRatio: div(entryNewRevenue, m.newRevenue) };
  }
  function mgmtLeverage(state) {
    const m = mgmt(state); if (m.operatingProfit == null || m.grossMarginPct == null) return null;
    const items = [
      { key: 'revenue', label: '売上 +10%', delta: m.revenue * 0.10 * m.grossMarginPct },
      { key: 'gm', label: '粗利率 +1pt', delta: m.revenue * 0.01 },
      { key: 'labor', label: '人件費 −5%', delta: (m.costs.labor || 0) * 0.05 },
      { key: 'ads', label: '広告費 −10%', delta: (m.costs.ads || 0) * 0.10 }
    ].sort((a, b) => b.delta - a.delta);
    return { base: m.operatingProfit, items, top: items[0] };
  }
  function requiredRevenue(state) {
    const m = mgmt(state); const rp = state.plan.requiredProfit;
    if (rp == null || m.fixedCosts == null || !(m.grossMarginPct > 0) || m.revenue == null) return null;
    const required = (m.fixedCosts + rp) / m.grossMarginPct; const g = state.plan.existingGrowthPct || 0;
    const existingForecast = m.existingRevenue != null ? m.existingRevenue * (1 + g / 100) : null;
    return { required, current: m.revenue, gap: required - m.revenue, existingForecast,
      newTarget: existingForecast != null ? Math.max(0, required - existingForecast) : null, grossMarginPct: m.grossMarginPct, fixedCosts: m.fixedCosts };
  }
  Sim.calc = { STANDARD_DELTAS, applied, ltv, category, store, reverse, reachRate, evenSplit, crmTargets, effectiveCogsRate, mgmtCore, mgmt, consistency, mgmtLeverage, requiredRevenue };
```
（既存の `Sim.calc = { ... }` 行は上の1行に置き換える）

- [ ] **Step 4: 全テストが通ることを確認**

Run: `node tests/run.js`
Expected: `71 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/calc.js tests/calc.test.js
git commit -m "feat(v2.1): calc に経営数値の派生値・整合・効きどころ・必要売上を追加"
```

---

### Task 3: analysis.js — 経営の健康度・整合チェック・注記・コメント

**Files:**
- Modify: `js/analysis.js`
- Modify: `tests/analysis.test.js`

**Interfaces:**
- Consumes: `Sim.calc.mgmt / consistency / mgmtLeverage`（Task 2）
- Produces:
  - `Sim.analysis.mgmtHealth(state)` → `{ available:false }` | `{ available:true, m, mode:'prev'|'benchmark'|'none', ratios:[{key,label,value,prev,bench,diffPrev,diffBench}], gross:{value,prev,bench}, repeat:{value,prev,bench}, lowContribution:[name…] }`（value/prev/bench は 0〜1 の小数、bench は benchmarks の % を 100 で割ったもの）
  - `Sim.analysis.consistencyCheck(state)` → `Sim.calc.consistency(state)` に `flags:[string]` を足したもの（比が 0.8〜1.2 の外で注記）
  - `Sim.analysis.mgmtChecks(state)` → `[{code, message}]`（矛盾入力・範囲外）
  - `Sim.analysis.mgmtComments(state)` → `string[]`

- [ ] **Step 1: テストを追加**

`tests/analysis.test.js` の末尾に追記:
```js
test('mgmtHealth: サンプルは none モードで比率が揃う', () => {
  const h = A.mgmtHealth(sample()); ok(h.available); eq(h.mode, 'none');
  const r = Object.fromEntries(h.ratios.map(x => [x.key, x.value])); eq(r.laborPct, 0.2); eq(r.rentPct, 0.075); eq(r.adsPct, 0.0375); eq(r.otherPct, 0.0875);
  eq(h.gross.value, 0.5); approx(h.repeat.value, 400 / 900, 1e-6); eq(h.lowContribution, ['マットレス']);
  eq(A.mgmtHealth(Sim.state.createEmpty()).available, false);
});
test('mgmtHealth: 前期があれば prev モードで差分、目安値があれば benchmark モード', () => {
  const s = sample(); s.mgmt.prev = Sim.state.normalizeMgmt({ revenue: 40000000, costs: { cogs: 21000000, labor: 9000000, rent: 3600000, ads: 1500000, other: 4000000 } }, false);
  let h = A.mgmtHealth(s); eq(h.mode, 'prev'); const labor = h.ratios.find(x => x.key === 'laborPct'); approx(labor.diffPrev, 0.2 - 0.225, 1e-6);
  s.benchmarks.laborPct = 18; h = A.mgmtHealth(s); eq(h.mode, 'benchmark'); approx(h.ratios.find(x => x.key === 'laborPct').diffBench, 0.02, 1e-6);
});
test('consistencyCheck: 比が 0.8〜1.2 の外なら注記', () => {
  eq(A.consistencyCheck(sample()).flags, []);
  const s = sample(); s.mgmt.newBuyers = 200; const c = A.consistencyCheck(s); eq(c.flags.length, 1); ok(c.flags[0].includes('新規人数') && c.flags[0].includes('50%'));
  s.mgmt.newBuyers = null; eq(A.consistencyCheck(s).flags, []);
});
test('mgmtChecks: 矛盾入力と範囲外', () => {
  const s = sample(); s.mgmt.newRevenue = 60000000; s.mgmt.visits.once = 800; s.mgmt.products[0].grossMarginPct = 150; s.mgmt.costs.labor = -1;
  const codes = A.mgmtChecks(s).map(w => w.code).sort(); eq(codes, ['gm_range', 'negative', 'new_gt_total', 'visits_gt_active']);
  eq(A.mgmtChecks(sample()), []);
});
test('mgmtComments: 文章が出る・空なら案内文', () => {
  const cm = A.mgmtComments(sample()); ok(cm.length >= 4); ok(cm.some(c => c.includes('粗利率50')));
  ok(cm.some(c => c.includes('損益分岐点'))); ok(cm.some(c => c.includes('売上 +10%')));
  eq(A.mgmtComments(Sim.state.createEmpty()), ['①経営数値を入れると経営の健康度が出ます。']);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: 新規5件が ✗（`A.mgmtHealth is not a function`）

- [ ] **Step 3: analysis.js に追加**

`comments()` の後（`Sim.analysis = ...` の前）に追加し、export 行を置き換える:
```js
  const pctOf = v => (v == null ? null : v / 100);
  const pct1 = v => (v == null ? '—' : (Math.round(v * 1000) / 10) + '%');
  function mgmtHealth(state) {
    const m = Sim.calc.mgmt(state); if (!m.available) return { available: false };
    const b = state.benchmarks; const p = m.prev;
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
    return { available: true, m, mode, ratios, gross, repeat, lowContribution };
  }
  function consistencyCheck(state) {
    const c = Sim.calc.consistency(state); const flags = [];
    const chk = (ratio, label) => { if (ratio == null) return; if (ratio < 0.8 || ratio > 1.2) flags.push(`${label}：②の合計が①の${Math.round(ratio * 100)}%です。間口カテゴリの分け方か新規の数え方にズレがある可能性があります`); };
    chk(c.newBuyersRatio, '新規人数'); chk(c.newRevenueRatio, '新規客売上');
    return Object.assign({}, c, { flags });
  }
  function mgmtChecks(state) {
    const m = state.mgmt || {}; const w = []; const has = v => v != null;
    if (has(m.revenue) && has(m.newRevenue) && m.newRevenue > m.revenue) w.push({ code: 'new_gt_total', message: '新規客売上が総売上を超えています。どちらかの数字をご確認ください' });
    if (has(m.buyers) && has(m.newBuyers) && m.newBuyers > m.buyers) w.push({ code: 'new_gt_total', message: '新規客数が購入客数を超えています。どちらかの数字をご確認ください' });
    const v = m.visits || {}; const vs = [v.once, v.twice, v.threePlus];
    if (vs.every(has) && has(m.activeCustomers) && vs[0] + vs[1] + vs[2] > m.activeCustomers) w.push({ code: 'visits_gt_active', message: '来店回数別の客数の合計がアクティブ顧客数を超えています。数え方をご確認ください' });
    (m.products || []).forEach(x => { if (has(x.grossMarginPct) && (x.grossMarginPct < 0 || x.grossMarginPct > 100)) w.push({ code: 'gm_range', message: `${x.name || '商品'}：粗利率は0〜100%の範囲で入力します` }); });
    const negs = []; const scan = (obj, prefix) => Object.keys(obj || {}).forEach(k => { const val = obj[k]; if (typeof val === 'number' && val < 0) negs.push(prefix + k); });
    scan({ revenue: m.revenue, buyers: m.buyers, newBuyers: m.newBuyers, newRevenue: m.newRevenue, activeCustomers: m.activeCustomers, dormant: m.dormant, inventory: m.inventory }, ''); scan(m.costs, 'costs.'); scan(m.visits, 'visits.'); scan(m.funnel, 'funnel.');
    if (negs.length) w.push({ code: 'negative', message: '経営数値の金額・人数は0以上で入力します（計算では0として扱っています）' });
    return w;
  }
  function mgmtComments(state) {
    const h = mgmtHealth(state); if (!h.available) return ['①経営数値を入れると経営の健康度が出ます。'];
    const m = h.m; const out = []; const ref = (r, unitLabel) => {
      if (h.mode === 'benchmark' && r.diffBench != null) return `（目安${pct1(r.bench)}との差${(r.diffBench >= 0 ? '+' : '')}${pct1(r.diffBench)}）`;
      if (h.mode === 'prev' && r.diffPrev != null) return `（前期${pct1(r.prev)}から${(r.diffPrev >= 0 ? '+' : '')}${pct1(r.diffPrev)}）`;
      return '';
    };
    if (m.grossMarginPct != null) out.push(`粗利率${pct1(m.grossMarginPct)}${ref(h.gross)}。営業利益は${m.operatingProfit == null ? '費用を入れると出ます' : yen(m.operatingProfit) + '（営業利益率' + pct1(m.opMarginPct) + '）'}。`);
    if (m.breakEven != null) out.push(`損益分岐点売上は${yen(m.breakEven)}で、安全余裕率は${pct1(m.safetyMargin)}です。${m.safetyMargin < 0.1 ? '余裕が薄く、売上の小さな落ち込みが赤字に直結しやすい構造です。' : ''}`);
    const worstRatio = h.ratios.filter(r => r.value != null && (r.diffBench != null || r.diffPrev != null)).sort((a, b) => ((b.diffBench != null ? b.diffBench : b.diffPrev) - (a.diffBench != null ? a.diffBench : a.diffPrev)))[0];
    if (worstRatio) out.push(`費用比率で最も上振れているのは${worstRatio.label}${pct1(worstRatio.value)}${ref(worstRatio)}です。`);
    else h.ratios.filter(r => r.value != null).forEach(r => out.push(`${r.label}は${pct1(r.value)}です。`));
    if (m.newShare != null) out.push(`売上の${pct1(1 - m.newShare)}が既存客によるものです。${m.newShare < 0.2 ? '既存客の維持が売上の土台になっています。' : '新規依存が高く、リピートの仕組みで安定させる余地があります。'}`);
    if (m.repeatRate != null) out.push(`2回以上来店した方はアクティブ顧客の${pct1(m.repeatRate)}${ref(h.repeat)}です。`);
    if (h.lowContribution.length) out.push(`${h.lowContribution.join('・')}は売上シェアに比べて粗利貢献が小さく、値付けか仕入の見直し余地がある可能性があります。`);
    const lv = Sim.calc.mgmtLeverage(state); if (lv) out.push(`営業利益に最も効くのは「${lv.top.label}」で、${yen(lv.top.delta)}の増加になる試算です。`);
    consistencyCheck(state).flags.forEach(f => out.push(f + '。'));
    return out;
  }
  Sim.analysis = { MIN_BASE, LEVER_LABELS, QUADRANT_LABELS, portfolio, leverage, weakness, timing, checks, comments, mgmtHealth, consistencyCheck, mgmtChecks, mgmtComments };
```

- [ ] **Step 4: 全テストが通ることを確認**

Run: `node tests/run.js`
Expected: `76 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/analysis.js tests/analysis.test.js
git commit -m "feat(v2.1): analysis に経営の健康度・整合チェック・注記・コメントを追加"
```

---

### Task 4: paste.js — 2列（項目名・値）貼り付け

**Files:**
- Modify: `js/paste.js`
- Modify: `tests/paste.test.js`

**Interfaces:**
- Produces:
  - `Sim.paste.KV_LABELS`（state パス → 認識ラベル配列）
  - `Sim.paste.parseKeyValues(text)` → `{ values:{[path]:number}, prev:{[path]:number}, warnings:[string] }`（path は `mgmt` からの相対、例 `costs.labor`）
  - `Sim.paste.applyKeyValues(state, parsed)` → `{ state（深いコピー）, count, prevCount }`

- [ ] **Step 1: テストを追加**

`tests/paste.test.js` の末尾に追記:
```js
test('parseKeyValues: ラベル揺れ・記号・前期プレフィックス・未知行', () => {
  const r = P.parseKeyValues('総売上\t¥48,000,000\n購入客数,700\n広告費\t1,800,000\n期末在庫金額　6000000\n来店3回以上\t150\n前期 総売上\t40000000\n前期　人件費\t9,000,000\n謎の項目\t1\n人件費\tabc');
  eq(r.values, { revenue: 48000000, buyers: 700, 'costs.ads': 1800000, inventory: 6000000, 'visits.threePlus': 150 });
  eq(r.prev, { revenue: 40000000, 'costs.labor': 9000000 });
  eq(r.warnings.length, 2); ok(r.warnings[0].includes('謎の項目')); ok(r.warnings[1].includes('人件費'));
  eq(P.parseKeyValues('').values, {});
  const e = P.parseKeyValues('前期 総売上\t\n家賃\t'); eq(e.values, {}); eq(e.prev, {}); eq(e.warnings, [], '値が空の行は警告なしで飛ばす');
});
test('applyKeyValues: 値を反映し、前期があれば prev を作る', () => {
  const s = Sim.state.createEmpty(); const r = P.applyKeyValues(s, P.parseKeyValues('総売上\t100\n仕入原価\t40\n前期 総売上\t90'));
  eq(s.mgmt.revenue, null, '元は変えない'); eq(r.state.mgmt.revenue, 100); eq(r.state.mgmt.costs.cogs, 40); eq(r.state.mgmt.prev.revenue, 90); eq(r.count, 2); eq(r.prevCount, 1);
  const r2 = P.applyKeyValues(s, P.parseKeyValues('総売上\t100')); eq(r2.state.mgmt.prev, null);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node tests/run.js`
Expected: 新規2件が ✗

- [ ] **Step 3: paste.js に追加**

`apply()` の後（`Sim.paste = ...` の前）に追加し、export 行を置き換える:
```js
  const KV_LABELS = {
    revenue: ['総売上', '売上高', '総売上高'], buyers: ['購入客数', '客数'], newBuyers: ['新規客数', '新規顧客数'], newRevenue: ['新規客売上', '新規売上'],
    itemsPerBuyer: ['買上点数'], activeCustomers: ['アクティブ顧客数', '顧客数'], 'visits.once': ['来店1回'], 'visits.twice': ['来店2回'], 'visits.threePlus': ['来店3回以上'],
    dormant: ['休眠客数'], inventory: ['期末在庫', '期末在庫金額', '在庫金額'], 'costs.cogs': ['仕入原価', '売上原価'], 'costs.labor': ['人件費'], 'costs.rent': ['家賃', '地代家賃'],
    'costs.ads': ['広告宣伝費', '広告費'], 'costs.other': ['その他経費', 'その他'], 'funnel.reservations': ['予約数'], 'funnel.visits': ['来店数'], 'funnel.deals': ['成約数']
  };
  const normLabel = s => String(s == null ? '' : s).replace(/[\s　"]/g, '').replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  function parseKeyValues(text) {
    const values = {}, prev = {}, warnings = [];
    String(text || '').split(/\r?\n/).forEach((line, li) => {
      if (line.trim() === '') return;
      const m = line.match(/^([^\t,]+)[\t,]\s*(.*)$/) || line.match(/^(\S+)[\s　]+(\S+)$/);
      if (!m) { warnings.push(`${li + 1}行目：「項目名 TAB 値」の形になっていません`); return; }
      if (m[2].trim() === '') return;   // 値が空の行（テンプレの未記入行）は黙って飛ばす
      let label = normLabel(m[1]); let isPrev = false;
      if (label.startsWith('前期')) { isPrev = true; label = label.slice(2); }
      const path = Object.keys(KV_LABELS).find(k => KV_LABELS[k].some(a => normLabel(a) === label));
      if (!path) { warnings.push(`${li + 1}行目：「${m[1].trim()}」は認識できない項目のため飛ばしました`); return; }
      const v = toNum(m[2]);
      if (v == null) { warnings.push(`${li + 1}行目：「${m[1].trim()}」の値が数字ではありません`); return; }
      (isPrev ? prev : values)[path] = v;
    });
    return { values, prev, warnings };
  }
  function setDeep(obj, path, value) { const keys = path.split('.'); let o = obj; for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) o[keys[i]] = {}; o = o[keys[i]]; } o[keys[keys.length - 1]] = value; }
  function applyKeyValues(state, parsed) {
    const s = JSON.parse(JSON.stringify(state)); s.mgmt = s.mgmt || Sim.state.emptyMgmt();
    Object.keys(parsed.values).forEach(p => setDeep(s.mgmt, p, parsed.values[p]));
    const prevKeys = Object.keys(parsed.prev);
    if (prevKeys.length) { if (!s.mgmt.prev) s.mgmt.prev = Sim.state.normalizeMgmt({}, false); prevKeys.forEach(p => setDeep(s.mgmt.prev, p, parsed.prev[p])); }
    return { state: s, count: Object.keys(parsed.values).length, prevCount: prevKeys.length };
  }
  Sim.paste = { HEADERS, toNum, mapHeaders, parse, apply, KV_LABELS, parseKeyValues, applyKeyValues };
```

- [ ] **Step 4: 全テストが通ることを確認**

Run: `node tests/run.js`
Expected: `78 passed, 0 failed`

- [ ] **Step 5: コミット**

```bash
git add js/paste.js tests/paste.test.js
git commit -m "feat(v2.1): paste に経営数値の2列貼り付けを追加"
```

---

### Task 5: 5ステップ化・①経営数値の画面（ui-mgmt.js）・②の整理

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/print.css`
- Modify: `css/style.css`（末尾に追記＋ステッパー列数）
- Create: `js/ui-mgmt.js`
- Modify: `js/ui-input.js`（集客経路ブロックの撤去・原価率の自動表示）

**Interfaces:**
- Consumes: `Sim.state.emptyMgmt / normalizeMgmt / newProductRow / newReplacementRow / newChannel`、`Sim.calc.mgmt / effectiveCogsRate`、`Sim.analysis.mgmtChecks / consistencyCheck`、`Sim.paste.parseKeyValues / applyKeyValues`、`Sim.ui.util`
- Produces: `Sim.ui.mgmt = { render(el, state, api), refresh(el, state, api) }`。`app.js` のモジュール表は `{1: Sim.ui.mgmt, 2: Sim.ui.input, 3: Sim.ui.diagnosis, 4: Sim.ui.plan, 5: Sim.ui.report}`

- [ ] **Step 1: index.html を修正**

(a) ヘッダー説明文:
```html
        <p id="head-sub">経営数値と間口カテゴリを入れて診断し、目標とレバー配分まで設計します。入力は自動保存されます。</p>
```
(b) ステッパーとパネルを5つに置き換え:
```html
<nav class="stepper wrap" id="stepper" aria-label="ステップ">
  <button type="button" data-step="1" class="active"><span class="no">1</span>経営数値</button>
  <button type="button" data-step="2"><span class="no">2</span>間口カテゴリ</button>
  <button type="button" data-step="3"><span class="no">3</span>診断</button>
  <button type="button" data-step="4"><span class="no">4</span>目標と戦略</button>
  <button type="button" data-step="5"><span class="no">5</span>レポート</button>
</nav>
<main class="wrap">
  <section class="step-panel" id="panel-1" data-step="1"></section>
  <section class="step-panel" id="panel-2" data-step="2" hidden></section>
  <section class="step-panel" id="panel-3" data-step="3" hidden></section>
  <section class="step-panel" id="panel-4" data-step="4" hidden></section>
  <section class="step-panel" id="panel-5" data-step="5" hidden></section>
  <div class="footnote">すべて試算です。実数値を入れるほど精度が上がります。ブラウザ内の自動保存は同じ端末・同じブラウザでしか残りません。持ち回るときは「書き出し」をお使いください。</div>
</main>
```
(c) スクリプトの読み込み順に `ui-mgmt.js` を追加（`ui-util.js` の直後）:
```html
<script src="js/ui-util.js"></script>
<script src="js/ui-mgmt.js"></script>
<script src="js/ui-input.js"></script>
```

- [ ] **Step 2: app.js を修正**

3か所を置き換え:
```js
  const mods = () => ({ 1: Sim.ui.mgmt, 2: Sim.ui.input, 3: Sim.ui.diagnosis, 4: Sim.ui.plan, 5: Sim.ui.report });
```
```js
    if (n === 5) reportDirty = false;
```
```js
    window.addEventListener('beforeprint', () => { if (reportDirty) { Sim.ui.report.render($('panel-5'), app.state, api); applyGuide($('panel-5')); reportDirty = false; } });
```

- [ ] **Step 3: print.css を修正**

```css
  #panel-5 { display: block !important; }
```
（`#panel-4 { display: block !important; }` を置き換える）

- [ ] **Step 4: style.css を修正**

`.stepper{...}` の `grid-template-columns:repeat(4,1fr)` を `repeat(5,1fr)` に変更し、末尾（`@media(max-width:880px)` の前）に追記:
```css
.mg4{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.autovals{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:6px;padding-top:8px;border-top:1px dashed var(--line);font-size:12px;color:var(--text-soft)}
.autovals b{color:var(--ink);font-size:14px;margin-left:4px}
.auto-tag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;background:rgba(63,138,110,.15);color:var(--good);font-size:10px;font-weight:800}
.wf{width:100%;max-width:720px;height:auto;display:block;margin:0 auto 8px}
.wf .bar-total{fill:var(--indigo)}.wf .bar-minus{fill:#c9a9a3}.wf .bar-profit{fill:var(--good)}.wf .bar-loss{fill:var(--bad)}
.wf .lbl{font-size:11px;fill:var(--ink-soft);text-anchor:middle}.wf .val{font-size:11px;fill:var(--ink);text-anchor:middle;font-weight:700}.wf .axis{stroke:var(--line)}
.hbar-row{display:grid;grid-template-columns:110px 1fr 70px;gap:10px;align-items:center;margin:6px 0;font-size:12px}
.hbar{position:relative;height:16px;background:var(--washi-deep);border-radius:8px;overflow:hidden}
.hbar .cur{position:absolute;left:0;top:0;height:100%;background:linear-gradient(90deg,var(--gold-soft),var(--gold));border-radius:8px}
.hbar .prev{position:absolute;left:0;top:4px;height:8px;background:rgba(58,90,140,.35);border-radius:4px}
.hbar .bench{position:absolute;top:-2px;width:2px;height:20px;background:var(--bad)}
.hbar-legend{font-size:11px;color:var(--text-soft);margin-top:4px}
.mix{display:flex;height:22px;border-radius:11px;overflow:hidden;font-size:11px;color:#fff;font-weight:800}
.mix span{display:flex;align-items:center;justify-content:center;white-space:nowrap}
.mix .new{background:var(--indigo-bright)}.mix .exist{background:var(--gold)}
.mgkv{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin:8px 0}
.mgkv div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.mgkv .k{font-size:11px;color:var(--text-soft);font-weight:700}.mgkv .v{font-size:18px;font-weight:800;color:var(--ink)}
.lev-inline{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.lev-inline div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--text-soft)}
.lev-inline div b{display:block;font-size:15px;color:var(--ink)}.lev-inline div.top{border-color:var(--gold);box-shadow:0 0 0 2px rgba(184,146,74,.3)}
```

- [ ] **Step 5: ui-mgmt.js を作る**

`js/ui-mgmt.js`:
```js
window.Sim = window.Sim || {};
Sim.ui = Sim.ui || {};
(function () {
  const U = () => Sim.ui.util;
  let pendingKv = null;
  function nf(labelHtml, path, value, opts) {
    const { val } = U(); opts = opts || {};
    return `<div class="field"><span class="flabel">${labelHtml}</span><input class="inp" type="number" min="0"${opts.max != null ? ` max="${opts.max}"` : ''}${opts.step ? ` step="${opts.step}"` : ''} data-type="optnum" data-path="${path}" value="${val(value)}"></div>`;
  }
  function numericBlocks(prefix, m, tag) {
    const g = p => `${prefix}.${p}`; const { guide } = U(); const t = tag || '';
    return `
      <div class="sec-title"><span class="no">1</span><h2>売上の全体像${t}</h2><span class="hint">年次（直近の決算期）${guide('レジの年間集計や決算書から。「新規客数」「新規客売上」は顧客IDで初回購入を判定できることが前提です。無ければ新規会員登録数で代用してください。')}</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('総売上（年）<span class="q">円。税込／税抜は店内で統一</span>', g('revenue'), m.revenue)}
        ${nf('購入客数（延べ）<span class="q">人</span>', g('buyers'), m.buyers)}
        ${nf('新規客数<span class="q">人</span>', g('newBuyers'), m.newBuyers)}
        ${nf('新規客売上<span class="q">円</span>', g('newRevenue'), m.newRevenue)}
        ${nf('買上点数（任意）<span class="q">1人あたり</span>', g('itemsPerBuyer'), m.itemsPerBuyer, { step: '0.1' })}
      </div><div class="autovals" data-out="${prefix}-auto-sales"></div></div>
      <div class="sec-title"><span class="no">2</span><h2>顧客の構成${t}</h2><span class="hint">${guide('アクティブ顧客＝過去2年以内に購入した人。来店回数別はその内訳です（合計がアクティブ顧客数と一致するのが理想）。')}</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('アクティブ顧客数<span class="q">過去2年以内に購入</span>', g('activeCustomers'), m.activeCustomers)}
        ${nf('来店1回の客数', g('visits.once'), m.visits.once)}
        ${nf('来店2回の客数', g('visits.twice'), m.visits.twice)}
        ${nf('来店3回以上の客数', g('visits.threePlus'), m.visits.threePlus)}
        ${nf('休眠客数（任意）<span class="q">2年以上来店なし</span>', g('dormant'), m.dormant)}
      </div><div class="autovals" data-out="${prefix}-auto-cust"></div></div>
      <div class="sec-title"><span class="no">3</span><h2>費用の構造${t}</h2><span class="hint">年額${guide('決算書・試算表から。粗利率＝（売上−仕入原価）÷売上、損益分岐点売上＝固定費÷粗利率で計算します。')}</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('仕入原価<span class="q">円</span>', g('costs.cogs'), m.costs.cogs)}
        ${nf('人件費<span class="q">円</span>', g('costs.labor'), m.costs.labor)}
        ${nf('家賃<span class="q">円</span>', g('costs.rent'), m.costs.rent)}
        ${nf('広告宣伝費<span class="q">円</span>', g('costs.ads'), m.costs.ads)}
        ${nf('その他経費<span class="q">円</span>', g('costs.other'), m.costs.other)}
        ${nf('期末在庫金額（任意）<span class="q">円</span>', g('inventory'), m.inventory)}
      </div><div class="autovals" data-out="${prefix}-auto-cost"></div></div>
      <div class="sec-title"><span class="no">4</span><h2>集客効率${t}</h2><span class="hint">任意</span></div>
      <div class="card pad"><div class="basebox mg4">
        ${nf('予約数', g('funnel.reservations'), m.funnel.reservations)}
        ${nf('来店数', g('funnel.visits'), m.funnel.visits)}
        ${nf('成約数', g('funnel.deals'), m.funnel.deals)}
      </div><div class="autovals" data-out="${prefix}-auto-funnel"></div></div>`;
  }
  function productsBlock(m) {
    const { esc, val, guide } = U();
    return `<div class="sec-title"><span class="no">5</span><h2>商品・粗利</h2><span class="hint">カテゴリ別の売上と粗利率${guide('売上の内訳と粗利率をカテゴリごとに。②の間口カテゴリ名を取り込んでから、足りない行を追加できます。')}</span></div>
      <div class="card pad"><table class="ltable"><tr><th>カテゴリ</th><th>売上（年・円）</th><th>粗利率（%）</th><th>売上シェア</th><th>粗利貢献</th><th></th></tr>
        ${m.products.map((p, i) => `<tr><td><input type="text" data-path="mgmt.products.${i}.name" value="${esc(p.name)}" placeholder="カテゴリ名"></td><td><input type="number" min="0" data-type="optnum" data-path="mgmt.products.${i}.sales" value="${val(p.sales)}"></td><td><input type="number" min="0" max="100" data-type="optnum" data-path="mgmt.products.${i}.grossMarginPct" value="${val(p.grossMarginPct)}"></td><td data-out="mg-prod-share-${p.id}"></td><td data-out="mg-prod-contrib-${p.id}"></td><td><button type="button" class="del dark" data-action="mg-del-product" data-index="${i}">✕</button></td></tr>`).join('')}
      </table>
      <button type="button" class="sbtn" data-action="mg-import-categories">②の間口カテゴリ名を取り込む</button><button type="button" class="sbtn" data-action="mg-add-product">＋ 行を追加</button>
      <div class="autovals" data-out="mg-auto-inv"></div></div>`;
  }
  function replacementBlock(m) {
    const { esc, val, guide } = U();
    return `<div class="sec-title"><span class="no">6</span><h2>買替周期</h2><span class="hint">任意・高額品${guide('「サイクル年数」はその商品を買い替える目安の年数、「直近サイクル分の購入者数」はその年数のあいだに買った人数です。年数で割ると、今後1年に買替時期を迎える人数の目安になります。')}</span></div>
      <div class="card pad"><table class="ltable"><tr><th>商品（②の間口カテゴリ名と同じにすると見込み売上が出ます）</th><th>サイクル年数</th><th>直近サイクル分の購入者数</th><th>今後1年の買替見込み</th><th></th></tr>
        ${m.replacement.map((r, i) => `<tr><td><input type="text" data-path="mgmt.replacement.${i}.name" value="${esc(r.name)}"></td><td><input type="number" min="0" step="0.5" data-type="optnum" data-path="mgmt.replacement.${i}.cycleYears" value="${val(r.cycleYears)}"></td><td><input type="number" min="0" data-type="optnum" data-path="mgmt.replacement.${i}.pastBuyers" value="${val(r.pastBuyers)}"></td><td data-out="mg-rep-${r.id}"></td><td><button type="button" class="del dark" data-action="mg-del-rep" data-index="${i}">✕</button></td></tr>`).join('')}
      </table><button type="button" class="sbtn" data-action="mg-add-rep">＋ 行を追加</button></div>`;
  }
  function channelsBlock(state) {
    const { esc, val } = U();
    return `<div class="card pad" style="margin-top:14px"><h3 class="h3">集客経路（任意）— 経路ごとの新規人数と費用からCPAを出します</h3>
      <table class="ltable"><tr><th>経路名</th><th>新規人数</th><th>費用（円・年）</th><th>CPA</th><th></th></tr>
        ${state.channels.map((ch, i) => `<tr><td><input type="text" data-path="channels.${i}.name" value="${esc(ch.name)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.newCustomers" value="${val(ch.newCustomers)}"></td><td><input type="number" min="0" data-type="num" data-path="channels.${i}.cost" value="${val(ch.cost)}"></td><td data-out="cpa-${ch.id}"></td><td><button type="button" class="del dark" data-action="del-channel" data-index="${i}">✕</button></td></tr>`).join('')}
      </table><button type="button" class="sbtn" data-action="add-channel">＋ 経路を追加</button>
      <p class="note-p">経路の新規合計と間口カテゴリの新規合計は一致しなくて構いません。</p></div>`;
  }
  function render(el, state, api) {
    const { esc, val } = U(); const m = state.mgmt; const b = state.benchmarks;
    el.innerHTML = `
      <p class="note-p">店全体の数字を年次で入れます。すべて任意ですが、★の付いた「総売上・新規客数・新規客売上・仕入原価・人件費・家賃・広告宣伝費・その他経費」が揃うと診断が出ます。分からない項目は空欄のままで構いません。</p>
      ${numericBlocks('mgmt', m, '')}
      ${channelsBlock(state)}
      ${productsBlock(m)}
      ${replacementBlock(m)}
      <div class="warnings" data-out="mg-warn"></div>
      <details class="card optblock"><summary>前期の数字（任意・入れると前期比の診断が出ます）</summary><div class="optbody">
        ${m.prev ? numericBlocks('mgmt.prev', m.prev, '（前期）') + '<button type="button" class="sbtn" data-action="mg-del-prev">前期の欄を消す</button>' : '<button type="button" class="sbtn" data-action="mg-add-prev">前期の欄を追加</button>'}
      </div></details>
      <details class="card optblock"><summary>経営数値の目安値（任意）— 自社目標や過去平均など、比べたい基準があれば</summary><div class="optbody basebox mg4">
        ${nf('粗利率の目安 %', 'benchmarks.grossMarginPct', b.grossMarginPct, { max: 100 })}
        ${nf('人件費率の目安 %', 'benchmarks.laborPct', b.laborPct, { max: 100 })}
        ${nf('家賃比率の目安 %', 'benchmarks.rentPct', b.rentPct, { max: 100 })}
        ${nf('広告費率の目安 %', 'benchmarks.adsPct', b.adsPct, { max: 100 })}
        ${nf('リピート率の目安 %', 'benchmarks.repeatRate', b.repeatRate, { max: 100 })}
      </div></details>
      <details class="card optblock"><summary>貼り付け（項目名と値の2列）— 収集シートの「経営数値」をそのまま貼れます</summary><div class="optbody">
        <p class="note-p">1行に「項目名 TAB 値」。項目名：総売上／購入客数／新規客数／新規客売上／買上点数／アクティブ顧客数／来店1回／来店2回／来店3回以上／休眠客数／期末在庫／仕入原価／人件費／家賃／広告宣伝費／その他経費／予約数／来店数／成約数。先頭に「前期 」を付けると前期の欄に入ります。カテゴリ別の売上・粗利率と買替は表に直接入力してください。</p>
        <textarea id="kv-text" rows="6" placeholder="総売上	48000000&#10;仕入原価	24000000"></textarea>
        <button type="button" class="sbtn" data-action="kv-preview">プレビュー</button><div id="kv-preview"></div>
      </div></details>`;
    outputs(el, state); U().bindPanel(el, api, actions(api, el));
  }
  function renderKvPreview(res, el) {
    const { esc, fmt } = U(); const box = el.querySelector('#kv-preview'); if (!box) return;
    const labelOf = p => (Sim.paste.KV_LABELS[p] || [p])[0];
    const rows = Object.keys(res.values).map(p => `<tr><td>${esc(labelOf(p))}</td><td>${fmt(res.values[p])}</td></tr>`).concat(Object.keys(res.prev).map(p => `<tr><td>前期 ${esc(labelOf(p))}</td><td>${fmt(res.prev[p])}</td></tr>`));
    box.innerHTML = (res.warnings.length ? `<ul class="warn">${res.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '') +
      (rows.length ? `<table class="ltable"><tr><th>項目</th><th>値</th></tr>${rows.join('')}</table><button type="button" class="sbtn primary" data-action="kv-apply">取り込む</button>` : '<p class="note-p">取り込める行がありません。</p>');
  }
  function actions(api, el) {
    return {
      'mg-add-product': () => api.update(s => { s.mgmt.products.push(Sim.state.newProductRow()); }, { structural: true }),
      'mg-del-product': d => api.update(s => { s.mgmt.products.splice(+d.index, 1); }, { structural: true }),
      'mg-import-categories': () => api.update(s => { const names = new Set(s.mgmt.products.map(p => p.name)); s.categories.forEach(c => { if (!names.has(c.name)) s.mgmt.products.push(Sim.state.newProductRow({ name: c.name })); }); }, { structural: true }),
      'mg-add-rep': () => api.update(s => { s.mgmt.replacement.push(Sim.state.newReplacementRow()); }, { structural: true }),
      'mg-del-rep': d => api.update(s => { s.mgmt.replacement.splice(+d.index, 1); }, { structural: true }),
      'add-channel': () => api.update(s => { s.channels.push(Sim.state.newChannel()); }, { structural: true }),
      'del-channel': d => api.update(s => { s.channels.splice(+d.index, 1); }, { structural: true }),
      'mg-add-prev': () => api.update(s => { s.mgmt.prev = Sim.state.normalizeMgmt({}, false); }, { structural: true }),
      'mg-del-prev': () => { if (!confirm('前期の数字を消しますか？')) return; api.update(s => { s.mgmt.prev = null; }, { structural: true }); },
      'kv-preview': () => { const res = Sim.paste.parseKeyValues(el.querySelector('#kv-text').value); pendingKv = res; renderKvPreview(res, el); },
      'kv-apply': () => { if (!pendingKv) return; const kv = pendingKv; pendingKv = null; let r = null;
        api.update(s => { r = Sim.paste.applyKeyValues(s, kv); Object.assign(s, r.state); }, { structural: true });
        alert(`取り込みました（今期${r.count}件・前期${r.prevCount}件）`); }
    };
  }
  function outputs(el, state) {
    const { yen, fmt, fmt1, esc } = U(); const m = Sim.calc.mgmt(state);
    const set = (k, html) => { const n = el.querySelector(`[data-out="${k}"]`); if (n) n.innerHTML = html; };
    const pct = v => (v == null ? '—' : fmt1(v * 100) + '%'); const kv = (k, v) => `<span>${k}<b>${v}</b></span>`;
    const fill = (prefix, x) => {
      set(`${prefix}-auto-sales`, kv('既存客売上', yen(x.existingRevenue)) + kv('客単価', yen(x.aov)) + kv('新規売上比率', pct(x.newShare)));
      set(`${prefix}-auto-cust`, kv('リピート率（2回以上）', pct(x.repeatRate)) + kv('年間来店頻度', x.visitFrequency == null ? '—' : fmt1(x.visitFrequency) + '回'));
      set(`${prefix}-auto-cost`, kv('粗利率', pct(x.grossMarginPct)) + kv('人件費率', pct(x.laborPct)) + kv('家賃比率', pct(x.rentPct)) + kv('広告費率', pct(x.adsPct)) + kv('営業利益', yen(x.operatingProfit)) + kv('営業利益率', pct(x.opMarginPct)) + kv('損益分岐点売上', yen(x.breakEven)) + kv('安全余裕率', pct(x.safetyMargin)) + kv('在庫回転', x.inventoryTurnMonths == null ? '—' : fmt1(x.inventoryTurnMonths) + 'ヶ月'));
      set(`${prefix}-auto-funnel`, kv('予約→来店', pct(x.funnel.visitRate)) + kv('来店→成約', pct(x.funnel.dealRate)));
    };
    fill('mgmt', m); if (m.prev) fill('mgmt.prev', m.prev);
    m.products.forEach(p => { set(`mg-prod-share-${p.id}`, pct(p.share)); set(`mg-prod-contrib-${p.id}`, pct(p.contributionShare)); });
    set('mg-auto-inv', kv('粗利貢献の合計', yen(m.products.reduce((s, p) => s + (p.contribution || 0), 0))));
    m.replacement.forEach(r => set(`mg-rep-${r.id}`, r.expectedBuyers == null ? '—' : fmt1(r.expectedBuyers) + '人'));
    m.channels.forEach(ch => set(`cpa-${ch.id}`, ch.cpa == null ? '—' : yen(ch.cpa)));
    const w = Sim.analysis.mgmtChecks(state).map(x => x.message).concat(Sim.analysis.consistencyCheck(state).flags);
    set('mg-warn', w.length ? `<ul class="warn">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
  }
  Sim.ui.mgmt = { render, refresh: outputs };
})();
```

- [ ] **Step 6: ui-input.js を修正**

(a) `render()` の中で、集客経路の `<details class="card optblock">…</details>` ブロック（`集客経路（任意）— 経路ごとの…` から `</details>` まで）を削除する。
(b) 原価率の欄に自動表示のタグを付ける。`render()` の原価率の `gbox` を置き換え:
```js
        <div class="gbox"><label>原価率（物販）${guide('売上に対する仕入原価の割合です。粗利＝売上×（1−原価率）で計算します。①経営数値に仕入原価と総売上が入っていれば、そちらの値を優先します。')}<span data-out="cogs-auto"></span></label><div class="row"><input type="number" min="0" max="100" data-type="num" data-path="store.cogsRate" value="${val(s.cogsRate)}"><span class="unit">%</span></div></div>
```
(c) 見出しの「hint」に②であることを示す1行を先頭に追加（`el.innerHTML = \`` の直後）:
```js
      <p class="note-p">新規のお客様が最初に買う商品のくくり（間口カテゴリ）ごとに数字を入れます。①経営数値の新規客数・新規客売上と食い違う場合は③で注記が出ます。</p>
```
(d) `actions()` から `'add-channel'` と `'del-channel'` の2行を削除。
(e) `outputs()` の `st.channels.forEach(...)` 行を削除し、代わりに追加:
```js
    const cogsAuto = el.querySelector('[data-out="cogs-auto"]'); const m = state.mgmt;
    if (cogsAuto) cogsAuto.innerHTML = (m && m.revenue > 0 && m.costs.cogs != null) ? `<span class="auto-tag">経営数値から自動：${fmt1(Sim.calc.effectiveCogsRate(state))}%</span>` : '';
```
`outputs()` の分割代入を `const { yen, fmt, fmt1, esc } = U();` に変える。

- [ ] **Step 7: 構文とテストを確認**

Run: `node --check js/*.js && node tests/run.js`
Expected: 全ファイル構文OK、`78 passed, 0 failed`

- [ ] **Step 8: ブラウザで手動確認（コントローラーが実施）**

| 確認 | 期待 |
|---|---|
| 起動（サンプル） | ステッパーが5つ。①に経営数値の6ブロック＋前期・目安値・貼り付けの折りたたみ。自動値：既存客売上 ¥47,100,000／客単価 ¥68,571／リピート率 44.4%／粗利率 50%／営業利益 ¥4,800,000／損益分岐点 ¥38,400,000／安全余裕率 20%／在庫回転 3ヶ月／予約→来店 80% |
| 新規客売上に 60000000 | 黄色の注記「新規客売上が総売上を超えています」。フォーカス維持 |
| 「②の間口カテゴリ名を取り込む」 | 既にある2件は増えない（名前一致） |
| 前期の欄を追加→総売上 40000000 | 前期側の自動値が出る |
| 貼り付けに `総売上\t50000000\n前期 総売上\t45000000` → プレビュー → 取り込む | 「今期1件・前期1件」、欄が更新 |
| ② | 集客経路ブロックが無い。原価率の横に「経営数値から自動：50%」 |
| 仕入原価を 19200000 に→② | タグが 40%。③のKPI粗利が 40% ベース |
| 幅400px | 横スクロールなし |

- [ ] **Step 9: コミット**

```bash
git add index.html js/app.js css/print.css css/style.css js/ui-mgmt.js js/ui-input.js
git commit -m "feat(v2.1): 5ステップ化と①経営数値の入力画面"
```

---

### Task 6: ③診断に「経営の健康度」を追加（ui-diagnosis.js）

**Files:**
- Modify: `js/ui-diagnosis.js`

**Interfaces:**
- Consumes: `Sim.calc.mgmt / mgmtLeverage`、`Sim.analysis.mgmtHealth / consistencyCheck / mgmtComments`
- Produces: `Sim.ui.diagnosis.parts` に `mgmtKpis(m), waterfallSvg(m), costBars(h), customerMix(m), productTable(m, h), funnelBlock(m, state), consistencyBlock(cc), mgmtLeverageBlock(lv)` を追加（Task 8 のレポートが再利用）

- [ ] **Step 1: 部品関数を追加**

`js/ui-diagnosis.js` の `function render(el, state)` の直前に追加:
```js
  const pctS = v => (v == null ? '—' : (Math.round(v * 1000) / 10).toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + '%');
  function mgmtKpis(m) {
    const { yen, fmt } = U();
    return `<div class="mgkv">
      <div><div class="k">総売上（年）</div><div class="v">${yen(m.revenue)}</div></div>
      <div><div class="k">客単価</div><div class="v">${yen(m.aov)}</div></div>
      <div><div class="k">新規／既存の売上比</div><div class="v">${pctS(m.newShare)} ／ ${m.newShare == null ? '—' : pctS(1 - m.newShare)}</div></div>
      <div><div class="k">リピート率（2回以上）</div><div class="v">${pctS(m.repeatRate)}</div></div>
      <div><div class="k">粗利率</div><div class="v">${pctS(m.grossMarginPct)}</div></div>
      <div><div class="k">営業利益率</div><div class="v">${pctS(m.opMarginPct)}</div></div>
      <div><div class="k">損益分岐点売上</div><div class="v">${yen(m.breakEven)}</div></div>
      <div><div class="k">安全余裕率</div><div class="v">${pctS(m.safetyMargin)}</div></div>
    </div>`;
  }
  function waterfallSvg(m) {
    const { fmt } = U();
    if (m.revenue == null || m.cogs == null) return '<p class="note-p">総売上と仕入原価を入れると収益構造の図が出ます。</p>';
    const steps = [{ l: '売上', v: m.revenue, t: 'total' }, { l: '仕入原価', v: -m.cogs, t: 'minus' }, { l: '粗利', v: m.grossProfit, t: 'total' }];
    const c = m.costs; const add = (l, v) => { if (v != null) steps.push({ l, v: -v, t: 'minus' }); };
    add('人件費', c.labor); add('家賃', c.rent); add('広告費', c.ads); add('その他', c.other);
    if (m.operatingProfit != null) steps.push({ l: '営業利益', v: m.operatingProfit, t: m.operatingProfit >= 0 ? 'profit' : 'loss' });
    const W = 720, H = 300, P = 40, bw = (W - 2 * P) / steps.length; const max = Math.max(m.revenue, 1); const minV = Math.min(0, ...steps.map(s => s.t === 'total' || s.t === 'profit' || s.t === 'loss' ? s.v : 0));
    const scale = (H - 2 * P) / (max - minV); const y0 = P + max * scale;
    let level = 0; const bars = steps.map((s, i) => {
      let top, bottom;
      if (s.t === 'minus') { top = level + s.v; bottom = level; level = top; }
      else { top = Math.max(0, s.v); bottom = Math.min(0, s.v); level = s.v; }
      const x = P + i * bw + bw * 0.15; const yTop = y0 - Math.max(top, bottom) * scale; const h = Math.max(1, Math.abs(top - bottom) * scale);
      return `<rect x="${x}" y="${yTop}" width="${bw * 0.7}" height="${h}" class="bar-${s.t}"/><text x="${x + bw * 0.35}" y="${yTop - 4}" class="val">${(s.v < 0 ? '−' : '') + fmt(Math.abs(s.v) / 10000)}万</text><text x="${x + bw * 0.35}" y="${H - P + 16}" class="lbl">${s.l}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="wf" role="img" aria-label="収益構造"><line x1="${P}" y1="${y0}" x2="${W - P}" y2="${y0}" class="axis"/>${bars}</svg>`;
  }
  function costBars(h) {
    const rows = h.ratios.filter(r => r.value != null); if (!rows.length) return '<p class="note-p">費用を入れると比率が出ます。</p>';
    const max = Math.max(...rows.map(r => Math.max(r.value, r.prev || 0, r.bench || 0)), 0.05) * 1.25;
    const w = v => Math.min(100, v / max * 100);
    return rows.map(r => `<div class="hbar-row"><span>${r.label}</span><div class="hbar">${r.prev != null ? `<div class="prev" style="width:${w(r.prev)}%"></div>` : ''}<div class="cur" style="width:${w(r.value)}%"></div>${r.bench != null ? `<div class="bench" style="left:${w(r.bench)}%"></div>` : ''}</div><b>${pctS(r.value)}</b></div>`).join('') +
      `<div class="hbar-legend">金＝今期${h.mode === 'prev' || rows.some(r => r.prev != null) ? '　青＝前期' : ''}${rows.some(r => r.bench != null) ? '　赤線＝目安値' : ''}</div>`;
  }
  function customerMix(m) {
    const { fmt } = U();
    const mix = m.newShare == null ? '<p class="note-p">新規客売上を入れると新規／既存の比率が出ます。</p>' :
      `<div class="mix"><span class="new" style="width:${Math.max(4, m.newShare * 100)}%">新規 ${pctS(m.newShare)}</span><span class="exist" style="width:${Math.max(4, (1 - m.newShare) * 100)}%">既存 ${pctS(1 - m.newShare)}</span></div>`;
    const v = m.visits; const tot = m.visitsTotal;
    const dist = tot ? `<div class="hbar-row"><span>来店1回</span><div class="hbar"><div class="cur" style="width:${v.once / tot * 100}%"></div></div><b>${fmt(v.once)}人</b></div>
      <div class="hbar-row"><span>来店2回</span><div class="hbar"><div class="cur" style="width:${v.twice / tot * 100}%"></div></div><b>${fmt(v.twice)}人</b></div>
      <div class="hbar-row"><span>3回以上</span><div class="hbar"><div class="cur" style="width:${v.threePlus / tot * 100}%"></div></div><b>${fmt(v.threePlus)}人</b></div>` : '<p class="note-p">来店回数別の客数を入れると分布が出ます。</p>';
    return mix + dist + `<div class="autovals"><span>リピート率<b>${pctS(m.repeatRate)}</b></span><span>年間来店頻度<b>${m.visitFrequency == null ? '—' : (Math.round(m.visitFrequency * 100) / 100) + '回'}</b></span><span>休眠客数<b>${m.dormant == null ? '—' : fmt(m.dormant) + '人'}</b></span></div>`;
  }
  function productTable(m, h) {
    const { esc, yen } = U(); if (!m.products.length) return '<p class="note-p">カテゴリ別の売上と粗利率を入れると粗利貢献が出ます。</p>';
    const low = new Set(h.lowContribution);
    return `<table class="ltable"><tr><th>カテゴリ</th><th>売上</th><th>売上シェア</th><th>粗利率</th><th>粗利貢献シェア</th><th></th></tr>
      ${m.products.map(p => `<tr><td>${esc(p.name)}</td><td>${yen(p.sales)}</td><td>${pctS(p.share)}</td><td>${p.grossMarginPct == null ? '—' : p.grossMarginPct + '%'}</td><td>${pctS(p.contributionShare)}</td><td>${low.has(p.name) ? '<span class="tag review">粗利貢献が小さい</span>' : ''}</td></tr>`).join('')}</table>
      <div class="autovals"><span>在庫回転<b>${m.inventoryTurnMonths == null ? '—' : (Math.round(m.inventoryTurnMonths * 10) / 10) + 'ヶ月分'}</b></span></div>`;
  }
  function funnelBlock(m, state) {
    const { esc, yen, fmt, fmt1 } = U(); let html = '';
    if (m.channels.length) html += `<table class="ltable"><tr><th>経路</th><th>新規</th><th>費用</th><th>CPA</th><th>粗利LTV ÷ CPA</th></tr>${m.channels.map(ch => `<tr><td>${esc(ch.name)}</td><td>${fmt(ch.newCustomers)}</td><td>${yen(ch.cost)}</td><td>${yen(ch.cpa)}</td><td>${ch.payback == null ? '—' : fmt1(ch.payback) + '倍'}</td></tr>`).join('')}</table>`;
    const f = m.funnel;
    if (f.reservations != null || f.visits != null || f.deals != null) html += `<div class="autovals"><span>予約→来店<b>${pctS(f.visitRate)}</b></span><span>来店→成約<b>${pctS(f.dealRate)}</b></span></div>`;
    if (m.replacement.length) html += `<h3 class="h3">買替の見込み（今後1年）</h3><table class="ltable"><tr><th>商品</th><th>見込み客数</th><th>見込み売上（②の間口単価×人数）</th></tr>${m.replacement.map(r => { const cat = state.categories.find(c => c.name === r.name); const rev = (cat && r.expectedBuyers != null) ? cat.entryPrice * r.expectedBuyers : null; return `<tr><td>${esc(r.name)}</td><td>${r.expectedBuyers == null ? '—' : fmt1(r.expectedBuyers) + '人'}</td><td>${rev == null ? '—（②に同名のカテゴリがありません）' : yen(rev)}</td></tr>`; }).join('')}</table>`;
    return html || '<p class="note-p">集客経路・予約→成約・買替周期を入れると集客効率が出ます。</p>';
  }
  function consistencyBlock(cc) {
    const { fmt, yen, esc } = U();
    return `<table class="ltable"><tr><th></th><th>②間口カテゴリの合計</th><th>①経営数値</th><th>比</th></tr>
      <tr><td>新規人数</td><td>${fmt(cc.entryNewTotal)}人</td><td>${cc.newBuyers == null ? '—' : fmt(cc.newBuyers) + '人'}</td><td>${cc.newBuyersRatio == null ? '—' : pctS(cc.newBuyersRatio)}</td></tr>
      <tr><td>初回来店の売上</td><td>${yen(cc.entryNewRevenue)}</td><td>${yen(cc.newRevenue)}</td><td>${cc.newRevenueRatio == null ? '—' : pctS(cc.newRevenueRatio)}</td></tr></table>
      ${cc.flags.length ? `<ul class="warn">${cc.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="note-p">②と①のズレは許容範囲（80〜120%）です。</p>'}`;
  }
  function mgmtLeverageBlock(lv) {
    const { yen } = U(); if (!lv) return '<p class="note-p">費用の構造を入れると、営業利益への効きどころが出ます。</p>';
    return `<div class="lev-inline">${lv.items.map((it, i) => `<div class="${i === 0 ? 'top' : ''}">${it.label}<b>+${yen(it.delta)}</b></div>`).join('')}</div><p class="note-p">現状の営業利益 ${yen(lv.base)} に対する増分の試算です（売上増は仕入原価も同率で増える前提、固定費は不変）。</p>`;
  }
```

- [ ] **Step 2: render を修正**

`render(el, state)` の `el.innerHTML = \`` の直前に追加:
```js
    const h = Sim.analysis.mgmtHealth(state); const mlv = Sim.calc.mgmtLeverage(state); const cc = Sim.analysis.consistencyCheck(state); const mcm = Sim.analysis.mgmtComments(state);
    const mgmtHtml = h.available ? `
      <div class="sec-title"><span class="no">経</span><h2>経営数値サマリー</h2></div>${mgmtKpis(h.m)}
      <div class="sec-title"><span class="no">経</span><h2>収益構造</h2><span class="hint">売上から営業利益までの流れ</span></div><div class="card pad">${waterfallSvg(h.m)}</div>
      <div class="sec-title"><span class="no">経</span><h2>費用比率</h2><span class="hint">${guide('売上に対する各費用の割合です。前期を入れると薄い青、目安値を入れると赤い線で比較できます。業界の数字は入っていません。')}</span></div><div class="card pad">${costBars(h)}</div>
      <div class="sec-title"><span class="no">経</span><h2>顧客の構成</h2></div><div class="card pad">${customerMix(h.m)}</div>
      <div class="sec-title"><span class="no">経</span><h2>商品・粗利</h2></div><div class="card pad">${productTable(h.m, h)}</div>
      <div class="sec-title"><span class="no">経</span><h2>集客効率と買替</h2></div><div class="card pad">${funnelBlock(h.m, state)}</div>
      <div class="sec-title"><span class="no">経</span><h2>①と②の整合チェック</h2></div><div class="card pad">${consistencyBlock(cc)}</div>
      <div class="sec-title"><span class="no">経</span><h2>営業利益への効きどころ</h2></div><div class="card pad">${mgmtLeverageBlock(mlv)}</div>
      <div class="sec-title"><span class="no">経</span><h2>経営コメント</h2></div><div class="card pad"><ul class="cm">${mcm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      <hr class="sep">` : '<p class="note-p">①経営数値（総売上など）を入れると、ここに「経営の健康度」が出ます。以下は間口カテゴリの診断です。</p>';
```
`el.innerHTML = \`` の直後（既存の `<div class="sec-title"><span class="no">1</span><h2>現状サマリー` の前）に `${mgmtHtml}` を挿入する。

`css/style.css` に追記:
```css
hr.sep{border:none;border-top:2px dashed var(--line);margin:28px 0 8px}
```

- [ ] **Step 3: export を更新**

```js
  Sim.ui.diagnosis = { render, refresh: render, parts: { kpis, table, quadrantSvg, leverageBlock, weaknessBlock, timingBlock, mgmtKpis, waterfallSvg, costBars, customerMix, productTable, funnelBlock, consistencyBlock, mgmtLeverageBlock } };
```

- [ ] **Step 4: 構文とテスト**

Run: `node --check js/ui-diagnosis.js && node tests/run.js`
Expected: 構文OK、`78 passed, 0 failed`

- [ ] **Step 5: ブラウザで手動確認（コントローラーが実施）**

| 確認 | 期待 |
|---|---|
| ③（サンプル） | 先頭に「経」バッジの9ブロック。KPI：総売上 ¥48,000,000／粗利率 50%／営業利益率 10%／損益分岐点 ¥38,400,000／安全余裕率 20% |
| 滝図 | 売上→仕入原価→粗利→人件費→家賃→広告費→その他→営業利益（緑）の8本 |
| 費用比率 | 人件費率 20%・家賃 7.5%・広告 3.8%・その他 8.8% の横棒 |
| 顧客の構成 | 新規1.9%／既存98.1% の帯、来店回数の3本、リピート率 44.4% |
| 商品・粗利 | マットレスに「粗利貢献が小さい」タグ。在庫回転 3ヶ月分 |
| 整合チェック | 新規人数 100人／100人（100%）、初回来店売上 ¥840,000／¥900,000（93.3%）。注記なし |
| ①で新規客数を200に→③ | 整合チェックに注記 |
| 効きどころ | 「売上 +10%」+¥2,400,000 が枠付き |
| ①を「空で始める」→③ | 先頭が案内文1行、以降は間口診断（空） |

- [ ] **Step 6: コミット**

```bash
git add js/ui-diagnosis.js css/style.css
git commit -m "feat(v2.1): ③診断に経営の健康度（滝図・費用比率・顧客構成・粗利貢献・整合・効きどころ）"
```

---

### Task 7: ④目標と戦略に「必要利益からの逆算」（ui-plan.js）

**Files:**
- Modify: `js/ui-plan.js`

**Interfaces:**
- Consumes: `Sim.calc.requiredRevenue`
- Produces: `Sim.ui.plan.parts.requiredTable(r)`（Task 8 で再利用）

- [ ] **Step 1: 部品関数を追加**

`function reverseTable(r)` の直前に追加:
```js
  function requiredTable(r) {
    const { yen } = U(); const pctS = v => (v == null ? '—' : (Math.round(v * 1000) / 10) + '%');
    if (!r) return '<p class="note-p">①経営数値の「費用の構造」と、上の必要営業利益を入れると必要売上が出ます。</p>';
    return `<table class="ltable"><tr><th>項目</th><th>金額</th><th>計算</th></tr>
      <tr><td>必要売上</td><td><b>${yen(r.required)}</b></td><td>（固定費 ${yen(r.fixedCosts)} ＋ 必要営業利益）÷ 粗利率 ${pctS(r.grossMarginPct)}</td></tr>
      <tr><td>現状の総売上</td><td>${yen(r.current)}</td><td></td></tr>
      <tr><td>ギャップ</td><td class="${r.gap > 0 ? 'gap' : 'ok'}">${yen(r.gap)}</td><td>必要売上 − 現状</td></tr>
      <tr><td>既存客の見込み売上</td><td>${yen(r.existingForecast)}</td><td>既存客売上 ×（1 ＋ 見込み％）</td></tr>
      <tr><td>間口（新規）で稼ぐべき売上（1年）</td><td><b>${yen(r.newTarget)}</b></td><td>必要売上 − 既存客の見込み（負なら0）</td></tr></table>`;
  }
```

- [ ] **Step 2: render にブロックを追加**

`render()` の `el.innerHTML = \`` の直後（既存の「目標設定と逆算」の sec-title の前）に追加:
```js
      <div class="sec-title"><span class="no">経</span><h2>必要利益からの逆算</h2><span class="hint">${guide('「この営業利益を出すには売上がいくら必要か」を費用構造から逆算します。既存客の見込みを引いた残りが、新規（間口）で稼ぐべき売上です。「反映」を押すと下の目標売上（1年）に入ります。')}</span></div>
      <div class="card globals">
        <div class="gbox"><label>必要営業利益（年）</label><div class="row"><input type="number" min="0" step="100000" data-type="optnum" data-path="plan.requiredProfit" value="${val(plan.requiredProfit)}"><span class="unit">円</span></div></div>
        <div class="gbox"><label>既存客売上の見込み（現状比）</label><div class="row"><input type="number" step="1" data-type="num" data-path="plan.existingGrowthPct" value="${val(plan.existingGrowthPct)}"><span class="unit">%</span></div></div>
        <div class="gbox"><label>反映</label><div class="row"><button type="button" class="sbtn primary" data-action="apply-required">間口の目標売上（1年）に反映</button></div></div>
      </div>
      <div class="card pad" data-out="required"></div>
```

- [ ] **Step 3: outputs と actions に追加**

`outputs()` の `set('cur-rev', ...)` の直前に:
```js
    set('required', requiredTable(Sim.calc.requiredRevenue(state)));
```
`actions()` に追加:
```js
      'apply-required': () => { const r = Sim.calc.requiredRevenue(api.getState()); if (!r || r.newTarget == null) { alert('①経営数値の費用の構造と必要営業利益を入れると反映できます。'); return; }
        api.update(s => { s.plan.targetRevenue[0] = Math.round(r.newTarget); s.store.period = 1; }, { structural: true }); },
```
export を更新:
```js
  Sim.ui.plan = { render, refresh: outputs, parts: { reverseTable, requiredTable, comparison, LEVERS, TACTIC_LEVERS } };
```

- [ ] **Step 4: 構文とテスト**

Run: `node --check js/ui-plan.js && node tests/run.js`
Expected: 構文OK、`78 passed, 0 failed`

- [ ] **Step 5: ブラウザで手動確認（コントローラーが実施）**

| 確認 | 期待 |
|---|---|
| ④（サンプル） | 先頭に「必要利益からの逆算」。必要営業利益が空なら案内文 |
| 必要営業利益 6000000 | 必要売上 ¥50,400,000／ギャップ ¥2,400,000／既存見込み ¥47,100,000／間口で稼ぐべき ¥3,300,000 |
| 見込み 10% | 間口で稼ぐべき ¥0 |
| 見込み 0 →「反映」 | 期間が1年に切り替わり、目標売上（1年累計）が 3,300,000。逆算表が1年ベースで出る |

- [ ] **Step 6: コミット**

```bash
git add js/ui-plan.js
git commit -m "feat(v2.1): ④に必要利益からの逆算と目標への反映"
```

---

### Task 8: ⑤レポートに経営数値の2ページ（ui-report.js）

**Files:**
- Modify: `js/ui-report.js`

**Interfaces:**
- Consumes: `Sim.ui.diagnosis.parts.*`（Task 6）、`Sim.ui.plan.parts.requiredTable`（Task 7）、`Sim.analysis.mgmtHealth / consistencyCheck / mgmtComments`、`Sim.calc.mgmtLeverage / requiredRevenue`

- [ ] **Step 1: render を修正**

(a) `const today = ...` の行の直後に追加:
```js
    const h = Sim.analysis.mgmtHealth(state); const cc = Sim.analysis.consistencyCheck(state); const mcm = Sim.analysis.mgmtComments(state); const mlv = Sim.calc.mgmtLeverage(state); const rq = Sim.calc.requiredRevenue(state);
    let n = 0; const sec = () => ++n;
    const mgmtPages = h.available ? `
        <section class="rpage"><h2>${sec()}. 経営数値サマリー</h2>${D.mgmtKpis(h.m)}<h3>収益構造</h3>${D.waterfallSvg(h.m)}<h3>費用比率</h3>${D.costBars(h)}</section>
        <section class="rpage"><h2>${sec()}. 経営の健康度</h2><h3>顧客の構成</h3>${D.customerMix(h.m)}<h3>商品・粗利</h3>${D.productTable(h.m, h)}<h3>集客効率と買替</h3>${D.funnelBlock(h.m, state)}<h3>①と②の整合</h3>${D.consistencyBlock(cc)}<h3>営業利益への効きどころ</h3>${D.mgmtLeverageBlock(mlv)}<h3>コメント</h3><ul class="cm">${mcm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>` : '';
```
(b) レポート本体の各 `<h2>` の番号を固定値から `${sec()}.` に置き換え、表紙の直後に `${mgmtPages}` を挿入する。置き換え後のページ列:
```js
      <div class="report">
        <section class="rpage cover"><div class="eyebrow">STORE SALES SIMULATOR</div><h1>${esc(state.store.name || '店舗')}<br>売上診断と戦略設計</h1>
          <p>${esc(state.store.fiscalLabel)}　／　${period}年で見た場合　／　シナリオ：${esc(sc.name)}</p><p class="small">作成日 ${today}</p></section>
        ${mgmtPages}
        <section class="rpage"><h2>${sec()}. 間口カテゴリの現状（${period}年で見た場合）</h2>${D.kpis(st)}${D.table(st)}</section>
        <section class="rpage"><h2>${sec()}. 間口の診断（ポートフォリオ・効きどころ）</h2><h3>間口ポートフォリオ</h3>${D.quadrantSvg(pf)}<h3>効きどころ</h3>${D.leverageBlock(lv)}</section>
        <section class="rpage"><h2>${n}. 間口の診断（つづき：弱点・打ち時・コメント）</h2><h3>弱点候補</h3>${D.weaknessBlock(wk)}<h3>購入までの期間</h3>${D.timingBlock(tm)}<h3>コメント</h3><ul class="cm">${cm.map(c => `<li>${esc(c)}</li>`).join('')}</ul></section>
        <section class="rpage"><h2>${sec()}. 目標とギャップ</h2>${rq ? '<h3>必要利益からの逆算</h3>' + P.requiredTable(rq) : ''}<h3>間口の目標と逆算</h3>${P.reverseTable(rv)}</section>
        <section class="rpage"><h2>${sec()}. 戦略（${esc(sc.name)}）</h2><p>この配分での売上 ${yen(now.revenue)}（目標到達率 ${reach == null ? '—' : fmt1(reach) + '%'}）</p>
          <table class="ltable"><tr><th>間口カテゴリ</th>${P.LEVERS.map(L => `<th>${L.label}</th>`).join('')}</tr>${leverRows}</table>
          <h3>打ち手</h3>${sc.tactics.length ? `<table class="ltable"><tr><th>レバー</th><th>打ち手</th><th>担当</th><th>期限</th></tr>${sc.tactics.map(t => `<tr><td>${leverName(t.lever)}</td><td>${tacticText(t)}</td><td>${esc(t.owner)}</td><td>${esc(t.due)}</td></tr>`).join('')}</table>` : '<p class="note-p">打ち手は未選択です。</p>'}
          ${sc.memo ? `<p>${esc(sc.memo)}</p>` : ''}<h3>シナリオ比較</h3>${P.comparison(state, period)}</section>
        <section class="rpage"><h2>${sec()}. 前提と計算式</h2><ul class="cm">
          <li>経営数値は年次（直近の決算期）です。粗利率＝（総売上−仕入原価）÷総売上、営業利益＝粗利−（人件費＋家賃＋広告宣伝費＋その他経費）、損益分岐点売上＝固定費÷粗利率、安全余裕率＝（総売上−損益分岐点）÷総売上。</li>
          <li>必要売上＝（固定費＋必要営業利益）÷粗利率。間口で稼ぐべき売上＝必要売上−既存客の見込み売上。</li>
          <li>間口＝新規のお客様が最初に買う商品のくくりです。新規獲得人数は1年分を1つの集団として扱い、その集団が1年／2年／3年で生む売上を「期間累計売上」と呼びます。</li>
          <li>顧客あたりLTV（期間）＝間口単価＋同日追加率×同日追加単価＋後日追加率（期間）×後日追加単価（期間）。期間累計売上＝新規獲得人数×LTV。</li>
          <li>費用比率・粗利率の比較は前期または目安値がある場合のみ行います。業界の数字は含んでいません。</li>
          <li>ポートフォリオの境界は店内の中央値（相対比較）です。新規獲得人数が10人未満のカテゴリは判定保留です。</li>
          <li>数字の出所：手入力または貼り付け（最終更新 ${esc((state.meta.updatedAt || '').slice(0, 10))}）。すべて試算であり、実数値を入れるほど精度が上がります。</li></ul></section>
      </div>`;
```
(c) ツールバーの文言を置き換え:
```js
      <div class="report-tools no-print"><button type="button" class="sbtn primary" data-action="print">印刷／PDF保存</button><span class="note-p">A4縦・${h.available ? '9' : '7'}ページ構成（内容量により前後します）。印刷ダイアログで「PDFに保存」を選べます。内容は①〜④の最新状態です。</span></div>
```

- [ ] **Step 2: 構文とテスト**

Run: `node --check js/ui-report.js && node tests/run.js`
Expected: 構文OK、`78 passed, 0 failed`

- [ ] **Step 3: ブラウザで手動確認（コントローラーが実施）**

| 確認 | 期待 |
|---|---|
| ⑤（サンプル） | 9ページ。1. 経営数値サマリー／2. 経営の健康度／3. 間口カテゴリの現状／4. 間口の診断×2／5. 目標とギャップ（必要利益の表あり）／6. 戦略／7. 前提 |
| 印刷プレビュー（A4） | 各 `.rpage` の高さが A4 本文（約1,017px）以内。滝図が1ページに収まる |
| 「空で始める」→⑤ | 経営の2ページが無く、番号は1から |

- [ ] **Step 4: コミット**

```bash
git add js/ui-report.js
git commit -m "feat(v2.1): ⑤レポートに経営数値サマリーと経営の健康度"
```

---

### Task 9: README・手動チェックリストの更新

**Files:**
- Modify: `README.md`
- Modify: `tests/manual-checklist.md`

- [ ] **Step 1: README の「使い方」を5ステップに書き換え**

```markdown
## 使い方
1. **① 経営数値** — 店全体の年次の数字（総売上・客数・新規・費用の構造・カテゴリ別の売上と粗利率・集客経路など）を入れます。すべて任意で、揃うほど診断が濃くなります。収集シートの「経営数値」は2列貼り付けで取り込めます。
2. **② 間口カテゴリ** — 間口カテゴリごとに「間口単価・新規獲得人数・後日追加（1/2/3年）」を入れます。CRMやExcelの表は「貼り付け」から取り込めます。
3. **③ 診断** — 経営の健康度（収益構造・費用比率・顧客構成・粗利貢献・①②の整合・効きどころ）と、間口の診断（4象限・効きどころ・弱点・打ち時）が自動で出ます。
4. **④ 目標と戦略** — 必要営業利益から必要売上を逆算して間口の目標に反映できます。シナリオ（最大3本）でレバーを配分し、打ち手を選びます。
5. **⑤ レポート** — A4・9ページ（経営数値がない場合は7ページ）に整形。「印刷／PDF保存」でPDFにできます。
```
「開発」節の設計書の行に追記:
```markdown
- 設計書（v2.1 経営数値）: `docs/superpowers/specs/2026-09-23-simulator-v2-1-management-design.md`
```

- [ ] **Step 2: manual-checklist.md を更新**

先頭の「起動・保存」の後に節を追加し、既存の「① 現状入力」→「② 間口カテゴリ」、「② 診断」→「③ 診断」、「③ 目標と戦略」→「④ 目標と戦略」、「④ レポート」→「⑤ レポート」に番号を振り直す。追加節:
```markdown
## ① 経営数値
- [ ] サンプルで自動値が出る（既存客売上 ¥47,100,000／客単価 ¥68,571／リピート率 44.4%／粗利率 50%／営業利益 ¥4,800,000／損益分岐点 ¥38,400,000／安全余裕率 20%／在庫回転 3ヶ月）
- [ ] 新規客売上 > 総売上 で黄色の注記、入力中にフォーカスが外れない
- [ ] 「②の間口カテゴリ名を取り込む」で重複しない
- [ ] 前期の欄を追加→前期の自動値が出る→③が「前期との比較」
- [ ] 2列貼り付け（今期・前期）→プレビュー→取り込み
- [ ] ②の原価率に「経営数値から自動」タグ、仕入原価を変えると追随
- [ ] v2 の書き出しJSON（mgmtなし）を読み込むと①が空欄で他は復元
```
「③ 診断」に追加:
```markdown
- [ ] 経営の健康度9ブロック（KPI・滝図・費用比率・顧客構成・商品粗利・集客と買替・整合チェック・効きどころ・コメント）
- [ ] 整合チェック：①新規客数を変えると注記が出る／消える
- [ ] 経営数値が空なら案内文1行のみ
```
「④ 目標と戦略」に追加:
```markdown
- [ ] 必要営業利益 6,000,000 → 必要売上 ¥50,400,000・間口で稼ぐべき ¥3,300,000。「反映」で期間1年・目標 3,300,000
```
「⑤ レポート」の行を「9ページ（経営数値なしは7ページ）」に直す。

- [ ] **Step 3: 全テスト**

Run: `node tests/run.js`
Expected: `78 passed, 0 failed`

- [ ] **Step 4: コミット**

```bash
git add README.md tests/manual-checklist.md
git commit -m "docs(v2.1): README と手動チェックリストを5ステップに更新"
```

**push は辻さんの承認後**（GitHub Pages が自動更新される）。

---

## 自己レビュー結果（計画作成時）

- **仕様カバー**: §2 データ構造 → Task 1／§3 計算8項目 → Task 2（固定費の上書きだけ不採用＝Global Constraints に明記）／§4-1 ブロック7種 → Task 5／§4-2 2列貼り付け → Task 4・5／§4-3 検証 → Task 3・5／§5 健康度8ブロック＋目安値5項目 → Task 3・5・6／§6 必要利益 → Task 2・7／§7 レポート2ページ＋必要利益の表＋9ページ文言 → Task 8／§8 5ステップ・panel-5・README → Task 5・9／§9 収集シートは別成果物（コントローラーが作成）／§10 テスト → Task 1〜4 自動＋Task 5〜8 手動。
- **型の整合**: `Sim.calc.mgmt()` の戻り値フィールド名（`existingRevenue, aov, newShare, repeatRate, visitFrequency, grossMarginPct, laborPct…, fixedCosts, operatingProfit, opMarginPct, breakEven, safetyMargin, inventoryTurnMonths, products[].share/contribution/contributionShare, funnel.visitRate/dealRate, replacement[].expectedBuyers, channels`）を Task 5（outputs）・6（parts）・8（report）で同名で参照。`mgmtHealth` の `ratios[].{value,prev,bench,diffPrev,diffBench}` を Task 6 `costBars` が参照。`requiredRevenue` の `{required,current,gap,existingForecast,newTarget,grossMarginPct,fixedCosts}` を Task 7 `requiredTable` が参照。
- **Review Focus 5件**: 1→Task 3 `mgmtChecks`、2→Task 2「部分入力」＋Task 3 available、3→Task 1「v2 データ」、4→Task 2「粗利率0以下」、5→Task 4 `parseKeyValues`。
- **Task 1〜4 のコードは計画作成時に現行コードへ適用して Node で実行し、78件すべて通ることを確認済み。**
