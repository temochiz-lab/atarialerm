export class Metrics {
  constructor() {
    this.baseline = null;
    this.previous = null;
  }

  reset() {
    this.baseline = null;
    this.previous = null;
  }

  measure(normalized, time) {
    if (normalized.length < 3) {
      return emptyMetrics();
    }

    if (!this.baseline || this.baseline.length !== normalized.length) {
      this.baseline = normalized.map((guide) => ({ ...guide }));
    }

    const tip = normalized[normalized.length - 1];
    const baseTip = this.baseline[this.baseline.length - 1];
    const tipDelta = Math.hypot(tip.x - baseTip.x, tip.y - baseTip.y);
    const shapeDelta = meanDistance(normalized, this.baseline);
    const angles = segmentAngles(normalized);
    const curvature = angleChanges(angles);
    const curvatureEnergy = curvature.reduce((sum, value) => sum + Math.abs(value), 0) / Math.max(1, curvature.length);

    let velocity = 0;
    if (this.previous) {
      const dt = Math.max(16, time - this.previous.time) / 1000;
      velocity = meanDistance(normalized, this.previous.points) / dt;
    }

    this.previous = {
      time,
      points: normalized.map((guide) => ({ ...guide }))
    };

    return {
      tipDelta,
      shapeDelta,
      curvatureEnergy,
      velocity,
      angles
    };
  }
}

function emptyMetrics() {
  return {
    tipDelta: 0,
    shapeDelta: 0,
    curvatureEnergy: 0,
    velocity: 0,
    angles: []
  };
}

function meanDistance(a, b) {
  const count = Math.min(a.length, b.length);
  if (!count) return 0;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  }
  return total / count;
}

function segmentAngles(points) {
  const angles = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    angles.push(Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x));
  }
  return angles;
}

function angleChanges(angles) {
  const changes = [];
  for (let i = 0; i < angles.length - 1; i += 1) {
    let delta = angles[i + 1] - angles[i];
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    changes.push(delta);
  }
  return changes;
}
