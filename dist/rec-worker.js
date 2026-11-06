'use strict';
importScripts('core.js?v=5.0.3','rec-core.js?v=5.0.3','rec-robust.js?v=5.0.3','rec-continuity.js?v=5.0.3');
let tracker,background,bodyTimeline=[],sourceFPS=30,trackGeometry=null;
self.onmessage=event=>{const m=event.data;try{let result;
 if(m.type==='geometry')result=DCRecCore.autoGeometry(new Float32Array(m.edge),m.width,m.height);
 else if(m.type==='background'){background=m.frame;result=true;}
 else if(m.type==='init'){tracker=new DCRecCore.Tracker({...m.options,sparse:true});bodyTimeline=[];sourceFPS=m.options.fps;result=true;}
 else if(m.type==='frame'){let detections=DCRecCore.scanGhost(m.frame,m.geometry,m.templates,{...m.options,background});if(m.track){trackGeometry=m.geometry;tracker.push(m.time,detections);let mask=0;for(let lane=0;lane<6;lane++)if(DCRecCore.holdRails(m.frame,m.geometry,lane,.98)>=.8)mask|=1<<lane;if(bodyTimeline.length<144001)bodyTimeline.push([m.time,mask]);detections.push(...DCRecCore.predictedDetections(tracker,m.time,m.geometry));}if(m.options?.coarse)detections=[0,1,2].flatMap(type=>detections.filter(d=>d.type===type&&d.q>=.36&&d.q<=.94).sort((a,b)=>b.score-a.score).slice(0,3)).map(d=>({...d,patch:DCRecCore.snapshot(m.frame,d)}));result={detections,events:tracker?.events.length||0};}
 else if(m.type==='speed')result=DCRecCore.speedEstimate(tracker.events);
 else if(m.type==='done'){const resolved=DCRecCore.resolveHolds(tracker.done(),{bodyTimeline,fps:sourceFPS,geometry:trackGeometry});result={events:resolved.events,inferredHolds:resolved.inferred,rejected:tracker.rejected};}
 else throw Error('未知 REC 消息');postMessage({id:m.id,result});
 }catch(error){postMessage({id:m.id,error:error.message});}};
