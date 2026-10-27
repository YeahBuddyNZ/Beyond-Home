// The Music tab's way to the family's music (beyond_home/server/music.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidates, cleanAddress, musicPath } from '../beyond_home/server/music.mjs';
import * as lib from '../beyond_home/web/src/lib.js';

test('only the paths the Music tab uses get through to the music server', () => {
	assert.equal(musicPath('GET', '/api/music/library'), '/api/library');
	assert.equal(musicPath('GET', '/api/music/radio'), '/api/radio');
	assert.equal(musicPath('GET', '/api/music/play/0123456789ab'), '/api/play/0123456789ab');
	assert.equal(musicPath('GET', '/api/music/cover/0123456789ab'), '/api/cover/0123456789ab');
	assert.equal(musicPath('GET', '/api/music/search', '?q=t%C5%AB%C4%AB'), '/api/search?q=t%C5%AB%C4%AB');
	assert.equal(musicPath('POST', '/api/music/played'), '/api/played');
	for (const [m, p] of [
		['GET', '/api/music/places'],
		['POST', '/api/music/places'],
		['POST', '/api/music/cd/copy'],
		['GET', '/api/music/play/../../etc'],
		['GET', '/api/music/play/XYZ'],
		['GET', '/api/music/rest/getAlbum'],
		['DELETE', '/api/music/library'],
	])
		assert.equal(musicPath(m, p), null, `${m} ${p} is refused`);
});

test('a typed address has to be inside the house', () => {
	assert.equal(cleanAddress('192.168.1.20'), 'http://192.168.1.20:8097');
	assert.equal(cleanAddress('http://10.0.0.5:9000/whatever'), 'http://10.0.0.5:9000');
	assert.equal(cleanAddress('kyles-mac.local'), 'http://kyles-mac.local:8097');
	assert.equal(cleanAddress(''), '');
	assert.equal(cleanAddress('example.com'), null);
	assert.equal(cleanAddress('8.8.8.8'), null);
	assert.equal(cleanAddress('http://192.168.1.2.evil.com'), null);
	assert.deepEqual(candidates('http://10.0.0.5:8097')[0], 'http://10.0.0.5:8097');
	assert.ok(candidates('').includes('http://172.30.32.1:8097'), 'the Home Assistant box itself is tried');
});

const library = {
	albums: [
		{ id: 'a', title: 'Tides', artist: 'Moana', hasCover: false, added: 1, trackIds: ['t2', 't1'] },
		{ id: 'b', title: 'Kōwhai', artist: 'Nikau', hasCover: false, added: 5, trackIds: ['t3'] },
		{ id: 'c', title: 'Rain', artist: 'Weka', hasCover: false, added: 3, trackIds: [] },
	],
	tracks: [
		{ id: 't1', title: 'Harbour', artist: 'Moana', album: 'Tides', albumId: 'a', track: 1 },
		{ id: 't2', title: 'Reef', artist: 'Moana', album: 'Tides', albumId: 'a', track: 2 },
		{ id: 't3', title: 'Tūī Song', artist: 'Nikau', album: 'Kōwhai', albumId: 'b', track: 1 },
	],
	recent: [{ id: 't2', at: 9 }],
};

test('albums open with what was played lately, songs in disc order', () => {
	assert.deepEqual(lib.albumsToShow(library).map((a) => a.id), ['a', 'b', 'c']);
	assert.deepEqual(lib.albumTracks(library, library.albums[0]).map((t) => t.title), ['Harbour', 'Reef']);
	assert.deepEqual(lib.findAlbums(library, 'tui').map((a) => a.id), ['b'], 'macrons don’t matter');
	assert.deepEqual(lib.findAlbums(library, 'moana reef').map((a) => a.id), ['a']);
	assert.equal(lib.clock(187), '3:07');
	assert.equal(lib.clock(3735), '1:02:15');
});

test('the Music tab reaches the music server through Beyond Home, songs in pieces and all', async (t) => {
	const song = Buffer.alloc(1000, 7);
	const seen = [];
	const box = createServer((req, res) => {
		seen.push(req.method + ' ' + req.url);
		if (req.url === '/api/hello') return res.end(JSON.stringify({ app: 'beyond-music' }));
		if (req.url === '/api/library') return res.end(JSON.stringify({ albums: [{ id: 'a' }] }));
		if (req.url === '/api/play/0123456789ab') {
			res.writeHead(206, { 'Content-Type': 'audio/flac', 'Content-Range': 'bytes 0-99/1000', 'Accept-Ranges': 'bytes', 'Content-Length': 100 });
			return res.end(song.subarray(0, 100));
		}
		if (req.url === '/api/played') {
			let b = '';
			req.on('data', (c) => (b += c)).on('end', () => (seen.push(b + ' ' + req.headers['content-type']), res.end('{}')));
			return;
		}
		res.statusCode = 404;
		res.end('{}');
	}).listen(0, '127.0.0.1');
	await new Promise((r) => box.once('listening', r));

	const www = mkdtempSync(join(tmpdir(), 'www-'));
	writeFileSync(join(www, 'index.html'), '<!doctype html>');
	const port = 19000 + Math.floor(Math.random() * 500);
	const proc = spawn(process.execPath, [new URL('../beyond_home/server/main.mjs', import.meta.url).pathname], {
		env: { ...process.env, PORT: String(port), TV_PORT: String(port + 500), WWW: www, DATA: mkdtempSync(join(tmpdir(), 'data-')), HA_URL: 'http://127.0.0.1:9/api' },
		stdio: 'ignore',
	});
	t.after(() => (proc.kill(), box.close()));
	const base = 'http://127.0.0.1:' + port;
	for (let i = 0; i < 50; i++) {
		if (await fetch(base + '/').then(() => true, () => false)) break;
		await new Promise((r) => setTimeout(r, 100));
	}

	const where = await fetch(base + '/api/music/where', { method: 'POST', body: JSON.stringify({ address: '127.0.0.1:' + box.address().port }) });
	assert.deepEqual(await where.json(), { address: 'http://127.0.0.1:' + box.address().port, found: true });
	assert.equal((await fetch(base + '/api/music/where', { method: 'POST', body: JSON.stringify({ address: 'example.com' }) })).status, 400);

	assert.deepEqual(await (await fetch(base + '/api/music/library')).json(), { albums: [{ id: 'a' }] });
	const part = await fetch(base + '/api/music/play/0123456789ab', { headers: { Range: 'bytes=0-99' } });
	assert.equal(part.status, 206);
	assert.equal(part.headers.get('content-range'), 'bytes 0-99/1000');
	assert.equal((await part.arrayBuffer()).byteLength, 100);
	await fetch(base + '/api/music/played', { method: 'POST', body: JSON.stringify({ id: '0123456789ab' }) });
	assert.ok(seen.includes('{"id":"0123456789ab"} application/json'));

	const before = seen.length;
	assert.equal((await fetch(base + '/api/music/places')).status, 404);
	assert.equal((await fetch(base + '/api/music/cd/copy', { method: 'POST', body: '{}' })).status, 404);
	assert.equal(seen.length, before, 'refused asks never reach the music server');

	box.close();
	box.closeAllConnections();
	await new Promise((r) => setTimeout(r, 100));
	const gone = await fetch(base + '/api/music/library');
	assert.equal(gone.status, 503);
});
