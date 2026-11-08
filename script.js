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
  backToTop?.addEventListener('click', () => scrollToPageTop());

  // A single reliable scroll helper is shared by both return-to-top controls.
  function scrollToPageTop() {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const topTarget = document.getElementById('top');
    if (topTarget) topTarget.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  $('#backToStart')?.addEventListener('click', (event) => {
    event.preventDefault();
    scrollToPageTop();
  });

  // Guided breathing: 4 seconds in, 2 seconds pause, 6 seconds out.
  const breathVisual = $('#breathVisual');
  const breathPhase = $('#breathPhase');
  const breathCount = $('#breathCount');
  const breathStart = $('#breathStart');
  const breathReset = $('#breathReset');
  const breathHint = $('#breathHint');
  let breathDuration = 120;
  let breathRemaining = 0;
  let breathInterval = null;
  let phaseTimer = null;
  let phaseIndex = 0;
  const phases = [
    { name: 'دم بگیر', key: 'inhale', seconds: 4, hint: 'به‌آرامی هوا را به درون بکش.' },
    { name: 'مکث کوتاه', key: 'hold', seconds: 2, hint: 'اگر راحتی، برای لحظه‌ای مکث کن.' },
    { name: 'بازدم', key: 'exhale', seconds: 6, hint: 'آرام و بدون فشار، هوا را بیرون بده.' }
  ];
  function stopBreathing(showReady = true) {
    window.clearInterval(breathInterval);
    window.clearInterval(phaseTimer);
    breathInterval = null;
    phaseTimer = null;
    breathVisual?.classList.remove('inhale', 'hold', 'exhale');
    if (showReady) {
      breathPhase.textContent = 'آماده‌ای؟';
      breathCount.textContent = 'یک شروع آرام';
      breathHint.textContent = 'وقتی آماده شدی، دکمه را بزن. هیچ عجله‌ای نیست.';
      breathStart.hidden = false;
      breathStart.textContent = 'شروع دوباره ✧';
      breathReset.hidden = true;
    }
  }
  function beginPhase() {
    const phase = phases[phaseIndex];
    breathVisual.classList.remove('inhale', 'hold', 'exhale');
    // Force style recalculation so each phase animation restarts cleanly.
    void breathVisual.offsetWidth;
    breathVisual.classList.add(phase.key);
    breathPhase.textContent = phase.name;
    breathHint.textContent = phase.hint;
    let count = phase.seconds;
    breathCount.textContent = `${faDigits(count)} ثانیه`;
    window.clearInterval(phaseTimer);
    phaseTimer = window.setInterval(() => {
      count -= 1;
      breathCount.textContent = `${faDigits(Math.max(0, count))} ثانیه`;
      if (count <= 0) {
        window.clearInterval(phaseTimer);
        phaseIndex = (phaseIndex + 1) % phases.length;
        beginPhase();
      }
    }, 1000);
  }
  function startBreathing() {
    stopBreathing(false);
    breathRemaining = breathDuration;
    phaseIndex = 0;
    breathStart.hidden = true;
    breathReset.hidden = false;
    breathHint.textContent = 'به‌آرامی حرکت دایره را دنبال کن؛ با بدن خودت مهربان باش.';
    beginPhase();
    breathInterval = window.setInterval(() => {
      breathRemaining -= 1;
      if (breathRemaining <= 0) {
        stopBreathing(false);
        breathPhase.textContent = 'آفرین';
        breathCount.textContent = 'این لحظه برای تو بود';
        breathHint.textContent = 'چند نفس دیگر هم می‌توانی به شکل طبیعی بکشی. ممنون که به خودت وقت دادی.';
        breathStart.hidden = false;
        breathStart.textContent = 'یک بار دیگر';
        breathReset.hidden = true;
        showToast('امیدوارم کمی سبک‌تر شده باشی. ♡');
      }
    }, 1000);
  }
  breathStart?.addEventListener('click', startBreathing);
  breathReset?.addEventListener('click', () => stopBreathing(true));
  $$('.duration-option').forEach(button => button.addEventListener('click', () => {
    if (breathInterval) return;
    $$('.duration-option').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    breathDuration = Number(button.dataset.duration) || 120;
  }));

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
    $('#soundToggleText').textContent = `صدای آرامش: ${audioPlaying ? 'روشن' : 'خاموش'}`;
    player?.setAttribute('aria-pressed', String(audioPlaying));
    $('#playGlyph').textContent = audioPlaying ? 'Ⅱ' : '▶';
    player?.setAttribute('aria-label', audioPlaying ? 'توقف صدای آرامش' : 'پخش صدای آرامش');
    $('#playerStatus').textContent = audioPlaying ? 'در حال پخش؛ هر وقت خواستی متوقفش کن' : 'برای شنیدن، پخش را بزن';
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
  window.addEventListener('pagehide', () => { try { audioContext?.close(); } catch (_) {} });

  // Mood responses, deliberately supportive and non-clinical.
  const moodResponses = {
    tired: 'شاید لازم نباشد الان بیشتر تلاش کنی. یک استراحت کوچک هم بخشی از مسیر است.',
    heavy: 'لازم نیست برای حال دلت دلیل پیدا کنی. همین که حسش می‌کنی، کافی است؛ با خودت نرم باش.',
    busy: 'بیا فقط یک چیز را برای چند لحظه کنار بگذاریم. قرار نیست همه فکرها همین الان جواب بگیرند.',
    hopeful: 'چه خوب که هنوز گوشه‌ای از دلت رو به روشنایی است. همان نور کوچک را آرام نگه دار.',
    good: 'چه قشنگ! لازم نیست دلیل حال خوبت را بدانی؛ چند لحظه کنارش بمان و مزه‌اش را حس کن.'
  };
  $$('.mood-option').forEach(button => button.addEventListener('click', () => {
    $$('.mood-option').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('#moodResponse').innerHTML = `<span class="response-flower" aria-hidden="true">✿</span><p>${moodResponses[button.dataset.mood]}</p>`;
  }));

  // The garden starts empty on every visit; each tap plants exactly one flower.
  const plantedFlowers = $('#plantedFlowers');
  const gardenCount = $('#gardenCount');
  let flowerCount = 0;
  // Clear values saved by older versions so returning visitors also see a fresh garden.
  try { localStorage.removeItem('ye-nafas-flowers'); } catch (_) {}
  const flowerEmojis = ['🌼', '🌸', '🌷', '🌺', '🪻', '🌻'];
  function addFlower() {
    if (!plantedFlowers || flowerCount >= 100) return;
    const flower = document.createElement('span');
    flower.className = 'planted-flower';
    flower.textContent = flowerEmojis[flowerCount % flowerEmojis.length];
    const positions = [31, 37, 49, 59, 74, 26, 65, 44, 82, 54];
    const left = positions[flowerCount % positions.length] + (Math.floor(flowerCount / positions.length) % 3) * 2;
    const bottom = 28 + (flowerCount % 4) * 8;
    flower.style.left = `${left}%`;
    flower.style.bottom = `${bottom}px`;
    flower.style.animationDelay = `${Math.random() * .15}s`;
    plantedFlowers.appendChild(flower);
    flowerCount += 1;
  }
  function updateGardenCount() {
    if (flowerCount === 0) gardenCount.textContent = 'هنوز اولین گلت را نکاشته‌ای؛ از همین‌جا شروع کن.';
    else gardenCount.textContent = `${faDigits(flowerCount)} گل کوچک در باغت شکفته است. چه باغ قشنگی!`;
  }
  updateGardenCount();
  $('#plantFlower')?.addEventListener('click', () => {
    if (flowerCount >= 100) { showToast('باغت پر از گل شده؛ چه جای قشنگی!'); return; }
    addFlower();
    updateGardenCount();
    showToast('یک گل دیگر برای باغت شکفت. 🌷');
  });

  // Rotating kindness notes.
  const kindnessMessages = [
    'تو مجبور نیستی هر روز بهترین نسخه‌ی خودت باشی. بعضی روزها، فقط ادامه دادن کافی است.',
    'قرار نیست همه‌چیز همین امروز درست شود. به خودت فرصت بده؛ راه‌ها کم‌کم پیدا می‌شوند.',
    'استراحت کردن عقب ماندن نیست. تو هم به اندازه‌ی هر چیز دیگری، به مراقبت نیاز داری.',
    'حتی اگر امروز کوچک‌ترین قدم را برداشتی، باز هم قدمی برداشته‌ای. آن را دست‌کم نگیر.',
    'لازم نیست همیشه جواب همه‌چیز را بدانی. گاهی آرام ماندن، خودش یک پاسخ است.',
    'با خودت همان‌طور حرف بزن که با یک دوست عزیز و خسته حرف می‌زنی.',
    'تو فقط نتیجه‌ی کارهایت نیستی؛ خودِ بودنت هم ارزشمند است.',
    'روزهای سخت، تمام داستان تو نیستند. هنوز صفحه‌های قشنگی در راه‌اند.',
    'امروز هرقدر که توانستی، کافی است. مهربانی با خودت را به فردا موکول نکن.'
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
      result.textContent = 'هر وقت آماده بودی، حتی با یک جمله‌ی کوتاه شروع کن.';
      thoughtInput.focus();
      return;
    }
    thoughtInput.value = '';
    thoughtCount.textContent = '۰ از ۶۰۰';
    result.textContent = 'نوشته‌ات فقط همین‌جا، پیش خودت بود. حالا می‌توانی رهایش کنی. ♡';
    showToast('یک لحظه برای سبک‌تر شدن؛ ممنون که به خودت فرصت دادی.');
  });

  // Prevent long-lived audio when the tab is no longer visible.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && audioPlaying) pauseAmbient();
  });
})();
