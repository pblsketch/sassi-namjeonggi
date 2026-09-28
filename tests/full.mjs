// 처음부터 꼼꼼히: 선생님용 버튼 없이 손으로 끝까지 풀고, 틀린 답·힌트 흐름, 저장·이어 하기,
// 설정·편람·관계도·키보드, 여러 화면 크기, file:// 열기까지 확인한다.
//   node full.mjs [all|first|review|flows|save|ui|sizes|file]
// 게임 폴더를 http://127.0.0.1:8765 에서 서빙하고 있어야 한다(file 제외). 설치된 크롬을 쓴다.
// 문제를 찾으면 '✗'로 찍고 종료 코드 1로 끝난다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = fileURLToPath(new URL('./shots/full/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const which = process.argv[2] || 'all';
const KNOWN_404 = /sc_reunion\.webp/; // 아직 없는 그림(알려진 것, 자리를 숨긴다)

const issues = [];
const note = (where, msg) => { issues.push(`${where}: ${msg}`); console.log('  ✗', `${where}: ${msg}`); };
const ok = (cond, where, msg) => { if (!cond) note(where, msg); return !!cond; };
const log = (...a) => console.log(...a);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const browser = await chromium.launch({ channel: 'chrome', headless: true });

const VP = {
  phone: { width: 390, height: 844, mobile: true },
  small: { width: 360, height: 640, mobile: true },
  land: { width: 844, height: 390, mobile: true },
  tablet: { width: 820, height: 1180, mobile: true },
  laptop: { width: 1366, height: 860 },
  wide: { width: 1920, height: 1080 },
};

async function newPage(vp, name) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  page.errs = [];
  page.tag = name;
  page.on('console', (m) => { if (m.type() === 'error' && !KNOWN_404.test((m.location() || {}).url || '')) page.errs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => page.errs.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400 && !KNOWN_404.test(r.url())) page.errs.push('http ' + r.status() + ': ' + r.url()); });
  page.on('requestfailed', (r) => { if (!KNOWN_404.test(r.url())) page.errs.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText); });
  let n = 0;
  page.shot = async (label) => { n++; await page.screenshot({ path: OUT + `${name}_${String(n).padStart(3, '0')}_${label.replace(/[\\/:*?"<>|\s]/g, '')}.png` }); };
  return page;
}
const W = (page, ms = 120) => page.waitForTimeout(ms);
const vbtn = (page, label) => page.locator('button:visible', { hasText: label });
async function clickIf(page, label) { const b = vbtn(page, label).first(); if (await b.count() && await b.isEnabled()) { await b.click(); return true; } return false; }
async function press(page, key) { await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await page.keyboard.press(key); }

// ───────── 지금 화면이 어떤 단계인지 ─────────
async function detect(page) {
  return page.evaluate(() => {
    if (document.querySelector('.sheet-back')) return { kind: 'sheet' };
    if (document.querySelector('.overlay')) return { kind: 'overlay' };
    if (document.querySelector('.colophon')) return { kind: 'result' };
    if (document.querySelector('.title-screen')) return { kind: 'title' };
    const m = document.querySelector('.main-inner');
    if (!m) return { kind: 'none' };
    const all = STORY.flatMap((c) => c.steps);
    const trayBtns = [...document.querySelectorAll('.tray button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim());
    const h2 = m.querySelector('.leaf h2');
    const leafT = h2 ? h2.firstChild.textContent.trim() : '';
    const h3 = (sel) => { const e = m.querySelector(sel + ' h3'); return e ? e.textContent.trim() : ''; };
    const chTitle = (document.querySelector('.topbar .where strong') || {}).textContent || '';
    const ch = STORY.find((c) => c.title === chTitle);
    if (m.querySelector('.seal-mark') && /完/.test(m.textContent) && m.querySelector('.map-inline')) return { kind: 'chend', ch: ch && ch.id, trayBtns };
    if (m.querySelector('.orig') && trayBtns.some((t) => /펼치기|이어서 읽기/.test(t))) return { kind: 'chhead', ch: ch && ch.id, trayBtns };
    if (m.querySelector('.leaf.restore')) return { kind: 'case', id: (all.find((s) => s.type === 'case' && s.title === leafT) || {}).id };
    if (m.querySelector('.bins')) return { kind: 'sort', id: (all.find((s) => s.type === 'sort' && s.title === h3('.card.note')) || {}).id };
    if (m.querySelector('.slots')) return { kind: 'route', id: (all.find((s) => s.type === 'route' && s.title === h3('.card.note')) || {}).id };
    if (m.querySelector('.charge-now')) return { kind: 'charges', id: all.find((s) => s.type === 'charges').id };
    if (m.querySelector('.ev.pick')) return { kind: 'reveal', id: all.find((s) => s.type === 'reveal').id };
    const mf = all.find((s) => s.type === 'mapfill' && s.title === h3('.card.note'));
    if (m.querySelector('.map-inline') && mf) return { kind: 'mapfill', id: mf.id };
    if (m.querySelector('.card.interp .slip')) return { kind: 'reflect', id: (all.find((s) => s.type === 'reflect' && s.title === h3('.card.interp')) || {}).id };
    if (h2) return { kind: 'page', id: (all.find((s) => s.type === 'page' && s.title === leafT) || {}).id };
    if (m.querySelector('.card') && trayBtns.includes('알겠어요')) return { kind: 'card', id: (all.find((s) => s.type === 'card' && s.title === h3('.card')) || {}).id };
    if (m.querySelector('.scene .caption')) return { kind: 'shop', trayBtns };
    return { kind: 'other', trayBtns, html: m.innerHTML.slice(0, 120) };
  });
}
const stepData = (page, id) => page.evaluate((id) => JSON.parse(JSON.stringify(STORY.flatMap((c) => c.steps).find((s) => s.id === id))), id);

// ───────── 화면 점검: 가로 넘침·글자 넘침·트레이에 가린 곳·관계도 겹침 ─────────
async function layoutCheck(page, where) {
  const found = await page.evaluate(async () => {
    const out = [];
    const iw = window.innerWidth;
    const desc = (e) => (e.tagName || '').toLowerCase() + '.' + [...(e.classList || [])].join('.') + ' 「' + (e.textContent || '').trim().slice(0, 16) + '」';
    for (const e of document.querySelectorAll('.main-inner *, .tray *, .topbar *, .sheet *, .overlay .body *')) {
      if (e.closest('.tray .scroll, .overlay .tabs, svg, .colophon, .scene')) continue;
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.right > iw + 1 || b.left < -1) { out.push('가로 넘침: ' + desc(e) + ` ${Math.round(b.left)}~${Math.round(b.right)}/${iw}`); break; }
    }
    if (document.documentElement.scrollWidth > iw + 1) out.push('문서에 가로 스크롤: ' + document.documentElement.scrollWidth + '/' + iw);
    for (const e of document.querySelectorAll('.btn, .person, .slip, .word, .toc-item, .stat, .ev, .card, .leaf, .clue, .bin, .orig, .feedback, .ledger, .name-input, .tab, .dex-item, .charge-now')) {
      if (!e.getBoundingClientRect().width) continue;
      const cs = getComputedStyle(e);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
      if (e.scrollWidth > e.clientWidth + 2) out.push('글자 넘침: ' + desc(e) + ` ${e.scrollWidth}>${e.clientWidth}`);
    }
    // 필사기(세로쓰기): 줄이 책장 밖으로 나가는지
    const col = document.querySelector('.colophon');
    if (col) {
      const cb = col.getBoundingClientRect();
      for (const c of col.querySelectorAll('.col, .name-seal')) {
        const b = c.getBoundingClientRect();
        if (b.left < cb.left + 4 || b.right > cb.right - 4 || b.top < cb.top + 4 || b.bottom > cb.bottom - 4) out.push('필사기 줄이 책장 밖: ' + desc(c) + ` [${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}] in [${Math.round(cb.left)},${Math.round(cb.top)},${Math.round(cb.right)},${Math.round(cb.bottom)}]`);
      }
    }
    // 트레이가 내용을 가리는지: 맨 아래로 내렸을 때 가장 아래 요소가 트레이 위에 있어야 한다
    const tray = document.querySelector('.tray:not(.hide)');
    if (tray && !document.querySelector('.overlay, .sheet-back')) {
      const y0 = window.scrollY;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 60));
      const top = tray.getBoundingClientRect().top;
      if (top < window.innerHeight * 0.25) out.push(`트레이가 화면의 ${Math.round((1 - top / window.innerHeight) * 100)}%를 차지함`);
      const els = [...document.querySelectorAll('.main-inner button, .main-inner .tok, .main-inner .blank, .main-inner .slip, .main-inner .bin, .main-inner .ev, .main-inner .feedback, .main-inner .explain, .main-inner .leaf, .main-inner .card, .main-inner .map-inline, .main-inner .slots, .main-inner .scroll-list')].filter((e) => e.getBoundingClientRect().height);
      let low = null;
      for (const e of els) { const b = e.getBoundingClientRect().bottom; if (!low || b > low.b) low = { e, b }; }
      if (low && low.b > top + 1) out.push(`트레이에 가림: ${desc(low.e)} 아래끝 ${Math.round(low.b)} > 트레이 위 ${Math.round(top)}`);
      window.scrollTo(0, y0);
    }
    return out;
  });
  for (const f of found) note(`${page.tag} ${where}`, f);
  await mapCheck(page, where);
  return found;
}
async function mapCheck(page, where) {
  const found = await page.evaluate(() => {
    const out = [];
    for (const svg of document.querySelectorAll('.mapbox svg')) {
      const sb = svg.getBoundingClientRect();
      if (!sb.width || !sb.height) continue;
      if (svg.closest('.side') && getComputedStyle(svg.closest('.side')).display === 'none') continue;
      const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim() && t.textContent.trim() !== '?');
      const bx = texts.map((t) => ({ t: t.textContent, b: t.getBoundingClientRect(), edge: t.classList.contains('edge-label') }));
      for (const x of bx) if (x.b.left < sb.left - 1 || x.b.right > sb.right + 1 || x.b.top < sb.top - 1 || x.b.bottom > sb.bottom + 1) out.push(`관계도 밖으로 나간 글자 「${x.t}」`);
      for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) {
        const a = bx[i].b, c = bx[j].b;
        const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (ix > 1.5 && iy > Math.min(a.height, c.height) * 0.35) out.push(`관계도 글자 겹침 「${bx[i].t}」×「${bx[j].t}」`);
      }
      // 선 이름이 인물 얼굴을 가리는지
      const rings = [...svg.querySelectorAll('circle.ring')].map((c) => ({ b: c.getBoundingClientRect(), nm: c.parentNode.getAttribute('aria-label') }));
      for (const x of bx.filter((x) => x.edge)) for (const r of rings) {
        const ix = Math.min(x.b.right, r.b.right) - Math.max(x.b.left, r.b.left), iy = Math.min(x.b.bottom, r.b.bottom) - Math.max(x.b.top, r.b.top);
        if (ix > r.b.width * 0.3 && iy > x.b.height * 0.5) out.push(`선 이름 「${x.t}」이 ${r.nm} 얼굴을 가림`);
      }
    }
    return [...new Set(out)];
  });
  for (const f of found) note(`${page.tag} ${where}`, f);
}

// ───────── 단계별 풀이(손으로) ─────────
// o: { mode, wrong:Set(kinds), alias:bool, keyboard:bool, where }
async function solvePage(page, id, o) {
  const step = await stepData(page, id);
  const ans = [];
  step.paras.forEach((pa) => { const t = typeof pa === 'string' ? pa : (pa.t || ''); for (const m of t.matchAll(/\[([^\]|]+)\|([a-z]+)\]/g)) ans.push(m[2]); });
  const toks = page.locator('.main-inner .leaf .tok');
  ok((await toks.count()) === ans.length, id, `호칭 칸 ${await toks.count()}개인데 데이터는 ${ans.length}개`);
  // 복습 모드에서는 자동 표시(얼굴)가 없어야 한다
  const autoN = await page.locator('.main-inner .auto').count();
  const autoChips = await page.locator('.main-inner .auto .chip').count();
  if (o.mode === 'review') ok(autoChips === 0, id, `다시 읽기인데 자동 표시 얼굴이 ${autoChips}개 보임`);
  else if (autoN) ok(autoChips === autoN, id, `처음 읽기인데 자동 표시 얼굴이 ${autoChips}/${autoN}`);
  // 복습 모드에서는 호칭을 인물 전체 명단에서 고른다
  if (o.mode === 'review' && ans.length) {
    const nAll = await page.evaluate(() => Object.keys(PEOPLE).length);
    ok((await page.locator('.tray .person').count()) === nAll, id, `다시 읽기인데 인물 칸이 전체 명단(${nAll})이 아님`);
  }
  let wrongPending = o.wrong && o.wrong.has('page') && ans.length >= 1;
  let revealWay = 0;
  const checkBtn = page.locator('.tray button', { hasText: '맞추어 보기' });
  const counts = () => page.evaluate(() => {
    const t = [...document.querySelectorAll('.main-inner .leaf .tok')];
    return { need: t.filter((x) => x.closest('.para.show') && x.classList.contains('need')).length, pen: t.filter((x) => x.classList.contains('pen')).length, done: t.filter((x) => x.classList.contains('done')).length, total: t.length, shown: document.querySelectorAll('.main-inner .para.show').length, paras: document.querySelectorAll('.main-inner .para').length };
  });
  for (let guard = 0; guard < 80; guard++) {
    let c = await counts();
    // 보이는 빈 호칭에 인물 표시
    const st = await page.evaluate(() => [...document.querySelectorAll('.main-inner .leaf .tok')].map((t) => ({ need: t.classList.contains('need'), vis: !!t.closest('.para.show') })));
    for (let i = 0; i < st.length; i++) {
      if (!st[i].vis || !st[i].need) continue;
      await toks.nth(i).click();
      let pid = ans[i];
      if (wrongPending) {
        const others = await page.locator('.tray .person').evaluateAll((els, pid) => els.map((e) => e.dataset.id).filter((x) => x !== pid), pid);
        pid = others[0];
        wrongPending = 'placed';
      }
      await page.locator(`.tray .person[data-id="${pid}"]`).click();
      c = await counts();
      if (c.pen >= 3 && await checkBtn.isEnabled()) { await doCheck(); c = await counts(); }
    }
    c = await counts();
    if (c.shown < c.paras) {
      // 다음 줄: 버튼 / 글 누르기 / Enter 를 번갈아
      const before = c.shown;
      const way = o.keyboard ? revealWay++ % 3 : 0;
      if (way === 0) await vbtn(page, '다음 줄').first().click();
      else if (way === 1) await page.locator('.main-inner .leaf h2').click();
      else await press(page, 'Enter');
      await W(page, 60);
      c = await counts();
      ok(c.shown === before + 1, id, `다음 줄(${['버튼', '글 누르기', 'Enter'][way]})로 한 줄이 펼쳐지지 않음 ${before}→${c.shown}`);
      continue;
    }
    if (c.pen > 0 && await checkBtn.isEnabled()) { await doCheck(); continue; }
    if (c.done === c.total) {
      const end = vbtn(page, '쪽 넘기기');
      ok(await end.isEnabled(), id, '호칭을 다 확인했는데 쪽 넘기기가 꺼져 있음');
      if (o.keyboard && guard % 2) await press(page, 'Enter'); else await end.click();
      await W(page, 150);
      return;
    }
    if (c.pen > 0 && !(await checkBtn.isEnabled())) { note(id, `맞추어 보기를 누를 수 없음 (표시 ${c.pen}, 남은 ${c.need})`); return; }
  }
  note(id, '쪽을 끝내지 못함');

  async function doCheck() {
    if (wrongPending === 'placed') {
      wrongPending = false;
      await checkBtn.click(); await W(page, 200);
      const f1 = await page.locator('.main-inner .feedback').first().textContent().catch(() => '');
      ok(/가운데/.test(f1) && /맞았어요/.test(f1), id, '틀린 뒤 1단계 피드백(몇 개 맞음)이 없음: ' + f1);
      await checkBtn.click(); await W(page, 200);
      ok(await page.locator('.main-inner .tok.wrong').count() >= 1, id, '2번째 틀림에 빗금 표시가 없음');
      await checkBtn.click(); await W(page, 200);
      const f3 = await page.locator('.main-inner .feedback').first().textContent().catch(() => '');
      ok(/여백의 메모/.test(f3), id, '3번째 틀림에 여백의 메모가 없음');
      o.memoCards = (o.memoCards || 0) + await page.locator('.main-inner .card.fiction', { hasText: '여백의 메모' }).count();
      await checkBtn.click(); await W(page, 200);
      const show = page.locator('.main-inner button', { hasText: '정답 보기' });
      if (ok(await show.count(), id, '4번째 틀림에 정답 보기가 없음')) { await show.click(); await W(page, 300); o.helped = (o.helped || 0) + 1; }
      ok((await counts()).pen === 0, id, '정답 보기 뒤에도 연필 표시가 남음');
      return;
    }
    await checkBtn.click();
    await W(page, 250);
    const c2 = await counts();
    ok(c2.pen === 0, id, `맞게 표시했는데 확정되지 않음(연필 ${c2.pen})`);
  }
}

async function solveCase(page, id, o) {
  const step = await stepData(page, id);
  // 조사 지점
  const spots = page.locator('.main-inner .spot');
  const nSpots = await spots.count();
  ok(nSpots === (step.spots || []).length, id, `조사 지점 ${nSpots}/${(step.spots || []).length}`);
  for (let i = 0; i < nSpots; i++) {
    await spots.nth(i).click();
    await page.waitForSelector('.sheet');
    const t = await page.locator('.sheet h3').textContent();
    ok(t === step.spots[i].label, id, `조사 지점 ${i + 1}의 제목이 다름: ${t}`);
    await page.locator('.sheet button', { hasText: '닫기' }).click();
    await W(page, 80);
  }
  const clues = page.locator('.main-inner .clue');
  for (let i = 0; i < await clues.count(); i++) { await clues.nth(i).click(); await W(page, 40); }
  const words = (await page.locator('.tray .word').allTextContents()).map((s) => s.trim());
  const need = [...(step.spots || []).flatMap((s) => s.words), ...(step.clues || []).flatMap((s) => s.words), ...(step.bank || []), ...(o.mode === 'review' ? step.hard || [] : [])];
  // 처음 읽기에는 헷갈리는 낱말(hard)이 나오면 안 된다
  if (o.mode !== 'review') for (const w of step.hard || []) if (!need.includes(w)) ok(!words.includes(w), id, `처음 읽기인데 복습용 낱말 「${w}」이 나옴`);
  for (const w of need) ok(words.includes(w), id, `낱말 「${w}」을 줍지 못함`);
  if (o.mode === 'review') ok(await page.locator('.tray .word img').count() === 0, id, '다시 읽기인데 낱말에 얼굴이 보임');
  const keys = [...step.lines.join(' ').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  const personOf = (w) => page.evaluate((w) => G.util.personOf(w), w);
  const right = async (k) => {
    const d = step.blanks[k];
    if (d.word) return d.word;
    const cands = [];
    for (const w of words) if (await personOf(w) === d.person) cands.push(w);
    // 다른 호칭(교 낭자·부인·엄숭·유 한림)을 일부러 골라 본다
    return (o.alias && cands.find((w) => w !== k)) || cands.find((w) => w === k) || cands[0];
  };
  const wrongOf = async (k) => { const r = await right(k); const d = step.blanks[k]; for (const w of words) { if (w === r) continue; if (d.person ? (await personOf(w)) !== d.person : w !== d.word) return w; } return null; };
  const blanks = page.locator('.main-inner .blank');
  const fill = async (i, w) => { await blanks.nth(i).click(); await page.locator('.tray .word', { hasText: new RegExp('^\\s*' + reEsc(w) + '\\s*$') }).first().click(); await W(page, 40); };
  const check = page.locator('.tray button', { hasText: '맞추어 보기' });
  const chosen = [];
  if (o.wrong && o.wrong.has('case')) {
    for (let i = 0; i < keys.length; i++) await fill(i, await wrongOf(keys[i]));
    const fb = () => page.locator('.main-inner .feedback').first().textContent().catch(() => '');
    await check.click(); await W(page, 200);
    ok(/틀렸어요/.test(await fb()), id, '1번째 틀림 피드백이 없음');
    await check.click(); await W(page, 200);
    ok(await page.locator('.main-inner .blank.wrong').count() >= 1, id, '2번째 틀림에 틀린 칸 빗금이 없음');
    await check.click(); await W(page, 200);
    ok(/여백의 메모/.test(await fb()), id, '3번째 틀림에 여백의 메모가 없음');
    ok(await page.locator('.main-inner .spot.glow, .main-inner .clue.glow').count() >= 1, id, '3번째 틀림에 실마리가 반짝이지 않음');
    o.memoCards = (o.memoCards || 0) + await page.locator('.main-inner .card.fiction', { hasText: '여백의 메모' }).count();
    await check.click(); await W(page, 200);
    const show = page.locator('.main-inner button', { hasText: '정답 보기' });
    if (ok(await show.count(), id, '4번째 틀림에 정답 보기가 없음')) { await show.click(); o.helped = (o.helped || 0) + 1; }
  } else {
    for (let i = 0; i < keys.length; i++) { const w = await right(keys[i]); chosen.push(w); await fill(i, w); }
    // 조사 글에 나온 조사(이/가, 은/는, 을/를, 과/와)가 고른 낱말과 어울리는지
    const text = await page.locator('.main-inner .leaf.restore').textContent();
    for (const w of chosen) {
      const m = text.match(new RegExp(reEsc(w) + '(이|가|은|는|을|를|과|와)(?=[\\s,.])'));
      if (!m) continue;
      const last = w.charCodeAt(w.length - 1);
      const jong = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 : 0;
      const wantBatchim = { 이: 1, 은: 1, 을: 1, 과: 1, 가: 0, 는: 0, 를: 0, 와: 0 }[m[1]];
      ok(!!jong === !!wantBatchim, id, `조사가 어색함: 「${w}${m[1]}」`);
    }
    await check.click();
  }
  await page.waitForSelector('.main-inner .explain', { timeout: 4000 }).catch(() => {});
  ok(await page.locator('.main-inner .blank.done').count() === keys.length, id, '맞게 채웠는데 복원 도장이 찍히지 않음');
  const next = vbtn(page, '다음 ▶');
  await next.waitFor({ timeout: 4000 });
  await layoutCheck(page, id + ' 복원 뒤');
  if (o.keyboard) await press(page, 'Enter'); else await next.click();
  await W(page, 150);
}

async function solveSort(page, id, o) {
  const step = await stepData(page, id);
  const label = (bin) => step.bins.find((b) => b.id === bin).label;
  const wrongBin = (bin) => step.bins.find((b) => b.id !== bin).id;
  const put = async (useWrong) => {
    const slips = page.locator('.main-inner .pool .slip');
    while (await slips.count()) {
      const t = (await slips.first().textContent()).trim();
      const c = step.cards.find((x) => x.t === t);
      await slips.first().click();
      await page.locator('.main-inner .bin', { hasText: label(useWrong ? wrongBin(c.bin) : c.bin) }).first().click({ position: { x: 20, y: 12 } });
    }
  };
  const check = page.locator('.tray button', { hasText: '맞추어 보기' });
  if (o.wrong && o.wrong.has('sort')) {
    await put(true);
    await check.click(); await W(page, 200);
    ok(/제자리/.test(await page.locator('.main-inner .feedback').first().textContent()), id, '1번째 틀림 피드백 없음');
    await check.click(); await W(page, 200);
    ok(await page.locator('.main-inner .slip.bad').count() > 0, id, '2번째 틀림에 붉은 쪽지 표시 없음');
    await check.click(); await W(page, 200);
    const show = page.locator('.main-inner button', { hasText: '정답 보기' });
    if (ok(await show.count(), id, '3번째 틀림에 정답 보기가 없음')) { await show.click(); o.helped = (o.helped || 0) + 1; }
  } else {
    await put(false);
    // 칸 안의 쪽지를 들고 다른 칸으로 옮겨 보기(다시 제자리로)
    const inBin = page.locator('.main-inner .bin .slip').first();
    const t = (await inBin.textContent()).trim();
    const c = step.cards.find((x) => x.t === t);
    await inBin.click();
    await page.locator('.main-inner .bin', { hasText: label(wrongBin(c.bin)) }).first().click({ position: { x: 20, y: 12 } });
    const moved = page.locator('.main-inner .bin .slip', { hasText: t });
    await moved.click();
    await page.locator('.main-inner .bin', { hasText: label(c.bin) }).first().click({ position: { x: 20, y: 12 } });
    await check.click();
  }
  await vbtn(page, '다음 ▶').waitFor({ timeout: 4000 });
  ok(await page.locator('.main-inner .slip.ok').count() === step.cards.length, id, '정답인데 모두 초록이 아님');
  await layoutCheck(page, id + ' 끝');
  await vbtn(page, '다음 ▶').click(); await W(page, 150);
}

async function solveRoute(page, id, o) {
  const step = await stepData(page, id);
  const tOf = (cid) => step.cards.find((c) => c.id === cid).t;
  const placeOrder = async (ids) => { for (const cid of ids) { const s = page.locator('.main-inner .pool .slip', { hasText: tOf(cid) }); if (await s.count()) await s.first().click(); } };
  const check = page.locator('.tray button', { hasText: '맞추어 보기' });
  if (o.wrong && o.wrong.has('route')) {
    const rev = [...step.order].reverse();
    await placeOrder(rev);
    await check.click(); await W(page, 200);
    ok(/제자리/.test(await page.locator('.main-inner .feedback').first().textContent()), id, '1번째 틀림 피드백 없음');
    await check.click(); await W(page, 250);
    ok(await page.locator('.main-inner .slot.locked').count() >= 1, id, '2번째 틀림에 제자리 낱장이 고정되지 않음');
    await placeOrder(rev);
    await check.click(); await W(page, 200);
    const show = page.locator('.main-inner button', { hasText: '정답 보기' });
    if (ok(await show.count(), id, '3번째 틀림에 정답 보기가 없음')) { await show.click(); o.helped = (o.helped || 0) + 1; }
  } else {
    // 하나를 잘못 넣었다가 빼고 다시
    await page.locator('.main-inner .pool .slip', { hasText: tOf(step.order[1]) }).click();
    await page.locator('.main-inner .slot .slip', { hasText: tOf(step.order[1]) }).click();
    ok(await page.locator('.main-inner .pool .slip').count() === step.cards.length, id, '놓인 낱장을 눌러도 빠지지 않음');
    await placeOrder(step.order);
    await check.click();
  }
  await vbtn(page, '다음 ▶').waitFor({ timeout: 4000 });
  ok(await page.locator('.main-inner .slot .slip.ok').count() === step.cards.length, id, '정답인데 모두 초록이 아님');
  await layoutCheck(page, id + ' 끝');
  await vbtn(page, '다음 ▶').click(); await W(page, 150);
}

async function nodeOf(page, pid, blank) {
  const pos = await page.evaluate((pid) => PEOPLE[pid].pos, pid);
  return page.locator(`.main-inner g.node${blank ? '.blank' : ''}[transform="translate(${pos[0]} ${pos[1]})"]`).first();
}
async function solveMap(page, id, o) {
  const step = await stepData(page, id);
  // 넓은 화면의 옆 관계도가 정답을 보여 주면 안 된다
  const leak = await page.evaluate((blanks) => {
    const side = document.querySelector('.side');
    if (!side || getComputedStyle(side).display === 'none') return [];
    return blanks.filter((b) => [...side.querySelectorAll('g.node')].some((g) => g.getAttribute('aria-label') === PEOPLE[b].name));
  }, step.blanks);
  ok(!leak.length, id, '옆 관계도에 빈자리 정답이 보임: ' + leak.join(', '));
  await mapCheck(page, id + ' 채우기 전');
  const place = async (pairs) => { for (const [blank, person] of pairs) { await (await nodeOf(page, blank, true)).click(); await page.locator(`.tray .person[data-id="${person}"]`).click(); await W(page, 40); } };
  const check = page.locator('.tray button', { hasText: '맞추어 보기' });
  const rot = step.blanks.map((b, i) => [b, step.blanks[(i + 1) % step.blanks.length]]);
  if (o.wrong && o.wrong.has('mapfill')) {
    await place(rot);
    await check.click(); await W(page, 200);
    ok(/자리가 맞았어요/.test(await page.locator('.main-inner .feedback').first().textContent()), id, '1번째 틀림 피드백 없음');
    await check.click(); await W(page, 200);
    ok(await check.isDisabled(), id, '2번째 틀림 뒤 틀린 자리가 비워지지 않음');
    await place(rot);
    await check.click(); await W(page, 200);
    const show = page.locator('.main-inner button', { hasText: '정답 보기' });
    if (ok(await show.count(), id, '3번째 틀림에 정답 보기가 없음')) { await show.click(); o.helped = (o.helped || 0) + 1; }
  } else {
    // 인물을 먼저 고르고 자리를 누르는 순서로도 해 본다
    const [first, ...rest] = step.blanks;
    await page.locator(`.tray .person[data-id="${first}"]`).click();
    await (await nodeOf(page, first, true)).click();
    await place(rest.map((b) => [b, b]));
    await mapCheck(page, id + ' 채운 뒤');
    await check.click();
  }
  await vbtn(page, '다음 ▶').waitFor({ timeout: 4000 });
  await mapCheck(page, id + ' 끝');
  await layoutCheck(page, id + ' 끝');
  await vbtn(page, '다음 ▶').click(); await W(page, 150);
}

async function evTitle(page, ev) {
  return page.evaluate((ev) => {
    const hit = G.steps.evidenceList().find((e) => e.id === ev);
    if (hit) return hit.title;
    for (const s of STORY.flatMap((c) => c.steps)) { if (s.id === ev) return s.evidence.title; if (s.evidence && s.evidence.id === ev) return s.evidence.title; }
    return null;
  }, ev);
}
async function solveReveal(page, id, o) {
  const step = await stepData(page, id);
  for (let i = 0; i < step.lines.length; i++) {
    await page.waitForFunction((n) => document.querySelectorAll('.main-inner .para.say').length === n, i + 1, { timeout: 5000 });
    const title = await evTitle(page, step.lines[i].ev);
    const target = page.locator('.main-inner .ev.pick', { has: page.locator('h4', { hasText: new RegExp('^' + reEsc(title) + '$') }) });
    ok(await target.count() === 1, id, `사건첩에 「${title}」이 ${await target.count()}개`);
    if (o.wrong && o.wrong.has('reveal') && i === 0) {
      await page.locator('.main-inner .ev.pick', { hasNot: page.locator('h4', { hasText: new RegExp('^' + reEsc(title) + '$') }) }).first().click();
      await W(page, 150);
      ok(/다른 사건/.test(await page.locator('.main-inner .feedback').first().textContent().catch(() => '')), id, '틀린 증거에 피드백 없음');
    }
    await target.click();
    await W(page, 150);
    ok(await target.locator('.ok-seal').count() === 1, id, `「${title}」에 확인 도장이 없음`);
  }
  await vbtn(page, '다음 ▶').waitFor({ timeout: 5000 });
  await layoutCheck(page, id + ' 끝');
  await vbtn(page, '다음 ▶').click(); await W(page, 150);
}
async function solveCharges(page, id, o) {
  const step = await stepData(page, id);
  for (let i = 0; i < step.charges.length; i++) {
    await page.waitForFunction((n) => document.querySelectorAll('.main-inner .scroll-list li').length === n && document.querySelector('.charge-now small').textContent.includes('죄목 ' + (n + 1)), i, { timeout: 5000 });
    const title = await evTitle(page, step.charges[i].ev);
    const target = page.locator('.main-inner .ev.pick', { has: page.locator('h4', { hasText: new RegExp('^' + reEsc(title) + '$') }) });
    if (o.wrong && o.wrong.has('charges') && i === 0) {
      await page.locator('.main-inner .ev.pick:not(.used)', { hasNot: page.locator('h4', { hasText: new RegExp('^' + reEsc(title) + '$') }) }).first().click();
      await W(page, 150);
      ok(/다른 죄/.test(await page.locator('.main-inner .feedback').first().textContent().catch(() => '')), id, '틀린 증거에 피드백 없음');
    }
    await target.click();
    await W(page, 120);
  }
  await vbtn(page, '다음 ▶').waitFor({ timeout: 6000 });
  ok(await page.locator('.main-inner .scroll-list li').count() === step.charges.length, id, '죄목이 모두 적히지 않음');
  await layoutCheck(page, id + ' 끝');
  await vbtn(page, '다음 ▶').click(); await W(page, 150);
}

// 한 판을 끝까지(타이틀 → 결과)
async function playThrough(page, o) {
  const seen = [];
  o.helped = 0; o.memoCards = 0;
  for (let guard = 0; guard < 300; guard++) {
    const d = await detect(page);
    const key = d.kind + ':' + (d.id || d.ch || '');
    if (seen[seen.length - 1] !== key) { seen.push(key); if (o.shots) await page.shot(key); if (o.layout && !['sheet', 'overlay'].includes(d.kind)) await layoutCheck(page, key); }
    if (d.kind === 'result') break;
    if (d.kind === 'chhead') {
      const ch = await page.evaluate((id) => STORY.find((c) => c.id === id), d.ch);
      ok(await page.locator('.main-inner .orig').count() === ch.hoemok.length, d.ch, '회목(原文) 수가 다름');
      const recap = await page.locator('.main-inner .card.note', { hasText: '지난 이야기' }).count();
      if (o.mode === 'review') ok(recap === 0, d.ch, '다시 읽기인데 지난 이야기가 나옴');
      else ok(recap === (ch.recap ? 1 : 0), d.ch, '처음 읽기인데 지난 이야기가 없음');
      if (o.keyboard) await press(page, 'Enter'); else await vbtn(page, '▶').first().click();
      await W(page, 150);
      continue;
    }
    if (d.kind === 'chend') {
      ok(await page.locator('.main-inner .mapbox svg g.node').count() > 0, key, '장 끝 관계도가 비어 있음');
      const next = page.locator('.tray button.primary', { hasText: '펼치기' });
      if (o.keyboard) {
        await press(page, 'Enter');
        await W(page, 200);
        const d2 = await detect(page);
        ok(d2.kind !== 'chend' || (d2.ch !== d.ch), key, 'Enter로 다음 장·마무리로 넘어가지 않음');
      } else if (await next.count()) await next.click();
      else await vbtn(page, '마무리').click();
      await W(page, 200);
      continue;
    }
    if (d.kind === 'card') { if (o.keyboard) await press(page, 'Enter'); else await vbtn(page, '알겠어요').click(); await W(page, 120); continue; }
    if (d.kind === 'page') { await solvePage(page, d.id, o); continue; }
    if (d.kind === 'case') { await solveCase(page, d.id, o); continue; }
    if (d.kind === 'sort') { await solveSort(page, d.id, o); continue; }
    if (d.kind === 'route') { await solveRoute(page, d.id, o); continue; }
    if (d.kind === 'mapfill') { await solveMap(page, d.id, o); continue; }
    if (d.kind === 'reveal') { await solveReveal(page, d.id, o); continue; }
    if (d.kind === 'charges') { await solveCharges(page, d.id, o); continue; }
    if (d.kind === 'reflect') {
      const next = vbtn(page, '다음 ▶');
      ok(await next.isDisabled(), d.id, '해석 질문에서 고르기 전에 다음이 켜져 있음');
      await page.locator('.main-inner .card.interp .slip').nth(1).click();
      ok(await next.isEnabled(), d.id, '보기를 골랐는데 다음이 꺼져 있음');
      await next.click(); await W(page, 150);
      continue;
    }
    if (d.kind === 'sheet') { note(key, '예상하지 못한 판이 떠 있음: ' + await page.locator('.sheet').textContent()); await page.locator('.sheet button').last().click(); continue; }
    note('playThrough', '알 수 없는 화면: ' + JSON.stringify(d));
    break;
  }
  return seen;
}

async function startNew(page, mode, url = BASE) {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await page.waitForSelector('.title-screen');
  ok(await vbtn(page, '이어 하기').count() === 0, 'title', '처음인데 이어 하기가 보임');
  await vbtn(page, '시작하기').click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet button', { hasText: mode === 'review' ? '다시 읽기' : '처음 읽기' }).click();
  // 세책방 도입: 주인의 말 4줄 + 게임 설정 카드 3장
  let lines = 0, cards = 0;
  for (let i = 0; i < 12; i++) {
    if (await clickIf(page, '네 ▶')) { lines++; await W(page, 60); continue; }
    if (await clickIf(page, '알겠어요')) { cards++; await W(page, 60); continue; }
    if (await page.locator('.main-inner .orig').count()) break;
    await W(page, 100);
  }
  ok(lines === 4 && cards === 3, 'shop', `세책방 도입 ${lines}줄·카드 ${cards}장`);
  const st = await page.evaluate(() => G.save.state);
  ok(st.mode === mode, 'mode', `읽기 방식이 ${st.mode}`);
}

async function checkResult(page, o, where) {
  await page.waitForSelector('.colophon');
  const st = await page.evaluate(() => G.save.state);
  const allCh = await page.evaluate(() => STORY.map((c) => c.id));
  ok(allCh.every((c) => st.chDone[c]), where, '모든 장이 끝나지 않음: ' + JSON.stringify(st.chDone));
  ok(Object.keys(st.cases).length === 5, where, '사건 5건이 기록되지 않음');
  ok(st.mode === o.mode, where, '결과의 읽기 방식이 다름');
  if (o.helped != null) ok(st.helped === o.helped, where, `도움 사용 ${st.helped}번, 테스트가 누른 정답 보기 ${o.helped}번`);
  const ledger = await page.locator('.ledger').textContent();
  ok(ledger.includes(o.mode === 'review' ? '다시 읽기' : '처음 읽기'), where, '장부에 읽기 방식이 없음');
  ok(/사건 복원/.test(ledger) && /5건/.test(ledger), where, '장부의 사건 수가 다름: ' + ledger);
  // 필사기: 날짜(간지)·이름·도장
  const colText = await page.locator('.colophon').textContent();
  ok(/謝氏南征記/.test(colText), where, '필사기에 책 이름이 없음');
  ok(!/육월|십월/.test(colText), where, '필사기 날짜 읽기가 틀림(유월·시월): ' + colText);
  await page.locator('.name-input').fill('2-3 12 김지은');
  await vbtn(page, '이름 도장 찍기').click();
  await W(page, 700);
  ok(await page.locator('.name-seal.on').count() === 1, where, '이름 도장이 찍히지 않음');
  ok((await page.locator('.name-seal span').textContent()) === '김지은印', where, '도장 글자가 다름');
  ok((await page.locator('.colophon .col.who').textContent()).includes('2-3 12 김지은'), where, '필사기에 이름이 없음');
  await layoutCheck(page, where + ' 필사기');
  const dl = page.waitForEvent('download', { timeout: 8000 });
  await vbtn(page, '필사기 이미지로 저장').click();
  const d = await dl.catch(() => null);
  ok(d && /\.png$/.test(d.suggestedFilename()), where, '이미지 저장이 되지 않음');
  if (d) { const p = OUT + page.tag + '_saved.png'; await d.saveAs(p); ok(fs.statSync(p).size > 20000, where, '저장한 이미지가 너무 작음'); }
  await page.shot('result');
}

// ───────── 1. 손으로 완주(처음 읽기 / 다시 읽기) ─────────
async function runPlay(mode, vpName, extra = {}) {
  log(`\n[${mode}] 손으로 완주 — ${vpName}`);
  const page = await newPage(VP[vpName], `${mode}_${vpName}`);
  await startNew(page, mode);
  const o = { mode, alias: mode === 'review', keyboard: mode === 'first', layout: true, shots: true, ...extra };
  const t0 = Date.now();
  const seen = await playThrough(page, o);
  await checkResult(page, o, mode);
  const kinds = new Set(seen.map((k) => k.split(':')[0]));
  for (const k of ['page', 'case', 'card', 'sort', 'route', 'reveal', 'charges', 'reflect', 'mapfill']) ok(kinds.has(k), mode, `단계 종류 ${k}를 거치지 않음`);
  log(`  화면 ${seen.length}개, ${Math.round((Date.now() - t0) / 1000)}초, 오류 ${page.errs.length}`);
  for (const e of page.errs) note(page.tag, e);
  await page.context().close();
}

// ───────── 2. 틀린 답 → 힌트 → 정답 보기 흐름(모든 활동) ─────────
async function runFlows() {
  log('\n[flows] 틀린 답 → 부분 피드백 → 틀린 칸 → 여백의 메모 → 정답 보기');
  const page = await newPage(VP.phone, 'flows');
  await startNew(page, 'first');
  const o = { mode: 'first', wrong: new Set(['page', 'case', 'sort', 'route', 'mapfill', 'reveal', 'charges']), layout: true };
  await playThrough(page, o);
  ok(o.memoCards === 1, 'flows', `여백의 메모 게임 설정 카드가 ${o.memoCards}번 나옴(처음 한 번이어야 함)`);
  await checkResult(page, o, 'flows');
  const st = await page.evaluate(() => G.save.state);
  ok(st.wrong.length > 5, 'flows', '오답 노트가 비어 있음');
  ok(await page.locator('.card.note', { hasText: '오답 노트' }).count() === 1, 'flows', '결과에 오답 노트가 없음');
  log(`  도움 ${st.helped}번, 오답 ${st.wrong.length}개, 첫 시도 ${JSON.stringify(st.stats)}`);
  for (const e of page.errs) note(page.tag, e);
  await page.context().close();
}

// ───────── 저장 상태 만들기(어느 단계 바로 앞까지 끝낸 것으로) ─────────
async function seed(page, uptoId, extra = {}, url = BASE) {
  await page.goto(url);
  await page.evaluate(({ uptoId, extra }) => {
    const all = STORY.flatMap((c) => c.steps);
    const idx = uptoId ? all.findIndex((s) => s.id === uptoId) : all.length;
    const st = { v: 1, mode: 'first', font: 1, sound: false, music: false, teacher: false, name: '', sealed: false, seenFiction: { shop: true, text: true, art: true }, done: {}, chDone: {}, tokens: {}, aliases: {}, met: {}, cases: {}, evidence: {}, stamps: {}, reflect: {}, stats: {}, wrong: [], helped: 0, startedAt: Date.now() - 30 * 60000, finishedAt: 0 };
    for (const s of all.slice(0, idx)) {
      st.done[s.id] = true;
      if (s.type === 'page') s.paras.forEach((pa, pi) => {
        const t = typeof pa === 'string' ? pa : (pa.t || '');
        if (pa.who) st.met[pa.who] = true;
        let n = 0;
        for (const m of t.matchAll(/\[([^\]|]+)\|([a-z]+)\]/g)) { st.tokens[s.id + '#' + pi + '.' + (n++)] = m[2]; st.aliases[m[2] + '|' + m[1]] = true; st.met[m[2]] = true; }
        for (const m of t.matchAll(/\{([^}|]+)\|([a-z]+)\}/g)) st.met[m[2]] = true;
      });
      if (s.type === 'case') { st.cases[s.id] = { done: true, tries: 1, helped: false }; st.evidence[s.id] = { title: s.evidence.title, short: s.evidence.short, text: s.lines.join(' ').replace(/\[([^\]]+)\]/g, '$1') }; for (const k in s.blanks) if (s.blanks[k].person) st.met[s.blanks[k].person] = true; }
      if (s.type === 'mapfill') s.blanks.forEach((b) => (st.met[b] = true));
      if (s.type === 'reveal') s.lines.forEach((l) => (st.stamps[l.ev] = true));
      if (s.type === 'reflect') st.reflect[s.id] = 0;
    }
    for (const c of STORY) if (c.steps.every((s) => st.done[s.id])) st.chDone[c.id] = true;
    Object.assign(st, extra);
    localStorage.setItem('sassi-jiwojin-v1', JSON.stringify(st));
  }, { uptoId, extra });
}
async function gotoStep(page, id, extra = {}, url = BASE) {
  await seed(page, id, extra, url);
  const ch = await page.evaluate((id) => STORY.find((c) => c.steps.some((s) => s.id === id)).id, id);
  await page.goto(url + '?ch=' + ch);
  await vbtn(page, '▶').first().click();
  await W(page, 250);
}

// ───────── 3. 저장·이어 하기·목차·다시 보기·처음부터 새로 ─────────
async function runSave() {
  log('\n[save] 저장·이어 하기·목차·다시 보기');
  const page = await newPage(VP.phone, 'save');
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  // 처음 목차: 서장만 열림
  await vbtn(page, '목차').click();
  const tocState = async () => page.locator('.toc-item .st').allTextContents();
  let t = await tocState();
  ok(t[0] === '열림' && t.slice(1).every((x) => x === '잠김'), 'toc', '처음 목차 상태: ' + t.join(','));
  await page.locator('.toc-item').nth(2).click();
  ok(await page.locator('.toast', { hasText: '앞 장을' }).count() === 1, 'toc', '잠긴 장을 눌러도 알림이 없음');
  ok(await page.locator('.overlay').count() === 1, 'toc', '잠긴 장을 누르자 목차가 닫힘');
  await page.locator('.overlay button[aria-label="닫기"]').click();
  // 새로 시작 → 서장 두 쪽째 중간까지
  await startNew(page, 'first');
  const o = { mode: 'first' };
  await vbtn(page, '펼치기').click(); await W(page);
  await vbtn(page, '알겠어요').click(); await W(page);
  let d = await detect(page);
  await solvePage(page, d.id, o); // p0a
  d = await detect(page);
  ok(d.id === 'p0b', 'save', '두 번째 쪽이 아님 ' + d.id);
  // 호칭 3개만 확정
  for (let i = 0; i < 4; i++) await vbtn(page, '다음 줄').click();
  const ans = ['sassi', 'nun', 'sassi'];
  const toks = page.locator('.main-inner .leaf .tok');
  for (let i = 0; i < 3; i++) { await toks.nth(i).click(); await page.locator(`.tray .person[data-id="${ans[i]}"]`).click(); }
  await vbtn(page, '맞추어 보기').click(); await W(page, 300);
  ok(await page.locator('.main-inner .tok.done').count() === 3, 'save', '호칭 3개가 확정되지 않음');
  // 새로고침 → 이어 하기
  await page.reload();
  await page.waitForSelector('.title-screen');
  ok(await vbtn(page, '이어 하기').count() === 1, 'save', '새로고침 뒤 이어 하기가 없음');
  await vbtn(page, '이어 하기').click();
  ok(await vbtn(page, '이어서 읽기').count() === 1, 'save', '장 머리에 이어서 읽기가 없음');
  await vbtn(page, '이어서 읽기').click(); await W(page);
  d = await detect(page);
  ok(d.id === 'p0b', 'save', '이어 하기가 같은 쪽으로 돌아오지 않음: ' + d.id);
  ok(await page.locator('.main-inner .tok.done').count() === 3, 'save', '확정한 호칭이 새로고침 뒤 사라짐');
  await solvePage(page, 'p0b', o);
  await vbtn(page, '알겠어요').click(); await W(page); // v0
  d = await detect(page);
  ok(d.kind === 'chend', 'save', '서장 끝이 아님');
  // 1장까지 손으로
  await page.locator('.tray button.primary', { hasText: '펼치기' }).click(); await W(page);
  for (let g = 0; g < 20; g++) {
    d = await detect(page);
    if (d.kind === 'chend') break;
    if (d.kind === 'chhead') { await vbtn(page, '▶').first().click(); await W(page); continue; }
    if (d.kind === 'card') { await vbtn(page, '알겠어요').click(); await W(page); continue; }
    if (d.kind === 'page') await solvePage(page, d.id, o);
    else if (d.kind === 'case') await solveCase(page, d.id, o);
    else if (d.kind === 'mapfill') await solveMap(page, d.id, o);
    else { note('save', '1장에서 예상 밖 화면 ' + d.kind); break; }
  }
  const stats1 = await page.evaluate(() => JSON.stringify(G.save.state.stats));
  // 목차: 서장·1장 끝, 2장 열림, 3장 잠김
  await page.locator('.tray button', { hasText: '목차' }).click();
  t = await tocState();
  ok(t[0] === '복원 끝' && t[1] === '복원 끝' && t[2] === '열림' && t[3] === '잠김', 'toc', '1장 뒤 목차 상태: ' + t.join(','));
  // 끝낸 1장 다시 보기
  await page.locator('.toc-item').nth(1).click(); await W(page);
  ok(await vbtn(page, '펼치기').count() === 1, 'replay', '다시 보기 장 머리가 펼치기가 아님');
  await vbtn(page, '펼치기').click(); await W(page);
  d = await detect(page);
  ok(d.id === 'p1a', 'replay', '다시 보기 첫 단계가 p1a가 아님: ' + d.id);
  ok(await page.locator('.main-inner .tok.need').count() === 0 && await page.locator('.main-inner .tok.done').count() > 0, 'replay', '다시 보기에서 확정한 호칭이 보이지 않음');
  ok(await page.locator('.main-inner .para.show').count() === await page.locator('.main-inner .para').count(), 'replay', '다시 보기인데 글이 다 펼쳐지지 않음');
  ok(await vbtn(page, '쪽 넘기기').isEnabled(), 'replay', '다시 보기에서 쪽 넘기기가 꺼져 있음');
  // 설정 → 처음부터 새로 → 그만두기: 게임이 계속 되어야 한다
  await page.locator('button[aria-label="설정"]').click();
  await page.locator('.sheet button', { hasText: '처음부터 새로' }).click();
  await page.locator('.sheet button', { hasText: '그만두기' }).click();
  await W(page, 200);
  await vbtn(page, '쪽 넘기기').click(); await W(page, 300);
  d = await detect(page);
  ok(d.id === 'c_song', 'settings', '처음부터 새로를 그만둔 뒤 다음 단계로 넘어가지 않음: ' + JSON.stringify(d));
  if (d.id === 'c_song') {
    ok(await page.locator('.main-inner .blank.done').count() === 3, 'replay', '다시 보기에서 푼 사건 빈칸이 채워져 있지 않음');
    ok(await page.locator('.main-inner .explain').count() === 1, 'replay', '다시 보기에서 사건 풀이가 없음');
    await vbtn(page, '다음 ▶').click(); await W(page);
    await vbtn(page, '쪽 넘기기').click(); await W(page); // p1b
    d = await detect(page);
    if (ok(d.kind === 'mapfill', 'replay', '관계도 채우기가 아님 ' + d.kind)) {
      const solved = await page.locator('.main-inner g.node.blank').count() === 0;
      ok(solved, 'replay', '다시 보기에서 이미 채운 관계도를 또 풀어야 함');
      if (!solved) await solveMap(page, d.id, o); else await vbtn(page, '다음 ▶').click();
      await W(page);
    }
    ok(await page.evaluate(() => JSON.stringify(G.save.state.stats)) === stats1, 'replay', '다시 보기에서 첫 시도 기록이 바뀜');
  }
  // 새로고침 뒤 다시 보기 중에도 이어 하기 → 2장
  await page.reload();
  await vbtn(page, '이어 하기').click();
  ok((await page.locator('.topbar .where strong').textContent()) === '옥가락지', 'save', '이어 하기가 2장으로 가지 않음');
  // 처음부터 새로(확인)
  await page.locator('button[aria-label="설정"]').click();
  await page.locator('.sheet button', { hasText: '처음부터 새로' }).click();
  await page.locator('.sheet button', { hasText: '새로 시작' }).click();
  await page.waitForSelector('.sheet h3:has-text("어떻게 읽을까요")');
  let st = await page.evaluate(() => G.save.state);
  ok(!Object.keys(st.done).length && !Object.keys(st.cases).length, 'reset', '처음부터 새로 뒤에도 기록이 남음');
  await page.locator('.sheet button', { hasText: '다시 읽기' }).click();
  await vbtn(page, '네 ▶').waitFor();
  st = await page.evaluate(() => G.save.state);
  ok(st.mode === 'review', 'reset', '다시 읽기를 골랐는데 모드가 ' + st.mode);
  // 타이틀로 → 목차 → 옛 판의 Enter가 새 화면에 끼어들지 않는지
  await page.goto(BASE);
  await seed(page, 'p2a');
  await page.goto(BASE + '?ch=ch2');
  await vbtn(page, '이어서 읽기').click(); await W(page);
  await page.locator('button[aria-label="목차"]').click();
  await page.locator('.overlay button', { hasText: '타이틀로' }).click();
  await W(page, 150);
  const before = JSON.stringify((await page.evaluate(() => G.save.state)).done);
  for (let i = 0; i < 8; i++) await press(page, 'Enter');
  await W(page, 200);
  const after = JSON.stringify((await page.evaluate(() => G.save.state)).done);
  ok(before === after, 'title', '타이틀 화면에서 Enter를 누르자 떠난 장의 단계가 끝난 것으로 기록됨');
  for (const e of page.errs) note(page.tag, e);
  await page.context().close();
}

// ───────── 4. 설정·편람·관계도·키보드 ─────────
async function runUI() {
  log('\n[ui] 설정·편람·관계도·키보드');
  const page = await newPage(VP.phone, 'ui');
  await gotoStep(page, 'p2b');
  let d = await detect(page);
  ok(d.id === 'p2b', 'ui', '시작 단계가 p2b가 아님 ' + JSON.stringify(d));
  // 설정
  await page.locator('button[aria-label="설정"]').click();
  const seg = (label, opt) => page.locator('.sheet div', { has: page.locator('div.small', { hasText: new RegExp('^' + label + '$') }) }).locator('button', { hasText: opt }).first();
  for (const [opt, fs] of [['아주 크게', '1.25'], ['크게', '1.12'], ['보통', '1']]) {
    await seg('글자 크기', opt).click();
    const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs').trim());
    ok(v === fs, 'settings', `글자 크기 ${opt} → --fs ${v}`);
  }
  await seg('효과음', '끄기').click();
  ok((await page.evaluate(() => G.save.state.sound)) === false, 'settings', '효과음 끄기가 저장되지 않음');
  await seg('효과음', '켜기').click();
  await seg('배경음', '켜기').click();
  ok((await page.evaluate(() => G.save.state.music)) === true, 'settings', '배경음 켜기가 저장되지 않음');
  await seg('배경음', '끄기').click();
  await seg('읽기 방식', '다시 읽기').click();
  ok((await page.evaluate(() => G.save.state.mode)) === 'review', 'settings', '읽기 방식이 바뀌지 않음');
  await seg('읽기 방식', '처음 읽기').click();
  await seg('선생님용', '모든 장 열기').click();
  ok((await page.evaluate(() => G.save.state.teacher)) === true, 'settings', '선생님용이 켜지지 않음');
  await page.shot('settings');
  await layoutCheck(page, '설정');
  await page.locator('.sheet button', { hasText: '닫기' }).click();
  // 선생님용: 목차가 모두 열리고, 다음 활동에 정답 채우기
  await page.locator('button[aria-label="목차"]').click();
  const t = await page.locator('.toc-item .st').allTextContents();
  ok(!t.includes('잠김'), 'teacher', '선생님용인데 잠긴 장이 있음');
  await page.locator('.overlay button[aria-label="닫기"]').click();
  await page.goto(BASE); await vbtn(page, '이어 하기').click(); await vbtn(page, '이어서 읽기').click(); await W(page);
  ok(await vbtn(page, '정답 채우기').count() === 1, 'teacher', '선생님용인데 정답 채우기가 없음');
  await page.evaluate(() => { G.save.state.teacher = false; G.save.write(); });
  // 키보드: Enter로 한 줄씩, 편람이 열려 있을 때는 Enter가 뒤쪽 쪽을 넘기지 않아야 함
  const shown = () => page.locator('.main-inner .para.show').count();
  let s0 = await shown();
  await press(page, 'Enter'); await W(page, 80);
  ok(await shown() === s0 + 1, 'keyboard', 'Enter로 다음 줄이 펼쳐지지 않음');
  await page.locator('button[aria-label="편람"]').click();
  await page.waitForSelector('.overlay');
  s0 = await shown();
  await page.locator('.overlay .tab', { hasText: '사건첩' }).focus();
  await page.keyboard.press('Enter'); await W(page, 80);
  ok(await shown() === s0, 'keyboard', '편람이 열린 채 Enter를 누르자 뒤쪽 필사본이 넘어감');
  ok(await page.locator('.overlay .tab.on', { hasText: '사건첩' }).count() === 1, 'keyboard', '편람 탭에서 Enter가 탭을 열지 못함');
  await page.keyboard.press('Escape'); await W(page, 80);
  ok(await page.locator('.overlay').count() === 0, 'keyboard', 'Esc로 편람이 닫히지 않음');
  // 호칭 칸에서 Enter: 그 호칭만 고르고 줄은 넘기지 않아야 함
  const need = page.locator('.main-inner .para.show .tok.need').first();
  if (await need.count()) {
    s0 = await shown();
    await need.focus(); await page.keyboard.press('Enter'); await W(page, 80);
    ok(await shown() === s0, 'keyboard', '호칭 칸에서 Enter를 누르자 다음 줄까지 펼쳐짐');
    ok(await page.locator('.main-inner .tok.sel').count() === 1, 'keyboard', '호칭 칸에서 Enter로 고르지 못함');
    const person = page.locator('.tray .person').first();
    await person.focus(); await page.keyboard.press('Enter'); await W(page, 80);
    ok(await page.locator('.main-inner .tok.pen').count() >= 1, 'keyboard', '인물 칸에서 Enter로 표시하지 못함');
  }
  // 풀이 낱말·자동 표시 풍선
  const gl = page.locator('.main-inner .para.show .gl').first();
  if (await gl.count()) { await gl.click(); ok(await page.locator('.pop').count() === 1, 'gloss', '낱말 풀이 풍선이 뜨지 않음'); await page.locator('.topbar').click({ position: { x: 150, y: 20 } }); await W(page, 80); ok(await page.locator('.pop').count() === 0, 'gloss', '풍선이 닫히지 않음'); }
  const au = page.locator('.main-inner .para.show .auto').first();
  if (await au.count()) { await au.click(); ok(/→/.test(await page.locator('.pop').textContent().catch(() => '')), 'auto', '자동 표시 풍선에 인물이 없음'); await page.mouse.click(5, 300); }
  // 편람 탭 전부
  await page.locator('button[aria-label="편람"]').click();
  for (const tab of ['관계도', '호칭 도감', '사건첩', '이본 노트', '낱말 풀이', '실제와 설정']) {
    await page.locator('.overlay .tab', { hasText: tab }).click(); await W(page, 80);
    const txt = (await page.locator('.overlay .body').textContent()).trim();
    ok(txt.length > 20, 'book', `편람 ${tab}이 비어 있음`);
    await page.shot('book_' + tab);
    await layoutCheck(page, '편람 ' + tab);
  }
  ok(await page.locator('.overlay .tab', { hasText: '작품 노트' }).count() === 0, 'book', '종장 전인데 작품 노트가 보임');
  // 관계도: 인물을 누르면 강조, 한 번 더 누르면 자세히, 빈 곳을 누르면 전체
  await page.locator('.overlay .tab', { hasText: '관계도' }).click();
  const sassi = page.locator('.overlay g.node[aria-label="사씨"]');
  await sassi.click(); await W(page, 80);
  ok(await page.locator('.overlay g.node.sel').count() === 1, 'map', '인물을 눌러도 강조되지 않음');
  ok(/한 번 더/.test(await page.locator('.overlay .maphint').textContent()), 'map', '강조 뒤 안내 글이 바뀌지 않음');
  await mapCheck(page, '편람 관계도(사씨 강조)');
  await page.locator('.overlay g.node[aria-label="사씨"]').click(); await W(page, 150);
  ok(await page.locator('.sheet h3', { hasText: '사씨' }).count() === 1, 'map', '한 번 더 눌러도 자세히 보기가 뜨지 않음');
  await page.shot('map_person');
  await page.keyboard.press('Escape'); await W(page, 80);
  ok(await page.locator('.sheet').count() === 0, 'map', 'Esc로 인물 자세히 보기가 닫히지 않음');
  ok(await page.locator('.overlay').count() === 1, 'map', 'Esc 한 번에 인물 판과 편람이 함께 닫힘');
  if (await page.locator('.sheet').count()) await page.locator('.sheet button', { hasText: '닫기' }).click();
  const box = await page.locator('.overlay .mapbox svg').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.995); await W(page, 80);
  ok(await page.locator('.overlay g.node.sel').count() === 0, 'map', '빈 곳을 눌러도 강조가 풀리지 않음');
  await page.locator('.overlay button[aria-label="닫기"]').click();
  // 관계도 아이콘
  await page.locator('button[aria-label="관계도"]').click();
  ok(await page.locator('.overlay .tab.on', { hasText: '관계도' }).count() === 1, 'map', '관계도 아이콘이 관계도 탭을 열지 않음');
  await page.keyboard.press('Escape');
  // 종장 뒤: 작품 노트 탭, 인물 결말
  await seed(page, null);
  await page.goto(BASE + '?ch=chE');
  await page.locator('button[aria-label="편람"]').click();
  ok(await page.locator('.overlay .tab', { hasText: '작품 노트' }).count() === 1, 'book', '종장 뒤인데 작품 노트가 없음');
  await page.locator('.overlay .tab', { hasText: '작품 노트' }).click();
  await layoutCheck(page, '편람 작품 노트');
  await page.locator('.overlay .tab', { hasText: '관계도' }).click();
  await mapCheck(page, '마지막 관계도(편람)');
  await page.shot('map_final');
  for (const e of page.errs) note(page.tag, e);
  await page.context().close();
}

// ───────── 5. 화면 크기 ─────────
const SCREENS = [
  ['title', async (p) => { await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.goto(BASE); await p.waitForSelector('.title-screen'); await W(p, 300); }],
  ['mode', async (p) => { await vbtn(p, '시작하기').click(); await p.waitForSelector('.sheet'); }],
  ['shop', async (p) => { await p.locator('.sheet button', { hasText: '처음 읽기' }).click(); await vbtn(p, '네 ▶').click(); await vbtn(p, '네 ▶').click(); await W(p, 300); }],
  ['p0b', async (p) => { await gotoStep(p, 'p0b', { font: p.font }); for (let i = 0; i < 8; i++) if (!(await clickIf(p, '다음 줄'))) break; const t = p.locator('.main-inner .tok'); await t.nth(0).click(); await p.locator('.tray .person').first().click(); await W(p, 300); }],
  ['ch1head', async (p) => { await seed(p, 'p1a', { font: p.font }); await p.goto(BASE + '?ch=ch1'); await W(p, 300); }],
  ['c_curse', async (p) => { await gotoStep(p, 'c_curse', { font: p.font }); await p.locator('.main-inner .clue').first().click(); await p.locator('.main-inner .blank').first().click(); await W(p, 300); }],
  ['c_jangju', async (p) => { await gotoStep(p, 'c_jangju', { font: p.font }); for (const c of await p.locator('.main-inner .clue').all()) await c.click(); await W(p, 300); }],
  ['r3', async (p) => { await gotoStep(p, 'r3', { font: p.font }); }],
  ['s4', async (p) => { await gotoStep(p, 's4', { font: p.font }); await p.locator('.main-inner .pool .slip').first().click(); await W(p, 200); }],
  ['rt4', async (p) => { await gotoStep(p, 'rt4', { font: p.font }); for (let i = 0; i < 3; i++) await p.locator('.main-inner .pool .slip').first().click(); await W(p, 200); }],
  ['rv5', async (p) => { await gotoStep(p, 'rv5', { font: p.font }); await W(p, 400); }],
  ['ch_E', async (p) => { await gotoStep(p, 'ch_E', { font: p.font }); await W(p, 400); }],
  ['m1', async (p) => { await gotoStep(p, 'm1', { font: p.font }); await W(p, 300); }],
  ['mE', async (p) => { await gotoStep(p, 'mE', { font: p.font }); await W(p, 300); }],
  ['chEnd', async (p) => { await seed(p, 'c_curse', { font: p.font }); await p.goto(BASE + '?ch=ch1'); await vbtn(p, '펼치기').click(); for (let i = 0; i < 20; i++) { if (await p.locator('.main-inner .seal-mark').count()) break; await p.evaluate(() => document.querySelector('.tray .btn.primary, .tray .btn:not([disabled])')?.click()); await W(p, 120); } await W(p, 300); }],
  ['result', async (p) => { await seed(p, null, { font: p.font, name: '2-3 12 남궁민수', sealed: true, stats: { names: [50, 65], case: [3, 5], map: [1, 2] }, finishedAt: new Date(2026, 5, 15).getTime() }); await p.goto(BASE + '?result=1'); await p.waitForSelector('.colophon'); await W(p, 400); }],
  ['result_colophon', async (p) => { await p.locator('.colophon').scrollIntoViewIfNeeded(); await W(p, 200); }],
  ['toc', async (p) => { await p.locator('button[aria-label="목차"]').click(); await W(p, 200); }],
  ['book_dex', async (p) => { await p.locator('.overlay button[aria-label="닫기"]').click(); await p.locator('button[aria-label="편람"]').click(); await W(p, 200); }],
  ['settings', async (p) => { await p.goto(BASE + '?ch=ch2'); await p.locator('button[aria-label="설정"]').click(); await W(p, 200); }],
];
async function runSizes() {
  log('\n[sizes] 화면 크기');
  const list = [['small', 1], ['phone', 1], ['land', 1], ['tablet', 1], ['laptop', 1], ['wide', 1], ['small', 1.25]];
  for (const [vpName, font] of list) {
    const page = await newPage(VP[vpName], `size_${vpName}${font > 1 ? '_big' : ''}`);
    page.font = font;
    for (const [name, go] of SCREENS) {
      try { await go(page); } catch (e) { note(page.tag, `${name} 화면으로 가지 못함: ${e.message.split('\n')[0]}`); continue; }
      await page.shot(name);
      await layoutCheck(page, name);
    }
    for (const e of page.errs) note(page.tag, e);
    log(`  ${page.tag} 끝`);
    await page.context().close();
  }
}

// ───────── 6. file:// 로 열기 ─────────
async function runFile() {
  log('\n[file] index.html을 파일로 열기');
  const url = pathToFileURL(ROOT + 'index.html').href;
  const page = await newPage(VP.phone, 'file');
  page.errs = []; // 글꼴이 막히는 것은 예상된 일이라 아래에서 따로 거른다
  await startNew(page, 'first', url);
  const o = { mode: 'first' };
  await vbtn(page, '펼치기').click(); await W(page);
  await vbtn(page, '알겠어요').click(); await W(page);
  let d = await detect(page);
  await solvePage(page, d.id, o);
  d = await detect(page);
  ok(d.id === 'p0b', 'file', 'file://에서 두 번째 쪽으로 넘어가지 않음');
  await page.reload();
  ok(await vbtn(page, '이어 하기').count() === 1, 'file', 'file://에서 저장이 되지 않음');
  await gotoStep(page, 'c_ring', {}, url);
  await solveCase(page, 'c_ring', o);
  await page.shot('file_case');
  const errs = page.errs.filter((e) => !/woff2|font|Access to font|net::ERR_FAILED/i.test(e));
  for (const e of errs) note('file', e);
  log(`  파일로 열기: 글꼴 관련 오류 ${page.errs.length - errs.length}개(예상됨), 그 밖의 오류 ${errs.length}개`);
  await page.context().close();
}

// ───────── 7. 자원 크기 ─────────
function runAssets() {
  log('\n[assets] 자원 크기');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
  let total = 0, music = 0;
  for (const f of walk(ROOT + 'assets').filter((f) => !f.includes('/raw/'))) {
    const s = fs.statSync(f).size;
    // 배경음(assets/music)은 장에 들어갈 때 그 곡만 받으므로 따로 센다(곡 크기·합계는 audio.mjs가 본다)
    if (f.includes('/music/')) { music += s; continue; }
    total += s;
    if (s > 320 * 1024) note('assets', `큰 파일 ${f.replace(ROOT, '')} ${Math.round(s / 1024)}KB`);
  }
  log(`  assets 합계 ${Math.round(total / 1024)}KB (그 밖에 배경음 ${Math.round(music / 1024)}KB, 필요할 때 받음)`);
}

const run = { first: () => runPlay('first', 'phone'), review: () => runPlay('review', 'small'), flows: runFlows, save: runSave, ui: runUI, sizes: runSizes, file: runFile, assets: runAssets };
const order = which === 'all' ? Object.keys(run) : which.split(',');
for (const k of order) { try { await run[k](); } catch (e) { note(k, '테스트 중단: ' + e.message.split('\n').slice(0, 3).join(' / ')); } }
await browser.close();
log(`\n결과: 문제 ${issues.length}개`);
process.exit(issues.length ? 1 : 0);
