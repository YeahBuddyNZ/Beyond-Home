# 0004: The box can show the house in Apple Home, off until somebody taps it

- **Date:** 18/11/2026
- **Decided by:** Kyle ("Yes please", "All the options to make it easy", 19/11/2026 NZ time), after asking about the Apple HomeView as a controller
- **Status:** Accepted

## What we decided

Settings has an **Apple Home** card. Tap **Show in Apple Home** and the things in the family's rooms appear in Apple's
Home app, so an Apple HomeView on the wall, an iPhone, an iPad, an Apple Watch and Siri can all run them. Each room's
moments come too, as buttons ("Lounge Movie night"), so "Hey Siri, Lounge Movie night" works. The box stays the brains:
Apple's screens are another remote, like Beyond TV.

## Why

Plenty of NZ homes already live in Apple's world, and Apple now sells a screen for the wall (Apple HomeView, NZ$599). We
can't put our own system on Apple's hardware, and don't need to: Home Assistant already speaks Apple's HomeKit.

## How

- It is Home Assistant's own HomeKit Bridge, set up by the box through Home Assistant's API (`server/apple.mjs`): one
  bridge, only the kinds of things Beyond Home shows, narrowed to the things that are in a room. A thing nobody has put
  in a room stays out.
- Moments are Home Assistant buttons the box makes (`input_button.beyond_<room>_<moment>`), one per room and moment
  that fits it, kept in step with **Update Apple Home**. Pressing one tells the box, which builds the calls from the
  room as it is right then with `momentCalls`, and every call passes `allow.mjs`, exactly like a tap in the app.
- The card shows the eight digit code and Home Assistant's QR code to scan with an iPhone's camera, then "In Apple
  Home" once it is added.
- **Take out of Apple Home** removes only the bridge and the buttons this box made, nothing else in Home Assistant.
- Nothing goes to the internet for this: HomeKit works inside the house. Away from home, and Siri, need an Apple home
  hub (an Apple HomeView, an Apple TV or a HomePod); that is Apple's doing, not ours.

## What it doesn't do

- Locks, cameras and alarms stay out, as everywhere else in Beyond Home.
- Apple Home only sees what Home Assistant's HomeKit Bridge can show: lights, switches, fans, blinds, heat pumps and TVs
  mostly; a receiver's input and volume follow Apple's own rules.
- Apple starts everything in one room; the family moves each thing into its room once in the Home app.
- Not yet tried on a real Home Assistant box or with a real iPhone. Needs Node with WebSocket on the box (Node 22).
