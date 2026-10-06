import { chromium } from "playwright";
import { createServer } from "vite";
import fs from "node:fs/promises";
import path from "node:path";

const host = "127.0.0.1";
const port = 5173;
const url = `http://${host}:${port}`;
const outDir = path.resolve("screenshots");
const outFile = path.join(outDir, "player-map.png");

await fs.mkdir(outDir, { recursive: true });

let server = null;
let browser = null;

try {
  let serverAlreadyRunning = false;

  try {
    const res = await fetch(url);
    serverAlreadyRunning = res.ok;
  } catch {}

  if (!serverAlreadyRunning) {
    server = await createServer({
      server: {
        host,
        port,
        strictPort: true
      }
    });

    await server.listen();
  }

  browser = await chromium.launch({
    headless: true,
    channel: "chrome"
  });

  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.up("w");
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: outFile,
    fullPage: false
  });

  console.log(`Saved screenshot: ${outFile}`);
} finally {
  if (browser) {
    await browser.close();
  }

  if (server) {
    await server.close();
  }
}
