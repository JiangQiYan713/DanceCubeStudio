# Windows 本地安装器

支持 Windows 10/11 的 Windows PowerShell 5.1、.NET 和默认浏览器。安装器无需管理员权限，不安装系统服务，不修改防火墙或系统代理。当前构建未签名，尚未在实体 Windows 完整验收。

setup.exe 先检查系统代理配置及少量常用本机 HTTP 代理端口，只有能通过 HTTPS 访问 GitHub 的代理才用于当前进程。不会扫描局域网；SOCKS-only / 需要认证的代理暂不自动接入。若没有可用代理则尝试直连；失败会显示原因，不会绕过网络访问控制。

用户选择空文件夹，再选择本地端口（默认8964，范围1024–65535）。复用已安装 Git，或下载官方 PortableGit 并用 Release API 的 SHA-256 摘要校验后解压到目标目录。仅接受 https://github.com/owner/repo 仓库地址；目标包含 source、可选 git、studio-config.json、Launch-Studio.ps1 与 Start-DanceCube.bat。

以后双击 BAT，会先检查上游，初次 clone，已有仓库 fetch 并只允许 fast-forward 更新。存在本地改动、分支分叉、来源不一致或网络失败时停止并保留文件，不用 reset --hard 覆盖。默认跟随 clone 的上游分支；私有仓库需要用户自己在 Git 中建立有效访问权限，安装器不保存 GitHub token。

网站以本机静态服务开放在 http://localhost:8964/，支持音频 Range / HEAD。启动器窗口关闭后网站停止。端口可在 studio-config.json 修改；浏览器缓存按来源隔离，换端口之前先导出歌曲和模板。此安装器不迁移在线站点的浏览器缓存。

## 构建与发布

安装 NSIS 3 后：

```sh
STUDIO_REPOSITORY=https://github.com/OWNER/REPO installer/build.sh
```

省略仓库变量会构建通用准备版，启动时要求填写维护者提供的仓库 URL。PowerShell脚本保存为UTF-8 BOM以兼容5.1。产物为 release/DanceCube-Studio-setup.exe；不要在未绑定目标仓库时将它宣称为安装即用的正式发布版。

仓库内 GitHub Actions 可在手动触发时产生构建产物，在 v* 标签推送时生成 GitHub Release。需仓库 contents:write 权限。正式发布前在 Windows 验证代理/直连、首次 clone、二次更新、端口占用、路径含中文/空格、媒体跳转和浏览器持久化，再配置代码签名。
