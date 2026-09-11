/* WebDich v0.8 — translation.js: Google gtx primary + MyMemory fallback.
 * Race protection: each cell has _requestId; response only written if id matches.
 * Incremental translation for UI display; TTS triggered by app only on FINAL.
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var text = (root.WD && root.WD.text) || (typeof require !== 'undefined' && require('./text.js'));
  function translate(textStr, from, to, cb) {
    if (!textStr) { cb(''); return; }
    // v0.8.1.2 fix: Google gtx with sl=auto — auto-detect source language, never translate wrong direction.
    var gtx = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + to + '&dt=t&q=' + encodeURIComponent(textStr);
    fetch(gtx).then(function (r) { return r.json(); }).then(function (j) {
      var t = '';
      if (j && j[0]) j[0].forEach(function (s) { if (s && s[0]) t += s[0]; });
      if (t && t.indexOf('MYMEMORY') < 0) cb(t); else cb('');
    }).catch(function () {
      // MyMemory fallback: detect source language properly (auto if available), filter warning strings.
      var fromLang = from;
      try { var L = root.WD && root.WD.language; if (L) { var d = L.detectLanguage(textStr); if (d.lang === 'vi' || d.lang === 'en') fromLang = d.lang; } } catch (e) {}
      var mm = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(textStr) + '&langpair=' + fromLang + '|' + to;
      fetch(mm).then(function (r) { return r.json(); }).then(function (j) {
        var t = (j && j.responseData && j.responseData.translatedText) || '';
        if (t && t.indexOf('MYMEMORY WARNING') < 0 && t.indexOf('QUERY LENGTH') < 0) cb(t); else cb('');
      }).catch(function () { cb(''); });
    });
  }
  // Translate one cell; skip if source unchanged. Race guard via _requestId.
  function translateCell(cell, from, to, onTranslated) {
    if (!cell || !cell.final || cell._last === cell.final) return;
    cell._last = cell.final;
    var reqId = ++cell._requestId;
    translate(cell.final, from, to, function (t) {
      if (reqId !== cell._requestId) return; // stale response, drop
      if (!t) return;
      cell.trans = t;
      if (onTranslated) onTranslated(cell, to);
    });
  }
  function translateRow(row, onTranslated) {
    if (!row) return;
    translateCell(row.en, 'en', 'vi', onTranslated);
    translateCell(row.vi, 'vi', 'en', onTranslated);
  }
  function scheduleTranslateActive(ms, onTranslated) {
    clearTimeout(state.transDebounce);
    state.transDebounce = setTimeout(function () { translateRow(state.activeRow, onTranslated); }, ms || 400);
  }
  var mod = { translate: translate, translateCell: translateCell, translateRow: translateRow, scheduleTranslateActive: scheduleTranslateActive };
  root.WD = root.WD || {};
  root.WD.translation = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
