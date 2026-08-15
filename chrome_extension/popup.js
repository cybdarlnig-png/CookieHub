const SITES = [
  { name: "夸克网盘", url: "https://pan.quark.cn/" },
  { name: "百度网盘", url: "https://pan.baidu.com/" },
  { name: "UC网盘", url: "https://drive.uc.cn/" }
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

async function getCookiesForUrl(url, label) {
  setStatus(`正在获取 ${label}…`);
  try {
    const cookies = await chrome.cookies.getAll({ url });
    const header = cookieHeader(cookies);
    outputElement.value = header;
    if (!header) {
      setStatus(`${label} 没有读取到 Cookie，请先登录。`, "error");
      return;
    }
    await copyText(header);
    setStatus(`已获取 ${cookies.length} 个 Cookie，并复制到剪贴板。`, "success");
  } catch (error) {
    setStatus(`获取失败：${error.message}`, "error");
  }
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
    getButton.addEventListener("click", () => getCookiesForUrl(site.url, site.name));

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
  await getCookiesForUrl(tab.url, new URL(tab.url).hostname);
});

document.getElementById("copy").addEventListener("click", async () => {
  const value = outputElement.value.trim();
  if (!value) {
    setStatus("当前没有可复制的 Cookie。", "error");
    return;
  }
  await copyText(value);
  setStatus("Cookie 已复制到剪贴板。", "success");
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
  setStatus("Cookie TXT 已保存。", "success");
});

document.getElementById("clear").addEventListener("click", () => {
  outputElement.value = "";
  setStatus("结果已清空。");
});

document.getElementById("uninstall").addEventListener("click", () => {
  chrome.management.uninstallSelf({ showConfirmDialog: true });
});

renderSites();
