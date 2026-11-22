"""把 chrome_extension 打包成可分发的 zip。

用法：
    python tools/build_package.py

输出 dist/cookie-hub-extension-<version>.zip 和同名 .sha256 文件。
Chrome Web Store 要求 manifest.json 位于 zip 根目录，因此这里按扩展目录
内部的相对路径写入归档，而不是保留 chrome_extension/ 前缀。
"""

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "chrome_extension"
DIST = ROOT / "dist"


def load_manifest():
    manifest = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("manifest_version") != 3:
        raise SystemExit("manifest.json 必须是 Manifest V3")
    return manifest


def check_icons(manifest):
    for size, relative in manifest.get("icons", {}).items():
        target = EXTENSION / relative
        if not target.is_file():
            raise SystemExit(f"缺少图标 {size}: {relative}")
        data = target.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            raise SystemExit(f"图标不是 PNG: {relative}")


def build():
    manifest = load_manifest()
    check_icons(manifest)
    version = manifest["version"]
    DIST.mkdir(exist_ok=True)
    target = DIST / f"cookie-hub-extension-{version}.zip"
    target.unlink(missing_ok=True)

    files = sorted(path for path in EXTENSION.rglob("*") if path.is_file())
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(EXTENSION).as_posix())

    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (DIST / f"cookie-hub-extension-{version}.sha256").write_text(
        f"{digest}  {target.name}\n", encoding="ascii"
    )
    print(f"built {target} ({target.stat().st_size} bytes)")
    print(f"sha256 {digest}")


if __name__ == "__main__":
    build()
