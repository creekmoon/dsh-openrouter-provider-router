/**
 * OpenRouter 供应商路由（浏览器半）
 * 结构：三视图状态机 —— 清单（已存规则）/ 编辑（草稿）/ 选择模型，切换只改 page.view，
 *       不新开路由；视觉全部走宿主令牌，尺寸对齐官方设置页（564px 内容列、0.5px 发丝线、r20 卡片）。
 */
window.__ModuleLoader__.load({
  // id 必须等于 package.json 的包名：宿主按包名请求浏览器模块，不对上则工厂注册后不挂到该行，插件静默不出现
  id: '@creekmoon/dsh-openrouter-provider-router',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    /** 设置页文案命名空间 */
    const NS = 'openrouter-provider'
    /** Connection 的共享通道与 Host 注册的端点名 */
    const RPC_CHANNEL = '/api'
    const RPC_ENDPOINT = 'openrouter-provider'
    /** 通配模型键，与 Host 的 ALL_MODELS 一致 */
    const ALL_MODELS = '*'
    /** 模型目录一次最多渲染多少行 */
    const MODEL_LIST_LIMIT = 80
    /** 供应商 slug 形态，与 Host 的 PROVIDER_SLUG 保持一致 */
    const PROVIDER_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?:\/[A-Za-z0-9._-]{1,64}){0,2}$/

    const zh = {
      navLabel: '供应商路由器',
      title: '供应商路由器',
      intro: 'OpenRouter 默认在同一模型的多个供应商之间自动挑选。这里每条指定都会把选择写死。',

      loadingRules: '正在读取设置…',
      addRule: '新建指定',
      emptyBody: '还没有任何指定。没有指定时，OpenRouter 会自己挑，可能挑到更贵或更慢的那家。',
      step1: '选一个模型，或者选「所有 OpenRouter 模型」',
      step2: '勾选要用的供应商，价格、上下文和可用性就在同一行',
      step3: '保存后立即生效，不需要重启',
      configLabel: '规则文件',

      allModels: '所有 OpenRouter 模型',
      allModelsMeta: '未单独指定的模型都走这一条',
      handsTo: '交给',
      tagWildcard: '通配',
      tagDefault: '当前默认',
      tagFallbacks: '允许回退',
      tagNoFallbacks: '不回退',
      tagAlias: 'Latest 别名',
      tagRouter: '路由',
      tagDegraded: '状态异常',
      edit: '编辑',
      remove: '删除',

      backToList: '供应商路由器',
      editorTitle: '指定供应商',
      editorIntro: '勾选要用的供应商；清单按输入价从低到高排。',
      sectionModel: '模型',
      sectionProviders: '供应商',
      sectionBehavior: '规则行为',
      changeModel: '更换',
      pickModel: '选择模型',
      pickModelFirst: '先选择模型，再挑供应商。',
      selectedPrefix: '已选 ',
      ofTotalPrefix: ' / 共 ',
      countSuffix: ' 家',
      clear: '清空',
      servingSuffix: ' 家可服务这个模型',
      sortInput: '输入价 ↑',
      tableProvider: '供应商',
      tableInput: '输入 $',
      tableOutput: '输出 $',
      tableUptime: '可用性',
      manualPlaceholder: '也可以直接填供应商 slug，例如 stepfun/fp8',
      add: '添加',
      manualHint: '可一次填多个，用逗号或空格分隔；清单外的 slug 也能保存，但请求可能被 OpenRouter 拒绝。',
      manualInvalidPrefix: '格式不正确：',
      listSeparator: '、',
      labelSeparator: '：',
      notInCatalog: '清单里没有这些 slug',
      notInCatalogHint: '拼写可能有误；保存后仍会按原样生效。',
      allowFallbacks: '允许回退',
      allowFallbacksDesc: '开启后，名单外的供应商仍可接管失败的请求；关闭后只发给上面这几家，可预测但更容易失败。',
      atLeastOne: '至少选 1 家供应商才能保存',

      unsaved: '未保存修改',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      deleteHint: '删除后，这个模型交回 OpenRouter 自动选择。',
      deleteRule: '删除这条指定',
      confirmDelete: '确认删除',
      deleted: '已删除',
      saved: '已保存',
      savedMismatchPrefix: '已保存，但当前默认模型是 ',
      savedMismatchSuffix: '，与此指定不同，暂时不会生效 —— 改用「所有 OpenRouter 模型」或切换默认模型。',
      saveFailedPrefix: '保存失败：',
      deleteFailedPrefix: '删除失败：',
      loadFailedPrefix: '读取设置失败：',

      catalogLoading: '正在读取供应商清单…',
      catalogErrorTitle: '读不到这个模型的供应商清单',
      catalogErrorHint: '手填的 slug 不受影响，保存后仍按你填的生效。',
      retry: '重试',
      aliasTitle: '别名没有固定的供应商清单',
      aliasText: '别名指向「同家族最新的具体模型」，所以清单随之变动。先选一个具体模型，再为它挑供应商。',
      routerTitle: '路由模型没有固定的供应商清单',
      routerText: '路由模型由 OpenRouter 按请求决定实际模型，没有候选清单可挑。',
      pickConcrete: '改选具体模型',
      allScopeTitle: '所有模型没有按模型的候选清单',
      allScopeText: '每个模型能服务的供应商不同，所以这里直接填 slug；填错不会拦住保存，但请求会返回 4xx。',
      noProviders: '该模型没有可用供应商，确认模型 id 是否正确。',

      pickerTitle: '选择模型',
      pickerIntro: '按 id 或名称搜索，也可以直接粘贴 OpenRouter 模型页地址。',
      searchModels: '搜索模型 id 或名称',
      pickerAllDesc: '一条规则覆盖全部模型，不需要候选清单',
      modelsLoading: '正在读取模型目录…',
      modelsErrorPrefix: '读取模型目录失败：',
      modelsEmpty: '没有匹配的模型',
      modelsMatchPrefix: '匹配 ',
      modelsTotalPrefix: '，共 ',
      modelsCountSuffix: ' 个',
      modelsTruncated: '匹配较多，仅显示前 80 个，请把搜索词写细一点。',
      manualModelLabel: '手动输入模型 id',
      manualModelPlaceholder: 'deepseek/deepseek-v4.1-flash-1017 或模型页地址',
      load: '打开',
      manualModelHint: '支持带 /models/、?endpoint=、#providers 的模型页地址。',

      context: '上下文',
      maxOutput: '最大输出',
      inputLabel: '输入',
      precision: '精度',
      unknownValue: '未知',
    }

    const en = {
      navLabel: 'Provider router',
      title: 'Provider router',
      intro: 'OpenRouter picks among a model’s providers by itself. Each pin here fixes that choice.',

      loadingRules: 'Reading settings…',
      addRule: 'New pin',
      emptyBody: 'No pins yet. Without one, OpenRouter chooses the provider itself and may pick a pricier or slower one.',
      step1: 'Pick a model, or pick “All OpenRouter models”',
      step2: 'Tick the providers you want; price, context and uptime sit on one row',
      step3: 'Save; it applies immediately, no restart',
      configLabel: 'Rules file',

      allModels: 'All OpenRouter models',
      allModelsMeta: 'Models without their own pin fall back to this one',
      handsTo: 'to',
      tagWildcard: 'wildcard',
      tagDefault: 'current default',
      tagFallbacks: 'fallbacks on',
      tagNoFallbacks: 'no fallbacks',
      tagAlias: 'latest alias',
      tagRouter: 'router',
      tagDegraded: 'degraded',
      edit: 'Edit',
      remove: 'Delete',

      backToList: 'Provider router',
      editorTitle: 'Pin providers',
      editorIntro: 'Tick the providers to use; the list is sorted by input price.',
      sectionModel: 'Model',
      sectionProviders: 'Providers',
      sectionBehavior: 'Rule behaviour',
      changeModel: 'Change',
      pickModel: 'Pick a model',
      pickModelFirst: 'Pick a model first, then its providers.',
      selectedPrefix: 'Selected ',
      ofTotalPrefix: ' of ',
      countSuffix: '',
      clear: 'Clear',
      servingSuffix: ' providers serve this model',
      sortInput: 'input ↑',
      tableProvider: 'Provider',
      tableInput: 'in $',
      tableOutput: 'out $',
      tableUptime: 'uptime',
      manualPlaceholder: 'Or type a provider slug, for example stepfun/fp8',
      add: 'Add',
      manualHint: 'Type several at once, separated by commas or spaces; a slug outside the list still saves, but OpenRouter may reject the request.',
      manualInvalidPrefix: 'Invalid slug: ',
      listSeparator: ', ',
      labelSeparator: ': ',
      notInCatalog: 'not in this model’s list',
      notInCatalogHint: 'possibly a typo; it is still saved as typed.',
      allowFallbacks: 'Allow fallbacks',
      allowFallbacksDesc: 'On, providers outside the list may still take over a failed request; off, only the ones above are used.',
      atLeastOne: 'Select at least one provider to save',

      unsaved: 'Unsaved changes',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      deleteHint: 'After deleting, this model goes back to OpenRouter’s own choice.',
      deleteRule: 'Delete this pin',
      confirmDelete: 'Delete',
      deleted: 'Deleted',
      saved: 'Saved',
      savedMismatchPrefix: 'Saved, but the current default model is ',
      savedMismatchSuffix: ', so this pin does not apply yet — use “All OpenRouter models” or switch the default model.',
      saveFailedPrefix: 'Save failed: ',
      deleteFailedPrefix: 'Delete failed: ',
      loadFailedPrefix: 'Could not read the setting: ',

      catalogLoading: 'Loading the provider list…',
      catalogErrorTitle: 'Could not load this model’s providers',
      catalogErrorHint: 'Typed slugs still apply; the saved rule keeps what you typed.',
      retry: 'Retry',
      aliasTitle: 'An alias has no fixed provider list',
      aliasText: 'An alias points at the newest concrete model in its family, so the list moves with it. Pick a concrete model first.',
      routerTitle: 'A router model has no fixed provider list',
      routerText: 'A router picks the real model per request, so there is no candidate list.',
      pickConcrete: 'Pick a concrete model',
      allScopeTitle: 'All models has no per-model candidate list',
      allScopeText: 'Each model serves a different set of providers, so type slugs here; a wrong one still saves but returns 4xx.',
      noProviders: 'No provider serves this model; check the model id.',

      pickerTitle: 'Pick a model',
      pickerIntro: 'Search by id or name, or paste an OpenRouter model page URL.',
      searchModels: 'Search a model id or name',
      pickerAllDesc: 'One rule for every model; no candidate list needed',
      modelsLoading: 'Loading the model catalog…',
      modelsErrorPrefix: 'Could not load the catalog: ',
      modelsEmpty: 'No model matches',
      modelsMatchPrefix: 'Matched ',
      modelsTotalPrefix: ' of ',
      modelsCountSuffix: '',
      modelsTruncated: 'Many matches; showing the first 80. Narrow the search.',
      manualModelLabel: 'Type a model id',
      manualModelPlaceholder: 'deepseek/deepseek-v4.1-flash-1017 or a model page URL',
      load: 'Open',
      manualModelHint: 'Accepts model page URLs with /models/, ?endpoint= or #providers.',

      context: 'context',
      maxOutput: 'max output',
      inputLabel: 'input',
      precision: 'precision',
      unknownValue: 'unknown',
    }

    const CSS = `
/* 尺寸取自宿主设置页：区块 16/24 500、导语 14/22、字段标签 12/18 500、输入 32/r12、卡片 0.5px/r20 */
.dop { container-type: inline-size; display: flex; flex-direction: column; gap: 12px; max-width: 720px; color: var(--dsw-alias-label-primary); font-variant-numeric: tabular-nums; }
.dop-head { display: flex; flex-direction: column; gap: 12px; }
.dop-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; }
.dop-intro { margin: 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }
.dop-status { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-status[data-tone='warn'] { color: var(--dsw-alias-state-warn-label); }
.dop-status[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }

.dop-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.dop-card { display: flex; flex-direction: column; gap: 12px; padding: 12px 14px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
.dop-rowHead { display: flex; align-items: center; gap: 10px; }
.dop-rowMain { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dop-rowTitle { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dop-rowName { font-size: 14px; line-height: 22px; font-weight: 500; overflow-wrap: anywhere; }
.dop-meta { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dop-tags { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dop-tag { flex: none; padding: 1px 6px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-xs); font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
.dop-tagAccent { border-color: var(--dsw-alias-state-business-primary); color: var(--dsw-alias-state-business-primary); }
.dop-tagWarn { border-color: var(--dsw-alias-state-warn-label); color: var(--dsw-alias-state-warn-label); }
.dop-tagMuted { border-color: transparent; background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-tertiary); }
.dop-removable { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 4px 0 7px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-xs); font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
.dop-removableCode { font-family: var(--ds-font-family-code, monospace); }
.dop-tagButton { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; padding: 0; border: none; border-radius: var(--dsw-radius-xs); background: transparent; color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
.dop-tagButton:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dop-actions { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; }

.dop-compact { display: inline-flex; align-items: center; justify-content: center; height: 28px; padding: 0 10px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-sm); background: transparent; font: inherit; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-primary); cursor: pointer; transition: background-color 120ms ease, transform 120ms ease; }
.dop-compact:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover); }
.dop-compact:active:not([disabled]) { transform: scale(0.98); }
.dop-compact[disabled] { opacity: 0.4; cursor: default; }
.dop-compactDanger { border: none; color: var(--dsw-alias-state-error-primary); }
.dop-compactDanger:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover-danger); }

.dop-add { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; height: 44px; border: 1px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-lg); background: transparent; font: inherit; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); cursor: pointer; transition: background-color 120ms ease, transform 120ms ease; }
.dop-add:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover); }
.dop-add:active:not([disabled]) { transform: scale(0.99); }

.dop-empty { padding: 12px; border: 1px dashed var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-lg); text-align: center; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.dop-steps { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.dop-step { display: flex; align-items: baseline; gap: 8px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dop-stepNum { font-family: var(--ds-font-family-code, monospace); font-variant-numeric: tabular-nums; }

.dop-crumb { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; height: 18px; padding: 0; border: none; background: none; color: var(--dsw-alias-label-tertiary); font: inherit; font-size: 12.5px; line-height: 18px; cursor: pointer; }
.dop-crumb:hover { color: var(--dsw-alias-label-primary); }
.dop-pageTitle { margin: 20px 0 0; font-size: 20px; line-height: 28px; font-weight: 500; }
.dop-pageIntro { margin: 8px 0 0; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-secondary); }

.dop-section { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; }
.dop-sectionHead { display: flex; align-items: baseline; gap: 10px; }
.dop-sectionTitle { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; }
.dop-count { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }

.dop-field { display: flex; flex-direction: column; gap: 6px; }
.dop-label { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-secondary); }
.dop-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dop-input { box-sizing: border-box; width: 100%; height: 32px; padding: 0 10px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 14px; line-height: 22px; }
.dop-input::placeholder { color: var(--dsw-alias-label-caption); }
.dop-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.dop-code { font-family: var(--ds-font-family-code, monospace); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); overflow-wrap: anywhere; }
.dop-inline { display: flex; align-items: center; gap: 8px; }
.dop-inline .dop-input { flex: 1; min-width: 0; }

.dop-inset { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-module-platform); }
.dop-insetTitle { font-size: 14px; line-height: 22px; font-weight: 500; }

.dop-table { border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-xl); overflow: hidden; }
.dop-tableHead { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 0.5px solid var(--dsw-alias-border-l2); }
.dop-columns { display: grid; grid-template-columns: 20px minmax(0, 1fr) 56px 56px 64px; gap: 8px; align-items: center; padding: 6px 14px; background: var(--dsw-alias-bg-module-platform); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dop-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) 56px 56px 64px; gap: 8px; align-items: center; min-height: 44px; box-sizing: border-box; padding: 6px 14px; border-top: 0.5px solid var(--dsw-alias-border-l2); cursor: pointer; transition: background-color 120ms ease; }
.dop-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dop-row[data-selected='true'] { background: var(--dsw-alias-bg-multi-select); }
.dop-row input { width: 16px; height: 16px; margin: 0; accent-color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.dop-num { text-align: right; font-family: var(--ds-font-family-code, monospace); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-uptime { display: inline-flex; align-items: center; justify-content: flex-end; gap: 5px; font-family: var(--ds-font-family-code, monospace); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; }
.dop-dot[data-tone='ok'] { background: var(--dsw-alias-state-success-primary); }
.dop-dot[data-tone='warn'] { background: var(--dsw-alias-state-warn-label); }
.dop-dot[data-tone='bad'] { background: var(--dsw-alias-state-error-primary); }

.dop-switch { flex: none; display: inline-flex; align-items: center; height: 20px; padding: 0; border: none; background: none; cursor: pointer; }
.dop-switchTrack { position: relative; width: 36px; height: 20px; border-radius: 999px; background: var(--dsw-alias-state-idle-primary); transition: background-color 150ms ease; }
.dop-switch[aria-checked='true'] .dop-switchTrack { background: var(--dsw-alias-state-business-primary); }
.dop-switchThumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-switch-thumb); transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1); }
.dop-switch[aria-checked='true'] .dop-switchThumb { transform: translateX(16px); }
.dop-switch[disabled] { opacity: 0.4; cursor: default; }
.dop-behavior { display: flex; align-items: flex-start; gap: 16px; }

.dop-footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 20px; }
.dop-footerStatus { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dop-dirty { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-spacer { flex: 1; }
.dop-primary { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 14px; border: none; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); font: inherit; font-size: 14px; line-height: 22px; cursor: pointer; transition: background-color 120ms ease, transform 120ms ease; }
.dop-primary:hover:not([disabled]) { background: var(--dsw-alias-button-primary-hover); }
.dop-primary:active:not([disabled]) { transform: scale(0.98); }
.dop-primary[disabled] { opacity: 0.4; cursor: default; }
.dop-secondary { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 14px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md); background: transparent; font: inherit; font-size: 14px; line-height: 22px; color: var(--dsw-alias-label-primary); cursor: pointer; transition: background-color 120ms ease, transform 120ms ease; }
.dop-secondary:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover-solid); }
.dop-secondary:active:not([disabled]) { transform: scale(0.98); }
.dop-secondary[disabled] { opacity: 0.4; cursor: default; }
.dop-danger { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 20px; padding-top: 16px; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.dop-dangerButton { height: 36px; padding: 0 14px; border: none; border-radius: var(--dsw-radius-md); background: transparent; font: inherit; font-size: 14px; line-height: 22px; color: var(--dsw-alias-state-error-primary); cursor: pointer; }
.dop-dangerButton:hover:not([disabled]) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.dop-dangerButton[disabled] { opacity: 0.4; cursor: default; }

.dop-pick { display: flex; flex-direction: column; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-xl); overflow: hidden; }
.dop-pickRow { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border: none; border-top: 0.5px solid var(--dsw-alias-border-l2); background: transparent; font: inherit; text-align: left; color: inherit; cursor: pointer; transition: background-color 120ms ease; }
.dop-pickRow:first-child { border-top: none; }
.dop-pickRow:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dop-pickRow[data-current='true'] { background: var(--dsw-alias-bg-multi-select); }
.dop-pickMain { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.dop-pickTop { display: flex; align-items: center; gap: 6px; }
.dop-pickName { font-size: 14px; line-height: 22px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dop-pickPrice { margin-left: auto; font-family: var(--ds-font-family-code, monospace); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dop-config { display: flex; align-items: center; gap: 8px; min-width: 0; margin-top: 12px; }

@container (max-width: 520px) {
  .dop-colOut, .dop-colUptime { display: none; }
  .dop-columns, .dop-row { grid-template-columns: 20px minmax(0, 1fr) 52px; }
  .dop-behavior { flex-direction: column; }
  .dop-footer { align-items: stretch; }
  .dop-footer .dop-primary, .dop-footer .dop-secondary { flex: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .dop-primary, .dop-secondary, .dop-compact, .dop-add, .dop-row, .dop-pickRow, .dop-switchThumb, .dop-switchTrack, .dop-tagButton { transition: none; }
}
`

    /**
     * 调用 Host 的 RPC 端点，把 ok:false 统一抛成 Error
     * @param {unknown} connection 浏览器侧的 connection 服务
     * @param {string} method 操作名（state / models / providers / save / clear）
     * @param {unknown} payload 参数
     * @param {AbortSignal} [signal] 取消信号
     * @returns {Promise<any>} Host 返回的 value
     */
    async function callRpc(connection, method, payload, signal) {
      const result = await connection.rpc.call(RPC_CHANNEL, RPC_ENDPOINT, { method, payload }, signal)
      if (result?.ok === false) throw new Error(result.error?.message ?? 'request failed')
      return result?.ok === true ? result.value : result
    }

    /**
     * 计算某模型对应的规则键：通配模型用 `*`，否则用去空格的模型 id
     * @param {unknown} model 模型 id 或通配标记
     * @returns {string} 规则键
     */
    function ruleKeyOf(model) {
      return model === ALL_MODELS ? ALL_MODELS : String(model ?? '').trim()
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
     * 在规则表里找一条规则，兼容 `~` 前缀的两种写法
     * @param {unknown} rules 规则表，来自 state RPC
     * @param {string} key 规则键
     * @returns {{ key: string, only: string[], allowFallbacks: boolean } | undefined} 命中的规则，含真实键
     */
    function findRule(rules, key) {
      if (!isRecord(rules)) return undefined
      const bare = key === ALL_MODELS ? key : key.replace(/^~/, '')
      const keys = key === bare ? [key] : [key, bare]
      for (const candidate of keys) {
        if (!Object.hasOwn(rules, candidate)) continue
        const rule = rules[candidate]
        return {
          key: candidate,
          only: Array.isArray(rule?.only) ? rule.only : [],
          allowFallbacks: rule?.allowFallbacks === true,
        }
      }
      return undefined
    }

    /**
     * 把规则表整理成清单页需要的行，通配规则排在最前
     * @param {unknown} snapshot state RPC 返回的宿主状态，含 rules
     * @returns {Array<{ key: string, only: string[], allowFallbacks: boolean }>} 已存规则行
     */
    function listRules(snapshot) {
      const rules = snapshot?.rules
      if (!isRecord(rules)) return []
      /* 排序步骤：通配键置顶，其余按模型 id 字典序 */
      return Object.keys(rules)
        .sort((left, right) => (left === ALL_MODELS ? -1 : right === ALL_MODELS ? 1 : left.localeCompare(right)))
        .map(key => findRule(rules, key))
        .filter(rule => rule !== undefined)
    }

    /**
     * 取当前默认模型；默认选择不走 OpenRouter 时返回空串
     * @param {unknown} snapshot state RPC 返回的宿主状态，含 defaultSelection
     * @returns {string} 默认模型 id，没有时为 ''
     */
    function defaultModelOf(snapshot) {
      const selection = snapshot?.defaultSelection
      if (selection?.provider !== 'openrouter') return ''
      return typeof selection.model === 'string' ? selection.model : ''
    }

    /**
     * 判断规则键是否就是当前默认模型，忽略 `~` 前缀差异
     * @param {string} key 规则键
     * @param {string} defaultModel 当前默认模型，来自 defaultModelOf()
     * @returns {boolean} true 表示这条指定当前生效
     */
    function isDefaultRule(key, defaultModel) {
      if (defaultModel === '' || key === ALL_MODELS) return false
      return key.replace(/^~/, '') === defaultModel.replace(/^~/, '')
    }

    /**
     * 判断草稿相对已存规则是否有改动
     * @param {unknown} snapshot 宿主状态，含 rules
     * @param {string} key 草稿对应的规则键
     * @param {{ providers: string[], allowFallbacks: boolean }} draft 编辑中的草稿
     * @returns {boolean} true 表示有未保存修改
     */
    function hasUnsavedChanges(snapshot, key, draft) {
      const stored = findRule(snapshot?.rules, key)
      if (stored === undefined) return draft.providers.length > 0 || draft.allowFallbacks
      if (stored.allowFallbacks !== draft.allowFallbacks) return true
      if (stored.only.length !== draft.providers.length) return true
      /* 比对步骤：两份 slug 先排序再逐项比，避免勾选顺序造成假“未保存” */
      const storedSorted = [...stored.only].sort()
      const draftSorted = [...draft.providers].sort()
      return storedSorted.some((slug, index) => slug !== draftSorted[index])
    }

    /**
     * 把供应商清单按输入价升序排列，未报价的排到最后
     * @param {unknown} catalog providers RPC 返回的清单，含 providers
     * @returns {Array<Record<string, unknown>>} 排序后的供应商行
     */
    function sortProvidersByPrice(catalog) {
      const rows = Array.isArray(catalog?.providers) ? catalog.providers : []
      /* 排序步骤：输入价升序；未知价置底；同价按 tag 字典序 */
      return [...rows].sort((left, right) => {
        const leftPrice = Number(left?.promptPerMillion)
        const rightPrice = Number(right?.promptPerMillion)
        const leftKnown = Number.isFinite(leftPrice)
        const rightKnown = Number.isFinite(rightPrice)
        if (leftKnown && rightKnown && leftPrice !== rightPrice) return leftPrice - rightPrice
        if (leftKnown !== rightKnown) return leftKnown ? -1 : 1
        return String(left?.tag ?? '').localeCompare(String(right?.tag ?? ''))
      })
    }

    /**
     * 按关键字过滤模型目录，匹配 id 或名称
     * @param {unknown} models models RPC 返回的模型数组
     * @param {string} query 搜索词
     * @returns {Array<Record<string, unknown>>} 命中的模型
     */
    function filterModels(models, query) {
      const rows = Array.isArray(models) ? models : []
      const keyword = query.trim().toLowerCase()
      if (keyword === '') return rows
      /* 过滤步骤：id 或名称包含关键字即命中 */
      return rows.filter(row => String(row.id).toLowerCase().includes(keyword) || String(row.name).toLowerCase().includes(keyword))
    }

    /**
     * 把每百万 token 价格渲染成简短数字
     * @param {unknown} value 每百万 token 的美元价
     * @returns {string} 形如 0.105，未知时为 '?'
     */
    function priceText(value) {
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : '?'
    }

    /**
     * 把 token 数渲染成带千分位的文本
     * @param {unknown} value token 数
     * @returns {string} 形如 1,048,576，未知时为 '?'
     */
    function tokenText(value) {
      return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '?'
    }

    /**
     * 把 token 数压成窄栏用的短写法
     * @param {unknown} value token 数
     * @returns {string} 形如 1.05M / 384K，未知时为 '?'
     */
    function compactToken(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '?'
      if (value >= 1000000) return `${(value / 1000000).toFixed(2).replace(/\.?0+$/, '')}M`
      if (value >= 1000) return `${Math.round(value / 1000)}K`
      return String(Math.round(value))
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
     * 取精度文案：清单缺字段或标为 unknown 时统一归到“未知”
     * @param {unknown} row 供应商行
     * @param {string} unknownLabel 本地化的“未知”
     * @returns {string} 精度文案
     */
    function quantizationText(row, unknownLabel) {
      const value = row?.quantization
      return typeof value === 'string' && value !== '' && value !== 'unknown' ? value : unknownLabel
    }

    /**
     * 按可用性百分比给出小圆点的色调
     * @param {unknown} value 近 30 分钟可用性百分比
     * @returns {'ok' | 'warn' | 'bad' | 'none'} 色调，未知时为 none
     */
    function uptimeTone(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'none'
      if (value >= 99) return 'ok'
      return value >= 95 ? 'warn' : 'bad'
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
     * 把多段手填内容拆成合法与非法两组 slug
     * @param {unknown} text 手填内容，可含逗号、空格、换行
     * @returns {{ valid: string[], invalid: string[] }} 校验结果
     */
    function splitManualSlugs(text) {
      /* 分隔符除半角逗号分号，也收中文全角逗号分号：用户常从中文文档整段粘贴 */
      const parts = String(text ?? '').split(/[\s,;\uFF0C\uFF1B]+/).filter(part => part !== '')
      /* 分组步骤：逐项过 slug 正则，合法与非法分开 */
      return {
        valid: parts.filter(part => PROVIDER_SLUG.test(part)),
        invalid: parts.filter(part => !PROVIDER_SLUG.test(part)),
      }
    }

    /**
     * 构造设置分区的初始页面状态
     * @returns {Record<string, unknown>} 页面状态，view 初始为清单
     */
    function initialPage() {
      return {
        phase: 'loading',
        snapshot: null,
        view: 'list',
        notice: null,
        busy: false,
        draft: { model: '', providers: [], allowFallbacks: false },
        storedKey: '',
        confirmDelete: false,
        catalog: null,
        catalogPhase: 'idle',
        catalogError: null,
        manualInput: '',
        manualError: null,
        models: null,
        modelsPhase: 'idle',
        modelsError: null,
        modelFilter: '',
        manualModel: '',
      }
    }

    /**
     * 构造设置分区组件：供应商路由器的清单 / 编辑 / 选择模型三视图
     * @param {{ locale: unknown, connection: unknown }} ctx 浏览器插件上下文
     * @returns {() => unknown} 设置分区 React 组件
     */
    function createSection(ctx) {
      const t = ctx.locale.bind(NS)

      return function OpenRouterProviderSection() {
        const mounted = useRef(true)
        const [page, setPage] = useState(initialPage())

        const providerRows = useMemo(() => sortProvidersByPrice(page.catalog), [page.catalog])
        const savedRows = useMemo(() => listRules(page.snapshot), [page.snapshot])
        const pickerRows = useMemo(() => filterModels(page.models, page.modelFilter), [page.models, page.modelFilter])

        const defaultModel = defaultModelOf(page.snapshot)
        const providerTags = page.draft.providers
        const knownSlugs = providerRows.map(row => row.tag)
        const unknownSlugs = providerTags.filter(slug => !knownSlugs.includes(slug))

        /**
         * 合并一次页面状态补丁
         * @param {Record<string, unknown>} next 要覆盖的字段
         * @returns {void}
         */
        const patch = (next) => setPage(current => ({ ...current, ...next }))

        /**
         * 按当前草稿里的模型拉供应商清单
         * @param {string} input 模型 id 或模型页地址
         * @returns {Promise<void>} 拉取结束
         */
        const loadProviders = async (input) => {
          const raw = String(input ?? '').trim()
          if (raw === '') return
          patch({ catalogPhase: 'loading', catalogError: null })
          try {
            const value = await callRpc(ctx.connection, 'providers', { input: raw })
            if (!mounted.current) return
            patch({ catalog: value ?? null, catalogPhase: 'ready' })
          } catch (error) {
            if (!mounted.current) return
            patch({ catalogError: error?.message ?? String(error), catalogPhase: 'error' })
          }
        }

        /**
         * 拉模型目录，供选择模型视图搜索
         * @returns {Promise<void>} 拉取结束
         */
        const loadModels = async () => {
          patch({ modelsPhase: 'loading', modelsError: null })
          try {
            const value = await callRpc(ctx.connection, 'models', {})
            if (!mounted.current) return
            patch({ models: Array.isArray(value) ? value : [], modelsPhase: 'ready' })
          } catch (error) {
            if (!mounted.current) return
            patch({ modelsError: error?.message ?? String(error), modelsPhase: 'error' })
          }
        }

        /**
         * 读宿主状态；默认模型确实走 OpenRouter 时把它带进草稿
         * @param {AbortSignal} signal 取消信号
         * @returns {Promise<void>} 读取结束
         */
        const loadState = async (signal) => {
          try {
            const snapshot = await callRpc(ctx.connection, 'state', {}, signal)
            if (signal?.aborted || !mounted.current) return
            const model = defaultModelOf(snapshot)
            const stored = findRule(snapshot.rules, ruleKeyOf(model))
            patch({
              snapshot,
              phase: 'ready',
              draft: {
                model,
                providers: stored?.only ?? [],
                allowFallbacks: stored?.allowFallbacks === true,
              },
            })
          } catch (error) {
            if (signal?.aborted || !mounted.current) return
            patch({ phase: 'error', notice: { tone: 'error', text: `${t('loadFailedPrefix')}${error?.message ?? String(error)}` } })
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

        /**
         * 回到清单视图并清掉编辑期的临时状态
         * @returns {void}
         */
        const showList = () => {
          patch({
            view: 'list',
            notice: null,
            confirmDelete: false,
            catalog: null,
            catalogPhase: 'idle',
            catalogError: null,
            manualInput: '',
            manualError: null,
          })
        }

        /**
         * 打开某条已存规则的编辑视图，并把规则值灌进草稿
         * @param {string} key 规则键，`*` 表示所有模型
         * @returns {void}
         */
        const openRule = (key) => {
          const stored = findRule(page.snapshot?.rules, key)
          patch({
            view: 'editor',
            storedKey: key,
            notice: null,
            confirmDelete: false,
            manualInput: '',
            manualError: null,
            catalog: null,
            catalogPhase: 'idle',
            catalogError: null,
            draft: {
              model: key,
              providers: stored?.only ?? [],
              allowFallbacks: stored?.allowFallbacks === true,
            },
          })
          if (ruleKeyOf(key) !== ALL_MODELS) void loadProviders(key)
        }

        /**
         * 新建指定：默认模型还没有自己的规则时直接带上它，省一步选择
         * @returns {void}
         */
        const startNewRule = () => {
          const candidate = defaultModel
          const taken = candidate !== '' && findRule(page.snapshot?.rules, ruleKeyOf(candidate)) !== undefined
          const model = taken ? '' : candidate
          patch({
            view: 'editor',
            storedKey: '',
            notice: null,
            confirmDelete: false,
            manualInput: '',
            manualError: null,
            catalog: null,
            catalogPhase: 'idle',
            catalogError: null,
            draft: { model, providers: [], allowFallbacks: false },
          })
          if (model !== '') void loadProviders(model)
        }

        /**
         * 打开选择模型视图，目录没拉过就顺手拉一次
         * @returns {void}
         */
        const openPicker = () => {
          const author = page.draft.model.replace(/^~/, '').split('/')[0]
          patch({ view: 'picker', notice: null, modelFilter: page.modelFilter === '' ? author : page.modelFilter })
          if (page.models === null && page.modelsPhase !== 'loading') void loadModels()
        }

        /**
         * 选定模型后回到编辑视图并拉它的供应商清单
         * @param {string} model 模型 id，`*` 表示所有模型
         * @returns {void}
         */
        const chooseModel = (model) => {
          patch({
            view: 'editor',
            modelFilter: '',
            catalog: null,
            catalogPhase: 'idle',
            catalogError: null,
            draft: { ...page.draft, model },
          })
          if (model !== ALL_MODELS) void loadProviders(model)
        }

        /**
         * 勾选或取消勾选一个供应商
         * @param {string} slug 供应商 tag
         * @returns {void}
         */
        const toggleProvider = (slug) => {
          if (page.busy) return
          setPage(current => {
            const has = current.draft.providers.includes(slug)
            const providers = has
              ? current.draft.providers.filter(item => item !== slug)
              : [...current.draft.providers, slug]
            return { ...current, notice: null, draft: { ...current.draft, providers } }
          })
        }

        /**
         * 把草稿里的供应商全部清空
         * @returns {void}
         */
        const clearProviders = () => {
          if (page.busy) return
          setPage(current => ({ ...current, notice: null, draft: { ...current.draft, providers: [] } }))
        }

        /**
         * 并入手填的供应商 slug，非法项留在输入框并给出提示
         * @returns {void}
         */
        const addManualProviders = () => {
          if (page.busy) return
          const { valid, invalid } = splitManualSlugs(page.manualInput)
          if (valid.length === 0 && invalid.length === 0) return
          setPage(current => {
            const providers = [...current.draft.providers]
            for (const slug of valid) if (!providers.includes(slug)) providers.push(slug)
            return {
              ...current,
              notice: null,
              manualInput: invalid.join(' '),
              manualError: invalid.length === 0 ? null : `${t('manualInvalidPrefix')}${invalid.join(t('listSeparator'))}`,
              draft: { ...current.draft, providers },
            }
          })
        }

        /**
         * 保存草稿并回到清单；保存结果显示在清单页状态行
         * @returns {Promise<void>} 保存结束
         */
        const saveDraft = async () => {
          /* 入参取自草稿，作用范围由模型键决定 */
          const { model, providers, allowFallbacks } = page.draft
          const scope = ruleKeyOf(model) === ALL_MODELS ? 'all' : 'model'

          /* 执行业务：保存规则，回填宿主状态并回到清单 */
          patch({ busy: true, notice: null })
          try {
            const snapshot = await callRpc(ctx.connection, 'save', {
              scope,
              model: scope === 'all' ? '' : model,
              only: providers,
              allowFallbacks,
            })
            if (!mounted.current) return
            /* 默认模型与这条规则不一致时降级为提示，不拦住保存 */
            const currentDefault = defaultModelOf(snapshot)
            const mismatch = scope === 'model' && currentDefault !== '' && !isDefaultRule(ruleKeyOf(model), currentDefault)
            patch({
              snapshot,
              busy: false,
              view: 'list',
              confirmDelete: false,
              notice: mismatch
                ? { tone: 'warn', text: `${t('savedMismatchPrefix')}${currentDefault}${t('savedMismatchSuffix')}` }
                : { tone: 'success', text: t('saved') },
            })
          } catch (error) {
            if (!mounted.current) return
            patch({ busy: false, notice: { tone: 'error', text: `${t('saveFailedPrefix')}${error?.message ?? String(error)}` } })
          }
        }

        /**
         * 删除一条指定并回到清单
         * @param {string} key 规则键
         * @returns {Promise<void>} 删除结束
         */
        const deleteRule = async (key) => {
          /* 作用范围由规则键决定，通配键删的是全局规则 */
          const scope = ruleKeyOf(key) === ALL_MODELS ? 'all' : 'model'

          /* 执行业务：删除后回填状态并回到清单，避免停在已失效的编辑页 */
          patch({ busy: true, notice: null })
          try {
            const snapshot = await callRpc(ctx.connection, 'clear', {
              scope,
              model: scope === 'all' ? '' : key,
            })
            if (!mounted.current) return
            patch({ snapshot, busy: false, view: 'list', confirmDelete: false, notice: { tone: 'success', text: t('deleted') } })
          } catch (error) {
            if (!mounted.current) return
            patch({ busy: false, notice: { tone: 'error', text: `${t('deleteFailedPrefix')}${error?.message ?? String(error)}` } })
          }
        }

        /**
         * 渲染一行标签，配色由变体决定
         * @param {string} label 标签文案
         * @param {string} [variant] accent / warn / muted，缺省为中性
         * @param {string} [key] React key
         * @returns {unknown} 标签节点
         */
        const tag = (label, variant, key) => h('span', { key, className: `dop-tag${variant ? ` dop-tag${variant[0].toUpperCase()}${variant.slice(1)}` : ''}` }, label)

        /**
         * 渲染状态行，没内容时不占位
         * @returns {unknown} 状态节点或 null
         */
        const renderNotice = () => (page.notice === null
          ? null
          : h('p', { className: 'dop-status', 'data-tone': page.notice.tone, role: 'status', 'aria-live': 'polite' }, page.notice.text))

        /**
         * 渲染加号图标，尺寸随上下文缩放
         * @returns {unknown} svg 节点
         */
        const plusIcon = () => h('svg', {
          width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
        }, h('path', { d: 'M6 2v8M2 6h8' }))

        /**
         * 渲染返回上级的小箭头
         * @returns {unknown} svg 节点
         */
        const backIcon = () => h('svg', {
          width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': 'true',
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        }, h('path', { d: 'M7 2L3 6l4 4' }))

        /**
         * 渲染清单页里的一条指定
         * @param {{ key: string, only: string[], allowFallbacks: boolean }} row 已存规则行
         * @returns {unknown} 卡片节点
         */
        const renderRuleCard = (row) => {
          const isAll = row.key === ALL_MODELS
          const meta = isAll ? t('allModelsMeta') : t('handsTo')
          return h('li', { key: row.key, className: 'dop-card' },
            h('div', { className: 'dop-rowHead' },
              h('div', { className: 'dop-rowMain' },
                h('div', { className: 'dop-rowTitle' },
                  h('span', { className: 'dop-rowName' }, isAll ? t('allModels') : row.key),
                  isDefaultRule(row.key, defaultModel) ? tag(t('tagDefault'), 'accent') : null,
                  isAll ? tag(t('tagWildcard')) : null,
                  tag(row.allowFallbacks ? t('tagFallbacks') : t('tagNoFallbacks'))),
                h('div', { className: 'dop-tags' },
                  h('span', { className: 'dop-meta' }, meta),
                  row.only.map(slug => tag(slug, undefined, slug)))),
              h('div', { className: 'dop-actions' },
                h('button', {
                  type: 'button', className: 'dop-compact', disabled: page.busy,
                  onClick: () => { openRule(row.key) },
                }, t('edit')),
                h('button', {
                  type: 'button', className: 'dop-compact dop-compactDanger', disabled: page.busy,
                  onClick: () => { void deleteRule(row.key) },
                }, t('remove')))))
        }

        /**
         * 渲染首次进入的三步引导
         * @returns {unknown} 引导节点
         */
        const renderGuide = () => h('div', { className: 'dop-steps' },
          h('span', { className: 'dop-step' }, h('span', { className: 'dop-stepNum' }, '1'), t('step1')),
          h('span', { className: 'dop-step' }, h('span', { className: 'dop-stepNum' }, '2'), t('step2')),
          h('span', { className: 'dop-step' }, h('span', { className: 'dop-stepNum' }, '3'), t('step3')))

        /**
         * 渲染清单视图：标题、引导、指定行、新建槽、规则文件路径
         * @returns {unknown} 视图节点
         */
        const renderListPage = () => {
          const isEmpty = savedRows.length === 0
          return h('section', { className: 'dop' },
            h('style', null, CSS),
            h('header', { className: 'dop-head' },
              h('h1', { className: 'dop-title' }, t('title')),
              h('p', { className: 'dop-intro' }, t('intro'))),
            page.phase === 'loading' ? h('p', { className: 'dop-meta' }, t('loadingRules')) : null,
            renderNotice(),
            isEmpty && page.phase === 'ready' ? h('div', { className: 'dop-empty' }, t('emptyBody')) : null,
            isEmpty && page.phase === 'ready' ? renderGuide() : null,
            h('ul', { className: 'dop-list' },
              savedRows.map(renderRuleCard),
              h('li', { key: 'add' },
                h('button', {
                  type: 'button', className: 'dop-add', disabled: page.busy || page.phase !== 'ready',
                  onClick: startNewRule,
                }, plusIcon(), t('addRule')))),
            h('div', { className: 'dop-config' },
              h('span', { className: 'dop-meta' }, t('configLabel')),
              h('span', { className: 'dop-code' }, page.snapshot?.policyFile ?? '')))
        }

        /**
         * 渲染模型卡片，展示名称、id 与规格
         * @returns {unknown} 卡片节点
         */
        const renderModelCard = () => {
          const model = page.draft.model
          const isAll = ruleKeyOf(model) === ALL_MODELS
          const specs = page.catalog?.specs
          const facts = [
            isRecord(specs) && typeof specs.contextWindow === 'number' ? `${t('context')} ${tokenText(specs.contextWindow)}` : null,
            isRecord(specs) && typeof specs.maxCompletionTokens === 'number' ? `${t('maxOutput')} ${tokenText(specs.maxCompletionTokens)}` : null,
            isRecord(specs) && Array.isArray(specs.inputModalities) && specs.inputModalities.length > 0
              ? `${t('inputLabel')} ${modalityText(specs.inputModalities)}`
              : null,
          ].filter(Boolean).join(' · ')
          /* 主路径：模型已选定就展示身份与规格；未选定只留一个选择入口 */
          const body = model === ''
            ? h('div', { className: 'dop-rowMain' }, h('span', { className: 'dop-rowName' }, t('pickModelFirst')))
            : h('div', { className: 'dop-rowMain' },
              h('div', { className: 'dop-rowTitle' },
                h('span', { className: 'dop-rowName' }, isAll ? t('allModels') : (specs?.name ?? model)),
                isAll ? tag(t('tagWildcard')) : null,
                model.startsWith('~') ? tag(t('tagAlias')) : null,
                page.catalog?.emptyReason === 'router' ? tag(t('tagRouter')) : null),
              isAll ? h('p', { className: 'dop-meta' }, t('allModelsMeta')) : h('span', { className: 'dop-code' }, model),
              facts === '' ? null : h('p', { className: 'dop-hint' }, facts))
          return h('div', { className: 'dop-card' },
            h('div', { className: 'dop-rowHead' },
              body,
              h('button', { type: 'button', className: 'dop-compact', disabled: page.busy, onClick: openPicker },
                model === '' ? t('pickModel') : t('changeModel'))))
        }

        /**
         * 渲染已选供应商标签，每项可单独移除
         * @returns {unknown} 标签行或 null
         */
        const renderSelectedTags = () => {
          if (providerTags.length === 0) return null
          return h('div', { className: 'dop-tags' },
            providerTags.map(slug => h('span', {
              key: slug,
              className: `dop-removable${PROVIDER_SLUG.test(slug) && knownSlugs.includes(slug) ? '' : ' dop-removableCode'}`,
            },
            slug,
            h('button', {
              type: 'button', className: 'dop-tagButton', disabled: page.busy,
              'aria-label': `${t('remove')} ${slug}`,
              onClick: () => { toggleProvider(slug) },
            }, '×'))))
        }

        /**
         * 渲染供应商表格的一行，勾选即加入草稿
         * @param {Record<string, unknown>} row 供应商行，来自 providers RPC
         * @returns {unknown} 表格行节点
         */
        const renderProviderRow = (row) => {
          const checked = providerTags.includes(row.tag)
          const facts = [
            row.tag,
            `${t('precision')} ${quantizationText(row, t('unknownValue'))}`,
            `${t('context')} ${compactToken(row.contextLength)}`,
          ].join(' · ')
          const tone = uptimeTone(row.uptimeLast30m)
          return h('label', { key: row.tag, className: 'dop-row', 'data-selected': checked ? 'true' : 'false' },
            h('input', { type: 'checkbox', checked, disabled: page.busy, onChange: () => { toggleProvider(row.tag) } }),
            h('span', { className: 'dop-rowMain' },
              h('span', { className: 'dop-rowTitle' },
                h('span', { className: 'dop-rowName' }, row.providerName ? row.providerName : row.tag),
                row.degraded === true ? tag(t('tagDegraded'), 'warn') : null),
              h('span', { className: 'dop-code' }, facts)),
            h('span', { className: 'dop-num' }, priceText(row.promptPerMillion)),
            h('span', { className: 'dop-num dop-colOut' }, priceText(row.completionPerMillion)),
            h('span', { className: 'dop-uptime dop-colUptime' },
              tone === 'none' ? null : h('span', { className: 'dop-dot', 'data-tone': tone }),
              typeof row.uptimeLast30m === 'number' ? `${row.uptimeLast30m.toFixed(1)}%` : t('unknownValue')))
        }

        /**
         * 渲染供应商表格，仅在有清单时出现
         * @returns {unknown} 表格节点
         */
        const renderProviderTable = () => h('div', { className: 'dop-table' },
          h('div', { className: 'dop-tableHead' },
            h('span', { className: 'dop-meta' }, `${providerRows.length}${t('servingSuffix')}`),
            h('span', { className: 'dop-spacer' }),
            h('span', { className: 'dop-tag dop-tagMuted' }, t('sortInput'))),
          h('div', { className: 'dop-columns' },
            h('span', null, ''),
            h('span', null, t('tableProvider')),
            h('span', { style: { textAlign: 'right' } }, t('tableInput')),
            h('span', { className: 'dop-colOut', style: { textAlign: 'right' } }, t('tableOutput')),
            h('span', { className: 'dop-colUptime', style: { textAlign: 'right' } }, t('tableUptime'))),
          providerRows.map(renderProviderRow))

        /**
         * 渲染清单不可用时的占位块：加载 / 失败 / 别名 / 路由 / 空清单 / 通配
         * @returns {unknown} 占位块
         */
        const renderCatalogState = () => {
          const isAll = ruleKeyOf(page.draft.model) === ALL_MODELS
          if (page.draft.model === '') return h('div', { className: 'dop-empty' }, t('pickModelFirst'))
          if (isAll) {
            return h('div', { className: 'dop-inset' },
              h('span', { className: 'dop-insetTitle' }, t('allScopeTitle')),
              h('p', { className: 'dop-hint' }, t('allScopeText')))
          }
          if (page.catalogPhase === 'loading') return h('p', { className: 'dop-meta', 'aria-busy': 'true' }, t('catalogLoading'))
          if (page.catalogPhase === 'error') {
            return h('div', { className: 'dop-inset' },
              h('span', { className: 'dop-insetTitle' }, t('catalogErrorTitle')),
              h('span', { className: 'dop-code' }, page.catalogError ?? ''),
              h('p', { className: 'dop-hint' }, t('catalogErrorHint')),
              h('button', {
                type: 'button', className: 'dop-compact',
                style: { alignSelf: 'flex-start', marginTop: '4px' },
                disabled: page.busy,
                onClick: () => { void loadProviders(page.draft.model) },
              }, t('retry')))
          }
          if (page.catalogPhase !== 'ready') return null
          const reason = page.catalog?.emptyReason
          if (reason === 'alias' || page.draft.model.startsWith('~')) {
            return h('div', { className: 'dop-inset' },
              h('span', { className: 'dop-insetTitle' }, t('aliasTitle')),
              h('p', { className: 'dop-hint' }, t('aliasText')),
              h('button', {
                type: 'button', className: 'dop-compact',
                style: { alignSelf: 'flex-start', marginTop: '4px' },
                disabled: page.busy, onClick: openPicker,
              }, t('pickConcrete')))
          }
          if (reason === 'router') {
            return h('div', { className: 'dop-inset' },
              h('span', { className: 'dop-insetTitle' }, t('routerTitle')),
              h('p', { className: 'dop-hint' }, t('routerText')),
              h('button', {
                type: 'button', className: 'dop-compact',
                style: { alignSelf: 'flex-start', marginTop: '4px' },
                disabled: page.busy, onClick: openPicker,
              }, t('pickConcrete')))
          }
          return h('div', { className: 'dop-empty' }, t('noProviders'))
        }

        /**
         * 渲染供应商区块：计数、已选标签、表格或占位、手填入口
         * @returns {unknown} 区块节点
         */
        const renderProviderSection = () => {
          const ready = page.catalogPhase === 'ready' && providerRows.length > 0
          const count = ready
            ? `${t('selectedPrefix')}${providerTags.length}${t('ofTotalPrefix')}${providerRows.length}${t('countSuffix')}`
            : `${t('selectedPrefix')}${providerTags.length}${t('countSuffix')}`
          return h('div', { className: 'dop-section' },
            h('div', { className: 'dop-sectionHead' },
              h('h2', { className: 'dop-sectionTitle' }, t('sectionProviders')),
              h('span', { className: 'dop-count' }, count),
              h('span', { className: 'dop-spacer' }),
              h('button', {
                type: 'button', className: 'dop-compact', disabled: page.busy || providerTags.length === 0,
                onClick: clearProviders,
              }, t('clear'))),
            renderSelectedTags(),
            ready ? renderProviderTable() : renderCatalogState(),
            unknownSlugs.length === 0 ? null : h('p', { className: 'dop-hint' }, `${t('notInCatalog')}${t('labelSeparator')}${unknownSlugs.join(t('listSeparator'))} · ${t('notInCatalogHint')}`),
            h('div', { className: 'dop-field' },
              h('div', { className: 'dop-inline' },
                h('input', {
                  className: 'dop-input', value: page.manualInput, spellCheck: false,
                  placeholder: t('manualPlaceholder'), 'aria-label': t('manualPlaceholder'),
                  disabled: page.busy || page.phase !== 'ready',
                  onChange: event => { patch({ manualInput: event.target.value, manualError: null }) },
                  onKeyDown: event => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addManualProviders()
                  },
                }),
                h('button', {
                  type: 'button', className: 'dop-compact',
                  disabled: page.busy || page.manualInput.trim() === '',
                  onClick: addManualProviders,
                }, t('add'))),
              page.manualError === null
                ? h('p', { className: 'dop-hint' }, t('manualHint'))
                : h('p', { className: 'dop-status', 'data-tone': 'error', role: 'alert' }, page.manualError)))
        }

        /**
         * 渲染“规则行为”区块：允许回退开关
         * @returns {unknown} 区块节点
         */
        const renderBehaviorSection = () => h('div', { className: 'dop-section' },
          h('h2', { className: 'dop-sectionTitle' }, t('sectionBehavior')),
          h('div', { className: 'dop-card dop-behavior' },
            h('div', { className: 'dop-rowMain' },
              h('span', { className: 'dop-rowName' }, t('allowFallbacks')),
              h('p', { className: 'dop-hint' }, t('allowFallbacksDesc'))),
            h('button', {
              type: 'button', className: 'dop-switch', role: 'switch',
              'aria-checked': page.draft.allowFallbacks ? 'true' : 'false',
              'aria-label': t('allowFallbacks'),
              disabled: page.busy,
              onClick: () => { patch({ draft: { ...page.draft, allowFallbacks: !page.draft.allowFallbacks }, notice: null }) },
            }, h('span', { className: 'dop-switchTrack' }, h('span', { className: 'dop-switchThumb' })))))

        /**
         * 渲染编辑页底部：未保存状态、取消、保存
         * @returns {unknown} 动作行节点
         */
        const renderEditorFooter = () => {
          const canSave = !page.busy && page.phase === 'ready' && providerTags.length > 0 && page.draft.model !== ''
          const dirty = hasUnsavedChanges(page.snapshot, ruleKeyOf(page.draft.model), page.draft)
          const status = providerTags.length === 0
            ? t('atLeastOne')
            : dirty ? t('unsaved') : ''
          return h('div', { className: 'dop-footer' },
            status === ''
              ? null
              : h('span', { className: 'dop-footerStatus' },
                dirty && providerTags.length > 0 ? h('span', { className: 'dop-dirty' }, h('span', { className: 'dop-dot', 'data-tone': 'warn' }), status) : status),
            h('span', { className: 'dop-spacer' }),
            h('button', { type: 'button', className: 'dop-secondary', disabled: page.busy, onClick: showList }, t('cancel')),
            h('button', {
              type: 'button', className: 'dop-primary', disabled: !canSave, onClick: () => { void saveDraft() },
            }, page.busy ? t('saving') : t('save')))
        }

        /**
         * 渲染删除区：说明代价，并需要二次确认
         * @returns {unknown} 删除区节点
         */
        const renderDangerZone = () => {
          const stored = findRule(page.snapshot?.rules, ruleKeyOf(page.draft.model))
          if (stored === undefined) return null
          return h('div', { className: 'dop-danger' },
            h('span', { className: 'dop-footerStatus' }, t('deleteHint')),
            h('span', { className: 'dop-spacer' }),
            page.confirmDelete
              ? h('span', { className: 'dop-actions' },
                h('button', {
                  type: 'button', className: 'dop-dangerButton', disabled: page.busy,
                  onClick: () => { void deleteRule(stored.key) },
                }, t('confirmDelete')),
                h('button', {
                  type: 'button', className: 'dop-secondary', disabled: page.busy,
                  onClick: () => { patch({ confirmDelete: false }) },
                }, t('cancel')))
              : h('button', {
                type: 'button', className: 'dop-dangerButton', disabled: page.busy,
                onClick: () => { patch({ confirmDelete: true }) },
              }, t('deleteRule')))
        }

        /**
         * 渲染编辑视图：模型、供应商、行为、动作与删除区
         * @returns {unknown} 视图节点
         */
        const renderEditorPage = () => h('section', { className: 'dop' },
          h('style', null, CSS),
          h('button', { type: 'button', className: 'dop-crumb', onClick: showList }, backIcon(), t('backToList')),
          h('h1', { className: 'dop-pageTitle' }, t('editorTitle')),
          h('p', { className: 'dop-pageIntro' }, t('editorIntro')),
          renderNotice(),
          h('div', { className: 'dop-section' },
            h('h2', { className: 'dop-sectionTitle' }, t('sectionModel')),
            renderModelCard()),
          renderProviderSection(),
          renderBehaviorSection(),
          renderEditorFooter(),
          renderDangerZone())

        /**
         * 渲染选择模型的搜索结果，含通配项
         * @returns {unknown} 列表节点
         */
        const renderPickerRows = () => {
          const shown = pickerRows.slice(0, MODEL_LIST_LIMIT)
          return h('div', { className: 'dop-pick' },
            h('button', {
              type: 'button', className: 'dop-pickRow', 'data-current': ruleKeyOf(page.draft.model) === ALL_MODELS ? 'true' : 'false',
              onClick: () => { chooseModel(ALL_MODELS) },
            },
            h('span', { className: 'dop-pickMain' },
              h('span', { className: 'dop-pickTop' },
                h('span', { className: 'dop-pickName' }, t('allModels')),
                tag(t('tagWildcard'))),
              h('span', { className: 'dop-code' }, t('pickerAllDesc')))),
            shown.map(row => h('button', {
              key: row.id,
              type: 'button', className: 'dop-pickRow',
              'data-current': row.id === page.draft.model ? 'true' : 'false',
              onClick: () => { chooseModel(row.id) },
            },
            h('span', { className: 'dop-pickMain' },
              h('span', { className: 'dop-pickTop' },
                h('span', { className: 'dop-pickName' }, row.name === '' ? row.id : row.name),
                row.alias === true ? tag(t('tagAlias')) : null,
                row.router === true ? tag(t('tagRouter')) : null,
                h('span', { className: 'dop-pickPrice' },
                  `${priceText(row.promptPerMillion)} / ${priceText(row.completionPerMillion)}`)),
              h('span', { className: 'dop-code' },
                `${row.id} · ${t('context')} ${tokenText(row.contextWindow)}`)))))
        }

        /**
         * 渲染选择模型视图：搜索、通配项、搜索结果、手动输入
         * @returns {unknown} 视图节点
         */
        const renderPickerPage = () => h('section', { className: 'dop' },
          h('style', null, CSS),
          h('button', { type: 'button', className: 'dop-crumb', onClick: () => { patch({ view: 'editor' }) } }, backIcon(), t('editorTitle')),
          h('h1', { className: 'dop-pageTitle' }, t('pickerTitle')),
          h('p', { className: 'dop-pageIntro' }, t('pickerIntro')),
          h('input', {
            className: 'dop-input', value: page.modelFilter, spellCheck: false, autoFocus: true,
            placeholder: t('searchModels'), 'aria-label': t('searchModels'),
            onChange: event => { patch({ modelFilter: event.target.value }) },
          }),
          page.modelsPhase === 'loading' ? h('p', { className: 'dop-meta', 'aria-busy': 'true' }, t('modelsLoading')) : null,
          page.modelsPhase === 'error'
            ? h('div', { className: 'dop-inset' },
              h('span', { className: 'dop-insetTitle' }, `${t('modelsErrorPrefix')}${page.modelsError ?? ''}`),
              h('button', {
                type: 'button', className: 'dop-compact', style: { alignSelf: 'flex-start', marginTop: '4px' },
                onClick: () => { void loadModels() },
              }, t('retry')))
            : null,
          page.modelsPhase === 'ready' ? (pickerRows.length === 0 ? h('div', { className: 'dop-empty' }, t('modelsEmpty')) : renderPickerRows()) : null,
          page.modelsPhase === 'ready'
            ? h('p', { className: 'dop-hint' },
              `${t('modelsMatchPrefix')}${pickerRows.length}${t('modelsTotalPrefix')}${page.models?.length ?? 0}${t('modelsCountSuffix')}`,
              pickerRows.length > MODEL_LIST_LIMIT ? ` · ${t('modelsTruncated')}` : '')
            : null,
          h('div', { className: 'dop-field' },
            h('span', { className: 'dop-label' }, t('manualModelLabel')),
            h('div', { className: 'dop-inline' },
              h('input', {
                className: 'dop-input', value: page.manualModel, spellCheck: false,
                placeholder: t('manualModelPlaceholder'), 'aria-label': t('manualModelLabel'),
                onChange: event => { patch({ manualModel: event.target.value }) },
                onKeyDown: event => {
                  if (event.key !== 'Enter' || page.manualModel.trim() === '') return
                  event.preventDefault()
                  chooseModel(modelIdFromInput(page.manualModel))
                  patch({ manualModel: '' })
                },
              }),
              h('button', {
                type: 'button', className: 'dop-compact', disabled: page.manualModel.trim() === '',
                onClick: () => { chooseModel(modelIdFromInput(page.manualModel)); patch({ manualModel: '' }) },
              }, t('load'))),
            h('p', { className: 'dop-hint' }, t('manualModelHint'))))

        if (page.view === 'picker') return renderPickerPage()
        if (page.view === 'editor') return renderEditorPage()
        return renderListPage()
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
