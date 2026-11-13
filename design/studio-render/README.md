# Continuous rendered studio visit

Current artist entrance: a dedicated camera route walks straight from the door
along the aisle to the station, without a reception turn or stop. A neutral admin
remains behind the desk. See [receptionist.md](receptionist.md) for camera rendering,
character projection and reproduction. The owner camera sequence is unchanged.

Preview route: `/design/studio-walkthrough.html` in the static export, or `/design/studio-walkthrough` on the Next dev server. The photographic still concept remains at `/design/studio-cinematic.html`; the live homepage is unchanged.

This is a single authored Blender environment with a keyed camera and rotating entrance door. It does not interpolate between unrelated AI-generated room images. Scroll selects a rendered camera frame, approaches the reception tablet, holds a close-up for the real product UI, then pulls back and resumes along the same aisle into the tattoo workspace. Reverse scrolling reverses the same movement.

## Short booking story

Reception is now a visual passage rather than a second invitation. The repeated heading and button are removed. Step inside follows a single five-second eased journey through the doorway and reception into the tablet preview. The first booking moment’s Previous control returns to the entrance. Manual scrolling and reduced-motion navigation remain available. Production build and Chromium checks passed at 320×568, 390×844, 844×390 and 1440×900 for continuous entry, tablet handoff, previous navigation and horizontal overflow; reduced-motion keyboard entry also passed.

The opening invitation now keeps only “From first hello / to final detail.” in the existing Space Grotesk typeface and a compact “Step inside” control. The entrance control is now an original SVG tattoo-flash cartouche with a pen/needle motif, drawn outline and ink underline. Pressing it spreads an ivory ink stamp through the frame, with contrast that follows the fill. The headline reveal remains. The pen animation runs only twice; reduced-motion preferences or the page’s Motion off control disable these effects. Build and browser checks passed at 320×568, 390×844, 844×390 and 1440×900, including the pressed state, keyboard entry and reduced motion. The extra eyebrow, supporting sentence and scroll hint have been removed. The copy still fades as the door opens. The header stays unmounted until the camera crosses the doorway, and hides again when returning to the entrance. The numbered chapter footer has been removed entirely; the motion toggle lives in the header after entry. This keeps hidden navigation out of the keyboard tab order. Clicking Step inside drives a five-second eased walk through reception into the booking preview. Wheel, touch, navigation keys, resizing and hiding the tab interrupt it; reduced motion enters immediately. Manual scrolling retains direct control.

The door has a 78% smoked-glass tint composited over the glass pane only. `project-door.cjs` exports the pane’s projection using the camera path, lens, hinge and dimensions from `build_scene.py`. The canvas applies the finish to the frame actually displayed, including reverse scrolling and slow frame loads. A matching SVG covers the initial poster before the canvas is ready. This is a browser material treatment; the Blender source and underlying images remain clear glass. Regenerate the projection with `node design/studio-render/project-door.cjs` if the camera or door geometry changes.

The production build and frame-player resource/interaction regressions passed. Chromium checks at 320×568, 390×844, 844×390 and 1440×900 passed for entrance layout, animation, navigation, reverse scrolling and reduced motion. Closed and opening door frames were visually checked on phone and desktop. This remains a local preview.

The cinematic previews now use three moments instead of nine screens: your booking form, enquiry to confirmed booking, and signed consent. Each pairs actual Studio captures with a scroll-driven reveal and a highlight on the relevant field or status. The booking copy keeps the artist's review and time selection explicit before the client pays the deposit. Form customisation is communicated through configurable questions and required details, without adding invented colour controls or a full builder demonstration.

`components/studio-cinematic/booking-story.js` maps the shorter scroll distance onto the existing camera timeline. The track is now 600svh; each product moment occupies approximately 60svh before the tablet handoff reverses into the studio. Entrance and exit movement retain approximately their previous scroll distances. The old Three.js preview keeps its independent story. Reduced motion shows each completed state directly; chapter navigation, reverse scrolling and the feature explorer remain available.

Production build passed. Chromium checks passed at 320×568, 390×844, 844×390 and 1440×900: three reveals in both scroll directions, tablet camera hold, next-moment navigation, room arrival, feature panel access, replay, reduced motion and heading focus. No runtime errors, missing assets or horizontal overflow were found. Phone and desktop layouts were visually reviewed. This change is available in the local preview and has not been deployed.

## Art direction and current limits

The approved photographic concept is the reference for warm plaster, walnut, stone, black upholstery, daylight, flash artwork and an intimate reception area. The actual room is newly authored geometry: the generated photo has not been converted into an exact 3D replica. This is the first rendered walkthrough version, not a claim of matching every detail or the photographic fidelity of that reference.

The camera route is guided. Buttons, booking sections, replay and reverse scrolling remain interactive; visitors cannot freely steer the camera or manipulate the furniture. Booking screenshots use sample data and create no real appointments or payments. The public artist entrance includes a stationary admin composited behind the reception counter.

## Source and reproduction

- `build_scene.py`: architecture, furnishing placement, upholstery/hardware, physical lights and continuous camera/door animation.
- `studio.blend`: locally saved editable scene (ignored by Git; regenerate from the source script).
- `fetch_assets.py`: downloads the source material scans and furnishing models to the ignored `assets/` directory.
- `render_sequence.py`: renders 121 frames per orientation from the saved scene, using Cycles/Metal, 96 samples, adaptive sampling and denoising.
- `render_tablet.py`: appends a 32-frame camera push from reception into the physical tablet, with separate portrait/landscape framing. Exports projected screen bounds so the HTML screenshot aligns with the rendered screen before moving to its reading position.
- `render_artist.py`: appends the artist branch. Frames 153–296 (144, the same frames per metre as the entrance walk) walk from reception down the aisle, past the task lamp, then back and down onto the window station's stool, looking across to the other station and flash wall. Frames 297–320 lean in and look down toward the lap, where the walkthrough holds an HTML phone. `--walk` or `--look` renders one segment; `--preview` renders a few low-resolution stills for checking the path.
- `encode_sequence.cjs`: encodes those renders as WebP at quality 86. Only format compression is performed. Frames without a raw PNG keep their existing WebP, so one branch can be re-rendered on its own.
- `flash-sheet.png`: generated original artwork texture used on the framed paper objects.

Commands, from the app directory, using Blender 4.5 LTS:

```sh
python3 design/studio-render/fetch_assets.py
blender -b --factory-startup --python design/studio-render/build_scene.py -- --preview
blender -b design/studio-render/studio.blend --python design/studio-render/render_sequence.py -- landscape
blender -b design/studio-render/studio.blend --python design/studio-render/render_sequence.py -- portrait
blender -b design/studio-render/studio.blend --python design/studio-render/render_tablet.py -- landscape
blender -b design/studio-render/studio.blend --python design/studio-render/render_tablet.py -- portrait
blender -b design/studio-render/studio.blend --python design/studio-render/render_artist.py -- landscape
blender -b design/studio-render/studio.blend --python design/studio-render/render_artist.py -- portrait
node design/studio-render/encode_sequence.cjs
npm run build
```

The renderer used here is the official Blender 4.5.14 Apple Silicon distribution, temporarily mounted under `/private/tmp/vanta-blender-mount`, not installed into Applications. Rendering scripts target this Mac's Metal GPU. Raw PNGs go to `/private/tmp/vanta-studio-render`; encoded web assets go to `public/studio/walkthrough/`. The source scene and full-resolution render files are not shipped to browsers.

Official rendering reference: https://docs.blender.org/manual/en/4.5/advanced/command_line/render.html

## Mobile delivery

- Portrait is rendered separately at 720×1100; landscape is 1280×800. The browser requests its matching orientation, rather than downloading both sequences.
- Only the current frame, nearby frames and four chapter stills are requested. There is no mandatory full-sequence download before interacting.
- At most three requests run concurrently and 20 decoded frames are retained; discarded bitmaps are explicitly closed.
- The camera reaches reception at frame 58, approaches the tablet through frames 121–152, and holds frame 152 while booking details are shown. The approach reverses before continuing through frames 58–120 into the workspace.
- The HTML screen crossfades over the projected tablet screen, then moves into the responsive reading layout. The heading and controls fade in after that handoff; invisible controls remain inert until ready.
- Reduced motion selects static chapter views. The real screenshot story and chapter controls stay available.
- A poster remains if the canvas or frame loading is unavailable. Individual failed frames can use a nearby loaded frame; reconnecting retries failed requests.
- The existing mobile, short-phone and landscape product layouts are retained.

Physical iPhone performance has not been measured; browser viewport emulation and browser-engine checks are recorded after validation below.

## Validation — 26 September 2026

- Production build and static export passed with both complete 121-frame sequences. Encoded landscape assets total 5,542,152 bytes; portrait assets total 3,245,732 bytes.
- `node scripts/test-frame-player.mjs` passed: scroll mapping, bounded fetching/cache, reversal, orientation changes, reconnect recovery, hidden-page suspension and cleanup.
- Chromium checked at 390×844, 320×568, 1440×900 and 844×390; WebKit checked at 390×844. All story beats, forward/reverse movement and orientation changes passed without runtime errors or missing assets.
- Both engines passed reduced-motion navigation, focus transfer, replay and frame-fetch failure fallback checks. Mobile entrance, reception, booking and workspace screenshots were visually reviewed.
- This remains a local preview; no production deployment was performed.

### Tablet transition refinement

Added 32 approach frames per orientation. The camera turns toward the tablet early, keeps its screen in view while moving closer, and pauses before the HTML handoff. The interface aligns with exported screen projection bounds, crossfades in place, then moves into its reading layout. The room fades away before the screen moves far enough to expose a duplicate beneath it.

The complete 153-frame sets total 3,978,884 bytes for portrait and 6,565,414 bytes for landscape. Only nearby frames and chapter anchors load as needed.

The production build, frame-player regressions and Chromium/WebKit browser checks passed after the transition change, including 320px phones, landscape orientation, reverse scrolling, reduced motion, focus and missing-frame fallback. Intermediate handoff screenshots were reviewed at mobile and desktop sizes.

### Studio feature explorer — 28 September 2026

The room arrival now ends with “You focus on the art. We’ll take care of the details.” Six feature cards follow in normal page scroll: schedule/stations, artist management, client records, booking forms, consent forms, and finances/reporting. Details open in a modal with actual app screenshots and concise capability descriptions; mobile uses a full-screen panel. Trial signup appears after the grid and in each detail panel.

New dashboard screenshots use local sample responses only; reproduce with `scripts/capture-feature-screens.cjs`. Details load their images on opening. Modal scrolling leaves the walkthrough position intact, Escape/back restore focus to the selected card, and keyboard focus cycles inside the panel.

Production build passed. Chromium checks passed at 320×568, 390×844, 844×390 and 1440×900 for all six panels, responsive screenshots, screenshot switching, focus containment/restoration, closing and replay. Reduced-motion navigation passed; no missing assets, runtime errors or horizontal overflow were found. Arrival, grid and detail layouts were visually reviewed. This update remains in the local preview, not deployed.

## Asset provenance

Poly Haven's assets are CC0: https://polyhaven.com/license

- Black Walnut Veneer 02: https://polyhaven.com/a/black_walnut_veneer_02
- Marble 01: https://polyhaven.com/a/marble_01
- Potted Plant 02: https://polyhaven.com/a/potted_plant_02
- Desk Lamp Arm 01: https://polyhaven.com/a/desk_lamp_arm_01
- Mid Century Lounge Chair: https://polyhaven.com/a/mid_century_lounge_chair

Concrete Floor 02 was evaluated locally but replaced by a restrained procedural floor material. The architecture, furniture assembly, tattoo beds, small equipment, typography and camera path were authored for this preview. No third-party studio photographs or paid models are shipped.

Vanta product captures: `public/studio/screenshots/README.md`.

## Generated flash artwork

Created using the built-in imagegen tool on 26 September 2026. Original retained at `/Users/matthewkwon/.codex/generated_images/01a0a05e-68f4-7d60-b33d-e5842d9c01d6/exec-904687b9-16f4-4b7c-8ed7-b41aa886f8e2.png`; project copy: `design/studio-render/flash-sheet.png`. The same image is UV-mapped to framed paper in the scene.

Exact prompt:

> Use case: texture asset for a 3D tattoo studio wall. Generate a single flat scanned tattoo flash sheet, portrait 2:3 ratio, no perspective, no frame, no room. Warm uncoated antique ivory paper with subtle grain. Exquisite original black ink traditional and fine-line tattoo flash artwork, a curated composition of 9 distinct designs: a large ornate dagger with a ribbon, elegant flying swallow, peony bloom with delicate leaves, coiled snake, symmetrical moth, small sacred heart, botanical sprig, ornamental star and a tiny crescent. Drawn with authentic hand-inked outlines and beautiful dense stippled engraving shading, professional tattoo artist portfolio quality, carefully balanced natural empty space between drawings. Black and ivory only, no color, no text, no letters, no logos, no watermark. The entire artwork must be visible with clean blank ivory margins at every edge. This will be printed on paper in a photorealistic rendered studio.

### Studio arrival polish

The walk and final studio view share one Space Grotesk heading: “You focus on the art. We’ll handle the rest.” The first line appears during the walk; the second reveals as the camera settles. Copy sits below the room’s focal area, with no numbered eyebrow or extra paragraph. An understated link leads to the feature explorer. The explorer now follows the scene in document flow instead of overlapping it with a negative margin. Production build and Chromium checks passed at 320×568, 390×844, 844×390 and 1440×900, including layout, feature navigation and reduced-motion keyboard navigation.

### Booking story design polish

All three moments use Space Grotesk headings and a compact segmented navigation above the copy. The numbered desk label and repeated result caption are removed. A slimmer tablet rim frames the existing product captures; navigation below uses a back control, quiet scroll hint and labelled Next / Enter studio action. Consent copy reads “Signed. Saved with the client.” The scroll-controlled screenshots and camera handoff remain intact. Build and Chromium layout/navigation checks passed at 320×568, 390×844, 844×390 and 1440×900; reduced-motion keyboard navigation passed.

### Larger product previews

The reading frame now fills the available width rather than using a fixed portrait aspect ratio. On phones, compact inline headings and reduced spacing give most of the viewport to the actual UI. Desktop allocates more width to the product column. Captures use cover positioning to frame the relevant form, deposit or consent area without distortion. An opaque scroll-driven wipe replaces overlapping transparent screenshots, and the synthetic highlight box is removed. Build and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900 for screen bounds and navigation, plus reduced-motion keyboard navigation.

### Continuous form scroll

The form moment uses one full-page capture of the real booking route with intercepted sample API responses (`capture-journey-screens.cjs --full-form-only`, 920×2934). Page progress .285–.425 translates the image from top to bottom using the current frame dimensions; reverse scrolling reverses it. The frame remains large and the page is the only scroll container. A slim progress thumb indicates position. The before/after wipe remains only for booking confirmation and consent. Build and Chromium tests passed at 320×568, 390×844, 713×766, 844×390 and 1440×900: start/mid/end image position, bottom alignment, reverse scroll, navigation back to form, and reduced motion.

### Short form preview and complete detail screens

The form now starts at the custom tattoo questions and moves at most 45% of the frame height. Its page-scroll allocation is halved from 60vh to 30vh. The total track is 570svh; the progress mapping preserves the entrance, booking, consent and studio travel distances. Booking and consent use contained screenshots with portrait framing, so the appointment/payment and client/consent details remain visible without close-up cropping. Production build, diff checks and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900, covering the shorter travel, reverse scroll, full screenshots, navigation and reduced motion.

### Stable story panels

The booking story now uses one fixed frame (up to 560px wide) for all three moments and reserves heading/description space to prevent resizing while scrolling. The phase follows the same eased progress as the camera. The form retains its short scroll; booking and consent display one complete final-state screenshot each. Panels stay mounted and fade through the solid frame background, with no screen wipe or overlapping interface text. Reduced motion switches directly. Build and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900 for stable frame bounds through forward/reverse boundaries, at most one visible screen, navigation and reduced motion.

The short form preview now begins at offset zero, showing the studio name and client details during the tablet handoff and on return navigation. It keeps the same 30vh travel allocation and maximum 45% frame-height scroll. Build and focused Chromium entry/reverse/navigation checks passed on mobile, desktop and reduced motion.

### Customisation overview

The form moment now presents an at-a-glance HTML illustration instead of an exact product screenshot or scrolling form. It explains website colours, configurable tattoo fields and required/optional choices, reference photos, and sharing by link, website or QR code. These capabilities were checked against the existing booking widget settings. Booking/consent panels retain their complete screenshots. The overview has no fake form inputs or buttons and adapts to frame size. Build and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900 for full content visibility and onward navigation.

### Booking and consent overviews

Booking and consent now use the same concise HTML overview treatment as the custom form. Booking compresses the accurate workflow into enquiry/artist estimate, client availability/artist selection, and deposit confirmation. Consent explains custom wording/questions, sharing for online signature, and keeping signed consent with the client record. The three panels retain the steady frame and non-overlapping fades; screenshot loading has been removed from this story. Build and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900 for content fit and onward navigation, plus reduced motion.

### Detailed overview illustrations

The overview panels now show concrete examples in the existing warm palette: a branded form with required/optional questions and botanical reference sketches; a reviewed enquiry with quote/duration, client-suggested times and artist selection, then a paid deposit; and a signed consent document connected to a client record. These are concise illustrations rather than the full app UI. Shared code-native SVG artwork and container-responsive styling keep detail readable without introducing new scroll regions. Production build and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900, including reduced motion and onward navigation.

### Simplified Vanta Studio UI

The three overview panels now follow the actual app’s Settings, BookingDetailPanel and client detail styling. They use the app’s dark theme tokens and shared Pill component, with condensed colour/field settings, appointment and deposit cards, and a consent card linked to the client. Only essential example information is shown, with no editable controls or nested scrolling. The existing short story timing and stable frame are retained.

Production build and Chromium checks passed at 320×568, 390×844, 713×766, 844×390 and 1440×900, including reduced motion, content fit and onward navigation.

### Tablet-to-studio transition

The tablet recedes with a slight perspective tilt, then the backdrop clears into a widening cinematic view of the existing camera walk. The backdrop remains opaque until the UI has faded, avoiding overlapping interface text with the baked tablet screen. The arrival headline reveals through two staggered line masks; a fine-line stroke and the feature link follow. Enter studio and See the studio now use a 3.8-second cancellable journey. The scroll track length is unchanged, reverse scroll reverses the effects, and reduced motion skips the travel and masks.

Production build and browser checks passed at 390×844, 1440×900 and 844×390, plus reduced motion at 320×568. Checked timed entry, reverse scrolling back to consent, headline/link visibility, feature navigation and browser errors.

### Features open over the studio

The arrival now pairs a quieter secondary headline with one pill-shaped feature-grid button. The decorative arrow is removed. Features open in a full-screen modal over the softly blurred room, with staggered card entrances, instead of scrolling to a section below the walkthrough. The page stays at its current position, Back to studio restores the opener’s focus, and feature detail dialogs close independently with Escape. Reduced motion disables the reveal animations.

Production build and browser checks passed at 390×844, 320×568, 1440×900 and 844×390, plus reduced motion. Verified all six cards and their detail dialogs, no background scroll jump, Escape handling, focus restoration and both feature entry buttons.

### Scroll into the features

The feature collection is now part of the pinned studio scene rather than a modal. After the existing walkthrough ends, 90vh of page travel fades the arrival copy out, softens the room and progressively reveals the six feature cards. Reverse scrolling reverses the reveal. The feature button follows the same scroll transition. Short screens add only enough page travel to reach the collection footer, without a nested scroll region. Earlier camera and booking timings use the original scene distance and remain unchanged. Feature detail dialogs remain available once the reveal finishes.

Build and browser checks passed on 390×844, 1440×900, 320×568 and 844×390, plus reduced motion: partial fade, reverse scroll, detail dialogs, button navigation and footer reachability.

### Existing feature catalogue as the source

The walkthrough now uses all nine entries from the signup introduction: Booking form & widget, Widget branding, Station scheduling, Consent builder, Client records, Artist management, Analytics, Multi-language, and Migration import. Their original descriptions, detailed copy and signup demo assets are shared in lib/studioFeatureCatalog.js. SignUpFlow keeps its existing illustrations and grouped tabs while consuming that same catalogue. The walkthrough adapter only adds presentation fields; it no longer maintains a separate six-feature list. Detail views support the existing videos and images, with text-only layouts for entries without media. Card reveal timing now derives from the catalogue length.

Production build and browser checks passed at 390×844, 320×568 and 1440×900. Verified all nine card titles/descriptions, detailed copy, media assets, keyboard focus restoration, navigation fading, and the unchanged signup grouping.

### Interactive flash-wall concept

The feature reveal now pushes the rendered room toward its artwork and brings in nine labelled, framed flash prints. The gallery uses the exact original flash sheet from the Blender room, encoded once as a 440 KB WebP and framed with SVG view boxes and clipping paths. No new room renders or separate per-print raster downloads are required. Each print keeps its canonical feature name and opens the existing shared catalogue description and demos, with a small forward animation and matching artwork in the detail view. Desktop uses three columns, mobile uses two, and the page scroll still reaches every print and the trial link. Reverse scroll restores the room; reduced motion disables the zoom, print travel and detail animation.

Production build and catalogue checks passed at 390×844, 320×568 and 1440×900 for all nine feature titles, descriptions, media and focus restoration. Scroll transition, footer reachability, navigation and reduced motion checks passed on those viewports plus 844×390. The signup feature list is unchanged.

### Flash-wall handoff polish

The first row now lifts from the actual framed artwork in rendered frame 120,
using the authored camera projection and the viewport's cover crop. Two prints
lift on mobile and three on desktop; the remaining prints fade into place to
avoid a tangle of crossing paths. The moving art retains its aspect ratio and
dissolves into the crisp feature prints, followed by their labels. The room push
is reduced to 12%, and the button plays the reversible scroll transition over
1.7 seconds. Wheel, touch, keyboard and resize still interrupt that movement.
Reduced motion shows the collection without travelling artwork.

`flash-wall-motion.js` holds the projection and layout calculations;
`WallPrint.js` reuses the cached room frame for the moving prints. No additional
rendered sequence or image assets are required. Verified desktop, portrait and
landscape mobile, reverse scrolling, feature details, footer reachability and
reduced motion. Local preview: `/design/studio-walkthrough.html?v=flash-lift-25`.

### Animate the entire flash wall

All ten physical wall frames now participate on mobile and desktop. The repeated
full flash sheet joins its other copy in one feature card, preserving the nine
canonical product features. Lower destination rows move first; prints find their
columns before settling vertically, with proportionate artwork and delayed labels.
The scroll distance and reduced-motion fallback are unchanged. Browser checks
cover movement of every frame, preserved proportions, reversible positions, all
nine final cards, dialogs, footer access and reduced motion. Preview version:
`/design/studio-walkthrough.html?v=all-flash-26`.

### Feature cards after the wall animation

The full-wall lift now lands in compact feature cards rather than oversized art
prints. Every card shows the canonical feature title, category, description and
a details/demo affordance. The flash becomes a small framed accent. Layouts use
one column below 600px, two below 1080px, and three on larger screens. The flying
art targets the thumbnail's actual position and width inside the padded card;
all ten physical prints still participate, with no extra scroll distance.

Preview: `/design/studio-walkthrough.html?v=feature-cards-27`.

Feature-card verification passed at 320px, 390px and 1440px: all nine titles,
visible descriptions, detail dialogs, demo assets and restored focus. Scroll
checks also passed at 844x390 and with reduced motion. The pinned stage uses
`overflow: clip` so browser focus cannot scroll it independently of the main
walkthrough; keyboard navigation stays at or beyond the feature reveal boundary.

### Quicker feature reveal

The wall-to-features reveal now occupies 32svh instead of 90svh (about 65% less
scrolling). The button animates over 850ms instead of 1700ms. Reveal progress,
track length, content scrolling, button destination and keyboard focus boundary
share the same distance constant. All ten prints still animate. Preview:
`/design/studio-walkthrough.html?v=quick-features-28`.

### Show features during the artwork handoff

Card surfaces, descriptions and the heading now reveal independently of the
artwork crossfade. All text is fully visible before 50% of the reveal, and the
collection becomes interactive at 52%. Prints settle into their thumbnails by
that point, keeping moving artwork out of the descriptions. This removes the
late, mostly empty interval shown in the previous preview. Reduced motion still
reveals the complete collection at once. Preview: `?v=early-features-29`.

### Softer flash settling

Extended just the artwork's travel window from .36 to .48 of the reveal and
lengthened its final crossfade. The scroll distance, button duration, early
feature text and interaction timing stay unchanged. Preview: `?v=soft-settle-30`.

### Full walkthrough pacing review

The camera journey now spans 370vh instead of 470vh: 120vh to enter and reach
the tablet, approximately 55vh for each of the three overview panels, and 85vh
to leave the desk and enter the studio. The form has more reading space while
the long travel sections are shorter. Track height and navigation use the same
shared timeline constants in `booking-story.js`.

Button travel is consistent and cancellable: 3400ms to enter, 650ms between
overview panels, 2200ms into the studio, and 850ms for the feature reveal or
return. Wheel, touch, navigation keys, resize and page hiding cancel travel;
switching to reduced motion completes the destination immediately. Chapter
headings receive focus after travel finishes.

Overview changes now have a short 280ms entrance rather than a scroll-dependent
fade through an empty screen. Stopping at a chapter boundary leaves a readable
panel. The existing 32vh feature reveal and softer, full-wall flash settling
are preserved, with descriptions appearing before the artwork finishes.

Preview: `/design/studio-walkthrough.html?v=journey-pace-31`.

Verification: production build and frame-player tests passed. Browser checks
passed at 320×568, 390×844, 844×390 and 1440×900, plus reduced motion: forward
and reverse scrolling, readable chapter boundaries, cancelled travel, chapter
focus, feature reveal/return, detail dialogs and footer access.

### Fast-scroll handling

The camera, chapter copy and flash reveal now use one visual scroll position.
Normal gestures have a bounded catch-up (at most 64px and 140ms after input
stops). Fast gestures and large jumps immediately adopt the native destination,
without replaying skipped chapter entrance animations. Button travel supplies its
own easing; it is no longer smoothed twice. Reading the feature list remains
native, with no wheel interception, mandatory stops or additional scroll length.

The frame player prioritises chapter stills and cancels obsolete requests when
the target changes. A destination frame gets a download slot even if slow
preloads are in flight. Aborted or late decodes are released safely.

This follows the short-scrub and fast-completion patterns described in
[GSAP ScrollTrigger's documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/),
implemented in the existing controller without adding a dependency. Thresholds
are tuned for this walkthrough rather than presented as a universal standard.

Preview: `/design/studio-walkthrough.html?v=fast-scroll-32`.
