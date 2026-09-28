// 소리 점검: 곡 악보·음량·클리핑, 장면마다 곡이 바뀌는지, 배경음·효과음 켜고 끄기.
//   cd tests && node audio.mjs [--preview]
// --preview: 곡마다 20초 미리 듣기 파일(design/audio_preview/*.wav, ffmpeg가 있으면 .mp3도)을 만든다.
// 게임 폴더를 http://127.0.0.1:8765 에서 서빙하고 있어야 한다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8765/index.html';
const PREVIEW = process.argv.includes('--preview');
const problems = [];
const bad = (m) => { problems.push(m); console.log('  ✗ ' + m); };

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const warns = [];
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('악보'))) warns.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => warns.push('pageerror: ' + e.message));

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.waitForSelector('.title-screen');

// 1) 데이터: STORY의 music이 모두 곡 목록에 있는지
const names = await page.evaluate(() => {
  const used = new Set();
  for (const c of STORY) { if (c.music) used.add(c.music); for (const s of c.steps) if (s.music) used.add(s.music); }
  return { used: [...used], tracks: Object.keys(G.audio.TRACKS), chNoMusic: STORY.filter((c) => !c.music).map((c) => c.id) };
});
console.log('곡:', names.tracks.join(', '));
for (const u of names.used) if (!names.tracks.includes(u)) bad('없는 곡 이름: ' + u);
for (const c of names.chNoMusic) bad('곡이 없는 장: ' + c);
for (const t of names.tracks) if (!names.used.includes(t) && !['shop', 'finale'].includes(t)) bad('쓰지 않는 곡: ' + t);

// 2) 곡마다 오프라인 렌더 → 음량(RMS)·최고치·마디 길이
const report = await page.evaluate(async (preview) => {
  const out = [];
  for (const name of Object.keys(G.audio.TRACKS)) {
    const def = G.audio.TRACKS[name];
    const L = G.audio._parse(def.lead.mel, def.mode, def.tonic);
    const buf = await G.audio.render(name, 20, 44100);
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; n++; }
    }
    const row = { name, bars: L.len / def.bar, loopSec: +(L.len * def.unit).toFixed(1), peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / n)).toFixed(1) };
    if (preview) {
      // 22.05kHz 모노 16비트 WAV로 줄여 base64로 넘긴다
      const L0 = buf.getChannelData(0), R0 = buf.getChannelData(1), step = 2, len = Math.floor(L0.length / step);
      const ab = new ArrayBuffer(44 + len * 2), dv = new DataView(ab);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + len * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 22050, true); dv.setUint32(28, 44100, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, len * 2, true);
      for (let i = 0; i < len; i++) { const v = Math.max(-1, Math.min(1, (L0[i * step] + R0[i * step]) / 2)); dv.setInt16(44 + i * 2, v * 32767, true); }
      let bin = ''; const u8 = new Uint8Array(ab);
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      row.wav = btoa(bin);
    }
    out.push(row);
  }
  return out;
}, PREVIEW);

console.log('\n곡          마디  한바퀴(초)  최고치   RMS(dB)');
for (const r of report) {
  console.log(`${r.name.padEnd(10)} ${String(r.bars).padStart(5)} ${String(r.loopSec).padStart(10)} ${String(r.peak).padStart(8)} ${String(r.rmsDb).padStart(9)}`);
  if (!Number.isInteger(r.bars)) bad(`${r.name}: 마디 수가 딱 떨어지지 않음(${r.bars})`);
  if (r.peak >= 0.99) bad(`${r.name}: 소리가 찢어질 수 있음(최고치 ${r.peak})`);
  if (r.rmsDb < -40) bad(`${r.name}: 너무 작음(${r.rmsDb} dB)`);
  if (r.rmsDb > -14) bad(`${r.name}: 너무 큼(${r.rmsDb} dB)`);
}
const dbs = report.map((r) => r.rmsDb);
if (Math.max(...dbs) - Math.min(...dbs) > 4) bad(`곡 사이 음량 차이가 큼(${Math.min(...dbs)} ~ ${Math.max(...dbs)} dB)`);

if (PREVIEW) {
  const dir = new URL('../design/audio_preview/', import.meta.url);
  fs.mkdirSync(fileURLToPath(dir), { recursive: true });
  let ff = null;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); ff = 'ffmpeg'; } catch (e) { /* ffmpeg 없음 */ }
  for (const r of report) {
    const wav = fileURLToPath(new URL(r.name + '.wav', dir));
    fs.writeFileSync(wav, Buffer.from(r.wav, 'base64'));
    if (ff) { execFileSync(ff, ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '96k', wav.replace(/\.wav$/, '.mp3')]); fs.unlinkSync(wav); }
  }
  console.log('\n미리 듣기 파일:', fileURLToPath(dir), ff ? '(mp3)' : '(wav)');
}

// 3) 실제 재생: 첫 터치 → 세책방 곡, 장에 들어가면 장의 곡, 단계의 곡, 배경음 끄기
const now = () => page.evaluate(() => ({ track: G.audio.track, playing: G.audio.now(), state: G.audio.ctx && G.audio.ctx.state }));
await page.locator('.music-toggle').waitFor();
await page.mouse.click(10, 400); // 첫 터치(소리 풀기)
await page.waitForTimeout(400);
let s = await now();
console.log('\n타이틀:', JSON.stringify(s));
if (s.playing !== 'shop') bad('타이틀에서 세책방 곡이 나오지 않음: ' + JSON.stringify(s));
if (s.state !== 'running') bad('소리 장치가 켜지지 않음: ' + s.state);

await page.locator('.music-toggle').click();
await page.waitForTimeout(300);
s = await now();
if (s.playing !== null) bad('타이틀 배경음 끄기가 안 됨: ' + JSON.stringify(s));
if (await page.evaluate(() => G.save.state.music) !== false) bad('배경음 끄기가 저장되지 않음');
await page.locator('.music-toggle').click();
await page.waitForTimeout(300);
if ((await now()).playing !== 'shop') bad('타이틀 배경음 다시 켜기가 안 됨');

for (const [ch, want] of [['ch0', 'peace'], ['ch3', 'sorrow'], ['chE', 'resolve']]) {
  await page.evaluate((id) => { G.save.state.teacher = true; G.app.play(id); }, ch);
  await page.waitForTimeout(500);
  s = await now();
  console.log(ch + ':', JSON.stringify(s));
  if (s.playing !== want) bad(`${ch}에서 ${want} 곡이 나오지 않음: ${s.playing}`);
}
// 단계의 곡: 4장 황릉묘의 꿈(p4b)까지 넘겨 본다
await page.evaluate(() => { const st = G.save.state; for (const id of ['n4', 'p4a']) st.done[id] = true; G.save.write(); G.app.play('ch4'); });
await page.waitForTimeout(400);
await page.locator('button', { hasText: '이어서 읽기' }).first().click();
await page.waitForTimeout(600);
s = await now();
console.log('ch4 p4b:', JSON.stringify(s));
if (s.playing !== 'dream') bad('꿈 장면에서 꿈 곡이 나오지 않음: ' + s.playing);

// 결과 화면
await page.evaluate(() => G.app.result());
await page.waitForTimeout(500);
if ((await now()).playing !== 'finale') bad('결과 화면에서 마무리 곡이 나오지 않음');

// 효과음이 오류 없이 나는지
const sfxErr = await page.evaluate(() => { const e = []; for (const k of ['tap', 'pick', 'pencil', 'page', 'stamp', 'ok', 'no', 'hint', 'inspect', 'clue', 'chapter', 'fanfare']) { try { G.audio[k](); } catch (x) { e.push(k + ': ' + x.message); } } return e; });
sfxErr.forEach(bad);
// 설정에서 배경음 끄기
await page.evaluate(() => { G.save.state.music = false; G.audio.music(false); });
await page.waitForTimeout(300);
if ((await now()).playing !== null) bad('설정에서 배경음을 꺼도 곡이 계속됨');

warns.forEach((w) => bad(w));
await browser.close();
console.log(problems.length ? `\n문제 ${problems.length}개` : '\n문제 0개');
process.exit(problems.length ? 1 : 0);
