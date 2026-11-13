// Lossy compression only; no generative or semantic changes to rendered imagery.
// Frames without a raw PNG keep their existing WebP, so a single branch can be
// re-rendered and encoded without the rest of the sequence on disk.
const sharp=require('sharp');const fs=require('node:fs/promises');const path=require('node:path');
const direct=require('../../components/studio-cinematic/artist-camera-path.json');
const LAST_FRAME=direct.firstFrame+direct.frameCount-1, RAW='/private/tmp/vanta-studio-render';
const exists=file=>fs.access(file).then(()=>true,()=>false);
(async()=>{
 const root=path.resolve(__dirname,'../../public/studio/walkthrough');const stats={};
 const directOnly=process.argv.includes('--direct-only');
 const requested=process.argv.slice(2).filter(arg=>arg!=='--direct-only');
 const variants=requested.length?requested:['portrait','landscape'];
 for(const variant of variants){
  if(!['portrait','landscape'].includes(variant))throw Error('Unknown render orientation');
  const dir=path.join(root,variant);await fs.mkdir(dir,{recursive:true});let total=0;
  for(let n=0;n<=LAST_FRAME;n++){
   const name=String(n).padStart(4,'0');const out=path.join(dir,name+'.webp');const raw=`${RAW}/${variant}/${name}.png`;
   if((!directOnly||n>=direct.firstFrame)&&await exists(raw))await sharp(raw).webp({quality:86,effort:5}).toFile(out);
   else if(!await exists(out))throw Error(`Missing frame ${variant}/${name}`);
   total+=(await fs.stat(out)).size;
  }
  stats[variant]={frames:LAST_FRAME+1,bytes:total};console.log(variant,stats[variant]);
 }
 const boundsFile=path.resolve(__dirname,'../../components/studio-cinematic/tablet-bounds.json');
 const bounds=JSON.parse(await fs.readFile(boundsFile,'utf8'));
 for(const variant of ['portrait','landscape']){
  const fresh=`${RAW}/${variant}/tablet-bounds.json`;
  if(await exists(fresh))bounds[variant]=JSON.parse(await fs.readFile(fresh,'utf8'));
 }
 await fs.writeFile(boundsFile,JSON.stringify(bounds,null,2)+'\n');
 const manifestFile=path.join(root,'manifest.json');
 const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
 await fs.writeFile(manifestFile,JSON.stringify({version:4,frameCount:LAST_FRAME+1,receptionFrame:58,tabletFrames:[121,152],artistFrames:[153,320],artistDirectFrames:[direct.firstFrame,LAST_FRAME],artistSeatedFrame:296,variants:{...manifest.variants,...stats}},null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1});
