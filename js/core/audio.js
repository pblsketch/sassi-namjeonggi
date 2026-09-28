'use strict';
// 소리
//  - 배경음: 국립국악원 「국악기 디지털 음원」의 양금 악구 녹음(공공누리 제1유형)을 악곡별로 이어 붙인 것(assets/music/*.mp3).
//    tools/build_music.py로 만든다. 곡은 장마다 분위기에 맞춰 고른다(STORY의 music, 단계의 music).
//    필요할 때 내려받아 풀고(곡마다 1MB 안팎), 풀어 둔 소리는 최근 3곡만 들고 있는다(휴대폰 메모리).
//  - 효과음: 브라우저에서 합성한다(같은 만든이의 「관동별곡: 잃어버린 시구」 합성 엔진)
//    가야금(Karplus-Strong), 대금(사인파 + 숨소리), 장구(덩·쿵·덕·기덕)·북·징, 합성한 공간 울림(ConvolverNode)
// 배경음·효과음은 설정에서 따로 끈다.
(function () {
  const MUSIC_VOL = 0.5, SFX_VOL = 0.8;
  let ctx = null, comp, musicBus, sfxBus, revIn;
  let ksCache = {}, noiseBuf = null;
  const A = (G.audio = { track: null });
  const S = () => G.save.state;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // 소리 길(버스) 만들기: 실제 재생과 미리 듣기(오프라인 렌더)에 함께 쓴다
  function buildGraph(c) {
    const cp = c.createDynamicsCompressor();
    cp.threshold.value = -14; cp.knee.value = 12; cp.ratio.value = 3; cp.attack.value = 0.01; cp.release.value = 0.25;
    const master = c.createGain(); master.gain.value = 1;
    cp.connect(master); master.connect(c.destination);
    const mb = c.createGain(); mb.gain.value = MUSIC_VOL; mb.connect(cp);
    const sb = c.createGain(); sb.gain.value = SFX_VOL; sb.connect(cp);
    const rev = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.4) * (i < 400 ? i / 400 : 1); }
    }
    rev.buffer = ir;
    const ri = c.createGain(); ri.gain.value = 1;
    const ro = c.createGain(); ro.gain.value = 0.3;
    const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 5000;
    ri.connect(rev); rev.connect(rl); rl.connect(ro); ro.connect(cp);
    return { comp: cp, musicBus: mb, sfxBus: sb, revIn: ri };
  }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    ({ comp, musicBus, sfxBus, revIn } = buildGraph(ctx));
    musicBus.gain.value = S().music ? MUSIC_VOL : 0;
    // 다른 탭으로 가면 소리를 멈춘다(교실에서 여러 기기가 동시에 울리지 않게)
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
      const el = cur && cur.el; // file://로 열어 <audio>로 트는 경우
      if (el) { if (document.hidden) el.pause(); else el.play().catch(() => {}); }
    });
    A.ctx = ctx;
    return ctx;
  }

  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function gainNode(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; }
  function send(node, out, wet) { node.connect(out); if (wet > 0) { const s = gainNode(wet); node.connect(s); s.connect(revIn); } }

  // ───────── 가야금 (Karplus-Strong)
  function ksBuffer(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = ctx.sampleRate, f = mtof(midi);
    const N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * (midi < 60 ? 3.2 : 2.4));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5; // 명주실처럼 부드러운 소리
    const decay = 0.9955 + 0.003 * Math.min(1, Math.max(0, (midi - 45) / 40));
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      ring[idx] = (a + b) * 0.5 * decay;
      d[i] = a;
      idx = (idx + 1) % N;
    }
    return (ksCache[midi] = buf);
  }
  function gayageum(t, midi, dur, vel, orn, out, wet = 0.28) {
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(Math.round(midi));
    const r = src.playbackRate;
    r.setValueAtTime(orn.includes('<') ? 0.945 : 1, t);
    if (orn.includes('<')) r.linearRampToValueAtTime(1, t + 0.09);
    if (orn.includes('~') && dur > 0.35) { // 농현: 줄을 눌렀다 놓았다
      for (let k = 0, tt = t + 0.18; tt < t + dur; k++, tt += 0.11) r.linearRampToValueAtTime(k % 2 ? 1 : 1.022, tt);
      r.linearRampToValueAtTime(1, t + dur);
    }
    if (orn.includes('>')) { r.setValueAtTime(1, t + Math.max(0.05, dur - 0.18)); r.linearRampToValueAtTime(0.95, t + dur); }
    const lp = filt('lowpass', 3800), body = filt('peaking', 900, 1); body.gain.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.55, t);
    g.gain.setTargetAtTime(0.0001, t + dur + 0.05, 0.35);
    src.connect(body); body.connect(lp); lp.connect(g); send(g, out, wet);
    src.start(t); src.stop(t + dur + 2.2);
  }

  // ───────── 대금
  function daegeum(t, midi, dur, vel, orn, out, prev, wet = 0.36) {
    const f = mtof(midi);
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const set = (fq, at) => { o1.frequency.setValueAtTime(fq, at); o2.frequency.setValueAtTime(fq, at); o3.frequency.setValueAtTime(fq * 2, at); };
    const ramp = (fq, at) => { o1.frequency.linearRampToValueAtTime(fq, at); o2.frequency.linearRampToValueAtTime(fq, at); o3.frequency.linearRampToValueAtTime(fq * 2, at); };
    if (prev) { set(mtof(prev), t); ramp(f, t + 0.07); }
    else if (orn.includes('<')) { set(f * 0.94, t); ramp(f, t + 0.1); }
    else set(f, t);
    if (orn.includes('>')) { const s = t + Math.max(0.1, dur - 0.2); set(f, s); ramp(f * 0.955, t + dur); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
    const vs = t + Math.min(0.45, dur * 0.4), depth = f * (orn.includes('~') ? 0.016 : 0.006);
    lg.gain.linearRampToValueAtTime(0, vs); lg.gain.linearRampToValueAtTime(depth, Math.min(t + dur, vs + 0.4));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const mix = ctx.createGain(); mix.gain.value = 1;
    const g2 = gainNode(0.14), g3 = gainNode(0.05);
    o1.connect(mix); o2.connect(g2); g2.connect(mix); o3.connect(g3); g3.connect(mix);
    const n = noise(), bp = filt('bandpass', f * 1.6, 0.9), ng = gainNode(0.035 * vel); // 숨소리
    n.connect(bp); bp.connect(ng); ng.connect(mix);
    const ch = noise(), hp = filt('highpass', 2500), cg = ctx.createGain(); // 첫소리의 바람 잡음
    cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    ch.connect(hp); hp.connect(cg); cg.connect(mix);
    const env = ctx.createGain(), peak = 0.2 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (prev ? 0.03 : 0.08));
    env.gain.setValueAtTime(peak, t + Math.max(0.09, dur - 0.06));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
    const lp = filt('lowpass', 4200);
    mix.connect(lp); lp.connect(env); send(env, out, wet);
    const end = t + dur + 0.3;
    [o1, o2, o3, lfo, n, ch].forEach((s) => { s.start(t); s.stop(end); });
  }

  // ───────── 타악: 장구·북·징
  function hit(t, kind, vel, out) {
    const kung = (tt, v) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(96, tt); o.frequency.exponentialRampToValueAtTime(56, tt + 0.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.6 * v, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.38);
      o.connect(g); send(g, out, 0.12); o.start(tt); o.stop(tt + 0.42);
      const n = noise(), lp = filt('lowpass', 380), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.2 * v, tt); ng.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(tt); n.stop(tt + 0.08);
    };
    const deok = (tt, v) => {
      const n = noise(), bp = filt('bandpass', 2700, 2.5), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.42 * v, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
      n.connect(bp); bp.connect(g); send(g, out, 0.15); n.start(tt); n.stop(tt + 0.09);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(820, tt); o.frequency.exponentialRampToValueAtTime(560, tt + 0.04);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.12 * v, tt); og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
      o.connect(og); og.connect(out); o.start(tt); o.stop(tt + 0.06);
    };
    if (kind === 'kung') kung(t, vel);
    else if (kind === 'deok') deok(t, vel);
    else if (kind === 'deong') { kung(t, vel); deok(t, vel * 0.9); }
    else if (kind === 'gideok') { deok(t - 0.07, vel * 0.45); deok(t, vel); }
    else if (kind === 'buk') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.45);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); send(g, out, 0.2); o.start(t); o.stop(t + 0.65);
      const n = noise(), lp = filt('lowpass', 260), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.12);
    } else if (kind === 'jing') {
      const f0 = 108;
      [[1, 1], [2.02, 0.55], [2.74, 0.4], [3.46, 0.28], [4.22, 0.18], [5.4, 0.1]].forEach(([m, a], i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f0 * m * 1.012, t); o.frequency.exponentialRampToValueAtTime(f0 * m, t + 1.2);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * a * vel, t + 0.03 + i * 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2 - i * 0.4);
        o.connect(g); send(g, out, 0.45); o.start(t); o.stop(t + 4.3);
      });
    }
  }

  // ───────── 배경음(녹음)
  // piece = 악곡 이름(국립국악원 양금 악구), gain = 곡끼리 음량 맞춤(tests/audio.mjs로 잼), wet = 공간 울림(꿈 장면만)
  const MUSIC_DIR = 'assets/music/';
  const LOOP_GAP = 1.2; // 한 바퀴 끝나고 다시 시작하기 전의 쉼(초)
  const TRACKS = {
    shop: { piece: '우조가락도드리', gain: 0.93 },     // 타이틀·세책방: 밝은 우조, 정겹게
    peace: { piece: '세령산', gain: 1.01 },            // 서장(유씨 집안·관음찬·혼인): 단정하고 우아하게
    unease: { piece: '계면가락도드리', gain: 0.99 },   // 1장(첩을 들이다): 계면조로 기운다
    scheme: { piece: '언편', gain: 1.01 },             // 2장(옥가락지)·모함 장면: 계면 편장단이 거칠게 몰아간다
    sorrow: { piece: '상령산', gain: 1.2 },            // 3장(쫓겨난 부인): 아주 느리고 무겁게
    wander: { piece: '윗도드리', gain: 1.01 },         // 4장(남쪽으로): 흘러가는 먼 길
    dream: { piece: '보허사', gain: 1.1, wet: 0.35 },  // 황릉묘의 꿈: 당악 계통 '허공을 걷는 노래'
    hope: { piece: '타령', gain: 1.02 },               // 5장(돌아온 진실): 경쾌하게 다시 밝아진다
    judgment: { piece: '편락', gain: 1 },              // 종장(교씨의 죄를 따짐): 빠르게 몰아친다
    resolve: { piece: '하현도드리', gain: 1.03 },      // 종장(재회·하늘의 도리): 따뜻하게 정리한다
    finale: { piece: '군악', gain: 0.86 },             // 필사기(결과 화면): 씩씩하고 화려하게
  };

  // 출처 표시(공공누리 제1유형): 타이틀에는 짧게, 설정·README에는 온전히
  A.CREDIT = '배경음 국립국악원 「국악기 디지털 음원」 양금 연주(공공누리 제1유형)';
  A.CREDIT_FULL = '배경음은 국립국악원이 공공누리 제1유형으로 개방한 「국악기 디지털 음원」의 양금 악구(' +
    [...new Set(Object.values(TRACKS).map((t) => t.piece))].join('·') + ')를 이어 붙여 썼어요. 원본은 국립국악원 누리집(gugak.go.kr/digitaleum)에서 무료로 받을 수 있어요.';

  const decode = (c, ab) => new Promise((ok, no) => c.decodeAudioData(ab, ok, no)); // 옛 사파리는 콜백 꼴만 된다
  const files = {};          // 곡 이름 → 내려받은 파일(Promise<ArrayBuffer>)
  const decoded = new Map(); // 곡 이름 → 풀어 둔 소리(최근 3곡)
  function fetchTrack(name) {
    if (!files[name]) {
      files[name] = fetch(MUSIC_DIR + name + '.mp3').then((r) => { if (!r.ok) throw new Error(name + ' ' + r.status); return r.arrayBuffer(); });
      files[name].catch(() => { delete files[name]; }); // 실패하면 다음에 다시 받는다
    }
    return files[name];
  }
  async function bufferOf(name) {
    if (decoded.has(name)) { const b = decoded.get(name); decoded.delete(name); decoded.set(name, b); return b; }
    const buf = await decode(ctx, (await fetchTrack(name)).slice(0)); // 풀면 원본이 비워지므로 복사본을 넘긴다
    decoded.set(name, buf);
    while (decoded.size > 3) decoded.delete(decoded.keys().next().value);
    return buf;
  }

  // file://로 열면 브라우저가 fetch로 파일 읽기를 막는다 → 그때는 <audio>로 곧장 튼다(음량은 요소 볼륨으로)
  const viaElement = location.protocol === 'file:';
  function fadeEl(el, to, sec, done) {
    clearInterval(el._fade);
    const from = el.volume, steps = Math.max(1, Math.round(sec * 20));
    let k = 0;
    el._fade = setInterval(() => {
      el.volume = Math.max(0, Math.min(1, from + (to - from) * (++k / steps)));
      if (k >= steps) { clearInterval(el._fade); if (done) done(); }
    }, 50);
  }

  let cur = null;
  function startTrack(name) {
    stopTrack(true);
    const def = TRACKS[name];
    if (viaElement) {
      const el = new Audio(MUSIC_DIR + name + '.mp3'); el.loop = true; el.volume = 0;
      const me = (cur = { name, el, src: null });
      el.play().then(() => {
        if (cur !== me) { el.pause(); return; }
        me.src = el;
        fadeEl(el, Math.min(1, MUSIC_VOL * (def.gain || 1)), 1.2);
      }).catch(() => { if (cur === me) cur = null; });
      return;
    }
    const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(musicBus);
    if (def.wet) { const w = gainNode(def.wet); bus.connect(w); w.connect(revIn); }
    const me = (cur = { name, bus, src: null });
    bufferOf(name).then((buf) => {
      if (cur !== me) return;
      const t0 = ctx.currentTime + 0.05;
      bus.gain.setValueAtTime(0.0001, t0);
      bus.gain.exponentialRampToValueAtTime(def.gain || 1, t0 + 1.2);
      const loop = (t) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(bus); s.start(t);
        me.src = s;
        s.onended = () => { if (cur === me) loop(Math.max(ctx.currentTime + 0.02, t + buf.duration + LOOP_GAP)); };
      };
      loop(t0);
    }).catch(() => { if (cur === me) cur = null; }); // 못 받으면(오프라인 등) 조용히 넘어간다
  }
  function stopTrack(fast) {
    if (cur && cur.el) { const el = cur.el; fadeEl(el, 0, fast ? 0.8 : 1.5, () => el.pause()); }
    else if (cur && ctx) {
      const { bus, src } = cur, now = ctx.currentTime, len = fast ? 0.8 : 1.5;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
      bus.gain.exponentialRampToValueAtTime(0.0001, now + len);
      if (src) { src.onended = null; try { src.stop(now + len + 0.1); } catch (e) { /* 이미 멈춤 */ } }
      setTimeout(() => bus.disconnect(), (len + 0.5) * 1000);
    }
    cur = null;
  }
  // 지금 들려야 할 곡을 맞춘다(배경음을 끄면 재생도 멈춘다)
  function sync() {
    if (!ctx) return;
    const want = S().music && A.track && TRACKS[A.track] ? A.track : null;
    if (!want) { if (cur) stopTrack(false); return; }
    if (!cur || cur.name !== want) startTrack(want);
  }

  A.unlock = function () {
    if (!init()) return;
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
    sync();
  };
  // 장면의 곡 정하기(같은 곡이면 그대로 이어서)
  A.play = function (name) {
    A.track = name || null;
    sync();
  };
  // 곧 쓸 곡 파일을 미리 받아 둔다(장에 들어갈 때 그 장의 곡들과 다음 장의 곡).
  // 교실 와이파이가 느려도 지금 곡이 먼저 나오게, 지금 곡을 받은 뒤 하나씩 차례로 받는다
  A.preload = function (names) {
    if (viaElement || !S().music) return;
    let chain = A.track && TRACKS[A.track] ? fetchTrack(A.track).catch(() => {}) : Promise.resolve();
    for (const n of new Set(names)) if (n && TRACKS[n]) chain = chain.then(() => fetchTrack(n)).catch(() => {});
  };
  // 배경음 켜기/끄기(설정)
  A.music = function (want) {
    if (!init()) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(want ? MUSIC_VOL : 0, now + 0.8);
    if (want && ctx.state === 'suspended') ctx.resume();
    sync();
  };

  // ───────── 효과음(가야금·장구·종이 소리)
  const sfxOn = () => S().sound && init() && ctx.state !== 'closed';
  function tone(type, f0, f1, dur, vol, t0 = 0) {
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, vol, f0, f1, type = 'bandpass', t0 = 0, q = 1) {
    const t = ctx.currentTime + t0;
    const n = noise(), f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
  }
  const pl = (m, dt = 0, v = 0.8, dur = 0.5, orn = '') => gayageum(ctx.currentTime + dt, m, dur, v, orn, sfxBus, 0.25);
  const SFX = {
    tap: () => hiss(0.03, 0.1, 2600, 1800, 'bandpass', 0, 3),                                           // 누르기: 얇은 나무 소리
    pick: () => pl(81, 0, 0.4, 0.25),                                                                   // 낱말 카드 고르기·놓기
    pencil: () => { hiss(0.18, 0.07, 1600, 4200, 'bandpass', 0, 0.9); pl(86, 0.04, 0.22, 0.15); },    // 붓으로 호칭 표시
    page: () => { hiss(0.24, 0.1, 700, 2800, 'bandpass', 0, 0.7); hiss(0.12, 0.05, 3000, 6500, 'highpass', 0.06); }, // 종이 넘기기
    stamp: () => { hit(ctx.currentTime, 'kung', 0.8, sfxBus); hiss(0.09, 0.16, 800, 200, 'lowpass'); }, // 도장
    ok: () => { [74, 79, 81, 86].forEach((m, i) => pl(m, i * 0.07, 0.8, 0.7)); hit(ctx.currentTime + 0.02, 'deok', 0.45, sfxBus); }, // 맞음
    no: () => { pl(64, 0, 0.6, 0.45, '>'); pl(62, 0.16, 0.55, 0.6, '>'); },                          // 틀림: 가야금을 꺾어 내린다
    hint: () => daegeum(ctx.currentTime, 81, 0.7, 0.6, '~', sfxBus, null, 0.4),                       // 여백의 메모
    inspect: () => { hit(ctx.currentTime, 'deok', 0.35, sfxBus); pl(88, 0.03, 0.35, 0.3); },           // 그림 속 조사 지점
    clue: () => { pl(79, 0, 0.55, 0.35); pl(84, 0.07, 0.55, 0.5); },                                   // 새 낱말을 얻음
    chapter: () => { hit(ctx.currentTime, 'jing', 0.55, sfxBus); hit(ctx.currentTime, 'buk', 0.6, sfxBus); }, // 장 펼치기
    fanfare: () => { [67, 69, 72, 74, 76, 79, 81].forEach((m, i) => pl(m, i * 0.08, 0.75, 0.9)); hit(ctx.currentTime + 0.6, 'jing', 0.8, sfxBus); hit(ctx.currentTime + 0.6, 'buk', 0.7, sfxBus); }, // 장 복원 끝
  };
  for (const k of Object.keys(SFX)) A[k] = () => { if (!sfxOn()) return; try { SFX[k](); } catch (e) { /* 무시 */ } };

  // ───────── 점검용: 곡을 오프라인으로 렌더해 AudioBuffer로 돌려준다(게임과 같은 소리 길: 곡 음량·배경음 크기·압축기)
  A.render = async function (name, seconds = 20, rate = 44100) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OAC(2, Math.ceil(seconds * rate), rate);
    const g = buildGraph(off), def = TRACKS[name];
    const buf = await decode(off, (await fetchTrack(name)).slice(0));
    const tb = off.createGain(); tb.gain.value = def.gain || 1; tb.connect(g.musicBus);
    if (def.wet) { const w = off.createGain(); w.gain.value = def.wet; tb.connect(w); w.connect(g.revIn); }
    for (let t = 0.05; t < seconds; t += buf.duration + LOOP_GAP) {
      const s = off.createBufferSource(); s.buffer = buf; s.connect(tb); s.start(t);
    }
    return off.startRendering();
  };
  A.now = () => (cur ? cur.name : null);           // 지금 흐르는(또는 받는 중인) 곡(점검용)
  A.ready = () => !!(cur && cur.src);              // 소리가 실제로 나기 시작했는지(점검용)
  A.TRACKS = TRACKS;
})();
