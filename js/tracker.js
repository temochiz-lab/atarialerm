import { CONFIG } from "./config.js";

export class GuideTracker {
  constructor(video, cv) {
    this.video = video;
    this.cv = cv;
    this.cap = null;
    this.src = null;
    this.gray = null;
    this.prevGray = null;
    this.guides = [];
    this.lastFrameAt = 0;
  }

  start(guides) {
    this.stop();
    const { cv } = this;
    this.cap = new cv.VideoCapture(this.video);
    this.src = new cv.Mat(this.video.videoHeight, this.video.videoWidth, cv.CV_8UC4);
    this.gray = new cv.Mat();
    this.prevGray = new cv.Mat();
    this.cap.read(this.src);
    cv.cvtColor(this.src, this.prevGray, cv.COLOR_RGBA2GRAY);
    this.guides = guides.map((guide) => this.createGuide(guide));
    this.lastFrameAt = performance.now();
    return this.currentGuides();
  }

  stop() {
    for (const guide of this.guides) {
      this.deleteGuideMats(guide);
    }
    this.guides = [];
    for (const mat of [this.src, this.gray, this.prevGray]) {
      if (mat && !mat.isDeleted?.()) mat.delete();
    }
    this.cap = null;
    this.src = null;
    this.gray = null;
    this.prevGray = null;
  }

  shouldProcess(now) {
    return now - this.lastFrameAt >= 1000 / CONFIG.targetFPS;
  }

  step(now = performance.now()) {
    if (!this.cap || !this.shouldProcess(now)) {
      return this.currentGuides();
    }

    const { cv } = this;
    this.lastFrameAt = now;
    this.cap.read(this.src);
    cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);

    for (const guide of this.guides) {
      this.updateGuide(guide);
    }

    const oldPrev = this.prevGray;
    this.prevGray = this.gray;
    this.gray = oldPrev;
    return this.currentGuides();
  }

  currentGuides() {
    return this.guides.map((guide) => ({
      id: guide.id,
      x: guide.x,
      y: guide.y,
      status: guide.status,
      featureCount: guide.featureCount
    }));
  }

  createGuide(guide) {
    const tracked = {
      id: guide.id,
      x: guide.x,
      y: guide.y,
      status: "tracked",
      featureCount: 0,
      points: null,
      lastPoints: null
    };
    this.detectFeatures(tracked, this.prevGray);
    return tracked;
  }

  updateGuide(guide) {
    const { cv } = this;
    if (!guide.points || guide.points.rows < CONFIG.minFeaturesPerGuide) {
      this.detectFeatures(guide, this.prevGray);
    }

    if (!guide.points || guide.points.rows === 0) {
      guide.status = "lost";
      guide.featureCount = 0;
      return;
    }

    const next = new cv.Mat();
    const status = new cv.Mat();
    const err = new cv.Mat();
    const winSize = new cv.Size(CONFIG.lkWinSize, CONFIG.lkWinSize);
    const criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 20, 0.03);

    cv.calcOpticalFlowPyrLK(this.prevGray, this.gray, guide.points, next, status, err, winSize, CONFIG.lkLevels, criteria);

    const displacements = [];
    for (let i = 0; i < status.rows; i += 1) {
      if (status.data[i] !== 1 || err.data32F[i] > CONFIG.maxFlowError) continue;
      const px = guide.points.data32F[i * 2];
      const py = guide.points.data32F[i * 2 + 1];
      const nx = next.data32F[i * 2];
      const ny = next.data32F[i * 2 + 1];
      displacements.push({ dx: nx - px, dy: ny - py, x: nx, y: ny });
    }

    this.deleteGuideMats(guide);
    if (!displacements.length) {
      guide.status = "lost";
      guide.featureCount = 0;
      next.delete();
      status.delete();
      err.delete();
      this.detectFeatures(guide, this.gray);
      return;
    }

    const dx = median(displacements.map((item) => item.dx));
    const dy = median(displacements.map((item) => item.dy));
    guide.x = clamp(guide.x + dx, 0, this.video.videoWidth);
    guide.y = clamp(guide.y + dy, 0, this.video.videoHeight);
    guide.featureCount = displacements.length;
    guide.status = displacements.length < CONFIG.minFeaturesPerGuide ? "weak" : "tracked";
    guide.points = pointsFromArray(cv, displacements.map((item) => [item.x, item.y]));

    next.delete();
    status.delete();
    err.delete();

    if (guide.status === "weak") {
      this.detectFeatures(guide, this.gray, true);
    }
  }

  detectFeatures(guide, gray, supplement = false) {
    const { cv } = this;
    const rect = roiRect(guide.x, guide.y, CONFIG.roiSize, gray.cols, gray.rows);
    if (!rect.width || !rect.height) {
      guide.status = "lost";
      return;
    }

    const roi = gray.roi(rect);
    const corners = new cv.Mat();
    cv.goodFeaturesToTrack(roi, corners, CONFIG.maxFeaturesPerGuide, 0.01, 5);

    const points = [];
    for (let i = 0; i < corners.rows; i += 1) {
      points.push([corners.data32F[i * 2] + rect.x, corners.data32F[i * 2 + 1] + rect.y]);
    }

    corners.delete();
    roi.delete();

    if (!points.length && !supplement) {
      guide.status = "lost";
      guide.featureCount = 0;
      return;
    }

    if (points.length) {
      this.deleteGuideMats(guide);
      guide.points = pointsFromArray(cv, points);
      guide.featureCount = points.length;
      if (guide.status === "lost") guide.status = "recovered";
    }
  }

  deleteGuideMats(guide) {
    if (guide.points && !guide.points.isDeleted?.()) guide.points.delete();
    if (guide.lastPoints && !guide.lastPoints.isDeleted?.()) guide.lastPoints.delete();
    guide.points = null;
    guide.lastPoints = null;
  }
}

function pointsFromArray(cv, points) {
  const mat = new cv.Mat(points.length, 1, cv.CV_32FC2);
  points.forEach((point, index) => {
    mat.data32F[index * 2] = point[0];
    mat.data32F[index * 2 + 1] = point[1];
  });
  return mat;
}

function roiRect(x, y, size, maxWidth, maxHeight) {
  const half = size / 2;
  const left = Math.max(0, Math.round(x - half));
  const top = Math.max(0, Math.round(y - half));
  const right = Math.min(maxWidth, Math.round(x + half));
  const bottom = Math.min(maxHeight, Math.round(y + half));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
