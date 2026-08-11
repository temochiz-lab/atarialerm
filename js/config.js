export const CONFIG = {
  processingWidth: 640,
  guideCount: 3,
  targetFPS: 18,
  roiSize: 54,
  templateSize: 34,
  templateSearchRadius: 58,
  templateSearchStep: 3,
  templateMinScore: 0.42,
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
  opencvSources: [
    "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js",
    "https://docs.opencv.org/4.10.0/opencv.js",
    "./vendor/opencv.js"
  ]
};

export function scoreThreshold(sensitivity = CONFIG.sensitivity) {
  return 0.78 - (sensitivity / 100) * 0.62;
}
