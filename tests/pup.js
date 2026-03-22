const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
      await page.goto('file:///C:/Users/Rocket/Desktop/AntiGravity/mBT/index.html', { waitUntil: 'networkidle0' });
      console.log("Page loaded successfully.");
      
      // Try to click stages
      await page.evaluate(() => {
          if (window.mBT && mBT.ui && mBT.ui.switchTab) {
              mBT.ui.switchTab('stages');
              console.log("Clicked stages programmatically.");
          } else {
              console.log("mBT or mBT.ui not fully loaded.");
          }
      });
      
  } catch (err) {
      console.error("Navigation Error:", err);
  } finally {
      await browser.close();
  }
})();
