const {test}=require('node:test');
const assert=require('node:assert/strict');
const {originalImageUrl}=require('./image-url');
const key='f4222449cb11ee162a75eb366572cfc80738e1171b47d-exEtQp';
for(const host of ['hbimg.huabanimg.com','hbimg.huaban.com','gd-hbimg.huaban.com','gd-hbimg-edge.huaban.com']) {
  for(const suffix of ['_fw236','_fw658/format/webp','_fw1200/format/avif','/format/webp','']) {
    test(host+suffix,()=>assert.equal(originalImageUrl(`https://${host}/${key}${suffix}`),`https://${host}/${key}`));
  }
}
test('preserves authentication while removing transformations',()=>assert.equal(originalImageUrl(`https://hbimg.huabanimg.com/${key}_fw658/format/webp?width=236&x-oss-process=image%2Fresize&token=abc&expires=123`),`https://hbimg.huabanimg.com/${key}?token=abc&expires=123`));
test('rejects unrelated hosts and protocols',()=>{
  for(const url of ['https://evil.com/a','https://huabanimg.com.evil.com/a','http://hbimg.huabanimg.com/a','https://huaban.com/pins/123']) assert.throws(()=>originalImageUrl(url));
});
