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
const engine = fs.readFileSync(path.join(base, 'extension/vendor/darkreader.js'), 'utf8');
const content = fs.readFileSync(path.join(base, 'extension/content.js'), 'utf8');
const nativeFallback = fs.readFileSync(path.join(base, 'extension/native-fallback.js'), 'utf8');
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
  const context = await browser.newContext({ colorScheme: "dark", viewport: { width: 1200, height: 900 } });
  await context.addInitScript(({ preload, colors, nativeTheme, nativeFallback, engine, content }) => {
    const params = new URLSearchParams(location.search);
    const data = { enabled: !params.has('disabled'), sites: params.has('site-off') ? { [location.hostname]: 'off' } : {} }, listeners = [];
    globalThis.sawPending = false;
    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'data-night-state' &&
        (record.oldValue === 'pending' || record.target.getAttribute('data-night-state') === 'pending')))
        globalThis.sawPending = true;
    }).observe(document, { subtree: true, attributes: true, attributeOldValue: true });
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
      (0, eval)(engine); (0, eval)(colors); (0, eval)(nativeTheme); (0, eval)(nativeFallback); (0, eval)(content);
    }
    install();
  }, { preload, colors, nativeTheme, nativeFallback, engine, content });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const url = `http://127.0.0.1:${server.address().port}`;
  const state = expected => page.waitForFunction(value => document.documentElement.getAttribute('data-night-state') === value, expected);
  const bg = selector => page.$eval(selector, el => getComputedStyle(el).backgroundColor);
  try {
    for (const setting of ['disabled', 'site-off']) {
      await page.goto(`${url}/?case=light&${setting}`); await state('off');
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => sawPending), false, 'saved off policy must never show a pending shield');
      assert.equal(await page.$eval('html', el => getComputedStyle(el, '::before').content), 'none');
      assert.equal(await page.evaluate(() => DarkReader.isEnabled()), false);
    }
    console.log('PASS disabled global and website policies do not show the loading shield');
    await page.goto(`${url}/native-auto.html`); await state('native');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'dark');
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), false);
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'off' } })); await state('off');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'light');
    await page.evaluate(() => browser.storage.local.set({ sites: {} }));
    await state('native');
    await page.emulateMedia({ colorScheme: 'light' }); await state('off');
    assert.equal(await page.$eval('html', el => el.dataset.theme), 'light');
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), false);
    await page.emulateMedia({ colorScheme: 'dark' }); await state('native');
    console.log('PASS native auto activation and browser preference restoration');
    await page.evaluate(() => {
      const header = document.createElement('header'); header.id = 'partial-header';
      header.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:60px;background:white;color:#222;z-index:50;transition:background-color 0.4s,color 0.4s';
      header.innerHTML = '<a style="color:#1756a9">Navigation</a><svg width="20" height="20"><rect width="20" height="20" fill="white"/></svg>';
      document.body.append(header);
    });
    await page.waitForFunction(() => document.querySelector('#partial-header').hasAttribute('data-night-native-bg'));
    assert.equal(await bg('#partial-header'), 'rgb(22, 27, 34)');
    await page.evaluate(() => {
      globalThis.nativeSamples = [];
      const header = document.querySelector('#partial-header');
      let frames = 0;
      function sample() {
        nativeSamples.push(getComputedStyle(header).backgroundColor);
        if (frames % 12 === 0) header.firstElementChild.textContent = `Notification ${frames}`;
        if (++frames < 90) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await page.waitForFunction(() => nativeSamples.length === 90);
    assert.ok(await page.evaluate(() => nativeSamples.every(c => c === 'rgb(22, 27, 34)')), 'dynamic notifications must never expose a white or transitional frame');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '.unrelated-update { opacity: 1; }'; document.head.append(style);
    });
    await page.waitForTimeout(350);
    assert.equal(await bg('#partial-header'), 'rgb(22, 27, 34)', 'theme rechecks keep fallback stable');

    assert.ok(await page.$eval('#partial-header a', el => NightColors.contrast(NightColors.parse(getComputedStyle(el).color), [22,27,34,1]) >= 4.5));
    assert.equal(await page.locator('#partial-header svg[data-night-native-fg]').count(), 0);
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), false);
    await page.evaluate(() => document.querySelector('#partial-header').style.backgroundColor = '#202124');
    await page.waitForFunction(() => !document.querySelector('#partial-header').hasAttribute('data-night-native-bg'));
    assert.equal(await bg('#partial-header'), 'rgb(32, 33, 36)');
    await page.evaluate(() => document.querySelector('#partial-header').style.backgroundColor = 'white');
    await page.waitForFunction(() => document.querySelector('#partial-header').hasAttribute('data-night-native-bg'));
    await page.emulateMedia({ colorScheme: 'light' }); await state('off');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#partial-header')).backgroundColor === 'rgb(255, 255, 255)');
    assert.equal(await bg('#partial-header'), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('[data-night-native-fg]').count(), 0);
    await page.emulateMedia({ colorScheme: 'dark' }); await state('native');
    console.log('PASS partial native surfaces, contrast, media, dynamic updates and restoration');

    await page.goto(`${url}/?case=light`); await state('converted');
    assert.equal(await bg('body'), 'rgb(13, 17, 23)');
    assert.ok(await page.$eval('#name', el => NightColors.contrast(NightColors.parse(getComputedStyle(el).color), NightColors.parse(getComputedStyle(el).backgroundColor)) >= 4.5));
    for (const media of ['#photo', '#canvas', '#logo']) {
      assert.equal(await page.$eval(media, el => getComputedStyle(el).filter), 'none');
      assert.equal(await page.$eval(media, el => el.hasAttribute('data-night-node')), false);
    }
    await page.click('#add');
    await page.waitForFunction(() => NightColors.luminance(NightColors.parse(getComputedStyle(document.querySelector('#cards .card')).backgroundColor)) < .12);
    await page.click('#toggle'); await state('native');
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), false);
    assert.equal(await page.locator('[data-night-node]').count(), 0);
    await page.click('#toggle'); await state('converted');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'off' } })); await state('off');
    assert.equal(await bg('body'), 'rgb(255, 255, 255)');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'native' } })); await state('native');
    assert.equal(await bg('body'), 'rgb(255, 255, 255)');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'force' } })); await state('converted');
    await page.evaluate(() => {
      globalThis.forceEnables = 0;
      const enable = DarkReader.enable;
      DarkReader.enable = (...args) => { forceEnables++; return enable(...args); };
    });
    await page.click('#toggle'); await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => forceEnables), 0, 'force mode must keep the engine running across root theme changes');
    assert.equal(await page.$eval('html', el => el.dataset.nightState), 'converted');
    console.log('PASS light page, forms, media, dynamic DOM, native toggle, website policies');
    for (const [scenario, expected] of [['native','native'], ['delayed','native'], ['mixed','converted'], ['transparent','converted'], ['large','converted']]) {
      await page.goto(`${url}/?case=${scenario}`); await state(expected);
      console.log(`PASS ${scenario}: ${expected}`);
    }
    await page.goto(`${url}/?case=light`); await state('converted');
    await page.evaluate(() => {
      globalThis.engineEnables = 0;
      const enable = DarkReader.enable;
      DarkReader.enable = (...args) => { engineEnables++; return enable(...args); };
    });
    await page.evaluate(() => {
      const button = document.querySelector('#add');
      button.classList.add('busy');
      button.style.opacity = '.9';
      for (let i = 0; i < 20; i++) button.click();
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => [...document.querySelectorAll('#cards .card')].every(el =>
      NightColors.luminance(NightColors.parse(getComputedStyle(el).backgroundColor)) < .12));
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => engineEnables), 0, 'content mutations and resize must not restart the engine');
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), true);
    fs.mkdirSync(path.join(base, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(base, 'test-results/light-converted.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await page.emulateMedia({ colorScheme: 'light' }); await state('off');
    assert.equal(await bg('body'), 'rgb(255, 255, 255)');
    await page.evaluate(() => browser.storage.local.set({ sites: { '127.0.0.1': 'force' } })); await state('converted');
    await page.evaluate(() => browser.storage.local.set({ sites: {} })); await state('off');
    await page.goto(`${url}/?case=native`); await state('off');
    assert.equal(await page.$eval('html', el => el.dataset.darkTheme), 'dark', 'preserve user native dark in light preference');
    await page.evaluate(() => browser.storage.local.set({ enabled: false })); await state('off');
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), false);
    await page.evaluate(() => browser.storage.local.set({ enabled: true, sites: { '127.0.0.1': 'force' } })); await state('converted');
    assert.equal(await page.evaluate(() => DarkReader.isEnabled()), true);
    assert.deepEqual(errors, []);
    console.log('PASS light preference, force override, preserved user theme, no page errors');
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
