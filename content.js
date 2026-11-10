(() => {
  let hovered=null, directory=null, busy=false;
  const panel=document.createElement('div');
  panel.style.cssText='position:fixed;right:18px;bottom:20px;z-index:2147483647;background:#fff;color:#222;padding:12px;border:1px solid #ddd;border-radius:10px;box-shadow:0 2px 14px #0003;font:14px sans-serif';
  const button=document.createElement('button'); button.textContent='选择素材文件夹';
  const status=document.createElement('span'); status.textContent='  悬停或查看大图，按 Z 下载';
  panel.append(button,status); document.documentElement.append(panel);
  const say=t=>status.textContent='  '+t;
  const refreshHint='扩展已更新或重新加载，请刷新此花瓣页面后再按 Z';
  function runtimeAvailable(){
    try{return !!globalThis.chrome?.runtime?.id && typeof globalThis.chrome.runtime.sendMessage==='function';}catch{return false;}
  }
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
  const selectionBox=document.createElement('div');
  // Keep the page-space selection below the site's fixed navigation layers.
  selectionBox.style.cssText='position:absolute;pointer-events:none;z-index:1;border:1px solid #369cff;background:rgba(70,160,255,.18);box-sizing:border-box;display:none';
  document.documentElement.append(selectionBox);
  const selectionStyle=document.createElement('style');
  selectionStyle.textContent='.huaban-download-selected{outline:3px solid #369cff!important;outline-offset:-3px!important}';
  document.documentElement.append(selectionStyle);
  let selection=null, dragging=false, pointer=null, suppressClick=false;
  let selected=[];
  function singleImageView(){
    if(/\/pins\/[^/]+/.test(location.pathname))return true;
    return [...document.querySelectorAll('[role="dialog"],dialog[open]')].some(dialog=>
      [...dialog.querySelectorAll('img')].some(visible));
  }
  function resetForSingleImage(){
    if(!singleImageView())return false;
    pointer=null;dragging=false;
    if(selection){clearSelection();if(!busy)say('单图浏览，按 Z 下载当前大图');}
    return true;
  }
  // Huaban changes views without reloading the content script.
  new MutationObserver(()=>{if(selection||pointer)resetForSingleImage();})
    .observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('popstate',resetForSingleImage);
  const editable=n=>n instanceof HTMLElement&&(n.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(n.tagName));
  function clearSelection(){
    selected.forEach(img=>img.classList.remove('huaban-download-selected'));
    selected=[]; selection=null; selectionBox.style.display='none';
  }
  function updateSelection(){
    if(resetForSingleImage())return;
    if(!selection)return;
    const left=Math.min(selection.x1,selection.x2), top=Math.min(selection.y1,selection.y2);
    const right=Math.max(selection.x1,selection.x2), bottom=Math.max(selection.y1,selection.y2);
    Object.assign(selectionBox.style,{display:'block',left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
    selected.forEach(img=>img.classList.remove('huaban-download-selected'));
    selected=[...document.images].filter(img=>{
      const r=img.getBoundingClientRect(), style=getComputedStyle(img);
      return r.width>100&&r.height>100&&style.visibility!=='hidden'&&style.display!=='none'&&
        /(^|\.)(huabanimg\.com|huaban\.com)$/.test((()=>{try{return new URL(img.currentSrc||img.src).hostname;}catch{return '';}})())&&
        r.right+scrollX>left&&r.left+scrollX<right&&r.bottom+scrollY>top&&r.top+scrollY<bottom;
    });
    selected.forEach(img=>img.classList.add('huaban-download-selected'));
    if(!busy)say('已框选 '+selected.length+' 张，按 Z 下载，Esc 清除');
  }
  document.addEventListener('pointerdown',e=>{
    if(resetForSingleImage())return;
    if(e.button!==0||e.pointerType!=='mouse'||busy||panel.contains(e.target)||e.composedPath().some(editable))return;
    pointer={x:e.clientX,y:e.clientY,startX:e.pageX,startY:e.pageY}; dragging=false;
  },true);
  document.addEventListener('pointermove',e=>{
    if(!pointer)return;
    if(resetForSingleImage())return;
    pointer.x=e.clientX;pointer.y=e.clientY;
    if(!dragging&&Math.hypot(e.pageX-pointer.startX,e.pageY-pointer.startY)<6)return;
    if(!dragging){clearSelection();dragging=true;selection={x1:pointer.startX,y1:pointer.startY};}
    selection.x2=e.pageX;selection.y2=e.pageY;
    e.preventDefault();window.getSelection()?.removeAllRanges();updateSelection();
  },true);
  document.addEventListener('dragstart',e=>{if(pointer)e.preventDefault();},true);
  document.addEventListener('selectstart',e=>{if(pointer)e.preventDefault();},true);
  function finishSelection(){if(dragging){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}pointer=null;dragging=false;}
  document.addEventListener('pointerup',finishSelection,true);
  document.addEventListener('pointercancel',finishSelection,true);
  window.addEventListener('blur',finishSelection);
  document.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopImmediatePropagation();}},true);
  window.addEventListener('scroll',()=>{
    if(dragging&&pointer){selection.x2=pointer.x+scrollX;selection.y2=pointer.y+scrollY;updateSelection();}
  },{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){finishSelection();clearSelection();say('已清除框选，悬停图片按 Z 下载');}},true);
  document.addEventListener('keydown',async e=>{
    if(e.code!=='KeyZ'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.shiftKey||e.isComposing)return;
    if(e.composedPath().some(n=>n instanceof HTMLElement&&(n.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName))))return;
    resetForSingleImage();
    const images=selection?selected.slice():[candidate()].filter(Boolean); if(!images.length||busy)return;
    const urls=[...new Set(images.map(img=>new URL(img.currentSrc||img.src,location.href).href))];
    e.preventDefault();
    if(!runtimeAvailable()){say(refreshHint);return;}
    if(!directory){say('请先点击“选择素材文件夹”');return;}
    busy=true;
    try {
      // Request permission directly inside the keyboard gesture, before network I/O.
      if(await directory.requestPermission({mode:'readwrite'})!=='granted')throw Error('需要文件夹写入授权');
      let saved=0, failed=0, lastError='';
      for(const url of urls){
      say('正在保存 '+(saved+failed+1)+' / '+urls.length+'…');
      try {
      if(!runtimeAvailable())throw Error(refreshHint);
      const result=await chrome.runtime.sendMessage({type:'image',url});
      if(!result)throw Error('后台没有返回结果，请重新加载扩展并刷新此页面');
      if(result.error)throw Error(result.error);
      const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'})[result.mime]||'img';
      const name='花瓣_'+Date.now()+'_'+crypto.randomUUID().slice(0,8)+'.'+ext;
      const file=await directory.getFileHandle(name,{create:true});
      const stream=await file.createWritable();
      try{await stream.write(Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)));await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}
      saved++;
      }catch(error){failed++;lastError=error.message;}
      }
      say('已保存 '+saved+' 张'+(failed?'，失败 '+failed+' 张：'+lastError:''));
    }catch(e){say(!runtimeAvailable()||/Extension context invalidated/i.test(e.message)?refreshHint:'保存失败：'+e.message);}finally{busy=false;}
  },true);
})();
