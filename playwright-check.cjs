const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    let logs = [];
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        if (msg.type() === 'error') {
            logs.push(`[ERROR] ${msg.text()}`);
        } else {
            logs.push(`[${msg.type()}] ${msg.text()}`);
        }
    });

    page.on('pageerror', exception => {
        logs.push(`[PAGEERROR] ${exception}`);
    });

    try {
        await page.goto('https://azura-gastrosense.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
    } catch (e) {
        logs.push(`[NAVIGATION ERROR] ${e.message}`);
    }

    fs.writeFileSync('playwright-logs.txt', logs.join('\n'));
    await browser.close();
})();
