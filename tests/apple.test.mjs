// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buttonsFor, createApple, entitiesFor, flowAnswer, pairingFrom } from '../beyond_home/server/apple.mjs';
import { refuse } from '../beyond_home/server/allow.mjs';

// A made-up house: a lounge with a TV, a receiver and a light, a kitchen light, and a plug nobody put in a room.
const house = () => ({
	rooms: [
		{
			id: 'lounge',
			name: 'Lounge',
			things: [
				{ entity_id: 'media_player.lounge_tv', state: 'off', attributes: { device_class: 'tv' } },
				{ entity_id: 'media_player.yamaha', state: 'on', attributes: { device_class: 'receiver', source_list: ['TV', 'Spotify'] } },
				{ entity_id: 'light.lounge', state: 'on', attributes: { brightness: 200 } }
			]
		},
		{ id: 'kitchen', name: 'Kitchen', things: [{ entity_id: 'light.kitchen', state: 'off', attributes: {} }] },
		{ id: '_elsewhere', name: 'Not in a room yet', things: [{ entity_id: 'switch.test_plug', state: 'on', attributes: {} }] }
	]
});

test('each room gets a button for each moment that fits it, never for things not in a room', () => {
	const b = buttonsFor(house());
	const names = b.map((x) => x.name);
	assert.ok(names.includes('Lounge Movie night'));
	assert.ok(names.includes('Kitchen Morning'));
	assert.ok(!names.includes('Kitchen Movie night'), 'no TV in the kitchen');
	assert.ok(!names.some((n) => n.startsWith('Not in a room')));
	assert.ok(b.every((x) => /^input_button\.beyond_[a-z0-9_]+$/.test(x.entity_id)));
	const ids = entitiesFor(house(), b);
	assert.ok(ids.includes('light.lounge') && ids.includes('input_button.beyond_lounge_movie'));
	assert.ok(!ids.includes('switch.test_plug'), 'a thing nobody put in a room stays out of Apple Home');
});

test('the set-up form is answered as a bridge with only the family’s things', () => {
	const plan = { domains: ['light'], entities: ['light.lounge'] };
	assert.deepEqual(flowAnswer({ data_schema: [{ name: 'include_domains' }] }, plan), { include_domains: ['light'] });
	assert.deepEqual(flowAnswer({ data_schema: [{ name: 'mode' }, { name: 'include_exclude_mode' }, { name: 'domains' }] }, plan), { mode: 'bridge', include_exclude_mode: 'include', domains: ['light'] });
	assert.deepEqual(flowAnswer({ data_schema: [{ name: 'entities' }, { name: 'something_new' }] }, plan), { entities: ['light.lounge'] });
	assert.deepEqual(flowAnswer({ data_schema: [] }, plan), {});
});

test('the pairing code and QR come from Home Assistant’s note for this bridge only', () => {
	const notes = {
		other: { notification_id: 'other', message: 'Something else 111-11-111' },
		abc123: { notification_id: 'abc123', message: 'To pair, scan ![image](/api/homekit/pairingqr?abc123-XyZ_9) or enter 482-91-736' }
	};
	assert.deepEqual(pairingFrom(notes, 'abc123'), { code: '482-91-736', qr: '/api/homekit/pairingqr?abc123-XyZ_9' });
	assert.equal(pairingFrom(notes, 'nope'), null);
});

// Stand-ins for Home Assistant's REST and websocket.
function fakeHa() {
	const h = { posts: [], deleted: [], buttons: new Map(), listeners: {}, entries: 0 };
	h.rest = async (path, init = {}) => {
		const body = init.body ? JSON.parse(init.body) : null;
		h.posts.push({ path, method: init.method || 'GET', body });
		const json = (x) => ({ json: async () => x, arrayBuffer: async () => new TextEncoder().encode('<svg/>').buffer });
		if (path === '/config/config_entries/flow') return json({ type: 'form', flow_id: 'f1', step_id: 'user', data_schema: [{ name: 'include_domains' }] });
		if (path === '/config/config_entries/flow/f1' && body.include_domains) return json({ type: 'form', flow_id: 'f1', step_id: 'pairing', data_schema: [] });
		if (path === '/config/config_entries/flow/f1') return (h.entries++, json({ type: 'create_entry', result: { entry_id: 'abc123' } }));
		if (path === '/config/config_entries/options/flow') return json({ type: 'form', flow_id: 'o1', step_id: 'init', data_schema: [{ name: 'mode' }, { name: 'include_exclude_mode' }, { name: 'domains' }] });
		if (path === '/config/config_entries/options/flow/o1' && body.domains) return json({ type: 'form', flow_id: 'o1', step_id: 'include', data_schema: [{ name: 'entities' }] });
		if (path === '/config/config_entries/options/flow/o1') return json({ type: 'create_entry' });
		if (path.startsWith('/config/config_entries/entry/')) return (h.deleted.push(path), json({}));
		if (path.startsWith('/homekit/pairingqr')) return json({});
		throw new Error('unexpected ' + path);
	};
	h.socket = async () => ({
		closed: false,
		async ask(type, extra) {
			if (type === 'input_button/list') return [...h.buttons.values()];
			if (type === 'input_button/create') return h.buttons.set(extra.name, { id: extra.name, name: extra.name });
			if (type === 'input_button/update') return h.buttons.set(extra.input_button_id, { id: extra.input_button_id, name: extra.name });
			if (type === 'input_button/delete') return h.buttons.delete(extra.input_button_id);
			throw new Error('unexpected ' + type);
		},
		async listen(type, extra, fn) {
			h.listeners[type] = fn;
		},
		close() {}
	});
	return h;
}

test('Show in Apple Home makes the buttons and a bridge, shows the code, and a moment pressed there passes allow.mjs', async () => {
	const h = fakeHa();
	const ran = [];
	const file = join(mkdtempSync(join(tmpdir(), 'apple-')), 'apple.json');
	const apple = createApple({ file, rest: h.rest, socket: h.socket, snapshot: async () => house(), run: async (c) => ran.push(...c) });
	assert.deepEqual(await apple.status(), { state: 'off' });
	assert.equal(h.posts.length, 0, 'nothing happens until somebody taps it');

	h.listeners = {};
	const started = apple.start();
	await new Promise((r) => setImmediate(r));
	h.listeners['persistent_notification/subscribe']({ type: 'current', notifications: { abc123: { notification_id: 'abc123', message: 'enter 482-91-736 ![q](/api/homekit/pairingqr?abc123-tok)' } } });
	const st = await started;
	assert.equal(st.state, 'pairing');
	assert.equal(st.code, '482-91-736');
	assert.ok(h.buttons.has('beyond_lounge_movie'));
	assert.equal(h.buttons.get('beyond_lounge_movie').name, 'Lounge Movie night');
	const include = h.posts.find((p) => p.body && p.body.entities);
	assert.ok(include.body.entities.includes('light.kitchen') && !include.body.entities.includes('switch.test_plug'));
	assert.ok(JSON.parse(readFileSync(file, 'utf8')).entry === 'abc123');
	assert.ok(await apple.qr());

	// "Hey Siri, Lounge Movie night": the button's state changes and the box does the moment itself.
	h.listeners.subscribe_events({ data: { entity_id: 'input_button.beyond_lounge_movie', old_state: { state: 'a' }, new_state: { state: 'b' } } });
	for (let i = 0; i < 20 && !ran.length; i++) await new Promise((r) => setImmediate(r));
	assert.ok(ran.some((c) => c.domain === 'media_player' && c.service === 'turn_on'));
	assert.ok(ran.every((c) => refuse(c) === null));

	// Another bridge's or anybody else's button does nothing.
	ran.length = 0;
	h.listeners.subscribe_events({ data: { entity_id: 'input_button.garage', old_state: { state: 'a' }, new_state: { state: 'b' } } });
	await new Promise((r) => setImmediate(r));
	assert.equal(ran.length, 0);

	// Paired: the note goes, and the card says it's on.
	h.listeners['persistent_notification/subscribe']({ type: 'removed', notifications: { abc123: {} } });
	assert.equal((await apple.status()).state, 'on');

	await apple.stop();
	assert.deepEqual(h.deleted, ['/config/config_entries/entry/abc123']);
	assert.equal(h.buttons.size, 0);
	assert.equal(existsSync(file), false);
	assert.equal(h.entries, 1);
});
