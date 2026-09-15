# WebDich v0.9.9 — Hướng dẫn Deploy GitHub Pages

## 🆕 Tính năng mới v0.9.9

### 1. **Title Bar thu gọn**
- Phần đầu trang thu gọn thành dòng title "webdich" đơn giản
- **Long press (giữ 0.5s)** vào title bar → mở modal cấu hình API

### 2. **Long Press thay đổi ngôn ngữ**
- **Click thường** vào nút EN/VI → tắt/bật hiển thị cột (giữ nguyên)
- **Long press (giữ 0.5s)** vào nút EN/VI → mở modal chọn ngôn ngữ cho cột đó
- Hỗ trợ **18 ngôn ngữ**: Tiếng Việt, English, 中文 (giản & phồn), 日本語, 한국어, Français, Deutsch, Español, ภาษาไทย, Bahasa Indonesia, Bahasa Melayu, Português, Русский, العربية, Türkçe, Italiano, Filipino
- Có vòng tròn progress hiển thị trong lúc giữ

### 3. **Tích hợp Dola Seed API**
- 3 nhà cung cấp dịch thuật chạy song song: **Google Translate** + **MyMemory** + **Dola Seed**
- Dola Seed được ưu tiên khi có API key hợp lệ
- API key lưu **localStorage** trên trình duyệt người dùng (không lên server)
- Hỗ trợ 4 nhà cung cấp:
  - **FreeLLM / Kilo Code** (miễn phí, ~200 req/giờ)
  - **Synthorai** ($1 free credit)
  - **APIYi** (Seed 2.1 Turbo)
  - **BytePlus ModelArk** (chính thức ByteDance)

### 4. **Backend hoàn toàn client-side**
- Chạy trên **GitHub Pages** / bất kỳ static hosting nào
- Không cần server riêng
- API key người dùng tự nhập, tự quản lý

---

## 🚀 Cách Deploy lên GitHub Pages

### Bước 1: Chuẩn bị repo
1. Tạo repo mới trên GitHub (ví dụ: `webdich`)
2. Clone repo về máy
3. Copy toàn bộ thư mục `webdich-0.1/` vào repo

### Bước 2: Push lên GitHub
```bash
git add .
git commit -m "WebDich v0.9.9 initial deploy"
git push origin main
```

### Bước 3: Bật GitHub Pages
1. Vào repo → **Settings** → **Pages**
2. **Source**: chọn `Deploy from a branch`
3. **Branch**: chọn `main` / `root`
4. Click **Save**
5. Chờ vài phút → trang web sẽ có tại: `https://<username>.github.io/webdich/`

---

## 📱 Cách sử dụng

### Cách 1: Dùng mặc định (Google + MyMemory)
- Không cần cấu hình gì
- Mở trang web → nhấn mic → nói
- Dịch thuật chạy tự động qua Google Translate + MyMemory

### Cách 2: Bật Dola Seed API (chất lượng cao hơn)
1. **Giữ lâu** vào dòng title "webdich" ở trên cùng (0.5 giây)
2. Modal cấu hình hiện ra → làm theo hướng dẫn:
   - Truy cập [freellm.net](https://freellm.net) → đăng ký miễn phí
   - Lấy API Key → dán vào ô
   - Chọn nhà cung cấp: **FreeLLM / Kilo Code (miễn phí)**
   - Đảm bảo tick "Bật Dola Seed"
   - Click **💾 Lưu cấu hình**
3. Xong! Dola Seed giờ là nhà cung cấp ưu tiên

### Thay đổi ngôn ngữ dịch
- **Giữ lâu** vào nút **EN** hoặc **VI** (0.5 giây)
- Chọn ngôn ngữ mong muốn từ danh sách
- Có thể tìm kiếm nhanh bằng ô tìm kiếm

---

## 🔒 Bảo mật & Lưu ý

### API Key lưu ở đâu?
- API key được lưu **chỉ trên trình duyệt** của người dùng qua `localStorage`
- **Không bao giờ** được gửi lên server GitHub Pages hay bất kỳ server nào khác
- Mỗi người dùng tự nhập và quản lý key của riêng họ

### Free Tier của FreeLLM/Kilo Code
- Mô hình: `kilo-code/bytedance-seed-dola-seed-2-0-pro:free`
- Giới hạn: **~200 yêu cầu/giờ**
- Hoàn toàn miễn phí, không cần thẻ tín dụng
- Nếu vượt giới hạn, hệ thống tự động fallback về Google Translate

### Cách xóa API Key
- Mở modal cấu hình → xóa key → Lưu
- Hoặc vào DevTools → Application → Local Storage → xóa `wdApiConfig`

---

## 📁 Cấu trúc dự án

```
webdich-0.1/
├── index.html              # Giao diện chính + modal
├── style.css               # Toàn bộ styles
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (PWA)
├── icon.svg / icon-*.png   # Icons
├── DEPLOY_GITHUB_PAGES.md  # Hướng dẫn này
├── js/
│   ├── state.js            # State management + ngôn ngữ + API config
│   ├── language.js         # Phát hiện & phân đoạn ngôn ngữ
│   ├── translation.js      # Google + MyMemory + Dola Seed providers
│   ├── asr.js              # Speech Recognition
│   ├── tts.js              # Text-to-Speech
│   ├── ui.js               # UI handlers + long press + modal
│   ├── app.js              # Controller chính
│   ├── text.js             # Xử lý text normalize
│   └── idioms.js           # Phát hiện thành ngữ
└── test/                   # Unit tests
```

---

## 🔧 Tùy chỉnh thêm

### Thêm ngôn ngữ mới
Sửa file `js/state.js`, thêm vào mảng `SUPPORTED_LANGUAGES`:
```javascript
{ code: 'nl', name: 'Nederlands', flag: '🇳🇱', asr: 'nl-NL', tts: 'nl-NL', label: 'Dutch' }
```

### Thay đổi thời gian long press
Sửa file `js/ui.js`, dòng:
```javascript
var LONG_PRESS_MS = 500; // đổi thành 400 = nhanh hơn, 600 = chậm hơn
```

### Thêm nhà cung cấp Dola Seed mới
Sửa file `js/translation.js`, thêm vào object `DOLA_PROVIDERS`:
```javascript
newprovider: {
  name: 'Tên nhà cung cấp',
  baseUrl: 'https://api.example.com/v1/chat/completions',
  model: 'model-name'
}
```

---

## 🐛 Khắc phục sự cố

### Mic không hoạt động
- Yêu cầu **HTTPS** (GitHub Pages có sẵn)
- Trình duyệt phải hỗ trợ Web Speech API (Chrome/Edge tốt nhất)
- Cho phép quyền micro khi trình duyệt hỏi

### Dola Seed không dịch
- Kiểm tra API key đúng chưa
- Kiểm tra kết nối mạng
- Xem Console (F12) để xem lỗi chi tiết
- Nếu vượt giới hạn free tier, hệ thống tự dùng Google Translate

### TTS không nói
- Kiểm tra âm lượng thiết bị
- Một số trình duyệt chặn TTS tự động → cần tương tác người dùng trước

---

## 📝 License & Credits

- Dựa trên WebDich v0.9.8 gốc
- Dịch thuật: Google Translate API, MyMemory, Dola Seed API
- ASR/TTS: Web Speech API (trình duyệt)
- PWA: Service Worker + Manifest
- Font: Be Vietnam Pro (Google Fonts)
