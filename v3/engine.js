// Same crop preparation and renderers as the curated review page.
  const imgCache = {}, cropCache = {};
  function loadImg(src) {
    if (imgCache[src]) return imgCache[src];
    const job = new Promise((ok) => {
      let attempt = 0;
      const start = () => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = () => { if (++attempt < 3) setTimeout(start, attempt === 1 ? 100 : 250); else ok(null); };
        let url = src;
        if (attempt && !String(src).startsWith("data:")) { const u = new URL(src, document.baseURI); u.searchParams.set("_image_retry", attempt); url = u.href; }
        im.src = url;
      };
      start();
    });
    // Keep browsing thousands of originals from retaining all decoded PNGs.
    const oldImages = Object.keys(imgCache);
    if (oldImages.length >= 64) delete imgCache[oldImages[0]];
    imgCache[src] = job;
    job.then(im => { if (!im && imgCache[src] === job) delete imgCache[src]; });
    return job;
  }
  async function cut(src, box, clear) {
    const k = src + "|" + box.join(",") + "|" + clear;
    if (cropCache[k]) return cropCache[k];
    const im = await loadImg(src);
    if (!im) return "";
    const [x0, y0, x1, y1] = box.map(Math.round), w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.drawImage(im, x0, y0, w, h, 0, 0, w, h);
    if (clear) { const d = g.getImageData(0, 0, w, h), p = d.data; for (let i = 0; i < p.length; i += 4) if (Math.min(p[i], p[i + 1], p[i + 2]) >= 246) p[i + 3] = 0; g.putImageData(d, 0, 0); }
    // Scoped edge-connected background cleanup for extracted illustration objects.
    if(clear==="gray"||clear==="green"){const d=g.getImageData(0,0,w,h),p=d.data,seen=new Uint8Array(w*h),q=[];const visit=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const i=y*w+x;if(seen[i])return;seen[i]=1;const k=i*4,r=p[k],gg=p[k+1],b=p[k+2],match=p[k+3]===0||(clear==="gray"?Math.min(r,gg,b)>125&&Math.max(r,gg,b)-Math.min(r,gg,b)<35:r>65&&gg>r*.9&&gg>b*1.2);if(match){p[k+3]=0;q.push(i)}};for(let x=0;x<w;x++){visit(x,0);visit(x,h-1)}for(let y=0;y<h;y++){visit(0,y);visit(w-1,y)}for(let i=0;i<q.length;i++){const n=q[i],x=n%w,y=Math.floor(n/w);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1)}g.putImageData(d,0,0);}
    const oldCrops = Object.keys(cropCache);
    if (oldCrops.length >= 512) delete cropCache[oldCrops[0]];
    return cropCache[k] = c.toDataURL();
  }
  async function fillCrops(content, from) {
    const c = JSON.parse(JSON.stringify(content || {}));
    if (!from) return c;
    const jobs = [];
    const walk = (b) => {
      if (!b || typeof b !== "object") return;
      if (Array.isArray(b)) { b.forEach(walk); return; }
      const k = b.kind;
      if (k === "icons" && b.crop && !b.src) jobs.push(cut(from, b.crop, b.crop_clear31||true).then((u) => { b.src = u; b._crop = 1; }));
      if (k === "pic" && b.crop && !b.src) { jobs.push(cut(from, b.crop, false).then((u) => { b.src = u; })); if (!b.h && !b.w) b.h = b.crop[3] - b.crop[1]; }
      if (k === "pictograph" && Array.isArray(b.crop) && !b.srcs) { b.srcs = []; b.crop.forEach((box, i) => jobs.push(cut(from, box, true).then((u) => { b.srcs[i] = u; }))); }
      if (k === "balance" || k === "ruler") [...(b.left || []), ...(b.right || []), ...(b.objects || [])].forEach((it) => {
        if (it.crop && !it.src) { jobs.push(cut(from, it.crop, true).then((u) => { it.src = u; })); it.ar = (it.crop[3] - it.crop[1]) / Math.max(1, it.crop[2] - it.crop[0]); }
      });
      if (k === "speech") (b.items || []).forEach((it) => { if (it.crop && !it.src) jobs.push(cut(from, it.crop, true).then((u) => { it.src = u; })); });
      Object.values(b).forEach((v) => { if (v && typeof v === "object") walk(v); });
    };
    walk(c.body);
    await Promise.all(jobs);
    return c;
  }


window.drawFactory=async(render,from,side)=>{await Promise.all([document.fonts.load('900 36px CookieRun'),document.fonts.load('400 36px CookieRunBold')]);const content=await fillCrops(render.content,from),item={...render,content};(side==='a'?renderAnswer:renderQuestion)(item,document.querySelector('#mount'));await window.applyVisualPresentation?.(document.querySelector('#mount'),window.FACTORY_CONTRACT,side,content,from);await whenReady(document.querySelector('#mount'));};
window.inspectRender=()=>{const root=document.querySelector('#mount'),errors=[];for(const im of root.querySelectorAll('img'))if(!im.naturalWidth)errors.push('이미지 누락: '+im.src.slice(0,160));const cv=root.querySelector('.canvas');if(!cv||cv.offsetWidth!==1024||cv.offsetHeight!==576)errors.push('캔버스 크기 불일치');const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);for(let n=walker.nextNode();n;n=walker.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.left< -1||r.top< -1||r.right>1025||r.bottom>577)errors.push('화면 밖 글자: '+n.textContent.slice(0,60));}for(const box of root.querySelectorAll('.r-textcard,.r-expr,.r-cards .card')){const br=box.getBoundingClientRect(),nodes=[...box.children].filter(e=>getComputedStyle(e).position==='absolute'&&(e.textContent.trim()||e.querySelector('.blank-box'))),rects=[];for(const n of nodes){const range=document.createRange();range.selectNodeContents(n);const r=n.querySelector('.blank-box')?.getBoundingClientRect()||range.getBoundingClientRect();if(r.width&&r.height){if(r.left<br.left-3||r.right>br.right+3||r.top<br.top-3||r.bottom>br.bottom+3)errors.push('본문 슬롯 밖 글자·답칸');rects.push(r)}}for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j],w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(w>3&&h>3)errors.push('본문 슬롯 겹침')}}for(const line of root.querySelectorAll('.answer-body .line')){const nodes=[...line.children].filter(e=>getComputedStyle(e).position==='absolute'),rects=nodes.map(e=>e.getBoundingClientRect());for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3)errors.push('해설 토큰 겹침')}}const zoom=parseFloat(root.querySelector('.body')?.style.zoom||'1');if(zoom<.999&&!root.querySelector('.body')?.dataset.fit)errors.push('본문 자동 축소 발생');return {errors:[...new Set(errors)],width:cv?.offsetWidth,height:cv?.offsetHeight,zoom};};

const inspectBase=window.inspectRender;
window.inspectRender=()=>{
 const base=inspectBase(),root=document.querySelector('#mount'),errors=[...base.errors],rule_results=[],contract=window.FACTORY_CONTRACT||{};
 const title=root.querySelector('.title');let titleLines=0;
 if(title&&title.textContent.trim()) {const r=document.createRange();r.selectNodeContents(title);titleLines=new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top/10))).size;if(titleLines>1&&title.textContent.trim()!=='다음 물음에 답하세요.')errors.push('INS-01: 두 줄 발문은 본문 분리 규칙이 필요합니다');}
 const area=root.querySelector('.content');
 if(area){const canvas=root.querySelector('.canvas'),cr=canvas.getBoundingClientRect(),declared=contract.layout?.body_area,top=parseFloat(getComputedStyle(canvas).getPropertyValue('--content-top'));const bounds=declared&&typeof declared==='object'?{left:declared.x,top:declared.y,right:declared.x+declared.w,bottom:declared.y+declared.h,width:declared.w,height:declared.h,x:declared.x,y:declared.y}:{left:cr.left,top:cr.top+top,right:cr.right,bottom:cr.bottom,width:cr.width,height:cr.height-top,x:cr.left,y:cr.top+top};const rects=[];const walk=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);for(let n=walk.nextNode();n;n=walk.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);rects.push(...r.getClientRects());}for(const e of area.querySelectorAll('img,svg,canvas,.blank-box'))rects.push(e.getBoundingClientRect());for(const r of rects){if(r.width<.5||r.height<.5)continue;if(r.left<bounds.left-.5||r.right>bounds.right+.5||r.top<bounds.top-.5||r.bottom>bounds.bottom+.5)errors.push('LAY-01: 실제 본문·보기 영역 이탈');for(const box of contract.layout?.reserved_boxes||[]){if(Math.min(r.right,box.x+box.w)-Math.max(r.left,box.x)>.5&&Math.min(r.bottom,box.y+box.h)-Math.max(r.top,box.y)>.5)errors.push('LAY-02: 예약 영역 침범');}}rule_results.push({rule:'LAY-01',basis:'declared body guide or canvas role --content-top; not the Hug group bounds',bounds:{x:bounds.x,y:bounds.y,w:bounds.width,h:bounds.height}});}
 for(const box of root.querySelectorAll('.blank-box'))if(!['rgb(255, 255, 255)','rgba(255, 255, 255, 1)'].includes(getComputedStyle(box).backgroundColor))errors.push('INS-02: 답칸 흰 채움 필요');
 const faces=[...document.fonts];if(!['CookieRun','CookieRunBold'].every(name=>faces.some(f=>f.family.replace(/[\"']/g,'')===name&&f.status==='loaded')))errors.push('TXT-01: 역할별 폰트 로드 실패');
 rule_results.push({rule:'INS-01',titleLines},{rule:'QA-01',rendered:true},{rule:'reserved_area',status:(contract.layout?.reserved_boxes||[]).length?'checked':'not_applicable_browser_png',note:'Figma 숨김 가이드를 검사했다는 뜻이 아님'});
 return {...base,errors:[...new Set(errors)],rule_results};
};
