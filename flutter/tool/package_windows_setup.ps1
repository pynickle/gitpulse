[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'package_windows.ps1')

function ConvertTo-NsisPath([string] $Path) {
    if ($Path -match '["\s]') {
        throw "NSIS paths cannot contain spaces or quotes: $Path"
    }
    return ($Path -replace '\\', '/')
}

function Find-MakeNsis {
    if ($env:MAKENSIS -and (Test-Path -LiteralPath $env:MAKENSIS -PathType Leaf)) {
        return $env:MAKENSIS
    }
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'NSIS\makensis.exe'),
        (Join-Path $env:ProgramFiles 'NSIS\makensis.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'NSIS\bin\makensis.exe'),
        (Join-Path $env:ProgramFiles 'NSIS\bin\makensis.exe')
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return $candidate
        }
    }
    throw 'makensis.exe was not found. The release job installs NSIS 3.13. See docs/flutter-release.md.'
}

$clientRoot = Split-Path -Parent $PSScriptRoot
$pubspec = Get-Content -LiteralPath (Join-Path $clientRoot 'pubspec.yaml') -Raw
$versionMatch = [regex]::Match($pubspec, '(?m)^version: (\d+\.\d+\.\d+)\+([1-9]\d*)\s*$')
if (-not $versionMatch.Success) {
    throw 'pubspec.yaml must declare version: X.Y.Z+N with a positive build number.'
}
$version = $versionMatch.Groups[1].Value
$releaseDirectory = Join-Path $clientRoot 'build/windows/x64/runner/Release'
$distributionDirectory = Join-Path $clientRoot 'build/distributions'
$iconPath = Join-Path $clientRoot 'windows/runner/resources/app_icon.ico'
$scriptPath = Join-Path $clientRoot 'windows/packaging/gitpulse.nsi'
if (-not (Test-Path -LiteralPath $iconPath -PathType Leaf)) {
    throw "Missing Windows icon: $iconPath"
}
New-Item -ItemType Directory -Path $distributionDirectory -Force | Out-Null
$setupPath = Join-Path $distributionDirectory "GitPulse-flutter-v$version-windows-x64-setup.exe"
if (Test-Path -LiteralPath $setupPath) {
    Remove-Item -LiteralPath $setupPath
}
$compiler = Find-MakeNsis
& $compiler @(
    '/INPUTCHARSET'
    'UTF8'
    "/DVERSION=$version"
    "/DSOURCE_DIR=$(ConvertTo-NsisPath $releaseDirectory)"
    "/DOUT_DIR=$(ConvertTo-NsisPath $distributionDirectory)"
    "/DSETUP_ICON=$(ConvertTo-NsisPath $iconPath)"
    (ConvertTo-NsisPath $scriptPath)
)
if ($LASTEXITCODE -ne 0) {
    throw "makensis exited with $LASTEXITCODE."
}
if (-not (Test-Path -LiteralPath $setupPath -PathType Leaf)) {
    throw "NSIS did not write $setupPath."
}
$digest = (Get-FileHash -LiteralPath $setupPath -Algorithm SHA256).Hash.ToLowerInvariant()
"$digest  $(Split-Path -Leaf $setupPath)" | Set-Content -LiteralPath "$setupPath.sha256" -Encoding ascii
Write-Output $setupPath
Write-Output "$setupPath.sha256"
