'use strict';
(function(root){
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeLink(url){return /^(?:https?:\/\/|(?:README|DEVELOPMENT|LEGAL|plan)\.md(?:#[\w-]+)?$)/i.test(url)&&!/[\s<>"']/.test(url)?url:null;}
function inline(value){const saved=[];let text=String(value).replace(/`([^`]+)`/g,(_,s)=>'\u0000'+(saved.push('<code>'+escape(s)+'</code>')-1)+'\u0000');text=escape(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,label,url)=>{const href=safeLink(url.replace(/&amp;/g,'&'));return href?`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`:label;}).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');return text.replace(/\u0000(\d+)\u0000/g,(_,i)=>saved[+i]||'');}
function render(text){
 const source=String(text).split(/\r?\n/),lines=[];let code=false,list=false,details=0;
 const endList=()=>{if(list){lines.push('</ul>');list=false;}};
 for(let i=0;i<source.length;i++){const line=source[i];if(line.startsWith('```')){endList();code=!code;lines.push(code?'<pre><code>':'</code></pre>');continue;}if(code){lines.push(escape(line)+'\n');continue;}
  if(line.trim()==='<details>'){endList();lines.push('<details class="doc-disclosure">');details++;continue;}
  if(line.trim()==='</details>'){endList();if(details){lines.push('</details>');details--;}continue;}
  const summary=line.trim().match(/^<summary>(.*)<\/summary>$/);if(summary&&details){endList();lines.push('<summary>'+inline(summary[1])+'</summary>');continue;}
  if(/^\|/.test(line)&&/^\|[\s:|-]+\|\s*$/.test(source[i+1]||'')){endList();const cells=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(s=>s.trim());lines.push('<div class="doc-table"><table><thead><tr>'+cells(line).map(s=>'<th>'+inline(s)+'</th>').join('')+'</tr></thead><tbody>');i++;while(/^\|/.test(source[i+1]||'')){i++;lines.push('<tr>'+cells(source[i]).map(s=>'<td>'+inline(s)+'</td>').join('')+'</tr>');}lines.push('</tbody></table></div>');continue;}
  if(/^[-*] /.test(line)){if(!list){lines.push('<ul>');list=true;}lines.push('<li>'+inline(line.slice(2))+'</li>');continue;}endList();
  const heading=line.match(/^(#{1,4}) (.*)/);lines.push(heading?`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`:line.trim()?'<p>'+inline(line)+'</p>':'');
 }endList();if(code)lines.push('</code></pre>');while(details-->0)lines.push('</details>');return lines.join('');
}
root.DCDocs={render,inline,safeLink};
})(typeof window==='undefined'?globalThis:window);
