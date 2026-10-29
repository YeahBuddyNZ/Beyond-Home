# 0002: Albums can be kept on the phone to play away from home

- **Date:** 29/10/2026
- **Decided by:** Kyle ("Yes please" to offline copies, 29/10/2026)
- **Status:** Accepted

## What we decided

In the Beyond Home phone app, an album has **Keep on this phone**. Its songs and cover are copied from the
household's own box to the phone, and the Music tab plays them when the box can't be reached. Away from home, the
Music tab shows only the kept albums and says so. **Let go** takes an album off the phone.

## Why

The music is the household's own, and it should come with them in the car and on the walk to school. Until now the
phone only played on the home Wi-Fi.

## How

- The copies live in the app's own storage on that phone (IndexedDB, `web/src/offline.ts`). Nothing goes anywhere
  else, and the box's screens never keep anything: only the phone app (and `?preview`) has the button.
- They are only ever copies of what the box holds. Each time the phone reaches the box, an album the box no longer
  has goes from the phone too (`keptGone` in `lib.js`), so a sold or given away CD (Beyond Music's "I sold this CD",
  section 81A) leaves the phone as well. A box that answers with no albums at all never wipes the phone.
- The song files come through the box's house door like any song (`home.songFile`), one at a time, and are saved
  together only once every song has come across.
- The phone is asked to keep them (`navigator.storage.persist`). A full phone says so in plain words.

## What it doesn't do

Radio stays at home (its list comes through the box). Playlists aren't kept yet, only albums. Nothing is shared
with anybody outside the household.
