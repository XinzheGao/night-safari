/* Browser-core tests inject the same declared CSS/JS with a storage/runtime stub.
   They verify page behavior, not Safari extension packaging or first paint timing. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = path.resolve(__dirname, '..');
const preload = fs.readFileSync(path.join(base, 'extension/preload.css'), 'utf8');
const colors = fs.readFileSync(path.join(base, 'extension/colors.js'), 'utf8');
const content = fs.readFileSync(path.join(base, 'extension/content.js'), 'utf8');
const nativeTheme = fs.readFileSync(path.join(base, 'extension/native-theme.js'), 'utf8');
const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(base, 'demo', name === '/' ? 'index.html' : name);
  if (!file.startsWith(path.join(base, 'demo') + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'application/javascript' : 'text/html'); res.end(fs.readFileSync(file)); }
  catch { res.writeHead(404).end(); }
});
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browserType = process.env.ENGINE === 'webkit' ? webkit : chromium;
  const browser = await browserType.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await context.addInitScript(({ preload, colors, nativeTheme, content }) => {
    const data = { enabled: true, sites: {} }, listeners = [];
    globalThis.browser = {
      storage: { local: { get: async () => ({ ...data }), set: async change => {
        const changes = {};
        for (const key of Object.keys(change)) { changes[key] = { newValue: change[key] }; data[key] = change[key]; }
        listeners.forEach(fn => fn(changes, 'local'));
      } }, onChanged: { addListener: fn => listeners.push(fn) } },
      runtime: { onMessage: { addListener: () => {} } }
    };
    function install() {
      if (!document.documentElement) { setTimeout(install, 0); return; }
      const style = document.createElement('style'); style.textContent = preload;
      document.documentElement.append(style);
      // Test-only eval. The extension itself never uses eval.
      (0, eval)(colors); (0, eval)(nativeTheme); (0, eval)(content);
    }
    install();
  }, { preload, colors, nativeTheme, content });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}`;
  const state = expected => page.waitForFunction(value => document.documentElement.getAttribute('data-night-state') === value, expected);
  const bg = selector => page.$eval(selector, el => getComputedStyle(el).backgroundColor);
  try {
    await page.goto(`${url}/native-auto.html`); await state('native');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'dark');
    assert.equal(await page.$eval('#night-engine', el => el.textContent), '');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'off' } })); await state('off');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'light');
    await page.evaluate(() => browser.storage.local.set({ sites: {} }));
    await state('native');
    console.log('PASS native auto activation, empty engine, reversible opt-out');
    await page.goto(`${url}/?case=light`); await state('converted');
    assert.equal(await bg('body'), 'rgb(13, 17, 23)');
    assert.equal(await page.$eval('#name', el => getComputedStyle(el).color), 'rgb(230, 237, 243)');
    for (const media of ['#photo', '#canvas', '#logo']) {
      assert.equal(await page.$eval(media, el => getComputedStyle(el).filter), 'none');
      assert.equal(await page.$eval(media, el => el.hasAttribute('data-night-node')), false);
    }
    await page.click('#add');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#cards .card')).backgroundColor === 'rgb(33, 38, 45)');
    await page.click('#toggle'); await state('native');
    assert.equal(await page.$eval('#night-engine', el => el.textContent), '');
    assert.equal(await page.locator('[data-night-node]').count(), 0);
    await page.click('#toggle'); await state('converted');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'off' } })); await state('off');
    assert.equal(await bg('body'), 'rgb(255, 255, 255)');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'native' } })); await state('native');
    assert.equal(await bg('body'), 'rgb(255, 255, 255)');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'force' } })); await state('converted');
    await page.click('#toggle'); await page.waitForTimeout(350);
    assert.equal(await page.$eval('html', el => el.dataset.nightState), 'converted');
    console.log('PASS light page, forms, media, dynamic DOM, native toggle, website policies');
    for (const [scenario, expected] of [['native','native'], ['delayed','native'], ['mixed','converted'], ['transparent','converted'], ['large','converted']]) {
      await page.goto(`${url}/?case=${scenario}`); await state(expected);
      console.log(`PASS ${scenario}: ${expected}`);
    }
    await page.goto(`${url}/?case=light`); await state('converted');
    const count = await page.locator('[data-night-node]').count();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('[data-night-node]').count(), count, 'no observer feedback loop');
    fs.mkdirSync(path.join(base, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(base, 'test-results/light-converted.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS stable observer, no page errors');
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
