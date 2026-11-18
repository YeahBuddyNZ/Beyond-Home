// Apple Home, from the box (ADR 0004). Off until somebody taps Show in Apple Home in Settings. Then Home Assistant's
// own HomeKit Bridge shows the things in the family's rooms in Apple Home (an iPhone, an iPad, an Apple Watch, a
// HomePod or an Apple HomeView on the wall), and each room's moments appear as buttons there too, so "Hey Siri, Lounge
// Movie night" works. A moment pressed in Apple Home comes back to the box, which builds the calls itself with
// momentCalls and checks every one with allow.mjs, exactly like a tap in the app.
// Node's own fetch and WebSocket, no packages. `opts` carries everything outside, so tests/apple.test.mjs can run it.

import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { refuse } from './allow.mjs';
import { momentCalls, momentsFor, sortRooms } from '../web/src/lib.js';

// What Apple Home is offered: the kinds of things Beyond Home already shows, and the moment buttons.
export const APPLE_DOMAINS = ['light', 'switch', 'fan', 'cover', 'climate', 'media_player', 'input_button'];
export const BUTTON_PREFIX = 'beyond_';
const MAX_BUTTONS = 60;

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

// One button per room and moment that fits it: "Lounge Movie night", "Kitchen Morning".
export function buttonsFor(snap) {
	const out = [];
	for (const room of sortRooms((snap && snap.rooms) || [])) {
		if (room.id === '_elsewhere') continue;
		for (const m of momentsFor(room)) {
			const id = BUTTON_PREFIX + slug(room.id) + '_' + m.id;
			out.push({ id, entity_id: 'input_button.' + id, room: room.id, moment: m.id, name: (room.name + ' ' + m.name).slice(0, 60) });
		}
	}
	return out.slice(0, MAX_BUTTONS);
}

// Everything Apple Home is allowed to see: the things in rooms, never the ones nobody has put in a room, and our buttons.
export function entitiesFor(snap, buttons) {
	const ids = [];
	for (const room of (snap && snap.rooms) || []) {
		if (room.id === '_elsewhere') continue;
		for (const t of room.things || []) if (APPLE_DOMAINS.includes(t.entity_id.split('.')[0])) ids.push(t.entity_id);
	}
	return [...new Set(ids.concat(buttons.map((b) => b.entity_id)))];
}

// Answers one step of Home Assistant's HomeKit set-up, whatever its version asks, from the fields the form names:
// a bridge, only these kinds of things, only these things. A field we don't know keeps Home Assistant's own default.
export function flowAnswer(step, plan) {
	const out = {};
	for (const f of Array.isArray(step.data_schema) ? step.data_schema : []) {
		const n = f && f.name;
		if (n === 'include_domains' || n === 'domains') out[n] = plan.domains;
		else if (n === 'mode') out[n] = 'bridge';
		else if (n === 'include_exclude_mode') out[n] = 'include';
		else if (n === 'entities' || n === 'include_entities') out[n] = plan.entities;
		else if (n === 'devices') out[n] = [];
	}
	return out;
}

// HomeKit's pairing note in Home Assistant: the eight digit code, and where its QR code is drawn.
export function pairingFrom(notes, entryId) {
	for (const n of Object.values(notes || {})) {
		const text = String((n && n.message) || '');
		const id = String((n && n.notification_id) || '');
		if (entryId && !id.includes(entryId) && !text.includes(entryId)) continue;
		const code = text.match(/\b\d{3}-\d{2}-\d{3}\b/);
		if (!code) continue;
		const qr = text.match(/\/api\/homekit\/pairingqr\?[A-Za-z0-9_\-.]+/);
		return { code: code[0], qr: qr ? qr[0] : null };
	}
	return null;
}

export function appleStatus(s, pairing) {
	if (!s.entry) return { state: 'off' };
	if (pairing) return { state: 'pairing', code: pairing.code, qr: Boolean(pairing.qr), buttons: (s.buttons || []).length };
	return { state: 'on', buttons: (s.buttons || []).length };
}

// A small client for Home Assistant's websocket: sign in, ask, and listen.
export function haSocket(url, token, Socket = globalThis.WebSocket) {
	return new Promise((resolve, reject) => {
		const ws = new Socket(url);
		let next = 1;
		const waiting = new Map();
		const listeners = new Map();
		const fail = (e) => {
			for (const w of waiting.values()) w.reject(e);
			waiting.clear();
			reject(e);
		};
		ws.onerror = () => fail(new Error('Home Assistant didn’t answer'));
		ws.onclose = () => {
			fail(new Error('Home Assistant closed the line'));
			api.closed = true;
			if (api.onclose) api.onclose();
		};
		const api = {
			closed: false,
			onclose: null,
			ask(type, extra = {}) {
				const id = next++;
				ws.send(JSON.stringify({ id, type, ...extra }));
				return new Promise((res, rej) => waiting.set(id, { resolve: res, reject: rej }));
			},
			async listen(type, extra, fn) {
				const id = next++;
				listeners.set(id, fn);
				ws.send(JSON.stringify({ id, type, ...extra }));
				return id;
			},
			close: () => ws.close()
		};
		ws.onmessage = (ev) => {
			let m;
			try {
				m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
			} catch {
				return;
			}
			if (m.type === 'auth_required') ws.send(JSON.stringify({ type: 'auth', access_token: token }));
			else if (m.type === 'auth_ok') resolve(api);
			else if (m.type === 'auth_invalid') fail(new Error('Home Assistant said no'));
			else if (m.type === 'result' && waiting.has(m.id)) {
				const w = waiting.get(m.id);
				waiting.delete(m.id);
				if (m.success) w.resolve(m.result);
				else w.reject(new Error((m.error && m.error.message) || 'Home Assistant said no'));
			} else if (m.type === 'event' && listeners.has(m.id)) listeners.get(m.id)(m.event);
		};
	});
}

export function createApple(opts) {
	const { file, rest, socket, snapshot, run, log = () => {} } = opts;
	let s = {};
	let line = null;
	let notes = {};
	const loaded = readFile(file, 'utf8').then(
		(t) => (s = JSON.parse(t)),
		() => {}
	);

	async function save() {
		await writeFile(file + '.new', JSON.stringify({ entry: s.entry || null, buttons: s.buttons || [] }));
		await rename(file + '.new', file);
	}

	// One line to Home Assistant while Apple Home is on: it hears the moment buttons and the pairing note.
	async function open() {
		if (line && !line.closed) return line;
		line = await socket();
		line.onclose = () => {
			line = null;
			if (s.entry) setTimeout(() => open().catch((e) => log('line', e.message)), 30000);
		};
		await line.listen('persistent_notification/subscribe', {}, (ev) => {
			if (!ev) return;
			if (ev.type === 'current' || ev.type === 'added' || ev.type === 'updated') Object.assign(notes, ev.notifications || {});
			if (ev.type === 'removed') for (const k of Object.keys(ev.notifications || {})) delete notes[k];
		});
		await line.listen('subscribe_events', { event_type: 'state_changed' }, (ev) => {
			const id = ev && ev.data && ev.data.entity_id;
			if (!id || !id.startsWith('input_button.' + BUTTON_PREFIX) || !ev.data.new_state || !ev.data.old_state) return;
			if (ev.data.new_state.state === ev.data.old_state.state) return;
			press(id).catch((e) => log('moment', e.message));
		});
		return line;
	}

	// A moment pressed in Apple Home or by Siri: the box builds the calls from the room as it is now.
	async function press(entityId) {
		const b = (s.buttons || []).find((x) => x.entity_id === entityId);
		if (!b) return;
		const room = ((await snapshot()).rooms || []).find((r) => r.id === b.room);
		if (!room) return;
		const calls = momentCalls(b.moment, room, 0);
		for (const c of calls) if (refuse(c)) throw new Error('refused ' + c.domain + '.' + c.service);
		await run(calls);
	}

	// Make the buttons match the rooms: add what's new, rename, and take away what no longer fits.
	async function syncButtons(snap) {
		const want = buttonsFor(snap);
		const have = new Map((await line.ask('input_button/list')).map((b) => [b.id, b]));
		for (const b of want) {
			if (!have.has(b.id)) await line.ask('input_button/create', { name: b.id, icon: 'mdi:home-heart' });
			const now = have.get(b.id);
			if (!now || now.name !== b.name) await line.ask('input_button/update', { input_button_id: b.id, name: b.name, icon: 'mdi:home-heart' });
		}
		for (const id of have.keys()) if (id.startsWith(BUTTON_PREFIX) && !want.some((b) => b.id === id)) await line.ask('input_button/delete', { input_button_id: id });
		s.buttons = want;
		return want;
	}

	// Walk Home Assistant's set-up or options form to the end, answering each step from the plan.
	async function walk(start, path, plan) {
		let step = start;
		for (let i = 0; i < 6 && step && step.type === 'form'; i++) {
			step = await (await rest(path + '/' + step.flow_id, { method: 'POST', body: JSON.stringify(flowAnswer(step, plan)) })).json();
		}
		return step;
	}

	async function show() {
		const snap = await snapshot();
		const buttons = await syncButtons(snap);
		const plan = { domains: APPLE_DOMAINS, entities: entitiesFor(snap, buttons) };
		return { snap, plan };
	}

	return {
		loaded,
		async status() {
			await loaded;
			if (s.entry) await open().catch((e) => log('line', e.message));
			return appleStatus(s, s.entry ? pairingFrom(notes, s.entry) : null);
		},
		// Called once at start: keep listening for moments if Apple Home is on.
		async resume() {
			await loaded;
			if (s.entry) open().catch((e) => log('line', e.message));
		},
		// Show in Apple Home: the buttons, then a HomeKit bridge with only the family's rooms in it.
		async start() {
			await loaded;
			await open();
			const { plan } = await show();
			if (!s.entry) {
				const begun = await (await rest('/config/config_entries/flow', { method: 'POST', body: JSON.stringify({ handler: 'homekit', show_advanced_options: false }) })).json();
				const done = await walk(begun, '/config/config_entries/flow', plan);
				if (!done || done.type !== 'create_entry' || !done.result) throw new Error('Home Assistant wouldn’t set up Apple Home: ' + ((done && done.reason) || 'no answer'));
				s.entry = done.result.entry_id || done.result;
			}
			// Narrow it to just the family's rooms. If this version's form doesn't take that, the kinds above still hold.
			try {
				const opts = await (await rest('/config/config_entries/options/flow', { method: 'POST', body: JSON.stringify({ handler: s.entry, show_advanced_options: false }) })).json();
				await walk(opts, '/config/config_entries/options/flow', plan);
			} catch (e) {
				log('options', e.message);
			}
			await save();
			await new Promise((r) => setTimeout(r, 1500));
			return appleStatus(s, pairingFrom(notes, s.entry));
		},
		// Rooms or moments changed: bring Apple Home up to date.
		async refresh() {
			await loaded;
			if (!s.entry) return appleStatus(s, null);
			await open();
			const { plan } = await show();
			const opts = await (await rest('/config/config_entries/options/flow', { method: 'POST', body: JSON.stringify({ handler: s.entry, show_advanced_options: false }) })).json();
			await walk(opts, '/config/config_entries/options/flow', plan);
			await save();
			return appleStatus(s, pairingFrom(notes, s.entry));
		},
		// The QR code to scan with an iPhone's camera, straight from Home Assistant.
		async qr() {
			const p = s.entry ? pairingFrom(notes, s.entry) : null;
			if (!p || !p.qr) return null;
			return rest(p.qr.replace(/^\/api/, ''), {});
		},
		// Take it out of Apple Home: only the bridge and buttons this box made, nothing else in Home Assistant.
		async stop() {
			await loaded;
			if (s.entry) await rest('/config/config_entries/entry/' + encodeURIComponent(s.entry), { method: 'DELETE' }).catch((e) => log('stop', e.message));
			if (line && !line.closed) {
				for (const b of s.buttons || []) await line.ask('input_button/delete', { input_button_id: b.id }).catch(() => {});
			}
			s = {};
			await rm(file, { force: true });
			if (line) line.close();
			return { state: 'off' };
		}
	};
}
