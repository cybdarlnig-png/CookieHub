# 安全说明

Cookie Hub 处理的是可用于维持账号登录状态的敏感凭证（Cookie、Authorization）。请只在你本人拥有、且你有权使用的账号和网站上使用。

## 安全设计

- 扩展没有任何网络请求代码：不包含 `fetch`、`XMLHttpRequest`、WebSocket 或远程脚本，测试会做静态检查。
- Cookie 与 Authorization 只写入 `chrome.storage.session`（内存会话存储），浏览器关闭后自动清除，不写入磁盘。
- 保存的 TXT 由浏览器下载到本机下载目录，是否保留由你决定。
- 卸载助手指南只清理本机残余数据，不会上传任何内容。

## 安全使用

- 不要把真实 Cookie 提交到 Issue、Pull Request、聊天记录或公开仓库。
- 不要把导出的 `cookie-*.txt`、`authorization-*.txt` 发给其他人。
- 使用结束后清空剪贴板，并删除不再需要的导出文件。
- 如果 Cookie 或 Authorization 泄露，请立即退出对应网站的所有登录设备并重新登录。

## 权限说明

| 权限 | 必要性 |
| --- | --- |
| `cookies` | 读取当前网站 Cookie，核心功能 |
| `tabs` | 读取当前标签页地址、打开常用网站 |
| `clipboardWrite` | 自动复制结果 |
| `downloads` | 保存 TXT |
| `debugger` | 捕获迅雷请求的 Authorization 请求头，仅在点击“获取 Authorization”时启用 |
| `storage` | 会话内暂存结果 |
| `<all_urls>` | 常用网站可能不是当前标签页，需要按网址读取 Cookie |

如果你只使用某一个网站，可以把 `manifest.json` 的 `host_permissions` 收窄为该网站的域名，进一步降低权限范围。

## 报告安全问题

报告问题时请只提供复现步骤和脱敏信息，不要附带任何真实 Cookie、Token、账号或密码。
