# claude-alert 🔔

Make **Claude Code** play a **chime + spoken voice** ("Response finished, ready to
continue") every time it finishes a response — so you can look away and get pinged when
it's your turn again.

- ✅ **No API key, no account, no network.** Uses your operating system's built-in
  text-to-speech.
- ✅ **Cross-platform:** macOS, Linux, and Windows.
- ✅ **Project/folder level:** each project you install it into gets the alert; other
  projects are untouched.

---

## How it works

Claude Code can run a **"Stop" hook** — a command it executes automatically every time the
main agent finishes replying. This package wires that hook to a small Node.js script,
[`.claude/claude-alert.js`](.claude/claude-alert.js), which plays a chime and then speaks a
short message.

It's written in Node because Claude Code itself runs on Node — so `node` is guaranteed to
be available on every machine, with nothing extra to install. The script picks the right
sound tool for the OS automatically:

| OS | Chime | Voice |
|----|-------|-------|
| **macOS** | `afplay` | `say` |
| **Windows** | `[console]::beep` | PowerShell `System.Speech` |
| **Linux** | `paplay` / `aplay` | `spd-say` / `espeak` |

On Linux the voice tools (`spd-say` or `espeak`) may need to be installed; macOS and
Windows work out of the box.

---

## Install

You install claude-alert **into a project**. Do it once per project you want alerts in.

### macOS / Linux

```bash
# from inside this repo, install into another project:
./install.sh /path/to/your/project

# …or into the folder you're currently in:
cd /path/to/your/project
/path/to/claude-alert/install.sh .
```

### Windows (PowerShell)

```powershell
# from inside this repo:
.\install.ps1 C:\path\to\your\project

# …or into the current folder:
.\install.ps1
```

Then **restart Claude Code** in that project (or run `/hooks` to verify) and the alert
fires on the next response. The first time, Claude Code may ask you to approve the new
hook — approve it.

> **Tip — quick test:** install into a throwaway folder, open it in a new editor window,
> start Claude Code, and ask it anything. You'll hear the chime + voice when it finishes.

---

## Change the message (and voice)

You have two ways:

### 1. Edit the file (permanent default)

Open [`.claude/claude-alert.js`](.claude/claude-alert.js) and change the `DEFAULTS` block
near the top:

```js
const DEFAULTS = {
  message: 'Response finished, ready to continue',   // 👈 your text here
  voice: '',                                          // 👈 a voice name, or '' for default
  announceProject: true,                              // 👈 also say the project folder name
  projectPhrase: 'We are working on',                 // 👈 words before the folder name
};
```

### Knowing *which* project finished

By default the voice appends the **project folder name** at the end — e.g.
"Response finished, ready to continue. **We are working on my-api**". Handy when you have
several Claude Code windows open and want to know which one just finished without looking.
Hyphens and underscores are read as spaces (`my-api` → "my api").

- Change the connector words with `projectPhrase` (e.g. `'Estamos trabajando en'`), or set
  it to `''` to speak just the bare folder name. Env override: `CLAUDE_ALERT_PROJECT_PHRASE`.
- Turn the whole thing off with `announceProject: false`, or `CLAUDE_ALERT_NO_PROJECT=1`.

If you already installed it into a project, edit that project's copy at
`<project>/.claude/claude-alert.js` (the installer puts a copy there).

### 2. Environment variables (override without editing)

Set these before launching Claude Code — handy for trying things or per-machine tweaks:

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLAUDE_ALERT_MESSAGE` | `Response finished, ready to continue` | spoken text |
| `CLAUDE_ALERT_VOICE` | system default | voice name (see below) |
| `CLAUDE_ALERT_CHIME` | OS default sound | chime sound file (macOS/Linux) |
| `CLAUDE_ALERT_SILENT` | `0` | set to `1` to mute |
| `CLAUDE_ALERT_NO_PROJECT` | `0` | set to `1` to **not** speak the project folder name |
| `CLAUDE_ALERT_PROJECT_PHRASE` | `We are working on` | words spoken before the folder name (`''` = none) |

**Finding voice names:**
- macOS: `say -v '?'` (e.g. `Samantha`, `Daniel`, `Karen`)
- Windows: voices installed under Settings → Time & Language → Speech

Example (macOS):
```bash
export CLAUDE_ALERT_MESSAGE="all done, boss"
export CLAUDE_ALERT_VOICE="Samantha"
```

---

## Test it manually

You don't need Claude Code to test the sound — just run the script directly:

```bash
node .claude/claude-alert.js        # macOS / Linux
node .\.claude\claude-alert.js      # Windows
```

You should hear the chime followed by the spoken message.

---

## Uninstall

In the project you installed it into:

1. Delete `<project>/.claude/claude-alert.js`
2. Remove the `"Stop"` block from `<project>/.claude/settings.json`

---

## Want a fancier AI voice? (optional, needs an API key)

The built-in OS voices are robotic. If you'd rather have a natural voice (ElevenLabs,
OpenAI TTS, etc.), that's the **only** case where you'd need an API key. Replace the
`say` / PowerShell speech call in `claude-alert.js` with a request to the TTS API and play
the returned audio. The hook wiring stays exactly the same — only the "speak" step changes.
