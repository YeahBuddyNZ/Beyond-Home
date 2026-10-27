// The house door: Beyond TV and the Beyond Home phone app pair with the box once by a code, typed in the app.
// A TV sees the rooms and asks for named things (a moment, the volume, one thing on or off): it never sends a service
// call of its own, the box builds every call and checks it with allow.mjs. A phone gets the app's own asks (the
// rooms, service calls checked by allow.mjs, the music), never the settings. Pure, so tests/tv.test.mjs runs it.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { refuse } from './allow.mjs';
import { MOMENTS, isAway, isOn, kindOf, momentCalls, momentsFor, muteCall, remoteTarget, roomSummary, sortRooms, thingName, toggleCall, volumeCall, volumeOf } from '../web/src/lib.js';

// No 0/O, 1/I/L or 5/S: read off a TV across the room and typed on a phone.
const LETTERS = 'ABCDEFGHJKMNPQRTUVWXYZ234678';
export const CODE_MINUTES = 10;
export const MAX_TVS = 12;
export const MAX_PHONES = 12;
const MAX_WAITING = 20;

export const hash = (s) => createHash('sha256').update(String(s)).digest('hex');

export function newCode(bytes = randomBytes(6)) {
	let out = '';
	for (const b of bytes) out += LETTERS[b % LETTERS.length];
	return out;
}

// Typed codes forgive spaces, dashes and lower case.
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const safeName = (s, kind) => String(s || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) || (kind === 'phone' ? 'Phone' : 'TV');
export const kindOfDevice = (k) => (k === 'phone' ? 'phone' : 'tv');

// A TV or phone asking to pair: it keeps the secret, the box keeps its hash and shows nothing but the code.
export function startPairing(state, name, now = Date.now(), kind = 'tv') {
	kind = kindOfDevice(kind);
	state.waiting = (state.waiting || []).filter((w) => w.expires > now).slice(-(MAX_WAITING - 1));
	const id = randomBytes(9).toString('base64url');
	const secret = randomBytes(32).toString('base64url');
	let code;
	do code = newCode();
	while (state.waiting.some((w) => w.code === code));
	state.waiting.push({ id, hash: hash(secret), code, name: safeName(name, kind), kind, expires: now + CODE_MINUTES * 60000 });
	return { id, secret, code, minutes: CODE_MINUTES };
}

// Somebody typed the TV's code in the Beyond Home app. Wrong, used and expired all answer the same.
export function approve(state, code, now = Date.now()) {
	const c = cleanCode(code);
	const i = (state.waiting || []).findIndex((w) => w.code === c && w.expires > now);
	if (i < 0) return 'That code didn’t work. Check the screen it’s on and try again.';
	const kind = kindOfDevice(state.waiting[i].kind);
	const same = (state.tvs || []).filter((t) => kindOfDevice(t.kind) === kind).length;
	if (kind === 'tv' && same >= MAX_TVS) return 'That’s as many TVs as one home can have. Remove one first.';
	if (kind === 'phone' && same >= MAX_PHONES) return 'That’s as many phones as one home can have. Remove one first.';
	const [w] = state.waiting.splice(i, 1);
	state.tvs = (state.tvs || []).concat({ id: w.id, hash: w.hash, name: w.name, kind, added: now });
	return null;
}

export function remove(state, id) {
	const before = (state.tvs || []).length;
	state.tvs = (state.tvs || []).filter((t) => t.id !== id);
	state.waiting = (state.waiting || []).filter((w) => w.id !== id);
	return state.tvs.length !== before;
}

// "Bearer <id>.<secret>" (or the same "<id>.<secret>" alone, for a song or a cover a phone's player asks for):
// 'tv' or 'phone' when paired, 'waiting' while its code is still on screen, null otherwise.
export function who(state, header, now = Date.now()) {
	const m = /^(?:Bearer )?([A-Za-z0-9_-]{6,40})\.([A-Za-z0-9_-]{20,80})$/.exec(String(header || ''));
	if (!m) return null;
	const want = Buffer.from(hash(m[2]));
	const same = (h) => h && h.length === want.length && timingSafeEqual(Buffer.from(h), want);
	const tv = (state.tvs || []).find((t) => t.id === m[1]);
	if (tv) return same(tv.hash) ? { kind: kindOfDevice(tv.kind), tv } : null;
	const w = (state.waiting || []).find((x) => x.id === m[1] && x.expires > now);
	return w && same(w.hash) ? { kind: 'waiting', code: w.code } : null;
}

// What the app lists: names, TV or phone, and when, never the hash.
export const listTvs = (state) => (state.tvs || []).map((t) => ({ id: t.id, name: t.name, kind: kindOfDevice(t.kind), added: t.added }));

// What a phone may ask on the house door, as the ingress path it stands for: the app's own asks, never its settings
// (pairing, the music's address), which stay behind Home Assistant's sign-in.
export function phonePath(method, path) {
	const p = String(path || '');
	if (!p.startsWith('/phone/')) return null;
	const rest = p.slice('/phone'.length);
	if (method === 'GET' && rest === '/snapshot') return '/api/snapshot';
	if (method === 'POST' && rest === '/act') return '/api/act';
	if (rest.startsWith('/music/') && rest !== '/music/where') return '/api' + rest;
	return null;
}

const thingOut = (t, room) => ({ id: t.entity_id, name: thingName(t, room.name), kind: kindOf(t), on: isOn(t), away: isAway(t) });

// The rooms as a TV draws them: a line each, the moments that fit, the remote and what can be switched.
export function tvSnapshot(snap) {
	return {
		rooms: sortRooms(snap.rooms || []).map((room) => {
			const target = remoteTarget(room);
			return {
				id: room.id,
				name: room.name,
				line: roomSummary(room),
				moments: momentsFor(room).map((m) => ({ id: m.id, name: m.name, lead: m.lead })),
				remote: target ? { name: thingName(target, room.name), kind: kindOf(target), on: isOn(target), volume: volumeOf(target), muted: !!(target.attributes || {}).is_volume_muted } : null,
				things: (room.things || []).filter((t) => kindOf(t) !== 'other').map((t) => thingOut(t, room))
			};
		}),
		time: snap.time
	};
}

const DOES = ['moment', 'volume_up', 'volume_down', 'mute', 'power', 'toggle'];

// A TV's ask ({ room, do, moment?, thing?, beat? }) into service calls, or { error }. Every call passes allow.mjs.
export function tvCalls(snap, ask) {
	if (!ask || typeof ask !== 'object' || !DOES.includes(ask.do)) return { error: 'Not something a TV asks' };
	const room = (snap.rooms || []).find((r) => r.id === ask.room);
	if (!room) return { error: 'That room has gone' };
	let calls = [];
	if (ask.do === 'moment') {
		if (!MOMENTS.some((m) => m.id === ask.moment)) return { error: 'No such moment' };
		calls = momentCalls(ask.moment, room, ask.beat);
	} else if (ask.do === 'toggle') {
		const t = (room.things || []).find((x) => x.entity_id === ask.thing);
		if (!t || isAway(t) || kindOf(t) === 'other') return { error: 'That isn’t in this room' };
		calls = [toggleCall(t)];
	} else {
		const target = remoteTarget(room);
		if (!target) return { error: 'Nothing to turn up in this room' };
		if (ask.do === 'volume_up' || ask.do === 'volume_down') calls = [volumeCall(target, ask.do === 'volume_up')];
		else if (ask.do === 'mute') calls = [muteCall(target)];
		else calls = [toggleCall(target)];
	}
	if (!calls.length) return { error: 'Nothing to do' };
	for (const c of calls) {
		const why = refuse(c);
		if (why) return { error: why };
	}
	return { calls };
}
