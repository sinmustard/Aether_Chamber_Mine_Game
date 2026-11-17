"use strict";
const PIXI_SRC='https://cdn.jsdelivr.net/npm/pixi.js@8.14.3/dist/pixi.min.js';
const GL={ph:0,pc:null,sc:null,pp:[],pn:0,bgr:new Map(),on:0,ready:0,fail:0,busy:0,r:null,st:null,pool:[],n:0,tx:{},img:new WeakMap(),fr:new WeakMap(),col:new Map(),cvG:null,cxG:null,cvP:null,sx:0,sy:0};
const ctxTop=ctx;
function glLayer(id){
  const c=document.createElement('canvas'); c.id=id;
  c.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;display:none';
  gcv.parentNode.insertBefore(c,gcv); return c;
}
function glCanvasTex(w,h,draw,mip){
  const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  return new PIXI.Texture({source:new PIXI.CanvasSource({resource:c,autoGenerateMipmaps:!!mip})});
}
async function glInit(){
  if(GL.ready||GL.fail||GL.busy) return; GL.busy=1;
  try{
    if(!window.PIXI) await new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=PIXI_SRC; s.onload=ok; s.onerror=no; document.head.appendChild(s); });
    GL.cvG=glLayer('gamecvG'); GL.cxG=GL.cvG.getContext('2d'); GL.cvP=glLayer('gamecvP');
    GL.r=await PIXI.autoDetectRenderer({preference:'webgl',canvas:GL.cvP,width:Math.max(1,gcv.width),height:Math.max(1,gcv.height),backgroundAlpha:0,antialias:true,resolution:1,autoDensity:false});
    GL.st=new PIXI.Container(); GL.sc=new PIXI.Container(); GL.st.addChild(GL.sc);
    const at=glCanvasTex(256,64,x=>{ x.fillStyle='#fff';
      x.beginPath(); x.arc(32,32,31.5,0,TAU); x.fill();
      x.beginPath(); x.moveTo(128,0.5); x.lineTo(159.5,32); x.lineTo(128,63.5); x.lineTo(96.5,32); x.closePath(); x.fill();
      x.fillRect(184,8,48,48); },1);
    const fr=(x,y,w,h)=>new PIXI.Texture({source:at.source,frame:new PIXI.Rectangle(x,y,w,h)});
    GL.tx.disk=fr(0,0,64,64); GL.tx.dia=fr(96,0,64,64); GL.tx.sq=fr(192,16,32,32);
    GL.pc=new PIXI.ParticleContainer({texture:GL.tx.disk,dynamicProperties:{vertex:true,position:true,rotation:false,uvs:true,color:true}});
    GL.st.addChild(GL.pc);
    new MutationObserver(glSyncLayers).observe(gcv,{attributes:true,attributeFilter:['style']});
    GL.ready=1;
  }catch(e){ GL.fail=1; try{ console.warn('[에테르 챔버] WebGL 그리기를 못 켜서 기본 그리기로 합니다',e); }catch(_){} }
  GL.busy=0;
}
function glWant(){ return OPT.gl!==0; }
function glSyncLayers(){
  const show=GL.ready&&GL.on&&gcv.style.display!=='none'?'block':'none';
  if(GL.cvG&&GL.cvG.style.display!==show) GL.cvG.style.display=show;
  if(GL.cvP&&GL.cvP.style.display!==show) GL.cvP.style.display=show;
}
function glFrameStart(){
  GL.on=GL.ready&&glWant()?1:0;
  if(!GL.ready&&glWant()&&!GL.fail&&!GL.busy) glInit();
  glSyncLayers();
  if(!GL.on){ ctx=ctxTop; return false; }
  if(GL.cvG.width!==gcv.width||GL.cvG.height!==gcv.height){ GL.cvG.width=gcv.width; GL.cvG.height=gcv.height; }
  if(GL.r.width!==gcv.width||GL.r.height!==gcv.height) GL.r.resize(gcv.width,gcv.height);
  GL.cxG.setTransform(1,0,0,1,0,0); GL.cxG.clearRect(0,0,GL.cvG.width,GL.cvG.height);
  GL.n=0; GL.pn=0; GL.ph=0; return true;
}
function glWorld(sx,sy){
  const k=DPR*ZK;
  GL.st.scale.set(k,k); GL.st.position.set(sx*k,CAMY*DPR+sy*k);
}
function glFrameEnd(){
  if(!GL.on) return;
  for(let i=GL.n;i<GL.pool.length;i++){ if(!GL.pool[i].visible) break; GL.pool[i].visible=false; }
  const arr=GL.pc.particleChildren;
  if(arr.length!==GL.pn){ if(arr.length<GL.pn){ for(let i=arr.length;i<GL.pn;i++) arr.push(GL.pp[i]); } else arr.length=GL.pn; GL.pc.update(); }
  GL.r.render(GL.st);
}
function glC(c){
  let v=GL.col.get(c);
  if(v===undefined){ try{ v=new PIXI.Color(c).toNumber(); }catch(e){ v=0xffffff; } GL.col.set(c,v); }
  return v;
}
function glS(tex){
  let s=GL.pool[GL.n];
  if(!s){ s=new PIXI.Sprite(tex); s.anchor.set(0.5); GL.sc.addChild(s); GL.pool.push(s); }
  else if(s.texture!==tex) s.texture=tex;
  GL.n++; s.visible=true; s.blendMode='normal'; s.rotation=0; s.skew.set(0,0); s.tint=0xffffff; s.alpha=1;
  return s;
}
function glBgr(c){
  let v=GL.bgr.get(c);
  if(v===undefined){ const n=glC(c); v=((n&0xff)<<16)|(n&0xff00)|((n>>16)&0xff); GL.bgr.set(c,v); }
  return v;
}
function glDisk(x,y,rx,ry,col,a,tex){
  const t=tex||GL.tx.disk;
  if(GL.ph){
    let p=GL.pp[GL.pn];
    if(!p){ p=new PIXI.Particle({texture:t,anchorX:0.5,anchorY:0.5}); GL.pp.push(p); }
    GL.pn++; p.texture=t; p.x=x; p.y=y; p.scaleX=rx*2/t.width; p.scaleY=ry*2/t.height;
    p.color=glBgr(col)+(((a<0?0:a>1?1:a)*255|0)<<24);
    return p;
  }
  const s=glS(t);
  s.position.set(x,y); s.scale.set(rx*2/t.width,ry*2/t.height); s.tint=glC(col); s.alpha=a;
  return s;
}
function glImgTex(img,keep){
  let t=GL.img.get(img);
  if(!t){
    const w=img.naturalWidth||img.width, h=img.naturalHeight||img.height, k=keep?1:Math.min(1,256/Math.max(w,h));
    t=glCanvasTex(Math.max(1,Math.round(w*k)),Math.max(1,Math.round(h*k)),(x,W,H)=>{ x.imageSmoothingQuality='high'; x.drawImage(img,0,0,W,H); },1);
    GL.img.set(img,t);
  }
  return t;
}
function glFrameTex(img,f,n){
  let m=GL.fr.get(img); if(!m){ m=[]; GL.fr.set(img,m); }
  if(!m[f]){ const b=glImgTex(img,1), fw=b.width/n; m[f]=new PIXI.Texture({source:b.source,frame:new PIXI.Rectangle(Math.round(f*fw),0,Math.floor(fw),b.height)}); }
  return m[f];
}
const glMat=()=>[1,0,0,1,0,0];
function glMT(m,x,y){ m[4]+=m[0]*x+m[2]*y; m[5]+=m[1]*x+m[3]*y; return m; }
function glMS(m,sx,sy){ m[0]*=sx; m[1]*=sx; m[2]*=sy; m[3]*=sy; return m; }
function glMR(m,t){ const c=Math.cos(t), s=Math.sin(t), a=m[0], b=m[1], cc=m[2], d=m[3];
  m[0]=a*c+cc*s; m[1]=b*c+d*s; m[2]=-a*s+cc*c; m[3]=-b*s+d*c; return m; }
const glPM=[];
function glImg(tex,m,size,alpha,flash){
  const put=(blend,a)=>{ const s=glS(tex), q=m.slice(); glMS(q,size/tex.width,size/tex.height);
    if(!glPM[0]) glPM[0]=new PIXI.Matrix();
    glPM[0].set(q[0],q[1],q[2],q[3],q[4],q[5]); s.setFromMatrix(glPM[0]); s.blendMode=blend; s.alpha=a; };
  put('normal',alpha);
  if(flash>0) put('add',Math.min(1,flash)*alpha);
}
function gameSnapshot(cx,w,h){
  if(GL.on&&GL.cvG&&GL.cvP){ cx.drawImage(GL.cvG,0,0,w,h); cx.drawImage(GL.cvP,0,0,w,h); }
  cx.drawImage(gcv,0,0,w,h);
}
if(glWant()) glInit();
