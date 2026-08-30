DEPLOY LINK - https://vval.vercel.app

# Validate local verification prototype

Validate is a hackathon prototype that replaces the previous simulated flow
with browser-side camera analysis. No identity-provider account or API key is
required.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Camera access works on localhost in modern
browsers. The first document scan can take longer while the OCR worker and
language data load.

## Deploy on Vercel

Import the repository with the Next.js framework preset and leave the root
directory empty. No environment variables are required for a demo deployment.
Set `VERIFICATION_SECRET` to a long random value if challenge tokens must remain
valid across separate deployments.

## Checks implemented

- document brightness, glare, and focus heuristics
- local OCR plus passport/ID MRZ check digits
- PDF417, QR, and Data Matrix barcode detection
- document portrait extraction and live face similarity
- single-face, anti-spoof, and liveness model signals
- a server-issued, cryptographically shuffled moving-dot challenge scored
  against head pose

Raw document and camera frames stay in browser memory. The Vercel server issues
a signed, expiring challenge, validates the returned target measurements, and
computes the final status; the browser cannot submit a chosen status or reason
codes. This deployment does not persist identity documents, camera media, or
verification results.

## Security boundary

This is not certified identity verification. Open-source vision heuristics
cannot prove that a government document is genuine or reliably defeat advanced
presentation attacks and deepfakes. The decision now runs on the server, but
its camera measurements originate in the browser and remain tamperable by a
determined attacker. Use a certified verification provider or trained manual
review before making real access, employment, financial, or legal decisions.
