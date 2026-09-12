/* WebDich v0.9.5a — app.js: controller only.
 *
 * v0.9.5a hotfixes (critical Vietnamese input bug):
 *  - Race condition: startSingleRecognizer now sets state.recSingle + _setRecognizer
 *    BEFORE calling asr.startRecognizer(r). onend identity check is always valid.
 *  - onerror full handler: if language error (not 'not-allowed'), auto-fallback to
 *    en-US once. If that also fails, stop mic and show status.
 *  - _langStreak initialized even when asrLang already matches target (so future
 *    language switches still have a valid streak baseline).
 *  - onspeechend + onaudioend + 1500ms timer triple fallback for finalize.
 *  - console.log for key events to aid debugging.
 */
(function (root) {
  'use strict';
  var WD = root.WD || {};
  var state = WD.state, text = WD.text, language = WD.language, asr = WD.asr, translation = WD.translation, tts = WD.tts, ui = WD.ui;
  if (typeof require !== 'undefined') {
    state = require('./state.js'); text = require('./text.js'); language = require('./language.js');
    asr = require('./asr.js'); translation = require('./translation.js'); tts = require('./tts.js'); ui = require('./ui.js');
  }
  var CHUNK_MS = 2000, DUAL_WAIT_MAX_MS = 180, STRONG_SCORE = 1.4, PAUSE_MS = 280;
  var SPECULATIVE_STABLE_MS = 150, SPECULATIVE_MIN_WORDS = 3, SPEECH_END_FALLBACK_MS = 1500;
  var VERSION = 'v0.9.5a', BUILD = '20260912-2315';
  var _asrFallbackTried = false;

  function log() {
    try { if (root.console && root.console.log) root.console.log.apply(root.console, ['[WebDich]'].concat(Array.prototype.slice.call(arguments))); } catch (e) {}
  }

  function attachRowRefs(row) { row.en._row = row; row.vi._row = row; }

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
      state.activeRow.vi.idiom = state.activeRow.vi.final ? idioms.detectVi(state.activeRow.vi.final).join('; ') : '';
    }
    if (idioms && idioms.detectEn) {
      state.activeRow.en.idiom = state.activeRow.en.final ? idioms.detectEn(state.activeRow.en.final).join('; ') : '';
    }
    translation.scheduleTranslateActive(120, onTranslatedDisplay);
  }
  function dominantChannel() {
    if (!state.activeRow) return 'en';
    var enLen = (state.activeRow.en.final || '').length;
    var viLen = (state.activeRow.vi.final || '').length;
    return viLen > enLen ? 'vi' : (enLen > viLen ? 'en' : 'en');
  }

  function onTranslatedDisplay(cell, toLang) {
    ui.renderRows();
    if (cell && cell._row && !cell._row.finalized) return;
    if (cell && cell.trans && !cell._spoken) {
      cell._spoken = true;
      tts.speak(cell.trans, toLang);
    }
  }

  function finalizeRow(row) {
    if (!row) return;
    row.finalized = true;
    log('finalizeRow', { en: row.en.final, vi: row.vi.final });
    if (row.en.trans && !row.en._spoken) onTranslatedDisplay(row.en, 'vi');
    if (row.vi.trans && !row.vi._spoken) onTranslatedDisplay(row.vi, 'en');
    translation.translateRow(row, onTranslatedDisplay);
    ui.renderRows();
  }

  function shouldEarlyCommit(lang, cand) {
    if (!cand || !cand.text) return false;
    if (lang === 'vi' && language.hasDiacritics(cand.text)) return true;
    var s = language.candidateScore(cand, lang);
    if (s >= STRONG_SCORE) return true;
    if (lang === 'en') {
      var words = cand.text.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        var sw = language.countInList(cand.text, ['the','is','are','was','were','i','you','to','of','in','for','on','with','at','by','from','this','that','and','but','or','not','hello','want','go','how','what','where','when','please','thank','good']);
        if (sw / words.length >= 0.7) return true;
      }
    }
    return false;
  }

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
      if (!state.dualMode) adaptAsrLanguage(winner.lang);
    }
  }

  function adaptAsrLanguage(detectedLang) {
    if (!state.micOn || state.dualMode) return;
    var target = detectedLang === 'vi' ? 'vi-VN' : 'en-US';
    if (!state._langStreak) {
      state._langStreak = { lang: target, count: (state.asrLang === target) ? 2 : 1 };
      log('adaptAsrLanguage init streak', state._langStreak);
      if (state.asrLang === target) return;
    }
    if (state._langStreak.lang === target) {
      state._langStreak.count++;
    } else {
      state._langStreak = { lang: target, count: 1 };
      return;
    }
    if (state._langStreak.count >= 2) {
      state._langStreak.count = 2;
      state.asrLang = target;
      if (state._persistAsrLang) state._persistAsrLang(target);
      log('adaptAsrLanguage switching to', target);
      if (state.recSingle) {
        try { state.recSingle.stop(); } catch (e) {}
      }
    }
  }

  function onDualResult(lang, e) {
    if (state.ttsSpeaking) return;
    var r = asr.extractResult(e);
    if (r.interim && shouldShowLive(lang, r.interim)) ui.updateLiveText(r.interim);
    if (!r.final) return;
    var cand = { text: text.normalizeText(r.final), conf: r.conf, ts: Date.now() };
    state.pending[lang] = cand;
    if (shouldEarlyCommit(lang, cand)) {
      if (state.pending.en && state.pending.vi) { flushPending(); return; }
      commitWinner({ lang: lang, text: cand.text });
      state.pending[lang] = null;
      return;
    }
    if (state.pending.en && state.pending.vi) { flushPending(); return; }
    if (!state.channel.en || !state.channel.vi) { flushPending(); return; }
    scheduleCommit();
  }

  function onSingleResult(e) {
    if (state.ttsSpeaking) return;
    var r = asr.extractResult(e);
    if (r.interim) {
      ui.updateLiveText(r.interim);
      scheduleSpeculative(r.interim);
    }
    if (!r.final) return;
    clearTimeout(state.speculativeTimer);
    state.lastStableInterim = '';
    var normalized = text.normalizeText(r.final);
    if (!normalized) return;
    var detected = language.detectLanguage(normalized);
    log('onSingleResult final', { text: normalized, detected: detected.lang, asrLang: state.asrLang });
    var commitLang = detected.lang;
    if (commitLang === 'unknown') commitLang = (state.asrLang === 'vi-VN') ? 'vi' : 'en';
    if (commitLang === 'vi' && !state.channel.vi) commitLang = 'en';
    if (commitLang === 'en' && !state.channel.en) commitLang = 'vi';
    commitWinner({ lang: commitLang, text: normalized });
  }

  function scheduleSpeculative(interim) {
    var words = interim.trim().split(/\s+/).filter(Boolean);
    if (words.length < SPECULATIVE_MIN_WORDS) return;
    if (interim === state.lastStableInterim) return;
    clearTimeout(state.speculativeTimer);
    state.lastStableInterim = interim;
    state.speculativeTimer = setTimeout(function () {
      if (!state.activeRow || state.activeRow.finalized) return;
      var detected = language.detectLanguage(interim);
      var fromLang = detected.lang === 'vi' ? 'vi' : 'en';
      var toLang = fromLang === 'vi' ? 'en' : 'vi';
      translation.translate(interim, fromLang, toLang, function (t) {
        if (t && state.activeRow && !state.activeRow.finalized) {
          var cell = fromLang === 'vi' ? state.activeRow.vi : state.activeRow.en;
          if (cell && cell.final === interim && !cell.trans) {
            cell.trans = t;
            ui.renderRows();
          }
        }
      });
    }, SPECULATIVE_STABLE_MS);
  }

  function shouldShowLive(lang, interim) {
    var other = state.pending[(lang === 'en' ? 'vi' : 'en')];
    if (!other) return true;
    var score = language.candidateScore({ text: interim, conf: 0.5 }, lang);
    var otherScore = language.candidateScore(other, (lang === 'en' ? 'vi' : 'en'));
    return score >= otherScore;
  }

  function enHandlers() {
    return {
      onresult: function (e) { onDualResult('en', e); },
      onend: function () { state.recEN = null; if (state.channel.en) { state.needRestart.en = true; scheduleRestart(); } },
      onerror: function (e) {
        log('en onerror', e && e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          state.userStopped = true; stopMicrophone(); ui.showStatus('Microphone access denied.');
        }
      }
    };
  }
  function viHandlers() {
    return {
      onresult: function (e) { onDualResult('vi', e); },
      onend: function () { state.recVI = null; if (state.channel.vi) { state.needRestart.vi = true; scheduleRestart(); } },
      onerror: function (e) {
        log('vi onerror', e && e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { state.viFailed = true; }
      }
    };
  }

  function singleHandlers() {
    var handlers = {};
    var thisRecognizer = null;
    var _speechEndFallbackTimer = null;

    function tryFinalizeFromPause() {
      clearTimeout(_speechEndFallbackTimer);
      if (state.activeRow && !state.activeRow.finalized && (state.activeRow.en.final || state.activeRow.vi.final)) {
        log('speech-end detected, finalizing row');
        finalizeRow(state.activeRow);
      }
    }

    handlers.onresult = onSingleResult;
    handlers.onspeechend = function () {
      log('onspeechend fired');
      clearTimeout(state._pauseTimer);
      clearTimeout(_speechEndFallbackTimer);
      state._pauseTimer = setTimeout(tryFinalizeFromPause, PAUSE_MS);
    };
    handlers.onaudioend = function () {
      log('onaudioend fired');
      clearTimeout(state._pauseTimer);
      clearTimeout(_speechEndFallbackTimer);
      state._pauseTimer = setTimeout(tryFinalizeFromPause, PAUSE_MS);
    };
    handlers.onspeechstart = function () {
      log('onspeechstart fired');
      clearTimeout(state._pauseTimer);
      clearTimeout(_speechEndFallbackTimer);
      _speechEndFallbackTimer = setTimeout(tryFinalizeFromPause, SPEECH_END_FALLBACK_MS);
    };
    handlers.onend = function () {
      log('onend fired, identity match:', state.recSingle === thisRecognizer);
      if (state.recSingle === thisRecognizer) {
        state.recSingle = null;
      }
      clearTimeout(_speechEndFallbackTimer);
      if (state.micOn && !state.userStopped) scheduleRestart();
    };
    handlers.onerror = function (e) {
      log('single onerror', e && e.error, 'lang=', state.asrLang);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        state.userStopped = true; stopMicrophone(); ui.showStatus('Microphone access denied.');
        return;
      }
      if (!_asrFallbackTried && state.asrLang !== 'en-US') {
        log('ASR error with lang', state.asrLang, '— falling back to en-US');
        _asrFallbackTried = true;
        state.asrLang = 'en-US';
        if (state._persistAsrLang) state._persistAsrLang('en-US');
        ui.showStatus('Ngôn ngữ vi-VN không khả dụng — đã fallback sang en-US.');
        return;
      }
      if (_asrFallbackTried || state.asrLang === 'en-US') {
        log('ASR unrecoverable error, stopping mic');
        state.userStopped = true;
        stopMicrophone();
        ui.showStatus('ASR lỗi: ' + (e.error || 'unknown') + '. Vui lòng thử lại.');
      }
    };
    handlers._setRecognizer = function (r) { thisRecognizer = r; };
    return handlers;
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

  // v0.9.5a: set refs BEFORE starting — no onend race condition
  function startSingleRecognizer() {
    if (!asr.supported || state.recSingle) return;
    state.lastStartTs = Date.now();
    try {
      var h = singleHandlers();
      var r = asr.startSingle(state.asrLang || 'en-US', h);
      if (r) {
        state.recSingle = r;
        h._setRecognizer(r);
        log('startSingleRecognizer', state.asrLang);
        asr.startRecognizer(r); // start AFTER refs set
      }
    } catch (e) {
      log('startSingleRecognizer exception', e);
      state.recSingle = null;
    }
  }

  function startChunkTimer() {
    stopChunkTimer();
    state.chunkTimer = setInterval(function () {
      if (state.activeRow && !state.activeRow.finalized && (state.activeRow.en.final || state.activeRow.vi.final)) finalizeRow(state.activeRow);
      flushPending();
    }, CHUNK_MS);
  }
  function stopChunkTimer() { if (state.chunkTimer) { clearInterval(state.chunkTimer); state.chunkTimer = null; } }

  function startMicrophone() {
    state.micOn = true; state.userStopped = false; state.viFailed = false; _asrFallbackTried = false;
    state.committedTail = ''; state.pending = { en: null, vi: null };
    state.rows = []; state.activeRow = null; state.needRestart = { en: false, vi: false }; state.lastStartTs = 0;
    state._lastSpokenTranslation = ''; state._langStreak = null;
    state.asrLang = state.asrLang || 'en-US';
    state.ttsSpeaking = false; state.lastStableInterim = '';
    if (state._ttsUnstickTimer) { clearTimeout(state._ttsUnstickTimer); state._ttsUnstickTimer = null; }
    if (state._pauseTimer) { clearTimeout(state._pauseTimer); state._pauseTimer = null; }
    if (state.speculativeTimer) { clearTimeout(state.speculativeTimer); state.speculativeTimer = null; }
    ui.renderRows(); ui.updateMicUI();
    startChunkTimer();
    if (translation.warmConnection) translation.warmConnection();
    log('startMicrophone, asrLang=', state.asrLang, 'dualMode=', state.dualMode);
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
    clearTimeout(state._pauseTimer); clearTimeout(state.speculativeTimer);
    state.needRestart = { en: false, vi: false };
    if (state.activeRow && (state.activeRow.en.final || state.activeRow.vi.final)) finalizeRow(state.activeRow);
    asr.stopAll();
    state.recSingle = null;
    state.ttsSpeaking = false;
    if (state._ttsUnstickTimer) { clearTimeout(state._ttsUnstickTimer); state._ttsUnstickTimer = null; }
    ui.updateMicUI(); ui.clearLive(); ui.renderRows();
    log('stopMicrophone');
  }

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
    log('initialized', VERSION, 'asr.supported=', asr.supported, 'default asrLang=', state.asrLang);
  }
  if (root.document) root.document.addEventListener ? root.document.addEventListener('DOMContentLoaded', init) : init();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      VERSION: VERSION,
      reset: function () { state.reset(); _asrFallbackTried = false; },
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
      _onTranslatedDisplay: onTranslatedDisplay,
      _adaptAsrLanguage: adaptAsrLanguage
    };
  }
})(typeof window !== 'undefined' ? window : global);
