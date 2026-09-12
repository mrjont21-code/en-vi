# WebDich v0.9.4 — Voice → Text → Translate → TTS (siêu tốc)
Bilingual real-time voice translator. Major latency reduction in v0.9.4:
**single-ASR auto-switch**, **early-commit 0ms**, **race Google∥MyMemory**,
**speculative translate**, **LRU cache**.

## Target latency budget (v0.9.4)
```
LIVE chữ          < 200ms   (interim ASR)
FINAL cột         < 400ms   (early-commit on diacritics/strong score)
TRANSLATION hiện  < 600ms   (race + speculative + cache)
TTS bắt đầu       < 800ms   (pause-trigger, no 2s chunk wait)
```

## Features
- **Single-ASR default**: one `SpeechRecognition` with auto language switching
  (2 consecutive same-language wins → switch `lang`). Chrome cannot reliably run
  two instances simultaneously; this eliminates the Chrome-fight loop.
- **Dual mode** still available via `state.dualMode = true` (explicit only).
- **Early-commit**: VI with diacritics or score ≥ 1.4 commits immediately (0ms).
  Max dual-wait reduced 700→**180ms**. No `lockUntil` blind-drop.
- **Race translation**: Google + MyMemory fire **simultaneously**, first good
  wins. 400ms timeout via `AbortController`. Identity rejection (output === input
  from `sl=auto` misdetect) → treated as failure.
- **`sl=from` by default**: `sl=auto` only when `detectLanguage === unknown`.
- **LRU cache** (200 entries): repeated phrases = 0ms, 0 network.
- **Warm connection**: tiny probe fires on mic-start; `preconnect` in HTML.
- **Speculative translate**: debounce 400→**120ms**; interim translates start earlier.
- **Pause-triggered TTS**: ASR `onend` + 400ms silence finalizes the row (no
  need to wait for 2s chunk). Chunk 2s remains as safety net only.
- **TTS Bug A fix**: callback checks `cell._row.finalized`, not `state.activeRow`.
  Row A finalized while user speaks row B → A still gets spoken.
- **Idioms v0.9.4**: keys AND input normalized by same function; contractions
  expanded only when genuine (`don't`, `it's`); `were`/`its` (possessive) not
  mangled; `one` is NOT a wildcard; `someone/something/anyone` are wildcards.
- **Channel toggle**: off channels stay off; `onend` respects `state.channel`.
- **`ttsSpeaking` safety**: reset on mic start/stop + 30s unstick timeout.
- **Mobile CSS**: `100dvh` wins, `env(safe-area-inset-bottom)` for notched devices.

## Files
```
webdich-0.1/
├── index.html          # preconnect to translate APIs, v0.9.4 title
├── style.css           # 100dvh + safe-area
├── manifest.json       # PWA v0.9.4
├── icon.svg
├── README.md
├── js/
│   ├── state.js        # +asrLang, +recSingle, +dualMode (default false)
│   ├── text.js
│   ├── language.js     # VI_DIACRITIC_RE uppercase-aware (TÔI, ĐẸP)
│   ├── idioms.js       # v0.9.4 normalize + wildcards
│   ├── asr.js          # +startSingle() for single-ASR mode
│   ├── translation.js  # race+timeout+identity+LRU+warm
│   ├── tts.js          # safety unstick timeout
│   ├── ui.js
│   └── app.js          # v0.9.4 controller: early-commit, single-ASR, Bug A fix
└── test/
    ├── fake-asr.js
    ├── pipeline.test.js    # 51 asserts (37 legacy + 14 v0.9.4) — ALL PASS
    └── fake-speech-test.js # 18 asserts — ALL PASS
```

## Run
```bash
cd webdich-0.1
python3 -m http.server 8080
# http://localhost:8080
```
Best: **Chrome / Edge (desktop or Android)**.

## Tests
```bash
node test/pipeline.test.js      # 51/51 PASS
node test/fake-speech-test.js   # 18/18 PASS
```

## v0.9.4 Fixes & Improvements (from v0.9.3 QA)

### Bug A (regression) — TTS of finalized row swallowed when user continues speaking
- **Root cause**: `onTranslatedDisplay` checked `!state.activeRow.finalized` instead of the
  cell's own row. Row A's translation callback arrives after row B became active → A silent forever.
- **Fix**: Each cell carries `cell._row` reference. Check `!cell._row.finalized`.
- **Test AA** added.

### Dual-wait 700ms made live slow
- **Fix**: `shouldEarlyCommit()` — VI diacritics or score ≥ 1.4 → commit **0ms**.
  Max dual-wait 700→**180ms**. Removed `lockUntil` blind-drop entirely.
- **Test BB** added.

### Idiom normalize broke keys
- **Fix**: BOTH keys AND input normalized by the SAME function. Contractions only
  expanded when genuinely contracted (`don't`, `it's` with apostrophe). `were`
  (past tense) and `its` (possessive) untouched. `one` not a wildcard.
  Wildcards: `someone/somebody/something/anyone/anybody/anything`.
- **Tests DD, EE, FF, GG, HH** added.

### Fallback waterfall = slow + double-failure prone
- **Fix**: Google + MyMemory **RACE** (simultaneous). First good wins.
  400ms timeout via `AbortController`. Identity rejection (`src === out` from
  `sl=auto` misdetect) → fallback. `sl=from` by default. Last-resort retry
  with `sl=auto` if both fail.
- **Test CC** added.

### Claim "single-recognizer fallback" not in code
- **Fix**: Implemented. Default mode = **single `SpeechRecognition`** with
  `state.asrLang`. After 2 consecutive same-language wins, recognizer restarts
  with new `lang`. `onSingleResult` → `detectLanguage` → route directly.
  Dual mode only via `state.dualMode = true` (explicit opt-in).

### Speculative translate + cache
- **Fix**: Debounce 400→**120ms**. LRU cache 200 entries. Warm connection on
  mic-start. `preconnect` hints in HTML.
- **Test II** added.

### `VI_DIACRITIC_RE` uppercase
- **Fix**: Full uppercase diacritic set added. `"TÔI MUỐN"`, `"ĐẸP"` → strong VI.
- **Test JJ** added.

### Bundle cleanup
- Removed stale `webdich-v0.9.2.html`.
- All version strings: README, HTML title, manifest, `VERSION` constant → **v0.9.4**.
