// Beyond Family, from the box (Beyond-Family docs/adr/0045). Off until somebody taps Link to Beyond Family in
// Settings: until then the box says nothing to the internet. Linking works like a TV's: the box says hello, keeps a
// secret, shows a code, and a grown-up types it in the Beyond Family app. Once linked the box sends the rooms as a TV
// sees them and waits for asks. An ask is a named thing (a moment, the volume, power, one thing on or off), never a
// service call: the box builds the calls itself with tvCalls, and every one passes allow.mjs.
// Node's own fetch, no packages. `opts` carries everything outside, so tests/family.test.mjs can run it.

import { readFile, rename, rm, writeFile } from 'node:fs/promises';

export const FAMILY_URL = 'https://beyondfamily.app/api';
const SNAPSHOT_EVERY = 5 * 60000;
const WAIT = 20;

// What the Settings card shows: never the secret.
export function familyStatus(s, now = Date.now()) {
	if (!s.id) return { state: 'off' };
	if (s.linked) return { state: 'linked', household: s.home?.name || '', people: (s.home?.people || []).length };
	if (s.code && s.codeUntil > now) return { state: 'waiting', code: s.code, minutes: Math.max(1, Math.ceil((s.codeUntil - now) / 60000)) };
	return { state: 'expired' };
}

// The family's people as the box may know them: first names, colours and who is a kid. Nothing else is kept.
export function cleanHome(h) {
	if (!h || typeof h !== 'object') return null;
	const people = (Array.isArray(h.people) ? h.people : []).slice(0, 30).map((p) => ({
		id: String(p?.id || '').slice(0, 40),
		name: String(p?.name || '').slice(0, 40),
		colour: String(p?.colour || '').slice(0, 20),
		kid: p?.kid === true
	}));
	return { name: String(h.name || '').slice(0, 60), people };
}

export function createFamily(opts) {
	const { file, snapshot, act, url = FAMILY_URL, fetchImpl = fetch, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = opts;
	let s = {};
	let running = false;
	let lastSnap = 0;
	const loaded = readFile(file, 'utf8').then(
		(t) => (s = JSON.parse(t)),
		() => {}
	);

	async function save() {
		const keep = { id: s.id, secret: s.secret, linked: !!s.linked, home: s.home || null };
		await writeFile(file + '.new', JSON.stringify(keep));
		await rename(file + '.new', file);
	}

	async function call(path, init = {}) {
		const headers = { 'Content-Type': 'application/json', ...(s.id ? { Authorization: 'Bearer ' + s.id + '.' + s.secret } : {}) };
		const res = await fetchImpl(url + path, { ...init, headers, signal: AbortSignal.timeout((WAIT + 10) * 1000) });
		const body = await res.json().catch(() => ({}));
		return { status: res.status, body };
	}

	async function forget() {
		s = {};
		await rm(file, { force: true });
	}

	async function sendSnapshot() {
		try {
			await call('/home-hub/snapshot', { method: 'POST', body: JSON.stringify(await snapshot()) });
			lastSnap = now();
		} catch (e) {
			log('snapshot', e.message);
		}
	}

	// One look: wait for asks, do them, say how each went. Answers false when the loop should stop.
	async function once() {
		const began = now();
		const { status, body } = await call('/home-hub/sync?wait=' + WAIT);
		if (status === 401) {
			// Unlinked in the app, or a reset: the secret is no good any more.
			await forget();
			return false;
		}
		if (status !== 200) throw new Error('Beyond Family answered ' + status);
		if (!body.linked) {
			if (s.linked) {
				s.linked = false;
				await save();
			}
			if (!body.waiting && !(s.codeUntil > now())) return false;
			await sleep(5000);
			return true;
		}
		const home = cleanHome(body.home);
		if (!s.linked || JSON.stringify(home) !== JSON.stringify(s.home)) {
			const first = !s.linked;
			s.linked = true;
			s.code = '';
			s.home = home;
			await save();
			if (first) lastSnap = 0;
		}
		let did = false;
		for (const ask of Array.isArray(body.asks) ? body.asks.slice(0, 10) : []) {
			let error;
			try {
				error = await act(ask);
			} catch (e) {
				error = 'Home Assistant didn’t answer.';
				log('ask', e.message);
			}
			did = true;
			await call('/home-hub/done', { method: 'POST', body: JSON.stringify({ id: ask.id, ...(error ? { error: String(error).slice(0, 200) } : {}) }) }).catch(() => {});
		}
		if (did || now() - lastSnap > SNAPSHOT_EVERY) await sendSnapshot();
		// Beyond Family holds a sync open while there is nothing to do. One that came straight back empty-handed
		// (a proxy cutting it short) waits a moment, so the box never asks in a tight loop.
		if (!did && now() - began < 1000) await sleep(2000);
		return true;
	}

	async function loop() {
		if (running) return;
		running = true;
		let wait = 5000;
		try {
			while (s.id) {
				try {
					if (!(await once())) break;
					wait = 5000;
				} catch (e) {
					// The internet at home is down, or Beyond Family is: try again, slower each time, up to five minutes.
					log('sync', e.message);
					await sleep(wait);
					wait = Math.min(wait * 2, 5 * 60000);
				}
			}
		} finally {
			running = false;
		}
	}

	return {
		loaded,
		status: () => familyStatus(s, now()),
		// Called once at start: a box already linked carries on by itself.
		async resume() {
			await loaded;
			if (s.id && s.linked) loop();
		},
		// Link to Beyond Family: a code for the app, then wait for it to be typed.
		async start() {
			await loaded;
			if (s.linked) return familyStatus(s, now());
			let out = s.id ? await call('/home-hub/code', { method: 'POST', body: '{}' }) : null;
			if (!out || out.status === 401) {
				s = {};
				out = await call('/home-hub/hello', { method: 'POST', body: '{}' });
				if (out.status !== 200 || !out.body.id) throw new Error('Beyond Family didn’t answer. Check the internet and try again.');
				s.id = out.body.id;
				s.secret = out.body.secret;
			}
			if (out.body.linked) s.linked = true;
			else {
				s.code = out.body.code;
				s.codeUntil = now() + (out.body.minutes || 10) * 60000;
			}
			await save();
			loop();
			return familyStatus(s, now());
		},
		// Unlink: tell Beyond Family (it can only switch the box off), then forget the secret either way.
		async stop() {
			await loaded;
			if (s.id) await call('/home-hub/bye', { method: 'POST', body: '{}' }).catch(() => {});
			await forget();
			return familyStatus(s, now());
		}
	};
}
