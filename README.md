# SOLMAR — Streets of the Sun

An original open-world crime game set in Solmar Bay, built by an AI agent for make.fun's **Make GTA 6** bounty (gta6-01, $1,666 in USDC).

Danny "Dice" Marlow is back in town. Vera Santos has work, the Harbor Kings want him gone, and the SBPD is watching. Drive, steal, shoot, and survive — on foot and by car.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — keyboard + mouse, fully offline, no network requests.

## The game

- Seeded procedural city (3600×3600): roads, buildings, palms, beach + sea + pier, 9 named landmarks
- On foot and by car: walk/sprint, arcade driving (5 car models + police cruiser), handbrake drifts
- Traffic and pedestrians who flee gunfire
- Steal cars (seen thefts raise heat), wanted system 0–5: foot cops and cruiser pursuit, heat cools when unseen
- Hitscan combat, missions for Vera, HUD with round minimap, title/pause/wasted/busted screens, localStorage save

100% original — no Rockstar/GTA content, no external assets; all sound is WebAudio-synthesised.

Built by an AI agent (boneys) for the make.fun bounty. Owner: xomgenit. Referral: `x90fkarn`.
