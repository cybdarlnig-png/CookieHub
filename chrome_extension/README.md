# Cookie Hub Chrome 扩展

`chrome_extension/` 是可以直接“加载已解压的扩展程序”的 Manifest V3 目录。

## 文件

- `manifest.json`：MV3 清单，声明 Cookie、标签页、剪贴板、下载、调试器和会话存储权限。
- `popup.html` / `popup.js`：弹窗界面、Cookie 读取、Authorization 等待与结果保存。
- `background.js`：迅雷 Authorization 的调试器捕获、30 秒超时自动断开、结果推送。
- `icons/`：16/32/48/128 图标，由 `tools/make_icons.py` 生成。

## 行为约定

- 结果只写入 `chrome.storage.session`，不落盘、不联网；弹窗重新打开时会恢复。
- 读取 Cookie 不会刷新页面；只有“获取 Authorization”会刷新当前迅雷标签页。
- Authorization 捕获成功后立即断开调试器；25 秒未捕获时弹窗会请求取消，后台 30 秒兜底断开。
- 保存 TXT 优先使用 `chrome.downloads`，失败时回退到 `<a download>`。
- 不引入任何远程脚本、`fetch`、`XMLHttpRequest` 或 WebSocket，测试会对此做静态检查。

## 本地检查

```powershell
python -m unittest -v test_extension
node --check background.js
node --check popup.js
node ../tools/smoke_chrome.mjs
```

`tools/smoke_chrome.mjs` 会在真实 Chrome 中加载本目录、校验接口并刷新 `docs/popup.png`。

## 修改图标

```powershell
python tools/make_icons.py
```

修改 `manifest.json` 的版本号后运行 `python tools/build_package.py` 生成可分发的 zip。
