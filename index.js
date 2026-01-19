import { readFileSync, writeFileSync } from 'fs';
import { chromium, firefox, webkit } from 'playwright';

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

  // ブラウザごとのストレージファイル名
  const storageFileName = `storage-state-${browserType}.json`;

  // --with-storage フラグがある場合、ストレージ状態を読み込む
  if (process.argv.includes('--with-storage')) {
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

  // SIGINT (Ctrl+C や Cmd+Q) でストレージ状態を保存してから閉じる
  process.on('SIGINT', async () => {
    try {
      const storageState = await context.storageState();
      writeFileSync(storageFileName, JSON.stringify(storageState, null, 2));
      console.log(`Storage state saved to ${storageFileName}`);
    } catch (error) {
      console.error('Failed to save storage state:', error);
    }
    await browser.close();
    process.exit(0);
  });
}

main().catch(console.error);
