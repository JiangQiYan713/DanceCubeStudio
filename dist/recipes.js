'use strict';
(function(root){
const C=root.DCCore,FORMAT='dc-recipe-1',LIBRARY='dc-recipe-library-1';
const LIMITS={items:500,notes:20000,bytes:8*1024*1024};
function clean(value,max){return String(value??'').trim().slice(0,max);}
function validate(value){
 if(!value||value.format!==FORMAT)throw Error('不是支持的配方模板文件');
 if(!Array.isArray(value.notes)||!value.notes.length||value.notes.length>LIMITS.notes)throw Error('每份模板需要 1—20000 个音符');
 const notes=value.notes.map((n,i)=>{const beat=C.beatValue(n.beat),end=n.end===null?null:C.beatValue(n.end),lane=n.lane;
  if(!Number.isInteger(lane)||lane<0||lane>5||beat<0||beat>100000||end!==null&&(end<beat||end>100000))throw Error('模板第 '+(i+1)+' 个音符无效');
  return{beat:C.beatArray(beat),lane,end:end===null?null:C.beatArray(end)};
 }).sort((a,b)=>C.beatValue(a.beat)-C.beatValue(b.beat)||a.lane-b.lane);
 const first=C.beatValue(notes[0].beat);
 if(Math.abs(first)>1e-7)throw Error('模板首音符必须从相对第 0 拍开始');
 const extent=Math.max(...notes.map(n=>C.beatValue(n.end??n.beat))),span=value.span?C.beatValue(value.span):extent;
 if(!Number.isFinite(span)||span<extent-1e-7||span>100000)throw Error('模板长度无效');
 return{format:FORMAT,id:clean(value.id,100)||C.uid(),name:clean(value.name,80)||'未命名配方',description:clean(value.description,600),tags:[...new Set((Array.isArray(value.tags)?value.tags:[]).map(t=>clean(t,24)).filter(Boolean))].slice(0,12),createdAt:Number.isFinite(value.createdAt)?value.createdAt:Date.now(),updatedAt:Number.isFinite(value.updatedAt)?value.updatedAt:Date.now(),source:{title:clean(value.source?.title,120),chart:clean(value.source?.chart,120),bpm:Number.isFinite(value.source?.bpm)?value.source.bpm:null},span:C.beatArray(span),notes};
}
function capture(notes,meta={}){
 if(!notes.length)throw Error('先在谱面里框选一段音符');
 const first=Math.min(...notes.map(n=>n.beat)),last=Math.max(...notes.map(n=>n.end??n.beat));
 return validate({format:FORMAT,id:C.uid(),name:meta.name||'选区配方',description:meta.description||'',tags:meta.tags||[],createdAt:Date.now(),updatedAt:Date.now(),source:meta.source,span:C.beatArray(last-first),notes:notes.map(n=>({lane:n.lane,beat:C.beatArray(n.beat-first),end:n.end===null?null:C.beatArray(n.end-first)}))});
}
function parse(value){
 const records=value?.format===LIBRARY?value.recipes:[value];
 if(!Array.isArray(records)||!records.length||records.length>LIMITS.items)throw Error('模板库需要 1—500 份模板');
 return records.map(validate);
}
function merge(current,incoming){
 const output=current.map(validate),ids=new Set(output.map(r=>r.id));
 for(const item of incoming){const next=validate(item);if(ids.has(next.id))next.id=C.uid();ids.add(next.id);output.push(next);}
 if(output.length>LIMITS.items)throw Error('本机模板库最多保存 500 份，请先导出并移除一些模板');
 if(new TextEncoder().encode(JSON.stringify(output)).length>LIMITS.bytes)throw Error('模板库超过 8 MB，请先导出部分模板');
 return output;
}
function instantiate(recipe,{beat=0,scale=1,mirror=null,repeat=1,gap=0}={}){
 const r=validate(recipe);if(!Number.isFinite(beat)||beat<0||![.25,.5,1,2,4].includes(scale)||!Number.isInteger(repeat)||repeat<1||repeat>32||!Number.isFinite(gap)||gap<0)throw Error('插入拍位、缩放或重复设置无效');
 if(mirror!==null&&!C.MIRRORS[mirror])throw Error('镜像方式无效');
 const span=C.beatValue(r.span)*scale;
 if(repeat>1&&span+gap<=0)throw Error('单拍模板重复时需要大于 0 的间隔');
 if(r.notes.length*repeat>LIMITS.notes)throw Error('一次插入最多 20000 个音符');
 const notes=[];
 for(let i=0;i<repeat;i++)for(const n of r.notes){const start=beat+i*(span+gap)+C.beatValue(n.beat)*scale,end=n.end===null?null:beat+i*(span+gap)+C.beatValue(n.end)*scale;if(start>100000||end>100000)throw Error('插入位置超出谱面上限');notes.push({id:C.uid(),lane:mirror?C.MIRRORS[mirror][n.lane]:n.lane,beat:+start.toFixed(9),end:end===null?null:+end.toFixed(9)});}
 return notes.sort((a,b)=>a.beat-b.beat||a.lane-b.lane);
}
function collisions(existing,items){
 const lanes=Array.from({length:6},()=>[]);
 for(const n of [...existing,...items])lanes[n.lane].push(n);
 const added=new Set(items.map(n=>n.id));
 for(const lane of lanes){lane.sort((a,b)=>a.beat-b.beat);const active=[];for(const n of lane){for(let i=active.length-1;i>=0;i--)if((active[i].end??active[i].beat)<n.beat-1e-6)active.splice(i,1);for(const p of active)if((added.has(n.id)||added.has(p.id))&&C.overlaps(n,p))return true;active.push(n);}}
 return false;
}
function bundle(recipes){return{format:LIBRARY,exportedAt:new Date().toISOString(),recipes:recipes.map(validate)};}
root.DCRecipes={FORMAT,LIBRARY,LIMITS,validate,capture,parse,merge,instantiate,collisions,bundle};
})(typeof window==='undefined'?globalThis:window);
