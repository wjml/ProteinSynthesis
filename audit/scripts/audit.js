const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..');
const SS_DIR = path.join(OUT, 'screenshots');
const LOG = path.join(OUT, 'logs.json');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

const errors = [];
function logErr(page, msg) { errors.push({ url: page.url(), msg }); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const ss = name => page.screenshot({ path: path.join(SS_DIR, `${name}.png`) });

  page.on('pageerror', e => logErr(page, e.message));
  page.on('console', msg => { if (msg.type() === 'error') logErr(page, msg.text()); });

  const BASE = 'http://localhost:8080';

  try {
    // Home
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    await ss('01-home');

    // Key pages via setVisiblePage directly (faster than clicking sidebar)
    const pages = [
      ['02-mendel-theory', 'mendel-theory'],
      ['03-mendel-lab', 'mendel-lab'],
      ['04-dna', 'dna'],
      ['05-rna', 'rna'],
      ['06-aminoacids', 'aminoacids'],
      ['07-diseases', 'diseases'],
      ['08-quiz', 'quiz'],
      ['09-popgen-lab', 'popgen-lab'],
      ['10-karyotype-lab', 'karyotype-lab'],
      ['11-app-info', 'app-info'],
    ];

    for (const [name, id] of pages) {
      try {
        await page.evaluate((pid) => {
          const btn = document.querySelector(`li#${pid}`);
          if (btn) btn.click();
        }, id);
        await page.waitForTimeout(300);
        await ss(name);
      } catch (e) {
        logErr(page, `Nav ${id}: ${e.message}`);
      }
    }

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    await ss('12-mobile-home');
    const mb = await page.$('.mobile-menu-btn');
    if (mb) { await mb.click(); await page.waitForTimeout(300); await ss('13-mobile-menu'); }

    // Dark mode
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);
    const tt = await page.$('#theme-toggle');
    if (tt) { await tt.click(); await page.waitForTimeout(500); await ss('14-dark-home'); }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await ss('15-dark-reload');
    const persists = await page.evaluate(() => localStorage.getItem('theme') === 'dark');
    logErr(page, `Dark persists: ${persists}`);

  } catch (e) {
    logErr(page, `FATAL: ${e.message}`);
  } finally {
    fs.writeFileSync(LOG, JSON.stringify(errors, null, 2));
    const count = fs.readdirSync(SS_DIR).length;
    console.log(`Done: ${count} screenshots, ${errors.length} errors`);
    await browser.close();
  }
})();