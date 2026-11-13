# Feature demo recordings

Ten short, silent recordings cover the nine features in `lib/studioFeatureCatalog.js`. Artist management has two clips: profiles/timetables and earnings/payouts. The signup introduction and walkthrough feature dialogs share the same recordings, posters and chapter metadata.

Each recording uses the actual dashboard with fictional data supplied by `scripts/feature-demo-fixtures.cjs`. The capture context intercepts nonlocal requests, including writes. No live account is used. Recording styles isolate and frame the real UI; they do not replace its controls or interaction logic.

## Record

1. Run `npm run build`.
2. Run `python3 scripts/serve-preview.py` (defaults to port 4173).
3. Run `STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/record-feature-demos.cjs`.

Requires Playwright Chromium, ffmpeg and ffprobe. `STUDIO_PLAYWRIGHT_PATH` is optional if Playwright is resolvable normally. `STUDIO_TEST_URL` overrides the local preview origin.

Pass one or more IDs to regenerate selected clips: `forms branding schedule consent clients artists payouts analytics languages migration`. Output is H.264 MP4 (1100 × 800), with fast-start metadata, JPEG posters and JSON chapters in `public/studio/demos`. The recorder also regenerates `lib/studioFeatureDemos.js`. Rebuild after recording so the static export includes the new assets and metadata.

Recordings are approximately 12–14 seconds each. Captions explain three focused moments. They play on request, with native pause, seek and fullscreen controls; chapter buttons jump directly to a moment. Playing a second demo pauses the first. Closing a dialog removes its players. Hidden browser tabs pause playback. The player preserves the full video frame on mobile and desktop.

## Verify

After rebuilding, run:

```
STUDIO_PLAYWRIGHT_PATH=/path/to/playwright node scripts/test-feature-demos.cjs
```

This checks all nine walkthrough dialogs at 1440px and 390px, plus the mobile signup dialogs, including metadata, chapter seeking, playback, horizontal overflow, dismissal and focus restoration. The preview server supports byte-range requests so seeking works locally too.

These are illustrative product demonstrations, not evidence of real appointments, clients or financial results. Existing older signup media remain in place for any other references.
