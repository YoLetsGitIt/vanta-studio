"""Render a reversible camera push from reception into the actual tablet.

Appends frames 121..152 without changing the existing door/workspace sequence.
Run with the saved studio.blend, passing portrait or landscape after --.
"""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

variant = sys.argv[sys.argv.index('--') + 1]
assert variant in ['portrait', 'landscape']
scene = bpy.context.scene
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type == 'METAL'
scene.cycles.device = 'GPU'
scene.cycles.samples = 96
scene.cycles.adaptive_threshold = .015
scene.cycles.use_denoising = True
scene.render.use_persistent_data = True
scene.render.resolution_x = 720 if variant == 'portrait' else 1280
scene.render.resolution_y = 1100 if variant == 'portrait' else 800
scene.render.resolution_percentage = 100
scene.frame_set(59)
camera = scene.camera
start = camera.location.copy()
start_rotation = camera.rotation_euler.to_quaternion()
camera.animation_data_clear()
tablet = bpy.data.objects['Actual booking form tablet']
center = tablet.location.copy()
normal = tablet.rotation_euler.to_matrix() @ Vector((0, 0, 1))
finish = center + normal * (.48 if variant == 'portrait' else .85)
# Turn toward the tablet early, then keep looking at it while moving closer.
# Interpolating camera rotations directly lets it drift offscreen mid-approach.
start_target = start + (start_rotation @ Vector((0, 0, -1))) * (center-start).length
start_lens = 22 if variant == 'portrait' else 25
end_lens = 35 if variant == 'portrait' else 25
camera.rotation_mode = 'QUATERNION'
camera.data.sensor_fit = 'HORIZONTAL'
folder = Path('/private/tmp/vanta-studio-render') / variant
folder.mkdir(exist_ok=True, parents=True)
for n in range(32):
    t = (n + 1) / 32
    eased = t * t * (3 - 2 * t)
    camera.location = start.lerp(finish, eased)
    turn = min(1, t/.35)
    target = start_target.lerp(center, turn*turn*(3-2*turn))
    camera.rotation_quaternion = (target-camera.location).to_track_quat('-Z', 'Y')
    camera.data.lens = start_lens + (end_lens - start_lens) * eased
    bpy.context.view_layer.update()
    scene.render.filepath = str(folder / f'{121+n:04d}.png')
    bpy.ops.render.render(write_still=True)
    print('TABLET_FRAME', variant, 121+n, flush=True)

# Normalized screen bounds for the HTML screen to pick up the same framing.
corners = [world_to_camera_view(scene, camera, tablet.matrix_world @ Vector(v))
           for v in [(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0)]]
bounds = dict(left=min(v.x for v in corners), top=1-max(v.y for v in corners),
              width=max(v.x for v in corners)-min(v.x for v in corners),
              height=max(v.y for v in corners)-min(v.y for v in corners),
              renderWidth=scene.render.resolution_x, renderHeight=scene.render.resolution_y)
(folder / 'tablet-bounds.json').write_text(json.dumps(bounds, indent=2)+'\n')
print('TABLET_COMPLETE', variant, bounds, flush=True)
