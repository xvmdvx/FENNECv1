// Puppeteer script to automate the Texas SOS payment step.
const puppeteer = require("puppeteer");
const path = require("path");

async function run() {
    const htmlPath = path.join(__dirname, "../../..", "SOSREF", "TX_BF_LLC_1.html");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    console.log("Opening test page...");
    await page.goto("file://" + htmlPath);

    await page.waitForSelector("select[name='payment_type_id']");
    console.log("Selecting Client Account...");
    const value = await page.$eval("select[name='payment_type_id']", el => {
        const opt = Array.from(el.options).find(o => /client account/i.test(o.textContent));
        return opt ? opt.value : "5";
    });
    await page.select("select[name='payment_type_id']", value);
    await page.waitForTimeout(300);
    console.log("Clicking Continue...");
    const button = await page.$("input[type='submit'][value='Continue']");
    if (button) {
        await Promise.all([
            button.click(),
            page.waitForNavigation({ waitUntil: "load" }).catch(() => {}),
        ]);
        console.log("Step completed.");
    } else {
        console.log("Continue button not found.");
    }
    await browser.close();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
