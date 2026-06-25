# 应用内搜索（Ctrl/Cmd+F）设计文档

## 背景

Gemini Desktop 是一个基于 Electron 的桌面客户端，包装了 `https://gemini.google.com/app` 和 `https://claude.ai`。当前应用没有提供页面内搜索能力，用户无法像在 Chrome 中一样使用 `Ctrl/Cmd+F` 搜索页面内容。本设计文档描述如何实现一个类似 Chrome 的页面内搜索功能。

## 目标

- 提供 `Ctrl/Cmd+F` 唤起的页面内搜索框。
- 搜索范围覆盖整个应用窗口内的可见文字，包括 `input` / `textarea` 中的内容。
- 支持增强搜索选项：大小写敏感、全字匹配、正则表达式。
- UI 参考 Chrome 的 `Ctrl+F`，位于窗口顶部右侧浮动。
- 优先跟随当前网页背景自动切换深浅色主题，不稳定时回退到跟随系统主题。

## 非目标

- 不实现跨页面搜索历史持久化。
- 不替换网页自身的搜索功能。
- 不实现复杂的搜索替换（replace）功能。

## 需求确认

| 维度 | 决策 |
|------|------|
| 搜索范围 | 整个应用窗口可见文字，包括 `input` / `textarea` |
| 功能级别 | 增强版：高亮、计数、上下跳转、大小写敏感、全字匹配、正则 |
| UI 位置 | 顶部右侧浮动，参考 Chrome |
| 主题策略 | 优先检测网页背景色自动切换，不稳定则回退 `prefers-color-scheme` |
| 自动填充 | 打开时自动填充当前页面选中文本 |
| 搜索触发 | 实时搜索，100ms 节流 |
| 选项记忆 | 仅当前会话内记住，关闭应用后重置 |
| 快捷键 | `Ctrl/Cmd+F` 打开，`Esc` 关闭，`Enter/Shift+Enter` 跳转，`↑/↓` 也支持跳转 |
| 空结果提示 | 计数显示 `0/0`，搜索框轻微抖动 |
| 正则错误 | 边框变红，显示「无效的正则表达式」提示 |
| 实现方案 | 混合方案：基础搜索用 Electron `findInPage`，开启正则/全字匹配时切到 JS 实现 |

## 架构

### 文件结构

```
src/
├── main.js                    # 现有主进程，增加搜索 IPC 和快捷键
├── preload.js                 # 新增：暴露安全 IPC 通道给页面
└── search/
    ├── search-box.js          # 搜索框 UI（输入框、计数、按钮、选项面板）
    ├── search-controller.js   # 协调 findInPage / JS 高亮两套逻辑
    ├── native-search.js       # 调用 Electron webContents.findInPage
    ├── js-search.js           # JS 实现的正则/全字匹配 + DOM 高亮
    ├── search-options.js      # 当前会话的搜索选项状态
    └── theme-detector.js      # 检测页面背景深浅，决定搜索框主题
```

### 组件职责

- **main.js**
  - 注册 `Ctrl/Cmd+F` 窗口快捷键。
  - 接收 `search:find` / `search:stop` / `search:navigate` IPC。
  - 调用 `webContents.findInPage` / `stopFindInPage`。
  - 把 `found-in-page` 事件结果回传 renderer。

- **preload.js**
  - 只暴露搜索相关的有限 API：`search.toggle()`、`search.onFound(callback)`、`search.find(text, options)`、`search.stop()`、`search.navigate(direction)`。
  - 不暴露完整 `ipcRenderer`，保持最小权限。

- **search-box.js**
  - 渲染顶部右侧浮动搜索框。
  - 处理输入、100ms 节流、快捷键、选项面板展开/收起。
  - 显示匹配计数 `current/total`。
  - 空结果时让搜索框轻微抖动。
  - 正则无效时边框变红并显示提示。

- **search-controller.js**
  - 根据当前选项决定搜索模式：
    - 未开启正则且未开启全字匹配 → 使用 native 搜索。
    - 开启正则或全字匹配 → 使用 JS 搜索。
  - 统一返回 `{ total, current, valid, message? }` 给 search-box.js。

- **native-search.js**
  - 通过 IPC 让 main 进程调用 `webContents.findInPage(text, { forward, findNext, matchCase })`。
  - 监听 `found-in-page` 结果，更新 total / current。
  - 调用 `stopFindInPage('clearSelection')` 清除高亮。

- **js-search.js**
  - 使用 `TreeWalker` 递归遍历文本节点，进入 `shadowRoot`。
  - 支持普通文本、大小写敏感、全字匹配、正则表达式。
  - 对 `input` / `textarea` 读取 `value` / `textContent` 并判断是否可见。
  - 使用 `CSS Custom Highlight API` 做高亮；不支持时 fallback 到 span 包裹。
  - 维护匹配列表，支持 `next` / `previous` 跳转并滚动到可视区域。
  - 监听 `MutationObserver`，在动态内容稳定后自动重新搜索（受 100ms 节流限制）。

- **search-options.js**
  - 维护当前会话的选项状态：`{ caseSensitive, wholeWord, regex }`。
  - 提供 `get()` / `set(key, value)` / `subscribe(callback)`。

- **theme-detector.js**
  - 采样 `document.body` 和 `document.documentElement` 的 computed `background-color`。
  - 计算亮度（relative luminance），低于阈值判定为深色主题。
  - 监听 DOM 变化和窗口 resize，debounce 后重新检测。
  - 如果检测失败或结果不稳定，回退到 `matchMedia('(prefers-color-scheme: dark)')`。

## 数据流

```
用户按 Ctrl/Cmd+F
  → main.js 捕获快捷键，发送 IPC "search:toggle"
  → preload.js 转发到页面
  → search-box.js 显示搜索框
      → 调用 window.getSelection().toString() 自动填充选中文本
      → 触发一次搜索
  → 用户输入
      → 100ms 节流
      → search-controller.js 判断模式
          → 基础模式：IPC "search:find" → main.js findInPage
              → "found-in-page" 事件 → 更新 total / current
          → JS 模式：js-search.js 直接操作 DOM 高亮
              → 返回 total / current → 更新 UI
  → 用户按 Enter / Shift+Enter / ↑ / ↓
      → 基础模式：findInPage(findNext/previous)
      → JS 模式：js-search.js 滚动到下一个/上一个匹配
  → 用户按 Esc 或点击 ✕
      → 关闭搜索框，清除所有高亮
```

## 关键实现细节

### 1. native 模式

Electron 的 `webContents.findInPage(text, options)` 原生支持：
- `forward`：搜索方向。
- `findNext`：是否继续查找下一个。
- `matchCase`：大小写敏感。

不支持全字匹配和正则表达式，因此当这两个选项任一开启时，必须切换到 JS 模式。

### 2. JS 模式匹配逻辑

- 普通模式：`text` 作为字面量搜索。
- 大小写敏感：默认不区分；开启时使用原始字符串比较。
- 全字匹配：构造正则 `\b${escapedText}\b`。
- 正则模式：直接使用用户输入作为正则表达式，用 `new RegExp(pattern, flags)` 捕获异常。

### 3. Shadow DOM 支持

`js-search.js` 使用递归的 `TreeWalker`：

```js
function* walk(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    yield walker.currentNode;
    if (walker.currentNode.parentElement?.shadowRoot) {
      yield* walk(walker.currentNode.parentElement.shadowRoot);
    }
  }
}
```

### 4. 动态内容

Gemini 的回复是流式生成的，JS 模式下需要监听 `MutationObserver`：

```js
const observer = new MutationObserver(debounce(() => {
  if (searchBox.isVisible()) searchController.research();
}, 100));
observer.observe(document.body, { childList: true, subtree: true });
```

### 5. 主题检测

```js
function isDarkBackground() {
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
  const bg = parseColor(bodyBg) || parseColor(htmlBg) || parseColor('white');
  return luminance(bg) < 0.5;
}
```

如果 `document.body` 背景透明或检测失败，回退到系统主题。

## 错误处理

| 场景 | 行为 |
|------|------|
| 正则表达式无效 | `js-search.js` 返回 `{ valid: false, message: '无效的正则表达式' }`，search-box.js 边框变红并显示提示，不执行搜索。 |
| IPC 通信失败 | 静默忽略，不崩溃，计数显示 `0/0`。 |
| CSS Custom Highlight API 不可用 | fallback 到 span 包裹高亮，并记录一次 `console.warn`。 |
| JS 搜索节点过多 | 增加超时保护，超过 200ms 未完成的搜索自动中止并提示「页面过大，建议简化搜索」。 |

## 测试计划

### 单元测试

- `js-search.js` 的匹配逻辑：
  - 普通文本匹配。
  - 大小写敏感匹配。
  - 全字匹配。
  - 正则匹配。
  - 无效正则处理。
- `theme-detector.js` 的亮度计算。

### 手动测试

- 在 Gemini / Claude 页面搜索静态文本。
- 在流式生成的回复中搜索动态内容。
- 在 `input` / `textarea` 中输入文字后搜索。
- 快捷键：`Ctrl/Cmd+F`、`Esc`、`Enter`、`Shift+Enter`、`↑`、`↓`。
- 主题切换：深色页面、浅色页面、系统主题切换。
- 正则错误提示。
- 空结果抖动。

## 后续可扩展

- 搜索历史持久化。
- 替换功能（replace）。
- 搜索结果预览（snippet）。

## 参考

- [Electron webContents.findInPage](https://www.electronjs.org/docs/latest/api/web-contents#contentsfindinpagetext-options)
- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
