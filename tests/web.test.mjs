// node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as lib from '../beyond_home/web/src/lib.js';
import { refuse } from '../beyond_home/server/allow.mjs';

const t = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const tv = t('media_player.lounge_tv', 'on', { friendly_name: 'Lounge TV', device_class: 'tv', app_name: 'Netflix', volume_level: 0.1 });
const amp = t('media_player.lounge_amp', 'on', { friendly_name: 'Lounge Yamaha RX-V6A', volume_level: 0.32, source_list: ['HDMI1', 'TV (ARC)', 'Spotify'] });
const lamp = t('light.lounge_lamp', 'on', { friendly_name: 'Lounge Lamp', brightness: 128 });
const heat = t('climate.lounge_heat_pump', 'heat', { friendly_name: 'Lounge Heat pump', temperature: 21 });
const lounge = { id: 'lounge', name: 'Lounge', things: [tv, amp, lamp, heat] };

test('things are named the way a family says them', () => {
	assert.equal(lib.kindOf(tv), 'tv');
	assert.equal(lib.kindOf(amp), 'receiver');
	assert.equal(lib.kindOf(t('media_player.x', 'on', { friendly_name: 'Sony BRAVIA' })), 'tv');
	assert.equal(lib.kindOf(t('media_player.kitchen', 'on', { friendly_name: 'Kitchen MusicCast' })), 'speaker');
	assert.equal(lib.kindOf(heat), 'heatpump');
	assert.equal(lib.thingName(lamp, 'Lounge'), 'Lamp');
	assert.equal(lib.thingName(t('light.a_b', 'on'), 'Lounge'), 'A b');
	assert.equal(lib.thingName(t('light.x', 'on', { friendly_name: 'Lounge' }), 'Lounge'), 'Lounge');
});

test('a room reads as one short line', () => {
	assert.equal(lib.roomSummary(lounge), 'TV on (Netflix), volume 32, 1 light on, heat pump 21°');
	assert.equal(lib.roomSummary({ name: 'Bedroom', things: [t('light.a', 'off')] }), 'All off');
	assert.doesNotMatch(lib.roomSummary(lounge), /—|–/);
});

test('the one remote follows the sound', () => {
	assert.equal(lib.remoteTarget(lounge), amp);
	const ampOff = { ...amp, state: 'off' };
	assert.equal(lib.remoteTarget({ things: [tv, ampOff] }), tv);
	assert.equal(lib.remoteTarget({ things: [{ ...tv, state: 'off' }, ampOff] }), ampOff);
	assert.equal(lib.remoteTarget({ things: [lamp] }), null);
	assert.equal(lib.remoteTarget({ things: [{ ...amp, state: 'unavailable' }] }), null);
});

test('movie night turns the TV and sound on, sound to the TV, lights down', () => {
	const calls = lib.momentCalls('movie', lounge);
	assert.deepEqual(calls.map((c) => c.domain + '.' + c.service), ['media_player.turn_on', 'media_player.turn_on', 'media_player.select_source', 'light.turn_on']);
	assert.equal(calls[2].data.source, 'TV (ARC)');
	assert.equal(calls[3].data.brightness_pct, 15);
	assert.deepEqual(lib.momentCalls('movie', { things: [lamp] }), []);
	assert.deepEqual(lib.momentsFor({ things: [lamp] }).map((m) => m.id), ['morning', 'bedtime', 'off']);
});

test('bedtime leaves the heat pump alone, everything off does not', () => {
	const ids = (id) => lib.momentCalls(id, lounge).map((c) => c.data.entity_id);
	assert.ok(!ids('bedtime').includes(heat.entity_id));
	assert.ok(ids('off').includes(heat.entity_id));
});

test('heat pumps stay between 16 and 30, by half degrees', () => {
	assert.equal(lib.warmerCall(heat, 0.5).data.temperature, 21.5);
	assert.equal(lib.warmerCall({ ...heat, attributes: { temperature: 30 } }, 0.5).data.temperature, 30);
	assert.equal(lib.warmerCall({ ...heat, attributes: { temperature: 16 } }, -0.5).data.temperature, 16);
});

test('lights dim between 1 and 100', () => {
	assert.equal(lib.brightnessOf(lamp), 50);
	assert.equal(lib.dimCall(lamp, -20).data.brightness_pct, 1);
	assert.equal(lib.dimCall(lamp, 140).data.brightness_pct, 100);
});

test('every call the screens can make is one the box lets through', () => {
	const all = [
		...lib.MOMENTS.flatMap((m) => lib.momentCalls(m.id, lounge)),
		...lounge.things.map(lib.toggleCall),
		...lounge.things.map((x) => lib.toggleCall({ ...x, state: 'off' })),
		lib.toggleCall(t('cover.blind', 'open')), lib.toggleCall(t('switch.jug', 'off')), lib.toggleCall(t('fan.fan', 'on')),
		lib.volumeCall(amp, true), lib.volumeCall(amp, false), lib.muteCall(amp), lib.sourceCall(amp, 'Spotify'),
		lib.warmerCall(heat, 0.5), lib.dimCall(lamp, 40)
	];
	for (const c of all) assert.equal(refuse(c), null, JSON.stringify(c));
});

test('only api.ts talks to the box', () => {
	const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
	const src = new URL('../beyond_home/web/src/', import.meta.url).pathname;
	const callers = walk(src).filter((f) => /\.(t|j)sx?$/.test(f) && /\bfetch\(/.test(readFileSync(f, 'utf8')));
	assert.deepEqual(callers.map((f) => f.slice(src.length)), ['api.ts']);
});

test('no em or en dashes in anything people read', () => {
	const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
	const src = new URL('../beyond_home/web/src/', import.meta.url).pathname;
	for (const f of walk(src).filter((x) => /\.(t|j)sx?$/.test(x) && !x.includes('/components/ui/') && !x.includes('/components/reui/')))
		assert.doesNotMatch(readFileSync(f, 'utf8'), /[—–]/, f);
});
