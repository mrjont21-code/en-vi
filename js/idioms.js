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
    }
  };
  // Detect all idioms present in text; returns array of meanings.
  idioms.detectVi = function (text) {
    if (!text) return [];
    var low = text.toLowerCase(), found = [], key;
    for (key in idioms.vi) { if (Object.prototype.hasOwnProperty.call(idioms.vi, key)) {
      if (low.indexOf(key) >= 0) found.push(idioms.vi[key]);
    } }
    return found;
  };
  root.WD = root.WD || {};
  root.WD.idioms = idioms;
  if (typeof module !== 'undefined' && module.exports) module.exports = idioms;
})(typeof window !== 'undefined' ? window : global);
