# DSH-OpenRouter-供应商路由器

DeepSeek Harness（DSH）插件：在 **设置 → 供应商路由器** 里，把某个 OpenRouter 模型的请求固定到你指定的上游供应商。

OpenRouter 默认会在同一模型的多个供应商之间自己挑、自己回退。同一个模型，不同供应商的价格、精度、上下文和可用性差别很大。这个插件让你把「谁来回这个请求」写死，并把规则落成 `provider.only` + `allow_fallbacks` 注入到请求体。

## 功能

- **按模型指定供应商**：规则按请求里的 `model` 精确匹配（只忽略 `~` 前缀）；作用范围可选「仅此模型」或「所有 OpenRouter 模型」。
- **手填为主**：直接填供应商 slug（例如 `stepfun/fp8`），回车即加入；可一次填多个，用逗号、空格或换行分隔。填的 slug 不在该模型的清单里时，行内提示可能有拼写错误。
- **右侧栏在线挑选**：列出该模型所有可服务的供应商，带输入 / 输出单价（$/1M）、精度、上下文、可用性；勾选即加入。
- **允许回退**开关：关掉即写 `allow_fallbacks: false`，OpenRouter 不会退到白名单外的供应商。
- **规则可手改**：保存在 `$DSH_HOME/openrouter-provider.json`，页面底部给出实际路径。

## 安装

要求 DSH 0.2.x（在 0.2.2-rc.3 上验证）。

```bash
git clone https://gitee.com/creekmoon/dsh-openrouter-provider-router.git
```

1. 打开 **设置 → 插件**，选择 **添加插件**（Add plugin），选中克隆下来的目录。
2. 重新打开设置，左侧导航出现 **供应商路由器**。

也可以由 agent 用 `plugin_manager` 安装：`action: install_bundle`，`target` 填本目录的绝对路径。

## 使用

1. 顶部对象条显示当前模型，点 **更换模型** 选一个具体模型（目录里约 470 个）。`~` 开头的 Latest 别名与 `openrouter/auto` 这类路由模型没有固定供应商清单。
2. 在 **供应商 slug** 里填 slug，回车或点 **添加**；也可以在右侧栏勾选。
3. 需要时打开 **允许回退**，并选择 **作用范围**。
4. 点 **保存**。

> 规则按请求里的 `model` 精确匹配。如果会话默认模型是别名（例如 `~deepseek/deepseek-flash-latest`），而你把规则挂在具体模型上，保存后操作条会提示「已保存但暂时不会生效」。

## 规则文件

`$DSH_HOME/openrouter-provider.json`：

```json
{
  "version": 1,
  "rules": {
    "deepseek/deepseek-v4.1-flash-1017": { "only": ["stepfun/fp8"], "allowFallbacks": false },
    "*": { "only": ["deepseek", "novita/fp8"], "allowFallbacks": true }
  }
}
```

- 键是模型 id；`*` 表示所有 OpenRouter 模型。
- `only` 是白名单，`allowFallbacks` 对应 `provider.allow_fallbacks`。

## 实现方式

Host 半在进程内包了一层 `globalThis.fetch`：只有当请求是 `POST https://openrouter.ai/api/v1/chat/completions`（含区域域名）、body 是 JSON 字符串、且命中一条规则时，才把 `provider.only` / `provider.allow_fallbacks` 合并进请求体。其它请求原样放行，解析失败也一律退回原请求。规则改动立即生效，不需要重启。

浏览器半注册一个 `settings.section`。两个半通过 `POST /api/openrouter-provider`（DSH 的认证通道，Host/Origin 与登录态由 DSH 先校验）读写状态。

## 数据来源

| 用途 | 来源 | 缓存 |
|---|---|---|
| 某模型的供应商清单 | `GET /api/v1/models/<id>/endpoints` | 60 秒 |
| 模型目录（更换模型面板） | `GET /api/v1/models` | 10 分钟 |
| 接口不可用时的兜底 | 抓模型页 HTML，解析其中内嵌的 endpoint 数组 | 60 秒 |

## 边界

- 只改本 Harness 发往 `openrouter.ai` 的请求；DeepSeek 官方、Kimi 等其它路由不受影响。
- 只处理 body 是 JSON 字符串的请求，其它形态原样放行。
- `~` 别名与路由模型没有固定供应商清单；接口返回空清单时页面给出说明与「选具体模型」入口，不当成加载失败。
- slug 必须能在该模型上服务，否则 OpenRouter 会返回 4xx。
- 模型页解析依赖 OpenRouter 当前的 Next.js 负载结构；接口优先，改版只会影响兜底路径。
- Host 返回的错误文案目前是中文硬编码，英文界面下会中英混排（界面文字本身已双语）。

## 开发

无构建步骤。`index.js` 是 Host 半，`client.js` 是浏览器半，都是纯 ESM，改完在「设置 → 插件」里禁用再启用即可。

```bash
node test/run.mjs              # 4 个离线检查
node test/verify-catalog.mjs   # 可选：联网核对真实接口与页面解析
```

| 检查 | 覆盖内容 |
|---|---|
| `test/verify-host.mjs` | fetch 注入、区域域名、非 OpenRouter 主机、非 JSON body、RPC 读写与落盘、`~` 前缀匹配、路径穿越拒绝、卸载还原 |
| `test/audit-client.mjs` | 中英双语键全解析、设计闸门（无字面色值/阴影/虚线、可按压元素有 `:active`、价格用 `tabular-nums`）、结构断言（手填在前、侧栏在后） |
| `test/check-layout.mjs` | 564px 内容列下两栏宽度与各列可用宽度 |
| `test/render-smoke.mjs` | 15 个状态下组件不抛错，结构与文案断言 |

`design/wireframe.html` 是灰阶结构线框，右下角可切换演示状态。

## 目录

| 路径 | 作用 |
|---|---|
| `index.js` | Host：fetch 拦截、策略文件读写、`/api/openrouter-provider` RPC、目录接口与模型页解析 |
| `client.js` | 浏览器：`settings.section` 里的设置页 |
| `cordis.patch.yml` | 插入 `openrouter-provider` 行 |
| `locale/*.json` | 插件列表里的标题与说明 |
| `icon.svg` | 插件图标 |
| `design/wireframe.html` | 灰阶结构线框 |
| `test/` | 离线检查与联网核对 |

## 发布（维护者）

远端是 `https://gitee.com/creekmoon/dsh-openrouter-provider-router.git`，日常直接：

```bash
git push
```

包名目前是 `@creekmoon/dsh-openrouter-provider`（`private: true`，防止误发 npm）。要发到 npm 或改名成自己的域，改 `package.json` 的 `name` 与 `private`，并同步 `cordis.patch.yml` 里的 `name`。

## 许可

MIT，见 [LICENSE](LICENSE)。

## English

A DSH plugin that pins each OpenRouter model to the upstream providers you choose. Open **Settings → Provider router**, type provider slugs (for example `stepfun/fp8`) or tick them in the side rail, then save. The Host half wraps `globalThis.fetch`: only `POST https://openrouter.ai/api/v1/chat/completions` requests with a JSON body that match a rule get `provider.only` and `provider.allow_fallbacks`; everything else passes through untouched.

Install: **Settings → Plugins → Add plugin**, pick this directory. Rules live in `$DSH_HOME/openrouter-provider.json`. Run `node test/run.mjs` for the offline checks; `node test/verify-catalog.mjs` hits the live OpenRouter API. MIT licensed.
