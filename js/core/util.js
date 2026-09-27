'use strict';
// 공용 도구: DOM 만들기, 글 속 표시 풀기, 섞기 등
window.G = window.G || {};
(function () {
  const U = (G.util = {});

  // h('div.cls#id', {attrs}, children...) — 간단한 요소 생성기
  U.h = function (sel, attrs, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'on') for (const ev in v) el.addEventListener(ev, v[ev]);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    U.append(el, kids);
    return el;
  };
  U.append = function (el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  };
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.shuffle = function (a, seed) {
    a = a.slice();
    let s = seed == null ? Math.random() * 1e9 : seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // 섞되 원래 순서와 같지 않게
  U.shuffleNot = function (a, seed) {
    if (a.length < 2) return a.slice();
    let r, n = 0;
    do { r = U.shuffle(a, seed == null ? null : seed + n); n++; } while (n < 20 && r.every((x, i) => x === a[i]));
    return r;
  };
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // **굵게** → <b>
  U.bold = (s) => U.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  U.boldNodes = function (s) {
    const span = document.createElement('span');
    span.innerHTML = U.bold(s).replace(/\n/g, '<br>');
    return span;
  };

  // 글 속 표시를 조각으로 나눈다.
  //  [호칭|id] → {k:'tag', t, id}   {호칭|id} → {k:'auto', t, id}   **x** → {k:'b', t}   나머지 → {k:'t', t}
  U.parse = function (s) {
    const out = [];
    const re = /\[([^\]|]+)\|([a-z]+)\]|\{([^}|]+)\|([a-z]+)\}|\*\*(.+?)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ k: 't', t: s.slice(last, m.index) });
      if (m[1]) out.push({ k: 'tag', t: m[1], id: m[2] });
      else if (m[3]) out.push({ k: 'auto', t: m[3], id: m[4] });
      else out.push({ k: 'b', t: m[5] });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ k: 't', t: s.slice(last) });
    return out;
  };
  // 표시를 걷어 낸 맨글
  U.plain = (s) => s.replace(/\[([^\]|]+)\|[a-z]+\]|\{([^}|]+)\|[a-z]+\}/g, '$1$2').replace(/\*\*(.+?)\*\*/g, '$1');

  // 낱말 뒤 조사를 받침에 맞춘다: josa('부인', '가 시킨') → '이 시킨'
  //  이/가, 은/는, 을/를, 과/와, 으로/로(ㄹ 받침은 '로')만 바꾸고 나머지는 그대로 둔다
  U.josa = function (word, rest) {
    const m = /^(으로|로|이|가|은|는|을|를|과|와)(?=[\s,.!?]|$)/.exec(rest || '');
    if (!m) return rest;
    const c = String(word).charCodeAt(String(word).length - 1);
    if (!(c >= 0xac00 && c <= 0xd7a3)) return rest;
    const jong = (c - 0xac00) % 28;
    const pairs = { 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 을: ['을', '를'], 를: ['을', '를'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'] };
    const useFirst = m[1] === '으로' || m[1] === '로' ? jong > 0 && jong !== 8 : jong > 0;
    return pairs[m[1]][useFirst ? 0 : 1] + rest.slice(m[1].length);
  };

  // 호칭 → 인물 사전 (낱말 카드 판정용)
  U.personOf = (function () {
    let map = null;
    return function (word) {
      if (!map) {
        map = {};
        for (const id in PEOPLE) {
          const p = PEOPLE[id];
          for (const t of [p.name, p.full, ...p.aliases.map((a) => a.t)]) if (t && t !== '시비') map[t] = map[t] || id;
        }
        map['유 한림'] = 'yeonsu'; map['부인'] = 'sassi';
      }
      return map[word] || null;
    };
  })();

  U.pt = function (id, mood) {
    const p = PEOPLE[id] || (window.FRAME_PEOPLE || {})[id];
    if (!p) return '';
    const name = typeof p.pt === 'string' ? p.pt : (p.pt[mood] || Object.values(p.pt)[0]);
    return 'assets/pt/' + name + '.webp';
  };
})();
