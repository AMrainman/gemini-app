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

  if (!options.caseSensitive) {
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

    this.matches = this.collectAndHighlightMatches(regex);
    this.current = this.matches.length > 0 ? 1 : 0;

    return {
      total: this.matches.length,
      current: this.current,
      valid: true,
    };
  }

  /**
   * 收集并高亮所有匹配
   * 对每个文本节点独立处理，从后往前替换，避免偏移失效
   */
  collectAndHighlightMatches(regex) {
    const matches = [];
    const nodes = this.collectTextNodes();

    for (const node of nodes) {
      const text = node.textContent;
      const nodeMatches = [];
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text)) !== null) {
        nodeMatches.push({ start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) break;
      }

      // 从后往前高亮，避免前面替换影响后续偏移
      for (let i = nodeMatches.length - 1; i >= 0; i--) {
        const { start, end } = nodeMatches[i];
        const highlightSpan = this.highlightRange(node, start, end);
        if (highlightSpan) {
          matches.unshift({ element: highlightSpan });
        }
      }
    }

    // 收集 input/textarea 的可见值
    const inputs = this.document.querySelectorAll('input, textarea');
    for (const input of inputs) {
      if (!this.isVisible(input)) continue;
      const value = input.value || input.textContent || '';
      let inputMatchCount = 0;
      let inputMatch;
      regex.lastIndex = 0;
      while ((inputMatch = regex.exec(value)) !== null) {
        inputMatchCount++;
        matches.push({ input });
        if (inputMatch[0].length === 0) break;
      }
      if (inputMatchCount > 0) {
        input.dataset.electronSearchMatch = 'true';
      }
    }

    return matches;
  }

  collectTextNodes() {
    const nodes = [];
    const walker = this.document.createTreeWalker(
      this.document.body,
      this.window.NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
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
      nodes.push(walker.currentNode);
    }
    return nodes;
  }

  /**
   * 在文本节点内高亮指定范围 [start, end)
   * 返回高亮 span 元素
   */
  highlightRange(node, start, end) {
    try {
      const after = node.splitText(end);
      const middle = node.splitText(start);
      const span = this.document.createElement('span');
      span.className = this.highlightClass;
      span.style.backgroundColor = '#ff9632';
      span.style.color = '#000';
      middle.parentNode.replaceChild(span, middle);
      span.appendChild(middle);
      return span;
    } catch (err) {
      // 复杂 DOM 结构下可能失败，跳过该匹配
      return null;
    }
  }

  isVisible(element) {
    const style = this.window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
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
    const spans = this.document.querySelectorAll(`.${this.highlightClass}`);
    for (const span of spans) {
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }

    const inputs = this.document.querySelectorAll('[data-electron-search-match]');
    for (const input of inputs) {
      delete input.dataset.electronSearchMatch;
    }

    this.matches = [];
    this.current = 0;
  }
}

module.exports = { JsSearch, buildRegExp, escapeRegExp };
