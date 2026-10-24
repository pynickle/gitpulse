; Per-user GitPulse installer. The portable ZIP is the same Release directory
; without this wizard. Credentials stay in Windows Credential Manager and
; path_provider storage; uninstall does not delete them.
;
; makensis /INPUTCHARSET UTF8 /DVERSION=X.Y.Z /DSOURCE_DIR=... /DOUT_DIR=... /DSETUP_ICON=...

Unicode true
ManifestDPIAware true

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"

!ifndef VERSION
  !error "VERSION is required."
!endif
!ifndef SOURCE_DIR
  !error "SOURCE_DIR is required."
!endif
!ifndef OUT_DIR
  !error "OUT_DIR is required."
!endif
!ifndef SETUP_ICON
  !error "SETUP_ICON is required."
!endif

Name "GitPulse"
OutFile "${OUT_DIR}\GitPulse-flutter-v${VERSION}-windows-x64-setup.exe"
InstallDir "$LOCALAPPDATA\GitPulse"
InstallDirRegKey HKCU "Software\ink.euphony\GitPulse" "InstallDir"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
BrandingText "GitPulse ${VERSION}"

VIProductVersion "${VERSION}.0"
VIFileVersion "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "GitPulse"
VIAddVersionKey /LANG=1033 "FileDescription" "GitPulse Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1033 "CompanyName" "ink.euphony"
VIAddVersionKey /LANG=1033 "LegalCopyright" "ink.euphony"

!define MUI_ICON "${SETUP_ICON}"
!define MUI_UNICON "${SETUP_ICON}"
!define MUI_ABORTWARNING

!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\gitpulse.exe"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"

LangString ArchRequired ${LANG_ENGLISH} "GitPulse requires 64-bit Windows."
LangString ArchRequired ${LANG_SIMPCHINESE} "GitPulse 需要 64 位 Windows。"
LangString DescApp ${LANG_ENGLISH} "Program files"
LangString DescApp ${LANG_SIMPCHINESE} "程序文件"
LangString DescDesktop ${LANG_ENGLISH} "Desktop shortcut"
LangString DescDesktop ${LANG_SIMPCHINESE} "桌面快捷方式"

Function .onInit
  !insertmacro MUI_LANGDLL_DISPLAY
  ${IfNot} ${RunningX64}
  ${AndIfNot} ${IsNativeARM64}
    MessageBox MB_OK|MB_ICONSTOP "$(ArchRequired)"
    Abort
  ${EndIf}
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
FunctionEnd

Function un.onInit
  !insertmacro MUI_UNGETLANGUAGE
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
FunctionEnd

Section "GitPulse" SecApp
  SectionIn RO
  nsExec::Exec "taskkill /f /im gitpulse.exe"
  Pop $0
  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\GitPulse.lnk" "$INSTDIR\gitpulse.exe"
  WriteRegStr HKCU "Software\ink.euphony\GitPulse" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "DisplayName" "GitPulse"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "DisplayIcon" "$INSTDIR\gitpulse.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "Publisher" "ink.euphony"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "URLInfoAbout" "https://github.com/pynickle/gitpulse"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse" "NoRepair" 1
SectionEnd

Section /o "Desktop shortcut" SecDesktop
  CreateShortcut "$DESKTOP\GitPulse.lnk" "$INSTDIR\gitpulse.exe"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} $(DescApp)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DescDesktop)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Section "Uninstall"
  nsExec::Exec "taskkill /f /im gitpulse.exe"
  Pop $0
  Delete "$SMPROGRAMS\GitPulse.lnk"
  Delete "$DESKTOP\GitPulse.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GitPulse"
  DeleteRegKey HKCU "Software\ink.euphony\GitPulse"
SectionEnd
