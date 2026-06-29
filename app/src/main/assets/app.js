    // ======================== STATE ========================
    const USERS = {
      'admin': { pass: 'admin123', name: 'Nguyễn Văn A', role: 'Kỹ sư sản xuất' },
      'user':  { pass: 'user123',  name: 'Trần Thị B',   role: 'Kỹ thuật viên' },
      'manager': { pass: 'mgr123', name: 'Lê Văn C',     role: 'Quản lý sản xuất' }
    };

    let currentPage = 'home';
    let lastPage = 'home';
    let darkMode = false;
    let bleScanning = false;
    let bleTimer = null;
    let isLoggedIn = false;
    let subPageOpen = false;  // track if any sub-page is open

    // ======================== BOOT SEQUENCE ========================
    window.addEventListener('DOMContentLoaded', () => {
      // Check saved session
      const saved = localStorage.getItem('ncmems_session');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.loggedIn && USERS[data.username]) {
            isLoggedIn = true;
          }
        } catch(e) {}
      }

      // Splash → Login or Main
      setTimeout(() => {
        document.getElementById('splashScreen').classList.add('hide');
        setTimeout(() => {
          document.getElementById('splashScreen').style.display = 'none';
          if (isLoggedIn) {
            enterMainApp();
          } else {
            showConnectionCheck();
          }
        }, 500);
      }, 2500);
    });

    // ======================== LOGIN ========================
    function togglePassword() {
      const pw = document.getElementById('loginPassword');
      pw.type = pw.type === 'password' ? 'text' : 'password';
    }

    function handleLogin() {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const errorEl = document.getElementById('loginError');
      const btn = document.getElementById('loginBtn');

      if (!username || !password) {
        errorEl.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
        errorEl.classList.add('show');
        return;
      }

      btn.classList.add('loading');
      errorEl.classList.remove('show');

      setTimeout(() => {
        btn.classList.remove('loading');
        const user = USERS[username];
        if (user && user.pass === password) {
          if (document.getElementById('rememberMe').checked) {
            localStorage.setItem('ncmems_session', JSON.stringify({
              loggedIn: true, username: username, name: user.name, role: user.role
            }));
          }
          enterMainApp(user);
        } else {
          errorEl.textContent = '❌ Sai tên đăng nhập hoặc mật khẩu';
          errorEl.classList.add('show');
        }
      }, 1200);
    }

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
      document.getElementById('loginUsername').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    });

    // ======================== CONNECTION CHECK ========================
    function showConnectionCheck() {
      const modal = document.getElementById('connectionModal');
      modal.classList.add('open');
      checkConnectionAgain();
    }

    function checkConnectionAgain() {
      const modal = document.getElementById('connectionModal');
      if (!modal || !modal.classList.contains('open')) return;
      setTimeout(() => {
        checkWiFi();
        checkBluetooth();
      }, 300);
    }

    function checkWiFi() {
      const statusEl = document.getElementById('connWifiStatus');
      const btn = document.getElementById('connWifiBtn');
      try {
        const enabled = typeof Android !== 'undefined' && Android.isWifiEnabled();
        if (enabled) {
          statusEl.textContent = '✅ Đã bật';
          statusEl.style.color = '#2e7d32';
          btn.textContent = '✓ Đã bật';
          btn.style.background = '#4caf50';
          btn.disabled = true;
        } else {
          statusEl.textContent = '❌ Chưa bật';
          statusEl.style.color = '#d32f2f';
          btn.textContent = '🔓 Bật WiFi';
          btn.style.background = '#1a4a8a';
          btn.disabled = false;
        }
      } catch(e) {
        statusEl.textContent = '⚠️ Không thể kiểm tra';
        statusEl.style.color = '#f57c00';
      }
      updateContinueButton();
    }

    function checkBluetooth() {
      const statusEl = document.getElementById('connBtStatus');
      const btn = document.getElementById('connBtBtn');
      try {
        const enabled = typeof Android !== 'undefined' && Android.isBluetoothEnabled();
        if (enabled) {
          statusEl.textContent = '✅ Đã bật';
          statusEl.style.color = '#2e7d32';
          btn.textContent = '✓ Đã bật';
          btn.style.background = '#4caf50';
          btn.disabled = true;
        } else {
          statusEl.textContent = '❌ Chưa bật';
          statusEl.style.color = '#d32f2f';
          btn.textContent = '🔓 Bật Bluetooth';
          btn.style.background = '#1a4a8a';
          btn.disabled = false;
        }
      } catch(e) {
        statusEl.textContent = '⚠️ Không thể kiểm tra';
        statusEl.style.color = '#f57c00';
      }
      updateContinueButton();
    }

    function updateContinueButton() {
      const wifiStatus = document.getElementById('connWifiStatus').textContent;
      const btStatus = document.getElementById('connBtStatus').textContent;
      const bothOn = wifiStatus.includes('Đã bật') && btStatus.includes('Đã bật');
      if (bothOn) {
        setTimeout(() => confirmConnectionReady(), 500);
      }
    }

    function openWifiSettings() {
      try {
        if (typeof Android !== 'undefined' && Android.openWifiSettings) {
          Android.openWifiSettings();
        }
      } catch(e) {}
    }

    function openBluetoothSettings() {
      try {
        if (typeof Android !== 'undefined' && Android.openBluetoothSettings) {
          Android.openBluetoothSettings();
        }
      } catch(e) {}
    }

    function confirmConnectionReady() {
      document.getElementById('connectionModal').classList.remove('open');
      document.getElementById('loginScreen').classList.add('active');
      renderLoginQR();
    }

    // ======================== MAIN APP ENTRY ========================
    function enterMainApp(userData) {
      const username = userData ? userData.name : (() => {
        const saved = JSON.parse(localStorage.getItem('ncmems_session') || '{}');
        return saved.name || 'Nguyễn Văn A';
      })();
      const role = userData ? userData.role : (() => {
        const saved = JSON.parse(localStorage.getItem('ncmems_session') || '{}');
        return saved.role || 'Kỹ sư sản xuất';
      })();

      document.getElementById('loginScreen').classList.remove('active');
      document.getElementById('mainApp').classList.add('active');
      document.getElementById('profileName').textContent = username;
      document.getElementById('profileRole').textContent = role;
      isLoggedIn = true;
    }

    // ======================== PAGE SWITCHING (fixed nav) ========================
    function switchPage(page, btn) {
      // Close BLE scanner if open
      if (subPageOpen) {
        closeBLEScanner();
      }

      if (currentPage === page) return;
      currentPage = page;

      document.querySelectorAll('.page-panel').forEach(p => p.classList.remove('active'));
      const target = document.querySelector(`.page-panel[data-page="${page}"]`);
      if (target) target.classList.add('active');

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      if (btn) btn.classList.add('active');
      else {
        const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navBtn) navBtn.classList.add('active');
      }
    }

    // ======================== NAVIGATION ========================
    function navigateTo(category) {
      showToast('📂 Đang mở ' + category + '...');
    }

    // ======================== SEARCH ========================
    function handleSearch() {
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      const container = document.getElementById('searchResults');
      if (!q) {
        container.innerHTML = '<div class="search-hint">🔍 Nhập từ khóa để tìm kiếm</div>';
        return;
      }
      const data = [
        { name: 'JIG', desc: 'Quản lý & Theo dõi Dụng cụ' },
        { name: 'PART', desc: 'Quản lý Phụ kiện & Vật tư' },
        { name: 'ESD', desc: 'Quản lý Thiết bị Chống Tĩnh điện' },
        { name: 'PRODUCTION EQUIPMENT', desc: 'Quản lý thiết bị sản xuất' },
      ];
      const results = data.filter(item =>
        item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)
      );
      if (results.length === 0) {
        container.innerHTML = '<div class="search-hint">😕 Không tìm thấy kết quả</div>';
      } else {
        container.innerHTML = results.map(r => `
          <div class="card" onclick="navigateTo('${r.name}')" style="animation:none;">
            <div class="card-info">
              <h3>${r.name}</h3>
              <p>${r.desc}</p>
            </div>
            <div class="card-arrow">
              <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
          </div>
        `).join('');
      }
    }

    // ======================== SETTINGS ========================
    function openSettings() {
      lastPage = currentPage;
      switchPage('settings');
    }
    function goBackFromSettings() {
      const target = lastPage || 'home';
      switchPage(target, document.querySelector(`.nav-item[data-page="${target}"]`));
    }

    function openWifiConfig() { showToast('Tính năng WiFi Config đang phát triển'); }

    function toggleDarkMode() {
      darkMode = !darkMode;
      document.getElementById('darkToggle').classList.toggle('on');
      document.body.classList.toggle('dark');
      showToast(darkMode ? '🌙 Chế độ tối' : '☀️ Chế độ sáng');
    }

    function toggleNotif() {
      document.getElementById('notifToggle').classList.toggle('on');
      const on = document.getElementById('notifToggle').classList.contains('on');
      showToast(on ? '🔔 Thông báo đã bật' : '🔕 Thông báo đã tắt');
    }

    // ======================== LOGOUT ========================
    function confirmLogout() { document.getElementById('logoutModal').classList.add('open'); }
    function closeLogout() { document.getElementById('logoutModal').classList.remove('open'); }
    document.getElementById('logoutModal').addEventListener('click', function(e) {
      if (e.target === this) closeLogout();
    });

    function doLogout() {
      localStorage.removeItem('ncmems_session');
      isLoggedIn = false;
      document.getElementById('logoutModal').classList.remove('open');
      document.getElementById('mainApp').classList.remove('active');
      document.getElementById('loginScreen').classList.add('active');
      document.getElementById('loginPassword').value = '';
      document.getElementById('loginError').classList.remove('show');
      showToast('👋 Đã đăng xuất');
    }

    // ======================== BLE SCANNER ========================
    function openBLEScanner() {
      document.getElementById('bleScannerPage').classList.add('active');
      subPageOpen = true;
    }
    function closeBLEScanner() {
      document.getElementById('bleScannerPage').classList.remove('active');
      subPageOpen = false;
      if (bleScanning) toggleBLEScan();
    }

    function toggleBLEScan() {
      const btn = document.getElementById('bleScanBtn');
      const text = document.getElementById('bleScanText');

      if (bleScanning) {
        bleScanning = false;
        btn.classList.remove('scanning');
        text.textContent = '🔍 Quét thiết bị';
        clearTimeout(bleTimer);
        showToast('🛑 Đã dừng quét BLE');
        return;
      }

      bleScanning = true;
      btn.classList.add('scanning');
      text.textContent = 'Đang quét...';
      const list = document.getElementById('bleDeviceList');
      list.innerHTML = '<div class="ble-empty" style="animation:fadeInUp 0.3s ease">📡 Đang quét thiết bị BLE...</div>';

      const mockDevices = [
        { name: 'NC-MEMS-BLE-001', addr: 'C4:BE:84:2A:11:3F', rssi: -58 },
        { name: 'NC-MEMS-BLE-002', addr: 'D0:39:72:BB:44:1A', rssi: -72 },
        { name: 'TempSensor-A1', addr: 'A4:C1:38:5E:97:2B', rssi: -45 },
        { name: 'BLE-Tag-47', addr: 'F8:42:93:11:CC:08', rssi: -81 },
        { name: 'iBeacon-Floor-3', addr: 'E5:12:77:3D:AA:59', rssi: -65 },
      ];

      let idx = 0;
      list.innerHTML = '';

      bleTimer = setInterval(() => {
        if (idx >= mockDevices.length) {
          clearInterval(bleTimer);
          showToast('✅ Đã tìm thấy ' + mockDevices.length + ' thiết bị');
          return;
        }
        const d = mockDevices[idx];
        const el = document.createElement('div');
        el.className = 'ble-device';
        el.style.animation = 'none';
        el.innerHTML = `
          <div class="ble-icon">
            <svg viewBox="0 0 24 24"><path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/></svg>
          </div>
          <div class="ble-info">
            <div class="name">${d.name}</div>
            <div class="addr">${d.addr}</div>
          </div>
          <div class="ble-rssi">RSSI: <strong>${d.rssi}</strong> dBm</div>
        `;
        el.addEventListener('click', () => {
          showToast('🔗 Đã kết nối với ' + d.name);
        });
        list.appendChild(el);
        requestAnimationFrame(() => { el.style.animation = ''; });
        idx++;
      }, 800);
    }

// ======================== MAC ADDRESS CONFIGURATOR (DIALOG) ========================

    // Auto-format MAC input: insert ":" after every 2 hex chars, uppercase
    function onMACInput() {
      const input = document.getElementById('macDialogInputField');
      let raw = input.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
      let formatted = '';
      for (let i = 0; i < raw.length; i++) {
        if (i > 0 && i % 2 === 0) formatted += ':';
        formatted += raw[i];
      }
      input.value = formatted;
      validateMACInput();
    }

    function validateMACInput() {
      const input = document.getElementById('macDialogInputField');
      const msg = document.getElementById('macValidationMsg');
      const raw = input.value.replace(/:/g, '');
      if (raw.length === 0) {
        msg.style.display = 'none';
        input.style.borderColor = '#ddd';
        return false;
      }
      if (/[^0-9A-F]/.test(raw)) {
        msg.textContent = '⚠️ Chỉ chấp nhận ký tự hex (0-9, A-F)';
        msg.style.display = 'block';
        input.style.borderColor = '#d32f2f';
        return false;
      }
      if (raw.length < 12) {
        msg.textContent = `⚠️ Còn thiếu ${12 - raw.length} ký tự`;
        msg.style.display = 'block';
        input.style.borderColor = '#f57c00';
        return false;
      }
      msg.style.display = 'none';
      input.style.borderColor = '#4caf50';
      return true;
    }

    function toggleMacConfig() {
      document.getElementById('macDialog').classList.add('open');
      const saved = localStorage.getItem('ncmems_mac_address');
      if (saved && saved.trim()) {
        showMacDisplayMode(saved);
      } else {
        showMacInputMode();
      }
    }

    function closeMacDialog() {
      document.getElementById('macDialog').classList.remove('open');
    }

    function showMacInputMode() {
      document.getElementById('macDialogInput').style.display = 'block';
      document.getElementById('macDialogDisplay').style.display = 'none';
      const saved = localStorage.getItem('ncmems_mac_address') || '';
      document.getElementById('macDialogInputField').value = saved;
      document.getElementById('macDialogInputField').focus();
      const msg = document.getElementById('macValidationMsg');
      msg.style.display = 'none';
      document.getElementById('macDialogInputField').style.borderColor = '#ddd';
      // Show delete button only if we have a saved MAC
      document.getElementById('macDeleteBtn').style.display = saved ? 'block' : 'none';
    }

    function showMacDisplayMode(mac) {
      document.getElementById('macDialogInput').style.display = 'none';
      document.getElementById('macDialogDisplay').style.display = 'block';
      document.getElementById('macDialogDisplayValue').textContent = mac;
    }

    function saveMacAddress() {
      if (!validateMACInput()) return;
      const mac = document.getElementById('macDialogInputField').value.toUpperCase();
      localStorage.setItem('ncmems_mac_address', mac);
      closeMacDialog();
      renderLoginQR();
      showToast('✅ Đã lưu MAC: ' + mac);
    }

    function editMacAddress() { showMacInputMode(); }

    function deleteMacAddress() {
      if (!confirm('Xóa địa chỉ MAC đã lưu?')) return;
      localStorage.removeItem('ncmems_mac_address');
      renderLoginQR();
      showToast('🗑️ Đã xóa MAC');
      showMacInputMode();
    }
    // ======================== LOGIN PAGE QR CODE ========================
    function renderLoginQR() {
      const container = document.getElementById('loginMacQR');
      const link = document.getElementById('macConfigLink');
      const saved = localStorage.getItem('ncmems_mac_address');

      if (!saved || !saved.trim()) {
        container.style.display = 'none';
        if (link) link.style.display = '';
        return;
      }

      container.style.display = 'block';
      if (link) link.style.display = 'none';
      document.getElementById('loginMacQRValue').textContent = saved;

      const canvas = document.getElementById('loginQRCanvas');
      const ctx = canvas.getContext('2d');
      // Explicit canvas size matching CSS
      canvas.width = 140;
      canvas.height = 140;

      try {
        const qr = qrcode(0, 'L');
        qr.addData(saved);
        qr.make();

        const cellSize = 5;
        const margin = 2;
        const dataURL = qr.createDataURL(cellSize, margin);

        const img = new Image();
        img.onload = function() {
          ctx.clearRect(0, 0, 140, 140);
          const x = Math.max(0, (140 - img.width) / 2);
          const y = Math.max(0, (140 - img.height) / 2);
          ctx.drawImage(img, x, y);
        };
        img.onerror = function() {
          console.error('QR image failed to load');
          ctx.fillStyle = '#eee';
          ctx.fillRect(0, 0, 140, 140);
        };
        img.src = dataURL;
      } catch(e) {
        console.error('Login QR error:', e);
        ctx.fillStyle = '#999';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ Lỗi tạo QR', 70, 70);
      }
    }

    // ======================== TOAST ========================
    let toastTimeout;
    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => el.classList.remove('show'), 2200);
    }

    // ======================== KEYBOARD ========================
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSettings();
    });
