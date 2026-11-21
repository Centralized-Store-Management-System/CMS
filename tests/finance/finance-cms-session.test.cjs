const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBridge(token) {
  let configured = null;
  let clearCalls = 0;
  const window = {
    sessionStorage: { getItem(key) { assert.equal(key, 'amz.tok'); return token; } },
    FinanceAuth: {
      configure(options) { configured = options; },
      clear() { clearCalls++; }
    }
  };
  vm.runInNewContext(fs.readFileSync('modules/finance/js/finance-cms-session.js', 'utf8'), { window, console });
  return { window, configured, get clearCalls() { return clearCalls; } };
}

test('Finance bridge injects the verified CMS session token provider', () => {
  const ctx = loadBridge('cms-session-example');
  assert.equal(typeof ctx.configured.getSessionToken, 'function');
  assert.equal(ctx.configured.getSessionToken(), 'cms-session-example');
  assert.equal(ctx.window.FinanceCmsSession.available(), true);
});

test('Finance bridge reports unavailable when CMS session is absent', () => {
  const ctx = loadBridge('');
  assert.equal(ctx.window.FinanceCmsSession.available(), false);
  assert.equal(ctx.configured.getSessionToken(), '');
});

test('Finance bridge clears only Finance auth cache', () => {
  const ctx = loadBridge('cms-session-example');
  ctx.window.FinanceCmsSession.clear();
  assert.equal(ctx.clearCalls, 1);
});
