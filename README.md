# atarialerm

Smartphone camera based fishing rod bite detector prototype.

This is a static HTML/CSS/JavaScript app for registering rod line guides by tap, tracking them with OpenCV.js, visualizing the rod curve, detecting bite candidates, and exporting measurement logs as CSV or JSON.

## Run locally

Serve the folder over HTTP, then open the URL in a browser:

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

Open `http://127.0.0.1:8787/index.html`.

Camera access requires a secure context on phones, so deploy to HTTPS, for example Vercel, for real smartphone testing.

## Notes

- Camera frames are processed on-device.
- Video upload and server-side image processing are not used in v0.1.
- Bite thresholds are intentionally user adjustable because real fishing data is still needed.
- `vendor/opencv.js` currently pins the OpenCV.js CDN loader. Replace it with a bundled OpenCV.js build for offline-first use.
