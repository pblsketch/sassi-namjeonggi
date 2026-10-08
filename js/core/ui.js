'use strict';
// 화면 부품: 알림, 풍선 도움말, 아래 판(시트), 도장 효과, 카드, 관계도(SVG)
(function () {
  const { h, $, $$ } = G.util;
  const ui = (G.ui = {});

  ui.toast = function (text, ms = 1800) {
    const el = h('div.toast', text);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };

  // 풍선 도움말: 요소 가까이에 뜬다. 아무 곳이나 누르면 닫힌다
  let popEl = null;
  ui.pop = function (anchor, html) {
    ui.unpop();
    popEl = h('div.pop', { html });
    document.body.appendChild(popEl);
    const r = anchor.getBoundingClientRect(), pr = popEl.getBoundingClientRect();
    let x = r.left + r.width / 2 - pr.width / 2, y = r.top - pr.height - 8;
    if (y < 60) y = r.bottom + 8;
    x = G.util.clamp(x, 8, window.innerWidth - pr.width - 8);
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px';
    setTimeout(() => document.addEventListener('pointerdown', ui.unpop, { once: true }), 0);
  };
  ui.unpop = function () { if (popEl) { popEl.remove(); popEl = null; } };

  // 아래에서 올라오는 판. 버튼을 누르면 닫히고 그 값을 돌려준다
  ui.sheet = function (content, buttons = [{ label: '닫기', value: true, cls: 'primary' }], opt = {}) {
    return new Promise((resolve) => {
      const back = h('div.sheet-back');
      const box = h('div.sheet', content);
      const acts = h('div.actions');
      for (const b of buttons) {
        acts.appendChild(h('button.btn' + (b.cls ? '.' + b.cls : ''), { on: { click: () => { G.audio.tap(); close(b.value); } } }, b.label));
      }
      box.appendChild(acts);
      back.appendChild(box);
      if (opt.dismiss !== false) back.addEventListener('click', (e) => { if (e.target === back) close(null); });
      // Esc로 닫기(고르지 않고 닫으면 안 되는 판은 제외)
      const onKey = (e) => { if (e.key === 'Escape' && opt.dismiss !== false && back.isConnected) { e.preventDefault(); close(null); } };
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
      const first = acts.querySelector('.btn.primary, .btn.seal') || acts.querySelector('.btn');
      if (first) setTimeout(() => first.focus(), 50);
      function close(v) { document.removeEventListener('keydown', onKey); back.remove(); resolve(v); }
    });
  };

  // 도장 글자는 한자로 찍고, 아래에 한글 읽기를 함께 보인다
  const STAMP_READ = { 確認: '확인', 復元: '복원', 斷罪: '단죄' };
  ui.stamp = async function (text = '確認') {
    G.audio.stamp();
    const el = h('div.stampfx', { 'aria-hidden': 'true' }, h('span.han', text), STAMP_READ[text] ? h('span.rd', STAMP_READ[text]) : null);
    document.body.appendChild(el);
    ui.inkBurst(window.innerWidth / 2, window.innerHeight * 0.42);
    await G.util.wait(1400);
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
  };
  ui.inkBurst = function (x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      const d = h('div.ink');
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 60, s = 4 + Math.random() * 9;
      Object.assign(d.style, { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', opacity: .8, transition: 'transform .6s ease-out, opacity .7s' });
      document.body.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`; d.style.opacity = 0; });
      setTimeout(() => d.remove(), 800);
    }
  };
  ui.shake = function (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

  // 알림 카드(게임 설정·이본 노트·해설·해석)
  const KIND = { fiction: '게임 설정 · 虛', variant: '이본 노트', note: '알아 두기', interp: '해석', orig: '原文' };
  ui.card = function (c) {
    const el = h('div.card.' + (c.kind || 'note'),
      h('span.kind', KIND[c.kind] || ''),
      h('h3', c.title),
      ...String(c.body || '').split('\n').map((line) => h('p', G.util.boldNodes(line))));
    if (c.real) el.appendChild(h('div.real', h('p', h('strong', '실제로는 → '), G.util.boldNodes(c.real))));
    return el;
  };

  ui.orig = function (hm) {
    return h('div.orig',
      h('span.seal-mark', '原文'),
      h('div.han', hm.han),
      h('div.rd', hm.read),
      h('div.gl2', hm.gloss),
      hm.note ? h('div.nt', hm.note) : null);
  };

  ui.personChip = function (id, opt = {}) {
    const p = PEOPLE[id];
    const el = h('button.person', { type: 'button', style: { '--pc': p.color }, dataset: { id } },
      h('img', { src: G.util.pt(id, opt.mood), alt: '' }), h('span', p.name));
    return el;
  };

  // ───────── 관계도 ─────────
  const EDGE = { bond: '#2a2119', ally: '#7b3f8c', foe: '#b3342a', help: '#1f7474' };
  // 지금까지 열린 관계선과 그 상태
  ui.links = function (doneSet) {
    const out = [];
    for (const l of LINKS) {
      if (!doneSet[l.at]) continue;
      let label = l.label, kind = l.kind, dash = false;
      for (const st of l.states || []) if (doneSet[st[0]]) { label = st[1]; kind = st[2]; dash = st[3]; }
      out.push({ a: l.a, b: l.b, label, kind, dash, at: l.at });
    }
    return out;
  };
  ui.visiblePeople = function (doneSet, met) {
    const ids = new Set(Object.keys(met || {}));
    for (const l of ui.links(doneSet)) { ids.add(l.a); ids.add(l.b); }
    return [...ids].filter((id) => PEOPLE[id]);
  };

  // opt: { done, met, blanks:[id], placed:{blankId: personId}, sel, newly:Set, title,
  //        onNode(id)  : 누르면 바로 불림(관계도 채우기용)
  //        onOpen(id)  : 한 번 누르면 그 인물의 관계가 강조되고, 한 번 더 누르면 불림(보기용)
  //        labelsFor   : 이 인물들과 이어진 선은 늘 관계 이름을 보여 줌 }
  // 선이 적으면(10개 이하) 관계 이름을 모두 보이고, 많으면 고른 인물의 선만 보인다.
  ui.map = function (opt) {
    const box = h('div.mapbox');
    let sel = opt.sel || null;
    const draw = () => {
      box.innerHTML = '';
      if (opt.title) box.appendChild(h('div.maptitle', opt.title));
      box.appendChild(drawSvg());
      box.appendChild(h('div.legend',
        h('span', h('i', { style: { borderColor: EDGE.bond } }), '가족·혼인·주종'),
        h('span', h('i', { style: { borderColor: EDGE.ally, borderTopStyle: 'dotted' } }), '한패'),
        h('span', h('i', { style: { borderColor: EDGE.foe } }), '미움·모함'),
        h('span', h('i', { style: { borderColor: EDGE.help } }), '도움')));
      if (opt.onOpen && hintNeeded) box.appendChild(h('div.maphint', sel ? '같은 인물을 한 번 더 누르면 자세히 볼 수 있어요 · 빈 곳을 누르면 전체 보기' : '인물을 누르면 그 인물의 관계 이름이 보여요'));
    };
    let hintNeeded = false;
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    function drawSvg() {
      // 세로 0~125: 맨 아래 인물(y 114)의 이름까지 잘리지 않게
      const svg = mk('svg', { viewBox: '0 0 100 125', role: 'img', 'aria-label': '인물 관계도' });
      const defs = mk('defs', {});
      svg.appendChild(defs);
      const links = ui.links(opt.done);
      const people = ui.visiblePeople(opt.done, opt.met);
      const masked = new Set(opt.mask || []); // 이름·얼굴을 가리는 인물(관계도 채우기 중인 빈자리)
      for (const b of [...(opt.blanks || []), ...masked]) if (!people.includes(b)) people.push(b);
      const pos = (id) => PEOPLE[id].pos;
      const R = 5;
      const shownLinks = links.filter((l) => people.includes(l.a) && people.includes(l.b));
      const always = new Set(opt.labelsFor || []);
      const showAll = shownLinks.length <= 10;
      const gEdges = mk('g', {}), gLabels = mk('g', {}), gNodes = mk('g', {});
      svg.append(gEdges, gNodes, gLabels);
      // 같은 두 사람 사이의 선이 여럿이면(예: 문객으로 들임·모함) 나란히 벌려 그린다
      const pairKey = (l) => [l.a, l.b].sort().join('~');
      const pairN = {}, pairI = new Map();
      for (const l of shownLinks) { const k = pairKey(l); pairN[k] = (pairN[k] || 0) + 1; pairI.set(l, pairN[k] - 1); }
      const geo = (l) => {
        const [a, b] = [l.a, l.b].sort(), [ax, ay] = pos(a), [bx, by] = pos(b);
        const n = pairN[pairKey(l)], off = (pairI.get(l) - (n - 1) / 2) * 2.2;
        const len = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / len, ny = (bx - ax) / len;
        return { x1: ax + nx * off, y1: ay + ny * off, x2: bx + nx * off, y2: by + ny * off };
      };
      // 선 이름은 인물 얼굴·이름이나 다른 선 이름과 겹치지 않는 자리를 선 위에서 찾아 놓는다
      const textW = (s, fs) => [...String(s)].reduce((w, ch) => w + (ch === ' ' ? 0.32 : /[가-힣一-鿿]/.test(ch) ? 1 : 0.62) * fs, 0);
      const hit = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
      const nodeBoxes = people.map((id) => { const [x, y] = pos(id), w = Math.max(R + 0.5, textW(PEOPLE[id].name, 2.8) / 2 + 0.3); return [x - w, y - R - 0.5, x + w, y + R + 3.9]; });
      const taken = [];
      const placeLabel = (g, text, fs) => {
        const w = textW(text, fs) + 1.6, hh = fs * 1.35; // 둘레에 조금 여유를 둔다
        const at = (t) => { const cx = g.x1 + (g.x2 - g.x1) * t, cy = g.y1 + (g.y2 - g.y1) * t; return { cx, cy, box: [cx - w / 2, cy - hh / 2, cx + w / 2, cy + hh / 2] }; };
        let best = null;
        for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.27, 0.73]) {
          const c = at(t);
          if (c.box[0] < 0 || c.box[2] > 100 || nodeBoxes.some((b) => hit(c.box, b)) || taken.some((b) => hit(c.box, b))) continue;
          best = c; break;
        }
        if (!best) for (const t of [0.5, 0.42, 0.58, 0.34, 0.66]) { const c = at(t); if (!taken.some((b) => hit(c.box, b))) { best = c; break; } }
        best = best || at(0.5);
        taken.push(best.box);
        return best;
      };
      const labeled = [];
      for (const l of shownLinks) {
        const g = geo(l);
        const mine = sel && (l.a === sel || l.b === sel);
        const dim = sel && !mine;
        gEdges.appendChild(mk('line', { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, stroke: EDGE[l.kind], 'stroke-width': mine ? 1.1 : l.kind === 'bond' ? 0.7 : 0.6, 'stroke-dasharray': l.dash ? '1.6 1.2' : l.kind === 'ally' ? '0.5 0.9' : '', opacity: dim ? 0.18 : 0.85, 'stroke-linecap': 'round' }));
        if (mine || (!sel && showAll) || always.has(l.a) || always.has(l.b)) labeled.push({ l, g, fs: mine ? 2.9 : 2.4 });
      }
      for (const { l, g, fs } of labeled) {
        const c = placeLabel(g, l.label, fs);
        const t = mk('text', { x: c.cx, y: c.cy + fs * 0.36, 'text-anchor': 'middle', 'font-size': fs, fill: EDGE[l.kind], class: 'edge-label' });
        t.textContent = l.label;
        gLabels.appendChild(t);
      }
      for (const id of people) {
        const p = PEOPLE[id], [x, y] = pos(id);
        const isMasked = masked.has(id);
        const isBlank = (opt.blanks || []).includes(id) || isMasked;
        const shown = isMasked ? null : isBlank ? (opt.placed || {})[id] : id;
        const faded = sel && sel !== id && !shownLinks.some((l) => (l.a === sel && l.b === id) || (l.b === sel && l.a === id));
        const g = mk('g', { class: 'node' + (isBlank ? ' blank' : '') + (sel === id ? ' sel' : '') + (opt.newly && opt.newly.has(id) ? ' newly' : ''), transform: `translate(${x} ${y})`, tabindex: 0, opacity: faded ? 0.4 : 1, role: 'button', 'aria-label': isBlank ? '빈자리' : p.name });
        const clipId = 'c-' + id + '-' + Math.random().toString(36).slice(2, 7);
        const cp = mk('clipPath', { id: clipId }); cp.appendChild(mk('circle', { r: R, cx: 0, cy: 0 })); defs.appendChild(cp);
        g.appendChild(mk('circle', { r: R + 0.4, fill: '#fffaf0' }));
        if (shown) {
          const img = mk('image', { href: G.util.pt(shown), x: -R, y: -R, width: R * 2, height: R * 2, 'clip-path': `url(#${clipId})`, preserveAspectRatio: 'xMidYMid slice' });
          if (isBlank) img.setAttribute('opacity', 0.75);
          g.appendChild(img);
        } else {
          const q = mk('text', { y: 1.6, 'text-anchor': 'middle', 'font-size': 5, 'font-weight': 800, fill: '#8b7a64' }); q.textContent = '?'; g.appendChild(q);
        }
        g.appendChild(mk('circle', { class: 'ring', r: R, fill: 'none', stroke: isBlank && !shown ? '#8b7a64' : (PEOPLE[shown] || p).color, 'stroke-width': 0.9 }));
        const nm = mk('text', { y: R + 3.1, 'text-anchor': 'middle', 'font-size': 2.8, fill: '#2a2119', class: 'node-label' });
        nm.textContent = isBlank ? (shown ? PEOPLE[shown].name : '?') : p.name;
        g.appendChild(nm);
        const act = () => {
          if (opt.onNode) return opt.onNode(id, g);
          if (!opt.onOpen || isMasked) return;
          if (sel === id) opt.onOpen(id);
          else { sel = id; G.audio.tap(); draw(); }
        };
        g.addEventListener('click', (e) => { e.stopPropagation(); act(); });
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        gNodes.appendChild(g);
      }
      if (opt.onOpen) svg.addEventListener('click', () => { if (sel) { sel = null; draw(); } });
      if (!people.length) {
        const t = mk('text', { x: 50, y: 60, 'text-anchor': 'middle', 'font-size': 3.5, fill: '#8b7a64' }); t.textContent = '아직 만난 인물이 없어요'; svg.appendChild(t);
      }
      hintNeeded = !!people.length;
      return svg;
    }
    draw();
    return box;
  };

  // 인물 상세(관계도·도감에서 누를 때)
  ui.personInfo = function (id) {
    const S = G.save.state, p = PEOPLE[id];
    const known = p.aliases.filter((a) => S.aliases[id + '|' + a.t]);
    return h('div',
      h('div.row-gap', h('img', { src: G.util.pt(id), alt: '', style: { width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid ' + p.color } }),
        h('div', h('h3', { style: { margin: 0 } }, p.name, p.hanja ? h('span.muted.small', ' ' + p.hanja) : ''), h('div.small', p.role))),
      h('p.small', h('b', '확인한 호칭: '), known.length ? known.map((a) => a.t).join(', ') : '아직 없어요'),
      S.chDone.chE ? h('p.small', h('b', '결말: '), p.fate) : null);
  };
})();
