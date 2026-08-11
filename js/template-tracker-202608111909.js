import { CONFIG } from "./config-202608111909.js";

export class TemplateTracker {
  constructor(video) {
    this.video = video;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.scaleX = 1;
    this.scaleY = 1;
    this.guides = [];
    this.lastFrameAt = 0;
  }

  start(guides) {
    this.resizeProcessingCanvas();
    this.drawFrame();
    const frame = this.readGray();
    this.guides = guides.map((guide) => ({
      id: guide.id,
      x: guide.x * this.scaleX,
      y: guide.y * this.scaleY,
      status: "tracked",
      featureCount: 1,
      template: capturePatch(frame, guide.x * this.scaleX, guide.y * this.scaleY, CONFIG.templateSize, this.canvas.width, this.canvas.height)
    }));
    this.lastFrameAt = performance.now();
    return this.currentGuides();
  }

  stop() {
    this.guides = [];
  }

  shouldProcess(now) {
    return now - this.lastFrameAt >= 1000 / CONFIG.targetFPS;
  }

  step(now = performance.now()) {
    if (!this.shouldProcess(now)) {
      return this.currentGuides();
    }

    this.lastFrameAt = now;
    this.drawFrame();
    const frame = this.readGray();

    for (const guide of this.guides) {
      const match = findBestMatch(frame, guide, this.canvas.width, this.canvas.height);
      if (!match) {
        guide.status = "lost";
        guide.featureCount = 0;
        continue;
      }

      guide.x = match.x;
      guide.y = match.y;
      guide.featureCount = Math.round(match.score * 100);
      guide.status = match.score >= CONFIG.templateMinScore ? "tracked" : "weak";

      if (guide.status === "tracked") {
        guide.template = blendPatch(
          guide.template,
          capturePatch(frame, guide.x, guide.y, CONFIG.templateSize, this.canvas.width, this.canvas.height),
          0.12
        );
      }
    }

    return this.currentGuides();
  }

  currentGuides() {
    return this.guides.map((guide) => ({
      id: guide.id,
      x: guide.x / this.scaleX,
      y: guide.y / this.scaleY,
      status: guide.status,
      featureCount: guide.featureCount
    }));
  }

  resizeProcessingCanvas() {
    const width = Math.min(CONFIG.processingWidth, this.video.videoWidth || CONFIG.processingWidth);
    const height = Math.max(1, Math.round(width * (this.video.videoHeight || 9) / (this.video.videoWidth || 16)));
    this.canvas.width = width;
    this.canvas.height = height;
    this.scaleX = width / (this.video.videoWidth || width);
    this.scaleY = height / (this.video.videoHeight || height);
  }

  drawFrame() {
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
  }

  readGray() {
    const data = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    const gray = new Uint8Array(this.canvas.width * this.canvas.height);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    }
    return gray;
  }
}

function findBestMatch(frame, guide, width, height) {
  const size = CONFIG.templateSize;
  const half = Math.floor(size / 2);
  const radius = CONFIG.templateSearchRadius;
  const step = CONFIG.templateSearchStep;
  let best = null;

  for (let y = Math.round(guide.y - radius); y <= guide.y + radius; y += step) {
    if (y - half < 0 || y + half >= height) continue;
    for (let x = Math.round(guide.x - radius); x <= guide.x + radius; x += step) {
      if (x - half < 0 || x + half >= width) continue;
      const score = matchScore(frame, guide.template, x, y, size, width);
      if (!best || score > best.score) best = { x, y, score };
    }
  }

  return best;
}

function matchScore(frame, template, cx, cy, size, width) {
  const half = Math.floor(size / 2);
  let sum = 0;
  let sumSq = 0;

  for (let ty = 0; ty < size; ty += 1) {
    const fy = cy - half + ty;
    for (let tx = 0; tx < size; tx += 1) {
      const fx = cx - half + tx;
      const diff = frame[fy * width + fx] - template[ty * size + tx];
      sum += Math.abs(diff);
      sumSq += diff * diff;
    }
  }

  const meanAbs = sum / (size * size);
  const rms = Math.sqrt(sumSq / (size * size));
  return Math.max(0, 1 - (meanAbs * 0.55 + rms * 0.45) / 96);
}

function capturePatch(frame, cx, cy, size, width, height) {
  const half = Math.floor(size / 2);
  const patch = new Uint8Array(size * size);
  for (let ty = 0; ty < size; ty += 1) {
    const fy = clamp(Math.round(cy) - half + ty, 0, height - 1);
    for (let tx = 0; tx < size; tx += 1) {
      const fx = clamp(Math.round(cx) - half + tx, 0, width - 1);
      patch[ty * size + tx] = frame[fy * width + fx];
    }
  }
  return patch;
}

function blendPatch(a, b, amount) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i += 1) {
    out[i] = a[i] * (1 - amount) + b[i] * amount;
  }
  return out;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
