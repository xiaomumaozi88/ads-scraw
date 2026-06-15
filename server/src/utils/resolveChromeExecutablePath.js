import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * 解析本机可执行的 Chrome/Chromium 路径（与 NODE_ENV、是否生产无关，按实际安装位置解析）。
 * 优先级：PUPPETEER_EXECUTABLE_PATH / CHROME_PATH → 常见安装路径 → Puppeteer 自带的 Chromium。
 * 若均不可用则返回 undefined，由 Puppeteer 使用其默认（通常为已下载的 Chromium）。
 */
export function resolveChromeExecutablePath() {
    const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
    if (fromEnv && fs.existsSync(fromEnv)) {
        return fromEnv;
    }

    const candidates = [];
    if (process.platform === 'darwin') {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
        );
    } else if (process.platform === 'linux') {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        );
    } else if (process.platform === 'win32') {
        candidates.push(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        );
    }

    for (const p of candidates) {
        try {
            if (p && fs.existsSync(p)) return p;
        } catch {
            // ignore
        }
    }

    try {
        const puppeteer = require('puppeteer');
        if (typeof puppeteer.executablePath === 'function') {
            const bundled = puppeteer.executablePath();
            if (bundled && fs.existsSync(bundled)) return bundled;
        }
    } catch {
        // ignore
    }

    return undefined;
}
