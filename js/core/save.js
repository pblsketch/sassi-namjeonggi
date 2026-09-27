'use strict';
// 진행 저장: 이 브라우저(localStorage)에만 저장하고 서버로 보내지 않는다
(function () {
  const KEY = 'sassi-jiwojin-v1';
  const fresh = () => ({
    v: 1,
    mode: 'first',          // first: 처음 읽기(도입) / review: 다시 읽기(복습)
    font: 1,                // 글자 크기 배율
    sound: true,
    music: false,           // 배경음(교실에서는 기본으로 끔)
    teacher: false,
    name: '',
    sealed: false,          // 필사기에 이름 도장을 찍었는지
    seenFiction: {},        // 본 게임 설정 카드
    done: {},               // 끝낸 단계 id
    chDone: {},             // 끝낸 장 id
    tokens: {},             // 호칭 잇기 확정: '단계#번호' → 인물 id
    aliases: {},            // 호칭 도감: '인물|호칭' → true
    met: {},                // 만난 인물
    cases: {},              // 사건: id → { tries, helped, text }
    evidence: {},           // 증거(사건첩 항목): id → true
    stamps: {},             // 설매의 고백으로 확인됨: id → true
    reflect: {},            // 해석 질문의 답
    stats: {},              // 영역별 첫 시도: { names:[맞음,전체], case:[...], ... }
    wrong: [],              // 오답 노트 [{kind, text}]
    helped: 0,              // 도움(힌트) 사용 횟수
    startedAt: 0,
    finishedAt: 0,
  });
  let S = fresh();
  G.save = {
    get state() { return S; },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) S = Object.assign(fresh(), JSON.parse(raw));
      } catch (e) { /* 저장소를 못 쓰는 환경: 새로 시작 */ }
      return S;
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ }
    },
    reset(keepSettings) {
      const keep = keepSettings ? { mode: S.mode, font: S.font, sound: S.sound, music: S.music, teacher: S.teacher, name: S.name } : {};
      S = Object.assign(fresh(), keep);
      this.write();
      return S;
    },
    stat(kind, ok) {
      const s = (S.stats[kind] = S.stats[kind] || [0, 0]);
      if (ok) s[0]++;
      s[1]++;
    },
    wrong(kind, text) {
      if (!S.wrong.some((w) => w.text === text)) S.wrong.push({ kind, text });
    },
  };
})();
