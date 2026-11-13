"""Render the artist branch: from reception, walk to the window station and sit on its stool,
then look down into your lap where the phone is held.

Frames 153..296 are the walk and 297..320 the look down, appended without changing the
door/workspace or tablet sequences. Run with the saved studio.blend, passing portrait or
landscape after --. Add --walk or --look to render one segment only, and --preview to
render a few low-resolution stills for checking the path.
"""
import bpy, sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
variant = args[0]
assert variant in ['portrait', 'landscape']
preview = '--preview' in args
scene = bpy.context.scene
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type == 'METAL'
scene.cycles.device = 'GPU'
scene.cycles.samples = 24 if preview else 96
scene.cycles.adaptive_threshold = .015
scene.cycles.use_denoising = True
scene.render.use_persistent_data = True
scene.render.resolution_x = 720 if variant == 'portrait' else 1280
scene.render.resolution_y = 1100 if variant == 'portrait' else 800
scene.render.resolution_percentage = 40 if preview else 100
scene.frame_set(59)
camera = scene.camera
camera.animation_data_clear()
camera.data.lens = 22 if variant == 'portrait' else 25
camera.data.sensor_fit = 'HORIZONTAL'

# The walk is about 8.2m, two and a half times the entrance walk. 144 frames
# keeps the same frames per metre as the door-to-reception path (~18), so each
# step through the room is the same size.
FIRST, COUNT = 153, 144
LOOK_FIRST, LOOK_COUNT = 297, 24
# (branch frame, eye position, look target). Frame 0 is the reception pause
# (sequence frame 58), so the branch leaves exactly where the choice appears.
# The walk follows the workspace aisle past the far side of the task lamp,
# then steps back onto the stool beside the window station and lowers to a
# seated eye height, looking across the room to the other station and flash wall.
STOPS = [
    (0, (.30, 1.64, 1.65), (-.65, 3.30, 1.56)),
    (36, (.95, 3.60, 1.67), (.50, 7.60, 1.45)),
    (78, (.35, 6.90, 1.67), (-.40, 11.0, 1.35)),
    (114, (.55, 9.00, 1.60), (-1.00, 11.2, 1.30)),
    (144, (1.15, 8.60, 1.20), (-1.30, 11.0, 1.30)),
]
# Seated, lean in slightly and tip the head down toward the lap. The phone
# itself is an HTML overlay, so the room only needs to settle out of focus.
LOOK = [
    (0, (1.15, 8.60, 1.20), (-1.30, 11.0, 1.30)),
    (24, (1.09, 8.66, 1.16), (.36, 9.38, .50)),
]


def interpolated(frame, idx, STOPS=STOPS):
    # Hermite through the stops, at rest at both ends like the main camera path.
    i = next((i for i in range(len(STOPS)-1) if frame <= STOPS[i+1][0]), len(STOPS)-2)
    a, b = STOPS[i], STOPS[i+1]
    t = max(0, min(1, (frame-a[0])/(b[0]-a[0])))
    A, B, dt = Vector(a[idx]), Vector(b[idx]), b[0]-a[0]

    def slope(j):
        if j in [0, len(STOPS)-1]:
            return Vector((0, 0, 0))
        return (Vector(STOPS[j+1][idx])-Vector(STOPS[j-1][idx]))/(STOPS[j+1][0]-STOPS[j-1][0])
    return (2*t**3-3*t*t+1)*A+(t**3-2*t*t+t)*dt*slope(i)+(-2*t**3+3*t*t)*B+(t**3-t*t)*dt*slope(i+1)


folder = Path('/private/tmp/vanta-studio-render') / (variant + ('-preview' if preview else ''))
folder.mkdir(exist_ok=True, parents=True)
segments = []
if '--look' not in args:
    segments.append((STOPS, FIRST, [18, 36, 60, 78, 96, 114, 129, 144] if preview else range(1, COUNT+1)))
if '--walk' not in args:
    segments.append((LOOK, LOOK_FIRST, [8, 16, 24] if preview else range(1, LOOK_COUNT+1)))
for stops, first, frames in segments:
    for n in frames:
        camera.location = interpolated(n, 1, stops)
        camera.rotation_euler = (interpolated(n, 2, stops)-camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        scene.render.filepath = str(folder / f'{first+n-1:04d}.png')
        bpy.ops.render.render(write_still=True)
        print('ARTIST_FRAME', variant, first+n-1, flush=True)
print('ARTIST_COMPLETE', variant, flush=True)
