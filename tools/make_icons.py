"""生成 Cookie Hub 扩展图标。

用法：
    python tools/make_icons.py

依赖 Pillow（pip install pillow）。图标以 8 倍超采样绘制后缩放，
保证 16px 下仍然清晰；输出到 chrome_extension/icons/。
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "chrome_extension" / "icons"
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 8

BACKGROUND_TOP = (37, 99, 235)
BACKGROUND_BOTTOM = (29, 78, 216)
COOKIE_FILL = (253, 230, 138)
COOKIE_EDGE = (245, 158, 11)
CHIP = (146, 64, 14)


def blend(start, end, ratio):
    return tuple(round(left + (right - left) * ratio) for left, right in zip(start, end))


def background(size):
    gradient = Image.new("RGB", (1, size))
    for y in range(size):
        gradient.putpixel((0, y), blend(BACKGROUND_TOP, BACKGROUND_BOTTOM, y / max(size - 1, 1)))
    gradient = gradient.resize((size, size))

    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.23), fill=255)

    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    image.paste(gradient, (0, 0), mask)
    return image


def draw_cookie(image, size):
    draw = ImageDraw.Draw(image)
    center = size / 2
    radius = size * 0.31
    draw.ellipse(
        (center - radius, center - radius, center + radius, center + radius),
        fill=COOKIE_FILL,
        outline=COOKIE_EDGE,
        width=max(1, round(size * 0.018)),
    )

    if size <= 16 * SUPERSAMPLE:
        chips = [(0.02, -0.12, 0.075), (-0.13, 0.09, 0.065), (0.16, 0.12, 0.055)]
    else:
        chips = [
            (-0.15, -0.17, 0.065),
            (0.15, -0.07, 0.055),
            (-0.05, 0.14, 0.06),
            (0.20, 0.17, 0.04),
            (-0.24, 0.06, 0.035),
        ]

    for dx, dy, relative_radius in chips:
        chip_radius = size * relative_radius
        x = center + size * dx
        y = center + size * dy
        draw.ellipse((x - chip_radius, y - chip_radius, x + chip_radius, y + chip_radius), fill=CHIP)


def render(size):
    canvas_size = size * SUPERSAMPLE
    image = background(canvas_size)
    draw_cookie(image, canvas_size)
    return image.resize((size, size), Image.LANCZOS)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        target = OUTPUT / f"icon-{size}.png"
        render(size).save(target, format="PNG", optimize=True)
        print(f"wrote {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
