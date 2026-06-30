// ===================================================================
// Scanner — Zebra Scanner SDK WebView Bridge (Browser Mock Fallback)
// ===================================================================
// Usage:
//   Scanner.onBarcode(data => handleScan(data))
//   Scanner.start()
//   Scanner.stop()
//   Scanner.connected  // boolean
//
// In production: communicates with ScannerBridge (native Android).
// In browser/dev: press 'Q' key to simulate a scan.
// ===================================================================

const Scanner = (() => {
  'use strict';

  // ── Config ──────────────────────────────────────────────────
  const CONFIG = {
    loginQRFormat: 'NCMEMS://',
    beepOnScan: true,
    vibrateOnScan: true,
    enableLoginQR: true,
    enableCategoryScan: true,
  };

  // ── State ───────────────────────────────────────────────────
  let listeners = [];
  let scanning = false;
  let _connected = false;

  // ── Load config from native bridge ──────────────────────────
  function init() {
    if (typeof ScannerBridge !== 'undefined' && ScannerBridge.getConfig) {
      try {
        const cfg = JSON.parse(ScannerBridge.getConfig());
        Object.assign(CONFIG, cfg);
      } catch (e) {}
      _connected = ScannerBridge.isConnected();
    }
  }

  // ── Public API ──────────────────────────────────────────────
  function start() {
    scanning = true;
    if (typeof ScannerBridge !== 'undefined' && ScannerBridge.startScanning) {
      ScannerBridge.startScanning();
    }
  }

  function stop() {
    scanning = false;
    if (typeof ScannerBridge !== 'undefined' && ScannerBridge.stopScanning) {
      ScannerBridge.stopScanning();
    }
  }

  function onBarcode(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function offBarcode(fn) {
    listeners = listeners.filter(l => l !== fn);
  }

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

    // Quick beep / vibrate feedback
    if (CONFIG.beepOnScan && typeof AudioContext !== 'undefined') {
      try { new AudioContext().close(); } catch(e) {}
    }

    listeners.forEach(fn => {
      try { fn(data); } catch(e) { console.warn('Scanner listener error:', e); }
    });
  }

  // ── Polling fallback for when native push doesn't work ──────
  let pollTimer = null;
  function startPolling() {
    if (typeof ScannerBridge === 'undefined' || !ScannerBridge.getLastBarcode) return;
    let lastPoll = '';
    pollTimer = setInterval(() => {
      try {
        const barcode = ScannerBridge.getLastBarcode();
        if (barcode && barcode !== lastPoll) {
          lastPoll = barcode;
          const type = ScannerBridge.getLastBarcodeType();
          _onBarcodeReceived(barcode, type);
        }
      } catch(e) {}
    }, 300);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Browser mock: press 'Q' to simulate scan ───────────────
  function enableMock() {
    document.addEventListener('keydown', e => {
      if (e.key === 'q' || e.key === 'Q') {
        _onBarcodeReceived('NCMEMS://admin:admin123', 'QR_CODE');
      }
      if (e.key === 'w' || e.key === 'W') {
        _onBarcodeReceived('JIG-001', 'CODE128');
      }
      if (e.key === 'e' || e.key === 'E') {
        _onBarcodeReceived('PART-005', 'CODE128');
      }
      if (e.key === 'r' || e.key === 'R') {
        _onBarcodeReceived('ESD-003', 'CODE128');
      }
    });
  }

  // ── Initialize ──────────────────────────────────────────────
  init();
  // If native bridge is present, poll for barcode data
  if (typeof ScannerBridge !== 'undefined' && ScannerBridge.getLastBarcode) {
    startPolling();
  } else {
    enableMock();
  }

  // ── Public interface ────────────────────────────────────────
  return {
    get connected() { return _connected; },
    get scanning() { return scanning; },
    get config() { return { ...CONFIG }; },
    init,
    start,
    stop,
    onBarcode,
    offBarcode,
    setConfig,
    _onBarcodeReceived,  // for native callback
  };
})();
