// 휴대폰 화면에서 글자 크기와 영역 비율을 잰다
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const tag = process.argv[2] || 'before';
const OUT = new URL('./shots/measure/', import.meta.url); fs.mkdirSync(fileURLToPath(OUT), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, vp] of [['iphone', { width: 390, height: 844 }], ['galaxy', { width: 360, height: 780 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.evaluate(() => { const done = { f0: 1 }; localStorage.setItem('sassi-jiwojin-v1', JSON.stringify({ v: 1, mode: 'first', sound: false, music: false, done, chDone: {}, met: {}, tokens: {}, aliases: {}, cases: {}, evidence: {}, stamps: {}, reflect: {}, stats: {}, wrong: [], helped: 0, seenFiction: { shop: 1, text: 1, art: 1 } })); });
  await page.goto('http://127.0.0.1:8765/index.html?ch=ch0');
  await page.locator('button', { hasText: '▶' }).first().click();
  await page.waitForSelector('.leaf');
  for (let i = 0; i < 3; i++) await page.locator('button', { hasText: '다음 줄' }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const px = (el, p) => el ? parseFloat(getComputedStyle(el)[p]) : null;
    const r = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
    const leaf = document.querySelector('.leaf'), para = document.querySelector('.leaf .para');
    return {
      vh: innerHeight, body: px(document.body, 'fontSize'), leafFont: px(leaf, 'fontSize'), leafLine: Math.round(px(para, 'lineHeight')),
      topbar: r('.topbar'), tray: r('.tray'), scene: r('.scene'), personChip: r('.tray .person'), btn: r('.tray .btn'),
      contentArea: innerHeight - r('.topbar') - r('.tray'),
      charsPerLine: Math.round(leaf.clientWidth / px(leaf, 'fontSize')),
    };
  });
  console.log(tag, name, JSON.stringify(m));
  await page.screenshot({ path: fileURLToPath(new URL(`${tag}_${name}_page.png`, OUT)) });
  // 사건 복원 화면
  await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('sassi-jiwojin-v1')); ['f0','p0a','p0b','v0','p1a'].forEach((k) => st.done[k] = 1); localStorage.setItem('sassi-jiwojin-v1', JSON.stringify(st)); });
  await page.goto('http://127.0.0.1:8765/index.html?ch=ch1');
  await page.locator('button', { hasText: '▶' }).first().click();
  await page.waitForSelector('.leaf.restore');
  await page.screenshot({ path: fileURLToPath(new URL(`${tag}_${name}_case.png`, OUT)) });
  await ctx.close();
}
await browser.close();
