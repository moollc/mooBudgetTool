var puppeteer = require('puppeteer');

(async function () {
  var browser = await puppeteer.launch({ headless: "new" });
  var page = await browser.newPage();

  page.on('console', function (msg) console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', function (error) console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', function (request) console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
      await page.goto('file:///C:/Users/Rocket/Desktop/AntiGravity/mBT/index.html', { waitUntil: 'networkidle0' });
      console.log("Page loaded successfully.");
      
      // Try to click stages
      await page.evaluate(function () {
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
