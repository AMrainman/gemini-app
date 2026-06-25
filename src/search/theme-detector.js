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
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)\s*,?\s*([\d.]+)?\)/);
  if (!rgbMatch) return null;
  const alpha = rgbMatch[4] ? Number(rgbMatch[4]) : 1;
  if (alpha === 0) return null;
  return {
    r: Number(rgbMatch[1]),
    g: Number(rgbMatch[2]),
    b: Number(rgbMatch[3]),
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
    return parseColor(style.backgroundColor);
  }

  systemTheme() {
    if (this.window.matchMedia && this.window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
}

module.exports = { ThemeDetector, luminance, parseColor };
