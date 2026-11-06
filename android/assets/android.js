'use strict';
// Runs before the site starts; native origin remains stable across updates.
window.DC_ANDROID=true;
try { const dpr=Math.min(window.devicePixelRatio||1,1.5);Object.defineProperty(window,'devicePixelRatio',{get:()=>dpr}); } catch(e) {}
let androidExportBusy=false;
async function androidExport(a){
 if(androidExportBusy)return;androidExportBusy=true;let begun=false;
 try{
  if(!DCAndroid.begin(a.download||'DanceCube-export.bin'))throw Error('已有导出任务或临时存储不可用');
  begun=true;const blob=await (await fetch(a.href)).blob();
  if(blob.size>512*1024*1024)throw Error('首版导出限制为512MB，请分批导出歌曲');
  for(let pos=0;pos<blob.size;pos+=192*1024){const data=await blob.slice(pos,pos+192*1024).arrayBuffer();const bytes=new Uint8Array(data);let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));if(!DCAndroid.chunk(btoa(text)))throw Error('写入导出临时文件失败');}
  DCAndroid.finish();
 }catch(e){if(begun)DCAndroid.cancel();alert('导出失败：'+e.message);}finally{androidExportBusy=false;}
}
const nativeClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download')&&(this.href.startsWith('blob:')||this.href.startsWith('data:'))){androidExport(this);return;}return nativeClick.call(this);};
document.addEventListener('click',e=>{const a=e.target.closest?.('a[download]');if(a&&(a.href.startsWith('blob:')||a.href.startsWith('data:'))){e.preventDefault();e.stopPropagation();androidExport(a);}},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(typeof pause==='function')pause();if(typeof flushSave==='function')flushSave();}});
