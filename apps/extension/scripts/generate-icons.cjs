const { createWriteStream } = require('fs');
const { deflateSync } = require('zlib');
const path = require('path');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type);
  const crcBuf = Buffer.concat([typeB, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeB, data, crc]);
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function generateIcon(size) {
  // Shield path definition (normalized 0-1 coordinates from SVG viewBox 0 0 24 24)
  // Bottom point: 12,22  Left: 3,7  Top: 3,7  Right: 21,7  Top-2: 12,2
  // Inner bottom: 12,20  Inner left: 6.5,8.55  Inner right: 17.5,8.55  Inner top: 12,5
  
  const scale = size / 24;
  const cx = size / 2;

  const primary = hexToRgb('#14f195');
  const secondary = hexToRgb('#9945ff');
  const bg = [12, 12, 12];

  const pixels = Buffer.alloc(size * size * 4); // RGBA

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = r;
    pixels[i+1] = g;
    pixels[i+2] = b;
    pixels[i+3] = a;
  }

  // Fill background (rounded rect approximation)
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = false;
      // Distance from edge for rounded corners
      let dx = 0, dy = 0;
      if (x < radius) dx = radius - x;
      else if (x > size - 1 - radius) dx = x - (size - 1 - radius);
      if (y < radius) dy = radius - y;
      else if (y > size - 1 - radius) dy = y - (size - 1 - radius);
      
      if (dx <= 0 && dy <= 0) inside = true;
      else if (dx > 0 && dy > 0 && Math.sqrt(dx*dx + dy*dy) <= radius) inside = true;
      else if (dx <= 0 && dy > 0 && dy <= radius) inside = true;
      else if (dy <= 0 && dx > 0 && dx <= radius) inside = true;

      if (!inside) {
        setPixel(x, y, 0, 0, 0, 0); // transparent
      }
    }
  }

  // Draw shield shape
  const px = (u) => u * scale;
  
  // The shield shape from SVG: M12 2 L3 7 v6 c0 5.55 3.84 10.74 9 12 L12 25 c5.16-1.26 9-6.45 9-12 V7 Z
  // Simplified: triangle-ish shield
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / scale;
      const v = y / scale;
      
      // Shield outer polygon
      // Top: point at (12, 2), sides: (3,7) to (21,7), bottom: (3,7) to (12,22) to (21,7)
      let inShield = false;
      const topY = 2, bottomY = 22, topX = 12;
      const leftOuterX = 3 + (topX - 3) * ((v - 7) / (bottomY - 7));
      const rightOuterX = 21 - (21 - topX) * ((v - 7) / (bottomY - 7));
      
      if (v >= 2 && v <= 7) {
        // Top triangle: (12,2) to (3,7) to (21,7)
        const leftEdge = 3 + (12 - 3) * ((v - 7) / (2 - 7));
        const rightEdge = 21 - (21 - 12) * ((v - 7) / (2 - 7));
        if (u >= leftEdge && u <= rightEdge) inShield = true;
      } else if (v > 7 && v <= 22) {
        // Bottom V: (3,7) to (12,22) to (21,7)
        const leftEdge = 3 + (12 - 3) * ((v - 7) / (22 - 7));
        const rightEdge = 21 - (21 - 12) * ((v - 7) / (22 - 7));
        if (u >= leftEdge && u <= rightEdge) inShield = true;
      }
      
      if (inShield) {
        // Gradient from top (primary) to bottom (secondary)
        const t = (v - 2) / 20;
        const r = lerp(primary[0], secondary[0], t);
        const g = lerp(primary[1], secondary[1], t);
        const b = lerp(secondary[2], primary[2], t); // swapped for purple
        setPixel(x, y, r, g, b, 255);
      }
      
      // Shield inner cutout (the checkmark area)
      const innerTopY = 8.55, innerBottomY = 20;
      let inInner = false;
      if (v >= 8.55 && v <= 20) {
        const innerLeftX = 6.5 + (12 - 6.5) * ((v - 8.55) / (20 - 8.55));
        const innerRightX = 17.5 - (17.5 - 12) * ((v - 8.55) / (20 - 8.55));
        if (u >= innerLeftX && u <= innerRightX) inInner = true;
      }
      // Inner top triangle
      if (v >= 5 && v <= 8.55) {
        const ile = 6.5 + (12 - 6.5) * ((v - 8.55) / (5 - 8.55));
        const ire = 17.5 - (17.5 - 12) * ((v - 8.55) / (5 - 8.55));
        if (u >= ile && u <= ire) inInner = true;
      }
      
      if (inInner) {
        // Dark inner
        setPixel(x, y, 10, 10, 10, 255);
      }
    }
  }

  // Raw image data with filter byte 0 per row
  const rawData = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    rawData[y * (1 + size * 4)] = 0; // filter: none
    pixels.copy(rawData, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = deflateSync(rawData);

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const buf = Buffer.concat([
    header,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);

  return buf;
}

const iconDir = path.join(__dirname, '..', 'public', 'icon');
const sizes = [16, 32, 48, 96, 128];

for (const size of sizes) {
  const png = generateIcon(size);
  const filePath = path.join(iconDir, `${size}.png`);
  const ws = createWriteStream(filePath);
  ws.write(png);
  ws.end();
  console.log(`Generated ${filePath} (${png.length} bytes)`);
}
