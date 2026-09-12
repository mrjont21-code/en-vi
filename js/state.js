/* WebDich v0.8 — state.js: pure state, no DOM/ASR/translate/TTS */
(function (root) {
  'use strict';
  var S = {
    micOn: false,
    userStopped: false,
    recEN: null,
    recVI: null,
    viFailed: false,
    pending: { en: null, vi: null },
    rows: [],
    activeRow: null,
    lockUntil: 0,
    channel: { en: true, vi: true },
    ttsRate: { en: 1.1, vi: 1.1 },
    ttsSpeaking: false,
    restartTimer: null,
    commitTimer: null,
    chunkTimer: null,
    transDebounce: null,
    lastStartTs: 0,
    needRestart: { en: false, vi: false },
    committedTail: '',
    _lastSpokenTranslation: ''
  };
  S.newRow = function () {
    return { en: { final: '', trans: '', _last: '', _requestId: 0, _spoken: false }, vi: { final: '', trans: '', _last: '', _requestId: 0, _spoken: false }, finalized: false };
  };
  S.reset = function () {
    S.micOn = false; S.userStopped = false; S.recEN = null; S.recVI = null; S.viFailed = false;
    S.pending = { en: null, vi: null }; S.rows = []; S.activeRow = null; S.lockUntil = 0;
    S.channel = { en: true, vi: true }; S.ttsRate = { en: 1.1, vi: 1.1 }; S.ttsSpeaking = false;
    S.restartTimer = null; S.commitTimer = null; S.chunkTimer = null; S.transDebounce = null;
    S.lastStartTs = 0; S.needRestart = { en: false, vi: false }; S.committedTail = '';
    S._lastSpokenTranslation = '';
  };
  root.WD = root.WD || {};
  root.WD.state = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : global);
