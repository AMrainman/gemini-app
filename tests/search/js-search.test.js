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
    assert.strictEqual(search.current, 1);
    search.next();
    assert.strictEqual(search.current, 2);
    search.next();
    assert.strictEqual(search.current, 3);
  });
});
