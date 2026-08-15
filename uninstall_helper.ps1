param([switch]$DryRun)

$ErrorActionPreference = "Stop"

$extensionPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "chrome_extension"))
$packageRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$legacyData = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "CookieHub"))
$localAppDataRoot = [System.IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\') + '\'
$downloads = Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads"

if ($DryRun) {
    Write-Output "DRY_RUN_EXTENSION=$extensionPath"
    Write-Output "DRY_RUN_LEGACY=$legacyData"
    Write-Output "DRY_RUN_DOWNLOADS=$downloads\cookie-*.txt"
    Write-Output "DRY_RUN_RESULT=NO_FILES_CHANGED"
    exit 0
}

Add-Type -AssemblyName PresentationFramework

$chromeCandidates = @(
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
)
$chrome = $chromeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "chrome://extensions/"
} else {
    Start-Process "chrome://extensions/"
}

$confirm = [System.Windows.MessageBox]::Show(
    '请在打开的 Chrome 扩展页中找到 Cookie Hub，点击“移除”并确认。完成后点击“确定”，卸载助手将清理本机残余文件。',
    "Cookie Hub 一键卸载",
    "OKCancel",
    "Information"
)
if ($confirm -ne "OK") {
    exit 0
}

if (-not $extensionPath.StartsWith($packageRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "扩展目录校验失败。"
}
if (Test-Path -LiteralPath $extensionPath) {
    Remove-Item -LiteralPath $extensionPath -Recurse -Force
}

if (-not $legacyData.StartsWith($localAppDataRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "本地数据目录校验失败。"
}
if (Test-Path -LiteralPath $legacyData) {
    Remove-Item -LiteralPath $legacyData -Recurse -Force
}

Set-Clipboard -Value ""

$downloadChoice = [System.Windows.MessageBox]::Show(
    "是否同时删除下载目录中由 Cookie Hub 保存的 cookie-*.txt 文件？",
    "清理导出文件",
    "YesNo",
    "Question"
)
if ($downloadChoice -eq "Yes" -and (Test-Path -LiteralPath $downloads)) {
    Get-ChildItem -LiteralPath $downloads -Filter "cookie-*.txt" -File -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
}

[System.Windows.MessageBox]::Show(
    "Cookie Hub 本机残余已清理完成。安装包和卸载助手会保留，方便以后重新安装；不需要时可以直接删除当前文件夹。",
    "卸载完成",
    "OK",
    "Information"
) | Out-Null
