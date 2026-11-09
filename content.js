(() => {
  let hovered=null, directory=null, busy=false;
  const panel=document.createElement('div');
  panel.style.cssText='position:fixed;right:18px;bottom:20px;z-index:2147483647;background:#fff;color:#222;padding:12px;border:1px solid #ddd;border-radius:10px;box-shadow:0 2px 14px #0003;font:14px sans-serif';
  const button=document.createElement('button'); button.textContent='选择素材文件夹';
  const status=document.createElement('span'); status.textContent='  悬停或查看大图，按 Z 下载';
  panel.append(button,status); document.documentElement.append(panel);
  const say=t=>status.textContent='  '+t;
  const db=new Promise((resolve,reject)=>{
    const req=indexedDB.open('huaban-independent-downloader',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('settings');
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  const ready=db.then(d=>new Promise((resolve,reject)=>{
    const r=d.transaction('settings').objectStore('settings').get('directory');
    r.onsuccess=()=>{directory=r.result;if(directory)button.textContent='文件夹：'+directory.name;resolve();};r.onerror=()=>reject(r.error);
  })).catch(()=>say('无法恢复文件夹，请重新选择'));
  button.onclick=async()=>{
    try {
      directory=await window.showDirectoryPicker({mode:'readwrite',id:'huaban-materials'});
      const d=await db;
      await new Promise((resolve,reject)=>{const tx=d.transaction('settings','readwrite');tx.objectStore('settings').put(directory,'directory');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      button.textContent='文件夹：'+directory.name; say('已就绪，按 Z 下载');
    }catch(e){if(e.name!=='AbortError')say(e.message);}
  };
  document.addEventListener('pointerover',e=>{hovered=e.target instanceof HTMLImageElement?e.target:null;},true);
  function visible(img){const r=img.getBoundingClientRect();return r.width>100&&r.height>100&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&getComputedStyle(img).visibility!=='hidden'&&getComputedStyle(img).display!=='none';}
  function candidate(){
    const images=[...document.images].filter(visible);
    const dialogs=[...document.querySelectorAll('[role="dialog"],dialog[open]')];
    const detail=images.filter(i=>dialogs.some(d=>d.contains(i)));
    const largest=list=>list.sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return y.width*y.height-x.width*x.height;})[0];
    if(detail.length)return largest(detail);
    if(/\/pins\/[^/]+/.test(location.pathname))return largest(images);
    return hovered&&visible(hovered)?hovered:null;
  }
  document.addEventListener('keydown',async e=>{
    if(e.code!=='KeyZ'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||e.isComposing)return;
    if(e.composedPath().some(n=>n instanceof HTMLElement&&(n.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName))))return;
    const img=candidate(); if(!img||busy)return;
    e.preventDefault();
    if(!directory){say('请先点击“选择素材文件夹”');return;}
    busy=true;
    try {
      // Request permission directly inside the keyboard gesture, before network I/O.
      if(await directory.requestPermission({mode:'readwrite'})!=='granted')throw Error('需要文件夹写入授权');
      say('正在保存…');
      let url=new URL(img.currentSrc||img.src,location.href);
      // Huaban CDN thumbnail transformations follow an underscore after the asset key.
      if(/(^|\.)huabanimg\.com$/.test(url.hostname))url.pathname=url.pathname.replace(/_[^/]*$/,'');
      const result=await chrome.runtime.sendMessage({type:'image',url:url.href});
      if(result.error)throw Error(result.error);
      const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'})[result.mime]||'img';
      const name='花瓣_'+Date.now()+'_'+crypto.randomUUID().slice(0,8)+'.'+ext;
      const file=await directory.getFileHandle(name,{create:true});
      const stream=await file.createWritable();
      try{await stream.write(Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)));await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}
      say('已保存：'+name);
    }catch(e){say('保存失败：'+e.message);}finally{busy=false;}
  },true);
})();
