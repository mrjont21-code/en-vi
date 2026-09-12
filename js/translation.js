/* WebDich v0.9.5 — translation.js: Google gtx + MyMemory RACE.
 * v0.9.5 changes:
 *  - Per-provider timeouts: Google 800ms, MyMemory 1500ms (measured: MM p50 ~900ms)
 *  - Abort the LOSER when a good result arrives (saves bandwidth + quota)
 *  - If Google returns identity/empty, do NOT abort MyMemory — let it win
 *  - warmConnection() only warms Google (saves MyMemory daily quota)
 *  - Phrasebook: ~80 common travel phrases EN↔VI — 0ms, 0 network hit
 *  - LRU cache hydrates from localStorage on boot; persists after each successful translate
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var LANG = (root.WD && root.WD.language) || (typeof require !== 'undefined' && require('./language.js'));

  var GOOGLE_TIMEOUT_MS = 800;
  var MM_TIMEOUT_MS = 1500;
  var CACHE_MAX = 200;
  var _cache = new Map();

  // ---------- v0.9.5: Phrasebook — common travel phrases, 0 RTT ----------
  var PHRASEBOOK_EN = {
    "hello":"xin chào","hi":"xin chào","good morning":"chào buổi sáng","good evening":"chào buổi tối",
    "goodbye":"tạm biệt","bye":"tạm biệt","see you later":"hẹn gặp lại","thank you":"cảm ơn",
    "thanks":"cảm ơn","thank you very much":"cảm ơn rất nhiều","you are welcome":"không có gì",
    "please":"làm ơn","sorry":"xin lỗi","excuse me":"xin lỗi","i am sorry":"tôi xin lỗi",
    "yes":"vâng","no":"không","maybe":"có thể","ok":"được","okay":"được",
    "i understand":"tôi hiểu","i do not understand":"tôi không hiểu",
    "do you speak english":"bạn nói tiếng anh được không",
    "do you speak vietnamese":"bạn nói tiếng việt được không",
    "i speak a little vietnamese":"tôi nói một chút tiếng việt",
    "how are you":"bạn khỏe không","i am fine":"tôi khỏe","nice to meet you":"rất vui được gặp bạn",
    "what is your name":"bạn tên gì","my name is":"tên tôi là",
    "where are you from":"bạn đến từ đâu","i am from":"tôi đến từ",
    "help":"giúp tôi","help me":"giúp tôi","emergency":"cấp cứu",
    "call the police":"gọi cảnh sát","call an ambulance":"gọi xe cứu thương",
    "where is the hospital":"bệnh viện ở đâu","pharmacy":"hiệu thuốc",
    "i am lost":"tôi bị lạc","where is the toilet":"nhà vệ sinh ở đâu",
    "how much does it cost":"giá bao nhiêu tiền","how much":"bao nhiêu",
    "too expensive":"đắt quá","cheap":"rẻ","expensive":"đắt",
    "can i have a discount":"giảm giá được không","i want to buy":"tôi muốn mua",
    "i want this one":"tôi muốn cái này","the bill please":"xin tính tiền",
    "where is the train station":"ga tàu hỏa ở đâu","train station":"ga tàu hỏa",
    "bus station":"bến xe buýt","airport":"sân bay","taxi":"xe taxi",
    "how do i get to":"làm sao để đến","go straight":"đi thẳng",
    "turn left":"rẽ trái","turn right":"rẽ phải","stop here":"dừng ở đây",
    "i want to go to":"tôi muốn đến","take me to":"chở tôi đến",
    "hotel":"khách sạn","where is the hotel":"khách sạn ở đâu",
    "i have a reservation":"tôi có đặt phòng","one room":"một phòng",
    "two rooms":"hai phòng","how much per night":"một đêm bao nhiêu",
    "i am hungry":"tôi đói","i am thirsty":"tôi khát",
    "menu please":"xin thực đơn","water":"nước","coffee":"cà phê",
    "tea":"trà","beer":"bia","food":"đồ ăn","rice":"cơm",
    "chicken":"gà","fish":"cá","vegetarian":"ăn chay",
    "it is delicious":"ngon quá","the check please":"xin tính tiền",
    "what time is it":"mấy giờ rồi","today":"hôm nay","tomorrow":"ngày mai",
    "yesterday":"hôm qua","morning":"buổi sáng","evening":"buổi tối",
    "monday":"thứ hai","tuesday":"thứ ba","wednesday":"thứ tư",
    "thursday":"thứ năm","friday":"thứ sáu","saturday":"thứ bảy","sunday":"chủ nhật",
    "i love you":"tôi yêu bạn","happy birthday":"chúc mừng sinh nhật",
    "good luck":"chúc may mắn","congratulations":"chúc mừng"
  };
  var PHRASEBOOK_VI = {};
  (function () {
    for (var k in PHRASEBOOK_EN) {
      if (Object.prototype.hasOwnProperty.call(PHRASEBOOK_EN, k)) {
        PHRASEBOOK_VI[PHRASEBOOK_EN[k]] = k;
      }
    }
  })();

  function phrasebookLookup(textStr, from, to) {
    var t = textStr.trim().toLowerCase();
    if (from === 'en' && to === 'vi') return PHRASEBOOK_EN[t] || null;
    if (from === 'vi' && to === 'en') return PHRASEBOOK_VI[t] || null;
    return null;
  }

  function cacheKey(from, to, textStr) {
    return from + '|' + to + '|' + textStr.trim().toLowerCase();
  }
  function cacheGet(from, to, textStr) {
    var k = cacheKey(from, to, textStr);
    var entry = _cache.get(k);
    if (entry) { _cache.delete(k); _cache.set(k, entry); return entry.trans; }
    return null;
  }
  var _persistTimer = null;
  function persistCache() {
    if (_persistTimer) return;
    _persistTimer = setTimeout(function () {
      _persistTimer = null;
      try {
        if (root.localStorage) {
          var entries = {};
          _cache.forEach(function (v, k) { entries[k] = v.trans; });
          root.localStorage.wdTransCache = JSON.stringify(entries);
        }
      } catch (e) {}
    }, 1000);
  }
  function cachePut(from, to, textStr, trans) {
    var k = cacheKey(from, to, textStr);
    _cache.delete(k);
    _cache.set(k, { trans: trans, ts: Date.now() });
    if (_cache.size > CACHE_MAX) {
      var firstKey = _cache.keys().next().value;
      if (firstKey !== undefined) _cache.delete(firstKey);
    }
    persistCache();
  }
  function hydrateCache() {
    try {
      if (root.localStorage && root.localStorage.wdTransCache) {
        var entries = JSON.parse(root.localStorage.wdTransCache);
        var keys = Object.keys(entries);
        for (var i = 0; i < keys.length && i < CACHE_MAX; i++) {
          _cache.set(keys[i], { trans: entries[keys[i]], ts: 0 });
        }
      }
    } catch (e) {}
  }
  hydrateCache();

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

  function fetchWithTimeout(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    var promise = fetch(url, { signal: controller.signal }).then(function (r) {
      clearTimeout(timer);
      return r;
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
    promise._controller = controller;
    return promise;
  }

  function fetchGoogle(textStr, from, to) {
    var sl = effectiveSourceLang(textStr, from);
    // v0.9.6: if source lang ends up same as target, use explicit 'from' (avoids identity)
    if (sl === to) sl = from;
    if (sl === to) sl = 'auto'; // last resort
    var gtx = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sl + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(textStr);
    var p = fetchWithTimeout(gtx, GOOGLE_TIMEOUT_MS);
    return p.then(function (r) { return r.json(); }).then(function (j) {
      var t = '';
      if (j && j[0]) j[0].forEach(function (s) { if (s && s[0]) t += s[0]; });
      if (!t) throw { code: 'empty', _controller: p._controller };
      if (t.indexOf('MYMEMORY') >= 0) throw { code: 'bad', _controller: p._controller };
      if (isNoOp(textStr, t)) throw { code: 'identity', _controller: p._controller, _doNotAbortOther: true };
      return { t: t, provider: 'google', _controller: p._controller };
    }).catch(function (e) {
      if (e && e._controller) throw e;
      throw { code: e && e.message || 'network', _controller: p._controller };
    });
  }

  function fetchMyMemory(textStr, from, to) {
    var fromLang = from;
    try { if (LANG && LANG.detectLanguage) { var d = LANG.detectLanguage(textStr); if (d.lang === 'vi' || d.lang === 'en') fromLang = d.lang; } } catch (e) {}
    // v0.9.6: CRITICAL FIX — MyMemory returns "PLEASE SELECT TWO DISTINCT LANGUAGES" if from===to
    if (fromLang === to) fromLang = from; // fall back to explicit source lang
    if (fromLang === to) { throw { code: 'same-lang', _controller: null }; } // still same? give up
    var mm = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(textStr) + '&langpair=' + fromLang + '|' + to;
    var p = fetchWithTimeout(mm, MM_TIMEOUT_MS);
    return p.then(function (r) { return r.json(); }).then(function (j) {
      var t = (j && j.responseData && j.responseData.translatedText) || '';
      if (!t) throw { code: 'empty', _controller: p._controller };
      // v0.9.6: filter ALL known MyMemory error strings
      var tUpper = t.toUpperCase();
      if (tUpper.indexOf('MYMEMORY WARNING') >= 0 ||
          tUpper.indexOf('PLEASE SELECT TWO DISTINCT LANGUAGES') >= 0 ||
          tUpper.indexOf('QUERY LENGTH LIMIT EXCEEDED') >= 0 ||
          tUpper.indexOf('DAILY QUOTA EXCEEDED') >= 0 ||
          tUpper.indexOf('INVALID LANGUAGE PAIR') >= 0 ||
          tUpper.indexOf('LANGUAGE PAIR NOT SUPPORTED') >= 0 ||
          tUpper.indexOf('NO TRANSLATION FOUND') >= 0) {
        throw { code: 'mm-error', _controller: p._controller, mmError: t };
      }
      if (isNoOp(textStr, t)) throw { code: 'identity', _controller: p._controller };
      return { t: t, provider: 'mm', _controller: p._controller };
    }).catch(function (e) {
      if (e && e._controller !== undefined) throw e;
      throw { code: e && e.message || 'network', _controller: p._controller };
    });
  }

  function translate(textStr, from, to, cb) {
    if (!textStr) { cb(''); return; }
    var norm = textStr.trim();
    var pb = phrasebookLookup(norm, from, to);
    if (pb) { cachePut(from, to, norm, pb); cb(pb); return; }
    var cached = cacheGet(from, to, norm);
    if (cached) { cb(cached); return; }

    var done = false;
    var googleDone = false, mmDone = false;
    var googleResult = null, mmResult = null;

    function finish(t) {
      if (done) return;
      done = true;
      if (t) { cachePut(from, to, norm, t); cb(t); } else { cb(''); }
    }

    function abortOther(winnerProvider) {
      try {
        if (winnerProvider === 'google' && mmResult && mmResult._controller && !mmDone) {
          mmResult._controller.abort();
        }
        if (winnerProvider === 'mm' && googleResult && googleResult._controller && !googleDone) {
          googleResult._controller.abort();
        }
      } catch (e) {}
    }

    function checkBothFailed() {
      if (googleDone && mmDone && !done) {
        try {
          var gtx2 = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + to + '&dt=t&q=' + encodeURIComponent(textStr);
          fetchWithTimeout(gtx2, GOOGLE_TIMEOUT_MS).then(function (r) { return r.json(); }).then(function (j) {
            var t = '';
            if (j && j[0]) j[0].forEach(function (s) { if (s && s[0]) t += s[0]; });
            if (t && !isNoOp(textStr, t)) finish(t); else finish('');
          }).catch(function () { finish(''); });
        } catch (e) { finish(''); }
      }
    }

    googleResult = fetchGoogle(textStr, from, to);
    googleResult.then(function (r) {
      googleDone = true;
      finish(r.t);
      abortOther('google');
    }).catch(function (e) {
      googleDone = true;
      if (e && e._doNotAbortOther) { /* Google identity: let MM run */ }
      checkBothFailed();
    });

    mmResult = fetchMyMemory(textStr, from, to);
    mmResult.then(function (r) {
      mmDone = true;
      if (!done) { finish(r.t); abortOther('mm'); }
    }).catch(function () {
      mmDone = true;
      checkBothFailed();
    });
  }

  function translateCell(cell, from, to, onTranslated) {
    if (!cell || !cell.final || cell._last === cell.final) return;
    var reqId = ++cell._requestId;
    translate(cell.final, from, to, function (t) {
      if (reqId !== cell._requestId) return;
      if (!t) return;
      cell.trans = t;
      cell._last = cell.final;
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

  function warmConnection() {
    try {
      if (root.fetch) {
        fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=hi', { mode: 'no-cors' }).catch(function () {});
      }
    } catch (e) {}
  }

  var mod = {
    translate: translate, translateCell: translateCell, translateRow: translateRow,
    scheduleTranslateActive: scheduleTranslateActive, warmConnection: warmConnection,
    _cache: _cache, _cacheGet: cacheGet, _cachePut: cachePut, _isNoOp: isNoOp,
    _phrasebookEN: PHRASEBOOK_EN, _phrasebookVI: PHRASEBOOK_VI,
    _phrasebookLookup: phrasebookLookup
  };
  root.WD = root.WD || {};
  root.WD.translation = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
