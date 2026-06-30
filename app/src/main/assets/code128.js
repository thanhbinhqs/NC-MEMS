// ===================================================================
// Code128 — lightweight Code 128B barcode encoder
// ===================================================================
// Generates a Code 128 barcode on a canvas element.
// Supports FNC1, FNC2, FNC3, FNC4 shift codes for extended pairing.
//
// Usage:
//   Code128.draw(canvasId, text, { width, height })
// ===================================================================

const Code128 = (() => {
  'use strict';

  // Code 128B character set
  const B = {
    ' ': 0, '!': 1, '"': 2, '#': 3, '$': 4, '%': 5, '&': 6, "'": 7,
    '(': 8, ')': 9, '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, '/': 15,
    '0': 16, '1': 17, '2': 18, '3': 19, '4': 20, '5': 21, '6': 22, '7': 23,
    '8': 24, '9': 25, ':': 26, ';': 27, '<': 28, '=': 29, '>': 30, '?': 31,
    '@': 32, 'A': 33, 'B': 34, 'C': 35, 'D': 36, 'E': 37, 'F': 38, 'G': 39,
    'H': 40, 'I': 41, 'J': 42, 'K': 43, 'L': 44, 'M': 45, 'N': 46, 'O': 47,
    'P': 48, 'Q': 49, 'R': 50, 'S': 51, 'T': 52, 'U': 53, 'V': 54, 'W': 55,
    'X': 56, 'Y': 57, 'Z': 58, '[': 59, '\\': 60, ']': 61, '^': 62, '_': 63,
    '`': 64, 'a': 65, 'b': 66, 'c': 67, 'd': 68, 'e': 69, 'f': 70, 'g': 71,
    'h': 72, 'i': 73, 'j': 74, 'k': 75, 'l': 76, 'm': 77, 'n': 78, 'o': 79,
    'p': 80, 'q': 81, 'r': 82, 's': 83, 't': 84, 'u': 85, 'v': 86, 'w': 87,
    'x': 88, 'y': 89, 'z': 90, '{': 91, '|': 92, '}': 93, '~': 94
  };

  // Special shift codes (FNC3 = 99 in Code 128B)
  const FNC1 = 102, FNC2 = 97, FNC3 = 96, FNC4 = 101;
  const START_B = 104;
  const STOP = 106;

  // Widths for each of the 107 code words (6 bars/spaces each)
  const CODE_WIDTHS = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],[1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],[1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],[3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],[1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],[1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
    [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],[3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,2],[1,1,1,2,3,3],[1,1,1,3,3,2],[1,3,1,2,3,1],[1,1,3,2,1,3],[1,1,3,3,1,2],[1,3,3,2,1,1],[3,1,3,1,2,1],
    [2,1,1,3,3,1],[2,1,3,2,1,2],[2,1,3,2,2,1],[2,1,4,1,1,2],[2,1,4,1,2,1],[4,1,1,2,1,3],[4,1,1,3,1,2],[4,1,3,1,1,2],[2,1,2,1,2,3],[2,1,2,3,2,1],
    [2,3,2,1,2,1],[1,1,1,2,4,2],[1,1,1,4,2,2],[1,2,1,1,4,2],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,4,1],[1,1,4,2,2,1],[2,1,2,1,4,1],
    [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],[1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[1,3,1,1,3,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],[2,1,1,2,3,2],[2,3,1,1,1,2,1,1] // 106 = STOP
  ];

  // Tokenize text, handling FNC3 prefix
  function encode(text) {
    const codes = [];

    // Start with Code B
    codes.push(START_B);

    // Add FNC3 if text starts with special marker
    let i = 0;
    if (text.startsWith('\x9f') || text.startsWith('{FNC3}')) {
      codes.push(FNC3);
      i = text.startsWith('\x9f') ? 1 : 6;
    }

    // Encode remaining text
    for (; i < text.length; i++) {
      const char = text[i];
      if (B[char] !== undefined) {
        codes.push(B[char]);
      } else if (char.charCodeAt(0) >= 128) {
        codes.push(FNC4);
        codes.push(B[String.fromCharCode(char.charCodeAt(0) - 128)] || B[' ']);
      }
    }

    // Calculate checksum
    let checksum = codes[0];
    for (let j = 1; j < codes.length; j++) {
      checksum += codes[j] * j;
    }
    codes.push(checksum % 103);

    // Stop code
    codes.push(STOP);

    return codes;
  }

  // Draw the barcode on a canvas
  function draw(canvasIdOrEl, text, options = {}) {
    const canvas = typeof canvasIdOrEl === 'string'
      ? document.getElementById(canvasIdOrEl)
      : canvasIdOrEl;
    if (!canvas) return;

    const width = options.width || canvas.width || 200;
    const height = options.height || canvas.height || 80;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    const codes = encode(text);

    // Calculate total modules
    let totalModules = 0;
    for (let c = 0; c < codes.length; c++) {
      const w = CODE_WIDTHS[codes[c]];
      if (!w) break;
      for (let m = 0; m < (c === codes.length - 1 ? 7 : 6); m++) {
        totalModules += w[m];
      }
    }

    const barHeight = height * 0.85;
    const margin = options.margin !== undefined ? options.margin : 10;
    const moduleWidth = (width - margin * 2) / totalModules;

    // Clear
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    // Draw bars
    let x = margin;
    for (let c = 0; c < codes.length; c++) {
      const w = CODE_WIDTHS[codes[c]];
      if (!w) break;
      const len = (c === codes.length - 1) ? 7 : 6;
      for (let m = 0; m < len; m++) {
        // Even indices = bar, odd = space
        if (m % 2 === 0) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x, 0, w[m] * moduleWidth, barHeight);
        }
        x += w[m] * moduleWidth;
      }
    }

    // Text label below barcode
    const label = text.replace(/^\x9f/, '');
    ctx.fillStyle = '#000';
    ctx.font = `${Math.min(14, margin * 2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, width / 2, height - 2);
  }

  // Create extended pairing barcode data for Zebra scanner
  // Format: <FNC3>PH{host}A{mac}
  // host: 11=HID, 16=SSI, 0E=SPP
  function pairingData(mac, hostType = '11') {
    // Remove colons from MAC
    const cleanMac = mac.replace(/[:\-]/g, '').toUpperCase();
    return '\x9fPH' + hostType + 'A' + cleanMac;
  }

  return { draw, pairingData, encode };
})();
