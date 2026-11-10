const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {originalImageUrl}=require('./image-url');

async function request(message){
  let listener, fetched;
  const context={originalImageUrl,URL,Uint8Array,btoa,importScripts(){},
    chrome:{runtime:{onMessage:{addListener(fn){listener=fn;}}}},
    fetch:async url=>{fetched=url;return {ok:true,headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}};
  vm.runInNewContext(readFileSync(require.resolve('./background.js'),'utf8'),context);
  const result=await new Promise(resolve=>listener(message,{},resolve));
  return {fetched,result};
}
test('thumbnail retry preserves the preview URL and transformations',async()=>{
  const url='https://hbimg.huabanimg.com/'+ 'a'.repeat(40)+'_fw236/format/webp?width=236';
  const preview=await request({type:'image',url,thumbnail:true});
  assert.equal(preview.fetched,url);
  assert.equal(preview.result.data,'AQID');
  const original=await request({type:'image',url});
  assert.equal(original.fetched,originalImageUrl(url));
});
test('thumbnail retry rejects unrelated hosts',async()=>{
  const {fetched,result}=await request({type:'image',url:'https://example.com/image.jpg',thumbnail:true});
  assert.equal(fetched,undefined);
  assert.ok(result.error);
});
