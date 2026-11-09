importScripts('image-url.js');
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type !== 'image') return;
  (async () => {
    const u = new URL(originalImageUrl(msg.url));
    if (u.protocol !== 'https:' || !/(^|\.)(huabanimg\.com|huaban\.com)$/.test(u.hostname)) throw Error('仅支持花瓣图片域名');
    const response = await fetch(u.href, {credentials:'omit'});
    if (!response.ok) throw Error('图片请求失败：' + response.status);
    const mime = (response.headers.get('content-type') || '').split(';')[0];
    if (!mime.startsWith('image/')) throw Error('链接没有返回图片');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 40 * 1024 * 1024) throw Error('图片超过 40MB');
    let binary = '';
    for(let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    reply({data:btoa(binary),mime});
  })().catch(e=>reply({error:e.message}));
  return true;
});
