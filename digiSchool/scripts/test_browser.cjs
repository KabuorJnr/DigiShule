const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure() ? request.failure().errorText : ''));

  console.log('Navigating to http://localhost:5173/DigiShule/ ...');
  try {
    await page.goto('http://localhost:5173/DigiShule/', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (e) {
    console.log('Navigation finished with status:', e.message);
  }
  
  await new Promise(r => setTimeout(r, 2000));
  
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('BODY HTML LENGTH:', bodyHTML.length);
  if (bodyHTML.length < 500) {
    console.log('BODY HTML:', bodyHTML);
  }
  
  await browser.close();
})();
