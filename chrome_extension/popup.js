const SITES = [
  { name: "夸克网盘", url: "https://pan.quark.cn/" },
  { name: "百度网盘", url: "https://pan.baidu.com/" },
  { name: "UC网盘", url: "https://drive.uc.cn/" },
  { name: "迅雷云盘", url: "https://pan.xunlei.com/", needsAuthorization: true }
];

const sitesElement = document.getElementById("sites");
const outputElement = document.getElementById("output");
const statusElement = document.getElementById("status");

function setStatus(message, type = "") {
  statusElement.textContent = message;
  statusElement.className = type;
}

function cookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function isXunleiUrl(url) {
  try {
    return /(^|\\.)xunlei\\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function getAuthorization() {
  return chrome.runtime.sendMessage({ type: "getXunleiAuthorization" });
}

async function waitForAuthorization(attempts = 12, interval = 500) {
  for (let index = 0; index < attempts; index += 1) {
    const authorization = await getAuthorization();
    if (authorization?.value) return authorization;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return null;
}

async function prepareXunleiCapture(tabId) {
  const response = await chrome.runtime.sendMessage({ type: "startXunleiCapture", tabId });
  if (!response?.ok) throw new Error(response?.error || "无法启动迅雷请求捕获");
  await chrome.tabs.reload(tabId);
}

async function getCookiesForTab(tab, label, needsAuthorization = false) {
  setStatus(`正在获取 ${label}…`);
  const url = tab.url;
  const cookies = await chrome.cookies.getAll({ url });
  const cookieValue = cookieHeader(cookies);
  let result = cookieValue;

  if (needsAuthorization) {
    if (!isXunleiUrl(url)) throw new Error("请先打开 pan.xunlei.com 迅雷云盘页面");
    setStatus("正在刷新迅雷页面并捕获 Authorization…");
    await prepareXunleiCapture(tab.id);
    const authorization = await waitForAuthorization();
    if (!authorization?.value) {
      outputElement.value = cookieValue;
      setStatus("未捕获到 Authorization，请确认已登录迅雷云盘后再点一次。", "error");
      return;
    }
    result = `Cookie: ${cookieValue}\nAuthorization: ${authorization.value}`;
  }

  outputElement.value = result;
  if (!cookieValue) {
    setStatus(`${label} 没有读取到 Cookie，请先登录。`, "error");
    return;
  }
  await copyText(result);
  const suffix = needsAuthorization ? " Cookie 和 Authorization" : " Cookie";
  setStatus(`已获取 ${cookies.length} 个${suffix}，并复制到剪贴板。`, "success");
}

async function getCookiesForUrl(url, label, needsAuthorization = false) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("找不到当前标签页。", "error");
    return;
  }
  if (needsAuthorization && !isXunleiUrl(tab.url || "")) {
    await chrome.tabs.update(tab.id, { url });
    setStatus("已打开迅雷云盘，请登录后重新点击“一键获取”。");
    return;
  }
  await getCookiesForTab(tab, label, needsAuthorization);
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

    const getButton = document.createElement("button");
    getButton.className = "get";
    getButton.textContent = "一键获取";
    getButton.addEventListener("click", () => getCookiesForUrl(site.url, site.name, site.needsAuthorization));

    row.append(info, openButton, getButton);
    sitesElement.append(row);
  });
}

document.getElementById("current").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
    setStatus("当前标签页不是普通网站页面。", "error");
    return;
  }
  await getCookiesForTab(tab, new URL(tab.url).hostname);
});

document.getElementById("copy").addEventListener("click", async () => {
  const value = outputElement.value.trim();
  if (!value) {
    setStatus("当前没有可复制的 Cookie。", "error");
    return;
  }
  await copyText(value);
  setStatus("结果已复制到剪贴板。", "success");
});

document.getElementById("save").addEventListener("click", () => {
  const value = outputElement.value.trim();
  if (!value) {
    setStatus("当前没有可保存的 Cookie。", "error");
    return;
  }
  const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cookie-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("结果 TXT 已保存。", "success");
});

document.getElementById("clear").addEventListener("click", () => {
  outputElement.value = "";
  setStatus("结果已清空。");
});

document.getElementById("uninstall").addEventListener("click", () => {
  chrome.management.uninstallSelf({ showConfirmDialog: true });
});

renderSites();
