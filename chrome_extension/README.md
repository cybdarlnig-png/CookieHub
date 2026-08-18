# Cookie Hub Chrome 扩展

安装后点击 Chrome 工具栏上的 Cookie Hub 图标即可使用。

界面提供：

- 一键获取当前标签页 Cookie；
- 夸克网盘、百度网盘、UC 网盘、迅雷云盘快捷入口；
- 迅雷云盘同时获取 Cookie 和 Authorization；
- 一键获取并复制；
- 保存 TXT；
- 复制和清空结果。
- 点击“卸载扩展”并确认即可从 Chrome 删除。

迅雷云盘需要在登录后刷新页面，让扩展捕获当前迅雷标签页网络请求中的
`Authorization` 请求头。获取结果会以两行形式复制：

```text
Cookie: name=value; name2=value2
Authorization: Bearer ...
```

Authorization 只在本地扩展会话中暂存，不上传到远程服务器。点击“一键获取”时扩展会刷新当前迅雷标签页，捕获成功后立即断开调试连接。

