chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { target } = message;

  if (target !== 'offscreen') return;

  console.log(message);

  const { value, type, tabId } = message;

  const index = tabId && getCapturedTabIndex(tabId);

  switch (type) {
    case 'captureTab':
      captureTab(message.streamId, tabId);
      break;

    case 'loadCapturedTab':
      loadCapturedTab(index, tabId);
      break;

    case 'powerOff':
      powerOff(index);
      sendResponse({ success: true });
      break;

    case 'reset':
      capturedTabsArr[index].resetSettings().then(() => {
        loadCapturedTab(index, tabId);
      });
      break;

    case 'deleteSavedSettings':
      sendMessage({
        target: 'worker',
        type: 'deleteSavedSettings',
      });
      break;

    case 'loadSavedSettings':
      loadSavedSettings(index, tabId);
      break;

    case 'loadPreset':
      loadPreset(index, tabId, message.preset);
      break;

    case 'saveSettings':
      capturedTabsArr[index].saveSettings();
      break;

    case 'volume':
      capturedTabsArr[index].volumeGainNode.gain.value = message.value;
      break;

    case 'getVolume':
      sendResponse(capturedTabsArr[index].volumeGainNode.gain.value);
      break;

    case 'threshold':
      capturedTabsArr[index].compressor.threshold.value = message.value;
      break;

    case 'attack':
      capturedTabsArr[index].compressor.attack.value = message.value;
      break;

    case 'release':
      capturedTabsArr[index].compressor.release.value = message.value;
      break;

    case 'ratio':
      capturedTabsArr[index].compressor.ratio.value = message.value;
      break;

    case 'knee':
      capturedTabsArr[index].compressor.knee.value = message.value;
      break;

    case 'twenty':
      capturedTabsArr[index].eq.twenty.gain.value = message.value;
      break;

    case 'fifty':
      capturedTabsArr[index].eq.fifty.gain.value = message.value;
      break;

    case 'oneHundred':
      capturedTabsArr[index].eq.oneHundred.gain.value = message.value;
      break;

    case 'twoHundred':
      capturedTabsArr[index].eq.twoHundred.gain.value = message.value;
      break;

    case 'fiveHundred':
      capturedTabsArr[index].eq.fiveHundred.gain.value = message.value;
      break;

    case 'oneThousand':
      capturedTabsArr[index].eq.oneThousand.gain.value = message.value;
      break;

    case 'twoThousand':
      capturedTabsArr[index].eq.twoThousand.gain.value = message.value;
      break;

    case 'fiveThousand':
      capturedTabsArr[index].eq.fiveThousand.gain.value = message.value;
      break;

    case 'tenThousand':
      capturedTabsArr[index].eq.tenThousand.gain.value = message.value;
      break;

    case 'twentyThousand':
      capturedTabsArr[index].eq.twentyThousand.gain.value = message.value;
      break;

    case 'pan':
      capturedTabsArr[index].setPan(value);
      break;

    case 'getPan':
      sendResponse(capturedTabsArr[index].pan);
      break;

    case 'setMono':
      capturedTabsArr[index].setMono(value);
      sendResponse(true);
      break;

    case 'getMono':
      sendResponse(capturedTabsArr[index].mono);
      break;

    case 'setInvert':
      capturedTabsArr[index].setInvert(value);
      sendResponse(true);
      break;

    case 'getInvert':
      sendResponse(capturedTabsArr[index].invert);
      break;

    case 'tabRemoved':
      if (index !== -1) {
        capturedTabsArr[index].stopAudio();
      }
      sendResponse(true);
      break;

    case 'getIndex':
      sendResponse(index);
      return true;

    case 'saveWindowState':
      capturedTabsArr[index].windowState = message.state;
      break;

    case 'getSavedWindowState':
      sendResponse({
        state: capturedTabsArr[index].windowState,
      });
      break;
  }
});

//

const { sendMessage } = chrome.runtime;

const capturedTabsArr = [];

async function getDefaultStorageObject() {
  return await sendMessage({
    target: 'worker',
    type: 'getDefaultSettings',
  });
}

async function getSavedStorageObject() {
  return await sendMessage({
    target: 'worker',
    type: 'getSavedSettings',
  });
}

function handleError(message = 'An error occurred', error = null) {
  console.error(error);
}

async function getUserMedia(streamId) {
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
    const stream = await getUserMedia(streamId);
    return stream;
  } catch (error) {
    utils.handleError('Error getting audio stream: ' + error.message);
  }
}

async function sendAudioSettingsToPopup(settings, tabId) {
  sendMessage({
    target: 'popup',
    type: 'load',
    settings,
    tabId,
  });
}

async function loadSavedSettings(index, tabId) {
  const { settings } = await getSavedStorageObject();
  capturedTabsArr[index].loadSettings(settings);
  sendAudioSettingsToPopup(settings, tabId);
}

async function captureTab(streamId, tabId) {
  const { settings } = await getSavedStorageObject();
  const audioStream = await getStream(streamId);

  capturedTabsArr[capturedTabsArr.length] = new CapturedAudioObject({
    tabId,
    stream: audioStream,
    settings,
  });

  sendAudioSettingsToPopup(settings, tabId);
}

async function loadCapturedTab(index, tabId) {
  const settings = await capturedTabsArr[index].getSettings();
  sendAudioSettingsToPopup(settings, tabId);
}

async function loadPreset(index, tabId, preset) {
  const eqSettings = { eq: preset };
  capturedTabsArr[index].loadSettings(eqSettings);
  sendAudioSettingsToPopup(eqSettings, tabId);
}

function powerOff(index) {
  capturedTabsArr[index].stopAudio();
  capturedTabsArr.splice(index, 1);
}

function getCapturedTabIndex(id) {
  return capturedTabsArr.findIndex(({ tabId }) => tabId === id);
}

class CapturedAudioObject {
  constructor({ tabId, stream, settings }) {
    this.tabId = tabId;
    this.audioCtx = new AudioContext({ latencyHint: 'interactive' });
    this.setupAudioNodes(stream, settings);
  }
  setupAudioNodes(stream, settings) {
    this.streamOutput = this.createMediaStreamSource(stream);
    this.setupVolume(settings.volume);
    this.setupPan(settings.pan);
    this.setupMono(settings.mono);
    this.setupInvert(settings.invert);
    this.setupCompressor(settings.compressor);
    this.setupEqualizer(settings.eq);
    this.connectAudioNodes();
  }
  createMediaStreamSource(stream) {
    return this.audioCtx.createMediaStreamSource(stream);
  }
  setupVolume(volume) {
    this.volumeGainNode = this.audioCtx.createGain();
    this.leftInvertGainNode = this.audioCtx.createGain();
    this.rightInvertGainNode = this.audioCtx.createGain();

    this.invertSplitter = this.audioCtx.createChannelSplitter(2);
    this.invertMerger = this.audioCtx.createChannelMerger(2);
    this.volumeGainNode.gain.value = volume;
  }
  setupPan(pan) {
    this.pan = pan;
    this.panSplitter = this.audioCtx.createChannelSplitter(2);
    this.leftPanGain = this.audioCtx.createGain();
    this.rightPanGain = this.audioCtx.createGain();
    this.panMerger = this.audioCtx.createChannelMerger(2);
  }
  setupMono(mono) {
    this.mono = mono;
    this.monoSplitter = this.audioCtx.createChannelSplitter(2);
    this.monoGain = this.audioCtx.createGain();
    this.stereoGain = this.audioCtx.createGain();
    this.monoMerger = this.audioCtx.createChannelMerger(1);
    this.stereoMerger = this.audioCtx.createChannelMerger(2);
    this.monoGain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    this.stereoGain.gain.setValueAtTime(1, this.audioCtx.currentTime);
  }
  setupInvert(invert) {
    this.invert = invert;
  }
  setupCompressor(compressorSettings) {
    this.compressor = this.audioCtx.createDynamicsCompressor();

    Object.entries(compressorSettings).forEach(([key, value]) => {
      this.compressor[key].setValueAtTime(value, this.audioCtx.currentTime);
    });

    this.compressor.attack.value = Number(
      this.compressor.attack.value.toFixed(1)
    );
  }
  setupEqualizer(eq) {
    const eqStructureObj = {
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

    Object.entries(eq).forEach(([key, value]) => {
      this.eq[key] = this.audioCtx.createBiquadFilter();

      const currentFreq = this.eq[key];
      const { currentTime } = this.audioCtx;
      const { type, frequency } = eqStructureObj[key];

      currentFreq.gain.value = value;
      currentFreq.type = type;
      currentFreq.frequency.setValueAtTime(frequency, currentTime);

      if (!key.includes('twenty')) {
        currentFreq.Q.setValueAtTime(5, currentTime);
      }
    });
  }
  connectAudioNodes() {
    const { audioCtx, streamOutput } = this;

    const {
      panMerger,
      panSplitter,
      leftPanGain,
      rightPanGain,
      leftInvertGainNode,
      rightInvertGainNode,
      invertMerger,
      invertSplitter,
    } = this;

    streamOutput.connect(invertSplitter);

    invertSplitter.connect(leftInvertGainNode, 0, 0);
    invertSplitter.connect(rightInvertGainNode, 1, 0);

    leftInvertGainNode.connect(invertMerger, 0, 0);
    rightInvertGainNode.connect(invertMerger, 0, 1);

    if (this.invert) {
      this.setInvert(true);
    }

    invertMerger.connect(panSplitter);
    panSplitter.connect(leftPanGain, 0);
    panSplitter.connect(rightPanGain, 1);
    leftPanGain.connect(panMerger, 0, 0);
    rightPanGain.connect(panMerger, 0, 1);

    this.setMono(this.mono);

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

    const { volumeGainNode } = this;

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
  setInvert(invert) {
    const { leftInvertGainNode } = this;
    const { gain } = leftInvertGainNode;

    if (invert) {
      gain.value = -1;
    } else {
      gain.value = 1;
    }

    this.invert = invert;
  }

  stopAudio() {
    const { streamOutput, audioCtx } = this;

    try {
      streamOutput.disconnect();
      this.volumeGainNode?.disconnect();
      this.compressor?.disconnect();
      Object.values(this.eq || {}).forEach((band) => band.disconnect?.());
    } catch (e) {
      console.warn('Disconnect error:', e);
    }

    const audioTracks = streamOutput.mediaStream.getAudioTracks();

    if (audioTracks.length > 0) {
      audioTracks[0].stop();
    }

    audioCtx.close();
    return true;
  }
  async resetSettings() {
    let { compressor, eq, volumeGainNode, mono, invert, pan } = this;

    const defaultSettingsObj = await getDefaultStorageObject();
    const defaultCompEntries = Object.entries(defaultSettingsObj.compressor);
    const defaultEqEntries = Object.entries(defaultSettingsObj.eq);

    defaultCompEntries.forEach(([key, value]) => {
      compressor[key].value = value;
    });

    defaultEqEntries.forEach(([key, value]) => {
      eq[key].gain.value = value;
    });

    pan = defaultSettingsObj.pan;
    this.setPan(0);

    mono = false;
    this.setMono(false);

    invert = false;
    this.setInvert(false);

    volumeGainNode.gain.value = 1;
  }

  setPan(val) {
    const clampedPan = Math.max(-1, Math.min(1, Number(val)));
    this.pan = clampedPan;

    const { leftPanGain, rightPanGain, audioCtx } = this;
    const { currentTime } = audioCtx;

    pan = clampedPan;

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

    if (val > 0) {
      change(true);
    } else {
      change(false);
    }
  }
  async saveSettings() {
    const { eq, compressor, mono, pan, volumeGainNode, invert } = this;
    const settingsObj = {
      compressor: {},
      eq: {},
    };

    const defaultSettingsObj = await getDefaultStorageObject();
    const compressorKeys = Object.keys(defaultSettingsObj.compressor);
    const eqKeys = Object.keys(defaultSettingsObj.eq);

    settingsObj.mono = mono;
    settingsObj.invert = invert;
    settingsObj.pan = pan;
    settingsObj.volume = volumeGainNode.gain.value;

    compressorKeys.forEach((key) => {
      settingsObj.compressor[key] = compressor[key].value;
    });
    eqKeys.forEach((key) => {
      settingsObj.eq[key] = eq[key].gain.value;
    });

    sendMessage({
      target: 'worker',
      type: 'saveToStorage',
      data: settingsObj,
    });
  }
  loadSettings(settings) {
    const { compressor, eq, pan, mono, volume, invert } = settings;

    if (compressor) {
      const compressorKeys = Object.keys(compressor);
      compressorKeys.forEach((key) => {
        this.compressor[key].value = compressor[key];
      });
    }

    if (eq) {
      const eqKeys = Object.keys(eq);
      eqKeys.forEach((key) => {
        this.eq[key].gain.value = eq[key];
      });
    }

    if (pan) {
      this.pan = pan;
      this.setPan(pan);
    }

    if (mono) {
      this.mono = mono;
      this.setMono(mono);
    }

    if (invert) {
      this.invert = invert;
      this.setInvert(invert);
    }

    if (volume) {
      this.volumeGainNode.gain.value = volume;
    }
  }
  async getSettings() {
    const { volumeGainNode, eq, compressor, mono, pan, invert } = this;

    const defaultSettingsObj = await getDefaultStorageObject();
    const compKeys = Object.keys(defaultSettingsObj.compressor);
    const eqKeys = Object.keys(defaultSettingsObj.eq);

    const currentSettingsObj = {};

    currentSettingsObj.mono = mono;
    currentSettingsObj.invert = invert;
    currentSettingsObj.pan = pan;
    currentSettingsObj.volume = volumeGainNode.gain.value;

    currentSettingsObj.compressor = {};
    compKeys.forEach((key) => {
      currentSettingsObj.compressor[key] = compressor[key].value;
    });

    currentSettingsObj.eq = {};
    eqKeys.forEach((key) => {
      currentSettingsObj.eq[key] = eq[key].gain.value;
    });

    return currentSettingsObj;
  }
}
