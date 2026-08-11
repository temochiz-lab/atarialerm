export const CONFIG = {
  buildAt: "2026-08-11 19:09 JST",
  processingWidth: 360,
  guideCount: 3,
  targetFPS: 8,
  roiSize: 54,
  templateSize: 24,
  templateSearchRadius: 32,
  templateSearchStep: 6,
  templateMinScore: 0.36,
  maxFeaturesPerGuide: 28,
  minFeaturesPerGuide: 7,
  lkWinSize: 21,
  lkLevels: 3,
  maxFlowError: 34,
  weakDistancePx: 18,
  sensitivity: 58,
  eventPreMs: 4000,
  eventPostMs: 2500,
  biteCooldownMs: 900,
  overlay: {
    boxes: true,
    labels: true,
    polyline: true,
    arrows: false,
    debug: false
  },
  opencvSources: []
};

export function scoreThreshold(sensitivity = CONFIG.sensitivity) {
  return 0.78 - (sensitivity / 100) * 0.62;
}
