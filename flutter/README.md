# GitPulse native client

A focused Release Timeline client for Android, with code-level iOS support.
Connect to a compatible self-hosted GitPulse backend; sign in with its enabled
personal-password, PAT or system-browser OAuth provider.

Use the stable Flutter SDK specified in `pubspec.yaml` and the committed
`pubspec.lock`. From this directory:

```sh
flutter pub get --enforce-lockfile
flutter analyze --no-pub
flutter test --no-pub
```

The HTTP contract tests also need Bun and the root backend dependencies. Read
[distribution, platform prerequisites and owner acceptance](../docs/flutter-release.md)
before building or installing. Android runs are the only ones this project
verifies; formal builds require the existing release signing identity, and debug
APKs are development artifacts. Release tags are independent `flutter-vX.Y.Z`.

Native app icons are committed generated assets. See [icon regeneration and
verification](tool/icons/README.md) for the single `uv run` command, source
ownership, platform requirements and owner acceptance.
