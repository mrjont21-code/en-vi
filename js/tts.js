/* WebDich v0.9.3 — tts.js: speechSynthesis wrapper.
 * Rules: only speak FINAL translation; each final translation spoken once (guarded by _lastSpokenTranslation).
 * Echo filter: sets state.ttsSpeaking while speaking; app ignores ASR while true.
 * Fixes v0.9.3:
 *  - Safety timeout: ttsSpeaking is forcibly cleared after maxDurationMs even if onend never fires
 *    (Chrome bug: cancel() often does NOT fire onend, leaving flag stuck true forever)
 *  - onstart / onend / onerror all robustly manage the flag
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var voices = [];
  var MAX_SPEAK_MS = 30000; // 30s safety — longest sentence we'd ever expect

  function loadVoices() { if (root.speechSynthesis) voices = root.speechSynthesis.getVoices(); }

  function pickVoice(lang) {
    var pref = (lang || '').slice(0, 2);
    for (var i = 0; i < voices.length; i++) { if (voices[i].lang && voices[i].lang.slice(0, 2) === pref) return voices[i]; }
    return null;
  }

  // v0.9.3: central flag management with safety net
  function clearTtsSpeaking() {
    state.ttsSpeaking = false;
    if (state._ttsUnstickTimer) { clearTimeout(state._ttsUnstickTimer); state._ttsUnstickTimer = null; }
  }

  function setTtsSpeaking() {
    state.ttsSpeaking = true;
    if (state._ttsUnstickTimer) clearTimeout(state._ttsUnstickTimer);
    state._ttsUnstickTimer = setTimeout(clearTtsSpeaking, MAX_SPEAK_MS);
  }

  // Speak a FINAL translation, once. Returns true if actually spoken.
  function speak(text, lang) {
    if (!text || !root.speechSynthesis) return false;
    var key = lang + '|' + text;
    if (state._lastSpokenTranslation === key) return false; // duplicate guard
    state._lastSpokenTranslation = key;
    // v0.9.5: set ttsSpeaking IMMEDIATELY, don't wait for onstart (100–300ms gap = echo leak)
    setTtsSpeaking();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    var v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = (lang.slice(0, 2) === 'vi') ? state.ttsRate.vi : state.ttsRate.en;
    u.pitch = 1.0;
    u.onstart = function () { /* already set */ };
    u.onend = function () { setTimeout(clearTtsSpeaking, 250); };
    u.onerror = function () { clearTtsSpeaking(); };
    root.speechSynthesis.speak(u);
    return true;
  }

  var mod = { loadVoices: loadVoices, pickVoice: pickVoice, speak: speak };
  root.WD = root.WD || {};
  root.WD.tts = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
