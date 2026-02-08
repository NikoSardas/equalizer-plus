const volumeFader = document.getElementById('volume');
const fadersGrp = document.querySelectorAll('.fadersGrp input');
const closeBtn = document.getElementById('close');
const monoBtn = document.getElementById('monoBtn');
const invertBtn = document.getElementById('invertBtn');
const presetsSelect = document.getElementById('presets');
const slotButtons = document.querySelectorAll('.slot-btn');
const slotDeleteButtons = document.querySelectorAll('.slot-delete');
const resetBtn = document.getElementById('resetBtn');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const themeLight = document.getElementById('themeLight');
const themeDark = document.getElementById('themeDark');
const themeRandom = document.getElementById('themeRandom');
const startupToggle = document.getElementById('startupToggle');
const collapseElement = document.getElementsByClassName('collapse')[0];
const collapseToggle = document.getElementById('collapse-toggle');
const rangeInputs = document.querySelectorAll('input[type="range"]');
const volumeVal = document.getElementById('volumeVal');
const versionLabelEl = document.getElementById('version');
const app = document.getElementById('EQapp');
const volumeIcon = document.getElementById('volume_icon');
const panFader = $('#panFader');
const panDiv = $('#panDiv');
const DEFAULT_VOLUME = 1;
const MIN_EQ_VALUE = -20;
const DEFAULT_COMPRESSOR_KNEE = 4;
const DEFAULT_COMPRESSOR_RELEASE = 0.2;
const DEFAULT_COMPRESSOR_RATIO = 10;
const DEFAULT_FADER_VALUE = 0;
const DEFAULT_PRESET_LABEL = 'Presets';
const DEFAULT_PAN_VALUE = 0;

let tabId = null;

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function initPopup(tab) {
  tabId = tab.id;

  NProgress.configure({ showSpinner: false });
  NProgress.start();
  NProgress.set(0.1);

  displayCurrentVersion();
  setPopupListener(tabId);
  loadUIListeners();

  NProgress.done();

  notifyWorkerReady();
}

function clearButtonFocusOnMouseUp() {
  const blurActiveButton = (event) => {
    const targetButton = event.target.closest('button, .btn');
    if (targetButton && typeof targetButton.blur === 'function') {
      setTimeout(() => targetButton.blur(), 0);
      return;
    }
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === 'SELECT') {
      return;
    }
    if (
      activeEl &&
      activeEl !== document.body &&
      typeof activeEl.blur === 'function'
    ) {
      setTimeout(() => activeEl.blur(), 0);
    }
  };

  document.addEventListener('mouseup', blurActiveButton);
  document.addEventListener('touchend', blurActiveButton);
  document.addEventListener('pointerup', blurActiveButton);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const [activeTab] = tabs || [];
  if (!activeTab) {
    return;
  }

  clearButtonFocusOnMouseUp();
  initPopup(activeTab);
});

function displayCurrentVersion() {
  const currentVersion = `V${chrome.runtime.getManifest().version}`;

  versionLabelEl.textContent = currentVersion;
}


function setPopupListener(currentTabId) {
  chrome.runtime.onMessage.addListener(async (message) => {
    const { tabId, target, settings, type } = message;

    if (currentTabId !== tabId) return;
    if (target !== 'popup') return;

    if (type === 'load') {
      await loadModules(settings);
      showUI();
    }
  });
}

function handleFaderInput({ target }) {
  const { id, classList } = target;
  let currentValue = Number(target.value);
  if (!Number.isFinite(currentValue)) {
    return;
  }

  if (classList.contains('eqFader') && currentValue === MIN_EQ_VALUE) {
    currentValue *= 2;
  } else if (classList.contains('compressorFader')) {
    setCompressorNumDisplayValue(currentValue, id);
  }

  paintSliderBg(target);

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: id,
    value: currentValue,
    tabId,
  });
}

function handleFaderReset({ target }) {
  let { value, id, classList } = target;

  switch (id) {
    case 'knee':
      value = DEFAULT_COMPRESSOR_KNEE;
      break;
    case 'release':
      value = DEFAULT_COMPRESSOR_RELEASE;
      break;
    case 'ratio':
      value = DEFAULT_COMPRESSOR_RATIO;
      break;
    default:
      value = DEFAULT_FADER_VALUE;
  }

  target.value = value;

  if (classList.contains('compressorFader')) {
    setCompressorNumDisplayValue(value, id);
  }

  paintSliderBg(target);

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: id,
    value,
    tabId,
  });
}

async function handleCollapseToggleClick() {
  const isExpanded = collapseToggle.classList.toggle('open');
  collapseElement.style.display = isExpanded ? 'block' : 'none';
  collapseToggle.setAttribute('aria-expanded', String(isExpanded));

  await chrome.storage.sync.set({ collapsed: !isExpanded });
}

async function handleCloseClick() {
  const powerOffResponse = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'powerOff',
    tabId,
  });

  if (powerOffResponse.success) {
    window.close();
  }
}

async function handleMonoClick() {
  const isMono = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'getMono',
    tabId,
  });

  setMono(!isMono);
}

async function handleInvertClick() {
  const isInverted = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'getInvert',
    tabId,
  });

  setInvert(!isInverted);
}

function handlePresetsChange(event) {
  try {
    loadEqPreset(event.target.value);
  } catch (error) {
    console.warn('Preset load failed:', error);
  }
}

function handleSaveClick() {
  saveSettings();
}

function flashSlotIndicator(buttonEl) {
  if (!buttonEl) return;
  buttonEl.classList.remove('saved-pulse');
  requestAnimationFrame(() => {
    buttonEl.classList.add('saved-pulse');
    setTimeout(() => {
      buttonEl.classList.remove('saved-pulse');
    }, 650);
  });
}

function flashSlotLoad(buttonEl) {
  if (!buttonEl) return;
  buttonEl.classList.remove('loaded-pulse');
  requestAnimationFrame(() => {
    buttonEl.classList.add('loaded-pulse');
    setTimeout(() => {
      buttonEl.classList.remove('loaded-pulse');
    }, 650);
  });
}

async function handleSlotClick(event) {
  const slot = event.currentTarget.dataset.slot;
  if (!slot) return;

  const isSaved = event.currentTarget.classList.contains('slot-saved');

  if (isSaved) {
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'loadPresetSlot',
      tabId,
      slot,
    });
    if (!response || response.success === false) {
      await showNotification('Could not load preset slot.');
    } else {
      flashSlotLoad(event.currentTarget);
    }
  } else {
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'savePresetSlot',
      tabId,
      slot,
    });
    if (!response || response.success === false) {
      await showNotification('Could not save preset slot.');
    } else {
      flashSlotIndicator(event.currentTarget);
    }
  }

  await refreshPresetSlots();
}

async function handleSlotDeleteClick(event) {
  event.stopPropagation();
  const slot = event.currentTarget.dataset.slot;
  if (!slot) return;

  const response = await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'deletePresetSlot',
    tabId,
    slot,
  });
  if (!response || response.success === false) {
    await showNotification('Could not delete preset slot.');
  }

  await refreshPresetSlots();
}

function handleResetClick() {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'reset',
    tabId,
  });

  presetsSelect.value = DEFAULT_PRESET_LABEL;
}

function handleSettingsToggleClick() {
  if (!settingsPanel) return;
  settingsPanel.classList.toggle('hidden');
  settingsPanel.setAttribute(
    'aria-hidden',
    String(settingsPanel.classList.contains('hidden')),
  );
}


function setCompressorOpen(isOpen) {
  const isExpanded = Boolean(isOpen);
  collapseElement.classList.toggle('open', isExpanded);
  collapseToggle.classList.toggle('open', isExpanded);
  collapseToggle.setAttribute('aria-expanded', String(isExpanded));
  const advanced = document.getElementById('advanced');
  if (advanced) {
    advanced.classList.toggle('open', isExpanded);
  }
}

function setTheme(mode) {
  const isDark = mode !== 'light';
  document.body.classList.toggle('dark-mode', isDark);
  document.body.classList.remove('custom-theme');
  document.body.style.removeProperty('--bg1');
  document.body.style.removeProperty('--bg2');
  document.body.style.removeProperty('--panel');
  document.body.style.removeProperty('--panel-hover');
  document.body.style.removeProperty('--text');
  document.body.style.removeProperty('--border');
  document.body.style.removeProperty('--accent');
  if (themeLight) {
    themeLight.classList.toggle('is-active', !isDark);
  }
  if (themeDark) {
    themeDark.classList.toggle('is-active', isDark);
  }
  updatePanTheme();
}

async function handleThemeLightClick() {
  setTheme('light');
  await chrome.storage.sync.set({ theme: 'light', customTheme: null });
}

async function handleThemeDarkClick() {
  setTheme('dark');
  await chrome.storage.sync.set({ theme: 'dark', customTheme: null });
}

function applyCustomTheme(theme) {
  if (!theme || typeof theme !== 'object') return;
  const isDark = theme.mode !== 'light';
  document.body.classList.toggle('dark-mode', isDark);
  document.body.classList.add('custom-theme');
  document.body.style.setProperty('--bg1', theme.bg1);
  document.body.style.setProperty('--bg2', theme.bg2);
  if (theme.panel) {
    document.body.style.setProperty('--panel', theme.panel);
  } else {
    document.body.style.removeProperty('--panel');
  }
  if (theme.panelHover) {
    document.body.style.setProperty('--panel-hover', theme.panelHover);
  } else {
    document.body.style.removeProperty('--panel-hover');
  }
  document.body.style.setProperty('--text', theme.text);
  document.body.style.setProperty('--border', theme.border);
  document.body.style.setProperty('--accent', theme.accent);
  if (themeLight) themeLight.classList.remove('is-active');
  if (themeDark) themeDark.classList.remove('is-active');
  updatePanTheme();
}

function generateRandomTheme() {
  const hue = Math.floor(Math.random() * 360);
  const isLight = Math.random() < 0.5;
  if (isLight) {
    return {
      mode: 'light',
      bg1: `hsl(${hue}, 20%, 92%)`,
      bg2: `hsl(${hue}, 20%, 88%)`,
      panel: `hsl(${hue}, 18%, 96%)`,
      panelHover: `hsl(${hue}, 18%, 90%)`,
      text: '#212324',
      border: 'rgba(0, 0, 0, 0.08)',
      accent: `hsl(${(hue + 30) % 360}, 70%, 45%)`,
    };
  }
  return {
    mode: 'dark',
    bg1: `hsl(${hue}, 18%, 6%)`,
    bg2: `hsl(${hue}, 18%, 10%)`,
    text: '#f5f6f7',
    border: 'rgba(255, 255, 255, 0.06)',
    accent: `hsl(${(hue + 30) % 360}, 80%, 55%)`,
  };
}

async function handleThemeRandomClick() {
  const theme = generateRandomTheme();
  applyCustomTheme(theme);
  if (themeLight) themeLight.classList.remove('is-active');
  if (themeDark) themeDark.classList.remove('is-active');
  await chrome.storage.sync.set({ customTheme: theme, theme: 'custom' });
}

function flashSaveUI() {
  if (!app) return;
  app.classList.remove('save-flash');
  requestAnimationFrame(() => {
    app.classList.add('save-flash');
    setTimeout(() => {
      app.classList.remove('save-flash');
    }, 650);
  });
}

async function handleStartupToggleClick() {
  if (!startupToggle) return;
  const isActive = startupToggle.classList.contains('is-active');

  if (isActive) {
    try {
      await chrome.runtime.sendMessage({
        target: 'worker',
        type: 'clearStartupSettings',
      });
      startupToggle.classList.remove('is-active');
      startupToggle.setAttribute('aria-pressed', 'false');
      return;
    } catch (error) {
      await showNotification('Could not clear startup settings.');
      return;
    }
  }

  let currentSettings = null;
  try {
    currentSettings = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'getCurrentSettings',
      tabId,
    });
  } catch (error) {
    currentSettings = null;
  }
  if (!currentSettings) {
    await showNotification('Could not read current settings.');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      target: 'worker',
      type: 'setStartupSettings',
      settings: currentSettings,
    });
    startupToggle.classList.add('is-active');
    startupToggle.setAttribute('aria-pressed', 'true');
    flashSaveUI();
  } catch (error) {
    await showNotification('Could not save startup settings.');
  }
}


function loadUIListeners() {
  volumeFader.addEventListener('input', ({ target }) => {
    const { value } = target;

    if (value === 0) {
      volumeIcon.classList = 'eqp-volume';
    } else {
      volumeIcon.classList = 'eqp-volume-2';
    }

    changeVolume(value);
    paintSliderBg(target);
  });

  volumeFader.addEventListener('dblclick', ({ target }) => {
    volumeFader.value = DEFAULT_VOLUME;
    changeVolume(DEFAULT_VOLUME);
    paintSliderBg(target);
  });

  fadersGrp.forEach((fader) => {
    fader.addEventListener('input', handleFaderInput);
    fader.addEventListener('dblclick', handleFaderReset);
  });

  collapseToggle.addEventListener('click', handleCollapseToggleClick);
  closeBtn.addEventListener('click', handleCloseClick);
  monoBtn.addEventListener('click', handleMonoClick);
  invertBtn.addEventListener('click', handleInvertClick);
  presetsSelect.addEventListener('change', handlePresetsChange);
  slotButtons.forEach((button) => {
    button.addEventListener('click', handleSlotClick);
  });
  slotDeleteButtons.forEach((button) => {
    button.addEventListener('click', handleSlotDeleteClick);
  });
  resetBtn.addEventListener('click', handleResetClick);
  if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener('click', handleSettingsToggleClick);
  }
  if (themeLight) {
    themeLight.addEventListener('click', handleThemeLightClick);
  }
  if (themeDark) {
    themeDark.addEventListener('click', handleThemeDarkClick);
  }
  if (themeRandom) {
    themeRandom.addEventListener('click', handleThemeRandomClick);
  }
  if (startupToggle) {
    startupToggle.addEventListener('click', handleStartupToggleClick);
    startupToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleStartupToggleClick();
      }
    });
  }
}

function notifyWorkerReady() {
  chrome.runtime.sendMessage({
    target: 'worker',
    type: 'popupReady',
    tabId,
  });
}

function setCompressorNumDisplayValue(value, id) {
  const valueEl = document.getElementById(`${id}Val`);
  if (!valueEl) return;
  valueEl.textContent = value;
}

function showUI() {
  updateAllSliderBackgrounds();
  app.classList.remove('opaque');
}

function paintSliderBg(sliderEl) {
  const percent = Math.ceil(
    ((sliderEl.value - sliderEl.min) / (sliderEl.max - sliderEl.min)) * 100,
  );
  sliderEl.style.backgroundImage = `linear-gradient(to right, var(--accent, #f59821) ${percent}%, transparent ${percent}%)`;
}

function updateAllSliderBackgrounds() {
  rangeInputs.forEach((input) => {
    paintSliderBg(input);
  });
}

async function loadModules(moduleSettings) {
  const storageObject = await chrome.storage.sync.get();
  let settings =
    moduleSettings != null ? moduleSettings : storageObject.settings;
  if (!settings) {
    settings = await chrome.runtime.sendMessage({
      target: 'worker',
      type: 'getDefaultSettings',
    });
  }

  const {
    collapsed,
    theme,
    customTheme,
    startupDefaultEnabled,
    startupSettings,
    showCompressor,
  } = storageObject || {};
  const isCollapsed = collapsed ?? true;
  const safeSettings = isPlainObject(settings) ? settings : {};
  const { volume, mono, pan, eq, compressor, invert } = safeSettings;

  setCollapsed(isCollapsed);
  if (mono != null) initMono(mono);
  if (invert != null) initInvert(invert);
  if (pan != null) initPan(pan);
  if (isPlainObject(compressor)) initCompressor(compressor);
  if (isPlainObject(eq)) initEq(eq);
  if (volume != null) initVolume(volume);

  if (theme === 'custom' && customTheme) {
    applyCustomTheme(customTheme);
  } else {
    setTheme(theme);
  }

  if (startupToggle) {
    const enabled = Boolean(startupDefaultEnabled && startupSettings);
    startupToggle.classList.toggle('is-active', enabled);
    startupToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  const compOpen = showCompressor ?? true;
  setCompressorOpen(compOpen);

  await refreshPresetSlots();
}

function getNotification(message) {
  return {
    type: 'basic',
    iconUrl: '../assets/images/on.png',
    title: 'Equalizer Plus',
    message,
    priority: 1,
  };
}

async function showNotification(message) {
  if (typeof message !== 'string') {
    handleError('Invalid notification string:', message);
  }
  await chrome.notifications.create(getNotification(message));
}

function handleError(message = 'An error occurred', error = null) {
  if (error instanceof Error) {
    throw error;
  }

  throw new Error(message);
}

function initPan(pan) {
  const accent = getComputedStyle(document.body)
    .getPropertyValue('--accent')
    .trim() || '#f59821';
  panFader.knob({
    fgColor: accent,
    bgColor: 'white',
    angleOffset: -125,
    angleArc: 250,
    min: -1,
    max: 1,
    thickness: '.8',
    step: 0.1,
    width: '50',
    height: '50',
    change: (v) => {
      updatePanAria(v);
      setPan(Number(v).toFixed(1));
    },
  });

  panFader.val(Number(pan.toFixed(1))).trigger('change');
  setPan(pan);
  updatePanAria(pan);

  panDiv.on('dblclick', () => {
    panFader.val(DEFAULT_PAN_VALUE).trigger('change');
    setPan(DEFAULT_PAN_VALUE);
    updatePanAria(DEFAULT_PAN_VALUE);
  });
}

function updatePanTheme() {
  const accent = getComputedStyle(document.body)
    .getPropertyValue('--accent')
    .trim() || '#f59821';
  try {
    panFader.trigger('configure', { fgColor: accent });
    panFader.trigger('change');
  } catch (error) {}
}

function setPan(panValue) {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'pan',
    value: panValue,
    tabId,
  });
}

function initMono(mono) {
  setMonoButton(mono);
}

function setMonoButton(isEnabled) {
  monoBtn.checked = isEnabled;
}

async function setMono(isMono) {
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'setMono',
    value: isMono,
    tabId,
  });

  setMonoButton(isMono);
}

function initInvert(invert) {
  setInvertButton(invert);
}

function setInvertButton(isEnabled) {
  invertBtn.checked = isEnabled;
}

async function setInvert(isInverted) {
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'setInvert',
    value: isInverted,
    tabId,
  });

  setInvertButton(isInverted);
}

function initCompressor(compressorSettings) {
  Object.entries(compressorSettings).forEach(([key, value]) => {
    const sliderEl = document.getElementById(key);
    const valueEl = document.getElementById(`${key}Val`);

    if (!sliderEl || !valueEl) {
      return;
    }

    sliderEl.value = value;
    valueEl.textContent = Math.round((value + Number.EPSILON) * 100) / 100;
  });
}

function setCollapsed(isCollapsed) {
  const isExpanded = !isCollapsed;
  if (!collapseElement || !collapseToggle) {
    return;
  }
  collapseElement.classList.toggle('open', isExpanded);
  collapseToggle.classList.toggle('open', isExpanded);
  collapseToggle.setAttribute('aria-expanded', String(isExpanded));
  collapseElement.style.display = isExpanded ? 'block' : 'none';
}

function updatePanAria(value) {
  panFader.attr('aria-valuenow', Number(value).toFixed(1));
}

function initEq(eqSettings) {
  Object.keys(eqSettings).forEach((key) => {
    const bandEl = document.getElementById(key);
    const value = eqSettings[key];

    if (!bandEl) {
      return;
    }

    bandEl.value = value;
  });
}

function loadEqPreset(name) {
  const eqPresets = {
    acoustic: [15, 15, 10, 4, 7, 7, 10, 12, 10, 5],
    bassBooster: [15, 12, 10, 7, 3, 0, 0, 0, 0, 0],
    bassReducer: [-15, -12, -10, -8, -5, 0, 0, 7, 10, 12],
    classical: [15, 12, 10, 8, -5, -5, 0, 7, 10, 12],
    dance: [12, 18, 15, 0, 5, 10, 16, 15, 12, 0],
    deep: [15, 12, 5, 3, 10, 8, 5, -6, -12, -15],
    electronic: [14, 13, 4, 0, -6, 6, 3, 4, 13, 15],
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    hiphop: [16, 14, 4, 10, -4, -3, 4, -2, 6, 10],
    jazz: [13, 10, 4, 6, -5, -5, 0, 4, 10, 13],
    latin: [9, 5, 0, 0, -5, -5, -5, 0, 10, 15],
    loudness: [18, 14, 0, 0, -6, 0, -2, -18, 16, 3],
    lounge: [-10, -5, -2, 4, 13, 4, 0, -5, 6, 3],
    piano: [10, 6, 0, 9, 10, 5, 11, 15, 10, 11],
    pop: [-5, -4, 0, 6, 15, 13, 6, 0, -3, -5],
    rnb: [9, 18, 16, 4, -8, -5, 8, 9, 10, 12],
    rock: [16, 13, 10, 4, -1, -2, 1, 8, 11, 15],
    smallSpeakers: [18, 14, 13, 8, 4, 0, -4, -9, -11, -14],
    spokenWord: [-7, -1, 0, 2, 12, 12, 14, 12, 8, 0],
    trebleBooster: [0, 0, 0, 0, 0, 3, 8, 12, 14, 17],
    trebleReducer: [0, 0, 0, 0, 0, -3, -8, -12, -14, -17],
    vocalBooster: [-5, -10, -10, 4, 12, 12, 10, 5, 0, -5],
  };

  const presetValues = eqPresets[name];
  if (!presetValues) {
    console.warn(`Unknown preset: ${name}`);
    return;
  }

  const presetPayload = {
    twenty: presetValues[0],
    fifty: presetValues[1],
    oneHundred: presetValues[2],
    twoHundred: presetValues[3],
    fiveHundred: presetValues[4],
    oneThousand: presetValues[5],
    twoThousand: presetValues[6],
    fiveThousand: presetValues[7],
    tenThousand: presetValues[8],
    twentyThousand: presetValues[9],
  };

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'loadPreset',
    tabId,
    preset: presetPayload,
  });
}

function initVolume(volumeValue) {
  volumeFader.value = volumeValue;

  setVolumeNumber(volumeValue);
}

function setVolume(volumeValue) {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'volume',
    tabId,
    value: volumeValue,
  });
}

function formatVolumePercent(volumeValue) {
  return `${(100 * Math.round(Number(volumeValue) * 100 + Number.EPSILON)) / 100}%`;
}

function setVolumeNumber(volumeValue) {
  volumeVal.textContent = formatVolumePercent(volumeValue);
}

function changeVolume(volumeValue) {
  setVolume(volumeValue);
  setVolumeNumber(volumeValue);
}

function saveSettings() {
  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'saveSettings',
    tabId,
  });
}

async function fetchPresetSlots() {
  const response = await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'getPresetSlots',
  });
  return response || {};
}

function updatePresetSlotUI(presetSlots) {
  const slots = isPlainObject(presetSlots?.presetSlots)
    ? presetSlots.presetSlots
    : isPlainObject(presetSlots)
      ? presetSlots
      : {};

  slotButtons.forEach((button) => {
    const slot = button.dataset.slot;
    const isSaved = Boolean(slot && slots[slot]);
    const deleteButton = button.querySelector('.slot-delete');

    button.classList.toggle('slot-saved', isSaved);
    if (deleteButton) {
      deleteButton.classList.toggle('hidden', !isSaved);
    }
    const checkEl = button.querySelector('.slot-check');
    if (checkEl) {
      checkEl.classList.toggle('hidden', !isSaved);
    }
  });
}

async function refreshPresetSlots() {
  const response = await fetchPresetSlots();
  updatePresetSlotUI(response);
}
