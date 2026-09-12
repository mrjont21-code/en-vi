/* WebDich v0.9.4 — app.js: controller only. No business logic.
 * Flow: MIC → ASR → TEXT → LANGUAGE → STATE → UI → TRANSLATION → TTS.
 * Owns: chunk timer, auto-finalize, auto-restart coordination, channel toggles.
 *
 * v0.9.4 major changes:
 *  - Bug A fix: onTranslatedDisplay checks the CELL'S OWN row.finalized, not state.activeRow
 *  - Early-commit: 0ms when VI has diacritics OR score ≥ strong threshold; max dual-wait 180ms
 *  - Removed lockUntil / FAST_CONF blind-drop; late channel can still revise once
 *  - Single-ASR default: one SpeechRecognition with auto language switching
 *    (Chrome cannot reliably run two instances simultaneously). Dual mode only
 *    when explicitly requested via state.dualMode = true.
 *  - Speculative translate: debounce reduced 400→120ms; interim translates start earlier
 *  - TTS triggered on pause-detection (onend + 400ms silence) not just 2s chunk
 */
(function (root) {
  'use strict';
  var WD = root.WD || {};
  var state = WD.state, text = WD.text, language = WD.language, asr = WD.asr, translation = WD.translation, tts = WD.tts, ui = WD.ui;
  if (typeof require !== 'undefined') {
    state = require('./state.js'); text = require('./text.js'); language = require('./language.js');
    asr = require('./asr.js'); translation = require('./translation.js'); tts = require('./tts.js'); ui = require('./ui.js');
  }
  var CHUNK_MS = 2000, DUAL_WAIT_MAX_MS = 180, STRONG_SCORE = 1.4, PAUSE_MS = 400;
  var VERSION = 'v0.9.4', BUILD = '20260912-2130';

  // Track which row each cell belongs to (for Bug A fix)
  function attachRowRefs(row) {
    row.en._row = row;
    row.vi._row = row;
  }

  // ---------- row helpers ----------
  function ensureActiveRow() {
    if (!state.activeRow || state.activeRow.finalized) {
      state.activeRow = state.newRow();
      attachRowRefs(state.activeRow);
      state.rows.push(state.activeRow);
    }
  }
  function appendToCell(cell, t) {
    var c = state.activeRow[cell];
    c.final = c.final ? c.final + ' ' + t : t;
  }
  function handleIncrement(seg) {
    seg = text.normalizeText(seg);
    if (!seg) return;
    ensureActiveRow();
    if (state.channel.en && state.channel.vi) {
      var segs = language.segmentDual(seg);
      for (var i = 0; i < segs.length; i++) {
        if (segs[i].lang === 'unknown') {
          var dom = dominantChannel();
          appendToCell(dom, segs[i].text);
        } else {
          appendToCell(segs[i].lang === 'vi' ? 'vi' : 'en', segs[i].text);
        }
      }
    } else {
      appendToCell(state.channel.en ? 'en' : 'vi', seg);
    }
    ui.renderRows();
    var idioms = WD.idioms || (typeof require !== 'undefined' && require('./idioms.js'));
    if (idioms && idioms.detectVi) {
      if (state.activeRow.vi.final) state.activeRow.vi.idiom = idioms.detectVi(state.activeRow.vi.final).join('; ');
      else state.activeRow.vi.idiom = '';
    }
    if (idioms && idioms.detectEn) {
      if (state.activeRow.en.final) state.activeRow.en.idiom = idioms.detectEn(state.activeRow.en.final).join('; ');
      else state.activeRow.en.idiom = '';
    }
    // v0.9.4: speculative translate — 120ms debounce (was 400ms)
    translation.scheduleTranslateActive(120, onTranslatedDisplay);
  }
  function dominantChannel() {
    if (!state.activeRow) return 'en';
    var enLen = (state.activeRow.en.final || '').length;
    var viLen = (state.activeRow.vi.final || '').length;
    if (viLen > enLen) return 'vi';
    if (enLen > viLen) return 'en';
    return 'en';
  }

  // v0.9.4 Bug A fix: check the CELL'S OWN row.finalized, not state.activeRow
  function onTranslatedDisplay(cell, toLang) {
    ui.renderRows();
    // Skip TTS only for INCREMENTAL translates of the cell's own non-finalized row
    if (cell && cell._row && !cell._row.finalized) return;
    if (cell && cell.trans && !cell._spoken) {
      cell._spoken = true;
      tts.speak(cell.trans, toLang);
    }
  }

  // ---------- finalize row → translation + TTS via callback ----------
  function finalizeRow(row) {
    if (!row) return;
    row.finalized = true;
    // If translation already exists, trigger TTS immediately
    if (row.en.trans && !row.en._spoken) onTranslatedDisplay(row.en, 'vi');
    if (row.vi.trans && !row.vi._spoken) onTranslatedDisplay(row.vi, 'en');
    translation.translateRow(row, onTranslatedDisplay);
    ui.renderRows();
  }

  // ---------- v0.9.4 early-commit decision ----------
  function shouldEarlyCommit(lang, cand) {
    if (!cand || !cand.text) return false;
    // Strong VI signal: diacritics = commit immediately (0ms)
    if (lang === 'vi' && language.hasDiacritics(cand.text)) return true;
    // Strong score: stopwords + confidence add up
    var s = language.candidateScore(cand, lang);
    if (s >= STRONG_SCORE) return true;
    return false;
  }

  // ---------- dual-ASR commit ----------
  function scheduleCommit() {
    clearTimeout(state.commitTimer);
    state.commitTimer = setTimeout(flushPending, DUAL_WAIT_MAX_MS);
  }
  function flushPending() {
    clearTimeout(state.commitTimer);
    var en = state.pending.en, vi = state.pending.vi;
    state.pending = { en: null, vi: null };
    var winner = language.pickWinner(en, vi);
    if (!winner) return;
    commitWinner(winner);
  }
  function commitWinner(winner) {
    var seg = text.stripCommittedPrefix(winner.text, state.committedTail);
    if (seg) {
      state.committedTail = text.appendCommitted(seg, state.committedTail);
      handleIncrement(seg);
      // Adapt ASR language in single-ASR mode
      if (!state.dualMode) adaptAsrLanguage(winner.lang);
    }
  }

  // ---------- v0.9.4: single-ASR language adaptation ----------
  function adaptAsrLanguage(detectedLang) {
    if (!state.micOn || state.dualMode) return;
    var target = detectedLang === 'vi' ? 'vi-VN' : 'en-US';
    if (state.asrLang === target) return;
    // Only switch after 2 consecutive same-language wins (avoid flicker)
    state._langStreak = state._langStreak || { lang: target, count: 0 };
    if (state._langStreak.lang === target) {
      state._langStreak.count++;
    } else {
      state._langStreak = { lang: target, count: 1 };
    }
    if (state._langStreak.count >= 2) {
      state.asrLang = target;
      state._langStreak.count = 0;
      // Restart recognizer with new language
      asr.stopAll();
      state.recSingle = null;
      startSingleRecognizer();
    }
  }

  // ---------- ASR result wiring ----------
  function onDualResult(lang, e) {
    if (state.ttsSpeaking) return;
    var r = asr.extractResult(e);
    if (r.interim) {
      if (shouldShowLive(lang, r.interim)) ui.updateLiveText(r.interim);
    }
    if (!r.final) return;
    var cand = { text: text.normalizeText(r.final), conf: r.conf, ts: Date.now() };
    state.pending[lang] = cand;

    // v0.9.4: early-commit on strong signal (0ms, no wait)
    if (shouldEarlyCommit(lang, cand)) {
      // If other channel has pending too, still run pickWinner for fairness
      if (state.pending.en && state.pending.vi) { flushPending(); return; }
      commitWinner({ lang: lang, text: cand.text });
      state.pending[lang] = null;
      return;
    }
    if (state.pending.en && state.pending.vi) { flushPending(); return; }
    if (!state.channel.en || !state.channel.vi) { flushPending(); return; }
    scheduleCommit();
  }

  // v0.9.4: single-ASR result handler — detect language, route directly
  function onSingleResult(e) {
    if (state.ttsSpeaking) return;
    var r = asr.extractResult(e);
    if (r.interim) { ui.updateLiveText(r.interim); }
    if (!r.final) return;
    var normalized = text.normalizeText(r.final);
    if (!normalized) return;
    var detected = language.detectLanguage(normalized);
    var commitLang = detected.lang;
    if (commitLang === 'unknown') commitLang = (state.asrLang === 'vi-VN') ? 'vi' : 'en';
    // Respect channel toggles
    if (commitLang === 'vi' && !state.channel.vi) commitLang = 'en';
    if (commitLang === 'en' && !state.channel.en) commitLang = 'vi';
    commitWinner({ lang: commitLang, text: normalized });
  }

  function shouldShowLive(lang, interim) {
    var other = state.pending[(lang === 'en' ? 'vi' : 'en')];
    if (!other) return true;
    var score = language.candidateScore({ text: interim, conf: 0.5 }, lang);
    var otherScore = language.candidateScore(other, (lang === 'en' ? 'vi' : 'en'));
    return score >= otherScore;
  }

  // ---------- ASR handlers ----------
  function enHandlers() {
    return {
      onresult: function (e) { onDualResult('en', e); },
      onend: function () { state.recEN = null; if (state.channel.en) { state.needRestart.en = true; scheduleRestart(); } },
      onerror: function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { state.userStopped = true; stopMicrophone(); ui.showStatus('Microphone access denied.'); } }
    };
  }
  function viHandlers() {
    return {
      onresult: function (e) { onDualResult('vi', e); },
      onend: function () { state.recVI = null; if (state.channel.vi) { state.needRestart.vi = true; scheduleRestart(); } },
      onerror: function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { state.viFailed = true; } }
    };
  }
  function singleHandlers() {
    return {
      onresult: onSingleResult,
      onend: function () {
        state.recSingle = null;
        // v0.9.4: onend = pause/silence detected → finalize active row for TTS
        if (state.activeRow && !state.activeRow.finalized && (state.activeRow.en.final || state.activeRow.vi.final)) {
          clearTimeout(state._pauseTimer);
          state._pauseTimer = setTimeout(function () {
            if (state.activeRow && !state.activeRow.finalized) finalizeRow(state.activeRow);
          }, PAUSE_MS);
        }
        if (state.micOn && !state.userStopped) scheduleRestart();
      },
      onerror: function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          state.userStopped = true; stopMicrophone(); ui.showStatus('Microphone access denied.');
        }
      }
    };
  }

  function scheduleRestart() {
    clearTimeout(state.restartTimer);
    var delay = (Date.now() - state.lastStartTs < 700) ? 600 : 350;
    state.restartTimer = setTimeout(doRestart, delay);
  }
  function doRestart() {
    if (!state.micOn || state.userStopped) return;
    if (state.dualMode) {
      if (state.needRestart.en && state.channel.en) { state.needRestart.en = false; asr.startEN(enHandlers()); }
      if (state.needRestart.vi && state.channel.vi) { state.needRestart.vi = false; asr.startVI(viHandlers()); }
    } else {
      if (!state.recSingle) startSingleRecognizer();
    }
  }

  function startSingleRecognizer() {
    if (!asr.supported || state.recSingle) return;
    state.lastStartTs = Date.now();
    try {
      state.recSingle = asr.startSingle(state.asrLang || 'en-US', singleHandlers());
    } catch (e) { state.recSingle = null; }
  }

  // ---------- chunk timer ----------
  function startChunkTimer() {
    stopChunkTimer();
    state.chunkTimer = setInterval(function () {
      if (state.activeRow && !state.activeRow.finalized && (state.activeRow.en.final || state.activeRow.vi.final)) finalizeRow(state.activeRow);
      flushPending();
    }, CHUNK_MS);
  }
  function stopChunkTimer() { if (state.chunkTimer) { clearInterval(state.chunkTimer); state.chunkTimer = null; } }

  // ---------- mic control ----------
  function startMicrophone() {
    state.micOn = true; state.userStopped = false; state.viFailed = false;
    state.committedTail = ''; state.pending = { en: null, vi: null };
    state.rows = []; state.activeRow = null; state.needRestart = { en: false, vi: false }; state.lastStartTs = 0;
    state._lastSpokenTranslation = ''; state._langStreak = null;
    state.asrLang = state.asrLang || 'en-US';
    state.ttsSpeaking = false;
    if (state._ttsUnstickTimer) { clearTimeout(state._ttsUnstickTimer); state._ttsUnstickTimer = null; }
    if (state._pauseTimer) { clearTimeout(state._pauseTimer); state._pauseTimer = null; }
    ui.renderRows(); ui.updateMicUI();
    startChunkTimer();
    // v0.9.4: warm translation connection
    if (translation.warmConnection) translation.warmConnection();
    if (state.dualMode) {
      if (state.channel.en) asr.startEN(enHandlers());
      if (state.channel.vi) asr.startVI(viHandlers());
    } else {
      startSingleRecognizer();
    }
  }
  function stopMicrophone() {
    state.userStopped = true; state.micOn = false;
    stopChunkTimer();
    clearTimeout(state.transDebounce); clearTimeout(state.restartTimer); clearTimeout(state.commitTimer);
    clearTimeout(state._pauseTimer);
    state.needRestart = { en: false, vi: false };
    if (state.activeRow && (state.activeRow.en.final || state.activeRow.vi.final)) finalizeRow(state.activeRow);
    asr.stopAll();
    state.recSingle = null;
    state.ttsSpeaking = false;
    if (state._ttsUnstickTimer) { clearTimeout(state._ttsUnstickTimer); state._ttsUnstickTimer = null; }
    ui.updateMicUI(); ui.clearLive(); ui.renderRows();
  }

  // ---------- channel toggles ----------
  function toggleChannel(lang) {
    var next = !state.channel[lang];
    if (!next && (lang === 'en' ? !state.channel.vi : !state.channel.en)) return;
    state.channel[lang] = next;
    ui.updateChannelUI();
    if (state.micOn && state.dualMode) {
      if (!next) {
        if (lang === 'en') { state.needRestart.en = false; asr.stopEN(); }
        else { state.needRestart.vi = false; asr.stopVI(); }
      } else {
        if (lang === 'en') asr.startEN(enHandlers()); else asr.startVI(viHandlers());
      }
    }
  }

  // ---------- init ----------
  function init() {
    if (!ui.el.live) ui.init();
    ui.updateChannelUI();
    tts.loadVoices();
    if (root.speechSynthesis && root.speechSynthesis.onvoiceschanged !== undefined) root.speechSynthesis.onvoiceschanged = tts.loadVoices;
    ui.bindRateSliders();
    if (ui.el.mic) ui.el.mic.addEventListener('click', function () { state.micOn ? stopMicrophone() : startMicrophone(); });
    if (ui.el.chEn) ui.el.chEn.addEventListener('click', function () { toggleChannel('en'); });
    if (ui.el.chVi) ui.el.chVi.addEventListener('click', function () { toggleChannel('vi'); });
    ui.updateLiveText('WebDich ' + VERSION + ' · tap mic');
    if (ui.el.live) ui.el.live.style.opacity = '0.45';
    ui.setVersion(VERSION);
    if (!asr.supported) ui.showStatus('WebDich ' + VERSION + ' · speech recognition not supported here. Use Chrome / Edge over HTTPS or localhost.');
  }
  if (root.document) root.document.addEventListener ? root.document.addEventListener('DOMContentLoaded', init) : init();

  // ---------- test hook (Node) ----------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      VERSION: VERSION,
      reset: function () { state.reset(); state._langStreak = null; state.asrLang = 'en-US'; state.recSingle = null; },
      getRows: function () { return state.rows.map(function (r) { return { en: r.en.final, vi: r.vi.final }; }); },
      onDualResult: onDualResult,
      onSingleResult: onSingleResult,
      flushPending: flushPending,
      handleIncrement: handleIncrement,
      finalizeRow: finalizeRow,
      startMicrophone: startMicrophone,
      stopMicrophone: stopMicrophone,
      toggleChannel: toggleChannel,
      pickWinner: language.pickWinner,
      shouldEarlyCommit: shouldEarlyCommit,
      _state: state,
      _attachRowRefs: attachRowRefs,
      _onTranslatedDisplay: onTranslatedDisplay
    };
  }
})(typeof window !== 'undefined' ? window : global);
