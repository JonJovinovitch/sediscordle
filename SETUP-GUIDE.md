# SeDiscordle Setup Guide (the easy version)

You'll put the game on **GitHub**, which is where the code lives. Then **Railway** runs it on the internet, and **Discord** shows it inside your server.

You don't need to install anything or type any code. It's all clicking, copying and pasting. It takes about **20 minutes**.

---

## Before you start, you need:

- ✅ The **sediscordle.zip** file (this folder)
- ✅ A **GitHub** account → github.com
- ✅ A **Railway** account → railway.com (just click "Login with GitHub")
- ✅ A **Discord** account, and a server where you're the owner or an admin
- ✅ A notes app open, so you can paste things in it to keep them for later

---

## STEP 1: Unzip the folder

1. Find **sediscordle.zip** on your computer.
2. Double-click it. You'll get a folder called **sediscordle**.
3. Open that folder. You should see stuff like `client`, `server`, `package.json`, `README.md`.

---

## STEP 2: Put the code on GitHub

1. Go to **github.com** and log in.
2. Click the **+** at the top right, then **New repository**.
3. In **Repository name**, type: `sediscordle`
4. Pick **Private**. That way only you can see it.
5. Click the green **Create repository** button.
6. On the next page, find the little link that says **"uploading an existing file"** and click it.
7. Go to your **sediscordle** folder. Select **everything inside it** (on a Mac: click a file, then press **Cmd + A**).
   - ⚠️ Drag the stuff **inside** the folder, not the folder itself.
8. **Drag all of it** onto the GitHub page.
9. Wait until all the files show up in the list.
10. Scroll down and click the green **Commit changes** button.

🎉 Your code is on GitHub now.

---

## STEP 3: Make your Discord app

1. Go to **discord.com/developers/applications** and log in.
2. Click **New Application** (top right).
3. Name it `SeDiscordle`, check the box, and click **Create**.
4. On the left, click **OAuth2**.
5. Find **Client ID** and click **Copy**. Paste it in your notes and label it **CLIENT ID**.
6. Find **Client Secret** and click **Reset Secret**, then **Yes, do it!**, then **Copy**. Paste it in your notes and label it **CLIENT SECRET**.
   - 🤫 This one is a password. Don't share it with anybody.
7. On that same page, find **Redirects** and click **Add Redirect**. Type:
   `https://127.0.0.1`
8. Click **Save Changes** (the green bar at the bottom).

---

## STEP 4: Run it on Railway

### 4a: Start the project

1. Go to **railway.com** and log in with GitHub.
2. Click **New Project** (or **+ New**).
3. Click **Deploy from GitHub repo**.
4. Pick **sediscordle**.
   - Don't see it? Click **Configure GitHub App** and give Railway access to the `sediscordle` repo, then come back and pick it.
5. Railway will try to start it, and **it's going to crash the first time.** That's normal, because we haven't given it its settings yet. Keep going.

### 4b: Add a database (where the leaderboards get saved)

1. In your Railway project, click **+ Create** (or right-click the empty space).
2. Click **Database**, then **PostgreSQL**.
3. Wait until you see a box called **Postgres** next to your sediscordle box.

### 4c: Give it its settings

1. Click on the **sediscordle** box (not the Postgres one).
2. Click the **Variables** tab.
3. Click **+ New Variable** and add these **3** things, one at a time:

| Name (type this exactly) | Value |
|---|---|
| `DISCORD_CLIENT_ID` | paste your **CLIENT ID** from your notes |
| `DISCORD_CLIENT_SECRET` | paste your **CLIENT SECRET** from your notes |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |

   - For `DATABASE_URL`, type it **exactly** like that, curly brackets and all. That's how it hooks up to the database.
4. Click **Deploy** (or **Apply changes**). Wait until the box says **Active** or **Success** ✅. It can take 1 to 3 minutes.

### 4d: Get your game's web address

1. Still in the **sediscordle** box, click the **Settings** tab.
2. Scroll down to **Networking**, then click **Generate Domain**.
   - If it asks for a port, type `8080` or just take the number it suggests.
3. You'll get an address that looks kind of like this:
   `sediscordle-production-abcd.up.railway.app`
4. **Copy it** and paste it in your notes. Label it **MY DOMAIN**.

✅ **Quick test:** open a web browser and go to `https://` + MY DOMAIN + `/api/config`
   Example: `https://sediscordle-production-abcd.up.railway.app/api/config`
   If you see some text with your client ID in it, you're good!

---

## STEP 5: Hook Discord up to your game

Go back to **discord.com/developers/applications** and click your **SeDiscordle** app.

### 5a: URL Mapping (this tells Discord where your game lives)

1. On the left, click **Activities**, then **URL Mappings**.
2. In **PREFIX**, type: `/`
3. In **TARGET**, paste **MY DOMAIN**.
   - ⚠️ **Don't** put `https://` in front. Just the address by itself, like `sediscordle-production-abcd.up.railway.app`
4. Click **Save Changes**.

### 5b: Turn Activities on

1. On the left, click **Activities**, then **Settings**.
2. Flip on **Enable Activities**.
3. Click **Save Changes** if it asks.

### 5c: Add it to your server

1. On the left, click **Installation**.
2. Under **Installation Contexts**, check **Guild Install** (and **User Install** too if you want).
3. Under **Install Link**, pick **Discord Provided Link**. Click **Copy**.
4. Click **Save Changes**.
5. Paste that link in your web browser and open it.
6. Pick **Add to Server**, choose your server, and click **Authorize**.

---

## STEP 6: PLAY 🎮

1. Open Discord and go to your server.
2. Either join a **voice channel**, or go to any **text channel**.
3. Click the **App Launcher** button. It's the 🚀 rocket or little shapes icon, near where you type messages or in the voice call bar.
4. Find **SeDiscordle** and click it. (Not showing? Type "SeDiscordle" in the search box.)
5. The first time, Discord asks if it's OK. Click **Authorize**.
6. Start typing words! 🟩🟨

**How the game works:**
- You've got **16 boards** and **no guess limit**. Every guess goes on all 16 boards. Keep going until all 16 are solved.
- **Scoring:** fewer guesses is better. If two people tie, the faster time wins.
- Everybody gets the **same 16 words** each day. A new puzzle drops at **midnight Eastern time**.
- Your **clock starts on your first guess**.
- 🔥 **Hard mode:** before your first guess, hit the orange **Hard mode** button. You get **60 seconds per guess**. If the clock runs out, a wasted guess gets added to your count and the next 60 seconds start. Hard-mode runs get a **HARD** tag on the leaderboard.
- 🔀 **Shuffle** moves the boards around on your screen. 🔊 turns the solve sound on or off.
- Hit 🏆 **Leaderboard** to see your server's:
  - **Today:** everyone who finished today
  - **All-Time Best:** everyone's best game ever, and the date
  - **Win Streaks:** most days in a row winning
  - On Today and All-Time Best, pick **Overall** (guesses, then time), **Fewest Guesses**, or **Fastest**.

---

## STEP 7: Let your friends play

Discord limits apps that are brand new and haven't been reviewed (Discord calls that "verified") yet. If your friends **can't see it**:

1. Go back to the Developer Portal and click your app.
2. On the left, click **App Testers**.
3. Add your friends by their Discord username. They have to be on your friends list.
4. They need to **accept the invite** from their email.

Also, for now it only works in servers with **fewer than 25 people**. Bigger servers have to wait until Discord verifies your app.

---

## 🆘 Something's not working?

| What you see | What to do |
|---|---|
| Railway says **Crashed** or **Failed** | Click the sediscordle box → **Deployments** → **View Logs**. If you see `DATABASE_URL is missing`, go redo **Step 4c**. Spelling counts! |
| In Discord, the game screen is **blank** or **won't load** | Check **Step 5a**. TARGET has to be your Railway address with **no** `https://` and no `/` at the end. |
| It says **"Discord login didn't work"** | Your Client Secret is wrong or old. Redo **Step 3, number 6**, paste the new secret into Railway (Step 4c), then close and reopen the game. Also make sure you did **Step 3, number 7** (the `https://127.0.0.1` redirect). |
| Opening the Railway address in a browser says **"Open this game from inside Discord"** | That's normal! The game only runs inside Discord. |
| You can't find SeDiscordle in the App Launcher | Make sure you did **5b** and **5c**. Fully quit Discord and open it again. |
| You want the new puzzle at a different time | In Railway Variables, add `PUZZLE_TIMEZONE`. Examples: `America/Chicago`, `America/Los_Angeles`, `Europe/London` |

---

## Changing the game later

Whenever you change a file on GitHub (click the file, click the ✏️ pencil, edit, then **Commit changes**), Railway **automatically** updates the game in a minute or two. You don't have to do anything else.
