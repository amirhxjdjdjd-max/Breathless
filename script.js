(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const faDigits = (value) => String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

  // Small, accessible toast for gentle feedback.
  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // Mobile navigation.
  const menuToggle = $('#menuToggle');
  const mainNav = $('.main-nav');
  menuToggle?.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'بستن منو' : 'باز کردن منو');
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  }));

  // Back-to-top button.
  const backToTop = $('#backToTop');
  window.addEventListener('scroll', () => {
    backToTop?.classList.toggle('visible', window.scrollY > 550);
  }, { passive: true });
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // Guided breathing: a gentle 4-2-6 rhythm, with optional chimes and pause/resume.
  const breathVisual = $('#breathVisual');
  const breathPhase = $('#breathPhase');
  const breathCount = $('#breathCount');
  const breathStart = $('#breathStart');
  const breathPause = $('#breathPause');
  const breathReset = $('#breathReset');
  const breathHint = $('#breathHint');
  const breathProgress = $('#breathProgress');
  const breathProgressTrack = $('.breath-progress');
  const breathProgressLabel = $('#breathProgressLabel');
  const breathRound = $('#breathRound');
  const chimeToggle = $('#breathChimeToggle');
  let breathDuration = 120;
  let breathRemaining = 0;
  let phaseRemaining = 0;
  let breathInterval = null;
  let phaseTimer = null;
  let phaseIndex = 0;
  let breathRunning = false;
  let breathPaused = false;
  let breathChimeEnabled = true;
  let breathAudioContext = null;
  const phases = [
    { name: 'آروم دم بگیر', key: 'inhale', seconds: 4, hint: 'آروم هوا رو به داخل بکش؛ فقط تا جایی که راحتی.' },
    { name: 'یه مکث کوچیک', key: 'hold', seconds: 2, hint: 'اگه برات راحته، یه لحظه مکث کن. اجباری نیست.' },
    { name: 'آروم بازدم کن', key: 'exhale', seconds: 6, hint: 'بدون عجله هوا رو بیرون بده و شونه‌هات رو رها کن.' }
  ];

  function formatClock(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    return `${faDigits(Math.floor(safe / 60))}:${faDigits(String(safe % 60).padStart(2, '0'))}`;
  }

  function updateBreathProgress() {
    const completed = breathDuration - breathRemaining;
    const percent = Math.min(100, Math.max(0, (completed / breathDuration) * 100));
    if (breathProgress) breathProgress.style.width = `${percent}%`;
    if (breathProgressTrack) breathProgressTrack.setAttribute('aria-valuenow', String(Math.round(percent)));
    if (breathProgressLabel) breathProgressLabel.textContent = formatClock(breathRemaining);
    if (breathRound) breathRound.textContent = breathRunning ? (breathPaused ? 'یه مکث کوچیک کردیم' : 'آفرین، داری پیش می‌ری') : (breathRemaining === 0 ? 'تموم شد؛ آفرین!' : 'هنوز شروع نکردیم');
  }

  function playBreathChime(index) {
    if (!breathChimeEnabled) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      if (!breathAudioContext) breathAudioContext = new AudioCtx();
      if (breathAudioContext.state === 'suspended') breathAudioContext.resume();
      const ctx = breathAudioContext;
      const now = ctx.currentTime;
      const notes = index === 0 ? [523.25, 659.25] : index === 1 ? [587.33] : [392, 523.25];
      notes.forEach((frequency, noteIndex) => {
        const oscillator = ctx.createOscillator();
        const envelope = ctx.createGain();
        const startAt = now + noteIndex * 0.09;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        envelope.gain.setValueAtTime(0.0001, startAt);
        envelope.gain.exponentialRampToValueAtTime(0.018, startAt + 0.07);
        envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.85);
        oscillator.connect(envelope);
        envelope.connect(ctx.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.9);
      });
    } catch (_) {
      // The visual breathing guide remains usable when audio is unavailable.
    }
  }

  function highlightBreathStep(key) {
    $$('[data-phase-step]').forEach(step => {
      step.classList.toggle('active', step.dataset.phaseStep === key);
    });
  }

  function clearBreathTimers() {
    window.clearInterval(breathInterval);
    window.clearInterval(phaseTimer);
    breathInterval = null;
    phaseTimer = null;
  }

  function updatePhaseCount() {
    if (breathCount) breathCount.textContent = `${faDigits(phaseRemaining)} ثانیه`;
  }

  function runPhaseTimer() {
    window.clearInterval(phaseTimer);
    phaseTimer = window.setInterval(() => {
      if (breathPaused || !breathRunning) return;
      phaseRemaining -= 1;
      updatePhaseCount();
      if (phaseRemaining <= 0) {
        phaseIndex = (phaseIndex + 1) % phases.length;
        beginPhase();
      }
    }, 1000);
  }

  function beginPhase() {
    const phase = phases[phaseIndex];
    if (!breathVisual || !phase) return;
    breathVisual.classList.remove('inhale', 'hold', 'exhale', 'paused');
    void breathVisual.offsetWidth;
    breathVisual.classList.add(phase.key);
    breathPhase.textContent = phase.name;
    breathHint.textContent = phase.hint;
    phaseRemaining = phase.seconds;
    updatePhaseCount();
    highlightBreathStep(phase.key);
    playBreathChime(phaseIndex);
    runPhaseTimer();
  }

  function finishBreathing() {
    clearBreathTimers();
    breathRunning = false;
    breathPaused = false;
    breathVisual?.classList.remove('inhale', 'hold', 'exhale', 'paused');
    breathPhase.textContent = 'آفرین!';
    breathCount.textContent = 'این چند دقیقه مال خودت بود';
    breathHint.textContent = 'حالا چند لحظه با ریتم طبیعی خودت بمون. امیدوارم یه ذره سبک‌تر شده باشی.';
    breathStart.hidden = false;
    breathStart.textContent = 'یه بار دیگه؟';
    breathPause.hidden = true;
    breathReset.hidden = true;
    highlightBreathStep('');
    breathRemaining = 0;
    updateBreathProgress();
    showToast('همین که به خودت وقت دادی، قشنگه. ♡');
  }

  function startSessionTimer() {
    window.clearInterval(breathInterval);
    breathInterval = window.setInterval(() => {
      if (breathPaused || !breathRunning) return;
      breathRemaining -= 1;
      updateBreathProgress();
      if (breathRemaining <= 0) finishBreathing();
    }, 1000);
  }

  function stopBreathing(showReady = true) {
    clearBreathTimers();
    breathRunning = false;
    breathPaused = false;
    breathVisual?.classList.remove('inhale', 'hold', 'exhale', 'paused');
    highlightBreathStep('');
    if (showReady) {
      breathRemaining = breathDuration;
      breathPhase.textContent = 'آماده‌ای؟';
      breathCount.textContent = 'یه شروع آروم';
      breathHint.textContent = 'هر وقت آماده بودی، شروع کن. قرار نیست به خودت فشار بیاری.';
      breathStart.hidden = false;
      breathStart.textContent = 'شروع کنیم ✧';
      breathPause.hidden = true;
      breathReset.hidden = true;
      breathPause.textContent = 'مکث';
      updateBreathProgress();
    }
  }

  function startBreathing() {
    stopBreathing(false);
    breathRunning = true;
    breathPaused = false;
    breathRemaining = breathDuration;
    phaseIndex = 0;
    breathStart.hidden = true;
    breathPause.hidden = false;
    breathPause.textContent = 'مکث';
    breathReset.hidden = false;
    beginPhase();
    startSessionTimer();
    updateBreathProgress();
  }

  function toggleBreathPause() {
    if (!breathRunning) return;
    breathPaused = !breathPaused;
    if (breathPaused) {
      clearBreathTimers();
      breathVisual?.classList.add('paused');
      breathPause.textContent = 'ادامه بدیم';
      breathHint.textContent = 'باشه، یه مکث کردیم. هر وقت خواستی ادامه بده.';
    } else {
      breathVisual?.classList.remove('paused');
      breathPause.textContent = 'مکث';
      breathHint.textContent = phases[phaseIndex].hint;
      runPhaseTimer();
      startSessionTimer();
    }
    updateBreathProgress();
  }

  breathStart?.addEventListener('click', startBreathing);
  breathPause?.addEventListener('click', toggleBreathPause);
  breathReset?.addEventListener('click', () => stopBreathing(true));
  chimeToggle?.addEventListener('click', () => {
    breathChimeEnabled = !breathChimeEnabled;
    chimeToggle.setAttribute('aria-pressed', String(breathChimeEnabled));
    chimeToggle.innerHTML = `<span aria-hidden="true">♫</span> صدای راهنما ${breathChimeEnabled ? 'روشنه' : 'خاموشه'}`;
    if (breathChimeEnabled) showToast('صدای راهنمای آروم روشن شد.');
  });
  $$('.duration-option').forEach(button => button.addEventListener('click', () => {
    if (breathRunning) return;
    $$('.duration-option').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    breathDuration = Number(button.dataset.duration) || 120;
    breathRemaining = breathDuration;
    updateBreathProgress();
  }));
  breathRemaining = breathDuration;
  updateBreathProgress();

  // Self-generated ambient audio via Web Audio. Nothing starts until the user presses play.
  const soundNames = { rain: 'باران آرام', ocean: 'موج دریا', wind: 'نسیم جنگل' };
  let audioContext = null;
  let ambientNodes = [];
  let masterGain = null;
  let activeSound = 'rain';
  let audioPlaying = false;
  let volume = 0.32;
  function createNoiseSource(context) {
    const bufferSize = context.sampleRate * 3;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }
  function clearAmbient() {
    ambientNodes.forEach(node => { try { node.stop?.(); } catch (_) {} try { node.disconnect?.(); } catch (_) {} });
    ambientNodes = [];
  }
  function makeAmbient(kind) {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('audio unavailable');
      audioContext = new AudioCtx();
      masterGain = audioContext.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioContext.destination);
    }
    clearAmbient();
    const ctx = audioContext;
    if (kind === 'rain') {
      const noise = createNoiseSource(ctx);
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1250;
      const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 180;
      const gain = ctx.createGain(); gain.gain.value = .5;
      noise.connect(low); low.connect(high); high.connect(gain); gain.connect(masterGain); noise.start();
      ambientNodes.push(noise, low, high, gain);
    } else if (kind === 'ocean') {
      const noise = createNoiseSource(ctx);
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 420;
      const swell = ctx.createGain(); swell.gain.value = .42;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .09;
      const depth = ctx.createGain(); depth.gain.value = .24;
      lfo.connect(depth); depth.connect(swell.gain);
      noise.connect(low); low.connect(swell); swell.connect(masterGain); noise.start(); lfo.start();
      ambientNodes.push(noise, low, swell, lfo, depth);
    } else {
      const noise = createNoiseSource(ctx);
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700;
      const windGain = ctx.createGain(); windGain.gain.value = .24;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = .055;
      const depth = ctx.createGain(); depth.gain.value = .14;
      lfo.connect(depth); depth.connect(windGain.gain);
      noise.connect(filter); filter.connect(windGain); windGain.connect(masterGain); noise.start(); lfo.start();
      // A very soft, distant tonal layer gives the generated breeze a gentle character.
      const tone = ctx.createOscillator(); tone.type = 'sine'; tone.frequency.value = 196;
      const toneGain = ctx.createGain(); toneGain.gain.value = .012;
      tone.connect(toneGain); toneGain.connect(masterGain); tone.start();
      ambientNodes.push(noise, filter, windGain, lfo, depth, tone, toneGain);
    }
    if (masterGain) masterGain.gain.setTargetAtTime(volume, ctx.currentTime, .25);
  }
  async function playAmbient() {
    try {
      if (!audioContext) makeAmbient(activeSound);
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (ambientNodes.length === 0) makeAmbient(activeSound);
      if (masterGain) masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, .25);
      audioPlaying = true;
      updateAudioUI();
    } catch (error) {
      audioPlaying = false;
      $('#playerStatus').textContent = 'مرورگر این قابلیت صوتی را پشتیبانی نمی‌کند.';
      showToast('امکان پخش صدا در این مرورگر فراهم نیست.');
    }
  }
  function pauseAmbient() {
    if (audioContext && masterGain) masterGain.gain.setTargetAtTime(0, audioContext.currentTime, .12);
    audioPlaying = false;
    updateAudioUI();
  }
  function updateAudioUI() {
    const toggle = $('#soundToggle');
    const player = $('#ambientPlay');
    toggle?.setAttribute('aria-pressed', String(audioPlaying));
    $('#soundToggleText').textContent = `صدای پس‌زمینه: ${audioPlaying ? 'روشن' : 'خاموش'}`;
    player?.setAttribute('aria-pressed', String(audioPlaying));
    $('#playGlyph').textContent = audioPlaying ? 'Ⅱ' : '▶';
    player?.setAttribute('aria-label', audioPlaying ? 'توقف صدای آرامش' : 'پخش صدای آرامش');
    $('#playerStatus').textContent = audioPlaying ? 'داره پخش می‌شه؛ هر وقت خواستی متوقفش کن' : 'برای شنیدن، دکمه پخش رو بزن';
  }
  function chooseSound(kind) {
    if (!soundNames[kind]) return;
    activeSound = kind;
    $$('.sound-card').forEach(card => {
      const selected = card.dataset.sound === kind;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    $('#currentSoundTitle').textContent = soundNames[kind];
    if (audioPlaying) {
      try { makeAmbient(kind); } catch (_) { pauseAmbient(); }
    }
  }
  $$('.sound-card').forEach(card => card.addEventListener('click', () => chooseSound(card.dataset.sound)));
  $('#ambientPlay')?.addEventListener('click', () => audioPlaying ? pauseAmbient() : playAmbient());
  $('#soundToggle')?.addEventListener('click', () => audioPlaying ? pauseAmbient() : playAmbient());
  $('#volumeSlider')?.addEventListener('input', event => {
    volume = Number(event.target.value) / 100;
    $('#volumeValue').textContent = `${faDigits(event.target.value)}٪`;
    if (masterGain && audioContext) masterGain.gain.setTargetAtTime(audioPlaying ? volume : 0, audioContext.currentTime, .08);
  });
  window.addEventListener('pagehide', () => { try { audioContext?.close(); } catch (_) {} try { breathAudioContext?.close(); } catch (_) {} });

  // Mood responses, deliberately supportive and non-clinical.
  const moodResponses = {
    tired: 'شاید الان وقتشه یه کم دست از تلاش برداری. لازم نیست همیشه محکم و پرانرژی باشی؛ استراحت هم حق توئه.',
    heavy: 'لازم نیست همین الان بفهمی چرا دلت گرفته. فقط با خودت سخت نگیر؛ این حال هم می‌گذره، قدم‌به‌قدم.',
    busy: 'بیا برای چند دقیقه همه تب‌های ذهنت رو ببندیم! قرار نیست همین الان جواب همه‌چی رو پیدا کنی.',
    hopeful: 'چه خوب! همون ذره امید رو نگه دار؛ لازم نیست عجله کنی، همین قدم‌های کوچیک هم ارزش دارن.',
    good: 'چه عالی! همین حال خوب رو یه کم مزه‌مزه کن و بذار توی دلت بمونه. خوشحالم که حالت خوبه.'
  };
  $$('.mood-option').forEach(button => button.addEventListener('click', () => {
    $$('.mood-option').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('#moodResponse').innerHTML = `<span class="response-flower" aria-hidden="true">✿</span><p>${moodResponses[button.dataset.mood]}</p>`;
  }));

  // Gentle garden: keep a small count locally on this device only.
  const plantedFlowers = $('#plantedFlowers');
  const gardenCount = $('#gardenCount');
  let flowerCount = 0;
  let savedFlowerCount = 0;
  try {
    const oldCount = localStorage.getItem('ye-nafas-flowers');
    savedFlowerCount = Math.min(100, Math.max(0, Number(localStorage.getItem('panah-flowers') ?? oldCount) || 0));
    if (oldCount && !localStorage.getItem('panah-flowers')) localStorage.setItem('panah-flowers', oldCount);
  } catch (_) { savedFlowerCount = 0; }
  const flowerEmojis = ['🌼', '🌸', '🌷', '🌺', '🪻', '🌻'];
  function addFlower(restore = false) {
    if (!plantedFlowers || flowerCount >= 100) return;
    const flower = document.createElement('span');
    flower.className = 'planted-flower';
    flower.textContent = flowerEmojis[flowerCount % flowerEmojis.length];
    const positions = [31, 37, 49, 59, 74, 26, 65, 44, 82, 54];
    const left = positions[flowerCount % positions.length] + (Math.floor(flowerCount / positions.length) % 3) * 2;
    const bottom = 28 + (flowerCount % 4) * 8;
    flower.style.left = `${left}%`;
    flower.style.bottom = `${bottom}px`;
    flower.style.animationDelay = restore ? '0s' : `${Math.random() * .15}s`;
    plantedFlowers.appendChild(flower);
    flowerCount += 1;
  }
  for (let i = 0; i < savedFlowerCount; i++) addFlower(true);
  function updateGardenCount() {
    if (flowerCount === 0) gardenCount.textContent = 'هنوز اولین گلت رو نکاشتی؛ از همین‌جا شروع کنیم؟';
    else gardenCount.textContent = `${faDigits(flowerCount)} تا گل توی باغت شکفته؛ چه جای قشنگی ساختی!`;
  }
  updateGardenCount();
  $('#plantFlower')?.addEventListener('click', () => {
    if (flowerCount >= 100) { showToast('باغت پر از گل شده؛ چه جای قشنگی!'); return; }
    addFlower();
    try { localStorage.setItem('panah-flowers', String(flowerCount)); } catch (_) {}
    updateGardenCount();
    showToast('یه گل دیگه توی باغت شکفت. 🌷');
  });

  // Rotating kindness notes.
  const kindnessMessages = [
    'قرار نیست همیشه روی فرم باشی. بعضی روزا همین که از تخت اومدی بیرون هم خودش یه کار بزرگه.',
    'همه‌چی قرار نیست همین امروز روبه‌راه بشه. یه کم به خودت وقت بده؛ قدم‌به‌قدم.',
    'استراحت کردن تنبلی نیست رفیق؛ تو هم شارژ لازم داری.',
    'اگه امروز فقط یه قدم کوچولو برداشتی، همونم حسابه. خودتو دست‌کم نگیر.',
    'لازم نیست جواب همه سؤال‌ها رو همین الان بدونی. بعضی چیزا با گذشت زمان روشن می‌شن.',
    'با خودت همون‌قدر مهربون حرف بزن که با عزیزترین دوستت حرف می‌زنی.',
    'ارزش تو به کارایی که انجام می‌دی نیست؛ خودت، همین‌طوری که هستی، ارزشمندی.',
    'این روز سخت، همه داستان زندگی تو نیست. هنوز کلی لحظه قشنگ مونده.',
    'امروز هرچقدر تونستی، کافیه. مهربونی با خودت رو نذار برای یه روز دیگه.'
  ];
  let lastKindness = 0;
  $('#newKindness')?.addEventListener('click', () => {
    let next = Math.floor(Math.random() * kindnessMessages.length);
    if (kindnessMessages.length > 1) while (next === lastKindness) next = Math.floor(Math.random() * kindnessMessages.length);
    lastKindness = next;
    const message = $('#kindnessMessage');
    message.style.opacity = '0';
    window.setTimeout(() => { message.textContent = kindnessMessages[next]; message.style.opacity = '1'; }, 180);
  });

  // A private writing moment. The text is never sent or stored.
  const thoughtInput = $('#thoughtInput');
  const thoughtCount = $('#thoughtCount');
  thoughtInput?.addEventListener('input', () => {
    thoughtCount.textContent = `${faDigits(thoughtInput.value.length)} از ۶۰۰`;
  });
  $('#releaseThought')?.addEventListener('click', () => {
    const value = thoughtInput.value.trim();
    const result = $('#releaseResult');
    if (!value) {
      result.textContent = 'هر وقت دلت خواست، حتی با یه جمله کوچیک شروع کن.';
      thoughtInput.focus();
      return;
    }
    thoughtInput.value = '';
    thoughtCount.textContent = '۰ از ۶۰۰';
    result.textContent = 'همین‌جا نوشتی و همین‌جا هم می‌مونه؛ حالا یه نفس بکش و بذار بره. ♡';
    showToast('یه قدم کوچیک برای سبک‌تر شدن. ♡');
  });

  // Prevent long-lived audio when the tab is no longer visible.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && audioPlaying) pauseAmbient();
  });
})();
