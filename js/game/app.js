'use strict';
// 화면 흐름: 타이틀 → 세책방 → 장 진행 → 결과. 목차·편람·설정은 위에 겹쳐 뜬다.
(function () {
  const { h, $, $$, wait } = G.util;
  const ui = G.ui;
  const app = (G.app = {});
  const S = () => G.save.state;
  const root = () => document.getElementById('app');

  const ICON = {
    toc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="12" cy="18" r="3"/><path d="M8.5 7.2 15.3 7M7.5 8.6l3.3 6.9M16.7 9.6l-3.5 6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
    musicOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    musicOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path d="M3 3l18 18"/></svg>',
  };
  const iconBtn = (name, label, fn) => h('button.icon-btn', { type: 'button', 'aria-label': label, title: label, html: ICON[name], on: { click: () => { G.audio.tap(); fn(); } } });

  app.applySettings = function () {
    document.documentElement.style.setProperty('--fs', S().font);
  };

  // ───────── 타이틀 ─────────
  // 지금 진행 중인 장에서 손을 뗀다(떠난 장의 단계가 뒤늦게 끝난 것으로 기록되지 않게)
  function leavePlay() {
    app._playToken = null;
    app.mapMask = null;
    sideBox = null;
    watchTray(null);
    document.documentElement.style.setProperty('--tray-h', '0px');
  }

  app.title = function () {
    G.ui.unpop();
    leavePlay();
    const st = S();
    const started = Object.keys(st.done).length > 0;
    G.audio.play('shop');
    const r = root(); r.innerHTML = '';
    const menu = h('div.menu');
    if (started) menu.appendChild(h('button.btn.primary', { on: { click: () => { G.audio.unlock(); app.continue(); } } }, '이어 하기'));
    menu.appendChild(h('button.btn' + (started ? '' : '.primary'), { on: { click: () => { G.audio.unlock(); app.newGame(started); } } }, started ? '처음부터 새로' : '시작하기'));
    menu.appendChild(h('button.btn', { on: { click: () => { G.audio.unlock(); app.toc(); } } }, '목차 · 장 고르기'));
    r.appendChild(h('div.title-screen',
      h('div.art', { style: { backgroundImage: 'url(assets/ui/title_art.webp)' } }),
      h('div.logo', h('h1', '사씨남정기'), h('div.sub', '지워진 이름')),
      menu,
      h('div.credit', '김만중 『사씨남정기』 학습 게임 · 이야기 글은 원작 줄거리를 새로 풀어 쓴 것이에요'),
      h('div.credit.maker', '만든이 박준일(온양여자고등학교 국어 교사)'),
      h('div.credit.maker', G.audio.CREDIT),
      musicToggle()));
  };

  // 타이틀 오른쪽 위의 배경음 켜기/끄기(설정의 '배경음'과 같은 값)
  function musicToggle() {
    const b = h('button.icon-btn.music-toggle', { type: 'button' });
    const draw = () => { const on = S().music; b.innerHTML = ICON[on ? 'musicOn' : 'musicOff']; b.setAttribute('aria-label', on ? '배경음 끄기' : '배경음 켜기'); b.title = on ? '배경음 끄기' : '배경음 켜기'; b.classList.toggle('off', !on); };
    b.addEventListener('click', () => { const st = S(); st.music = !st.music; G.save.write(); G.audio.unlock(); G.audio.music(st.music); G.audio.tap(); draw(); });
    draw();
    return b;
  };

  app.newGame = async function (confirmReset) {
    if (confirmReset) {
      const ok = await ui.sheet([h('h3', '처음부터 새로 할까요?'), h('p', '지금까지 확인한 호칭과 복원한 사건이 모두 지워져요.')],
        [{ label: '그만두기', value: false }, { label: '새로 시작', value: true, cls: 'seal' }]);
      if (!ok) return; // 그만두면 하던 장을 그대로 이어 간다
    }
    leavePlay();
    G.save.reset(true);
    const mode = await ui.sheet([
      h('h3', '어떻게 읽을까요?'),
      h('p', h('b', '처음 읽기'), ' — 작품을 처음 만나요. 인물 얼굴과 이름이 자동으로 보이고, 도움이 넉넉해요.'),
      h('p', h('b', '다시 읽기'), ' — 작품을 읽은 뒤 복습해요. 자동 표시 없이 호칭을 직접 떠올려야 해요.'),
      h('p.small.muted', '설정에서 언제든 바꿀 수 있어요.'),
    ], [{ label: '다시 읽기(복습)', value: 'review' }, { label: '처음 읽기', value: 'first', cls: 'primary' }], { dismiss: false });
    S().mode = mode || 'first';
    S().startedAt = Date.now();
    G.save.write();
    await app.shopIntro();
    app.play('ch0');
  };

  app.continue = function () {
    const st = S();
    const next = STORY.find((c) => !st.chDone[c.id]);
    if (!next) return app.result();
    app.play(next.id);
  };

  // ───────── 세책방 도입(게임 설정) ─────────
  app.shopIntro = async function () {
    G.audio.play('shop');
    const r = root(); r.innerHTML = '';
    const main = h('div.main-inner');
    r.appendChild(h('div.stage', h('div.main', main)));
    const tray = h('div.tray'); r.appendChild(tray);
    const ctx = mkCtx(main, tray);
    main.appendChild(h('div.scene', h('img', { src: 'assets/sc/sc_bookshop.webp', alt: '' }), h('span.caption', '조선 후기, 한양의 어느 세책방')));
    const box = h('div');
    main.appendChild(box);
    for (const line of NOTES.frame.intro) {
      box.appendChild(h('div.para.frame-say.show', h('div.who', h('img', { src: G.util.pt('owner'), alt: '' })),
        h('div.bubble', h('span.nm', '세책방 주인', h('span.tagbadge.fiction', '게임 설정')), G.util.boldNodes(line))));
      G.audio.page();
      box.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await G.steps.nextButton(ctx, '네 ▶');
    }
    for (const k of ['shop', 'text', 'art']) {
      main.appendChild(ui.card(Object.assign({ kind: 'fiction' }, NOTES.fiction[k])));
      main.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      S().seenFiction[k] = true;
      await G.steps.nextButton(ctx, '알겠어요');
    }
    G.save.write();
  };

  // ───────── 장 진행 ─────────
  // 아래 트레이의 높이가 바뀌면(안내 글이 두 줄이 되거나 버튼이 늘면) 본문 아래 여백도 따라 바꾼다
  let trayObs = null;
  function watchTray(tray) {
    if (trayObs) { trayObs.disconnect(); trayObs = null; }
    if (tray && window.ResizeObserver) { trayObs = new ResizeObserver(() => setTrayH(tray)); trayObs.observe(tray); }
  }
  function mkCtx(main, tray) {
    watchTray(tray);
    return {
      main,
      tray(content) { tray.innerHTML = ''; if (content) tray.appendChild(content); tray.classList.toggle('hide', !content); setTrayH(tray); },
      trayEl: () => tray,
      refresh() { app.refreshSide(); },
    };
  }
  function setTrayH(tray) {
    requestAnimationFrame(() => document.documentElement.style.setProperty('--tray-h', (tray.classList.contains('hide') ? 0 : tray.offsetHeight) + 'px'));
  }

  let sideBox = null, lastPeople = new Set();
  app.refreshSide = function () {
    if (!sideBox) return;
    const st = S();
    const now = new Set(ui.visiblePeople(st.done, st.met));
    const newly = new Set([...now].filter((x) => !lastPeople.has(x)));
    lastPeople = now;
    sideBox.innerHTML = '';
    const m = ui.map({ done: st.done, met: st.met, newly, mask: app.mapMask, title: '인물 관계도', onOpen: (id) => ui.sheet([ui.personInfo(id)]) });
    m.style.height = '100%';
    sideBox.appendChild(m);
  };

  app.play = async function (chId) {
    G.ui.unpop();
    app.mapMask = null;
    const st = S();
    const ci = STORY.findIndex((c) => c.id === chId);
    const ch = STORY[ci];
    G.audio.play(ch.music);
    G.audio.preload([ch.music, ...ch.steps.map((s) => s.music), STORY[ci + 1] ? STORY[ci + 1].music : 'finale']);
    G.audio.chapter();
    const r = root(); r.innerHTML = '';
    const prog = h('i');
    const top = h('div.topbar',
      iconBtn('toc', '목차', () => app.toc()),
      h('div.where', h('small', ch.no), h('strong', ch.title)),
      iconBtn('map', '관계도', () => app.book('map')),
      iconBtn('book', '편람', () => app.book('dex')),
      iconBtn('gear', '설정', () => app.settings()));
    const main = h('div.main-inner');
    sideBox = h('div.mapbox-holder', { style: { height: '100%' } });
    r.append(top, h('div.progress', prog), h('div.stage', h('div.main', main), h('div.side', sideBox)));
    const tray = h('div.tray'); r.appendChild(tray);
    const ctx = mkCtx(main, tray);
    lastPeople = new Set(ui.visiblePeople(st.done, st.met));
    app.refreshSide();
    const token = (app._playToken = {});

    // 장 머리: 회목(원문) + 지난 이야기
    main.appendChild(h('div.center', h('div.muted.small', '『사씨남정기』'), h('h2', { style: { fontFamily: 'var(--serif)', margin: '4px 0 12px' } }, ch.no + ' · ' + ch.title)));
    ch.hoemok.forEach((hm) => main.appendChild(ui.orig(hm)));
    if (ch.recap && st.mode === 'first') main.appendChild(h('div.card.note', h('span.kind', '지난 이야기'), h('p', ch.recap)));
    const firstUndone = ch.steps.findIndex((s) => !st.done[s.id]);
    const startAt = st.chDone[ch.id] || firstUndone < 0 ? 0 : firstUndone;
    await G.steps.nextButton(ctx, startAt > 0 ? '이어서 읽기 ▶' : '펼치기 ▶');
    if (app._playToken !== token) return;

    for (let i = startAt; i < ch.steps.length; i++) {
      const step = ch.steps[i];
      prog.style.width = Math.round((i / ch.steps.length) * 100) + '%';
      main.innerHTML = '';
      window.scrollTo({ top: 0 });
      ctx.tray(null);
      G.audio.play(step.music || ch.music);
      const run = G.steps[step.type];
      if (run) await run(step, ctx);
      if (app._playToken !== token) return;
      st.done[step.id] = true;
      G.save.write();
      app.refreshSide();
    }
    prog.style.width = '100%';
    st.chDone[ch.id] = true;
    G.save.write();
    await chapterEnd(ch, ci, ctx, main, token);
  };

  async function chapterEnd(ch, ci, ctx, main, token) {
    const st = S();
    main.innerHTML = '';
    window.scrollTo({ top: 0 });
    G.audio.fanfare();
    main.appendChild(h('div.center', h('span.seal-mark', { style: { fontSize: '1.3em' } }, '完'), h('h2', { style: { fontFamily: 'var(--serif)' } }, ch.no + ' 복원 끝')));
    const holder = h('div.map-inline');
    const m = ui.map({ done: st.done, met: st.met, title: '지금까지의 관계도', onOpen: (id) => ui.sheet([ui.personInfo(id)]) });
    m.style.height = '100%';
    holder.appendChild(m);
    main.appendChild(holder);
    const next = STORY[ci + 1];
    if (!next) { await G.steps.nextButton(ctx, '마무리 ▶'); if (app._playToken === token) app.result(); return; }
    const go = h('button.btn.primary', { on: { click: () => { document.removeEventListener('keydown', key); G.audio.tap(); app.play(next.id); } } }, next.no + ' 펼치기 ▶');
    // Enter로 다음 장(다른 화면으로 떠났으면 손을 뗀다)
    const key = (e) => {
      if (!go.isConnected) { document.removeEventListener('keydown', key); return; }
      if (e.key === 'Enter' && G.steps.enterFree(e, go)) { e.preventDefault(); go.click(); }
    };
    document.addEventListener('keydown', key);
    ctx.tray(h('div.actions',
      h('button.btn', { on: { click: () => { G.audio.tap(); app.toc(); } } }, '목차'), go));
    setTimeout(() => go.focus({ preventScroll: true }), 30);
  }

  // ───────── 목차 ─────────
  app.toc = function () {
    const st = S();
    const ov = overlay('목차', (body) => {
      const list = h('div.toc');
      STORY.forEach((c, i) => {
        const done = st.chDone[c.id];
        const open = st.teacher || i === 0 || st.chDone[STORY[i - 1].id] || Object.keys(st.done).some((k) => c.steps.some((s) => s.id === k));
        const el = h('button.toc-item' + (done ? '.done' : '') + (open ? '' : '.locked'), { type: 'button' },
          h('span.no', c.no), h('span', h('div.tt', c.title), h('div.hm', c.hoemok[0].han)),
          h('span.st', done ? '복원 끝' : open ? '열림' : '잠김'));
        el.addEventListener('click', () => { if (!open) { ui.toast('앞 장을 먼저 복원해야 해요'); return; } G.audio.tap(); close(); app.play(c.id); });
        list.appendChild(el);
      });
      body.append(list, h('div.sp'),
        h('div.row-gap', h('button.btn.small', { on: { click: () => { close(); app.title(); } } }, '타이틀로'),
          st.chDone.chE ? h('button.btn.small', { on: { click: () => { close(); app.result(); } } }, '결과 보기') : null),
        h('p.small.muted', '선생님은 설정에서 "모든 장 열기"를 켜면 잠긴 장도 고를 수 있어요.'));
    });
    const close = ov.close;
  };

  // ───────── 편람 ─────────
  app.book = function (tab = 'map') {
    const st = S();
    const tabs = [['map', '관계도'], ['dex', '호칭 도감'], ['ev', '사건첩'], ['var', '이본 노트'], ['gl', '낱말 풀이'], ['fic', '실제와 설정']];
    if (st.chDone.chE) tabs.push(['work', '작품 노트']);
    overlay('편람', (body, bar) => {
      const show = (t) => {
        $$('.tab', bar).forEach((b) => b.classList.toggle('on', b.dataset.t === t));
        body.innerHTML = '';
        body.appendChild(BOOK[t]());
      };
      for (const [k, label] of tabs) bar.appendChild(h('button.tab', { type: 'button', dataset: { t: k }, on: { click: () => { G.audio.tap(); show(k); } } }, label));
      show(tab);
    }, true);
  };
  const BOOK = {
    map() {
      const st = S();
      const holder = h('div.map-inline');
      const m = ui.map({ done: st.done, met: st.met, mask: app.mapMask, onOpen: (id) => ui.sheet([ui.personInfo(id)]) });
      m.style.height = '100%';
      holder.appendChild(m);
      return h('div', holder, h('p.small.muted', '인물을 누르면 그 인물의 관계가 보이고, 한 번 더 누르면 확인한 호칭을 볼 수 있어요. 선은 사건을 복원할 때마다 늘어나요.' + (app.mapMask ? ' 지금 채우는 빈자리는 물음표로 가려 두었어요.' : '')));
    },
    dex() {
      const st = S();
      const box = h('div.dex');
      // 필사본에서 직접 확인할 수 있는 호칭만 '찾을 칸'으로 센다. 글에 표시로 나오지 않는 호칭(본명·낮춤말 등)은
      // 그 인물을 만나면 풀이로 열어 준다(끝까지 ???로 남아 다 못 찾은 것처럼 보이지 않게).
      const findable = app.findableAliases();
      for (const id in PEOPLE) {
        const p = PEOPLE[id], met = st.met[id];
        const als = h('div.als');
        for (const a of p.aliases) {
          const k = id + '|' + a.t;
          const on = st.aliases[k] || (met && (a.t === p.name || !findable.has(k)));
          const el = h('span.al' + (on ? '' : '.off') + (on && !findable.has(k) ? '.info' : ''), on ? a.t : '');
          if (on) el.addEventListener('click', (e) => ui.pop(e.currentTarget, `<b>${G.util.esc(a.t)}</b> (${a.kind}) — ${G.util.esc(a.who)}${a.tip ? '<br>' + G.util.esc(a.tip) : ''}`));
          als.appendChild(el);
        }
        box.appendChild(h('div.dex-item' + (met ? '' : '.unknown'), { style: { '--pc': p.color } },
          h('img', { src: G.util.pt(id), alt: '' }),
          h('div', h('div.nm', met ? p.name : '아직 모르는 인물'), met ? h('div.rl', p.role) : null, met ? als : null)));
      }
      const got = Object.keys(st.aliases).filter((k) => findable.has(k)).length;
      return h('div', h('p.small.muted', `필사본에서 확인한 호칭 ${got}개 / ${findable.size}개 · 호칭을 누르면 누가 언제 쓰는지 보여요. 점선 호칭은 글에 표시로 나오지 않아 풀이로 보여 주는 것이에요.`), box);
    },
    ev() {
      const st = S();
      const list = G.steps.evidenceList();
      if (!list.length) return h('p.muted', '아직 복원한 사건이 없어요.');
      return h('div.dex', list.map((e) => h('div.ev', h('h4', e.title), h('div.txt', e.text), st.stamps[e.id] ? h('span.seal-mark.ok-seal', '확인') : null)));
    },
    var() { return h('div', NOTES.variants.map((v) => ui.card({ kind: 'variant', title: v.title, body: v.body })), h('p.small.muted', '이본(異本): 같은 작품이지만 베끼고 옮기는 과정에서 내용이 조금씩 달라진 여러 책.')); },
    gl() {
      const box = h('div.dex');
      for (const k in NOTES.glossary) box.appendChild(h('div.ev', h('h4', k), h('div.txt', NOTES.glossary[k])));
      return box;
    },
    fic() {
      return h('div',
        h('div.card.note', h('h3', '이 게임의 표시'),
          h('p', h('span.seal-mark', '原文'), ' 원작의 한문 글귀(회목). 한 글자도 바꾸지 않았어요.'),
          h('p', h('b', '필사본 쪽'), ' 원작 줄거리를 오늘날 말로 새로 풀어 쓴 글.'),
          h('p', h('span.tagbadge.fiction', '게임 설정'), ' 게임을 위해 지어낸 것(虛).'),
          h('p', h('span.tagbadge.variant', '이본 노트'), ' 판본마다 내용이 다른 곳.'),
          h('p', h('span.tagbadge.interp', '해석'), ' 여러 해석이 있는 판단. 정답이 아니에요.')),
        ...Object.values(NOTES.fiction).map((f) => ui.card(Object.assign({ kind: 'fiction' }, f))));
    },
    work() { return h('div', NOTES.work.map((w) => ui.card({ kind: w.layer === 'interp' ? 'interp' : 'note', title: w.title, body: w.body }))); },
  };

  // 필사본 글에 [호칭|인물]로 나오는 호칭(호칭 잇기로 확인할 수 있는 것)
  let findableCache = null;
  app.findableAliases = function () {
    if (findableCache) return findableCache;
    findableCache = new Set();
    for (const c of STORY) for (const s of c.steps) if (s.type === 'page') for (const pa of s.paras) {
      const t = typeof pa === 'string' ? pa : pa.t || '';
      for (const f of G.util.parse(t)) if (f.k === 'tag') findableCache.add(f.id + '|' + f.t);
    }
    return findableCache;
  };

  function overlay(title, build, withTabs) {
    const bar = h('div.tabs');
    const body = h('div.inner');
    const el = h('div.overlay',
      h('div.topbar', h('div.where', h('strong', title)), h('button.icon-btn', { type: 'button', 'aria-label': '닫기', on: { click: () => { G.audio.tap(); close(); } } }, '✕')),
      withTabs ? bar : null,
      h('div.body', body));
    document.body.appendChild(el);
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.sheet-back')) close(); }; // 위에 판이 떠 있으면 판부터 닫는다
    document.addEventListener('keydown', onKey);
    function close() { el.remove(); document.removeEventListener('keydown', onKey); G.ui.unpop(); }
    build(body, bar);
    return { close };
  }

  // ───────── 설정 ─────────
  app.settings = async function () {
    const st = S();
    const seg = (label, key, opts) => h('div', { style: { margin: '10px 0' } }, h('div.small', { style: { fontWeight: 700 } }, label),
      h('div.row-gap', opts.map(([v, t]) => {
        const b = h('button.btn.small' + (st[key] === v ? '.primary' : ''), { type: 'button' }, t);
        b.addEventListener('click', () => {
          G.audio.tap(); st[key] = v; G.save.write(); app.applySettings();
          if (key === 'music') G.audio.music(st.music);
          $$('.btn', b.parentNode).forEach((x) => x.classList.toggle('primary', x === b));
        });
        return b;
      })));
    const res = await ui.sheet([
      h('h3', '설정'),
      seg('읽기 방식', 'mode', [['first', '처음 읽기(도입)'], ['review', '다시 읽기(복습)']]),
      seg('글자 크기', 'font', [[1, '보통'], [1.12, '크게'], [1.25, '아주 크게']]),
      seg('효과음', 'sound', [[true, '켜기'], [false, '끄기']]),
      seg('배경음', 'music', [[true, '켜기'], [false, '끄기']]),
      seg('선생님용', 'teacher', [[false, '끄기'], [true, '모든 장 열기 + 정답 채우기']]),
      h('p.small.muted', '진행 상황은 이 브라우저에만 저장돼요(서버로 보내지 않아요).'),
      h('p.small.muted', '만든이 박준일(온양여자고등학교 국어 교사)'),
      h('p.small.muted', G.audio.CREDIT_FULL),
    ], [{ label: '처음부터 새로', value: 'reset' }, { label: '타이틀로', value: 'title' }, { label: '닫기', value: true, cls: 'primary' }]);
    if (res === 'reset') app.newGame(true);
    if (res === 'title') app.title();
  };

  // ───────── 결과: 필사기 쓰기 ─────────
  // 옛 필사본 끝에 베껴 쓴 사람이 날짜와 이름을 적어 두던 필사기(筆寫記)를 본뜬다(게임 설정).
  const STEM = '갑을병정무기경신임계', BRANCH = '자축인묘진사오미신유술해';
  const STEM_H = '甲乙丙丁戊己庚辛壬癸', BRANCH_H = '子丑寅卯辰巳午未申酉戌亥';
  app.ganji = function (y) { const s = (y - 4) % 10, b = (y - 4) % 12; return { ko: STEM[s] + BRANCH[b], han: STEM_H[s] + BRANCH_H[b] }; };
  // 도장에 새길 글자: 입력한 문자열에서 마지막 한글 이름(1~4자). 세 글자면 옛 인장처럼 '印'을 붙인다
  app.sealText = function (name) {
    const words = String(name || '').match(/[가-힣]{1,4}/g);
    let t = words ? words[words.length - 1] : '';
    if (t.length === 3) t += '印';
    return t;
  };
  const KD = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  app.koNum = (n) => (n >= 20 ? KD[Math.floor(n / 10)] : '') + (n >= 10 ? '십' : '') + KD[n % 10];
  // 달 이름은 소리 나는 대로: 6월은 '유월', 10월은 '시월'(한글 맞춤법 제52항)
  app.koMonth = (m) => (m === 6 ? '유' : m === 10 ? '시' : app.koNum(m)) + '월';
  app.colophonLines = function (st) {
    const d = new Date(st.finishedAt || Date.now());
    const gj = app.ganji(d.getFullYear());
    return {
      title: '謝氏南征記 終',
      date: `${gj.ko}년 ${app.koMonth(d.getMonth() + 1)} ${app.koNum(d.getDate())}일`,
      year: d.getFullYear(), ganji: gj,
      role: '세책방 필사가',
      name: st.name || '　　　',
      did1: '번진 곳을 메우고',
      did2: '삼가 고쳐 쓰다',
    };
  };

  app.result = async function () {
    G.ui.unpop();
    leavePlay();
    G.audio.play('finale');
    const st = S();
    if (!st.finishedAt) { st.finishedAt = Date.now(); G.save.write(); }
    const r = root(); r.innerHTML = '';
    const main = h('div.main-inner');
    r.append(h('div.topbar', iconBtn('toc', '목차', () => app.toc()), h('div.where', h('small', '복원을 마치며'), h('strong', '필사기 쓰기')), iconBtn('book', '편람', () => app.book('dex'))),
      h('div.stage', h('div.main', main)));
    const tray = h('div.tray.hide'); r.appendChild(tray);

    const say = (line) => h('div.para.frame-say.show', h('div.who', h('img', { src: G.util.pt('owner'), alt: '' })), h('div.bubble', h('span.nm', '세책방 주인', h('span.tagbadge.fiction', '게임 설정')), G.util.boldNodes(line)));
    NOTES.frame.outro.forEach((line) => main.appendChild(say(line)));
    if (!st.seenFiction.colophon) main.appendChild(ui.card(Object.assign({ kind: 'fiction' }, NOTES.fiction.colophon)));

    // 필사기(세로쓰기 책장)
    const cl = app.colophonLines(st);
    const nameSpan = h('span', cl.name);
    const sealSpan = h('span', app.sealText(st.name));
    const seal = h('div.name-seal' + (st.sealed ? '.on' : ''), sealSpan);
    const sealLen = () => seal.dataset.len = Math.min(3, app.sealText(st.name).length || 1);
    sealLen();
    // 이름 바로 아래에 도장을 찍는다(옛 필사기처럼)
    const page = h('div.colophon',
      h('div.col.title', cl.title),
      h('div.col', cl.date),
      h('div.col', cl.role),
      h('div.col.who', nameSpan, seal),
      h('div.col', cl.did1),
      h('div.col', cl.did2));
    const note = h('p.center.small.muted', `${cl.ganji.ko}년(${cl.ganji.han}年)은 ${cl.year}년이에요. 옛 필사기처럼 해를 간지로 적었어요.`);
    const nameIn = h('input.name-input', { type: 'text', placeholder: '반 번호 이름 (예: 2-3 12 김지은)', value: st.name || '', maxlength: 24, 'aria-label': '필사가 이름' });
    const stampBtn = h('button.btn.seal', { type: 'button' }, st.sealed ? '도장 다시 찍기' : '이름 도장 찍기');
    nameIn.addEventListener('input', () => {
      st.name = nameIn.value; st.sealed = false; G.save.write();
      nameSpan.textContent = app.colophonLines(st).name;
      sealSpan.textContent = app.sealText(st.name); sealLen(); seal.classList.remove('on');
      stampBtn.textContent = '이름 도장 찍기';
    });
    stampBtn.addEventListener('click', async () => {
      if (!app.sealText(st.name)) { ui.toast('도장에 새길 이름(한글)을 먼저 적어 주세요'); nameIn.focus(); return; }
      st.sealed = true; st.seenFiction.colophon = true; G.save.write();
      seal.classList.remove('on'); void seal.offsetWidth; seal.classList.add('on');
      G.audio.stamp(); ui.inkBurst(seal.getBoundingClientRect().left + 30, seal.getBoundingClientRect().top + 30, 10);
      stampBtn.textContent = '도장 다시 찍기';
    });
    main.append(h('h2.center', { style: { fontFamily: 'var(--serif)', margin: '18px 0 4px' } }, '필사기(筆寫記)'),
      h('p.center.small.muted', '복원한 필사본 끝장에 날짜와 이름을 적고 도장을 찍어 마무리해요.'),
      h('div.row-gap', { style: { justifyContent: 'center' } }, nameIn, stampBtn), h('div.sp'), page, note);

    // 세책방 장부(기록)
    const pct = (k) => { const s = st.stats[k]; return s && s[1] ? Math.round((s[0] / s[1]) * 100) + '%' : '—'; };
    const mins = st.startedAt ? Math.max(1, Math.round((st.finishedAt - st.startedAt) / 60000)) : null;
    const caseN = Object.keys(st.cases).length;
    main.appendChild(h('div.ledger',
      h('div.lh', '세책방 장부', h('span.tagbadge.fiction', '게임 설정')),
      h('div.stats',
        h('div.stat', h('b', String(Object.keys(st.tokens).length) + '곳'), h('span', '호칭 표시 (첫 시도 ' + pct('names') + ')')),
        h('div.stat', h('b', caseN + '건'), h('span', '사건 복원 (첫 시도 ' + pct('case') + ')')),
        h('div.stat', h('b', pct('map')), h('span', '관계도 채우기 첫 시도')),
        h('div.stat', h('b', st.helped + '번'), h('span', '도움(정답 보기) 사용'))),
      h('p.small.muted', (st.mode === 'review' ? '다시 읽기(복습)' : '처음 읽기(도입)') + (mins ? ` · ${mins}분` : ''))));

    const holder = h('div.map-inline');
    const m = ui.map({ done: st.done, met: st.met, title: '책 앞장에 붙인 관계도', onOpen: (id) => ui.sheet([ui.personInfo(id)]) });
    m.style.height = '100%'; holder.appendChild(m);
    main.appendChild(holder);

    const wrongNames = st.wrong.filter((w) => w.kind === 'names').slice(0, 6);
    const wrongOther = st.wrong.filter((w) => w.kind !== 'names').slice(0, 8);
    if (st.wrong.length) main.appendChild(h('div.card.note', h('span.kind', '오답 노트'), h('h3', '헷갈렸던 것'),
      wrongNames.length ? h('p', h('b', '호칭: '), wrongNames.map((w) => w.text).join(' / ')) : null,
      ...wrongOther.map((w) => h('p.small', '· ' + w.text))));
    const ref = STORY.flatMap((c) => c.steps).find((s) => s.type === 'reflect');
    if (ref && st.reflect[ref.id] != null) main.appendChild(h('div.card.interp', h('span.kind', '해석 · 내가 고른 답'), h('h3', G.util.plain(ref.q).replace(/\*\*/g, '')), h('p', ref.options[st.reflect[ref.id]])));
    main.appendChild(h('div.card.interp', h('span.kind', '생각 나누기'), h('h3', '친구와 이야기해 보세요'), ...NOTES.debrief.map((q) => h('p', '· ' + q))));
    NOTES.work.forEach((w) => main.appendChild(ui.card({ kind: w.layer === 'interp' ? 'interp' : 'note', title: w.title, body: w.body })));
    main.appendChild(h('div.card.note', h('h3', '필사기 제출하기'),
      h('p.small', '이름 도장을 찍은 필사기와 세책방 장부가 보이게 화면을 캡처해서 제출하세요. 윈도: Win + Shift + S · 크롬북: Ctrl + 창 전환 키 · 아이폰·아이패드: 전원 + 볼륨 올리기 · 안드로이드: 전원 + 볼륨 내리기'),
      h('div.row-gap', h('button.btn.primary', { on: { click: () => app.saveImage() } }, '필사기 이미지로 저장'),
        h('button.btn', { on: { click: () => app.title() } }, '타이틀로'))));
    G.audio.fanfare();
  };

  // 필사기를 그림 파일로 (글자·도장·장부·관계도를 캔버스에 직접 그린다)
  app.saveImage = function () {
    const st = S();
    const W = 900, H = 1500, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const serif = getComputedStyle(document.documentElement).getPropertyValue('--serif');
    g.fillStyle = '#efe2c3'; g.fillRect(0, 0, W, H);
    // 책장(광곽: 바깥 굵은 선 + 안쪽 가는 선)
    const px = 90, py = 50, pw = W - 180, ph = 660;
    g.fillStyle = '#f7efdc'; g.fillRect(px, py, pw, ph);
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 6; g.strokeRect(px + 18, py + 18, pw - 36, ph - 36);
    g.lineWidth = 1.5; g.strokeRect(px + 28, py + 28, pw - 56, ph - 56);
    // 세로쓰기: 오른쪽 줄부터
    const cl = app.colophonLines(st);
    const cols = [[cl.title, 44, 700], [cl.date, 34, 400], [cl.role, 34, 400], [cl.name, 36, 700, true], [cl.did1, 34, 400], [cl.did2, 34, 400]];
    let x = px + pw - 90, sealAt = null;
    for (const [text, size, wt, isName] of cols) {
      g.font = `${wt} ${size}px ${serif}`; g.fillStyle = '#2a2119'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let y = py + 90;
      for (const ch of text) {
        if (ch === ' ') { y += size * 0.55; continue; }
        g.fillText(ch, x, y); y += size * 1.12;
      }
      if (isName) sealAt = [x, y + 20];
      x -= size * (isName ? 2.9 : 2.0);
    }
    // 도장(이름 아래)
    const sealT = st.sealed ? app.sealText(st.name) : '';
    if (sealT && sealAt) {
      const s = 96, sx = sealAt[0] - s / 2, sy = Math.min(sealAt[1], py + ph - s - 40);
      g.strokeStyle = '#b3342a'; g.lineWidth = 7; g.strokeRect(sx, sy, s, s);
      g.fillStyle = '#b3342a'; g.font = `700 ${sealT.length > 2 ? 36 : sealT.length === 2 ? 40 : 58}px ${serif}`;
      const chars = [...sealT];
      if (chars.length === 1) g.fillText(chars[0], sx + s / 2, sy + s / 2);
      else if (chars.length === 2) { g.fillText(chars[0], sx + s / 2, sy + s * 0.3); g.fillText(chars[1], sx + s / 2, sy + s * 0.72); }
      else chars.forEach((ch, i) => g.fillText(ch, sx + (i < 2 ? s * 0.72 : s * 0.28), sy + (i % 2 === 0 ? s * 0.3 : s * 0.72)));
    }
    // 세책방 장부
    g.textBaseline = 'alphabetic';
    const pct = (k) => { const s = st.stats[k]; return s && s[1] ? Math.round((s[0] / s[1]) * 100) + '%' : '—'; };
    const ly = py + ph + 50;
    g.fillStyle = '#fffaf0'; g.fillRect(px, ly, pw, 250);
    g.strokeStyle = 'rgba(42,33,25,.3)'; g.lineWidth = 1.5; g.strokeRect(px, ly, pw, 250);
    g.fillStyle = '#1f7474'; g.textAlign = 'left'; g.font = `700 26px ${serif}`; g.fillText('세책방 장부 (게임 설정)', px + 30, ly + 45);
    const rows = [['호칭 표시', Object.keys(st.tokens).length + '곳 · 첫 시도 ' + pct('names')], ['사건 복원', Object.keys(st.cases).length + '건 · 첫 시도 ' + pct('case')], ['관계도 채우기 첫 시도', pct('map')], ['도움(정답 보기)', st.helped + '번 · ' + (st.mode === 'review' ? '다시 읽기' : '처음 읽기')]];
    g.font = `24px ${serif}`;
    rows.forEach(([k, v], i) => { g.fillStyle = '#5a4a3a'; g.textAlign = 'left'; g.fillText(k, px + 30, ly + 95 + i * 40); g.fillStyle = '#2a2119'; g.textAlign = 'right'; g.fillText(v, px + pw - 30, ly + 95 + i * 40); });
    // 관계도(초상 없이 색 동그라미)
    const oy = ly + 290, sz = 540;
    const P = (id) => [W / 2 - sz / 2 + PEOPLE[id].pos[0] / 100 * sz, oy + PEOPLE[id].pos[1] / 120 * (H - oy - 40)];
    const COL = { bond: '#2a2119', ally: '#7b3f8c', foe: '#b3342a', help: '#1f7474' };
    const ids = ui.visiblePeople(st.done, st.met);
    for (const l of ui.links(st.done)) {
      if (!ids.includes(l.a) || !ids.includes(l.b)) continue;
      const [x1, y1] = P(l.a), [x2, y2] = P(l.b);
      g.strokeStyle = COL[l.kind]; g.lineWidth = 2.5; g.setLineDash(l.dash ? [8, 6] : []);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    g.setLineDash([]);
    for (const id of ids) {
      const [cx, cy] = P(id);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(cx, cy, 15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = PEOPLE[id].color; g.lineWidth = 5; g.stroke();
      g.fillStyle = '#2a2119'; g.font = `700 15px ${serif}`; g.textAlign = 'center'; g.fillText(PEOPLE[id].name, cx, cy + 32);
    }
    c.toBlob((blob) => {
      if (!blob) { ui.toast('이 기기에서는 저장이 안 돼요. 화면을 캡처해 주세요.'); return; }
      const a = h('a', { href: URL.createObjectURL(blob), download: '사씨남정기_필사기_' + (st.name || '이름') + '.png' });
      document.body.appendChild(a); a.click(); a.remove();
    }, 'image/png');
  };
})();
