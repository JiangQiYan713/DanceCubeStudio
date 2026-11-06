/* Playtest results: rank/clear badges and an on-demand, two-axis note bar chart. */
(function(root){'use strict';
const C=root.DCCore,COLORS={early:'#4b9dff',late:'#d54bdc',hold:'#9398a4'};
function assessment(result){
 const completion=result.maxScore>0?C.clamp(result.score/result.maxScore,0,1):0;
 const ranks=[[.98,'SSS','#ffda75'],[.95,'SS','#ffda75'],[.9,'S','#ffda75'],[.8,'A','#ca86ff'],[.7,'B','#88b49b'],[.6,'C','#8ea5bf'],[0,'D','#969ba5']],rank=ranks.find(([min])=>completion>=min);
 const counts=Object.fromEntries(['perfect','great','good','miss'].map(g=>[g,Number(result.stats?.[g]?.notes)||0]));
 const ap=counts.perfect>0&&!counts.great&&!counts.good&&!counts.miss,fc=!counts.miss&&counts.perfect+counts.great+counts.good>0;
 return{completion,rank:rank[1],color:rank[2],glow:completion>=.9,clear:ap?'AP':fc?'FC':null,clearName:ap?'AllPerfect':fc?'FullCombo':''};
}
function bars(rows){return rows.slice().sort((a,b)=>a.time-b.time||a.lane-b.lane).map((r,i)=>{
 const hold=r.end!==null,miss=r.grade==='miss',value=hold?C.clamp(1-r.points/(r.units*100),0,1)*100:miss?100:Math.min(100,Math.abs(Number(r.deltaMs)||0));
 return{x:i+1,value,unit:hold?'%':'ms',type:hold?'hold':'tap',miss,lane:r.lane+1,grade:r.grade,rawMs:hold?null:r.deltaMs,color:hold?COLORS.hold:(r.deltaMs??0)<0?COLORS.early:COLORS.late};
 });}
function viewport(total,zoom,pan){const count=Math.max(1,Math.ceil(total/Math.pow(Math.max(1,total),C.clamp(Number(zoom)||0,0,100)/100))),max=Math.max(0,total-count),start=C.clamp(Math.floor(Number(pan)||0),0,max);return{start,count,max,end:Math.min(total,start+count)};}
function describe(bar){const y=bar.type==='hold'?bar.value.toFixed(2)+'%':bar.miss?'100ms+':bar.value.toFixed(2)+'ms';return`(${bar.x}, ${y}) · 轨道 ${bar.lane} · ${bar.type==='hold'?'长条失分比':bar.miss?'单点 Miss':bar.rawMs<0?'单点提前':bar.rawMs>0?'单点延后':'单点准时'} · ${bar.grade}`;}
function mount(host,result,{signal}={}){
 const data=bars(result.rows),zoom=host.querySelector('[data-chart-zoom]'),pan=host.querySelector('[data-chart-pan]'),canvas=host.querySelector('canvas'),info=host.querySelector('[data-chart-info]'),range=host.querySelector('[data-chart-range]');
 let selected=null,current=null,width=600,height=330,closed=false,resizeObserver=null;
 function draw(){if(closed||!host.isConnected)return;const rect=canvas.getBoundingClientRect();width=rect.width||600;height=330;const dpr=Math.min(root.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=height*dpr;const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);const style=getComputedStyle(host),text=style.getPropertyValue('--text').trim()||'#f4effb',muted=style.getPropertyValue('--muted').trim()||'#a69aaf';
  current=viewport(data.length,zoom.value,pan.value);pan.max=current.max;pan.value=current.start;pan.disabled=!current.max;range.textContent=`第 ${data.length?current.start+1:0}～${current.end} / ${data.length} 个音符`;
  const left=51,right=width-49,top=31,bottom=height-42,plotWidth=Math.max(1,right-left),plotHeight=bottom-top,step=plotWidth/current.count;current={...current,left,right,top,bottom,step};
  c.font='11px system-ui';c.fillStyle=muted;c.textAlign='left';c.fillText('单点 |Δt| · ms',left,15);c.textAlign='right';c.fillText('长条失分 · %',right,15);
  for(let v=0;v<=100;v+=20){const y=bottom-v/100*plotHeight;c.strokeStyle='rgba(150,140,170,.22)';c.lineWidth=1;c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();c.fillStyle=muted;c.textAlign='right';c.fillText(String(v),left-9,y+4);c.textAlign='left';c.fillText(v+'%',right+8,y+4);}
  for(let i=current.start;i<current.end;i++){const bar=data[i],x=left+(i-current.start)*step+.1,h=Math.max(1,bar.value/100*plotHeight);c.fillStyle=bar.color;c.fillRect(x,bottom-h,Math.max(.35,step*.78),h);if(bar.x===selected){c.strokeStyle=text;c.lineWidth=2;c.strokeRect(x-1,bottom-h-2,Math.max(2,step*.78+2),h+3);}if(bar.miss&&bar.type==='tap'&&step>34){c.save();c.translate(x+step*.38,top+2);c.rotate(-Math.PI/2);c.fillStyle=text;c.textAlign='right';c.font='9px system-ui';c.fillText('100ms+',0,0);c.restore();}}
  c.fillStyle=muted;c.textAlign='center';const interval=Math.max(1,Math.ceil(current.count/8));for(let i=current.start;i<current.end;i++)if((i-current.start)%interval===0||i===current.end-1)c.fillText(String(i+1),left+(i-current.start+.4)*step,bottom+19);c.fillText('第 x 个音符（按头部时刻、轨道排序）',width/2,height-5);
 }
 function pick(index){if(!data.length)return;selected=C.clamp(index,0,data.length-1)+1;info.textContent=describe(data[selected-1]);canvas.setAttribute('aria-label',info.textContent);draw();}
 const click=e=>{const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*width/(rect.width||width),y=(e.clientY-rect.top)*height/(rect.height||height);if(current&&x>=current.left&&x<=current.right&&y>=current.top&&y<=current.bottom)pick(Math.min(current.end-1,current.start+Math.floor((x-current.left)/current.step)));};
 const key=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?data.length-1:(selected===null?current.start:selected-1)+(e.key==='ArrowLeft'?-1:1),v=C.clamp(index,0,data.length-1);if(v<current.start)pan.value=v;else if(v>=current.end)pan.value=v-current.count+1;pick(v);};
 const changeZoom=()=>{pan.value=Math.min(+pan.value,viewport(data.length,zoom.value,pan.value).max);draw();};
 zoom.addEventListener('input',changeZoom);pan.addEventListener('input',draw);canvas.addEventListener('click',click);canvas.addEventListener('keydown',key);root.addEventListener('resize',draw);
 if(root.ResizeObserver){resizeObserver=new root.ResizeObserver(draw);resizeObserver.observe(canvas);}
 function dispose(){if(closed)return;closed=true;resizeObserver?.disconnect();root.removeEventListener('resize',draw);zoom.removeEventListener('input',changeZoom);pan.removeEventListener('input',draw);canvas.removeEventListener('click',click);canvas.removeEventListener('keydown',key);signal?.removeEventListener('abort',dispose);}
 signal?.addEventListener('abort',dispose,{once:true});draw();return dispose;
}
root.DCPlayResults={COLORS,assessment,bars,viewport,describe,mount};
})(typeof window==='undefined'?globalThis:window);
