/* WebDich v0.9.4 — translation.js: Google gtx + MyMemory RACE (not waterfall).
 * v0.9.4 changes:
 *  - Google and MyMemory fire SIMULTANEOUSLY; first good result wins
 *  - 400ms timeout via AbortController + setTimeout
 *  - Identity rejection: if output === input (sl=auto misdetected), treat as failure
 *  - sl=from by default (not auto); auto only used when detectLanguage === unknown
 *  - LRU cache (200 entries) — repeated phrases = 0ms, 0 network
 *  - warmConnection() fires a tiny probe on mic-start to warm TLS/HTTP2
 *  - _last only committed on successful non-empty translation (failures retryable)
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var textMod = (root.WD && root.WD.text) || (typeof require !== 'undefined' && require('./text.js'));
  var LANG = (root.WD && root.WD.language) || (typeof require !== 'undefined' && require('./language.js'));

  var TIMEOUT_MS = 400;
  var CACHE_MAX = 200;
  var _cache = new Map(); // key: "from|to|text" → {trans, ts}

  function cacheKey(from, to, textStr) {
    return from + '|' + to + '|' + textStr.trim().toLowerCase();
  }
  function cacheGet(from, to, textStr) {
    var k = cacheKey(from, to, textStr);
    var entry = _cache.get(k);
    if (entry) {
      // LRU: move to end
      _cache.delete(k);
      _cache.set(k, entry);
      return entry.trans;
    }
    return null;
  }
  function cachePut(from, to, textStr, trans) {
    var k = cacheKey(from, to, textStr);
    _cache.delete(k);
    _cache.set(k, { trans: trans, ts: Date.now() });
    if (_cache.size > CACHE_MAX) {
      // Evict oldest (first in insertion order)
      var firstKey = _cache.keys().next().value;
      if (firstKey !== undefined) _cache.delete(firstKey);
    }
  }

  function isNoOp(src, out) {
    return src && out && src.trim().toLowerCase() === out.trim().toLowerCase();
  }

  function effectiveSourceLang(textStr, from) {
    try {
      if (LANG && LANG.detectLanguage) {
        var d = LANG.detectLanguage(textStr);
        if (d.lang === 'unknown') return 'auto';
      }
    } catch (e) {}
    return from;
  }

  // Fetch with timeout via AbortController
  function fetchWithTimeout(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch(url, { signal: controller.signal }).then(function (r) {
      clearTimeout(timer);
      return r;
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  function fetchGoogle(textStr, from, to) {
    var sl = effectiveSourceLang(textStr, from);
    var gtx = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(textStr);
    return fetchWithTimeout(gtx, TIMEOUT_MS).then(function (r) { return r.json(); }).then(function (j) {
      var t = '';
      if (j && j[0]) j[0].forEach(function (s) { if (s && s[0]) t += s[0]; });
      if (!t) throw new Error('google-empty');
      if (t.indexOf('MYMEMORY') >= 0) throw new Error('google-bad-payload');
      if (isNoOp(textStr, t)) throw new Error('google-identity');
      return t;
    });
  }

  function fetchMyMemory(textStr, from, to) {
    var fromLang = from;
    try { if (LANG && LANG.detectLanguage) { var d = LANG.detectLanguage(textStr); if (d.lang === 'vi' || d.lang === 'en') fromLang = d.lang; } } catch (e) {}
    var mm = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(textStr) + '&langpair=' + fromLang + '|' + to;
    return fetchWithTimeout(mm, TIMEOUT_MS).then(function (r) { return r.json(); }).then(function (j) {
      var t = (j && j.responseData && j.responseData.translatedText) || '';
      if (!t) throw new Error('mm-empty');
      if (t.indexOf('MYMEMORY WARNING') >= 0 || t.indexOf('QUERY LENGTH') >= 0) throw new Error('mm-warning');
      if (isNoOp(textStr, t)) throw new Error('mm-identity');
      return t;
    });
  }

  // v0.9.4: RACE — fire both, first good wins
  function translate(textStr, from, to, cb) {
    if (!textStr) { cb(''); return; }
    // Cache hit → instant
    var cached = cacheGet(from, to, textStr);
    if (cached) { cb(cached); return; }

    var done = false;
    var failures = [];
    function finish(t) {
      if (done) return;
      done = true;
      if (t) {
        cachePut(from, to, textStr, t);
        cb(t);
      } else {
        cb('');
      }
    }

    var gPromise = fetchGoogle(textStr, from, to).then(finish).catch(function (e) {
      failures.push('google:' + (e && e.message));
      checkBothFailed();
    });
    var mPromise = fetchMyMemory(textStr, from, to).then(finish).catch(function (e) {
      failures.push('mm:' + (e && e.message));
      checkBothFailed();
    });

    function checkBothFailed() {
      if (failures.length >= 2 && !done) {
        // Both failed — try one more with sl flipped / auto as last resort
        var sl = effectiveSourceLang(textStr, from);
        if (sl !== 'auto') {
          var gtx2 = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + to + '&dt=t&q=' + encodeURIComponent(textStr);
          fetchWithTimeout(gtx2, TIMEOUT_MS).then(function (r) { return r.json(); }).then(function (j) {
            var t = '';
            if (j && j[0]) j[0].forEach(function (s) { if (s && s[0]) t += s[0]; });
            if (t && !isNoOp(textStr, t)) finish(t); else finish('');
          }).catch(function () { finish(''); });
        } else {
          finish('');
        }
      }
    }
  }

  // Translate one cell; skip if source unchanged. Race guard via _requestId.
  function translateCell(cell, from, to, onTranslated) {
    if (!cell || !cell.final || cell._last === cell.final) return;
    var reqId = ++cell._requestId;
    translate(cell.final, from, to, function (t) {
      if (reqId !== cell._requestId) return;
      if (!t) return; // v0.9.4: empty → don't write, don't mark _last → retryable
      cell.trans = t;
      cell._last = cell.final; // v0.9.4: only commit _last on success
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
    state.transDebounce = setTimeout(function () { translateRow(state.activeRow, onTranslated); }, ms || 120);
  }

  // v0.9.4: warm TLS/HTTP2 connection on mic start
  function warmConnection() {
    try {
      if (root.fetch) {
        // Tiny no-op requests to warm connections; ignore results
        fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=hi', { mode: 'no-cors' }).catch(function () {});
        fetch('https://api.mymemory.translated.net/get?q=hi&langpair=en|vi', { mode: 'no-cors' }).catch(function () {});
      }
    } catch (e) {}
  }

  var mod = {
    translate: translate, translateCell: translateCell, translateRow: translateRow,
    scheduleTranslateActive: scheduleTranslateActive, warmConnection: warmConnection,
    _cache: _cache, _cacheGet: cacheGet, _cachePut: cachePut, _isNoOp: isNoOp
  };
  root.WD = root.WD || {};
  root.WD.translation = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
