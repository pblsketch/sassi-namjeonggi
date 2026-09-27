// 데이터 점검(브라우저 없이): 호칭 표시·빈칸 정답·관계선·증거 연결·글자 모양을 검사한다.
//   node content.mjs
// 문제가 있으면 목록을 찍고 종료 코드 1로 끝난다.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const sandbox = { window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const f of ['js/data/people.js', 'js/data/story.js', 'js/data/notes.js']) vm.runInContext(fs.readFileSync(ROOT + f, 'utf8'), sandbox, { filename: f });
const { PEOPLE, STORY, NOTES, LINKS } = sandbox;

const problems = [];
const bad = (msg) => problems.push(msg);
const steps = STORY.flatMap((c) => c.steps.map((s) => ({ ...s, ch: c.id })));
const stepIds = new Set(steps.map((s) => s.id));

// 1) 단계 id가 겹치지 않는지, 종류가 알려진 것인지
const TYPES = new Set(['page', 'case', 'card', 'sort', 'route', 'reveal', 'charges', 'reflect', 'mapfill']);
const seenIds = new Set();
for (const s of steps) {
  if (seenIds.has(s.id)) bad(`단계 id 중복: ${s.id}`);
  seenIds.add(s.id);
  if (!TYPES.has(s.type)) bad(`알 수 없는 단계 종류: ${s.id} (${s.type})`);
}

// 2) 글 속 [호칭|인물]·{호칭|인물}이 people.js의 호칭과 맞는지
const texts = [];
for (const s of steps) {
  if (s.type !== 'page') continue;
  s.paras.forEach((pa, i) => {
    if (typeof pa === 'string') texts.push({ where: `${s.id}#${i}`, t: pa });
    else if (pa.t) {
      texts.push({ where: `${s.id}#${i}`, t: pa.t });
      if (!PEOPLE[pa.who]) bad(`${s.id}#${i}: 말하는 인물 없음 ${pa.who}`);
    }
  });
}
let tagCount = 0, autoCount = 0;
for (const { where, t } of texts) {
  for (const m of t.matchAll(/\[([^\]|]+)\|([a-z]+)\]|\{([^}|]+)\|([a-z]+)\}/g)) {
    const word = m[1] || m[3], id = m[2] || m[4];
    if (m[1]) tagCount++; else autoCount++;
    const p = PEOPLE[id];
    if (!p) { bad(`${where}: 없는 인물 id ${id}`); continue; }
    const names = [p.name, p.full, ...p.aliases.map((a) => a.t)];
    if (!names.includes(word)) bad(`${where}: 「${word}」은(는) ${id}의 호칭 목록에 없음`);
  }
  // 짝이 맞지 않는 괄호
  const plain = t.replace(/\[([^\]|]+)\|([a-z]+)\]|\{([^}|]+)\|([a-z]+)\}/g, '');
  if (/[\[\]{}|]/.test(plain)) bad(`${where}: 표시 괄호가 짝이 맞지 않음 — ${t}`);
  if ((t.match(/\*\*/g) || []).length % 2) bad(`${where}: ** 짝이 맞지 않음`);
}

// 3) 사건 복원: 빈칸 정답을 게임 안에서 주울 수 있는지
const personOf = (() => {
  const map = {};
  for (const id in PEOPLE) { const p = PEOPLE[id]; for (const t of [p.name, p.full, ...p.aliases.map((a) => a.t)]) if (t && t !== '시비') map[t] = map[t] || id; }
  map['유 한림'] = 'yeonsu'; map['부인'] = 'sassi';
  return (w) => map[w] || null;
})();
for (const s of steps.filter((x) => x.type === 'case')) {
  const collectable = new Set([...(s.spots || []).flatMap((x) => x.words), ...(s.clues || []).flatMap((x) => x.words)]);
  const bank = new Set(s.bank || []);
  const keys = [...s.lines.join(' ').matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  if (new Set(keys).size !== keys.length) bad(`${s.id}: 빈칸 이름이 겹침`);
  for (const k of keys) {
    const def = s.blanks[k];
    if (!def) { bad(`${s.id}: 빈칸 [${k}]의 정답 정의 없음`); continue; }
    if (def.person) {
      if (!PEOPLE[def.person]) bad(`${s.id}: [${k}] 없는 인물 ${def.person}`);
      const ok = [...collectable].some((w) => personOf(w) === def.person);
      if (!ok) bad(`${s.id}: [${k}](${def.person})에 맞는 낱말을 조사 지점·쪽지에서 주울 수 없음`);
    } else if (!collectable.has(def.word)) bad(`${s.id}: [${k}] 정답 낱말 「${def.word}」을 주울 수 없음`);
  }
  for (const k in s.blanks) if (!keys.includes(k)) bad(`${s.id}: 쓰이지 않는 빈칸 정의 ${k}`);
  // 오답 낱말(bank)이 정답이 되어 버리지 않는지
  for (const w of bank) for (const k of keys) {
    const def = s.blanks[k];
    if (def && (def.person ? personOf(w) === def.person : w === def.word)) bad(`${s.id}: 오답용 낱말 「${w}」이 [${k}]의 정답이 됨`);
  }
  for (const sp of s.spots || []) if (sp.x < 5 || sp.x > 95 || sp.y < 5 || sp.y > 95) bad(`${s.id}: 조사 지점이 그림 가장자리 밖 (${sp.label})`);
  if (!s.evidence || !s.evidence.title) bad(`${s.id}: 사건첩 제목 없음`);
}

// 4) 관계선: at·states가 실제 단계 id인지, 인물이 있는지
const order = steps.map((s) => s.id);
for (const l of LINKS) {
  if (!PEOPLE[l.a] || !PEOPLE[l.b]) bad(`관계선 ${l.a}-${l.b}: 없는 인물`);
  if (!stepIds.has(l.at)) bad(`관계선 ${l.a}-${l.b}: at ${l.at}은(는) 없는 단계`);
  for (const st of l.states || []) {
    if (!stepIds.has(st[0])) bad(`관계선 ${l.a}-${l.b}: states ${st[0]}은(는) 없는 단계`);
    else if (order.indexOf(st[0]) < order.indexOf(l.at)) bad(`관계선 ${l.a}-${l.b}: states ${st[0]}이 at보다 앞`);
  }
  if (!['bond', 'ally', 'foe', 'help'].includes(l.kind)) bad(`관계선 ${l.a}-${l.b}: 알 수 없는 kind ${l.kind}`);
}
// 같은 두 사람 사이의 선(겹쳐 그려지므로 화면에서 따로 처리해야 함)
const pairs = {};
for (const l of LINKS) { const k = [l.a, l.b].sort().join('~'); (pairs[k] = pairs[k] || []).push(l.label); }
const dupPairs = Object.entries(pairs).filter(([, v]) => v.length > 1);

// 5) 관계도 채우기: 빈자리 인물이 그 시점까지 관계선으로 이어져 있는지
for (const s of steps.filter((x) => x.type === 'mapfill')) {
  const upto = new Set(order.slice(0, order.indexOf(s.id)));
  for (const b of s.blanks) {
    if (!PEOPLE[b]) bad(`${s.id}: 없는 인물 ${b}`);
    const n = LINKS.filter((l) => upto.has(l.at) && (l.a === b || l.b === b)).length;
    if (!n) bad(`${s.id}: 빈자리 ${b}에 이어진 선이 아직 없음(단서 없음)`);
  }
}

// 6) 증거: reveal·charges가 가리키는 사건첩 항목이 앞에서 만들어지는지
const evidenceAt = {};
for (const s of steps) {
  if (s.type === 'case') evidenceAt[s.id] = order.indexOf(s.id);
  if (s.evidence && s.evidence.id) evidenceAt[s.evidence.id] = order.indexOf(s.id);
}
for (const s of steps.filter((x) => x.type === 'reveal' || x.type === 'charges')) {
  const items = s.type === 'reveal' ? s.lines : s.charges;
  const evs = items.map((x) => x.ev);
  if (s.type === 'charges' && new Set(evs).size !== evs.length) bad(`${s.id}: 같은 증거를 두 죄목에 씀`);
  for (const ev of evs) {
    if (evidenceAt[ev] == null) bad(`${s.id}: 증거 ${ev}이(가) 없음`);
    else if (evidenceAt[ev] > order.indexOf(s.id)) bad(`${s.id}: 증거 ${ev}이(가) 이 단계보다 뒤에 나옴`);
  }
  if (s.type === 'reveal' && !PEOPLE[s.who]) bad(`${s.id}: 고백하는 인물 없음`);
}

// 7) 나누어 담기·순서
for (const s of steps.filter((x) => x.type === 'sort')) for (const c of s.cards) if (!s.bins.some((b) => b.id === c.bin)) bad(`${s.id}: 「${c.t}」의 칸 ${c.bin} 없음`);
for (const s of steps.filter((x) => x.type === 'route')) {
  const ids = s.cards.map((c) => c.id);
  if (ids.length !== s.order.length || !s.order.every((id) => ids.includes(id))) bad(`${s.id}: order와 cards가 맞지 않음`);
}
for (const s of steps.filter((x) => x.type === 'reflect')) if (!s.options || s.options.length < 2) bad(`${s.id}: 보기 부족`);

// 8) 그림 파일
const ASSET = (p) => fs.existsSync(ROOT + p);
const missing = [];
for (const s of steps) {
  if (s.scene && !ASSET(`assets/sc/${s.scene}.webp`)) missing.push(`${s.id}: assets/sc/${s.scene}.webp`);
  if (s.map && !ASSET(`assets/sc/${s.map}.webp`)) missing.push(`${s.id}: assets/sc/${s.map}.webp`);
}
for (const id in PEOPLE) for (const f of Object.values(typeof PEOPLE[id].pt === 'string' ? { a: PEOPLE[id].pt } : PEOPLE[id].pt)) if (!ASSET(`assets/pt/${f}.webp`)) bad(`초상 없음: ${id} ${f}`);
for (const id in sandbox.FRAME_PEOPLE) if (!ASSET(`assets/pt/${sandbox.FRAME_PEOPLE[id].pt}.webp`)) bad(`초상 없음: ${id}`);
for (const f of ['assets/ui/paper.webp', 'assets/ui/title_art.webp', 'assets/sc/sc_bookshop.webp', 'assets/ui/icon-192.png', 'assets/ui/icon-512.png', 'assets/ui/og-image.jpg', 'assets/fonts/myeongjo.woff2', 'assets/fonts/myeongjo-bold.woff2', 'assets/fonts/brush.woff2']) if (!ASSET(f)) bad(`파일 없음: ${f}`);

// 9) 인물 위치: 관계도 동그라미(반지름 5)가 겹치지 않는지
const ids = Object.keys(PEOPLE);
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const [x1, y1] = PEOPLE[ids[i]].pos, [x2, y2] = PEOPLE[ids[j]].pos;
  if (Math.hypot(x1 - x2, y1 - y2) < 12) bad(`관계도 인물이 너무 가까움: ${ids[i]} ${ids[j]}`);
}

// 9-2) 관계선이 다른 인물의 얼굴 위를 지나가지 않는지(지나가면 그 인물과 이어진 것처럼 보인다)
for (const l of LINKS) {
  const [ax, ay] = PEOPLE[l.a].pos, [bx, by] = PEOPLE[l.b].pos;
  for (const id of ids) {
    if (id === l.a || id === l.b) continue;
    const [px, py] = PEOPLE[id].pos;
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const d = Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py);
    if (d < 6.2) bad(`관계선 ${l.a}-${l.b}(${l.label})이 ${id}의 얼굴 위를 지나감 (거리 ${d.toFixed(1)})`);
  }
}

// 10) 글자 모양: 겹친 띄어쓰기, 문장 부호 앞 띄어쓰기, 괄호 짝
const allText = [];
const walk = (o, path) => {
  if (typeof o === 'string') allText.push({ path, t: o });
  else if (Array.isArray(o)) o.forEach((x, i) => walk(x, path + '[' + i + ']'));
  else if (o && typeof o === 'object') for (const k in o) if (!['id', 'type', 'kind', 'who', 'ev', 'bin', 'color', 'pt', 'side', 'scene', 'map', 'at'].includes(k)) walk(o[k], path + '.' + k);
};
walk(STORY, 'STORY'); walk(PEOPLE, 'PEOPLE'); walk(NOTES, 'NOTES');
for (const { path, t } of allText) {
  if (/ {2,}/.test(t)) bad(`${path}: 띄어쓰기 두 칸 — ${t.slice(0, 40)}`);
  if (/ [,.!?)」』]/.test(t)) bad(`${path}: 문장 부호 앞 빈칸 — ${t.slice(0, 40)}`);
  if (/^\s|\s$/.test(t) && t.trim()) bad(`${path}: 앞뒤 빈칸 — 「${t}」`);
  for (const [a, b] of [['(', ')'], ['「', '」'], ['『', '』']]) if (t.split(a).length !== t.split(b).length) bad(`${path}: 괄호 ${a}${b} 짝 — ${t.slice(0, 50)}`);
  if (/[.?!][가-힣]/.test(t.replace(/\d\.\d/g, ''))) bad(`${path}: 문장 부호 뒤 띄어쓰기 없음 — ${t.slice(0, 50)}`);
}

// 요약
const tokenTotal = texts.reduce((n, x) => n + [...x.t.matchAll(/\[([^\]|]+)\|([a-z]+)\]/g)].length, 0);
console.log(`단계 ${steps.length}개, 호칭 잇기 ${tagCount}곳, 자동 표시 ${autoCount}곳, 사건 ${steps.filter((x) => x.type === 'case').length}건, 관계선 ${LINKS.length}개`);
console.log(`인물 ${ids.length}명, 호칭 ${Object.values(PEOPLE).reduce((n, p) => n + p.aliases.length, 0)}개, 호칭 잇기 칸 ${tokenTotal}곳`);
if (dupPairs.length) console.log('같은 두 사람 사이의 선(따로 벌려 그려야 함):', dupPairs.map(([k, v]) => `${k}(${v.join('/')})`).join(', '));
if (missing.length) console.log('아직 없는 그림(알려진 것, 자리는 숨김):', missing.join(', '));
console.log(problems.length ? `문제 ${problems.length}개` : '문제 없음');
for (const p of problems) console.log(' -', p);
process.exit(problems.length ? 1 : 0);
