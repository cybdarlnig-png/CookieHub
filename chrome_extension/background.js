const XUNLEI_URL_FILTER = [
  "https://*.xunlei.com/*",
  "http://*.xunlei.com/*"
];
const attachedTabs = new Map();
const requestUrls = new Map();

function isXunleiUrl(url) {
  try {
    return /(^|\\.)xunlei\\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function findAuthorization(headers) {
  if (!headers || typeof headers !== "object") return null;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === "authorization" && value) return String(value);
  }
  return null;
}

async function detach(tabId) {
  if (!attachedTabs.has(tabId)) return;
  attachedTabs.delete(tabId);
  for (const key of requestUrls.keys()) {
    if (key.startsWith(`${tabId}:`)) requestUrls.delete(key);
  }
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // 标签页关闭或调试器已断开时无需继续处理。
  }
}

async function startCapture(tabId) {
  await detach(tabId);
  await chrome.storage.session.remove("xunleiAuthorization");
  await chrome.debugger.attach({ tabId }, "1.3");
  attachedTabs.set(tabId, true);
  await chrome.debugger.sendCommand({ tabId }, "Network.enable");
  return { ok: true };
}

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const tabId = source.tabId;
  if (!tabId || !attachedTabs.has(tabId)) return;
  if (method !== "Network.requestWillBeSentExtraInfo" && method !== "Network.requestWillBeSent") return;

  if (method === "Network.requestWillBeSent" && params.requestId && params.request?.url) {
    requestUrls.set(`${tabId}:${params.requestId}`, params.request.url);
  }
  const url = method === "Network.requestWillBeSentExtraInfo"
    ? requestUrls.get(`${tabId}:${params.requestId}`)
    : params.request?.url;
  if (!url || !isXunleiUrl(url)) return;

  const headers = method === "Network.requestWillBeSentExtraInfo"
    ? params.headers
    : params.request?.headers;
  const authorization = findAuthorization(headers);
  if (!authorization) return;

  await chrome.storage.session.set({
    xunleiAuthorization: {
      value: authorization,
      url,
      capturedAt: new Date().toISOString()
    }
  });
  await detach(tabId);
});

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
  for (const key of requestUrls.keys()) {
    if (key.startsWith(`${tabId}:`)) requestUrls.delete(key);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "startXunleiCapture") {
    startCapture(message.tabId)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "getXunleiAuthorization") {
    chrome.storage.session.get("xunleiAuthorization")
      .then((result) => sendResponse(result.xunleiAuthorization || null));
    return true;
  }
  return false;
});
