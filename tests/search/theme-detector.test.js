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
