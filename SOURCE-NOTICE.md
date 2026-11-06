# 源码与资源说明

DanceCube Studio 是独立的第三方玩家工具。根目录 README 与 dist/LEGAL.md 说明功能、来源与数据边界。

安装器和网站源码不包含用户令牌、个人账号接口响应、浏览器缓存、私有 Git 凭证、官方 APK、官方应用源码或其他工具的可执行文件。默认谱面、音乐、曲绘、Malody 皮肤和测试参考保留原有署名与各自权利；提供源码包不表示取得这些资源的再分发许可，也不替整个目录另行授予未经确认的开源许可。

Windows 安装器以 NSIS 构建；NSIS 运行时、安装桩与界面资源按其许可允许用于安装器，见 https://nsis.sourceforge.io/License 。没有捆绑 Git 二进制：缺少本地 Git 时，从 git-for-windows/git 的官方 GitHub Release 下载 PortableGit，验证 Release 返回的 SHA-256 摘要后解压；其许可文件一并保留在目标 git 目录，见 https://github.com/git-for-windows/git 。不修改系统代理设置。

.github/workflows/release.yml 可在维护者选定的 GitHub 仓库构建安装器与源码包；标签 v* 才创建 GitHub Release，手动运行只生成可下载构建产物。构建时自动绑定该仓库 URL。不得把本工具的托管凭据或浏览器数据提交到 GitHub。

5.0 手谱转换使用现有内置皮肤作本地匹配参考，不新增外部视觉模型、远程视频上传服务或第三方 API。合成 QA 录像不随网站分发；用户选择的视频也不会被打包为源码或站点资源。
