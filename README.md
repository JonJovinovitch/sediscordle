# SeDiscordle

16 Wordles at once (Sedecordle rules), 21 guesses, same daily puzzle for everyone, played as a Discord Activity right inside your server.

**New here? Open `SETUP-GUIDE.md`. It walks you through everything step by step.**

## What's in it

- **Same rules as Sedecordle:** 16 boards, 21 guesses, and every guess goes onto every board.
- **Hard mode:** pick it before your first guess. You get 60 seconds per guess, and if time runs out that guess is burned. Hard runs get a HARD tag on the leaderboard.
- **Same daily puzzle for everyone.** The new one starts at midnight (US Eastern by default).
- **Per-server leaderboards:**
  - **Win Streaks:** days in a row you solved all 16 (plus your best ever)
  - **Fastest Ever:** each player's quickest full win, with the date they did it
  - **Today:** everyone's results on today's puzzle
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
