# Artist entrance and reception admin

The public artist entrance uses a dedicated 120-frame camera path from the door
along the studio aisle to the station. It takes 2.6 seconds, with no reception
turn, greeting, wave or stop. The admin stays behind the counter in a neutral pose.
Reduced motion opens the completed station view immediately; Escape/back can
cancel entry, and extra forward input cannot skip ahead to the phone.

`components/studio-cinematic/artist-camera-path.json` is the shared camera source.
Its entrance look targets stay in the aisle, rather than pointing left at the
reception tablet. It ends at the existing seated camera, preserving the phone tour.

The admin is an original transparent character generated with the built-in image
tool. Only the neutral pose is now used. The browser projects it through the
rendered cameras and masks it behind the physical counter and tablet; it is a
composited character, not a rigged Blender model.

Source: `design/studio-render/receptionist-atlas.png` (original atlas preserved).
Runtime: `public/studio/artist/reception/admin.webp` (neutral cell, quality 90).
The earlier waving atlas is retained as source history and is no longer loaded.

## Reproduction

- Render with Blender 4.5: `blender -b design/studio-render/studio.blend --python design/studio-render/render_artist_direct.py -- landscape` (repeat with `portrait`).
- Encode only the new branch: `node design/studio-render/encode_sequence.cjs --direct-only`.
- Update the door tint: `node design/studio-render/project-door.cjs`.
- Update the character: `node design/studio-render/project-receptionist.cjs`.
- Verify route and player: `node scripts/test-artist-entrance.mjs` and `node scripts/test-frame-player.mjs`.

Frames 321–440 are the new direct route. Original owner and tablet frames remain
unchanged. Frame 440 matches the original artist seated view (296), followed by
phone frames 297–320. The public website receives these through its existing
walkthrough sync during build. Nothing is deployed by these commands.

## Generation prompt (built-in tool, transparent background enabled)

Use case: stylized-concept. Asset type: transparent character animation sprite atlas for a realistic warm architectural 3D tattoo studio walkthrough. Create a SINGLE wide PNG with exactly FOUR equally-sized cells in one horizontal row, transparent background. Same friendly adult female receptionist, late 20s, dark brown hair in a relaxed bun, small hoop earrings, charcoal short sleeve work shirt, subtle blackwork tattoos on forearms. Natural warm medium skin, understated pleasant smile. Render like a high quality Blender Cycles human in soft warm interior daylight from viewer right, neutral subdued exposure, realistic proportions and materials, not cartoon. All four cells show the IDENTICAL person at identical scale, fixed head/torso/hips positions and camera, front view turned just 10 degrees toward viewer right. Show from top of head to mid thigh, complete arms and hands with generous transparent space, no cropping of fingers. Each person centered exactly within their cell. Frame 1: both arms resting down naturally, welcoming neutral expression. Frame 2: right forearm raised, palm facing viewer beside shoulder, fingers naturally separated, elbow bent, greeting. Frame 3: identical raised arm, hand tilted 15 degrees out in wave. Frame 4: identical raised arm, hand tilted 15 degrees inward in wave. Keep head and torso totally consistent between cells for animation. NO desk, NO floor, NO background, NO letters, NO cell borders, NO cast floor shadow. True alpha transparency everywhere outside person.
