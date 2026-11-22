// 在真实 Chrome 中加载扩展并做一次冒烟检查。
//
// 用法：
//   node tools/smoke_chrome.mjs
//   CHROME_PATH="/path/to/chrome" node tools/smoke_chrome.mjs
//
// 说明：品牌版 Chrome 会忽略命令行 --load-extension，因此这里通过
// CDP 的 Extensions.loadUnpacked 在 --remote-debugging-pipe 下加载未打包
// 扩展，然后打开 popup.html 截图并校验关键接口。截图输出到 docs/popup.png。

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTENSION_PATH = path.join(ROOT, "chrome_extension");
const SCREENSHOT_PATH = path.join(ROOT, "docs", "popup.png");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("未找到 Chrome，请用 CHROME_PATH 指定可执行文件");
  return found;
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cookiehub-smoke-"));
const chrome = findChrome();
const child = spawn(
  chrome,
  [
    "--headless",
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-sync",
    "--disable-background-networking",
    "about:blank"
  ],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] }
);

const toBrowser = child.stdio[3];
const fromBrowser = child.stdio[4];
const pending = new Map();
let buffer = "";
let sequence = 0;

fromBrowser.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let index;
  while ((index = buffer.indexOf("\0")) >= 0) {
    const raw = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    if (!raw) continue;
    const message = JSON.parse(raw);
    if (!message.id || !pending.has(message.id)) continue;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
    else resolve(message.result);
  }
});

function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = (sequence += 1);
    pending.set(id, { resolve, reject });
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    toBrowser.write(`${JSON.stringify(payload)}\0`);
  });
}

async function main() {
  await sleep(1200);
  const { id: extensionId } = await send("Extensions.loadUnpacked", { path: EXTENSION_PATH });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);

  await call("Page.enable", {});
  await call("Runtime.enable", {});
  await call("Network.enable", {});
  await call("Emulation.setDeviceMetricsOverride", {
    width: 560,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false
  });

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await call("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  };

  const navigation = await call("Page.navigate", { url: `chrome-extension://${extensionId}/popup.html` });
  if (navigation.errorText) throw new Error(`打开扩展页面失败: ${navigation.errorText}`);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if ((await evaluate("document.readyState")) === "complete") break;
    await sleep(100);
  }
  await sleep(600);

  const manifestVersion = await evaluate("chrome.runtime.getManifest().version");
  const contentHeight = await evaluate("Math.ceil(document.body.getBoundingClientRect().height)");
  await call("Emulation.setDeviceMetricsOverride", {
    width: 560,
    height: contentHeight,
    deviceScaleFactor: 2,
    mobile: false
  });
  await sleep(300);

  await call("Network.setCookie", {
    name: "COOKIEHUB_SMOKE",
    value: "1",
    domain: ".baidu.com",
    path: "/",
    secure: true,
    sameSite: "Lax"
  });

  const downloadDirectory = path.join(profile, "downloads");
  fs.mkdirSync(downloadDirectory, { recursive: true });
  await send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDirectory,
    eventsEnabled: true
  });

  const report = {
    extensionId,
    version: manifestVersion,
    siteRows: await evaluate("document.querySelectorAll('.site').length"),
    siteButtons: await evaluate("document.querySelectorAll('.site button').length"),
    iconLoads: await evaluate("fetch(chrome.runtime.getURL('icons/icon-128.png')).then((r) => r.ok)", true),
    cookieCheck: await evaluate(
      "chrome.cookies.getAll({url:'https://pan.baidu.com/'}).then((cookies) => cookies.map((c) => c.name))",
      true
    ),
    downloadsApi: await evaluate("typeof chrome.downloads?.download"),
    sessionApi: await evaluate("typeof chrome.storage.session?.get"),
    backgroundAlive: await evaluate(
      "chrome.runtime.sendMessage({type:'getXunleiAuthorization'}).then((value) => value === null)",
      true
    )
  };

  const shot = await call("Page.captureScreenshot", { format: "png" });
  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
  fs.writeFileSync(SCREENSHOT_PATH, Buffer.from(shot.data, "base64"));
  report.screenshot = path.relative(ROOT, SCREENSHOT_PATH);
  report.screenshotBytes = fs.statSync(SCREENSHOT_PATH).size;

  report.download = await evaluate(
    `(async () => {
      const original = chrome.downloads.download.bind(chrome.downloads);
      window.__cookieHubDownload = null;
      chrome.downloads.download = (...args) =>
        original(...args).then(
          (id) => {
            window.__cookieHubDownload = { ok: true, id };
            return id;
          },
          (error) => {
            window.__cookieHubDownload = { ok: false, error: String(error) };
            throw error;
          }
        );
      document.getElementById("output").value = "cookie-hub-smoke";
      document.getElementById("save").click();
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const [item] = await chrome.downloads.search({ orderBy: ["-startTime"], limit: 1 });
        if (item && item.state !== "in_progress") {
          return {
            state: item.state,
            filename: item.filename,
            primaryPath: window.__cookieHubDownload
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return { state: "timeout", primaryPath: window.__cookieHubDownload };
    })()`,
    true
  );
  const downloadedFiles = fs.existsSync(downloadDirectory)
    ? fs.readdirSync(downloadDirectory).filter((name) => name.endsWith(".txt"))
    : [];
  report.downloadFile = downloadedFiles[0] || null;
  report.downloadContent = report.downloadFile
    ? fs.readFileSync(path.join(downloadDirectory, report.downloadFile), "utf8").trim()
    : null;

  const failures = [];
  if (report.version !== JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, "manifest.json"), "utf8")).version) {
    failures.push("版本号不一致");
  }
  if (report.siteRows !== 4 || report.siteButtons !== 9) failures.push("站点列表渲染异常");
  if (!report.iconLoads) failures.push("图标无法加载");
  if (!report.cookieCheck.includes("COOKIEHUB_SMOKE")) failures.push("cookies 权限不可用");
  if (report.downloadsApi !== "function") failures.push("downloads 接口缺失");
  if (report.sessionApi !== "function") failures.push("storage.session 接口缺失");
  if (!report.backgroundAlive) failures.push("后台 service worker 无响应");
  if (report.download?.state !== "complete") failures.push(`保存 TXT 失败：${report.download?.state}`);
  if (!report.download?.primaryPath?.ok) failures.push("chrome.downloads 主路径未成功");
  if (report.downloadContent !== "cookie-hub-smoke") failures.push("保存的文件内容不正确");

  console.log(JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(`冒烟检查失败：${failures.join("、")}`);
}

main()
  .catch((error) => {
    console.error("SMOKE_FAILED:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await send("Browser.close");
    } catch {
      // 忽略关闭失败。
    }
    child.kill();
    await sleep(800);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      // 临时目录清理失败不影响结果。
    }
  });
