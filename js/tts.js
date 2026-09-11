/* WebDich v0.8 — tts.js: speechSynthesis wrapper.
 * Rules: only speak FINAL translation; each final translation spoken once (guarded by _lastSpokenTranslation).
 * Echo filter: sets state.ttsSpeaking while speaking; app ignores ASR while true.
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var voices = [];
  function loadVoices() { if (root.speechSynthesis) voices = root.speechSynthesis.getVoices(); }
  function pickVoice(lang) {
    var pref = (lang || '').slice(0, 2);
    for (var i = 0; i < voices.length; i++) { if (voices[i].lang && voices[i].lang.slice(0, 2) === pref) return voices[i]; }
    return null;
  }
  // Speak a FINAL translation, once. Returns true if actually spoken.
  function speak(text, lang) {
    if (!text || !root.speechSynthesis) return false;
    var key = lang + '|' + text;
    if (state._lastSpokenTranslation === key) return false; // duplicate guard
    state._lastSpokenTranslation = key;
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    var v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = (lang.slice(0, 2) === 'vi') ? state.ttsRate.vi : state.ttsRate.en;
    u.pitch = 1.0;
    u.onstart = function () { state.ttsSpeaking = true; };
    u.onend = function () { setTimeout(function () { state.ttsSpeaking = false; }, 250); };
    u.onerror = function () { state.ttsSpeaking = false; };
    root.speechSynthesis.speak(u);
    return true;
  }
  var mod = { loadVoices: loadVoices, pickVoice: pickVoice, speak: speak };
  root.WD = root.WD || {};
  root.WD.tts = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
