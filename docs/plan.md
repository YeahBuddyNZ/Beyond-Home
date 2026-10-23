# Beyond Home: the plan

The full plan, agreed with Kyle on 23/10/2026: https://claude.ai/artifact/GX1D5xV9s13qFhMVKpjjzA

## The shape

Home Assistant underneath, Beyond on top, the same move as Beyond Gateway (OpenWrt underneath).

- **The box:** Home Assistant OS on a Home Assistant Green or Raspberry Pi 5, with Beyond Home as a Home Assistant app (add-on) shown through ingress. Later sold already set up.
- **Beyond TV** is the screen: a Home widget and the TV remote driving the receiver.
- **Beyond Family** is the phone remote and control from away, through a connection the box makes outward. Grown-ups set it up; kids only get the buttons a grown-up gives them.
- **Beyond Gateway** finds the devices and can keep smart plugs and cameras on their own network.

## Stages

0. Prove it on Kyle's own kit (this repo, now).
1. The box and the Beyond app: rooms, the one remote, moments, setup that explains itself.
2. Beyond TV: the Home widget and the remote.
3. Beyond Family: phone remote, control from away.
4. Moments in plain words and local voice.
5. Gateway link and a box people can buy.
6. Beyond Box: Home, Music and Photos on one box.

## What NZ homes have

| Thing | Inside the house? |
|---|---|
| Yamaha receivers and MusicCast | Yes (Yamaha Extended Control) |
| Denon, Marantz, Sonos | Yes |
| Google TV and Android TV (Sony, TCL, Hisense) | Yes |
| LG and Samsung TVs | Yes, after the TV allows it once |
| Old gear with only infrared | With an IR blaster |
| Hue, IKEA, LIFX, Matter | Yes |
| Cheap Wi-Fi bulbs and plugs (Tuya based) | Cloud by default; steer to Matter |
| Mitsubishi heat pumps | Cloud by default; local with an adapter a technician fits |
| Daikin | Newer units yes |
| Panasonic, Fujitsu | Cloud; IR blaster as a fallback |

## The everything hub (Kyle, 23/10/2026)

Kyle widened the brief: energy, a sustainable home, the home on the TV, and every media brand linked in. It stays one
hub: Home Assistant already holds all of it, so these are new screens in the Beyond app, not new engines.

### Every media brand

The one remote already treats any `media_player` the same way, so a new brand is a Home Assistant integration plus
the right words, never new Beyond code. What works inside the house:

| Brand | How |
|---|---|
| Yamaha (receivers, MusicCast) | Yamaha Extended Control |
| Denon, Marantz (HEOS) | HEOS, local |
| Sonos | Local |
| Bose SoundTouch | Local; newer Bose speakers vary |
| Bluesound, NAD | BluOS, local |
| JBL (Authentics, newer Bar models) | Through Google Cast or AirPlay, when the speaker has it |
| Older JBL soundbars | No network control: HDMI-CEC from the TV or an IR blaster |
| Anything with Google Cast or AirPlay 2 | Cast is controllable; AirPlay 2 can be played to |

JBL is the honest one: it has no control of its own over the network, so what a JBL can do depends on whether that
model has Cast built in. The app should say so in plain words when somebody adds one.

### Energy and a sustainable home

Home Assistant's energy dashboard does the counting; Beyond shows it as one line and one choice.

- **What the house is using now** needs a meter that answers inside the house. NZ smart meters belong to the
  metering company and give no live feed to the home: retailers show half-hourly use a day late in their own apps.
  MBIE is exploring a consumer data right for electricity, which may change that; until then live use comes from:
  - a clamp monitor in the switchboard (Shelly Pro 3EM, Emporia Vue, IoTaWatt), **fitted by an electrician**;
  - a solar inverter or battery that reports locally (Fronius, SolarEdge, Enphase, Sungrow and others);
  - plugs that measure (Shelly, Tapo and Matter plugs) for single appliances.
- **The big NZ loads** are the hot water cylinder, heat pumps and an EV. Beyond can schedule what the family already
  controls (heat pumps, EV chargers with local control such as Wallbox and Zappi). Hot water on ripple control
  belongs to the lines company and is not ours to touch.
- **Sustainable, in plain words:** "Using a lot right now", "Sunny, the panels are covering the house", "The heat
  pump in the empty room is on". The NZ grid is mostly renewable already, so the useful nudge is cost and peak
  times on the family's own plan, not guilt.
- Never touch wiring, never change the power plan, and never claim a saving we can't measure.

### The home on the TV

Beyond TV owns the screens; Beyond Home owns the data and the calls. The TV gets the same snapshot the app uses
(rooms, what's on, energy now) and sends the same allow-listed calls, over the house network.

- The box gets a second door for the TV: the TV shows a code, somebody types it in the Beyond app (Settings, TVs),
  and the TV then holds its own secret (only a hash kept on the box), exactly the pattern Beyond Family uses for TVs.
  Ingress stays as it is. Built 23/10/2026 (`server/tvs.mjs`, port 8098): the TV never sends a service call, only a
  named ask the box turns into allow-listed calls.
- First screens on the TV: a Home row (rooms, one tap Moments), the one remote driving the receiver, and an energy
  card. A 3D view of the home comes later and borrows Beyond Family's house map once a house has one.

### Order

These slot into the stages above: more brands and the energy line come with stage 1 (the box and the app), the TV
door and Home row are stage 2, control from away stays stage 3.

## Setting it up (23/10/2026)

- **Today:** home.gobeyond.nz (the website's `/home/add`) opens the box's own `/_my_redirect` page that adds this
  repo as an app store, the same way Home Assistant's my.home-assistant.io links work. A web page on https can't see
  into the house, so it tries `homeassistant.local:8123` and takes a typed address otherwise, kept in that browser
  only. The repo must be public for the box to add it.
- **Next:** finding the box from the Beyond Family app on the phone (local network discovery, `_home-assistant._tcp`
  over mDNS), so nobody types an address. Needs the native apps' local network permission.
- **Later:** a pre-set box that arrives with Beyond Home already in it.
