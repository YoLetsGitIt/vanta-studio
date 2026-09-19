# Studio walkthrough preview

Open `/design/studio-3d` using the Next dev server (port 3001), or `/design/studio-3d.html` from the static export. This remains a separate preview; the homepage is unchanged.

The visit starts at the door and moves towards the reception tablet. The HTML appointment card emerges from the tablet's projected screen position, while the room falls out of focus. The camera rests during the story. At the end the card returns towards the tablet, the room comes back into focus and the camera moves into the studio. The physical tablet retains the example's confirmed appointment and signed-consent summary.

Three short moments replace the earlier form-builder tutorial:

1. **Your bookings. Your form.** A compact enquiry card changes accent colour and reveals a placement field. Copy explains customisable colours and questions, with Instagram and website sharing labels.
2. **From first enquiry to booked in.** The same client card develops through enquiry, artist estimate, client suggestions from artist availability, artist time selection and a paid deposit. Roles are identified; the booking is confirmed only after the deposit moment.
3. **Your consent. Kept together.** A short document illustrates customisable wording and acknowledgements, sending for signature, and storing signed consent with the client record alongside the appointment details. No form builder is shown.

All actions are illustrative and driven by scrolling, with previous/next controls. No input, real booking, payment, message or API call is made. Scrolling backwards restores earlier states. Reduced-motion mode uses static room viewpoints and no card entrance animation. WebGL failure uses the reception image fallback.

The room and artist are procedural Three.js assets; the artist remains a stylised placeholder. The card is an illustrative interface, not the complete Studio dashboard. Shared actual form previews remain in `components/forms/FormPreviews.js` for the Studio settings page.

Mobile layouts stack the caption above the card and omit redundant navigation during the demonstration. Short phone and landscape layouts scale the illustrated card while keeping navigation buttons at touch size. There are no nested scrolling form panels.

Implementation: `StudioJourney.js`, `BookingStory.js`, `story.js`, `scene.js`, `journey.css`, `process.css` under `components/studio-journey/`.

Checks use Chromium viewport emulation, not physical iPhone performance measurements.

Verified: all nine story beats at 320×568, 390×844, 844×390 and 1440×900, including card bounds, phone caption/navigation spacing, backwards scroll, next navigation and final deposit/consent state. Reduced motion and heading focus passed. The production build passed; its entrance/exit transforms and WebGL-loss fallback were checked with no JavaScript page errors.
