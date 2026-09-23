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
