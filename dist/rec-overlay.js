/* Recognition diagnostics only: never feeds pixels or labels back into detection. */
'use strict';
(function(root){
function draw(ctx,detections,{width,height,time,frameNumber,fps}){
 ctx.save();ctx.globalCompositeOperation='difference';ctx.strokeStyle='#fff';ctx.lineWidth=2;
 for(const d of detections){const size=Math.max(6,d.size||12);ctx.setLineDash(d.synthetic?[5,3]:d.trackId?[ ]:[3,2]);ctx.strokeRect(d.x-size/2,d.y-size/2,size,size);}
 ctx.restore();ctx.save();ctx.font='bold 11px monospace';ctx.textBaseline='top';
 function label(text,x,y){const w=ctx.measureText(text).width+6;x=Math.max(0,Math.min(width-w,x));y=Math.max(0,Math.min(height-16,y));ctx.fillStyle='rgba(0,0,0,.85)';ctx.fillRect(x,y,w,16);ctx.fillStyle='#fff';ctx.fillText(text,x+3,y+2);}
 for(const d of detections){const name=['蓝','黄','尾'][d.type]||'候选';label((d.trackId?'#'+d.trackId:'?未关联')+(d.synthetic?' 推算 ':' ')+name+' L'+(d.lane+1),d.x+(d.size||12)/2+3,d.y-8);}
 label('帧 '+frameNumber+' | '+time.toFixed(3)+'s | '+fps.toFixed(3)+' FPS',4,4);ctx.restore();
}
root.DCRecOverlay={draw};
})(typeof window==='undefined'?globalThis:window);
