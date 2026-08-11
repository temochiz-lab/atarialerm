import { CONFIG, scoreThreshold } from "./config.js";

export class BiteDetector {
  constructor() {
    this.lastCandidateAt = 0;
  }

  score(metrics, trackingHealth, state) {
    if (state !== "TRACKING" || trackingHealth.lost > 0 || trackingHealth.total < 3) {
      return { score: 0, candidate: false };
    }

    const raw =
      metrics.shapeDelta * 5.4 +
      metrics.tipDelta * 2.8 +
      metrics.curvatureEnergy * 0.34 +
      Math.min(metrics.velocity, 2.4) * 0.22;
    const score = Math.max(0, Math.min(1.6, raw));
    const now = performance.now();
    const candidate =
      score >= scoreThreshold(CONFIG.sensitivity) &&
      now - this.lastCandidateAt > CONFIG.biteCooldownMs &&
      trackingHealth.weak <= Math.max(1, Math.floor(trackingHealth.total / 3));

    if (candidate) this.lastCandidateAt = now;
    return { score, candidate };
  }
}
