/* Panaah — interactive features rebuilt from the ground up. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const fa = value => String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  // Small feedback message.
  let toastTimer = 0;
  function toast(message) {
    const box = $('#toast');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => box.classList.remove('show'), 2600);
  }

  // Always return to the actual top of the document (works on desktop and mobile).
  function goToTop(event) {
    event?.preventDefault();
    try {
      window.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    } catch (_) {
      window.scrollTo(0, 0);
    }
    // A final direct reset avoids anchor offsets from scroll-padding on mobile browsers.
    window.setTimeout(() => {
      if (window.scrollY > 4) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }, reduceMotion ? 0 : 850);
  }
  $('#backToStart')?.addEventListener('click', goToTop);
  $('#backToTop')?.addEventListener('click', goToTop);
  const backToTop = $('#backToTop');
  function updateBackToTop() {
    backToTop?.classList.toggle('visible', window.scrollY > 420);
  }
  window.addEventListener('scroll', updateBackToTop, { passive: true });
  updateBackToTop();

  // Mobile navigation.
  const menuButton = $('#menuToggle');
  const nav = $('.main-nav');
  menuButton?.addEventListener('click', () => {
    const opened = nav?.classList.toggle('open') ?? false;
    menuButton.setAttribute('aria-expanded', String(opened));
    menuButton.setAttribute('aria-label', opened ? 'بستن منو' : 'باز کردن منو');
  });
  $$('.main-nav a').forEach(link => link.addEventListener('click', () => {
    nav?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }));

  // Breathing orb: timing is driven by elapsed time, not chained intervals.
  const breathVisual = $('#breathVisual');
  const breathPhase = $('#breathPhase');
  const breathCount = $('#breathCount');
  const breathStart = $('#breathStart');
  const breathReset = $('#breathReset');
  const breathHint = $('#breathHint');
  const breathPhases = [
    { label: 'دم بگیر', className: 'inhale', seconds: 4, hint: 'آرام هوا را به درون بکش؛ فقط تا جایی که راحتی.' },
    { label: 'مکث کوتاه', className: 'hold', seconds: 2, hint: 'اگر بدنت راحت است، یک مکث کوتاه داشته باش.' },
    { label: 'بازدم', className: 'exhale', seconds: 6, hint: 'نرم و بی‌فشار هوا را بیرون بده.' }
  ];
  let breathLength = 120;
  let breathStartedAt = 0;
  let breathTicker = 0;
  let previousPhase = -1;

  function stopBreathing(showInitial = true) {
    window.clearInterval(breathTicker);
    breathTicker = 0;
    breathStartedAt = 0;
    previousPhase = -1;
    breathVisual?.classList.remove('inhale', 'hold', 'exhale', 'is-running');
    if (showInitial && breathPhase && breathCount && breathHint && breathStart && breathReset) {
      breathPhase.textContent = 'آماده‌ای؟';
      breathCount.textContent = 'یک شروع آرام';
      breathHint.textContent = 'وقتی آماده شدی، دکمه را بزن. هیچ عجله‌ای نیست.';
      breathStart.hidden = false;
      breathStart.textContent = 'شروع تمرین ✧';
      breathReset.hidden = true;
    }
  }

  function tickBreathing() {
    const elapsed = (Date.now() - breathStartedAt) / 1000;
    const remaining = Math.max(0, Math.ceil(breathLength - elapsed));
    const cycle = elapsed % 12;
    let phaseIndex = 0;
    let phaseElapsed = cycle;
    if (cycle >= 4 && cycle < 6) { phaseIndex = 1; phaseElapsed = cycle - 4; }
    else if (cycle >= 6) { phaseIndex = 2; phaseElapsed = cycle - 6; }

    const phase = breathPhases[phaseIndex];
    if (phaseIndex !== previousPhase) {
      breathVisual?.classList.remove('inhale', 'hold', 'exhale');
      void breathVisual?.offsetWidth;
      breathVisual?.classList.add(phase.className);
      previousPhase = phaseIndex;
      breathPhase.textContent = phase.label;
      breathHint.textContent = phase.hint;
    }
    breathCount.textContent = `${fa(Math.max(1, Math.ceil(phase.seconds - phaseElapsed)))} ثانیه · ${fa(remaining)} مانده`;

    if (remaining <= 0) {
      stopBreathing(false);
      breathVisual?.classList.remove('inhale', 'hold', 'exhale');
      breathPhase.textContent = 'آفرین';
      breathCount.textContent = 'این لحظه برای تو بود';
      breathHint.textContent = 'حالا چند نفس طبیعی بکش. ممنون که به خودت وقت دادی.';
      breathStart.hidden = false;
      breathStart.textContent = 'یک بار دیگر ✧';
      breathReset.hidden = true;
      toast('امیدوارم کمی سبک‌تر شده باشی. ♡');
    }
  }

  breathStart?.addEventListener('click', () => {
    stopBreathing(false);
    breathStartedAt = Date.now();
    breathVisual?.classList.add('is-running');
    breathStart.hidden = true;
    breathReset.hidden = false;
    tickBreathing();
    breathTicker = window.setInterval(tickBreathing, 180);
  });
  breathReset?.addEventListener('click', () => stopBreathing(true));
  $$('.duration-option').forEach(button => button.addEventListener('click', () => {
    if (breathTicker) return;
    $$('.duration-option').forEach(option => {
      const selected = option === button;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    breathLength = Number(button.dataset.duration) || 120;
  }));

  // Real, local audio files: no network request and no Web Audio dependency.
  const audio = $('#ambientAudio');
  const soundToggle = $('#soundToggle');
  const playButton = $('#ambientPlay');
  const soundStatus = $('#playerStatus');
  const soundTitle = $('#currentSoundTitle');
  const volumeSlider = $('#volumeSlider');
  const soundCatalog = {
    rain: { title: 'باران آرام', file: 'assets/audio/rain.wav' },
    ocean: { title: 'موج دریا', file: 'assets/audio/ocean.wav' },
    wind: { title: 'نسیم جنگل', file: 'assets/audio/wind.wav' }
  };
  let selectedSound = 'rain';
  let soundIsPlaying = false;

  function syncSoundButtons() {
    soundToggle?.setAttribute('aria-pressed', String(soundIsPlaying));
    playButton?.setAttribute('aria-pressed', String(soundIsPlaying));
    $('#soundToggleText').textContent = `صدای آرامش: ${soundIsPlaying ? 'روشن' : 'خاموش'}`;
    $('#playGlyph').textContent = soundIsPlaying ? 'Ⅱ' : '▶';
    playButton?.setAttribute('aria-label', soundIsPlaying ? 'توقف صدای آرامش' : 'پخش صدای آرامش');
    if (soundStatus) soundStatus.textContent = soundIsPlaying ? 'در حال پخش؛ هر وقت خواستی متوقفش کن' : 'برای شنیدن، دکمه پخش را بزن';
  }

  function selectSound(name) {
    if (!soundCatalog[name] || !audio) return;
    selectedSound = name;
    $$('.sound-card').forEach(card => {
      const active = card.dataset.sound === name;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-pressed', String(active));
    });
    if (soundTitle) soundTitle.textContent = soundCatalog[name].title;
    audio.src = soundCatalog[name].file;
    audio.load();
    if (soundIsPlaying) {
      const attempt = audio.play();
      if (attempt?.then) attempt.then(() => { soundIsPlaying = true; syncSoundButtons(); }).catch(handleAudioError);
    }
  }

  function handleAudioError() {
    soundIsPlaying = false;
    syncSoundButtons();
    if (soundStatus) soundStatus.textContent = 'پخش نشد؛ صدای گوشی و حالت بی‌صدا را بررسی کن.';
    toast('پخش صدا ممکن نشد. یک بار دیگر دکمه پخش را بزن.');
  }

  async function playSound() {
    if (!audio) return;
    if (!audio.getAttribute('src')) audio.src = soundCatalog[selectedSound].file;
    audio.volume = Number(volumeSlider?.value ?? 38) / 100;
    try {
      await audio.play();
      soundIsPlaying = true;
      syncSoundButtons();
    } catch (_) {
      handleAudioError();
    }
  }

  function pauseSound() {
    audio?.pause();
    soundIsPlaying = false;
    syncSoundButtons();
  }

  $$('.sound-card').forEach(card => card.addEventListener('click', () => selectSound(card.dataset.sound)));
  playButton?.addEventListener('click', () => soundIsPlaying ? pauseSound() : playSound());
  soundToggle?.addEventListener('click', () => soundIsPlaying ? pauseSound() : playSound());
  volumeSlider?.addEventListener('input', () => {
    if (audio) audio.volume = Number(volumeSlider.value) / 100;
    $('#volumeValue').textContent = `${fa(volumeSlider.value)}٪`;
  });
  audio?.addEventListener('pause', () => {
    if (soundIsPlaying) { soundIsPlaying = false; syncSoundButtons(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && soundIsPlaying) pauseSound();
  });
  selectSound('rain');
  if (audio) audio.volume = Number(volumeSlider?.value ?? 38) / 100;
  syncSoundButtons();

  // Mood picker.
  const moodMessages = {
    tired: 'شاید لازم نباشد الان بیشتر تلاش کنی. یک استراحت کوچک هم بخشی از مسیر است.',
    heavy: 'لازم نیست برای حال دلت دلیل پیدا کنی. همین که حسش می‌کنی، کافی است؛ با خودت نرم باش.',
    busy: 'بیا فقط یک چیز را برای چند لحظه کنار بگذاریم. قرار نیست همه فکرها همین الان جواب بگیرند.',
    hopeful: 'چه خوب که هنوز گوشه‌ای از دلت رو به روشنایی است. همان نور کوچک را آرام نگه دار.',
    good: 'چه قشنگ! لازم نیست دلیل حال خوبت را بدانی؛ چند لحظه کنارش بمان و مزه‌اش را حس کن.'
  };
  $$('.mood-option').forEach(button => button.addEventListener('click', () => {
    $$('.mood-option').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    const response = $('#moodResponse');
    if (!response) return;
    const icon = document.createElement('span');
    icon.className = 'response-flower';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✿';
    const text = document.createElement('p');
    text.textContent = moodMessages[button.dataset.mood] || 'همین حسی که داری، ارزش شنیده‌شدن دارد.';
    response.replaceChildren(icon, text);
  }));

  // Garden: absolutely empty on every page load; one click creates one flower.
  const gardenScene = $('.garden-art');
  const flowerLayer = $('#plantedFlowers');
  const gardenCount = $('#gardenCount');
  const plantButton = $('#plantFlower');
  let flowers = 0;
  const gardenSpots = [
    { x: 15, bottom: 27, height: 67, tilt: -8 }, { x: 27, bottom: 33, height: 82, tilt: 5 },
    { x: 39, bottom: 25, height: 61, tilt: -5 }, { x: 51, bottom: 38, height: 88, tilt: 8 },
    { x: 63, bottom: 26, height: 69, tilt: -7 }, { x: 75, bottom: 34, height: 81, tilt: 6 },
    { x: 86, bottom: 25, height: 63, tilt: -4 }, { x: 21, bottom: 73, height: 62, tilt: 7 },
    { x: 34, bottom: 80, height: 70, tilt: -6 }, { x: 47, bottom: 75, height: 66, tilt: 5 },
    { x: 60, bottom: 82, height: 72, tilt: -5 }, { x: 73, bottom: 74, height: 64, tilt: 7 },
    { x: 82, bottom: 78, height: 70, tilt: -6 }, { x: 10, bottom: 52, height: 58, tilt: 5 },
    { x: 92, bottom: 53, height: 59, tilt: -5 }
  ];
  const petalColors = ['#e8a8a4', '#d7a9c9', '#f0c77e', '#e7a9b7', '#c5b3df', '#f1d39a'];
  const centerColors = ['#f6df9a', '#f5d6a0', '#f4e1a9'];

  function createFlower(index) {
    const spot = gardenSpots[index % gardenSpots.length];
    const flower = document.createElement('div');
    flower.className = 'garden-bloom';
    flower.setAttribute('aria-hidden', 'true');
    flower.style.setProperty('--flower-x', `${spot.x}%`);
    flower.style.setProperty('--flower-bottom', `${spot.bottom}px`);
    flower.style.setProperty('--flower-height', `${spot.height}px`);
    flower.style.setProperty('--flower-tilt', `${spot.tilt}deg`);
    flower.style.setProperty('--petal-color', petalColors[index % petalColors.length]);
    flower.style.setProperty('--center-color', centerColors[index % centerColors.length]);

    const stem = document.createElement('span');
    stem.className = 'bloom-stem';
    const leafA = document.createElement('i');
    leafA.className = 'bloom-leaf leaf-a';
    const leafB = document.createElement('i');
    leafB.className = 'bloom-leaf leaf-b';
    const head = document.createElement('span');
    head.className = 'bloom-head';
    for (let petal = 0; petal < 6; petal += 1) {
      const part = document.createElement('i');
      part.className = 'bloom-petal';
      part.style.setProperty('--petal-angle', `${petal * 60}deg`);
      head.appendChild(part);
    }
    const center = document.createElement('i');
    center.className = 'bloom-center';
    head.appendChild(center);
    flower.append(stem, leafA, leafB, head);
    return flower;
  }

  function updateGardenText() {
    if (!gardenCount) return;
    gardenCount.textContent = flowers === 0
      ? 'باغ هنوز خالیه؛ اولین گل رو تو بکار.'
      : `${fa(flowers)} گل کوچیک توی باغت شکفته. دونه‌دونه قشنگ‌تر می‌شه. `;
  }

  function clearOldGarden() {
    // Remove any flowers left by older versions, including their old saved counters.
    gardenScene?.querySelectorAll('.garden-flower, .flower-one, .flower-two, .flower-three, .flower-four, .flower-five, .planted-flower, .garden-bloom').forEach(node => node.remove());
    flowerLayer?.replaceChildren();
    try {
      for (const key of Object.keys(localStorage)) {
        if (/^(panah|ye-nafas)[-_].*(flower|garden)/i.test(key)) localStorage.removeItem(key);
      }
      localStorage.removeItem('ye-nafas-flowers');
      localStorage.removeItem('panah-flowers');
    } catch (_) { /* Private browsing may block storage; the garden still starts empty. */ }
    flowers = 0;
    updateGardenText();
  }

  clearOldGarden();
  plantButton?.addEventListener('click', () => {
    if (!flowerLayer || flowers >= 30) {
      if (flowers >= 30) toast('باغت پر شده؛ چه باغ قشنگی!');
      return;
    }
    flowerLayer.appendChild(createFlower(flowers));
    flowers += 1;
    updateGardenText();
    toast('یه گل کوچولو برای باغت شکفت. 🌷');
  });

  // Kind words, with a gentle fade between messages.
  const kindWords = [
    'تو مجبور نیستی هر روز بهترین نسخه‌ی خودت باشی. بعضی روزها، فقط ادامه دادن کافیه.',
    'قرار نیست همه‌چیز همین امروز درست بشه. به خودت فرصت بده؛ راه‌ها کم‌کم پیدا می‌شن.',
    'استراحت کردن عقب موندن نیست. تو هم به اندازه‌ی هر چیز دیگه‌ای، به مراقبت نیاز داری.',
    'حتی اگه امروز فقط یه قدم کوچیک برداشتی، باز هم قدم برداشتی. دست‌کم نگیرش.',
    'لازم نیست همیشه جواب همه‌چیز رو بدونی. گاهی آروم موندن، خودش یه جوابه.',
    'با خودت همون‌طور حرف بزن که با یه دوست عزیز و خسته حرف می‌زنی.',
    'تو فقط نتیجه‌ی کارهات نیستی؛ خودِ بودنت هم ارزشمنده.',
    'روزهای سخت، تمام داستان تو نیستن. هنوز صفحه‌های قشنگی در راهه.',
    'امروز هرقدر که تونستی، کافیه. مهربونی با خودت رو به فردا موکول نکن.'
  ];
  let lastKindIndex = 0;
  $('#newKindness')?.addEventListener('click', () => {
    const message = $('#kindnessMessage');
    if (!message) return;
    let next = Math.floor(Math.random() * kindWords.length);
    if (kindWords.length > 1) while (next === lastKindIndex) next = Math.floor(Math.random() * kindWords.length);
    lastKindIndex = next;
    message.classList.add('message-fading');
    window.setTimeout(() => {
      message.textContent = kindWords[next];
      message.classList.remove('message-fading');
    }, reduceMotion ? 0 : 220);
  });

  // Private writing ritual: animate the note away, play a small local chime, then clear it.
  const thoughtInput = $('#thoughtInput');
  const thoughtCount = $('#thoughtCount');
  const releaseButton = $('#releaseThought');
  const releaseVisual = $('#releaseVisual');
  const releaseChime = $('#releaseChime');
  let releaseTimer = 0;
  thoughtInput?.addEventListener('input', () => {
    if (thoughtCount) thoughtCount.textContent = `${fa(thoughtInput.value.length)} از ۶۰۰`;
  });

  releaseButton?.addEventListener('click', () => {
    const noteText = thoughtInput?.value.trim() ?? '';
    const result = $('#releaseResult');
    if (!noteText) {
      if (result) result.textContent = 'اول هرچی توی دلت مونده بنویس؛ لازم نیست مرتب و قشنگ باشه.';
      thoughtInput?.focus();
      return;
    }

    window.clearTimeout(releaseTimer);
    releaseVisual?.querySelectorAll('.release-floating-note').forEach(node => node.remove());
    const floatingNote = document.createElement('span');
    floatingNote.className = 'release-floating-note';
    floatingNote.textContent = noteText.length > 54 ? `${noteText.slice(0, 54)}…` : noteText;
    releaseVisual?.appendChild(floatingNote);
    releaseVisual?.classList.remove('release-active');
    void releaseVisual?.offsetWidth;
    releaseVisual?.classList.add('release-active');

    if (releaseChime) {
      try { releaseChime.currentTime = 0; const chimePromise = releaseChime.play(); chimePromise?.catch?.(() => {}); } catch (_) {}
    }
    if (result) result.textContent = 'بذار آروم‌آروم از ذهنت دور بشه… ♡';
    releaseButton.disabled = true;
    thoughtInput.disabled = true;

    releaseTimer = window.setTimeout(() => {
      if (thoughtInput) thoughtInput.value = '';
      if (thoughtCount) thoughtCount.textContent = '۰ از ۶۰۰';
      if (result) result.textContent = 'رها شد. لازم نیست دوباره بهش برگردی؛ همین لحظه برای توئه. ♡';
      floatingNote.remove();
      releaseVisual?.classList.remove('release-active');
      releaseButton.disabled = false;
      if (thoughtInput) thoughtInput.disabled = false;
      toast('یه نفس آروم… همین‌قدر کافیه.');
    }, reduceMotion ? 80 : 1550);
  });

  // Ensure the page starts in the correct state even after restoring a browser tab.
  window.addEventListener('pageshow', updateBackToTop);
})();
