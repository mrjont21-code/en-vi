/* WebDich v0.9.9 — app.js: controller.
 * v0.9.9 updates:
 *  - Dynamic language pairs from state.colLanguages
 *  - toggleChannel() exported for UI click handling
 *  - Dola Seed API integration via translation module
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
  var VERSION = 'v0.9.9', BUILD = '20260915-001';
  var _asrFallbackTried = false;
  if (state.chunkMode === undefined) state.chunkMode = true;

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

  function dominantChannel() {
    if (!state.activeRow) return 'en';
    var enLen = (state.activeRow.en.final || '').length;
    var viLen = (state.activeRow.vi.final || '').length;
    return viLen > enLen ? 'vi' : (enLen > viLen ? 'en' : 'en');
  }

  function createAndProcessSegment(cellKey, textStr, cell) {
    if (!textStr) return;
    state._segmentCounter++;
    var sourceLang = state.colLanguages[cellKey];
    var otherKey = cellKey === 'en' ? 'vi' : 'en';
    var targetLang = state.colLanguages[otherKey];
    var from = sourceLang.code;
    var to = targetLang.code;
    var gender = (cellKey === 'vi') ? 'female' : 'male';
    var seg = {
      order: state._segmentCounter,
      lang: from,
      text: textStr,
      trans: '',
      spoken: false,
      cell: cell,
      from: from,
      to: to,
      gender: gender,
      ttsLang: targetLang.tts
    };
    state.segments.push(seg);
    log('createSegment', '#' + seg.order, from + '→' + to, '|', textStr.substring(0, 50));
    translation.translate(textStr, from, to, function (t) {
      if (!t) return;
      seg.trans = t;
      ui.renderRows();
      trySpeakNextSegment();
    });
    trySpeakNextSegment();
  }

  function trySpeakNextSegment() {
    if (state.ttsSpeaking) return;
    for (var i = 0; i < state.segments.length; i++) {
      var seg = state.segments[i];
      if (!seg.spoken && seg.trans) {
        speakSegment(seg);
        return;
      }
    }
  }

  function speakSegment(seg) {
    if (seg.spoken) return;
    seg.spoken = true;
    log('speakSegment', '#' + seg.order, seg.gender, seg.ttsLang, '|', seg.trans.substring(0, 50));
    tts.speak(seg.trans, seg.ttsLang, seg.gender, onTtsEnd);
  }

  function onTtsEnd() { trySpeakNextSegment(); }

  function handleIncrement(seg) {
    seg = text.normalizeText(seg);
    if (!seg) return;
    ensureActiveRow();
    if (state.channel.en && state.channel.vi) {
      var segs = language.segmentDual(seg);
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        var cellKey;
        if (s.lang === 'unknown') cellKey = dominantChannel();
        else cellKey = (s.lang === 'vi') ? 'vi' : 'en';
        appendToCell(cellKey, s.text);
        createAndProcessSegment(cellKey, s.text, state.activeRow[cellKey]);
      }
    } else {
      var singleKey = state.channel.en ? 'en' : 'vi';
      appendToCell(singleKey, seg);
      createAndProcessSegment(singleKey, seg, state.activeRow[singleKey]);
    }
    ui.renderRows();
    var idioms = WD.idioms || (typeof require !== 'undefined' && require('./idioms.js'));
    if (idioms && idioms.detectVi) state.activeRow.vi.idiom = state.activeRow.vi.final ? idioms.detectVi(state.activeRow.vi.final).join('; ') : '';
    if (idioms && idioms.detectEn) state.activeRow.en.idiom = state.activeRow.en.final ? idioms.detectEn(state.activeRow.en.final).join('; ') : '';
    translation.scheduleTranslateActive(120, onTranslatedDisplayLegacy);
  }

  function onTranslatedDisplayLegacy(cell, toLang) {
    ui.renderRows();
    if (cell && cell._row && !cell._row.finalized) return;
    if (!state.chunkMode && cell && cell.trans && !cell._spoken) {
      cell._spoken = true;
      var gender = (toLang.slice(0, 2) === 'en') ? 'male' : 'female';
      tts.speak(cell.trans, toLang, gender, onTtsEnd);
    }
  }

  function commitChunk(winner) {
    var rawText = text.normalizeText(winner.text);
    if (!rawText) return;
    var lang = winner.lang;
    var stripped = text.stripCommittedPrefix(rawText, state.committedTail);
    if (!stripped) return;
    state.committedTail = text.appendCommitted(stripped, state.committedTail);
    var row = state.newRow();
    attachRowRefs(row);
    row.finalized = true;
    var cellKey;
    if (lang === 'vi' && state.channel.vi) cellKey = 'vi';
    else if (lang === 'en' && state.channel.en) cellKey = 'en';
    else cellKey = state.channel.en ? 'en' : (state.channel.vi ? 'vi' : null);
    if (!cellKey) return;
    row[cellKey].final = stripped;
    state.rows.push(row);
    state.activeRow = null;
    state.pending = { en: null, vi: null };
    state._lastCommitTs = Date.now();
    clearTimeout(state.commitTimer);
    ui.renderRows();
    log('commitChunk', { lang: lang, text: stripped.substring(0, 60) });
    createAndProcessSegment(cellKey, stripped, row[cellKey]);
    if (!state.dualMode) adaptAsrLanguage(lang);
  }

  function finalizeRow(row) {
    if (!row) return;
    row.finalized = true;
    translation.translateRow(row, onTranslatedDisplayLegacy);
    ui.renderRows();
    trySpeakNextSegment();
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
    if (state.chunkMode) commitChunk(winner);
    else commitWinnerLegacy(winner);
  }

  function commitWinnerLegacy(winner) {
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
    if (state._langStreak.lang === target) state._langStreak.count++;
    else { state._langStreak = { lang: target, count: 1 }; return; }
    if (state._langStreak.count >= 2) {
      state._langStreak.count = 2;
      state.asrLang = target;
      if (state._persistAsrLang) state._persistAsrLang(target);
      log('adaptAsrLanguage switching to', target);
      if (state.recSingle) { try { state.recSingle.stop(); } catch (e) {} }
    }
  }

  function onDualResult(lang, e) {
    if (state.ttsSpeaking) return;
    var r = asr.extractResult(e);
    if (r.interim && shouldShowLive(lang, r.interim)) ui.updateLiveText(r.interim);
    if (!r.final) return;
    var cand = { text: text.normalizeText(r.final), conf: r.conf, ts: Date.now() };
    if (state.chunkMode && state._lastCommitTs && (Date.now() - state._lastCommitTs < 500) &&
        !state.pending[(lang === 'en' ? 'vi' : 'en')]) {
      log('onDualResult: skipping late loser from same chunk', lang, cand.text.substring(0, 40));
      return;
    }
    state.pending[lang] = cand;
    if (shouldEarlyCommit(lang, cand)) {
      if (state.pending.en && state.pending.vi) { flushPending(); return; }
      if (state.chunkMode) commitChunk({ lang: lang, text: cand.text });
      else commitWinnerLegacy({ lang: lang, text: cand.text });
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
    if (r.interim) { ui.updateLiveText(r.interim); scheduleSpeculative(r.interim); }
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
    if (state.chunkMode) commitChunk({ lang: commitLang, text: normalized });
    else commitWinnerLegacy({ lang: commitLang, text: normalized });
  }

  function scheduleSpeculative(interim) {
    var words = interim.trim().split(/\s+/).filter(Boolean);
    if (words.length < SPECULATIVE_MIN_WORDS) return;
    if (interim === state.lastStableInterim) return;
    clearTimeout(state.speculativeTimer);
    state.lastStableInterim = interim;
    state.speculativeTimer = setTimeout(function () {
      var detected = language.detectLanguage(interim);
      var fromLang = detected.lang === 'vi' ? 'vi' : 'en';
      var otherKey = fromLang === 'en' ? 'vi' : 'en';
      var toLang = state.colLanguages[otherKey].code;
      translation.translate(interim, fromLang, toLang, function (t) { /* warm cache */ });
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
      if (state.chunkMode && (state.pending.en || state.pending.vi)) flushPending();
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
      if (state.recSingle === thisRecognizer) state.recSingle = null;
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
      var h = singleHandlers();
      var r = asr.startSingle(state.asrLang, h);
      if (h._setRecognizer) h._setRecognizer(r);
    }
    state.lastStartTs = Date.now();
  }

  function startMicrophone() {
    if (state.micOn) return;
    state.userStopped = false;
    _asrFallbackTried = false;
    state.micOn = true;
    ui.updateMicUI();
    ui.clearLive();
    state.lastStartTs = Date.now();
    if (state.dualMode) {
      if (state.channel.en) asr.startEN(enHandlers());
      if (state.channel.vi) asr.startVI(viHandlers());
    } else {
      var h = singleHandlers();
      var r = asr.startSingle(state.asrLang, h);
      if (h._setRecognizer) h._setRecognizer(r);
    }
    translation.warmConnection();
    log('mic ON, dualMode=' + state.dualMode + ', asrLang=' + state.asrLang);
  }

  function stopMicrophone() {
    state.micOn = false;
    ui.updateMicUI();
    ui.clearLive();
    try {
      if (state.recEN) { state.recEN.onend = null; state.recEN.stop(); }
      if (state.recVI) { state.recVI.onend = null; state.recVI.stop(); }
      if (state.recSingle) { state.recSingle.onend = null; state.recSingle.stop(); }
    } catch (e) {}
    state.recEN = state.recVI = state.recSingle = null;
    clearTimeout(state.restartTimer);
    clearTimeout(state.commitTimer);
    clearTimeout(state._pauseTimer);
    state.pending = { en: null, vi: null };
    if (state.activeRow && !state.activeRow.finalized && (state.activeRow.en.final || state.activeRow.vi.final)) {
      finalizeRow(state.activeRow);
    }
    log('mic OFF');
  }

  function toggleMicrophone() {
    if (state.micOn) stopMicrophone(); else startMicrophone();
  }

  function toggleChannel(colKey) {
    if (state.micOn) { ui.showStatus('Tắt mic trước khi thay đổi cột'); return; }
    state.channel[colKey] = !state.channel[colKey];
    if (!state.channel.en && !state.channel.vi) {
      state.channel[colKey] = true;
      ui.showStatus('Phải có ít nhất 1 cột bật');
      return;
    }
    ui.updateChannelUI();
    log('toggleChannel', colKey, '=', state.channel[colKey]);
  }

  function init() {
    ui.init();
    ui.setVersion(VERSION);
    ui.updateColumnLabels();
    ui.updateMicUI();
    ui.updateChannelUI();
    ui.bindRateSliders();
    tts.loadVoices();
    if (root.speechSynthesis) root.speechSynthesis.onvoiceschanged = tts.loadVoices;
    var micBtn = root.document.getElementById('mic');
    if (micBtn) micBtn.addEventListener('click', toggleMicrophone);
    if (state.isDolaEnabled && state.isDolaEnabled()) {
      log('Dola Seed ENABLED — provider:', state.apiConfig.provider);
    } else {
      log('Dola Seed disabled or no API key — using Google + MyMemory only');
    }
    ui.showStatus('Nhấn mic để bắt đầu · Giữ lâu để thay đổi ngôn ngữ');
    setTimeout(function() { ui.clearLive(); }, 3000);
  }

  WD.app = {
    init: init,
    toggleChannel: toggleChannel,
    toggleMicrophone: toggleMicrophone,
    startMicrophone: startMicrophone,
    stopMicrophone: stopMicrophone
  };

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = WD.app;
})(typeof window !== 'undefined' ? window : global);
