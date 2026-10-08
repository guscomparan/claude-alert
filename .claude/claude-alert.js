#!/usr/bin/env node
/*
 * claude-alert — play a chime + spoken notice when Claude finishes a response,
 * or when it stops to ask you a multiple-choice question.
 *
 * Triggered by Claude Code hooks (see .claude/settings.json):
 *   Stop                          -> node claude-alert.js            ("I've finished with ...")
 *   PreToolUse on AskUserQuestion -> node claude-alert.js question   ("I've questions related to ...")
 * Cross-platform: works on macOS, Linux, and Windows. Runs on Node, which is
 * always present because Claude Code itself runs on Node — no extra install.
 *
 * ── CHANGE THE MESSAGE / VOICE HERE ──────────────────────────────────────────
 * Edit the DEFAULTS below, or override per-machine with environment variables:
 *   CLAUDE_ALERT_MESSAGE           spoken text when Claude finishes
 *   CLAUDE_ALERT_QUESTION_MESSAGE  spoken text when Claude asks a question
 *   CLAUDE_ALERT_VOICE             voice name (macOS `say -v '?'`, Windows installed voice)
 *   CLAUDE_ALERT_CHIME             sound file when Claude finishes (macOS/Linux only)
 *   CLAUDE_ALERT_QUESTION_CHIME    sound file when Claude asks a question (macOS/Linux only)
 *   CLAUDE_ALERT_SILENT            set to "1" to mute
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const DEFAULTS = {
  // 👇 Change the spoken message here (env var CLAUDE_ALERT_MESSAGE overrides it)
  message: "I've finished",
  // 👇 Spoken when Claude asks you a question with options (env CLAUDE_ALERT_QUESTION_MESSAGE)
  questionMessage: "I've questions",
  // 👇 Leave empty for the system default voice, or set a voice name
  voice: '',
  // 👇 Also speak the project folder name at the end (so you know WHICH project).
  //    Set to false to turn it off, or use env var CLAUDE_ALERT_NO_PROJECT=1
  announceProject: true,
  // 👇 Words spoken right before the folder name, e.g. "I've finished WITH claude alert".
  //    Leave empty ('') to just say the bare folder name.
  projectPhrase: 'with',
  // 👇 Same, for questions: "I've questions RELATED TO claude alert".
  questionProjectPhrase: 'related to',
};

if (process.env.CLAUDE_ALERT_SILENT === '1') process.exit(0);

const { spawn } = require('child_process');

// "question" mode is passed by the AskUserQuestion hook; anything else = finished.
const IS_QUESTION = process.argv[2] === 'question';

// If claude-alert is also installed globally (~/.claude), Claude Code runs the
// global hook AND this project's hook at the same time, and the two voices
// overlap into a robotic echo. In that case a project copy stays quiet and lets
// the global one speak.
function globalInstallWillPlay() {
  const fs = require('fs');
  const path = require('path');
  const home = path.join(require('os').homedir(), '.claude');
  if (path.dirname(path.resolve(__filename)) === home) return false; // we ARE the global copy
  try {
    const settings = fs.readFileSync(path.join(home, 'settings.json'), 'utf8');
    return settings.includes('claude-alert.js') && (!IS_QUESTION || settings.includes('AskUserQuestion'));
  } catch (_) {
    return false;
  }
}
if (globalInstallWillPlay()) process.exit(0);

const MESSAGE = IS_QUESTION
  ? process.env.CLAUDE_ALERT_QUESTION_MESSAGE || DEFAULTS.questionMessage
  : process.env.CLAUDE_ALERT_MESSAGE || DEFAULTS.message;
const VOICE = process.env.CLAUDE_ALERT_VOICE || DEFAULTS.voice;

// Figure out the project folder name from the path Claude Code provides, so the
// voice can tell you WHICH project just finished. Hyphens/underscores become
// spaces so it reads naturally (e.g. "claude-alert" -> "claude alert").
const ANNOUNCE_PROJECT =
  process.env.CLAUDE_ALERT_NO_PROJECT === '1' ? false : DEFAULTS.announceProject;

function projectName() {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const base = dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
  return base.replace(/[-_]+/g, ' ').trim();
}

// The full text the voice actually speaks.
const PROJECT_PHRASE = IS_QUESTION
  ? process.env.CLAUDE_ALERT_QUESTION_PROJECT_PHRASE ?? DEFAULTS.questionProjectPhrase
  : process.env.CLAUDE_ALERT_PROJECT_PHRASE ?? DEFAULTS.projectPhrase;

function projectSuffix() {
  const name = projectName();
  if (!name) return '';
  return PROJECT_PHRASE ? `${PROJECT_PHRASE} ${name}` : name;
}

const SPOKEN =
  ANNOUNCE_PROJECT && projectSuffix() ? `${MESSAGE} ${projectSuffix()}` : MESSAGE;

// Run a list of candidate commands, stopping at the first one that succeeds.
// A command that is missing (spawn error) or exits non-zero falls through to
// the next candidate. Calls done() when one succeeds or the list is exhausted.
function tryFirst(candidates, done) {
  const attempt = () => {
    const c = candidates.shift();
    if (!c) return done();
    let child;
    try {
      child = spawn(c.cmd, c.args, { stdio: 'ignore', windowsHide: true });
    } catch (_) {
      return attempt();
    }
    child.on('error', attempt);
    child.on('close', (code) => (code === 0 ? done() : attempt()));
  };
  attempt();
}

// Single-quote escape for PowerShell string literals.
const psQuote = (s) => s.replace(/'/g, "''");

const platform = process.platform;
const done = () => process.exit(0);

if (platform === 'darwin') {
  const chime = IS_QUESTION
    ? process.env.CLAUDE_ALERT_QUESTION_CHIME || '/System/Library/Sounds/Submarine.aiff'
    : process.env.CLAUDE_ALERT_CHIME || '/System/Library/Sounds/Glass.aiff';
  const sayArgs = VOICE ? ['-v', VOICE, SPOKEN] : [SPOKEN];
  // chime first, then speak
  tryFirst([{ cmd: 'afplay', args: [chime] }], () => {
    tryFirst([{ cmd: 'say', args: sayArgs }], done);
  });
} else if (platform === 'win32') {
  const selectVoice = VOICE ? `$s.SelectVoice('${psQuote(VOICE)}');` : '';
  const ps = [
    'Add-Type -AssemblyName System.Speech;',
    // question: two rising beeps; finished: one beep
    IS_QUESTION ? '[console]::beep(660,120); [console]::beep(990,150);' : '[console]::beep(880,150);',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    selectVoice,
    `$s.Speak('${psQuote(SPOKEN)}');`,
  ].join(' ');
  tryFirst(
    [
      { cmd: 'powershell', args: ['-NoProfile', '-Command', ps] },
      { cmd: 'pwsh', args: ['-NoProfile', '-Command', ps] },
    ],
    done
  );
} else {
  // Linux / other Unix
  const chime =
    (IS_QUESTION ? process.env.CLAUDE_ALERT_QUESTION_CHIME : process.env.CLAUDE_ALERT_CHIME) || '';
  const playChime = (next) => {
    if (!chime) return next();
    tryFirst(
      [
        { cmd: 'paplay', args: [chime] },
        { cmd: 'aplay', args: [chime] },
      ],
      next
    );
  };
  const speak = () =>
    tryFirst(
      [
        { cmd: 'spd-say', args: ['--wait', SPOKEN] },
        { cmd: 'espeak', args: [SPOKEN] },
      ],
      done
    );
  playChime(speak);
}
