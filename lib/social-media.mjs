// Native MemeSpace image verification. No user-provided file names or executable SVG/HTML are accepted.
export const MAX_IMAGE_BYTES=2*1024*1024;
export const MAX_FORM_BYTES=MAX_IMAGE_BYTES+32768;
export async function readSocialForm(request){
 const contentType=request.headers.get('content-type')||'';
 if(!contentType.toLowerCase().startsWith('multipart/form-data;'))throw Error('INPUT');
 const reader=request.body?.getReader();
 if(!reader)throw Error('INPUT');
 const chunks=[];
 let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>MAX_FORM_BYTES){void reader.cancel().catch(()=>{});throw Error('UPLOAD_TOO_LARGE')}
   chunks.push(value);
  }
 }finally{reader.releaseLock()}
 try{return await new Response(Buffer.concat(chunks),{headers:{'Content-Type':contentType}}).formData()}
 catch{throw Error('INPUT')}
}
const LIMIT=4096;
function jpegSize(buf){
 if(buf.length<12||buf[0]!==255||buf[1]!==216||buf[2]!==255)return null;
 let offset=2;
 while(offset+8<=buf.length){
  if(buf[offset]!==255)return null;
  while(offset<buf.length&&buf[offset]===255)offset++;
  const marker=buf[offset++];
  if(marker===0xda||marker===0xd9)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(offset+2>buf.length)return null;
  const length=buf.readUInt16BE(offset);
  if(length<2||offset+length>buf.length)return null;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(length<7)return null;
   return {width:buf.readUInt16BE(offset+5),height:buf.readUInt16BE(offset+3)};
  }
  offset+=length;
 }
 return null;
}
export function verifySocialImage(bytes,mime){
 if(!Buffer.isBuffer(bytes)||bytes.length<20||bytes.length>MAX_IMAGE_BYTES)return null;
 let size=null;
 if(mime==='image/png'&&bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(8)===13){
  size={width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 }else if(mime==='image/jpeg')size=jpegSize(bytes);
 else if(mime==='image/gif'&&bytes.length>=13&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))
  size={width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};
 if(!size||size.width<1||size.height<1||size.width>LIMIT||size.height>LIMIT)return null;
 return {...size,mime,byteSize:bytes.length};
}
