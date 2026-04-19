const PNG = require("pngjs").PNG;
const fs = require("fs");
const path = require("path");

const SIZE = 160;
const SCALE = SIZE / 96;
const OUT = __dirname;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sx(value) {
  return value * SCALE;
}

function createCanvas(size) {
  const data = new Uint8Array(size * size * 4);
  return {
    data,
    set(x, y, r, g, b, a = 255) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || x >= size || y < 0 || y >= size) return;
      const i = (y * size + x) * 4;
      const oa = data[i + 3] / 255;
      const na = a / 255;
      const out = na + oa * (1 - na);
      if (out === 0) return;
      data[i] = Math.round((r * na + data[i] * oa * (1 - na)) / out);
      data[i + 1] = Math.round((g * na + data[i + 1] * oa * (1 - na)) / out);
      data[i + 2] = Math.round((b * na + data[i + 2] * oa * (1 - na)) / out);
      data[i + 3] = Math.round(out * 255);
    },
  };
}

function fillCircle(cv, cx, cy, r, color, alpha = 255) {
  cx = sx(cx);
  cy = sx(cy);
  r = sx(r);
  const [cr, cg, cb] = color;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= r - 0.5) cv.set(x, y, cr, cg, cb, alpha);
      else if (d <= r + 0.5) cv.set(x, y, cr, cg, cb, Math.round(alpha * (r + 0.5 - d)));
    }
  }
}

function strokeCircle(cv, cx, cy, r, sw, color) {
  cx = sx(cx);
  cy = sx(cy);
  r = sx(r);
  sw = sx(sw);
  const [cr, cg, cb] = color;
  const inner = r - sw / 2;
  const outer = r + sw / 2;
  for (let y = Math.floor(cy - outer - 1); y <= Math.ceil(cy + outer + 1); y++) {
    for (let x = Math.floor(cx - outer - 1); x <= Math.ceil(cx + outer + 1); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d >= inner && d <= outer) {
        const a = d < inner + 1 ? Math.round(255 * (d - inner))
          : d > outer - 1 ? Math.round(255 * (outer - d)) : 255;
        cv.set(x, y, cr, cg, cb, a);
      }
    }
  }
}

function fillEllipse(cv, cx, cy, rx, ry, color, alpha = 255, angle = 0) {
  cx = sx(cx);
  cy = sx(cy);
  rx = sx(rx);
  ry = sx(ry);
  const [cr, cg, cb] = color;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const bound = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - bound); y <= Math.ceil(cy + bound); y++) {
    for (let x = Math.floor(cx - bound); x <= Math.ceil(cx + bound); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const d2 = (lx / rx) ** 2 + (ly / ry) ** 2;
      if (d2 <= 1) cv.set(x, y, cr, cg, cb, alpha);
      else if (d2 <= (1 + 1 / Math.min(rx, ry)) ** 2) {
        const edge = Math.sqrt(d2) - 1;
        cv.set(x, y, cr, cg, cb, Math.round(alpha * Math.max(0, 1 - edge * Math.min(rx, ry))));
      }
    }
  }
}

function strokeLine(cv, x0, y0, x1, y1, sw, color, alpha = 255) {
  const steps = Math.ceil(Math.hypot(sx(x1 - x0), sx(y1 - y0)) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(cv, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, sw / 2, color, alpha);
  }
}

function strokeBezier(cv, p0, p1, p2, sw, color, alpha = 255, steps = 100) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
    fillCircle(cv, x, y, sw / 2, color, alpha);
  }
}

function save(cv, filename) {
  const png = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
  png.data = Buffer.from(cv.data);
  fs.writeFileSync(path.join(OUT, filename), PNG.sync.write(png));
  console.log("wrote", filename);
}

function drawSeed() {
  const cv = createCanvas(SIZE);
  const col = hexToRgb("#7c8ca3");
  const bg = hexToRgb("#f4f7fb");
  const dark = hexToRgb("#4a5568");

  fillEllipse(cv, 48, 70, 22, 5, col, 100);
  fillEllipse(cv, 48, 54, 15, 21, dark, 220, 0.18);
  strokeBezier(cv, [44, 36], [46, 54], [44, 72], 1.5, bg, 160);
  fillEllipse(cv, 43, 45, 4, 7, [255, 255, 255], 80, 0.2);
  save(cv, "garden_seed.png");
}

function drawSprout() {
  const cv = createCanvas(SIZE);
  const col = hexToRgb("#d48b19");
  const green = hexToRgb("#5aad4e");
  const dgreen = hexToRgb("#3d8a35");

  fillEllipse(cv, 48, 71, 24, 7, col, 120);
  strokeBezier(cv, [48, 71], [46, 56], [48, 42], 4, dgreen);
  fillEllipse(cv, 34, 54, 12, 6, green, 230, -0.55);
  strokeBezier(cv, [46, 56], [38, 52], [28, 55], 1.5, dgreen, 180);
  fillEllipse(cv, 62, 54, 12, 6, green, 230, 0.55);
  strokeBezier(cv, [46, 56], [54, 52], [68, 55], 1.5, dgreen, 180);
  fillEllipse(cv, 48, 37, 4, 7, green, 210);
  save(cv, "garden_sprout.png");
}

function drawBud() {
  const cv = createCanvas(SIZE);
  const col = hexToRgb("#4A90D9");
  const green = hexToRgb("#5aad4e");
  const dgreen = hexToRgb("#3d8a35");
  const pink = hexToRgb("#e8a0b0");

  fillEllipse(cv, 48, 72, 24, 7, col, 120);
  strokeBezier(cv, [48, 72], [47, 58], [48, 50], 4, dgreen);
  fillEllipse(cv, 37, 61, 10, 5, green, 210, -0.45);
  fillEllipse(cv, 59, 61, 10, 5, green, 210, 0.45);
  fillEllipse(cv, 48, 36, 11, 17, dgreen, 220);
  fillEllipse(cv, 48, 30, 7, 10, pink, 230);
  strokeBezier(cv, [43, 48], [44, 38], [47, 26], 1.5, green, 160);
  strokeBezier(cv, [53, 48], [52, 38], [49, 26], 1.5, green, 160);
  save(cv, "garden_bud.png");
}

function drawBloom() {
  const cv = createCanvas(SIZE);
  const col = hexToRgb("#20a86b");
  const green = hexToRgb("#5aad4e");
  const dgreen = hexToRgb("#3d8a35");
  const petal = hexToRgb("#f9c4d2");
  const dpetal = hexToRgb("#e07090");
  const yellow = hexToRgb("#f5d04a");
  const dyellow = hexToRgb("#c8a020");

  fillEllipse(cv, 48, 74, 24, 6, col, 120);
  strokeBezier(cv, [48, 74], [46, 62], [48, 56], 4, dgreen);
  fillEllipse(cv, 35, 64, 12, 5, green, 220, -0.4);
  fillEllipse(cv, 61, 64, 12, 5, green, 220, 0.4);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const px = 48 + Math.cos(a) * 14;
    const py = 40 + Math.sin(a) * 14;
    fillEllipse(cv, px, py, 8, 12, petal, 240, a);
    strokeLine(cv, 48, 40, px, py, 1, dpetal, 80);
  }

  fillCircle(cv, 48, 40, 11, yellow);
  strokeCircle(cv, 48, 40, 10.5, 2, dyellow);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    fillCircle(cv, 48 + Math.cos(a) * 5, 40 + Math.sin(a) * 5, 1.5, dyellow);
  }

  save(cv, "garden_bloom.png");
}

drawSeed();
drawSprout();
drawBud();
drawBloom();
