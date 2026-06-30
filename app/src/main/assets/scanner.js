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
  // Scanner sends keystrokes to whichever field has focus.
  // We capture ALL keystrokes globally and detect barcode patterns:
  //   1. Multiple chars arriving rapidly (<200ms between keys)
  //   2. Terminated by Enter
  //   3. Or timeout (200ms without key = end of barcode)
  // Non-blocking: does NOT preventDefault, normal typing still works.
  function startHidCapture() {
    let buffer = '';
    let lastKeyTime = 0;
    let barcodeTimer = null;

    document.addEventListener('keydown', e => {
      // Mock scan keys (browser testing) — only when no input focused
      const tag = e.target.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        if (e.key === 'q') { _onBarcodeReceived('NCMEMS://admin:admin123', 'MOCK'); return; }
        if (e.key === 'w') { _onBarcodeReceived('JIG-001', 'MOCK'); return; }
        if (e.key === 'e') { _onBarcodeReceived('PART-005', 'MOCK'); return; }
        if (e.key === 'r') { _onBarcodeReceived('ESD-003', 'MOCK'); return; }
      }

      // Handle Enter — potential barcode terminator
      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          const barcode = buffer;
          buffer = '';
          lastKeyTime = 0;
          clearTimeout(barcodeTimer);
          _connected = true;
          _onBarcodeReceived(barcode, 'HID_BARCODE');
        }
        buffer = '';
        return;
      }

      // Track printable characters
      if (e.key.length === 1 && e.key.charCodeAt(0) >= 0x20) {
        const now = Date.now();
        const gap = now - lastKeyTime;

        // If gap > 500ms, this is likely new input (not barcode continuation)
        if (gap > 500) {
          buffer = '';
        }

        buffer += e.key;
        lastKeyTime = now;

        // If we accumulated enough chars rapidly, it's a barcode
        if (buffer.length >= 4 && gap > 0 && gap < 200) {
          clearTimeout(barcodeTimer);
          barcodeTimer = setTimeout(() => {
            // No new key for 200ms → barcode complete
            if (buffer.length >= 3) {
              const barcode = buffer;
              buffer = '';
              lastKeyTime = 0;
              _connected = true;
              _onBarcodeReceived(barcode, 'HID_BARCODE');
            }
          }, 200);
        }
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
