// The Music tab's way to the family's music: the Beyond Music server (YeahBuddyNZ/Beyond-Music) on a Mac, a Pi or
// this same box. The screens ask Beyond Home, and Beyond Home asks the music server, because a page Home Assistant
// serves over https can't fetch an http box itself. Its own short list of paths, kept apart from allow.mjs, which is
// Home Assistant service calls only.

import { Readable } from 'node:stream';

const ID = /^[a-f0-9]{12}$/;

// The paths the Music tab may ask for, and what each becomes on the music server. Anything else is refused.
export function musicPath(method, path, query = '') {
	const p = path.replace(/^\/api\/music/, '');
	if (method === 'GET') {
		if (p === '/hello' || p === '/library' || p === '/radio') return '/api' + p;
		if (p === '/search') {
			const q = new URLSearchParams(query).get('q') || '';
			return q.length <= 100 ? '/api/search?q=' + encodeURIComponent(q) : null;
		}
		const m = /^\/(play|cover)\/([^/]+)$/.exec(p);
		if (m && ID.test(m[2])) return `/api/${m[1]}/${m[2]}`;
	}
	if (method === 'POST' && p === '/played') return '/api/played';
	return null;
}

// Only addresses inside the house: a typed address can't send Beyond Home off to the internet.
const PRIVATE = /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01])|127\.\d+)\.\d+\.\d+$/;
export function cleanAddress(text) {
	let s = String(text || '').trim();
	if (!s) return '';
	if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
	let u;
	try {
		u = new URL(s);
	} catch {
		return null;
	}
	const h = u.hostname.toLowerCase();
	if (!(PRIVATE.test(h) || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home.arpa') || h === 'localhost')) return null;
	return `${u.protocol}//${u.hostname}:${u.port || '8097'}`;
}

// Where to look, best first: the address typed in Settings, then the Home Assistant box itself (the Beyond Music
// app runs on the host network, which an app sees at 172.30.32.1), then this machine, then the name it answers to.
export function candidates(saved) {
	return [saved, 'http://172.30.32.1:8097', 'http://127.0.0.1:8097', 'http://beyond-music.local:8097'].filter(Boolean);
}

export function createMusic({ saved = () => '', fetcher = fetch } = {}) {
	let found = null; // { base, at }
	async function hello(base) {
		try {
			const res = await fetcher(base + '/api/hello', { signal: AbortSignal.timeout(2500) });
			const body = res.ok ? await res.json() : null;
			return body?.app === 'beyond-music' ? body : null;
		} catch {
			return null;
		}
	}
	async function find(fresh = false) {
		if (!fresh && found && Date.now() - found.at < 5 * 60000) return found.base;
		for (const base of candidates(saved())) {
			if (await hello(base)) {
				found = { base, at: Date.now() };
				return base;
			}
		}
		found = null;
		return null;
	}
	return {
		find,
		forget: () => (found = null),
		// Passes one ask through, streaming the answer back (songs come in pieces, so Range goes both ways).
		async pass(req, res, target, body) {
			const base = await find();
			if (!base) return { missing: true };
			const headers = {};
			if (req.headers.range) headers.Range = req.headers.range;
			if (body != null) headers['Content-Type'] = 'application/json';
			const answer = await fetcher(base + target, { method: req.method, headers, body: body ?? undefined, signal: AbortSignal.timeout(target.startsWith('/api/play/') ? 6 * 3600000 : 15000) }).catch(() => null);
			if (!answer) {
				found = null;
				return { missing: true };
			}
			const out = { 'Cache-Control': target.startsWith('/api/cover/') ? 'private, max-age=86400' : 'no-store', 'X-Content-Type-Options': 'nosniff' };
			for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
				const v = answer.headers.get(k);
				if (v) out[k] = v;
			}
			res.writeHead(answer.status, out);
			if (!answer.body) {
				res.end();
				return {};
			}
			Readable.fromWeb(answer.body).on('error', () => res.destroy()).pipe(res);
			req.on('close', () => answer.body.cancel().catch(() => {}));
			return {};
		},
	};
}
