
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  tabId = tabs[0].id;

  NProgress.set(0.1);

  displayCurrentVersion();
  setPopupListener(tabId);
  loadUIListeners();

  NProgress.done();

  sendReadyMessage();
});

//

let tabId = null;

NProgress.configure({ showSpinner: false });
NProgress.start();

const { sendMessage } = chrome.runtime;

const volumeFader = document.getElementById('volume'),
  fadersGrp = document.querySelectorAll('.fadersGrp input'),
  closeBtn = document.getElementById('close'),
  monoBtn = document.getElementById('monoBtn'),
  invertBtn = document.getElementById('invertBtn'),
  presetsSelect = document.getElementById('presets'),
  saveSettingsBtn = document.getElementById('saveSettingsBtn'),
  loadSettingsBtn = document.getElementById('loadSettingsBtn'),
  deleteSettingsBtn = document.getElementById('deleteSettingsBtn'),
  resetBtn = document.getElementById('resetBtn'),
  collapseElement = document.getElementsByClassName('collapse')[0],
  collapseToggle = document.getElementById('collapse-toggle'),
  rangeInputs = document.querySelectorAll('input[type="range"]'),
  volumeVal = document.getElementById('volumeVal'),
  collapseElements = document.querySelector('.collapse'),
  app = document.getElementById('EQapp');

function sendReadyMessage() {
  sendMessage({
    target: 'worker',
    type: 'popupReady',
    tabId,
  });
}

function setPopupListener(currentTabId) {
  chrome.runtime.onMessage.addListener(async (message) => {
    const { tabId, target, settings, type } = message;

    if (currentTabId !== tabId) return;
    if (target !== 'popup') return;

    if (type === 'load') {
      loadModules(settings).then(() => {
        displayUI();
      });
    }
  });
}

function setCompressorNumDisplayValue(displayVal, id) {
  const compFaderValDisplay = document.getElementById(`${id}Val`);
  compFaderValDisplay.textContent = displayVal;
}

function displayUI() {
  paintAllSliders();
  app.classList.remove('opaque');
}

function loadUIListeners() {
  volumeFader.addEventListener('input', ({ target }) => {
    const { value } = target;
    const volumeIcon = document.getElementById('volume_icon');

    if (value === 0) {
      volumeIcon.classList = 'eqp-volume';
    } else {
      volumeIcon.classList = 'eqp-volume-2';
    }

    changeVolume(value);
    paintSliderBg(target);
  });

  volumeFader.addEventListener('dblclick', ({ target }) => {
    const defaultValue = 1;

    volumeFader.value = defaultValue;
    changeVolume(defaultValue);
    paintSliderBg(target);
  });

  fadersGrp.forEach((fader) => {
    fader.addEventListener('input', ({ target }) => {
      const { id, classList } = target;
      let currentValue = Number(target.value);
      const minimumEqValue = -20;

      if (classList.contains('eqFader') && currentValue === minimumEqValue) {
        currentValue *= 2;
      } else if (classList.contains('compressorFader')) {
        setCompressorNumDisplayValue(currentValue, id);
      }

      paintSliderBg(target);

      sendMessage({
        target: 'offscreen',
        type: id,
        value: currentValue,
        tabId,
      });
    });

    fader.addEventListener('dblclick', ({ target }) => {
      let { value, id, classList } = target;
      const kneeDefaultValue = 4;
      const releaseDefaultValue = 0.2;
      const ratioDefaultValue = 10;
      const defaultValue = 0;

      switch (id) {
        case 'knee':
          value = kneeDefaultValue;
          break;
        case 'release':
          value = releaseDefaultValue;
          break;
        case 'ratio':
          value = ratioDefaultValue;
          break;
        default:
          value = defaultValue;
      }

      target.value = value;

      if (classList.contains('compressorFader')) {
        setCompressorNumDisplayValue(value, id);
      }

      paintSliderBg(target);

      sendMessage({
        target: 'offscreen',
        type: id,
        value,
        tabId,
      });
    });
  });

  collapseToggle.addEventListener('click', async () => {
    collapseToggle.classList.toggle('open');

    const isCollapsed = !collapseToggle.classList.contains('open');

    if (isCollapsed) {
      collapseElements.style.display = 'none';
    } else {
      collapseElements.style.display = 'block';
    }

    await chrome.storage.sync.set({ collapsed: isCollapsed });
  });

  closeBtn.addEventListener('click', async () => {
    const powerOff = await sendMessage({
      target: 'offscreen',
      type: 'powerOff',
      tabId,
    });

    if (powerOff.success) {
      window.close();
    }
  });

  monoBtn.addEventListener('click', async () => {
    const mono = await sendMessage({
      target: 'offscreen',
      type: 'getMono',
      tabId,
    });

    setMono(!mono);
  });

  invertBtn.addEventListener('click', async () => {
    const invert = await sendMessage({
      target: 'offscreen',
      type: 'getInvert',
      tabId,
    });

    setInvert(!invert);
  });

  presetsSelect.addEventListener('change', ({ target }) => {
    loadEqPreset(target.value);
  });

  saveSettingsBtn.addEventListener('click', () => {
    saveSettings();
    showLoadBtn();
  });

  loadSettingsBtn.addEventListener('click', () => {
    sendMessage({
      target: 'offscreen',
      type: 'loadSavedSettings',
      tabId,
    });
  });

  deleteSettingsBtn.addEventListener('click', () => {
    sendMessage({
      target: 'offscreen',
      type: 'deleteSavedSettings',
      tabId,
    });

    showSaveBtn();
  });

  resetBtn.addEventListener('click', () => {
    sendMessage({
      target: 'offscreen',
      type: 'reset',
      tabId,
    });

    presetsSelect.value = 'Presets';
  });
}

function paintSliderBg(el) {
  const p = Math.ceil(((el.value - el.min) / (el.max - el.min)) * 100);
  el.style.backgroundImage = `linear-gradient(to right, #f59821 ${p}%, transparent ${p}%)`;
}

function paintAllSliders() {
  rangeInputs.forEach((input) => {
    paintSliderBg(input);
  });
}

function displayCurrentVersion() {
  const versionElement = document.getElementById('version');
  const currentVersion = `V${chrome.runtime.getManifest().version}`;

  versionElement.textContent = currentVersion;
}

async function loadModules(moduleSettings) {
  console.log(moduleSettings);
  const storageObject = await chrome.storage.sync.get();
  console.log(storageObject);

  if (moduleSettings === undefined) {
    moduleSettings = storageObject.settings;
  }

  //  console.log(moduleSettings);

  const { collapsed, saved } = storageObject;
  const { volume, mono, pan, eq, compressor, invert } = moduleSettings;

  // console.log(volume, mono, pan, eq, compressor, invert);
  // console.log(tabId);

  if (mono != null) initMono(mono);
  if (invert != null) initInvert(invert);
  if (pan != null) initPan(pan);
  if (compressor != null) initCompressor(compressor, collapsed);
  if (eq != null) initEq(eq);
  if (volume != null) initVolume(volume);

  showSavedButton(saved);
}

function getNotification(notification) {
  return {
    type: 'basic',
    iconUrl: '../assets/images/on.png',
    title: 'Equalizer Plus',
    message: notification,
    priority: 1,
  };
}

async function showNotification(notification) {
  if (typeof notification !== 'string') {
    handleError('Invalid notification string:', notification);
    return;
  }
  await chrome.notifications.create(getNotification(notification));
}

function handleError(message = 'An error occurred', error = null) {
  console.error(error);
}

function initPan(pan) {
  const panFader = $('#panFader');
  const panDiv = $('#panDiv');

  panFader.knob({
    fgColor: '#f59821',
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
      setPan(Number(v).toFixed(1));
    },
  });

  panFader.val(Number(pan.toFixed(1))).trigger('change');
  setPan(pan);

  panDiv.on('dblclick', () => {
    panFader.val(0).trigger('change');
    setPan(0);
  });
}

function setPan(value) {
  sendMessage({
    target: 'offscreen',
    type: 'pan',
    value,
    tabId,
  });
}

function initMono(mono) {
  setMonoButton(mono);
}

function setMonoButton(state) {
  monoBtn.checked = state;
}

async function setMono(value) {
  await sendMessage({
    target: 'offscreen',
    type: 'setMono',
    value,
    tabId,
  });

  setMonoButton(value);
}

function initInvert(invert) {
  setInvertButton(invert);
}

function setInvertButton(state) {
  invertBtn.checked = state;
}

async function setInvert(value) {
  await sendMessage({
    target: 'offscreen',
    type: 'setInvert',
    value,
    tabId,
  });

  setInvertButton(value);
}

function initCompressor(compSettings, collapsed) {
  setCollapsed(collapsed);

  Object.entries(compSettings).forEach(([key, value]) => {
    const sliderPosition = document.getElementById(key);
    const numberValue = document.getElementById(`${key}Val`);

    sliderPosition.value = value;
    numberValue.textContent = Math.round((value + Number.EPSILON) * 100) / 100;
  });
}

function setCollapsed(collapsed) {
  const hide = () => {
    collapseElement.classList.remove('open');
    collapseToggle.classList.remove('open');
  };
  const show = () => {
    collapseElement.classList.add('open');
    collapseToggle.classList.add('open');
  };

  collapsed ? hide() : show();
}

function initEq(eqSettings) {
  Object.keys(eqSettings).forEach((key) => {
    const eqBand = document.getElementById(key);
    const currentValue = eqSettings[key];

    eqBand.value = currentValue;
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

  const item = eqPresets[name];

  const preset = {
    twenty: item[0],
    fifty: item[1],
    oneHundred: item[2],
    twoHundred: item[3],
    fiveHundred: item[4],
    oneThousand: item[5],
    twoThousand: item[6],
    fiveThousand: item[7],
    tenThousand: item[8],
    twentyThousand: item[9],
  };

  sendMessage({
    target: 'offscreen',
    type: 'loadPreset',
    tabId,
    preset,
  });
}

function initVolume(volume) {
  volumeFader.value = volume;

  setVolumeNumber(volume);
}

function setVolume(value) {
  sendMessage({
    target: 'offscreen',
    type: 'volume',
    tabId,
    value,
  });
}

function setVolumeNumber(value) {
  volumeVal.textContent = `${
    (100 * Math.round(Number(value) * 100 + Number.EPSILON)) / 100
  }%`;
}

function changeVolume(value) {
  setVolume(value);
  setVolumeNumber(value);
}

function showSavedButton(saved) {
  saved ? showLoadBtn() : showSaveBtn();
}

function saveSettings() {
  sendMessage({
    target: 'offscreen',
    type: 'saveSettings',
    tabId,
  });
}

function showLoadBtn() {
  document.getElementById('saveSettingsBtn').classList.add('hidden');
  document.getElementById('deleteSettingsBtn').classList.remove('hidden');
  document.getElementById('loadSettingsBtn').classList.remove('hidden');
}

function showSaveBtn() {
  document.getElementById('saveSettingsBtn').classList.remove('hidden');
  document.getElementById('deleteSettingsBtn').classList.add('hidden');
  document.getElementById('loadSettingsBtn').classList.add('hidden');
}
