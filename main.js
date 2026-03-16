const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    // macOS 通常不需要在这里设置 icon，它会使用打包时指定的 .icns
    // Windows 和 Linux 会使用这里的 .png
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('https://gemini.google.com/app');

  // 隐藏到托盘而不是退出 (macOS 常见行为)
  mainWindow.on('close', function (event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // 注册全局快捷键
  const ret = globalShortcut.register('Alt+G', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  if (!ret) {
    console.error('快捷键注册失败');
  }

  app.on('activate', function () {
    // macOS 点击 dock 图标时恢复窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// 在退出前设置标志位，允许窗口真正关闭
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll();
});