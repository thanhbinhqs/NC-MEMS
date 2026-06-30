// ===================================================================
// Scanner — Zebra scanner integration
// ===================================================================
// PRIMARY FLOW:
//   Login page shows phone's Bluetooth MAC as QR code.
//   Zebra scanner scans the QR → connects to phone (HID keyboard mode).
//   Barcode arrives as keystrokes → captured by onScanKey handler.
//
//   Also supports SPP/BLE incoming connections via native server socket.
//
// Browser mock: press Q/W/E/R keys to simulate scan.
// ===================================================================

const Scanner = (() => {
  'use strict';

  const CONFIG = {
    loginQRFormat: 'NCMEMS://',
    enableLoginQR: true,
    enableCategoryScan: true,
  };

  let listeners = [];
  let scanning = false;
  let _connected = false;
  let _lastHidBarcode = '';
  let _hidTimeout = null;

  // ── Load config from native bridge ──────────────────────────
  function init() {
    if (typeof ScannerBridge !== 'undefined') {
      try {
        const cfg = JSON.parse(ScannerBridge.getConfig());
        Object.assign(CONFIG, cfg);
      } catch (e) {}
      _connected = ScannerBridge.isConnected();
    }

    // Start HID key capture (Zebra scanner in HID keyboard mode)
    startHidCapture();
  }

  // ── HID key capture (for Zebra scanners in keyboard mode) ───
  function startHidCapture() {
    // Buffer keystrokes with a small timeout to detect barcode end
    let buffer = '';

    document.addEventListener('keydown', e => {
      // Skip if the event target is an input field (normal typing)
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Check for mock scan keys (browser testing)
      if (e.key === 'q') { _onBarcodeReceived('NCMEMS://admin:admin123', 'QR_CODE'); return; }
      if (e.key === 'w') { _onBarcodeReceived('JIG-001', 'CODE128'); return; }
      if (e.key === 'e') { _onBarcodeReceived('PART-005', 'CODE128'); return; }
      if (e.key === 'r') { _onBarcodeReceived('ESD-003', 'CODE128'); return; }

      // Prevent actual typing
      e.preventDefault();

      // Handle Enter key (scanner sends Enter after barcode)
      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          const barcode = buffer;
          buffer = '';
          _lastHidBarcode = barcode;
          _onBarcodeReceived(barcode, 'HID_BARCODE');
          _connected = true;
        }
        return;
      }

      // Accumulate printable characters
      if (e.key.length === 1 && e.key.charCodeAt(0) >= 0x20) {
        buffer += e.key;
        // Auto-detect end after 150ms of no input
        clearTimeout(_hidTimeout);
        _hidTimeout = setTimeout(() => {
          if (buffer.length > 2) {
            const barcode = buffer;
            buffer = '';
            _lastHidBarcode = barcode;
            _onBarcodeReceived(barcode, 'HID_BARCODE');
            _connected = true;
          }
        }, 150);
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────
  function start() { scanning = true; }
  function stop() { scanning = false; }

  function onBarcode(fn) { if (typeof fn === 'function') listeners.push(fn); }
  function offBarcode(fn) { listeners = listeners.filter(l => l !== fn); }

  function setConfig(obj) {
    Object.assign(CONFIG, obj);
    if (typeof ScannerBridge !== 'undefined' && ScannerBridge.setConfig) {
      ScannerBridge.setConfig(JSON.stringify(obj));
    }
  }

  // ── Called from native on barcode event ─────────────────────
  function _onBarcodeReceived(barcode, type) {
    if (!scanning) return;
    const data = { barcode, type: type || 'UNKNOWN', timestamp: Date.now() };
    listeners.forEach(fn => {
      try { fn(data); } catch(e) { console.warn('Scanner listener error:', e); }
    });
  }

  // ── Poll for SPP data from native bridge ────────────────────
  let pollTimer = null;
  function startPolling() {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.getLastBarcode) return;
    let lastPoll = '';
    pollTimer = setInterval(() => {
      try {
        const barcode = ScannerBridge.getLastBarcode();
        if (barcode && barcode !== lastPoll) {
          lastPoll = barcode;
          _onBarcodeReceived(barcode, ScannerBridge.getLastBarcodeType());
        }
        _connected = ScannerBridge.isConnected();
      } catch(e) {}
    }, 300);
  }

  // ── Phone info helpers ──────────────────────────────────────
  function getPhoneMac() {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.getPhoneMac) return 'UNAVAILABLE';
    return ScannerBridge.getPhoneMac();
  }

  function getPhoneName() {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.getPhoneName) return 'NC MEMS';
    return ScannerBridge.getPhoneName();
  }

  // ── Discovery for Settings ──────────────────────────────────
  function discover(callback) {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.startDiscovery) {
      callback([]); return;
    }
    ScannerBridge.startDiscovery();
    setTimeout(() => {
      const raw = ScannerBridge.getDiscoveredDevices();
      callback(JSON.parse(raw || '[]'));
    }, 8000);
  }

  function connect(address) {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.connectToDevice) return;
    ScannerBridge.connectToDevice(address);
  }

  function disconnect() {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.disconnectDevice) return;
    ScannerBridge.disconnectDevice();
  }

  function getConnectedDevice() {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.getConnectedDeviceName) return '';
    return ScannerBridge.getConnectedDeviceName();
  }

  // ── Init ────────────────────────────────────────────────────
  init();
  if (typeof ScannerBridge !== 'undefined' && ScannerBridge.getLastBarcode) {
    startPolling();
  }

  // ── Public interface ────────────────────────────────────────
  return {
    get connected() { return _connected; },
    get scanning() { return scanning; },
    get config() { return { ...CONFIG }; },
    init, start, stop, onBarcode, offBarcode, setConfig,
    getPhoneMac, getPhoneName,
    discover, connect, disconnect, getConnectedDevice,
    _onBarcodeReceived,
  };
})();
