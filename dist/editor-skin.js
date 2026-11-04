/* Ordinary show-editor glyphs share the preview's selected skin and official inner fallback. */
'use strict';
(function(root){
function draw(c,skin,e,x,y,ey,width,prefs={}){
 const P=root.DCPreview,inner=e.type==='inner',multi=e.multi,fake=e.end===e.beat,hold=e.end!==null&&!fake,config=inner?P.innerConfig(skin,'note',e.position):skin?.config('note-'+e.position)||{},size=P.pair(config.size,[52.8,52.8]),height=width*size[1]/size[0],fallback='cursor'+((inner?(hold?7:3):(hold?5:1))+(multi?1:0))+'.png';
 const glyph=(px,py,tail=false)=>{
  if(hold&&root.DCPreviewAssets?.draw(c,root.DCPreviewAssets.name(inner,multi),px,py,width,height,skin))return true;
  if(!inner&&!multi&&!hold&&prefs.cursorOverride&&root.DCWebSettings?.drawCursor(c,px,py,width,height))return true;
  const tex=tail?config.tex3:multi?config.tex4:config.tex,chosen=tex||(!inner?(tail?'guangbiaoc.png':multi?'guangbiaob.png':'guangbiaoa.png'):fallback);
  if(skin?.hasFrame?.(chosen)&&skin.draw(c,chosen,px,py,width,height))return true;
  if(root.DCShowPreview?.drawSprite(c,inner?fallback:tail?'cursor5.png':multi?'cursor2.png':'cursor1.png',px,py,width,height,0,skin))return true;
  c.fillStyle=inner?(multi?'#ed48d5':'#4fdd85'):(multi?'#ffdc55':'#70baff');c.beginPath();c.arc(px,py,width*.37,0,Math.PI*2);c.fill();return false;
 };
 if(hold){const bodyTex=multi&&config.tex5?config.tex5:config.tex2,body='changan'+(inner?(multi?'d':'c'):(multi?'b':'a'))+'.png';let drawn=false;
  if(bodyTex&&skin?.hasFrame?.(bodyTex))drawn=config.bodyaxis==='horizontal'?skin.draw(c,bodyTex,x,(y+ey)/2,Math.abs(ey-y),width*.82,Math.atan2(ey-y,0)):skin.drawHold(c,bodyTex,x,y,x,ey,width*.82);
  if(!drawn&&inner&&skin?.hasFrame?.(body))drawn=skin.draw(c,body,x,(y+ey)/2,Math.abs(ey-y),width,Math.atan2(ey-y,0));
  if(!drawn)drawn=root.DCShowPreview?.drawSprite(c,body,x,(y+ey)/2,Math.abs(ey-y),width,Math.atan2(ey-y,0)*180/Math.PI,skin);
  if(!drawn){c.strokeStyle=inner?(multi?'#ed48d5':'#4fdd85'):(multi?'#ffdc55':'#70baff');c.lineWidth=width*.7;c.beginPath();c.moveTo(x,y);c.lineTo(x,ey);c.stroke();}
  glyph(x,ey,true);
 }
 glyph(x,y);
 return{width,height};
}
root.DCEditorSkin={draw};
})(typeof window==='undefined'?globalThis:window);
