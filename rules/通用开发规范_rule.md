---
description: 本仓库通用开发规范：改代码、改文案、改文档、发版前先看这一份
globs:
  - "*.js"
  - "*.json"
  - "*.md"
  - "locale/**"
  - "test/**"
alwaysApply: false
---

# 通用开发规范

本指南提炼「DSH 双半插件」在新增能力、改文案、改文档、发版四类场景下的稳定规律与推荐做法，来自本仓库现有代码的实证核查（`client.js` 1409 行 / 54 个函数注释，`index.js` 759 行 / 37 个函数注释，7 个测试文件）。

条目以 [推荐] 为主体：每条都说明背后的规律与可偏离情形。[硬约束] 极少，只留给违反会造成可验证损害、且已在本仓库真实踩过的场合。[可参考] 只是现状参照，不构成背书。

## 一、适用范围

- 覆盖：`index.js`、`client.js` 两个运行时文件，`locale/` 与 `client.js` 内的文案字典，`test/` 下的离线检查，`README.md` / `README.en.md` 与 `designs/` 文档资产。
- 不覆盖：DSH 宿主自身的插件契约（包名与模块 id 的绑定规则、locale 服务、设置页几何）——那些以官方包文档为准，本规范只记录本仓库如何遵守它们。

## 二、核心规律

**一、插件是两半，各管一头。** Host 半 `index.js` 只有一个真正改行为的地方：包一层 `globalThis.fetch`，把规则合并进发往 OpenRouter 的请求体。浏览器半 `client.js` 只有一个真正的入口：往设置页注册一个分区，画清单 / 编辑 / 选模型三个视图。两半之间没有共享内存、没有互相 import，只有一条 RPC：`POST /api/openrouter-provider`，方法 `state` / `models` / `providers` / `save` / `clear`。任何新能力都要先回答"它属于哪一半"，再回答"另一半要拿什么数据"，最后才写代码。

**二、用户看到的东西都不归本插件定义。** 文案进 locale 字典（`zh` / `en` 两套），视觉进宿主的设计令牌（`--dsw-alias-*`）与官方尺寸。这条规律的好处是：宿主换主题、换语言，插件自动跟着变；代价是任何一处"图省事写死"都会在另一种语言或主题下露馅——本仓库已经为此修过两处。

**三、文档是双份的，而且两份都是展示面。** `README.md` 是 GitHub 仓库首页的默认正文，也是 npm 包页面正文；`README.en.md` 是英文读者从顶部语言链接进入的镜像。它们不是"翻译备查"，而是两个都要维护的入口。

## 三、推荐做法

### A. 代码

[硬约束] 浏览器模块的注册 `id` 必须等于 `package.json` 的 `name`。
  违反后果：宿主按包名请求浏览器模块，对不上时工厂执行完也不会挂到那一行，插件在设置里**静默消失**、没有任何报错（本仓库真实踩过，排查成本极高）。
  突破路径：改包名时三处必须同改——`package.json` 的 `name`、`client.js` 的 `id`、`cordis.patch.yml` 里的行 `name`——然后跑 `node test/run.mjs`，`audit-client.mjs` 会直接拦住不一致。
  参考实现：`client.js:8`、`cordis.patch.yml`、`test/audit-client.mjs:92`

[推荐] Host 半只认自己的目标：`openrouter.ai` 的 `POST /api/v1/chat/completions`、body 是 JSON 字符串、命中规则才改写；其余请求原样放行。
  背后规律：插件是在进程内替换全局 `fetch`，判定一旦放宽，DeepSeek 官方、Kimi 等其它渠道都会被误伤，且用户无法从界面察觉。
  何时可偏离：OpenRouter 新增等价端点时，先在 `test/verify-host.mjs` 补一条"非目标主机/非 JSON body 原样放行"的用例，再扩判定。
  参考实现：`index.js:190`（`rewriteFetchRequest`）、`index.js:160`（`matchRule`）

[推荐] 改写链上任何解析失败都退回原请求，不向外抛错，日志走 `logger.debug` 并注明"可能是正常情况无须理会"。
  背后规律：这个函数跑在每一次模型请求的关键路径上，抛错等于替用户中断推理；请求体不是 JSON、规则文件被手改坏都属于可预期的日常情况。
  参考实现：`index.js:199-202`

[推荐] 注册一切资源都用 `ctx.effect`，并返回清理函数；还原全局对象前先确认它仍是自己装的那一个版本。
  背后规律：插件会被禁用、重载、热更新，清理函数不幂等就会把别人的 `fetch` 一起还原掉。
  参考实现：`index.js:211`（`installFetchPatch`）、`index.js:223-225`、`index.js:757-758`

[推荐] 两半共用的形态（`PROVIDER_SLUG`、`ALL_MODELS`）各自声明一份，并在注释里点明"与另一半保持一致"。
  背后规律：两半是独立加载的模块，没有共享模块可引；抽公共文件反而要求构建或额外的加载协商，违背"无构建步骤"。
  何时可偏离：同一常量出现第三份时，再考虑抽成 `shared.js` 并确认 DSH 能解析该相对导入。
  参考实现：`client.js:20-24`、`index.js` 顶部常量区

[推荐] 不引入构建步骤、不引入运行时依赖。
  背后规律：DSH 直接加载仓库里的 `index.js` / `client.js`，加了构建就得让每个使用者先跑一次，插件的主要成本会从"安装"变成"编译"。
  参考实现：`package.json` 无 `devDependencies`、无 `build` 脚本

[推荐] 每个函数写中文 JSDoc（做什么 + 关键约束），方法体内用 `/* xxx */` 分区注释，空行只用于分区切割。
  背后规律：这是本仓库与团队 `creekmoon-code-style` 的既定风格，读者靠注释理解"为什么"，靠命名理解"做什么"。
  参考实现：`client.js` 54 处、`index.js` 37 处函数注释

### B. 文案与国际化

[硬约束] 界面可见文案一律走 `t('key')`，`zh` / `en` 两套字典键必须一一对应；代码区（注释除外）不得出现中文。
  违反后果：DSH 的语言切换是实时的，写死的文案在切语言后不会变；只写一侧的键会在另一种语言下把键名直接显示给用户。
  突破路径：确实需要中文的场景（例如只给中文用户的日志）走 `logger`，不要进界面；新增文案时两处相邻添加。
  参考实现：`client.js:26`（zh）、`client.js:134`（en）、闸门 `test/audit-client.mjs:53`（字典外无中文）

[硬约束] 拼接文案里用到的标点也必须来自字典（`listSeparator` / `labelSeparator`），不要把「、」「：」写在模板串里。
  违反后果：英文界面会出现中文全角标点，属于最容易被用户发现的粗糙点（本仓库修过两处：手填 slug 报错、清单外 slug 提示）。
  突破路径：新增一种拼接形态时，成对补字典键（中文全角 / 英文半角 + 空格）。
  参考实现：`client.js:75-76`、`client.js:183-184`、使用点 `client.js:866` 与 `client.js:1200`

[推荐] `locale/*.json` 的 `meta.title` / `meta.description` 双语齐备：英文句首大写、描述里写准确入口名（与界面菜单文案一致）。
  背后规律：这份元数据是插件清单里唯一由宿主读取的展示信息，写错入口名会让用户按图索骥找不到入口。
  参考实现：`locale/zh.json`、`locale/en.json`、闸门 `test/audit-client.mjs:55`

### C. 文档

[硬约束] README 改动必须中英双份同步：改了 `README.md` 就要同步改 `README.en.md`，反之亦然。
  违反后果：`README.md` 是 GitHub 首页默认正文，也是 npm 页面正文；英文读者会从顶部语言链接进 `README.en.md`。只改一份，另一半的读者就会看到过期信息——安装方式、命令、包名这类内容一旦不同步，读者会直接按错的方式操作。
  突破路径：只改一份时必须在提交说明里写清原因，并在同一轮里补上另一份（不要留"下次再补"）。
  参考实现：两份文件、`test/check-docs.mjs`
  注意：`check-docs.mjs` 只校验互链、截图路径、标签词、规则文件可达性这类结构事实，**正文措辞是否同步它校验不了**，所以这条靠人守。

[推荐] 安装路径按"npm 包名优先、克隆源码备选"来写，并说明各自适用场景（只想用 → 包名；要改代码 → 源码）。
  背后规律：从 npm 装是三步、无需 git；源码安装只有改代码的人需要，写在前面对普通用户是噪音。

[推荐] 只改仓库不发版时，在交付说明里点明"npm 页面正文仍是旧文案"。
  背后规律：npm 页面渲染的是发布进 tarball 的 README，仓库更新不会回流到已发布的版本。

[推荐] 术语固定译法，避免同一概念两种说法。

| 中文 | English | 说明 |
|---|---|---|
| 供应商路由器 | provider router | 设置页与插件清单的统一叫法 |
| 指定 | pin | 一条"模型 → 供应商"规则 |
| 回退 | fallback | 对应请求体的 `allow_fallbacks` |
| 清单 / 编辑 / 选模型 | list / editor / picker | 三个视图，代码里也是这三个词 |
| 可用性 | uptime | 近 30 分钟成功比例 |

### D. 测试

[推荐] 行为改动配套补离线检查，统一入口 `node test/run.mjs`；每个子脚本自己打印 `PASS` / `FAIL` 并以非零码退出，聚合入口按子进程状态汇总。
  背后规律：没有联网依赖才能进发布流水线；统一入口让"改完该跑什么"只有一个答案。
  参考实现：`test/run.mjs`、`.github/workflows/publish.yml`（发布前必跑）

[推荐] 新闸门要能给出可读失败信息（打印期望值与实际值），不要只断言一个布尔。
  参考实现：`test/audit-client.mjs:92` 打印 `id vs name`、`test/check-docs.mjs` 分别打印每条结构事实

[场景] 需要真实联网核对的检查放 `test/verify-catalog.mjs`，不进 `run.mjs`。
  判断条件：是否要访问 `openrouter.ai` 或抓取模型页 HTML；是则单独跑，否才进聚合入口。

### E. 发版

[推荐] 只打 tag 发版，不手工 `npm publish`：改 `package.json` 的 `version` → `git tag vX.Y.Z` → 推 tag。工作流会先跑离线检查、校验 tag 与版本一致，再用 GitHub OIDC 可信发布。
  背后规律：版本号的唯一来源是 `package.json`，tag 只负责触发；两处不一致时让流水线失败，比人工核对可靠。
  参考实现：`.github/workflows/publish.yml`

[硬约束] 仓库里不得出现任何 npm token，也不得为了发布绕过可信发布流程。
  违反后果：npm 的 bypass token 等同于账号发布权，一旦进入仓库或日志即可被用于发布恶意版本；本仓库已有 OIDC 通道，没有任何用 token 的必要。
  突破路径：确实需要临时 token 时，只在本地一次性使用、用完立即在 npm 网站撤销，且绝不写入文件或提交。

[推荐] 纯文档、纯规则改动默认不发版。
  何时可偏离：本次改动的目的就是更新 npm 页面正文时——那就必须发版，否则读者看到的还是旧文案。

## 四、场景分支

- **本地调试**：用 `link:` 方式安装本仓库（`plugin_manager` 的 `install_bundle` 指向目录），改完代码禁用再启用即可生效，不需要发版。
- **给别人安装**：让对方在 **插件 → 添加插件** 里填包名，不需要克隆。
- **只改文档**：按"文档"一节同步中英两份；若目标是 npm 页面，则走发版。
- **改行为**：先补/改测试，再按发版流程走；不能既改行为又不发版还声称已交付，因为 npm 用户拿不到。

## 五、已知偏离与例外

- npm 版本列表里存在 `0.0.0-stage` 占位版本，是 npm 异步发布时自动生成的产物，`latest` 不指向它，不影响安装；不要把它当作本项目的版本号。
- `test/verify-catalog.mjs` 需要联网，故意不在 `test/run.mjs` 里，也不在发布流水线里。
- `designs/` 是静态设计稿，不参与任何测试闸门；里面的画板是设计期资产，与其对应的实现以 `client.js` 为准。

## 六、待确认 / 可演进点

- `rules/` 与 `AGENTS.md` 目前不在 `package.json` 的 `files` 里，也就是不会进 npm 包。这是有意的（使用者不需要开发规范）；若将来希望随包分发，需要显式加进 `files` 并接受包体积变化。
- 字典外禁止中文的闸门目前靠"代码区去掉注释后扫 CJK"实现。若将来必须在正则里写中文字符，请改用 `\uXXXX` 转义，而不是放宽闸门。

## 七、参考实现 / 证据来源

| 主题 | 位置 |
|---|---|
| 浏览器模块注册与 id | `client.js:8`、`client.js:1401`（`ctx.slots.inject` / `register`） |
| 中英文字典 | `client.js:26`（zh）、`client.js:134`（en） |
| 拼接标点 | `client.js:75-76`、`client.js:183-184` |
| fetch 拦截与放行 | `index.js:190`、`index.js:211`、`index.js:223` |
| RPC 契约 | `index.js:694`（`dispatch`）、`index.js:703`（注册路由） |
| 插件入口与清理 | `index.js:738`、`index.js:757-758` |
| 离线闸门 | `test/run.mjs`、`test/audit-client.mjs`、`test/check-docs.mjs` |
| 发布流水线 | `.github/workflows/publish.yml` |
| 双份文档 | `README.md`、`README.en.md` |
