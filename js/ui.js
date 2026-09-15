/* WebDich v0.9.9 — ui.js: DOM + modal + long-press handlers.
 * v0.9.9 updates:
 *  - Long press on title bar → opens API settings modal
 *  - Long press on EN/VI buttons → opens language selector modal
 *  - Dynamic column labels based on selected languages
 *  - API settings modal with key input + provider selection
 */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));

  var LONG_PRESS_MS = 500;
  var _pressTimer = null;
  var _pressTarget = null;
  var _activeLangColumn = null;

  var el = {};

  function init() {
    el.live = root.document.getElementById('live');
    el.en = root.document.getElementById('final-en');
    el.vi = root.document.getElementById('final-vi');
    el.enBody = root.document.getElementById('body-en');
    el.viBody = root.document.getElementById('body-vi');
    el.mic = root.document.getElementById('mic');
    el.chEn = root.document.getElementById('ch-en');
    el.chVi = root.document.getElementById('ch-vi');
    el.rateEn = root.document.getElementById('rate-en');
    el.rateEnVal = root.document.getElementById('rate-en-val');
    el.rateVi = root.document.getElementById('rate-vi');
    el.rateViVal = root.document.getElementById('rate-vi-val');
    el.badge = root.document.getElementById('version-badge');

    el.titleBar = root.document.getElementById('title-bar');
    el.labelEn = root.document.getElementById('label-en');
    el.labelVi = root.document.getElementById('label-vi');
    el.pressFeedback = root.document.getElementById('press-feedback');

    el.apiModal = root.document.getElementById('api-modal');
    el.apiKeyInput = root.document.getElementById('api-key-input');
    el.apiProviderSelect = root.document.getElementById('api-provider-select');
    el.dolaEnabled = root.document.getElementById('dola-enabled');
    el.apiStatus = root.document.getElementById('api-status');
    el.saveApiBtn = root.document.getElementById('save-api-settings');
    el.toggleApiKey = root.document.getElementById('toggle-api-key');

    el.langModal = root.document.getElementById('lang-modal');
    el.langModalTitle = root.document.getElementById('lang-modal-title');
    el.langSearch = root.document.getElementById('lang-search');
    el.langList = root.document.getElementById('lang-list');

    _addProgressRing(el.chEn);
    _addProgressRing(el.chVi);

    updateColumnLabels();
    _bindLongPressHandlers();
    _bindModalHandlers();
    _bindApiFormHandlers();
    _bindLangSearch();
    _loadApiConfigToForm();
  }

  function _addProgressRing(btn) {
    if (!btn) return;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = root.document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'progress-ring');
    svg.setAttribute('viewBox', '0 0 54 54');
    var circle = root.document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', '27');
    circle.setAttribute('cy', '27');
    circle.setAttribute('r', '25');
    circle.setAttribute('stroke-dasharray', '157');
    circle.setAttribute('stroke-dashoffset', '157');
    svg.appendChild(circle);
    btn.appendChild(svg);
  }

  function _setRingProgress(btn, progress) {
    var circle = btn.querySelector('.progress-ring circle');
    if (circle) {
      var circumference = 157;
      circle.style.strokeDashoffset = circumference * (1 - progress);
    }
  }

  function _bindLongPressHandlers() {
    if (el.titleBar) {
      el.titleBar.addEventListener('mousedown', function(e) { _startPress(e, el.titleBar, 'api'); });
      el.titleBar.addEventListener('touchstart', function(e) { _startPress(e, el.titleBar, 'api'); }, { passive: true });
      el.titleBar.addEventListener('mouseup', _cancelPress);
      el.titleBar.addEventListener('mouseleave', _cancelPress);
      el.titleBar.addEventListener('touchend', _cancelPress);
      el.titleBar.addEventListener('touchcancel', _cancelPress);
    }

    if (el.chEn) {
      el.chEn.addEventListener('mousedown', function(e) { e.preventDefault(); _startPress(e, el.chEn, 'lang-en'); });
      el.chEn.addEventListener('touchstart', function(e) { e.preventDefault(); _startPress(e, el.chEn, 'lang-en'); }, { passive: false });
      el.chEn.addEventListener('mouseup', function(e) { _handleClickOrCancel(e, 'en'); });
      el.chEn.addEventListener('mouseleave', _cancelPress);
      el.chEn.addEventListener('touchend', function(e) { _handleClickOrCancel(e, 'en'); });
      el.chEn.addEventListener('touchcancel', _cancelPress);
    }

    if (el.chVi) {
      el.chVi.addEventListener('mousedown', function(e) { e.preventDefault(); _startPress(e, el.chVi, 'lang-vi'); });
      el.chVi.addEventListener('touchstart', function(e) { e.preventDefault(); _startPress(e, el.chVi, 'lang-vi'); }, { passive: false });
      el.chVi.addEventListener('mouseup', function(e) { _handleClickOrCancel(e, 'vi'); });
      el.chVi.addEventListener('mouseleave', _cancelPress);
      el.chVi.addEventListener('touchend', function(e) { _handleClickOrCancel(e, 'vi'); });
      el.chVi.addEventListener('touchcancel', _cancelPress);
    }
  }

  function _startPress(e, target, action) {
    _pressTarget = { el: target, action: action };
    target.classList.add('pressing');

    var point = _getEventPoint(e);
    if (point && el.pressFeedback) {
      el.pressFeedback.style.left = point.x + 'px';
      el.pressFeedback.style.top = point.y + 'px';
      el.pressFeedback.classList.add('active');
      el.pressFeedback.classList.remove('complete');
    }

    if (action.indexOf('lang-') === 0) {
      var startTime = Date.now();
      function animateRing() {
        if (!_pressTarget || _pressTarget.el !== target) return;
        var elapsed = Date.now() - startTime;
        var progress = Math.min(elapsed / LONG_PRESS_MS, 1);
        _setRingProgress(target, progress);
        if (progress < 1) root.requestAnimationFrame(animateRing);
      }
      root.requestAnimationFrame(animateRing);
    }

    _pressTimer = setTimeout(function() { _triggerLongPress(action); }, LONG_PRESS_MS);
  }

  function _cancelPress(e) {
    if (_pressTimer) { clearTimeout(_pressTimer); _pressTimer = null; }
    if (_pressTarget) {
      _pressTarget.el.classList.remove('pressing');
      if (_pressTarget.action.indexOf('lang-') === 0) _setRingProgress(_pressTarget.el, 0);
      _pressTarget = null;
    }
    if (el.pressFeedback) el.pressFeedback.classList.remove('active', 'complete');
  }

  function _handleClickOrCancel(e, colKey) {
    if (_pressTimer === null && _pressTarget === null) return;
    var wasLongPress = !_pressTimer;
    _cancelPress(e);
    if (!wasLongPress && WD && WD.app && WD.app.toggleChannel) {
      WD.app.toggleChannel(colKey);
    }
  }

  function _triggerLongPress(action) {
    if (_pressTimer) { clearTimeout(_pressTimer); _pressTimer = null; }
    if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(30);
    if (el.pressFeedback) el.pressFeedback.classList.add('complete');
    if (_pressTarget && _pressTarget.action.indexOf('lang-') === 0) _setRingProgress(_pressTarget.el, 1);

    setTimeout(function() {
      if (_pressTarget) {
        _pressTarget.el.classList.remove('pressing');
        if (_pressTarget.action.indexOf('lang-') === 0) _setRingProgress(_pressTarget.el, 0);
      }
      if (el.pressFeedback) el.pressFeedback.classList.remove('active', 'complete');

      if (action === 'api') openApiModal();
      else if (action === 'lang-en') { _activeLangColumn = 'en'; openLangModal('Chọn ngôn ngữ cho cột trái'); }
      else if (action === 'lang-vi') { _activeLangColumn = 'vi'; openLangModal('Chọn ngôn ngữ cho cột phải'); }
      _pressTarget = null;
    }, 150);
  }

  function _getEventPoint(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.clientX !== undefined) return { x: e.clientX, y: e.clientY };
    return null;
  }

  function _bindModalHandlers() {
    var closeBtns = root.document.querySelectorAll('[data-close]');
    closeBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var modalId = btn.getAttribute('data-close');
        closeModal(modalId);
      });
    });
    if (el.apiModal) el.apiModal.addEventListener('click', function(e) { if (e.target === el.apiModal) closeModal('api-modal'); });
    if (el.langModal) el.langModal.addEventListener('click', function(e) { if (e.target === el.langModal) closeModal('lang-modal'); });
    root.document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { closeModal('api-modal'); closeModal('lang-modal'); }
    });
  }

  function openModal(modalId) {
    var modal = root.document.getElementById(modalId);
    if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  }

  function closeModal(modalId) {
    var modal = root.document.getElementById(modalId);
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  }

  function openApiModal() { _loadApiConfigToForm(); _hideApiStatus(); openModal('api-modal'); }
  function openLangModal(title) {
    if (el.langModalTitle) el.langModalTitle.textContent = '🌐 ' + title;
    if (el.langSearch) el.langSearch.value = '';
    _renderLanguageList('');
    openModal('lang-modal');
  }

  function _bindApiFormHandlers() {
    if (el.toggleApiKey) el.toggleApiKey.addEventListener('click', function() {
      var type = el.apiKeyInput.type === 'password' ? 'text' : 'password';
      el.apiKeyInput.type = type;
      el.toggleApiKey.textContent = type === 'password' ? '👁' : '🙈';
    });
    if (el.saveApiBtn) el.saveApiBtn.addEventListener('click', _saveApiConfig);
  }

  function _loadApiConfigToForm() {
    if (!state || !state.apiConfig) return;
    var cfg = state.apiConfig;
    if (el.apiKeyInput) el.apiKeyInput.value = cfg.key || '';
    if (el.apiProviderSelect) el.apiProviderSelect.value = cfg.provider || 'freellm';
    if (el.dolaEnabled) el.dolaEnabled.checked = cfg.enabled !== false;
  }

  function _saveApiConfig() {
    var key = el.apiKeyInput ? el.apiKeyInput.value.trim() : '';
    var provider = el.apiProviderSelect ? el.apiProviderSelect.value : 'freellm';
    var enabled = el.dolaEnabled ? el.dolaEnabled.checked : true;
    if (enabled && !key) { _showApiStatus('Vui lòng nhập API Key khi bật Dola Seed', 'error'); return; }
    state.setApiConfig({ key: key, provider: provider, enabled: enabled });
    if (enabled && key) {
      _showApiStatus('✅ Đã lưu! Dola Seed đã sẵn sàng sử dụng', 'success');
      setTimeout(function() { closeModal('api-modal'); }, 1200);
    } else {
      _showApiStatus('✅ Đã lưu cấu hình', 'success');
      setTimeout(function() { closeModal('api-modal'); }, 800);
    }
  }

  function _showApiStatus(msg, type) {
    if (!el.apiStatus) return;
    el.apiStatus.textContent = msg;
    el.apiStatus.className = 'api-status ' + type;
  }

  function _hideApiStatus() {
    if (el.apiStatus) { el.apiStatus.className = 'api-status'; el.apiStatus.textContent = ''; }
  }

  function _bindLangSearch() {
    if (el.langSearch) el.langSearch.addEventListener('input', function() {
      _renderLanguageList(el.langSearch.value.trim().toLowerCase());
    });
  }

  function _renderLanguageList(filter) {
    if (!el.langList || !state) return;
    el.langList.innerHTML = '';
    var languages = state._getAllLanguages();
    var currentCode = _activeLangColumn ? state.colLanguages[_activeLangColumn].code : null;
    languages.forEach(function(lang) {
      if (filter) {
        var match = lang.name.toLowerCase().indexOf(filter) >= 0 ||
                    lang.code.toLowerCase().indexOf(filter) >= 0 ||
                    lang.label.toLowerCase().indexOf(filter) >= 0;
        if (!match) return;
      }
      var item = root.document.createElement('div');
      item.className = 'lang-item' + (lang.code === currentCode ? ' active' : '');
      item.innerHTML =
        '<span class="lang-flag">' + lang.flag + '</span>' +
        '<span class="lang-name">' + lang.name + '</span>' +
        '<span class="lang-code">' + lang.code + '</span>';
      item.addEventListener('click', function() { _selectLanguage(lang.code); });
      el.langList.appendChild(item);
    });
    if (el.langList.children.length === 0) {
      el.langList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">Không tìm thấy ngôn ngữ</div>';
    }
  }

  function _selectLanguage(langCode) {
    if (!_activeLangColumn || !state) return;
    var success = state.setColLanguage(_activeLangColumn, langCode);
    if (success) {
      updateColumnLabels();
      closeModal('lang-modal');
      if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(20);
    }
  }

  function updateColumnLabels() {
    if (!state) return;
    var langEn = state.colLanguages.en;
    var langVi = state.colLanguages.vi;
    if (el.labelEn && langEn) el.labelEn.textContent = langEn.flag + '  ' + langEn.name.toUpperCase();
    if (el.labelVi && langVi) el.labelVi.textContent = langVi.flag + '  ' + langVi.name.toUpperCase();
    if (el.chEn && langEn) el.chEn.textContent = langEn.code.toUpperCase().substring(0, 2);
    if (el.chVi && langVi) el.chVi.textContent = langVi.code.toUpperCase().substring(0, 2);
  }

  function updateLiveText(t) {
    if (!el.live) return;
    el.live.classList.remove('status');
    el.live.style.opacity = '';
    el.live.textContent = t || '';
  }

  function clearLive() { if (el.live) { el.live.classList.remove('status'); el.live.style.opacity = ''; el.live.textContent = ''; } }

  function showStatus(msg) { if (el.live) { el.live.classList.add('status'); el.live.textContent = msg; } }

  function renderCell(colEl, cell) {
    var wrap = root.document.createElement('div');
    wrap.className = 'row-cell';
    var pf = root.document.createElement('p');
    pf.className = 'final-text';
    pf.textContent = cell.final || '\u00A0';
    if (!cell.final) pf.style.opacity = '0.2';
    wrap.appendChild(pf);
    if (cell.trans) {
      var pt = root.document.createElement('p');
      pt.className = 'trans-text';
      pt.textContent = cell.trans;
      wrap.appendChild(pt);
    }
    if (cell.idiom) {
      var pi = root.document.createElement('p');
      pi.className = 'idiom-text';
      pi.textContent = 'Nghĩa: ' + cell.idiom;
      wrap.appendChild(pi);
    }
    colEl.appendChild(wrap);
  }

  function renderRows() {
    if (!el.enBody) return;
    el.enBody.innerHTML = '';
    el.viBody.innerHTML = '';
    for (var i = 0; i < state.rows.length; i++) {
      var r = state.rows[i];
      renderCell(el.enBody, r.en);
      renderCell(el.viBody, r.vi);
    }
    el.enBody.scrollTop = el.enBody.scrollHeight;
    el.viBody.scrollTop = el.viBody.scrollHeight;
  }

  function updateMicUI() { if (el.mic) { el.mic.classList.toggle('on', state.micOn); el.mic.setAttribute('aria-pressed', state.micOn ? 'true' : 'false'); } }

  function updateChannelUI() {
    if (el.chEn) { el.chEn.classList.toggle('on', state.channel.en); el.chEn.setAttribute('aria-pressed', state.channel.en ? 'true' : 'false'); }
    if (el.chVi) { el.chVi.classList.toggle('on', state.channel.vi); el.chVi.setAttribute('aria-pressed', state.channel.vi ? 'true' : 'false'); }
    if (el.en) el.en.classList.toggle('hidden', !state.channel.en);
    if (el.vi) el.vi.classList.toggle('hidden', !state.channel.vi);
  }

  function bindRateSliders(onChange) {
    if (el.rateEn) el.rateEn.addEventListener('input', function () { state.ttsRate.en = parseFloat(el.rateEn.value); if (el.rateEnVal) el.rateEnVal.textContent = el.rateEn.value + '×'; if (onChange) onChange('en', state.ttsRate.en); });
    if (el.rateVi) el.rateVi.addEventListener('input', function () { state.ttsRate.vi = parseFloat(el.rateVi.value); if (el.rateViVal) el.rateViVal.textContent = el.rateVi.value + '×'; if (onChange) onChange('vi', state.ttsRate.vi); });
  }

  function setVersion(v) { if (el.badge) el.badge.textContent = v; }

  var mod = {
    init: init, el: el,
    updateLiveText: updateLiveText, clearLive: clearLive, showStatus: showStatus,
    renderCell: renderCell, renderRows: renderRows,
    updateMicUI: updateMicUI, updateChannelUI: updateChannelUI,
    bindRateSliders: bindRateSliders, setVersion: setVersion,
    updateColumnLabels: updateColumnLabels,
    openApiModal: openApiModal, openLangModal: openLangModal,
    closeModal: closeModal
  };

  root.WD = root.WD || {};
  root.WD.ui = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
