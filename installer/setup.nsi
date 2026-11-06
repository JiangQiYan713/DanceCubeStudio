Unicode True
RequestExecutionLevel user
!include "MUI2.nsh"
!ifndef REPO_URL
!define REPO_URL ""
!endif
!ifndef OUTPUT
!define OUTPUT "DanceCube-Studio-setup.exe"
!endif
Name "DanceCube Studio 1.0.0"
VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "DanceCube Studio Installer"
VIAddVersionKey /LANG=2052 "ProductVersion" "1.0.0"
VIAddVersionKey /LANG=2052 "FileVersion" "1.0.0.0"
VIAddVersionKey /LANG=2052 "FileDescription" "DanceCube Studio 本地安装器"
VIAddVersionKey /LANG=2052 "LegalCopyright" "DanceCube Studio"
OutFile "${OUTPUT}"
SetCompressor /SOLID lzma
!define MUI_WELCOMEPAGE_TITLE "DanceCube Studio 1.0.0 本地部署"
!define MUI_WELCOMEPAGE_TEXT "先选择空文件夹与本地端口，再检查网络和本机代理。安装器使用维护者的 GitHub 源码运行网站，无需管理员权限。\r\n\r\n歌曲、登录与编辑缓存保存在浏览器；本地启动器不会上传这些资料。\r\n\r\n卸载：关闭启动器后，直接删除整个安装目录；桌面快捷方式请手动删除。\r\n\r\n安装器未签名。请确保可以访问源码仓库。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "本地部署流程已完成。请保留启动器和目标文件夹，setup.exe 可以删除。\r\n\r\n卸载方法：关闭启动器后，直接删除整个安装目录。如有桌面快捷方式，请手动删除。安装目录内有“卸载说明.txt”。"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
Section "Local deployment"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR\studio"
    File "Launch-Studio.ps1"
    File "Setup-Studio.ps1"
    DetailPrint "打开独立安装窗口，请完成目录与端口选择…"
    ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File "$PLUGINSDIR\studio\Setup-Studio.ps1" -Repository "${REPO_URL}"' $0
    StrCmp $0 "0" complete
    MessageBox MB_OK|MB_ICONEXCLAMATION "安装未完成或已取消。请查看错误提示后重试。"
    SetErrorLevel 1
    Quit
complete:
SectionEnd
