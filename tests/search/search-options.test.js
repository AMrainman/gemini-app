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
