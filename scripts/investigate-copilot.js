// Direct investigation using Puppeteer (same engine as Chrome DevTools MCP)
const puppeteer = require('puppeteer-core');

async function main() {
  console.log('=== Investigating CopilotKit 404 ===\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture all network events
  const requests = [];
  const errors = [];
  
  page.on('request', req => {
    if (req.url().includes('copilotkit')) {
      console.log(`[NET] ${req.method()} ${req.url()}`);
      requests.push({ url: req.url(), method: req.method() });
    }
  });
  
  page.on('response', async res => {
    if (res.url().includes('copilotkit')) {
      console.log(`[RES] ${res.status()} ${res.url()}`);
      console.log(`[HEADERS]`, Object.fromEntries(res.headers()));
    }
  });
  
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
    errors.push(err.message);
  });
  
  page.on('console', msg => {
    if (msg.text().includes('copilotkit') || msg.type() === 'error') {
      console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`);
      if (msg.type() === 'error') errors.push(msg.text());
    }
  });
  
  console.log('Navigating to https://api.jamot.pro...');
  
  try {
    await page.goto('https://api.jamot.pro', { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (e) {
    console.log('Navigation timeout/error:', e.message);
  }
  
  // Check for specific copilotkit routes
  console.log('\n--- Testing /api/copilotkit endpoints ---');
  
  const routes = [
    '/api/copilotkit/',
    '/api/copilotkit/route', 
    '/api/copilotkit/messages',
    '/api/copilotkit/stream'
  ];
  
  for (const route of routes) {
    try {
      const res = await fetch(`https://api.jamot.pro${route}`, {
        headers: { 'User-Agent': 'debug-test' },
        signal: AbortSignal.timeout(3000)
      });
      console.log(`  ${res.status} ${route}`);
    } catch (e) {
      console.log(`  FAIL ${route}: ${e.message.split('\n')[0]}`);
    }
  }
  
  // Get console output from the page
  console.log('\n--- Page Console Output ---');
  const consoleMessages = await page.evaluate(() => {
    return window.__NEXT_DATA__ ? 'Has Next.js runtime' : 'No Next.js data';
  });
  console.log(consoleMessages);
  
  // Take screenshot for visual check
  await page.screenshot({ path: '/tmp/copilot-debug.png' });
  console.log('\nScreenshot saved to /tmp/copilot-debug.png');
  
  // Print summary
  console.log('\n=== Summary ===');
  console.log(`Network requests to copilotkit: ${requests.length}`);
  console.log(`Console errors: ${errors.length}`);
  if (requests.length === 0 && errors.length === 0) {
    console.log('⚠️  No copilotkit activity detected on page load');
    console.log('→ This suggests the issue is not on initial navigation');
    console.log('→ The 404 may occur during user interaction (chat message send)');
  }
  
  await browser.close();
}

main().catch(console.error);
