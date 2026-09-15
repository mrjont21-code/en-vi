/* WebDich v0.9.9 — state.js: pure state management
 * v0.9.9 updates:
 *  - Configurable column languages (18 languages supported)
 *  - Dola Seed API config (key, provider, enabled)
 *  - All settings persist to localStorage
 */
(function (root) {
  'use strict';

  var SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸', asr: 'en-US', tts: 'en-US', label: 'English' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', asr: 'vi-VN', tts: 'vi-VN', label: 'Vietnamese' },
    { code: 'zh', name: '中文 (简体)', flag: '🇨🇳', asr: 'zh-CN', tts: 'zh-CN', label: 'Chinese' },
    { code: 'zh-TW', name: '中文 (繁體)', flag: '🇭🇰', asr: 'zh-TW', tts: 'zh-TW', label: 'Chinese Trad' },
    { code: 'ja', name: '日本語', flag: '🇯🇵', asr: 'ja-JP', tts: 'ja-JP', label: 'Japanese' },
    { code: 'ko', name: '한국어', flag: '🇰🇷', asr: 'ko-KR', tts: 'ko-KR', label: 'Korean' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', asr: 'fr-FR', tts: 'fr-FR', label: 'French' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', asr: 'de-DE', tts: 'de-DE', label: 'German' },
    { code: 'es', name: 'Español', flag: '🇪🇸', asr: 'es-ES', tts: 'es-ES', label: 'Spanish' },
    { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', asr: 'th-TH', tts: 'th-TH', label: 'Thai' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩', asr: 'id-ID', tts: 'id-ID', label: 'Indonesian' },
    { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾', asr: 'ms-MY', tts: 'ms-MY', label: 'Malay' },
    { code: 'pt', name: 'Português', flag: '🇵🇹', asr: 'pt-PT', tts: 'pt-PT', label: 'Portuguese' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺', asr: 'ru-RU', tts: 'ru-RU', label: 'Russian' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦', asr: 'ar-SA', tts: 'ar-SA', label: 'Arabic' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷', asr: 'tr-TR', tts: 'tr-TR', label: 'Turkish' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹', asr: 'it-IT', tts: 'it-IT', label: 'Italian' },
    { code: 'fil', name: 'Filipino', flag: '🇵🇭', asr: 'fil-PH', tts: 'fil-PH', label: 'Filipino' }
  ];

  function defaultAsrLang() {
    try {
      if (root.localStorage && root.localStorage.wdAsrLang) {
        var saved = root.localStorage.wdAsrLang;
        var found = SUPPORTED_LANGUAGES.find(function(l) { return l.asr === saved; });
        if (found) return saved;
      }
    } catch (e) {}
    try {
      var nav = (root.navigator && root.navigator.language) || '';
      if (nav.toLowerCase().indexOf('vi') === 0) return 'vi-VN';
      if (nav.toLowerCase().indexOf('en') === 0) return 'en-US';
    } catch (e) {}
    return 'vi-VN';
  }

  function persistAsrLang(lang) {
    try { if (root.localStorage) root.localStorage.wdAsrLang = lang; } catch (e) {}
  }

  function getColLang(colKey) {
    try {
      if (root.localStorage) {
        var saved = root.localStorage['wdColLang_' + colKey];
        if (saved) {
          var found = SUPPORTED_LANGUAGES.find(function(l) { return l.code === saved; });
          if (found) return found;
        }
      }
    } catch (e) {}
    return colKey === 'en' ? SUPPORTED_LANGUAGES[0] : SUPPORTED_LANGUAGES[1];
  }

  function persistColLang(colKey, langCode) {
    try { if (root.localStorage) root.localStorage['wdColLang_' + colKey] = langCode; } catch (e) {}
  }

  function getApiConfig() {
    try {
      if (root.localStorage && root.localStorage.wdApiConfig) {
        return JSON.parse(root.localStorage.wdApiConfig);
      }
    } catch (e) {}
    return { key: '', provider: 'freellm', enabled: true };
  }

  function persistApiConfig(config) {
    try { if (root.localStorage) root.localStorage.wdApiConfig = JSON.stringify(config); } catch (e) {}
  }

  var colLangEn = getColLang('en');
  var colLangVi = getColLang('vi');
  var apiConfig = getApiConfig();

  var S = {
    colLanguages: { en: colLangEn, vi: colLangVi },
    apiConfig: apiConfig,
    micOn: false,
    userStopped: false,
    recEN: null,
    recVI: null,
    recSingle: null,
    viFailed: false,
    pending: { en: null, vi: null },
    rows: [],
    segments: [],
    _segmentCounter: 0,
    activeRow: null,
    channel: { en: true, vi: true },
    dualMode: true,
    asrLang: defaultAsrLang(),
    ttsRate: { en: 1.1, vi: 1.1 },
    ttsSpeaking: false,
    restartTimer: null,
    commitTimer: null,
    chunkTimer: null,
    transDebounce: null,
    speculativeTimer: null,
    lastStableInterim: '',
    lastStartTs: 0,
    needRestart: { en: false, vi: false },
    committedTail: '',
    _lastSpokenTranslation: '',
    _ttsUnstickTimer: null,
    _pauseTimer: null,
    _langStreak: null,
    _persistAsrLang: persistAsrLang,
    _persistColLang: persistColLang,
    _persistApiConfig: persistApiConfig,
    _getLanguageByCode: function(code) {
      return SUPPORTED_LANGUAGES.find(function(l) { return l.code === code; });
    },
    _getAllLanguages: function() {
      return SUPPORTED_LANGUAGES.slice();
    },
    setColLanguage: function(colKey, langCode) {
      var lang = this._getLanguageByCode(langCode);
      if (!lang) return false;
      this.colLanguages[colKey] = lang;
      this._persistColLang(colKey, langCode);
      return true;
    },
    setApiConfig: function(config) {
      this.apiConfig = config;
      this._persistApiConfig(config);
    },
    isDolaEnabled: function() {
      return this.apiConfig && this.apiConfig.enabled &&
             this.apiConfig.key && this.apiConfig.key.trim().length > 0;
    }
  };

  S.newRow = function () {
    return {
      en: { final: '', trans: '', _last: '', _requestId: 0, _spoken: false, idiom: '' },
      vi: { final: '', trans: '', _last: '', _requestId: 0, _spoken: false, idiom: '' },
      finalized: false
    };
  };

  S.reset = function () {
    S.micOn = false; S.userStopped = false; S.recEN = null; S.recVI = null; S.recSingle = null;
    S.viFailed = false; S.pending = { en: null, vi: null }; S.rows = []; S.activeRow = null;
    S.segments = []; S._segmentCounter = 0;
    S.channel = { en: true, vi: true }; S.dualMode = true;
    S.asrLang = defaultAsrLang();
    S.ttsRate = { en: 1.1, vi: 1.1 }; S.ttsSpeaking = false;
    S.restartTimer = null; S.commitTimer = null; S.chunkTimer = null;
    S.transDebounce = null; S.speculativeTimer = null; S.lastStableInterim = '';
    S.lastStartTs = 0; S.needRestart = { en: false, vi: false }; S.committedTail = '';
    S._lastSpokenTranslation = ''; S._ttsUnstickTimer = null; S._pauseTimer = null; S._langStreak = null;
  };

  root.WD = root.WD || {};
  root.WD.state = S;
  root.WD.languages = SUPPORTED_LANGUAGES;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : global);
