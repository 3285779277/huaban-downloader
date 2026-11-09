/* Shared by the service worker and URL regression tests. */
function originalImageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/(^|\.)(huabanimg\.com|huaban\.com)$/.test(url.hostname)) throw Error('仅支持花瓣图片域名');
  const imageHost = /(^|\.)huabanimg\.com$/.test(url.hostname) || /(^|\.)[\w-]*hbimg(?:-edge)?\.huaban\.com$/.test(url.hostname);
  if (!imageHost) throw Error('当前链接不是花瓣图片 CDN 地址');
  // Resize suffixes belong to the asset segment, not necessarily the end of
  // the pathname: /KEY_fw658/format/webp must become /KEY.
  const match = url.pathname.match(/^\/([a-f\d]{32,}(?:-[A-Za-z\d]+)?)(?:_[^/]*)?(?:\/.*)?$/i);
  if (match) url.pathname = '/' + match[1];
  else {
    url.pathname = url.pathname.replace(/_(?:fw|fh|sq|mw|mh)\d+[^/]*(?:\/.*)?$/i, '').replace(/\/format\/(?:webp|avif|jpeg|jpg|png).*$/i, '');
  }
  // Preserve signatures/authentication; remove only known image transforms.
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:imageView2?|imageMogr2|x-oss-process|image_process|width|height|w|h|quality|format)$/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.href;
}
if (typeof module !== 'undefined') module.exports = {originalImageUrl};
