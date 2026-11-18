# AGENTS.md

本仓是 DeepSeek Harness（DSH）的一个插件，单仓库、无构建步骤、无运行时依赖：`index.js` 是 Host 半（进程内包 `globalThis.fetch`，把规则合并进发往 OpenRouter 的请求体），`client.js` 是浏览器半（设置页的清单 / 编辑 / 选模型三视图），两半只通过 `POST /api/openrouter-provider` 通信。包已发布到 npm（`@creekmoon/dsh-openrouter-provider-router`），发版由 GitHub Actions 用 OIDC 可信发布完成，仓库内不放任何 npm token。

## 任务开始前的固定动作

1. **先查 `rules/`**：列出 `rules/` 下的规则文件，按 frontmatter 的 `description` 与 `globs` 匹配当前任务；匹配则阅读并遵循。当前是 `rules/通用开发规范_rule.md`，覆盖代码、文案、文档、测试、发版五类场景。没有匹配项时在回复里说明「规则未覆盖本次任务」，不要静默跳过。
2. **动手前先定位属于哪一半**：改请求改写看 `index.js`；改界面、交互、文案看 `client.js`；两边都要动时先定 RPC 契约（方法名、入参、返回结构），再分别实现，不要互相 import。
3. **改文案必须成对改**：`client.js` 的 `zh` 与 `en` 字典、`locale/zh.json` 与 `locale/en.json`、`README.md` 与 `README.en.md` —— 中英在同一轮改完，不允许留一份旧的。
4. **改完跑闸门**：`node test/run.mjs`（5 个离线检查）。失败项会打印期望值与实际值，逐条看清楚再改，不要只看最后一行。
5. **写代码遵循 `creekmoon-code-style`**：中文 JSDoc、`/* xxx */` 分区注释、Happy Path First、方法名覆盖行为。
6. **不要顺手发版**：只有用户明确要求时才改 `package.json` 版本号并打 tag；纯文档、纯规则改动默认不发版。

## 红线（`rules/通用开发规范_rule.md`）

- **浏览器模块 `id` 必须等于 `package.json` 的 `name`**。对不上时插件在设置里静默消失、无任何报错；改包名要三处同改：`package.json` 的 `name`、`client.js` 的 `id`、`cordis.patch.yml` 的行 `name`。
- **界面文案不得硬编码**，拼接用到的标点也必须来自字典键（`listSeparator` / `labelSeparator`）；代码区（注释除外）出现中文会被 `test/audit-client.mjs` 直接拦下。
- **README 中英两份必须同步**。`test/check-docs.mjs` 只验结构（互链、截图路径、标签词），正文措辞是否同步它查不出来，这条靠人守。
- **仓库内不得出现任何 npm token**，发布只走 OIDC 可信发布；临时 token 只在本地一次性使用并立即撤销。

## 核心架构事实（容易踩坑）

- **Host 半只改目标请求**：`openrouter.ai` 的 `POST /api/v1/chat/completions`、body 是 JSON 字符串、命中规则时才合并 `provider.only` 与 `provider.allow_fallbacks`，其余一律原样放行（`index.js:190`）。改写链上任何异常都退回原请求、不抛错（`index.js:199`）。
- **RPC 只有一条通道**：`POST /api/openrouter-provider`，方法 `state` / `models` / `providers` / `save` / `clear`，返回 `{ok:false}` 时浏览器半统一抛错（`index.js:694`、`client.js` 的 `callRpc`）。
- **注册必须可清理**：`apply` 里用 `ctx.effect` 装 fetch 拦截与 RPC 路由，卸载时只在 `globalThis.fetch` 仍是自己那版的情况下还原（`index.js:738`、`index.js:757`）。
- **设置页是三视图状态机**：清单 / 编辑 / 选模型只改 `page.view`，不新开路由；几何与配色全部走宿主令牌与官方尺寸，闸门是 `test/audit-client.mjs` 与 `test/check-layout.mjs`。
- **文案与元数据分两套**：界面文案在 `client.js` 的 `zh` / `en` 字典；插件清单里的标题与描述在 `locale/*.json` 的 `meta`。
- **发布靠 tag**：`git tag vX.Y.Z` 并推 tag → `.github/workflows/publish.yml` 依次跑 `npm test`、校验 tag 与 `package.json` 版本一致、OIDC 发布。不打 tag 就不会发布。

## 规则文件清单（以实际目录为准，有增删时更新本清单）

- `rules/通用开发规范_rule.md`：代码边界、国际化文案、双份文档、离线闸门、发版流程，以及本仓的已知偏离与术语表。
