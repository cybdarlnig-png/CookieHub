const CAPTURE_TIMEOUT_MS = 30000;
const attachedTabs = new Set();
const requestUrls = new Map();
const captureTimers = new Map();

function isXunleiUrl(url) {
  try {
    return /(^|\.)xunlei\.com$/i.test(new URL(url).hostname);
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

function clearTabState(tabId) {
  const timer = captureTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    captureTimers.delete(tabId);
  }
  for (const key of requestUrls.keys()) {
    if (key.startsWith(`${tabId}:`)) requestUrls.delete(key);
  }
}

async function detach(tabId) {
  clearTabState(tabId);
  if (!attachedTabs.has(tabId)) return;
  attachedTabs.delete(tabId);
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // 标签页关闭或调试器已断开时无需继续处理。
  }
}

async function startCapture(tabId) {
  if (!Number.isInteger(tabId)) throw new Error("无效的迅雷标签页。");
  await detach(tabId);
  await chrome.storage.session.remove("xunleiAuthorization");
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
  } catch (error) {
    const message = error?.message || String(error);
    if (/another debugger|debugger is already attached/i.test(message)) {
      throw new Error("当前标签页已被其他扩展的调试器占用。");
    }
    if (/cannot attach|cannot access/i.test(message)) {
      throw new Error("无法附加调试器，请确认当前标签页是迅雷云盘等普通网页。");
    }
    throw error;
  }
  attachedTabs.add(tabId);
  captureTimers.set(
    tabId,
    setTimeout(() => {
      detach(tabId);
    }, CAPTURE_TIMEOUT_MS)
  );
  try {
    await chrome.debugger.sendCommand({ tabId }, "Network.enable");
  } catch (error) {
    await detach(tabId);
    throw error;
  }
  return { ok: true };
}

async function handleAuthorization(tabId, value, url) {
  if (!attachedTabs.has(tabId)) return;
  const authorization = {
    value,
    url,
    capturedAt: new Date().toISOString()
  };
  await chrome.storage.session.set({ xunleiAuthorization: authorization });
  await detach(tabId);
  try {
    await chrome.runtime.sendMessage({ type: "xunleiAuthorizationCaptured", authorization });
  } catch {
    // 弹窗已关闭时没有接收方，结果仍保存在会话存储中。
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
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

  handleAuthorization(tabId, authorization, url).catch(() => {});
});

chrome.debugger.onDetach.addListener((source) => {
  if (!source.tabId) return;
  clearTabState(source.tabId);
  attachedTabs.delete(source.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId);
  attachedTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "startXunleiCapture") {
    startCapture(message.tabId)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }
  if (message?.type === "cancelXunleiCapture") {
    detach(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message?.type === "getXunleiAuthorization") {
    chrome.storage.session
      .get("xunleiAuthorization")
      .then((result) => sendResponse(result.xunleiAuthorization || null))
      .catch(() => sendResponse(null));
    return true;
  }
  return false;
});
