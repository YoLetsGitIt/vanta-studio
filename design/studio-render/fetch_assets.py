"""Fetch CC0 production assets from Poly Haven's public API. No runtime requests."""
from pathlib import Path
import json, subprocess, concurrent.futures
ROOT=Path(__file__).resolve().parent/'assets'
ASSETS=['black_walnut_veneer_02','marble_01','potted_plant_02','desk_lamp_arm_01','mid_century_lounge_chair']
def fetch(url,path):
 path.parent.mkdir(parents=True,exist_ok=True)
 if not path.exists(): subprocess.run(['curl','--fail','--location','--silent','--show-error',url,'-o',str(path)],check=True)
for asset in ASSETS:
 root=ROOT/asset
 manifest=root/'manifest.json';fetch('https://api.polyhaven.com/files/'+asset,manifest)
 data=json.loads(manifest.read_text())['blend']['1k']['blend']
 jobs=[(data['url'],root/(asset+'.blend'))]+[(v['url'],root/k) for k,v in data.get('include',{}).items()]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  list(pool.map(lambda job:fetch(*job),jobs))
 print('Downloaded',asset,flush=True)
