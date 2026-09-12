/* WebDich v0.9 — idioms.js: local idiom dictionary (no API, no key, instant).
 * Format: { vi: { "idiom phrase": "concise meaning" } }. Extend as needed.
 */
(function (root) {
  'use strict';
  var idioms = {
    vi: {
      "bắt cá hai tay": "tham lam, muốn có cả hai, dễ mất cả hai",
      "ăn xôi hỏng bỏng không": "không được gì, thiệt cả hai phía",
      "chân ướt chân ráo": "mới bắt đầu, chưa có kinh nghiệm",
      "ăn không ngồi rồi": "nhàn nhã, sung sướng không phải làm gì",
      "đầu đau": "lo lắng, phiền muộn nhiều",
      "lòng vòng": "rộng lượng, hay tha thứ cho người khác",
      "tốt bụng": "nhân hậu, hay giúp đỡ người khác",
      "cứng đầu": "bướng bỉnh, không nghe lời người khác",
      "mềm dẻo": "linh hoạt, dễ thích ứng, không cứng nhắc",
      "cương quyết": "kiên quyết, không do dự",
      "dứt khoát": "quyết đoán, không vòng vo",
      "vòng vo": "nói quanh quẩn, không thẳng thắn",
      "quanh co": "không trực tiếp, nói đi nói lại",
      "thẳng thắn": "nói rõ ràng, thật thà, không giấu giếm",
      "thận trọng": "cẩn thận, suy nghĩ kỹ trước khi làm",
      "vội vàng": "hấp tấp, làm nhanh không cẩn thận",
      "thong thả": "không vội, từ tốn, nhẹ nhàng",
      "chậm rãi": "từ tốn, không vội vàng",
      "gấp rút": "vội vàng, phải làm nhanh",
      "do dự": "chưa quyết đoán, lưỡng lự",
      "mơ hồ": "không rõ ràng, không cụ thể",
      "rõ ràng": "thể hiện rõ, không mập mờ",
      "tỉnh táo": "tỉnh táo, suy nghĩ rõ ràng",
      "say đắm": "mê hoặc, yêu thích rất nhiều",
      "cuồng nhiệt": "rất hào hứng, say mê",
      "ấm áp": "ấm nóng, thân tình, dễ chịu",
      "lạnh lùng": "không thân thiện, xa cách",
      "khắc nghiệt": "gay gắt, khó chịu, không thương tiếc",
      "hiền lành": "hiền dịu, dễ bảo, không dữ",
      "nhân hậu": "tốt bụng, hay thương người",
      "hào phóng": "rộng rãi, không keo kiệt",
      "keo kiệt": "bủn xỉn, ít khi cho người khác",
      "tham lam": "muốn có nhiều quá mức, không biết đủ",
      "mạnh dạn": "tự tin, dũng cảm, không ngại ngùng",
      "nỗ lực": "cố gắng hết sức",
      "quyết tâm": "kiên định làm điều gì đó",
      "sáng tạo": "có ý tưởng mới, độc đáo",
      "thất bại": "không thành công, không đạt mục tiêu",
      "thành công": "đạt kết quả tốt, đúng mục tiêu",
      "thông cảm": "hiểu và thông cảm cho người khác",
      "tận tâm": "hết lòng, hết sức làm việc",
      "trung thực": "không nói dối, thật thà",
      "cẩn thận": "cẩn trọng, tránh rủi ro",
      "tự tin": "tin vào khả năng của mình",
      "đầu óc": "trí tuệ, khả năng suy nghĩ",
      "tay chân": "khả năng làm việc thực tế",
      "tai mắt": "người giúp việc quan sát, nghe ngóng",
      "máu lửa": "tính khí nóng, hay giận dữ",
      "gan ruột": "lòng dũng cảm, không sợ hãi",
      "nóng lòng": "vội vàng muốn làm gì, không kiềm được",
      "nóng giận": "dễ nổi giận, tính khí nóng"
    },
    en: {
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
      "let someone off the hook": "tha thứ, không bắt lỗi",
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
      "give someone the cold shoulder": "lạnh lùng, phớt lờ",
      "go back to the drawing board": "lên kế hoạch lại từ đầu",
      "in the heat of the moment": "trong lúc nóng giận",
      "it takes two to tango": "một mình không làm nên chuyện",
      "keep your chin up": "giữ tinh thần lạc quan",
      "no pain, no gain": "không có công thì không có thành quả",
      "on cloud nine": "cực kỳ hạnh phúc",
      "play it by ear": "ứng biến tùy tình huống",
      "sit on the fence": "không đứng về phe nào",
      "take it with a grain of salt": "không nên tin hoàn toàn",
      "through thick and thin": "qua mọi thăng trầm",
      "turn a blind eye": "làm ngơ trước điều sai trái"
    }
  };
  // Detect all idioms present in text; returns array of meanings.
  function detect(dict, text) {
    if (!text) return [];
    var low = text.toLowerCase(), found = [], key;
    for (key in dict) { if (Object.prototype.hasOwnProperty.call(dict, key)) {
      if (low.indexOf(key) >= 0) found.push(dict[key]);
    } }
    return found;
  }
  idioms.detectVi = function (text) { return detect(idioms.vi, text); };
  idioms.detectEn = function (text) { return detect(idioms.en, text); };
  root.WD = root.WD || {};
  root.WD.idioms = idioms;
  if (typeof module !== 'undefined' && module.exports) module.exports = idioms;
})(typeof window !== 'undefined' ? window : global);
