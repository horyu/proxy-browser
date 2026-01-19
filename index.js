import { existsSync } from 'fs';
import { chromium, firefox, webkit } from 'playwright';

/**
 * ストレージ管理を設定する
 *
 * 5秒ごとに直接ファイルに書き込む理由:
 * - browser.on('disconnected') や context.on('close') などのフックイベントでは、
 *   イベント発火時点で既にブラウザが閉じる過程にあり、非同期の storageState() 呼び出しが
 *   完了しない可能性が高いため、定期的にファイルに保存する方式を採用
 *
 * @param {import('playwright').Browser} browser
 * @param {import('playwright').BrowserContext} context
 * @param {string} storageFileName
 */
function setupStorageManagement(browser, context, storageFileName) {
  // 定期的にファイルに直接書き込む（5秒ごと）
  // storageState({ path }) を使うことで、直接ファイルに保存される
  const saveInterval = setInterval(async () => {
    try {
      await context.storageState({ path: storageFileName });
    } catch (error) {
      // エラーは無視（ブラウザが閉じられた場合など）
    }
  }, 5000); // 5秒ごとにファイルに保存

  // ブラウザが切断された時の処理
  browser.on('disconnected', () => {
    clearInterval(saveInterval);
  });

  // シグナルハンドラーの共通処理
  const handleShutdown = async (signal) => {
    clearInterval(saveInterval);
    console.log(`\nShutting down gracefully (${signal})...`);
    // 最新の状態を保存してから終了
    try {
      await context.storageState({ path: storageFileName });
      console.log(`Storage state saved to ${storageFileName}`);
    } catch (error) {
      // エラーは無視（既に定期保存されている）
    }
    process.exit(0);
  };

  // SIGINT (Ctrl+C) でストレージ状態を保存してから閉じる
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // SIGTERM (kill コマンドなど) でもストレージを保存
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
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

  const browser = await browserEngine.launch({ headless: false });

  /** @type {import('playwright').BrowserContextOptions} */
  let contextOptions = { proxy };

  // ストレージ機能を有効にするかどうか
  const withStorage = process.argv.includes('--with-storage');

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
    setupStorageManagement(browser, context, storageFileName);
  }
}

main().catch(console.error);
