const SITES = [
  { name: "夸克网盘", url: "https://pan.quark.cn/" },
  { name: "百度网盘", url: "https://pan.baidu.com/" },
  { name: "UC网盘", url: "https://drive.uc.cn/" },
  { name: "迅雷云盘", url: "https://pan.xunlei.com/", isXunlei: true }
];

const LAST_RESULT_KEY = "lastResult";
const CAPTURE_TIMEOUT_MS = 25000;

const sitesElement = document.getElementById("sites");
const outputElement = document.getElementById("output");
const statusElement = document.getElementById("status");
const versionElement = document.getElementById("version");
let busy = false;

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = type;
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = value;
  });
}

function readableError(error) {
  const message = error?.message || String(error);
  if (/another debugger|debugger is already attached/i.test(message)) {
    return "当前迅雷标签页被其他扩展占用，请先停用占用调试器的扩展，然后在 chrome://extensions 重新加载 Cookie Hub。";
  }
  if (/receiving end does not exist|could not establish connection/i.test(message)) {
    return "扩展后台尚未更新，请到 chrome://extensions 点击 Cookie Hub 的“重新加载”后重试。";
  }
  if (/permission|not allowed|cannot access/i.test(message)) {
    return "当前扩展缺少所需权限，请到 chrome://extensions 移除后重新加载 chrome_extension 文件夹。";
  }
  if (/no tab with id/i.test(message)) {
    return "标签页已关闭，请重新进入目标网站后再试。";
  }
  return message;
}

function cookieHeader(cookies) {
  return [...cookies]
    .sort((left, right) => (right.path || "").length - (left.path || "").length || left.name.localeCompare(right.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 弹窗失去焦点时 Clipboard API 会被拒绝，回退到可用的旧接口。
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

function isXunleiUrl(url) {
  try {
    return /(^|\.)xunlei\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function getAuthorization() {
  try {
    return await chrome.runtime.sendMessage({ type: "getXunleiAuthorization" });
  } catch {
    return null;
  }
}

function waitForAuthorization(timeoutMs = CAPTURE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let done = false;
    let timer = 0;
    let pollTimer = 0;
    const finish = (authorization) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(pollTimer);
      chrome.runtime.onMessage.removeListener(onMessage);
      resolve(authorization || null);
    };
    const onMessage = (message) => {
      if (message?.type === "xunleiAuthorizationCaptured" && message.authorization?.value) {
        finish(message.authorization);
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    timer = setTimeout(() => finish(null), timeoutMs);
    pollTimer = setInterval(async () => {
      if (done) return;
      const authorization = await getAuthorization();
      if (authorization?.value) finish(authorization);
    }, 1000);
  });
}

async function startXunleiCapture(tabId) {
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({ type: "startXunleiCapture", tabId });
  } catch (error) {
    throw new Error(readableError(error));
  }
  if (!response?.ok) throw new Error(response?.error || "无法启动迅雷请求捕获");
}

async function cancelXunleiCapture(tabId) {
  try {
    await chrome.runtime.sendMessage({ type: "cancelXunleiCapture", tabId });
  } catch {
    // 弹窗关闭或后台已断开时无需处理。
  }
}

async function rememberResult(label, value) {
  outputElement.value = value;
  try {
    await chrome.storage.session.set({
      [LAST_RESULT_KEY]: { label, value, savedAt: new Date().toISOString() }
    });
  } catch {
    // 会话存储不可用时不影响本次获取结果。
  }
}

async function forgetResult() {
  outputElement.value = "";
  try {
    await chrome.storage.session.remove(LAST_RESULT_KEY);
  } catch {
    // 忽略会话存储清理失败。
  }
}

async function getCookiesForTab(tab, label, cookieUrl = tab.url) {
  setStatus(`正在获取 ${label}…`);
  const cookies = await chrome.cookies.getAll({ url: cookieUrl });
  const cookieValue = cookieHeader(cookies);
  if (!cookieValue) {
    await forgetResult();
    setStatus(`${label} 没有读取到 Cookie，请先在 Chrome 中登录该网站。`, "error");
    return;
  }
  await rememberResult(label, cookieValue);
  const copied = await copyText(cookieValue);
  if (copied) {
    setStatus(`已获取 ${cookies.length} 个 Cookie，并复制到剪贴板。`, "success");
  } else {
    setStatus(`已获取 ${cookies.length} 个 Cookie；自动复制失败，请点击“复制结果”。`, "error");
  }
}

async function getAuthorizationForTab(tab) {
  if (!isXunleiUrl(tab.url || "")) {
    setStatus("请先进入迅雷云盘，再点击“获取 Authorization”。", "error");
    return;
  }
  setStatus("正在刷新迅雷页面并捕获 Authorization，请稍候…");
  await startXunleiCapture(tab.id);
  const waiting = waitForAuthorization();
  try {
    await chrome.tabs.reload(tab.id);
  } catch (error) {
    await cancelXunleiCapture(tab.id);
    throw error;
  }
  const authorization = await waiting;
  if (!authorization?.value) {
    await cancelXunleiCapture(tab.id);
    setStatus("25 秒内未捕获到 Authorization，请确认已登录迅雷云盘、当前标签页未被关闭后重试。", "error");
    return;
  }
  const result = `Authorization: ${authorization.value}`;
  await rememberResult("迅雷 Authorization", result);
  const copied = await copyText(result);
  if (copied) {
    setStatus("已获取 Authorization，并复制到剪贴板。", "success");
  } else {
    setStatus("已获取 Authorization；自动复制失败，请点击“复制结果”。", "error");
  }
}

async function getSiteTab(site) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("找不到当前标签页。");
  }
  const siteHost = new URL(site.url).hostname;
  const currentHost = tab.url ? new URL(tab.url).hostname : "";
  if (currentHost !== siteHost && !currentHost.endsWith(`.${siteHost}`)) {
    await chrome.tabs.update(tab.id, { url: site.url });
    setStatus(`已打开 ${site.name}，登录后再点击获取按钮。`);
    return null;
  }
  return tab;
}

async function runTask(task) {
  if (busy) return;
  setBusy(true);
  try {
    await task();
  } catch (error) {
    setStatus(`操作失败：${readableError(error)}`, "error");
  } finally {
    setBusy(false);
  }
}

function getCookiesForSite(site) {
  return runTask(async () => {
    const tab = await getSiteTab(site);
    if (tab) await getCookiesForTab(tab, site.name, site.url);
  });
}

function getAuthorizationForSite(site) {
  return runTask(async () => {
    const tab = await getSiteTab(site);
    if (tab) await getAuthorizationForTab(tab);
  });
}

function renderSites() {
  sitesElement.replaceChildren();
  SITES.forEach((site) => {
    const row = document.createElement("div");
    row.className = "site";
    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "site-name";
    name.textContent = site.name;
    const url = document.createElement("div");
    url.className = "site-url";
    url.textContent = new URL(site.url).hostname;
    info.append(name, url);

    const openButton = document.createElement("button");
    openButton.className = "open";
    openButton.textContent = "进入网站";
    openButton.addEventListener("click", () => chrome.tabs.create({ url: site.url }));

    const cookieButton = document.createElement("button");
    cookieButton.className = "get";
    cookieButton.textContent = site.isXunlei ? "获取 Cookie" : "一键获取";
    cookieButton.addEventListener("click", () => getCookiesForSite(site));

    row.append(info, openButton, cookieButton);
    if (site.isXunlei) {
      row.classList.add("xunlei");
      const authorizationButton = document.createElement("button");
      authorizationButton.className = "get-auth";
      authorizationButton.textContent = "获取 Authorization";
      authorizationButton.addEventListener("click", () => getAuthorizationForSite(site));
      row.append(authorizationButton);
    }
    sitesElement.append(row);
  });
}

document.getElementById("current").addEventListener("click", () => {
  runTask(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
      setStatus("当前标签页不是普通网站页面。", "error");
      return;
    }
    await getCookiesForTab(tab, new URL(tab.url).hostname, tab.url);
  });
});

document.getElementById("copy").addEventListener("click", () => {
  runTask(async () => {
    const value = outputElement.value.trim();
    if (!value) {
      setStatus("当前没有可复制的结果。", "error");
      return;
    }
    const copied = await copyText(value);
    setStatus(copied ? "结果已复制到剪贴板。" : "复制失败，请手动选中文本复制。", copied ? "success" : "error");
  });
});

function timestampForFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

document.getElementById("save").addEventListener("click", () => {
  runTask(async () => {
    const value = outputElement.value.trim();
    if (!value) {
      setStatus("当前没有可保存的结果。", "error");
      return;
    }
    const prefix = value.startsWith("Authorization:") ? "authorization" : "cookie";
    const filename = `${prefix}-${timestampForFilename()}.txt`;
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({ url, filename, saveAs: false });
    } catch {
      // downloads 权限不可用时回退到页面内下载，并延迟释放 Blob。
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    setStatus(`已保存 ${filename}，文件位于浏览器下载目录。`, "success");
  });
});

document.getElementById("clear").addEventListener("click", () => {
  runTask(async () => {
    await forgetResult();
    setStatus("结果已清空。");
  });
});

document.getElementById("uninstall").addEventListener("click", () => {
  chrome.management.uninstallSelf({ showConfirmDialog: true }).catch((error) => {
    setStatus(`卸载未完成：${readableError(error)}`, "error");
  });
});

async function restoreLastResult() {
  try {
    const stored = await chrome.storage.session.get(LAST_RESULT_KEY);
    const last = stored?.[LAST_RESULT_KEY];
    if (!last?.value) return;
    outputElement.value = last.value;
    setStatus(`已恢复上次获取的${last.label || "结果"}（仅本次浏览器会话保留）。`);
  } catch {
    // 会话存储不可用时保持空白界面。
  }
}

function showVersion() {
  try {
    versionElement.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    versionElement.textContent = "";
  }
}

showVersion();
renderSites();
restoreLastResult();
