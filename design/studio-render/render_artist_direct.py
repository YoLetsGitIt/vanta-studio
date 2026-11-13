"""Artist-only doorway-to-station route, without a reception turn or pause.
Run with studio.blend, then -- landscape|portrait [--preview] [--frames 34,60].
Existing owner, tablet and seated-phone renders are left untouched.
"""
import bpy, sys, json, argparse
from pathlib import Path
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('variant',choices=['landscape','portrait'])
parser.add_argument('--preview',action='store_true')
parser.add_argument('--frames')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
root=Path(__file__).resolve().parents[2]
route=json.loads((root/'components/studio-cinematic/artist-camera-path.json').read_text())
stops=route['stops']
scene=bpy.context.scene
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='METAL';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='METAL'
scene.cycles.device='GPU';scene.cycles.samples=16 if args.preview else 48
scene.cycles.adaptive_threshold=.02;scene.cycles.use_denoising=True
scene.render.use_persistent_data=True
scene.render.resolution_x=720 if args.variant=='portrait' else 1280
scene.render.resolution_y=1100 if args.variant=='portrait' else 800
scene.render.resolution_percentage=50 if args.preview else 100
camera=scene.camera;camera.animation_data_clear()
camera.data.lens=22 if args.variant=='portrait' else 25
camera.data.sensor_fit='HORIZONTAL'

def position(n,k):
    i=next((i for i in range(len(stops)-1) if n<=stops[i+1][0]),len(stops)-2)
    a,b=stops[i],stops[i+1];dt=b[0]-a[0];t=(n-a[0])/dt
    def slope(j):
        if j in (0,len(stops)-1):return Vector((0,0,0))
        return (Vector(stops[j+1][k])-Vector(stops[j-1][k]))/(stops[j+1][0]-stops[j-1][0])
    return (2*t**3-3*t*t+1)*Vector(a[k])+(t**3-2*t*t+t)*dt*slope(i)+(-2*t**3+3*t*t)*Vector(b[k])+(t**3-t*t)*dt*slope(i+1)

folder=Path('/private/tmp/vanta-studio-render')/(args.variant+'-direct-preview' if args.preview else args.variant)
folder.mkdir(parents=True,exist_ok=True)
frames=[int(n) for n in args.frames.split(',')] if args.frames else ([1,24,34,60,86,120] if args.preview else range(1,route['frameCount']+1))
for n in frames:
    scene.frame_set(min(n,route['doorFrames'])+1)
    camera.location=position(n,1)
    camera.rotation_euler=(position(n,2)-camera.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    scene.render.filepath=str(folder/f"{route['firstFrame']+n-1:04d}.png")
    bpy.ops.render.render(write_still=True)
    print('DIRECT_FRAME',args.variant,n,flush=True)
