(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const faDigits = (value) => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // Friendly feedback that never interrupts the page.
  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Mobile navigation: close after selection, outside tap, or Escape.
  const menuToggle = $('#menuToggle');
  const mainNav = $('.main-nav');
  function closeMenu() {
    mainNav?.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
    menuToggle?.setAttribute('aria-label', 'باز کردن منو');
  }
  menuToggle?.addEventListener('click', () => {
    const isOpen = mainNav?.classList.toggle('open') ?? false;
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'بستن منو' : 'باز کردن منو');
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('click', event => {
    if (mainNav?.classList.contains('open') && !mainNav.contains(event.target) && !menuToggle?.contains(event.target)) closeMenu();
  });

  // Back to top.
  const backToTop = $('#backToTop');
  function updateBackToTop() { backToTop?.classList.toggle('visible', window.scrollY > 550); }
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  updateBackToTop();
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' }));

  // One AudioContext powers optional ambience, breathing tones, and tiny interaction sounds.
  let audioContext = null;
  let masterGain = null;
  let breathGain = null;
  let ambientNodes = [];
  let breathNodes = [];
  let activeSound = 'rain';
  let audioPlaying = false;
  let volume = 0.32;
  let breathSoundOn = true;
  const soundNames = { rain: 'باران آرام', ocean: 'موج دریا', wind: 'نسیم جنگل' };

  function getAudioContext() {
    if (audioContext && audioContext.state !== 'closed') return audioContext;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Audio is not supported in this browser.');
    audioContext = new AudioCtx();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
    breathGain = audioContext.createGain();
    breathGain.gain.value = 0.8;
    breathGain.connect(audioContext.destination);
    return audioContext;
  }

  function makeNoiseSource(context, seconds = 4) {
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function clearAmbient() {
    ambientNodes.forEach(node => {
      try { node.stop?.(); } catch (_) {}
      try { node.disconnect?.(); } catch (_) {}
    });
    ambientNodes = [];
  }

  function makeAmbient(kind) {
    const ctx = getAudioContext();
    clearAmbient();
    if (kind === 'rain') {
      const noise = makeNoiseSource(ctx);
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1550;
      const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 170;
      const softness = ctx.createBiquadFilter(); softness.type = 'peaking'; softness.frequency.value = 680; softness.Q.value = .6; softness.gain.value = -5;
      const gain = ctx.createGain(); gain.gain.value = .38;
      noise.connect(low); low.connect(high); high.connect(softness); softness.connect(gain); gain.connect(masterGain);
      noise.start(); ambientNodes.push(noise, low, high, softness, gain);
    } else if (kind === 'ocean') {
      const noise = makeNoiseSource(ctx);
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 500;
      const swell = ctx.createGain(); swell.gain.value = .25;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .075;
      const depth = ctx.createGain(); depth.gain.value = .18;
      lfo.connect(depth); depth.connect(swell.gain);
      noise.connect(low); low.connect(swell); swell.connect(masterGain);
      noise.start(); lfo.start(); ambientNodes.push(noise, low, swell, lfo, depth);
    } else {
      const noise = makeNoiseSource(ctx);
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 620;
      const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 90;
      const windGain = ctx.createGain(); windGain.gain.value = .19;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .045;
      const depth = ctx.createGain(); depth.gain.value = .12;
      lfo.connect(depth); depth.connect(windGain.gain);
      noise.connect(low); low.connect(high); high.connect(windGain); windGain.connect(masterGain);
      noise.start(); lfo.start(); ambientNodes.push(noise, low, high, windGain, lfo, depth);
    }
    if (masterGain) masterGain.gain.setTargetAtTime(audioPlaying ? volume : 0, ctx.currentTime, .18);
  }

  async function playAmbient() {
    try {
      const ctx = getAudioContext();
      if (!ambientNodes.length) makeAmbient(activeSound);
      if (ctx.state === 'suspended') await ctx.resume();
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setTargetAtTime(volume, ctx.currentTime, .35);
      audioPlaying = true;
      updateAudioUI();
    } catch (_) {
      audioPlaying = false;
      const status = $('#playerStatus');
      if (status) status.textContent = 'مرورگرت از پخش این صدا پشتیبانی نمی‌کنه.';
      showToast('فعلاً پخش صدا توی این مرورگر در دسترس نیست.');
    }
  }

  function pauseAmbient() {
    if (audioContext && masterGain && audioContext.state !== 'closed') {
      masterGain.gain.cancelScheduledValues(audioContext.currentTime);
      masterGain.gain.setTargetAtTime(0, audioContext.currentTime, .14);
    }
    audioPlaying = false;
    updateAudioUI();
  }

  function updateAudioUI() {
    const toggle = $('#soundToggle');
    const player = $('#ambientPlay');
    toggle?.setAttribute('aria-pressed', String(audioPlaying));
    const toggleText = $('#soundToggleText');
    if (toggleText) toggleText.textContent = `صدای آرامش: ${audioPlaying ? 'روشن' : 'خاموش'}`;
    player?.setAttribute('aria-pressed', String(audioPlaying));
    const glyph = $('#playGlyph');
    if (glyph) glyph.textContent = audioPlaying ? 'Ⅱ' : '▶';
    player?.setAttribute('aria-label', audioPlaying ? 'توقف صدای آرامش' : 'پخش صدای آرامش');
    const status = $('#playerStatus');
    if (status) status.textContent = audioPlaying ? 'داریم با هم گوش می‌دیم… هر وقت خواستی متوقفش کن.' : 'برای شنیدن، پخش رو بزن.';
  }

  function chooseSound(kind) {
    if (!soundNames[kind]) return;
    activeSound = kind;
    $$('.sound-card').forEach(card => {
      const selected = card.dataset.sound === kind;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    $$('.retreat-card').forEach(card => {
      const selected = card.dataset.scene === kind;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    const title = $('#currentSoundTitle');
    if (title) title.textContent = soundNames[kind];
    if (audioPlaying) {
      try { makeAmbient(kind); } catch (_) { pauseAmbient(); }
    }
  }

  $$('.sound-card').forEach(card => card.addEventListener('click', () => chooseSound(card.dataset.sound)));
  $('#ambientPlay')?.addEventListener('click', () => audioPlaying ? pauseAmbient() : playAmbient());
  $('#soundToggle')?.addEventListener('click', () => audioPlaying ? pauseAmbient() : playAmbient());
  $('#volumeSlider')?.addEventListener('input', event => {
    volume = Number(event.target.value) / 100;
    const value = $('#volumeValue');
    if (value) value.textContent = `${faDigits(event.target.value)}٪`;
    if (masterGain && audioContext && audioContext.state !== 'closed') {
      masterGain.gain.setTargetAtTime(audioPlaying ? volume : 0, audioContext.currentTime, .08);
    }
  });

  // A soft, low-volume musical breath cue follows the current inhale / pause / exhale phase.
  let currentBreathCue = [];
  function stopBreathCue(fade = true) {
    const oldNodes = currentBreathCue;
    currentBreathCue = [];
    if (!oldNodes.length || !audioContext || audioContext.state === 'closed') return;
    const ctx = audioContext;
    const now = ctx.currentTime;
    const gain = oldNodes.find(node => node.__cueGain);
    if (gain) {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, fade ? .12 : .015);
      } catch (_) {}
    }
    window.setTimeout(() => oldNodes.forEach(node => {
      try { node.stop?.(); } catch (_) {}
      try { node.disconnect?.(); } catch (_) {}
    }), fade ? 420 : 60);
  }

  async function playBreathCue(phase) {
    if (!breathSoundOn) return;
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      stopBreathCue(false);
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.__cueGain = true;
      const seconds = phase.seconds;
      const startHz = phase.key === 'inhale' ? 174 : phase.key === 'hold' ? 196 : 220;
      const endHz = phase.key === 'inhale' ? 220 : phase.key === 'hold' ? 196 : 164;
      oscillator.type = 'sine';
      overtone.type = 'sine';
      oscillator.frequency.setValueAtTime(startHz, now);
      oscillator.frequency.linearRampToValueAtTime(endHz, now + seconds);
      overtone.frequency.setValueAtTime(startHz * 2.01, now);
      overtone.frequency.linearRampToValueAtTime(endHz * 2.01, now + seconds);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.linearRampToValueAtTime(phase.key === 'hold' ? .009 : .014, now + Math.min(.8, seconds / 3));
      gain.gain.setTargetAtTime(.0001, now + Math.max(.8, seconds - .45), .18);
      oscillator.connect(gain); overtone.connect(gain); gain.connect(breathGain);
      oscillator.start(now); overtone.start(now);
      oscillator.stop(now + seconds + .35); overtone.stop(now + seconds + .35);
      currentBreathCue = [oscillator, overtone, gain];
    } catch (_) {
      // The visual breathing guide remains fully usable if audio is unavailable.
    }
  }

  function playReleaseSound() {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      // An airy filtered exhale.
      const noise = makeNoiseSource(ctx, 1.2);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.setValueAtTime(1400, now); filter.frequency.exponentialRampToValueAtTime(380, now + 1.25);
      const whoosh = ctx.createGain(); whoosh.gain.setValueAtTime(.0001, now); whoosh.gain.linearRampToValueAtTime(.055, now + .16); whoosh.gain.exponentialRampToValueAtTime(.0001, now + 1.3);
      noise.connect(filter); filter.connect(whoosh); whoosh.connect(breathGain); noise.start(now); noise.stop(now + 1.35);
      // Two tiny, warm notes dissolve with the paper.
      [523.25, 659.25, 783.99].forEach((frequency, index) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        const start = now + .12 + index * .09;
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.linearRampToValueAtTime(.012 / (index + 1), start + .035);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .9 + index * .05);
        oscillator.connect(gain); gain.connect(breathGain); oscillator.start(start); oscillator.stop(start + 1.05);
      });
    } catch (_) {}
  }

  function playPlantSound() {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(740, now); osc.frequency.exponentialRampToValueAtTime(1046, now + .16);
      gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(.022, now + .025); gain.gain.exponentialRampToValueAtTime(.0001, now + .55);
      osc.connect(gain); gain.connect(breathGain); osc.start(now); osc.stop(now + .58);
    } catch (_) {}
  }

  // Guided breathing uses one monotonic clock, so delayed browser timers cannot drift out of sync.
  const breathVisual = $('#breathVisual');
  const breathPhase = $('#breathPhase');
  const breathCount = $('#breathCount');
  const breathStart = $('#breathStart');
  const breathReset = $('#breathReset');
  const breathHint = $('#breathHint');
  const breathRemainingLabel = $('#breathRemaining');
  const breathSoundToggle = $('#breathSoundToggle');
  const phases = [
    { name: 'دم بگیر', key: 'inhale', seconds: 4, hint: 'آروم هوا رو به درون بکش… فقط تا جایی که راحته.' },
    { name: 'مکث کوتاه', key: 'hold', seconds: 2, hint: 'اگه مکث برات راحته، همین‌جا یه لحظه بمون.' },
    { name: 'بازدم', key: 'exhale', seconds: 6, hint: 'حالا آروم رها کن… انگار داری خستگی رو بیرون می‌دی.' }
  ];
  let breathDuration = 120;
  let breathTimer = null;
  let breathing = false;
  let breathDeadline = 0;
  let phaseDeadline = 0;
  let phaseIndex = 0;

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.ceil(totalSeconds));
    return `${faDigits(String(Math.floor(seconds / 60)).padStart(2, '0'))}:${faDigits(String(seconds % 60).padStart(2, '0'))}`;
  }

  function beginBreathPhase(now = performance.now()) {
    const phase = phases[phaseIndex];
    breathVisual?.classList.remove('inhale', 'hold', 'exhale');
    if (breathVisual) {
      void breathVisual.offsetWidth;
      breathVisual.classList.add(phase.key);
    }
    if (breathPhase) breathPhase.textContent = phase.name;
    if (breathHint) breathHint.textContent = phase.hint;
    if (breathCount) breathCount.textContent = `${faDigits(phase.seconds)} ثانیه`;
    phaseDeadline = now + phase.seconds * 1000;
    playBreathCue(phase);
  }

  function finishBreathing() {
    window.clearInterval(breathTimer);
    breathTimer = null;
    breathing = false;
    stopBreathCue(true);
    breathVisual?.classList.remove('inhale', 'hold', 'exhale');
    if (breathPhase) breathPhase.textContent = 'آفرین';
    if (breathCount) breathCount.textContent = 'همین چند لحظه، مال خودت بود';
    if (breathHint) breathHint.textContent = 'حالا لازم نیست کاری بکنی. بذار نفست خودش برگرده به ریتم همیشگی؛ ممنون که به خودت سر زدی.';
    if (breathRemainingLabel) breathRemainingLabel.textContent = 'زمان باقی‌مانده: ۰۰:۰۰';
    if (breathStart) { breathStart.hidden = false; breathStart.textContent = 'یه دور دیگه؟'; }
    if (breathReset) breathReset.hidden = true;
    showToast('دمت گرم که چند لحظه برای خودت وقت گذاشتی. ♡');
  }

  function stopBreathing(showReady = true) {
    window.clearInterval(breathTimer);
    breathTimer = null;
    breathing = false;
    stopBreathCue(true);
    breathVisual?.classList.remove('inhale', 'hold', 'exhale');
    if (showReady) {
      if (breathPhase) breathPhase.textContent = 'آماده‌ای؟';
      if (breathCount) breathCount.textContent = 'هیچ عجله‌ای نیست';
      if (breathHint) breathHint.textContent = 'هر وقت دلت خواست شروع کن. اگه همین‌طور طبیعی نفس بکشی هم کاملاً خوبه.';
      if (breathRemainingLabel) breathRemainingLabel.textContent = `زمان باقی‌مانده: ${formatClock(breathDuration)}`;
      if (breathStart) { breathStart.hidden = false; breathStart.textContent = 'شروع تمرین ✧'; }
      if (breathReset) breathReset.hidden = true;
    }
  }

  function startBreathing() {
    stopBreathing(false);
    breathing = true;
    breathDeadline = performance.now() + breathDuration * 1000;
    phaseIndex = 0;
    if (breathStart) breathStart.hidden = true;
    if (breathReset) breathReset.hidden = false;
    beginBreathPhase();
    breathTimer = window.setInterval(() => {
      if (!breathing) return;
      const now = performance.now();
      const left = Math.max(0, (breathDeadline - now) / 1000);
      if (breathRemainingLabel) breathRemainingLabel.textContent = `زمان باقی‌مانده: ${formatClock(left)}`;
      if (now >= breathDeadline) { finishBreathing(); return; }
      if (now >= phaseDeadline) {
        phaseIndex = (phaseIndex + 1) % phases.length;
        beginBreathPhase(now);
      } else if (breathCount) {
        breathCount.textContent = `${faDigits(Math.ceil((phaseDeadline - now) / 1000))} ثانیه`;
      }
    }, 100);
  }

  breathStart?.addEventListener('click', startBreathing);
  breathReset?.addEventListener('click', () => stopBreathing(true));
  breathSoundToggle?.addEventListener('click', () => {
    breathSoundOn = !breathSoundOn;
    breathSoundToggle.setAttribute('aria-pressed', String(breathSoundOn));
    breathSoundToggle.textContent = `♫ صدای راهنما: ${breathSoundOn ? 'روشن' : 'خاموش'}`;
    if (!breathSoundOn) stopBreathCue(true);
    else if (breathing) playBreathCue(phases[phaseIndex]);
  });
  $$('.duration-option').forEach(button => button.addEventListener('click', () => {
    if (breathing) return;
    $$('.duration-option').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    breathDuration = Math.max(30, Number(button.dataset.duration) || 120);
    if (breathRemainingLabel) breathRemainingLabel.textContent = `زمان باقی‌مانده: ${formatClock(breathDuration)}`;
  }));

  // Photo scenes start their matching sound only after a deliberate tap.
  $$('.retreat-card').forEach(card => card.addEventListener('click', async () => {
    const kind = card.dataset.scene;
    chooseSound(kind);
    const feedback = $('#retreatFeedback');
    if (feedback) feedback.textContent = `${soundNames[kind]} انتخاب شد… چند ثانیه چشماتو ببند و به صدای فضا گوش بده. هر وقت نخواستی، از دکمه‌ی صدا خاموشش کن.`;
    await playAmbient();
  }));

  // Supportive, conversational mood notes. No diagnosis, no pressure to explain.
  const moodResponses = {
    tired: [
      'می‌فهمم… بعضی خستگی‌ها با خواب هم کامل نمی‌رن. لازم نیست الان خودتو جمع‌وجور کنی؛ یه کم به خودت مرخصی بده.',
      'شاید امروز بیشتر از چیزی که فکر می‌کنی از خودت مایه گذاشتی. بیا فعلاً ازت چیزی نخوایم.',
      'اگه تنها کاری که امروز ازت برمیاد استراحته، همون کار کاملاً ارزشمنده. لازم نیست بابتش عذاب وجدان بگیری.',
      'یه لیوان آب، شل کردن شونه‌ها و چند دقیقه بی‌کاری… گاهی همین چیزای کوچیک شروع مراقبت از خودمونه.',
      'تو ماشین نیستی که همیشه روشن بمونی. آدمی؛ خسته می‌شی، مکث می‌کنی و دوباره راه می‌افتی.'
    ],
    heavy: [
      'لازم نیست همین الان دلیل ناراحتیت رو پیدا کنی. می‌تونی فقط ناراحت باشی؛ من این چند لحظه رو برات نگه می‌دارم.',
      'کاش می‌شد یه پتوی نرم انداخت روی دل آدم. فعلاً با خودت مهربون باش؛ این حس هم قرار نیست تا ابد همین‌قدر سنگین بمونه.',
      'اگه بغض داری، مجبور نیستی قورتش بدی. بعضی وقتا اشک هم راهیه که دل یه کم سبک‌تر بشه.',
      'قرار نیست جلوی همه محکم باشی. همین‌جا لازم نیست وانمود کنی حالت خوبه.',
      'می‌دونم شاید الان هیچ جمله‌ای نتونه همه‌چیز رو درست کنه. پس فقط اینو بدون: لازم نیست تنهایی با همه‌چیز بجنگی.'
    ],
    busy: [
      'بیا فقط برای ده ثانیه هیچ تصمیمی نگیریم. دنیا بدون جواب فوری تو هم می‌چرخه؛ قول می‌دم.',
      'فکرات رو لازم نیست با زور ساکت کنی. بذار از کنارت رد بشن، مثل ابرایی که از آسمون می‌گذرن.',
      'فقط یکی از کارها رو انتخاب کن؛ نه همه رو. بقیه می‌تونن یه کم منتظر بمونن.',
      'شاید لازم باشه لیست کارهات کوتاه‌تر بشه، نه اینکه تو سریع‌تر بدوی. با خودت راه بیا.',
      'یه نفس معمولی بکش، فکت رو شل کن و کف پاهات رو روی زمین حس کن. همین الان اینجایی.'
    ],
    hopeful: [
      'چه خوب که یه گوشه از دلت هنوز منتظر اتفاقای قشنگه. لازم نیست عجله کنی؛ بذار امیدت آروم‌آروم قد بکشه.',
      'همین نور کوچیک رو نگه دار. حتی روزای ابری هم نمی‌تونن برای همیشه جلوی آفتاب رو بگیرن.',
      'امید داشتن یعنی با وجود نامعلوم بودن راه، یه قدم کوچیک برداری. همین که هنوز دلت می‌خواد، قشنگه.',
      'شاید اتفاق خوب بعدی خیلی ساده باشه؛ یه مکالمه، یه خبر، یه صبح سبک‌تر. جا براش باز بذار.',
      'به خودت حق بده هم امیدوار باشی، هم گاهی بترسی. این دوتا می‌تونن کنار هم باشن.'
    ],
    good: [
      'ای جان! چه خوب که حالت خوبه. یه لحظه وایسا و این حس قشنگ رو مزه‌مزه کن؛ لازم نیست زود از کنارش رد بشی.',
      'امروز هرچی باعث لبخندت شده، حتی اگه کوچیکه، بذار یه کم بیشتر کنارت بمونه.',
      'خوشحالی لازم نیست دلیل بزرگی داشته باشه. بعضی روزا آفتاب از پنجره می‌تابه و همین کافیه.',
      'امیدوارم این حال خوب رو با خودت ببری توی بقیه روزت؛ آروم، بی‌فشار و با یه لبخند کوچولو.',
      'چه خوب که اومدی حتی وقتی حالت خوبه. اینجا فقط برای روزای سخت نیست؛ برای جشن گرفتن لحظه‌های خوب هم هست.'
    ]
  };
  let currentMood = null;
  let moodMessageIndex = -1;
  let moodTransitionId = 0;
  function showMoodMessage() {
    if (!currentMood) return;
    const messages = moodResponses[currentMood];
    let next = Math.floor(Math.random() * messages.length);
    if (messages.length > 1) while (next === moodMessageIndex) next = Math.floor(Math.random() * messages.length);
    moodMessageIndex = next;
    const text = $('#moodResponseText');
    if (!text) return;
    const transitionId = ++moodTransitionId;
    text.classList.add('changing');
    window.setTimeout(() => {
      if (transitionId !== moodTransitionId) return;
      text.textContent = messages[next];
      text.classList.remove('changing');
    }, prefersReducedMotion ? 0 : 180);
  }
  $$('.mood-option').forEach(button => button.addEventListener('click', () => {
    currentMood = button.dataset.mood;
    moodMessageIndex = -1;
    $$('.mood-option').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const more = $('#moodMore');
    if (more) more.hidden = false;
    showMoodMessage();
  }));
  $('#moodMore')?.addEventListener('click', showMoodMessage);

  // The garden remembers planted flowers on this device; positions are repeatable after reload.
  const plantedFlowers = $('#plantedFlowers');
  const gardenCount = $('#gardenCount');
  const flowerEmojis = ['🌼', '🌸', '🌷', '🌺', '🪻', '🌻', '🌹', '💮'];
  const maxFlowers = 60;
  let flowerCount = 0;
  try { flowerCount = Math.min(maxFlowers, Math.max(0, Number(localStorage.getItem('ye-nafas-flowers')) || 0)); } catch (_) { flowerCount = 0; }

  function addFlower(index, restored = false) {
    if (!plantedFlowers || index >= maxFlowers) return;
    const flower = document.createElement('span');
    const seed = index + 1;
    const left = 8 + ((seed * 37) % 84);
    const bottom = 17 + ((seed * 23) % 105);
    const size = 19 + ((seed * 11) % 15);
    flower.className = 'planted-flower';
    flower.textContent = flowerEmojis[index % flowerEmojis.length];
    flower.style.left = `${left}%`;
    flower.style.bottom = `${bottom}px`;
    flower.style.fontSize = `${size}px`;
    flower.style.animationDelay = restored ? '0s' : `${Math.min(.18, Math.random() * .18)}s`;
    flower.style.setProperty('--flower-tilt', `${(seed % 7) - 3}deg`);
    plantedFlowers.appendChild(flower);
  }
  for (let i = 0; i < flowerCount; i++) addFlower(i, true);

  function updateGardenCount() {
    if (!gardenCount) return;
    if (flowerCount === 0) gardenCount.textContent = 'باغت منتظر اولین گلشه. از یه دونه شروع کنیم؟';
    else if (flowerCount === 1) gardenCount.textContent = 'اولین گلت شکفت! همین شروع کوچیک چقدر قشنگه. 🌱';
    else if (flowerCount < 10) gardenCount.textContent = `${faDigits(flowerCount)} گل کوچولو توی باغت داری… داره قشنگ می‌شه. ♡`;
    else if (flowerCount < maxFlowers) gardenCount.textContent = `${faDigits(flowerCount)} گل توی باغت شکفته؛ ببین با صبوری چی ساختی. ♡`;
    else gardenCount.textContent = 'باغت پر از گل شده؛ یه گوشه‌ی قشنگ برای خودت ساختی. ♡';
  }
  updateGardenCount();
  $('#plantFlower')?.addEventListener('click', () => {
    if (flowerCount >= maxFlowers) { showToast('باغت پر از گل شده؛ چه جای قشنگی! 🌷'); return; }
    addFlower(flowerCount);
    flowerCount += 1;
    try { localStorage.setItem('ye-nafas-flowers', String(flowerCount)); } catch (_) {}
    updateGardenCount();
    playPlantSound();
    showToast('یه گل تازه برای باغت شکفت. 🌼');
  });

  // A larger, more human collection of small reminders. Avoid repeating the same card twice.
  const kindnessMessages = [
    'هی رفیق… می‌دونم شاید امروز اون‌جوری که می‌خواستی پیش نرفته باشه. ولی قرار نیست هر روز بدرخشی؛ بعضی روزها فقط باید با خودت مهربون‌تر باشی.',
    'لازم نیست همه‌چیز رو همین امشب حل کنی. بعضی جواب‌ها وقتی می‌رسن که دیگه انقدر دنبالشون نمی‌دوی.',
    'اگه امروز فقط از پس کارای ضروری بر اومدی، بازم کافیه. تو بیشتر از یه فهرست کارهای انجام‌شده‌ای.',
    'گاهی بهترین کاری که می‌تونی برای خودت بکنی اینه که بگی: «فعلاً بسه، خسته شدم.»',
    'کاش همون‌قدر که نگران ناراحت کردن بقیه‌ای، حواست به دل خودت هم باشه.',
    'تو عقب نموندی. مسیر زندگی آدم‌ها با هم یکی نیست؛ لازم نیست با ساعت کسی دیگه زندگی کنی.',
    'اگه امروز نتونستی لبخند بزنی، اشکالی نداره. قرار نیست حتی لبخندت هم همیشه سر وقت باشه.',
    'یه روز بد، تو رو به یه آدم بد یا یه آدم شکست‌خورده تبدیل نمی‌کنه. فقط یه روز بده؛ همین.',
    'قرار نیست برای دوست‌داشتنی بودن، همیشه مفید، قوی، خوشحال یا بی‌اشتباه باشی.',
    'بعضی وقتا باید گوشی رو بذاری کنار، یه جرعه آب بخوری و یادت بیاد زندگی فقط توی صفحه نیست.',
    'تو می‌تونی هم دلتنگ باشی، هم امیدوار. هم بترسی، هم ادامه بدی. لازم نیست فقط یه حس داشته باشی.',
    'اگه کسی امروز مهربونی لازم داشت، امیدوارم خودت هم جزوش باشی.',
    'همه‌ی گل‌ها یه روز شکوفه نمی‌دن. تو هم لازم نیست با زمان‌بندی بقیه رشد کنی.',
    'بذار بعضی چیزا ناتمام بمونن. دنیا با چند تا کار نیمه‌تموم از حرکت نمی‌ایسته.',
    'یه کم از خودت توقع رو پایین بیار. تو قرار نیست هر روز رکورد تازه‌ای ثبت کنی.',
    'شاید الان فقط به یه جای امن، یه نوشیدنی گرم و چند دقیقه سکوت نیاز داری. همین خواسته کاملاً محترمه.',
    'اشتباه کردن یعنی آدم بودی و تلاش کردی؛ نه اینکه دیگه فرصت بهتر شدن نداری.',
    'گاهی باید به خودت بگی: «می‌دونم سختته. من طرف توام.»',
    'لازم نیست با عجله خوب بشی. هر حسی زمان خودش رو داره.',
    'امروز رو با همه‌ی کم‌وکاستی‌هاش تموم کن. فردا یه صفحه‌ی جدیده، نه امتحان جبرانی امروز.',
    'حتی اگه هیچ‌کس متوجه تلاشت نشد، این دلیل نمی‌شه تلاش تو بی‌ارزش بوده باشه.',
    'به خودت اجازه بده از چیزای ساده خوشحال بشی؛ بوی چای، نور آفتاب، صدای بارون… زندگی از همین‌ها ساخته شده.',
    'اگه دلت می‌خواد یه کم فاصله بگیری، این لزوماً فرار نیست. گاهی فاصله گرفتن یعنی داری از خودت مراقبت می‌کنی.',
    'تو لازم نیست همه رو راضی نگه داری و بعد ته صف به خودت برسی.',
    'بعضی روزها برد واقعی اینه که با وجود سختی‌ها، با خودت نامهربون نشدی.',
    'هر وقت حس کردی از همه‌چی جا موندی، یادت بیاد که نفس کشیدن هم بخشی از مسیرته.',
    'بذار امروز یه ذره آسون‌تر بگذره. لازم نیست برای هر چیزی با خودت بجنگی.',
    'اگه هنوز داری سعی می‌کنی، حتی خیلی آروم، بدون که این هم یه جور شجاعته.',
    'هیچ اشکالی نداره که نظرت عوض بشه، مسیرت رو عوض کنی یا دوباره از اول شروع کنی.',
    'تو فقط روزهای پربازده و عکس‌های قشنگت نیستی؛ روزهای خسته و ساکتت هم بخشی از توئن و محترمن.',
    'یه نفس بکش. شونه‌هات رو رها کن. به خودت یادآوری کن که همین لحظه لازم نیست همه‌چیز رو بدونی.',
    'شاید لازم باشه امروز کمتر خودت رو قضاوت کنی و بیشتر به حرف دلت گوش بدی.',
    'قرار نیست همیشه از پس همه‌چیز بربیای. کمک خواستن هم یه جور مراقبت از خودته.',
    'به اون نسخه از خودت که تا اینجا اومده یه خسته نباشید بده. خیلی چیزا رو پشت سر گذاشته.',
    'هر شروع تازه‌ای لازم نیست بزرگ و پرسر‌وصدا باشه. گاهی یه تصمیم کوچیک و آروم کافیه.',
    'اگه امروز یه نفر باهات خوب نبود، لطفاً تو هم با خودت همون‌طور رفتار نکن.',
    'تو حق داری روزهایی داشته باشی که فقط دلت بخواد آروم باشی و هیچ توضیحی ندی.',
    'گاهی لازم نیست حال خوب رو پیدا کنی؛ فقط کافیه یه ذره جا برای اومدنش باز بذاری.',
    'اینکه هنوز بعضی چیزا اذیتت می‌کنن، به معنی ضعیف بودن یا عقب رفتنت نیست.',
    'از خودت نپرس چرا مثل قبل نیستی. شاید خیلی چیزا عوض شده و تو داری خودت رو باهاشون هماهنگ می‌کنی.',
    'امیدوارم امشب با خودت آشتی کنی؛ حتی اگه همه‌ی مسئله‌ها هنوز سر جاشونن.',
    'تو سزاوار استراحتی هستی که لازم نباشه اول خودتو از خستگی از پا بندازی تا بهش برسی.',
    'گاهی آروم‌ترین تصمیم، جواب ندادن به همه‌ی فکرهاست. لازم نیست وارد هر بحثی با ذهنت بشی.',
    'امیدوارم یه اتفاق کوچیک و بی‌خبر امروز لبخند بیاره روی لبت؛ از اونایی که آدم دلش می‌خواد نگهشون داره.',
    'اگه از یه چیزی مطمئن نیستی، اشکالی نداره. لازم نیست همین الان جواب قطعی داشته باشی.',
    'یه کم با خودت راه بیا. تو داری زندگی رو برای اولین بار تجربه می‌کنی، نه اینکه قبلاً چند بار تمرینش کرده باشی.',
    'خوب بودن همیشه یعنی خوشحال بودن نیست؛ گاهی یعنی با وجود سختی، خودت رو تنها نذاشتی.',
    'بذار امروز همون‌قدر که هست، کافی باشه. لازم نیست ازش یه داستان موفقیت بسازی.',
    'به خودت یادآوری کن: من هم آدم مهمی توی زندگی خودمم.',
    'همین که چند دقیقه مکث کردی و اومدی اینجا، یعنی یه گوشه از دلت هنوز مراقبته. قدرش رو بدون.'
  ];
  let lastKindness = -1;
  let kindnessTransitionId = 0;
  const kindnessMessage = $('#kindnessMessage');
  $('#newKindness')?.addEventListener('click', () => {
    let next = Math.floor(Math.random() * kindnessMessages.length);
    while (kindnessMessages.length > 1 && next === lastKindness) next = Math.floor(Math.random() * kindnessMessages.length);
    lastKindness = next;
    if (!kindnessMessage) return;
    const transitionId = ++kindnessTransitionId;
    kindnessMessage.classList.add('changing');
    window.setTimeout(() => {
      if (transitionId !== kindnessTransitionId) return;
      kindnessMessage.textContent = kindnessMessages[next];
      kindnessMessage.classList.remove('changing');
    }, prefersReducedMotion ? 0 : 220);
  });

  // The text remains local and is only cleared after its paper-like release animation finishes.
  const thoughtInput = $('#thoughtInput');
  const thoughtCount = $('#thoughtCount');
  const thoughtStage = $('#thoughtStage');
  const releaseButton = $('#releaseThought');
  const releaseResult = $('#releaseResult');
  const releaseParticles = $('#releaseParticles');
  let isReleasing = false;
  thoughtInput?.addEventListener('input', () => {
    if (thoughtCount) thoughtCount.textContent = `${faDigits(thoughtInput.value.length)} از ۱۲۰۰`;
  });

  function createReleaseParticles() {
    if (!releaseParticles) return;
    releaseParticles.replaceChildren();
    const symbols = ['✧', '·', '✦', '˚', '♡', '✧', '·', '✦', '˚', '✧', '·', '♡'];
    symbols.forEach((symbol, index) => {
      const particle = document.createElement('span');
      particle.className = 'release-particle';
      particle.textContent = symbol;
      particle.style.setProperty('--particle-x', `${((index * 31) % 100) - 50}px`);
      particle.style.setProperty('--particle-y', `${-35 - ((index * 19) % 95)}px`);
      particle.style.setProperty('--particle-delay', `${(index % 6) * 55}ms`);
      releaseParticles.appendChild(particle);
    });
  }

  releaseButton?.addEventListener('click', () => {
    if (!thoughtInput || isReleasing) return;
    const value = thoughtInput.value.trim();
    if (!value) {
      if (releaseResult) releaseResult.textContent = 'هر وقت آماده بودی، حتی با یه کلمه شروع کن. هیچ عجله‌ای نیست. ♡';
      thoughtInput.focus();
      return;
    }

    isReleasing = true;
    releaseButton.disabled = true;
    releaseButton.textContent = 'داریم آروم رهاش می‌کنیم…';
    thoughtInput.readOnly = true;
    thoughtStage?.classList.add('releasing');
    createReleaseParticles();

    // Duplicate only for the visual paper animation; use textContent to keep it safe.
    const flyingNote = document.createElement('div');
    flyingNote.className = 'flying-thought';
    flyingNote.setAttribute('aria-hidden', 'true');
    flyingNote.textContent = value;
    thoughtStage?.appendChild(flyingNote);

    playReleaseSound();
    if (releaseResult) releaseResult.textContent = 'بذار بره… تو لازم نیست همه‌چیز رو با خودت نگه داری. ♡';
    const releaseDelay = prefersReducedMotion ? 420 : 1780;
    window.setTimeout(() => {
      thoughtInput.value = '';
      thoughtInput.readOnly = false;
      if (thoughtCount) thoughtCount.textContent = '۰ از ۱۲۰۰';
      thoughtStage?.classList.remove('releasing');
      flyingNote.remove();
      releaseParticles?.replaceChildren();
      isReleasing = false;
      releaseButton.disabled = false;
      releaseButton.innerHTML = 'آروم رهاش کن <span aria-hidden="true">✧</span>';
      if (releaseResult) releaseResult.textContent = 'تموم شد… یه نفس معمولی بکش. لازم نیست چیزی رو به زور فراموش کنی؛ فقط برای همین لحظه، بذارش کنار. ♡';
      showToast('نوشته‌ات رها شد؛ با خودت مهربون بمون.');
    }, releaseDelay);
  });

  // Pause active audio and breathing if the tab is no longer visible.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (audioPlaying) pauseAmbient();
      if (breathing) {
        stopBreathing(false);
        if (breathPhase) breathPhase.textContent = 'مکث کردیم';
        if (breathCount) breathCount.textContent = 'هر وقت برگشتی…';
        if (breathHint) breathHint.textContent = 'صفحه رو ترک کردی و تمرین متوقف شد؛ هر وقت خواستی دوباره شروع کن.';
        if (breathStart) { breathStart.hidden = false; breathStart.textContent = 'ادامه با یه شروع تازه'; }
        if (breathReset) breathReset.hidden = true;
      }
    }
  });

  window.addEventListener('pagehide', () => {
    clearAmbient();
    currentBreathCue = [];
    try { audioContext?.close(); } catch (_) {}
    audioContext = null; masterGain = null; breathGain = null;
  });

  // Set the initial UI consistently on load.
  updateAudioUI();
})();
