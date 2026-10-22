// Beyond Home's server inside the Home Assistant app: serves the screens and talks to Home Assistant for them.
// Home Assistant's ingress signs people in, so only its gateway (172.30.32.2) may reach this server.
// No packages: Node's own http and fetch.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { refuse } from './allow.mjs';
import { ROOMS_TEMPLATE, buildSnapshot } from './snapshot.mjs';

const PORT = Number(process.env.PORT || 8099);
const WWW = process.env.WWW || '/app/www';
const HA = process.env.HA_URL || 'http://supervisor/core/api';
const TOKEN = process.env.SUPERVISOR_TOKEN || '';
const INGRESS = new Set(['172.30.32.2', '::ffff:172.30.32.2', '127.0.0.1', '::1', '::ffff:127.0.0.1']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };

async function ha(path, init = {}) {
	const res = await fetch(HA + path, { ...init, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });
	if (!res.ok) throw new Error('Home Assistant answered ' + res.status);
	return res;
}

async function snapshot() {
	const [areas, states] = await Promise.all([
		ha('/template', { method: 'POST', body: JSON.stringify({ template: ROOMS_TEMPLATE }) }).then((r) => r.text()).then(JSON.parse),
		ha('/states').then((r) => r.json())
	]);
	return { ...buildSnapshot(areas, states), time: Math.floor(Date.now() / 1000) };
}

const send = (res, code, body, type = 'application/json') => {
	res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
	res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function readBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const parts = [];
		req.on('data', (c) => {
			size += c.length;
			if (size > 16384) reject(new Error('too big'));
			else parts.push(c);
		});
		req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
		req.on('error', reject);
	});
}

createServer(async (req, res) => {
	if (!INGRESS.has(req.socket.remoteAddress)) return send(res, 403, { error: 'Open Beyond Home from Home Assistant.' });
	const path = new URL(req.url, 'http://x').pathname;
	try {
		if (path === '/api/snapshot' && req.method === 'GET') return send(res, 200, await snapshot());
		if (path === '/api/act' && req.method === 'POST') {
			const calls = [].concat(JSON.parse(await readBody(req)));
			if (!calls.length || calls.length > 40) return send(res, 400, { error: 'Nothing to do' });
			for (const c of calls) {
				const why = refuse(c);
				if (why) return send(res, 400, { error: why });
			}
			for (const c of calls) await ha('/services/' + c.domain + '/' + c.service, { method: 'POST', body: JSON.stringify(c.data) });
			return send(res, 200, { ok: true });
		}
		if (req.method !== 'GET') return send(res, 405, { error: 'No' });
		const file = normalize(join(WWW, path === '/' ? 'index.html' : path));
		if (!file.startsWith(WWW + '/')) return send(res, 404, { error: 'Not found' });
		const body = await readFile(file).catch(() => null);
		if (!body) return send(res, 404, { error: 'Not found' });
		return send(res, 200, body, TYPES[extname(file)] || 'application/octet-stream');
	} catch (e) {
		console.error(path, e.message);
		return send(res, 502, { error: 'Home Assistant didn’t answer. Try again in a moment.' });
	}
}).listen(PORT, () => console.log('Beyond Home on ' + PORT));
