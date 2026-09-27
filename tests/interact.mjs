// 활동을 선생님용 버튼 없이 직접 풀어 보는 테스트(틀린 답 → 힌트 단계 → 정답).
//   node interact.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const OUT = new URL('./shots/interact/', import.meta.url);
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
let n = 0;
const shot = async (name) => { n++; await page.screenshot({ path: fileURLToPath(new URL(String(n).padStart(2, '0') + '_' + name + '.png', OUT)) }); };
const btn = (label) => page.locator('button', { hasText: label }).filter({ visible: true }).first();
const log = (...a) => console.log(...a);

// 1장 사건(정자의 노래)부터 시작하도록 저장 상태를 만든다
async function startAt(chId, doneIds) {
  await page.goto(BASE);
  await page.evaluate(({ doneIds }) => {
    localStorage.clear();
    const st = { v: 1, mode: 'first', font: 1, sound: false, music: false, teacher: false, name: '', seenFiction: { shop: true, text: true }, done: {}, chDone: {}, tokens: {}, aliases: {}, met: {}, cases: {}, evidence: {}, stamps: {}, reflect: {}, stats: {}, wrong: [], helped: 0, startedAt: Date.now(), finishedAt: 0 };
    for (const id of doneIds) st.done[id] = true;
    for (const id of ['yusosa', 'yeonsu', 'dubuin', 'sassi', 'nun', 'gyo', 'jangju', 'eomsung']) st.met[id] = true;
    localStorage.setItem('sassi-jiwojin-v1', JSON.stringify(st));
  }, { doneIds });
  await page.goto(BASE + '?ch=' + chId);
  await btn('▶').click();
}

// ── 사건 복원 ──
await startAt('ch1', ['f0', 'p0a', 'p0b', 'v0', 'p1a']);
await page.waitForSelector('.leaf.restore');
const spots = page.locator('.spot');
for (let i = 0; i < await spots.count(); i++) { await spots.nth(i).click(); await page.waitForSelector('.sheet'); if (i === 0) await shot('case_spot_sheet'); await btn('닫기').click(); }
await shot('case_words');
const words = await page.locator('.tray .word').allTextContents();
log('words', words.join(' | '));
// 틀리게 채우기: 사씨↔교씨 바꾸고 '매를 들자'
const blanks = page.locator('.blank');
const fill = async (i, w) => { await blanks.nth(i).click(); await page.locator('.tray .word', { hasText: w }).first().click(); };
await fill(0, '교씨'); await fill(1, '사씨'); await fill(2, '매를 들자');
await btn('맞추어 보기').click(); await page.waitForTimeout(300);
log('try1:', (await page.locator('.feedback').first().textContent()).trim());
await btn('맞추어 보기').click(); await page.waitForTimeout(300);
log('try2 wrong-marked blanks:', await page.locator('.blank.wrong').count());
await btn('맞추어 보기').click(); await page.waitForTimeout(300);
log('try3 glowing sources:', await page.locator('.spot.glow, .clue.glow').count());
await shot('case_hint3');
// 바로잡기(채운 칸을 누르면 비워지고 선택됨)
await blanks.nth(0).click(); await page.locator('.tray .word', { hasText: '사씨' }).first().click();
await blanks.nth(1).click(); await page.locator('.tray .word', { hasText: '교씨' }).first().click();
await blanks.nth(2).click(); await page.locator('.tray .word', { hasText: '타이르자' }).first().click();
await btn('맞추어 보기').click(); await page.waitForTimeout(1200);
log('solved:', await page.locator('.blank.done').count(), '/ explain:', await page.locator('.explain').count());
await shot('case_solved');

// ── 나누어 담기 ──
await startAt('ch4', ['n4', 'p4a', 'p4b']);
await page.waitForSelector('.bins');
const answer = await page.evaluate(() => STORY.find((c) => c.id === 'ch4').steps.find((s) => s.id === 's4').cards);
const slips = page.locator('.pool .slip');
while (await slips.count()) {
  const t = (await slips.first().textContent()).trim();
  const c = answer.find((x) => x.t === t);
  await slips.first().click();
  await page.locator('.bin', { hasText: c.bin === 'dream' ? '꿈속' : '깨어난 뒤' }).click();
}
await shot('sort_filled');
await btn('맞추어 보기').click(); await page.waitForTimeout(1200);
log('sort ok:', await page.locator('.slip.ok').count());

// ── 흩어진 낱장 ──
await startAt('ch4', ['n4', 'p4a', 'p4b', 's4', 'p4c']);
await page.waitForSelector('.slots');
const pool = page.locator('.pool .slip');
while (await pool.count()) await pool.first().click(); // 뒤섞인 순서 그대로 넣기(대부분 틀림)
await btn('맞추어 보기').click(); await page.waitForTimeout(300);
log('route try1:', (await page.locator('.feedback').first().textContent()).trim());
await btn('맞추어 보기').click().catch(() => {});
await page.waitForTimeout(300);
log('route after try2 locked:', await page.locator('.slot.locked').count(), 'left in pool:', await pool.count());
await shot('route_locked');
const order = await page.evaluate(() => STORY.find((c) => c.id === 'ch4').steps.find((s) => s.id === 'rt4').cards);
const want = await page.evaluate(() => STORY.find((c) => c.id === 'ch4').steps.find((s) => s.id === 'rt4').order);
// 남은 낱장을 정답 순서대로 빈자리에 넣기
for (const id of want) {
  const t = order.find((c) => c.id === id).t;
  const inPool = page.locator('.pool .slip', { hasText: t });
  if (await inPool.count()) await inPool.first().click();
}
await btn('맞추어 보기').click(); await page.waitForTimeout(1200);
log('route ok:', await page.locator('.slot .slip.ok').count());
await shot('route_done');

console.log('SHOTS', n, 'ERRORS', errors.length); for (const e of errors) console.log(' -', e);
await browser.close();
