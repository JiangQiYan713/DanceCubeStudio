'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../dist/'+f+'.js'),'utf8');
const x={console,TextEncoder,TextDecoder,Response,Blob,URL,setTimeout,clearTimeout,AbortController,DOMException,requestControllers:new Set()};x.window=x;vm.createContext(x);
for(const f of ['core','settings-core','project','formats','account-core','show','online-package'])vm.runInContext(read(f),x);
x.A=x.DCAccountCore;
const resource=read('account').match(/async function fetchResource\([\s\S]*?\nasync function resources/)[0].replace(/\nasync function resources$/,'');vm.runInContext(resource,x);
(async()=>{
 const base='https://dance-user-file.oss-cn-shanghai.aliyuncs.com/fixture/',calls=[];
 // Model a display image cached without CORS. A script must bypass this cache.
 x.fetch=async(url,opts)=>{calls.push({url,opts});if(opts.cache!=='no-store')throw new TypeError('cached image is not CORS readable');return new Response('IMAGE');};
 const image=await x.fetchResource(base+'art.jpg',{max:100});assert.equal(new TextDecoder().decode(image.data),'IMAGE');assert.equal(calls[0].opts.mode,'cors');assert.equal(calls[0].opts.credentials,'omit');assert.equal(calls[0].opts.cache,'no-store');assert.equal(x.requestControllers.size,0);
 const info={MusicID:10,GoodsName:'Fallback',BPM:120,BeginSeconds:1,PicPath:base+'preview.jpg',ResourcePath:base+'background.jpg',LevelList:[{MusicLevNew:11,MusicLevel:1},{MusicLevNew:105,MusicLevel:17}],ListFile:[{MusicLev:11,FileType:1,Url:base+'classic.txt'},{MusicLev:105,FileType:1,Url:base+'show.txt'},{MusicLev:0,FileType:3,Url:base+'blocked.jpg'}]};
 const attempted=[];const load=async url=>{attempted.push(url);if(/blocked|preview/.test(url))throw new TypeError('CORS');return new Response(url.endsWith('.txt')?'1-0\n':'IMAGE');};
 const result=await x.DCOnlinePackage.make(info,load);assert.equal(result.warnings.length,0);assert(result.charts.every(c=>c.backgroundName),'classic and show reference fallback art');const files=await x.DCCore.unzip(await result.blob.arrayBuffer());assert(files.some(f=>f.name.endsWith('.jpg')));assert.equal(attempted.filter(u=>u===info.ResourcePath).length,1,'shared successful fallback downloaded once');
 const showOnly={...info,ListFile:info.ListFile.filter(f=>f.MusicLev>=100)};const show=await x.DCOnlinePackage.make(showOnly,load);assert(show.charts[0].backgroundName,'show uses detail art without a FileType 3 record');
 const failed=await x.DCOnlinePackage.make(info,async url=>{if(!url.endsWith('.txt'))throw new TypeError('CORS');return new Response('1-0\n');});assert(failed.warnings.length>0);assert(failed.warnings.every(w=>w.includes('背景图')));assert(failed.charts.every(c=>!c.backgroundName));
 await assert.rejects(()=>x.DCOnlinePackage.make(info,async()=>{throw new TypeError('CORS');}),/TXT/,'required charts never silently disappear');
 console.log('PASS cache bypass, bounded media bytes, classic/show alternative covers, show cover without file record, shared download, accurate missing background warnings and fatal chart errors.');
})().catch(e=>{console.error(e);process.exitCode=1});
