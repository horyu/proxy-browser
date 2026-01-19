# Proxy Browser Launcher

This project launches Chrome, Safari, or Firefox with proxy settings configured from a `.env` file using Playwright.

## Prerequisites

This project uses [mise](https://mise.jdx.dev/) for managing Node.js and pnpm versions.

### Installing mise

If you don't have mise installed, install it using one of the following methods:

- **macOS (with Homebrew):**

  ```bash
  brew install mise
  ```

- **Other platforms:**
  Refer to the [mise installation guide](https://mise.jdx.dev/getting-started.html).

After installation, ensure mise is activated in your shell (follow the post-installation steps in the mise documentation).

## Setup

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd proxy-browser
   ```

2. Install dependencies:

   ```bash
   mise install
   pnpm install
   ```

3. Install Playwright browsers:

   ```bash
   pnpx playwright install --with-deps
   ```

4. Configure proxy settings in `.env` file (copy from `.env.example`):

   ```bash
   cp .env.example .env
   # Edit .env with your proxy details
   ```

5. Run the project with your preferred browser:

   **Chrome:**

   ```bash
   pnpm run chrome
   # With storage state:
   pnpm run chrome:storage
   ```

   **Safari (default):**

   ```bash
   pnpm run safari
   # With storage state:
   pnpm run safari:storage
   ```

   **Firefox:**

   ```bash
   pnpm run firefox
   # With storage state:
   pnpm run firefox:storage
   ```

   You can also run directly with Node.js:

   ```bash
   node --env-file=.env index.js [chrome|safari|firefox] [--with-storage]
   ```

This will launch the selected browser with the proxy settings applied. The `:storage` variants automatically load and save browser state (cookies, localStorage, etc.).

## License

This project is licensed under the [DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE, Version 2](LICENSE).

Copyright notice is as follows:

```txt
Copyright (C) 2025 horyu
Portions generated with the assistance of Grok Code Fast 1.
```
