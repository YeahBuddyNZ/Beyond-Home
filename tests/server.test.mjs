// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refuse } from '../beyond_home/server/allow.mjs';
import { buildSnapshot } from '../beyond_home/server/snapshot.mjs';

test('the box refuses anything the screens never send', () => {
	assert.equal(refuse({ domain: 'light', service: 'turn_on', data: { entity_id: 'light.lamp', brightness_pct: 50 } }), null);
	assert.ok(refuse({ domain: 'lock', service: 'unlock', data: { entity_id: 'lock.front' } }));
	assert.ok(refuse({ domain: 'light', service: 'turn_on', data: { entity_id: 'switch.jug' } }));
	assert.ok(refuse({ domain: 'light', service: 'turn_on', data: { entity_id: 'light.lamp', flash: 'long' } }));
	assert.ok(refuse({ domain: 'light', service: 'turn_on', data: { entity_id: 'light.lamp', brightness_pct: 0 } }));
	assert.ok(refuse({ domain: 'climate', service: 'set_temperature', data: { entity_id: 'climate.a', temperature: 40 } }));
	assert.ok(refuse({ domain: 'homeassistant', service: 'restart', data: {} }));
	assert.ok(refuse({ domain: 'light', service: 'turn_on', data: { entity_id: '../x' } }));
	assert.ok(refuse(null));
});

const states = [
	{ entity_id: 'light.lounge_lamp', state: 'on', attributes: { friendly_name: 'Lounge Lamp', brightness: 100, entity_picture: '/secret.jpg' } },
	{ entity_id: 'media_player.lounge_tv', state: 'on', attributes: { friendly_name: 'Lounge TV', media_title: 'What we watch', app_name: 'Netflix' } },
	{ entity_id: 'light.shed', state: 'off', attributes: { friendly_name: 'Shed' } },
	{ entity_id: 'sensor.power', state: '12', attributes: {} },
	{ entity_id: 'lock.front', state: 'locked', attributes: {} }
];
const areas = [
	{ id: 'lounge', name: 'Lounge', entities: ['light.lounge_lamp', 'media_player.lounge_tv', 'sensor.power'] },
	{ id: 'empty', name: 'Garage', entities: [] }
];

test('rooms come from areas, and only what the screens use leaves the box', () => {
	const s = buildSnapshot(areas, states);
	assert.deepEqual(s.rooms.map((r) => r.name), ['Lounge', 'Not in a room yet']);
	assert.deepEqual(s.rooms[0].things.map((t) => t.entity_id), ['light.lounge_lamp', 'media_player.lounge_tv']);
	assert.deepEqual(s.rooms[1].things.map((t) => t.entity_id), ['light.shed']);
	const json = JSON.stringify(s);
	assert.doesNotMatch(json, /secret\.jpg|What we watch|lock\.front/);
	assert.match(json, /Netflix/);
});

test('the server talks to Home Assistant for the screens, and only for them', async (t) => {
	const seen = [];
	const ha = createServer((req, res) => {
		let body = '';
		req.on('data', (c) => (body += c));
		req.on('end', () => {
			seen.push({ path: req.url, auth: req.headers.authorization, body });
			res.setHeader('Content-Type', 'application/json');
			if (req.url === '/api/template') return res.end(JSON.stringify(areas));
			if (req.url === '/api/states') return res.end(JSON.stringify(states));
			res.end('[]');
		});
	}).listen(0);
	await new Promise((r) => ha.once('listening', r));
	const www = mkdtempSync(join(tmpdir(), 'www-'));
	writeFileSync(join(www, 'index.html'), '<!doctype html><title>Beyond Home</title>');
	const port = 18000 + Math.floor(Math.random() * 1000);
	const proc = spawn(process.execPath, [new URL('../beyond_home/server/main.mjs', import.meta.url).pathname], {
		env: { ...process.env, PORT: String(port), WWW: www, HA_URL: 'http://127.0.0.1:' + ha.address().port + '/api', SUPERVISOR_TOKEN: 'tok' },
		stdio: 'ignore'
	});
	t.after(() => (proc.kill(), ha.close()));
	const base = 'http://127.0.0.1:' + port;
	for (let i = 0; i < 50; i++) {
		if (await fetch(base + '/').then(() => true, () => false)) break;
		await new Promise((r) => setTimeout(r, 100));
	}

	assert.match(await (await fetch(base + '/')).text(), /Beyond Home/);
	assert.equal((await fetch(base + '/../../etc/passwd')).status, 404);
	const snap = await (await fetch(base + '/api/snapshot')).json();
	assert.equal(snap.rooms[0].name, 'Lounge');
	assert.equal(seen[0].auth, 'Bearer tok');

	const ok = await fetch(base + '/api/act', { method: 'POST', body: JSON.stringify([{ domain: 'light', service: 'turn_off', data: { entity_id: 'light.lounge_lamp' } }]) });
	assert.equal(ok.status, 200);
	assert.ok(seen.some((s) => s.path === '/api/services/light/turn_off' && JSON.parse(s.body).entity_id === 'light.lounge_lamp'));

	const before = seen.length;
	const no = await fetch(base + '/api/act', { method: 'POST', body: JSON.stringify([{ domain: 'light', service: 'turn_off', data: { entity_id: 'light.a' } }, { domain: 'lock', service: 'unlock', data: { entity_id: 'lock.front' } }]) });
	assert.equal(no.status, 400);
	assert.equal(seen.length, before, 'nothing reaches Home Assistant when any call is refused');
});
