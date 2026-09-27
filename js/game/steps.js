'use strict';
// 단계 실행기: 단계 하나를 화면에 펼치고, 끝나면 resolve 한다.
// ctx = { main, tray(content), clearTray(), done(stepId), refresh() }
(function () {
  const { h, $, $$, parse, wait, shuffle, shuffleNot } = G.util;
  const ui = G.ui;
  const steps = (G.steps = {});
  const S = () => G.save.state;
  const review = () => S().mode === 'review';

  // ───────── 공통: 아래 트레이의 버튼 ─────────
  function actionBtn(label, cls, onClick) {
    return h('button.btn' + (cls ? '.' + cls : ''), { type: 'button', on: { click: () => { G.audio.tap(); onClick(); } } }, label);
  }
  // Enter를 게임 진행에 써도 되는 때: 판·편람이 떠 있지 않고, 다른 버튼·입력 칸에 포커스가 없을 때
  // (포커스가 있는 버튼·호칭 칸은 제 Enter를 그대로 받는다)
  function enterFree(e, own) {
    if (document.querySelector('.sheet-back, .overlay')) return false;
    const t = e.target;
    if (t && t !== own && t !== document.body && t.closest && t.closest('button, a, input, textarea, select, [role="button"], [tabindex]')) return false;
    return true;
  }
  steps.enterFree = enterFree;
  function nextButton(ctx, label = '다음 ▶') {
    return new Promise((res) => {
      const b = actionBtn(label, 'primary', () => { cleanup(); res(); });
      const key = (e) => {
        if (!b.isConnected) { cleanup(); return; } // 다른 화면으로 떠났으면 손을 뗀다
        if (e.key === 'Enter' && enterFree(e, b)) { e.preventDefault(); b.click(); }
      };
      document.addEventListener('keydown', key);
      function cleanup() { document.removeEventListener('keydown', key); }
      ctx.tray(h('div.actions', b));
      setTimeout(() => b.focus({ preventScroll: true }), 30);
    });
  }
  steps.nextButton = nextButton;

  function feedback(box, kind, text) {
    box.innerHTML = '';
    box.appendChild(h('div.feedback.' + kind, G.util.boldNodes(text)));
    // 힌트(여백의 메모)가 처음 나올 때 게임 설정임을 알린다
    if (text.includes('여백의 메모') && !S().seenFiction.marks) {
      S().seenFiction.marks = true;
      box.appendChild(ui.card(Object.assign({ kind: 'fiction' }, NOTES.fiction.marks)));
    }
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function teacherSolve(fn) {
    return S().teacher ? actionBtn('정답 채우기(선생님용)', 'small.ghost', fn) : null;
  }
  function scene(name, cls = '') {
    if (!name) return null;
    const img = h('img', { src: 'assets/sc/' + name + '.webp', alt: '' });
    const box = h('div.scene' + cls, img);
    img.addEventListener('error', () => box.remove()); // 그림이 아직 없으면 자리를 비운다
    return box;
  }

  // 글 조각을 DOM으로. glossUsed: 이 쪽에서 이미 풀이 표시한 낱말
  function renderText(s, glossUsed, onToken) {
    const frag = document.createDocumentFragment();
    for (const f of parse(s)) {
      if (f.k === 't') frag.appendChild(glossify(f.t, glossUsed));
      else if (f.k === 'b') frag.appendChild(h('b', glossify(f.t, glossUsed)));
      else if (f.k === 'auto') frag.appendChild(autoTok(f));
      else frag.appendChild(onToken(f));
    }
    return frag;
  }
  let glossRe = null;
  function glossify(text, used) {
    const G2 = NOTES.glossary;
    if (!glossRe) glossRe = new RegExp('(' + Object.keys(G2).sort((a, b) => b.length - a.length).join('|') + ')', 'g');
    const frag = document.createDocumentFragment();
    let last = 0, m;
    glossRe.lastIndex = 0;
    while ((m = glossRe.exec(text))) {
      if (used.has(m[1])) continue;
      if (/[가-힣]/.test(text[m.index - 1] || '')) continue; // '칭찬' 속의 '찬'처럼 낱말 가운데는 건너뛴다
      used.add(m[1]);
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const w = m[1];
      frag.appendChild(h('span.gl', { tabindex: 0, on: { click: (e) => { e.stopPropagation(); ui.pop(e.currentTarget, `<b>${w}</b> ${G.util.esc(G2[w])}`); } } }, w));
      last = m.index + w.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    return frag;
  }
  function aliasOf(id, t) { return (PEOPLE[id].aliases || []).find((a) => a.t === t); }
  function autoTok(f) {
    const p = PEOPLE[f.id];
    const el = h('span.auto', { style: { '--pc': p.color }, tabindex: 0 }, f.t);
    if (!review()) el.appendChild(h('span.chip', h('img', { src: G.util.pt(f.id), alt: p.name })));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (review()) return;
      const a = aliasOf(f.id, f.t);
      ui.pop(el, `<b>${G.util.esc(f.t)}</b> → ${G.util.esc(p.name)}${a && a.who ? '<br>' + G.util.esc(a.who) : ''}`);
    });
    return el;
  }

  // 알림 카드(게임 설정 카드는 처음 한 번만 자세히)
  steps.card = async function (step, ctx) {
    ctx.main.appendChild(ui.card(step));
    await nextButton(ctx, '알겠어요');
  };

  // ───────── 필사본 쪽: 읽기 + 호칭 잇기 ─────────
  steps.page = async function (step, ctx) {
    const st = S();
    const glossUsed = new Set();
    if (step.scene) ctx.main.appendChild(scene(step.scene, '.short'));
    const leaf = h('div.leaf', h('h2', step.title));
    ctx.main.appendChild(leaf);
    const fbBox = h('div');
    ctx.main.appendChild(fbBox);

    const tokens = [];
    let selTok = null, selPerson = null, fails = 0;
    const pool = new Set();

    const makeToken = (f, key) => {
      const p = PEOPLE[f.id];
      const tk = { key, id: f.id, t: f.t, pen: null, state: 'need', tried: false };
      const el = h('span.tok.need', { tabindex: 0, role: 'button', 'aria-label': f.t + ' — 누구인지 표시하기' }, f.t);
      tk.el = el;
      pool.add(f.id);
      if (st.tokens[key] === f.id) setDone(tk, true);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tk.state === 'done') {
          const a = aliasOf(tk.id, tk.t);
          ui.pop(el, `<b>${G.util.esc(tk.t)}</b> → ${G.util.esc(p.name)}${a && a.tip ? '<br>' + G.util.esc(a.tip) : a && a.who ? '<br>' + G.util.esc(a.who) : ''}`);
          return;
        }
        G.audio.tap();
        if (selPerson) { pencil(tk, selPerson); selectPerson(null); return; }
        selectTok(tk); // 이미 골라져 있어도 그대로 둔다(자동 선택된 호칭을 다시 눌러도 풀리지 않게)
      });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
      tokens.push(tk);
      return el;
    };
    function chipFor(id, pen) {
      const p = PEOPLE[id];
      return h('span.chip', { style: { '--pc': p.color } }, h('img', { src: G.util.pt(id), alt: '' }), p.name);
    }
    function setDone(tk, silent) {
      tk.state = 'done'; tk.pen = tk.id;
      tk.el.className = 'tok done';
      tk.el.style.setProperty('--pc', PEOPLE[tk.id].color);
      $$('.chip', tk.el).forEach((c) => c.remove());
      if (!review() || silent) tk.el.appendChild(chipFor(tk.id));
      st.tokens[tk.key] = tk.id;
      st.aliases[tk.id + '|' + tk.t] = true;
      st.met[tk.id] = true;
    }
    function pencil(tk, id) {
      tk.pen = id; tk.state = 'pen';
      tk.el.className = 'tok pen';
      $$('.chip', tk.el).forEach((c) => c.remove());
      tk.el.appendChild(chipFor(id, true));
      G.audio.pencil();
      selectTok(null);
      // 다음 빈 호칭으로 자동 선택
      const next = tokens.find((t) => t.state === 'need' && t.el.closest('.para.show'));
      if (next) selectTok(next);
      update();
    }
    function selectTok(tk) {
      if (selTok) selTok.el.classList.remove('sel');
      selTok = tk;
      if (tk) tk.el.classList.add('sel');
      update();
    }
    function selectPerson(id) {
      selPerson = id;
      $$('.person', ctx.trayEl()).forEach((b) => b.classList.toggle('sel', b.dataset.id === id));
    }

    // 문단 만들기
    const paraEls = step.paras.map((pa, pi) => {
      let el;
      const key = (n) => step.id + '#' + pi + '.' + n;
      let n = 0;
      const onTok = (f) => makeToken(f, key(n++));
      if (typeof pa === 'string') el = h('p.para', renderText(pa, glossUsed, onTok));
      else if (pa.frame) {
        el = h('div.para.frame-say',
          h('div.who', h('img', { src: G.util.pt('owner'), alt: '' })),
          h('div.bubble', h('span.nm', '세책방 주인', h('span.tagbadge.fiction', '게임 설정')), G.util.boldNodes(pa.frame)));
      } else {
        const p = PEOPLE[pa.who];
        pool.add(pa.who);
        el = h('div.para.say', { style: { '--pc': p.color } },
          h('div.who', h('img', { src: G.util.pt(pa.who), alt: '' })),
          h('div.bubble', h('span.nm', p.name), renderText(pa.t, glossUsed, onTok)));
      }
      leaf.appendChild(el);
      return el;
    });
    const foot = h('div.leaf-foot', h('span.pg'), h('span', '글을 누르면 다음 줄'));
    leaf.appendChild(foot);

    // 트레이
    const hint = h('div.hint-line');
    const people = h('div.scroll');
    const acts = h('div.actions');
    const checkBtn = actionBtn('맞추어 보기', 'seal', check);
    const nextBtn = actionBtn('다음 줄 ▼', '', reveal);
    const endBtn = actionBtn('쪽 넘기기 ▶', 'primary', () => finish());
    const solveBtn = teacherSolve(() => { tokens.forEach((t) => t.state !== 'done' && setDone(t)); while (shown < paraEls.length) reveal(); update(); });
    acts.append(solveBtn || '', checkBtn, nextBtn, endBtn);
    const trayEl = h('div', hint, h('div.row', people), acts);
    ctx.tray(trayEl);

    // 고를 수 있는 인물: 지금까지 만난 인물 + 이 쪽의 인물
    const ids = [...new Set([...Object.keys(PEOPLE).filter((id) => st.met[id]), ...pool])];
    ids.sort((a, b) => Object.keys(PEOPLE).indexOf(a) - Object.keys(PEOPLE).indexOf(b));
    for (const id of ids) {
      const b = ui.personChip(id);
      b.addEventListener('click', () => {
        G.audio.tap();
        if (selTok) { pencil(selTok, id); return; }
        selectPerson(selPerson === id ? null : id);
      });
      people.appendChild(b);
    }
    if (!tokens.length) people.parentNode.classList.add('hide');

    // 이미 끝낸 쪽이면 다 펼친다
    let shown = 0;
    const replay = !!st.done[step.id];
    function reveal() {
      if (shown >= paraEls.length) return;
      const el = paraEls[shown++];
      el.classList.add('show');
      if (el.classList.contains('say')) st.met[step.paras[shown - 1].who] = true;
      G.audio.page();
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (!selTok) { const nt = tokens.find((t) => t.state === 'need' && t.el.closest('.para.show')); if (nt) selectTok(nt); }
      update();
    }
    leaf.addEventListener('click', (e) => { if (e.target.closest('.tok,.auto,.gl')) return; if (shown < paraEls.length) reveal(); });
    if (replay) while (shown < paraEls.length) { paraEls[shown++].classList.add('show'); }
    else reveal();

    let resolveDone;
    const donePromise = new Promise((r) => (resolveDone = r));
    function finish() { cleanupKeys(); resolveDone(); }
    const onKey = (e) => {
      if (!leaf.isConnected) { cleanupKeys(); return; } // 다른 화면으로 떠났으면 손을 뗀다
      if (e.key === 'Enter' && enterFree(e)) {
        e.preventDefault();
        if (shown < paraEls.length) reveal();
        else if (!endBtn.disabled) endBtn.click();
        else if (!checkBtn.disabled) checkBtn.click();
      }
    };
    document.addEventListener('keydown', onKey);
    function cleanupKeys() { document.removeEventListener('keydown', onKey); }

    function update() {
      const shownToks = tokens.filter((t) => t.el.closest('.para.show'));
      const pens = tokens.filter((t) => t.state === 'pen');
      const left = shownToks.filter((t) => t.state !== 'done');
      const allRead = shown >= paraEls.length;
      const canCheck = pens.length >= 3 || (pens.length > 0 && pens.length === left.length && (allRead || left.length < 3));
      checkBtn.disabled = !canCheck;
      checkBtn.textContent = `맞추어 보기 (${pens.length}/${Math.min(3, Math.max(1, left.length))})`;
      nextBtn.classList.toggle('hide', allRead);
      const allDone = tokens.every((t) => t.state === 'done');
      endBtn.classList.toggle('hide', !allRead);
      endBtn.disabled = !allDone;
      checkBtn.classList.toggle('hide', allDone);
      if (allDone && allRead) hint.textContent = tokens.length ? '이 쪽의 호칭을 모두 확인했어요.' : '';
      else if (left.length && !selTok) hint.textContent = '밑줄 친 호칭(?)을 누르고, 그 호칭이 가리키는 인물을 아래에서 고르세요.';
      else if (selTok) hint.innerHTML = `<b>「${G.util.esc(selTok.t)}」</b>은(는) 누구일까요? 아래에서 인물을 고르세요.`;
      else hint.textContent = allRead ? '' : '글을 누르거나 [다음 줄]을 눌러 읽어 나가세요.';
      $('.pg', foot).textContent = tokens.length ? `호칭 ${tokens.filter((t) => t.state === 'done').length} / ${tokens.length}` : '';
    }

    async function check() {
      const pens = tokens.filter((t) => t.state === 'pen');
      const good = pens.filter((t) => t.pen === t.id);
      for (const t of pens) {
        if (!t.tried) { t.tried = true; G.save.stat('names', t.pen === t.id); }
        if (t.pen !== t.id) G.save.wrong('names', `「${t.t}」은(는) ${PEOPLE[t.id].name}`);
      }
      if (good.length === pens.length) {
        fails = 0;
        pens.forEach((t) => setDone(t));
        tokens.forEach((t) => t.el.classList.remove('wrong'));
        fbBox.innerHTML = '';
        ui.stamp('確認');
        G.audio.ok();
        const tips = pens.map((t) => aliasOf(t.id, t.t)).filter((a) => a && a.tip);
        if (tips.length) feedback(fbBox, 'ok', tips.map((a) => `「${a.t}」: ${a.tip}`).join('\n'));
        G.save.write();
        ctx.refresh();
        update();
        return;
      }
      fails++;
      G.audio.no();
      ui.shake(leaf);
      if (fails === 1) feedback(fbBox, 'warn', `${pens.length}개 가운데 **${good.length}개**가 맞았어요. 어느 것이 틀렸는지 앞뒤 글을 다시 살펴보세요.`);
      else {
        pens.forEach((t) => t.el.classList.toggle('wrong', t.pen !== t.id));
        const bad = pens.filter((t) => t.pen !== t.id);
        let msg = `빗금 친 호칭이 틀렸어요.`;
        if (fails >= 3) msg += '\n' + bad.map((t) => { const a = aliasOf(t.id, t.t); return `여백의 메모: 「${t.t}」 — ${a && (a.tip || a.who) ? (a.tip || a.who) : '앞뒤 문장에서 이 사람이 한 일을 찾아보세요.'}`; }).join('\n');
        feedback(fbBox, 'bad', msg);
        if (fails >= 4) {
          fbBox.appendChild(actionBtn('정답 보기', 'small', () => {
            bad.forEach((t) => setDone(t)); pens.forEach((t) => t.state === 'pen' && setDone(t));
            st.helped++; fails = 0; fbBox.innerHTML = ''; G.save.write(); ctx.refresh(); update();
          }));
        }
      }
      update();
    }

    update();
    await donePromise;
    G.save.write();
  };

  // ───────── 사건 복원: 조사 → 낱말 → 빈칸 ─────────
  steps.case = async function (step, ctx) {
    const st = S();
    const bank = new Map(); // 낱말 → 칩 요소
    let selBlank = null, tries = 0, solved = false;
    const replay = !!(st.cases[step.id] && st.cases[step.id].done);

    ctx.main.appendChild(h('p', { style: { margin: '0 0 10px' } }, G.util.boldNodes(step.intro || '')));
    const sources = []; // {el, words}
    if (step.scene) {
      const sc = scene(step.scene);
      (step.spots || []).forEach((sp, i) => {
        const b = h('button.spot', { type: 'button', style: { left: sp.x + '%', top: sp.y + '%' }, 'aria-label': sp.label }, String(i + 1));
        b.addEventListener('click', () => openSpot(sp, b));
        sc.appendChild(b);
        sources.push({ el: b, words: sp.words });
      });
      ctx.main.appendChild(sc);
    }
    if (step.clues && step.clues.length) {
      const list = h('div.clues');
      for (const c of step.clues) {
        const el = h('button.clue', { type: 'button' }, h('span.lb', '✎ ', c.label), h('div.tx', markWords(c.text, c.words)));
        el.addEventListener('click', () => {
          G.audio.page();
          el.classList.add('open'); el.classList.remove('glow');
          addWords(c.words);
        });
        list.appendChild(el);
        sources.push({ el, words: c.words });
      }
      ctx.main.appendChild(list);
    }
    // 복원할 쪽
    const leaf = h('div.leaf.restore', h('h2', step.title + ' ', h('span.small.muted', '— 번진 곳 복원')));
    const blanks = [];
    for (const line of step.lines) {
      const p = h('p');
      let prev = null;
      line.split(/(\[[^\]]+\])/).forEach((part) => {
        const m = part.match(/^\[([^\]]+)\]$/);
        if (!m) {
          const tn = document.createTextNode(part);
          p.appendChild(tn);
          // 빈칸 바로 뒤의 조사(이/가, 은/는 …)는 채운 낱말에 맞춰 바꾼다
          if (prev) { prev.after = tn; prev.afterRaw = part; }
          prev = null;
          return;
        }
        const def = step.blanks[m[1]];
        const el = h('span.blank', { tabindex: 0, role: 'button', 'aria-label': '빈칸' }, '　　');
        const bk = { key: m[1], def, el, word: null };
        prev = bk;
        el.addEventListener('click', () => {
          if (solved) return;
          G.audio.tap();
          if (bk.word) { setBlank(bk, null); selectBlank(bk); return; }
          selectBlank(selBlank === bk ? null : bk);
        });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
        blanks.push(bk);
        p.appendChild(el);
      });
      leaf.appendChild(p);
    }
    ctx.main.appendChild(leaf);
    const fbBox = h('div');
    ctx.main.appendChild(fbBox);

    // 트레이
    const hint = h('div.hint-line');
    const words = h('div.scroll');
    const checkBtn = actionBtn('맞추어 보기', 'seal', check);
    const solveBtn = teacherSolve(() => { for (const b of blanks) setBlank(b, answerWord(b)); check(true); });
    ctx.tray(h('div', hint, h('div.row', words), h('div.actions', solveBtn || '', checkBtn)));

    function markWords(text, ws) {
      let html = G.util.esc(text);
      for (const w of ws || []) html = html.split(G.util.esc(w)).join(`<mark class="w">${G.util.esc(w)}</mark>`);
      return h('span', { html });
    }
    function wordKind(w) { return G.util.personOf(w) ? 'person' : /[다자고어워]$|알려|보여/.test(w) ? 'act' : 'thing'; }
    function addWords(ws, silent) {
      for (const w of ws || []) {
        if (bank.has(w)) continue;
        const kind = wordKind(w), pid = G.util.personOf(w);
        const chip = h('button.word.kind-' + kind + (silent ? '' : '.new'), { type: 'button', style: pid ? { '--pc': PEOPLE[pid].color } : null },
          pid && !review() ? h('img', { src: G.util.pt(pid), alt: '' }) : null, w);
        chip.addEventListener('click', () => {
          if (solved) return;
          G.audio.pick();
          let target = selBlank || blanks.find((b) => !b.word);
          if (!target) { G.ui.toast('채울 빈칸을 먼저 누르세요'); return; }
          setBlank(target, w);
          selectBlank(blanks.find((b) => !b.word) || null);
        });
        bank.set(w, chip);
        words.appendChild(chip);
        if (!silent) G.audio.pick();
      }
      update();
    }
    function openSpot(sp, btn) {
      G.audio.page();
      btn.classList.add('seen'); btn.classList.remove('glow');
      addWords(sp.words);
      ui.sheet([h('h3', sp.label), h('p', { style: { fontFamily: 'var(--serif)', lineHeight: 1.9 } }, markWords(sp.text, sp.words)),
        h('p.small.muted', '노란 형광펜 낱말을 주웠어요. 아래 낱말 칸에 들어갔어요.')], [{ label: '닫기', value: true, cls: 'primary' }]);
    }
    function selectBlank(bk) {
      blanks.forEach((b) => b.el.classList.remove('sel'));
      selBlank = bk;
      if (bk) bk.el.classList.add('sel');
      update();
    }
    function setBlank(bk, w) {
      bk.word = w;
      bk.el.textContent = w || '　　';
      if (bk.after) bk.after.textContent = w ? G.util.josa(w, bk.afterRaw) : bk.afterRaw;
      bk.el.classList.toggle('filled', !!w);
      bk.el.classList.remove('wrong');
      update();
    }
    function isRight(bk) {
      if (!bk.word) return false;
      return bk.def.person ? G.util.personOf(bk.word) === bk.def.person : bk.word === bk.def.word;
    }
    function answerWord(bk) {
      if (bk.def.word) return bk.def.word;
      const inBank = [...bank.keys()].find((w) => G.util.personOf(w) === bk.def.person);
      return inBank || PEOPLE[bk.def.person].name;
    }
    function update() {
      const filled = blanks.filter((b) => b.word).length;
      checkBtn.disabled = solved || filled < blanks.length;
      checkBtn.textContent = `맞추어 보기 (${filled}/${blanks.length})`;
      if (solved) hint.textContent = '';
      else if (!bank.size) hint.textContent = step.scene ? '그림 속 붉은 점과 쪽지를 눌러 낱말을 모으세요.' : '쪽지를 눌러 펼치고 낱말을 모으세요.';
      else if (selBlank) hint.textContent = '고른 빈칸에 들어갈 낱말을 누르세요. (채운 칸을 누르면 비워져요)';
      else hint.textContent = '빈칸을 누르고 낱말을 고르세요. 모든 칸을 채우면 맞추어 볼 수 있어요.';
    }

    let resolveDone;
    const donePromise = new Promise((r) => (resolveDone = r));

    async function check(byTeacher) {
      tries++;
      const bad = blanks.filter((b) => !isRight(b));
      if (tries === 1 && !byTeacher) G.save.stat('case', bad.length === 0);
      if (!bad.length) return success(byTeacher);
      G.audio.no();
      ui.shake(leaf);
      bad.forEach((b) => G.save.wrong('case', `${step.title}: 「${b.word}」 자리에는 ${b.def.person ? PEOPLE[b.def.person].name : b.def.word}`));
      const near = bad.length <= 2;
      let msg = near ? '거의 다 왔어요! **두 칸 이하**가 틀렸어요.' : '**세 칸 이상**이 틀렸어요. 조사한 내용을 다시 읽어 보세요.';
      if (tries >= 2) { bad.forEach((b) => b.el.classList.add('wrong')); msg += '\n빗금 친 칸이 틀린 칸이에요.'; }
      if (tries >= 3) {
        msg += '\n여백의 메모: 반짝이는 곳에 실마리가 있어요.';
        for (const b of bad) {
          for (const s of sources) if ((s.words || []).some((w) => (b.def.person ? G.util.personOf(w) === b.def.person : w === b.def.word))) s.el.classList.add('glow');
        }
      }
      feedback(fbBox, near ? 'warn' : 'bad', msg);
      if (tries >= 4) {
        fbBox.appendChild(actionBtn('정답 보기', 'small', () => {
          st.helped++;
          for (const b of blanks) setBlank(b, answerWord(b));
          success(true);
        }));
      }
    }
    async function success(helped) {
      solved = true;
      blanks.forEach((b) => { b.el.className = 'blank done'; });
      fbBox.innerHTML = '';
      ui.stamp('復元');
      G.audio.ok();
      for (const b of blanks) if (b.def.person) st.met[b.def.person] = true;
      const text = step.lines.map((l) => l.replace(/\[([^\]]+)\]([^[]*)/g, (_, k, rest) => { const w = blanks.find((b) => b.key === k).word; return w + G.util.josa(w, rest); })).join(' ');
      st.cases[step.id] = { done: true, tries, helped: !!helped };
      st.evidence[step.id] = { title: step.evidence.title, short: step.evidence.short, text };
      G.save.write();
      ctx.refresh();
      if (step.explain) fbBox.appendChild(h('div.explain', G.util.boldNodes(step.explain)));
      update();
      await wait(400);
      await nextButton(ctx);
      resolveDone();
    }

    // 다시 보기: 이미 푼 사건이면 채워 둔다
    if (replay) {
      for (const s of step.spots || []) addWords(s.words, true);
      for (const c of step.clues || []) addWords(c.words, true);
      $$('.clue', ctx.main).forEach((c) => c.classList.add('open'));
      $$('.spot', ctx.main).forEach((c) => c.classList.add('seen'));
      for (const b of blanks) setBlank(b, answerWord(b));
      solved = true;
      blanks.forEach((b) => { b.el.className = 'blank done'; });
      if (step.explain) fbBox.appendChild(h('div.explain', G.util.boldNodes(step.explain)));
      await nextButton(ctx);
      return;
    }
    addWords(shuffle(step.bank || []), true);
    update();
    await donePromise;
  };

  // ───────── 나누어 담기 ─────────
  steps.sort = async function (step, ctx) {
    ctx.main.appendChild(h('div.card.note', h('h3', step.title), h('p', G.util.boldNodes(step.intro || ''))));
    const pool = h('div.pool');
    const binsEl = h('div.bins');
    const bins = {};
    for (const b of step.bins) {
      const el = h('div.bin', { role: 'button', tabindex: 0 }, h('h4', b.label));
      el.addEventListener('click', (e) => { if (e.target.closest('.slip')) return; drop(b.id); });
      el.addEventListener('keydown', (e) => { if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); drop(b.id); } });
      bins[b.id] = el; binsEl.appendChild(el);
    }
    const fbBox = h('div');
    ctx.main.append(pool, binsEl, fbBox);
    let sel = null, tries = 0;
    const cards = shuffleNot(step.cards).map((c) => {
      const el = h('button.slip', { type: 'button' }, c.t);
      const cd = { ...c, el, at: null };
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // 다른 쪽지를 들고 칸 안의 쪽지를 누르면 들고 있던 쪽지를 그 칸에 담는다
        if (sel && sel !== cd && cd.at) { drop(cd.at); return; }
        G.audio.tap(); select(sel === cd ? null : cd);
      });
      pool.appendChild(el);
      return cd;
    });
    // 다시 보기: 이미 푼 활동이면 정답 자리에 놓아 보여 준다(첫 시도 기록은 건드리지 않음)
    if (S().done[step.id]) {
      cards.forEach((c) => { c.at = c.bin; bins[c.bin].appendChild(c.el); c.el.classList.add('ok'); c.el.disabled = true; });
      if (step.explain) fbBox.appendChild(h('div.explain', G.util.boldNodes(step.explain)));
      await nextButton(ctx);
      return;
    }
    function select(cd) { cards.forEach((c) => c.el.classList.remove('sel')); sel = cd; if (cd) cd.el.classList.add('sel'); Object.values(bins).forEach((b) => b.classList.toggle('target', !!cd)); }
    function drop(bin) {
      if (!sel) { G.ui.toast('먼저 담을 쪽지를 누르세요'); return; }
      G.audio.pick();
      sel.at = bin; sel.el.classList.remove('ok', 'bad');
      bins[bin].appendChild(sel.el);
      select(null); update();
    }
    const checkBtn = actionBtn('맞추어 보기', 'seal', check);
    const solveBtn = teacherSolve(() => { cards.forEach((c) => { sel = c; drop(c.bin); }); check(true); });
    const hint = h('div.hint-line', '쪽지를 누른 뒤, 담을 칸을 누르세요.');
    ctx.tray(h('div', hint, h('div.actions', solveBtn || '', checkBtn)));
    function update() { checkBtn.disabled = cards.some((c) => !c.at); }
    update();
    let resolveDone; const donePromise = new Promise((r) => (resolveDone = r));
    async function check(byTeacher) {
      tries++;
      const bad = cards.filter((c) => c.at !== c.bin);
      if (tries === 1 && !byTeacher) G.save.stat('sort', !bad.length);
      if (!bad.length) {
        cards.forEach((c) => c.el.classList.add('ok'));
        ui.stamp('確認'); G.audio.ok(); fbBox.innerHTML = '';
        if (step.explain) fbBox.appendChild(h('div.explain', G.util.boldNodes(step.explain)));
        checkBtn.disabled = true;
        await nextButton(ctx); resolveDone(); return;
      }
      G.audio.no();
      bad.forEach((c) => G.save.wrong('sort', `「${c.t}」 → ${step.bins.find((b) => b.id === c.bin).label}`));
      if (tries >= 2) bad.forEach((c) => c.el.classList.add('bad'));
      feedback(fbBox, 'warn', `${cards.length}장 가운데 **${cards.length - bad.length}장**이 제자리예요.` + (tries >= 2 ? ' 붉은 쪽지를 옮겨 보세요.' : ''));
      if (tries >= 3) fbBox.appendChild(actionBtn('정답 보기', 'small', () => { S().helped++; cards.forEach((c) => { sel = c; drop(c.bin); }); check(true); }));
    }
    await donePromise;
  };

  // ───────── 순서 맞추기(흩어진 낱장) ─────────
  steps.route = async function (step, ctx) {
    ctx.main.appendChild(h('div.card.note', h('h3', step.title), h('p', G.util.boldNodes(step.intro || ''))));
    if (step.map) ctx.main.appendChild(h('div.scene.short', h('img', { src: 'assets/sc/' + step.map + '.webp', alt: '', style: { objectPosition: 'center 40%' } })));
    const slotsEl = h('div.slots'), pool = h('div.pool'), fbBox = h('div');
    ctx.main.append(slotsEl, h('p.small.muted', '▼ 흩어진 낱장 (누르면 빈 순서에 들어가요)'), pool, fbBox);
    const N = step.cards.length;
    const slots = [];
    for (let i = 0; i < N; i++) {
      const el = h('div.slot', h('span.n', String(i + 1)), h('div.empty'));
      slots.push({ el, card: null, locked: false });
      slotsEl.appendChild(el);
    }
    let tries = 0;
    const cards = shuffleNot(step.cards).map((c) => {
      const el = h('button.slip', { type: 'button' }, c.t);
      const cd = { ...c, el, slot: -1 };
      el.addEventListener('click', () => { G.audio.tap(); cd.slot >= 0 ? unplace(cd) : place(cd); });
      pool.appendChild(el);
      return cd;
    });
    function place(cd, idx) {
      if (idx == null) idx = slots.findIndex((s) => !s.card);
      if (idx < 0) return;
      const s = slots[idx]; s.card = cd; cd.slot = idx;
      s.el.replaceChild(cd.el, s.el.children[1]);
      G.audio.pick(); update();
    }
    function unplace(cd) {
      const s = slots[cd.slot]; if (s.locked) return;
      s.card = null; s.el.replaceChild(h('div.empty'), cd.el); cd.slot = -1;
      cd.el.classList.remove('bad'); pool.appendChild(cd.el); update();
    }
    // 다시 보기: 이미 푼 순서면 맞춘 차례대로 보여 준다
    if (S().done[step.id]) {
      step.order.forEach((id, i) => {
        const c = cards.find((x) => x.id === id), s = slots[i];
        s.card = c; s.locked = true; c.slot = i;
        s.el.replaceChild(c.el, s.el.children[1]);
        c.el.classList.add('ok'); c.el.disabled = true;
      });
      if (step.explain) fbBox.appendChild(h('div.explain', G.util.boldNodes(step.explain)));
      await nextButton(ctx);
      return;
    }
    const checkBtn = actionBtn('맞추어 보기', 'seal', check);
    const solveBtn = teacherSolve(() => { cards.forEach((c) => c.slot >= 0 && unplace(c)); step.order.forEach((id, i) => place(cards.find((c) => c.id === id), i)); check(true); });
    ctx.tray(h('div', h('div.hint-line', '낱장을 누르면 차례로 빈자리에 들어가요. 놓인 낱장을 누르면 빠져요.'), h('div.actions', solveBtn || '', checkBtn)));
    function update() { checkBtn.disabled = slots.some((s) => !s.card); }
    update();
    let resolveDone; const donePromise = new Promise((r) => (resolveDone = r));
    async function check(byTeacher) {
      tries++;
      const bad = slots.filter((s, i) => s.card.id !== step.order[i]);
      if (tries === 1 && !byTeacher) G.save.stat('route', !bad.length);
      if (!bad.length) {
        slots.forEach((s) => s.card.el.classList.add('ok'));
        ui.stamp('確認'); G.audio.ok(); fbBox.innerHTML = '';
        if (step.explain) fbBox.appendChild(h('div.explain', G.util.boldNodes(step.explain)));
        checkBtn.disabled = true;
        await nextButton(ctx); resolveDone(); return;
      }
      G.audio.no();
      G.save.wrong('route', `${step.title}: 사건의 순서`);
      feedback(fbBox, 'warn', `${N}장 가운데 **${N - bad.length}장**이 제자리예요.` + (tries >= 2 ? ' 제자리인 낱장은 고정하고, 나머지는 다시 뺐어요.' : ''));
      if (tries >= 2) {
        slots.forEach((s, i) => { if (s.card.id === step.order[i]) { s.locked = true; s.el.classList.add('locked'); s.card.el.classList.add('ok'); } });
        bad.forEach((s) => unplace(s.card));
      }
      if (tries >= 3) fbBox.appendChild(actionBtn('정답 보기', 'small', () => { S().helped++; cards.forEach((c) => c.slot >= 0 && !slots[c.slot].locked && unplace(c)); step.order.forEach((id, i) => { const c = cards.find((x) => x.id === id); if (c.slot < 0) place(c, i); }); check(true); }));
    }
    await donePromise;
  };

  // ───────── 고백 듣고 확인 도장 ─────────
  function evidenceList() {
    const st = S();
    const out = [];
    for (const ch of STORY) for (const s of ch.steps) {
      if (s.type === 'case' && st.evidence[s.id]) out.push({ id: s.id, ...st.evidence[s.id] });
      if (s.type === 'page' && s.evidence && st.done[s.id]) out.push({ id: s.evidence.id, title: s.evidence.title, short: s.evidence.short, text: s.evidence.text });
    }
    return out;
  }
  steps.evidenceList = evidenceList;

  steps.reveal = async function (step, ctx) {
    const st = S();
    const replay = !!st.done[step.id]; // 다시 보기에서는 첫 시도 기록을 다시 세지 않는다
    const p = PEOPLE[step.who];
    ctx.main.appendChild(h('p', G.util.boldNodes(step.intro || '')));
    const talk = h('div');
    const evBox = h('div.dex');
    const fbBox = h('div');
    ctx.main.append(talk, h('p.small.muted', '▼ 사건첩'), evBox, fbBox);
    const evs = evidenceList();
    // 필요한 증거가 없으면(선생님이 장을 건너뛴 경우) 이야기 글로 채워 둔다
    for (const ln of step.lines) if (!evs.find((e) => e.id === ln.ev)) evs.push(fallbackEvidence(ln.ev));
    const evEls = {};
    for (const e of evs) {
      const el = h('button.ev.pick', { type: 'button' }, h('h4', e.title), h('div.txt', e.text));
      if (st.stamps[e.id]) el.appendChild(h('span.seal-mark.ok-seal', '확인'));
      evEls[e.id] = el; evBox.appendChild(el);
    }
    ctx.tray(h('div.hint-line', '고백이 확인해 주는 사건을 사건첩에서 누르세요.'));
    for (const ln of step.lines) {
      talk.appendChild(h('div.para.say.show', { style: { '--pc': p.color } }, h('div.who', h('img', { src: G.util.pt(step.who), alt: '' })), h('div.bubble', h('span.nm', p.name), ln.t)));
      G.audio.page();
      talk.lastChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      let first = true;
      await new Promise((res) => {
        const handlers = [];
        for (const id in evEls) {
          const el = evEls[id];
          const fn = () => {
            if (id === ln.ev) {
              if (first && !replay) G.save.stat('reveal', true);
              st.stamps[id] = true;
              if (!el.querySelector('.ok-seal')) el.appendChild(h('span.seal-mark.ok-seal', '확인'));
              ui.stamp('確認'); G.audio.ok(); fbBox.innerHTML = '';
              handlers.forEach(([e, f]) => e.removeEventListener('click', f));
              res();
            } else {
              if (first && !replay) G.save.stat('reveal', false);
              first = false;
              G.audio.no(); ui.shake(el); feedback(fbBox, 'warn', '이 고백과는 다른 사건이에요.');
            }
          };
          el.addEventListener('click', fn); handlers.push([el, fn]);
        }
      });
      await wait(500);
    }
    G.save.write();
    await nextButton(ctx);
  };
  function fallbackEvidence(id) {
    for (const ch of STORY) for (const s of ch.steps) {
      if (s.id === id && s.type === 'case') return { id, title: s.evidence.title, short: s.evidence.short, text: s.lines.join(' ').replace(/\[([^\]]+)\]/g, '$1') };
      if (s.evidence && s.evidence.id === id) return { id, title: s.evidence.title, short: s.evidence.short, text: s.evidence.text };
    }
    return { id, title: id, text: '' };
  }

  // ───────── 죄목 따지기 ─────────
  steps.charges = async function (step, ctx) {
    const replay = !!S().done[step.id]; // 다시 보기에서는 첫 시도·오답 기록을 다시 남기지 않는다
    ctx.main.appendChild(h('p', G.util.boldNodes(step.intro || '')));
    const now = h('div.charge-now');
    const list = h('ol');
    const scroll = h('div.scroll-list', h('div.small.muted', '유 상서가 따진 죄'), list);
    const evBox = h('div.dex'), fbBox = h('div');
    ctx.main.append(now, fbBox, h('p.small.muted', '▼ 사건첩(증거)'), evBox, scroll);
    const evs = evidenceList();
    for (const c of step.charges) if (!evs.find((e) => e.id === c.ev)) evs.push(fallbackEvidence(c.ev));
    const evEls = {};
    for (const e of shuffle(evs)) {
      const el = h('button.ev.pick', { type: 'button' }, h('h4', e.title), h('div.txt', e.text));
      evEls[e.id] = el; evBox.appendChild(el);
    }
    ctx.tray(h('div.hint-line', '지금 따지는 죄에 맞는 증거를 사건첩에서 고르세요.'));
    let i = 0;
    for (const c of step.charges) {
      i++;
      now.innerHTML = '';
      now.append(h('small', `죄목 ${i} / ${step.charges.length}`), c.t);
      now.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      let first = true;
      await new Promise((res) => {
        const hs = [];
        for (const id in evEls) {
          const el = evEls[id];
          const fn = () => {
            if (el.classList.contains('used')) return;
            if (id === c.ev) {
              if (first && !replay) G.save.stat('charges', true);
              el.classList.add('used');
              list.appendChild(h('li', c.t));
              G.audio.stamp(); fbBox.innerHTML = '';
              hs.forEach(([e, f]) => e.removeEventListener('click', f));
              res();
            } else {
              if (first && !replay) { G.save.stat('charges', false); G.save.wrong('charges', `「${c.t}」의 증거는 ${fallbackEvidence(c.ev).title}`); }
              first = false;
              G.audio.no(); ui.shake(el); feedback(fbBox, 'warn', '이 증거는 다른 죄에 해당해요.');
            }
          };
          el.addEventListener('click', fn); hs.push([el, fn]);
        }
      });
      await wait(350);
    }
    now.innerHTML = '';
    now.append(h('small', '모든 죄를 따졌다'), '역부취주(逆婦就誅) — 도리를 거스른 여인이 벌을 받다');
    G.audio.fanfare();
    await ui.stamp('斷罪');
    await nextButton(ctx);
  };

  // ───────── 해석 질문 ─────────
  steps.reflect = async function (step, ctx) {
    const st = S();
    const card = h('div.card.interp', h('span.kind', '해석 · 채점하지 않아요'), h('h3', step.title), h('p', G.util.boldNodes(step.q)));
    const opts = h('div.pool');
    step.options.forEach((o, i) => {
      const el = h('button.slip', { type: 'button' }, o);
      if (st.reflect[step.id] === i) el.classList.add('sel');
      el.addEventListener('click', () => { G.audio.tap(); st.reflect[step.id] = i; $$('.slip', opts).forEach((x) => x.classList.remove('sel')); el.classList.add('sel'); G.save.write(); next.disabled = false; });
      opts.appendChild(el);
    });
    card.appendChild(opts);
    if (step.note) card.appendChild(h('p.small.muted', step.note));
    ctx.main.appendChild(card);
    const next = actionBtn('다음 ▶', 'primary', () => res());
    next.disabled = st.reflect[step.id] == null;
    let res; const p = new Promise((r) => (res = r));
    ctx.tray(h('div.actions', next));
    await p;
  };

  // ───────── 관계도 빈자리 ─────────
  steps.mapfill = async function (step, ctx) {
    const st = S();
    ctx.main.appendChild(h('div.card.note', h('h3', step.title), h('p', G.util.boldNodes(step.intro || ''))));
    const holder = h('div.map-inline');
    const fbBox = h('div');
    ctx.main.append(holder, fbBox);
    const placed = {};
    let sel = null, selPerson = null, tries = 0, solved = false;
    // 다시 보기: 이미 채운 관계도면 완성된 모습만 보여 준다(첫 시도 기록은 건드리지 않음)
    if (st.done[step.id]) {
      const m = ui.map({ done: st.done, met: st.met, labelsFor: step.blanks });
      m.style.height = '100%';
      holder.appendChild(m);
      await nextButton(ctx);
      return;
    }
    // 푸는 동안에는 옆 관계도·편람 관계도에서 빈자리 인물을 가린다(정답이 보이지 않게)
    G.app.mapMask = step.blanks;
    ctx.refresh();
    function draw() {
      holder.innerHTML = '';
      const m = ui.map({ done: st.done, met: st.met, blanks: solved ? [] : step.blanks, placed, sel, onNode, labelsFor: step.blanks });
      m.style.height = '100%';
      holder.appendChild(m);
    }
    function onNode(id) {
      if (solved || !step.blanks.includes(id)) return;
      G.audio.tap();
      if (selPerson) { put(id, selPerson); return; }
      sel = sel === id ? null : id; draw(); update();
    }
    function put(blank, person) {
      for (const k in placed) if (placed[k] === person) delete placed[k];
      placed[blank] = person; sel = null; selPerson = null;
      G.audio.pick(); draw(); update();
      $$('.person', people).forEach((b) => b.classList.remove('sel'));
    }
    const people = h('div.scroll');
    for (const id of shuffleNot(step.blanks)) {
      const b = ui.personChip(id);
      b.addEventListener('click', () => {
        G.audio.tap();
        if (sel) { put(sel, id); return; }
        selPerson = selPerson === id ? null : id;
        $$('.person', people).forEach((x) => x.classList.toggle('sel', x.dataset.id === selPerson));
      });
      people.appendChild(b);
    }
    const hint = h('div.hint-line', '물음표 자리를 누르고 알맞은 인물을 고르세요.');
    const checkBtn = actionBtn('맞추어 보기', 'seal', check);
    const solveBtn = teacherSolve(() => { step.blanks.forEach((b) => (placed[b] = b)); check(true); });
    ctx.tray(h('div', hint, h('div.row', people), h('div.actions', solveBtn || '', checkBtn)));
    function update() {
      checkBtn.disabled = solved || step.blanks.some((b) => !placed[b]);
      $$('.person', people).forEach((x) => x.classList.toggle('used', Object.values(placed).includes(x.dataset.id)));
    }
    draw(); update();
    let resolveDone; const donePromise = new Promise((r) => (resolveDone = r));
    async function check(byTeacher) {
      tries++;
      const bad = step.blanks.filter((b) => placed[b] !== b);
      if (tries === 1 && !byTeacher) G.save.stat('map', !bad.length);
      if (!bad.length) {
        solved = true; draw(); update();
        step.blanks.forEach((b) => (st.met[b] = true));
        ui.stamp('確認'); G.audio.ok(); fbBox.innerHTML = '';
        G.app.mapMask = null;
        G.save.write(); ctx.refresh();
        await nextButton(ctx); resolveDone(); return;
      }
      G.audio.no();
      bad.forEach((b) => G.save.wrong('map', `관계도: ${PEOPLE[b].name}의 자리`));
      let msg = `${step.blanks.length}자리 가운데 **${step.blanks.length - bad.length}자리**가 맞았어요. 선에 적힌 관계를 다시 보세요.`;
      if (tries >= 2) { bad.forEach((b) => delete placed[b]); msg += '\n틀린 자리는 다시 비웠어요.'; draw(); update(); }
      feedback(fbBox, 'warn', msg);
      if (tries >= 3) fbBox.appendChild(actionBtn('정답 보기', 'small', () => { st.helped++; step.blanks.forEach((b) => (placed[b] = b)); check(true); }));
    }
    await donePromise;
  };
})();
