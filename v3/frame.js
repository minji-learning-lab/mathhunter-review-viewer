/* 문제/해설 공통 틀 렌더러.
 *
 * item: questionPool 문항 + content
 *   content.q_text        제목. <u>강조</u>, {3/4} 분수, {1 3/4} 대분수, [] 빈 네모 칸
 *   content.title_image   제목 띠 그림 경로. 제목에 그림 기호가 섞여 글자로 못 쓰는 문항에 쓴다 (캔버스 맨 위 0~70px)
 *   content.body          본문 블록 배열 [{kind, ...}]. kind 별 그리기는 RENDERERS
 *   content.body_dir      "column"(기본, 위→아래) | "row"(좌→우)
 *   content.option_text   보기 글자 배열. 없으면 options 를 "@"로 나눈 값
 *   content.options_in_body  true 면 보기 줄을 그리지 않는다 (본문 렌더러가 그림)
 *   content.option_gap    본문→보기 간격(px) 덮어쓰기
 *   content.option_spacing  보기 사이 간격(px) 덮어쓰기
 *   content.body_top      본문 상자 위쪽 y(px). 주면 세로 가운데 정렬 대신 이 위치에 둔다
 *   content.body_shift_x  본문을 가운데(x=512)에서 옮길 거리(px). 원본 5%만 가운데가 아니다
 *   content.body_fit      [w, h] 원본 본문 크기(px). 그린 본문을 이 상자에 맞게 늘이거나 줄인다(0.6~1.6배)
 *   (위 네 값은 기존 문항을 원본과 똑같이 옮길 때 원본에서 잰 값을 넣는다)
 *   content.a_text        해설 본문. 줄은 "\n"
 *
 * 본문 렌더러는 FrameRenderers.register(kind, fn) 로 추가한다. fn(block) → HTMLElement
 */
(function () {
  /* 보기 간격: 원본 3,013문항에서 가장 넓은 보기 너비(w)에 따라 줄어든다.
     3지선다 w≤60 이면 131px, w=200 이면 약 50px. 4지선다는 106px 에서 시작 */
  const OPTION_SPACING = { 2: [160, 60], 3: [131, 48], 4: [106, 44], 5: [90, 36] };

  function layoutOptions(root) {
    root.querySelectorAll(".options").forEach((row) => {
      const opts = [...row.children];
      const [max, min] = OPTION_SPACING[opts.length] || OPTION_SPACING[3];
      let gap = Number(row.dataset.spacing);
      if (!row.dataset.spacing) {
        const w = Math.max(...opts.map((o) => o.getBoundingClientRect().width));
        gap = Math.round(Math.min(max, Math.max(min, max - 0.6 * (w - 60))));
      }
      row.style.gap = gap + "px";
    });
  }

  /* AI 가 어림한 크기를 원본 본문 크기에 맞춘다. zoom 은 배치에도 반영돼 보기 줄이 따라 움직인다 */
  function fitBodies(root) {
    root.querySelectorAll(".body[data-fit]").forEach((body) => {
      const [w, h] = body.dataset.fit.split(",").map(Number);
      const r = inkRect(body);
      if (!r.width || !r.height) return;
      const s = Math.min(3, Math.max(0.5, Math.min(w / r.width, h / r.height)));
      body.style.zoom = s.toFixed(3);
    });
  }

  /* 본문에서 실제로 보이는 부분(글자, 채움·테두리 있는 상자, 그림)만 둘러싼 사각형.
   * 블록 요소는 폭이 줄 전체라 body 상자로 재면 원본과 비율이 틀어진다 */
  function inkRect(body) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (r) => {
      if (!r.width && !r.height) return;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    };
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3) {
        if (!n.textContent.trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) add(r);
        continue;
      }
      const tag = n.tagName.toLowerCase();
      const cs = getComputedStyle(n);
      const boxed = cs.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(cs.borderTopWidth) > 0 ||
        parseFloat(cs.borderBottomWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
      // SVG 는 그림 상자 전체가 아니라 안의 선·도형만 잰다 (도형 그림은 여백이 크다)
      if (n instanceof SVGGraphicsElement && !["svg", "g", "foreignobject"].includes(tag)) { add(n.getBoundingClientRect()); continue; }
      if (tag === "img" || (boxed && !(n instanceof SVGElement))) add(n.getBoundingClientRect());
    }
    if (x1 < x0) return body.getBoundingClientRect();
    return { width: x1 - x0, height: y1 - y0, left: x0, top: y0, right: x1, bottom: y1 };
  }

  /* 본문을 원본 크기로 맞춘 뒤 보기 줄이나 본문이 화면(1024×576) 밖으로 나가면 본문을 조금씩 줄인다.
   * 원본은 보기를 본문 오른쪽에 세로로 두는데 틀은 아래에 두는 문항에서 생긴다 */
  function keepInside(root) {
    const cv = root.querySelector(".canvas"), body = root.querySelector(".body");
    if (!cv || !body) return;
    const c = cv.getBoundingClientRect(), opts = root.querySelector(".options");
    // 본문과 보기 줄만 잰다(원본 제목 띠 그림은 폭이 화면 전체라 넣으면 늘 넘친 것으로 보인다)
    const ext = () => [inkRect(body), opts && inkRect(opts)].filter((r) => r && r.right !== undefined)
      .reduce((a, r) => ({ left: Math.min(a.left, r.left), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, right: -Infinity, bottom: -Infinity });
    for (let k = 0; k < 14; k++) {
      const r = ext();
      if (r.bottom <= c.top + 568 && r.right <= c.left + 1018 && r.left >= c.left + 6) break;
      body.style.zoom = (parseFloat(body.style.zoom || 1) * 0.92).toFixed(3);
      layoutOptions(root);
    }
  }

  const CIRCLED = ["①", "②", "③", "④", "⑤"];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* 글자 마크업: 이스케이프 후 <u>, 분수만 되살린다 */
  function inline(s) {
    let h = escapeHtml(s ?? "");
    h = h.replace(/&lt;u&gt;/g, "<u>").replace(/&lt;\/u&gt;/g, "</u>");
    // {1 3/4} 는 대분수, {2 × 3/5 × 3} 처럼 분자에 공백이 있으면 그냥 분수.
    // 빈칸·낱자음 span 보다 먼저 바꾼다: span 의 "</" 가 분수 식의 "/" 로 읽혀 {[]/6} 이 깨졌다
    h = h.replace(/\{(?:(\d+)\s+(?=[^{}\s\/]+\/))?([^{}\/]+)\/([^{}\/]+)\}/g, (_, whole, num, den) => {
      const frac = `<span class="frac"><span>${num}</span><span>${den}</span></span>`;
      return whole ? `<span class="mixed">${whole}${frac}</span>` : frac;
    });
    h = h.replace(/\[\]/g, '<span class="blank-box"></span>');
    // 기호로 쓰는 낱자음(ㄱ, ㄴ, ㄷ …)
    h = h.replace(/[ㄱ-ㅎ]/g, (j) => `<span class="jamo">${j}</span>`);
    return h;
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  const RENDERERS = {
    image(b) {
      const img = el("img", "block-image");
      img.src = b.src;
      if (b.w) img.style.width = b.w + "px";
      if (b.h) img.style.height = b.h + "px";
      return img;
    },
    text(b) {
      const e = el("div", "block-text", inline(b.text));
      if (b.size) e.style.fontSize = b.size + "px";
      if(b.font_family){e.style.fontFamily=b.font_family;e.style.fontWeight=b.font_weight??400;}
      if(b.text_stroke!==undefined)e.style.webkitTextStroke=b.text_stroke+"px "+(b.ink||"#343434");
      if(b.text_filter)e.style.filter=b.text_filter;
      if (b.align) e.style.textAlign = b.align;
      if(b.w)e.style.width=b.w+"px";
      if(b.line_height)e.style.lineHeight=b.line_height;
      if(b.letter_spacing!==undefined)e.style.letterSpacing=b.letter_spacing+"em";
      if(b.symbol_colors){const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),nodes=[];for(let t=walker.nextNode();t;t=walker.nextNode())nodes.push(t);for(const t of nodes){const fragment=document.createDocumentFragment();for(const c of t.textContent){if(b.symbol_colors[c]){const span=document.createElement("span");span.textContent=c;span.style.color=b.symbol_colors[c];fragment.appendChild(span);}else fragment.appendChild(document.createTextNode(c));}t.replaceWith(fragment);}}
      if(b.nowrap)e.style.whiteSpace="pre";
      if(b.measured_lines){e.innerHTML="";e.style.position="relative";String(b.text).split("\n").forEach((line,i)=>{const p=b.measured_lines[i],t=el("div",null,inline(line));if(!p)return;Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??b.size)+"px",letterSpacing:(p.letter_spacing??0)+"px",transform:p.scale_x!==undefined?`scaleX(${p.scale_x})`:"none",transformOrigin:"0 0",lineHeight:"1",whiteSpace:"pre"});e.appendChild(t)});}

      if(b.blank_size)e.style.setProperty("--blank-size",b.blank_size+"px");
      if(b.blank_width)e.style.setProperty("--blank-width",b.blank_width+"px");
      if(b.blank_height)e.style.setProperty("--blank-height",b.blank_height+"px");
      if(b.blank_bw)e.style.setProperty("--blank-border",b.blank_bw+"px");
      return e;
    },
  };

  function renderBlock(b) {
    const fn = RENDERERS[b.kind];
    if (!fn) throw new Error("알 수 없는 본문 블록: " + b.kind);
    return fn(b);
  }

  function optionTexts(item) {
    const c = item.content || {};
    if (c.option_text) return c.option_text;
    if (item.type !== "객관식" || !item.options || item.options === "-") return [];
    return item.options.split("@");
  }

  function renderQuestion(item, root) {
    const c = item.content || {};
    root.innerHTML = "";
    const canvas = el("div", "canvas question");
    if (c.title_image) {
      // 제목 안에 그림 기호가 있는 문항: 원본 제목 띠를 그대로 놓는다
      const t = el("img", "title-image");
      t.src = c.title_image;
      canvas.appendChild(t);
    } else {
      const title = el("div", "title", inline(c.q_text));
      if(c.title_size!==undefined)title.style.fontSize=c.title_size+"px";
      if(c.title_inset!==undefined){title.style.left=c.title_inset+"px";title.style.right=c.title_inset+"px";}
      if(c.title_style)Object.assign(title.style,c.title_style);
      canvas.appendChild(title);
    }

    const content = el("div", "content");
    const body = el("div", "body" + (c.body_dir === "row" ? " row" : ""));
    (c.body || []).forEach((b) => body.appendChild(renderBlock(b)));
    content.appendChild(body);

    const opts = c.options_in_body ? [] : optionTexts(item);
    if (opts.length) {
      content.classList.add("has-options");
      const gap = el("div", "opt-gap");
      if (c.option_gap !== undefined) {
        // 원본에서 잰 간격은 그대로 쓰고, 본문 최소 높이·간격 줄이기 규칙은 끈다
        gap.style.flex = `0 0 ${c.option_gap}px`;
        gap.style.minHeight = "0";
        body.style.minHeight = "0";
      }
      content.appendChild(gap);
      const row = el("div", "options");
      if (c.option_spacing !== undefined) row.dataset.spacing = c.option_spacing;
      if(c.option_layout){if(c.option_layout.gap!==undefined)row.dataset.spacing=c.option_layout.gap;if(c.option_layout.style)Object.assign(row.style,c.option_layout.style);}
      if(c.option_shift)row.style.transform=`translate(${c.option_shift[0]}px,${c.option_shift[1]}px)`;
      opts.forEach((t, i) => {
        row.appendChild(el("span", "option", `<span class="mark">${CIRCLED[i]}</span><span>${inline(t)}</span>`));
      });
      if(c.option_layout?.mark_vector){const a=c.option_layout.mark_vector,ns="http://www.w3.org/2000/svg",size=a.size??32,bw=a.bw??3;row.querySelectorAll(".mark").forEach((m,i)=>{const s=document.createElementNS(ns,"svg"),circle=document.createElementNS(ns,"circle"),text=document.createElementNS(ns,"text");s.setAttribute("width",size);s.setAttribute("height",size);s.setAttribute("viewBox",`0 0 ${size} ${size}`);for(const[k,v]of Object.entries({cx:size/2,cy:size/2,r:(size-bw)/2,stroke:a.color||"#343434","stroke-width":bw,fill:"none"}))circle.setAttribute(k,v);for(const[k,v]of Object.entries({x:size/2+(a.text_dx??0),y:size/2+(a.text_size??22)*.35+(a.text_dy??0),"text-anchor":"middle","font-family":a.font_family||"Arial","font-weight":a.font_weight??700,"font-size":a.text_size??22,fill:a.color||"#343434"}))text.setAttribute(k,v);text.textContent=String(i+1);s.append(circle,text);m.replaceChildren(s);Object.assign(m.style,{display:"inline-flex",width:size+"px",height:size+"px",lineHeight:"0"});});}
      if(c.option_layout){if(c.option_layout.mark_style)row.querySelectorAll(".mark").forEach(x=>Object.assign(x.style,c.option_layout.mark_style));}
      if(c.option_layout?.item_styles)row.querySelectorAll(".option").forEach((x,i)=>Object.assign(x.style,c.option_layout.item_styles[i]||{}));
      if(c.option_layout?.parts)row.querySelectorAll(".option").forEach((x,i)=>[...x.children].forEach((p,j)=>Object.assign(p.style,c.option_layout.parts[i]?.[j]||{})));
      content.appendChild(row);
    }
    if (c.body_top !== undefined) {
      // 기존 문항 전환: 원본 본문 위치에 그대로 둔다
      content.style.top = c.body_top + "px";
      content.style.bottom = "auto";
      content.style.justifyContent = "flex-start";
    }
    if (c.body_shift_x) body.style.transform = `translateX(${c.body_shift_x}px)`;
    if (c.body_fit) body.dataset.fit = c.body_fit.join(",");
    canvas.appendChild(content);
    root.appendChild(canvas);
    return canvas;
  }

  function renderAnswer(item, root) {
    const c = item.content || {};
    root.innerHTML = "";
    const canvas = el("div", "canvas answer");
    canvas.appendChild(el("div", "answer-header", "해설"));
    // 분수가 한 줄이라도 있으면 모든 줄 간격이 60px → 72px 로 넓어진다 (원본 1,105장 측정)
    const text = c.a_text || "";
    const body = el("div", "answer-body" + (/\{[^{}]*\/[^{}]*\}/.test(text) ? " has-frac" : ""));
    text.split("\n").forEach((line,index) => {const d=el("div","line",inline(line)),spacing=c.answer_spacing?.[index];if(spacing?.minus_space!==undefined||spacing?.arrow_space!==undefined){let html=inline(line);if(spacing.minus_before_space!==undefined)html=html.replace(/ - /g,'<span style="display:inline-block;width:'+spacing.minus_before_space+'px"> </span>-<span style="display:inline-block;width:'+(spacing.minus_space??8)+'px"> </span>');else if(spacing.minus_space!==undefined)html=html.replace(/- /g,'-<span style="display:inline-block;width:'+spacing.minus_space+'px"> </span>');if(spacing.arrow_space!==undefined)html=html.replace(/→ /g,'→<span style="display:inline-block;width:'+spacing.arrow_space+'px"> </span>');const span=el("span",null,html);d.innerHTML="";d.appendChild(span);}if(c.answer_layout?.[index])Object.assign(d.style,c.answer_layout[index]);if(c.answer_layout?.[index]?.underline_style)d.querySelectorAll("u").forEach(u=>Object.assign(u.style,c.answer_layout[index].underline_style));if(c.answer_layout?.[index]?.tokens){const a=c.answer_layout[index],tokens=line.match(/\S+/g)||[];d.innerHTML="";d.style.position="relative";a.tokens.forEach((p,j)=>{if(p.src){const t=el("img");t.src=p.src;Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",width:p.w+"px",height:p.h+"px"});d.appendChild(t);return;}const t=el("span",null,inline(tokens[p.index??j]??""));Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??32)+"px",letterSpacing:(p.letter_spacing??0)+"px",lineHeight:"1",whiteSpace:"pre",transform:p.scale_x!==undefined?`scaleX(${p.scale_x})`:"none",transformOrigin:"0 0"});d.appendChild(t)});}body.appendChild(d)});
    canvas.appendChild(body);
    root.appendChild(canvas);
    return canvas;
  }

  /* 폰트·이미지가 다 뜬 뒤 true. PNG 촬영은 이걸 기다린다 */
  async function whenReady(root) {
    await document.fonts.ready;
    await Promise.all([...root.querySelectorAll("svg image")].map(e=>new Promise(resolve=>{const image=new Image();image.onload=image.onerror=resolve;image.src=e.href.baseVal;})));
    await Promise.all([...root.querySelectorAll("img")].map((i) => i._ready || (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
    root.querySelectorAll(".r-icons").forEach(e => { if (e._fitIcons) e._fitIcons(); });
    root.querySelectorAll(".r-textcard").forEach(e=>{if(e._fitText)e._fitText();});
    fitBodies(root);
    layoutOptions(root);
    keepInside(root);
    document.documentElement.dataset.ready = "1";
  }

  window.FrameRenderers = { register: (k, fn) => { RENDERERS[k] = fn; }, inline, renderBlock };
  window.renderQuestion = renderQuestion;
  window.renderAnswer = renderAnswer;
  window.whenReady = whenReady;
})();
