/* WebDich v0.9.4 — state.js: pure state, no DOM/ASR/translate/TTS
 * v0.9.4 additions: asrLang, recSingle, dualMode (default = single-ASR)
 */
(function (root) {
  'use strict';
  var S = {
    micOn: false,
    userStopped: false,
    recEN: null,
    recVI: null,
    recSingle: null,       // v0.9.4: single recognizer instance
    viFailed: false,
    pending: { en: null, vi: null },
    rows: [],
    activeRow: null,
    channel: { en: true, vi: true },
    dualMode: false,       // v0.9.4: default = single-ASR with auto-switch
    asrLang: 'en-US',      // v0.9.4: current language for single-ASR mode
    ttsRate: { en: 1.1, vi: 1.1 },
    ttsSpeaking: false,
    restartTimer: null,
    commitTimer: null,
    chunkTimer: null,
    transDebounce: null,
    lastStartTs: 0,
    needRestart: { en: false, vi: false },
    committedTail: '',
    _lastSpokenTranslation: '',
    _ttsUnstickTimer: null,
    _pauseTimer: null,
    _langStreak: null
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
    S.channel = { en: true, vi: true }; S.dualMode = false; S.asrLang = 'en-US';
    S.ttsRate = { en: 1.1, vi: 1.1 }; S.ttsSpeaking = false;
    S.restartTimer = null; S.commitTimer = null; S.chunkTimer = null; S.transDebounce = null;
    S.lastStartTs = 0; S.needRestart = { en: false, vi: false }; S.committedTail = '';
    S._lastSpokenTranslation = ''; S._ttsUnstickTimer = null; S._pauseTimer = null; S._langStreak = null;
  };
  root.WD = root.WD || {};
  root.WD.state = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : global);
