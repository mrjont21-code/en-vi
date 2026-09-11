/* WebDich v0.8 — language.js: pure language detection & dual-ASR scoring.
 * No LLM, no API, no TTS. Input text → output {lang, confidence}.
 */
(function (root) {
  'use strict';
  var VI_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;
  var NON_ASCII_RE = /[^\x00-\x7F]/;
  var VI_STOP = ['tôi','bạn','xin','chào','là','có','không','đi','đến','một','người','đây','đó',
    'gì','nào','mình','anh','chị','em','được','rồi','đang','sẽ','vì','nhưng','mà','và','với','từ',
    'trong','trên','dưới','giữa','sau','trước','ngay','rất','nhiều','ít','kia','này','hay','hoặc',
    'nếu','khi','đã','cũng','đều','lại','vẫn','chỉ','thì','ga','tàu','xe','nhà','biển','phố','ăn',
    'uống','nước','muốn','cảm','ơn','lỗi','cho','hỏi','ở','đâu','ra','vào','lên','xuống','qua','tiếp',
    'theo','nơi','đường','phải','trái','thẳng','đầu','cuối','giờ','phút','ngày','tuần','tháng','năm',
    'sáng','trưa','chiều','tối','nay','mai','quá','lại','nữa','về','xem','biết','nghe','nói','hỏi',
    'đợi','gặp','làm','lấy','đưa','trả','mua','bán','giá','bao','nhiêu','đồng','tiền','thẻ','vé',
    'máy','bay','sân','khách','sạn','nhà','hàng','quán','phòng','tắm','ngủ','y','tế','bệnh','viện',
    'thuốc','cứu','hỏa','trạm','ai','ấy','hắn','cô','dì','chú','bác','ông','bà','con','cháu','bè',
    'nhau','tạm','biệt','hẹn','lại','tên','gọi','xa','gần','thế','nào','ạ','ơi','ồ','à','lúc'];
  var EN_STOP = ['the','is','are','was','were','i','you','he','she','it','we','they','to','of','in',
    'for','on','with','at','by','from','up','about','into','over','after','be','have','has','had',
    'do','does','did','this','that','these','those','and','but','or','not','no','yes','hello','want',
    'wants','go','goes','home','station','train','how','what','where','when','why','a','an','my',
    'your','his','her','our','their','me','him','us','them','will','would','can','could','should',
    'please','thank','thanks','good','morning','afternoon','evening','night','bye','ok','okay','yeah',
    'like','get','take','make','see','know','think','say','said','tell','come','came','give','need',
    'time','today','tomorrow','yesterday','now','then','here','there','very','really','so','too',
    'just','only','also','well','right','left','straight','first','last','next','bus','taxi','hotel',
    'airport','street','road','city','country','food','water','coffee','tea','beer','wine','menu',
    'bill','check','money','ticket','passport','bag','luggage','help','emergency','doctor','pharmacy',
    'hospital','police','excuse','sorry','welcome','much','many','few','little','more','less','again',
    'still','already','yet','ever','never','always','often','sometimes','maybe','perhaps','sure',
    'course','fine','great','nice','expensive','cheap','big','small','hot','cold','open','closed',
    'early','late','far','near','fast','slow','stop','wait','walk','drive','fly','run','sit','stand',
    'eat','drink','sleep','work','play','read','write','listen','watch','learn','buy','sell','pay',
    'cost','find','love','enjoy','remember','forget','understand','believe','hope','must','all','each',
    'every','both','other','some','such','nor','own','same','than','because','as','until','while',
    'against','between','through','during','before','above','below','down','out','off','under',
    'further','once','which','who','whom','whose','hi','hey','oh','wow','uh','um','hmm','how','are',
    'you','about','back','alarm','going','america'];
  function hasDiacritics(t) { return VI_DIACRITIC_RE.test(t || ''); }
  function countInList(text, list) {
    var words = (text || '').toLowerCase().split(' '), n = 0;
    for (var i = 0; i < words.length; i++) if (list.indexOf(stripPunct(words[i])) >= 0) n++;
    return n;
  }
  function stripPunct(w) { return w.replace(/[.,!?;:()"'\[\]{}<>]/g, ''); }
  function classifyWord(w) {
    var low = stripPunct((w || '').toLowerCase());
    if (!low) return null;
    if (VI_DIACRITIC_RE.test(w)) return 'vi';
    if (VI_STOP.indexOf(low) >= 0) return 'vi';
    if (EN_STOP.indexOf(low) >= 0) return 'en';
    if (NON_ASCII_RE.test(w)) return 'vi';
    return 'en';
  }
  function splitByLanguage(text) {
    var words = (text || '').trim().split(' ').filter(Boolean);
    var segs = [], curLang = null, curWords = [];
    for (var i = 0; i < words.length; i++) {
      var lang = classifyWord(words[i]) || curLang || 'en';
      if (curLang === null) { curLang = lang; curWords = [words[i]]; }
      else if (lang === curLang) { curWords.push(words[i]); }
      else { segs.push({ lang: curLang, text: curWords.join(' ') }); curLang = lang; curWords = [words[i]]; }
    }
    if (curLang !== null) segs.push({ lang: curLang, text: curWords.join(' ') });
    return segs;
  }
  function candidateScore(c, lang) {
    if (!c || !c.text) return -999;
    var words = c.text.split(/\s+/).filter(Boolean).length || 1;
    var s = (c.conf || 0) * 2.0;
    var sw = (lang === 'vi') ? countInList(c.text, VI_STOP) : countInList(c.text, EN_STOP);
    s += (sw / words) * 0.9;
    if (lang === 'vi' && hasDiacritics(c.text)) s += 0.6;
    if (lang === 'en' && hasDiacritics(c.text)) s -= 0.3;
    if (lang === 'en' && !hasDiacritics(c.text)) s += 0.05;
    s += Math.min(words, 12) * 0.01;
    return s;
  }
  function pickWinner(en, vi) {
    var sEn = candidateScore(en, 'en'), sVi = candidateScore(vi, 'vi');
    if (sEn < -900 && sVi < -900) return null;
    if (sVi >= sEn) return { lang: 'vi', text: vi.text };
    return { lang: 'en', text: en.text };
  }
  // Standalone detection: input text → {lang, confidence}. confidence 0..1.
  function detectLanguage(text) {
    if (!text || !text.trim()) return { lang: 'unknown', confidence: 0 };
    var words = text.trim().split(' ').filter(Boolean);
    if (!words.length) return { lang: 'unknown', confidence: 0 };
    var vi = 0, en = 0;
    for (var i = 0; i < words.length; i++) {
      if (classifyWord(words[i]) === 'vi') vi++; else en++;
    }
    var total = vi + en;
    if (hasDiacritics(text)) return { lang: 'vi', confidence: Math.min(1, 0.7 + vi / total * 0.3) };
    if (vi > en) return { lang: 'vi', confidence: vi / total };
    if (en > vi) return { lang: 'en', confidence: en / total };
    return { lang: 'unknown', confidence: 0 };
  }
  // v0.8.1.1: three-state classifier. Weak tokens (no dictionary/diacritic signal) = unknown, NOT forced to en.
  function classifyWord3(w) {
    var low = stripPunct((w || '').toLowerCase());
    if (!low) return { lang: 'unknown', strong: false };
    if (VI_DIACRITIC_RE.test(w)) return { lang: 'vi', strong: true };
    if (VI_STOP.indexOf(low) >= 0) return { lang: 'vi', strong: true };
    if (EN_STOP.indexOf(low) >= 0) return { lang: 'en', strong: true };
    if (NON_ASCII_RE.test(w)) return { lang: 'vi', strong: false }; // lexical pattern, weak
    return { lang: 'unknown', strong: false };
  }
  // v0.8.1.1: dual-language segmentation with context smoothing.
  // Only a STRONG token may create a language transition. Weak/unknown tokens follow the current segment
  // (context). This prevents fragmentation from classifier flicker. Invariant: join(segments) === input.
  function segmentDual(text) {
    var words = (text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var segs = [], curLang = null, curWords = [];
    function flush() {
      if (!curWords.length) return;
      segs.push({ lang: curLang || 'unknown', text: curWords.join(' ') });
      curWords = [];
    }
    for (var i = 0; i < words.length; i++) {
      var c = classifyWord3(words[i]);
      if (curLang === null) {
        if (c.strong) curLang = c.lang;
        curWords.push(words[i]);
      } else if (c.strong && c.lang !== curLang) {
        flush();
        curLang = c.lang;
        curWords.push(words[i]);
      } else {
        curWords.push(words[i]); // weak/unknown → follow current segment (context)
      }
    }
    flush();
    return segs;
  }
  var mod = { classifyWord: classifyWord, classifyWord3: classifyWord3, splitByLanguage: splitByLanguage, segmentDual: segmentDual, candidateScore: candidateScore, pickWinner: pickWinner, detectLanguage: detectLanguage, hasDiacritics: hasDiacritics, countInList: countInList };
  root.WD = root.WD || {};
  root.WD.language = mod;
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
})(typeof window !== 'undefined' ? window : global);
