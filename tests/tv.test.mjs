// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approve, cleanCode, hash, newCode, remove, startPairing, tvCalls, tvSnapshot, who } from '../beyond_home/server/tvs.mjs';
import { buildSnapshot } from '../beyond_home/server/snapshot.mjs';

const t = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const states = [
	t('media_player.lounge_tv', 'on', { friendly_name: 'Lounge TV', device_class: 'tv', app_name: 'Netflix', media_title: 'What we watch' }),
	t('media_player.lounge_amp', 'on', { friendly_name: 'Lounge Yamaha RX-V6A', volume_level: 0.32, source_list: ['TV (ARC)'] }),
	t('light.lounge_lamp', 'on', { friendly_name: 'Lounge Lamp', brightness: 128 }),
	t('lock.front', 'locked'),
	t('light.bed', 'off', { friendly_name: 'Bedroom light' })
];
const areas = [
	{ id: 'bedroom', name: 'Bedroom', entities: ['light.bed'] },
	{ id: 'lounge', name: 'Lounge', entities: ['media_player.lounge_tv', 'media_player.lounge_amp', 'light.lounge_lamp', 'lock.front'] }
];
const snap = { ...buildSnapshot(areas, states), time: 1 };

test('codes are easy to read off a TV, and typed ones forgive spaces', () => {
	for (let i = 0; i < 200; i++) assert.match(newCode(), /^[A-HJKMNP-RT-Z2-4678]{6}$/);
	assert.equal(cleanCode(' abc-d e2 '), 'ABCDE2');
});

test('a TV pairs once with its code, and only the hash stays on the box', () => {
	const state = { tvs: [], waiting: [] };
	const p = startPairing(state, 'Lounge TV', 1000);
	assert.equal(JSON.stringify(state).includes(p.secret), false);
	assert.equal(state.waiting[0].hash, hash(p.secret));
	const bearer = 'Bearer ' + p.id + '.' + p.secret;
	assert.deepEqual(who(state, bearer, 2000), { kind: 'waiting', code: p.code });
	assert.ok(approve(state, 'WRONG1', 2000));
	assert.ok(approve(state, p.code, 1000 + 11 * 60000), 'an expired code does nothing');
	assert.equal(approve(state, p.code.toLowerCase(), 2000), null);
	assert.ok(approve(state, p.code, 2000), 'a code works once');
	assert.equal(who(state, bearer, 3000).kind, 'tv');
	assert.equal(who(state, 'Bearer ' + p.id + '.' + 'x'.repeat(43), 3000), null);
	assert.equal(who(state, 'Bearer nope', 3000), null);
	assert.equal(remove(state, p.id), true);
	assert.equal(who(state, bearer, 3000), null);
});

test('the TV sees rooms in plain words and never the show or anything not on the screens', () => {
	const out = tvSnapshot(snap);
	assert.deepEqual(out.rooms.map((r) => r.name), ['Lounge', 'Bedroom']);
	const lounge = out.rooms[0];
	assert.equal(lounge.line, 'TV on (Netflix), volume 32, 1 light on');
	assert.deepEqual(lounge.moments.map((m) => m.id), ['movie', 'morning', 'bedtime', 'off', 'party']);
	assert.equal(lounge.remote.kind, 'receiver');
	assert.equal(lounge.remote.volume, 32);
	const json = JSON.stringify(out);
	assert.doesNotMatch(json, /What we watch|lock\.front|source_list/);
});

test('a TV asks for named things and the box builds the calls, all through the allow list', () => {
	assert.equal(tvCalls(snap, { room: 'lounge', do: 'volume_up' }).calls[0].data.entity_id, 'media_player.lounge_amp');
	assert.ok(tvCalls(snap, { room: 'lounge', do: 'moment', moment: 'movie' }).calls.length >= 3);
	assert.equal(tvCalls(snap, { room: 'lounge', do: 'moment', moment: 'party', beat: 3 }).calls[0].data.brightness_pct, 100);
	assert.equal(tvCalls(snap, { room: 'lounge', do: 'moment', moment: 'party-over' }).calls[0].data.brightness_pct, 80);
	assert.equal(tvCalls(snap, { room: 'bedroom', do: 'toggle', thing: 'light.bed' }).calls[0].service, 'turn_on');
	assert.ok(tvCalls(snap, { room: 'bedroom', do: 'toggle', thing: 'light.lounge_lamp' }).error, 'only things in that room');
	assert.ok(tvCalls(snap, { room: 'lounge', do: 'toggle', thing: 'lock.front' }).error);
	assert.ok(tvCalls(snap, { room: 'lounge', do: 'unlock' }).error);
	assert.ok(tvCalls(snap, { room: 'garage', do: 'mute' }).error);
	assert.ok(tvCalls(snap, { room: 'bedroom', do: 'volume_up' }).error);
	assert.ok(tvCalls(snap, null).error);
});

test('the TV door pairs, shows rooms, acts, and the app can take a TV away', async (t) => {
	const seen = [];
	const ha = createServer((req, res) => {
		let body = '';
		req.on('data', (c) => (body += c));
		req.on('end', () => {
			seen.push({ path: req.url, body });
			res.setHeader('Content-Type', 'application/json');
			if (req.url === '/api/template') return res.end(JSON.stringify(areas));
			if (req.url === '/api/states') return res.end(JSON.stringify(states));
			res.end('[]');
		});
	}).listen(0);
	await new Promise((r) => ha.once('listening', r));
	const data = mkdtempSync(join(tmpdir(), 'data-'));
	const www = mkdtempSync(join(tmpdir(), 'www-'));
	writeFileSync(join(www, 'index.html'), 'x');
	const port = 19000 + Math.floor(Math.random() * 500);
	const tvPort = port + 600;
	const proc = spawn(process.execPath, [new URL('../beyond_home/server/main.mjs', import.meta.url).pathname], {
		env: { ...process.env, PORT: String(port), TV_PORT: String(tvPort), DATA: data, WWW: www, HA_URL: 'http://127.0.0.1:' + ha.address().port + '/api', SUPERVISOR_TOKEN: 'tok' },
		stdio: 'ignore'
	});
	t.after(() => (proc.kill(), ha.close()));
	const app = 'http://127.0.0.1:' + port;
	const door = 'http://127.0.0.1:' + tvPort;
	for (let i = 0; i < 50; i++) {
		if (await fetch(door + '/tv/hi').then(() => true, () => false)) break;
		await new Promise((r) => setTimeout(r, 100));
	}

	const hi = await fetch(door + '/tv/hi');
	assert.equal((await hi.json()).beyond, 'home');
	assert.equal(hi.headers.get('access-control-allow-origin'), '*');
	assert.equal((await fetch(door + '/tv/snapshot')).status, 401);

	const p = await (await fetch(door + '/tv/hello', { method: 'POST', body: JSON.stringify({ name: 'Lounge TV' }) })).json();
	const auth = { Authorization: 'Bearer ' + p.id + '.' + p.secret };
	const wait = await fetch(door + '/tv/snapshot', { headers: auth });
	assert.equal(wait.status, 202);

	assert.equal((await fetch(app + '/api/tvs/pair', { method: 'POST', body: JSON.stringify({ code: 'AAAAAA' }) })).status, 400);
	const paired = await (await fetch(app + '/api/tvs/pair', { method: 'POST', body: JSON.stringify({ code: p.code }) })).json();
	assert.deepEqual(paired.tvs.map((x) => x.name), ['Lounge TV']);
	assert.doesNotMatch(JSON.stringify(paired), /hash/);
	assert.doesNotMatch(readFileSync(join(data, 'tvs.json'), 'utf8'), new RegExp(p.secret));

	const rooms = await (await fetch(door + '/tv/snapshot', { headers: auth })).json();
	assert.equal(rooms.rooms[0].name, 'Lounge');

	const before = seen.length;
	assert.equal((await fetch(door + '/tv/act', { method: 'POST', headers: auth, body: JSON.stringify({ room: 'lounge', do: 'toggle', thing: 'lock.front' }) })).status, 400);
	assert.ok(!seen.slice(before).some((s) => s.path.startsWith('/api/services')), 'a refused ask reaches nothing');
	assert.equal((await fetch(door + '/tv/act', { method: 'POST', headers: auth, body: JSON.stringify({ room: 'lounge', do: 'volume_down' }) })).status, 200);
	assert.ok(seen.some((s) => s.path === '/api/services/media_player/volume_down'));

	// The ingress app is not reachable on the TV port, and the TV door is not the app.
	assert.equal((await fetch(door + '/api/snapshot')).status, 401);
	assert.equal((await fetch(door + '/api/tvs/pair', { method: 'POST', headers: auth, body: '{}' })).status, 404);

	await fetch(app + '/api/tvs/remove', { method: 'POST', body: JSON.stringify({ id: p.id }) });
	assert.equal((await fetch(door + '/tv/snapshot', { headers: auth })).status, 401);
});
