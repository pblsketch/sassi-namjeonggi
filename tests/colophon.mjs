// 필사기 화면만 빠르게 확인(결과 화면 + 이름 도장 + 이미지 저장)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const OUT = new URL('./shots/colophon/', import.meta.url); fs.mkdirSync(fileURLToPath(OUT), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 860 }]]) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html');
  await page.evaluate(() => {
    const done = {}; STORY.forEach((c) => c.steps.forEach((s) => (done[s.id] = true)));
    const chDone = {}; STORY.forEach((c) => (chDone[c.id] = true));
    const met = {}; Object.keys(PEOPLE).forEach((k) => (met[k] = true));
    localStorage.setItem('sassi-jiwojin-v1', JSON.stringify({ v: 1, mode: 'first', sound: false, music: false, done, chDone, met, tokens: {}, aliases: { 'sassi|사씨': 1 }, cases: { c_song: { done: 1 } }, evidence: {}, stamps: {}, reflect: {}, stats: { names: [8, 10], case: [3, 5], map: [1, 2] }, wrong: [], helped: 1, startedAt: Date.now() - 41 * 60000, finishedAt: 0, seenFiction: {} }));
  });
  await page.goto('http://127.0.0.1:8765/index.html?result=1');
  await page.locator('.name-input').fill('2-3 12 김지은');
  await page.locator('button', { hasText: '이름 도장 찍기' }).click();
  await page.waitForTimeout(700);
  await page.locator('.colophon').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL(label + '_colophon.png', OUT)) });
  const dl = page.waitForEvent('download');
  await page.locator('button', { hasText: '필사기 이미지로 저장' }).click();
  const d = await dl; await d.saveAs(fileURLToPath(new URL(label + '_saved.png', OUT)));
  console.log(label, 'download', d.suggestedFilename(), 'errors', errs.length, errs.join(' | '));
  await ctx.close();
}
await browser.close();
