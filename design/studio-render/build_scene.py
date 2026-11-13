"""Author a continuous architectural studio scene; render with Blender 4.5 Cycles.
Run: Blender -b --factory-startup --python design/studio-render/build_scene.py -- --preview
All geometry uses metres. Source assets: CC0 Poly Haven, see README.md.
"""
import bpy, math, random, argparse, sys, json
from pathlib import Path
from mathutils import Vector
from math import pi
ROOT=Path(__file__).resolve().parent
APP=ROOT.parents[1]
ASSETS=ROOT/'assets'
OUT=Path('/private/tmp/vanta-studio-render')
OUT.mkdir(exist_ok=True)
args=argparse.ArgumentParser();args.add_argument('--preview',action='store_true');args.add_argument('--frames',default='');args.add_argument('--portrait',action='store_true');args.add_argument('--samples',type=int,default=64)
args=args.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
random.seed(41)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True;scene.cycles.adaptive_threshold=.025
scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=4;scene.cycles.glossy_bounces=4;scene.cycles.transmission_bounces=6
scene.cycles.transparent_max_bounces=8
scene.render.use_persistent_data=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
 prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='METAL'
 scene.cycles.device='GPU'
except Exception as e:print('CPU fallback',e)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.15
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.fps=30
# Values supplied to materials are linear RGB.
def rgba(hex):
 h=hex.lstrip('#');v=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)+(1,)
def mat(name,color,rough=.5,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba(color);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
def scanned(asset,name):
 path=ASSETS/asset/(asset+'.blend');before=set(bpy.data.images)
 with bpy.data.libraries.load(str(path),link=False) as (src,dst): dst.materials=src.materials
 for im in set(bpy.data.images)-before:
  if im.filepath.startswith('//'):im.filepath=str(ASSETS/asset/im.filepath[2:])
 m=dst.materials[0];m.name=name;return m
walnut=scanned('black_walnut_veneer_02','Oiled American walnut')
concrete=mat('Honed concrete','#77736b',.62)
nt=concrete.node_tree;p=nt.nodes.get('Principled BSDF');n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=3;n.inputs['Detail'].default_value=3
ramp=nt.nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=rgba('#68675f');ramp.color_ramp.elements[1].color=rgba('#97948b');nt.links.new(n.outputs['Fac'],ramp.inputs['Fac']);nt.links.new(ramp.outputs[0],p.inputs['Base Color'])
b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.12;b.inputs['Distance'].default_value=.007;nt.links.new(n.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
stone=scanned('marble_01','Honed pale stone')
# Restrained scan relief and a deeper oil finish.
for material in [walnut,stone]:
 nt=material.node_tree
 for node in nt.nodes:
  if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.18
  if node.type=='DISPLACEMENT':node.inputs['Scale'].default_value=0
 if material==walnut:
  p=nt.nodes.get('Principled BSDF');link=p.inputs['Base Color'].links[0];src=link.from_socket;nt.links.remove(link);mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.18,.145,.12,1);nt.links.new(src,mix.inputs[1]);nt.links.new(mix.outputs[0],p.inputs['Base Color'])
  for node in nt.nodes:
   if node.type=='MAPPING':node.inputs['Scale'].default_value=(3,1,1)
# Warm, softly textured limewash rather than a flat shader.
plaster=mat('Warm mineral plaster','#bfb5a3',.87)
nt=plaster.node_tree;p=nt.nodes.get('Principled BSDF');noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=32;noise.inputs['Detail'].default_value=4
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18;bump.inputs['Distance'].default_value=.022;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],p.inputs['Normal'])
black=mat('Powder coated steel','#1e211e',.31,.55);chrome=mat('Brushed surgical steel','#a6aaa7',.25,.92);brass=mat('Aged bronze details','#8c7250',.32,.75)
leather=mat('Charcoal upholstery','#242522',.38)
nt=leather.node_tree;p=nt.nodes.get('Principled BSDF');n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=235;n.inputs['Detail'].default_value=2;b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.18;b.inputs['Distance'].default_value=.003;nt.links.new(n.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs['Normal'],p.inputs['Normal']);p.inputs['Coat Weight'].default_value=.13
thread=mat('Upholstery seam','#42433d',.7);paper=mat('Uncoated ivory paper','#e9dec9',.85);ink=mat('Printed black ink','#343029',.85);rubber=mat('Rubber feet','#121512',.75);ceramic=mat('Ceramic','#958a72',.53);white=mat('Clean linen','#e5e1d4',.86)
glass=mat('Clear entrance glass','#e8eee7',.008);p=glass.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=1;p.inputs['IOR'].default_value=1.46

def finish(o,name,material,bevel=0):
 o.name=name
 if material:o.data.materials.append(material)
 if bevel:
  m=o.modifiers.new('Soft manufactured edges','BEVEL');m.width=bevel;m.segments=4
  m=o.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
 return o

def box(name,loc,size,material,bevel=.008,rot=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if rot:o.rotation_euler=rot
 return finish(o,name,material,bevel)
def cyl(name,loc,radius,depth,material,r2=None,rot=None):
 bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=radius,radius2=radius if r2 is None else r2,depth=depth,location=loc);o=bpy.context.object
 if rot:o.rotation_euler=rot
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,material,.004)
def uvball(name,loc,size,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.scale=size
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,material)
def curve(name,points,material,r=.005,cyclic=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=3
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,co in zip(sp.bezier_points,points):b.co=co;b.handle_left_type=b.handle_right_type='AUTO'
 sp.use_cyclic_u=cyclic;o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);c.materials.append(material);return o
def rod(name,a,b,r,material):
 mid=(Vector(a)+Vector(b))/2;o=cyl(name,mid,r,(Vector(b)-Vector(a)).length,material);o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler();return o
font=Path('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
font=bpy.data.fonts.load(str(font)) if font.exists() else None
def text(name,string,loc,size,material,rot=(pi/2,0,0)):
 c=bpy.data.curves.new(name,'FONT');c.body=string;c.align_x='CENTER';c.size=size;c.extrude=.002;c.bevel_depth=.0007;c.space_character=1.05
 if font:c.font=font
 o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;c.materials.append(material);return o

def import_model(asset,loc,height,rotation=0):
 path=ASSETS/asset/(asset+'.blend');before=set(bpy.data.images)
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):dst.objects=src.objects
 all_objs=[o for o in dst.objects if o]
 for im in set(bpy.data.images)-before:
  if im.filepath.startswith('//'):im.filepath=str(ASSETS/asset/im.filepath[2:])
 for o in all_objs:
  scene.collection.objects.link(o)
  if asset=='desk_lamp_arm_01' and o.type=='MESH' and o.name.startswith('geo_'):
   o.data.materials.clear();o.data.materials.append(black)
  if o.name.startswith('wdg_'):o.hide_render=True
 bpy.context.view_layer.update()
 depsgraph=bpy.context.evaluated_depsgraph_get()
 meshes=[]
 for source in all_objs:
  if source.type!='MESH' or source.name.startswith('wdg_'):continue
  evaluated=source.evaluated_get(depsgraph)
  data=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
  obj=bpy.data.objects.new(source.name+' baked',data);scene.collection.objects.link(obj);obj.matrix_world=source.matrix_world.copy();meshes.append(obj)
 for obj in all_objs:bpy.data.objects.remove(obj,do_unlink=True)
 bpy.context.view_layer.update()
 coords=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 low=Vector(tuple(min(c[i] for c in coords) for i in range(3)));high=Vector(tuple(max(c[i] for c in coords) for i in range(3)))
 pivot=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z));scale=height/(high.z-low.z)
 root=bpy.data.objects.new(asset+' placement',None);scene.collection.objects.link(root)
 for o in meshes:o.location-=pivot;o.parent=root
 root.scale=(scale,)*3;root.location=loc;root.rotation_euler.z=rotation;return root

# An intimate 7m x 11m atelier with a real passage alongside reception.
box('Continuous concrete slab',(0,5.5,-.10),(7.4,13,.2),concrete,.012)
box('Left limewash wall',(-3.6,5.5,1.95),(.22,12,3.9),plaster)
box('Back limewash wall',(0,11.3,1.95),(7.2,.20,3.9),plaster)
box('Ceiling',(0,5.5,4.0),(7.4,12,.18),plaster)
# Right wall is built around the openings; daylight actually enters the room.
box('Window wall dado',(3.6,5.5,.40),(.22,12,.8),plaster)
box('Window wall lintel',(3.6,5.5,3.76),(.22,12,.5),plaster)
for y in [0,3.7,7.4,11.1]:box('Window wall pier',(3.6,y,2.2),(.22,.55,2.85),plaster)
for y in [1.85,5.55,9.25]:
 for yy in [y-1.55,y+1.55]:box('Steel window jamb',(3.56,yy,2.16),(.08,.065,2.75),black)
 for z in [.82,3.5]:box('Steel window head and sill',(3.56,y,z),(.08,3.15,.065),black)
 for yy in [y-.52,y+.52]:box('Steel window mullion',(3.56,yy,2.16),(.07,.038,2.7),black,.004)
 for z in [1.67,2.6]:box('Window transom',(3.56,y,z),(.06,3.12,.037),black,.004)
 box('Stone window ledge',(3.50,y,.80),(.42,3.25,.07),stone,.01)
 # Glass deliberately omitted here: an open daylight portal avoids caustic noise.
for y in [1.8,5.6,9.3]:box('Exposed charcoal beam',(0,y,3.82),(7.1,.12,.19),black,.015)
for x in [-3.45,3.45]:box('Low walnut skirting',(x,5.6,.055),(.045,11.2,.11),walnut,.005)
# Exterior seen through windows is simple neutral courtyard architecture, beyond the camera route.
box('Courtyard opposite wall',(8.4,5.0,2),(0.3,20,4),plaster)
for y in [0,3,6,9,12]:box('Courtyard recess',(8.2,y,2.1),(.08,1.4,2.4),black)

# Door from the original experience, with a physically rotating hinge.
for x,w in [(-2.4,2.4),(2.4,2.4)]:box('Entrance facade',(x,0,1.95),(w,.22,3.9),plaster)
box('Door lintel',(0,0,3.58),(2.4,.22,.64),plaster)
for x in [-1.2,1.2]:box('Door jamb',(x,-.03,1.65),(.075,.13,3.30),black)
box('Door head',(0,-.03,3.31),(2.45,.13,.08),black)
box('Door threshold',(0,0,.015),(2.4,.2,.03),stone)
door=bpy.data.objects.new('Entrance door hinge',None);scene.collection.objects.link(door);door.location=(-1.16,-.025,0)
def door_piece(o):o.parent=door;return o
for x in [.035,2.285]:door_piece(box('Door leaf stile',(x,0,1.64),(.07,.065,3.23),black))
for z in [.055,3.23]:door_piece(box('Door leaf rail',(1.16,0,z),(2.32,.065,.08),black))
door_piece(box('Door glass',(1.16,0,1.645),(2.18,.015,3.09),glass,.002))
for z in [1.12,1.65]:door_piece(rod('Door handle mount',(2.1,-.01,z),(2.1,-.14,z),.017,brass))
door_piece(rod('Solid bronze door pull',(2.1,-.15,1.10),(2.1,-.15,1.67),.022,brass))
door_piece(text('Door wordmark','vanta.',(1.16,-.041,2.08),.32,paper))
door_piece(text('Door submark','S T U D I O',(1.16,-.042,1.94),.048,paper))

# Reception: asymmetrical walnut joinery and a honed stone return.
box('Reception back wall',(-1.85,4.5,1.72),(3.5,.15,3.44),plaster,.012)
box('Reception walnut cabinet',(-1.77,2.95,.57),(2.8,.85,1.08),walnut,.035)
box('Recessed toe kick',(-1.77,2.95,.075),(2.64,.72,.15),black,.012)
box('Stone countertop',(-1.77,2.95,1.135),(2.90,.95,.055),stone,.022)
box('Solid stone end block',(-.28,2.95,.625),(.44,1.0,1.25),stone,.019)
for x in [-2.9,-2.05,-1.2]:box('Joinery panel reveal',(x,2.518,.57),(.009,.006,.92),black,.001)
text('Reception lettering','vanta.',(-1.8,4.409,2.12),.44,black)
text('Reception lettering small','T A T T O O   S T U D I O',(-1.8,4.407,1.99),.043,black)
# Tablet, with a real Studio capture mapped to its screen.
box('Tablet stand foot',(-1.0,2.85,1.178),(.28,.22,.025),black,.012)
rod('Tablet support',(-1,2.91,1.18),(-1,2.96,1.36),.025,black)
tablet=box('Tablet body',(-1,2.96,1.52),(.34,.025,.48),black,.018,rot=(math.radians(-12),0,0))
screenmat=mat('Actual Vanta Studio screen','#ffffff',.35)
p=screenmat.node_tree.nodes.get('Principled BSDF');tex=screenmat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(APP/'public/studio/screenshots/booking-form.png'));screenmat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color']);screenmat.node_tree.links.new(tex.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.3
bpy.ops.mesh.primitive_plane_add(size=1,location=(-1,2.937,1.522),rotation=(pi/2-math.radians(12),0,0));o=bpy.context.object;o.scale=(.308,.45,1);finish(o,'Actual booking form tablet',screenmat)
# A small object cluster provides believable scale without visual clutter.
cyl('Ceramic pencil pot',(-2.65,3.02,1.22),.062,.17,ceramic,r2=.068)
for i in range(4):rod('Reception pencil',(-2.68+i*.018,3.02,1.20),(-2.69+i*.02,3.02,1.39),.0035,walnut)
for i in range(2):box('Portfolio book',(-2.18,2.98,1.18+i*.032),(.33,.25,.026),paper,.003,rot=(0,0,.09-i*.13))
# Open reception seating and plant form a foreground layer.
import_model('mid_century_lounge_chair',(-2.80,1.25,0),.86,rotation=.4)
import_model('potted_plant_02',(-3.08,3.75,0),1.05)

# Sculptural bronze pendants: smooth lathed profiles, not polygon cones.
def pendant(x,y,z,r=.30):
 rod('Pendant cord',(x,y,z+.22),(x,y,3.85),.006,black)
 profile=[(0,.20),(.055,.17),(.09,.08),(.16,.005),(.25,-.06),(r,-.085),(r,-.10),(.25,-.085),(.15,-.025),(.06,.13)]
 verts=[];faces=[]
 for rad,zz in profile:
  for j in range(64):a=j*2*pi/64;verts.append((x+rad*math.cos(a),y+rad*math.sin(a),z+zz))
 for k in range(len(profile)-1):
  for j in range(64):faces.append((k*64+j,k*64+(j+1)%64,(k+1)*64+(j+1)%64,(k+1)*64+j))
 mesh=bpy.data.meshes.new('Spun brass shade');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Spun bronze pendant',mesh);scene.collection.objects.link(o);o.data.materials.append(brass)
 for f in mesh.polygons:f.use_smooth=True
 emit=mat('Warm opal diffuser','#fff1d7',.45);p=emit.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=rgba('#ffe6bc');p.inputs['Emission Strength'].default_value=2
 cyl('Opal diffuser',(x,y,z-.083),r*.84,.012,emit)
 area('Pendant light',(x,y,z-.12),(x,y,0),45,(1,.80,.57),.45)
def area(name,loc,target,power,color,size,size_y=None):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='RECTANGLE';d.size=size;d.size_y=size_y or size
 o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.visible_camera=False;o.visible_glossy=False;o.visible_transmission=False;return o
pendant(-1.7,2.95,2.91,.28);pendant(.2,7.6,3.00,.24)

# Tattoo beds: segmented padded upholstery, visible stitching and hydraulic hardware.
def cushion(name,loc,size,angle=0):
 o=box(name,loc,size,leather,min(size)*.40,rot=(angle,0,0))
 # Stitch piping follows a rounded rectangular inset around the upper surface.
 w,d,h=size;rr=.06;pts=[]
 for cx,cy,start in [(w/2-rr,d/2-rr,0),(-w/2+rr,d/2-rr,pi/2),(-w/2+rr,-d/2+rr,pi),(w/2-rr,-d/2+rr,3*pi/2)]:
  for i in range(5):a=start+i*pi/8;pts.append((cx+rr*math.cos(a),cy+rr*math.sin(a),h/2-.007))
 seam=curve(name+' seam',pts,thread,.0018,True);seam.parent=o
 return o

def chair(x,y,angle):
 before=set(bpy.data.objects)
 box('Hydraulic weighted base',(0,0,.08),(.83,.84,.12),black,.075)
 cyl('Pump housing',(0,0,.24),.17,.24,black);cyl('Polished hydraulic ram',(0,0,.49),.09,.29,chrome);cyl('Seat swivel collar',(0,0,.66),.15,.07,chrome)
 box('Under seat chassis',(0,0,.72),(.54,.6,.06),black,.024)
 cushion('Contoured seat',(0,0,.82),(.70,.67,.16),-.07)
 # Back rises toward rear (+Y); lower section gently falls towards foot.
 cushion('Reclining back',(0,.53,1.06),(.65,.75,.15),.51)
 cushion('Adjustable headrest',(0,.94,1.30),(.40,.28,.135),.51)
 cushion('Leg support',(0,-.63,.69),(.62,.59,.14),.23)
 cushion('Foot support',(0,-1.02,.57),(.59,.20,.12),.25)
 for side in [-1,1]:
  rod('Arm support',(side*.34,.12,.75),(side*.45,.12,1.0),.021,chrome)
  cushion('Adjustable armrest',(side*.45,.05,1.03),(.16,.52,.09),.03)
  cyl('Back hinge',(side*.29,.31,.82),.045,.065,chrome,rot=(0,pi/2,0))
 rod('Back recline piston',(-.19,.15,.70),(-.19,.75,1.06),.022,chrome)
 rod('Foot rail',(-.26,-.35,.66),(-.26,-1.08,.45),.021,chrome)
 rod('Foot rail',(.26,-.35,.66),(.26,-1.08,.45),.021,chrome)
 curve('Hydraulic foot pedal',[(-.18,-.1,.25),(-.25,-.55,.16),(.25,-.55,.16),(.18,-.1,.25)],chrome,.02)
 for xx in [-.19,.19]:cyl('Headrest rod',(xx,.95,1.19),.013,.28,chrome)
 root=bpy.data.objects.new('Tattoo station chair',None);scene.collection.objects.link(root)
 for o in set(bpy.data.objects)-before:
  if o!=root and o.parent is None:o.parent=root
 root.location=(x,y,0);root.rotation_euler.z=angle
 return root
chair(1.55,7.5,-.25);chair(-1.48,9.35,.22)

def trolley(x,y):
 for z in [.25,.78]:
  box('Steel tray',(x,y,z),(.47,.40,.023),chrome,.012)
  for yy in [y-.195,y+.195]:box('Tray lip',(x,yy,z+.025),(.47,.008,.055),chrome,.004)
 for xx in [x-.21,x+.21]:
  for yy in [y-.17,y+.17]:
   rod('Trolley upright',(xx,yy,.08),(xx,yy,.89),.011,chrome)
   cyl('Caster wheel',(xx,yy,.045),.037,.028,rubber,rot=(pi/2,0,0))
 for i in range(4):
  xx=x-.15+i*.085;cyl('Ink bottle',(xx,y,.833),.022,.085,black);cyl('Bottle nozzle',(xx,y,.890),.009,.035,black,r2=.003)
 cyl('Rinse bottle',(x+.12,y+.10,.85),.031,.12,white);rod('Rinse spout',(x+.12,y+.1,.91),(x+.17,y+.1,.95),.005,white)
 box('Folded wipe stack',(x,y-.1,.807),(.16,.11,.028),white,.006)
for pos in [(2.63,7.8),(-2.65,9.7)]:trolley(*pos)
# Use an authored articulated lamp asset at each station, mounted to a weighted stand.
for x,y in [(.65,8.15),(-2.35,10.05)]:
 cyl('Task light weighted foot',(x,y,.035),.21,.06,black);rod('Task light riser',(x,y,.07),(x,y,.9),.018,chrome)
 import_model('desk_lamp_arm_01',(x,y,.88),.64,.45)
# An artist stool with realistic five-star castor base.
for x,y in [(1.2,8.5),(-.6,9.9)]:
 cyl('Artist stool seat',(x,y,.56),.21,.075,leather);cyl('Artist stool stem',(x,y,.33),.025,.4,chrome)
 for i in range(5):
  a=2*pi*i/5;xx=x+math.cos(a)*.25;yy=y+math.sin(a)*.25;rod('Stool star leg',(x,y,.16),(xx,yy,.07),.016,chrome);cyl('Stool castor',(xx,yy,.035),.03,.028,rubber,rot=(pi/2,0,a))
# Storage, sink, towels and another scanned plant.
box('Rear fitted walnut storage',(-1.7,10.94,.46),(2.9,.53,.90),walnut,.016)
box('Stone storage top',(-1.7,10.94,.94),(2.99,.59,.055),stone,.012)
for x in [-2.8,-2.1,-1.4,-.7]:
 box('Cabinet door seam',(x,10.667,.49),(.007,.009,.77),black,.001)
 rod('Cabinet pull',(x+.20,10.64,.75),(x+.40,10.64,.75),.006,brass)
for i in range(3):box('Folded linen',(-2.5,10.9,1.01+i*.045),(.33,.26,.035),white,.012)
import_model('potted_plant_02',(2.98,6.4,0),1.35,1.5)
import_model('potted_plant_02',(-2.95,10.85,.98),.68,.5)

# Generated original ink artwork, UV-framed on physical paper with slim oak mounts.
flashmat=mat('Original ink flash on paper','#ede3ca',.90)
node=flashmat.node_tree.nodes.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(ROOT/'flash-sheet.png'));flashmat.node_tree.links.new(node.outputs['Color'],flashmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
def flash(x,z,w,h,uv):
 y=11.17
 box('Walnut gallery frame',(x,y,z),(w,.046,h),walnut,.008)
 box('Ivory gallery mount',(x,y-.026,z),(w-.027,.012,h-.027),paper,.003)
 bpy.ops.mesh.primitive_plane_add(size=1,location=(x,y-.034,z),rotation=(pi/2,0,0));o=bpy.context.object;o.scale=(w-.09,h-.09,1);finish(o,'Original tattoo flash print',flashmat)
 u0,v0,u1,v1=uv
 for loop in o.data.uv_layers.active.data:loop.uv=(u0+loop.uv.x*(u1-u0),v0+loop.uv.y*(v1-v0))
for x,z,w,h,uv in [(-2.65,2.65,.64,.98,(0,.29,.31,1)),(-1.63,2.55,.87,1.3,(0,0,1,1)),(-.57,2.67,.74,.85,(.58,.54,1,1)),(.60,2.6,.76,1.12,(.27,.25,.59,.68)),(1.75,2.60,.85,1.3,(0,0,1,1)),(2.8,2.6,.67,.89,(.54,.25,1,.54)),(-2.65,1.5,.65,.72,(0,0,.33,.34)),(-.40,1.55,.8,.65,(.33,.67,.80,1)),(.59,1.38,.58,.72,(.31,0,.65,.33)),(2.78,1.43,.61,.7,(.64,0,1,.30))]:flash(x,z,w,h,uv)
# Softer side lighting and genuine bounced daylight. No baked fake shadow blobs.
world=bpy.data.worlds.new('Daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.70,.79,1,1);world.node_tree.nodes['Background'].inputs[1].default_value=.12;scene.world=world
for y in [1.85,5.55,9.25]:area('Broad window daylight',(3.95,y,2.5),(-2,y+1,1),135,(1,.91,.76),2.7,2.8)
d=bpy.data.lights.new('Late afternoon sun','SUN');d.energy=2.0;d.angle=.12;d.color=(1,.86,.66);o=bpy.data.objects.new('Late afternoon sun',d);scene.collection.objects.link(o);o.rotation_euler=Vector((-1,.42,-.85)).to_track_quat('-Z','Y').to_euler()
# Camera keeps the same space and sight lines from start to finish.
bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='Continuous studio visit';scene.camera=camera;camera.data.lens=25;camera.data.sensor_width=36;camera.data.clip_start=.08;camera.data.clip_end=80
# 121 unique frames; frame 58 is the reception pause used for all UI story steps.
# Entrance 0..58, story holds frame 58, workspace 58..120.
STOPS=[(0,(0,-1.60,1.70),(0,3.1,1.65)),(16,(.05,-1.40,1.70),(-.1,3.4,1.65)),(34,(.25,.38,1.68),(-.6,3.4,1.55)),(58,(.30,1.64,1.65),(-.65,3.3,1.56)),(72,(.98,2.5,1.67),(.28,6.5,1.55)),(92,(1.0,4.3,1.70),(.70,8.7,1.42)),(120,(.10,5.1,1.70),(.20,8.8,1.25))]
def interpolated(frame,idx):
 # Hermite interpolation with zero derivatives at the story pause and ends.
 i=next((i for i in range(len(STOPS)-1) if frame<=STOPS[i+1][0]),len(STOPS)-2)
 a,b=STOPS[i],STOPS[i+1];t=max(0,min(1,(frame-a[0])/(b[0]-a[0])));A=Vector(a[idx]);B=Vector(b[idx]);dt=b[0]-a[0]
 def slope(j):
  if j in [0,3,len(STOPS)-1]:return Vector((0,0,0))
  return (Vector(STOPS[j+1][idx])-Vector(STOPS[j-1][idx]))/(STOPS[j+1][0]-STOPS[j-1][0])
 return (2*t**3-3*t*t+1)*A+(t**3-2*t*t+t)*dt*slope(i)+(-2*t**3+3*t*t)*B+(t**3-t*t)*dt*slope(i+1)
def set_frame(f,portrait=False):
 camera.location=interpolated(f,1);target=interpolated(f,2)
 camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
 camera.data.lens=22 if portrait else 25
 camera.data.sensor_fit='HORIZONTAL'
 # Open inward before crossing the threshold; motion reverses cleanly with scroll.
 t=max(0,min(1,f/28));door.rotation_euler.z=math.radians(98)*(t*t*(3-2*t))
 scene.render.resolution_x=720 if portrait else 1280;scene.render.resolution_y=1100 if portrait else 800
 scene.camera.data.dof.use_dof=False
# Save the authored scene and a fully keyed camera/door path for future rendering.
for f in range(121):
 set_frame(f);camera.keyframe_insert(data_path='location',frame=f+1);camera.keyframe_insert(data_path='rotation_euler',frame=f+1);door.keyframe_insert(data_path='rotation_euler',frame=f+1)
scene.frame_start=1;scene.frame_end=121;scene.frame_set(59);set_frame(58)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'studio.blend'))
frames=[0,34,58,120] if args.preview else ([int(x) for x in args.frames.split(',')] if args.frames else list(range(121)))
for f in frames:
 scene.frame_set(f+1);set_frame(f,args.portrait)
 if args.preview:scene.render.resolution_percentage=70
 scene.render.filepath=str(OUT/('portrait' if args.portrait else 'landscape')/f'{f:04d}.png');Path(scene.render.filepath).parent.mkdir(exist_ok=True)
 bpy.ops.render.render(write_still=True)
 print('FRAME_DONE',f,flush=True)
print('RENDER_COMPLETE',flush=True)
