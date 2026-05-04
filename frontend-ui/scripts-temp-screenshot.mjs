import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const EMAIL = 'mariowinter.sg@gmail.com';
const PASSWORD = 'werte1234';
const OUT = '/tmp/proj20-screenshots';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
});
const page = await context.newPage();

// Surface JS errors / console warnings to help debug a blank page.
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text());
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

console.log('1) Navigate to', BASE_URL);
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

// If we landed on /login, perform login.
if (/login/i.test(page.url())) {
  console.log('2) On login page — submitting credentials');
  // The login screen uses MUI TextField — try common selectors.
  const emailInput = page.getByLabel(/email/i).first();
  const passwordInput = page.getByLabel(/password/i).first();
  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  // Submit
  await page.getByRole('button', { name: /log in|sign in|login/i }).first().click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
}

console.log('3) Logged in, current URL:', page.url());

// Force dark theme via localStorage if the app uses MUI useColorScheme.
await page.evaluate(() => {
  try {
    localStorage.setItem('mui-mode', 'dark');
    localStorage.setItem('mui-color-scheme-light', 'dark');
    localStorage.setItem('mui-color-scheme-dark', 'dark');
  } catch (e) {
    void e;
  }
});

// Trigger the floating chat bar to expand. The bar default-collapses to a chevron;
// dispatch an `expandBar` via the Redux store accessible on `window` if any, else
// click the chevron.
console.log('4) Expand floating chat bar');
// Click the chevron indicator if present
const chevron = page.getByLabel(/expand|chat/i).first();
const chevronCount = await chevron.count();
if (chevronCount > 0) {
  await chevron.click().catch(() => {});
}

// Wait for the expanded chat input bar.
await page.waitForSelector('[data-testid="chat-input-bar"]', { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(800);

console.log('5) Full-page screenshot');
await page.screenshot({ path: `${OUT}/full-dark.png`, fullPage: false });

const bar = page.locator('[data-testid="chat-input-bar"]').first();
if (await bar.count() > 0) {
  console.log('6) Tight crop of chat input bar');
  await bar.screenshot({ path: `${OUT}/chat-input-bar-dark.png` });
} else {
  console.log('   (chat-input-bar not found)');
}

// Also light mode for comparison
await page.evaluate(() => {
  try {
    localStorage.setItem('mui-mode', 'light');
    localStorage.setItem('mui-color-scheme-light', 'light');
    localStorage.setItem('mui-color-scheme-dark', 'light');
  } catch (e) {
    void e;
  }
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
const chevronLight = page.getByLabel(/expand|chat/i).first();
if (await chevronLight.count() > 0) await chevronLight.click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/full-light.png`, fullPage: false });
const barLight = page.locator('[data-testid="chat-input-bar"]').first();
if (await barLight.count() > 0) {
  await barLight.screenshot({ path: `${OUT}/chat-input-bar-light.png` });
}

await browser.close();
console.log('done');
