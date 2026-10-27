# Beyond Home: notes for Claude

Beyond's home hub: Home Assistant underneath, the Beyond app on top. Part of the Beyond tools with Beyond TV
(YeahBuddyNZ/Beyond.TV), Beyond Gateway (YeahBuddyNZ/Beyond-Gateway) and Beyond Family (YeahBuddyNZ/Beyond-Family).
Tagline "Free your world". Plan: docs/plan.md.

## Ours

- **Writing:** New Zealand English everywhere (copy, comments, commits). No em dashes. Dates DD/MM/YYYY. Brand is "Beyond™".
- **Brand:** the same purple as Beyond Gateway and gobeyond.nz: violet `#6E3DDB` for the one thing to press, lilac
  `#9E7BFF`, void `#0D0C18` to `#2C2458` for the hero card, paper `#F7F6F2` and ink `#22221F`. Four dots as the mark.
  Sora for display type. Tokens live once, on `:root` in `beyond_home/web/src/index.css`.
- **People aren't technical.** Rooms, not entities. Never show an entity id, YAML, an IP address or a service name.
- **Local first:** it works with the internet down. Never break the brand's own app or remote.
- **Never touch wiring** (230 V is an electrician's job in NZ) and never keep what anybody watches or listens to: the
  snapshot carries the app or input, never the show (`KEEP` in `snapshot.mjs`).
- **The way back:** Home Assistant's own screens stay under Settings, Advanced.
- Every visible feature goes on the website (YeahBuddyNZ/GoBeyond-Website) and in the README in the same change.

## The code

- `beyond_home/` is the Home Assistant app (add-on): `config.yaml` (ingress on 8099), `Dockerfile` (builds the web app,
  then runs `server/main.mjs` on Node with no packages). `repository.yaml` at the root makes this repo an app store.
- `server/main.mjs` only answers Home Assistant's ingress gateway (172.30.32.2). Two routes: `GET api/snapshot`
  (areas through the template API plus states, shaped by `snapshot.mjs`) and `POST api/act` (service calls, every one
  checked by `allow.mjs` before any is sent). A new kind of call goes in `allow.mjs` and in a test.
- `server/tvs.mjs` is the TVs' door, a second server on port 8098 (`config.yaml` `ports`), private addresses only, CORS
  `*`, no cookies. `GET /tv/hi` says it is Beyond Home (how a TV finds the box), `POST /tv/hello` starts pairing (the TV
  keeps a secret, the box keeps its sha256 in `/data/tvs.json`), the code is typed in the app (Settings, TVs:
  `api/tvs`, `api/tvs/pair`, `api/tvs/remove`), then `GET /tv/snapshot` and `POST /tv/act` with `Bearer <id>.<secret>`.
  A TV asks for named things (a moment, volume, mute, power, one thing on or off in that room); the box builds the
  calls with `web/src/lib.js` and `allow.mjs`, so the Dockerfile ships `lib.js` beside the server.
- `server/music.mjs` is the Music tab's way to Beyond Music (YeahBuddyNZ/Beyond-Music, port 8097): `api/music/*` on the
  ingress server, passed through only if `musicPath` names it (never via `allow.mjs`, which is Home Assistant calls
  only), to an address typed in Settings (house addresses only, `cleanAddress`), else 172.30.32.1, 127.0.0.1 or
  beyond-music.local. Songs stream with Range both ways. Kyle folded Beyond Music into Beyond Home on 27/10/2026.
- `web/` is React 19, Vite and Tailwind v4 with ReUI (style `base-nova` on Base UI), copied from Beyond Gateway. Every
  visible part comes from `components/ui` or `components/reui` (installed output: compose, never edit).
- Only `web/src/api.ts` talks to the box (a test checks). Pure decisions stay in `web/src/lib.js`, plain JavaScript so
  `node --test` runs it: what a thing is, a room's line, where the remote's volume goes, the moments. Every call it can
  build must pass `allow.mjs` (a test checks). `?preview` runs against `web/src/mock.js` (made-up names only, never
  real family names); `npm run build:hub` leaves it out.
- Checks: `sh tests/run.sh`; `cd beyond_home/web && npm run build:hub`. CI also builds the Docker image.
- Not yet run on a real Home Assistant box: say so when reporting.
