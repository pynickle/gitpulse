"""Build helpers for the split Android release APKs.

Flutter 3.47 (`FlutterPluginConstants.ABI_VERSION`) assigns each split APK a
version code of `abi_version * 1000 + pubspec build number`:

* armeabi-v7a -> 1
* arm64-v8a -> 2
* x86_64 -> 4 (3 stayed reserved after Flutter removed x86)

The release workflow calls this script instead of inlining the checks.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import os
import re
import stat
import subprocess
import sys
import zipfile
from pathlib import Path

APPLICATION_ID = "ink.euphony.gitpulse"
ANDROID_VERSION_CODE_LIMIT = 2_100_000_000
ABI_VERSION = {
    "armeabi-v7a": 1,
    "arm64-v8a": 2,
    "x86_64": 4,
}
SPLIT_ABIS = ("arm64-v8a", "armeabi-v7a", "x86_64")
PUBSPEC_VERSION = re.compile(r"^version: (\d+\.\d+\.\d+)\+([1-9]\d*)\s*$", re.M)


def flutter_root_from_script() -> Path:
    return Path(__file__).resolve().parent.parent


def max_build_number() -> int:
    return ANDROID_VERSION_CODE_LIMIT - max(ABI_VERSION.values()) * 1000


def split_version_code(abi: str, build_number: int) -> int:
    try:
        abi_version = ABI_VERSION[abi]
    except KeyError as error:
        raise SystemExit(f"Unsupported Android ABI: {abi}") from error
    version_code = abi_version * 1000 + build_number
    if version_code > ANDROID_VERSION_CODE_LIMIT:
        raise SystemExit(
            f"{abi} version code {version_code} exceeds Android's "
            f"{ANDROID_VERSION_CODE_LIMIT} limit."
        )
    return version_code


def read_pubspec_version(root: Path) -> tuple[str, int]:
    pubspec = (root / "pubspec.yaml").read_text(encoding="utf-8")
    match = PUBSPEC_VERSION.search(pubspec)
    if not match:
        raise SystemExit("Expected Flutter version X.Y.Z+N with a positive build number.")
    version, build_number = match.group(1), int(match.group(2))
    if build_number > max_build_number():
        raise SystemExit(
            "The Android build number is too large for split APKs. "
            f"The highest safe value is {max_build_number()}, so x86_64 stays "
            f"within version code {ANDROID_VERSION_CODE_LIMIT}."
        )
    return version, build_number


def escape_property(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("=", "\\=")
        .replace(":", "\\:")
    )


def android_apk_names(version: str) -> list[str]:
    return [f"GitPulse-flutter-v{version}-android-{abi}.apk" for abi in SPLIT_ABIS]


def windows_distribution_names(version: str) -> list[str]:
    prefix = f"GitPulse-flutter-v{version}-windows-x64"
    return [f"{prefix}-setup.exe", f"{prefix}.zip"]


def release_binary_names(version: str) -> list[str]:
    return android_apk_names(version) + windows_distribution_names(version)


def checksum_name(binary_name: str) -> str:
    return f"{binary_name}.sha256"


def sha256_file(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def write_checksum(path: Path) -> None:
    path.with_name(checksum_name(path.name)).write_text(
        f"{sha256_file(path)}  {path.name}\n",
        encoding="ascii",
        newline="\n",
    )


def abis_in_apk(path: Path) -> set[str]:
    with zipfile.ZipFile(path) as apk:
        found = set()
        for name in apk.namelist():
            parts = name.split("/")
            if len(parts) >= 3 and parts[0] == "lib" and parts[1] and not name.endswith("/"):
                found.add(parts[1])
        return found


def _require_env(names: list[str]) -> dict[str, str]:
    values = {}
    missing = []
    for name in names:
        value = os.environ.get(name, "")
        if not value:
            missing.append(name)
        values[name] = value
    if missing:
        raise SystemExit(
            "Missing release signing input: "
            + ", ".join(missing)
            + ". See ../docs/flutter-release.md."
        )
    return values


def _write_private(path: Path, content: bytes | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, str):
        path.write_text(content, encoding="utf-8", newline="\n")
    else:
        path.write_bytes(content)
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)


def write_signing(root: Path) -> None:
    env = _require_env(
        [
            "KEYSTORE_BASE64",
            "GITPULSE_ANDROID_KEYSTORE_PATH",
            "GITPULSE_ANDROID_STORE_PASSWORD",
            "GITPULSE_ANDROID_KEY_ALIAS",
            "GITPULSE_ANDROID_KEY_PASSWORD",
            "EXPECTED_CERT_SHA256",
        ]
    )
    try:
        keystore = base64.b64decode(env["KEYSTORE_BASE64"], validate=True)
    except ValueError as error:
        raise SystemExit("FLUTTER_ANDROID_KEYSTORE_BASE64 is not valid base64.") from error
    if not keystore:
        raise SystemExit("FLUTTER_ANDROID_KEYSTORE_BASE64 decoded to an empty keystore.")
    _write_private(Path(env["GITPULSE_ANDROID_KEYSTORE_PATH"]), keystore)
    properties = "\n".join(
        [
            f"storeFile={escape_property(env['GITPULSE_ANDROID_KEYSTORE_PATH'])}",
            f"storePassword={escape_property(env['GITPULSE_ANDROID_STORE_PASSWORD'])}",
            f"keyAlias={escape_property(env['GITPULSE_ANDROID_KEY_ALIAS'])}",
            f"keyPassword={escape_property(env['GITPULSE_ANDROID_KEY_PASSWORD'])}",
        ]
    )
    _write_private(root / "android" / "key.properties", properties + "\n")


def _build_tools() -> Path:
    tools_root = Path(os.environ["ANDROID_HOME"]) / "build-tools"
    candidates = [path for path in tools_root.iterdir() if re.fullmatch(r"\d+\.\d+\.\d+", path.name)]
    if not candidates:
        raise SystemExit(f"No Android build-tools release found in {tools_root}.")
    return max(candidates, key=lambda path: tuple(int(part) for part in path.name.split(".")))


def _verify_signer(apksigner: Path, apk: Path, expected_sha256: str) -> None:
    signer = subprocess.run(
        [str(apksigner), "verify", "--verbose", "--print-certs", str(apk)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    expected = re.sub(r"[^0-9a-fA-F]", "", expected_sha256).lower()
    digests = {
        re.sub(r"[^0-9a-fA-F]", "", digest).lower()
        for digest in re.findall(r"certificate SHA-256 digest:\s*([0-9a-fA-F:]+)", signer)
    }
    if not re.fullmatch(r"[0-9a-f]{64}", expected) or digests != {expected}:
        print(signer, file=sys.stderr)
        raise SystemExit("APK signer does not match the pinned release certificate.")
    if re.search(r"certificate DN: .*CN\s*=\s*Android Debug", signer, re.I):
        raise SystemExit("A debug certificate is not a release identity.")


def _verify_badging(aapt2: Path, apk: Path, version: str, version_code: int) -> None:
    badging = subprocess.run(
        [str(aapt2), "dump", "badging", str(apk)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.splitlines()[0]
    package = dict(re.findall(r"(\w+)='([^']*)'", badging))
    actual = (package.get("name"), package.get("versionName"), package.get("versionCode"))
    expected = (APPLICATION_ID, version, str(version_code))
    if actual != expected:
        raise SystemExit(
            f"Unexpected APK identity for {apk.name}: {actual}, expected {expected}."
        )


def verify_splits(root: Path) -> None:
    version, build_number = read_pubspec_version(root)
    env = _require_env(["EXPECTED_CERT_SHA256", "RELEASE_VERSION", "RELEASE_BUILD_NUMBER"])
    if env["RELEASE_VERSION"] != version or int(env["RELEASE_BUILD_NUMBER"]) != build_number:
        raise SystemExit("Release version env does not match flutter/pubspec.yaml.")
    tools = _build_tools()
    apk_dir = root / "build" / "app" / "outputs" / "flutter-apk"
    universal = apk_dir / "app-release.apk"
    if universal.exists():
        print(
            "app-release.apk is not a release artifact and will not be uploaded.",
            file=sys.stderr,
        )
    distributions = root / "build" / "distributions"
    distributions.mkdir(parents=True, exist_ok=True)
    for stale in distributions.glob("GitPulse-flutter-v*-android*.apk*"):
        stale.unlink()
    for abi in SPLIT_ABIS:
        apk = apk_dir / f"app-{abi}-release.apk"
        if not apk.is_file():
            raise SystemExit(f"Missing split APK: {apk}")
        packaged_abis = abis_in_apk(apk)
        if packaged_abis != {abi}:
            raise SystemExit(f"{apk.name} contains ABIs {sorted(packaged_abis)}, expected only {abi}.")
        version_code = split_version_code(abi, build_number)
        _verify_signer(tools / "apksigner", apk, env["EXPECTED_CERT_SHA256"])
        _verify_badging(tools / "aapt2", apk, version, version_code)
        artifact = distributions / f"GitPulse-flutter-v{version}-android-{abi}.apk"
        artifact.write_bytes(apk.read_bytes())
        write_checksum(artifact)
        print(f"Verified {artifact.name}; versionCode {version_code}; ABI {abi}")


def verify_checksum_file(directory: Path, binary_name: str) -> None:
    binary = directory / binary_name
    checksum_path = directory / checksum_name(binary_name)
    if not binary.is_file() or not checksum_path.is_file():
        raise SystemExit(f"Missing release file or checksum: {binary_name}")
    line = checksum_path.read_text(encoding="utf-8").strip()
    match = re.fullmatch(r"([0-9a-f]{64})  (\S+)", line)
    actual = sha256_file(binary)
    if not match or match.group(1) != actual or match.group(2) != binary_name:
        raise SystemExit(f"Checksum does not match {binary_name}.")


def assert_release_assets(directory: Path, version: str) -> None:
    expected = []
    for binary_name in release_binary_names(version):
        verify_checksum_file(directory, binary_name)
        expected.extend([binary_name, checksum_name(binary_name)])
    found = sorted(path.name for path in directory.iterdir() if path.is_file())
    if found != sorted(expected):
        raise SystemExit(
            "Release directory does not contain exactly the split Android APKs, "
            "Windows setup, portable ZIP, and their checksums.\n"
            f"Expected: {sorted(expected)}\nFound: {found}"
        )


def validate_version(root: Path) -> None:
    version, build_number = read_pubspec_version(root)
    if os.environ.get("GITHUB_REF_TYPE") == "tag":
        expected = f"flutter-v{version}"
        if os.environ.get("GITHUB_REF_NAME") != expected:
            raise SystemExit(f"The tag must be {expected} and match flutter/pubspec.yaml.")
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8", newline="\n") as handle:
            handle.write(f"version={version}\nbuild_number={build_number}\n")
    print(f"Flutter release version {version}+{build_number}")


def _root(args: argparse.Namespace) -> Path:
    return Path(args.root).resolve() if args.root else flutter_root_from_script()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", help="Flutter project directory. Defaults to flutter/.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("validate-version")
    subcommands.add_parser("write-signing")
    subcommands.add_parser("verify-splits")
    version_code = subcommands.add_parser("version-code")
    version_code.add_argument("--build-number", type=int, required=True)
    assets = subcommands.add_parser("assert-assets")
    assets.add_argument("--dir", required=True)
    assets.add_argument("--version", required=True)

    args = parser.parse_args(argv)
    if args.command == "validate-version":
        validate_version(_root(args))
    elif args.command == "write-signing":
        write_signing(_root(args))
    elif args.command == "verify-splits":
        verify_splits(_root(args))
    elif args.command == "version-code":
        import json

        print(
            json.dumps(
                {abi: split_version_code(abi, args.build_number) for abi in SPLIT_ABIS},
                sort_keys=True,
            )
        )
    elif args.command == "assert-assets":
        assert_release_assets(Path(args.dir), args.version)
    else:
        raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        if error.stdout:
            print(error.stdout, file=sys.stderr)
        if error.stderr:
            print(error.stderr, file=sys.stderr)
        raise SystemExit(error.returncode) from error
