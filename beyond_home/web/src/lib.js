// The decisions behind the screens, in plain JavaScript so node --test runs them with no build (tests/web.test.mjs).
// A "thing" is one Home Assistant entity as the snapshot hands it over: { entity_id, state, attributes }.
// Every service call this file builds must be one beyond_home/server/allow.mjs lets through (a test checks).

export const domainOf = (id) => String(id || '').split('.')[0];

const RECEIVER = /receiver|yamaha|denon|marantz|onkyo|pioneer|\brx-?[a-z]?\d|\bavr\b|soundbar/i;

// What a thing is, in the words on screen. A media player is a TV, a receiver or a speaker.
export function kindOf(t) {
	const d = domainOf(t.entity_id);
	const a = t.attributes || {};
	if (d === 'light') return 'light';
	if (d === 'climate') return 'heatpump';
	if (d === 'fan') return 'fan';
	if (d === 'cover') return 'blind';
	if (d === 'switch') return 'plug';
	if (d === 'media_player') {
		if (a.device_class === 'tv') return 'tv';
		if (a.device_class === 'receiver' || RECEIVER.test(a.friendly_name || t.entity_id)) return 'receiver';
		if (/\btv\b|bravia|webos|tizen|television/i.test(a.friendly_name || t.entity_id)) return 'tv';
		return 'speaker';
	}
	return 'other';
}

export const KIND_WORDS = { tv: 'TV', receiver: 'Receiver', speaker: 'Speaker', light: 'Light', heatpump: 'Heat pump', fan: 'Fan', blind: 'Blind', plug: 'Plug', other: 'Thing' };

// "Lounge Ceiling light" in the Lounge is just "Ceiling light" there.
export function thingName(t, roomName) {
	const full = ((t.attributes || {}).friendly_name || String(t.entity_id).split('.')[1] || '').replace(/_/g, ' ').trim();
	if (roomName) {
		const cut = full.replace(new RegExp('^' + roomName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'), '');
		if (cut) return cut.charAt(0).toUpperCase() + cut.slice(1);
	}
	return full || KIND_WORDS[kindOf(t)];
}

export function isOn(t) {
	const s = t.state;
	if (s === 'unavailable' || s === 'unknown') return false;
	if (domainOf(t.entity_id) === 'climate') return s !== 'off';
	if (domainOf(t.entity_id) === 'cover') return s === 'open';
	return s !== 'off' && s !== 'standby';
}

export const isAway = (t) => t.state === 'unavailable';

export function volumeOf(t) {
	const v = (t.attributes || {}).volume_level;
	return typeof v === 'number' ? Math.round(v * 100) : null;
}

// What a TV or receiver is showing: the app or the input, never the name of the show.
export function showing(t) {
	const a = t.attributes || {};
	return a.app_name || a.source || null;
}

// One short line for a room card. Nothing on reads "All off".
export function roomSummary(room) {
	const things = room.things || [];
	const parts = [];
	const tv = things.find((t) => kindOf(t) === 'tv' && isOn(t));
	if (tv) parts.push(showing(tv) ? 'TV on (' + showing(tv) + ')' : 'TV on');
	const loud = remoteTarget(room);
	if (loud && isOn(loud) && kindOf(loud) !== 'tv' && volumeOf(loud) != null) parts.push('volume ' + volumeOf(loud));
	const lights = things.filter((t) => kindOf(t) === 'light' && isOn(t)).length;
	if (lights) parts.push(lights === 1 ? '1 light on' : lights + ' lights on');
	const heat = things.find((t) => kindOf(t) === 'heatpump' && isOn(t));
	if (heat) {
		const want = (heat.attributes || {}).temperature;
		parts.push(want != null ? 'heat pump ' + want + '°' : 'heat pump on');
	}
	if (!parts.length) return 'All off';
	const line = parts.join(', ');
	return line.charAt(0).toUpperCase() + line.slice(1);
}

// The one remote's volume goes to the receiver when it is on, otherwise the TV, otherwise a speaker.
export function remoteTarget(room) {
	const media = (room.things || []).filter((t) => domainOf(t.entity_id) === 'media_player' && !isAway(t));
	const order = ['receiver', 'tv', 'speaker'];
	for (const k of order) {
		const on = media.find((t) => kindOf(t) === k && isOn(t));
		if (on) return on;
	}
	for (const k of order) {
		const any = media.find((t) => kindOf(t) === k);
		if (any) return any;
	}
	return null;
}

// The receiver input that carries the TV's sound: ARC first, then anything that says TV.
export function tvInput(receiver) {
	const list = (receiver.attributes || {}).source_list || [];
	return list.find((s) => /\barc\b|audio return/i.test(s)) || list.find((s) => /\btv\b/i.test(s)) || null;
}

const call = (domain, service, entity_id, extra) => ({ domain, service, data: Object.assign({ entity_id }, extra || {}) });

export function toggleCall(t) {
	const d = domainOf(t.entity_id);
	if (d === 'cover') return call('cover', isOn(t) ? 'close_cover' : 'open_cover', t.entity_id);
	if (d === 'climate') return isOn(t) ? call('climate', 'turn_off', t.entity_id) : call('climate', 'turn_on', t.entity_id);
	return call(d, isOn(t) ? 'turn_off' : 'turn_on', t.entity_id);
}

export const volumeCall = (t, up) => call('media_player', up ? 'volume_up' : 'volume_down', t.entity_id);
export const muteCall = (t) => call('media_player', 'volume_mute', t.entity_id, { is_volume_muted: !(t.attributes || {}).is_volume_muted });
export const sourceCall = (t, source) => call('media_player', 'select_source', t.entity_id, { source });

// Heat pumps go up and down by half a degree and stay between 16 and 30.
export function warmerCall(t, step) {
	const a = t.attributes || {};
	const now = typeof a.temperature === 'number' ? a.temperature : 20;
	const next = Math.min(30, Math.max(16, Math.round((now + step) * 2) / 2));
	return call('climate', 'set_temperature', t.entity_id, { temperature: next });
}

export const dimCall = (t, pct) => call('light', 'turn_on', t.entity_id, { brightness_pct: Math.min(100, Math.max(1, Math.round(pct))) });

export function brightnessOf(t) {
	const b = (t.attributes || {}).brightness;
	return typeof b === 'number' && isOn(t) ? Math.round((b / 255) * 100) : isOn(t) ? 100 : 0;
}

// Moments: one tap that sets a room up. Each returns the calls it would make (empty means it doesn't fit the room).
export const MOMENTS = [
	{ id: 'movie', name: 'Movie night', lead: 'TV and sound on, lights down' },
	{ id: 'morning', name: 'Morning', lead: 'Lights up' },
	{ id: 'bedtime', name: 'Bedtime', lead: 'Screens and lights off' },
	{ id: 'off', name: 'Everything off', lead: 'The whole room off' },
	{ id: 'party', name: 'Party', lead: 'Lights bright and colourful' },
	// Back to ordinary light when a party on the TV ends. Never offered as a button.
	{ id: 'party-over', name: 'Party over', lead: 'Lights back to warm white', hidden: true }
];

// Party colours, one per light, moved along one place each beat so the room changes with the music.
export const PARTY_COLOURS = [[255, 0, 160], [0, 200, 255], [255, 190, 0], [120, 255, 0], [160, 60, 255], [255, 80, 40]];
const PARTY_EFFECT = /colou?r ?loop|rainbow|party|disco|prism|cycle/i;
const COLOUR_MODES = ['hs', 'xy', 'rgb', 'rgbw', 'rgbww'];
export const canColour = (t) => ((t.attributes || {}).supported_color_modes || []).some((m) => COLOUR_MODES.includes(m));
// A light's own party effect, when it has one (Hue's prism, a colour loop), so it keeps changing between beats.
export function partyEffect(t) {
	const list = (t.attributes || {}).effect_list;
	return Array.isArray(list) ? list.find((e) => typeof e === 'string' && e.length <= 40 && PARTY_EFFECT.test(e)) || null : null;
}

export function momentCalls(id, room, beat) {
	const things = (room.things || []).filter((t) => !isAway(t));
	const of = (k) => things.filter((t) => kindOf(t) === k);
	const out = [];
	if (id === 'movie') {
		const tvs = of('tv');
		if (!tvs.length) return [];
		tvs.forEach((t) => out.push(call('media_player', 'turn_on', t.entity_id)));
		of('receiver').forEach((r) => {
			out.push(call('media_player', 'turn_on', r.entity_id));
			const input = tvInput(r);
			if (input) out.push(sourceCall(r, input));
		});
		of('light').forEach((l) => out.push(dimCall(l, 15)));
		return out;
	}
	if (id === 'morning') {
		of('light').forEach((l) => out.push(dimCall(l, 100)));
		return out;
	}
	if (id === 'bedtime' || id === 'off') {
		['tv', 'receiver', 'speaker'].forEach((k) => of(k).filter(isOn).forEach((t) => out.push(call('media_player', 'turn_off', t.entity_id))));
		of('light').filter(isOn).forEach((l) => out.push(call('light', 'turn_off', l.entity_id)));
		if (id === 'off') {
			of('fan').filter(isOn).forEach((t) => out.push(call('fan', 'turn_off', t.entity_id)));
			of('heatpump').filter(isOn).forEach((t) => out.push(call('climate', 'turn_off', t.entity_id)));
		}
		return out;
	}
	if (id === 'party') {
		const step = Math.max(0, Math.floor(Number(beat) || 0)) % PARTY_COLOURS.length;
		of('light').forEach((l, i) => {
			const effect = partyEffect(l);
			if (effect) out.push(call('light', 'turn_on', l.entity_id, { brightness_pct: 100, effect }));
			else if (canColour(l)) out.push(call('light', 'turn_on', l.entity_id, { brightness_pct: 100, rgb_color: PARTY_COLOURS[(i + step) % PARTY_COLOURS.length].slice() }));
			else out.push(dimCall(l, 100));
		});
		return out;
	}
	if (id === 'party-over') {
		// Warm white undoes the colour and, on most lights, the effect too.
		of('light').filter(isOn).forEach((l) => out.push(canColour(l) ? call('light', 'turn_on', l.entity_id, { brightness_pct: 80, color_temp_kelvin: 2700 }) : dimCall(l, 80)));
		return out;
	}
	return [];
}

// The moments that do something in this room, so a room with no TV never shows Movie night.
export const momentsFor = (room) => MOMENTS.filter((m) => !m.hidden && (momentCalls(m.id, room).length > 0 || (m.id === 'off' && (room.things || []).length > 0)));

// Rooms in the order a family thinks of them: the ones with a TV first, then by name.
export function sortRooms(rooms) {
	const tv = (r) => ((r.things || []).some((t) => kindOf(t) === 'tv') ? 0 : 1);
	return rooms.slice().sort((a, b) => tv(a) - tv(b) || a.name.localeCompare(b.name));
}

// ---------- music ----------

// An album's songs in the order they're on the disc.
export function albumTracks(library, album) {
	const byId = new Map((library?.tracks || []).map((t) => [t.id, t]));
	return (album?.trackIds || [])
		.map((id) => byId.get(id))
		.filter(Boolean)
		.sort((a, b) => (a.disc || 1) - (b.disc || 1) || (a.track || 0) - (b.track || 0) || a.title.localeCompare(b.title));
}

// Albums the household played lately first, then the newest added: what the Music tab opens on.
export function albumsToShow(library) {
	const albums = library?.albums || [];
	const byTrack = new Map((library?.tracks || []).map((t) => [t.id, t.albumId]));
	const recent = [];
	for (const r of library?.recent || []) {
		const a = byTrack.get(r.id);
		if (a && !recent.includes(a)) recent.push(a);
	}
	const rank = (a) => (recent.includes(a.id) ? recent.indexOf(a.id) : recent.length);
	return albums.slice().sort((a, b) => rank(a) - rank(b) || b.added - a.added || a.title.localeCompare(b.title));
}

// 3:07, 1:02:15.
export function clock(seconds) {
	const s = Math.max(0, Math.floor(Number(seconds) || 0));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, '0');
	return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Every word in the search has to be somewhere in the album, the artist or a song.
export function findAlbums(library, query) {
	const key = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
	const words = key(query).split(/\s+/).filter(Boolean);
	if (!words.length) return albumsToShow(library);
	const songs = new Map();
	for (const t of library?.tracks || []) songs.set(t.albumId, (songs.get(t.albumId) || '') + ' ' + t.title);
	return albumsToShow(library).filter((a) => {
		const hay = key(`${a.title} ${a.artist} ${songs.get(a.id) || ''}`);
		return words.every((w) => hay.includes(w));
	});
}

// The phone app finding the box: the house door is port 8098 (server/tvs.mjs). A typed address is cleaned to
// http://<host>:8098, house addresses only, or null when it can't be one. Empty stays empty.
const HOUSE_HOST = /^(10\.\d+|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+$/;
export function boxAddress(text) {
	let s = String(text || '').trim();
	if (!s) return '';
	if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
	let u;
	try {
		u = new URL(s);
	} catch {
		return null;
	}
	const h = u.hostname.toLowerCase();
	if (!(HOUSE_HOST.test(h) || h.endsWith('.local') || h.endsWith('.lan') || h.endsWith('.home.arpa') || /^[a-z0-9-]+$/.test(h))) return null;
	return `http://${h}:${u.port && u.port !== '8099' && u.port !== '8123' ? u.port : '8098'}`;
}

// Where the phone looks, best first: where it found the box last, then the names a Beyond Home box answers to.
export function boxTries(last) {
	const names = ['http://beyond-home.local:8098', 'http://homeassistant.local:8098', 'http://homeassistant:8098'];
	return [last, ...names].filter((a, i, all) => a && all.indexOf(a) === i);
}

// A phone's name for the box's list, from what the browser says it is.
export function phoneName(userAgent) {
	const ua = String(userAgent || '');
	if (/iPad/.test(ua)) return 'iPad';
	if (/iPhone/.test(ua)) return 'iPhone';
	if (/Android/.test(ua)) return 'Android phone';
	return 'Phone';
}
