import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  test('requires the three split APKs, symbol archive and their matching checksums', () => {
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
          'for name in [*package_android.release_binary_names("1.2.3"), package_android.symbols_archive_name("1.2.3")]:',
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

describe('Flutter Dart debug symbol archive', () => {
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'gitpulse-dart-symbols-'));
    const created = runPython(
      [
        '-c',
        [
          'import sys',
          'from pathlib import Path',
          'import package_android as p',
          'root = Path(sys.argv[1])',
          '(root / "pubspec.yaml").write_text("version: 1.2.3+9\\n")',
          'dist = root / "build" / "distributions"',
          'symbols = root / "build" / "symbols"',
          'dist.mkdir(parents=True)',
          'symbols.mkdir()',
          'for abi, platform in p.SYMBOL_PLATFORMS.items():',
          '    apk = dist / f"GitPulse-flutter-v1.2.3-android-{abi}.apk"',
          '    apk.write_bytes(abi.encode())',
          '    p.write_checksum(apk)',
          '    (symbols / f"app.{platform}.symbols").write_bytes(f"symbols-{abi}".encode())',
        ].join('\n'),
        root,
      ],
      { cwd: toolDir }
    );
    expect(created.status).toBe(0);
    return root;
  }

  function packageSymbols(root: string) {
    return runPython([packageAndroid, '--root', root, 'package-symbols'], {
      env: {
        ...process.env,
        GITHUB_SHA: 'a'.repeat(40),
        GITHUB_RUN_ID: '12345',
        GITHUB_RUN_ATTEMPT: '2',
      },
    });
  }

  test('archives all ABI symbols with build identity and hashes of the matching APKs', () => {
    const root = fixture();
    try {
      const packaged = packageSymbols(root);
      expect(packaged.status).toBe(0);
      const directory = join(root, 'build', 'distributions');
      const archive = join(directory, 'GitPulse-flutter-v1.2.3-android-symbols.zip');
      const inspected = runPython([
        '-c',
        [
          'import sys, json, zipfile',
          'with zipfile.ZipFile(sys.argv[1]) as z:',
          '    print(json.dumps({"manifest": json.loads(z.read("manifest.json")), "files": {n: z.read(n).decode() for n in z.namelist() if n != "manifest.json"}}))',
        ].join('\n'),
        archive,
      ]);
      expect(inspected.status).toBe(0);
      const { manifest, files } = JSON.parse(inspected.stdout);
      expect(manifest).toMatchObject({
        version: '1.2.3',
        build_number: 9,
        commit: 'a'.repeat(40),
        run_id: '12345',
        run_attempt: '2',
      });
      const platforms = {
        'arm64-v8a': 'android-arm64',
        'armeabi-v7a': 'android-arm',
        x86_64: 'android-x64',
      };
      expect(Object.keys(manifest.abis).sort()).toEqual(Object.keys(platforms).sort());
      expect(Object.keys(files)).toHaveLength(3);
      for (const [abi, platform] of Object.entries(platforms)) {
        const name = `app.${platform}.symbols`;
        expect(files[name]).toBe(`symbols-${abi}`);
        expect(manifest.abis[abi]).toEqual({
          apk: `GitPulse-flutter-v1.2.3-android-${abi}.apk`,
          apk_sha256: new Bun.CryptoHasher('sha256').update(abi).digest('hex'),
          symbols: name,
          symbols_sha256: new Bun.CryptoHasher('sha256').update(`symbols-${abi}`).digest('hex'),
        });
      }
      const accepted = runPython([
        packageAndroid,
        'assert-assets',
        '--dir',
        directory,
        '--version',
        '1.2.3',
      ]);
      expect(accepted.status).toBe(0);

      // The release validator must reject a corrupt diagnostic archive too.
      writeFileSync(archive, 'corrupt');
      const rejected = runPython([
        packageAndroid,
        'assert-assets',
        '--dir',
        directory,
        '--version',
        '1.2.3',
      ]);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain('Checksum does not match');
    } finally {
      rmSync(root, { recursive: true });
    }
  });

  test.each(['missing', 'empty'])('rejects %s symbols before creating an archive', (state) => {
    const root = fixture();
    try {
      const symbol = join(root, 'build', 'symbols', 'app.android-arm.symbols');
      if (state === 'missing') rmSync(symbol);
      else writeFileSync(symbol, '');
      const rejected = packageSymbols(root);
      expect(rejected.status).not.toBe(0);
      expect(rejected.stderr).toContain(
        'Missing or empty Dart debug symbols: app.android-arm.symbols'
      );
      expect(
        existsSync(
          join(root, 'build', 'distributions', 'GitPulse-flutter-v1.2.3-android-symbols.zip')
        )
      ).toBe(false);
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});

describe('Flutter release download table', () => {
  test('links the shipped Android APKs and omits a universal APK', () => {
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
    expect(rendered).toContain('Download for Android, by device ABI:');
    for (const filename of [
      'GitPulse-flutter-v1.2.3-android-arm64-v8a.apk',
      'GitPulse-flutter-v1.2.3-android-armeabi-v7a.apk',
      'GitPulse-flutter-v1.2.3-android-x86_64.apk',
    ]) {
      expect(rendered).toContain(
        `https://github.com/pynickle/gitpulse/releases/download/flutter-v1.2.3/${filename}`
      );
    }
    expect(rendered).toContain('alt="APK ARMv8"');
    expect(rendered).toContain('alt="APK ARMv7"');
    expect(rendered).toContain('alt="APK x64"');
    expect(rendered).not.toContain('GitPulse-flutter-v1.2.3-android.apk');
    expect(rendered).not.toContain('windows');
    rmSync(root, { recursive: true });
  });
});
