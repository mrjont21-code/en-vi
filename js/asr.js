/* WebDich v0.8 — asr.js: pure SpeechRecognition lifecycle + result extraction.
 * No pipeline, no language scoring, no DOM. App wires callbacks.
 * exact-once: iterate from e.resultIndex; each final processed once.
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var SR = (root.SpeechRecognition || root.webkitSpeechRecognition);
  var supported = !!SR;
  function extractResult(e) {
    var interim = '', finalText = '', confSum = 0, confN = 0;
    for (var i = e.resultIndex; i < e.results.length; i++) {
      var r = e.results[i];
      var alt = r[0] || {};
      var t = alt.transcript || '';
      if (r.isFinal) {
        finalText += t + ' ';
        if (typeof alt.confidence === 'number') { confSum += alt.confidence; confN++; }
      } else {
        interim += t;
      }
    }
    return { interim: interim.trim(), final: finalText.trim(), conf: confN ? confSum / confN : 0 };
  }
  function makeRecognizer(lang, handlers) {
    var r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.maxAlternatives = 1;
    r.onresult = handlers.onresult;
    r.onend = handlers.onend;
    r.onerror = handlers.onerror;
    try { r.start(); } catch (e) {}
    return r;
  }
  // handlers: { onresult(e), onend(), onerror(e) }
  function startEN(handlers) {
    if (!supported || state.recEN) return;
    state.lastStartTs = Date.now();
    try { state.recEN = makeRecognizer('en-US', handlers); } catch (e) { state.recEN = null; }
  }
  function startVI(handlers) {
    if (!supported || state.viFailed || state.recVI) return;
    state.lastStartTs = Date.now();
    try { state.recVI = makeRecognizer('vi-VN', handlers); } catch (e) { state.viFailed = true; state.recVI = null; }
  }
  function stopAll() {
    if (state.recEN) { try { state.recEN.stop(); } catch (e) {} state.recEN = null; }
    if (state.recVI) { try { state.recVI.stop(); } catch (e) {} state.recVI = null; }
  }
  function stopEN() { if (state.recEN) { try { state.recEN.stop(); } catch (e) {} state.recEN = null; } }
  function stopVI() { if (state.recVI) { try { state.recVI.stop(); } catch (e) {} state.recVI = null; } }
  var mod = { supported: supported, extractResult: extractResult, makeRecognizer: makeRecognizer, startEN: startEN, startVI: startVI, stopAll: stopAll, stopEN: stopEN, stopVI: stopVI };
  root.WD = root.WD || {};
  root.WD.asr = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
