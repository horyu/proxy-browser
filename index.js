import { readFileSync, writeFileSync } from 'fs';
import { webkit } from 'playwright';

async function main() {
  const proxy = {
    server: process.env.PROXY_SERVER,
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  };

  const browser = await webkit.launch({ headless: false });

  /** @type {import('playwright').BrowserContextOptions} */
  let contextOptions = { proxy };

  // --with-storage フラグがある場合、ストレージ状態を読み込む
  if (process.argv.includes('--with-storage')) {
    try {
      const storageState = JSON.parse(
        readFileSync('storage-state.json', 'utf8')
      );
      contextOptions.storageState = storageState;
      console.log('Loaded storage state from storage-state.json');
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
  console.log('Safari launched with proxy settings.');

  // SIGINT (Ctrl+C や Cmd+Q) でストレージ状態を保存してから閉じる
  process.on('SIGINT', async () => {
    try {
      const storageState = await context.storageState();
      writeFileSync(
        'storage-state.json',
        JSON.stringify(storageState, null, 2)
      );
      console.log('Storage state saved to storage-state.json');
    } catch (error) {
      console.error('Failed to save storage state:', error);
    }
    await browser.close();
    process.exit(0);
  });
}

main().catch(console.error);
