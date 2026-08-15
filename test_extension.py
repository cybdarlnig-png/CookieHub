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

    def test_manifest_is_standalone_popup(self):
        self.assertEqual(self.manifest["manifest_version"], 3)
        self.assertEqual(self.manifest["action"]["default_popup"], "popup.html")
        self.assertNotIn("background", self.manifest)
        self.assertNotIn("content_scripts", self.manifest)

    def test_manifest_has_cookie_and_tab_permissions(self):
        self.assertIn("cookies", self.manifest["permissions"])
        self.assertIn("tabs", self.manifest["permissions"])
        self.assertIn("management", self.manifest["permissions"])
        self.assertEqual(self.manifest["host_permissions"], ["<all_urls>"])

    def test_preconfigured_sites_exist(self):
        for name in ("夸克网盘", "百度网盘", "UC网盘"):
            self.assertIn(name, self.popup_js)

    def test_popup_has_one_click_controls(self):
        for element_id in ("current", "sites", "output", "copy", "save", "clear", "uninstall", "status"):
            self.assertIn(f'id="{element_id}"', self.popup_html)

    def test_self_uninstall_is_available(self):
        self.assertIn("chrome.management.uninstallSelf", self.popup_js)

    def test_one_click_installer_exists(self):
        self.assertTrue((ROOT / "一键安装.bat").is_file())
        self.assertTrue((ROOT / "install_helper.ps1").is_file())
        self.assertTrue((ROOT / "一键卸载.bat").is_file())
        self.assertTrue((ROOT / "uninstall_helper.ps1").is_file())


if __name__ == "__main__":
    unittest.main()
