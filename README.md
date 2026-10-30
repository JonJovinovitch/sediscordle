# SeDiscordle

16 Wordles at once (Sedecordle style), no guess limit, same daily puzzle for everyone, played as a Discord Activity right inside your server.

**New here? Open `SETUP-GUIDE.md`. It walks you through everything step by step.**

## What's in it

- **Sedecordle style, no guess limit:** 16 boards, and every guess goes onto every board. Keep guessing until all 16 are solved.
- **Scoring:** fewer guesses is better. Time breaks ties.
- **Hard mode:** pick it before your first guess. You get 60 seconds per guess. If time runs out, a wasted guess gets added to your count. Hard runs get a HARD tag on the leaderboard.
- **Same daily puzzle for everyone.** The new one starts at midnight (US Eastern by default).
- **Per-server leaderboards:**
  - **Today:** everyone who finished today's puzzle
  - **All-Time Best:** each player's best game ever, with the date
  - **Win Streaks:** days in a row you solved all 16 (plus your best ever)
  - Today and All-Time Best can be ranked **Overall** (guesses, then time), by **Fewest Guesses**, or by **Fastest**.
- **Shuffle button:** mixes up where the 16 boards sit on screen, just for looks.
- **Solve celebration:** each solved board pops, throws confetti, and plays an excited squeal. There's a sound on/off button.
- **Orange and green theme:** green means right spot, orange means right letter in the wrong spot.
- **The server does the scoring.** The answers never get sent to players until they finish, and the clock starts on your first guess and stops on the server, so times can't be faked.
- **Fair across servers:** you get one game per day. If you're in several servers, your result counts on every one of their leaderboards.

## How it's built

| Part | What |
|---|---|
| `client/` | The game screen (React + Vite + Discord Embedded App SDK) |
| `server/index.js` | Web server (Express): Discord login, guesses, leaderboards |
| `server/puzzle.js` | The rules: picking the daily words and coloring tiles |
| `server/db.js` | Postgres tables (created automatically on first start) |
| `server/data/` | Word lists (2,315 possible answers, 14,855 allowed guesses) |
| `railway.json` | Tells Railway how to build and start it |

## Settings (Railway → Variables)

| Name | Needed? | What |
|---|---|---|
| `DISCORD_CLIENT_ID` | yes | Discord Developer Portal → OAuth2 |
| `DISCORD_CLIENT_SECRET` | yes | Discord Developer Portal → OAuth2 |
| `DATABASE_URL` | yes | `${{Postgres.DATABASE_URL}}` |
| `PUZZLE_TIMEZONE` | no | When the new puzzle drops. Default `America/New_York` |
| `PUZZLE_SECRET` | no | Made for you automatically and saved in the database |
| `ALLOW_DEV_LOGIN` | no | `true` lets you play in a normal browser for testing. Keep it off for real use |

## Running it on your own computer (optional)

```
npm install
DATABASE_URL=postgres://... ALLOW_DEV_LOGIN=true npm run dev
```
Then open http://localhost:5173.
