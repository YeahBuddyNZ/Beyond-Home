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
	assert.deepEqual(lib.momentsFor({ things: [lamp] }).map((m) => m.id), ['morning', 'bedtime', 'off', 'party']);
});

test('bedtime leaves the heat pump alone, everything off does not', () => {
	const ids = (id) => lib.momentCalls(id, lounge).map((c) => c.data.entity_id);
	assert.ok(!ids('bedtime').includes(heat.entity_id));
	assert.ok(ids('off').includes(heat.entity_id));
});

test('a party lights the room up in colour and moves the colours on each beat', () => {
	const bulb = t('light.lounge_bulb', 'on', { supported_color_modes: ['xy', 'color_temp'] });
	const hue = t('light.lounge_strip', 'on', { supported_color_modes: ['xy'], effect_list: ['candle', 'prism'] });
	const room = { things: [lamp, bulb, hue, tv] };
	const calls = lib.momentCalls('party', room, 0);
	assert.deepEqual(calls.map((c) => c.data.entity_id), ['light.lounge_lamp', 'light.lounge_bulb', 'light.lounge_strip']);
	assert.deepEqual(calls[0].data, { entity_id: 'light.lounge_lamp', brightness_pct: 100 }, 'a plain light just goes bright');
	assert.deepEqual(calls[1].data.rgb_color, lib.PARTY_COLOURS[1]);
	assert.equal(calls[2].data.effect, 'prism', 'a light with its own party effect uses it');
	assert.deepEqual(lib.momentCalls('party', room, 1)[1].data.rgb_color, lib.PARTY_COLOURS[2]);
	assert.deepEqual(lib.momentCalls('party', room, 'nonsense')[1].data.rgb_color, lib.PARTY_COLOURS[1]);
	const over = lib.momentCalls('party-over', room);
	assert.equal(over[1].data.color_temp_kelvin, 2700);
	assert.ok(!('color_temp_kelvin' in over[0].data));
	assert.ok(!lib.momentsFor(room).some((m) => m.id === 'party-over'), 'party over is never a button');
	assert.ok(lib.momentsFor(room).some((m) => m.id === 'party'));
	for (const c of [...calls, ...over]) assert.equal(refuse(c), null, JSON.stringify(c));
});

test('colours and effects only go to lights, and only sensible ones', () => {
	const c = (data, domain = 'light') => ({ domain, service: 'turn_on', data: { entity_id: domain + '.x', ...data } });
	assert.ok(refuse(c({ rgb_color: [256, 0, 0] })));
	assert.ok(refuse(c({ rgb_color: [1, 2] })));
	assert.ok(refuse(c({ effect: '' })));
	assert.ok(refuse(c({ color_temp_kelvin: 9000 })));
	assert.ok(refuse(c({ rgb_color: [1, 2, 3] }, 'switch')));
	assert.equal(refuse(c({ rgb_color: [1, 2, 3], brightness_pct: 50 })), null);
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

test('only api.ts (and phone.ts, finding and pairing the box) talks to the box', () => {
	const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
	const src = new URL('../beyond_home/web/src/', import.meta.url).pathname;
	const callers = walk(src).filter((f) => /\.(t|j)sx?$/.test(f) && /\bfetch\(/.test(readFileSync(f, 'utf8')));
	assert.deepEqual(callers.map((f) => f.slice(src.length)), ['api.ts', 'phone.ts']);
});

test('no em or en dashes in anything people read', () => {
	const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
	const src = new URL('../beyond_home/web/src/', import.meta.url).pathname;
	for (const f of walk(src).filter((x) => /\.(t|j)sx?$/.test(x) && !x.includes('/components/ui/') && !x.includes('/components/reui/')))
		assert.doesNotMatch(readFileSync(f, 'utf8'), /[—–]/, f);
});

test('the phone app finds the box on the house door, and only inside the house', () => {
	assert.equal(lib.boxAddress('192.168.1.20'), 'http://192.168.1.20:8098');
	assert.equal(lib.boxAddress('http://homeassistant.local:8123'), 'http://homeassistant.local:8098', 'the address Home Assistant shows still works');
	assert.equal(lib.boxAddress('beyond-home.local'), 'http://beyond-home.local:8098');
	assert.equal(lib.boxAddress(''), '');
	assert.equal(lib.boxAddress('example.com'), null);
	assert.equal(lib.boxAddress('8.8.8.8'), null);
	assert.equal(lib.boxAddress('http://[not'), null);
	assert.deepEqual(lib.boxTries('http://beyond-home.local:8098'), ['http://beyond-home.local:8098', 'http://homeassistant.local:8098', 'http://homeassistant:8098']);
	assert.equal(lib.boxTries('http://10.0.0.5:8098')[0], 'http://10.0.0.5:8098');
	assert.equal(lib.phoneName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'iPhone');
	assert.equal(lib.phoneName(''), 'Phone');
});
