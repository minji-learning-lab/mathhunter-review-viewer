// Runtime archives are read in memory. Imported JS/HTML is never executed.
export async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function readRuntime(file,progress=()=>{}){
 if(file.size>500*1024*1024)throw Error('ZIP은 500MB 이하여야 합니다.');
 const bytes=new Uint8Array(await file.arrayBuffer()),v=new DataView(bytes.buffer),decoder=new TextDecoder('utf-8',{fatal:true});
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===bytes.length){end=p;break;}
 if(end<0||v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('일반 단일 ZIP 파일이 필요합니다.');
 const count=v.getUint16(end+10,true),directory=v.getUint32(end+16,true);if(count===65535||count>20000||directory>=end)throw Error('지원하지 않는 ZIP 구조입니다.');
 const files=new Map();let pos=directory,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw Error('ZIP 목록이 손상되었습니다.');
  const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),size=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),extra=v.getUint16(pos+30,true),comment=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true),name=decoder.decode(bytes.subarray(pos+46,pos+46+nl));
  pos+=46+nl+extra+comment;total+=size;
  if(flags&1||![0,8].includes(method)||size>50*1024*1024||total>700*1024*1024||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.')||files.has(name)||offset+30>directory)throw Error('안전하지 않거나 너무 큰 ZIP 항목입니다.');
  if(v.getUint32(offset,true)!==0x04034b50)throw Error('ZIP 파일 경계 오류');
  const start=offset+30+v.getUint16(offset+26,true)+v.getUint16(offset+28,true);if(start+compressed>directory)throw Error('ZIP 항목 범위 오류');
  let raw=bytes.subarray(start,start+compressed);
  if(method===8){const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let used=0;try{while(true){const part=await reader.read();if(part.done)break;used+=part.value.length;if(used>size){await reader.cancel();throw Error('압축 해제 크기 초과');}chunks.push(part.value);}}finally{reader.releaseLock();}raw=new Uint8Array(used);let at=0;for(const c of chunks){raw.set(c,at);at+=c.length;}}
  if(raw.length!==size)throw Error('압축 해제 크기가 다릅니다.');files.set(name,raw);if(i%50===0)progress(`압축 확인 ${i+1} / ${count}`);
 }
 const manifest=JSON.parse(decoder.decode(files.get('RUNTIME-MANIFEST.json')||new Uint8Array()));
 if(!Array.isArray(manifest.files)||manifest.files.length!==files.size-1)throw Error('V3 실행 manifest가 필요합니다.');
 const seen=new Set();for(let i=0;i<manifest.files.length;i++){const entry=manifest.files[i],raw=files.get(entry.path);if(seen.has(entry.path)||!raw||raw.length!==entry.bytes||await sha(raw)!==entry.sha256)throw Error('파일 해시 불일치: '+entry.path);seen.add(entry.path);if(i%50===0)progress(`해시 확인 ${i+1} / ${manifest.files.length}`);}
 if(![...files.keys()].some(n=>n.startsWith('factory_v3/data/sources/')))throw Error('V3 원문 JSON이 없습니다.');
 return {files,manifest,sha256:await sha(bytes)};
}
