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
    this.errorLabel = null;
    this.throttleTimer = null;
    this.visible = false;
  }

  render() {
    if (this.element) return this.element;

    const container = document.createElement('div');
    container.id = 'electron-search-box';
    container.className = 'electron-search-box';
    container.style.cssText = this.baseStyles();

    // 使用 DOM API 创建元素，避免触发页面的 Trusted Types CSP
    const input = document.createElement('input');
    input.className = 'electron-search-input';
    input.type = 'text';
    input.placeholder = '搜索';
    container.appendChild(input);
    this.input = input;

    const countLabel = document.createElement('span');
    countLabel.className = 'electron-search-count';
    countLabel.textContent = '0/0';
    container.appendChild(countLabel);
    this.countLabel = countLabel;

    const prevBtn = this.createButton('prev', '上一个 (↑)', '↑');
    container.appendChild(prevBtn);

    const nextBtn = this.createButton('next', '下一个 (Enter)', '↓');
    container.appendChild(nextBtn);

    const optionsBtn = this.createButton('options', '选项', '⚙');
    container.appendChild(optionsBtn);

    const closeBtn = this.createButton('close', '关闭 (Esc)', '✕');
    container.appendChild(closeBtn);

    const optionsPanel = document.createElement('div');
    optionsPanel.className = 'electron-search-options';
    optionsPanel.style.display = 'none';
    optionsPanel.appendChild(this.createCheckboxOption('caseSensitive', '区分大小写'));
    optionsPanel.appendChild(this.createCheckboxOption('wholeWord', '全字匹配'));
    optionsPanel.appendChild(this.createCheckboxOption('regex', '正则表达式'));
    container.appendChild(optionsPanel);
    this.optionsPanel = optionsPanel;

    const errorLabel = document.createElement('div');
    errorLabel.className = 'electron-search-error';
    errorLabel.style.display = 'none';
    container.appendChild(errorLabel);
    this.errorLabel = errorLabel;

    this.element = container;

    this.bindEvents();
    this.applyTheme();

    return container;
  }

  createButton(action, title, text) {
    const button = document.createElement('button');
    button.className = 'electron-search-btn';
    button.dataset.action = action;
    button.title = title;
    button.textContent = text;
    return button;
  }

  createCheckboxOption(option, labelText) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.option = option;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${labelText}`));
    return label;
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
    this.isComposing = false;

    this.input.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });

    this.input.addEventListener('compositionend', () => {
      this.isComposing = false;
      this.onInput();
    });

    this.input.addEventListener('input', () => {
      if (!this.isComposing) this.onInput();
    });

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
    this.search();
  }

  async search() {
    const text = this.input.value;
    this.hideError();

    if (!text) {
      this.controller.stop();
      this.updateCount(0, 0);
      return;
    }

    // 保存焦点与选区，避免搜索后丢失输入状态
    const activeElement = document.activeElement;
    const inputWasFocused = activeElement === this.input;
    const selectionStart = this.input.selectionStart;
    const selectionEnd = this.input.selectionEnd;
    const selectionDirection = this.input.selectionDirection;

    // 临时隐藏搜索框，避免 native / JS 搜索把搜索框自身内容算入结果
    const originalDisplay = this.element.style.display;
    this.element.style.display = 'none';

    const result = await this.controller.find(text);

    // 恢复搜索框显示
    this.element.style.display = originalDisplay;

    // 恢复焦点与选区
    if (inputWasFocused) {
      this.input.focus();
      this.input.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
    } else if (activeElement && activeElement.focus && activeElement !== this.input) {
      activeElement.focus();
    }

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
    // 页面可能已把搜索框从 DOM 中移除，不能仅凭 this.visible 判断
    const isInDom = this.element && this.element.parentNode && this.element.parentNode.isConnected;
    if (isInDom) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    this.render();
    const parent = document.body || document.documentElement;
    parent.appendChild(this.element);
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

// 注入全局样式
if (typeof document !== 'undefined' && document.head) {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes electron-search-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    .electron-search-box {
      position: relative;
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
      color: inherit;
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
  document.head.appendChild(style);
}

module.exports = { SearchBox };
