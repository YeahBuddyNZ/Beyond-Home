// Home Assistant's areas and states, turned into the rooms the screens draw. Pure, so tests/server.test.mjs runs it.

export const DOMAINS = ['media_player', 'light', 'switch', 'fan', 'cover', 'climate'];

// Asked of Home Assistant's template API: every area with the entities in it (directly or through its device).
export const ROOMS_TEMPLATE =
	'{% set ns = namespace(out=[]) %}{% for a in areas() %}' +
	'{% set ns.out = ns.out + [{"id": a, "name": area_name(a), "entities": area_entities(a)}] %}' +
	'{% endfor %}{{ ns.out | tojson }}';

// Only what the screens use leaves the box: never pictures, media titles or anything else an entity carries.
const KEEP = ['friendly_name', 'device_class', 'volume_level', 'is_volume_muted', 'source', 'source_list', 'app_name', 'brightness', 'supported_color_modes', 'temperature', 'current_temperature', 'hvac_modes', 'min_temp', 'max_temp'];

function slim(s) {
	const a = {};
	for (const k of KEEP) if (s.attributes && s.attributes[k] !== undefined) a[k] = s.attributes[k];
	return { entity_id: s.entity_id, state: s.state, attributes: a };
}

const shown = (s) => DOMAINS.includes(s.entity_id.split('.')[0]) && !(s.attributes && s.attributes.hidden);

export function buildSnapshot(areas, states) {
	const byId = new Map(states.filter(shown).map((s) => [s.entity_id, s]));
	const placed = new Set();
	const rooms = [];
	for (const a of areas || []) {
		const things = (a.entities || []).filter((id) => byId.has(id)).map((id) => (placed.add(id), slim(byId.get(id))));
		if (things.length) rooms.push({ id: a.id, name: a.name, things });
	}
	const rest = [...byId.values()].filter((s) => !placed.has(s.entity_id)).map(slim);
	if (rest.length) rooms.push({ id: '_elsewhere', name: 'Not in a room yet', things: rest });
	return { rooms };
}
