import json
import unittest
from pathlib import Path

ROOT = Path(__file__).parent
EXTENSION = ROOT / "chrome_extension"

class StandaloneExtensionTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
        self.popup_js = (EXTENSION / "popup.js").read_text(encoding="utf-8")
        self.popup_html = (EXTENSION / "popup.html").read_text(encoding="utf-8")
        self.background_js = (EXTENSION / "background.js").read_text(encoding="utf-8")

    def test_manifest_is_mv3_popup_with_service_worker(self):
        self.assertEqual(self.manifest["manifest_version"], 3)
        self.assertEqual(self.manifest["action"]["default_popup"], "popup.html")
        self.assertEqual(self.manifest["background"]["service_worker"], "background.js")
        self.assertNotIn("content_scripts", self.manifest)

    def test_manifest_permissions(self):
        for permission in ("cookies", "tabs", "management", "debugger", "storage"):
            self.assertIn(permission, self.manifest["permissions"])
        self.assertEqual(self.manifest["host_permissions"], ["<all_urls>"])

    def test_preconfigured_sites_exist(self):
        for name in ("夸克网盘", "百度网盘", "UC网盘", "迅雷云盘"):
            self.assertIn(name, self.popup_js)

    def test_popup_has_one_click_controls(self):
        for element_id in ("current", "sites", "output", "copy", "save", "clear", "uninstall", "status"):
            self.assertIn(f'id="{element_id}"', self.popup_html)

    def test_self_uninstall_is_available(self):
        self.assertIn("chrome.management.uninstallSelf", self.popup_js)

    def test_xunlei_debugger_capture_is_scoped(self):
        self.assertIn("startXunleiCapture", self.popup_js)
        self.assertIn("获取 Cookie", self.popup_js)
        self.assertIn("获取 Authorization", self.popup_js)
        self.assertIn("getAuthorizationForTab", self.popup_js)
        self.assertNotIn("needsAuthorization", self.popup_js)
        cookie_flow = self.popup_js.split("async function getCookiesForTab", 1)[1].split("async function getAuthorizationForTab", 1)[0]
        self.assertNotIn("prepareXunleiCapture", cookie_flow)
        self.assertNotIn("chrome.tabs.reload", cookie_flow)
        self.assertIn("chrome.debugger.attach", self.background_js)
        self.assertIn("chrome.storage.session || chrome.storage.local", self.background_js)
        self.assertIn("debugger is already attached", self.background_js)
        self.assertIn("Network.requestWillBeSentExtraInfo", self.background_js)
        self.assertIn("authorization", self.background_js)
        self.assertIn("xunlei", self.background_js)

    def test_one_click_installer_exists(self):
        for name in ("一键安装.bat", "install_helper.ps1", "一键卸载.bat", "uninstall_helper.ps1"):
            self.assertTrue((ROOT / name).is_file())

if __name__ == "__main__":
    unittest.main()

