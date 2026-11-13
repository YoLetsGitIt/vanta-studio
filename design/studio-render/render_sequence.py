"""Render the authored .blend to a device-specific sequence without rebuilding it.
Blender -b design/studio-render/studio.blend --python design/studio-render/render_sequence.py -- portrait
"""
import bpy,sys
from pathlib import Path
variant=sys.argv[sys.argv.index('--')+1]
assert variant in ['portrait','landscape']
scene=bpy.context.scene
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='METAL'
scene.cycles.device='GPU';scene.cycles.samples=96;scene.cycles.adaptive_threshold=.015;scene.cycles.use_denoising=True
scene.render.use_persistent_data=True
scene.render.resolution_x=720 if variant=='portrait' else 1280
scene.render.resolution_y=1100 if variant=='portrait' else 800
scene.render.resolution_percentage=100
scene.camera.data.lens=22 if variant=='portrait' else 25
scene.camera.data.sensor_fit='HORIZONTAL'
folder=Path('/private/tmp/vanta-studio-render')/variant;folder.mkdir(exist_ok=True,parents=True)
for frame in range(121):
 scene.frame_set(frame+1);scene.render.filepath=str(folder/f'{frame:04d}.png');bpy.ops.render.render(write_still=True);print('FRAME_DONE',variant,frame,flush=True)
print('SEQUENCE_COMPLETE',variant,flush=True)
