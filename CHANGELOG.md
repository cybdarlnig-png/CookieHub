# 更新日志

## 1.4.0

### 新增

- 扩展图标（16/32/48/128），工具栏与扩展页不再显示默认图标
- 弹窗重新打开时恢复本次浏览器会话中最后一次获取的结果
- 保存 TXT 改用 `chrome.downloads`，失败时回退到页面内下载
- 迅雷 Authorization 捕获支持事件推送，等待更及时
- GitHub Actions 持续集成与 `tools/build_package.py` 打包脚本
- `tools/make_icons.py` 图标生成脚本

### 改进

- Authorization 捕获增加 30 秒兜底超时，成功后或超时后都会断开调试器
- 弹窗等待 Authorization 改为“事件推送 + 轮询兜底”，超过 25 秒自动取消
- Cookie 按路径长度排序，更接近浏览器实际发送的 Cookie 头
- 自动复制失败不再中断获取流程，改为提示手动复制
- 卸载助手保留 `chrome_extension` 文件夹，避免误删导致无法重新安装
- 保存文件名按内容区分为 `cookie-*.txt` 与 `authorization-*.txt`

### 修复

- 修复立即 `URL.revokeObjectURL` 可能导致保存中断的问题
- 修复后台异常时弹窗没有错误提示的问题
- 修复安装/卸载脚本中的重复提示与文案不一致

### 移除

- 移除不必要的 `management` 权限（`uninstallSelf` 不需要该权限）
- 移除未使用的 `XUNLEI_URL_FILTER` 常量

## 1.3.0 及更早版本

早期版本完成了 Cookie 获取、常用网站快捷入口、迅雷 Cookie 与 Authorization 拆分获取、一键安装/卸载等功能，细节见 Git 提交记录。
