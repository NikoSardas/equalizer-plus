chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleOffscreenMessage(message, sender, sendResponse);
});

function handleOffscreenMessage(message, sender, sendResponse) {
  const { target } = message;

  if (target !== 'offscreen') return;

  const { value, type, tabId, streamId } = message;
  const capturedTabIndex = tabId != null ? getCapturedTabIndex(tabId) : -1;
  const capturedTab = capturedTabsArr[capturedTabIndex];

  switch (type) {
    case 'captureTab':
      captureTab(streamId, tabId);
      break;

    case 'loadCapturedTab':
      loadCapturedTab(capturedTabIndex, tabId);
      break;

    case 'powerOff':
      powerOff(capturedTabIndex);
      sendResponse({ success: true });
      break;

    case 'reset':
      if (!capturedTab) {
        handleError('reset: no captured tab for tabId', tabId);
        return;
      }
      capturedTab.resetSettings().then(() => {
        loadCapturedTab(capturedTabIndex, tabId);
      });
      break;

    case 'deleteSavedSettings':
      chrome.runtime.sendMessage({
        target: 'worker',
        type: 'deleteSavedSettings',
      });
      break;

    case 'loadSavedSettings':
      if (!capturedTab) {
        handleError('loadSavedSettings: no captured tab for tabId', tabId);
        return;
      }
      loadSavedSettings(capturedTabIndex, tabId);
      break;

    case 'loadPreset':
      if (!capturedTab) {
        handleError('loadPreset: no captured tab for tabId', tabId);
        return;
      }
      loadPreset(capturedTabIndex, tabId, message.preset);
      break;

    case 'saveSettings':
      if (!capturedTab) {
        handleError('saveSettings: no captured tab for tabId', tabId);
        return;
      }
      capturedTab.saveSettings();
      break;

    case 'savePresetSlot':
      if (!capturedTab) {
        handleError('savePresetSlot: no captured tab for tabId', tabId);
        sendResponse({ success: false });
        return;
      }
      savePresetSlot(capturedTabIndex, message.slot)
        .then((success) => sendResponse({ success: Boolean(success) }))
        .catch(() => sendResponse({ success: false }));
      return true;

    case 'loadPresetSlot':
      if (!capturedTab) {
        handleError('loadPresetSlot: no captured tab for tabId', tabId);
        sendResponse({ success: false });
        return;
      }
      loadPresetSlot(capturedTabIndex, tabId, message.slot)
        .then((success) => sendResponse({ success: Boolean(success) }))
        .catch(() => sendResponse({ success: false }));
      return true;

    case 'deletePresetSlot':
      deletePresetSlot(message.slot)
        .then((success) => sendResponse({ success: Boolean(success) }))
        .catch(() => sendResponse({ success: false }));
      return true;

    case 'volume':
      if (!capturedTab) {
        handleError('volume: no captured tab for tabId', tabId);
        break;
      }
      capturedTab.volumeGainNode.gain.value = message.value;
      break;

    case 'getVolume':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      sendResponse(capturedTab.volumeGainNode.gain.value);
      break;

    case 'threshold':
      if (!capturedTab) {
        break;
      }
      capturedTab.compressor.threshold.value = message.value;
      break;

    case 'attack':
      if (!capturedTab) {
        break;
      }
      capturedTab.compressor.attack.value = message.value;
      break;

    case 'release':
      if (!capturedTab) {
        break;
      }
      capturedTab.compressor.release.value = message.value;
      break;

    case 'ratio':
      if (!capturedTab) {
        break;
      }
      capturedTab.compressor.ratio.value = message.value;
      break;

    case 'knee':
      if (!capturedTab) {
        break;
      }
      capturedTab.compressor.knee.value = message.value;
      break;

    case 'twenty':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.twenty.gain.value = message.value;
      break;

    case 'fifty':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.fifty.gain.value = message.value;
      break;

    case 'oneHundred':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.oneHundred.gain.value = message.value;
      break;

    case 'twoHundred':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.twoHundred.gain.value = message.value;
      break;

    case 'fiveHundred':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.fiveHundred.gain.value = message.value;
      break;

    case 'oneThousand':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.oneThousand.gain.value = message.value;
      break;

    case 'twoThousand':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.twoThousand.gain.value = message.value;
      break;

    case 'fiveThousand':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.fiveThousand.gain.value = message.value;
      break;

    case 'tenThousand':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.tenThousand.gain.value = message.value;
      break;

    case 'twentyThousand':
      if (!capturedTab) {
        break;
      }
      capturedTab.eq.twentyThousand.gain.value = message.value;
      break;

    case 'pan':
      if (!capturedTab) {
        break;
      }
      capturedTab.setPan(value);
      break;

    case 'getPan':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      sendResponse(capturedTab.pan);
      break;

    case 'setMono':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      capturedTab.setMono(value);
      sendResponse(true);
      break;

    case 'getMono':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      sendResponse(capturedTab.mono);
      break;

    case 'setInvert':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      capturedTab.setInvert(value);
      sendResponse(true);
      break;

    case 'getInvert':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      sendResponse(capturedTab.invert);
      break;

    case 'getCurrentSettings':
      if (!capturedTab) {
        sendResponse(false);
        break;
      }
      capturedTab.getSettings().then((settings) => {
        sendResponse(settings);
      });
      return true;

    case 'tabRemoved':
      if (capturedTabIndex !== -1) {
        capturedTabsArr[capturedTabIndex].stopAudio();
        capturedTabsArr.splice(capturedTabIndex, 1);
      }
      sendResponse(true);
      break;

    case 'getIndex':
      sendResponse(capturedTabIndex);
      return true;

    case 'saveWindowState':
      if (!capturedTab) {
        break;
      }
      capturedTab.windowState = message.state;
      break;

    case 'getSavedWindowState':
      if (!capturedTab) {
        sendResponse(null);
        break;
      }
      sendResponse(capturedTab.windowState || null);
      break;
  }
}

const capturedTabsArr = [];

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

async function fetchDefaultSettings() {
  return await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'getDefaultSettings',
  });
}

async function fetchSavedSettings() {
  return await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'getSavedSettings',
  });
}

async function fetchPresetSlots() {
  return await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'getPresetSlots',
  });
}

async function fetchStartupSettings() {
  return await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'getStartupSettings',
  });
}



function handleError(message = 'An error occurred', error = null) {
  if (error instanceof Error) {
    console.error(message, error);
    return;
  }

  console.error(message);
  return;
}

async function requestTabAudioStream(streamId) {
  if (!streamId) {
    throw new Error('Missing streamId');
  }
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
  });
}

async function getStream(streamId) {
  try {
    const stream = await requestTabAudioStream(streamId);
    return stream;
  } catch (error) {
    handleError(
      'Error getting audio stream: ' + (error && error.message),
      error,
    );
    return null;
  }
}

function sendAudioSettingsToPopup(settings, tabId) {
  chrome.runtime.sendMessage({
    target: 'popup',
    type: 'load',
    settings,
    tabId,
  });
}

async function loadSavedSettings(capturedTabIndex, tabId) {
  const { settings } = await fetchSavedSettings();
  const safeSettings = isPlainObject(settings)
    ? settings
    : await fetchDefaultSettings();
  const capturedTab = capturedTabsArr[capturedTabIndex];
  if (!capturedTab) {
    handleError('loadSavedSettings: invalid captured tab index', capturedTabIndex);
    return;
  }
  capturedTab.loadSettings(safeSettings);
  sendAudioSettingsToPopup(safeSettings, tabId);
}

async function captureTab(streamId, tabId) {
  const existingCapturedTabIndex = getCapturedTabIndex(tabId);
  if (existingCapturedTabIndex !== -1) {
    await loadCapturedTab(existingCapturedTabIndex, tabId);
    return;
  }

  const { startupSettings, startupDefaultEnabled } = await fetchStartupSettings();
  if (startupDefaultEnabled && isPlainObject(startupSettings)) {
    const defaultSettings = await fetchDefaultSettings();
    const safeStartupSettings = buildSafeSettings({
      defaultSettings,
      incomingSettings: startupSettings,
    });
    const stream = await getStream(streamId);
    if (!stream) {
      handleError('captureTab: failed to get startup stream');
      return;
    }
    capturedTabsArr.push(
      new CapturedAudioObject({
        tabId,
        stream,
        settings: safeStartupSettings,
      }),
    );
    sendAudioSettingsToPopup(safeStartupSettings, tabId);
    return;
  }

  const { settings } = await fetchSavedSettings();
  const defaultSettings = await fetchDefaultSettings();
  const safeSettings = buildSafeSettings({
    defaultSettings,
    incomingSettings: settings,
  });
  const stream = await getStream(streamId);
  if (!stream) {
    handleError('captureTab: failed to get stream');
    return;
  }

  capturedTabsArr.push(new CapturedAudioObject({
    tabId,
    stream,
    settings: safeSettings,
  }));

  sendAudioSettingsToPopup(safeSettings, tabId);
}

async function loadCapturedTab(capturedTabIndex, tabId) {
  const capturedTab = capturedTabsArr[capturedTabIndex];
  if (!capturedTab) {
    handleError('loadCapturedTab: invalid captured tab index', capturedTabIndex);
    return;
  }
  const currentSettings = await capturedTab.getSettings();
  sendAudioSettingsToPopup(currentSettings, tabId);
}

async function loadPreset(capturedTabIndex, tabId, eqPreset) {
  const presetSettings = { eq: eqPreset };
  const capturedTab = capturedTabsArr[capturedTabIndex];
  if (!capturedTab) {
    handleError('loadPreset: invalid captured tab index', capturedTabIndex);
    return;
  }
  capturedTab.loadSettings(presetSettings);
  sendAudioSettingsToPopup(presetSettings, tabId);
}

async function savePresetSlot(capturedTabIndex, slot) {
  const capturedTab = capturedTabsArr[capturedTabIndex];
  if (!capturedTab) {
    handleError('savePresetSlot: invalid captured tab index', capturedTabIndex);
    return false;
  }
  const settings = await capturedTab.getSettings();
  await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'savePresetSlot',
    slot,
    settings,
  });
  return true;
}

async function loadPresetSlot(capturedTabIndex, tabId, slot) {
  const capturedTab = capturedTabsArr[capturedTabIndex];
  if (!capturedTab) {
    handleError('loadPresetSlot: invalid captured tab index', capturedTabIndex);
    return false;
  }
  const { presetSlots } = await fetchPresetSlots();
  const slots = isPlainObject(presetSlots) ? presetSlots : {};
  const slotSettings = slots[slot];
  if (!isPlainObject(slotSettings)) {
    return false;
  }
  capturedTab.loadSettings(slotSettings);
  sendAudioSettingsToPopup(slotSettings, tabId);
  return true;
}

async function deletePresetSlot(slot) {
  await chrome.runtime.sendMessage({
    target: 'worker',
    type: 'deletePresetSlot',
    slot,
  });
  return true;
}

function powerOff(capturedTabIndex) {
  if (capturedTabIndex === -1) {
    return;
  }
  capturedTabsArr[capturedTabIndex].stopAudio();
  capturedTabsArr.splice(capturedTabIndex, 1);
}

function getCapturedTabIndex(tabId) {
  return capturedTabsArr.findIndex(({ tabId: capturedTabId }) => capturedTabId === tabId);
}

function buildSafeSettings({ defaultSettings, incomingSettings }) {
  const safeDefaults = isPlainObject(defaultSettings) ? defaultSettings : {};
  const safeIncoming = isPlainObject(incomingSettings) ? incomingSettings : {};
  const defaultCompressor = isPlainObject(safeDefaults.compressor)
    ? safeDefaults.compressor
    : {};
  const incomingCompressor = isPlainObject(safeIncoming.compressor)
    ? safeIncoming.compressor
    : {};
  const defaultEq = isPlainObject(safeDefaults.eq) ? safeDefaults.eq : {};
  const incomingEq = isPlainObject(safeIncoming.eq) ? safeIncoming.eq : {};

  return {
    ...safeDefaults,
    ...safeIncoming,
    compressor: { ...defaultCompressor, ...incomingCompressor },
    eq: { ...defaultEq, ...incomingEq },
  };
}

class CapturedAudioObject {
  constructor({ tabId, stream: audioStream, settings }) {
    this.tabId = tabId;
    this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
    this.setupAudioNodes(audioStream, settings);
  }
  setupAudioNodes(audioStream, audioSettings) {
    this.streamOutput = this.createMediaStreamSource(audioStream);
    this.setupVolume(audioSettings.volume);
    this.setupPan(audioSettings.pan);
    this.setupMono(audioSettings.mono);
    this.setupInvert(audioSettings.invert);
    this.setupCompressor(audioSettings.compressor);
    this.setupEqualizer(audioSettings.eq);
    this.connectAudioNodes();
  }
  createMediaStreamSource(audioStream) {
    return this.audioCtx.createMediaStreamSource(audioStream);
  }
  setupVolume(volumeValue) {
    this.volumeGainNode = this.audioCtx.createGain();
    this.leftInvertGainNode = this.audioCtx.createGain();
    this.rightInvertGainNode = this.audioCtx.createGain();

    this.invertSplitter = this.audioCtx.createChannelSplitter(2);
    this.invertMerger = this.audioCtx.createChannelMerger(2);
    this.volumeGainNode.gain.value = volumeValue;
  }
  setupPan(panValue) {
    this.pan = panValue;
    this.panSplitter = this.audioCtx.createChannelSplitter(2);
    this.leftPanGain = this.audioCtx.createGain();
    this.rightPanGain = this.audioCtx.createGain();
    this.panMerger = this.audioCtx.createChannelMerger(2);
  }
  setupMono(isMono) {
    this.mono = isMono;
    this.monoSplitter = this.audioCtx.createChannelSplitter(2);
    this.monoGain = this.audioCtx.createGain();
    this.stereoGain = this.audioCtx.createGain();
    this.monoMerger = this.audioCtx.createChannelMerger(1);
    this.stereoMerger = this.audioCtx.createChannelMerger(2);
    this.monoGain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    this.stereoGain.gain.setValueAtTime(1, this.audioCtx.currentTime);
  }
  setupInvert(isInverted) {
    this.invert = isInverted;
  }
  setupCompressor(compressorSettings) {
    this.compressor = this.audioCtx.createDynamicsCompressor();

    Object.entries(compressorSettings).forEach(([key, value]) => {
      this.compressor[key].setValueAtTime(value, this.audioCtx.currentTime);
    });

    this.compressor.attack.value = Number(
      this.compressor.attack.value.toFixed(1),
    );
  }
  setupEqualizer(eqSettings) {
    const eqBandConfig = {
      twenty: {
        type: 'lowshelf',
        frequency: 32,
      },
      fifty: {
        type: 'peaking',
        frequency: 64,
      },
      oneHundred: {
        type: 'peaking',
        frequency: 125,
      },
      twoHundred: {
        type: 'peaking',
        frequency: 250,
      },
      fiveHundred: {
        type: 'peaking',
        frequency: 500,
      },
      oneThousand: {
        type: 'peaking',
        frequency: 1000,
      },
      twoThousand: {
        type: 'peaking',
        frequency: 2000,
      },
      fiveThousand: {
        type: 'peaking',
        frequency: 4000,
      },
      tenThousand: {
        type: 'peaking',
        frequency: 8000,
      },
      twentyThousand: {
        type: 'highshelf',
        frequency: 16000,
      },
    };

    this.eq = {};

    Object.entries(eqSettings).forEach(([bandKey, gainValue]) => {
      this.eq[bandKey] = this.audioCtx.createBiquadFilter();

      const filterNode = this.eq[bandKey];
      const { currentTime } = this.audioCtx;
      const { type, frequency } = eqBandConfig[bandKey];

      filterNode.gain.value = gainValue;
      filterNode.type = type;
      filterNode.frequency.setValueAtTime(frequency, currentTime);

      if (!bandKey.includes('twenty')) {
        filterNode.Q.setValueAtTime(5, currentTime);
      }
    });
  }
  connectAudioNodes() {
    this.connectInvertNodes();
    this.connectPanNodes();
    this.setMono(this.mono);
    this.connectEqChain();
    this.connectOutput();
  }

  connectInvertNodes() {
    const {
      streamOutput,
      invertSplitter,
      leftInvertGainNode,
      rightInvertGainNode,
      invertMerger,
    } = this;

    streamOutput.connect(invertSplitter);
    invertSplitter.connect(leftInvertGainNode, 0, 0);
    invertSplitter.connect(rightInvertGainNode, 1, 0);
    leftInvertGainNode.connect(invertMerger, 0, 0);
    rightInvertGainNode.connect(invertMerger, 0, 1);

    if (this.invert) {
      this.setInvert(true);
    }
  }

  connectPanNodes() {
    const {
      invertMerger,
      panSplitter,
      leftPanGain,
      rightPanGain,
      panMerger,
    } = this;

    invertMerger.connect(panSplitter);
    panSplitter.connect(leftPanGain, 0);
    panSplitter.connect(rightPanGain, 1);
    leftPanGain.connect(panMerger, 0, 0);
    rightPanGain.connect(panMerger, 0, 1);
  }

  connectEqChain() {
    const { compressor } = this;
    const {
      twenty,
      fifty,
      oneHundred,
      twoHundred,
      fiveHundred,
      oneThousand,
      twoThousand,
      fiveThousand,
      tenThousand,
      twentyThousand,
    } = this.eq;

    twenty.connect(fifty);
    fifty.connect(oneHundred);
    oneHundred.connect(twoHundred);
    twoHundred.connect(fiveHundred);
    fiveHundred.connect(oneThousand);
    oneThousand.connect(twoThousand);
    twoThousand.connect(fiveThousand);
    fiveThousand.connect(tenThousand);
    tenThousand.connect(twentyThousand);
    twentyThousand.connect(compressor);
  }

  connectOutput() {
    const { audioCtx, compressor, volumeGainNode } = this;

    compressor.connect(volumeGainNode);
    volumeGainNode.connect(audioCtx.destination);
  }
  setMono(isMono) {
    const {
      panMerger,
      monoSplitter,
      monoGain,
      stereoGain,
      monoMerger,
      stereoMerger,
    } = this;

    const { twenty } = this.eq;

    this.mono = isMono;

    panMerger.disconnect();
    monoSplitter.disconnect();
    monoMerger.disconnect();
    stereoMerger.disconnect();
    monoGain.disconnect();
    stereoGain.disconnect();

    const connectMono = () => {
      panMerger.connect(monoSplitter);
      monoSplitter.connect(monoMerger, 0, 0);
      monoSplitter.connect(monoMerger, 1, 0);
      monoMerger.connect(monoGain);
      monoGain.connect(twenty);
    };

    const connectStereo = () => {
      panMerger.connect(twenty);
    };

    if (isMono) {
      connectMono();
    } else {
      connectStereo();
    }
  }
  setInvert(isInverted) {
    const { leftInvertGainNode } = this;
    const { gain } = leftInvertGainNode;

    if (isInverted) {
      gain.value = -1;
    } else {
      gain.value = 1;
    }

    this.invert = isInverted;
  }

  stopAudio() {
    const { streamOutput, audioCtx } = this;

    try {
      streamOutput.disconnect();
      this.volumeGainNode?.disconnect();
      this.compressor?.disconnect();
      Object.values(this.eq || {}).forEach((band) => band.disconnect?.());
    } catch (error) {
      handleError('stopAudio: failed to disconnect audio nodes', error);
    }

    const audioTracks = streamOutput.mediaStream?.getAudioTracks() || [];
    audioTracks.forEach((track) => track.stop());

    audioCtx.close();
    return true;
  }
  async resetSettings() {
    const { compressor, eq, volumeGainNode } = this;

    const defaultSettingsObj = await fetchDefaultSettings();
    const defaultCompEntries = Object.entries(defaultSettingsObj.compressor);
    const defaultEqEntries = Object.entries(defaultSettingsObj.eq);

    defaultCompEntries.forEach(([key, value]) => {
      compressor[key].value = value;
    });

    defaultEqEntries.forEach(([key, value]) => {
      eq[key].gain.value = value;
    });

    this.setPan(0);

    this.setMono(false);

    this.setInvert(false);

    volumeGainNode.gain.value = 1;
  }

  setPan(panValue) {
    const clampedPan = Math.max(-1, Math.min(1, Number(panValue)));
    this.pan = clampedPan;

    const { leftPanGain, rightPanGain, audioCtx } = this;
    const { currentTime } = audioCtx;

    const leftGain = leftPanGain.gain;
    const rightGain = rightPanGain.gain;

    const change = (state) => {
      if (state) {
        leftGain.setValueAtTime(1 - clampedPan, currentTime);
        rightGain.setValueAtTime(1, currentTime);
      } else {
        leftGain.setValueAtTime(1, currentTime);
        rightGain.setValueAtTime(1 + clampedPan, currentTime);
      }
    };

    if (clampedPan > 0) {
      change(true);
    } else {
      change(false);
    }
  }
  async saveSettings() {
    const { eq, compressor, mono, pan, volumeGainNode, invert } = this;
    const settingsPayload = {
      compressor: {},
      eq: {},
    };

    const defaultSettings = await fetchDefaultSettings();
    const compressorKeys = Object.keys(defaultSettings.compressor);
    const eqKeys = Object.keys(defaultSettings.eq);

    settingsPayload.mono = mono;
    settingsPayload.invert = invert;
    settingsPayload.pan = pan;
    settingsPayload.volume = volumeGainNode.gain.value;

    compressorKeys.forEach((key) => {
      settingsPayload.compressor[key] = compressor[key].value;
    });
    eqKeys.forEach((key) => {
      settingsPayload.eq[key] = eq[key].gain.value;
    });

    chrome.runtime.sendMessage({
      target: 'worker',
      type: 'saveToStorage',
      data: settingsPayload,
    });
  }
  loadSettings(audioSettings) {
    const safeSettings = isPlainObject(audioSettings) ? audioSettings : {};
    const { compressor, eq, pan, mono, volume, invert } = safeSettings;

    if (isPlainObject(compressor)) {
      const compressorKeys = Object.keys(compressor);
      compressorKeys.forEach((key) => {
        this.compressor[key].value = compressor[key];
      });
    }

    if (isPlainObject(eq)) {
      const eqKeys = Object.keys(eq);
      eqKeys.forEach((key) => {
        this.eq[key].gain.value = eq[key];
      });
    }

    if (pan != null) {
      this.pan = pan;
      this.setPan(pan);
    }

    if (mono != null) {
      this.mono = mono;
      this.setMono(mono);
    }

    if (invert != null) {
      this.invert = invert;
      this.setInvert(invert);
    }

    if (volume != null) {
      this.volumeGainNode.gain.value = volume;
    }
  }
  async getSettings() {
    const { volumeGainNode, eq, compressor, mono, pan, invert } = this;

    const defaultSettings = await fetchDefaultSettings();
    const compressorKeys = Object.keys(defaultSettings.compressor);
    const eqBandKeys = Object.keys(defaultSettings.eq);

    const currentSettings = {};

    currentSettings.mono = mono;
    currentSettings.invert = invert;
    currentSettings.pan = pan;
    currentSettings.volume = volumeGainNode.gain.value;

    currentSettings.compressor = {};
    compressorKeys.forEach((key) => {
      currentSettings.compressor[key] = compressor[key].value;
    });

    currentSettings.eq = {};
    eqBandKeys.forEach((key) => {
      currentSettings.eq[key] = eq[key].gain.value;
    });

    return currentSettings;
  }
}
