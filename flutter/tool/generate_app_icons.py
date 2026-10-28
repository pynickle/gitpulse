# /// script
# requires-python = "==3.15.*"
# dependencies = ["Pillow==13.0.0"]
# ///
"""Regenerate native icons: uv run --locked tool/generate_app_icons.py."""

from collections import Counter
from pathlib import Path
import json
import shutil
import subprocess

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "tool/icons/generated"
WHITE = (255, 255, 255, 255)


def save(image, name):
    image.save(SOURCES / name, compress_level=9)


def recover_mark(original):
    """Invert the white matte, retaining the small palette's colour variations."""
    colors = Counter(original.get_flattened_data())
    dark = max((c for c in colors if max(c) < 128), key=colors.get)
    green = max((c for c in colors if c[1] - c[0] > 100), key=colors.get)
    recovered = {}
    for color in colors:
        if min(color) >= 253:
            recovered[color] = (0, 0, 0, 0)
            continue
        base = green if color[1] - color[0] > 20 else dark
        # Project onto the white-to-brand-colour line to estimate coverage.
        numerator = sum((255 - c) * (255 - b) for c, b in zip(color, base))
        denominator = sum((255 - b) ** 2 for b in base)
        alpha = min(255, max(1, round(255 * numerator / denominator)))
        # Retain the palette residual instead of flattening the mark's colours.
        rgb = tuple(
            max(0, min(255, round(255 + (c - 255) * 255 / alpha))) for c in color
        )
        recovered[color] = (*rgb, alpha)
    mark = Image.new("RGBA", original.size)
    mark.putdata([recovered[c] for c in original.get_flattened_data()])
    composite = Image.alpha_composite(Image.new("RGBA", mark.size, WHITE), mark)
    error = ImageChops.difference(composite.convert("RGB"), original)
    maximum = max(high for _, high in error.getextrema())
    if maximum > 2:
        raise ValueError(f"Brand recovery changed a channel by {maximum} (limit 2)")
    if mark.getpixel((0, 0))[3] != 0:
        raise ValueError("Recovered mark must have a transparent background")
    print(f"Brand recovery: maximum channel error {maximum}/255", flush=True)
    return mark


def derive_sources():
    SOURCES.mkdir(parents=True, exist_ok=True)
    original = Image.open(ROOT.parent / "public/icon.png").convert("RGB")
    if original.size != (1024, 1024):
        raise ValueError("Expected the 1024px web brand source")
    mark = recover_mark(original)
    save(mark, "mark.png")
    square = Image.alpha_composite(Image.new("RGBA", mark.size, WHITE), mark)
    save(square.convert("RGB"), "square.png")
    monochrome = Image.new("RGBA", mark.size, (0, 0, 0, 0))
    monochrome.putalpha(mark.getchannel("A"))
    save(monochrome, "monochrome.png")
    dark = Image.open(ROOT.parent / "public/icon-dark.png").convert("RGBA")
    # This brand state has a 15/255 matte, not a transparent background.
    dark.putalpha(
        dark.getchannel("A").point(lambda a: max(0, round((a - 15) * 255 / 240)))
    )
    save(dark, "dark.png")
    save(square.convert("L").convert("RGB"), "tinted.png")


def run(command, *args):
    executable = shutil.which(command)
    if executable is None:
        raise RuntimeError(f"{command} must be on PATH")
    subprocess.run([executable, *args], cwd=ROOT, check=True)


def normalize_white_backgrounds():
    # The delegated average resampler truncates 255 to 254 at some ratios.
    paths = list((ROOT / "android/app/src/main/res").glob("mipmap-*/ic_launcher.png"))
    ios = ROOT / "ios/Runner/Assets.xcassets/AppIcon.appiconset"
    paths += [p for p in ios.glob("*.png") if "-Dark-" not in p.name]
    for path in paths:
        image = Image.open(path).convert("RGB")
        image.putdata(
            [
                (255, 255, 255) if min(c) >= 254 else c
                for c in image.get_flattened_data()
            ]
        )
        image.save(path, compress_level=9)


def normalize_catalog(platform):
    directory = ROOT / platform / "Runner/Assets.xcassets/AppIcon.appiconset"
    contents = directory / "Contents.json"
    data = json.loads(contents.read_text(encoding="utf-8"))
    contents.write_text(
        json.dumps(data, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    referenced = {entry["filename"] for entry in data["images"]}
    # Remove only obsolete PNGs inside this generated icon catalog, never sources.
    for path in directory.glob("*.png"):
        if path.name not in referenced:
            path.unlink()


def main():
    derive_sources()
    run("flutter", "pub", "get", "--enforce-lockfile")
    project = ROOT / "ios/Runner.xcodeproj/project.pbxproj"
    original_project = project.read_bytes()
    try:
        run("dart", "run", "flutter_launcher_icons")
    finally:
        # AppIcon is already wired. 0.14.4 rewrites every ASSETCATALOG setting,
        # including GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS, to "AppIcon".
        project.write_bytes(original_project)
    normalize_catalog("ios")
    normalize_white_backgrounds()
    run("flutter", "test", "--no-pub", "test/app_icons_test.dart")


if __name__ == "__main__":
    main()
