# 应用内搜索（Ctrl/Cmd+F）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Gemini Desktop 中实现一个类似 Chrome 的 `Ctrl/Cmd+F` 页面内搜索框，支持基础搜索、大小写敏感、全字匹配和正则表达式。

**Architecture:** 采用混合方案：基础搜索通过 Electron 主进程的 `webContents.findInPage` 完成；当用户开启正则或全字匹配时，切换到渲染进程的 JS 实现。搜索框 UI 通过 `preload.js` 注入到页面中，与主进程通过 IPC 通信。

**Tech Stack:** Electron 29, Node.js 24 (内置 `node:test`), JavaScript (CommonJS), jsdom（仅用于单元测试）

---

## 文件结构

```
src/
├── main.js                    # 修改：注册快捷键、处理搜索 IPC
├── preload.js                 # 新增：暴露安全 API 并初始化搜索
└── search/
    ├── index.js               # 新增：搜索功能入口
    ├── search-box.js          # 新增：搜索框 UI
    ├── search-controller.js   # 新增：协调 native / JS 搜索
    ├── native-search.js       # 新增：主进程 findInPage 桥接
    ├── js-search.js           # 新增：JS 正则/全字匹配与高亮
    ├── search-options.js      # 新增：搜索选项状态
    └── theme-detector.js      # 新增：页面深浅色主题检测
tests/search/
├── search-options.test.js     # 新增：选项状态测试
├── theme-detector.test.js     # 新增：主题检测测试
├── js-search.test.js          # 新增：匹配逻辑测试
└── search-controller.test.js  # 新增：搜索控制器测试
```

---

## Task 1: 项目基础设置

**Files:**
- Create: `src/search/` 目录、`tests/search/` 目录
- Modify: `package.json`
- Install: `jsdom` (devDependency，用于 DOM 相关单元测试)

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p src/search tests/search
```

- [ ] **Step 2: 安装 jsdom 并更新 package.json**

```bash
npm install --save-dev jsdom
```

修改 `package.json` 的 `scripts` 和 `devDependencies`：

```json
{
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "test": "node --test tests/**/*.test.js"
  },
  "devDependencies": {
    "electron": "^29.0.0",
    "electron-builder": "^24.9.1",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 3: 创建 `src/preload.js` 骨架**

```js
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的搜索 API 给渲染进程
contextBridge.exposeInMainWorld('electronSearch', {
  find: (text, options) => ipcRenderer.invoke('search:find', text, options),
  stop: () => ipcRenderer.send('search:stop'),
  navigate: (direction) => ipcRenderer.send('search:navigate', direction),
  onFound: (callback) => ipcRenderer.on('search:found', callback),
  onToggle: (callback) => ipcRenderer.on('search:toggle', callback),
});
```

- [ ] **Step 4: 修改 `main.js` 加载 preload**

在 `createWindow` 的 `webPreferences` 中增加 `preload`：

```js
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  autoHideMenuBar: true,
  show: false,
  icon: path.join(__dirname, 'icon.png'),
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

- [ ] **Step 5: 验证安装**

```bash
npm test
```

Expected: 没有测试文件，命令退出代码 0。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/preload.js main.js
git commit -m "chore: 添加搜索功能基础目录和测试环境"
```

---

## Task 2: 搜索选项状态管理

**Files:**
- Create: `src/search/search-options.js`
- Create: `tests/search/search-options.test.js`

- [ ] **Step 1: 写失败测试 `tests/search/search-options.test.js`**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { SearchOptions } = require('../../src/search/search-options');

describe('SearchOptions', () => {
  it('返回默认选项', () => {
    const options = new SearchOptions();
    assert.deepStrictEqual(options.get(), {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    });
  });

  it('设置单个选项', () => {
    const options = new SearchOptions();
    options.set('caseSensitive', true);
    assert.strictEqual(options.get().caseSensitive, true);
  });

  it('订阅选项变化', () => {
    const options = new SearchOptions();
    let called = false;
    options.subscribe((opts) => {
      called = true;
      assert.strictEqual(opts.regex, true);
    });
    options.set('regex', true);
    assert.strictEqual(called, true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: `Error: Cannot find module '../../src/search/search-options'`

- [ ] **Step 3: 实现 `src/search/search-options.js`**

```js
/**
 * 管理当前会话的搜索选项状态
 * 不持久化到磁盘，关闭应用后重置
 */
class SearchOptions {
  constructor() {
    this.options = {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    };
    this.listeners = [];
  }

  get() {
    return { ...this.options };
  }

  set(key, value) {
    if (!(key in this.options)) return;
    this.options = { ...this.options, [key]: value };
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    const snapshot = this.get();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

module.exports = { SearchOptions };
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: 三个测试全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/search/search-options.js tests/search/search-options.test.js
git commit -m "feat: 实现搜索选项状态管理"
```

---

## Task 3: 主题检测

**Files:**
- Create: `src/search/theme-detector.js`
- Create: `tests/search/theme-detector.test.js`

- [ ] **Step 1: 写失败测试 `tests/search/theme-detector.test.js`**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
const { ThemeDetector, luminance } = require('../../src/search/theme-detector');

describe('luminance', () => {
  it('白色亮度接近 1', () => {
    assert.ok(luminance({ r: 255, g: 255, b: 255 }) > 0.9);
  });

  it('黑色亮度接近 0', () => {
    assert.ok(luminance({ r: 0, g: 0, b: 0 }) < 0.1);
  });
});

describe('ThemeDetector', () => {
  it('深色背景返回 dark', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body style="background:#000"></body></html>');
    const detector = new ThemeDetector(dom.window.document, dom.window);
    assert.strictEqual(detector.detect(), 'dark');
  });

  it('浅色背景返回 light', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body style="background:#fff"></body></html>');
    const detector = new ThemeDetector(dom.window.document, dom.window);
    assert.strictEqual(detector.detect(), 'light');
  });

  it('透明背景回退到系统主题', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body style="background:transparent"></body></html>');
    const detector = new ThemeDetector(dom.window.document, dom.window);
    const result = detector.detect();
    assert.ok(result === 'dark' || result === 'light');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: `Error: Cannot find module '../../src/search/theme-detector'`

- [ ] **Step 3: 实现 `src/search/theme-detector.js`**

```js
/**
 * 检测页面背景亮度，决定搜索框使用深色还是浅色主题
 * 检测失败时回退到系统主题
 */

function luminance({ r, g, b }) {
  const srgb = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

function parseColor(color) {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

class ThemeDetector {
  constructor(document = window.document, windowRef = window) {
    this.document = document;
    this.window = windowRef;
  }

  detect() {
    const bodyBg = this.getBackgroundColor(this.document.body);
    const htmlBg = this.getBackgroundColor(this.document.documentElement);
    const color = bodyBg || htmlBg || parseColor('white');

    if (!color) {
      return this.systemTheme();
    }

    const lum = luminance(color);
    return lum < 0.5 ? 'dark' : 'light';
  }

  getBackgroundColor(element) {
    if (!element) return null;
    const style = this.window.getComputedStyle(element);
    const color = parseColor(style.backgroundColor);
    // 透明背景视为未检测到
    if (!color) return null;
    const alphaMatch = style.backgroundColor.match(/rgba?\([^)]+,\s*([\d.]+)\)/);
    if (alphaMatch && Number(alphaMatch[1]) === 0) return null;
    return color;
  }

  systemTheme() {
    if (this.window.matchMedia && this.window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
}

module.exports = { ThemeDetector, luminance, parseColor };
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: `ThemeDetector` 测试全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/search/theme-detector.js tests/search/theme-detector.test.js
git commit -m "feat: 实现页面主题深浅色检测"
```

---

## Task 4: JS 搜索核心（匹配逻辑）

**Files:**
- Create: `src/search/js-search.js`
- Create: `tests/search/js-search.test.js`

- [ ] **Step 1: 写失败测试 `tests/search/js-search.test.js`**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
const { JsSearch } = require('../../src/search/js-search');

describe('JsSearch 匹配逻辑', () => {
  function createDom(html) {
    return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  }

  it('普通文本匹配', () => {
    const dom = createDom('<p>Hello world</p>');
    const search = new JsSearch(dom.window.document, dom.window);
    const result = search.find('world');
    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.valid, true);
  });

  it('大小写敏感匹配', () => {
    const dom = createDom('<p>Hello World</p>');
    const search = new JsSearch(dom.window.document, dom.window);
    const result = search.find('world', { caseSensitive: true });
    assert.strictEqual(result.total, 0);
  });

  it('全字匹配', () => {
    const dom = createDom('<p>Hello world worldwide</p>');
    const search = new JsSearch(dom.window.document, dom.window);
    const result = search.find('world', { wholeWord: true });
    assert.strictEqual(result.total, 1);
  });

  it('正则匹配', () => {
    const dom = createDom('<p>cat cut cot</p>');
    const search = new JsSearch(dom.window.document, dom.window);
    const result = search.find('c.t', { regex: true });
    assert.strictEqual(result.total, 3);
  });

  it('无效正则返回错误', () => {
    const dom = createDom('<p>Hello</p>');
    const search = new JsSearch(dom.window.document, dom.window);
    const result = search.find('(', { regex: true });
    assert.strictEqual(result.valid, false);
    assert.ok(result.message.includes('正则'));
  });

  it('支持 input value', () => {
    const dom = createDom('<input value="search me">');
    const search = new JsSearch(dom.window.document, dom.window);
    const result = search.find('search');
    assert.strictEqual(result.total, 1);
  });

  it('跳转下一个匹配', () => {
    const dom = createDom('<p>a a a</p>');
    const search = new JsSearch(dom.window.document, dom.window);
    search.find('a');
    assert.strictEqual(search.current, 0);
    search.next();
    assert.strictEqual(search.current, 1);
    search.next();
    assert.strictEqual(search.current, 2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: `Error: Cannot find module '../../src/search/js-search'`

- [ ] **Step 3: 实现 `src/search/js-search.js`**

```js
/**
 * JS 实现的页面内搜索
 * 支持普通文本、大小写敏感、全字匹配、正则表达式
 * 使用 span 包裹实现高亮（CSS Custom Highlight API 的 fallback）
 */

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegExp(text, options) {
  let pattern = text;
  let flags = 'g';

  if (options.caseSensitive) {
    // 默认 RegExp 已经区分大小写，无需添加 i
  } else {
    flags += 'i';
  }

  if (options.wholeWord) {
    pattern = `\\b${escapeRegExp(text)}\\b`;
  } else if (!options.regex) {
    pattern = escapeRegExp(text);
  }

  return new RegExp(pattern, flags);
}

class JsSearch {
  constructor(document = window.document, windowRef = window) {
    this.document = document;
    this.window = windowRef;
    this.matches = [];
    this.current = 0;
    this.highlightClass = 'electron-search-highlight';
  }

  find(text, options = {}) {
    this.clear();

    if (!text) {
      return { total: 0, current: 0, valid: true };
    }

    let regex;
    try {
      regex = buildRegExp(text, options);
    } catch (err) {
      return {
        total: 0,
        current: 0,
        valid: false,
        message: '无效的正则表达式',
      };
    }

    this.matches = this.collectMatches(regex);
    this.current = this.matches.length > 0 ? 1 : 0;
    this.highlight();

    return {
      total: this.matches.length,
      current: this.current,
      valid: true,
    };
  }

  collectMatches(regex) {
    const matches = [];
    const walker = this.document.createTreeWalker(
      this.document.body,
      this.window.NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 跳过搜索框自身和 script/style 标签
          const parent = node.parentElement;
          if (!parent) return this.window.NodeFilter.FILTER_REJECT;
          if (parent.closest('#electron-search-box')) return this.window.NodeFilter.FILTER_REJECT;
          if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
            return this.window.NodeFilter.FILTER_REJECT;
          }
          return this.window.NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent;
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ node, start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) break;
      }
    }

    // 收集 input/textarea 的可见值
    const inputs = this.document.querySelectorAll('input, textarea');
    for (const input of inputs) {
      if (!this.isVisible(input)) continue;
      const value = input.value || input.textContent || '';
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(value)) !== null) {
        matches.push({ input, start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) break;
      }
    }

    return matches;
  }

  isVisible(element) {
    const style = this.window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  highlight() {
    for (const match of this.matches) {
      if (match.node) {
        this.highlightTextNode(match);
      } else if (match.input) {
        this.highlightInput(match);
      }
    }
  }

  highlightTextNode(match) {
    const { node, start, end } = match;
    const range = this.document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);

    const span = this.document.createElement('span');
    span.className = this.highlightClass;
    span.style.backgroundColor = '#ff9632';
    span.style.color = '#000';

    try {
      range.surroundContents(span);
      match.element = span;
    } catch {
      // 跨元素边界时跳过高亮，但保留匹配记录
    }
  }

  highlightInput(match) {
    // input 无法直接高亮内部文本，用 outline 标记当前选中的输入框
    match.input.dataset.electronSearchMatch = 'true';
  }

  next() {
    if (this.matches.length === 0) return;
    this.current = this.current >= this.matches.length ? 1 : this.current + 1;
    this.scrollToCurrent();
  }

  previous() {
    if (this.matches.length === 0) return;
    this.current = this.current <= 1 ? this.matches.length : this.current - 1;
    this.scrollToCurrent();
  }

  scrollToCurrent() {
    const match = this.matches[this.current - 1];
    if (!match) return;
    const target = match.element || match.input;
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  clear() {
    // 移除文本高亮 span
    const spans = this.document.querySelectorAll(`.${this.highlightClass}`);
    for (const span of spans) {
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }

    // 移除 input 标记
    const inputs = this.document.querySelectorAll('[data-electron-search-match]');
    for (const input of inputs) {
      delete input.dataset.electronSearchMatch;
    }

    this.matches = [];
    this.current = 0;
  }
}

module.exports = { JsSearch, buildRegExp, escapeRegExp };
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: 所有 `JsSearch` 测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/search/js-search.js tests/search/js-search.test.js
git commit -m "feat: 实现 JS 搜索核心逻辑"
```

---

## Task 5: 原生搜索桥接

**Files:**
- Create: `src/search/native-search.js`

- [ ] **Step 1: 实现 `src/search/native-search.js`**

```js
/**
 * 主进程 findInPage 的渲染进程桥接
 * 通过 IPC 调用主进程的 webContents.findInPage
 */

class NativeSearch {
  constructor(ipc) {
    this.ipc = ipc;
    this.current = 0;
    this.total = 0;
    this.pendingText = null;
  }

  find(text, options = {}) {
    this.pendingText = text;
    this.current = 0;
    this.total = 0;

    return this.ipc.invoke('search:find', {
      text,
      options: {
        forward: true,
        findNext: false,
        matchCase: options.caseSensitive || false,
      },
    });
  }

  next() {
    return this.ipc.invoke('search:find', {
      text: this.pendingText,
      options: {
        forward: true,
        findNext: true,
        matchCase: false, // 由主进程根据当前选项决定
      },
    });
  }

  previous() {
    return this.ipc.invoke('search:find', {
      text: this.pendingText,
      options: {
        forward: false,
        findNext: true,
        matchCase: false,
      },
    });
  }

  stop() {
    this.ipc.send('search:stop');
    this.current = 0;
    this.total = 0;
  }

  updateResult(result) {
    this.current = result.activeMatchOrdinal || 0;
    this.total = result.matches || 0;
  }
}

module.exports = { NativeSearch };
```

- [ ] **Step 2: Commit**

```bash
git add src/search/native-search.js
git commit -m "feat: 添加原生搜索 IPC 桥接"
```

---

## Task 6: 搜索控制器

**Files:**
- Create: `src/search/search-controller.js`
- Create: `tests/search/search-controller.test.js`

- [ ] **Step 1: 写失败测试 `tests/search/search-controller.test.js`**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { SearchController } = require('../../src/search/search-controller');

describe('SearchController', () => {
  function createIpc() {
    return {
      invoke: async () => ({ matches: 0, activeMatchOrdinal: 0 }),
      send: () => {},
    };
  }

  it('未开启高级选项时使用 native 模式', () => {
    const options = { get: () => ({ caseSensitive: false, wholeWord: false, regex: false }) };
    const controller = new SearchController(createIpc(), options);
    assert.strictEqual(controller.mode, 'native');
  });

  it('开启正则时切换到 JS 模式', () => {
    const options = { get: () => ({ caseSensitive: false, wholeWord: false, regex: true }) };
    const controller = new SearchController(createIpc(), options);
    assert.strictEqual(controller.mode, 'js');
  });

  it('开启全字匹配时切换到 JS 模式', () => {
    const options = { get: () => ({ caseSensitive: false, wholeWord: true, regex: false }) };
    const controller = new SearchController(createIpc(), options);
    assert.strictEqual(controller.mode, 'js');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

Expected: `Error: Cannot find module '../../src/search/search-controller'`

- [ ] **Step 3: 实现 `src/search/search-controller.js`**

```js
const { JsSearch } = require('./js-search');
const { NativeSearch } = require('./native-search');

/**
 * 根据当前选项决定使用 native 还是 JS 搜索
 * 统一返回 { total, current, valid, message? }
 */
class SearchController {
  constructor(ipc, options, document, windowRef) {
    this.ipc = ipc;
    this.options = options;
    this.jsSearch = new JsSearch(document, windowRef);
    this.nativeSearch = new NativeSearch(ipc);
    this.lastText = '';
  }

  get mode() {
    const opts = this.options.get();
    if (opts.wholeWord || opts.regex) return 'js';
    return 'native';
  }

  async find(text) {
    this.lastText = text;

    if (this.mode === 'js') {
      const result = this.jsSearch.find(text, this.options.get());
      return result;
    }

    const result = await this.nativeSearch.find(text, this.options.get());
    this.nativeSearch.updateResult(result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  async next() {
    if (this.mode === 'js') {
      this.jsSearch.next();
      return {
        total: this.jsSearch.matches.length,
        current: this.jsSearch.current,
        valid: true,
      };
    }

    const result = await this.nativeSearch.next();
    this.nativeSearch.updateResult(result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  async previous() {
    if (this.mode === 'js') {
      this.jsSearch.previous();
      return {
        total: this.jsSearch.matches.length,
        current: this.jsSearch.current,
        valid: true,
      };
    }

    const result = await this.nativeSearch.previous();
    this.nativeSearch.updateResult(result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  stop() {
    this.jsSearch.clear();
    this.nativeSearch.stop();
  }
}

module.exports = { SearchController };
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

Expected: 所有 `SearchController` 测试通过。

- [ ] **Step 5: Commit**

```bash
git add src/search/search-controller.js tests/search/search-controller.test.js
git commit -m "feat: 实现搜索控制器，协调 native 与 JS 模式"
```

---

## Task 7: 搜索框 UI

**Files:**
- Create: `src/search/search-box.js`

- [ ] **Step 1: 实现 `src/search/search-box.js`**

```js
/**
 * 渲染顶部右侧浮动的搜索框 UI
 * 处理输入、节流、快捷键、选项面板、空结果抖动
 */

class SearchBox {
  constructor(controller, options, themeDetector) {
    this.controller = controller;
    this.options = options;
    this.themeDetector = themeDetector;
    this.element = null;
    this.input = null;
    this.countLabel = null;
    this.optionsPanel = null;
    this.throttleTimer = null;
    this.visible = false;
  }

  render() {
    if (this.element) return this.element;

    const container = document.createElement('div');
    container.id = 'electron-search-box';
    container.className = 'electron-search-box';
    container.style.cssText = this.baseStyles();

    container.innerHTML = `
      <input class="electron-search-input" type="text" placeholder="搜索">
      <span class="electron-search-count">0/0</span>
      <button class="electron-search-btn" data-action="prev" title="上一个 (↑)">↑</button>
      <button class="electron-search-btn" data-action="next" title="下一个 (Enter)">↓</button>
      <button class="electron-search-btn" data-action="options" title="选项">⚙</button>
      <button class="electron-search-btn" data-action="close" title="关闭 (Esc)">✕</button>
      <div class="electron-search-options" style="display:none">
        <label><input type="checkbox" data-option="caseSensitive"> 区分大小写</label>
        <label><input type="checkbox" data-option="wholeWord"> 全字匹配</label>
        <label><input type="checkbox" data-option="regex"> 正则表达式</label>
      </div>
      <div class="electron-search-error" style="display:none"></div>
    `;

    this.element = container;
    this.input = container.querySelector('.electron-search-input');
    this.countLabel = container.querySelector('.electron-search-count');
    this.optionsPanel = container.querySelector('.electron-search-options');
    this.errorLabel = container.querySelector('.electron-search-error');

    this.bindEvents();
    this.applyTheme();

    return container;
  }

  baseStyles() {
    return `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      min-width: 280px;
    `;
  }

  applyTheme() {
    const theme = this.themeDetector.detect();
    const isDark = theme === 'dark';
    this.element.style.backgroundColor = isDark ? '#2d2d2d' : '#ffffff';
    this.element.style.color = isDark ? '#e8e8e8' : '#202124';
    this.element.style.border = `1px solid ${isDark ? '#5f6368' : '#dadce0'}`;
    this.input.style.backgroundColor = isDark ? '#1e1e1e' : '#f8f9fa';
    this.input.style.color = isDark ? '#e8e8e8' : '#202124';
    this.input.style.border = `1px solid ${isDark ? '#5f6368' : '#dadce0'}`;
  }

  bindEvents() {
    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onKeyDown(e));

    this.element.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'next') this.findNext();
      if (action === 'prev') this.findPrevious();
      if (action === 'options') this.toggleOptions();
      if (action === 'close') this.hide();
    });

    this.element.querySelectorAll('[data-option]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        this.options.set(e.target.dataset.option, e.target.checked);
        this.onInput();
      });
    });

    this.options.subscribe(() => this.syncOptions());
  }

  syncOptions() {
    const opts = this.options.get();
    this.element.querySelectorAll('[data-option]').forEach((checkbox) => {
      checkbox.checked = opts[checkbox.dataset.option];
    });
  }

  onInput() {
    if (this.throttleTimer) clearTimeout(this.throttleTimer);
    this.throttleTimer = setTimeout(() => this.search(), 100);
  }

  async search() {
    const text = this.input.value;
    this.hideError();

    if (!text) {
      this.controller.stop();
      this.updateCount(0, 0);
      return;
    }

    const result = await this.controller.find(text);
    if (!result.valid) {
      this.showError(result.message);
      this.updateCount(0, 0);
      return;
    }

    this.updateCount(result.current, result.total);
    if (result.total === 0) {
      this.shake();
    }
  }

  async findNext() {
    const result = await this.controller.next();
    if (result.valid) {
      this.updateCount(result.current, result.total);
    }
  }

  async findPrevious() {
    const result = await this.controller.previous();
    if (result.valid) {
      this.updateCount(result.current, result.total);
    }
  }

  onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) this.findPrevious();
      else this.findNext();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.findNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.findPrevious();
    } else if (e.key === 'Escape') {
      this.hide();
    }
  }

  toggleOptions() {
    const isVisible = this.optionsPanel.style.display !== 'none';
    this.optionsPanel.style.display = isVisible ? 'none' : 'block';
  }

  updateCount(current, total) {
    this.countLabel.textContent = `${current}/${total}`;
  }

  showError(message) {
    this.errorLabel.textContent = message;
    this.errorLabel.style.display = 'block';
    this.input.style.borderColor = '#ea4335';
  }

  hideError() {
    this.errorLabel.style.display = 'none';
    this.input.style.borderColor = '';
  }

  shake() {
    this.element.style.animation = 'none';
    // 强制重绘
    void this.element.offsetWidth;
    this.element.style.animation = 'electron-search-shake 0.3s ease';
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    this.render();
    document.body.appendChild(this.element);
    this.visible = true;

    const selection = window.getSelection().toString();
    if (selection) {
      this.input.value = selection;
      this.search();
    }

    this.input.focus();
    this.input.select();
  }

  hide() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.controller.stop();
    this.visible = false;
  }
}

// 注入抖动动画
const style = document.createElement('style');
style.textContent = `
  @keyframes electron-search-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
  .electron-search-box input,
  .electron-search-box button {
    outline: none;
  }
  .electron-search-box input {
    border-radius: 4px;
    padding: 4px 8px;
    flex: 1;
  }
  .electron-search-box button {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
  }
  .electron-search-box button:hover {
    background: rgba(128,128,128,0.15);
  }
  .electron-search-options {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 6px;
    padding: 8px;
    border-radius: 8px;
    background: inherit;
    border: inherit;
    box-shadow: inherit;
  }
  .electron-search-options label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }
  .electron-search-error {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 6px;
    color: #ea4335;
    font-size: 12px;
  }
`;
if (document.head) document.head.appendChild(style);

module.exports = { SearchBox };
```

- [ ] **Step 2: Commit**

```bash
git add src/search/search-box.js
git commit -m "feat: 实现搜索框 UI"
```

---

## Task 8: 搜索入口

**Files:**
- Create: `src/search/index.js`

- [ ] **Step 1: 实现 `src/search/index.js`**

```js
const { SearchBox } = require('./search-box');
const { SearchController } = require('./search-controller');
const { SearchOptions } = require('./search-options');
const { ThemeDetector } = require('./theme-detector');

/**
 * 初始化页面内搜索功能
 * 由 preload.js 在 DOMContentLoaded 后调用
 */
function initSearch() {
  if (typeof window === 'undefined' || !window.electronSearch) {
    console.warn('electronSearch API 未暴露，跳过搜索初始化');
    return;
  }

  const options = new SearchOptions();
  const controller = new SearchController(
    window.electronSearch,
    options,
    document,
    window
  );
  const themeDetector = new ThemeDetector();
  const searchBox = new SearchBox(controller, options, themeDetector);

  window.electronSearch.onToggle((event) => {
    searchBox.toggle();
  });
}

module.exports = { initSearch };
```

- [ ] **Step 2: Commit**

```bash
git add src/search/index.js
git commit -m "feat: 添加搜索功能入口"
```

---

## Task 9: 主进程集成

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: 在 `before-input-event` 中增加 Ctrl/Cmd+F 快捷键**

在 `mainWindow.webContents.on('before-input-event', ...)` 回调中，在 `if (input.key === 'w' ...)` 之后增加：

```js
if (input.key === 'f' && (input.control || input.meta)) {
  mainWindow.webContents.send('search:toggle');
  event.preventDefault();
}
```

- [ ] **Step 2: 增加搜索 IPC 处理**

在 `createWindow` 函数中，在 `mainWindow.webContents.on('before-input-event', ...)` 之前增加：

```js
mainWindow.webContents.on('ipc-message', (event, channel, requestId, ...args) => {
  if (channel === 'search:find') {
    const { text, options } = args[0];
    mainWindow.webContents.findInPage(text, options);
  }
});
```

注意：Electron 的 `ipcRenderer.invoke` 在 renderer 端通过 `ipcRenderer.invoke('search:find', ...)` 发送，`ipcMain.handle` 在主进程处理。这里使用 `ipcMain.handle` 更合适。

修改方案：在 `createWindow` 函数顶部引入 `ipcMain`，并注册 handler：

```js
const { app, BrowserWindow, globalShortcut, session, ipcMain } = require('electron');
```

在 `createWindow` 中增加：

```js
ipcMain.handle('search:find', (event, { text, options }) => {
  return new Promise((resolve) => {
    const onFound = (event, result) => {
      mainWindow.webContents.off('found-in-page', onFound);
      resolve(result);
    };
    mainWindow.webContents.on('found-in-page', onFound);
    mainWindow.webContents.findInPage(text, options);
  });
});

ipcMain.on('search:stop', () => {
  mainWindow.webContents.stopFindInPage('clearSelection');
});

ipcMain.on('search:navigate', (event, direction) => {
  mainWindow.webContents.findInPage('', {
    forward: direction === 'next',
    findNext: true,
  });
});
```

- [ ] **Step 3: 处理 `found-in-page` 事件回传 renderer**

```js
mainWindow.webContents.on('found-in-page', (event, result) => {
  mainWindow.webContents.send('search:found', result);
});
```

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: 主进程集成搜索快捷键与 IPC"
```

---

## Task 10: Preload 集成

**Files:**
- Modify: `src/preload.js`

- [ ] **Step 1: 加载搜索入口并正确清理事件监听**

```js
const { contextBridge, ipcRenderer } = require('electron');
const { initSearch } = require('./search/index');

const listeners = [];

function on(channel, callback) {
  const wrapped = (event, ...args) => callback(...args);
  listeners.push({ channel, wrapped });
  ipcRenderer.on(channel, wrapped);
}

function once(channel, callback) {
  const wrapped = (event, ...args) => callback(...args);
  listeners.push({ channel, wrapped });
  ipcRenderer.once(channel, wrapped);
}

contextBridge.exposeInMainWorld('electronSearch', {
  find: (text, options) => ipcRenderer.invoke('search:find', { text, options }),
  stop: () => ipcRenderer.send('search:stop'),
  navigate: (direction) => ipcRenderer.send('search:navigate', direction),
  onFound: (callback) => on('search:found', callback),
  onToggle: (callback) => on('search:toggle', callback),
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/preload.js
git commit -m "feat: preload 暴露搜索 API 并初始化搜索入口"
```

---

## Task 11: 运行全部测试

- [ ] **Step 1: 运行单元测试**

```bash
npm test
```

Expected: 所有测试通过。

- [ ] **Step 2: 启动应用进行手动测试**

```bash
npm start
```

手动验证清单：
- 在 Gemini 页面按 `Ctrl/Cmd+F` 打开搜索框。
- 输入关键词，确认高亮和计数。
- 按 `Enter` / `Shift+Enter` 跳转。
- 按 `↑` / `↓` 跳转。
- 开启「正则表达式」并输入 `c.t`，确认匹配。
- 输入无效正则 `(`, 确认边框变红并提示。
- 开启「全字匹配」，确认只匹配完整单词。
- 选中页面文字后按 `Ctrl/Cmd+F`，确认自动填充。
- 按 `Esc` 关闭搜索框并清除高亮。

- [ ] **Step 3: Commit 修复（如有）**

根据手动测试结果修复问题后提交。

---

## 自我审查

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 搜索范围覆盖可见文字 + input/textarea | Task 4 (`js-search.js`) |
| 高亮、计数、上下跳转 | Task 4, Task 7 |
| 大小写敏感 | Task 4, Task 2 |
| 全字匹配、正则表达式 | Task 4 |
| 顶部右侧浮动 UI | Task 7 |
| 主题自动检测 | Task 3 |
| 自动填充选中文本 | Task 7 (`show` 方法) |
| 实时搜索 + 100ms 节流 | Task 7 (`onInput`) |
| 选项仅会话记忆 | Task 2 |
| 快捷键 Ctrl/Cmd+F, Esc, Enter, ↑↓ | Task 7, Task 9 |
| 空结果 0/0 + 抖动 | Task 7 (`shake`) |
| 正则错误提示 | Task 4, Task 7 |
| 混合方案 native/JS | Task 5, Task 6 |

### Placeholder 检查

- 无 `TBD`、`TODO`、未完成的代码块。
- 每个 Task 包含完整代码和命令。

### 类型一致性检查

- `SearchController` 在 native 和 JS 模式下都返回 `{ total, current, valid, message? }`。
- `NativeSearch` 和 `JsSearch` 的接口在 `SearchController` 中保持一致。
- `SearchOptions.get()` 返回 `{ caseSensitive, wholeWord, regex }` 快照，所有调用方一致。
