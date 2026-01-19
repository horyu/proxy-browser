import { readFileSync, writeFileSync } from 'fs';
import { chromium, firefox, webkit } from 'playwright';

/**
 * ストレージ管理を設定する
 *
 * 5秒ごとにメモリ上でストレージ状態を更新する理由:
 * - browser.on('disconnected') や context.on('close') などのフックイベントでは、
 *   イベント発火時点で既にブラウザが閉じる過程にあり、非同期の storageState() 呼び出しが
 *   完了しない可能性が高いため、定期的にメモリに保存しておく方式を採用
 *
 * @param {import('playwright').Browser} browser
 * @param {import('playwright').BrowserContext} context
 * @param {string} storageFileName
 */
function setupStorageManagement(browser, context, storageFileName) {
  let cachedStorageState = null;

  // ファイルに書き出す関数（プログラム終了時のみ呼ばれる）
  const writeStorageToFile = () => {
    if (cachedStorageState) {
      try {
        writeFileSync(
          storageFileName,
          JSON.stringify(cachedStorageState, null, 2),
        );
        console.log(`Storage state saved to ${storageFileName}`);
      } catch (error) {
        console.error('Failed to save storage state:', error);
      }
    }
  };

  // 定期的にメモリ上のストレージ状態を更新（ファイルには書き込まない）
  // イベントフックでは保存が間に合わないため、事前にメモリに保持しておく
  const saveInterval = setInterval(async () => {
    try {
      cachedStorageState = await context.storageState();
    } catch (error) {
      // エラーは無視（ブラウザが閉じられた場合など）
    }
  }, 5000); // 5秒ごとにメモリ上で更新

  // ブラウザが切断された時の処理
  browser.on('disconnected', () => {
    clearInterval(saveInterval);
    console.log('\nBrowser disconnected');
    writeStorageToFile();
    process.exit(0);
  });

  // シグナルハンドラーの共通処理
  const handleShutdown = async (signal) => {
    clearInterval(saveInterval);
    console.log(`\nShutting down gracefully (${signal})...`);
    // 最新の状態を取得して即座に保存（中断される前に確実に保存）
    try {
      cachedStorageState = await context.storageState();
      writeStorageToFile(); // 取得直後に即座に保存
    } catch (error) {
      // エラーが発生してもキャッシュされた状態があれば保存を試みる
      writeStorageToFile();
    }
    try {
      await browser.close();
    } catch (error) {
      // ブラウザがすでに閉じている場合は無視
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
  let browserName;

  switch (browserType) {
    case 'chrome':
    case 'chromium':
      browserEngine = chromium;
      browserName = 'Chrome';
      break;
    case 'firefox':
      browserEngine = firefox;
      browserName = 'Firefox';
      break;
    case 'safari':
    case 'webkit':
    default:
      browserEngine = webkit;
      browserName = 'Safari';
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
  if (withStorage) {
    try {
      const storageState = JSON.parse(readFileSync(storageFileName, 'utf8'));
      contextOptions.storageState = storageState;
      console.log(`Loaded storage state from ${storageFileName}`);
    } catch (error) {
      // ファイルが存在しない場合は読み込まない（ログは出さない）
      if (error.code !== 'ENOENT') {
        console.error('Failed to load storage state:', error.message);
      }
    }
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto(process.env.TARGET_URL || 'https://example.com');
  console.log(`${browserName} launched with proxy settings.`);

  // ストレージ管理を設定（有効な場合のみ）
  // ストレージなしの場合は、保存すべき状態がないためクリーンアップ処理は不要
  if (withStorage) {
    setupStorageManagement(browser, context, storageFileName);
  }
}

main().catch(console.error);
