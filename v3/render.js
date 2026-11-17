'use strict';
addEventListener('message',async event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='v3-render')return;
 const {render,from,side,fonts,contract,nonce}=event.data;
 try{
  const black=new FontFace('CookieRun',`url(${fonts.black})`,{weight:'900'}),bold=new FontFace('CookieRunBold',`url(${fonts.bold})`);
  await Promise.all([black.load(),bold.load()]);document.fonts.add(black);document.fonts.add(bold);window.FACTORY_CONTRACT=contract;
  await drawFactory(render,from,side);const inspection=inspectRender();document.documentElement.dataset.ready='1';parent.postMessage({type:'v3-render-result',nonce,inspection},location.origin);
 }catch(e){document.querySelector('#mount').textContent='렌더 오류: '+e.message;parent.postMessage({type:'v3-render-result',nonce,error:e.message},location.origin);}
});
parent.postMessage({type:'v3-render-ready'},location.origin);
