# Cookie Hub 🍪

一个面向普通用户的 Chrome Cookie 获取工具。它直接使用电脑上现有的 Chrome 和当前登录状态，不启动独立浏览器，不要求安装 Python，也不会把 Cookie 上传到服务器。

> Cookie 等同于登录凭证。请仅获取和使用你本人账号的 Cookie，不要发送给他人，也不要提交到 GitHub、网盘或其他公开位置。

## 功能特点

- 使用当前 Chrome 的登录状态
- 支持任意普通 `HTTP/HTTPS` 网站的当前标签页
- 预置夸克网盘、百度网盘、UC 网盘和迅雷云盘入口
- 迅雷云盘提供独立的“获取 Cookie”和“获取 Authorization”按钮
- 一键整理为标准 `name=value; name2=value2` 格式
- 自动复制到剪贴板，可保存为本地 TXT
- 不启动独立浏览器或独立 Profile
- 不依赖 Python、Node.js或后台服务
- 不包含网络上传、统计或远程接口
- 提供中文安装与卸载助手

## 工作流程

```text
在 Chrome 登录网站
        ↓
点击 Cookie Hub 图标
        ↓
点击“一键获取”或“获取当前标签页”
        ↓
Cookie 显示并自动复制
```

## 安装方法

### 傻瓜式安装

1. 下载并解压项目。
2. 双击 `一键安装.bat`。
3. 在自动打开的 Chrome 扩展页面开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择自动打开的 `chrome_extension` 文件夹。
6. 将 Cookie Hub 固定到 Chrome 工具栏。

### 手动安装

1. 在 Chrome 地址栏打开 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择项目中的 `chrome_extension` 文件夹。

## 使用方法

### 预置网站

1. 点击 Chrome 工具栏上的 Cookie Hub 图标。
2. 点击夸克网盘、百度网盘、UC网盘或迅雷云盘旁的“进入网站”。
3. 完成登录后重新打开扩展。
4. 点击对应的获取按钮。

迅雷云盘的两个按钮相互独立：

- “获取 Cookie”只读取当前登录状态，不刷新页面；
- “获取 Authorization”才会刷新当前迅雷标签页并捕获请求头。

Authorization 按钮成功后会复制：

```text
Authorization: Bearer ...
```

### 其他网站

1. 在 Chrome 中打开目标网站并登录。
2. 点击 Cookie Hub 图标。
3. 点击“获取当前标签页 Cookie”。

获取成功后，Cookie 会显示在扩展界面中并自动复制到剪贴板。

## 为什么会获取到很多 Cookie？

登录状态通常不只依赖一个 Cookie。网站可能同时使用登录会话、安全校验、设备标识、负载均衡、用户设置和不同子域名的 Cookie。因此工具默认返回当前网址可使用的完整 Cookie Header，不建议随意删除其中某一项。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `cookies` | 读取用户主动选择网站的 Cookie |
| `tabs` | 获取当前活动标签页网址、打开预置网站 |
| `clipboardWrite` | 将结果复制到剪贴板 |
| `management` | 允许用户从扩展界面发起自卸载 |
| `debugger` | 仅在用户点击“获取 Authorization”时，观察当前迅雷标签页的网络请求头 |
| `storage` | 在当前扩展会话中暂存迅雷 Authorization |
| `<all_urls>` | 支持当前标签页中的普通网站 |

所有处理均在本机 Chrome 扩展中完成。项目代码没有使用 `fetch`、`XMLHttpRequest`、WebSocket 或远程服务器上传 Cookie。Authorization 监听仅匹配 `*.xunlei.com` 请求，并在捕获到 Authorization 后立即解除调试连接。旧的独立 Authorization 扩展不再需要，只保留 Cookie Hub。

## 使用限制

- Chrome 内部页面、Chrome 网上应用店及其他扩展页面不能读取。
- 无痕窗口需要用户手动允许扩展在无痕模式中运行。
- 只能读取当前 Chrome Profile 中允许访问的 Cookie。
- 某些网站还依赖 LocalStorage、IndexedDB、设备指纹或临时令牌，仅复制 Cookie 不一定能在其他软件中复现登录。
- 一个服务使用多个域名时，当前网址可能不会包含其他关联域名的 Cookie。

## 卸载和清理

1. 在扩展界面点击“卸载扩展”，或者在 `chrome://extensions/` 中点击“移除”。
2. 双击 `一键卸载.bat`。
3. 根据提示决定是否删除下载目录中的 `cookie-*.txt`。

Chrome 负责删除扩展注册和扩展数据；卸载助手负责清理项目扩展目录、旧版 CookieHub 本地数据以及剪贴板内容，不需要第三方清理软件。

## 项目结构

```text
CookieHub/
├─ chrome_extension/       # Chrome 扩展正式源代码
│  ├─ manifest.json        # 扩展配置和权限
│  ├─ background.js        # 迅雷 Authorization 捕获服务
│  ├─ popup.html           # 扩展弹窗界面
│  ├─ popup.js             # Cookie 获取与导出逻辑
│  └─ README.md
├─ 一键安装.bat             # Windows安装入口
├─ install_helper.ps1      # 安装助手
├─ 一键卸载.bat             # Windows卸载入口
├─ uninstall_helper.ps1    # 卸载和清理助手
├─ 使用说明.txt             # 简明中文说明
├─ test_extension.py       # 基础结构和行为测试
└─ README.md
```

## 隐私与安全

- 本项目不会主动联网传输 Cookie。
- Cookie 仅显示在本地扩展弹窗、剪贴板或用户主动保存的 TXT 中。
- 保存后的 TXT 文件为明文，请使用后及时删除。
- 不要截图、公开粘贴或提交真实 Cookie。
- 如果 Cookie 意外泄露，请立即退出对应网站的所有登录设备并重新登录。

## 开发检查

```powershell
python test_extension.py
node --check chrome_extension/popup.js
```

## 开源许可

本项目使用 [MIT License](LICENSE)。

