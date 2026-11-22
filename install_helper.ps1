$ErrorActionPreference = "Stop"

$extensionPath = Join-Path $PSScriptRoot "chrome_extension"
$manifestPath = Join-Path $extensionPath "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "未找到 chrome_extension\manifest.json，请确认解压完整后重试。"
}
$version = (Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json).version

$chromeCandidates = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

try {
    Set-Clipboard -Value $extensionPath
} catch {
    # 剪贴板被占用时不影响安装流程。
}

Start-Process -FilePath "explorer.exe" -ArgumentList ('"{0}"' -f $extensionPath)

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "chrome://extensions/"
} else {
    Start-Process "chrome://extensions/"
}

Add-Type -AssemblyName PresentationFramework
$message = @"
安装页面和扩展文件夹已经打开，扩展路径也已复制到剪贴板。

版本：$version

只需完成三步：
1. 打开 Chrome 扩展页右上角“开发者模式”
2. 点击“加载已解压的扩展程序”
3. 选择刚刚打开的 chrome_extension 文件夹

Chrome 会提示 Cookie、下载和调试器权限，这些权限只用于在本机读取登录状态，
扩展不会上传任何数据。安装后把 Cookie Hub 固定到工具栏，点击图标即可使用。

注意：加载后不要删除或移动 chrome_extension 文件夹，否则扩展会失效。
"@
[System.Windows.MessageBox]::Show($message, "Cookie Hub 一键安装助手", "OK", "Information") | Out-Null
