# Artist app tour

The website uses Matthew’s narrated **18:18** artist app tour, exported on 30 October 2026. It is a 1920 × 1080 landscape H.264/AAC MP4 with captions, 15 chapters and timestamped transition screens. The artist landing page’s splash and final CTA share one fullscreen player, playback position and chapter selector. The studio walkthrough also uses this same video with narration enabled.

## Reviewed source and import

The edit, individual chapters, captions, source recordings and verification results live in `../artifacts/artist-tour-full-production-2026-10-29/`. App views use prepared demonstration data; some handoffs use explanatory graphics. See that project’s README for capture scope.

To import a reviewed export:

```sh
python3 scripts/import-artist-tour.py ../artifacts/artist-tour-full-production-2026-10-29
```

This copies the MP4 and poster into `public/studio/artist/demos/` and generates `lib/artistAppTour.js` with the actual duration and chapter offsets. Change the import script’s media revision when replacing the export so previously cached media refreshes. Build `vanta-website` afterwards: its prebuild sync copies this source catalogue and assets into the website checkout, preventing a later build from restoring the old video.

`prepare-artist-tour.py` is the legacy silent overview generator; do not use it to regenerate the narrated tour. The full edit uses the separate production project’s rendering pipeline.

## Player behavior

The landing page loads the MP4 only when opened. Playback includes Matthew’s voice and burned-in captions; it preserves the full landscape composition with `object-fit: contain`. Viewers can seek with native controls or the chapter selector, pause, resume from either CTA and close the dialog. Closing pauses playback and returns focus to the opener. The page’s chosen theme does not recolour the video.
