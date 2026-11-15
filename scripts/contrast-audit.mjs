#!/usr/bin/env node
/**
 * Browser-based colour contrast audit. For every theme in light and dark mode it loads the app in
 * headless Chrome, walks every visible piece of text, works out the opaque colour behind it and
 * checks WCAG 2.x AA (4.5:1, or 3:1 for large text). It also fails any text that sits directly on the
 * page background or the animated 3D backdrop instead of on an opaque surface.
 *
 *   yarn dev            # in one terminal
 *   node scripts/contrast-audit.mjs
 *
 * Environment: BASE_URL (default http://localhost:3000), CHROME_PATH.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THEMES = ['cosmos', 'forest', 'ocean', 'sunset', 'classic', 'arctic', 'cyber', 'sakura', 'desert', 'candy'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9400 + Math.floor(Math.random() * 400);

const chrome = spawn(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'audit-'))}`, 'about:blank'], { stdio: 'ignore' });
let ws;
try {
    let targets;
    for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch(`http://localhost:${PORT}/json`)).json(); } catch { await sleep(500); } }
    ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const pending = {};
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) pending[d.id](d); };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });

    const CHECK = `(() => {
      const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
      const backdrop = (el) => { // returns an opaque colour, or null when the text sits on the page/gradient
        const layers = [];
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
          const c = parse(cs.backgroundColor);
          if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; }
        }
        let base = layers.pop(); if (!base || base.a < 0.999) return null;
        while (layers.length) base = over(layers.pop(), base);
        return base;
      };
      const out = { checked: 0, fails: [], onBackdrop: [] };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.nodeValue.trim()) continue;
        const el = n.parentElement;
        if (!el || seen.has(el)) continue;
        seen.add(el);
        if (el.closest('.sr-only, [hidden], script, style, noscript, canvas, [aria-hidden="true"]')) continue;
        if (el.closest(':disabled, [aria-disabled="true"], [inert]')) continue; // inactive controls are exempt
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        let opacity = 1; for (let e = el; e; e = e.parentElement) opacity *= parseFloat(getComputedStyle(e).opacity);
        const fg = parse(cs.color); const bg = backdrop(el);
        const label = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' "' + n.nodeValue.trim().slice(0, 28) + '"';
        out.checked++;
        if (!bg) { out.onBackdrop.push(label); continue; }
        const eff = over({ ...fg, a: fg.a * opacity }, bg);
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
        const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
        const got = ratio(eff, bg);
        if (got < need) out.fails.push(label + ' ' + got.toFixed(2) + ' < ' + need);
      }
      return JSON.stringify(out);
    })()`;

    const pages = [['/', 'play'], ['/', 'book'], ['/privacy', 'privacy'], ['/accessibility', 'accessibility']];
    let problems = 0, total = 0;
    for (const theme of THEMES) for (const mode of ['light', 'dark']) {
        await send('Page.navigate', { url: BASE });
        await sleep(2500);
        await ev(`localStorage.setItem('sudoku-theme','${theme}');localStorage.setItem('sudoku-mode','${mode}');localStorage.setItem('sudoku-effects','on');localStorage.removeItem('sudoku-consent')`);
        for (const [path, view] of pages) {
            await send('Page.navigate', { url: BASE + path });
            await sleep(3500);
            if (view === 'book') await ev(`[...document.querySelectorAll('[role=tab]')].find((t) => t.textContent.includes('book'))?.click()`);
            if (path === '/') await ev(`document.querySelectorAll('details').forEach((d) => (d.open = true))`);
            await sleep(500);
            const r = JSON.parse(await ev(CHECK));
            total += r.checked;
            const bad = [...r.fails, ...r.onBackdrop.map((x) => 'ON BACKDROP ' + x)];
            problems += bad.length;
            if (bad.length) console.log(`✗ ${theme}/${mode} ${view}: ${bad.slice(0, 6).join(' | ')}`);
        }
        console.log(`✓ ${theme}/${mode}`);
    }
    console.log(`\nChecked ${total} text elements across ${THEMES.length * 2} theme/mode combinations. Problems: ${problems}`);
    process.exitCode = problems ? 1 : 0;
} finally {
    chrome.kill();
    ws?.close();
}
