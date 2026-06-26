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
    this.document = document;
    this.windowRef = windowRef;
    this.jsSearch = null;
    this.nativeSearch = new NativeSearch(ipc);
    this.lastText = '';
  }

  get jsSearchInstance() {
    if (!this.jsSearch) {
      this.jsSearch = new JsSearch(this.document, this.windowRef);
    }
    return this.jsSearch;
  }

  get mode() {
    const opts = this.options.get();
    if (opts.wholeWord || opts.regex) return 'js';
    return 'native';
  }

  async find(text) {
    this.lastText = text;
    console.log('[controller] find, mode:', this.mode, 'text:', text);

    if (this.mode === 'js') {
      const result = this.jsSearchInstance.find(text, this.options.get());
      console.log('[controller] js result:', result);
      return result;
    }

    const result = await this.nativeSearch.find(text, this.options.get());
    this.nativeSearch.updateResult(result);
    console.log('[controller] native raw result:', result);
    return {
      total: result.matches,
      current: result.activeMatchOrdinal,
      valid: true,
    };
  }

  async next() {
    if (this.mode === 'js') {
      this.jsSearchInstance.next();
      return {
        total: this.jsSearchInstance.matches.length,
        current: this.jsSearchInstance.current,
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
      this.jsSearchInstance.previous();
      return {
        total: this.jsSearchInstance.matches.length,
        current: this.jsSearchInstance.current,
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
    if (this.jsSearch) {
      this.jsSearch.clear();
    }
    this.nativeSearch.stop();
  }
}

module.exports = { SearchController };
