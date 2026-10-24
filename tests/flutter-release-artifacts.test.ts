import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..');
const toolDir = join(repoRoot, 'flutter', 'tool');
const packageAndroid = join(toolDir, 'package_android.py');
const releaseNotes = join(toolDir, 'flutter_release_notes.py');

function pythonCommand(): string {
  for (const command of ['python3', 'python']) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) {
      return command;
    }
  }
  throw new Error('Python 3.11 or newer is required to test the Flutter release scripts.');
}

const python = pythonCommand();

function runPython(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(python, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
  });
  return result;
}

describe('Flutter split APK version codes', () => {
  test('uses the Flutter 3.47 ABI multipliers', () => {
    const result = runPython([packageAndroid, 'version-code', '--build-number', '7']);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      'arm64-v8a': 2007,
      'armeabi-v7a': 1007,
      x86_64: 4007,
    });
  });
});

describe('Flutter release version validation', () => {
  test('accepts a matching flutter tag and rejects an oversized build number', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-flutter-version-'));
    const output = join(root, 'github-output.txt');
    writeFileSync(join(root, 'pubspec.yaml'), 'name: gitpulse\nversion: 1.2.3+9\n', 'utf8');

    const accepted = runPython([packageAndroid, '--root', root, 'validate-version'], {
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        GITHUB_REF_NAME: 'flutter-v1.2.3',
        GITHUB_REF_TYPE: 'tag',
      },
    });

    expect(accepted.status).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe('version=1.2.3\nbuild_number=9\n');

    writeFileSync(
      join(root, 'pubspec.yaml'),
      'name: gitpulse\nversion: 1.2.3+2099996001\n',
      'utf8'
    );
    const rejected = runPython([packageAndroid, '--root', root, 'validate-version']);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('2099996000');
    rmSync(root, { recursive: true });
  });

  test('rejects a tag that does not match pubspec.yaml', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-flutter-tag-'));
    writeFileSync(join(root, 'pubspec.yaml'), 'name: gitpulse\nversion: 1.2.3+9\n', 'utf8');
    const rejected = runPython([packageAndroid, '--root', root, 'validate-version'], {
      env: {
        ...process.env,
        GITHUB_REF_NAME: 'flutter-v9.9.9',
        GITHUB_REF_TYPE: 'tag',
      },
    });

    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('flutter-v1.2.3');
    rmSync(root, { recursive: true });
  });
});

describe('Android signing properties', () => {
  test('escapes Gradle special characters and writes a private keystore', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-android-signing-'));
    const keystorePath = join(root, 'release.jks');
    const result = runPython([packageAndroid, '--root', root, 'write-signing'], {
      env: {
        ...process.env,
        EXPECTED_CERT_SHA256: 'ab',
        GITPULSE_ANDROID_KEY_ALIAS: 'release',
        GITPULSE_ANDROID_KEY_PASSWORD: 'secret',
        GITPULSE_ANDROID_KEYSTORE_PATH: keystorePath,
        GITPULSE_ANDROID_STORE_PASSWORD: 'a=b:c\\d\ne',
        KEYSTORE_BASE64: Buffer.from('keystore-bytes').toString('base64'),
      },
    });

    expect(result.status).toBe(0);
    expect(readFileSync(keystorePath)).toEqual(Buffer.from('keystore-bytes'));
    expect(readFileSync(join(root, 'android', 'key.properties'), 'utf8')).toContain(
      'storePassword=a\\=b\\:c\\\\d\\ne\n'
    );
    rmSync(root, { recursive: true });
  });
});

describe('Flutter release assets', () => {
  test('requires the three APKs, setup, portable ZIP, and matching checksums', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-release-assets-'));
    const directory = join(root, 'distributions');
    const created = runPython(
      [
        '-c',
        [
          'import sys',
          'from pathlib import Path',
          'import package_android',
          'directory = Path(sys.argv[1])',
          'directory.mkdir()',
          'for name in package_android.release_binary_names("1.2.3"):',
          '    path = directory / name',
          '    path.write_bytes(name.encode())',
          '    package_android.write_checksum(path)',
        ].join('\n'),
        directory,
      ],
      { cwd: toolDir }
    );
    expect(created.status).toBe(0);

    const accepted = runPython([
      packageAndroid,
      'assert-assets',
      '--dir',
      directory,
      '--version',
      '1.2.3',
    ]);
    expect(accepted.status).toBe(0);

    writeFileSync(join(directory, 'GitPulse-flutter-v1.2.3-android.apk'), 'universal');
    const rejected = runPython([
      packageAndroid,
      'assert-assets',
      '--dir',
      directory,
      '--version',
      '1.2.3',
    ]);
    expect(rejected.status).not.toBe(0);
    expect(rejected.stderr).toContain('GitPulse-flutter-v1.2.3-android.apk');
    rmSync(root, { recursive: true });
  });

  test('reads only the ABI directories stored in an APK', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-apk-abis-'));
    const apk = join(root, 'sample.apk');
    const result = runPython(
      [
        '-c',
        [
          'import sys, zipfile',
          'import package_android',
          'with zipfile.ZipFile(sys.argv[1], "w") as apk:',
          '    apk.writestr("lib/arm64-v8a/libapp.so", b"arm64")',
          '    apk.writestr("lib/x86_64/", b"")',
          'print(",".join(sorted(package_android.abis_in_apk(__import__("pathlib").Path(sys.argv[1])))))',
        ].join('\n'),
        apk,
      ],
      { cwd: toolDir }
    );

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('arm64-v8a');
    rmSync(root, { recursive: true });
  });
});

describe('Flutter release download table', () => {
  test('links the shipped Android and Windows files and omits a universal APK', () => {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-release-notes-'));
    const notes = join(root, 'notes.md');
    const body = join(root, 'body.md');
    writeFileSync(notes, '## Changes\n\n- Timeline filters\n', 'utf8');
    const result = runPython([
      releaseNotes,
      '--version',
      '1.2.3',
      '--notes',
      notes,
      '--output',
      body,
      '--repository',
      'pynickle/gitpulse',
    ]);

    expect(result.status).toBe(0);
    const rendered = readFileSync(body, 'utf8');
    expect(rendered).toContain('## Changes');
    expect(rendered).toContain('Download based on your OS:');
    for (const filename of [
      'GitPulse-flutter-v1.2.3-android-arm64-v8a.apk',
      'GitPulse-flutter-v1.2.3-android-armeabi-v7a.apk',
      'GitPulse-flutter-v1.2.3-android-x86_64.apk',
      'GitPulse-flutter-v1.2.3-windows-x64-setup.exe',
      'GitPulse-flutter-v1.2.3-windows-x64.zip',
    ]) {
      expect(rendered).toContain(
        `https://github.com/pynickle/gitpulse/releases/download/flutter-v1.2.3/${filename}`
      );
    }
    expect(rendered).toContain('alt="APK ARMv8"');
    expect(rendered).toContain('alt="Setup x64"');
    expect(rendered).toContain('alt="Portable x64"');
    expect(rendered).not.toContain('GitPulse-flutter-v1.2.3-android.apk');
    expect(rendered).not.toContain('macos');
    rmSync(root, { recursive: true });
  });
});
