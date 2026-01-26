chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  return handleWorkerMessage(message, sender, sendResponse);
});

function handleWorkerMessage(message, sender, sendResponse) {
  const { target, type, tabId, data } = message;

  if (target !== 'worker') return;

  switch (type) {
    case 'popupReady':
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
      saveSettings(data);
      setSavedState(true);
      break;

    default:
      handleError('Unknown message type:', type);
      break;
  }
}

async function onPopupReady(tabId) {
  await verifyOffscreenDoc();

  const capturedTabIndex = await getCapturedTabIndex(tabId);
  const tabIsCaptured = capturedTabIndex !== -1;

  chrome.runtime.sendMessage({
    target: 'offscreen',
    type: tabIsCaptured ? 'loadCapturedTab' : 'captureTab',
    streamId: !tabIsCaptured && (await getStreamId(tabId)),
    tabId,
  });
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'tabRemoved',
      tabId,
    });
  } catch (err) {
    handleError('tabRemoved sendMessage failed', err);
  }
});

chrome.tabCapture.onStatusChanged.addListener(
  async ({ status, fullscreen, tabId }) => {
    if (status !== 'active') {
      return;
    }

    const isCaptured = (await getCapturedTabIndex(tabId)) > -1;
    if (isCaptured) {
      toggleFullscreen({ fullscreen, tabId });
    }
  },
);

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason === 'chrome_update') {
    return;
  }

  await verifyOffscreenDoc();

  if (reason === 'update') {
    onUpdated(previousVersion);
  } else if (reason === 'install') {
    onInstalled();
  }
});

async function setSavedState(isSaved) {
  await chrome.storage.sync.set({
    saved: isSaved,
  });
}

async function getSavedSettings() {
  return await chrome.storage.sync.get();
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({
    settings,
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

async function setCollapsedState(isCollapsed) {
  await chrome.storage.sync.set({
    collapsed: isCollapsed,
  });
}

async function getStreamId(tabId) {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    if (streamId && typeof streamId === 'string') {
      return streamId;
    }
    handleError('Invalid streamId:', streamId);
  } catch (error) {
    handleError('Error in getStreamId:', error);
  }
}

async function verifyOffscreenDoc() {
  const contexts = await chrome.runtime.getContexts({});

  const offscreenDocument = contexts.find(
    (c) => c.contextType === 'OFFSCREEN_DOCUMENT',
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

async function exitFullscreen({ windowState }) {
  const { id } = await chrome.windows.getCurrent();
  chrome.windows.update(id, { state: windowState });
}

async function getSavedWindowState({ windowState, tabId }) {
  try {
    return await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'getSavedWindowState',
      state: windowState,
      tabId,
    });
  } catch (error) {
    handleError('Error getting saved window state', error);
  }
}

async function saveWindowState({ windowState, tabId }) {
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'saveWindowState',
    state: windowState,
    tabId,
  });
}

async function toggleFullscreen({ fullscreen, tabId }) {
  const { state } = await chrome.windows.getCurrent();

  if (fullscreen) {
    await saveWindowState({ windowState: state, tabId });
    enterFullscreen();
  } else {
    const savedWindowState = await getSavedWindowState({
      windowState: state,
      tabId,
    });
    exitFullscreen({ windowState: savedWindowState });
  }
}

function handleError(message = 'An error occurred', error = null) {
  const notifyMessage =
    (error && error.message) ||
    (typeof message === 'string' ? message : String(message));
  try {
    showNotification({ message: notifyMessage });
  } catch (e) {}

  if (error instanceof Error) {
    throw error;
  }

  throw new Error(notifyMessage);
}

function showNotification(notificationPayload) {
  const message =
    typeof notificationPayload === 'string'
      ? notificationPayload
      : notificationPayload && notificationPayload.message;

  if (typeof message !== 'string') {
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
  initializeStorage();
}

async function onUpdated(previousVersion) {
  if (previousVersion !== '1.2.3') return;

  showUpdateNotification();

  chrome.storage.sync.clear(() => {
    initializeStorage();
  });
}

function showInstallNotification() {
  showNotification({
    message:
      'This extension does not collect any user data and is completely free of any malicious code.',
  });
}

const UPDATE_PAGE_URL = 'https://nikosardas.github.io/eqPlus-pages/V3-Update.html';

function showUpdateNotification() {
  chrome.windows.create({
    url: UPDATE_PAGE_URL,
  });
}

function initializeStorage() {
  setDefaultSettings();
  setSavedState(false);
  setCollapsedState(true);
}

async function getCapturedTabIndex(tabId) {
  return await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'getIndex',
    tabId,
  });
}
