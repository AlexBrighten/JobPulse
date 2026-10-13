const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, drawFn) {
  const bytesPerPixel = 4;
  const rawData = Buffer.alloc(height * (width * bytesPerPixel + 1));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * bytesPerPixel + 1);
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const typeAndData = Buffer.concat([typeBuf, data]);

    const crc = crc32(typeAndData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([length, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Icon design: Modern vibrant rounded squircle with gradient (deep indigo to bright violet) + briefcase/pulse graphic
function drawIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  const cx = 0.5, cy = 0.5;
  const dx = Math.abs(nx - cx);
  const dy = Math.abs(ny - cy);
  const cornerR = 0.22;
  const isInside = (dx <= 0.5 - cornerR && dy <= 0.5) ||
                   (dy <= 0.5 - cornerR && dx <= 0.5) ||
                   (Math.hypot(dx - (0.5 - cornerR), dy - (0.5 - cornerR)) <= cornerR);

  if (!isInside) return [0, 0, 0, 0];

  const grad = (nx + ny) / 2;
  let r = Math.round(79 + grad * (147 - 79));
  let g = Math.round(70 + grad * (51 - 70));
  let b = Math.round(229 + grad * (234 - 229));

  // Briefcase body: bounds [0.25, 0.38] to [0.75, 0.75]
  const inBody = (nx >= 0.26 && nx <= 0.74 && ny >= 0.40 && ny <= 0.74);
  // Handle: [0.38, 0.26] to [0.62, 0.40]
  const inHandleOuter = (nx >= 0.38 && nx <= 0.62 && ny >= 0.26 && ny <= 0.40);
  const inHandleInner = (nx >= 0.44 && nx <= 0.56 && ny >= 0.31 && ny <= 0.40);
  const inHandle = inHandleOuter && !inHandleInner;

  // Center latch
  const inLatch = (nx >= 0.44 && nx <= 0.56 && ny >= 0.52 && ny <= 0.62);
  const inStrap = (ny >= 0.50 && ny <= 0.53 && nx >= 0.26 && nx <= 0.74);

  if (inHandle || inBody) {
    if (inLatch) {
      return [245, 158, 11, 255]; // Amber accent latch
    }
    if (inStrap) {
      return [220, 225, 245, 220]; // Light subtle accent
    }
    return [255, 255, 255, 245]; // Crisp white icon
  }

  return [r, g, b, 255];
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPng(size, size, drawIcon);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngBuf);
  console.log(`Generated icon${size}.png (${pngBuf.length} bytes)`);
});
