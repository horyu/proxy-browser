import { existsSync } from 'fs';
import { chromium, firefox, webkit } from 'playwright';

/**
 * ストレージ管理を設定する
 *
 * シグナルハンドラーでストレージを保存する:
 * - storageState() の実行中に一時的なタブが開かれるため、定期保存は避ける
 * - プログラム終了時（SIGINT/SIGTERM）のみストレージを保存する
 * - LaunchOptionsでhandleSIGINT/SIGTERM/SIGHUPをfalseに設定することで、
 *   Playwrightのデフォルトハンドラーを無効化し、独自のハンドラーで処理する
 *
 * @param {import('playwright').BrowserContext} context
 * @param {string} storageFileName
 */
function setupStorageManagement(context, storageFileName) {
  let isShuttingDown = false;

  const handleShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nShutting down gracefully (${signal})...`);
    try {
      await context.storageState({ path: storageFileName });
      console.log(`Storage state saved to ${storageFileName}`);
    } catch (error) {
      console.error('Failed to save storage state:', error.message);
    } finally {
      await context.browser()?.close();
    }
    process.exit(0);
  };

  process.on('SIGINT', async () => {
    await handleShutdown('SIGINT');
  });

  process.on('SIGTERM', async () => {
    await handleShutdown('SIGTERM');
  });
}

async function main() {
  const proxy = {
    server: process.env.PROXY_SERVER,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  };

  // コマンドライン引数からブラウザを選択（デフォルトはsafari）
  // 使用例: node index.js chrome --with-storage
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const browserType = (args[0] || 'safari').toLowerCase();
  let browserEngine;

  switch (browserType) {
    case 'chrome':
    case 'chromium':
      browserEngine = chromium;
      break;
    case 'firefox':
      browserEngine = firefox;
      break;
    case 'safari':
    case 'webkit':
    default:
      browserEngine = webkit;
      break;
  }

  // ストレージ機能を有効にするかどうか
  const withStorage = process.argv.includes('--with-storage');

  /** @type {import('playwright').LaunchOptions} */
  const launchOptions = {
    headless: false,
    // ストレージ有効時はPlaywrightのデフォルトシグナルハンドリングを無効化
    // 独自のシグナルハンドラーでストレージを保存してから終了する
    ...(withStorage && {
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    }),
  };

  const browser = await browserEngine.launch(launchOptions);

  /** @type {import('playwright').BrowserContextOptions} */
  let contextOptions = { proxy };

  // ブラウザごとのストレージファイル名
  const storageFileName = `storage-state-${browserType}.json`;

  // ストレージ状態を読み込む
  if (withStorage && existsSync(storageFileName)) {
    contextOptions.storageState = storageFileName;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto(process.env.TARGET_URL || 'https://example.com');

  // ストレージ管理を設定（有効な場合のみ）
  // ストレージなしの場合は、保存すべき状態がないためクリーンアップ処理は不要
  if (withStorage) {
    setupStorageManagement(context, storageFileName);
  }
}

main().catch(console.error);
