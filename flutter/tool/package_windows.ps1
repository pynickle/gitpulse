[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$clientRoot = Split-Path -Parent $PSScriptRoot
$pubspec = Get-Content -LiteralPath (Join-Path $clientRoot 'pubspec.yaml') -Raw
$versionMatch = [regex]::Match($pubspec, '(?m)^version: (\d+\.\d+\.\d+)\+([1-9]\d*)\s*$')
if (-not $versionMatch.Success) {
    throw 'pubspec.yaml must declare version: X.Y.Z+N with a positive build number.'
}
$version = $versionMatch.Groups[1].Value
$buildNumber = $versionMatch.Groups[2].Value
$releaseDirectory = Join-Path $clientRoot 'build/windows/x64/runner/Release'
$requiredFiles = @(
    'gitpulse.exe',
    'flutter_windows.dll',
    'flutter_secure_storage_windows_plugin.dll',
    'url_launcher_windows_plugin.dll',
    'msvcp140.dll',
    'vcruntime140.dll',
    'vcruntime140_1.dll',
    'data/app.so',
    'data/icudtl.dat',
    'data/flutter_assets/AssetManifest.bin'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $releaseDirectory $relativePath) -PathType Leaf)) {
        throw "Incomplete Windows release directory: missing $relativePath. Run flutter build windows --release."
    }
}
$executable = Get-Item -LiteralPath (Join-Path $releaseDirectory 'gitpulse.exe')
if ($executable.VersionInfo.ProductVersion -ne "$version+$buildNumber") {
    throw 'The Windows executable version differs from pubspec.yaml. Rebuild before packaging.'
}
$distributionDirectory = Join-Path $clientRoot 'build/distributions'
New-Item -ItemType Directory -Path $distributionDirectory -Force | Out-Null
$archivePath = Join-Path $distributionDirectory "GitPulse-flutter-v$version-windows-x64.zip"
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($releaseDirectory, $archivePath)
$digest = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
"$digest  $(Split-Path -Leaf $archivePath)" | Set-Content -LiteralPath "$archivePath.sha256" -Encoding ascii
Write-Output $archivePath
Write-Output "$archivePath.sha256"
