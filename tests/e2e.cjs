const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdir, readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const shots = path.resolve(__dirname, '../../shots');
const chrome = process.env.CHROMIUM_PATH || [
  path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);

async function getOrigin(server) {
  const [chunk] = await once(server.stdout, 'data', { signal: AbortSignal.timeout(10000) });
  const origin = chunk.toString().trim();
  assert.match(origin, /^http:\/\/127\.0\.0\.1:\d+$/, 'Preview server must report a local origin');
  return origin;
}

async function run() {
  await mkdir(shots, { recursive: true });
  const server = spawn(process.execPath, [path.resolve(__dirname, '../scripts/serve.mjs')], {
    env: { ...process.env, CATCHMENT_PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  let browser;
  try {
    const origin = await getOrigin(server);
    browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
    const issues = [];
    const watch = (page) => {
      page.on('pageerror', (error) => issues.push(String(error)));
      page.on('console', (message) => { if (message.type() === 'error') issues.push(message.text()); });
      page.on('requestfailed', (request) => issues.push(`${request.url()} ${request.failure().errorText}`));
      page.on('response', (response) => { if (response.status() >= 400) issues.push(`${response.status()} ${response.url()}`); });
    };
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    watch(page);
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(shots, '01-school-demo.png') });
    assert.equal(await page.locator('#runoff').innerText(), '24,024 L');
    assert.equal(await page.locator('#intervals tr').count(), 24);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'lab');

    await page.getByRole('button', { name: 'Courtyard', exact: true }).click();
    const earlyOverflow = await page.locator('#overflow').innerText();
    await page.getByLabel('Rainfall pattern').selectOption('steady');
    assert.notEqual(await page.locator('#overflow').innerText(), earlyOverflow);
    await page.getByRole('button', { name: 'Courtyard', exact: true }).click();
    await page.getByRole('button', { name: 'Storage', exact: true }).click();
    assert.equal(await page.locator('#chart-title').innerText(), 'Garden storage over time');
    assert.match(await page.locator('#chart-subtitle').innerText(), /8,400 L/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(shots, '02-courtyard-storage.png') });

    await page.getByRole('button', { name: 'Load school demo' }).click();
    assert.equal(await page.getByRole('button', { name: 'School', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Discharge', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByLabel('Target', { exact: true }).selectOption('0.9');
    const suggested = Number.parseInt(await page.locator('#suggestion').innerText(), 10);
    await page.getByRole('button', { name: 'Apply area' }).click();
    assert.equal(Number(await page.getByLabel('Garden area').inputValue()), suggested);
    assert.ok(Number.parseFloat(await page.locator('#capture').innerText()) >= 90);
    await page.getByText('View interval data', { exact: true }).click();
    assert.ok(await page.getByRole('table').isVisible());
    await page.locator('#lab').evaluate((lab) => lab.scrollIntoView({ block: 'start' }));
    await page.screenshot({ path: path.join(shots, '03-sizing-and-data.png') });

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), 'catchment-lab-storm.csv');
    const csv = (await readFile(await download.path(), 'utf8')).trim().split(/\r?\n/);
    assert.equal(csv.length, 25);
    assert.match(csv[0], /^minute,rain_mm,baseline_l,overflow_l,stored_l,infiltrated_l,/);
    assert.equal(Number(csv[1].split(',')[6]), suggested);

    await page.getByRole('button', { name: 'Model guide' }).click();
    assert.ok(await page.getByRole('dialog').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open-method');
    const rainfall = page.getByLabel('Total rainfall');
    await rainfall.fill('301');
    assert.match(await page.locator('#validation').innerText(), /last valid scenario/);
    assert.equal(await rainfall.getAttribute('aria-invalid'), 'true');
    await rainfall.fill('0');
    assert.equal(await page.locator('#runoff').innerText(), '0 L');
    assert.equal(await page.getByRole('button', { name: 'Apply area' }).isDisabled(), true);

    const localReferences = await page.locator('a[href], script[src], link[href]').evaluateAll((nodes) => nodes.map((node) => node.href || node.src));
    for (const reference of [...localReferences, `${origin}/assets/rain-garden.webp`]) {
      const url = new URL(reference);
      assert.equal(url.origin, origin);
      if (url.hash) assert.ok(await page.locator(url.hash).count(), `Missing fragment ${url.hash}`);
      else assert.equal((await page.request.get(reference)).status(), 200, reference);
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    watch(mobile);
    await mobile.goto(origin, { waitUntil: 'networkidle' });
    await mobile.getByRole('button', { name: 'Load school demo' }).tap();
    assert.equal(await mobile.locator('#runoff').innerText(), '24,024 L');
    await mobile.getByRole('button', { name: 'Library', exact: true }).tap();
    assert.equal(await mobile.locator('#scenario-name').innerText(), 'LIBRARY');
    await mobile.getByRole('button', { name: 'Storage', exact: true }).tap();
    await mobile.getByText('View interval data', { exact: true }).tap();
    for (const width of [390, 320, 768]) {
      await mobile.setViewportSize({ width, height: 844 });
      assert.ok(await mobile.evaluate((viewport) => document.documentElement.scrollWidth <= viewport, width), `Layout overflows at ${width}px`);
    }

    assert.deepEqual(issues, []);
    console.log(`Chromium ${browser.version()} | desktop 1920×1080 | touch viewport 390×844 | 320px and 768px layout checks`);
    console.log(`School baseline 24,024 L | 90% capture area ${suggested} m² | 24 CSV data rows | zero console, page, or network errors`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
