# Cookie Hub Chrome 扩展

安装后点击 Chrome 工具栏上的 Cookie Hub 图标即可使用。

界面提供：

- 一键获取当前标签页 Cookie；
- 夸克网盘、百度网盘、UC 网盘、迅雷云盘快捷入口；
- 迅雷云盘提供独立的 Cookie 和 Authorization 获取按钮；
- 一键获取并复制；
- 保存 TXT；
- 复制和清空结果。
- 点击“卸载扩展”并确认即可从 Chrome 删除。

迅雷云盘的“获取 Cookie”按钮只读取当前登录状态，不刷新页面。
“获取 Authorization”按钮会在登录后刷新页面，让扩展捕获当前迅雷标签页网络请求中的
`Authorization` 请求头。两个结果分别复制：

```text
Authorization: Bearer ...
```

Authorization 只在本地扩展会话中暂存，不上传到远程服务器。点击“获取 Authorization”时扩展会刷新当前迅雷标签页，捕获成功后立即断开调试连接。旧的独立 Authorization 扩展不再需要。

