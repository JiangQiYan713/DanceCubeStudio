/* Beat-head clicks on the Web Audio clock. No audio or chart data leaves this browser. */
'use strict';
(function(root){
const C=root.DCCore,TYPES=[['clear','清脆'],['electric','电波'],['dull','沉闷'],['moderate','适中']],COUNT_IN=[-8,-7,-6,-5];
function events(chart){const beats=[...COUNT_IN,...root.DCUnits.records(chart).map(n=>n.beat)].sort((a,b)=>a-b),out=[];for(const beat of beats)if(!out.length||Math.abs(beat-out.at(-1).beat)>1e-8)out.push({beat,time:C.beatToTime(chart,beat)});return out;}
function onset(buffer){let peak=0;const width=Math.max(1,Math.round(buffer.sampleRate*.001)),energy=[];for(let i=0;i<buffer.length;i+=width){let sum=0,count=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const a=buffer.getChannelData(ch);for(let j=i;j<Math.min(i+width,a.length);j++){sum+=a[j]*a[j];count++;}}const rms=Math.sqrt(sum/Math.max(1,count));energy.push(rms);peak=Math.max(peak,rms);}if(peak<1e-5)throw Error('音效接近静音，请换一个文件');const index=energy.findIndex((v,i)=>v>=peak*.08&&(energy[i+1]??v)>=peak*.04);return Math.round(Math.max(0,index)*width/buffer.sampleRate*1000);}
function delay(p){return(p.type==='custom'?Number(p.delay1Ms)||0:0)+(Number(p.delay2Ms)||0);}
function builtin(ctx,type){const duration=.09,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0),hz={clear:2300,electric:1250,dull:220,moderate:900}[type]||900;for(let i=0;i<data.length;i++){const t=i/ctx.sampleRate,phase=2*Math.PI*hz*t,attack=Math.min(1,t/.001),wave=type==='electric'?Math.tanh(3*Math.sin(phase)):type==='moderate'?.75*Math.sin(phase)+.25*Math.sin(phase*2.4):Math.sin(phase);data[i]=wave*attack*Math.exp(-t/(type==='dull'?.021:.012))*.65;}return buffer;}
class Player{
 constructor({audio,output,timers=root}){this.audio=audio;this.output=output;this.timers=timers;this.record=null;this.decoded=new WeakMap();this.builtins=new Map();this.voices=new Set();this.timer=null;this.queue=[];this.next=0;}
 async decode(record){if(!record?.data?.length)throw Error('请先上传节拍音效');if(record.data.length>10*1024*1024)throw Error('节拍音文件不能超过 10 MB');let promise=this.decoded.get(record);if(!promise){promise=this.audio().decodeAudioData(record.data.slice().buffer).then(buffer=>{if(!Number.isFinite(buffer.duration)||buffer.duration<=0||buffer.duration>10)throw Error('节拍音长度须大于 0 且不超过 10 秒');return buffer;});this.decoded.set(record,promise);promise.catch(()=>this.decoded.delete(record));}return promise;}
 async analyze(record){return onset(await this.decode(record));}
 setRecord(record){this.record=record||null;}
 async prepare(p){if(p.type==='custom')return this.decode(this.record);if(!this.builtins.has(p.type))this.builtins.set(p.type,builtin(this.audio(),p.type));return this.builtins.get(p.type);}
 voice(buffer,when,volume){const ctx=this.audio(),node=ctx.createBufferSource(),gain=ctx.createGain();node.buffer=buffer;gain.gain.value=volume/100;node.connect(gain);gain.connect(this.output());const item={node,gain};this.voices.add(item);node.onended=()=>{this.voices.delete(item);node.disconnect();gain.disconnect();};node.start(Math.max(ctx.currentTime,when));return item;}
 async audition(p,record){const ctx=this.audio();await ctx.resume();const buffer=p.type==='custom'?await this.decode(record||this.record):await this.prepare(p);this.voice(buffer,ctx.currentTime+.04,p.volume);}
 start(chart,p,{epoch,position,rate,buffer}){this.stop();if(!p.enabled)return;this.queue=events(chart).filter(e=>e.time>=position-1e-8).map(e=>({...e,when:epoch+(e.time-position)/rate-delay(p)/1000}));this.buffer=buffer;this.volume=p.volume;this.next=0;this.pump();this.timer=this.timers.setInterval(()=>this.pump(),25);}
 pump(){const now=this.audio().currentTime;while(this.next<this.queue.length&&this.queue[this.next].when<=now+.15){const e=this.queue[this.next++];if(e.when>=now-.025)this.voice(this.buffer,e.when,this.volume);}if(this.next===this.queue.length&&this.timer!==null){this.timers.clearInterval(this.timer);this.timer=null;}}
 stop(){if(this.timer!==null)this.timers.clearInterval(this.timer);this.timer=null;this.queue=[];this.next=0;for(const item of this.voices){try{item.node.stop();}catch(e){}item.node.disconnect();item.gain.disconnect();}this.voices.clear();}
}
root.DCBeatSound={Player,TYPES,COUNT_IN,events,onset,delay};
})(typeof window==='undefined'?globalThis:window);
