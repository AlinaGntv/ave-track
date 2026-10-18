// Генерирует PNG-иконки PWA без внешних зависимостей: растеризация с суперсэмплингом + zlib.
// Мотив — заполненный кружок выполнения из приложения, ч/б.
// Запуск: node scripts/generate-icons.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = path.resolve("public/icons");
const BG = [17, 17, 18];
const FG = [255, 255, 255];
const SS = 4; // суперсэмплинг 4×4

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // глубина
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // фильтр None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * @param size  размер в px
 * @param scale размер знака относительно холста (для maskable — меньше, чтобы попасть в безопасную зону)
 * @param rounded скруглённый квадрат с прозрачными углами (обычные иконки) или фон на весь холст (iOS, maskable)
 */
function render(size, { scale = 1, rounded = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const ring = 0.3 * scale;
  const stroke = 0.056 * scale;
  const dot = 0.178 * scale;
  const corner = 0.225;

  const sample = (u, v) => {
    // Фон: прямоугольник со скруглёнными углами или весь холст
    if (rounded) {
      const dx = Math.max(corner - u, u - (1 - corner), 0);
      const dy = Math.max(corner - v, v - (1 - corner), 0);
      if (dx * dx + dy * dy > corner * corner) return null;
    }
    const r = Math.hypot(u - 0.5, v - 0.5);
    const onRing = Math.abs(r - ring) <= stroke / 2;
    return onRing || r <= dot ? FG : BG;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          if (!c) continue;
          r += c[0];
          g += c[1];
          b += c[2];
          a += 1;
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      rgba[i] = a ? Math.round(r / a) : 0;
      rgba[i + 1] = a ? Math.round(g / a) : 0;
      rgba[i + 2] = a ? Math.round(b / a) : 0;
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, rgba);
}

fs.mkdirSync(OUT, { recursive: true });
const icons = {
  "icon-192.png": render(192, { rounded: true }),
  "icon-512.png": render(512, { rounded: true }),
  // Android обрезает maskable до круга/сквиркла — знак уменьшен до безопасной зоны (80%)
  "maskable-512.png": render(512, { scale: 0.8 }),
  // iOS сам скругляет углы, прозрачность не поддерживает
  "apple-touch-icon.png": render(180),
};
for (const [name, png] of Object.entries(icons)) {
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`✓ public/icons/${name} (${png.length} B)`);
}
