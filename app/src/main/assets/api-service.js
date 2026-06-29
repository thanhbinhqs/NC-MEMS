// ===================================================================
// API Service Layer — NC MEMS
// ===================================================================
// Chuyển useMock = false để dùng API thật.
// Mọi service function đều trả về Promise (tương thích async/await).
// ===================================================================

const ApiService = (() => {
  'use strict';

  // ─── Config ──────────────────────────────────────────────────────
  const CONFIG = {
    useMock: true,
    baseUrl: 'http://10.0.2.2:3000/api/v1',  // Android emulator → host machine
    timeout: 10000,
  };

  // ─── Endpoints ───────────────────────────────────────────────────
  const ENDPOINTS = {
    login:        '/auth/login',
    logout:       '/auth/logout',
    profile:      '/profile',
    categories:   '/categories',
    categoryDetail: (id) => `/categories/${id}`,
    search:       (q) => `/search?q=${encodeURIComponent(q)}`,
    items:        '/items',
    itemDetail:   (id) => `/items/${id}`,
    stats:        '/stats',
    devices:      '/devices',
    settings:     '/settings',
  };

  // ─── Mock Data ───────────────────────────────────────────────────
  const MOCK = {
    // Users / Auth
    users: {
      'admin':  { pass: 'admin123', name: 'Nguyễn Văn A', role: 'Kỹ sư sản xuất' },
      'user':   { pass: 'user123',  name: 'Trần Thị B',   role: 'Kỹ thuật viên' },
      'manager':{ pass: 'mgr123',  name: 'Lê Văn C',     role: 'Quản lý sản xuất' },
    },

    // Categories dashboard
    categories: [
      { id: 'JIG',      name: 'JIG',                 desc: 'Quản lý & Theo dõi Dụng cụ',               count: 150, icon: 'jig' },
      { id: 'PART',     name: 'PART',                desc: 'Quản lý Phụ kiện & Vật tư',               count: 3500, icon: 'part' },
      { id: 'ESD',      name: 'ESD',                 desc: 'Quản lý Thiết bị Chống Tĩnh điện',        count: 210, icon: 'esd' },
      { id: 'PRODUCTION', name: 'PRODUCTION EQUIPMENT', desc: 'Quản lý thiết bị sản xuất',            count: 45, icon: 'production' },
    ],

    // Profile stats
    stats: { jig: 150, part: 3500, esd: 210, production: 45 },

    // Searchable items
    searchItems: [
      { id: 1,  category: 'JIG',      name: 'JIG-001', desc: 'Dụng cụ kiểm tra A', location: 'Kho A' },
      { id: 2,  category: 'JIG',      name: 'JIG-002', desc: 'Dụng cụ kiểm tra B', location: 'Kho B' },
      { id: 3,  category: 'PART',     name: 'PART-001', desc: 'Phụ kiện kết nối USB', location: 'Kho A' },
      { id: 4,  category: 'PART',     name: 'PART-002', desc: 'Cáp tín hiệu', location: 'Kho C' },
      { id: 5,  category: 'PART',     name: 'PART-003', desc: 'Adapter nguồn', location: 'Kho A' },
      { id: 6,  category: 'ESD',      name: 'ESD-001', desc: 'Thảm chống tĩnh điện', location: 'Khu vực SX' },
      { id: 7,  category: 'ESD',      name: 'ESD-002', desc: 'Vòng đeo tay chống tĩnh điện', location: 'Khu vực SX' },
      { id: 8,  category: 'PRODUCTION', name: 'EQ-001', desc: 'Máy đo công suất', location: 'Phòng Máy' },
      { id: 9,  category: 'PRODUCTION', name: 'EQ-002', desc: 'Thiết bị kiểm tra nhiệt', location: 'Phòng QC' },
    ],
  };

  // ─── HTTP Helper ─────────────────────────────────────────────────
  async function http(method, path, body) {
    const url = CONFIG.baseUrl + path;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: CONFIG.timeout,
    };
    if (body) opts.body = JSON.stringify(body);

    // Attach auth token if available
    const token = localStorage.getItem('ncmems_api_token');
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: resp.statusText }));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  // ─── Simulated delay for mock mode ───────────────────────────────
  function mockDelay(ms) {
    const delay = ms || (Math.random() * 200 + 80);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // ─── Service: Auth ───────────────────────────────────────────────
  async function login(username, password) {
    if (CONFIG.useMock) {
      await mockDelay(400);
      const user = MOCK.users[username];
      if (!user || user.pass !== password) {
        throw new Error('Sai tên đăng nhập hoặc mật khẩu');
      }
      const { pass, ...safe } = user;
      return { token: 'mock-token-' + Date.now(), user: { ...safe, username } };
    }
    return http('POST', ENDPOINTS.login, { username, password });
  }

  async function logout() {
    localStorage.removeItem('ncmems_api_token');
    localStorage.removeItem('ncmems_user');
    if (CONFIG.useMock) return { ok: true };
    return http('POST', ENDPOINTS.logout);
  }

  // ─── Service: Categories ─────────────────────────────────────────
  async function getCategories() {
    if (CONFIG.useMock) {
      await mockDelay();
      return MOCK.categories;
    }
    return http('GET', ENDPOINTS.categories);
  }

  async function getCategoryDetail(id) {
    if (CONFIG.useMock) {
      await mockDelay();
      const cat = MOCK.categories.find(c => c.id === id);
      if (!cat) throw new Error('Không tìm thấy danh mục');
      const items = MOCK.searchItems.filter(i => i.category === id);
      return { ...cat, items };
    }
    return http('GET', ENDPOINTS.categoryDetail(id));
  }

  // ─── Service: Search ─────────────────────────────────────────────
  async function search(query) {
    if (CONFIG.useMock) {
      await mockDelay(250);
      const q = query.toLowerCase();
      const results = MOCK.searchItems.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
      return results;
    }
    return http('GET', ENDPOINTS.search(query));
  }

  // ─── Service: Profile / Stats ────────────────────────────────────
  async function getProfile(username) {
    if (CONFIG.useMock) {
      await mockDelay();
      const user = MOCK.users[username];
      if (!user) throw new Error('User not found');
      const { pass, ...safe } = user;
      return { ...safe, username };
    }
    return http('GET', ENDPOINTS.profile);
  }

  async function getStats() {
    if (CONFIG.useMock) {
      await mockDelay();
      return MOCK.stats;
    }
    return http('GET', ENDPOINTS.stats);
  }

  async function getItems(category) {
    if (CONFIG.useMock) {
      await mockDelay();
      if (category) return MOCK.searchItems.filter(i => i.category === category);
      return MOCK.searchItems;
    }
    const path = category ? `${ENDPOINTS.items}?category=${encodeURIComponent(category)}` : ENDPOINTS.items;
    return http('GET', path);
  }

  // ─── Service: Settings ───────────────────────────────────────────
  async function saveSettings(data) {
    if (CONFIG.useMock) {
      await mockDelay();
      Object.entries(data).forEach(([k, v]) => localStorage.setItem('ncmems_setting_' + k, JSON.stringify(v)));
      return { ok: true };
    }
    return http('PUT', ENDPOINTS.settings, data);
  }

  async function loadSettings() {
    if (CONFIG.useMock) {
      await mockDelay(50);
      const out = {};
      const prefix = 'ncmems_setting_';
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try { out[key.slice(prefix.length)] = JSON.parse(localStorage.getItem(key)); } catch {}
        }
      }
      return out;
    }
    return http('GET', ENDPOINTS.settings);
  }

  // ─── Public API ──────────────────────────────────────────────────
  return {
    CONFIG,
    login,
    logout,
    getCategories,
    getCategoryDetail,
    search,
    getProfile,
    getStats,
    getItems,
    saveSettings,
    loadSettings,
    // Convenience: toggle mock mode
    setMock(v) { CONFIG.useMock = !!v; },
    isMock() { return CONFIG.useMock; },
  };
})();
