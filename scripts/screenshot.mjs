import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const url = process.env.GAME_URL || "http://127.0.0.1:5173";
const outDir = path.resolve("screenshots");
const outFile = path.join(outDir, "player-map.png");

await fs.mkdir(outDir, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(target, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(target);
      if (res.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${target}`);
}

let vite = null;

try {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("not ready");
  } catch {
    const command = process.platform === "win32"
      ? ["cmd.exe", ["/d", "/s", "/c", "npm run dev -- --host 127.0.0.1"]]
      : ["npm", ["run", "dev", "--", "--host", "127.0.0.1"]];

    vite = spawn(command[0], command[1], {
      stdio: "inherit",
      shell: false
    });
    await waitForServer(url);
  }

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome"
  });

  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // Nudge the player forward so the screenshot shows the map in motion.
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.up("w");
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: outFile,
    fullPage: false
  });

  await browser.close();
  console.log(`Saved screenshot: ${outFile}`);
} finally {
  if (vite) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(vite.pid), "/t", "/f"], {
        stdio: "ignore",
        shell: false
      });
    } else {
      vite.kill("SIGTERM");
    }
  }
}
