/**
 * 独立搜索窗口的 UI 逻辑
 * 运行在独立的 BrowserWindow 中，通过 searchWindowApi 与主进程通信
 */

const api = window.searchWindowApi;

const input = document.getElementById('search-input');
const countLabel = document.getElementById('search-count');
const optionsPanel = document.getElementById('search-options');
const errorLabel = document.getElementById('search-error');

const options = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

let isComposing = false;
let lastText = '';

function updateCount(current, total) {
  countLabel.textContent = `${current}/${total}`;
}

function showError(message) {
  errorLabel.textContent = message;
  errorLabel.style.display = 'block';
}

function hideError() {
  errorLabel.style.display = 'none';
}

function getOptions() {
  return { ...options };
}

async function doSearch() {
  const text = input.value;
  lastText = text;
  hideError();

  if (!text) {
    api.stop();
    updateCount(0, 0);
    return;
  }

  await api.find(text, getOptions());
}

async function findNext() {
  if (!lastText) return;
  await api.next(lastText, getOptions());
}

async function findPrevious() {
  if (!lastText) return;
  await api.previous(lastText, getOptions());
}

function toggleOptions() {
  const isVisible = optionsPanel.style.display !== 'none';
  optionsPanel.style.display = isVisible ? 'none' : 'block';
}

input.addEventListener('compositionstart', () => {
  isComposing = true;
});

input.addEventListener('compositionend', () => {
  isComposing = false;
  doSearch();
});

input.addEventListener('input', () => {
  if (!isComposing) doSearch();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) findPrevious();
    else findNext();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    findNext();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    findPrevious();
  } else if (e.key === 'Escape') {
    api.hide();
  }
});

document.getElementById('btn-next').addEventListener('click', findNext);
document.getElementById('btn-prev').addEventListener('click', findPrevious);
document.getElementById('btn-options').addEventListener('click', toggleOptions);
document.getElementById('btn-close').addEventListener('click', () => api.hide());

document.querySelectorAll('[data-option]').forEach((checkbox) => {
  checkbox.addEventListener('change', (e) => {
    options[e.target.dataset.option] = e.target.checked;
    doSearch();
  });
});

api.onResult((result) => {
  if (!result.valid) {
    showError(result.message || '搜索失败');
    updateCount(0, 0);
    return;
  }
  updateCount(result.current, result.total);
});

// 窗口获得焦点时聚焦输入框并全选
window.addEventListener('focus', () => {
  input.focus();
  input.select();
});

// 初始化时聚焦输入框
input.focus();
