// html/*.html 시안을 360px·1280px 폭 전체 화면 PNG로 찍는다.
// 실행: node build.mjs && node shoot.mjs  (Chrome 또는 Edge 필요. CHROME_PATH로 바꿀 수 있다)
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const htmlDir = join(here, '..', 'html');
const outDir = join(here, '..');
const WIDTHS = [1280, 360];
const PORT = 9333;

const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
].filter(Boolean);
const chromePath = candidates.find((p) => existsSync(p));
if (!chromePath) throw new Error('Chrome/Edge를 찾지 못했어요. CHROME_PATH를 지정해 주세요.');

const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ubb-shoot-'))}`,
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    'about:blank',
]);

async function waitForTarget() {
    for (let i = 0; i < 50; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const pageTarget = list.find((t) => t.type === 'page');
            if (pageTarget) return pageTarget.webSocketDebuggerUrl;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('Chrome 디버깅 연결 실패');
}

const ws = new WebSocket(await waitForTarget());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
});
const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
        ws.send(JSON.stringify({ id, method, params }));
    });
const once = (method) => new Promise((r) => listeners.push((m) => m.method === method && r(m)));

await send('Page.enable');
await send('Runtime.enable');
const pages = JSON.parse(readFileSync(join(htmlDir, 'pages.json'), 'utf8'));
for (const p of pages) {
    for (const width of WIDTHS) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        const loaded = once('Page.loadEventFired');
        await send('Page.navigate', { url: pathToFileURL(join(htmlDir, `${p.file}.html`)).href });
        await loaded;
        await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true });
        const { result } = await send('Runtime.evaluate', { expression: 'Math.ceil(document.documentElement.scrollHeight)' });
        const height = Math.max(result.value, 640);
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const name = `${p.file}-${width}.png`;
        writeFileSync(join(outDir, name), Buffer.from(shot.data, 'base64'));
        console.log(`${name} (${width}x${height})`);
    }
}
ws.close();
chrome.kill();
