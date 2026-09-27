'use strict';
// 소리: 모두 브라우저에서 합성한다(파일 없음).
//  - 가야금 소리: Karplus-Strong 방식으로 줄 뜯는 소리를 만든다
//  - 배경음: 계면조 느낌의 다섯 음(라·도·레·미·솔)을 느리게 뜯는 생성형 가락 + 낮은 지속음
(function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  const cache = {};
  const SCALE = [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25, 587.33]; // 라 도 레 미 솔 라 도 레

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.0; musicBus.connect(master);
    return ctx;
  }

  function pluckBuffer(freq, dur = 1.6, bright = 0.5) {
    const key = freq.toFixed(1) + ':' + dur + ':' + bright;
    if (cache[key]) return cache[key];
    const sr = ctx.sampleRate, len = Math.floor(sr * dur), N = Math.max(2, Math.round(sr / freq));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    const damp = 0.996 - (1 - bright) * 0.004;
    for (let i = N; i < len; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N + 1]);
    // 가야금처럼 줄을 누르는 떨림 없이 부드럽게 끝나도록 꼬리를 줄인다
    for (let i = 0; i < len; i++) d[i] *= Math.min(1, (len - i) / (sr * 0.3));
    return (cache[key] = buf);
  }

  function pluck(freq, when = 0, vol = 0.5, bus = sfxBus, dur = 1.6, bright = 0.5) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(freq, dur, bright);
    const g = ctx.createGain(); g.gain.value = vol;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(ctx.currentTime + when);
  }

  function noise(dur, type, freq, vol, when = 0, q = 1) {
    const sr = ctx.sampleRate, len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(ctx.currentTime + when);
    return { f, g, src };
  }

  function tone(freq, dur, vol, type = 'sine', when = 0, bus = sfxBus, slideTo = 0) {
    const o = ctx.createOscillator(); o.type = type;
    const t = ctx.currentTime + when;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const on = () => G.save.state.sound && init();

  G.audio = {
    unlock() { if (init() && ctx.state === 'suspended') ctx.resume(); if (G.save.state.music) this.music(true); },
    tap() { if (on()) noise(0.03, 'bandpass', 2200, 0.25, 0, 2); },
    pick() { if (on()) pluck(SCALE[5], 0, 0.35, sfxBus, 0.8, 0.7); },
    pencil() { if (on()) noise(0.08, 'highpass', 3500, 0.12); },
    page() { if (!on()) return; const n = noise(0.28, 'bandpass', 900, 0.18, 0, 0.7); n.f.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.25); },
    stamp() { if (!on()) return; tone(130, 0.18, 0.6, 'sine', 0, sfxBus, 55); noise(0.12, 'lowpass', 500, 0.5); },
    ok() { if (!on()) return; [2, 4, 5].forEach((n, i) => pluck(SCALE[n], i * 0.09, 0.45)); },
    no() { if (!on()) return; pluck(SCALE[1] / 2, 0, 0.45, sfxBus, 1.0, 0.3); pluck(SCALE[0] / 2, 0.14, 0.4, sfxBus, 1.0, 0.3); },
    fanfare() {
      if (!on()) return;
      [0, 2, 3, 4, 5, 7].forEach((n, i) => pluck(SCALE[n], i * 0.11, 0.45));
      tone(98, 2.6, 0.22, 'sine', 0.7); tone(98.6, 2.6, 0.12, 'sine', 0.7); // 징
    },
    music(want) {
      if (!init()) return;
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.linearRampToValueAtTime(want && G.save.state.sound ? 0.32 : 0, t + 1.2);
      if (want && !this._loop) startLoop();
    },
  };

  // 생성형 배경음: 한 장단(약 6초)마다 3~6음 짧은 가락, 가끔 쉼
  function startLoop() {
    const beat = 0.85;
    let deg = 3;
    G.audio._loop = setInterval(() => {
      if (!ctx || musicBus.gain.value < 0.01 || document.hidden) return;
      // 낮은 지속음(아주 작게)
      tone(110, beat * 6, 0.05, 'sine', 0, musicBus);
      if (Math.random() < 0.25) return; // 쉬는 장단
      const n = 3 + Math.floor(Math.random() * 4);
      let t = 0;
      for (let i = 0; i < n; i++) {
        deg = Math.max(0, Math.min(SCALE.length - 1, deg + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        pluck(SCALE[deg], t, 0.28 + Math.random() * 0.1, musicBus, 2.2, 0.45);
        t += beat * (Math.random() < 0.3 ? 1.5 : 1);
      }
      if (Math.random() < 0.5) tone(70, 0.4, 0.18, 'sine', 0, musicBus, 50); // 북
    }, beat * 6 * 1000);
  }
})();
