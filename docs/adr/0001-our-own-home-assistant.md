# 0001: Beyond Home becomes our own build of Home Assistant

- **Date:** 27/10/2026
- **Decided by:** Kyle
- **Status:** Accepted

## What we decided

Beyond Home stops being an app added to an unchanged Home Assistant and becomes our own build of it: our name, our
look, our app as the first screen, our first-run, our updates. Home Assistant's code stays underneath, so every brand
it talks to keeps working.

The full plan: https://claude.ai/artifact/Vbt2RoxWPQL74vRuJXz3em

## Why

Families should meet Beyond Home, not Home Assistant. Today they install Home Assistant first, find its app store,
add our repository and open us from a side panel. That is four steps nobody non-technical gets through. With our own
build they flash one file to a Raspberry Pi or a Home Assistant Green, or buy a box already set up, and Beyond Home is
what opens.

## How

- **Four forks under YeahBuddyNZ, all kept Apache 2.0:** `beyond-home-os` (home-assistant/operating-system),
  `beyond-home-supervisor`, `beyond-home-frontend` and `beyond-home-core`.
- **Change what a person sees, and as little of the engine as possible.** The image, the screens and the first-run are
  ours. Core gets a few small patches: the product name in what people read, New Zealand defaults, no nudges toward
  Home Assistant's cloud.
- **Our changes are a short stack of patches**, one per idea, put back on top of each monthly Home Assistant release.
  Their security fixes go out the same week. A release reaches Kyle's own box first, then everyone a few days later.
- **The name and logo are not ours to use.** "Home Assistant" is the Open Home Foundation's trade mark and Apache 2.0
  gives no trade mark rights, so nothing a family sees carries it. A plain credit ("Built on Home Assistant") goes in
  Settings, About and on the website, checked against their brand guidelines first.
- **Every fork keeps their licence and notices**, adds our copyright beside theirs, and lists our patches in
  `CHANGES-BEYOND.md`. This repository's own app stays GPL-3.0, a separate program as now.
- **The way back stays:** Home Assistant's own screens under Settings, Advanced, and plain Home Assistant reads the same
  backup.

## In order

1. This record, and the four forks, untouched.
2. The image: our name, `beyond-home.local` on the network, our app store, this app already installed.
3. The first screen and first-run.
4. Words and defaults in core.
5. Signed updates from our server, the monthly merge and a monthly test run.
6. The website and README change in the same pull request as the first image people can download; gobeyond.nz/home/add
   looks for `beyond-home.local`.
7. Kyle's spare box first, before anyone else's.

Until the first image ships, the add-on keeps working exactly as it does today.

## What it costs

A merge each month (about a day when nothing big moved; an estimate until we have done a few), and we become the people
who ship security fixes to every box.
