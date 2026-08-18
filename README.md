# Cookie Hub

一个使用电脑现有 Chrome 登录状态的 Cookie 获取扩展，适合需要 Cookie 或登录请求头的本地工具适配。

## 功能

- 获取当前网页 Cookie，并自动复制到剪贴板
- 支持夸克网盘、百度网盘、UC 网盘和迅雷云盘
- 迅雷云盘提供独立的“获取 Cookie”和“获取 Authorization”按钮
- 支持保存 TXT，提供一键安装和卸载
- Cookie 和 Authorization 只在本机处理，不上传服务器

## 安装

1. 双击 `一键安装.bat`。
2. 在 Chrome 扩展页开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择 `chrome_extension` 文件夹。

注意：加载完成后不要删除或移动 `chrome_extension` 文件夹，否则扩展会失效。

也可以直接打开 `chrome://extensions/` 手动加载 `chrome_extension` 文件夹。

## 使用

1. 在 Chrome 中打开并登录目标网站。
2. 点击 Cookie Hub 图标。
3. 普通网站点击“一键获取”；迅雷云盘按需要点击“获取 Cookie”或“获取 Authorization”。

迅雷 Cookie 按钮不会刷新页面；Authorization 按钮会刷新迅雷页面并捕获请求头。

## 注意

Cookie 和 Authorization 都是登录凭证，只用于自己的账号，不要公开、转发或提交到公开仓库。

## 检查

```powershell
python test_extension.py
node --check chrome_extension/popup.js
node --check chrome_extension/background.js
```

MIT License
