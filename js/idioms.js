/* WebDich v0.9.4 — idioms.js: local idiom dictionary (no API, no key, instant).
 * v0.9.4 fixes:
 *  - BOTH keys AND input text are normalized by the SAME function → guaranteed consistency
 *  - Contraction expansion only for genuine contractions (don't, it's, won't, can't...).
 *    "were" is NOT expanded (past tense, not a contraction). "its" (possessive) is NOT
 *    expanded to "it is" — only "it's" (with apostrophe in original) becomes "it is".
 *  - Regex for contractions fixed: "cant"/"wont" (no apostrophe) stay as-is, not "ca not"/"wo not".
 *  - "one" is NOT a wildcard (prevents "kill two birds with a stone" falsely matching
 *    "kill two birds with one stone"). Wildcards: someone/somebody/something/anyone/anybody/anything.
 *  - Word-boundary regex matching → no substring false positives.
 */
(function (root) {
  'use strict';

  // ---------- VI idioms: only genuine fixed expressions ----------
  var viIdioms = {
    "bắt cá hai tay": "tham lam, muốn có cả hai, dễ mất cả hai",
    "ăn xôi hỏng bỏng không": "không được gì, thiệt cả hai phía",
    "chân ướt chân ráo": "mới bắt đầu, chưa có kinh nghiệm",
    "ăn không ngồi rỗi": "nhàn nhã, sung sướng không phải làm gì",
    "đau đầu": "lo lắng, phiền muộn nhiều",
    "lòng vòng": "đi vòng vo, quanh co, không thẳng thắn",
    "cứng đầu": "bướng bỉnh, không nghe lời người khác",
    "vòng vo": "nói quanh quẩn, không thẳng thắn",
    "quanh co": "không trực tiếp, nói đi nói lại",
    "thẳng thắn": "nói rõ ràng, thật thà, không giấu giếm",
    "máu lửa": "tính khí nóng, hay giận dữ",
    "gan ruột": "ruột thịt, người thân thiết",
    "gan dạ": "lòng dũng cảm, không sợ hãi",
    "nóng lòng": "vội vàng muốn làm gì, không kiềm được",
    "nóng giận": "dễ nổi giận, tính khí nóng",
    "tai mắt": "người giúp việc quan sát, nghe ngóng",
    "tay chân": "khả năng làm việc thực tế",
    "đầu óc": "trí tuệ, khả năng suy nghĩ"
  };

  // ---------- EN idioms ----------
  var enIdioms = {
    "break a leg": "chúc may mắn",
    "piece of cake": "rất dễ dàng",
    "hit the books": "học bài chăm chỉ",
    "hit the hay": "đi ngủ",
    "hit the sack": "đi ngủ",
    "under the weather": "không khỏe, bị ốm",
    "cost an arm and a leg": "rất đắt đỏ",
    "once in a blue moon": "rất hiếm khi",
    "spill the beans": "tiết lộ bí mật",
    "bite the bullet": "chịu đựng điều khó khăn",
    "break the ice": "phá vỡ sự ngượng ngùng",
    "let the cat out of the bag": "để lộ bí mật",
    "hit the nail on the head": "nói đúng trọng tâm",
    "when pigs fly": "không bao giờ xảy ra",
    "burn the midnight oil": "thức khuya làm việc",
    "call it a day": "kết thúc ngày làm việc, nghỉ ngơi",
    "cut corners": "làm tắt, thiếu cẩn thận",
    "get out of hand": "mất kiểm soát",
    "go the extra mile": "cố gắng hơn mức bình thường",
    "hang in there": "kiên trì, cố lên",
    "it's not rocket science": "không khó hiểu",
    "kill two birds with one stone": "một mũi tên trúng hai đích",
    "let someone off the hook": "tha thứ, không bắt lỗi ai đó",
    "on the ball": "nhanh nhẹn, hiểu biết",
    "pull someone's leg": "trêu chọc ai đó",
    "speak of the devil": "nói tới người này người kia tới",
    "the best of both worlds": "được lợi cả hai phía",
    "time flies": "thời gian trôi nhanh",
    "your guess is as good as mine": "tôi cũng không biết",
    "a dime a dozen": "phổ biến, dễ tìm",
    "back to square one": "quay lại điểm xuất phát",
    "barking up the wrong tree": "nhầm mục tiêu",
    "beat around the bush": "nói vòng vo, không thẳng thắn",
    "blessing in disguise": "điều xui mà lại thành may",
    "burn bridges": "đốt cầu thuyền, không còn lối lui",
    "cry over spilt milk": "hối hận điều đã qua",
    "don't judge a book by its cover": "đừng đánh giá qua bề ngoài",
    "every cloud has a silver lining": "điều xui cũng có mặt tốt",
    "give someone the cold shoulder": "lạnh lùng, phớt lờ ai đó",
    "go back to the drawing board": "lên kế hoạch lại từ đầu",
    "in the heat of the moment": "trong lúc nóng giận",
    "it takes two to tango": "một mình không làm nên chuyện",
    "keep your chin up": "giữ tinh thần lạc quan",
    "no pain no gain": "không có công thì không có thành quả",
    "on cloud nine": "cực kỳ hạnh phúc",
    "play it by ear": "ứng biến tùy tình huống",
    "sit on the fence": "không đứng về phe nào",
    "take it with a grain of salt": "không nên tin hoàn toàn",
    "through thick and thin": "qua mọi thăng trầm",
    "turn a blind eye": "làm ngơ trước điều sai trái"
  };

  // ---------- v0.9.4: single normalization function for BOTH keys and input ----------
  var CONTRACTIONS = {
    "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
    "won't": "will not", "wouldn't": "would not",
    "can't": "cannot", "couldn't": "could not", "shouldn't": "should not",
    "it's": "it is", "he's": "he is", "she's": "she is", "who's": "who is",
    "what's": "what is", "that's": "that is", "there's": "there is", "let's": "let us",
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "i'll": "i will", "you'll": "you will", "he'll": "he will", "she'll": "she will",
    "we'll": "we will", "they'll": "they will",
    "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have"
  };

  // v0.9.5: ASR contractions — Chrome almost never outputs apostrophes
  var ASR_CONTRACTIONS = {
    "dont": "do not", "doesnt": "does not", "didnt": "did not",
    "isnt": "is not", "arent": "are not", "wasnt": "was not", "werent": "were not",
    "hasnt": "has not", "havent": "have not", "hadnt": "had not",
    "wont": "will not", "wouldnt": "would not",
    "cant": "cannot", "couldnt": "could not", "shouldnt": "should not",
    "im": "i am", "youre": "you are", "were": "were", // "were" stays as past tense, NOT "we are"
    "theyre": "they are", "its": "its" // "its" (possessive) stays, bigram "its not" handled separately
  };

  // v0.9.5: wildcard possessive → bare wildcard (before punctuation strip)
  var WILDCARD_POSSESSIVE = {
    "someone's": "someone", "somebody's": "somebody", "something's": "something",
    "anyone's": "anyone", "anybody's": "anybody", "anything's": "anything"
  };

  function normalizeForMatch(text) {
    if (!text) return '';
    var t = text.toLowerCase();

    // Step 1: wildcard possessive (before punctuation strip so we see the apostrophe)
    t = t.replace(/(someone|somebody|something|anyone|anybody|anything)'s/g, function (m) {
      return WILDCARD_POSSESSIVE[m] || m;
    });

    // Step 2: genuine contractions WITH apostrophe
    t = t.replace(/[a-z]+'[a-z]*/g, function (m) {
      return CONTRACTIONS[m] || m.replace(/'/g, '');
    });

    // Step 3: strip punctuation
    t = t.replace(/[.,!?;:()"'\[\]{}<>]/g, '');

    // Step 4: bigram "its not" → "it is not" (ASR reality; "its" alone stays possessive)
    t = t.replace(/\bits not\b/g, 'it is not');

    // Step 5: ASR contractions (no apostrophe) — whole words only
    t = t.replace(/\b([a-z]+)\b/g, function (m) {
      return ASR_CONTRACTIONS[m] || m;
    });

    // Step 6: wildcard plural forms (ASR quirk: "someones" for "someone's" without apostrophe)
    t = t.replace(/\b(someones|anyones|somebodies|anybodies|somethings|anythings)\b/g, function (m) {
      return m.replace(/(s|es)$/, '');
    });

    // Step 7: collapse whitespace
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  // Wildcard tokens: match any single word
  var WILDCARDS = {
    'someone': true, 'somebody': true, 'something': true,
    'anyone': true, 'anybody': true, 'anything': true
  };

  // Build regex from NORMALIZED idiom key
  function keyToRegex(normalizedKey) {
    var parts = normalizedKey.split(/\s+/);
    var pattern = parts.map(function (p) {
      if (WILDCARDS[p]) return '\\S+'; // any non-space sequence = one word
      return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('\\s+');
    return new RegExp('(^|\\s)' + pattern + '(\\s|$)', 'i');
  }

  // Pre-compile: normalize each key first, then build regex
  var viRegexes = {};
  var viNormKeys = {};
  for (var k in viIdioms) { if (Object.prototype.hasOwnProperty.call(viIdioms, k)) {
    var nk = normalizeForMatch(k);
    viNormKeys[k] = nk;
    viRegexes[k] = keyToRegex(nk);
  }}
  var enRegexes = {};
  var enNormKeys = {};
  for (var ek in enIdioms) { if (Object.prototype.hasOwnProperty.call(enIdioms, ek)) {
    var nek = normalizeForMatch(ek);
    enNormKeys[ek] = nek;
    enRegexes[ek] = keyToRegex(nek);
  }}

  // Detect all idioms present in text using word-boundary regex matching
  function detect(dict, regexes, text) {
    if (!text) return [];
    var normalized = normalizeForMatch(text);
    if (!normalized) return [];
    var found = [], key;
    for (key in dict) { if (Object.prototype.hasOwnProperty.call(dict, key)) {
      if (regexes[key].test(normalized)) found.push(dict[key]);
    } }
    return found;
  }

  var idioms = {
    vi: viIdioms,
    en: enIdioms,
    detectVi: function (text) { return detect(viIdioms, viRegexes, text); },
    detectEn: function (text) { return detect(enIdioms, enRegexes, text); },
    _normalize: normalizeForMatch,
    _viNormKeys: viNormKeys,
    _enNormKeys: enNormKeys
  };

  root.WD = root.WD || {};
  root.WD.idioms = idioms;
  if (typeof module !== 'undefined' && module.exports) module.exports = idioms;
})(typeof window !== 'undefined' ? window : global);
