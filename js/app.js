/* WebDich v0.8 — app.js: controller only. No business logic.
 * Flow: MIC → ASR → TEXT → LANGUAGE → STATE → UI → TRANSLATION → TTS.
 * Owns: chunk timer, auto-finalize, auto-restart coordination, channel toggles.
 */
(function (root) {
  'use strict';
  var WD = root.WD || {};
  var state = WD.state, text = WD.text, language = WD.language, asr = WD.asr, translation = WD.translation, tts = WD.tts, ui = WD.ui;
  if (typeof require !== 'undefined') {
    state = require('./state.js'); text = require('./text.js'); language = require('./language.js');
    asr = require('./asr.js'); translation = require('./translation.js'); tts = require('./tts.js'); ui = require('./ui.js');
  }
  var CHUNK_MS = 2000, DUAL_WAIT_MS = 350, FAST_CONF = 0.8, LOCK_MS = 600;
  var VERSION = 'v0.8.1.1', BUILD = '20260911-1000';

  // ---------- row helpers ----------
  function ensureActiveRow() {
    if (!state.activeRow || state.activeRow.finalized) {
      state.activeRow = state.newRow();
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
      var segs = language.segmentDual(seg); // v0.8.1.1: context-smoothed dual-language segmentation
      for (var i = 0; i < segs.length; i++) {
        if (segs[i].lang === 'unknown') {
          appendToCell('en', segs[i].text); // unknown → keep in both, never force to EN
          appendToCell('vi', segs[i].text);
        } else {
          appendToCell(segs[i].lang === 'vi' ? 'vi' : 'en', segs[i].text);
        }
      }
    } else {
      appendToCell(state.channel.en ? 'en' : 'vi', seg);
    }
    ui.renderRows();
    translation.scheduleTranslateActive(400, onTranslatedDisplay); // incremental UI display only
  }
  function onTranslatedDisplay() { ui.renderRows(); }

  // ---------- finalize row (chunk close / mic stop) → translation + TTS (final only) ----------
  function finalizeRow(row) {
    if (!row) return;
    row.finalized = true;
    translation.translateRow(row, onTranslatedDisplay);
    if (row.en.trans) tts.speak(row.en.trans, 'vi-VN'); // TTS only on FINAL, deduped by _lastSpokenTranslation
    if (row.vi.trans) tts.speak(row.vi.trans, 'en-US');
    ui.renderRows();
  }

  // ---------- dual-ASR commit ----------
  function scheduleCommit() {
    clearTimeout(state.commitTimer);
    state.commitTimer = setTimeout(flushPending, DUAL_WAIT_MS);
  }
  function flushPending() {
    clearTimeout(state.commitTimer);
    var en = state.pending.en, vi = state.pending.vi;
    state.pending = { en: null, vi: null };
    var winner = language.pickWinner(en, vi);
    if (!winner) return;
    var seg = text.stripCommittedPrefix(winner.text, state.committedTail);
    if (seg) {
      state.committedTail = text.appendCommitted(seg, state.committedTail);
      handleIncrement(seg);
    }
  }

  // ---------- ASR result wiring ----------
  function onDualResult(lang, e) {
    if (state.ttsSpeaking) return; // echo filter
    var r = asr.extractResult(e);
    if (r.interim) ui.updateLiveText(r.interim); else ui.clearLive();
    if (!r.final) return;
    if (state.lockUntil && Date.now() < state.lockUntil) return;
    state.pending[lang] = { text: text.normalizeText(r.final), conf: r.conf, ts: Date.now() };
    if (state.pending.en && state.pending.vi) { flushPending(); return; }
    if (r.conf >= FAST_CONF) { state.lockUntil = Date.now() + LOCK_MS; flushPending(); return; }
    if (!state.channel.en || !state.channel.vi) { flushPending(); return; }
    scheduleCommit();
  }

  // ---------- ASR handlers (injected into asr.js) ----------
  function enHandlers() {
    return {
      onresult: function (e) { onDualResult('en', e); },
      onend: function () { state.recEN = null; state.needRestart.en = true; scheduleRestart(); },
      onerror: function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { state.userStopped = true; stopMicrophone(); ui.showStatus('Microphone access denied.'); } }
    };
  }
  function viHandlers() {
    return {
      onresult: function (e) { onDualResult('vi', e); },
      onend: function () { state.recVI = null; state.needRestart.vi = true; scheduleRestart(); },
      onerror: function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { state.viFailed = true; } }
    };
  }
  function scheduleRestart() {
    clearTimeout(state.restartTimer);
    var delay = (Date.now() - state.lastStartTs < 700) ? 600 : 350;
    state.restartTimer = setTimeout(doRestart, delay);
  }
  function doRestart() {
    if (!state.micOn || state.userStopped) return;
    if (state.needRestart.en) { state.needRestart.en = false; asr.startEN(enHandlers()); }
    if (state.needRestart.vi) { state.needRestart.vi = false; asr.startVI(viHandlers()); }
  }

  // ---------- chunk timer (app-owned) ----------
  function startChunkTimer() {
    stopChunkTimer();
    state.chunkTimer = setInterval(function () {
      if (state.activeRow && (state.activeRow.en.final || state.activeRow.vi.final)) finalizeRow(state.activeRow);
      flushPending();
    }, CHUNK_MS);
  }
  function stopChunkTimer() { if (state.chunkTimer) { clearInterval(state.chunkTimer); state.chunkTimer = null; } }

  // ---------- mic control ----------
  function startMicrophone() {
    state.micOn = true; state.userStopped = false; state.viFailed = false;
    state.committedTail = ''; state.pending = { en: null, vi: null }; state.lockUntil = 0;
    state.rows = []; state.activeRow = null; state.needRestart = { en: false, vi: false }; state.lastStartTs = 0;
    state._lastSpokenTranslation = '';
    ui.renderRows(); ui.updateMicUI();
    startChunkTimer();
    if (state.channel.en) asr.startEN(enHandlers());
    if (state.channel.vi) asr.startVI(viHandlers());
  }
  function stopMicrophone() {
    state.userStopped = true; state.micOn = false;
    stopChunkTimer();
    clearTimeout(state.transDebounce); clearTimeout(state.restartTimer); clearTimeout(state.commitTimer);
    state.needRestart = { en: false, vi: false };
    if (state.activeRow && (state.activeRow.en.final || state.activeRow.vi.final)) finalizeRow(state.activeRow);
    asr.stopAll();
    ui.updateMicUI(); ui.clearLive(); ui.renderRows();
  }

  // ---------- channel toggles ----------
  function toggleChannel(lang) {
    var next = !state.channel[lang];
    if (!next && (lang === 'en' ? !state.channel.vi : !state.channel.en)) return; // at least one on
    state.channel[lang] = next;
    ui.updateChannelUI();
    if (state.micOn) {
      if (!next) { if (lang === 'en') { state.needRestart.en = false; asr.stopEN(); } else { state.needRestart.vi = false; asr.stopVI(); } }
      else { if (lang === 'en') asr.startEN(enHandlers()); else asr.startVI(viHandlers()); }
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
      reset: function () { state.reset(); },
      getRows: function () { return state.rows.map(function (r) { return { en: r.en.final, vi: r.vi.final }; }); },
      onDualResult: onDualResult,
      flushPending: flushPending,
      handleIncrement: handleIncrement,
      finalizeRow: finalizeRow,
      startMicrophone: startMicrophone,
      stopMicrophone: stopMicrophone,
      toggleChannel: toggleChannel
    };
  }
})(typeof window !== 'undefined' ? window : global);
