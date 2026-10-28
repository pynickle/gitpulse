"""Render the Flutter draft-release body.

The downloads follow FlClash's release template — shields.io badges rather than
plain links — for the Android split APKs, one badge per ABI. GitPulse publishes
the Flutter client to Android only.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from package_android import SPLIT_ABIS, release_binary_names

BADGES = {
    "arm64-v8a": ("APK", "ARMv8", "168039", "android"),
    "armeabi-v7a": ("APK", "ARMv7", "45bf55", "android"),
    "x86_64": ("APK", "x64", "96ed89", "android"),
}


def download_url(repository: str, version: str, filename: str) -> str:
    return (
        f"https://github.com/{repository}/releases/download/"
        f"flutter-v{version}/{filename}"
    )


def _badge(kind: str, label: str, color: str, logo: str) -> str:
    return f"https://img.shields.io/badge/{kind}-{label}-{color}.svg?logo={logo}"


def _link(url: str, kind: str, label: str, color: str, logo: str) -> str:
    badge = _badge(kind, label, color, logo)
    return f'<a href="{url}"><img alt="{kind} {label}" src="{badge}"></a>'


def render_download_table(version: str, repository: str) -> str:
    android_links = "<br>\n".join(
        _link(download_url(repository, version, filename), *BADGES[abi])
        for abi, filename in zip(
            SPLIT_ABIS, release_binary_names(version), strict=True
        )
    )
    return f"""**Download for Android, by device ABI:**

<div align="left">
{android_links}
</div>
"""


def render_release_body(version: str, notes: str, repository: str) -> str:
    table = render_download_table(version, repository).rstrip() + "\n"
    stripped = notes.strip()
    if not stripped:
        return table
    return f"{stripped}\n\n{table}"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", required=True)
    parser.add_argument("--notes", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--repository",
        default=os.environ.get("GITHUB_REPOSITORY", "pynickle/gitpulse"),
    )
    args = parser.parse_args(argv)
    body = render_release_body(
        args.version,
        args.notes.read_text(encoding="utf-8"),
        args.repository,
    )
    args.output.write_text(body, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
