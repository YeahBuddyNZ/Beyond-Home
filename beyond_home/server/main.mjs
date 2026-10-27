// Beyond Home's server inside the Home Assistant app: serves the screens and talks to Home Assistant for them.
// Home Assistant's ingress signs people in, so only its gateway (172.30.32.2) may reach this server.
// No packages: Node's own http and fetch.

import { createServer } from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { refuse } from './allow.mjs';
import { ROOMS_TEMPLATE, buildSnapshot } from './snapshot.mjs';
import { cleanAddress, createMusic, musicPath } from './music.mjs';
import { approve, listTvs, phonePath, remove, startPairing, tvCalls, tvSnapshot, who } from './tvs.mjs';

const PORT = Number(process.env.PORT || 8099);
const WWW = process.env.WWW || '/app/www';
const HA = process.env.HA_URL || 'http://supervisor/core/api';
const TOKEN = process.env.SUPERVISOR_TOKEN || '';
const TV_PORT = Number(process.env.TV_PORT || 8098);
const DATA = process.env.DATA || '/data';
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

// Paired TVs, kept in the app's own folder on the box so they survive an update.
const STATE = join(DATA, 'tvs.json');
let state = { tvs: [], waiting: [] };
const loaded = readFile(STATE, 'utf8').then((t) => (state = { waiting: [], ...JSON.parse(t) }), () => {});
async function save() {
	await writeFile(STATE + '.new', JSON.stringify({ tvs: state.tvs }));
	await rename(STATE + '.new', STATE);
}

// Where the family's music is (server/music.mjs): an address typed in Settings, else found by itself.
const MUSIC = join(DATA, 'music.json');
let musicAt = '';
readFile(MUSIC, 'utf8').then((t) => (musicAt = JSON.parse(t).address || ''), () => {});
const music = createMusic({ saved: () => musicAt });

const send = (res, code, body, type = 'application/json', extra = {}) => {
	res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
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

// The app's own asks, the same from Home Assistant's ingress and from a paired phone on the house door: the rooms,
// service calls (every one checked by allow.mjs), and the music passed through. `extra` carries the door's headers.
// Answers true when it handled the ask.
async function appAsk(req, res, path, search, extra = {}) {
	if (path === '/api/snapshot' && req.method === 'GET') return (send(res, 200, await snapshot(), 'application/json', extra), true);
	if (path === '/api/act' && req.method === 'POST') {
		const calls = [].concat(JSON.parse(await readBody(req)));
		if (!calls.length || calls.length > 40) return (send(res, 400, { error: 'Nothing to do' }, 'application/json', extra), true);
		for (const c of calls) {
			const why = refuse(c);
			if (why) return (send(res, 400, { error: why }, 'application/json', extra), true);
		}
		for (const c of calls) await ha('/services/' + c.domain + '/' + c.service, { method: 'POST', body: JSON.stringify(c.data) });
		return (send(res, 200, { ok: true }, 'application/json', extra), true);
	}
	if (path.startsWith('/api/music/') && path !== '/api/music/where') {
		const target = musicPath(req.method, path, search);
		if (!target) return (send(res, 404, { error: 'Not found' }, 'application/json', extra), true);
		const out = await music.pass(req, res, target, req.method === 'POST' ? await readBody(req) : null, extra);
		if (out.missing) send(res, 503, { error: 'Your music isn’t answering. Is the Mac or box it lives on switched on?' }, 'application/json', extra);
		return true;
	}
	return false;
}

createServer(async (req, res) => {
	if (!INGRESS.has(req.socket.remoteAddress)) return send(res, 403, { error: 'Open Beyond Home from Home Assistant.' });
	const url = new URL(req.url, 'http://x');
	const path = url.pathname;
	try {
		if (await appAsk(req, res, path, url.search)) return;
		if (path === '/api/tvs' && req.method === 'GET') return (await loaded, send(res, 200, { tvs: listTvs(state) }));
		if (path === '/api/tvs/pair' && req.method === 'POST') {
			await loaded;
			const why = approve(state, JSON.parse(await readBody(req)).code);
			if (why) return send(res, 400, { error: why });
			await save();
			return send(res, 200, { tvs: listTvs(state) });
		}
		if (path === '/api/tvs/remove' && req.method === 'POST') {
			await loaded;
			if (remove(state, JSON.parse(await readBody(req)).id)) await save();
			return send(res, 200, { tvs: listTvs(state) });
		}
		if (path === '/api/music/where' && req.method === 'GET') return send(res, 200, { address: musicAt, found: Boolean(await music.find()) });
		if (path === '/api/music/where' && req.method === 'POST') {
			const address = cleanAddress(JSON.parse(await readBody(req)).address);
			if (address === null) return send(res, 400, { error: 'That doesn’t look like an address in the house, like 192.168.1.20.' });
			musicAt = address;
			await writeFile(MUSIC, JSON.stringify({ address }));
			music.forget();
			return send(res, 200, { address, found: Boolean(await music.find(true)) });
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

// The house door, for Beyond TV and the Beyond Home phone app. Only private addresses (a port forwarded from the
// internet gets nothing), no cookies (so any origin may ask: Beyond TV on LG and Samsung runs from a file, the phone
// app from its own), and a few asks a minute each.
const HOUSE = /^(::ffff:)?(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)|^(::1|fe80:|fc|fd)/i;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const asks = new Map();
function tooMany(key, max) {
	const now = Date.now();
	const list = (asks.get(key) || []).filter((t) => t > now - 60000);
	list.push(now);
	asks.set(key, list);
	if (asks.size > 500) for (const [k, v] of asks) if (v[v.length - 1] < now - 60000) asks.delete(k);
	return list.length > max;
}

createServer(async (req, res) => {
	const ip = req.socket.remoteAddress || '';
	const tv = (code, body) => send(res, code, body, 'application/json', CORS);
	if (!HOUSE.test(ip)) return tv(403, { error: 'Only inside the house' });
	if (req.method === 'OPTIONS') return tv(204, '');
	const url = new URL(req.url, 'http://x');
	const path = url.pathname;
	try {
		await loaded;
		// How a TV or phone looking round the house knows it has found Beyond Home.
		if (path === '/tv/hi' && req.method === 'GET') return tv(200, { beyond: 'home' });
		if (path === '/tv/hello' && req.method === 'POST') {
			if (tooMany('hello ' + ip, 6)) return tv(429, { error: 'Slow down a little' });
			const body = JSON.parse((await readBody(req)) || '{}');
			return tv(200, startPairing(state, body.name, Date.now(), body.kind));
		}
		// A song plays in pieces and a phone scrolls past dozens of covers, so those don't count against the limit.
		const media = /^\/phone\/music\/(play|cover)\//.test(path);
		if (!media && tooMany('tv ' + ip, 240)) return tv(429, { error: 'Slow down a little' });
		// An <audio> or <img> can't send a header, so a phone's songs and covers carry the key as ?k= instead.
		const me = who(state, req.headers.authorization || (media && req.method === 'GET' ? url.searchParams.get('k') : ''));
		if (!me) return tv(401, { error: 'Pair this again' });
		if (me.kind === 'waiting') return tv(202, { waiting: true, code: me.code });
		if (path.startsWith('/phone/')) {
			const as = me.kind === 'phone' ? phonePath(req.method, path) : null;
			if (!as) return tv(404, { error: 'Not found' });
			url.searchParams.delete('k');
			if (await appAsk(req, res, as, url.search, CORS)) return;
			return tv(404, { error: 'Not found' });
		}
		if (path === '/tv/snapshot' && req.method === 'GET') return tv(200, tvSnapshot(await snapshot()));
		if (path === '/tv/act' && req.method === 'POST') {
			const out = tvCalls(await snapshot(), JSON.parse(await readBody(req)));
			if (out.error) return tv(400, { error: out.error });
			for (const c of out.calls) await ha('/services/' + c.domain + '/' + c.service, { method: 'POST', body: JSON.stringify(c.data) });
			return tv(200, { ok: true });
		}
		if (path === '/tv/bye' && req.method === 'POST') {
			if (remove(state, me.tv.id)) await save();
			return tv(200, { ok: true });
		}
		return tv(404, { error: 'Not found' });
	} catch (e) {
		console.error('tv', path, e.message);
		return tv(e instanceof SyntaxError ? 400 : 502, { error: e instanceof SyntaxError ? 'Bad ask' : 'Home Assistant didn’t answer. Try again in a moment.' });
	}
}).listen(TV_PORT, () => console.log('Beyond Home for TVs on ' + TV_PORT));
