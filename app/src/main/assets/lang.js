// ===================================================================
// i18n — Multi-language system for NC MEMS
// ===================================================================
// Usage:
//   __('key')         → translated string for current language
//   setLanguage('vi') → switch language & reapply to DOM
//   applyI18n()       → re-read data-i18n attributes on visible DOM
//
// Adding a new language:
//   Add entries to LANGUAGES and TRANSLATIONS objects below.
// ===================================================================

const LANGUAGES = {
  vi: { label: 'Tiếng Việt', flag: '🇻🇳', code: 'VI' },
  en: { label: 'English',    flag: '🇬🇧', code: 'EN' },
  ja: { label: '日本語',    flag: '🇯🇵', code: 'JA' },
  ko: { label: '한국어',    flag: '🇰🇷', code: 'KO' },
};

// Current language (set from localStorage or default)
let _currentLang = localStorage.getItem('ncmems_language') || 'vi';

// Fallback language for missing keys
const FALLBACK_LANG = 'vi';

// ======================== TRANSLATIONS ========================
const TRANSLATIONS = {

  // ── App / Splash ──────────────────────────────────────────
  'app.title':            { vi: 'NC MEMS', en: 'NC MEMS', ja: 'NC MEMS', ko: 'NC MEMS' },
  'app.subtitle':         { vi: 'Hệ thống quản lý chung', en: 'General Management System', ja: '総合管理システム', ko: '일반 관리 시스템' },
  'app.version':          { vi: 'Phiên bản', en: 'Version', ja: 'バージョン', ko: '버전' },
  'app.loading':          { vi: 'Đang tải...', en: 'Loading...', ja: '読み込み中...', ko: '로딩 중...' },

  // ── Login ──────────────────────────────────────────────────
  'login.title':          { vi: 'Đăng nhập', en: 'Login', ja: 'ログイン', ko: '로그인' },
  'login.subtitle':       { vi: 'Vui lòng đăng nhập để tiếp tục', en: 'Please log in to continue', ja: '続行するにはログインしてください', ko: '계속하려면 로그인하세요' },
  'login.username':       { vi: 'TÊN ĐĂNG NHẬP', en: 'USERNAME', ja: 'ユーザー名', ko: '사용자 이름' },
  'login.password':       { vi: 'MẬT KHẨU', en: 'PASSWORD', ja: 'パスワード', ko: '비밀번호' },
  'login.placeholder_user': { vi: 'Nhập tài khoản', en: 'Enter username', ja: 'ユーザー名を入力', ko: '사용자 이름 입력' },
  'login.placeholder_pass': { vi: 'Nhập mật khẩu', en: 'Enter password', ja: 'パスワードを入力', ko: '비밀번호 입력' },
  'login.remember':       { vi: 'Ghi nhớ đăng nhập', en: 'Remember login', ja: 'ログインを記憶', ko: '로그인 기억' },
  'login.forgot':         { vi: 'Quên mật khẩu?', en: 'Forgot password?', ja: 'パスワードをお忘れですか？', ko: '비밀번호를 잊으셨나요?' },
  'login.btn':            { vi: 'Đăng nhập', en: 'Login', ja: 'ログイン', ko: '로그인' },
  'login.error':          { vi: 'Sai tên đăng nhập hoặc mật khẩu', en: 'Invalid username or password', ja: 'ユーザー名またはパスワードが間違っています', ko: '사용자 이름 또는 비밀번호가 잘못되었습니다' },
  'login.mac_config':     { vi: '📡 Cài đặt địa chỉ MAC thiết bị', en: '📡 Set device MAC address', ja: '📡 デバイスMACアドレス設定', ko: '📡 장치 MAC 주소 설정' },
  'login.forgot_toast':   { vi: 'Liên hệ quản trị viên để đặt lại mật khẩu', en: 'Contact administrator to reset password', ja: '管理者に連絡してパスワードをリセット', ko: '관리자에게 문의하여 비밀번호 재설정' },

  // ── Home ───────────────────────────────────────────────────
  'home.title':           { vi: 'NC MEMS', en: 'NC MEMS', ja: 'NC MEMS', ko: 'NC MEMS' },
  'home.management':      { vi: 'QUẢN LÝ CHUNG', en: 'GENERAL MANAGEMENT', ja: '総合管理', ko: '일반 관리' },
  'home.categories':      { vi: 'Danh mục', en: 'Categories', ja: 'カテゴリ', ko: '카테고리' },
  'home.jig':             { vi: 'JIG', en: 'JIG', ja: 'JIG', ko: 'JIG' },
  'home.jig_desc':        { vi: 'Quản lý & Theo dõi Dụng cụ', en: 'Manage & Track Tools', ja: '工具の管理と追跡', ko: '도구 관리 및 추적' },
  'home.jig_count':       { vi: '150 mặt hàng', en: '150 items', ja: '150点', ko: '150개 항목' },
  'home.part':            { vi: 'PART', en: 'PART', ja: 'PART', ko: 'PART' },
  'home.part_desc':       { vi: 'Quản lý Phụ kiện & Vật tư', en: 'Manage Accessories & Supplies', ja: 'アクセサリと消耗品の管理', ko: '액세서리 및 소모품 관리' },
  'home.part_count':      { vi: '3,500 linh kiện', en: '3,500 components', ja: '3,500点', ko: '3,500개 부품' },
  'home.esd':             { vi: 'ESD', en: 'ESD', ja: 'ESD', ko: 'ESD' },
  'home.esd_desc':        { vi: 'Quản lý Thiết bị Chống Tĩnh điện', en: 'Manage Anti-Static Equipment', ja: '静電気対策機器の管理', ko: '정전기 방지 장비 관리' },
  'home.esd_count':       { vi: '210 thiết bị', en: '210 devices', ja: '210台', ko: '210개 장치' },
  'home.production':      { vi: 'PRODUCTION EQUIPMENT', en: 'PRODUCTION EQUIPMENT', ja: '生産設備', ko: '생산 장비' },
  'home.production_desc': { vi: 'Quản lý thiết bị sản xuất', en: 'Manage Production Equipment', ja: '生産設備の管理', ko: '생산 장비 관리' },
  'home.production_count':{ vi: '45 thiết bị', en: '45 devices', ja: '45台', ko: '45개 장치' },

  // ── Search ─────────────────────────────────────────────────
  'search.title':         { vi: 'TÌM KIẾM', en: 'SEARCH', ja: '検索', ko: '검색' },
  'search.placeholder':   { vi: 'Tìm kiếm JIG, PART, ESD...', en: 'Search JIG, PART, ESD...', ja: 'JIG, PART, ESDを検索...', ko: 'JIG, PART, ESD 검색...' },
  'search.btn':           { vi: 'Tìm', en: 'Search', ja: '検索', ko: '검색' },
  'search.hint':          { vi: '🔍 Nhập từ khóa để tìm kiếm', en: '🔍 Enter keywords to search', ja: '🔍 キーワードを入力して検索', ko: '🔍 검색어를 입력하세요' },
  'search.searching':     { vi: '🔍 Đang tìm...', en: '🔍 Searching...', ja: '🔍 検索中...', ko: '🔍 검색 중...' },
  'search.no_results':    { vi: '😕 Không tìm thấy kết quả', en: '😕 No results found', ja: '😕 結果が見つかりませんでした', ko: '😕 결과를 찾을 수 없습니다' },
  'search.error':         { vi: '⚠️ Lỗi tìm kiếm', en: '⚠️ Search error', ja: '⚠️ 検索エラー', ko: '⚠️ 검색 오류' },

  // ── Profile ────────────────────────────────────────────────
  'profile.title':        { vi: 'HỒ SƠ', en: 'PROFILE', ja: 'プロフィール', ko: '프로필' },
  'profile.logout':       { vi: 'Đăng xuất', en: 'Logout', ja: 'ログアウト', ko: '로그아웃' },
  'profile.role_prod':    { vi: 'Kỹ sư sản xuất', en: 'Production Engineer', ja: '生産エンジニア', ko: '생산 엔지니어' },
  'profile.role_tech':    { vi: 'Kỹ thuật viên', en: 'Technician', ja: '技術者', ko: '기술자' },
  'profile.role_mgr':     { vi: 'Quản lý sản xuất', en: 'Production Manager', ja: '生産管理者', ko: '생산 관리자' },

  // ── Settings ───────────────────────────────────────────────
  'settings.title':       { vi: 'CÀI ĐẶT', en: 'SETTINGS', ja: '設定', ko: '설정' },
  'settings.back':        { vi: 'Quay lại', en: 'Back', ja: '戻る', ko: '뒤로' },
  'settings.display':     { vi: 'Giao diện & Hiển thị', en: 'Interface & Display', ja: 'インターフェースと表示', ko: '인터페이스 및 표시' },
  'settings.dark_mode':   { vi: 'Chế độ tối', en: 'Dark Mode', ja: 'ダークモード', ko: '다크 모드' },
  'settings.dark_desc':   { vi: 'Giao diện tối cho môi trường thiếu sáng', en: 'Dark interface for low-light environments', ja: '暗い環境向けのダークインターフェース', ko: '어두운 환경을 위한 다크 인터페이스' },
  'settings.language':    { vi: 'Ngôn ngữ', en: 'Language', ja: '言語', ko: '언어' },
  'settings.lang_desc':   { vi: 'Tiếng Việt', en: 'English', ja: '日本語', ko: '한국어' },
  'settings.app':         { vi: 'Ứng dụng', en: 'Application', ja: 'アプリケーション', ko: '애플리케이션' },
  'settings.version':     { vi: 'Phiên bản', en: 'Version', ja: 'バージョン', ko: '버전' },
  'settings.version_desc':{ vi: 'NC MEMS v1.0.0', en: 'NC MEMS v1.0.0', ja: 'NC MEMS v1.0.0', ko: 'NC MEMS v1.0.0' },

  // ── Connection Check ───────────────────────────────────────
  'conn.title':           { vi: 'Kiểm tra kết nối', en: 'Connection Check', ja: '接続確認', ko: '연결 확인' },
  'conn.desc':            { vi: 'Vui lòng bật WiFi và Bluetooth để sử dụng ứng dụng', en: 'Please enable WiFi and Bluetooth to use the app', ja: 'アプリを使用するにはWiFiとBluetoothを有効にしてください', ko: '앱을 사용하려면 WiFi와 블루투스를 켜주세요' },
  'conn.wifi':            { vi: 'WiFi', en: 'WiFi', ja: 'WiFi', ko: 'WiFi' },
  'conn.bluetooth':       { vi: 'Bluetooth', en: 'Bluetooth', ja: 'Bluetooth', ko: '블루투스' },
  'conn.checking':        { vi: 'Đang kiểm tra...', en: 'Checking...', ja: '確認中...', ko: '확인 중...' },
  'conn.on':              { vi: 'Đã bật', en: 'On', ja: 'オン', ko: '켜짐' },
  'conn.off':             { vi: 'Chưa bật', en: 'Off', ja: 'オフ', ko: '꺼짐' },
  'conn.wifi_on':         { vi: '✓ Đã bật', en: '✓ On', ja: '✓ オン', ko: '✓ 켜짐' },
  'conn.wifi_off':        { vi: '🔓 Bật WiFi', en: '🔓 Enable WiFi', ja: '🔓 WiFiを有効にする', ko: '🔓 WiFi 켜기' },
  'conn.bt_on':           { vi: '✓ Đã bật', en: '✓ On', ja: '✓ オン', ko: '✓ 켜짐' },
  'conn.bt_off':          { vi: '🔓 Bật Bluetooth', en: '🔓 Enable Bluetooth', ja: '🔓 Bluetoothを有効にする', ko: '🔓 블루투스 켜기' },
  'conn.retry':           { vi: '🔄 Kiểm tra lại', en: '🔄 Check again', ja: '🔄 再確認', ko: '🔄 다시 확인' },
  'conn.error':           { vi: '⚠️ Không thể kiểm tra', en: '⚠️ Cannot check', ja: '⚠️ 確認できません', ko: '⚠️ 확인할 수 없습니다' },

  // ── Logout ─────────────────────────────────────────────────
  'logout.title':         { vi: 'Đăng xuất', en: 'Logout', ja: 'ログアウト', ko: '로그아웃' },
  'logout.confirm':       { vi: 'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?', en: 'Are you sure you want to log out?', ja: 'ログアウトしてもよろしいですか？', ko: '로그아웃하시겠습니까?' },
  'logout.cancel':        { vi: 'Hủy', en: 'Cancel', ja: 'キャンセル', ko: '취소' },
  'logout.btn':           { vi: 'Đăng xuất', en: 'Logout', ja: 'ログアウト', ko: '로그아웃' },
  'logout.toast':         { vi: '👋 Đã đăng xuất', en: '👋 Logged out', ja: '👋 ログアウトしました', ko: '👋 로그아웃되었습니다' },

  // ── MAC Dialog ─────────────────────────────────────────────
  'mac.title':            { vi: 'Địa chỉ MAC', en: 'MAC Address', ja: 'MACアドレス', ko: 'MAC 주소' },
  'mac.desc':             { vi: 'Nhập địa chỉ MAC của thiết bị BLE để kết nối.', en: 'Enter the MAC address of the BLE device to connect.', ja: '接続するBLEデバイスのMACアドレスを入力してください。', ko: '연결할 BLE 장치의 MAC 주소를 입력하세요.' },
  'mac.label':            { vi: 'Địa chỉ MAC', en: 'MAC Address', ja: 'MACアドレス', ko: 'MAC 주소' },
  'mac.placeholder':      { vi: 'VD: AA:BB:CC:DD:EE:FF', en: 'e.g. AA:BB:CC:DD:EE:FF', ja: '例: AA:BB:CC:DD:EE:FF', ko: '예: AA:BB:CC:DD:EE:FF' },
  'mac.save':             { vi: '💾 Lưu', en: '💾 Save', ja: '💾 保存', ko: '💾 저장' },
  'mac.saved':            { vi: 'Đã lưu', en: 'Saved', ja: '保存済み', ko: '저장됨' },
  'mac.edit':             { vi: '✏️ Sửa', en: '✏️ Edit', ja: '✏️ 編集', ko: '✏️ 편집' },
  'mac.delete':           { vi: '🗑️ Xóa', en: '🗑️ Delete', ja: '🗑️ 削除', ko: '🗑️ 삭제' },
  'mac.confirm_delete':   { vi: 'Xóa địa chỉ MAC đã lưu?', en: 'Delete saved MAC address?', ja: '保存したMACアドレスを削除しますか？', ko: '저장된 MAC 주소를 삭제하시겠습니까?' },
  'mac.saved_toast':      { vi: '✅ Đã lưu MAC', en: '✅ MAC saved', ja: '✅ MACを保存しました', ko: '✅ MAC 저장됨' },
  'mac.deleted_toast':    { vi: '🗑️ Đã xóa MAC', en: '🗑️ MAC deleted', ja: '🗑️ MACを削除しました', ko: '🗑️ MAC 삭제됨' },
  'mac.hex_error':        { vi: '⚠️ Chỉ chấp nhận ký tự hex (0-9, A-F)', en: '⚠️ Only hex characters (0-9, A-F)', ja: '⚠️ 16進数のみ（0-9、A-F）', ko: '⚠️ 16진수 문자만 허용됩니다 (0-9, A-F)' },
  'mac.too_short':        { vi: '⚠️ Thiếu', en: '⚠️ Missing', ja: '⚠️ 不足', ko: '⚠️ 부족' },
  'mac.too_long':         { vi: '⚠️ MAC quá dài, chỉ 12 ký tự hex', en: '⚠️ MAC too long, only 12 hex chars', ja: '⚠️ MACアドレスが長すぎます（12文字まで）', ko: '⚠️ MAC 주소가 너무 깁니다 (12자리 16진수)' },

  // ── Language Picker ────────────────────────────────────────
  'lang.picker_title':    { vi: '🌐 Chọn ngôn ngữ', en: '🌐 Select Language', ja: '🌐 言語を選択', ko: '🌐 언어 선택' },

  // ── Toasts ─────────────────────────────────────────────────
  'toast.dark_on':        { vi: '🌙 Chế độ tối', en: '🌙 Dark mode', ja: '🌙 ダークモード', ko: '🌙 다크 모드' },
  'toast.dark_off':       { vi: '☀️ Chế độ sáng', en: '☀️ Light mode', ja: '☀️ ライトモード', ko: '☀️ 라이트 모드' },
  'toast.lang_changed':   { vi: '🌐 Ngôn ngữ', en: '🌐 Language', ja: '🌐 言語', ko: '🌐 언어' },
  'toast.nav_cat':        { vi: '📂 Đang mở', en: '📂 Opening', ja: '📂 開いています', ko: '📂 여는 중' },
};

// ======================== i18n ENGINE ========================

// Translate a key: __('login.title') → "Đăng nhập"
function __(key) {
  const dict = TRANSLATIONS[key];
  if (!dict) return '⁇' + key;
  return dict[_currentLang] || dict[FALLBACK_LANG] || '⁇' + key;
}

// Get current language code
function getCurrentLang() {
  return _currentLang;
}

// Set language and persist
function setLanguage(lang, label) {
  document.getElementById('languageDialog').classList.remove('open');
  _currentLang = lang;
  localStorage.setItem('ncmems_language', lang);
  ApiService.saveSettings({ language: lang });

  // Update settings page UI
  const descMap = { vi: 'Tiếng Việt', en: 'English', ja: '日本語', ko: '한국어' };
  const langEl = document.querySelector('#settingsContent .setting-row:nth-child(2)');
  if (langEl) {
    langEl.querySelector('.setting-desc').textContent = descMap[lang] || 'Tiếng Việt';
    const code = langEl.querySelector('span');
    if (code) code.textContent = (LANGUAGES[lang]?.code || 'VI') + ' ›';
  }

  // Re-apply i18n to all visible content
  applyI18n();

  showToast(__(`toast.lang_changed`) + ': ' + (descMap[lang] || lang));
}

// Apply translations to all elements with data-i18n attributes
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = __(key);
    if (translation && !translation.startsWith('⁇')) {
      // Handle different element types
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.hasAttribute('placeholder')) el.placeholder = translation;
        else el.value = translation;
      } else {
        el.textContent = translation;
      }
    }
  });
}

// Initialize language from saved settings
function initLanguage(settings) {
  const lang = (settings && settings.language) || localStorage.getItem('ncmems_language') || 'vi';
  _currentLang = lang;
  localStorage.setItem('ncmems_language', lang);
}
