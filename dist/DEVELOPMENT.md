# DanceCube Studio 开发文档

## 架构与维护原则

应用为纯静态 HTML / CSS / JavaScript，发布目录 `dist/`，无需构建或第三方脚本 CDN。Web Audio 解码音乐并作为播放时钟，FFT / BPM 候选在本地 Worker 运行。账号模块按需直连官方服务，无后台代理、账号同步或外部 AI。HTTP 服务用于 Worker、fetch 与浏览器持久存储，不能依赖 file:// 打开。

大版本更新时按功能整理全部 Markdown；后续小版本默认不更新 Markdown，除非维护者额外说明。文档描述当前完整行为，避免逐版本流水账。`plan.MD` 只作计划展示，其内容不自动成为开发范围。

维护核心约束：先验证再修改 live chart；非法操作不能留下一半数据；假键不计物量；BPM 与 Effect 分开；未知原始字段尽量保留；不在源码、日志、测试或导出物中保存账号 token 和个人接口响应。

## 模块职责

| 模块 | 职责 |
| --- | --- |
| core.js | MC 与拍数组、BPM 积分、校验、镜像、ZIP 读写 |
| project.js / local-library.js | 多歌曲别名、迁移、资源隔离、删除事务与缓存回收 |
| show.js / show-editor.js | 秀谱规范、TXT / ZIP、12 / 18 轨编辑、滑条堆叠与降级备份 |
| units.js | 固定 0.2 秒物量索引，实时 Combo、总物量及大整数 |
| beat-sound.js | 四种本地音效、上传起音分析、Web Audio 定时与取消 |
| analysis-worker.js / timing.js | FFT、RMS、频带、频谱通量、BPM / 相位及分段估计 |
| rhythm.js | 网格采音、双手生成约束、预览索引与预加载桶 |
| formats.js | MC2TXT 折算、合并同类、TXT / SV 反向映射与回读清单 |
| skin.js / mui.js | 图集、UIS 支持子集、MUI 类型表单、末尾注释 |
| preview-shared.js / preview-assets.js / preview-calibration.js | 内外圈共用几何、运动、特效、贴图与前缘对齐 |
| show-preview.js | 内圈、滑条、外框旋转与经典皮肤的联合渲染 |
| settings-core.js / web-settings.js | 设置规范、条件校验、独立媒体与配置迁移 |
| account-core.js / account.js | 固定官方来源、登录 Vault、商店、背包与入库 |
| account-profile.js / account-resources.js / account-people.js | 资料设置、道具图、玩家只读入口 |
| recipes.js / recipes-ui.js | 配方格式、原子插入与本机模板库 |
| docs.js | 转义 Markdown、允许的链接、表格与默认收起的作者条目 |
| app.js | 会话协调、历史、播放时钟、共享采音绘制、主 Canvas、文档按需读取 |

## 会话与资源隔离

```json
{
  "format": "dc-studio-3",
  "songs": [{"id":"…","song":{},"charts":[],"activeChartId":"…","view":{},"assetPrefix":"song-id/","expanded":true,"chartExpanded":{}}],
  "activeSongId": "…",
  "settings": {},
  "song": {}, "charts": [], "activeChartId": "…", "view": {}
}
```

末尾四项是当前歌曲的兼容别名。切换和序列化前 `DCProject.sync`；读取和历史恢复后 `normalize / activate` 重新建立引用。历史不能只克隆表层。各歌资源独立前缀，导出单歌去掉前缀，多歌曲导出用目录和 `dc-library-1` 清单隔离同名文件。

旧 dc-studio-2 缓存迁移时将视野数值减半保留旧范围；规范视野为 `112 * zoom / 100` CSS pixel / 拍，zoom 1—400。已有音符拍数组尽量原样保留。项目格式号与应用语义版本独立，不因应用更新随意改格式标记。

歌曲与难度删除走 IndexedDB 原子事务，按作用域清理 package、媒体、分析与 session；共享资源不能误删。删除前要求已保存确认，可先导出。删除递增库 revision，失效旧异步写入并清空历史，最后一首删除后创建空白工作区。

## 拍数、时间和流速

MC 拍数组 `[integer,numerator,denominator]` 分母为正，输入要求分子小于分母。`parseBeat` 接受小数与数组，`beatParts` 整数默认分母 4。连续显示取最近 1/64，不回写音符。内核使用 Number 积分，不能宣称完全有理数无误差；生成数组用既有 61440 分母有理化。

```
rawTime(b) = BPMList 分段积分，每拍秒数 60 / BPM
songTime(b) = rawTime(b) - rawTime(audioBeat) - offset / 1000
flight = 2.5 / noteSpeed
previewDistance = 基础速度 × Effect.scroll 对音乐时间的积分
```

编辑器网格拍距不随 BPM 改变。演出不能再乘当前 BPM / 初始 BPM。保留零与负 Effect.scroll，预览查询须考虑反向段。网页流速为 1—12；账号机台速度为官方参数，按接口返回 / 提交比例处理，不能直接互当同一量。

## 预卷与编辑保护

最小可定位拍数为 -8。`minTime()` 使用当前 BPM / Offset 映射，不能用固定 -4 秒替代。最小视图 bottom 额外减去预览线以下的可视拍数，使预览线能在用户设定高度抵达 -8。网格从 max(-8,visibleBottom) 绘制；0 到 -8 区域用灰色 alpha 0.2 蒙版，预览线最后绘制在蒙版之上。

`gridPoint / DCShowEdit.point` 同时返回 rawBeat 与吸附 beat。写入、擦除与右键操作先检查 rawBeat；负数 -0.01 即使吸附到 0 也不得修改 0 拍音符。长条 / 滑条拖画任一端 rawBeat < 0 时取消整次写入；复制、配方与属性也必须通过非负规范检查。框选与预览导航不受写入限制。

`seek` 可定位 minTime 至总时长。restart 暂停、回到 -8 再播放；stop 回到 -8 并暂停。音频尚未到 0 时，BufferSource 延后启动，不能用立即 `start(0,max(0,position))` 提前播放音乐。

## 音频时钟与节拍音

播放使用同一 AudioContext epoch：

```
visualPosition = startPosition + max(0,ctx.currentTime - epoch) * rate
music.start(epoch + max(0,-startPosition)/rate, max(0,startPosition))
clickTime = epoch + (event.songTime-startPosition)/rate - totalDelayMs/1000
totalDelayMs = delay1Ms + delay2Ms
```

epoch 留出至少 40 ms 安排时间；正补偿较大时相应扩大提前量，使起始位置的 click 也能提前安排。等待 epoch 时视觉位置保持起点。节拍音不改变播放速率，因此起音延迟保持现实毫秒，不随音乐 rate 改变。

`DCBeatSound.events` 合并四个预卷拍 -2、-1.75、-1.5、-1.25 与所有非假键音符头部，按拍去重。slides 用整根链头，续段、尾部和物量 tick 不生成音效。音效与 grid 时间一致，不读取图片包围盒、消失距离或像素偏移。

Player 使用 25 ms 定时器向前安排 150 ms 的 Web Audio BufferSource；不以 requestAnimationFrame 决定声音触发。若线程迟到超过容差，跳过过期声音，避免集中补响。pause、seek、切歌与重新播放必须 stop 定时器和全部已调度 voice，包括尚未开始的节点。音乐源同样支持取消未来启动。

四个内置音效用本地采样合成。自定义音效上限 10 MB / 10 秒，由本地 decodeAudioData 解码。自动起音测量采用约 1 ms RMS 窗与相对峰值阈值，拒绝近静音文件，输出一级毫秒值。它不测量硬件输出延迟；二级由用户听感调整。音效独立 Gain 后接主音量，试听不提交设置。

`settings.beatSound` 包含 enabled、type、volume、delay1Ms、delay2Ms、autoCalibrate、customName。内置音效一级有效值为 0，自定义一级仍保留以便切回。音效原文件存 `web-beatSound`，不写入歌曲 assets 或原生 ZIP。

## 物量索引

固定间隔为 `12/60 = 0.2` 秒，已取消可调实验模型。normalize 将历史 unitModel 统一为 duration、holdTickFrames 设 12，移除全局网格参数；旧 JSON 不能启用过时拟合。

单点为 1，假键为 0；长条为 `1+floor(duration/.2)`，整根滑条从首段起点到最后续段结束累计，再乘 stack。内圈同规则。BPM 分段积分得到持续时间，Offset / audioBeat 平移事件但不改变总物量，Effect / rate / FPS 不改变总数。

UnitIndex 用头部前缀、已结束长条 tick 前缀和活跃区间树查询当前位置，支持反向 seek；不逐帧展开每个判定点或每层堆叠。权重与前缀用 BigInt，大于安全整数时返回十进制字符串。默认参考 17 级为 1606 个真实头部、总物量 1900；保留短于 0.2 秒的正长条，不能为目标总数改写原谱。

缓存按图表对象、notes / shownotes / timings 引用与 BPM / Offset / audioBeat 签名失效。经典和秀谱总物量、预览 Combo 使用同一实例；编辑后替换或规范化引用并重建，避免统计停留在第一次下载。

## 秀谱数据与编辑

经典音符保存在 notes，内圈与滑条保存在同一难度 JSON 的 shownotes。内圈从 A 正上方开始逆时针。经典显示顺序 123654，分离滑条时外圈、滑条、内圈各六列。

```json
{"shownotes":[
  {"id":"inner","kind":"tap","position":"A","beat":[2,0,4],"end":null},
  {"id":"chain","kind":"slide","position":"4","beat":[0,0,4],"segments":[{"id":"s1","direction":"L","angle":180,"end":[3,0,4]}],"stack":2}
]}
```

规范化按 slideKey 合并完全相同链，stack 可为安全整数或十进制大整数字符串。单击擦除 one=true 减 1，框选删除去整组。不要为 n 堆叠创建 n 份对象。未知语法及原始 TXT / SV 留存，不冒充已支持的可编辑语义。

滑条 slidePath 在无限延伸的六列虚拟空间维持方向，slideSegments 在每个六列边界切分并镜像平移。跨界桥接保持同拍水平、细线低 alpha；粗段保持同斜率。绘制、命中与框选共用切分几何，桥接线不命中。滑条头部强调；不得进入内圈区域。

经典 / 内圈联合检查真实同类同起同止以着色，假键独立分组。内圈单押绿、多押品红，普通内圈音符不默认半透明；收缩提示圆环单独为低 alpha。秀谱外框跟随滑条旋转，滑条渲染保留自己的算法，经典部分复用经典运动与皮肤特效。

升级经典恢复已有备份或创建空 shownotes；降级将秀谱元素移到 showBackup，保留经典外圈、BPMList 与 effect。每次类型变更要求确认并可撤销。MCZ 导出为最小经典投影并提示损失，不能把 Malody 未识别元素混入标准 notes。

## 分析与自动生成

Worker 用 Hann 窗 FFT、RMS、频带正向对数谱通量与局部峰值。频率边界为整曲能量累计的 0.05%—99.95%，用于抗噪，不是绝对非零声学极值。时间 / 频带 / 敏感度共同决定网格候选，粗网格优先，三连音需邻近支持。

候选保存 observedTime、time、errorMs、division 与数组标签。编辑器、候选表、时间轴、生成器都读同一份结果；修改 BPM / Offset / 频带须更新网格。app 的 drawAnalysis 由经典和秀谱共用，禁止各自复制一套算法而结果不一致。showHooks.hover 使用相同拍数与带符号音频时间。

生成器创建新经典难度，原谱保留；等级控制最短间隔、每秒预算、细分及九种配置权重。默认两手占用限制，长条占用对应手区，预留换手与同轨释放间距；密集片段倾向长条，allowMulti 才放宽多押。100 级是极端密度，不代表官方定级。秀谱自动生成暂禁用，但本地音频分析可用。

## 格式转换

TXT 算法参考用户提供的 JiangQiYan713 MC2TXT，测试参考代码独立保留署名。以初始 BPM 为 base，将 rawTime 转成 base 拍，减首事件位置，再保留两位小数。Offset 影响音频首事件，不重复加到相对拍内。

经典单点 `轨道-开始`，长条 / 假键 `轨道-开始-结束`。同类合并以相同输出开始和结束文本为键，降序连接轨号；假键三段式不与真实单点混合。SV 为相对拍、scroll。TXTpack 的 `dc-txtpack-1` 清单记录原映射帮助回读，纯 TXT 必须手动补基准 BPM 和首事件时间。

秀谱内圈 A—F 同普通格式。滑条 `起轨 L/R 角度-起点-终点`，续写 `0 L/R 角度-终点`，续段紧邻不间断。规范 ZIP 使用 dc-show-package-2 清单与每难度 JSON；兼容读取旧事件清单。秀谱 TXT 默认不输出 SV；强制开启需明确阅读官方不支持秀谱变速的提示。完整 ZIP 保留 effect。

## 预览、皮肤与性能

PreviewIndex 按滚动积分排序，二分查找可见候选，并合并活跃长条，考虑区间全部 Effect 节点。预加载以 250 ms 桶存候选，支持负时间桶，范围覆盖 -8 预卷。谱面 / 速度变更递增 generation 取消旧任务；全曲或线前后 10 秒分别预热索引、候选与皮肤。

目标 FPS 仅 60 / 120，默认 120；历史 144 规范为 120。requestAnimationFrame 前台采样用于设备限制，不把采样值当硬件能力保证。无高刷新能力时禁用预加载；音效仍在 AudioContext 时钟独立调度。

皮肤采用实际图集去裁边 / 旋转 / 原始尺寸恢复，识别已核验的 UIS 子集。HitFX / LightX 按 bg-0 轮廓对齐，音符消失按时间截断；普通单点与长条头在出现期放大，运动中尾巴持续存在。Combo 用 combo 字体，num 字体不替代。MUI 表单区分必需 / 可选字段和类型，注释合并置末尾，网页专用字段可本地保存或写入尾注，不执行任意皮肤动作代码。

## 网页设置与独立媒体

DCSettings.normalize 只接受有限数值与白名单枚举，颜色支持 #RGB / #RRGGBB / #RRGGBBAA。四个面板不透明度默认 70%；线条独立配置；外圈 / 内圈消失点、生成点、长条特效以 CSS pixel 偏移，不修改音符时间。

表单 novalidate，主动 collect 只校验当前启用分支；选填数值为空沿用原值。背景本地 / URL 二选一，非活动主题色、缩放与未用模型不应阻止提交。无效活动字段展开所在 details 并聚焦。不要恢复整表 required 检查。

默认设置从 assets/web-defaults.json 读取后规范化。本地背景 web-background、网页光标 web-cursor 与节拍音 web-beatSound 独立于歌曲。配置 dc-web-settings-1 只导出允许键，mediaRefs 为 name / MIME / size / CRC32；可选 base64 嵌入。导入先校验、准备媒体，再原子持久化并应用，失败回滚原状态 / 媒体；缺失光标回退当前皮肤，缺失音效回退适中并提示，缺失活动本地背景提示补文件。

默认网页壁纸用随站副本并禁网隔离；外部网页背景沙箱显示，不注入账号数据。恢复网页默认不清理歌曲、模板、账号；全部重置清空相应 IndexedDB 并退出本机登录。设置 JSON 永不包含凭据。

## 账号、商店与资源边界

官方 API 固定基址 `https://dancedemo.shenghuayule.com/Dance`。token 仅发往固定 API，不附在外部媒体请求，不放 URL、日志或谱包。Vault 使用独立 localStorage，截止取官方有效期与创建后 7 天较早值。401 / invalid_token 清理，短信 / 图形码仅在内存。扫码非重叠轮询，关闭取消；第三方站点不伪造微信运行环境或 OAuth 回调。

显式歌曲 ID 调 MusicData/GetGoodsInfo；曲名与谱师分别处理，不以纯数字自动识别意图。完整目录检索分批且标注范围，未完成保持部分状态。实际等级取 MusicLevel，MusicLevNew 是档位；0 级合法，null / 未提供才未知。共享歌曲 ID 无自制详情时不标自制，网络失败不等于不存在。

详情串行限流、TTL / 容量上限与取消信号防止请求风暴。切页使旧任务失效，列表显示进度。媒体 / 谱面失败分开，CORS、网络及登录权限不能通过猜测 URL 或附带 token 绕过。已下架但官方仍允许下载的资源可入库，不能推断所有下架资源均可读取。

资料与设置只呈现官方字段；战力曲线预载后绘制时间轴，双荣誉分区。机台参数按 ParamType 选择请求语义，数值允许有限实数，不擅自限范围或为缺失项合成全快照。保存按钮才执行账号写入。道具按官方分类原图展示 / 下载，网页光标预览与真实装备分开。

成绩查询、收藏官谱列表、道具光标兼容、玩家名称匹配、战队设置与订单明细有已知限制，见 plan.MD。相关函数存在不等于整个官方功能可用。当前任务只展示计划，不为这些条目添加接口。

## 存储、配方和文档

IndexedDB 库 `dancecube-studio-v2` 的 store 保存 session、assets、skin、analysis:*、package:<songId>、recipes 与 web-*。localStorage 备份会话并独立存 Vault。歌曲 ZIP 停顿后生成，播放时延后，视图变化不重复打包。配额失败保留现有状态并提供导出，不自动删用户文件。

dc-recipe-1 为相对拍音符，dc-recipe-library-1 为集合。模板只保留六键音符 / 起止数组及描述，不保存音频、BPMList、Effect、未知原始字段或凭据。上限 500 份 / 8 MB / 每份 20000 音符；插入支持缩放、镜像、重复，先验证碰撞再建一次撤销记录。负拍目标直接拒绝，不夹到 0。

README.md、DEVELOPMENT.md、plan.MD、LEGAL.md 只在对应按钮点击后 fetch，data-file 隔离竞态。docs.js 转义输入，支持受限 Markdown、表格、独行 details / summary；不允许任意 HTML、脚本、open 属性或非白名单 URL。致谢条目默认隐藏，点击外部链接才打开第三方网页。

## 验证与发布

先对改动脚本运行 node --check，再执行 tests 下相关检查。纯 Node 覆盖格式、时间、生成、皮肤、资料规则；DOM 检查使用 jsdom、fake-indexeddb 与 @napi-rs/canvas，路径可通过 DC_JSDOM / DC_FAKE_IDB / DC_CANVAS 配置，Canvas 也可从 CODEX_PRIMARY_RUNTIME_NODE_MODULES 解析。PowerShell 检查可设 PWSH。

```
node tests/core.cjs
node tests/analysis.cjs
node tests/timing.cjs
node tests/skin.cjs
node tests/units382.cjs
node tests/beat40.cjs
node tests/app40.cjs
node tests/settings40.cjs
```

其余 test 文件的历史编号是文件标识，不代表使用过时的产品规则；相关断言须跟随固定 0.2 秒规则。完整运行器见 docs/testing.md。DOM / 模拟音频时钟可以证明调度与写入保护，不能测量实际扬声器延迟、真实屏幕 FPS、官方服务可用性或机台判定。

保持既有静态托管 manifest 和访问范围；源仓库同步、归档与部署需匹配同一 commit。GitHub Actions 只在维护者选定的仓库运行，v* 标签生成 Release，手动构建只出产物。安装器不包含 Git 凭据或账号缓存，详见 installer/README.md 与 SOURCE-NOTICE.md。真实 Windows、Malody、舞立方机台与账号写入须单独验收。
