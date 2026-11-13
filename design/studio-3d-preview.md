# Studio walkthrough preview

Open `/design/studio-3d` using the Next dev server (port 3001), or `/design/studio-3d.html` from the static export. This remains a separate preview; the homepage is unchanged.

The visit starts at the door and moves towards the reception tablet. The HTML tablet showing actual Studio screenshots emerges from the tablet's projected screen position, while the room falls out of focus. The camera rests during the story. At the end the card returns towards the tablet, the room comes back into focus and the camera moves into the studio. The physical tablet retains the example's confirmed appointment and signed-consent summary.

Three short moments replace the earlier form-builder tutorial:

1. **Your bookings. Your form.** Current public booking form screenshots show client details and tattoo questions. Copy explains customisation and sharing.
2. **From first enquiry to booked in.** Actual booking detail panels and the Send selection link dialog show enquiry, quote and duration, client suggestions, artist selection and the paid deposit.
3. **Your consent. Kept together.** Actual client record screenshots show the consent link action and completed consent status. Copy explains customisable forms and storage with the client; no builder tutorial is shown.

All actions are illustrative and driven by scrolling, with previous/next controls. No input, real booking, payment, message or API call is made. Scrolling backwards restores earlier states. Reduced-motion mode uses static room viewpoints and no card entrance animation. WebGL failure uses the reception image fallback.

The room is procedural Three.js geometry. The placeholder artist is hidden in the current interior-focused preview. The tablet uses browser captures of the real app with sample API responses. See `public/studio/screenshots/README.md` and `scripts/capture-journey-screens.cjs` for provenance and regeneration. Shared actual form previews remain in `components/forms/FormPreviews.js` for the Studio settings page.

Mobile layouts stack the caption above the card and omit redundant navigation during the demonstration. Short phone and landscape layouts scale the screenshot tablet while keeping navigation buttons at touch size. There are no nested scrolling form panels.

Implementation: `StudioJourney.js`, `BookingStory.js`, `story.js`, `scene.js`, `journey.css`, `process.css` under `components/studio-journey/`.

Checks use Chromium viewport emulation, not physical iPhone performance measurements.

Verified: all nine story beats at 320×568, 390×844, 844×390 and 1440×900, including card bounds, phone caption/navigation spacing, backwards scroll, next navigation and final deposit/consent state. Reduced motion and heading focus passed. The production build passed; its entrance/exit transforms and WebGL-loss fallback were checked with no JavaScript page errors.

## Interior and rendering pass

The current version uses a curved mineral reception counter, neutral plaster walls, fitted walnut cabinetry and rounded upholstery. The primitive artist is hidden for this preview. The tablet position and camera-to-story handoff stay fixed.

Locally hosted 1K color, OpenGL normal and roughness scans replace the uniform architectural surfaces; source and CC0 licensing are recorded in `public/studio/materials/README.md`. Maps total approximately 950KB and have neutral material fallbacks. The flash gallery, foliage and furniture remain local geometry/artwork.

The renderer now uses a prefiltered reflection environment, directional daylight, downward-facing pendant lights, blurred variance shadows, screen-space ambient occlusion and final tone mapping/anti-aliasing. Transparent signs and glass are excluded from the ambient-occlusion depth pass. Shadow maps update for the moving entrance door, then remain cached while the camera moves. Rendering remains demand-driven.

Mobile uses a 1024px shadow map, 12 AO samples and a 1.25 compositor pixel-ratio cap; desktop uses 2048px, 24 samples and a 1.5 cap. The longest compositor dimension is capped at 1800 pixels, with AO at 70% of CSS viewport dimensions. These are quality budgets, not a claim of measured physical-phone frame rate.
