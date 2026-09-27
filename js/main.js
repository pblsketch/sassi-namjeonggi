'use strict';
// 시작점. 주소 뒤에 붙이는 바로가기:
//   ?ch=ch3      그 장으로 바로 (예: ch0 서장, ch1~ch5, chE 종장)
//   ?teacher=1   선생님용(모든 장 열기 + 정답 채우기) 켜기
//   ?result=1    결과 화면 보기
(function () {
  G.save.load();
  const q = new URLSearchParams(location.search);
  if (q.get('teacher') === '1') { G.save.state.teacher = true; G.save.write(); }
  G.app.applySettings();
  const go = () => {
    const ch = q.get('ch');
    if (ch && STORY.some((c) => c.id === ch)) return G.app.play(ch);
    if (q.get('result') === '1') return G.app.result();
    G.app.title();
  };
  // 첫 터치에서 소리를 켤 수 있게(브라우저 정책)
  document.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });
  go();
})();
