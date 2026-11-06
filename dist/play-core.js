/* Classic 6K playtest: audio-time judgement and press-bound hold coverage. */
(function(root){'use strict';
const C=root.DCCore,EPS=1e-9,GRADES=['perfect','great','good','miss'];
const MODES={standard:[40,60,80,100],professional:[20,20,40,60]};
function windows(mode='standard',custom){
 if(MODES[mode])return MODES[mode].slice();
 if(mode!=='custom')throw Error('未知计分模式');
 const a=Array.from(custom||[],Number);
 if(a.length!==4||a.some((v,i)=>!Number.isInteger(v)||v<1||v>99||i&&v<=a[i-1]))throw Error('自定义四个边界须为 1～99 ms 的递增整数');
 return a;
}
function tapGrade(delta,bounds){const ms=Math.abs(delta)*1000;for(let i=0;i<4;i++)if(ms<bounds[i]-1e-7)return{grade:i<2?'perfect':i===2?'great':'good',tier:i<2?i+1:null};return{grade:'miss',tier:null};}
function holdGrade(ratio){return ratio>.8+EPS?'perfect':ratio>=.6-EPS?'great':ratio>=.05-EPS?'good':'miss';}
function coverage(n){const bonus=n.activated ? .2 : 0;return{held:n.held,bonus,effectiveHeld:n.held+bonus,ratio:(n.held+bonus)/(n.end-n.time)};}
function prepare(input,{duration=0,start=null,end=null}={}){
 const chart=C.validateChart(input);if(chart.mode==='show')throw Error('谱面试玩暂只支持经典 6K 谱面');
 const raw=chart.notes.map(n=>({n,id:n.id,lane:n.lane,time:C.beatToTime(chart,n.beat),end:n.end===null?null:C.beatToTime(chart,n.end),fake:C.isFake(n)}));
 const real=raw.filter(n=>!n.fake),first=real.reduce((m,n)=>Math.min(m,n.time),0),last=real.reduce((m,n)=>Math.max(m,n.end??n.time),0);
 const fullEnd=Math.max(Number(duration)||0,last+.101,.2),practice=start!==null||end!==null;
 const from=practice?Number(start??0):first,to=practice?Number(end??fullEnd):fullEnd;
 if(!Number.isFinite(from)||!Number.isFinite(to)||from<first||to<=from||to>fullEnd+EPS)throw Error('练习区间无效；结束时间须晚于开始时间，并在歌曲 / 谱面时长内');
 const items=[];
 for(const r of raw){
  if(r.fake){if(r.time>=from&&r.time<to)items.push({...r,units:0,window:r.time});continue;}
  if(r.end===null){if(r.time>=from&&r.time<to)items.push({...r,units:1,window:r.time});}
  else if(r.end>from&&r.time<to){const time=Math.max(r.time,from),finish=Math.min(r.end,to);items.push({...r,time,end:finish,window:practice?Math.max(from,time-.1):time-.1,units:1+Math.floor((finish-time)/.2+EPS),clipped:time!==r.time||finish!==r.end});}
 }
 items.sort((a,b)=>a.time-b.time||a.lane-b.lane);
 const total=items.reduce((v,n)=>v+n.units,0);if(!total)throw Error('所选区间没有可计分的真实音符');
 if(!Number.isSafeInteger(total*100))throw Error('谱面物量过大，无法精确计分');
 return{chart,items,total,maxScore:total*100,start:from,end:to,practice,fullEnd};
}
class Engine{
 constructor(model,{mode='standard',custom}={}){
  this.model=model;this.bounds=windows(mode,custom);this.mode=mode;this.items=model.items.map(n=>({...n,result:null,held:0,activated:false}));this.pressed=Array(6).fill(false);this.holding=Array(6).fill(null);this.time=model.start-2;
  this.holds=this.items.filter(n=>n.units&&n.end!==null).sort((a,b)=>a.window-b.window);this.holdCursor=0;this.activeHolds=new Set();
  this.taps=Array.from({length:6},(_,lane)=>this.items.filter(n=>n.units&&n.end===null&&n.lane===lane));this.tapCursor=Array(6).fill(0);
  this.deadlines=this.items.filter(n=>n.units).map(n=>({n,time:(n.end??n.time)+.1})).sort((a,b)=>a.time-b.time||a.n.time-b.n.time||a.n.lane-b.n.lane);this.deadlineCursor=0;
  this.rows=[];this.score=0;this.combo=0;this.maxCombo=0;this.stats=Object.fromEntries(GRADES.map(k=>[k,{notes:0,units:0}]));this.perfectTiers=[0,0];this.done=false;this.onJudge=null;
 }
 record(n,grade,extra={}){if(n.result)return;const points=n.units*({perfect:100,great:86,good:50,miss:0}[grade]);n.result={id:n.id,lane:n.lane,time:n.time,end:n.end,units:n.units,grade,points,...extra};this.rows.push(n.result);this.score+=points;this.stats[grade].notes++;this.stats[grade].units+=n.units;if(grade==='miss')this.combo=0;else this.combo+=n.units;this.maxCombo=Math.max(this.maxCombo,this.combo);if(extra.tier)this.perfectTiers[extra.tier-1]++;this.onJudge?.(n.result);}
 advance(time){
  if(this.done)return;time=Number(time);if(!Number.isFinite(time)||time<this.time-EPS)return;const previous=this.time;
  while(this.holdCursor<this.holds.length&&this.holds[this.holdCursor].window<=time+EPS)this.activeHolds.add(this.holds[this.holdCursor++]);
  // A physical hold belongs to one note. Crossing another head never reassigns it.
  for(const n of this.holding)if(n&&!n.result&&this.pressed[n.lane])n.held+=Math.max(0,Math.min(time,n.end+.1)-Math.max(previous,n.window));
  while(this.deadlineCursor<this.deadlines.length&&this.deadlines[this.deadlineCursor].time<=time+EPS){const {n,time:at}=this.deadlines[this.deadlineCursor++];if(n.end!==null){const value=coverage(n);this.record(n,holdGrade(value.ratio),{...value,judgedAt:at});this.activeHolds.delete(n);if(this.holding[n.lane]===n)this.holding[n.lane]=null;}else this.record(n,'miss',{deltaMs:null,judgedAt:at});}
  this.time=time;
 }
 setHeld(lane,held,time,strike=true){
  if(!Number.isInteger(lane)||lane<0||lane>=6||!Number.isFinite(time)||time<this.time-EPS)return null;
  this.advance(time);if(this.done||this.pressed[lane]===!!held)return null;
  this.pressed[lane]=!!held;
  if(held)return strike?this.hit(lane,time):null;
  const n=this.holding[lane];this.holding[lane]=null;
  if(n&&!n.result){const value=coverage(n);if(holdGrade(value.ratio)==='perfect'){this.record(n,'perfect',{...value,judgedAt:time,early:true});this.activeHolds.delete(n);return n.result;}}
  return null;
 }
 hit(lane,time){
  this.advance(time);if(this.done||!this.taps[lane]||!Number.isFinite(time)||time<this.time-EPS)return null;
  const list=this.taps[lane];let i=this.tapCursor[lane];while(i<list.length&&list[i].result)i++;this.tapCursor[lane]=i;
  let n=list[i];if(n&&Math.abs(time-n.time)>.1+EPS)n=null;
  // An earlier unfinished long (including a retake) wins over a later tap/long.
  for(const hold of this.activeHolds)if(hold.lane===lane&&!hold.result&&time>=hold.window-EPS&&time<hold.end+.1&&(!n||hold.time<n.time))n=hold;
  if(!n)return null;
  if(n.end!==null){if(this.pressed[lane]){this.holding[lane]=n;n.activated=true;}return null;}
  const result=tapGrade(time-n.time,this.bounds);this.record(n,result.grade,{tier:result.tier,deltaMs:(time-n.time)*1000,judgedAt:time});return n.result;
 }
 release(time){for(let lane=0;lane<6;lane++)this.setHeld(lane,false,time);}
 finish(){this.advance(this.model.end+.100001);this.pressed.fill(false);this.holding.fill(null);this.done=true;return this.summary();}
 summary(){return{score:this.score,maxScore:this.model.maxScore,total:this.model.total,completion:this.score/this.model.maxScore,maxCombo:this.maxCombo,stats:JSON.parse(JSON.stringify(this.stats)),perfectTiers:this.perfectTiers.slice(),rows:this.rows.slice(),mode:this.mode,bounds:this.bounds.slice(),practice:this.model.practice,start:this.model.start,end:this.model.end};}
}
/* Owners prevent one finger/key release from cancelling another held input. */
class Inputs{
 constructor(engine,clock){this.engine=engine;this.clock=clock;this.owners=new Map();}
 move(owner,lane,strike=true){const old=this.owners.get(owner);if(old===lane)return;const time=this.clock();if(old!==undefined){this.owners.delete(owner);this.engine.setHeld(old,[...this.owners.values()].includes(old),time);}if(lane!==null&&lane!==undefined){this.owners.set(owner,lane);this.engine.setHeld(lane,true,time,strike);}}
 clear(){this.owners.clear();this.engine.release(this.clock());}
}
/* Feedback follows accepted input, never the automatic preview/expiration timeline. */
class Effects{
 constructor(){this.clear();}
 clear(){this.taps=[];this.holds=new Map();this.judgements=new Map();}
 hit(row,item,time){if(!item||C.isFake(item.n))return;this.judgements.set(row.lane,{n:item.n,time,grade:row.grade});if(row.end===null&&row.deltaMs!==null)this.taps.push({n:item.n,time,end:null});}
 judgeRecords(time){for(const [lane,r]of this.judgements)if(time-r.time>=.28)this.judgements.delete(lane);return [...this.judgements.values()].filter(r=>time>=r.time);}
 records(engine,time){
  this.taps=this.taps.filter(r=>time-r.time<.28&&time>=r.time);
  const ids=new Set();for(const n of engine.activeHolds){if(n.result||engine.holding[n.lane]!==n||!engine.pressed[n.lane]||time<n.window||time>=n.end+.1)continue;ids.add(n.id);if(!this.holds.has(n.id))this.holds.set(n.id,{n:n.n,time,end:n.end+.1});}
  for(const id of this.holds.keys())if(!ids.has(id))this.holds.delete(id);
  return [...this.taps,...this.holds.values()];
 }
}
function fitScale(settings){return Math.min(1,.46/Math.max(...settings.map(p=>.3*Number(p.distance)+.067*Number(p.size))));}
function pads(width,height,settings){const fit=fitScale(settings),radius=Math.min(width,height)*fit*.3,cx=width/2,cy=height/2;return C.ANGLES.map((deg,i)=>{const a=deg*Math.PI/180,r=radius*Number(settings[i].distance);return{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r,r:Math.min(width,height)*fit*.067*Number(settings[i].size),lane:i};});}
// Separating-axis test for the actual pointy hexagons, before viewport fitting.
function overlappingPads(settings){
 const magnitude=Math.max(...settings.map(p=>Math.max(p.distance,p.size))),list=settings.map((p,i)=>{const a=C.ANGLES[i]*Math.PI/180,d=.3*(p.distance/magnitude);return{x:Math.cos(a)*d,y:Math.sin(a)*d,r:.067*(p.size/magnitude)};}),axes=[[1,0],[.5,Math.sqrt(3)/2],[-.5,Math.sqrt(3)/2]],pairs=[];
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j],extent=(a.r+b.r)*Math.sqrt(3)/2;if(axes.every(([x,y])=>Math.abs((a.x-b.x)*x+(a.y-b.y)*y)<extent*(1-1e-12)))pairs.push([i,j]);}
 return pairs;
}
function hitPad(x,y,pads){let found=null,distance=Infinity;for(const p of pads){const dx=Math.abs(x-p.x),dy=Math.abs(y-p.y),r=p.r;/* pointy hexagon, including its border */if(dx<=r*Math.sqrt(3)/2+EPS&&dy<=r+EPS&&Math.sqrt(3)*dy+dx<=Math.sqrt(3)*r+EPS){const d=Math.hypot(dx,dy)/r;if(d<distance){found=p.lane;distance=d;}}}return found;}
function tracePads(x0,y0,x1,y1,list){const cuts=[0,1],dx=x1-x0,dy=y1-y0;for(const p of list){const vertices=Array.from({length:6},(_,i)=>{const a=(i*60-90)*Math.PI/180;return[p.x+Math.cos(a)*p.r,p.y+Math.sin(a)*p.r];});for(let i=0;i<6;i++){const a=vertices[i],b=vertices[(i+1)%6],ex=b[0]-a[0],ey=b[1]-a[1],det=dx*ey-dy*ex;if(Math.abs(det)<EPS)continue;const ax=a[0]-x0,ay=a[1]-y0,t=(ax*ey-ay*ex)/det,u=(ax*dy-ay*dx)/det;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}}cuts.sort((a,b)=>a-b);const out=[];let previous=hitPad(x0,y0,list);for(let i=1;i<cuts.length;i++){const t=(cuts[i-1]+cuts[i])/2,lane=hitPad(x0+dx*t,y0+dy*t,list);if(lane!==previous){out.push({lane,t:cuts[i-1]});previous=lane;}}const lane=hitPad(x1,y1,list);if(lane!==previous)out.push({lane,t:1});return out;}
root.DCPlayCore={MODES,windows,tapGrade,holdGrade,coverage,prepare,Engine,Inputs,Effects,pads,hitPad,fitScale,overlappingPads,tracePads};
})(typeof window==='undefined'?globalThis:window);
