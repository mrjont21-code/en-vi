/* WebDich v0.9.7 — tts.js: speechSynthesis wrapper.
 * v0.9.7:
 *  - pickVoice supports genderHint ('male'/'female') — EN defaults to male, VI to female
 *  - speak() accepts optional onEnd callback for TTS queue coordination
 *  - ttsSpeaking set immediately (v0.9.5 fix)
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
  var voices = [];
  var MAX_SPEAK_MS = 30000;

  function loadVoices() { if (root.speechSynthesis) voices = root.speechSynthesis.getVoices(); }

  // v0.9.7: gender-aware voice selection
  // genderHint: 'male' | 'female' | null
  function pickVoice(lang, genderHint) {
    var pref = (lang || '').slice(0, 2);
    var matching = [];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.slice(0, 2) === pref) matching.push(voices[i]);
    }
    if (!matching.length) return null;
    if (!genderHint) return matching[0];

    var nameLower, hint;
    if (genderHint === 'male') {
      // Prefer voices with male indicators in name
      for (var j = 0; j < matching.length; j++) {
        nameLower = (matching[j].name || '').toLowerCase();
        hint = matching[j].voiceURI || '';
        if (nameLower.indexOf('male') >= 0 || nameLower.indexOf('guy') >= 0 || nameLower.indexOf('man') >= 0 ||
            nameLower.indexOf('david') >= 0 || nameLower.indexOf('mark') >= 0 || nameLower.indexOf('daniel') >= 0 ||
            nameLower.indexOf('alex') >= 0 || nameLower.indexOf('fred') >= 0 ||
            hint.indexOf('male') >= 0) return matching[j];
      }
      // Fallback: last voice in list often male on many systems
      return matching[matching.length - 1];
    }
    if (genderHint === 'female') {
      for (var k = 0; k < matching.length; k++) {
        nameLower = (matching[k].name || '').toLowerCase();
        hint = matching[k].voiceURI || '';
        if (nameLower.indexOf('female') >= 0 || nameLower.indexOf('woman') >= 0 || nameLower.indexOf('girl') >= 0 ||
            nameLower.indexOf('samantha') >= 0 || nameLower.indexOf('victoria') >= 0 ||
            nameLower.indexOf('karen') >= 0 || nameLower.indexOf('tina') >= 0 ||
            nameLower.indexOf('zira') >= 0 || nameLower.indexOf('lien') >= 0 ||
            hint.indexOf('female') >= 0) return matching[k];
      }
      // Fallback: first voice in list often female on many systems
      return matching[0];
    }
    return matching[0];
  }

  function clearTtsSpeaking() {
    state.ttsSpeaking = false;
    if (state._ttsUnstickTimer) { clearTimeout(state._ttsUnstickTimer); state._ttsUnstickTimer = null; }
  }
  function setTtsSpeaking() {
    state.ttsSpeaking = true;
    if (state._ttsUnstickTimer) clearTimeout(state._ttsUnstickTimer);
    state._ttsUnstickTimer = setTimeout(clearTtsSpeaking, MAX_SPEAK_MS);
  }

  // v0.9.7: speak accepts genderHint + onEnd callback for TTS queue
  function speak(text, lang, genderHint, onEnd) {
    if (!text || !root.speechSynthesis) return false;
    var key = lang + '|' + text;
    if (state._lastSpokenTranslation === key) return false;
    state._lastSpokenTranslation = key;
    setTtsSpeaking();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    var v = pickVoice(lang, genderHint);
    if (v) u.voice = v;
    u.rate = (lang.slice(0, 2) === 'vi') ? state.ttsRate.vi : state.ttsRate.en;
    u.pitch = (genderHint === 'female') ? 1.1 : (genderHint === 'male' ? 0.9 : 1.0);
    u.onstart = function () { /* already set */ };
    u.onend = function () {
      setTimeout(function () {
        clearTtsSpeaking();
        if (onEnd) onEnd();
      }, 150);
    };
    u.onerror = function () {
      clearTtsSpeaking();
      if (onEnd) onEnd();
    };
    root.speechSynthesis.speak(u);
    return true;
  }

  var mod = { loadVoices: loadVoices, pickVoice: pickVoice, speak: speak };
  root.WD = root.WD || {};
  root.WD.tts = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
