#!/usr/bin/env node
/**
 * Generates extension/icons/icon{16,32,48,128}.png from public/jams-logo.png.
 * Pure Node (zlib only) — no image libraries needed. Renders the logo onto a
 * rounded dark tile (matches the app's ink color) so the icon reads clearly in
 * both light and dark Chrome toolbars, then box-downsamples from a 512px master.
 *
 * Usage: node scripts/make-extension-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "public", "jams-logo.png");
const OUT = path.join(root, "extension", "icons");
const LOGO_OUT = path.join(root, "extension", "logo.png");
const MASTER = 512;
const SIZES = [16, 32, 48, 128];

/* --------------------------------- PNG I/O --------------------------------- */

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let p = 8;
  let w = 0;
  let h = 0;
  let colorType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    if (type === "IHDR") {
      w = buf.readUInt32BE(p + 8);
      h = buf.readUInt32BE(p + 12);
      if (buf[p + 16] !== 8) throw new Error("only 8-bit PNGs supported");
      colorType = buf[p + 17];
      if (buf[p + 20] !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") {
      idat.push(buf.subarray(p + 8, p + 8 + len));
    } else if (type === "IEND") break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = w * bpp;
  const out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const si = x * bpp;
      const di = (y * w + x) * 4;
      out[di] = cur[si];
      out[di + 1] = cur[si + 1];
      out[di + 2] = cur[si + 2];
      out[di + 3] = bpp === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, data: out };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --------------------------------- drawing --------------------------------- */

/** Rounded-rect tile with antialiased edges; color rgb(28,25,23) (app ink). */
function makeTile(size, radius, rgb) {
  const data = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cx;
      const qx = Math.abs(px) - (cx - radius);
      const qy = Math.abs(py) - (cx - radius);
      const d =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const alpha = Math.min(1, Math.max(0, 0.5 - d));
      const i = (y * size + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  return data;
}

/** "src over dst", straight (non-premultiplied) alpha, both RGBA buffers. */
function over(dst, dw, dh, src, sw, sh, ox, oy) {
  for (let y = 0; y < sh; y++) {
    const dy = y + oy;
    if (dy < 0 || dy >= dh) continue;
    for (let x = 0; x < sw; x++) {
      const dx = x + ox;
      if (dx < 0 || dx >= dw) continue;
      const si = (y * sw + x) * 4;
      const di = (dy * dw + dx) * 4;
      const sa = src[si + 3] / 255;
      const da = dst[di + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa <= 0) {
        dst[di + 3] = 0;
        continue;
      }
      for (let ch = 0; ch < 3; ch++) {
        dst[di + ch] = Math.round(
          (src[si + ch] * sa + dst[di + ch] * da * (1 - sa)) / oa
        );
      }
      dst[di + 3] = Math.round(oa * 255);
    }
  }
}

/** Box-filter resize (premultiplied to avoid halos), RGBA → RGBA. */
function resize(src, sw, sh, dw, dh) {
  const pre = Buffer.alloc(sw * sh * 4);
  for (let i = 0; i < sw * sh; i++) {
    const a = src[i * 4 + 3];
    pre[i * 4] = (src[i * 4] * a) / 255;
    pre[i * 4 + 1] = (src[i * 4 + 1] * a) / 255;
    pre[i * 4 + 2] = (src[i * 4 + 2] * a) / 255;
    pre[i * 4 + 3] = a;
  }
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.ceil(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.ceil(((x + 1) * sw) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) * 4;
          r += pre[i];
          g += pre[i + 1];
          b += pre[i + 2];
          a += pre[i + 3];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const di = (y * dw + x) * 4;
      const oa = a / n;
      out[di + 3] = Math.round(oa);
      out[di] = oa > 0 ? Math.min(255, Math.round(r / n / (oa / 255))) : 0;
      out[di + 1] = oa > 0 ? Math.min(255, Math.round(g / n / (oa / 255))) : 0;
      out[di + 2] = oa > 0 ? Math.min(255, Math.round(b / n / (oa / 255))) : 0;
    }
  }
  return out;
}

/* ---------------------------------- main ----------------------------------- */

const logo = decodePng(fs.readFileSync(SRC));
const tile = makeTile(MASTER, Math.round(MASTER * 0.22), [28, 25, 23]);
over(
  tile,
  MASTER,
  MASTER,
  logo.data,
  logo.w,
  logo.h,
  Math.round((MASTER - logo.w) / 2),
  Math.round((MASTER - logo.h) / 2)
);

fs.mkdirSync(OUT, { recursive: true });
for (const size of SIZES) {
  const icon = resize(tile, MASTER, MASTER, size, size);
  const file = path.join(OUT, `icon${size}.png`);
  fs.writeFileSync(file, encodePng(size, size, icon));
  console.log("wrote", path.relative(root, file));
}
fs.copyFileSync(SRC, LOGO_OUT);
console.log("wrote", path.relative(root, LOGO_OUT));
