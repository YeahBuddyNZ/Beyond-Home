// A stand-in house for previewing the app in a browser (?preview). Made-up rooms, made-up gear, the kind NZ homes have.

const t = (entity_id, state, attributes) => ({ entity_id, state, attributes });

const rooms = [
	{
		id: 'lounge', name: 'Lounge', things: [
			t('media_player.lounge_tv', 'on', { friendly_name: 'Lounge TV', device_class: 'tv', app_name: 'Netflix', volume_level: 0.12 }),
			t('media_player.lounge_receiver', 'on', {
				friendly_name: 'Lounge Yamaha receiver', device_class: 'receiver', volume_level: 0.32, is_volume_muted: false, source: 'TV (ARC)',
				source_list: ['TV (ARC)', 'Apple TV', 'PlayStation', 'Spotify', 'Net Radio', 'Bluetooth']
			}),
			t('light.lounge_ceiling', 'on', { friendly_name: 'Lounge Ceiling', brightness: 90 }),
			t('light.lounge_lamp', 'off', { friendly_name: 'Lounge Lamp' }),
			t('climate.lounge_heat_pump', 'heat', { friendly_name: 'Lounge Heat pump', temperature: 21, current_temperature: 18.5 })
		]
	},
	{
		id: 'kitchen', name: 'Kitchen', things: [
			t('media_player.kitchen_speaker', 'playing', { friendly_name: 'Kitchen MusicCast speaker', volume_level: 0.25, source: 'Net Radio', source_list: ['Net Radio', 'Spotify', 'Bluetooth'] }),
			t('light.kitchen_bench', 'on', { friendly_name: 'Kitchen Bench lights', brightness: 255 }),
			t('switch.kitchen_jug', 'off', { friendly_name: 'Kitchen Jug' })
		]
	},
	{
		id: 'nikau', name: "Nikau's room", things: [
			t('media_player.nikau_tv', 'off', { friendly_name: "Nikau's room LG TV", device_class: 'tv' }),
			t('light.nikau_light', 'off', { friendly_name: "Nikau's room Light" })
		]
	},
	{
		id: 'bedroom', name: 'Main bedroom', things: [
			t('light.bedroom_bedside', 'on', { friendly_name: 'Main bedroom Bedside lamp', brightness: 60 }),
			t('climate.bedroom_heat_pump', 'off', { friendly_name: 'Main bedroom Heat pump', temperature: 19, current_temperature: 16 }),
			t('cover.bedroom_blind', 'open', { friendly_name: 'Main bedroom Blind' })
		]
	}
];

const find = (id) => rooms.flatMap((r) => r.things).find((x) => x.entity_id === id);
const clone = (o) => JSON.parse(JSON.stringify(o));

export async function mockSnapshot() {
	await new Promise((r) => setTimeout(r, 100));
	return { rooms: clone(rooms), time: Math.floor(Date.now() / 1000) };
}

export async function mockAct(calls) {
	await new Promise((r) => setTimeout(r, 150));
	for (const { domain, service, data } of calls) {
		const x = find(data.entity_id);
		if (!x) continue;
		const a = x.attributes;
		if (service === 'turn_on') {
			x.state = domain === 'climate' ? 'heat' : 'on';
			if (domain === 'light') a.brightness = Math.round(((data.brightness_pct ?? 100) / 100) * 255);
			if (domain === 'media_player' && a.device_class === 'tv' && !a.app_name) a.app_name = 'Live TV';
		}
		if (service === 'turn_off') x.state = 'off';
		if (service === 'open_cover') x.state = 'open';
		if (service === 'close_cover') x.state = 'closed';
		if (service === 'volume_up') a.volume_level = Math.min(1, (a.volume_level ?? 0) + 0.01);
		if (service === 'volume_down') a.volume_level = Math.max(0, (a.volume_level ?? 0) - 0.01);
		if (service === 'volume_mute') a.is_volume_muted = !!data.is_volume_muted;
		if (service === 'select_source') a.source = data.source;
		if (service === 'set_temperature') a.temperature = data.temperature;
	}
}

// Paired TVs in the stand-in: any six letters pair a new one.
let tvs = [{ id: 'a1', name: 'Lounge TV', added: Date.now() - 864e5 * 3 }];
export async function mockTvs() {
	return clone(tvs);
}
export async function mockPairTv(code) {
	await new Promise((r) => setTimeout(r, 300));
	if (String(code).replace(/[^a-z0-9]/gi, '').length !== 6) throw new Error('That code didn’t work. Check the TV and try again.');
	tvs.push({ id: 'b' + tvs.length, name: 'Bedroom TV', added: Date.now() });
	return clone(tvs);
}
export async function mockRemoveTv(id) {
	tvs = tvs.filter((t) => t.id !== id);
	return clone(tvs);
}
