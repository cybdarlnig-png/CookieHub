$ErrorActionPreference = "Stop"

$extensionPath = Join-Path $PSScriptRoot "chrome_extension"
$chromeCandidates = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

Set-Clipboard -Value $extensionPath
Start-Process -FilePath "explorer.exe" -ArgumentList ('"{0}"' -f $extensionPath)

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "chrome://extensions/"
} else {
    Start-Process "chrome://extensions/"
}

Add-Type -AssemblyName PresentationFramework
$message = @"
安装页面和扩展文件夹已经打开，扩展路径也已复制。

只需完成三步：
1. 打开 Chrome 扩展页右上角“开发者模式”
2. 点击“加载已解压的扩展程序”
3. 选择刚刚打开的 chrome_extension 文件夹

安装后把 Cookie Hub 固定到工具栏，点击图标即可使用。
"@
[System.Windows.MessageBox]::Show($message, "Cookie Hub 一键安装助手", "OK", "Information") | Out-Null
