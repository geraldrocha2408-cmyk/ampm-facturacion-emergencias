// Minimal, local-only XLSX reader. Reads cached cell values; never executes macros/formulas.
async function readXlsx(file){
  if(!globalThis.DecompressionStream)throw Error('Este navegador no puede abrir XLSX. Usa Chrome/Edge actualizado o exporta como CSV.');
  const buf=await file.arrayBuffer(),v=new DataView(buf),bytes=new Uint8Array(buf),decoder=new TextDecoder();
  let end=-1;for(let p=buf.byteLength-22;p>=Math.max(0,buf.byteLength-65557);p--){if(v.getUint32(p,true)===0x06054b50){end=p;break;}}
  if(end<0)throw Error('No es un archivo XLSX válido.');
  let pos=v.getUint32(end+16,true),entries=new Map(),size=0;
  for(let i=0;i<v.getUint16(end+10,true);i++){
    if(v.getUint32(pos,true)!==0x02014b50)throw Error('XLSX dañado.');
    const method=v.getUint16(pos+10,true),compressed=v.getUint32(pos+20,true),uncompressed=v.getUint32(pos+24,true),nl=v.getUint16(pos+28,true),el=v.getUint16(pos+30,true),cl=v.getUint16(pos+32,true),offset=v.getUint32(pos+42,true),name=decoder.decode(bytes.slice(pos+46,pos+46+nl));
    size+=uncompressed;if(size>50_000_000)throw Error('El XLSX expandido supera 50 MB. Exporta solo la lista de productos.');
    entries.set(name,{method,compressed,uncompressed,offset});pos+=46+nl+el+cl;
  }
  async function xml(name){const e=entries.get(name);if(!e)return null;const p=e.offset+30+v.getUint16(e.offset+26,true)+v.getUint16(e.offset+28,true);let b=bytes.slice(p,p+e.compressed);if(e.method===8)b=new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());else if(e.method!==0)throw Error('Compresión XLSX no compatible.');if(b.length!==e.uncompressed)throw Error('Tamaño XLSX inválido.');const d=new DOMParser().parseFromString(decoder.decode(b),'application/xml');if(d.querySelector('parsererror'))throw Error('XML de Excel no válido.');return d;}
  const book=await xml('xl/workbook.xml'),rels=await xml('xl/_rels/workbook.xml.rels');
  const sheets=[...(book?.getElementsByTagName('sheet')||[])].filter(s=>s.getAttribute('state')!=='hidden');
  const ss=await xml('xl/sharedStrings.xml'),strings=[...(ss?.getElementsByTagName('si')||[])].map(s=>[...s.getElementsByTagName('t')].map(t=>t.textContent).join(''));
  const result=[];
  for(const sheet of sheets){const id=sheet.getAttribute('r:id'),rel=[...rels.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===id);let path=rel?.getAttribute('Target');if(!path)continue;path=path.startsWith('/')?path.slice(1):'xl/'+path;const doc=await xml(path),rows=[];
    for(const row of doc?.getElementsByTagName('row')||[]){const values=[];for(const c of row.getElementsByTagName('c')){const ref=c.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/)?.[0];if(!letters)continue;let index=0;for(const ch of letters)index=index*26+ch.charCodeAt(0)-64;if(index>100)throw Error('Demasiadas columnas. Exporta solo productos.');const type=c.getAttribute('t'),raw=c.getElementsByTagName('v')[0]?.textContent??'';values[index-1]=type==='s'?strings[Number(raw)]:type==='inlineStr'?[...c.getElementsByTagName('t')].map(t=>t.textContent).join(''):raw;}
      if(values.some(x=>String(x??'').trim()))rows.push(Array.from(values,v=>v??''));
    }result.push({name:sheet.getAttribute('name'),rows});
  }if(!result.length)throw Error('No se encontraron hojas legibles.');return result;
}
