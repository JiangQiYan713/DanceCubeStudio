# DanceCube Studio

经典六键与秀谱同屏制谱工具，应用版本为 4.0.0。编辑、频谱分析、BPM / Offset 测量、自动写谱及节拍音在浏览器本地运行，无需外部 AI 接口。账号中心按需连接舞立方官方服务。

## 使用入口

- `dist/README.md`：面向玩家的使用指南。
- `dist/DEVELOPMENT.md`：数据格式、时间计算、模块职责与维护方式。
- `dist/LEGAL.md`：第三方关系、资料来源、存储与连接说明。
- `dist/plan.MD`：已知问题与待规划功能，仅作展示。
- `installer/README.md`：Windows 本地安装器的运行与构建。
- `SOURCE-NOTICE.md`：源码与资源权利说明。

网页顶部“指南 / 开发 / 计划 / 法律”分别按点击读取外部 Markdown，不在启动时预加载。

## 本地运行

网站为无需构建的静态 HTML / CSS / JavaScript。将 `dist/` 作为 HTTP 服务根目录，例如：

```sh
python -m http.server 8964 --directory dist
```

在浏览器打开 `http://localhost:8964/`。请使用 HTTP 服务，直接双击 HTML 无法可靠使用 Worker、资源读取与持久存储。换域名、端口或浏览器前先导出 ZIP、配方和网页设置。

## 关键行为

谱面以 BPMList 和 Offset 映射音乐时间。经典轨道为 123654，秀谱增加 ABCDEF，可选择分离滑条为 18 轨。编辑器保留第 -8 拍至 0 拍的只读预卷，重新播放从 -8 拍开始。

物量采用固定 0.2 秒间隔：单点为 1；长条和整根滑条为 `1 + floor(时长秒数 / 0.2)`，滑条乘堆叠数；假键为 0。Combo 随音乐时间累计物量。目标帧率仅有 60 / 120 FPS，实际受设备限制。节拍音使用 Web Audio 时间调度，可上传音效并分别校准文件起音及设备延迟。

原生 ZIP 保留假键、秀谱元素、BPMList 与 Effect。MCZ 为经典投影，存在假键或秀谱内容时需确认兼容性损失。TXTpack 包含机台 TXT 和回读元数据；秀谱默认不输出 SV。

## 检查

```sh
node tests/core.cjs
node tests/analysis.cjs
node tests/timing.cjs
node tests/skin.cjs
node tests/beat40.cjs
node tests/units382.cjs
```

完整检查目录、DOM 依赖及音频验证边界见 `dist/DEVELOPMENT.md` 与 `docs/testing.md`。自动检查不能替代真实浏览器听感、Malody 回导、舞立方机台、官方账号与实体 Windows 验收。

## 维护

大版本变更时系统整理文档；小版本默认只更新代码、测试与应用版本号，不重复维护 Markdown。维护者另有明确要求时按要求处理。文档按功能组织，不维护逐版本更新流水账。计划页面只作信息展示，其中条目不自动成为开发任务。
