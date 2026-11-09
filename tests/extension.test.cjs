const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');

let context, profile, popup, extensionId;
const extension = path.resolve(__dirname, '../extension');
const longCode = 'const result = computeAdvantage(rewards, values, nextValues, discount, lambda); '.repeat(24);
const content = `<h2>让对话适应你的屏幕</h2><p>${'宽屏阅读为代码、公式和长文提供更多空间，拖动滑块即可实时调整。'.repeat(14)}</p><ul><li>公式、列表保留原来的排版与缩进</li><li>代码保留横向滚动</li></ul><div class="code-block"><pre>${longCode}</pre></div><div><table><tr><th>参数</th><th>解释</th></tr><tr><td>γ</td><td>环境折扣因子</td></tr><tr><td>λ</td><td>优势估计的偏差与方差权衡</td></tr></table></div>`;
const common = `<style>*{box-sizing:border-box}body{margin:0;background:#fafafa;font:16px/1.8 system-ui;color:#22352e}aside{position:fixed;left:0;top:0;width:240px;height:100vh;background:#edf2ef;padding:28px}main{margin-left:240px;height:100vh;overflow:auto;padding-top:40px}h2{font-size:24px}p{margin-top:12px}pre{white-space:pre;overflow:auto;background:#e9eeeb;padding:20px;border-radius:14px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ccd9d2}form,input-container{display:block;margin:24px auto}input{width:100%;padding:16px;border:1px solid #ccd9d2;border-radius:18px;background:white}.code-block{min-width:0}</style>`;
function chatTranscript(legacy) {
  const message = `<div data-markdown-text-style="assistant-message">${content}</div>`;
  if (legacy) return `<article data-testid="conversation-turn-fixture"><div><div class="max-w-(--thread-content-max-width)">${message}</div></div></article>`;
  return `<div data-thread-user-message-navigation-content class="max-w-(--thread-body-max-width)">${message}</div>`;
}
function fixture(site, { legacy = false, beforeMain = '' } = {}) {
  const body = site === 'chatgpt'
    ? `<main><div class="thread-parent thread-scroll-container" style="--thread-content-max-width:48rem;--thread-body-max-width:var(--thread-content-max-width)">${chatTranscript(legacy)}<div class="max-w-(--thread-body-max-width)"><form data-chatgpt-composer><input placeholder="询问 ChatGPT"></form></div></div><style>[class~="max-w-(--thread-body-max-width)"]{max-width:var(--thread-body-max-width)}[class~="max-w-(--thread-content-max-width)"]{max-width:var(--thread-content-max-width)}[class^="max-w-(--thread-"]{width:100%;margin:auto;padding:0 20px}</style></main>`
    : `<main><chat-window style="display:block;width:100%"><div class="conversation-container"><user-query style="display:block;max-width:708px;margin:auto;width:100%">讲讲宽屏阅读</user-query><model-response><div class="markdown-main-panel">${content}</div></model-response><div class="response-footer">复制 · 重做</div></div><input-container><div class="input-area-container"><input placeholder="问问 Gemini"></div></input-container></chat-window><style>${legacy ? '.conversation-container{width:760px;max-width:760px;margin:auto}' : ''}.markdown-main-panel>*,.response-footer{max-width:708px;margin-left:auto;margin-right:auto}.markdown-main-panel p{max-width:708px}.input-area-container{width:100%;max-width:660px;margin:auto}</style></main>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${site} 布局测试</title>${common}</head><body><aside><strong>${site === 'chatgpt' ? 'ChatGPT' : 'Gemini'}</strong><p>新对话</p><p>对话列表</p></aside>${beforeMain}${body}</body></html>`;
}
const width = async (page, selector) => page.locator(selector).first().evaluate(e => e.getBoundingClientRect().width);
const within = (actual, expected) => assert.ok(Math.abs(actual - expected) < 2, `width ${actual}, expected ${expected}`);
const waitForWidth = (page, selector, expected) => page.waitForFunction(({ selector, expected }) =>
  Math.abs(document.querySelector(selector).getBoundingClientRect().width - expected) < 2, { selector, expected });
const settle = async page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function set(site, patch) {
  await popup.evaluate(async ({ site, patch }) => {
    await chrome.storage.local.set(Object.fromEntries(Object.entries(patch).map(([field, value]) => [`${site}.${field}`, value])));
  }, { site, patch });
}
async function open(site, options) {
  const page = await context.newPage();
  const url = site === 'chatgpt' ? 'https://chatgpt.com/c/fixture' : 'https://gemini.google.com/app/fixture';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: fixture(site, options) }));
  await page.goto(url);
  await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--awr-width'));
  await settle(page);
  return page;
}
before(async () => {
  profile = await mkdtemp(path.join(tmpdir(), 'awr-test-'));
  context = await chromium.launchPersistentContext(profile, { ...(process.env.AWR_BROWSER_PATH ? { executablePath: process.env.AWR_BROWSER_PATH } : { channel: 'chromium' }), headless: true, viewport: { width: 1600, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'], args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  const item = manager.locator('extensions-item').filter({ hasText: '宽屏阅读' });
  await item.waitFor();
  extensionId = await item.getAttribute('id');
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.locator('.site-panel').first().waitFor();
});
after(async () => { await context?.close(); if (profile) await rm(profile, { recursive: true }); });

test('real MV3 extension: width, independent settings, composer, restore and persistence', async () => {
  const chat = await open('chatgpt');
  const gemini = await open('gemini');
  const chatSelector = '[data-markdown-text-style]';
  const gemSelector = '.markdown-main-panel > p';
  const errors = [];
  chat.on('pageerror', error => errors.push(error.message));
  gemini.on('pageerror', error => errors.push(error.message));
  for (const percent of [35, 65, 85, 100]) {
    await set('chatgpt', { width: percent });
    await set('gemini', { width: percent });
    const column = 1360 * percent / 100;
    await waitForWidth(chat, chatSelector, column - 40);
    await waitForWidth(gemini, gemSelector, Math.min(column, 1336));
    for (const page of [chat, gemini]) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('pre').evaluate(e => e.scrollWidth > e.clientWidth), true);
    }
  }
  await set('gemini', { width: 65, composer: true });
  await gemini.waitForFunction(() => document.documentElement.hasAttribute('data-awr-composer'));
  await settle(gemini);
  within(await width(gemini, '.input-area-container'), 884);
  await set('chatgpt', { width: 85, composer: false });
  await settle(chat);
  within(await width(chat, 'form'), 728);
  await set('chatgpt', { composer: true });
  await chat.waitForFunction(() => document.documentElement.hasAttribute('data-awr-composer'));
  await settle(chat);
  within(await width(chat, 'form'), 1116);
  within(await width(gemini, gemSelector), 884);
  await set('gemini', { enabled: false });
  await gemini.waitForFunction(() => !document.documentElement.hasAttribute('data-awr-site'));
  within(await width(gemini, gemSelector), 708);
  await gemini.reload();
  await gemini.waitForFunction(() => window.AWR === undefined);
  within(await width(gemini, gemSelector), 708);
  await set('gemini', { enabled: true });
  await gemini.waitForFunction(() => document.documentElement.hasAttribute('data-awr-site'));
  await settle(gemini);
  within(await width(gemini, gemSelector), 884);
  assert.deepEqual(errors, []);
  await chat.close(); await gemini.close();
});

test('ChatGPT keeps the visible thread wide beside a hidden or narrow main panel', async () => {
  await set('chatgpt', { width: 85, enabled: true });
  const page = await open('chatgpt', { beforeMain: '<main id="inactive-pane" hidden style="position:absolute;width:48px"></main>' });
  const thread = '[data-thread-user-message-navigation-content]';
  const available = '.thread-parent';
  for (const selector of [thread, `${thread} p`]) {
    const padding = selector === thread ? 0 : 40;
    within(await width(page, selector), (await width(page, available)) * .85 - padding);
  }

  await page.evaluate(() => {
    document.getElementById('inactive-pane').hidden = false;
    const current = document.querySelector('.thread-parent').closest('main');
    const replacement = current.cloneNode(true);
    replacement.style.marginRight = '280px';
    current.replaceWith(replacement);
  });
  await settle(page);
  within(await width(page, thread), (await width(page, available)) * .85);
  within(await width(page, `${thread} p`), (await width(page, available)) * .85 - 40);
  await page.close();
});

test('ChatGPT does not squeeze both the message and composer in a compact pane', async () => {
  await set('chatgpt', { enabled: true, width: 35, composer: true });
  const page = await open('chatgpt');
  await set('chatgpt', { enabled: false });
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-awr-site'));
  await page.locator('.thread-scroll-container').evaluate(pane => {
    pane.style.inlineSize = '180px';
    pane.style.marginInline = 'auto';
  });
  const columns = ['[data-markdown-text-style] p', 'form'];
  const native = await Promise.all(columns.map(selector => width(page, selector)));
  assert.deepEqual(native, [140, 140]);
  await set('chatgpt', { enabled: true });
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-awr-site'));
  await settle(page);
  const enabled = await Promise.all(columns.map(selector => width(page, selector)));
  assert.deepEqual(enabled, native, 'Wide Reader must preserve both native widths when there is no room to widen');
  await page.close();
});

test('ChatGPT still widens standalone conversation turns', async () => {
  await set('chatgpt', { width: 85, enabled: true });
  const page = await open('chatgpt', { legacy: true });
  within(await width(page, '[data-markdown-text-style]'), 1116);
  await set('chatgpt', { enabled: false });
  await waitForWidth(page, '[data-markdown-text-style]', 728);
  await page.close();
});

test('SPA replacement, streaming additions, sidebar changes and small viewports', async () => {
  await set('gemini', { width: 85, enabled: true });
  const page = await open('gemini', { legacy: true });
  within(await width(page, '.markdown-main-panel > p'), 1156);
  await page.evaluate(() => {
    const old = document.querySelector('chat-window');
    const replacement = old.cloneNode(true); old.replaceWith(replacement);
    const p = document.createElement('p'); p.textContent = '新生成的回答'; replacement.querySelector('.markdown-main-panel').append(p);
  });
  await settle(page);
  within(await width(page, '.markdown-main-panel > p'), 1156);
  await page.evaluate(() => { document.querySelector('main').style.marginLeft = '60px'; });
  await page.waitForFunction(() => parseFloat(document.documentElement.style.getPropertyValue('--awr-width')) > 1300);
  within(await width(page, '.markdown-main-panel > p'), 1309);
  for (const size of [{ width: 900, height: 700 }, { width: 480, height: 700 }]) {
    await page.setViewportSize(size);
    await settle(page);
    within(await width(page, '.markdown-main-panel > p'), (size.width - 60) * .85);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.close();
});

test('toolbar slider, keyboard access, restore and no added page UI', async () => {
  await set('gemini', { width: 85, enabled: true, composer: false });
  const page = await open('gemini');
  const controls = popup.locator('.site-panel').nth(1);
  await controls.locator('.width-slider').press('Home');
  await popup.waitForFunction(() => document.querySelectorAll('.width-number')[1].value === '35');
  await page.waitForFunction(() => Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--awr-width')) - 476) < 2);
  await controls.getByRole('button', { name: '宽屏 85%' }).click();
  await controls.getByRole('button', { name: '恢复网站原宽度' }).click();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-awr-site'));
  await controls.getByRole('button', { name: '重置设置', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-awr-site'));
  assert.deepEqual(await page.evaluate(() => [...document.body.children].map(e => e.tagName)), ['ASIDE', 'MAIN']);
  assert.equal(await page.locator('#ai-wide-reader').count(), 0);
  await page.close();
});
