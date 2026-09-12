# WebDich v0.9.5 — Voice → Text → Translate → TTS (siêu tốc)
Bilingual real-time voice translator. All v0.9.4 QA gaps addressed.

## Measured latency budget (v0.9.5)
```
LIVE chữ          < 200ms   (interim ASR)
FINAL cột         < 400ms   (early-commit 0ms for VI diacritics / EN stopword-dense)
TRANSLATION hiện  < 500ms   (phrasebook=0ms, cache=0ms, race p50≈250ms, speculative=overlap)
TTS bắt đầu       < 700ms   (onspeechend + 280ms, NOT chunk 2000ms)
```

## What's new in v0.9.5 (from v0.9.4 QA)

### P0 — Default language + unsigned VI detection
- **`asrLang` default = `vi-VN`** (detected from `navigator.language`; falls back to `vi-VN` for `html lang="vi"` audience).
- **Persists to `localStorage.wdAsrLang`** on every language adaptation — user's preferred ASR language sticks across reloads.
- **Unsigned VI lexicon** (~100 common words: `toi, muon, khong, chao, den, lam, duoc, nguoi...`) added to `classifyWord3` as **strong VI** signals.
- `candidateScore()` gains +0.5 weighted bonus for unsigned VI words — en-US ASR output of Vietnamese speech is now correctly classified as VI, so `adaptAsrLanguage` actually reaches 2-streak and switches to `vi-VN`.
- **Tests LL, PP** verify.

### P0 — Realistic timeouts + loser-abort
- **Google timeout: 800ms** (was 400ms — measured 389ms in datacenter; 3G/Wi-Fi weak needs headroom).
- **MyMemory timeout: 1500ms** (measured p50 ~900ms; 400ms was aborting every single request).
- When a good result arrives, the **loser is `AbortController.abort()`-ed** (saves bandwidth + MyMemory daily quota).
- **Exception**: if Google fails with `identity` (output === input from `sl=auto` misdetect), MyMemory is **NOT** aborted — it still has a chance to win.
- `warmConnection()` now only warms Google (saves MyMemory 1k words/day free quota).
- **Last-resort retry**: both fail → one more try with `sl=auto`.

### P0 — `onend` identity check (no double-start, no silence gap)
- `singleHandlers.onend` only nulls `state.recSingle` **if `state.recSingle === thisRecognizer`** (identity check via closure).
- `adaptAsrLanguage`: sets `state.asrLang`, persists, then calls `recSingle.stop()`. The old recognizer's `onend` fires, sees it's still the active one → nulls it → `scheduleRestart()` → `doRestart()` → `startSingleRecognizer()` with new `asrLang`. **One clean restart, not two.**

### P1 — `onspeechend`-triggered TTS (not `onend`, not chunk 2s)
- **`onspeechend`** (actual user stopped talking) → 280ms grace → `finalizeRow()` → TTS.
- **`onspeechstart`** clears the pause timer if user resumes.
- `onend` is now purely for engine restart coordination.
- Chunk 2000ms remains as safety net only.
- **`asr.js`**: `makeRecognizer` now wires `onspeechend`, `onspeechstart`, `onaudioend` when provided.

### P1 — Speculative interim translate
- When interim is **≥ 3 words** and **stable for 150ms** (unchanged), fires `translation.translate()` in background.
- If speculative result arrives before final and the final text matches → `cell.trans` pre-filled, UI shows translation instantly.
- If final differs → normal translate flow takes over (request-id guard prevents stale writes).

### P1 — Idiom ASR-contraction support
- Chrome almost never outputs apostrophes. Normalize pipeline now handles:
  - **Wildcard possessive first**: `someone's → someone` (before punctuation strip, so apostrophe is visible)
  - Genuine contractions with apostrophe (existing behavior)
  - Punctuation strip
  - **Bigram fix**: `its not → it is not` (only when `its` immediately precedes `not`; standalone `its` stays possessive)
  - **ASR contractions** (no apostrophe): `dont→do not, doesnt→does not, didnt→did not, isnt→is not, wont→will not, cant→cannot, couldnt→could not, shouldnt→should not`
  - **Wildcard plural forms**: `someones→someone, anyones→anyone` (ASR quirk for possessives without apostrophe)
  - `"were"` stays as past tense, **never** expanded to `"we are"`.
- **Result**: `"its not rocket science"`, `"dont judge a book..."`, `"pull my leg"` all match correctly on real mic input.
- **Tests MM, NN, OO** verify.

### P1 — Phrasebook 80 common travel phrases
- ~80 EN↔VI pairs (greetings, directions, transport, hotel, food, emergencies, shopping, time, polite phrases).
- Checked **before** cache and network → **0ms, 0 network**.
- Covers ~20–40% of typical travel dialogue repeats.
- **Test KK** verifies.

### P1 — LRU cache → `localStorage` persistence
- Cache hydrates from `localStorage.wdTransCache` on boot (max 200 entries).
- Persists (debounced 1s) after every successful translate.
- User's common phrases from previous sessions are instant on reload.

### Minor
- **`ttsSpeaking = true` immediately** in `speak()`, not waiting for `onstart` (closes 100–300ms echo leak window).
- Early-commit: EN with **stopword ratio ≥ 0.7 and ≥ 3 words** also commits at 0ms (Chrome often returns `confidence=0`; stopwords are a reliable signal even without conf).
- **Test QQ** verifies.

---

## Files changed since v0.9.4
- `js/state.js` — default `asrLang` from `navigator.language`/`localStorage`, `_persistAsrLang`, `speculativeTimer`, `lastStableInterim`
- `js/language.js` — `VI_UNSIGNED` lexicon, `countUnsignedVi()`, bonus in `candidateScore`
- `js/translation.js` — per-provider timeouts (800/1500), loser-abort, phrasebook, localStorage cache persist/hydrate, warm Google only, identity-skip-abort
- `js/app.js` — `VERSION=v0.9.5`, `onspeechend`/`onspeechstart` handlers, `onend` identity check, speculative interim translate, `asrLang` persist, early-commit EN stopword ratio
- `js/asr.js` — wire non-standard handlers (`onspeechend`, `onspeechstart`, `onaudioend`)
- `js/tts.js` — `ttsSpeaking=true` immediately on `speak()` call
- `js/idioms.js` — 7-step normalize: wildcard possessive → contractions → strip punct → bigram `its not` → ASR contractions → wildcard plurals → collapse
- `index.html` — title v0.9.5
- `manifest.json` — v0.9.5
- `test/pipeline.test.js` — 8 new tests (KK–RR), total 60 asserts

## Tests
```bash
node test/pipeline.test.js      # 60/60 PASS
node test/fake-speech-test.js   # 18/18 PASS
```

## Run
```bash
cd webdich-0.1
python3 -m http.server 8080
# http://localhost:8080
```
Best: **Chrome / Edge (desktop or Android)**.
