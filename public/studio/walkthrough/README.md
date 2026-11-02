# Rendered studio camera sequence

321 frames per orientation, rendered from a single authored Blender/Cycles scene. The portrait and landscape files share the same studio and door animation; the tablet approach distance, lens/framing and output dimensions adapt to each orientation.

- Portrait: 720×1100.
- Landscape: 1280×800.
- Frame 0: entrance door.
- Frame 58: reception, before approaching the tablet.
- Frame 120: inside the workspace.
- Frames 121–152: camera move from reception to a close-up of the physical tablet. The booking story holds frame 152; leaving reverses the approach before continuing from frame 58 into the studio.
- Frames 153–296: artist branch from reception to the stool at the window station, ending seated and looking across to the other station and flash wall. Played on a timer after choosing “Artist”, at the entrance walk's frames per metre and camera speed, reversed when standing back up.
- Frames 297–320: seated, leaning in and looking down toward the lap. The artist tour's phone (an HTML overlay showing real Vanta app screenshots) is held over these frames.

These are an illustrative fictional studio, not images of a customer location. Product screenshots are provided separately and use sample data.

The player requests the current orientation and a small moving window of frames, rather than requiring both sequences up front. `manifest.json` records encoded byte counts.

Scene source, asset licenses, artwork prompt and reproduction commands: `design/studio-render/README.md` in the repository.
