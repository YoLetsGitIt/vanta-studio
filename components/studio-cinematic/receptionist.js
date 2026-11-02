import projection from './receptionist-projection.json' with { type: 'json' };

// Project the character into the room, behind the actual counter and tablet.
export function createReceptionist(redraw){
  const image=new Image(),sprite=document.createElement('canvas'),layer=document.createElement('canvas');
  sprite.width=543;sprite.height=724;
  const sc=sprite.getContext('2d'),lc=layer.getContext('2d');
  let ready=false,disposed=false;
  image.onload=()=>{
    if(disposed)return;
    sc.filter='brightness(.92) saturate(.78)';
    sc.drawImage(image,-47,0);
    ready=true;redraw();
  };
  image.src='/studio/artist/reception/admin.webp';
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  function triangle(source,target){
    const [[x0,y0],[x1,y1],[x2,y2]]=source,[[u0,v0],[u1,v1],[u2,v2]]=target;
    const d=x0*(y1-y2)+x1*(y2-y0)+x2*(y0-y1);
    const a=(u0*(y1-y2)+u1*(y2-y0)+u2*(y0-y1))/d;
    const b=(v0*(y1-y2)+v1*(y2-y0)+v2*(y0-y1))/d;
    const c=(u0*(x2-x1)+u1*(x0-x2)+u2*(x1-x0))/d;
    const e=(v0*(x2-x1)+v1*(x0-x2)+v2*(x1-x0))/d;
    const cx=(u0+u1+u2)/3,cy=(v0+v1+v2)/3;
    // Slightly overlap the texture triangles to avoid antialiased hairline seams.
    lc.save();lc.beginPath();target.forEach(([x,y],i)=>lc[i?'lineTo':'moveTo'](x+Math.sign(x-cx)*.6,y+Math.sign(y-cy)*.6));lc.closePath();lc.clip();
    lc.setTransform(a,b,c,e,u0-a*x0-c*y0,v0-b*x0-e*y0);lc.drawImage(sprite,0,0);lc.restore();
  }
  return {
    draw(context,frame,variant,width,height){
      const scene=projection[variant],geometry=scene?.frames[frame];
      if(!ready||disposed||!geometry)return;
      if(layer.width!==width||layer.height!==height){layer.width=width;layer.height=height;}
      lc.clearRect(0,0,width,height);
      const scale=Math.max(width/scene.width,height/scene.height),ox=(width-scene.width*scale)/2,oy=(height-scene.height*scale)/2;
      const point=([x,y])=>[ox+x*scale,oy+y*scale];
      const [tl,tr,br,bl]=geometry.quad.map(point);
      for(let n=0;n<8;n++){
        const l=n/8,r=(n+1)/8,topL=mix(tl,tr,l),topR=mix(tl,tr,r),bottomL=mix(bl,br,l),bottomR=mix(bl,br,r);
        triangle([[l*543,0],[r*543,0],[r*543,724]],[topL,topR,bottomR]);
        triangle([[l*543,0],[r*543,724],[l*543,724]],[topL,bottomR,bottomL]);
      }
      lc.globalCompositeOperation='destination-out';
      for(const polygon of geometry.occluders){lc.beginPath();polygon.map(point).forEach(([x,y],i)=>lc[i?'lineTo':'moveTo'](x,y));lc.closePath();lc.fill();}
      lc.globalCompositeOperation='source-over';context.drawImage(layer,0,0);
    },
    dispose(){disposed=true;image.onload=null;image.src='';layer.width=layer.height=sprite.width=sprite.height=1;},
  };
}
