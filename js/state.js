/* WebDich v0.9.5 — state.js: pure state, no DOM/ASR/translate/TTS
 * v0.9.5: asrLang defaults to navigator.language (vi-VN for VI audience)
 * and persists to localStorage on every adaptation.
 */
(function (root) {
  'use strict';

  // v0.9.5: detect default ASR language from browser + localStorage
  function defaultAsrLang() {
    try {
      if (root.localStorage && root.localStorage.wdAsrLang) {
        var saved = root.localStorage.wdAsrLang;
        if (saved === 'vi-VN' || saved === 'en-US') return saved;
      }
    } catch (e) {}
    try {
      var nav = (root.navigator && root.navigator.language) || '';
      if (nav.toLowerCase().indexOf('vi') === 0) return 'vi-VN';
    } catch (e) {}
    // HTML lang="vi" + Vietnamese audience → default vi-VN
    return 'vi-VN';
  }

  function persistAsrLang(lang) {
    try { if (root.localStorage) root.localStorage.wdAsrLang = lang; } catch (e) {}
  }

  var S = {
    micOn: false,
    userStopped: false,
    recEN: null,
    recVI: null,
    recSingle: null,
    viFailed: false,
    pending: { en: null, vi: null },
    rows: [],
    activeRow: null,
    channel: { en: true, vi: true },
    dualMode: false,
    asrLang: defaultAsrLang(),
    ttsRate: { en: 1.1, vi: 1.1 },
    ttsSpeaking: false,
    restartTimer: null,
    commitTimer: null,
    chunkTimer: null,
    transDebounce: null,
    speculativeTimer: null,   // v0.9.5: interim speculative translate timer
    lastStableInterim: '',    // v0.9.5: last interim that triggered speculative
    lastStartTs: 0,
    needRestart: { en: false, vi: false },
    committedTail: '',
    _lastSpokenTranslation: '',
    _ttsUnstickTimer: null,
    _pauseTimer: null,
    _langStreak: null,
    _persistAsrLang: persistAsrLang
  };
  S.newRow = function () {
    return {
      en: { final: '', trans: '', _last: '', _requestId: 0, _spoken: false, idiom: '' },
      vi: { final: '', trans: '', _last: '', _requestId: 0, _spoken: false, idiom: '' },
      finalized: false
    };
  };
  S.reset = function () {
    S.micOn = false; S.userStopped = false; S.recEN = null; S.recVI = null; S.recSingle = null;
    S.viFailed = false; S.pending = { en: null, vi: null }; S.rows = []; S.activeRow = null;
    S.channel = { en: true, vi: true }; S.dualMode = false;
    S.asrLang = defaultAsrLang();
    S.ttsRate = { en: 1.1, vi: 1.1 }; S.ttsSpeaking = false;
    S.restartTimer = null; S.commitTimer = null; S.chunkTimer = null;
    S.transDebounce = null; S.speculativeTimer = null; S.lastStableInterim = '';
    S.lastStartTs = 0; S.needRestart = { en: false, vi: false }; S.committedTail = '';
    S._lastSpokenTranslation = ''; S._ttsUnstickTimer = null; S._pauseTimer = null; S._langStreak = null;
  };
  root.WD = root.WD || {};
  root.WD.state = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : global);
