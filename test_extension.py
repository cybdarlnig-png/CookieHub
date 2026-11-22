import codecs
import json
import os
import shutil
import struct
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).parent
EXTENSION = ROOT / "chrome_extension"

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def read(path):
    return path.read_text(encoding="utf-8")


def png_size(path):
    data = path.read_bytes()
    if data[:8] != PNG_SIGNATURE:
        raise ValueError(f"{path.name} 不是 PNG")
    return struct.unpack(">II", data[16:24])


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads(read(EXTENSION / "manifest.json"))

    def test_manifest_is_mv3_popup_with_service_worker(self):
        self.assertEqual(self.manifest["manifest_version"], 3)
        self.assertEqual(self.manifest["action"]["default_popup"], "popup.html")
        self.assertEqual(self.manifest["background"]["service_worker"], "background.js")
        self.assertNotIn("content_scripts", self.manifest)

    def test_version_and_minimum_chrome(self):
        version = self.manifest["version"]
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertGreaterEqual(tuple(map(int, version.split("."))), (1, 4, 0))
        self.assertGreaterEqual(int(self.manifest["minimum_chrome_version"]), 116)

    def test_permissions_are_minimal(self):
        self.assertEqual(
            set(self.manifest["permissions"]),
            {"cookies", "tabs", "clipboardWrite", "downloads", "debugger", "storage"},
        )
        self.assertEqual(self.manifest["host_permissions"], ["<all_urls>"])
        # management.uninstallSelf 不需要 management 权限。
        self.assertNotIn("management", self.manifest["permissions"])

    def test_icons_are_declared_and_present(self):
        icons = self.manifest["icons"]
        self.assertEqual(set(icons), {"16", "32", "48", "128"})
        self.assertEqual(self.manifest["action"]["default_icon"], icons)
        for size, relative in icons.items():
            path = EXTENSION / relative
            self.assertTrue(path.is_file(), relative)
            self.assertEqual(png_size(path), (int(size), int(size)))


class ExtensionSecurityTests(unittest.TestCase):
    def setUp(self):
        self.background = read(EXTENSION / "background.js")
        self.popup = read(EXTENSION / "popup.js")
        self.html = read(EXTENSION / "popup.html")

    def test_no_remote_code_or_network_calls(self):
        for code in (self.background, self.popup):
            for forbidden in ("fetch(", "XMLHttpRequest", "WebSocket", "sendBeacon", "eval(", "new Function"):
                self.assertNotIn(forbidden, code)

    def test_results_never_touch_local_disk_storage(self):
        for code in (self.background, self.popup):
            self.assertNotIn("chrome.storage.local", code)
            self.assertIn("chrome.storage.session", code)

    def test_no_sensitive_output_is_logged(self):
        for code in (self.background, self.popup):
            self.assertNotIn("console.log", code)
            self.assertNotIn("console.debug", code)


class BackgroundTests(unittest.TestCase):
    def setUp(self):
        self.code = read(EXTENSION / "background.js")

    def test_debugger_capture_is_scoped_to_xunlei(self):
        self.assertIn("chrome.debugger.attach", self.code)
        self.assertIn('"Network.enable"', self.code)
        self.assertIn("Network.requestWillBeSentExtraInfo", self.code)
        self.assertIn("isXunleiUrl", self.code)

    def test_capture_is_cleaned_up(self):
        self.assertIn("CAPTURE_TIMEOUT_MS", self.code)
        self.assertIn("setTimeout", self.code)
        self.assertIn("clearTimeout", self.code)
        self.assertIn("chrome.debugger.detach", self.code)
        self.assertIn("cancelXunleiCapture", self.code)

    def test_result_is_pushed_to_popup_and_kept_in_session(self):
        self.assertIn("xunleiAuthorizationCaptured", self.code)
        self.assertIn('chrome.storage.session.set({ xunleiAuthorization: authorization })', self.code)

    def test_unused_filter_was_removed(self):
        self.assertNotIn("XUNLEI_URL_FILTER", self.code)


class PopupTests(unittest.TestCase):
    def setUp(self):
        self.code = read(EXTENSION / "popup.js")
        self.html = read(EXTENSION / "popup.html")

    def test_preconfigured_sites_exist(self):
        for name in ("夸克网盘", "百度网盘", "UC网盘", "迅雷云盘"):
            self.assertIn(name, self.code)

    def test_popup_has_one_click_controls(self):
        for element_id in ("current", "sites", "output", "copy", "save", "clear", "status", "version"):
            self.assertIn(f'id="{element_id}"', self.html)
        self.assertIn('aria-live="polite"', self.html)

    def test_cookie_header_is_ordered_by_path(self):
        self.assertIn("localeCompare", self.code)
        self.assertIn('(right.path || "").length', self.code)

    def test_download_uses_downloads_api_with_fallback(self):
        self.assertIn("chrome.downloads.download", self.code)
        self.assertIn("URL.revokeObjectURL", self.code)
        self.assertIn("setTimeout(() => URL.revokeObjectURL(url), 60000)", self.code)

    def test_clipboard_has_fallback(self):
        self.assertIn("document.execCommand(\"copy\")", self.code)

    def test_last_result_is_restored(self):
        self.assertIn("restoreLastResult", self.code)
        self.assertIn("LAST_RESULT_KEY", self.code)

    def test_self_uninstall_is_available(self):
        self.assertIn("chrome.management.uninstallSelf", self.code)

    def test_authorization_waits_for_pushed_event(self):
        self.assertIn("xunleiAuthorizationCaptured", self.code)
        self.assertIn("chrome.runtime.onMessage.addListener", self.code)

    def test_authorization_flow_does_not_reload_for_cookie(self):
        cookie_flow = self.code.split("async function getCookiesForTab", 1)[1].split(
            "async function getAuthorizationForTab", 1
        )[0]
        self.assertNotIn("chrome.tabs.reload", cookie_flow)
        self.assertNotIn("startXunleiCapture", cookie_flow)


class InstallerTests(unittest.TestCase):
    def test_one_click_installer_exists(self):
        for name in ("一键安装.bat", "install_helper.ps1", "一键卸载.bat", "uninstall_helper.ps1"):
            self.assertTrue((ROOT / name).is_file(), name)

    def test_bat_files_call_helpers(self):
        self.assertIn("install_helper.ps1", read(ROOT / "一键安装.bat"))
        self.assertIn("uninstall_helper.ps1", read(ROOT / "一键卸载.bat"))

    def test_uninstaller_keeps_program_folder(self):
        code = read(ROOT / "uninstall_helper.ps1")
        self.assertIn("[switch]$DryRun", code)
        self.assertNotIn("Remove-Item -LiteralPath $extensionPath", code)
        self.assertIn("cookie-*.txt", code)
        self.assertIn("authorization-*.txt", code)

    def test_powershell_scripts_are_utf8_with_bom(self):
        # Windows PowerShell 5.1 会把无 BOM 的 UTF-8 脚本按 ANSI 解码，导致中文和引号错乱。
        for name in ("install_helper.ps1", "uninstall_helper.ps1"):
            self.assertTrue((ROOT / name).read_bytes().startswith(codecs.BOM_UTF8), name)

    @unittest.skipUnless(os.name == "nt" and shutil.which("powershell"), "需要 Windows PowerShell")
    def test_powershell_scripts_parse(self):
        for name in ("install_helper.ps1", "uninstall_helper.ps1"):
            command = (
                "$tokens=$null; $errors=$null; "
                f"[System.Management.Automation.Language.Parser]::ParseFile('{ROOT / name}', [ref]$tokens, [ref]$errors) | Out-Null; "
                "if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_.Message }; exit 1 }"
            )
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", command],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            self.assertEqual(result.returncode, 0, f"{name}: {result.stderr}")


class ProjectTests(unittest.TestCase):
    def test_javascript_syntax(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("未安装 Node.js")
        for name in ("background.js", "popup.js"):
            result = subprocess.run(
                [node, "--check", str(EXTENSION / name)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_delivery_assets_exist(self):
        for name in (
            ".github/workflows/ci.yml",
            "tools/build_package.py",
            "tools/make_icons.py",
            "tools/smoke_chrome.mjs",
            "docs/popup.png",
            "CHANGELOG.md",
        ):
            self.assertTrue((ROOT / name).is_file(), name)

    def test_scratch_files_removed(self):
        for name in ("DIFF_FILE", "MODIFIED_FILE"):
            self.assertFalse((ROOT / name).exists(), name)


if __name__ == "__main__":
    unittest.main()
