/* WebDich v0.9.9 — translation.js: Google + MyMemory + Dola Seed RACE
 * v0.9.9 updates:
 *  - Dola Seed API as 3rd provider (priority when enabled)
 *  - Dynamic language pairs from state.colLanguages
 *  - 4 Dola providers: FreeLLM, Synthorai, APIYi, BytePlus
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var LANG = (root.WD && root.WD.language) || (typeof require !== 'undefined' && require('./language.js'));

  var GOOGLE_TIMEOUT_MS = 800;
  var MM_TIMEOUT_MS = 1500;
  var DOLA_TIMEOUT_MS = 3000;
  var CACHE_MAX = 200;
  var _cache = new Map();

  // ===== DOLA SEED PROVIDERS =====
  var DOLA_PROVIDERS = {
    freellm: {
      name: 'FreeLLM / Kilo Code',
      baseUrl: 'https://router.freellm.net/v1/chat/completions',
      model: 'kilo-code/bytedance-seed-dola-seed-2-0-pro:free'
    },
    synthorai: {
      name: 'Synthorai',
      baseUrl: 'https://api.synthorai.io/v1/chat/completions',
      model: 'bytedance/dola-seed-2-0-pro'
    },
    apiyi: {
      name: 'APIYi',
      baseUrl: 'https://api.apiyi.com/v1/chat/completions',
      model: 'dola-seed-2-1-turbo-260628'
    },
    byteplus: {
      name: 'BytePlus ModelArk',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: 'doubao-seed-2-0-pro'
    }
  };

  // ===== LANGUAGE NAMES FOR DOLA PROMPT =====
  var LANG_NAMES = {
    'en': 'English', 'vi': 'Vietnamese', 'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)', 'ja': 'Japanese', 'ko': 'Korean',
    'fr': 'French', 'de': 'German', 'es': 'Spanish', 'th': 'Thai',
    'id': 'Indonesian', 'ms': 'Malay', 'pt': 'Portuguese', 'ru': 'Russian',
    'ar': 'Arabic', 'tr': 'Turkish', 'it': 'Italian', 'fil': 'Filipino'
  };

  // ===== PHRASEBOOK =====
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

  function fetchWithTimeout(url, timeoutMs, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    var fetchOpts = options || {};
    fetchOpts.signal = controller.signal;
    var promise = fetch(url, fetchOpts).then(function (r) {
      clearTimeout(timer);
      return r;
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
    promise._controller = controller;
    return promise;
  }

  // ===== GOOGLE =====
  function fetchGoogle(textStr, from, to) {
    var sl = effectiveSourceLang(textStr, from);
    if (sl === to) sl = from;
    if (sl === to) sl = 'auto';
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

  // ===== MYMEMORY =====
  function fetchMyMemory(textStr, from, to) {
    var fromLang = from;
    try { if (LANG && LANG.detectLanguage) { var d = LANG.detectLanguage(textStr); if (d.lang === 'vi' || d.lang === 'en') fromLang = d.lang; } } catch (e) {}
    if (fromLang === to) fromLang = from;
    if (fromLang === to) { throw { code: 'same-lang', _controller: null }; }
    var mm = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(textStr) + '&langpair=' + fromLang + '|' + to;
    var p = fetchWithTimeout(mm, MM_TIMEOUT_MS);
    return p.then(function (r) { return r.json(); }).then(function (j) {
      var t = (j && j.responseData && j.responseData.translatedText) || '';
      if (!t) throw { code: 'empty', _controller: p._controller };
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

  // ===== DOLA SEED =====
  function fetchDolaSeed(textStr, from, to) {
    if (!state || !state.isDolaEnabled || !state.isDolaEnabled()) {
      return Promise.reject({ code: 'dola-disabled', _controller: null });
    }
    var cfg = state.apiConfig;
    var provider = DOLA_PROVIDERS[cfg.provider];
    if (!provider) {
      return Promise.reject({ code: 'dola-provider-unknown', _controller: null });
    }
    var fromName = LANG_NAMES[from] || from;
    var toName = LANG_NAMES[to] || to;
    var systemPrompt = 'You are a professional translator. Translate the following text from ' +
      fromName + ' to ' + toName + '. Return ONLY the translated text, no explanations, no extra content.';

    var p = fetchWithTimeout(provider.baseUrl, DOLA_TIMEOUT_MS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key.trim()
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: textStr }
        ],
        stream: false,
        temperature: 0.3
      })
    });

    return p.then(function (r) {
      if (!r.ok) throw { code: 'dola-http-' + r.status, _controller: p._controller };
      return r.json();
    }).then(function (j) {
      var t = '';
      if (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) {
        t = j.choices[0].message.content.trim();
      }
      if (!t) throw { code: 'dola-empty', _controller: p._controller };
      if (isNoOp(textStr, t)) throw { code: 'identity', _controller: p._controller };
      return { t: t, provider: 'dola', _controller: p._controller };
    }).catch(function (e) {
      if (e && e._controller !== undefined) throw e;
      throw { code: e && e.code || e.message || 'dola-network', _controller: p._controller };
    });
  }

  // ===== MAIN TRANSLATE: 3 providers race =====
  function translate(textStr, from, to, cb) {
    if (!textStr) { cb(''); return; }
    var norm = textStr.trim();
    var pb = phrasebookLookup(norm, from, to);
    if (pb) { cachePut(from, to, norm, pb); cb(pb); return; }
    var cached = cacheGet(from, to, norm);
    if (cached) { cb(cached); return; }

    var done = false;
    var results = { google: null, mm: null, dola: null };
    var finished = { google: false, mm: false, dola: false };

    function finish(t, provider) {
      if (done) return;
      done = true;
      if (t) { cachePut(from, to, norm, t); cb(t); } else { cb(''); }
      // Abort losers
      try {
        for (var key in results) {
          if (key !== provider && results[key] && results[key]._controller && !finished[key]) {
            try { results[key]._controller.abort(); } catch (e) {}
          }
        }
      } catch (e) {}
    }

    function checkAllFailed() {
      if (finished.google && finished.mm && finished.dola && !done) {
        // Last resort: Google with auto
        try {
          var gtx2 = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + to + '&dt=t&q=' + encodeURIComponent(textStr);
          fetchWithTimeout(gtx2, GOOGLE_TIMEOUT_MS).then(function (r) { return r.json(); }).then(function (j) {
            var t = '';
            if (j && j[0]) j[0].forEach(function (s) { if (s && s[0]) t += s[0]; });
            if (t && !isNoOp(textStr, t)) finish(t, 'google-fallback'); else cb('');
          }).catch(function () { cb(''); });
        } catch (e) { cb(''); }
      }
    }

    // Google
    results.google = fetchGoogle(textStr, from, to);
    results.google.then(function (r) {
      finished.google = true;
      // Nếu Dola chưa về và Google OK, dùng Google (nhanh hơn)
      if (!done) finish(r.t, 'google');
    }).catch(function (e) {
      finished.google = true;
      checkAllFailed();
    });

    // MyMemory
    results.mm = fetchMyMemory(textStr, from, to);
    results.mm.then(function (r) {
      finished.mm = true;
      if (!done) finish(r.t, 'mm');
    }).catch(function () {
      finished.mm = true;
      checkAllFailed();
    });

    // Dola Seed (ưu tiên nếu bật)
    if (state && state.isDolaEnabled && state.isDolaEnabled()) {
      results.dola = fetchDolaSeed(textStr, from, to);
      results.dola.then(function (r) {
        finished.dola = true;
        // Dola có chất lượng cao hơn → luôn ưu tiên nếu về trước hoặc sau Google
        finish(r.t, 'dola');
      }).catch(function () {
        finished.dola = true;
        checkAllFailed();
      });
    } else {
      finished.dola = true;
    }
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
    // v0.9.9: Dùng ngôn ngữ động từ state.colLanguages
    var enLang = state.colLanguages.en.code;
    var viLang = state.colLanguages.vi.code;
    translateCell(row.en, enLang, viLang, onTranslated);
    translateCell(row.vi, viLang, enLang, onTranslated);
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
    fetchDolaSeed: fetchDolaSeed,
    _cache: _cache, _cacheGet: cacheGet, _cachePut: cachePut, _isNoOp: isNoOp,
    _phrasebookEN: PHRASEBOOK_EN, _phrasebookVI: PHRASEBOOK_VI,
    _phrasebookLookup: phrasebookLookup,
    _providers: DOLA_PROVIDERS
  };
  root.WD = root.WD || {};
  root.WD.translation = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
