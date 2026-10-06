const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseUsage } = require('../out/usageClient');

test('parses Codex bucket, plan, reset count and actual window lengths', () => {
  const u = parseUsage({ rateLimits: { primary: { usedPercent: 99 } },
    rateLimitsByLimitId: { codex: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1800000000 }, secondary: { usedPercent: 80, windowDurationMins: 10080 } } },
    rateLimitResetCredits: { availableCount: 2, credits: [] }
  }, { email: 'test@example.com', planType: 'plus' });
  assert.equal(u.primary.remainingPercent, 75);
  assert.equal(u.weekly.remainingPercent, 20);
  assert.equal(u.primary.label, '5-hour limit');
  assert.equal(u.weekly.label, 'Weekly limit');
  assert.equal(u.availableResets, 2);
  assert.equal(u.planType, 'plus');
});

test('does not invent reset counts or missing windows', () => {
  const u = parseUsage({ rateLimits: { primary: null, secondary: null }, rateLimitResetCredits: null }, {});
  assert.equal(u.availableResets, undefined);
  assert.equal(u.primary, undefined);
  assert.equal(parseUsage({ rateLimits: {}, rateLimitResetCredits: { availableCount: 0 } }, {}).availableResets, 0);
  assert.throws(() => parseUsage({}, {}), /No Codex limits/);
});

function client(mode) {
  const sent = [];
  let killed = false;
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => { killed = true; };
  child.stdin = new Writable({ write(chunk, encoding, next) {
    const msg = JSON.parse(chunk.toString());
    sent.push(msg);
    next();
    if (!msg.id || mode === 'timeout') return;
    setImmediate(() => {
      let result = {};
      if (msg.id === 2) result = { account: mode === 'loggedOut' ? null : { type: 'chatgpt', planType: 'plus' } };
      if (msg.id === 3) result = { rateLimits: { primary: { usedPercent: 30 } } };
      const response = JSON.stringify(mode === 'rpcError' && msg.id === 3
        ? { id: msg.id, error: { message: 'offline' } } : { id: msg.id, result });
      child.stdout.write('{"method":"notification"}\n' + response.slice(0, 10));
      child.stdout.write(response.slice(10) + '\n');
    });
  }});
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../out/usageClient'), 'utf8'), {
    exports: module.exports, module, require: name => name === 'node:child_process' ? { spawn: () => child } : require(name),
    process: { platform: 'linux', env: {} }, setTimeout, clearTimeout, Buffer
  });
  return { read: module.exports.readCodexUsage, sent, killed: () => killed };
}

test('RPC handshake handles fragmented lines and notifications, then cleans up', async () => {
  const c = client('success');
  const u = await c.read('codex', 1000);
  assert.equal(u.primary.remainingPercent, 70);
  assert.deepEqual(c.sent.map(m => m.method), ['initialize', 'initialized', 'account/read', 'account/rateLimits/read']);
  assert.equal(c.killed(), true);
});

for (const [mode, error] of [['loggedOut', /ChatGPT login/], ['rpcError', /offline/], ['timeout', /timed out/]]) {
  test(`handles ${mode} and cleans up`, async () => {
    const c = client(mode);
    await assert.rejects(c.read('codex', mode === 'timeout' ? 20 : 1000), error);
    assert.equal(c.killed(), true);
  });
}

test('status item and hover include remaining usage, countdown, plan and resets', () => {
  const item = { show() {}, dispose() {} };
  class MarkdownString {
    value = '';
    appendMarkdown(text) { this.value += text; }
  }
  const vscode = {
    window: { createStatusBarItem: () => item },
    StatusBarAlignment: { Right: 1 }, MarkdownString,
    ThemeColor: class { constructor(id) { this.id = id; } },
    workspace: { getConfiguration: () => ({ get: (key, fallback) => fallback }) }
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../out/statusBar'), 'utf8'), {
    exports: module.exports, module, require: name => name === 'vscode' ? vscode : require(name)
  });
  const bar = new module.exports.CodexUsageStatusBar();
  bar.showUsage(parseUsage({ rateLimits: {
    primary: { usedPercent: 25, resetsAt: Math.floor(Date.now() / 1000) + 7200, windowDurationMins: 300 },
    secondary: { usedPercent: 80, windowDurationMins: 10080 }
  }, rateLimitResetCredits: { availableCount: 2 } }, { planType: 'plus' }));
  assert.match(item.text, /Codex 20% left/);
  assert.match(item.tooltip.value, /Resets in 2h 0m/);
  assert.match(item.tooltip.value, /\*\*Plan:\*\* plus/);
  assert.match(item.tooltip.value, /\*\*Available resets:\*\* 2/);
  assert.match(item.tooltip.value, /Remaining \*\*75%\*\*/);
  assert.equal(item.backgroundColor.id, 'statusBarItem.warningBackground');
});
