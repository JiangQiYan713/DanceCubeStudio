Unicode True
RequestExecutionLevel user
!include "MUI2.nsh"
!ifndef REPO_URL
!define REPO_URL ""
!endif
!ifndef OUTPUT
!define OUTPUT "DanceCube-Studio-setup.exe"
!endif
Name "DanceCube Studio"
OutFile "${OUTPUT}"
SetCompressor /SOLID lzma
!define MUI_WELCOMEPAGE_TITLE "DanceCube Studio 本地部署"
!define MUI_WELCOMEPAGE_TEXT "检查网络和本机代理后，选择空文件夹与本地端口。安装器使用维护者的 GitHub 源码运行网站，无需管理员权限。\r\n\r\n歌曲、登录与编辑缓存保存在浏览器；本地启动器不会上传这些资料。\r\n\r\n安装器未签名。当前版本需提供源码仓库地址。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "本地部署流程已完成。请保留启动器和目标文件夹，setup.exe 可以删除。若遇到网络或端口错误，请根据提示修复后重新运行。"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
Section "Local deployment"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR\studio"
    File "Launch-Studio.ps1"
    File "Setup-Studio.ps1"
    DetailPrint "检查网络、Git 与目标目录…"
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File "$PLUGINSDIR\studio\Setup-Studio.ps1" -Repository "${REPO_URL}"'
    Pop $0
    StrCmp $0 "0" complete
    MessageBox MB_OK|MB_ICONEXCLAMATION "安装未完成或已取消。请查看错误提示后重试。"
    SetErrorLevel 1
    Quit
complete:
SectionEnd
