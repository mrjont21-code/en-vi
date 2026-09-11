/* WebDich v0.8 — ui.js: pure DOM. No ASR/language/translate/TTS logic. */
(function (root) {
  'use strict';
  var state = (root.WD && root.WD.state) || (typeof require !== 'undefined' && require('./state.js'));
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
  var mod = { init: init, el: el, updateLiveText: updateLiveText, clearLive: clearLive, showStatus: showStatus, renderCell: renderCell, renderRows: renderRows, updateMicUI: updateMicUI, updateChannelUI: updateChannelUI, bindRateSliders: bindRateSliders, setVersion: setVersion };
  root.WD = root.WD || {};
  root.WD.ui = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
