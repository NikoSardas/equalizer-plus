chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { target, type } = message;

  if (target !== 'worker') return;

  switch (type) {
    case 'popupReady':
      const { tabId } = message;
      onPopupReady(tabId);
      break;

    case 'getSavedSettings':
      getSavedSettings().then((response) => {
        sendResponse(response);
      });
      return true;

    case 'getDefaultSettings':
      sendResponse(getDefaultSettings());
      break;

    case 'deleteSavedSettings':
      setDefaultSettings();
      setSavedState(false);
      break;

    case 'saveToStorage':
      saveSettings(message.data);
      setSavedState(true);
      break;

    default:
      handleError('Unknown message type:', type);
      break;
  }
});

//

async function onPopupReady(tabId) {
  await verifyOffscreenDoc();

  const index = await getCapturedTabArrayIndex(tabId);
  const tabIsCaptured = index !== -1;

  sendMessage({
    target: 'offscreen',
    type: tabIsCaptured ? 'loadCapturedTab' : 'captureTab',
    index: tabIsCaptured && index,
    streamId: !tabIsCaptured && (await getStreamId(tabId)),
    tabId,
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  sendMessage({
    target: 'offscreen',
    type: 'tabRemoved',
    tabId,
  }),
    (response) => {
      return true;
    };
});

chrome.tabCapture.onStatusChanged.addListener(
  async ({ status, fullscreen, tabId }) => {
    if (status === 'active') {
      const tabIsCaptured = (await getCapturedTabArrayIndex(tabId)) > -1;
      if (tabIsCaptured) {
        toggleFullscreen({ fullscreen, tabId });
      }
    }
  }
);

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason === 'chrome_update') return;

  await verifyOffscreenDoc();

  if (reason === 'update') {
    onUpdated(previousVersion);
  } else if (reason === 'install') {
    onInstalled();
  }
});

const { sendMessage } = chrome.runtime;

async function setSavedState(state) {
  await chrome.storage.sync.set({
    saved: state,
  });
}

async function getSavedSettings() {
  return await chrome.storage.sync.get();
}

async function saveSettings(settingsObject) {
  await chrome.storage.sync.set({
    settings: settingsObject,
  });
}

function getDefaultSettings() {
  return {
    compressor: {
      threshold: 0,
      attack: 0,
      release: 0.2,
      ratio: 10,
      knee: 4,
    },
    eq: {
      twenty: 0,
      fifty: 0,
      oneHundred: 0,
      twoHundred: 0,
      fiveHundred: 0,
      oneThousand: 0,
      twoThousand: 0,
      fiveThousand: 0,
      tenThousand: 0,
      twentyThousand: 0,
    },
    mono: false,
    invert: false,
    pan: 0,
    volume: 1,
  };
}

async function setDefaultSettings() {
  await chrome.storage.sync.set({
    settings: getDefaultSettings(),
  });
}

async function setCollapsedState(state) {
  await chrome.storage.sync.set({
    collapsed: state,
  });
}

async function getStreamId(tabId) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    if (streamId && typeof streamId === 'string') {
      return streamId;
    } else {
      handleError('Invalid streamId:', streamId);
      return false;
    }
  } catch (error) {
    handleError('Error in getStreamId:', error);
  }
}

async function verifyOffscreenDoc() {
  const allContexts = await chrome.runtime.getContexts({});

  const offscreenDocument = allContexts.find(
    (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
  );

  if (!offscreenDocument) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording from chrome.tabCapture API',
    });
  }
}

async function enterFullscreen() {
  const { id } = await chrome.windows.getCurrent();
  chrome.windows.update(id, { state: 'fullscreen' });
}

async function exitFullscreen({ state }) {
  const { id } = await chrome.windows.getCurrent();
  chrome.windows.update(id, state);
}

async function getSavedWindowState({ state, tabId }) {
  try {
    return await sendMessage({
      target: 'offscreen',
      type: 'getSavedWindowState',
      state,
      tabId,
    });
  } catch (error) {
    handleError('Error getting saved window state', error);
    return state;
  }
}

async function saveWindowState({ state, tabId }) {
  await sendMessage({
    target: 'offscreen',
    type: 'saveWindowState',
    state,
    tabId,
  });
}

async function toggleFullscreen({ fullscreen, tabId }) {
  const { state } = await chrome.windows.getCurrent();

  if (fullscreen) {
    await saveWindowState({ state, tabId });
    enterFullscreen();
  } else {
    const savedWindowState = await getSavedWindowState({
      state,
      tabId,
    });
    exitFullscreen({ state: savedWindowState });
  }
}

function handleError(message = 'An error occurred', error = null) {
  showNotification(error);
}

function showNotification(notification) {
  const { message } = notification;

  if (typeof message !== 'string') {
    handleError('Invalid notification message:', notification);
    return;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../assets/images/on.png',
    title: 'Equalizer Plus',
    message: message,
    priority: 1,
  });
}

async function onInstalled() {
  showInstallNotification();
  setInitState();
}

async function onUpdated(previousVersion) {
  if (previousVersion !== '1.2.3') return;

  showUpdateNotification();

  chrome.storage.sync.clear(() => {
    setInitState();
  });
}

function showInstallNotification() {
  showNotification({
    message:
      'This extension does not collect any user data and is completely free of any malicious code.',
  });
}

function showUpdateNotification() {
  chrome.windows.create({
    url: 'https://nikosardas.github.io/eqPlus-pages/V3-Update.html',
  });
}

function setInitState() {
  setDefaultSettings();
  setSavedState(false);
  setCollapsedState(true);
}

async function getCapturedTabArrayIndex(tabId) {
  return await sendMessage({
    target: 'offscreen',
    type: 'getIndex',
    tabId,
  });
}
