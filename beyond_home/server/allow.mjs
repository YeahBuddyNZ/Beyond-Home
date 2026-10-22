// The only service calls the screens may make, checked on the box before anything reaches Home Assistant.
// Grown-ups still have Home Assistant's own screens for everything else (Advanced, in Settings).

export const ALLOWED = {
	media_player: ['turn_on', 'turn_off', 'volume_up', 'volume_down', 'volume_mute', 'select_source', 'media_play_pause'],
	light: ['turn_on', 'turn_off'],
	switch: ['turn_on', 'turn_off'],
	fan: ['turn_on', 'turn_off'],
	cover: ['open_cover', 'close_cover'],
	climate: ['turn_on', 'turn_off', 'set_temperature']
};

const ID = /^[a-z_]+\.[a-z0-9_]+$/;
const DATA = { entity_id: 1, source: 1, is_volume_muted: 1, brightness_pct: 1, temperature: 1 };

// Returns null when the call is fine, or why it isn't.
export function refuse(c) {
	if (!c || typeof c !== 'object') return 'No call';
	const { domain, service, data } = c;
	if (!ALLOWED[domain] || !ALLOWED[domain].includes(service)) return 'Not something Beyond Home does';
	if (!data || typeof data !== 'object') return 'No data';
	const ids = Array.isArray(data.entity_id) ? data.entity_id : [data.entity_id];
	if (!ids.length || ids.some((id) => typeof id !== 'string' || !ID.test(id) || id.split('.')[0] !== domain)) return 'Wrong thing';
	for (const k of Object.keys(data)) if (!DATA[k]) return 'Unexpected ' + k;
	if ('brightness_pct' in data && !(data.brightness_pct >= 1 && data.brightness_pct <= 100)) return 'Brightness out of range';
	if ('temperature' in data && !(data.temperature >= 16 && data.temperature <= 30)) return 'Temperature out of range';
	if ('source' in data && (typeof data.source !== 'string' || data.source.length > 80)) return 'Bad input';
	if ('is_volume_muted' in data && typeof data.is_volume_muted !== 'boolean') return 'Bad mute';
	return null;
}
