# 0003: The box can link to Beyond Family, off until somebody taps Link

- **Date:** 18/11/2026
- **Decided by:** Kyle ("start linking them all", 18/11/2026), with Beyond Family's ADR 0045
- **Status:** Accepted

## What we decided

Settings has a **Link to Beyond™ Family** card. Until somebody taps it, the box says nothing to the internet, as
before. Tapped, the box shows a six letter code; a grown-up types it in the Beyond Family app (Family, Your home).
From then on the grown-ups in that household can see the rooms from anywhere and ask for the same named things a TV
can: a moment, the volume, mute, power, or one thing on or off.

## Why

Leaving the house with the heat pump on, or the kids' TV still loud at bedtime while you're out, is the most common
reason to want your home in your pocket. Beyond Family already knows who the grown-ups are, so it is the right door.

## How

- It works like a TV linking to Beyond Family: the box says hello and keeps a secret in `/data/family.json` (only its
  hash is kept by Beyond Family), shows the code, then holds a long sync open to Beyond Family and waits for asks
  (`server/family.mjs`). The box always calls out; nothing reaches in, so no port is opened on the router.
- An ask is a name, never a Home Assistant call. The box builds the calls itself with `tvCalls` and every one passes
  `allow.mjs`, the same list a TV uses.
- What goes to Beyond Family is the TV snapshot: rooms, their line, moments, the remote's name, volume and on or
  off, and things on or off. Never what is playing (`KEEP` in `snapshot.mjs`), and never an entity id or address.
- From Beyond Family the box keeps only the household's name and each person's first name, colour and whether
  they are a kid (`cleanHome`), for later screens. Nothing else is kept.
- Unlink on the box, or in Beyond Family, and the secret is forgotten at once. A box Beyond Family no longer knows
  answers 401 and forgets it too.
- With the internet down everything in the house carries on; the box just tries again, slower each time, up to every
  five minutes.

## What it doesn't do

- No cameras, locks or alarms from away. Those need their own decision.
- Kids never get it: Beyond Family shows Your home to grown-ups only.
- Not yet tried against a real Home Assistant box.
