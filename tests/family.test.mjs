// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanHome, createFamily, familyStatus } from '../beyond_home/server/family.mjs';

// A stand-in for Beyond Family's /home-hub door: records every ask and answers like the real one.
function fakeFamily() {
	const f = { calls: [], linked: false, asks: [], done: [], snapshots: [], gone: false };
	f.fetch = async (url, init = {}) => {
		const path = url.replace('https://family.test/api', '');
		const auth = (init.headers || {}).Authorization || '';
		f.calls.push({ path, auth });
		const reply = (status, body) => ({ status, json: async () => body });
		if (path === '/home-hub/hello') return reply(200, { id: '0b9e7c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b', secret: 'S'.repeat(43), code: 'KQXRMB', minutes: 10 });
		if (auth !== 'Bearer 0b9e7c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b.' + 'S'.repeat(43) || f.gone) return reply(401, { linked: false });
		if (path === '/home-hub/code') return reply(200, { linked: f.linked, code: 'NEWCDE', minutes: 10 });
		if (path.startsWith('/home-hub/sync')) {
			if (!f.linked) return reply(200, { linked: false, waiting: true });
			const asks = f.asks.splice(0);
			return reply(200, { linked: true, home: { name: 'The Testers', people: [{ id: 'm1', name: 'Aroha', colour: '#378ADD', kid: true, birthday: '2015-01-01' }] }, asks });
		}
		if (path === '/home-hub/snapshot') return (f.snapshots.push(JSON.parse(init.body)), reply(200, { linked: true }));
		if (path === '/home-hub/done') return (f.done.push(JSON.parse(init.body)), reply(200, { ok: true }));
		if (path === '/home-hub/bye') return reply(200, { linked: false });
		return reply(404, {});
	};
	return f;
}

function make(f, acts = []) {
	const file = join(mkdtempSync(join(tmpdir(), 'family-')), 'family.json');
	let ticks = 0;
	const fam = createFamily({
		file,
		url: 'https://family.test/api',
		fetchImpl: f.fetch,
		snapshot: async () => ({ rooms: [{ id: 'lounge', name: 'Lounge' }], time: 1 }),
		act: async (ask) => (acts.push(ask), ask.do === 'toggle' ? 'That isn’t in this room' : null),
		sleep: async () => {
			// Let the test look in between, and stop the loop from running for ever: after a few naps, unlink.
			await new Promise((r) => setImmediate(r));
			if (++ticks > 2000) f.gone = true;
		}
	});
	return { fam, file };
}

const until = async (fn) => {
	for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 5));
};

test('nothing goes to the internet until somebody taps Link', async () => {
	const f = fakeFamily();
	const { fam } = make(f);
	await fam.resume();
	assert.equal(f.calls.length, 0);
	assert.deepEqual(fam.status(), { state: 'off' });
});

test('linking shows a code, keeps the secret on the box, and never in the status', async () => {
	const f = fakeFamily();
	const { fam, file } = make(f);
	const st = await fam.start();
	assert.equal(st.state, 'waiting');
	assert.equal(st.code, 'KQXRMB');
	assert.ok(!JSON.stringify(st).includes('SSSS'));
	assert.ok(readFileSync(file, 'utf8').includes('SSSS'), 'the secret is kept on the box');
	await until(() => !existsSync(file));
});

test('once linked it does named asks, says how each went, sends the rooms, and keeps only first names', async () => {
	const f = fakeFamily();
	const acts = [];
	const { fam, file } = make(f, acts);
	f.linked = true;
	f.asks = [
		{ id: 'a1', room: 'lounge', do: 'volume_down' },
		{ id: 'a2', room: 'lounge', do: 'toggle', thing: 'lock.front' }
	];
	await fam.start();
	await until(() => f.done.length === 2);
	assert.deepEqual(acts.map((a) => a.do), ['volume_down', 'toggle']);
	assert.deepEqual(f.done, [{ id: 'a1' }, { id: 'a2', error: 'That isn’t in this room' }]);
	assert.ok(f.snapshots.length >= 1);
	assert.equal(fam.status().state, 'linked');
	assert.equal(fam.status().household, 'The Testers');
	assert.ok(!readFileSync(file, 'utf8').includes('2015'), 'a birthday sent by mistake is not kept');
	// Unlinked in the app: the next sync answers 401 and the box forgets its secret.
	f.gone = true;
	await until(() => !existsSync(file));
	assert.equal(fam.status().state, 'off');
});

test('unlink tells Beyond Family and forgets the secret', async () => {
	const f = fakeFamily();
	const { fam, file } = make(f);
	await fam.start();
	await fam.stop();
	assert.ok(f.calls.some((c) => c.path === '/home-hub/bye'));
	assert.equal(existsSync(file), false);
	assert.equal(fam.status().state, 'off');
});

test('the status and the household are plain', () => {
	assert.deepEqual(familyStatus({ id: 'x', code: 'ABC', codeUntil: 0 }, 1), { state: 'expired' });
	assert.equal(familyStatus({ id: 'x', code: 'ABC', codeUntil: 5 * 60000 }, 0).minutes, 5);
	assert.equal(cleanHome(null), null);
	assert.deepEqual(cleanHome({ name: 'Home', people: [{ id: 1, name: 'Nikau', colour: '#fff', kid: 'yes', email: 'x' }] }).people[0], { id: '1', name: 'Nikau', colour: '#fff', kid: false });
});
