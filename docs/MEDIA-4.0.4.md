# 4.0.4 自制谱媒体读取修复

## 问题与证据范围

“部分媒体缺失”来自可选资源下载失败：音频、曲绘（歌曲背景图）或秀谱标题图。TXT 和 SV 下载失败会终止载入，不属于该提示。

检查发现远程媒体 fetch 没有指定缓存策略；曲绘先用于普通 img 展示、再被脚本 fetch 打包时，有可能复用不带 CORS 许可的图片缓存。此问题与网络/跨域 TypeError 相符，但没有用户报错谱包的 MusicID 或原图 URL，不能断定这是该歌曲的唯一根因。真正缺少服务器 CORS 许可、资源失效或网络不通仍然可能失败。

## 修改

- 媒体 fetch 使用 cache: no-store，保持 cors、credentials: omit 和原始 URL，不修改签名参数。
- 经典与秀谱统一按原文件 URL、PreviewUrl、PicPath、ResourcePath 尝试曲绘备用来源；秀谱没有 FileType=3 记录时也可以读取详情曲绘。
- 媒体失败后显示可关闭的载入报告，明确列出失败类型，提供本首歌曲的官方媒体下载链接；不再仅靠短暂的“部分媒体”提示。
- 全站资源查询版本更新到 4.0.4，避免继续使用旧脚本缓存。

## 验证

node tests/media404.cjs
node tests/package402.cjs
node tests/core.cjs
node tests/v35.cjs
DC_JSDOM=<jsdom directory> node tests/people403.cjs

新增测试模拟不带 CORS 的图片缓存，检查下载请求绕过缓存；验证经典/秀谱备用曲绘、只有详情曲绘的秀谱、共享图片只下载一次、全部图片来源失败时的准确告警，以及 TXT 失败必须终止。

自动测试通过不代表已使用真实登录账号完成涉事歌曲联调。本次未使用用户账号和真实报错资源进行浏览器复现。
