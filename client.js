/**
 * OpenRouter 供应商路由（浏览器半）
 * 结构：顶部对象条（为哪个模型配置）→ 可选的具体模型面板 → 单张供应商清单（勾选即已选）
 *       → 折叠的已保存指定 → 吸底操作条（回退 / 作用范围 / 清除 / 保存）。
 * 只做结构，视觉沿用宿主主题令牌；不引用 Host 客户端包。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-openrouter-provider',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    /** 设置页文案命名空间 */
    const NS = 'openrouter-provider'
    /** Connection 的共享通道与 Host 注册的端点名 */
    const RPC_CHANNEL = '/api'
    const RPC_ENDPOINT = 'openrouter-provider'
    /** 通配模型键，与 Host 的 ALL_MODELS 一致 */
    const ALL_MODELS = '*'
    /** 模型列表一次最多渲染多少行 */
    const MODEL_LIST_LIMIT = 80
    /** 供应商 slug 形态，与 Host 的 PROVIDER_SLUG 保持一致 */
    const PROVIDER_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?:\/[A-Za-z0-9._-]{1,64}){0,2}$/

    const zh = {
      navLabel: '供应商路由器',
      title: 'DSH-OpenRouter-供应商路由器',
      subtitle: '为某个模型指定请求交给哪些供应商；保存后该模型的请求只会发给它们，除非你允许回退。',

      modelUnknown: '未选择模型',
      changeModel: '更换模型',
      modelCountSuffix: ' 家供应商',
      modelInput: '输入',
      badgeAlias: 'Latest 别名',
      badgeRouter: '路由模型',

      pickerFilter: '搜索模型 id 或名称，例如 deepseek',
      pickerLoading: '正在读取模型目录…',
      pickerError: '读取模型目录失败：',
      pickerEmptyList: '没有匹配的模型',
      pickerTruncated: '匹配较多，仅显示前 80 个，请把搜索词写细一点。',
      pickerAdvanced: '手动填写模型 id 或粘贴模型页 URL',
      pickerAdvancedHint: '支持带 /models/、?endpoint=、#providers 的模型页地址。',
      pickerAdvancedPlaceholder: 'deepseek/deepseek-v4.1-flash-1017 或 https://openrouter.ai/...',
      load: '加载',
      collapse: '收起',

      providersLabel: '供应商指定',
      selectedPrefix: '已选 ',
      ofTotalPrefix: ' / 共 ',
      countSuffix: ' 家',
      clearSelection: '清空',
      manualLabel: '供应商 slug',
      manualPlaceholder: 'stepfun/fp8',
      manualHint: '可一次填多个，用逗号、空格或换行分隔；slug 就是 OpenRouter 供应商的 tag（例如 stepfun/fp8）。',
      manualInvalid: '格式不正确：',
      add: '添加',
      pinnedLabel: '已指定',
      pinnedEmptyTitle: '还没有指定供应商',
      pinnedEmptyHint: '在上面手填 slug 后按 Enter 或点「添加」；也可以从右侧在线挑选。',
      remove: '移除',
      notInCatalog: '清单里没有这个 slug',
      notInCatalogHint: '该模型的清单里没有它，拼写可能有误；保存后仍会按原样生效。',
      colQuant: '精度',
      colInput: '输入',
      colOutput: '输出',
      colContext: '上下文',
      colMaxOutput: '最大输出',
      maxOutputShort: '上限',
      colUptime: '可用性',
      unknownValue: '未知',
      degradedTag: '状态异常',

      railTitle: '在线挑选',
      railSortHint: '单价 $/1M · 输入 / 输出',
      providerFilter: '筛选名称或 slug',

      listIdle: '选定模型后，这里会列出它可用的供应商。',
      listLoading: '正在读取供应商清单…',
      listEmptyTitle: '该模型没有可用供应商',
      listEmptyHint: '确认模型 id 是否正确，或换一个具体模型。',
      listErrorTitle: '供应商清单读取失败',
      listErrorHint: '手填 slug 不受影响；也可以粘贴模型页 URL，让页面解析网页里的供应商与价格。',
      listFilteredEmpty: '没有匹配的供应商',
      retry: '重试',

      aliasTitle: '别名/路由模型没有固定供应商',
      aliasTextAlias: 'Latest 别名会把请求转给同家族最新的具体模型，OpenRouter 不提供它的供应商清单。',
      aliasTextRouter: '路由模型由 OpenRouter 现场决定实际模型，因此没有固定供应商清单。',
      pickConcrete: '选具体模型',
      scopeAllHint: '“所有 OpenRouter 模型”没有按模型的候选清单，直接手填 slug。',

      onboardStep1: '① 选定模型',
      onboardStep2: '② 填供应商 slug 或在线挑选',
      onboardStep3: '③ 保存',

      fallbacksLabel: '允许回退',
      scopeLabel: '作用范围',
      scopeModel: '仅此模型',
      scopeAll: '所有 OpenRouter 模型',
      clearPin: '清除该指定',
      confirmClearPrefix: '清除 ',
      confirmClearSuffix: ' 的指定？',
      confirmYes: '确认清除',
      cancel: '取消',
      save: '保存',
      saving: '保存中…',
      dirtyNotice: '有未保存的修改',

      saved: '已保存',
      savedMismatchPrefix: '已保存，但当前默认模型是 ',
      savedMismatchSuffix: '，与此指定不同，暂时不会生效 —— 改用「所有 OpenRouter 模型」或切换默认模型。',
      failedPrefix: '保存失败：',
      removed: '已清除',
      removeFailedPrefix: '清除失败：',
      loadFailedPrefix: '读取设置失败：',

      savedRulesLabel: '已保存的指定',
      savedRulesEmpty: '还没有任何指定，OpenRouter 按自己的规则自动选择供应商。',
      savedAll: '所有模型（*）',
      savedProviderCountSuffix: ' 家',
      savedFallback: '允许回退',
      savedNoFallback: '不回退',
      delete: '删除',
      configLocation: '配置文件位置',
    }

    const en = {
      navLabel: 'Provider router',
      title: 'DSH-OpenRouter-Provider-Router',
      subtitle: 'Choose which providers serve a model; saved requests go only to them unless you allow fallbacks.',

      modelUnknown: 'No model selected',
      changeModel: 'Change model',
      modelCountSuffix: ' providers',
      modelInput: 'input',
      badgeAlias: 'Latest alias',
      badgeRouter: 'router',

      pickerFilter: 'Search a model id or name, for example deepseek',
      pickerLoading: 'Loading the model catalog…',
      pickerError: 'Could not load the model catalog: ',
      pickerEmptyList: 'No model matches',
      pickerTruncated: 'Many matches; showing the first 80. Narrow the search.',
      pickerAdvanced: 'Type a model id or paste a model page URL',
      pickerAdvancedHint: 'Accepts model page URLs with /models/, ?endpoint=, or #providers.',
      pickerAdvancedPlaceholder: 'deepseek/deepseek-v4.1-flash-1017 or https://openrouter.ai/...',
      load: 'Load',
      collapse: 'Collapse',

      providersLabel: 'Provider pin',
      selectedPrefix: 'Selected ',
      ofTotalPrefix: ' / ',
      countSuffix: '',
      clearSelection: 'Clear',
      manualLabel: 'Provider slug',
      manualPlaceholder: 'stepfun/fp8',
      manualHint: 'Separate several slugs with commas, spaces, or new lines; a slug is the OpenRouter provider tag (for example stepfun/fp8).',
      manualInvalid: 'Invalid slug: ',
      add: 'Add',
      pinnedLabel: 'Pinned',
      pinnedEmptyTitle: 'No provider pinned yet',
      pinnedEmptyHint: 'Type a slug above and press Enter or Add; you can also tick providers in the rail on the right.',
      remove: 'Remove',
      notInCatalog: 'not in this model’s list',
      notInCatalogHint: 'This slug is not in the list for this model, so it may be a typo; it is still saved as typed.',
      colQuant: 'Precision',
      colInput: 'in',
      colOutput: 'out',
      colContext: 'context',
      colMaxOutput: 'max output',
      maxOutputShort: 'max out',
      colUptime: 'uptime',
      unknownValue: 'unknown',
      degradedTag: 'degraded',

      railTitle: 'Browse',
      railSortHint: '$ per 1M · in / out',
      providerFilter: 'Filter name or slug',

      listIdle: 'Pick a model first; its providers appear here.',
      listLoading: 'Loading the provider list…',
      listEmptyTitle: 'No provider serves this model',
      listEmptyHint: 'Check the model id, or pick a concrete model.',
      listErrorTitle: 'Could not load the provider list',
      listErrorHint: 'Typing slugs still works; you can also paste the model page URL so the page is parsed.',
      listFilteredEmpty: 'No provider matches',
      retry: 'Retry',

      aliasTitle: 'Alias and router models have no fixed providers',
      aliasTextAlias: 'A Latest alias redirects to the newest concrete model in its family, so OpenRouter lists no providers for it.',
      aliasTextRouter: 'A router model picks the real model per request, so it has no fixed provider list.',
      pickConcrete: 'Pick a concrete model',
      scopeAllHint: 'All OpenRouter models has no per-model candidate list; type slugs instead.',

      onboardStep1: '① Pick a model',
      onboardStep2: '② Type a slug or browse',
      onboardStep3: '③ Save',

      fallbacksLabel: 'Allow fallbacks',
      scopeLabel: 'Applies to',
      scopeModel: 'This model only',
      scopeAll: 'All OpenRouter models',
      clearPin: 'Remove pin',
      confirmClearPrefix: 'Remove the pin for ',
      confirmClearSuffix: '?',
      confirmYes: 'Remove',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving…',
      dirtyNotice: 'Unsaved changes',

      saved: 'Saved',
      savedMismatchPrefix: 'Saved, but the current default model is ',
      savedMismatchSuffix: ', so this pin does not apply yet — use All OpenRouter models, or switch the default model.',
      failedPrefix: 'Save failed: ',
      removed: 'Removed',
      removeFailedPrefix: 'Remove failed: ',
      loadFailedPrefix: 'Could not read the setting: ',

      savedRulesLabel: 'Saved pins',
      savedRulesEmpty: 'No pins yet; OpenRouter keeps choosing providers itself.',
      savedAll: 'All models (*)',
      savedProviderCountSuffix: '',
      savedFallback: 'fallbacks',
      savedNoFallback: 'no fallbacks',
      delete: 'Delete',
      configLocation: 'Configuration file',
    }

    const CSS = `
/* 深度策略：全页只用 1px 边框 + 表面色阶，不用阴影；圆角只有 12（容器/控件）、8（行/徽章钮）、999（胶囊）三档 */
.dop { display: flex; flex-direction: column; gap: 16px; width: 100%; box-sizing: border-box; position: relative; font-variant-numeric: tabular-nums; }
.dop-head { display: flex; flex-direction: column; gap: 4px; }
.dop-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dop-sub { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-label { margin: 0; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.dop-spacer { flex: 1 1 auto; }

/* 对象条：不加卡片外壳，用一条分隔线收口，避免整页卡片马赛克 */
.dop-object { display: flex; align-items: flex-start; gap: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.dop-objectMain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.dop-objectLine { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dop-objectName { font-size: 14px; line-height: 22px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dop-objectId { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); word-break: break-all; }
.dop-objectSpecs { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-tag { display: inline-flex; align-items: center; padding: 0 8px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); font-weight: 400; }

/* 模型选择面板：临时展开的悬浮面，用边框 + 更高一层的表面色 */
.dop-picker { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)); }
.dop-modelList { display: flex; flex-direction: column; max-height: min(280px, 38vh); overflow-y: auto; border-top: 1px solid var(--dsw-alias-border-l2); }
.dop-modelRow { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 44px; padding: 8px; border: none; border-bottom: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: none; text-align: left; font: inherit; cursor: pointer; transition: background-color 120ms ease; }
.dop-modelRow:hover { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.dop-modelRow:active { background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2)); }
.dop-modelRow[data-current='true'] { background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2)); }
.dop-modelMain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dop-modelName { font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-modelMeta { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-advanced { display: flex; flex-direction: column; gap: 8px; }
.dop-advanced summary { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); cursor: pointer; }

/* 控件：36px 档位，左右内边距 16px；可按压元素都要有 :active 物理反馈 */
.dop-input { flex: 1; min-width: 0; height: 36px; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; line-height: 22px; transition: border-color 120ms ease; }
.dop-input::placeholder { color: var(--dsw-alias-label-secondary); }
.dop-input:disabled { opacity: 0.5; cursor: not-allowed; }
.dop-button { flex: none; height: 36px; padding: 0 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; line-height: 22px; cursor: pointer; transition: background-color 120ms ease, transform 120ms ease, opacity 120ms ease; }
.dop-button:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.dop-button:active:not([disabled]) { transform: scale(0.97); }
.dop-button[disabled] { opacity: 0.5; cursor: not-allowed; }
.dop-primary { flex: none; min-width: 96px; height: 40px; padding: 0 20px; border: none; border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base)); font: inherit; font-size: 14px; line-height: 22px; font-weight: 500; cursor: pointer; transition: filter 120ms ease, transform 120ms ease, opacity 120ms ease; }
.dop-primary:hover:not([disabled]) { filter: brightness(0.96); }
.dop-primary:active:not([disabled]) { transform: scale(0.97); }
.dop-primary[disabled] { opacity: 0.5; cursor: not-allowed; }
.dop-primaryDanger { background: var(--dsw-alias-state-error-primary, var(--dsw-alias-brand-primary)); }
.dop-link { border: none; background: none; padding: 0; font: inherit; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); cursor: pointer; transition: color 120ms ease; }
.dop-link:hover:not([disabled]) { color: var(--dsw-alias-label-primary); }
.dop-link[disabled] { opacity: 0.5; cursor: not-allowed; }
.dop-linkDanger { color: var(--dsw-alias-state-error-primary); }

/* 引导与就地通知：不用虚线框，浅底 + 圆角即可 */
.dop-checklist { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-checklist span[data-done='true'] { color: var(--dsw-alias-state-success-primary); }
.dop-bannerTitle { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dop-alert { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }

/* 工作面：左侧主线（手填 + 已指定），右侧栏（在线挑选）。列宽按设置面板真实内容宽约 560px 定 */
.dop-region { container-type: inline-size; }
.dop-work { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 24px; align-items: start; }
.dop-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.dop-blockTitle { margin: 0; font-size: 14px; line-height: 22px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dop-count { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-mainHead { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dop-field { display: flex; flex-direction: column; gap: 8px; }
.dop-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dop-picker .dop-input { height: 32px; font-size: 13px; }
.dop-picker .dop-button { height: 32px; padding: 0 12px; font-size: 13px; }
.dop-manualRow { display: flex; align-items: center; gap: 8px; }
.dop-manualRow .dop-input { flex: 1; min-width: 0; }
.dop-subhead { display: flex; align-items: baseline; gap: 8px; margin-top: 4px; }
.dop-subhead .dop-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.dop-stack { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

/* 已指定供应商：名称与价格同排，精度/上下文/上限并入副行（主线窄，开不了多列） */
.dop-pins { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)); overflow: hidden; }
.dop-pin { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; align-items: start; padding: 12px 12px 12px 8px; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.dop-pin:last-child { border-bottom: none; }
.dop-pinRemove { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: none; border-radius: 999px; background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 1; cursor: pointer; transition: background-color 120ms ease, color 120ms ease, transform 120ms ease; }
.dop-pinRemove:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); }
.dop-pinRemove:active:not([disabled]) { transform: scale(0.92); }
.dop-pinRemove[disabled] { opacity: 0.5; cursor: not-allowed; }
.dop-pinMain { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dop-pinTop { display: flex; align-items: baseline; gap: 8px; }
.dop-pinName { flex: 1; min-width: 0; font-size: 14px; line-height: 20px; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-pinPrice { flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-primary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dop-pinMeta { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 17px; color: var(--dsw-alias-label-secondary); word-break: break-word; }
.dop-pinWarn { color: var(--dsw-alias-state-warn-primary); font-size: 11px; line-height: 17px; }
.dop-empty { display: flex; flex-direction: column; gap: 4px; padding: 16px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)); }

/* 侧栏：筛选 + 候选，勾选即指定；加载/失败/别名都在侧栏里就地表达 */
.dop-rail { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1)); }
.dop-railHead { display: flex; align-items: baseline; gap: 8px; }
.dop-railTitle { margin: 0; font-size: 13px; line-height: 20px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dop-rail .dop-input { height: 30px; padding: 0 8px; font-size: 12px; }
.dop-railList { display: flex; flex-direction: column; margin: 0 -4px; max-height: min(260px, 40vh); overflow-y: auto; }
.dop-railRow { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 8px; align-items: start; padding: 8px 4px; border-radius: 8px; cursor: pointer; transition: background-color 120ms ease; }
.dop-railRow:hover { background: var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2)); }
.dop-railRow[data-checked='true'] { background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2)); }
.dop-railRow input { width: 14px; height: 14px; margin: 4px 0 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
.dop-railMain { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dop-railTop { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.dop-railName { flex: 1; min-width: 0; font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-railPrice { flex: none; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 18px; color: var(--dsw-alias-label-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dop-railMeta { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-railSkeleton { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.dop-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 24px 16px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }
.dop-slotTitle { font-size: 14px; line-height: 22px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dop-rail .dop-slot { padding: 16px 8px; }
.dop-rail .dop-slotTitle { font-size: 13px; line-height: 20px; }

/* 加载骨架：按真实行结构占位，只动 opacity */
.dop-skeletonBar { height: 8px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); animation: dop-pulse 1.4s ease-in-out infinite; }
@keyframes dop-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .dop-skeletonBar { animation: none; } }

/* 窄容器：侧栏收到主线下方，顺序仍是先填后挑 */
@container (max-width: 540px) {
  .dop-work { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .dop-railList { max-height: min(280px, 45vh); }
}


/* 辅助信息：去卡片化，只用分隔线 */
.dop-sub { border-top: 1px solid var(--dsw-alias-border-l2); }
.dop-sub > summary { display: flex; align-items: center; gap: 8px; padding: 12px 0; font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dop-savedRow { display: grid; grid-template-columns: minmax(0, 1fr) 72px 96px 48px; gap: 8px; align-items: center; padding: 8px 0; border-top: 1px solid var(--dsw-alias-border-l2); font-size: 12px; line-height: 18px; }
.dop-savedModel { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-savedMeta { color: var(--dsw-alias-label-secondary); }
.dop-fileline { margin: 0; padding: 0 0 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); word-break: break-all; }

/* 吸底操作条：一条边 + 表面色，不包整圈边框（避免又一块卡片） */
.dop-actionbar { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0; padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
.dop-actionbar .dop-status { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); max-width: 100%; }
.dop-actionbar .dop-status[data-tone='warn'] { color: var(--dsw-alias-state-warn-primary); }
.dop-actionbar .dop-status[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }
.dop-switch { display: inline-flex; align-items: center; gap: 8px; border: none; background: none; padding: 0; font: inherit; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); cursor: pointer; }
.dop-switch:active { opacity: 0.85; }
.dop-switchTrack { position: relative; flex: none; width: 36px; height: 20px; border-radius: 999px; background: var(--dsw-alias-state-idle-primary, var(--dsw-alias-border-l2)); transition: background-color 150ms ease; }
.dop-switch[aria-checked='true'] .dop-switchTrack { background: var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary)); }
.dop-switchThumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 999px; background: var(--dsw-alias-switch-thumb, var(--dsw-alias-bg-base)); transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1); }
.dop-switch[aria-checked='true'] .dop-switchThumb { transform: translateX(16px); }
.dop-seg { display: inline-flex; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); overflow: hidden; }
.dop-seg button { height: 32px; padding: 0 12px; border: none; background: none; font: inherit; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
.dop-seg button:hover { color: var(--dsw-alias-label-primary); }
.dop-seg button:active { background: var(--dsw-alias-bg-layer-1); }
.dop-seg button[aria-pressed='true'] { background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2)); color: var(--dsw-alias-label-primary); font-weight: 500; }

`

    /**
     * 调用 Host 的 RPC 端点，把 ok:false 统一抛成 Error
     * @param {unknown} connection 浏览器侧的 connection 服务
     * @param {string} method 操作名
     * @param {unknown} payload 参数
     * @param {AbortSignal} signal 取消信号
     * @returns {Promise<any>} Host 返回的 value
     */
    async function callRpc(connection, method, payload, signal) {
      const result = await connection.rpc.call(RPC_CHANNEL, RPC_ENDPOINT, { method, payload }, signal)
      if (result?.ok === false) throw new Error(result.error?.message ?? 'request failed')
      return result?.ok === true ? result.value : result
    }

    /**
     * 计算表单对应的规则键：所有模型用通配键，否则用去空格的模型 id
     * @param {string} scope 'model' 或 'all'
     * @param {string} model 模型输入内容
     * @returns {string} 规则键
     */
    function ruleKeyOf(scope, model) {
      return scope === 'all' ? ALL_MODELS : model.trim()
    }

    /**
     * 找一个键对应的已存规则，兼容 DSH 的 `~` 前缀写法（带与不带都能命中）
     * @param {Record<string, { only: string[], allowFallbacks: boolean }>} rules 规则表
     * @param {string} key 当前表单的规则键
     * @returns {{ storedKey: string, rule: { only: string[], allowFallbacks: boolean } } | undefined} 命中的已存规则及其真实键
     */
    function ruleFor(rules, key) {
      if (!isRecord(rules)) return undefined
      const bare = key === ALL_MODELS ? key : key.replace(/^~/, '')
      for (const candidate of key === bare ? [key] : [key, bare]) {
        if (Object.hasOwn(rules, candidate)) return { storedKey: candidate, rule: rules[candidate] }
      }
      return undefined
    }

    /**
     * 从规则表取一条规则的勾选状态，没有规则时回退为“未选、不回退”
     * @param {Record<string, { only: string[], allowFallbacks: boolean }>} rules 规则表
     * @param {string} key 规则键
     * @returns {{ selected: string[], allowFallbacks: boolean }} 表单初值
     */
    function formValueOf(rules, key) {
      const rule = ruleFor(rules, key)?.rule
      return { selected: Array.isArray(rule?.only) ? [...rule.only] : [], allowFallbacks: rule?.allowFallbacks === true }
    }

    /**
     * 判断值是否是普通对象
     * @param {unknown} value 待判断值
     * @returns {boolean} true 表示非 null 且非数组的对象
     */
    function isRecord(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    }

    /**
     * 把每百万 token 价格渲染成简短数字
     * @param {number | null} value 每百万 token 的美元价
     * @returns {string} 形如 0.105，未知时为 '?'
     */
    function priceText(value) {
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : '?'
    }

    /**
     * 把 token 数渲染成带千分位的文本
     * @param {number | null} value token 数
     * @returns {string} 形如 1,048,576，未知时为 '?'
     */
    function tokenText(value) {
      return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '?'
    }

    /**
     * 把模态数组渲染成一行
     * @param {unknown} list 模态数组
     * @returns {string} 形如 text, image，空时为 '—'
     */
    function modalityText(list) {
      return Array.isArray(list) && list.length > 0 ? list.join(', ') : '—'
    }

    /**
     * 从输入内容里取模型 id：既接受裸 id，也接受模型页 URL
     * @param {unknown} text 输入内容
     * @returns {string} 模型 id，无法识别时返回去空格后的原文
     */
    function modelIdFromInput(text) {
      const raw = String(text ?? '').trim()
      if (raw === '' || !/^https?:\/\//i.test(raw)) return raw
      try {
        const segments = new URL(raw).pathname.split('/').filter(Boolean)
        const at = segments[0] === 'models' ? 1 : 0
        return segments.slice(at, at + 2).join('/')
      } catch {
        return raw
      }
    }

    /**
     * 构造设置分区组件：设置左侧导航“供应商路由”对应的页面
     * @param {{ locale: unknown, connection: unknown }} ctx 浏览器插件上下文
     * @returns {() => unknown} 设置分区 React 组件
     */
    function createSection(ctx) {
      const t = ctx.locale.bind(NS)

      return function OpenRouterProviderSection() {
        const mounted = useRef(true)
        const [phase, setPhase] = useState('loading')
        const [state, setState] = useState(null)
        const [notice, setNotice] = useState(null)
        const [dirty, setDirty] = useState(false)
        const [model, setModel] = useState('')
        const [scope, setScope] = useState('model')
        const [selected, setSelected] = useState([])
        const [allowFallbacks, setAllowFallbacks] = useState(false)
        const [catalog, setCatalog] = useState(null)
        const [catalogPhase, setCatalogPhase] = useState('idle')
        const [catalogError, setCatalogError] = useState(null)
        const [providerFilter, setProviderFilter] = useState('')
        const [manualInput, setManualInput] = useState('')
        const [manualError, setManualError] = useState(null)
        const [manualModel, setManualModel] = useState('')
        const [busy, setBusy] = useState(false)
        const [pickerOpen, setPickerOpen] = useState(false)
        const [modelCatalog, setModelCatalog] = useState(null)
        const [modelCatalogPhase, setModelCatalogPhase] = useState('idle')
        const [modelCatalogError, setModelCatalogError] = useState(null)
        const [modelFilter, setModelFilter] = useState('')
        const [confirmRemove, setConfirmRemove] = useState(false)

        const modelId = modelIdFromInput(model)
        const currentKey = ruleKeyOf(scope, modelId)
        const storedRule = ruleFor(state?.rules, currentKey)
        const hasRule = storedRule !== undefined

        const savedRules = useMemo(() => {
          const rules = state?.rules
          if (!isRecord(rules)) return []
          return Object.entries(rules).sort((left, right) => left[0].localeCompare(right[0]))
        }, [state])

        const markDirty = () => { setDirty(true); setNotice(null) }

        const syncFromState = (nextState, nextKey) => {
          const form = formValueOf(nextState?.rules ?? {}, nextKey)
          setSelected(form.selected)
          setAllowFallbacks(form.allowFallbacks)
          setDirty(false)
          setNotice(null)
        }

        /* 加载某模型（裸 id 或模型页 URL）的规格与供应商 */
        const loadProviders = useCallback(async (input, signal) => {
          const raw = String(input ?? '').trim()
          if (raw === '') return
          setCatalogPhase('loading')
          setCatalogError(null)
          try {
            const value = await callRpc(ctx.connection, 'providers', { input: raw }, signal)
            if (signal?.aborted || !mounted.current) return
            setCatalog(value ?? null)
            if (typeof value?.model === 'string' && value.model !== '') {
              setModel(value.model)
              setCatalogPhase('ready')
              return
            }
            setCatalogPhase('error')
            setCatalogError(t('listEmptyHint'))
          } catch (error) {
            if (signal?.aborted || !mounted.current) return
            setCatalogError(error?.message ?? String(error))
            setCatalogPhase('error')
          }
        }, [])

        /* 模型目录：展开“更换模型”时按需加载 */
        const loadModelCatalog = async (signal) => {
          setModelCatalogPhase('loading')
          setModelCatalogError(null)
          try {
            const rows = await callRpc(ctx.connection, 'models', {}, signal)
            if (signal?.aborted || !mounted.current) return
            setModelCatalog(Array.isArray(rows) ? rows : [])
            setModelCatalogPhase('ready')
          } catch (error) {
            if (signal?.aborted || !mounted.current) return
            setModelCatalogError(error?.message ?? String(error))
            setModelCatalogPhase('error')
          }
        }

        const openPicker = () => {
          setPickerOpen(true)
          setConfirmRemove(false)
          if (modelFilter === '') {
            const author = modelId.replace(/^~/, '').split('/')[0]
            if (author !== '') setModelFilter(author)
          }
          if (modelCatalog === null && modelCatalogPhase !== 'loading') void loadModelCatalog()
        }

        /* 读 Host 状态；默认模型确实走 OpenRouter 时才回填并自动拉候选 */
        const loadState = async (signal) => {
          try {
            const value = await callRpc(ctx.connection, 'state', {}, signal)
            if (signal?.aborted || !mounted.current) return
            const selection = value?.defaultSelection ?? null
            const openRouterDefault = selection !== null && selection.provider === 'openrouter'
              && typeof selection.model === 'string'
            const initialModel = openRouterDefault ? selection.model : ''
            setState(value)
            setModel(initialModel)
            syncFromState(value, ruleKeyOf('model', initialModel))
            setPhase('ready')
            if (initialModel !== '') void loadProviders(initialModel, signal)
          } catch (error) {
            if (signal?.aborted || !mounted.current) return
            setNotice({ tone: 'error', text: `${t('loadFailedPrefix')}${error?.message ?? String(error)}` })
            setPhase('error')
          }
        }

        useEffect(() => {
          mounted.current = true
          const abort = new AbortController()
          void loadState(abort.signal)
          return () => {
            mounted.current = false
            abort.abort()
          }
        }, [])

        const toggleProvider = (tag) => {
          if (busy) return
          setSelected(current => current.includes(tag) ? current.filter(slug => slug !== tag) : [...current, tag])
          markDirty()
        }

        /* 手动输入供应商：一次可填多个，逐个校验，非法项留在输入框并报错 */
        const addManualProviders = () => {
          if (busy) return
          const parts = manualInput.split(/[\s,;，；]+/).map(part => part.trim()).filter(part => part !== '')
          if (parts.length === 0) return
          const valid = parts.filter(part => PROVIDER_SLUG.test(part))
          const invalid = parts.filter(part => !PROVIDER_SLUG.test(part))
          if (valid.length > 0) {
            setSelected(current => {
              const next = [...current]
              for (const slug of valid) if (!next.includes(slug)) next.push(slug)
              return next
            })
            markDirty()
          }
          setManualError(invalid.length === 0 ? null : `${t('manualInvalid')}${invalid.join('、')}`)
          setManualInput(invalid.join(' '))
        }

        const chooseModel = (id) => {
          if (busy) return
          setModel(id)
          setPickerOpen(false)
          setConfirmRemove(false)
          setCatalog(null)
          setCatalogPhase('idle')
          setProviderFilter('')
          if (state !== null) syncFromState(state, ruleKeyOf(scope, id))
          void loadProviders(id)
        }

        const changeScope = (next) => {
          setScope(next)
          setConfirmRemove(false)
          if (state !== null) syncFromState(state, ruleKeyOf(next, modelId))
        }

        const save = async () => {
          setBusy(true)
          setNotice(null)
          try {
            const value = await callRpc(ctx.connection, 'save', {
              scope, model: modelId, only: selected, allowFallbacks,
            })
            if (!mounted.current) return
            setState(value)
            setDirty(false)
            const savedKey = scope === 'all' ? ALL_MODELS : modelId
            const defaultModel = value?.defaultSelection?.model
            const mismatch = scope === 'model' && typeof defaultModel === 'string' && defaultModel !== ''
              && defaultModel.replace(/^~/, '') !== savedKey.replace(/^~/, '')
            setNotice(mismatch
              ? { tone: 'warn', text: `${t('savedMismatchPrefix')}${defaultModel}${t('savedMismatchSuffix')}` }
              : { tone: 'success', text: t('saved') })
          } catch (error) {
            if (!mounted.current) return
            setNotice({ tone: 'error', text: `${t('failedPrefix')}${error?.message ?? String(error)}` })
          } finally {
            if (mounted.current) setBusy(false)
          }
        }

        const clearRule = async (key) => {
          setBusy(true)
          setNotice(null)
          setConfirmRemove(false)
          try {
            const value = await callRpc(ctx.connection, 'clear', {
              scope: key === ALL_MODELS ? 'all' : 'model', model: key === ALL_MODELS ? '' : key,
            })
            if (!mounted.current) return
            setState(value)
            setNotice({ tone: 'success', text: t('removed') })
            if (key === currentKey || key === storedRule?.storedKey) {
              setSelected([])
              setAllowFallbacks(false)
              setDirty(false)
            }
          } catch (error) {
            if (!mounted.current) return
            setNotice({ tone: 'error', text: `${t('removeFailedPrefix')}${error?.message ?? String(error)}` })
          } finally {
            if (mounted.current) setBusy(false)
          }
        }

        /* 对象条文案 */
        const specs = catalog?.specs
        const providerRows = Array.isArray(catalog?.providers) ? catalog.providers : []
        const objectName = isRecord(specs) && specs.name !== '' ? specs.name : (modelId === '' ? t('modelUnknown') : modelId)
        const objectSpecs = [
          isRecord(specs) && typeof specs.contextWindow === 'number' ? `${t('colContext')} ${tokenText(specs.contextWindow)}` : null,
          isRecord(specs) && typeof specs.maxCompletionTokens === 'number' ? `${t('colMaxOutput')} ${tokenText(specs.maxCompletionTokens)}` : null,
          isRecord(specs) && Array.isArray(specs.inputModalities) && specs.inputModalities.length > 0
            ? `${t('modelInput')} ${modalityText(specs.inputModalities)}`
            : null,
          catalogPhase === 'ready' && providerRows.length > 0 ? `${providerRows.length}${t('modelCountSuffix')}` : null,
        ].filter(Boolean).join(' · ')
        const modelIsAlias = modelId.startsWith('~')
        const emptyReason = catalog?.emptyReason

        /* 更换模型面板 */
        const renderPicker = () => {
          if (modelCatalogPhase === 'loading') return h('p', { className: 'dop-hint' }, t('pickerLoading'))
          if (modelCatalogPhase === 'error') {
            return h('div', null,
              h('p', { className: 'dop-alert', role: 'alert' }, `${t('pickerError')}${modelCatalogError}`),
              h('button', {
                type: 'button', className: 'dop-button', disabled: busy,
                onClick: () => { void loadModelCatalog() },
              }, t('retry')))
          }
          if (!Array.isArray(modelCatalog)) return null
          const query = modelFilter.trim().toLowerCase()
          const matches = modelCatalog.filter(row => query === ''
            || String(row.id).toLowerCase().includes(query)
            || String(row.name).toLowerCase().includes(query))
          const shown = matches.slice(0, MODEL_LIST_LIMIT)
          return h('div', { className: 'dop-modelList' },
            shown.length === 0
              ? h('div', { className: 'dop-slot' }, t('pickerEmptyList'))
              : shown.map(row => h('button', {
                type: 'button', key: row.id, className: 'dop-modelRow',
                'data-current': row.id === modelId ? 'true' : undefined,
                disabled: busy,
                onClick: () => { chooseModel(row.id) },
              },
              h('span', { className: 'dop-modelMain' },
                h('span', { className: 'dop-modelName' }, row.name === '' ? row.id : row.name),
                h('span', { className: 'dop-modelMeta' },
                  `${row.id} · ${t('colContext')} ${tokenText(row.contextWindow)} · ${t('colInput')} $${priceText(row.promptPerMillion)} · ${t('colOutput')} $${priceText(row.completionPerMillion)}`)),
              row.alias === true ? h('span', { className: 'dop-tag' }, t('badgeAlias')) : null,
              row.router === true ? h('span', { className: 'dop-tag' }, t('badgeRouter')) : null)),
            matches.length > shown.length ? h('p', { className: 'dop-hint' }, t('pickerTruncated')) : null)
        }

        /* 精度文案：清单缺字段时统一显示“未知” */
        const quantizationText = (row) => {
          const value = row?.quantization
          return typeof value === 'string' && value !== '' && value !== 'unknown' ? value : t('unknownValue')
        }

        /* 紧凑 token 数：1,048,576 → 1.05M，供窄栏使用 */
        const compactToken = (value) => {
          if (typeof value !== 'number' || !Number.isFinite(value)) return '?'
          if (value >= 1000000) return `${(value / 1000000).toFixed(2).replace(/\.?0+$/, '')}M`
          if (value >= 1000) return `${Math.round(value / 1000)}K`
          return String(Math.round(value))
        }

        /* 一条已指定供应商：名称与价格同排，规格并入副行；清单外的 slug 就地标出拼写风险 */
        const renderPinnedRow = (slug) => {
          const row = providerRows.find(item => item.tag === slug) ?? null
          const known = row !== null
          const name = known ? (row.providerName === '' ? row.tag : row.providerName) : slug
          const uptime = typeof row?.uptimeLast30m === 'number' && Number.isFinite(row.uptimeLast30m)
            ? ` · ${t('colUptime')} ${row.uptimeLast30m.toFixed(1)}%`
            : ''
          const meta = known
            ? `${row.tag} · ${t('colQuant')} ${quantizationText(row)} · ${t('colContext')} ${tokenText(row.contextLength)} · ${t('maxOutputShort')} ${tokenText(row.maxCompletionTokens)}${uptime}${row.degraded === true ? ` · ${t('degradedTag')}` : ''}`
            : `${slug} · ${t('notInCatalog')}`
          return h('div', { className: 'dop-pin', key: slug, 'data-unknown': known ? undefined : 'true' },
            h('button', {
              type: 'button', className: 'dop-pinRemove', disabled: busy,
              'aria-label': `${t('remove')} ${slug}`, title: t('remove'),
              onClick: () => { toggleProvider(slug) },
            }, '✕'),
            h('div', { className: 'dop-pinMain' },
              h('div', { className: 'dop-pinTop' },
                h('span', { className: 'dop-pinName', title: name }, name),
                h('span', { className: 'dop-pinPrice' },
                  known ? `$${priceText(row.promptPerMillion)} / $${priceText(row.completionPerMillion)}` : t('unknownValue'))),
              h('div', { className: 'dop-pinMeta', title: meta }, meta),
              known ? null : h('p', { className: 'dop-hint dop-pinWarn' }, t('notInCatalogHint'))))
        }

        /* 侧栏一条候选：勾选即指定；副行给 slug、精度与上下文 */
        const renderRailRow = (row) => {
          const checked = selected.includes(row.tag)
          const meta = `${row.tag} · ${t('colQuant')} ${quantizationText(row)} · ${t('colContext')} ${compactToken(row.contextLength)}${row.degraded === true ? ` · ${t('degradedTag')}` : ''}`
          return h('label', { className: 'dop-railRow', key: row.tag, 'data-checked': checked ? 'true' : 'false' },
            h('input', { type: 'checkbox', checked, disabled: busy, onChange: () => { toggleProvider(row.tag) } }),
            h('span', { className: 'dop-railMain' },
              h('span', { className: 'dop-railTop' },
                h('span', { className: 'dop-railName', title: row.providerName === '' ? row.tag : row.providerName },
                  row.providerName === '' ? row.tag : row.providerName),
                h('span', { className: 'dop-railPrice' }, `${priceText(row.promptPerMillion)} / ${priceText(row.completionPerMillion)}`)),
              h('span', { className: 'dop-railMeta', title: meta }, meta)))
        }

        /* 侧栏：筛选 + 候选；清单的加载/失败/别名状态都收在这一栏，主线不被阻塞 */
        const renderRail = () => {
          const query = providerFilter.trim().toLowerCase()
          const matches = providerRows.filter(row => query === ''
            || String(row.providerName).toLowerCase().includes(query)
            || String(row.tag).toLowerCase().includes(query))
          let body = null
          if (scope === 'all') {
            body = h('div', { className: 'dop-slot' }, t('scopeAllHint'))
          } else if (catalogPhase === 'loading') {
            body = h('div', { className: 'dop-stack', 'aria-busy': 'true' },
              h('div', { className: 'dop-railSkeleton' },
                h('span', { className: 'dop-skeletonBar', style: { width: '92%' } }),
                h('span', { className: 'dop-skeletonBar', style: { width: '78%' } }),
                h('span', { className: 'dop-skeletonBar', style: { width: '86%' } }),
                h('span', { className: 'dop-skeletonBar', style: { width: '70%' } })),
              h('p', { className: 'dop-hint' }, t('listLoading')))
          } else if (catalogPhase === 'error') {
            body = h('div', { className: 'dop-slot' },
              h('div', { className: 'dop-slotTitle' }, t('listErrorTitle')),
              h('p', { className: 'dop-alert', role: 'alert' }, catalogError ?? ''),
              h('p', { className: 'dop-hint' }, t('listErrorHint')),
              h('button', {
                type: 'button', className: 'dop-button', disabled: busy, style: { marginTop: '10px' },
                onClick: () => { void loadProviders(model) },
              }, t('retry')))
          } else if (catalogPhase !== 'ready') {
            body = h('div', { className: 'dop-slot' }, t('listIdle'))
          } else if (providerRows.length === 0) {
            const isAlias = emptyReason === 'alias' || modelIsAlias
            body = isAlias || emptyReason === 'router'
              ? h('div', { className: 'dop-stack' },
                h('div', { className: 'dop-bannerTitle' }, t('aliasTitle')),
                h('p', { className: 'dop-hint' }, isAlias ? t('aliasTextAlias') : t('aliasTextRouter')),
                h('button', { type: 'button', className: 'dop-button', onClick: openPicker }, t('pickConcrete')))
              : h('div', { className: 'dop-slot' },
                h('div', { className: 'dop-slotTitle' }, t('listEmptyTitle')),
                h('div', null, t('listEmptyHint')))
          } else if (matches.length === 0) {
            body = h('div', { className: 'dop-slot' }, t('listFilteredEmpty'))
          } else {
            body = h('div', { className: 'dop-railList' }, matches.map(renderRailRow))
          }
          return h('aside', { className: 'dop-rail', 'aria-label': t('railTitle') },
            h('div', { className: 'dop-railHead' },
              h('h3', { className: 'dop-railTitle' }, t('railTitle')),
              scope === 'all' || catalogPhase !== 'ready'
                ? null
                : h('span', { className: 'dop-count' }, `${providerRows.length}${t('countSuffix')}`)),
            h('input', {
              className: 'dop-input', value: providerFilter, spellCheck: false,
              placeholder: t('providerFilter'), 'aria-label': t('providerFilter'),
              disabled: busy || scope === 'all' || catalogPhase !== 'ready',
              onChange: event => { setProviderFilter(event.target.value) },
            }),
            h('p', { className: 'dop-hint' }, t('railSortHint')),
            body)
        }

        /* 工作面：左主线（手填 + 已指定），右侧栏（在线挑选） */
        const renderWork = () => {
          const totalText = scope === 'all' || catalogPhase !== 'ready'
            ? `${t('selectedPrefix')}${selected.length}`
            : `${t('selectedPrefix')}${selected.length}${t('ofTotalPrefix')}${providerRows.length}${t('countSuffix')}`
          return h('div', { className: 'dop-region' },
            h('div', { className: 'dop-work' },
              h('div', { className: 'dop-main' },
                h('div', { className: 'dop-mainHead' },
                  h('h3', { className: 'dop-blockTitle' }, t('providersLabel')),
                  h('span', { className: 'dop-count' }, totalText),
                  h('span', { className: 'dop-spacer' }),
                  h('button', {
                    type: 'button', className: 'dop-link', disabled: busy || selected.length === 0,
                    onClick: () => { setSelected([]); markDirty() },
                  }, t('clearSelection'))),
                h('div', { className: 'dop-field' },
                  h('label', { className: 'dop-label', htmlFor: 'dop-manual' }, t('manualLabel')),
                  h('div', { className: 'dop-manualRow' },
                    h('input', {
                      id: 'dop-manual', className: 'dop-input', value: manualInput, spellCheck: false,
                      placeholder: t('manualPlaceholder'),
                      disabled: busy || phase !== 'ready',
                      onChange: event => { setManualInput(event.target.value); setManualError(null) },
                      onKeyDown: event => {
                        if (event.key === 'Enter') { event.preventDefault(); addManualProviders() }
                      },
                    }),
                    h('button', {
                      type: 'button', className: 'dop-button',
                      disabled: busy || manualInput.trim() === '',
                      onClick: addManualProviders,
                    }, t('add'))),
                  manualError === null
                    ? h('p', { className: 'dop-hint' }, t('manualHint'))
                    : h('p', { className: 'dop-alert', role: 'alert' }, manualError)),
                h('div', { className: 'dop-subhead' },
                  h('span', { className: 'dop-label' }, t('pinnedLabel')),
                  h('span', { className: 'dop-count' }, String(selected.length))),
                selected.length === 0
                  ? h('div', { className: 'dop-empty' },
                    h('div', { className: 'dop-slotTitle' }, t('pinnedEmptyTitle')),
                    h('p', { className: 'dop-hint' }, t('pinnedEmptyHint')))
                  : h('div', { className: 'dop-pins' }, selected.map(renderPinnedRow))),
              renderRail()))
        }

        const canSave = !busy && phase === 'ready' && selected.length > 0
          && (scope === 'all' || modelId !== '')
        const statusText = notice !== null
          ? notice.text
          : dirty ? t('dirtyNotice') : ''
        const showOnboarding = savedRules.length === 0 && !pickerOpen

        return h('section', { className: 'dop' },
          h('style', null, CSS),
          h('header', { className: 'dop-head' },
            h('h2', { className: 'dop-title' }, t('title')),
            h('p', { className: 'dop-sub' }, t('subtitle'))),

          /* 对象条 */
          h('div', { className: 'dop-object' },
            h('div', { className: 'dop-objectMain' },
              h('div', { className: 'dop-objectLine' },
                h('span', { className: 'dop-objectName' }, objectName),
                modelIsAlias ? h('span', { className: 'dop-tag' }, t('badgeAlias')) : null,
                emptyReason === 'router' ? h('span', { className: 'dop-tag' }, t('badgeRouter')) : null),
              h('div', { className: 'dop-objectId' }, modelId === '' ? '—' : modelId),
              objectSpecs === '' ? null : h('div', { className: 'dop-objectSpecs' }, objectSpecs)),
            h('button', {
              type: 'button', className: 'dop-button',
              onClick: () => { if (pickerOpen) setPickerOpen(false); else openPicker() },
            }, pickerOpen ? t('collapse') : t('changeModel'))),

          /* 更换模型面板 */
          pickerOpen
            ? h('div', { className: 'dop-picker' },
              h('div', { className: 'dop-toolbar' },
                h('input', {
                  className: 'dop-input', value: modelFilter, spellCheck: false, autoFocus: true,
                  placeholder: t('pickerFilter'), 'aria-label': t('pickerFilter'),
                  onChange: event => { setModelFilter(event.target.value) },
                })),
              renderPicker(),
              h('details', { className: 'dop-advanced' },
                h('summary', null, t('pickerAdvanced')),
                h('div', { className: 'dop-toolbar' },
                  h('input', {
                    className: 'dop-input', value: manualModel, spellCheck: false,
                    placeholder: t('pickerAdvancedPlaceholder'), 'aria-label': t('pickerAdvanced'),
                    disabled: busy,
                    onChange: event => { setManualModel(event.target.value) },
                    onKeyDown: event => { if (event.key === 'Enter' && manualModel.trim() !== '') { setManualModel(''); chooseModel(manualModel) } },
                  }),
                  h('button', {
                    type: 'button', className: 'dop-button',
                    disabled: busy || manualModel.trim() === '',
                    onClick: () => { const value = manualModel; setManualModel(''); chooseModel(value) },
                  }, t('load'))),
                h('p', { className: 'dop-hint' }, t('pickerAdvancedHint'))))
            : null,

          /* 首次引导 */
          showOnboarding
            ? h('div', { className: 'dop-checklist' },
              h('span', { 'data-done': modelId !== '' ? 'true' : 'false' }, t('onboardStep1')),
              h('span', { 'data-done': selected.length > 0 ? 'true' : 'false' }, t('onboardStep2')),
              h('span', null, t('onboardStep3')))
            : null,

          /* 工作面：左侧主线（手填 + 已指定），右侧栏（在线挑选） */
          renderWork(),

          /* 已保存的指定 */
          h('details', { className: 'dop-sub' },
            h('summary', null, `${t('savedRulesLabel')}（${savedRules.length}）`),
            savedRules.length === 0
              ? h('p', { className: 'dop-fileline' }, t('savedRulesEmpty'))
              : savedRules.map(([key, rule]) => h('div', { className: 'dop-savedRow', key },
                h('span', { className: 'dop-savedModel', title: key }, key === ALL_MODELS ? t('savedAll') : key),
                h('span', { className: 'dop-savedMeta' }, `${(rule.only ?? []).length}${t('savedProviderCountSuffix')}`),
                h('span', { className: 'dop-savedMeta' }, rule.allowFallbacks === true ? t('savedFallback') : t('savedNoFallback')),
                h('button', {
                  type: 'button', className: 'dop-link', disabled: busy,
                  onClick: () => { void clearRule(key) },
                }, t('delete'))))),

          /* 配置文件位置 */
          h('details', { className: 'dop-sub' },
            h('summary', null, t('configLocation')),
            h('p', { className: 'dop-fileline' }, state?.policyFile ?? '')),

          /* 吸底操作条 */
          h('div', { className: 'dop-actionbar' },
            confirmRemove
              ? [
                h('span', { key: 'confirm', className: 'dop-status', role: 'alert' },
                  `${t('confirmClearPrefix')}${storedRule?.storedKey === ALL_MODELS ? t('savedAll') : (storedRule?.storedKey ?? currentKey)}${t('confirmClearSuffix')}`),
                h('span', { key: 'spacer', className: 'dop-spacer' }),
                h('button', {
                  key: 'cancel', type: 'button', className: 'dop-button', disabled: busy,
                  onClick: () => { setConfirmRemove(false) },
                }, t('cancel')),
                h('button', {
                  key: 'confirmYes', type: 'button', className: 'dop-primary dop-primaryDanger', disabled: busy,
                  onClick: () => { void clearRule(storedRule?.storedKey ?? currentKey) },
                }, t('confirmYes')),
              ]
              : [
                h('button', {
                  key: 'fallbacks', type: 'button', className: 'dop-switch', role: 'switch',
                  'aria-checked': allowFallbacks ? 'true' : 'false',
                  disabled: busy,
                  onClick: () => { setAllowFallbacks(value => !value); markDirty() },
                }, h('span', { className: 'dop-switchTrack' }, h('span', { className: 'dop-switchThumb' })), t('fallbacksLabel')),
                h('span', { key: 'scope', className: 'dop-seg', role: 'group', 'aria-label': t('scopeLabel') },
                  h('button', {
                    type: 'button', 'aria-pressed': scope === 'model' ? 'true' : 'false',
                    disabled: busy, onClick: () => { changeScope('model') },
                  }, t('scopeModel')),
                  h('button', {
                    type: 'button', 'aria-pressed': scope === 'all' ? 'true' : 'false',
                    disabled: busy, onClick: () => { changeScope('all') },
                  }, t('scopeAll'))),
                h('button', {
                  key: 'clear', type: 'button', className: 'dop-link dop-linkDanger',
                  disabled: busy || !hasRule,
                  onClick: () => { setConfirmRemove(true); setNotice(null) },
                }, t('clearPin')),
                h('span', { key: 'spacer', className: 'dop-spacer' }),
                h('p', {
                  key: 'status', className: 'dop-status', role: 'status', 'aria-live': 'polite',
                  'data-tone': notice?.tone,
                }, statusText),
                h('button', {
                  key: 'save', type: 'button', className: 'dop-primary', disabled: !canSave,
                  onClick: () => { void save() },
                }, busy ? t('saving') : t('save')),
              ]))
      }
    }

    return {
      inject: ['slots', 'connection', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'openrouter-provider: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'openrouter-provider', order: 25,
          label: () => t('navLabel'),
        }, createSection(ctx))), 'openrouter-provider: settings section')
      },
    }
  },
})
