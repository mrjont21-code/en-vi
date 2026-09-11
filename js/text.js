/* WebDich v0.8 — text.js: pure text processing.
 * resultIndex = exact-once in-session (handled in asr.js).
 * stripCommittedPrefix = guard for cross-restart only. No in-session heuristic.
 */
(function (root) {
  'use strict';
  var TAIL_WORDS = 15;
  function normalizeText(t) { return (t || '').trim().replace(/\s+/g, ' '); }
  function stripPunct(w) { return w.replace(/[.,!?;:()"'\[\]{}<>]/g, ''); }
  // Exact-prefix guard (cross-restart re-transcribe). Pure: takes committedTail, returns stripped seg.
  function stripCommittedPrefix(seg, committedTail) {
    var a = (committedTail || '').toLowerCase().split(' ').slice(-TAIL_WORDS);
    var bLow = normalizeText(seg).toLowerCase().split(' ');
    var bOrig = normalizeText(seg).split(' ');
    var maxK = Math.min(a.length, bLow.length), k = 0, i, j, match;
    for (i = maxK; i >= 1; i--) {
      match = true;
      for (j = 0; j < i; j++) { if (a[a.length - i + j] !== bLow[j]) { match = false; break; } }
      if (match) { k = i; break; }
    }
    return bOrig.slice(k).join(' ').trim();
  }
  function appendCommitted(seg, committedTail) {
    return normalizeText((committedTail || '') + ' ' + seg).split(' ').slice(-TAIL_WORDS).join(' ');
  }
  var mod = { normalizeText: normalizeText, stripPunct: stripPunct, stripCommittedPrefix: stripCommittedPrefix, appendCommitted: appendCommitted, TAIL_WORDS: TAIL_WORDS };
  root.WD = root.WD || {};
  root.WD.text = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
