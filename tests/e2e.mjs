// 처음부터 끝까지 자동으로 플레이해 보는 E2E 테스트.
//   cd tests && npm install && node e2e.mjs [phone|tablet|desktop]
// 게임 폴더를 http://127.0.0.1:8765 에서 서빙하고 있어야 한다(python -m http.server 8765).
// 이미 설치된 크롬을 쓴다(브라우저를 따로 내려받지 않음).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true }, desktop: { width: 1366, height: 860 } };
const which = process.argv[2] || 'phone';
const OUT = new URL('./shots/' + which + '/', import.meta.url);
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const vp = SIZE[which];
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

let n = 0;
const shot = async (name) => { n++; await page.screenshot({ path: fileURLToPath(new URL(String(n).padStart(3, '0') + '_' + name + '.png', OUT)), fullPage: false }); };
const btn = (label) => page.locator('button', { hasText: label }).filter({ visible: true });
async function clickIf(label) { const b = btn(label).first(); if (await b.count() && await b.isEnabled()) { await b.click(); return true; } return false; }

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '?teacher=1');
await page.waitForSelector('.title-screen');
await shot('title');

// 새로 시작 → 처음 읽기
await btn('시작하기').click();
await page.waitForSelector('.sheet');
await shot('mode');
await btn('처음 읽기').click();
// 세책방 도입
for (let i = 0; i < 12; i++) {
  if (await clickIf('네 ▶')) continue;
  if (await clickIf('알겠어요')) { if (i === 4) await shot('shop'); continue; }
  break;
}
await shot('ch0_intro');

// 서장 첫 쪽은 손으로 호칭 잇기를 해 본다(선생님용 버튼 없이)
await clickIf('펼치기 ▶');
await page.waitForSelector('.card.note');
await shot('card_ming');
await clickIf('알겠어요'); // 명나라 카드
await page.waitForSelector('.leaf .para.show');
// 모든 줄 펼치기
for (let i = 0; i < 6; i++) if (!(await clickIf('다음 줄'))) break;
await shot('page_tokens');
const answers = await page.evaluate(() => {
  const st = STORY[0].steps.find((s) => s.id === 'p0a');
  const out = [];
  st.paras.forEach((pa) => { const t = typeof pa === 'string' ? pa : pa.t || ''; for (const m of t.matchAll(/\[([^\]|]+)\|([a-z]+)\]/g)) out.push(PEOPLE[m[2]].name); });
  return out;
});
// 일부러 하나 틀려 보기: 첫 호칭(유 소사)에 유연수를 고른다
const toks = page.locator('.tok.need');
const nTok = await toks.count();
for (let i = 0; i < nTok; i++) {
  await page.locator('.tok').nth(i).click();
  const name = i === 0 ? '유연수' : answers[i];
  await page.locator('.tray .person', { hasText: name }).first().click();
}
await shot('page_penciled');
await btn('맞추어 보기').first().click();
await page.waitForTimeout(400);
await shot('page_wrong_feedback');
// 바로잡기
await page.locator('.tok').nth(0).click();
await page.locator('.tray .person', { hasText: answers[0] }).first().click();
await btn('맞추어 보기').first().click();
await page.waitForTimeout(1200);
await shot('page_confirmed');

// 나머지는 선생님용 정답 채우기로 빠르게
const seen = new Set();
for (let guard = 0; guard < 400; guard++) {
  if (await page.locator('.colophon').count()) break;
  const stepKind = await page.evaluate(() => {
    const m = document.querySelector('.main-inner');
    if (!m) return 'none';
    if (m.querySelector('.leaf.restore')) return 'case';
    if (m.querySelector('.bins')) return 'sort';
    if (m.querySelector('.slots')) return 'route';
    if (m.querySelector('.charge-now')) return 'charges';
    if (m.querySelector('.ev.pick')) return 'reveal';
    if (m.querySelector('.map-inline') && document.querySelector('.tray .person')) return 'mapfill';
    if (m.querySelector('.leaf')) return 'page';
    if (m.querySelector('.card.interp .slip')) return 'reflect';
    return 'other';
  });
  const where = await page.locator('.topbar .where strong').first().textContent().catch(() => '');
  const key = where + ':' + stepKind;
  if (!seen.has(key)) { seen.add(key); await page.waitForTimeout(300); await shot(where.replace(/\s/g, '') + '_' + stepKind); }

  if (stepKind === 'reveal' || stepKind === 'charges') {
    // 데이터에서 정답 제목을 찾아 누른다
    const title = await page.evaluate((kind) => {
      const st = STORY.flatMap((c) => c.steps).find((s) => s.type === kind);
      const items = kind === 'reveal' ? st.lines : st.charges;
      const done = kind === 'reveal' ? document.querySelectorAll('.para.say').length - 1 : document.querySelectorAll('.scroll-list li').length;
      const ev = items[Math.min(done, items.length - 1)].ev;
      const all = G.steps.evidenceList();
      const hit = all.find((e) => e.id === ev);
      if (hit) return hit.title;
      for (const s of STORY.flatMap((c) => c.steps)) { if (s.id === ev) return s.evidence.title; if (s.evidence && s.evidence.id === ev) return s.evidence.title; }
      return null;
    }, stepKind);
    const target = page.locator('.ev.pick:not(.used)', { hasText: title }).first();
    if (title && await target.count()) { await target.click(); await page.waitForTimeout(700); }
    if (await clickIf('다음 ▶')) continue;
    continue;
  }
  if (stepKind === 'reflect') { await page.locator('.card.interp .slip').first().click(); }
  if (await clickIf('정답 채우기(선생님용)')) { await page.waitForTimeout(900); }
  for (const label of ['쪽 넘기기 ▶', '다음 ▶', '알겠어요', '펼치기 ▶', '이어서 읽기 ▶', '마무리 ▶']) {
    if (await clickIf(label)) { await page.waitForTimeout(150); break; }
  }
  const nextCh = page.locator('.tray button.primary', { hasText: '펼치기 ▶' });
  if (await nextCh.count()) { await page.waitForTimeout(200); await shot('chapter_end'); await nextCh.first().click(); }
}
await page.waitForTimeout(800);
await shot('result');
await page.locator('.name-input').fill('2-3 12 김지은');
await page.locator('button', { hasText: '이름 도장 찍기' }).click();
await page.waitForTimeout(700);
await page.locator('.colophon').scrollIntoViewIfNeeded();
await shot('result_colophon');
await page.locator('.ledger').scrollIntoViewIfNeeded();
await shot('result_ledger');
// 편람 탭
await page.goto(BASE + '?ch=ch1');
await page.waitForSelector('.topbar');
for (const t of ['관계도', '편람']) {
  await page.locator(`button[aria-label="${t}"]`).first().click();
  await page.waitForTimeout(500);
  await shot('book_' + t);
  if (t === '편람') for (const tab of ['사건첩', '이본 노트', '실제와 설정']) { await page.locator('.overlay .tab', { hasText: tab }).click(); await page.waitForTimeout(250); await shot('book_' + tab); }
  await page.locator('.overlay button[aria-label="닫기"]').click();
}
const st = await page.evaluate(() => G.save.state);
console.log(JSON.stringify({ chDone: st.chDone, aliases: Object.keys(st.aliases).length, stats: st.stats, wrong: st.wrong.length }, null, 0));
console.log('SHOTS', n, 'ERRORS', errors.length);
for (const e of errors) console.log(' -', e);
await browser.close();
