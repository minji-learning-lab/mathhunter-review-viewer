/* 본문 렌더러. frame.js 뒤에 불러온다.
 *
 * 모든 블록 공통 값
 *   size    글자 크기(px)
 *   theme   색 테마 이름 (renderers.css 의 .theme-*): blue sky panel yellow orange green gray ink purple mint frame
 *   fill, line, head, mark   테마 색 덮어쓰기
 *   radius, bw   모서리 반지름, 테두리 두께(px)
 *   w, h    상자 크기(px). 없으면 내용에 맞춘다
 *
 * 블록 종류는 아래 register 호출을 보면 된다. 데이터 예시는 samples/samples.js.
 */
(function () {
  const { register, inline, renderBlock } = window.FrameRenderers;
  const SVG = "http://www.w3.org/2000/svg";
  const atlasImages=new Map();
  function loadAtlas(src){if(!atlasImages.has(src))atlasImages.set(src,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{atlasImages.delete(src);reject(new Error("Atlas image failed: "+src))};im.src=src}));return atlasImages.get(src)}

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function svg(tag, attrs, text) {
    const e = document.createElementNS(SVG, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* 공통 값(size, theme, 색, 크기)을 요소에 붙인다 */
  function style(e, b, defaults = {}) {
    const o = { ...defaults, ...b };
    if (o.size) e.style.fontSize = o.size + "px";
    if(o.font_family){e.style.fontFamily=o.font_family;e.style.fontWeight=o.font_weight??400;}
    if(o.text_stroke!==undefined)e.style.webkitTextStroke=o.text_stroke+"px "+(o.text_color||"#343434");
    if(o.blank_size)e.style.setProperty("--blank-size",o.blank_size+"px");
    if(o.blank_width)e.style.setProperty("--blank-width",o.blank_width+"px");
    if(o.blank_height)e.style.setProperty("--blank-height",o.blank_height+"px");
    if(o.blank_bw)e.style.setProperty("--blank-border",o.blank_bw+"px");
    if (o.ls) e.style.letterSpacing = o.ls + "em";
    if (o.theme) e.classList.add("theme-" + o.theme);
    for (const k of ["fill", "line", "head", "mark"]) if (o[k]) e.style.setProperty("--" + k, o[k]);
    if (o.radius !== undefined) e.style.setProperty("--radius", o.radius + "px");
    if (o.bw !== undefined) e.style.setProperty("--bw", o.bw + "px");
    // 점선 테두리 상자 (식 상자, 문장 카드 등)
    if (o.dashed) { e.style.borderStyle = "dashed"; e.style.setProperty("--bs", "dashed"); }
    if (o.w) e.style.width = o.w + "px";
    if (o.h) e.style.height = o.h + "px";
    return e;
  }

  /* ---- 묶기 ----
   * fill 을 주면 색 판(둥근 모서리) 위에 놓는다 (예: 파란 판 속 말풍선 대화) */
  const panel = (e, b) => {
    if (!b.fill) return;
    Object.assign(e.style, { background: b.fill, borderRadius: (b.radius ?? 18) + "px", padding: b.pad ?? "22px 30px" });
  };
  register("row", (b) => {
    const e = style(el("div", "r-row"), b);
    panel(e, b);
    e.style.gap = (b.gap ?? 40) + "px";
    if (b.cols) {
      e.style.display = "grid";
      e.style.gridTemplateColumns = `repeat(${b.cols}, max-content)`;
      e.style.justifyContent = "center";
    }
    // align: 세로 맞춤 (flex-start 위, flex-end 아래). 기본은 가운데
    if (b.align) e.style.alignItems = b.align;
    b.items.forEach((x) => { const child=renderBlock(x); if(b.baseline && ["arrow","text"].includes(x.kind))child.style.alignSelf="center";e.appendChild(child); });
    if(b.positions){Object.assign(e.style,{display:"block",position:"relative"});[...e.children].forEach((child,i)=>{const p=b.positions[i];if(p)Object.assign(child.style,{position:"absolute",left:p[0]+"px",top:p[1]+"px"});});}
    return e;
  });
  register("stack", (b) => {
    const e = style(el("div", "r-stack"), b);
    panel(e, b);
    e.style.gap = (b.gap ?? 24) + "px";
    if (b.align) e.style.alignItems = b.align;
    b.items.forEach((x) => e.appendChild(renderBlock(x)));
    return e;
  });
  // 가/나/다 같은 작은 이름표
  register("label", (b) => style(el("span", "r-label", inline(b.text)), b));

  /* ---- expression: 한 줄 식. box 를 주면 색 상자 안에 ----
   * {kind:"expression", text:"95 - 30 = 85 - □", size:54, box:"yellow"} */
  register("expression", (b) => {
    const e = el("div", "r-expr", inline(b.text));
    style(e, b, { size: b.box ? 44 : 54 });
    if(b.word_spacing!==undefined)e.style.wordSpacing=b.word_spacing+"px";
    if(b.blank_style)e.querySelectorAll(".blank-box").forEach(x=>Object.assign(x.style,b.blank_style));
    // box 테마 없이 fill/line 색만 줘도 상자로 그린다
    if (b.box || b.fill || b.line) {
      e.classList.add("r-box");
      if (b.box) e.classList.add("theme-" + b.box);
      if (!b.line) e.style.setProperty("--bw", (b.bw ?? 0) + "px");
      if (b.pad) e.style.padding = b.pad;
    }
    if(b.measured_line){const p=b.measured_line,t=el("span",null,inline(b.text));e.innerHTML="";Object.assign(e.style,{position:"relative"});Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??b.size)+"px",lineHeight:"1",whiteSpace:"pre",letterSpacing:(p.letter_spacing??0)+"px",transform:`scaleX(${p.scale_x??1})`,transformOrigin:"0 0"});e.appendChild(t);}
    if(b.token_layout){e.innerHTML="";e.style.position="relative";const tokens=String(b.text).match(/\S+/g)||[];b.token_layout.forEach((p,i)=>{const t=el("span",null,inline(tokens[p.index??i]??""));Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??b.size)+"px",lineHeight:"1",whiteSpace:"pre",fontFamily:p.font_family||b.font_family||"CookieRun",fontWeight:p.font_weight??b.font_weight??900,letterSpacing:(p.letter_spacing??0)+"px",transform:`scaleX(${p.scale_x??1})`,transformOrigin:"0 0"});e.appendChild(t)});}
    if(b.frame_art){const a=b.frame_art,bw=b.bw??0,m=a.inset??32,center=el("div"),art=el("img");Object.assign(center.style,{position:"absolute",left:(a.dx+m-bw)+"px",top:(a.dy+m-bw)+"px",width:(a.w-2*m)+"px",height:(a.h-2*m)+"px",background:b.fill||"white",pointerEvents:"none"});art.src=a.src;Object.assign(art.style,{position:"absolute",left:(a.dx-bw)+"px",top:(a.dy-bw)+"px",width:a.w+"px",height:a.h+"px",pointerEvents:"none"});e.style.position="relative";e.style.background="transparent";e.style.borderColor="transparent";e.prepend(art);e.prepend(center);}
    if(b.blank_style)e.querySelectorAll(".blank-box").forEach(x=>Object.assign(x.style,b.blank_style));
    return e;
  });

  /* ---- compare: 두 값 사이 ○ ----
   * {kind:"compare", left:"5 : 8", right:"0.6", gap:100} */
  register("compare", (b) => {
    const e = style(el("div", "r-compare"), b, { size: 54 });
    e.style.gap = (b.gap ?? 100) + "px";
    e.appendChild(el("span", "", inline(b.left)));
    const c = el("span", "circle");
    if (b.circle) { c.style.width = c.style.height = b.circle + "px"; }
    e.appendChild(c);
    e.appendChild(el("span", "", inline(b.right)));
    return e;
  });

  /* ---- vertical: 세로셈. 숫자는 오른쪽 끝을 맞춘다. "." 은 앞 숫자에 붙는다 ----
   * {kind:"vertical", rows:["26", "×0.8"], result:"□□"}  (result 없으면 줄만, "□" 는 빈칸) */
  register("vertical", (b) => {
    const parse = (s) => {
      const m = /^([+\-×÷])?\s*(.*)$/.exec(s.replace(/\s+/g, ""));
      const cells = [];
      // units: 단위 글자(kg, mL, 시 …)를 한 칸으로 (단위 섞인 세로셈)
      for (const ch of (b.units ? m[2].match(/[A-Za-z가-힣]+|./gu) || [] : m[2])) {
        if (ch === "." && cells.length) cells[cells.length - 1] += ".";
        else cells.push(ch);
      }
      return { op: m[1] || "", cells };
    };
    const rows = b.rows.map(parse);
    const res = b.result !== undefined ? parse(b.result) : null;
    const carry = b.carry || null;
    const n = Math.max(carry ? carry.length : 0, ...rows.concat(res ? [res] : []).map((r) => r.cells.length));
    const e = style(el("div", "r-vertical"), b, { size: 54 });
    // 원본 표본: 자리 간격 74px, 줄 간격 76px, 연산 기호 칸 107px (56px 글자 기준)
    const colW = b.col_w ?? 1.32, isU = (c) => /^[A-Za-z가-힣]+$/.test(c);
    const ucol = new Array(n).fill(false);
    if (b.units) rows.concat(res ? [res] : []).forEach((r) => r.cells.forEach((c, ci) => { if (isU(c)) ucol[n - r.cells.length + ci] = true; }));
    e.style.gridTemplateColumns = `${b.op_w ?? 1.9}em ` + ucol.map((u) => (u ? (b.unit_w ?? 1.9) : colW) + "em").join(" ");
    e.style.lineHeight = b.line ?? 1.36;
    // slash: [[줄 번호, 그 줄 글자 번호]] 받아내림으로 지운 숫자에 사선 (0부터)
    const sl = new Set((b.slash || []).map(([r, c]) => r + "," + c));
    const put = (r, ri) => {
      e.appendChild(el("span", "cell op", r.op));
      for (let i = 0; i < n - r.cells.length; i++) e.appendChild(el("span", "cell"));
      // "_" 는 빈 자리 (받아올림 줄 "□_" 처럼 □ 를 왼쪽 자리로 옮길 때)
      r.cells.forEach((c, ci) => {
        const x = c === "□" ? el("span", "blank") : c === "_" ? el("span", "cell") : el("span", "cell", inline(c));
        if (sl.has(ri + "," + ci)) x.classList.add("slash");
        if (b.units && isU(c)) x.classList.add("unit");
        e.appendChild(x);
      });
    };
    // carry: 맨 위 받아올림·받아내림 줄. 자리마다 글자("" 는 비움, "□" 는 빈 네모), 오른쪽 끝을 맞춘다.
    // "[1]" 은 네모 안 색 글자, "10" 은 네모 없이 색 글자. carry_color 로 색
    if (carry) {
      e.appendChild(el("span", "cell op"));
      for (let i = 0; i < n - carry.length; i++) e.appendChild(el("span", "cell"));
      carry.forEach((c) => {
        const x = el("span", "cell carry");
        if (c) {
          const m = /^\[(.+)\]$/.exec(String(c));
          const t = el("span", c === "□" || m ? "cbox" : "cnum", c === "□" ? "" : inline(m ? m[1] : String(c)));
          t.style.color = b.carry_color || "#e45757";
          x.appendChild(t);
        }
        e.appendChild(x);
      });
    }
    rows.forEach(put);
    e.appendChild(el("div", "rule"));
    if (res) put(res, rows.length);
    return e;
  });

  /* ---- statements: ㄱ/ㄴ/ㄷ 문장 목록 (색 패널, 점선 구분) ----
   * {kind:"statements", items:["ㄱ. ...", "ㄴ. ..."], theme:"panel", size:28} */
  register("statements", (b) => {
    const e = style(el("div", "r-statements r-box"), b, { theme: "panel", size: 28, bw: 0, radius: 10 });
    if(b.compact_panel)Object.assign(e.style,{border:"2px solid #aaa",borderRadius:"4px",background:"white",padding:"6px 18px",lineHeight:"1.2"});b.items.forEach((t) => {const line=el("div", "item", inline(t));if(b.compact_panel)line.style.padding="4px 0";if(b.wrap)Object.assign(line.style,{whiteSpace:"pre-line",wordBreak:"keep-all"});e.appendChild(line)});
    return e;
  });

  /* ---- table: 표 ----
   * {kind:"table", rows:[["1900","2000"],["2900",""]], theme:"orange", cell_w:140, cell_h:56,
   *  head_row:true, head_col:true, marks:[[0,0],[1,2]], rounded:true, col_w:[169,307]} */
  register("table", (b) => {
    const t = style(el("table", "r-table" + (b.rounded ? " rounded" : "")), b, { theme: "orange", size: 28, radius: 12 });
    if (b.tbw) t.style.setProperty("--tbw", b.tbw + "px");
    if(b.fixed)t.style.tableLayout="fixed";
    if(b.line_height)t.style.lineHeight=b.line_height;
    const marks = new Set((b.marks || []).map(([r, c]) => r + "," + c));
    const M = (v) => v === "<" || v === "^";
    const tally = n => {const s=svg("svg",{width:68,height:42,viewBox:"0 0 68 42","data-tally-count":n});for(let k=0;k<n;k++)s.appendChild(svg("line",{x1:8+(k%5)*10,y1:28-Math.floor(k/5)*12,x2:27+(k%5)*10,y2:10-Math.floor(k/5)*12,stroke:b.tally_color||"#009ee8","stroke-width":2}));return s;};
    b.rows.forEach((row, ri) => {
      const tr = el("tr");
      row.forEach((v, ci) => {
        if (M(v)) return;
        const td = el("td", "", inline(v));
        // 합친 칸: 오른쪽 "<" 개수만큼 colSpan, 아래 "^" 개수만큼 rowSpan
        let cs = 1, rs = 1;
        while (row[ci + cs] === "<") cs++;
        while (b.rows[ri + rs] && b.rows[ri + rs][ci] === "^") rs++;
        if (cs > 1) td.colSpan = cs;
        if (rs > 1) td.rowSpan = rs;
        // 앞 칸이 모두 위 칸에 합쳐졌으면 그 칸의 오른쪽 선이 있으니 왼쪽 선을 지운다
        if (ci > 0 && row.slice(0, ci).every(M)) td.style.borderLeft = "none";
        if ((b.head_row && ri === 0) || (b.head_col && ci === 0)) { td.classList.add("head"); if(b.head_size)td.style.fontSize=b.head_size+"px"; }
        if(b.wrap)Object.assign(td.style,{whiteSpace:"pre-line",wordBreak:"keep-all"});
        if(b.cell_pad!==undefined)td.style.padding=b.cell_pad;
        if(b.cell_sizes?.[ri+","+ci])td.style.fontSize=b.cell_sizes[ri+","+ci]+"px";
        if(b.cell_align?.[ri+","+ci])td.style.textAlign=b.cell_align[ri+","+ci];
        if(b.cell_colors?.[ri+","+ci])td.style.color=b.cell_colors[ri+","+ci];
        if(b.internal_border){td.style.border="0";if(ci<row.length-1)td.style.borderRight=`${b.internal_border.width??2}px ${b.internal_border.style||"dashed"} ${b.internal_border.color||"white"}`;}
        if(b.option_marks){const m=/^([①②③④⑤])\s+(.*)$/.exec(String(v));if(m){const wrap=el("span"),mark=el("span",null,m[1]),text=el("span",null,inline(m[2]));Object.assign(wrap.style,{display:"inline-flex",alignItems:"center",gap:(b.option_marks.gap??12)+"px"});Object.assign(mark.style,{fontSize:(b.option_marks.size??(b.size??36)*.9)+"px",fontFamily:b.option_marks.font_family||"CookieRun",fontWeight:b.option_marks.font_weight??900});wrap.append(mark,text);td.innerHTML="";td.appendChild(wrap);}}
        if(b.cell_shift?.[ri+","+ci]||b.cell_scale_x?.[ri+","+ci]){const shift=b.cell_shift?.[ri+","+ci]||[0,0],span=el("span");span.append(...td.childNodes);span.style.display="inline-block";span.style.transform=`translate(${shift[0]}px,${shift[1]}px) scaleX(${b.cell_scale_x?.[ri+","+ci]??1})`;td.innerHTML="";td.appendChild(span);}
        if(b.cell_tallies?.[ri+","+ci]!==undefined)td.replaceChildren(tally(b.cell_tallies[ri+","+ci]));
        if (marks.has(ri + "," + ci)){td.classList.add("mark");if(b.mark_art)td.replaceChildren(renderBlock(b.mark_art));}
        const cw = Array.isArray(b.col_w) ? b.col_w[ci] : b.cell_w;
        if (cw) td.style.width = cw + "px";
        if (b.cell_h) td.style.height = b.cell_h + "px";
        if(b.row_h?.[ri])td.style.height=b.row_h[ri]+"px";
        tr.appendChild(td);
      });
      if(ri===1 && b.tally_counts){const countRow=el("tr");countRow.style.height=(b.tally_h||68)+"px";for(let j=0;j<row.length;j++){const cell=el("td",j===0?"head":"");cell.style.padding="0";if(j===0){cell.innerHTML=inline("세면서\n표시하기");cell.style.whiteSpace="pre-line";cell.style.fontSize="24px";}else cell.appendChild(tally(b.tally_counts[j-1]||0));countRow.appendChild(cell)}t.appendChild(countRow);}
      t.appendChild(tr);
    });
    if(b.show_title && b.title){const box=el("div");const title=el("div",null,inline(b.title));Object.assign(title.style,{fontSize:(b.title_size??b.size??28)+"px",textAlign:"center",background:b.head||"#ffeccc",marginBottom:"12px"});if(b.title_fit)Object.assign(title.style,{width:"max-content",marginLeft:"auto",marginRight:"auto",borderRadius:"8px",padding:"4px 8px"});box.appendChild(title);box.appendChild(t);return box;}
    return t;
  });

  /* ---- cards: 같은 모양 상자 한 줄 ----
   * {kind:"cards", items:["2","5","6"], colors:["#ef5b5b",...], w:78, h:97, gap:38}
   * 이어진 사슬: link:true / 칸 두 개짜리 카드: items:[["22","68"]], split_colors:["#ffe37a","#d8f2ff"]
   * 카드 위 이름표: labels:["ㄱ.","ㄴ.","ㄷ."]
   * 동그란 카드: round:true / 점선 테두리: dashed:true / 카드마다 테두리색: line_colors:[...]
   * w, h 가 없으면 글자 크기 기준 기본 크기(1.9em 정사각) */
  register("cards", (b) => {
    if(b.curved_chain27){const e=el("div");Object.assign(e.style,{position:"relative",width:"440px",height:"254px"});const points=[[50,0],[140,20],[230,42],[320,12],[360,102],[246,134],[154,164],[64,150],[-14,102]],s=svg("svg",{width:440,height:254,viewBox:"-20 0 440 254"});s.appendChild(svg("path",{d:points.slice(0,b.items.length).map(([x,y],i)=>`${i?'L':'M'}${x+24} ${y+24}`).join(' '),fill:"none",stroke:"#df9471","stroke-width":2}));e.appendChild(s);b.items.forEach((it,i)=>{const [x,y]=points[i]||[i*50,0],card=renderBlock({...b,curved_chain27:false,items:[it],colors:[b.colors?.[i]],line_colors:[b.line_colors?.[i]],link:false});Object.assign(card.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(card)});return e;}
    // w, h 는 카드 한 장 크기라 줄 전체에는 주지 않는다
    const e = style(el("div", "r-cards"), { ...b, w: undefined, h: undefined }, { theme: "green", size: 34 });
    const gap = b.gap ?? (b.link ? 24 : 26);
    if (!b.link) e.style.gap = gap + "px";
    if (b.round) e.classList.add("round");
    if (b.dashed) e.classList.add("dashed");
    b.items.forEach((it, i) => {
      if (b.link && i) {
        const l = el("span", "link");
        l.style.width = gap + "px";
        e.appendChild(l);
      }
      const card = el("div", "card" + (b.shadow ? " shadow" : ""));
      if (b.w) card.style.width = b.w + "px";
      if (b.h) card.style.height = b.h + "px";
      if (b.colors && b.colors[i]) card.style.setProperty("--card", b.colors[i]);
      if (b.line_colors && b.line_colors[i]) card.style.setProperty("--card-line", b.line_colors[i]);
      if(b.outline_palette){card.style.setProperty("--card","#fff");card.style.setProperty("--card-line",({red:"#ca4e50",orange:"#ef914a",blue:"#4e80b9",green:"#688b6b",purple:"#9766b8"})[b.colors?.[i]]||b.colors?.[i]||"#aaa");}
      if(b.ink)card.style.color=b.ink;
      if (b.blank_fill && it === "") card.style.setProperty("--card", b.blank_fill);
      if (Array.isArray(it)) {
        card.classList.add("split");
        it.forEach((v, j) => {
          const s = el("span", "", inline(v));
          if (b.split_colors) s.style.background = b.split_colors[j];
          card.appendChild(s);
        });
      } else {
        card.innerHTML = inline(it);
        if(b.token_layout){card.innerHTML="";card.style.position="relative";const tokens=String(it).match(/\S+/g)||[];b.token_layout.forEach((p,i)=>{const span=el("span",null,inline(tokens[p.index??i]??""));Object.assign(span.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??b.size)+"px",lineHeight:"1",whiteSpace:"pre"});if(p.font_family)span.style.fontFamily=p.font_family;if(p.font_weight!==undefined)span.style.fontWeight=p.font_weight;if(p.scale_x!==undefined)Object.assign(span.style,{transform:`scaleX(${p.scale_x})`,transformOrigin:"0 0"});card.appendChild(span)});}
        else if(b.text_shift||b.text_scale_x){const span=el("span",null,inline(it));span.style.display="inline-block";span.style.transform=`translate(${b.text_shift?.[0]??0}px,${b.text_shift?.[1]??0}px) scaleX(${b.text_scale_x??1})`;card.innerHTML="";card.appendChild(span);}
      }
      if(b.underline_style)card.querySelectorAll("u").forEach(u=>Object.assign(u.style,b.underline_style));
      if(b.blank_style)card.querySelectorAll(".blank-box").forEach(x=>Object.assign(x.style,b.blank_style));
      if(b.frame_art){const a=Array.isArray(b.frame_art)?b.frame_art[i]:b.frame_art,bw=b.bw??3,m=a.inset??32,center=el("div"),art=el("img");Object.assign(center.style,{position:"absolute",left:(a.dx+m-bw)+"px",top:(a.dy+m-bw)+"px",width:(a.w-2*m)+"px",height:(a.h-2*m)+"px",background:b.colors?.[i]||b.fill||"white",pointerEvents:"none"});art.src=a.src;Object.assign(art.style,{position:"absolute",left:(a.dx-bw)+"px",top:(a.dy-bw)+"px",width:a.w+"px",height:a.h+"px",pointerEvents:"none"});card.style.position="relative";card.style.background="transparent";card.style.borderColor="transparent";card.prepend(art);card.prepend(center);}
      if(b.native_outline&&!b.frame_art){const a=b.native_outline,bw=a.bw??b.bw??4,w=b.w,h=b.h,r=a.radius??b.radius??0,art=svg("svg",{width:w,height:h,viewBox:`0 0 ${w} ${h}`});card.style.position="relative";card.style.borderColor="transparent";card.style.borderRadius=r+"px";Object.assign(art.style,{position:"absolute",left:-bw+"px",top:-bw+"px",pointerEvents:"none",overflow:"visible"});art.appendChild(svg("rect",{x:bw/2,y:bw/2,width:w-bw,height:h-bw,rx:Math.max(0,r-bw/2),fill:"none",stroke:b.line_colors?.[i]||b.line||"#333","stroke-width":bw,...(a.dash?{"stroke-dasharray":a.dash.join(" "),"stroke-dashoffset":a.offset??0}:{})}));card.appendChild(art);}
      if (b.labels) {
        const w = el("div", "card-wrap");
        w.appendChild(el("span", "card-label", inline(b.labels[i])));
        w.appendChild(card);
        e.appendChild(w);
      } else {
        e.appendChild(card);
      }
    });
    return e;
  });

  /* ---- text_card: 글만 든 색 상자 ----
   * {kind:"text_card", text:"…\n…", theme:"mint", shadow:true, w:598} */
  register("text_card", (b) => {
    const e = el("div", "r-textcard r-box", inline(b.text));
    style(e, b, { theme: "mint", size: 28, bw: 3, radius: 0 });
    if (b.wrap) Object.assign(e.style, {whiteSpace:"pre-line",wordBreak:"keep-all"});
    if(b.pad!==undefined)e.style.padding=b.pad;
    if(b.nowrap)e.style.whiteSpace="pre";
    if(b.line_height)e.style.lineHeight=b.line_height;
    if(b.text_align)e.style.textAlign=b.text_align;
    if(b.fit_text)e._fitText=()=>{
      const ctx=document.createElement("canvas").getContext("2d"),maximum=b.size??28,minimum=b.min_size??20;
      for(let size=maximum;size>=minimum;size--){e.style.fontSize=size+"px";const cs=getComputedStyle(e);ctx.font=cs.font;const lines=(b.fit_explicit_lines?e.innerText:e.textContent).split("\n"),width=e.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),height=e.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom),lineHeight=parseFloat(cs.lineHeight)||size*1.2;if(Math.max(...lines.map(t=>ctx.measureText(t).width))<=width+.5&&lines.length*lineHeight<=height+.5)break;}
    };
    if(b.stitched){e.style.position="relative";e.style.boxShadow="inset 0 0 0 12px #e1d1f4";const seam=el("div");Object.assign(seam.style,{position:"absolute",inset:"20px",border:"4px dashed #b4bec6",borderRadius:"16px",pointerEvents:"none"});e.appendChild(seam);if(b.corner_stars){const art=svg("svg",{width:b.w,height:b.h,viewBox:`0 0 ${b.w} ${b.h}`});Object.assign(art.style,{position:"absolute",inset:"0",pointerEvents:"none"});for(const [x,y,r]of [[58,34,18],[30,86,9],[b.w-34,b.h-54,32],[b.w-68,b.h-18,10]]){let points=[];for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,R=i%2?r*.5:r;points.push((x+Math.cos(a)*R)+","+(y+Math.sin(a)*R));}art.appendChild(svg("polygon",{points:points.join(" "),fill:"#ffd9e8",stroke:"#f780ab","stroke-width":3}));}e.appendChild(art);}}
    if(b.token_layout){e.innerHTML="";e.style.position="relative";const tokens=String(b.text).match(/\S+/g)||[];b.token_layout.forEach((p,i)=>{const t=el("span",null,inline(tokens[p.index??i]??""));Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??b.size)+"px",lineHeight:"1",whiteSpace:"pre",fontFamily:p.font_family||b.font_family||"CookieRun",fontWeight:p.font_weight??b.font_weight??900,letterSpacing:(p.letter_spacing??0)+"px",transform:p.scale_x!==undefined?`scaleX(${p.scale_x})`:"none",transformOrigin:"0 0"});e.appendChild(t)});}
    else if(b.measured_lines&&b.measured_lines.length===String(b.text).split("\n").length){e.innerHTML="";e.style.position="relative";String(b.text).split("\n").forEach((line,i)=>{const p=b.measured_lines[i],t=el("div",null,inline(line));Object.assign(t.style,{position:"absolute",left:p.x+"px",top:p.y+"px",fontSize:(p.size??b.size)+"px",letterSpacing:(p.letter_spacing??b.letter_spacing??0)+"px",wordSpacing:p.word_spacing!==undefined?p.word_spacing+"px":"normal",transform:p.scale_x!==undefined&&p.scale_x!==1?`scaleX(${p.scale_x})`:"none",transformOrigin:"0 0",lineHeight:"1",whiteSpace:"pre",fontFamily:b.font_family||"CookieRun",fontWeight:b.font_weight??900,webkitTextStroke:(b.text_stroke??0)+"px "+(b.text_color||"#343434")});e.appendChild(t)});}
    if(b.underline_color)e.querySelectorAll("u").forEach(u=>u.style.color=b.underline_color);
    if(b.underline_style)e.querySelectorAll("u").forEach(u=>Object.assign(u.style,b.underline_style));
    if(b.underline_markers)e.querySelectorAll("u").forEach((u,i)=>{u.style.position="relative";u.dataset.annotation=String.fromCharCode(0x2460+i)});
    if (b.shadow) e.classList.add("shadow");
    if(b.shadow_color)e.style.boxShadow=(b.shadow_dx??12)+"px "+(b.shadow_dy??12)+"px 0 "+b.shadow_color;
    if(b.inline_flow){const flow=el("span");flow.append(...e.childNodes);flow.style.display="block";flow.style.width="100%";e.appendChild(flow);}
    if (b.h) { e.style.display = "flex"; e.style.alignItems = "center"; e.style.justifyContent = b.text_align==="left"?"flex-start":"center"; }
    if(b.frame_art){const a=b.frame_art,bw=b.bw??3,m=a.inset??32,center=el("div"),art=el("img");Object.assign(center.style,{position:"absolute",left:(a.dx+m-bw)+"px",top:(a.dy+m-bw)+"px",width:(a.w-2*m)+"px",height:(a.h-2*m)+"px",background:b.fill||"white",pointerEvents:"none"});art.src=a.src;Object.assign(art.style,{position:"absolute",left:(a.dx-bw)+"px",top:(a.dy-bw)+"px",width:a.w+"px",height:a.h+"px",pointerEvents:"none"});e.style.background="transparent";e.style.borderColor="transparent";e.style.boxShadow="none";e.prepend(art);e.prepend(center);}
    if(b.border_dash&&!b.frame_art){const w=b.w,h=b.h,bw=b.bw??3,r=b.radius??0,art=svg("svg",{width:w,height:h,viewBox:`0 0 ${w} ${h}`});Object.assign(art.style,{position:"absolute",left:-bw+"px",top:-bw+"px",pointerEvents:"none",overflow:"visible"});e.style.borderColor="transparent";art.appendChild(svg("rect",{x:bw/2,y:bw/2,width:w-bw,height:h-bw,rx:Math.max(0,r-bw/2),fill:"none",stroke:b.line||"#333","stroke-width":bw,"stroke-dasharray":b.border_dash.join(" "),"stroke-dashoffset":b.dash_offset??0}));e.appendChild(art);}
    return e;
  });

  /* drawer: 색·단수를 바꿀 수 있는 서랍장. 원본의 사선 앞면과 나무 테두리. */
  register("drawer", (b) => {
    const colors = b.colors || [], n = colors.length, base = n * 40 + 78;
    const s = svg("svg", {class:"r-svg", width:176, height:base + 4, viewBox:`0 0 176 ${base + 4}`});
    const g = svg("g", {transform:"translate(2 2)"}); s.appendChild(g);
    const poly = (points, fill) => g.appendChild(svg("polygon", {points:points.map(p=>p.join(",")).join(" "),fill,stroke:"#805b3e","stroke-width":3,"stroke-linejoin":"round"}));
    poly([[0,32],[64,58],[64,base],[0,base-26]], "#ca925e");
    poly([[64,58],[172,24],[172,base-34],[64,base]], "#e5b57c");
    poly([[0,32],[106,0],[172,24],[64,58]], "#ffe3b5");
    for(let i=0;i<n;i++) {
      const y=70+i*40, slope=34/108, xr=166,xl=70, dy=(xr-xl)*slope;
      poly([[xl,y],[xr,y-dy],[xr,y+33-dy],[xl,y+33]], colors[i]);
      g.appendChild(svg("ellipse", {cx:117,cy:y+16.5-(117-xl)*slope,rx:6,ry:6.3,fill:"#e7c68e",stroke:"#8a7652","stroke-width":1.6}));
    }
    return s;
  });

  /* 책등 제목과 선반을 각각 코드 요소로 그린다. */
  register("bookshelf", (b) => {
    const names=b.items||[],bw=56,H=208,W=names.length*bw+28;
    const s=svg("svg",{class:"r-svg",width:W,height:H+18,viewBox:`0 0 ${W} ${H+18}`});
    const rect=(x,y,w,h,fill,stroke="#8d6341")=>s.appendChild(svg("rect",{x,y,width:w,height:h,fill,stroke,"stroke-width":3}));
    rect(0,70,W,H-70,"#deb17d");
    names.forEach((name,i)=>{
      const x=16+i*bw;rect(x,0,bw,H,(b.colors||[])[i]||"#90c9e8",(b.line_colors||[])[i]||"#7097ae");
      const chars=[...String(name)],lh=33,labelH=chars.length*lh+14;
      s.appendChild(svg("rect",{x:x+7,y:10,width:bw-14,height:labelH,fill:"#fff"}));
      chars.forEach((c,j)=>{const t=svg("text",{x:x+bw/2,y:40+j*lh,"text-anchor":"middle","font-size":30},c);t.style.fontFamily="CookieRun";t.style.fontWeight="900";s.appendChild(t)});
    });
    rect(0,H,W,16,"#ca925e");return s;
  });

  /* 학생 수를 유지하면서 각 인물의 얼굴·옷·팔·다리를 독립적으로 그린다. */
  register("children_line", (b) => {
    const n=b.count||0,step=56,L=80,W=L*2+Math.max(0,n-1)*step;
    const s=svg("svg",{class:"r-svg",width:W,height:142,viewBox:`0 0 ${W} 142`});
    s.appendChild(svg("ellipse",{cx:W/2,cy:121,rx:(W-95)/2,ry:17,fill:"#eadba8"}));
    for(let i=0;i<n;i++){
      const g=svg("g",{transform:`translate(${L+i*step} 0)`,"data-person-index":i});s.appendChild(g);
      const pink=i%3!==1,cloth=pink?"#ffb9d0":"#a5d5f4",dark=pink?"#e776a1":"#5d9acb",hair=["#653b2a","#43434d","#ab6a37"][i%3];
      const path=(d,fill,stroke="#a26955",w=1.6)=>g.appendChild(svg("path",{d,fill,stroke,"stroke-width":w,"stroke-linejoin":"round","stroke-linecap":"round"}));
      path("M-14 76 L0 77 L-6 105 L-16 119 L-25 115 L-16 99 Z",cloth,dark);
      path("M2 77 L15 76 L16 99 L29 114 L22 121 L5 105 Z",cloth,dark);
      path("M-25 114 L-14 116 L-15 123 L-29 122 Z","#9be4dd","#5d999b");
      path("M22 115 L31 112 L35 118 L25 123 L19 122 Z","#9be4dd","#5d999b");
      path("M-19 43 Q0 38 19 44 L17 79 Q0 89 -18 77 Z",cloth,dark);
      path("M-17 46 L-31 65 L-23 69 L-7 54",cloth,dark);
      path("M16 46 L28 59 L35 56 L38 62 L25 69 L8 54",cloth,dark);
      g.appendChild(svg("ellipse",{cx:0,cy:28,rx:24,ry:25,fill:hair}));
      g.appendChild(svg("ellipse",{cx:0,cy:30,rx:20,ry:21,fill:"#ffe0bf",stroke:"#b47d60","stroke-width":1.3}));
      path("M-21 25 Q-24 4 -4 3 Q19 -1 23 25 L11 20 L7 12 L0 20 L-8 14 L-14 24 Z",hair,hair,1);
      for(const x of [-8,7])g.appendChild(svg("ellipse",{cx:x,cy:30,rx:2.1,ry:2.7,fill:"#51352b"}));
      for(const x of [-13,13])g.appendChild(svg("ellipse",{cx:x,cy:37,rx:4,ry:2.3,fill:"#f4a39b",opacity:.7}));
      path("M-5 39 Q0 44 6 38","none","#a2574a",1.5);
    }
    for(const [x,t] of [[28,"앞"],[W-28,"뒤"]]){s.appendChild(svg("rect",{x:x-21,y:77,width:42,height:42,rx:8,fill:"#b7eef6"}));s.appendChild(svg("text",{x,y:107,"text-anchor":"middle","font-size":28},t))}
    return s;
  });

  /* 키 순서와 실제 표시 높이는 데이터가 결정한다. 그림은 원본 개별 인물이다. */
  register("people_height", (b) => {
    const e=el("div","r-people-height"),H=Math.max(...b.items.map(x=>x.h));
    Object.assign(e.style,{display:"flex",gap:"6px",alignItems:"flex-end",borderBottom:"2px solid #c9c9c9"});
    for(const p of b.items){const col=el("div"),art=el("div"),im=renderBlock(p.art);
      Object.assign(col.style,{display:"flex",flexDirection:"column",alignItems:"center",width:"90px",gap:"6px"});
      Object.assign(art.style,{height:H+"px",width:"90px",display:"flex",alignItems:"flex-end",justifyContent:"center"});
      im.style.height=p.h+"px";im.style.width="auto";art.appendChild(im);col.appendChild(art);const label=el("div","",inline(p.name));label.style.fontSize="26px";col.appendChild(label);e.appendChild(col);
    }return e;
  });

  let vesselSerial=0;
  register("glass_vessels", (b) => {
    const W=Math.max(...b.items.map(x=>x.x+x.w/2))+12,H=Math.max(...b.items.map(x=>x.y+x.h))+16;
    const s=svg("svg",{class:"r-svg",width:W,height:H,viewBox:`0 -10 ${W} ${H+10}`});
    const defs=svg("defs",{}),id="glass-"+(vesselSerial++),grad=svg("linearGradient",{id,x1:"0%",x2:"100%"});
    for(const [offset,color] of [["0%","#b1e2ed"],["35%","#effcff"],["100%","#a4d6e9"]])grad.appendChild(svg("stop",{offset,"stop-color":color}));defs.appendChild(grad);s.appendChild(defs);
    for(const v of b.items){const x=v.x,y=v.y,w=v.w,h=v.h,ry=Math.min(9,w*.1),bw=w*.74;
      s.appendChild(svg("path",{d:`M${x-w/2},${y} L${x-bw/2},${y+h} Q${x},${y+h+ry} ${x+bw/2},${y+h} L${x+w/2},${y} Z`,fill:`url(#${id})`,stroke:"#5193ad","stroke-width":2.5}));
      s.appendChild(svg("ellipse",{cx:x,cy:y,rx:w/2,ry,fill:"#f4fcff",stroke:"#5193ad","stroke-width":2.5}));
      s.appendChild(svg("path",{d:`M${x-bw/2},${y+h} Q${x},${y+h-ry} ${x+bw/2},${y+h}`,fill:"none",stroke:"#70aec3","stroke-width":1.5}));
    }
    for(const t of b.labels||[])s.appendChild(svg("text",{x:t.x,y:t.y-6,"text-anchor":"middle","font-size":t.size||30},t.text));return s;
  });

  let balloonSerial=0;
  register("balloon_line", (b) => {
    const colors=b.colors||[],W=b.w||520,H=b.h||180,n=colors.length;
    const s=svg("svg",{class:"r-svg",width:W,height:H,viewBox:`0 0 ${W} ${H}`});
    s.appendChild(svg("rect",{width:W,height:H,rx:20,fill:"#85e4fa"}));
    s.appendChild(svg("path",{d:`M0 120 L55 78 L115 130 L170 92 L220 143 L282 90 L340 134 L410 88 L520 128 L520 180 L0 180 Z`,fill:"#59a9bb"}));
    s.appendChild(svg("path",{d:`M0 157 Q130 108 260 162 Q390 126 520 156 L520 180 L0 180 Z`,fill:"#77b6b6"}));
    for(const [x,y] of [[36,30],[120,18],[430,26]]){s.appendChild(svg("ellipse",{cx:x,cy:y,rx:24,ry:6,fill:"#d9f9ff"}));s.appendChild(svg("ellipse",{cx:x+8,cy:y-5,rx:13,ry:7,fill:"#d9f9ff"}))}
    const defs=svg("defs",{});s.appendChild(defs);
    colors.forEach((color,i)=>{const x=75+i*(W-150)/Math.max(1,n-1),y=132-i*(b.rise||10),gid="balloon-"+(balloonSerial++),g=svg("radialGradient",{id:gid,cx:"30%",cy:"25%",r:"75%"});
      for(const [offset,c] of [["0%","#fff"],["35%",color],["100%",color]])g.appendChild(svg("stop",{offset,"stop-color":c}));defs.appendChild(g);
      s.appendChild(svg("path",{d:`M${x},${y+19} q-8,8 1,13 q-10,8 -14,14`,fill:"none",stroke:"#5c747c","stroke-width":1.4}));
      s.appendChild(svg("path",{d:`M${x},${y+17} l-4,7 h8 Z`,fill:color,stroke:"#627b83","stroke-width":.8}));
      s.appendChild(svg("ellipse",{cx:x,cy:y,rx:20,ry:23,fill:`url(#${gid})`,stroke:(b.line_colors||[])[i]||"#657d87","stroke-width":1.2}));
    });return s;
  });

  register("digital_clock", (b) => {
    const lcd=b.theme==="lcd",alarm=b.theme==="alarm",s=svg("svg",{class:"r-svg",width:alarm?300:lcd?288:440,height:alarm?204:lcd?160:224,viewBox:alarm?"0 0 440 300":"0 0 440 224"});
    if(alarm){s.appendChild(svg("rect",{x:180,y:0,width:80,height:12,fill:"#555"}));s.appendChild(svg("rect",{x:2,y:10,width:436,height:288,rx:56,fill:"#555"}));s.appendChild(svg("rect",{x:30,y:34,width:380,height:194,rx:30,fill:"#222",stroke:"#444","stroke-width":5}));for(const x of [76,344,378])s.appendChild(svg("circle",{cx:x,cy:260,r:x===76?20:11,fill:"#666",stroke:"#444","stroke-width":2}));for(let y=246;y<276;y+=7)for(let x=142;x<302;x+=9)s.appendChild(svg("circle",{cx:x,cy:y,r:2,fill:"#292929"}));}
    else if(lcd){s.appendChild(svg("rect",{x:90,y:0,width:260,height:25,rx:8,fill:"#5963ab"}));s.appendChild(svg("rect",{x:0,y:20,width:440,height:204,rx:18,fill:"#939ace"}));s.appendChild(svg("rect",{x:24,y:46,width:392,height:151,fill:"#f5f4ed",stroke:"#24252c","stroke-width":10}));}
    else {
    s.appendChild(svg("rect",{x:40,y:0,width:360,height:30,rx:22,fill:"#41443e"}));
    for(const x of [42,318])s.appendChild(svg("rect",{x,y:209,width:80,height:14,rx:3,fill:"#858882"}));
    s.appendChild(svg("path",{d:"M15 10 H423 L438 24 V198 L424 214 H25 L0 202 V35 Z",fill:"#bfc2bd"}));
    s.appendChild(svg("rect",{x:13,y:22,width:412,height:180,rx:16,fill:"#080a08"}));
    s.appendChild(svg("rect",{x:25,y:32,width:388,height:158,rx:14,fill:"#20231f"}));}
    const shapes=[[[12,0],[52,0],[59,7],[52,14],[12,14],[5,7]],[[54,8],[61,15],[61,48],[54,55],[48,48],[48,15]],[[54,65],[61,72],[61,105],[54,112],[48,105],[48,72]],[[12,110],[52,110],[59,117],[52,124],[12,124],[5,117]],[[5,65],[12,72],[12,105],[5,112],[-1,105],[-1,72]],[[5,8],[12,15],[12,48],[5,55],[-1,48],[-1,15]],[[12,55],[52,55],[59,62],[52,69],[12,69],[5,62]]];
    const segments={0:[0,1,2,3,4,5],1:[1,2],2:[0,1,6,4,3],3:[0,1,6,2,3],4:[5,6,1,2],5:[0,5,6,2,3],6:[0,5,6,4,3,2],7:[0,1,2],8:[0,1,2,3,4,5,6],9:[0,1,2,3,5,6]};
    const parts=String(b.text).split(":"),digits=parts[0].padStart(2," ")+(parts[1]||"00"),xs=[50,126,244,320];
    [...digits].forEach((d,i)=>{const on=segments[d]||[];shapes.forEach((points,j)=>s.appendChild(svg("polygon",{points:points.map(([x,y])=>[x+xs[i],y+51+(lcd?12:0)].join(",")).join(" "),fill:on.includes(j)?(lcd?"#242525":alarm?"#e9f51c":"#26c82f"):(lcd?"none":"#2b2e29")})))});
    for(const y of [80,133])s.appendChild(svg("rect",{x:214,y:y+(lcd?12:0),width:11,height:11,fill:lcd?"#242525":alarm?"#e9f51c":"#26c82f"}));
    if(!lcd&&!alarm)s.appendChild(svg("rect",{x:25,y:32,width:388,height:67,rx:14,fill:"#fff",opacity:.12}));return s;
  });

  register("locker_grid", (b) => {
    const rows=b.rows,nr=rows.length-1,nc=rows[0].length-1,L=92,CW=97,CH=52,T=36;
    const s=svg("svg",{class:"r-svg",width:L+nc*CW+3,height:T+nr*CH+3,viewBox:`0 0 ${L+nc*CW+3} ${T+nr*CH+3}`});
    for(let c=0;c<nc;c++)s.appendChild(svg("text",{x:L+c*CW+CW/2,y:22,"text-anchor":"middle","font-size":23},rows[0][c+1]));
    for(let rr=0;rr<nr;rr++){
      s.appendChild(svg("text",{x:L-9,y:T+rr*CH+CH/2+9,"text-anchor":"end","font-size":24},rows[rr+1][0]));
      for(let c=0;c<nc;c++){const x=L+c*CW,y=T+rr*CH,value=rows[rr+1][c+1];s.appendChild(svg("rect",{x,y,width:CW,height:CH,fill:value&&!/^\d+$/.test(String(value))?"#f4dcc3":"#ecad76",stroke:"#865f41","stroke-width":2}));
        s.appendChild(svg("circle",{cx:x+14,cy:y+CH/2,r:4.5,fill:"#66899c"}));s.appendChild(svg("text",{x:x+CW/2,y:y+CH/2+10,"text-anchor":"middle","font-size":29},value));}
    }return s;
  });

  register("classification_board", (b) => {
    const e=el("div"),head=el("div","",inline(b.title)),grid=el("div");
    Object.assign(e.style,{width:(b.w||198)+"px",background:"#65a86a",border:"9px solid #ad8762",padding:"6px",boxSizing:"border-box"});
    Object.assign(head.style,{fontSize:b.title.length>8?"20px":"26px",lineHeight:"1.15",color:"white",textAlign:"center",whiteSpace:"normal",marginBottom:"6px",fontFamily:"CookieRun",fontWeight:"900"});
    Object.assign(grid.style,{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"5px"});e.appendChild(head);e.appendChild(grid);
    const assets={"강아지":"icons/item/IMG_Q_614111_dog.png","고양이":"icons/cat.png","토끼":"icons/rabbit.png"};
    for(const p of b.items){const cell=el("div"),name=el("div","",inline(p.name)),img=el("img"),label=el("div","",inline(p.animal));
      Object.assign(cell.style,{height:(b.cell_h||(b.items.length>8?62:70))+"px",background:"#b5d6ad",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:"18px",lineHeight:"20px"});
      cell.appendChild(name);
      if(b.arts?.[p.animal]) {cell.appendChild(renderBlock(b.arts[p.animal]));}
      else if(assets[p.animal]) {img.src=assets[p.animal];Object.assign(img.style,{height:"29px",width:"auto",maxWidth:"60px",objectFit:"contain"});cell.appendChild(img);}
      else {
        const art=svg("svg",{width:62,height:28,viewBox:"0 0 62 28"}),kind=p.animal;
        const wheel=(x,y)=>art.appendChild(svg("circle",{cx:x,cy:y,r:5,fill:"#404951",stroke:"#27333b","stroke-width":1}));
        if(kind==="자전거") {
          for(const x of [13,49])art.appendChild(svg("circle",{cx:x,cy:19,r:8,fill:"#fff",stroke:"#416d91","stroke-width":2}));
          art.appendChild(svg("path",{d:"M13 19 L24 7 L34 19 L13 19 M24 7 H42 L49 19 M34 19 L42 7 L39 3 H47 M20 5 H28",fill:"none",stroke:"#416d91","stroke-width":2}));
        } else if(kind==="버스"||kind==="기차") {
          art.appendChild(svg("rect",{x:5,y:4,width:52,height:18,rx:4,fill:kind==="버스"?"#f1b64a":"#67b797",stroke:"#506673","stroke-width":1.5}));
          for(const x of [10,21,32,43])art.appendChild(svg("rect",{x,y:7,width:8,height:7,rx:1,fill:"#e2f5fc"}));wheel(16,23);wheel(47,23);
          if(kind==="기차")art.appendChild(svg("path",{d:"M4 27 H59 M9 1 H47",stroke:"#506673","stroke-width":2}));
        } else if(["딸기","초코","바닐라"].includes(kind)) {
          art.appendChild(svg("path",{d:"M22 12 L31 27 L40 12 Z",fill:"#dca76b",stroke:"#ac7c4e","stroke-width":1}));
          art.appendChild(svg("circle",{cx:31,cy:10,r:10,fill:{"딸기":"#f2a2b8","초코":"#886046","바닐라":"#fff2cf"}[kind],stroke:"#b59c81","stroke-width":1}));
        }
        cell.appendChild(art);
      }
      cell.appendChild(label);grid.appendChild(cell);
    }return e;
  });

  register("price_board", (b) => {
    const e=el("div");Object.assign(e.style,{display:"flex",border:"4px solid #b0b0b0",borderRadius:"15px",overflow:"hidden",background:"white"});
    for(const p of b.items){const cell=el("div"),art=el("div"),name=el("div","",inline(p.name)),price=el("div","",inline(p.price));
      Object.assign(cell.style,{width:"154px",display:"flex",flexDirection:"column",borderRight:"2px solid #b0b0b0",alignItems:"stretch"});
      Object.assign(art.style,{height:"132px",display:"flex",alignItems:"center",justifyContent:"center"});const pic=renderBlock(p.art);pic.style.maxHeight="110px";pic.style.maxWidth="120px";pic.style.objectFit="contain";art.appendChild(pic);
      Object.assign(name.style,{fontSize:(b.name_size||28)+"px",textAlign:"center",padding:"0 2px 8px"});Object.assign(price.style,{fontSize:(b.price_size||28)+"px",lineHeight:"30px",textAlign:"center",background:"#a9dcee",borderTop:"3px solid #b0b0b0",padding:"7px 2px",whiteSpace:"pre-line"});cell.appendChild(art);cell.appendChild(name);cell.appendChild(price);e.appendChild(cell);
    }e.lastElementChild.style.borderRight="0";return e;
  });

  /* ---- icons: 아이콘 × 개수 ----
   * {kind:"icons", icon:"pear_plate", count:5, gap:15, frame:"frame", per_row:3} → icons/pear_plate.png */
  register("icons", (b) => {
    const e = style(el("div", "r-icons"), b);
    e.style.gap = (b.gap ?? 15) + "px";
    if (b.per_row) {
      // 줄마다 개수를 정하면 격자로 놓는다 (예: 자동차 6대를 3개씩 2줄)
      e.style.display = "grid";
      e.style.gridTemplateColumns = `repeat(${b.per_row}, auto)`;
      e.style.justifyContent = "center";
      e.style.alignContent = "center";
    }
    if(b.center_last){Object.assign(e.style,{display:"flex",flexWrap:"wrap",justifyContent:"center"});}
    if(b.row_gap!==undefined)e.style.rowGap=b.row_gap+"px";
    if (b.frame) { e.classList.add("r-box", "theme-" + b.frame); e.style.setProperty("--bw", (b.bw ?? 5) + "px"); }
    if(b.oval_field){e.style.borderRadius="48%";e.style.background="radial-gradient(ellipse,#a7c75f 55%,#cedb9c)";}
    if(b.frame_fill&&!b.oval_field)e.style.background=b.frame_fill;if(b.frame && b.line)e.style.borderColor=b.line;
    // 고정 영역의 그림만 크기를 계산한다. 개수와 명시적 행 순서는 유지한다.
    if (b.w && b.h && !b.icon_w && !b.icon_h) {
      if (b.frame) e.style.padding = "24px 32px";
      e._fitIcons = () => {
        const imgs = [...e.querySelectorAll("img")];
        if (!imgs.length || imgs.some(im=>!im.naturalWidth)) return;
        const cs=getComputedStyle(e), gap=b.gap??15;
        const w=b.w-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-parseFloat(cs.borderLeftWidth||0)-parseFloat(cs.borderRightWidth||0);
        const h=b.h-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom)-parseFloat(cs.borderTopWidth||0)-parseFloat(cs.borderBottomWidth||0);
        let best=null;
        for(let cols=b.per_row||1;cols<=(b.per_row||Math.min(5,imgs.length));cols++) {
          const rows=Math.ceil(imgs.length/cols),cw=(w-gap*(cols-1))/cols,ch=(h-gap*(rows-1))/rows;
          const scale=Math.min(1.25,...imgs.map(im=>Math.min(cw/im.naturalWidth,ch/im.naturalHeight)));
          if(scale>0&&(!best||scale>best.scale))best={cols,rows,cw,ch,scale};
        }
        if(!best)return;
        Object.assign(e.style,{display:"grid",gridTemplateColumns:`repeat(${best.cols}, ${best.cw}px)`,gridAutoRows:best.ch+"px",justifyContent:"center",alignContent:"center",justifyItems:"center",alignItems:"center"});
        e.dataset.iconColumns=best.cols;
        imgs.forEach(im=>{im.style.width=(im.naturalWidth*best.scale)+"px";im.style.height=(im.naturalHeight*best.scale)+"px"});
      };
    }
    if (b.pad !== undefined) e.style.padding = typeof b.pad === "number" ? b.pad+"px" : b.pad;
    // crossed: 마지막 몇 개에 지움 사선(뺄셈 그림). crossed_from 을 주면 그 번호(0부터)부터
    const cx0 = b.crossed ? (b.crossed_from ?? b.count - b.crossed) : Infinity, cx1 = cx0 + (b.crossed ?? 0);
    for (let i = 0; i < b.count; i++) {
      const img = el("img");
      img.src = b.srcs?.[i] || b.src || `icons/${b.icon}.png`;
      if (b.icon_w) img.style.width = b.icon_w + "px";
      if (b.icon_h) img.style.height = b.icon_h + "px";
      if (i >= cx0 && i < cx1) { const w = el("span", "r-icon-x"); w.appendChild(img); e.appendChild(w); } else e.appendChild(img);
    }
    if(b.positions){Object.assign(e.style,{display:"block",position:"relative",width:(b.w??484)+"px",height:(b.h??220)+"px"});[...e.children].forEach((im,i)=>{const p=b.positions[i];if(p)Object.assign(im.style,{position:"absolute",left:p[0]+"px",top:p[1]+"px"});});}
    return e;
  });

  /* ---- number_line: 수직선 ----
   * {kind:"number_line", from:16, to:22, step:1, width:180, range:[17,20], open:[true,false], points:[]}
   * labels: 눈금마다 글자 (분수 마크업 가능, ""는 비움). jumps: [{from,to,label,below}] 굽은 화살표 */
  register("number_line", (b) => {
    const step = b.step ?? 1, n = Math.round((b.to - b.from) / step);
    const W = b.width ?? 360, pad = b.pad ?? 14, fs = b.size ?? 20, tick = b.tick ?? 14, hgt = b.jump_h ?? 40;
    const frac = (b.labels || []).some((t) => /\{/.test(String(t))) || (b.jumps || []).some((j) => /\{/.test(String(j.label ?? "")));
    const lh = frac ? fs * 2.4 : fs + 4;   // 분수 글자는 두 줄 높이
    const up = (b.jumps || []).some((j) => !j.below), down = (b.jumps || []).some((j) => j.below);
    const top = tick / 2 + 2 + (up ? hgt + lh : 0), bot = tick / 2 + lh + 8 + (down ? hgt + lh : 0);
    const s = svg("svg", { class: "r-svg", width: W + pad * 2, height: top + bot, viewBox: `${-pad} ${-top} ${W + pad * 2} ${top + bot}` });
    const x = (v) => ((v - b.from) / (b.to - b.from)) * W;
    const text = (cx, cy, t) => {
      if (!/\{|\[\]/.test(String(t))) { s.appendChild(svg("text", { x: cx, y: cy + fs * 0.35, "font-size": fs, "text-anchor": "middle" }, String(t))); return; }
      const bw = fs * 4, bh = lh;
      const fo = svg("foreignObject", { x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh });
      const d = el("div", "r-fig-wrap"); d.style.justifyContent = "center";
      const t2 = el("div", "r-fig-label", inline(String(t))); t2.style.fontSize = fs + "px";
      d.appendChild(t2); fo.appendChild(d); s.appendChild(fo);
    };
    (b.jumps || []).forEach((j) => {
      const x0 = x(j.from), x1 = x(j.to), col = j.color || b.jump_color || "#f06a98", sg = j.below ? 1 : -1;
      const mx = (x0 + x1) / 2, dir = x1 >= x0 ? 1 : -1, y0 = sg * 3;
      s.appendChild(svg("path", { d: `M${x0},${y0} Q${mx},${sg * (hgt * 2 - 3)} ${x1},${y0}`, fill: "none", stroke: col, "stroke-width": 3 }));
      s.appendChild(svg("polygon", { points: `${x1},${sg * 2} ${x1 - dir * 12},${sg * 12} ${x1 - dir * 2},${sg * 16}`, fill: col }));
      if (j.label != null) text(mx, sg * (hgt + lh / 2 + 2), j.label);
    });
    const ink = "#303030", mark = b.mark || "#10c8f0";
    s.appendChild(svg("line", { x1: -pad, y1: 0, x2: W + pad, y2: 0, stroke: ink, "stroke-width": 2 }));
    for (let i = 0; i <= n; i++) {
      const v = b.from + i * step, px = x(v);
      s.appendChild(svg("line", { x1: px, y1: -tick / 2, x2: px, y2: tick / 2, stroke: ink, "stroke-width": 2 }));
      const lab = b.labels ? b.labels[i] : ((b.label_every ?? 1) && i % (b.label_every ?? 1) === 0 ? String(+v.toFixed(4)) : "");
      if (lab != null && lab !== "") text(px, tick / 2 + lh / 2 + 4, lab);
    }
    const dot = (v, open) => s.appendChild(svg("circle", { cx: x(v), cy: 0, r: 6, fill: open ? "#ffffff" : mark, stroke: mark, "stroke-width": 3 }));
    const ends = [];
    if (b.range) {
      // 범위 끝이 눈금 밖이면 선만 끝까지 긋고 점은 찍지 않는다 (이상·초과처럼 한쪽이 열린 범위)
      const [r0, r1] = b.range, out0 = r0 < b.from, out1 = r1 > b.to;
      const cx0 = out0 ? -pad : x(r0), cx1 = out1 ? W + pad : x(r1);
      s.appendChild(svg("line", { x1: cx0, y1: 0, x2: cx1, y2: 0, stroke: mark, "stroke-width": 5 }));
      const open = b.open || [false, false];
      if (!out0) { dot(r0, open[0]); ends.push(r0); }
      if (!out1) { dot(r1, open[1]); ends.push(r1); }
    }
    // 범위 끝과 같은 자리의 점은 이미 찍었다 (빈 점 위에 채운 점을 덮어쓰지 않는다)
    (b.points || []).forEach((p) => { const v = p.at ?? p; if (!ends.includes(v)) dot(v, p.open); });
    return s;
  });

  /* ---- chart: 막대/꺾은선 그래프 ----
   * {kind:"chart", type:"line", title:"요일별 입장객 수", labels:["화","수"], values:[1700,1600],
   *  min:1000, max:2000, step:500, minor:100, y_unit:"(명)", x_unit:"(요일)", w:280, h:150}
   * break:true      — 0 과 min 사이를 물결선으로 줄인다(꺾은선그래프). 맨 아래 눈금은 0
   * corner:["학생 수","월"] — 왼쪽 아래 칸을 대각선으로 나눠 세로축·가로축 이름
   * labels 에 "\n" 이면 두 줄. values 의 null 은 그리지 않는다(㉠ 처럼 빈 막대)
   * series:[{values, color}] — 꺾은선 여러 개. horizontal:true — 가로 막대(labels 가 왼쪽) */
  register("chart", (b) => {
    if (b.horizontal) return hbar(b);
    const fs = b.size ?? 16, W = b.w ?? 280, H = b.h ?? 150, L = b.left ?? 56, top = b.title ? fs + 18 : 6;
    const lines = Math.max(1, ...b.labels.map((t) => String(t).split("\n").length)), bottom = fs * 1.15 * lines + 12;
    const total = { w: L + W + 2, h: top + H + bottom + 2 };
    const s = svg("svg", { class: "r-svg", width: total.w, height: total.h, viewBox: `0 0 ${total.w} ${total.h}` });
    const ink = "#303030", grid = b.grid || "#8fc8ee", minorc = b.minor_color || "#cfe7f7";
    const x0 = L, y0 = top, n = b.labels.length, cw = W / n, bh = b.break ? Math.min(28, H * 0.18) : 0;
    const y = (v) => y0 + H - bh - ((v - b.min) / (b.max - b.min)) * (H - bh);
    const multi = (x, yy, t, o = {}) => {
      const tx = svg("text", { x, y: yy, "font-size": o.fs ?? fs, "text-anchor": o.anchor ?? "middle" });
      String(t).split("\n").forEach((ln, k) => tx.appendChild(svg("tspan", { x, dy: k ? (o.fs ?? fs) * 1.15 : 0 }, ln)));
      s.appendChild(tx);
    };
    if (b.title) s.appendChild(svg("text", { x: x0 + W / 2, y: fs + 2, "font-size": fs, "text-anchor": "middle" }, b.title));
    s.appendChild(svg("rect", { x: x0 - L, y: y0, width: L, height: H, fill: b.head || "#ece4ff" }));
    s.appendChild(svg("rect", { x: x0 - L, y: y0 + H, width: L + W, height: bottom, fill: b.head2 || "#d8cbf3" }));
    if (b.minor) for (let v = b.min; v <= b.max + 1e-9; v += b.minor)
      s.appendChild(svg("line", { x1: x0, x2: x0 + W, y1: y(v), y2: y(v), stroke: minorc, "stroke-width": 1 }));
    for (let v = b.min; v <= b.max + 1e-9; v += b.step) {
      s.appendChild(svg("line", { x1: x0, x2: x0 + W, y1: y(v), y2: y(v), stroke: grid, "stroke-width": 1.5 }));
      // y_labels: 눈금 글자 바꾸기 {"20":"[]"} (빈칸 눈금). "[]" 는 네모 칸
      const yl = b.y_labels?.[String(+v.toFixed(6))] ?? String(+v.toFixed(6));
      if (yl === "[]") s.appendChild(svg("rect", { x: x0 - 6 - fs * 1.4, y: y(v) - fs * 0.6, width: fs * 1.3, height: fs * 1.2, fill: "#fff", stroke: ink, "stroke-width": 1.5 }));
      else s.appendChild(svg("text", { x: x0 - 6, y: y(v) + fs * 0.35, "font-size": fs, "text-anchor": "end" }, yl));
    }
    if (b.break) {
      // 물결선 두 줄로 0~min 구간 생략
      const yb = y0 + H - bh / 2, amp = 3, wl = 12;
      for (const dy of [-3, 3]) {
        let d = `M${x0 - L * 0.3},${yb + dy}`;
        for (let x = x0 - L * 0.3; x < x0 + W; x += wl) d += ` q${wl / 4},${-amp} ${wl / 2},0 t${wl / 2},0`;
        s.appendChild(svg("path", { d, fill: "none", stroke: ink, "stroke-width": 1.2 }));
      }
      s.appendChild(svg("line", { x1: x0, x2: x0 + W, y1: y0 + H, y2: y0 + H, stroke: grid, "stroke-width": 1.5 }));
      s.appendChild(svg("text", { x: x0 - 6, y: y0 + H - 2, "font-size": fs, "text-anchor": "end" }, "0"));
    }
    for (let i = 0; i <= n; i++) s.appendChild(svg("line", { x1: x0 + i * cw, x2: x0 + i * cw, y1: y0, y2: y0 + H, stroke: ink, "stroke-width": 1.5 }));
    b.labels.forEach((t, i) => multi(x0 + (i + 0.5) * cw, y0 + H + fs + 4, t));
    if (b.y_unit) s.appendChild(svg("text", { x: x0 - L + 4, y: y0 + fs, "font-size": fs * 0.7 }, b.y_unit));
    if (b.x_unit) s.appendChild(svg("text", { x: x0 + W - 2, y: y0 + H + bottom - 2, "font-size": fs * 0.7, "text-anchor": "end" }, b.x_unit));
    if (b.corner) {
      s.appendChild(svg("line", { x1: x0 - L, y1: y0 + H, x2: x0, y2: y0 + H + bottom, stroke: ink, "stroke-width": 1 }));
      s.appendChild(svg("text", { x: x0 - L + 3, y: y0 + H + fs * 0.75, "font-size": fs * 0.7 }, b.corner[0]));
      s.appendChild(svg("text", { x: x0 - 3, y: y0 + H + bottom - 3, "font-size": fs * 0.7, "text-anchor": "end" }, b.corner[1]));
    }
    const ser = b.series || [{ values: b.values, color: b.color }];
    if (b.type === "bar") {
      const k = ser.length, bw = (cw * 0.5) / k;
      ser.forEach((sr, j) => sr.values.forEach((v, i) => {
        if (v === null || v === undefined) return;
        s.appendChild(svg("rect", { x: x0 + i * cw + cw * 0.25 + j * bw, y: y(v), width: bw, height: y0 + H - bh - y(v), fill: sr.color || "#a8d0ff" }));
      }));
    } else {
      ser.forEach((sr) => {
        const pts = sr.values.map((v, i) => (v === null || v === undefined ? null : [x0 + (i + 0.5) * cw, y(v)])).filter(Boolean);
        // no_line: 점만 찍는다(점끼리 잇지 않는 그래프)
        if (!b.no_line) s.appendChild(svg("polyline", { points: pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: sr.color || "#e020c0", "stroke-width": 2 }));
        pts.forEach(([cx, cy]) => s.appendChild(svg("circle", { cx, cy, r: 3.5, fill: ink })));
      });
      // point_labels: 점 위에 붙는 이름(ㄱ, ㄴ …). 칸 순서대로, "" 는 비움
      (b.point_labels || []).forEach((t, i) => {
        const v = ser[0].values[i];
        if (!t || v === null || v === undefined) return;
        s.appendChild(svg("text", { x: x0 + (i + 0.5) * cw, y: y(v) - 8, "font-size": fs, "text-anchor": "middle" }, t));
      });
    }
    s.appendChild(svg("rect", { x: x0 - L, y: y0, width: L + W, height: H + bottom, fill: "none", stroke: ink, "stroke-width": 2 }));
    return s;
  });

  /* 가로 막대그래프: labels 가 왼쪽 칸, 값 눈금은 아래 */
  function hbar(b) {
    const fs = b.size ?? 16, W = b.w ?? 280, H = b.h ?? 150, L = b.left ?? 70, top = b.title ? fs + 18 : 6, bottom = fs + 16;
    const total = { w: L + W + 2, h: top + H + bottom + 2 };
    const s = svg("svg", { class: "r-svg", width: total.w, height: total.h, viewBox: `0 0 ${total.w} ${total.h}` });
    const ink = "#303030", grid = b.grid || "#8fc8ee", x0 = L, y0 = top, n = b.labels.length, rh = H / n;
    const x = (v) => x0 + ((v - b.min) / (b.max - b.min)) * W;
    if (b.title) s.appendChild(svg("text", { x: x0 + W / 2, y: fs + 2, "font-size": fs, "text-anchor": "middle" }, b.title));
    s.appendChild(svg("rect", { x: 0, y: y0, width: L, height: H, fill: b.head || "#ece4ff" }));
    s.appendChild(svg("rect", { x: 0, y: y0 + H, width: L + W, height: bottom, fill: b.head2 || "#d8cbf3" }));
    if (b.minor) for (let v = b.min; v <= b.max + 1e-9; v += b.minor)
      s.appendChild(svg("line", { x1: x(v), x2: x(v), y1: y0, y2: y0 + H, stroke: b.minor_color || "#cfe7f7", "stroke-width": 1 }));
    for (let v = b.min; v <= b.max + 1e-9; v += b.step) {
      s.appendChild(svg("line", { x1: x(v), x2: x(v), y1: y0, y2: y0 + H, stroke: grid, "stroke-width": 1.5 }));
      s.appendChild(svg("text", { x: x(v), y: y0 + H + fs + 4, "font-size": fs, "text-anchor": "middle" }, String(v)));
    }
    for (let i = 0; i <= n; i++) s.appendChild(svg("line", { x1: x0, x2: x0 + W, y1: y0 + i * rh, y2: y0 + i * rh, stroke: ink, "stroke-width": 1.5 }));
    b.labels.forEach((t, i) => s.appendChild(svg("text", { x: L / 2, y: y0 + (i + 0.5) * rh + fs * 0.35, "font-size": fs, "text-anchor": "middle" }, t)));
    b.values.forEach((v, i) => {
      if (v === null || v === undefined) return;
      s.appendChild(svg("rect", { x: x0, y: y0 + i * rh + rh * 0.25, width: x(v) - x0, height: rh * 0.5, fill: b.color || "#a8d0ff" }));
    });
    if (b.corner) {
      s.appendChild(svg("line", { x1: 0, y1: y0 + H, x2: L, y2: y0 + H + bottom, stroke: ink, "stroke-width": 1 }));
      s.appendChild(svg("text", { x: 3, y: y0 + H + fs * 0.75, "font-size": fs * 0.7 }, b.corner[0]));
      s.appendChild(svg("text", { x: L - 3, y: y0 + H + bottom - 3, "font-size": fs * 0.7, "text-anchor": "end" }, b.corner[1]));
    }
    s.appendChild(svg("rect", { x: 0, y: y0, width: L + W, height: H + bottom, fill: "none", stroke: ink, "stroke-width": 2 }));
    return s;
  }

  /* ---- pictograph: 그림그래프 ----
   * {kind:"pictograph", title:"날짜별 줄넘기 횟수", head:["날짜","줄넘기 횟수"],
   *  rows:[{label:"14일", counts:[1,2]}, …], units:[{value:100, text:"100회"}, {value:10, text:"10회"}],
   *  icon:"circle"(기본) | 글자 하나, color:"#7ab8e8"}
   * counts 는 units 순서대로 큰 그림·작은 그림 개수. 아래에 범례(그림 = 값)를 단다 */
  register("pictograph", (b) => {
    const fs = b.size ?? 18, col = b.color || "#7ab8e8", units = b.units || [{ value: 10 }, { value: 1 }];
    const box = style(el("div", "r-picto"), { ...b, size: undefined, w: undefined, h: undefined });
    box.style.fontSize = fs + "px";
    const ic = (k) => {
      const d = fs * (k === 0 ? 1.25 : k === 1 ? 0.8 : 0.55);
      // srcs: 단마다 원본에서 잘라 낸 그림(검사기가 crop 으로 만든다). 원본 그림 크기 그대로
      if (b.srcs && b.srcs[k]) { const e = el("img", "r-picto-img"); e.src = b.srcs[k]; return e; }
      if (b.icon && b.icon !== "circle") { const e = el("span", "r-picto-ic", inline(b.icon)); e.style.fontSize = d + "px"; return e; }
      const e = el("span", "r-picto-dot"); e.style.width = e.style.height = d + "px"; e.style.background = col; return e;
    };
    if (b.title) box.appendChild(el("div", "r-graph-title", inline(b.title)));
    const t = el("table", "r-picto-table");
    if (b.head) { const tr = el("tr"); b.head.forEach((h) => tr.appendChild(el("th", "", inline(h)))); t.appendChild(tr); }
    b.rows.forEach((r) => {
      const tr = el("tr");
      tr.appendChild(el("th", "", inline(r.label)));
      const td = el("td");
      if (r.blank) td.innerHTML = inline(r.blank);
      else (r.counts || []).forEach((n, k) => { for (let i = 0; i < n; i++) td.appendChild(ic(k)); });
      tr.appendChild(td); t.appendChild(tr);
    });
    box.appendChild(t);
    const lg = el("div", "r-picto-legend");
    units.forEach((u, k) => { const it = el("span", "r-picto-li"); it.appendChild(ic(k)); it.appendChild(el("span", "", inline(u.text ?? String(u.value)))); lg.appendChild(it); });
    box.appendChild(lg);
    return box;
  });

  /* ---- fraction_model: 칸 나눈 사각형 일부 색칠 ----
   * {kind:"fraction_model", rows:2, cols:5, filled:7, cell_w:59, cell_h:97, fill:"#afbfff", line:"#081762"} */
  register("fraction_model", (b) => {
    const e = style(el("div", "r-frac-model"), b, { fill: "#afbfff", line: "#081762" });
    e.style.gridTemplateColumns = `repeat(${b.cols}, ${b.cell_w ?? 60}px)`;
    e.style.gridAutoRows = (b.cell_h ?? 60) + "px";
    const on = new Set(Array.isArray(b.filled) ? b.filled : [...Array(b.filled).keys()].map((i) =>
      b.fill_by === "row" ? i : (i % b.rows) * b.cols + Math.floor(i / b.rows)));
    for (let i = 0; i < b.rows * b.cols; i++) {
      const c = el("i", on.has(i) ? "on" : "");
      if ((i + 1) % b.cols === 0) c.style.borderRight = "0";
      if (i >= (b.rows - 1) * b.cols) c.style.borderBottom = "0";
      e.appendChild(c);
    }
    return e;
  });

  /* ---- shape: 정다각형 / 직사각형 ----
   * {kind:"shape", sides:8, side:110, fill:"#bee5f6", line:"#006fad", side_label:"9 cm"}
   * {kind:"shape", rect:[240,140], w_label:"12 cm", h_label:"5 cm"} */
  register("shape", (b) => {
    const fill = b.fill || "#bee5f6", line = b.line || "#006fad", sw = b.bw ?? 5, fs = b.size ?? 22;
    let pts, W, H;
    if (b.rect) {
      [W, H] = b.rect;
      // 추출 때 표시 길이(cm 등)를 그대로 적은 경우: 긴 변을 260px 로 키운다
      if (Math.max(W, H) < 60) { const k = 260 / Math.max(W, H); W *= k; H *= k; }
      pts = [[0, 0], [W, 0], [W, H], [0, H]];
    } else {
      const n = b.sides, side = b.side >= 30 ? b.side : 120, R = side / (2 * Math.sin(Math.PI / n));
      const rot = b.rotate ?? (n % 2 ? -90 : -90 + 180 / n);
      pts = [...Array(n).keys()].map((i) => {
        const a = ((rot + (360 * i) / n) * Math.PI) / 180;
        return [R * Math.cos(a), R * Math.sin(a)];
      });
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const mx = Math.min(...xs), my = Math.min(...ys);
      pts = pts.map(([x, y]) => [x - mx, y - my]);
      W = Math.max(...xs) - mx; H = Math.max(...ys) - my;
    }
    const m = sw + (b.side_label || b.w_label || b.h_label ? fs * 3 : 0);
    const s = svg("svg", { class: "r-svg", width: W + m * 2, height: H + m * 2, viewBox: `${-m} ${-m} ${W + m * 2} ${H + m * 2}` });
    s.appendChild(svg("polygon", { points: pts.map((p) => p.join(",")).join(" "), fill, stroke: line, "stroke-width": sw, "stroke-linejoin": "round" }));
    if (b.side_label && !b.rect) {
      // 오른쪽 위를 향한 변에 점선 표시와 길이 (변 가운데가 중심에서 -45° 에 가장 가까운 변)
      const want = b.label_angle ?? -45;
      let i = 0, bestD = 1e9;
      pts.forEach((p, k) => {
        const q = pts[(k + pts.length - 1) % pts.length];
        const ang = (Math.atan2((p[1] + q[1]) / 2 - H / 2, (p[0] + q[0]) / 2 - W / 2) * 180) / Math.PI;
        const d = Math.abs(((ang - want + 540) % 360) - 180);
        if (d < bestD) { bestD = d; i = k; }
      });
      const a = pts[i], c = pts[(i + pts.length - 1) % pts.length];
      const nx = (a[1] - c[1]), ny = -(a[0] - c[0]), len = Math.hypot(nx, ny), o = 10;
      const ux = nx / len, uy = ny / len;
      const sgn = (ux * ((a[0] + c[0]) / 2 - W / 2) + uy * ((a[1] + c[1]) / 2 - H / 2)) > 0 ? 1 : -1;
      const d = (p) => [p[0] + sgn * ux * o, p[1] + sgn * uy * o];
      const [p1, p2] = [d(c), d(a)];
      s.appendChild(svg("line", { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: "#9a9a9a", "stroke-width": 2, "stroke-dasharray": "2 4" }));
      s.appendChild(svg("text", { x: (p1[0] + p2[0]) / 2 + sgn * ux * fs, y: (p1[1] + p2[1]) / 2 + sgn * uy * fs + fs * 0.35, "font-size": fs, "text-anchor": "middle" }, b.side_label));
    }
    if (b.rect && b.w_label) s.appendChild(svg("text", { x: W / 2, y: H + sw + fs + 4, "font-size": fs, "text-anchor": "middle" }, b.w_label));
    if (b.rect && b.h_label) s.appendChild(svg("text", { x: -sw - 6, y: H / 2 + fs * 0.35, "font-size": fs, "text-anchor": "end" }, b.h_label));
    return s;
  });

  /* ---- figure: 평면도형 그림 (점 좌표로 그린다) ----
   * 좌표는 오른쪽이 +x, 아래가 +y. unit 을 곱해 px 가 된다(모눈이면 unit = 한 칸 px).
   * {kind:"figure", unit:40, grid:{x:[0,8], y:[0,4]}, items:[
   *   {t:"poly", pts:[[1,4],[3,0],[5,4]], fill:"#e9fbe9", line:"#20b070"},   // 다각형 (open:true 면 꺾은선)
   *   {t:"seg", a:[0,0], b:[4,0], ext:"both"},       // 선분. ext 로 직선(both)·반직선(b 쪽) 표현
   *   {t:"circle", c:[2,2], r:1.5},                   // 원
   *   {t:"angle", at:[1,4], a:[3,0], b:[5,4], label:"60°"},  // 각 표시(부채꼴)와 크기
   *   {t:"right", at:[3,4], a:[3,0], b:[5,4]},         // 직각 표시
   *   {t:"len", a:[1,4], b:[5,4], text:"6 cm"},        // 변 길이 (변 바깥쪽에). arc:true 면 a~b 범위를 하늘색 점선 호로(bulge px, flip 으로 반대쪽)
   *   {t:"tick", a:[1,4], b:[3,0], n:1},               // 길이가 같은 변 표시
   *   {t:"dot", at:[3,0]},  {t:"arrow", a:[0,0], b:[2,0]},
   *   {t:"text", at:[3,-0.5], text:"ㄱ", box:true}]}   // 꼭짓점 이름·도형 이름. 분수 마크업 가능 */
  register("figure", (b) => {
    const u = b.unit ?? 1, ink = b.ink || "#303030", fs = b.size ?? 26, sw = b.bw ?? 4;
    const P = (p) => [p[0] * u, p[1] * u];
    const items = b.items || [];
    // 그릴 범위: 모든 점 + 모눈
    const xs = [], ys = [];
    const take = (p) => { if (p) { const [x, y] = P(p); xs.push(x); ys.push(y); } };
    items.forEach((it) => {
      (it.pts || []).forEach(take); take(it.a); take(it.b); take(it.at);
      if (it.c) { take([it.c[0] - it.r, it.c[1] - it.r]); take([it.c[0] + it.r, it.c[1] + it.r]); }
    });
    if (b.grid) { take([b.grid.x[0], b.grid.y[0]]); take([b.grid.x[1], b.grid.y[1]]); }
    const m = b.margin ?? 6; // 여백을 크게 두면 본문 위치가 원본보다 아래로 밀린다. 바깥 글자는 overflow 로 보인다
    let x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m;
    let W = Math.max(...xs) - Math.min(...xs) + m * 2, H = Math.max(...ys) - Math.min(...ys) + m * 2;
    if(b.view_box)[x0,y0,W,H]=b.view_box;
    const s = svg("svg", { class: "r-svg r-figure", width: W, height: H, viewBox: `${x0} ${y0} ${W} ${H}` });
    s.style.overflow = "visible";
    if(b.font_family){s.style.fontFamily=b.font_family;s.style.fontWeight=b.font_weight??400;}

    if (b.grid) {
      const g = b.grid, step = g.step ?? 1, gc = g.color || "#a9b8d6";
      const dash = g.solid ? null : "4 4";
      for (let x = g.x[0]; x <= g.x[1] + 1e-9; x += step)
        s.appendChild(svg("line", { x1: x * u, y1: g.y[0] * u, x2: x * u, y2: g.y[1] * u, stroke: gc, "stroke-width": 1.5, ...(dash && { "stroke-dasharray": dash }) }));
      for (let y = g.y[0]; y <= g.y[1] + 1e-9; y += step)
        s.appendChild(svg("line", { x1: g.x[0] * u, y1: y * u, x2: g.x[1] * u, y2: y * u, stroke: gc, "stroke-width": 1.5, ...(dash && { "stroke-dasharray": dash }) }));
      if (g.dots) for (let x = g.x[0]; x <= g.x[1] + 1e-9; x += step) for (let y = g.y[0]; y <= g.y[1] + 1e-9; y += step)
        s.appendChild(svg("circle", { cx: x * u, cy: y * u, r: 3, fill: gc }));
    }

    const strokeOf = (it) => ({ stroke: it.line || ink, "stroke-width": it.bw ?? sw, fill: "none",
      "stroke-linecap": it.line_cap||b.line_cap||"round", "stroke-linejoin": it.line_join||b.line_join||"round", ...(it.dashed && { "stroke-dasharray": "8 6" }) });
    const unitv = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    // 글자는 모아 두었다가 선·다른 글자와 겹치지 않게 조금 옮긴 뒤 그린다(placeLabels)
    const pending = [], lines = [], anchors = [], arcs = [], polys = [];
    const label = (x, y, text, it = {}) => { const L = { x, y, x0: x, y0: y, text: String(text), it, size: it.size ?? fs }; pending.push(L); return L; };
    const near = (x, y, only) => { let k = -1, best = Infinity; anchors.forEach((p, i) => { if (only && !only.has(i)) return; const d = Math.hypot(x - p[0], y - p[1]); if (d < best) { best = d; k = i; } }); return k; };
    const dots = new Set(); let rivals = null; // 이름표끼리 다투는 점: 점(dot)과 이름이 붙은 점. 이름 없는 꼭짓점은 뺀다
    const anchorOf = (p) => { const k = anchors.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5); return k >= 0 ? k : anchors.push(p) - 1; };
    // 글자 잉크 상자 어림 (em): 한글 0.95, 낱자음 잉크 0.5(간격 1), 숫자·영문 0.6, 공백 0.3. 낱자음만이면 높이 0.55
    const textBox = (L) => {
      const t = L.text.replace(/\{[^}]*\}/g, "00").replace(/\[\]/g, "□");
      let w = 0;
      for (const ch of t) w += /[가-힣□]/.test(ch) ? 0.95 : /[ㄱ-ㅎ]/.test(ch) ? 1 : ch === " " ? 0.3 : ch === "°" ? 0.4 : 0.6;
      if (/^[ㄱ-ㅎ]+$/.test(t)) return [(w - 0.5) * L.size, L.size * 0.55];
      return [w * L.size, L.size * 0.9];
    };
    const hitsSeg = (L, [a, c], pad) => {
      // 선분이 (pad 만큼 넓힌) 글자 상자를 지나는가: Liang–Barsky 자르기
      const [w, h] = textBox(L), x0 = L.x - w / 2 - pad, x1 = L.x + w / 2 + pad, y0 = L.y - h / 2 - pad, y1 = L.y + h / 2 + pad;
      const dx = c[0] - a[0], dy = c[1] - a[1];
      let t0 = 0, t1 = 1;
      for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
        if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
        if (t0 > t1) return false;
      }
      return true;
    };
    const boxOf = (L) => { const [w, h] = textBox(L); return [L.x - w / 2, L.y - h / 2, L.x + w / 2, L.y + h / 2]; };
    const overlap = (A, B, pad) => { const a = boxOf(A), b = boxOf(B); return a[0] < b[2] + pad && b[0] < a[2] + pad && a[1] < b[3] + pad && b[1] < a[3] + pad; };
    const boxDist = (L, p) => { const b = boxOf(L); return Math.hypot(Math.max(b[0] - p[0], 0, p[0] - b[2]), Math.max(b[1] - p[1], 0, p[1] - b[3])); };
    // 부채꼴 안의 점들(꼭짓점, 반지름 0.35·0.7·1 배 × 9 방향)로 글자와 부채꼴의 거리·겹침을 어림한다
    const sectorPts = (A) => {
      if (A.pts && A.pts.r === A.r) return A.pts;
      const pts = [A.at];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, dx = A.ua[0] * (1 - t) + A.ub[0] * t, dy = A.ua[1] * (1 - t) + A.ub[1] * t, l = Math.hypot(dx, dy) || 1;
        for (const f of [0.35, 0.7, 1]) pts.push([A.at[0] + (dx / l) * A.r * f, A.at[1] + (dy / l) * A.r * f]);
      }
      pts.r = A.r;
      return (A.pts = pts);
    };
    const sectorDist = (L, A) => Math.min(...sectorPts(A).map((p) => boxDist(L, p)));
    const covers = (L, A) => { const b = boxOf(L); return sectorPts(A).some(([x, y]) => x > b[0] + 2 && x < b[2] - 2 && y > b[1] + 2 && y < b[3] - 2); };
    // 각도 글자의 주인은 가장 가까운 부채꼴, 이름표의 주인은 처음 가장 가까운 점
    const owns = (L, x = L.x, y = L.y) => {
      if (L.angle) {
        const [ox, oy] = [L.x, L.y]; L.x = x; L.y = y;
        // 제 각 안(또는 맞꼭지각 쪽)에 있으면 좁은 각이라 멀리 놓인 것도 괜찮다
        const A = L.angle, vx = x - A.at[0], vy = y - A.at[1], cr = (u, v) => u[0] * v[1] - u[1] * v[0], s0 = Math.sign(cr(A.ua, A.ub));
        const wedge = (v) => Math.sign(cr(A.ua, v)) === s0 && Math.sign(cr(v, A.ub)) === s0;
        const own = sectorDist(L, A), inside = wedge([vx, vy]) || wedge([-vx, -vy]);
        const far = (L.size * 1.8) / Math.max(Math.sin(A.theta / 2), 0.2); // 좁은 각일수록 글자가 멀리 가야 들어간다
        const ok = (inside ? own <= far : own <= L.size * 1.0) && arcs.every((B) => B === A || sectorDist(L, B) > own + L.size * 0.4); // 다른 부채꼴과 비슷하게 가까우면 어느 각인지 헷갈린다
        L.x = ox; L.y = oy;
        return ok;
      }
      return L.owner == null || near(x, y, rivals) === L.owner;
    };
    const crosses = (p, q, [a, c]) => {
      const cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
      return cr(p, q, a) * cr(p, q, c) < 0 && cr(a, c, p) * cr(a, c, q) < 0;
    };
    // 이름표와 제 점 사이를 선이 가로막는가(꼭짓점에서 나가는 변은 빼고)
    const walled = (L) => {
      if (L.owner == null || L.angle) return false;
      const p = anchors[L.owner];
      const dist = ([a, c]) => { const dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
      return lines.some((sg) => !sg.dot && dist(sg) > 6 && crosses(p, [L.x, L.y], sg)); // 점을 지나는 선(점이 선 위)은 빼고
    };
    const inPoly = (pp, x, y) => { let c = false; for (let i = 0, j = pp.length - 1; i < pp.length; j = i++) { const [xi, yi] = pp[i], [xj, yj] = pp[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    // 각 표시: 한 변 양끝 부채꼴이 겹치면 둘 다 줄인다. 그 뒤 글자를 각 안쪽(안 되면 바깥쪽)에 놓고 고정한다
    const placeAngles = () => {
      for (const A of arcs) for (const B of arcs) {
        if (A === B) continue;
        const d = Math.hypot(A.at[0] - B.at[0], A.at[1] - B.at[1]);
        if (d > 1 && A.r + B.r + 4 > d) { const k = Math.max(0.3, (d - 4) / (A.r + B.r)); A.r = Math.max(10, A.r * k); B.r = Math.max(10, B.r * k); }
      }
      for (const A of arcs) {
        const { at, r, ua, ub, it } = A;
        const p1 = [at[0] + ua[0] * r, at[1] + ua[1] * r], p2 = [at[0] + ub[0] * r, at[1] + ub[1] * r];
        const sweep = ua[0] * ub[1] - ua[1] * ub[0] > 0 ? 1 : 0;
        A.g.appendChild(svg("path", { d: `M${at.join(",")} L${p1.join(",")} A${r},${r} 0 0 ${sweep} ${p2.join(",")} Z`,
          fill: it.fill || "#ffd6ea", stroke: it.line || "#f06aa8", "stroke-width": 2 }));
      }
      const done = [];
      const fits = (L, A) => !lines.some((sg) => hitsSeg(L, sg, 2)) && owns(L)
        && arcs.every((B) => !covers(L, B) && (B === A || sectorDist(L, B) > 2))
        && pending.every((M) => M === L || (M.angle && !done.includes(M)) || !overlap(L, M, 2));
      for (const A of arcs) {
        const L = A.L;
        if (!L) continue;
        const base = L.size, [mx, my] = A.mid;
        // side: 이등분선에서 옆으로 비킨 자리(대칭축이 각을 지나갈 때). out: 각 바깥쪽
        const spot = (size, out, side = 0, far = 1) => {
          L.size = size;
          const [w, h] = textBox(L), ext = Math.abs(mx) * w / 2 + Math.abs(my) * h / 2;
          let d;
          if (out) d = -(ext + 6);
          else if (A.it.label_off != null) d = A.r + A.it.label_off;
          else {
            // 두 변에 걸리지 않을 거리: 변에 수직인 상자 반쪽 / sin(반각)
            const perp = ([ux, uy]) => Math.abs(uy) * w / 2 + Math.abs(ux) * h / 2;
            d = Math.max(A.r + ext + 3, (Math.max(perp(A.ua), perp(A.ub)) + 3) / Math.max(Math.sin(A.theta / 2), 0.15));
          }
          const sx = side * (Math.abs(my) * w / 2 + Math.abs(mx) * h / 2 + 5);
          d *= far;
          L.x = L.x0 = A.at[0] + mx * d - my * sx; L.y = L.y0 = A.at[1] + my * d + mx * sx;
        };
        // 순서: 각 안 바로 옆 → 각 바깥 → 작은 글자로 같은 순서 → 각 안에서 옆으로 비키거나 멀리
        const tries = [];
        for (const k of [1, 0.85]) tries.push([base * k, false, 0, 1], [base * k, true, 0, 1]);
        for (const k of [1, 0.85]) for (const far of [1, 1.3, 1.6, 2, 2.5]) for (const side of [1, -1]) tries.push([base * k, false, side, far]);
        if (!tries.some(([size, out, side, far]) => (spot(size, out, side, far), fits(L, A)))) { spot(base * 0.85, false); L.bad = true; }
        L.pin = true;
        done.push(L);
      }
    };
    // 그린 뒤 검사용: 글자가 제 꼭짓점·각·변을 떠났거나 겹친 것. window.__FIG_ISSUES 가 있으면 거기에 쌓는다
    const audit = () => {
      const out = window.__FIG_ISSUES;
      if (!out) return;
      const add = (kind, text) => out.push({ kind, text });
      pending.forEach((L, i) => {
        if (L.it.box) return;
        if (L.owner != null && !owns(L)) add(L.angle ? "각도 글자가 다른 꼭짓점에 더 가까움" : "이름표가 다른 점에 더 가까움", L.text);
        if (L.bad) add("각도 글자 놓을 자리 없음", L.text);
        if (walled(L)) add("이름표와 제 점 사이에 선", L.text);
        if (lines.some((sg) => hitsSeg(L, sg, -2))) add("글자가 선에 걸침", L.text);
        // 데이터 자리에서 밀려 선을 건너갔으면 다른 변·선분의 글자로 읽힌다(도형 안↔밖)
        if (!L.pin && Math.hypot(L.x - L.x0, L.y - L.y0) > 1 && lines.some((sg) => !sg.dot && crosses([L.x0, L.y0], [L.x, L.y], sg))) add("글자가 선 반대쪽으로 밀림", L.text);
        pending.forEach((M, j) => { if (j > i && !M.it.box && overlap(L, M, -1)) add("글자끼리 겹침", L.text + " / " + M.text); });
        arcs.forEach((B) => { if (covers(L, B)) add("글자가 각 표시를 덮음", L.text); });
        if (!L.angle && /°/.test(L.text)) {
          const free = arcs.filter((B) => !B.L).map((B) => sectorDist(L, B));
          // 빈 부채꼴(글자 없는 각 표시)이 있을 때만: 부채꼴 없이 글자로만 각을 적는 그림도 있다
          if (free.length && Math.min(...free) > L.size * 0.5) add("각도 글자가 각 표시에서 떨어짐", L.text);
        }
        // 가장 가까운 선이 다각형 변일 때만(대각선·대칭축 위 길이는 안쪽이 맞다)
        if ((L.len || /(\d|\])\s*(c?m|mm)$/.test(L.text)) && L.it.side !== "in" && polys.some((pp) => inPoly(pp, L.x, L.y))) {
          const segD = ([a, c]) => { const dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((L.x - a[0]) * dx + (L.y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(L.x - a[0] - t * dx, L.y - a[1] - t * dy); };
          const best = lines.reduce((m, sg) => (segD(sg) < segD(m) ? sg : m), lines[0]);
          if (best && best.edge && !lines.some((sg) => sg.seg && segD(sg) < L.size * 2)) add("길이 글자가 도형 안쪽", L.text);
        }
      });
      arcs.forEach((A, i) => arcs.forEach((B, j) => { if (j > i && Math.hypot(A.at[0] - B.at[0], A.at[1] - B.at[1]) < A.r + B.r - 1) add("각 표시끼리 겹침", (A.L?.text || "") + " / " + (B.L?.text || "")); }));
    };
    const placeLabels = () => {
      const pad = 3;
      pending.forEach((L) => {
        if (!L.name || !anchors.length) return;
        // 도형 안에 쓴 한 글자는 도형 이름(가, 나)이다. 점 옆에 있을 때만 점 이름으로 본다(IMG_Q_114323)
        if (polys.some((pp) => inPoly(pp, L.x0, L.y0))) {
          const k = near(L.x0, L.y0, dots);
          if (k >= 0 && Math.hypot(anchors[k][0] - L.x0, anchors[k][1] - L.y0) < L.size * 2) L.owner = k;
          return;
        }
        L.owner = near(L.x0, L.y0);
      });
      rivals = new Set([...dots, ...pending.filter((L) => L.owner != null && !L.angle).map((L) => L.owner)]);
      placeAngles();
      // 점 이름이 선 위에 놓였거나 이름과 제 점 사이에 선이 끼면 제 점 둘레 16 방향에서 선·다른 글자에 안 걸리는 자리를 고른다
      for (const L of pending) {
        // 선 위에 놓인 것은 점(dot) 이름만 옮긴다. 대칭축 끝 이름(ㅁ, ㅂ)은 원래 선 끝에 붙여 쓴다(IMG_Q_523235)
        if (L.owner == null || L.it.box || L.it.fixed || !(walled(L) || (dots.has(L.owner) && lines.some((sg) => hitsSeg(L, sg, 2))))) continue;
        const [ax, ay] = anchors[L.owner], d0 = Math.max(Math.hypot(L.x - ax, L.y - ay), L.size * 0.8);
        const a0 = Math.atan2(L.y - ay, L.x - ax);
        const free = (x, y) => { const [ox, oy] = [L.x, L.y]; L.x = x; L.y = y;
          const ok = !lines.some((sg) => hitsSeg(L, sg, 2)) && owns(L) && !walled(L) && pending.every((M) => M === L || !overlap(L, M, 2)) && arcs.every((B) => !covers(L, B));
          L.x = ox; L.y = oy; return ok; };
        found: for (const f of [1, 1.3, 1.6]) for (let k = 0; k < 16; k++) { // 처음 방향부터 ±22.5° 씩 번갈아
          const ang = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8), x = ax + Math.cos(ang) * d0 * f, y = ay + Math.sin(ang) * d0 * f;
          if (free(x, y)) { L.x = L.x0 = x; L.y = L.y0 = y; break found; }
        }
      }
      for (let iter = 0; iter < 60; iter++) {
        let moved = false;
        for (const L of pending) {
          if (L.it.box || L.it.fixed || L.pin) continue;
          const lim = L.size * 1.5; // 처음 자리에서 글자 크기의 1.5배 넘게는 옮기지 않는다
          let px = 0, py = 0;
          for (const sgm of lines) {
            if (!hitsSeg(L, sgm, pad)) continue;
            const [a, c] = sgm, [ux, uy] = unitv(a, c);
            let vx = -uy, vy = ux;
            if ((L.x - a[0]) * vx + (L.y - a[1]) * vy < 0) { vx = -vx; vy = -vy; }
            if (sgm.edge) {
              // 다각형 변은 가장 가까운 점의 반대쪽으로 민다. 법선으로 밀면 꼭짓점에 닿은 글자가 두 변 법선의 합으로
              // 도형 안쪽으로 밀려 들어갔다(G_523135_01 의 5 cm). 화살표·선분은 법선 그대로(끝에 일부러 붙인 글자, IMG_Q_613116)
              const dx = c[0] - a[0], dy = c[1] - a[1], t = Math.max(0, Math.min(1, ((L.x - a[0]) * dx + (L.y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
              const wx = L.x - a[0] - t * dx, wy = L.y - a[1] - t * dy, wl = Math.hypot(wx, wy);
              if (wl > 1e-6) { vx = wx / wl; vy = wy / wl; }
            }
            px += vx; py += vy;
          }
          const [w, h] = textBox(L);
          for (const M of pending) {
            if (M === L) continue;
            const [w2, h2] = textBox(M);
            if (Math.abs(L.x - M.x) < (w + w2) / 2 + pad && Math.abs(L.y - M.y) < (h + h2) / 2 + pad) {
              const [ux, uy] = Math.hypot(L.x - M.x, L.y - M.y) > 0.1 ? unitv([M.x, M.y], [L.x, L.y]) : [1, 0];
              px += ux; py += uy;
            }
          }
          const pl = Math.hypot(px, py);
          if (pl < 1e-6) continue;
          const nx = L.x + (px / pl) * 1.5, ny = L.y + (py / pl) * 1.5;
          if (Math.hypot(nx - L.x0, ny - L.y0) > lim || !owns(L, nx, ny)) continue;
          const [ox, oy] = [L.x, L.y]; L.x = nx; L.y = ny;
          if (!walled({ ...L, x: ox, y: oy }) && walled(L)) { L.x = ox; L.y = oy; continue; } // 제 점과의 사이에 선이 끼게는 밀지 않는다
          moved = true;
        }
        if (!moved) break;
      }
      pending.forEach(drawLabel);
      audit();
    };
    const drawLabel = ({ x, y, text, it, size }) => {
      // 분수·자음 마크업을 쓰려고 foreignObject 안에 HTML 로 넣는다
      const bw = size * (String(text).length * 1.2 + 2), bh = size * 3;
      const fo = svg("foreignObject", { x: x - bw / 2, y: y - bh / 2, width: bw, height: bh });
      const d = el("div", "r-fig-label" + (it.box ? " boxed" : ""), inline(String(text)));
      d.style.fontSize = size + "px";
      if (it.color) d.style.color = it.color;
      if(it.font_family){d.style.fontFamily=it.font_family;d.style.fontWeight=it.font_weight??400;}
      if(it.letter_spacing!==undefined)d.style.letterSpacing=it.letter_spacing+"px";
      if(it.text_stroke!==undefined)d.style.webkitTextStroke=it.text_stroke+"px "+(it.stroke_color||it.color||"#343434");if(it.stroke_color)d.style.paintOrder="stroke fill";if(it.rotation)d.style.transform=`rotate(${it.rotation}deg)`;
      const wrap = el("div", "r-fig-wrap");
      wrap.style.justifyContent = it.anchor === "l" ? "flex-start" : it.anchor === "r" ? "flex-end" : "center";
      wrap.appendChild(d);
      fo.appendChild(wrap);
      s.appendChild(fo);
    };
    const arrowHead = (a, c, col, w) => {
      const [ux, uy] = unitv(a, c), L = b.arrow_head_length??(14 + w * 2), Wd = b.arrow_head_width??(8 + w);
      const p = [c[0] - ux * L + uy * Wd, c[1] - uy * L - ux * Wd], q = [c[0] - ux * L - uy * Wd, c[1] - uy * L + ux * Wd];
      s.appendChild(svg("polygon", { points: `${c.join(",")} ${p.join(",")} ${q.join(",")}`, fill: col }));
    };

    for (const it of items) {
      if (it.t === "poly") {
        const pp = it.pts.map(P), pts = pp.map((p) => p.join(",")).join(" ");
        pp.forEach((p, i) => { if (i < pp.length - 1 || !it.open) lines.push(Object.assign([p, pp[(i + 1) % pp.length]], { edge: !it.open })); });
        pp.forEach(anchorOf);
        if (!it.open) polys.push(pp);
        if(it.ellipse)s.appendChild(svg("ellipse",{cx:it.ellipse.cx*u,cy:it.ellipse.cy*u,rx:it.ellipse.rx*u,ry:it.ellipse.ry*u,...strokeOf(it),fill:it.fill||"none"}));else if(it.path)s.appendChild(svg("path",{d:it.path,...strokeOf(it),fill:it.fill||"none"}));else if(it.radius && pp.length===4 && new Set(pp.map(p=>p[0])).size===2 && new Set(pp.map(p=>p[1])).size===2){const xx=pp.map(p=>p[0]),yy=pp.map(p=>p[1]);s.appendChild(svg("rect",{x:Math.min(...xx),y:Math.min(...yy),width:Math.max(...xx)-Math.min(...xx),height:Math.max(...yy)-Math.min(...yy),rx:it.radius,...strokeOf(it),fill:it.fill||"none"}));}else s.appendChild(svg(it.open ? "polyline" : "polygon", { points: pts, ...strokeOf(it), fill: it.open ? "none" : (it.fill || "none") }));
      } else if (it.t === "seg" || it.t === "arrow") {
        let a = P(it.a), c = P(it.b);
        const [ux, uy] = unitv(a, c), e = it.ext_len ?? 40;
        if (it.ext === "both" || it.ext === "a") a = [a[0] - ux * e, a[1] - uy * e];
        if (it.ext === "both" || it.ext === "b") c = [c[0] + ux * e, c[1] + uy * e];
        s.appendChild(svg("line", { x1: a[0], y1: a[1], x2: c[0], y2: c[1], ...strokeOf(it) }));
        lines.push(Object.assign([a, c], { seg: true }));
        anchorOf(P(it.a)); anchorOf(P(it.b)); // 대칭축 끝 이름(ㅁ, ㅂ)의 주인
        if (it.t === "arrow") arrowHead(a, c, it.line || ink, it.bw ?? sw);
      } else if (it.t === "curve") {
        // 점들을 지나는 부드러운 곡선(Catmull-Rom → 베지어). closed:true 면 닫힌 곡선
        const pp = it.pts.map(P), n = pp.length, cl = !!it.closed, g = (i) => pp[cl ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
        let d = `M${pp[0].join(",")}`;
        for (let i = 0; i < (cl ? n : n - 1); i++) {
          const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
          const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
          d += ` C${c1.join(",")} ${c2.join(",")} ${p2.join(",")}`;
        }
        s.appendChild(svg("path", { d: d + (cl ? " Z" : ""), ...strokeOf(it), fill: cl ? (it.fill || "none") : "none" }));
      } else if (it.t === "circle") {
        const [cx, cy] = P(it.c);
        s.appendChild(svg("circle", { cx, cy, r: it.r * u, ...strokeOf(it), fill: it.fill || "none" }));
      } else if (it.t === "arc") {
        // 원의 일부(호). from→to 도, 0° 는 오른쪽, 시계 방향(+y 아래)으로 잰다. pie:true 면 부채꼴
        const [cx, cy] = P(it.c), r = it.r * u, f = (it.from * Math.PI) / 180, g = (it.to * Math.PI) / 180;
        const p1 = [cx + r * Math.cos(f), cy + r * Math.sin(f)], p2 = [cx + r * Math.cos(g), cy + r * Math.sin(g)];
        const span = (((it.to - it.from) % 360) + 360) % 360, large = span > 180 ? 1 : 0;
        const d = (it.pie ? `M${cx},${cy} L` : "M") + `${p1.join(",")} A${r},${r} 0 ${large} 1 ${p2.join(",")}` + (it.pie ? " Z" : "");
        s.appendChild(svg("path", { d, ...strokeOf(it), fill: it.pie ? (it.fill || "none") : "none" }));
      } else if (it.t === "angle") {
        // 부채꼴은 자리만 잡아 두고 placeLabels 에서 그린다: 한 변 양끝 부채꼴이 겹치면 반지름을 줄여야 해서
        const at = P(it.at), [ax, ay] = unitv(at, P(it.a)), [bx2, by2] = unitv(at, P(it.b));
        const mx = ax + bx2, my = ay + by2, ml = Math.hypot(mx, my) || 1;
        const theta = Math.acos(Math.max(-1, Math.min(1, ax * bx2 + ay * by2)));
        const g = svg("g");
        s.appendChild(g);
        const A = { it, at, g, r: it.r ?? 26, ua: [ax, ay], ub: [bx2, by2], mid: ml > 1e-6 ? [mx / ml, my / ml] : [-ay, ax], theta, owner: anchorOf(at) };
        if (it.label) { A.L = label(at[0], at[1], it.label, it); A.L.angle = A; A.L.owner = A.owner; }
        arcs.push(A);
      } else if (it.t === "right") {
        const at = P(it.at), k = it.size ?? 16, [ax, ay] = unitv(at, P(it.a)), [bx2, by2] = unitv(at, P(it.b));
        const p1 = [at[0] + ax * k, at[1] + ay * k], p3 = [at[0] + bx2 * k, at[1] + by2 * k], p2 = [p1[0] + bx2 * k, p1[1] + by2 * k];
        s.appendChild(svg("polyline", { points: [p1, p2, p3].map((p) => p.join(",")).join(" "), fill: "none", stroke: it.line || "#f06aa8", "stroke-width": 2 }));
      } else if (it.t === "len") {
        // 변 가운데에서 도형 바깥쪽(side 로 뒤집기)으로 띄워 적는다
        const a = P(it.a), c = P(it.b), [ux, uy] = unitv(a, c), sg = it.side === "in" ? -1 : 1;
        const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, off = it.off ?? fs * 1.1;
        // 기본 바깥쪽: 아래·오른쪽을 향한 법선
        let nx = uy, ny = -ux;
        if (ny < 0 || (Math.abs(ny) < 1e-6 && nx < 0)) { nx = -nx; ny = -ny; }
        if (it.flip) { nx = -nx; ny = -ny; }
        if (it.arc) {
          // 길이 범위 점선(원본처럼 하늘색 점선 호): a→b 를 바깥쪽으로 bulge(px) 만큼 부풀린 곡선, 글자는 꼭대기 바깥
          const h = (it.bulge ?? Math.min(Math.hypot(c[0] - a[0], c[1] - a[1]) * 0.18, 34)) * sg;
          const q = [mx + nx * h * 2, my + ny * h * 2];
          s.appendChild(svg("path", { d: `M${a.join(",")} Q${q.join(",")} ${c.join(",")}`, fill: "none",
            stroke: it.line || "#3cc4ec", "stroke-width": 2.5, "stroke-dasharray": "1 6", "stroke-linecap": "round" }));
          const pts = Array.from({ length: 9 }, (_, k) => { const t = k / 8; return [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * q[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * q[1] + t * t * c[1]]; });
          for (let k = 0; k < 8; k++) lines.push([pts[k], pts[k + 1]]);
          label(mx + nx * (h + (it.off ?? fs * 0.75) * sg), my + ny * (h + (it.off ?? fs * 0.75) * sg), it.text, it).len = [a, c];
        } else label(mx + nx * off * sg, my + ny * off * sg, it.text, it).len = [a, c];
      } else if (it.t === "tick") {
        const a = P(it.a), c = P(it.b), [ux, uy] = unitv(a, c), n = it.n ?? 1, k = 9;
        const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
        for (let i = 0; i < n; i++) {
          const o = (i - (n - 1) / 2) * 7;
          const cx = mx + ux * o, cy = my + uy * o;
          s.appendChild(svg("line", { x1: cx - uy * k, y1: cy + ux * k, x2: cx + uy * k, y2: cy - ux * k, stroke: it.line || ink, "stroke-width": 2.5 }));
        }
      } else if (it.t === "dot") {
        const [cx, cy] = P(it.at);
        s.appendChild(svg("circle", { cx, cy, r: it.r ?? 5, fill: it.fill || ink }));
        const k = it.r ?? 5; // 점 이름이 점을 덮지 않게 점도 피한다
        lines.push(Object.assign([[cx - k, cy - k], [cx + k, cy + k]], { dot: true }), Object.assign([[cx - k, cy + k], [cx + k, cy - k]], { dot: true }));
        dots.add(anchorOf([cx, cy]));
      } else if (it.t === "text") {
        const [x, y] = P(it.at);
        const L = label(x, y, it.text, it);
        L.name = /^[ㄱ-ㅎ가-힣]$/.test(String(it.text).trim()); // 꼭짓점·점 이름: 밀어도 처음 가장 가까운 점 쪽에 남긴다
      }
    }
    if(b.fixed_labels)pending.forEach(drawLabel);else placeLabels();
    // theme 을 주면 둥근 상자 안에 넣는다 (합동 문제의 왼쪽 기준 도형 등)
    const box = style(el("div", "r-figure-box" + (b.theme ? " r-box" : "")), { ...b, size: undefined, w: undefined, h: undefined });
    box.appendChild(s);
    return box;
  });

  /* ---- arrow: 글줄 사이에 놓는 화살표 기호 ----
   * {kind:"arrow", dir:"right", color:"#8fb8e8", len:40} — dir: right / down / left / up */
  register("arrow", (b) => {
    const len = b.len ?? 40, th = b.bw ?? 10, col = b.color || "#8a8a8a";
    const s = svg("svg", { class: "r-svg r-arrow", width: len, height: len, viewBox: `0 0 ${len} ${len}` });
    const m = len / 2, hl = len * 0.45;
    s.appendChild(svg("path", { d: `M2,${m} L${len - hl},${m}`, stroke: col, "stroke-width": th, "stroke-linecap": "butt" }));
    s.appendChild(svg("polygon", { points: `${len - hl - 1},${m - th * 1.3} ${len - 1},${m} ${len - hl - 1},${m + th * 1.3}`, fill: col }));
    const rot = { right: 0, down: 90, left: 180, up: 270 }[b.dir || "right"];
    if (rot) s.style.transform = `rotate(${rot}deg)`;
    return s;
  });

  /* ---- flow: 상자와 연산을 화살표로 잇는 계산 흐름 ----
   * style "arc": 처음 상자 → (위쪽 타원 연산들) → 끝 상자, 위로 굽은 화살표 하나
   *   {kind:"flow", style:"arc", nodes:[{text:"24", theme:"green"}, {text:"", theme:"green"}],
   *    ops:[{text:"-10", theme:"yellow"}, {text:"+23", theme:"yellow"}]}
   * style "line": 상자들을 곧은 화살표로 차례로 잇고, 화살표 위에 연산 글자
   *   {kind:"flow", style:"line", nodes:[{text:"3"},{text:""},{text:"40"}], ops:[{text:"×4"},{text:"+28"}]}
   * 상자: text(빈 칸은 ""), theme 또는 fill/line, w, h, round(동그라미). 연산: text, theme, plain(타원 없이 글자만) */
  register("flow", (b) => {
    const fs = b.size ?? 34, ink = "#303030";
    const nw = b.node_w ?? 150, nh = b.node_h ?? 92, ow = b.op_w ?? 150, oh = b.op_h ?? 78;
    const e = style(el("div", "r-flow"), { ...b, w: undefined, h: undefined });
    e.style.position = "relative";
    e.style.fontSize = fs + "px";
    const place = (node, x, y, w, h, cls) => {
      const d = style(el("div", "r-flow-node " + cls, inline(node.text ?? "")), { theme: node.theme, fill: node.fill, line: node.line, size: node.size });
      Object.assign(d.style, { position: "absolute", left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
      if (node.round) d.classList.add("round");
      e.appendChild(d);
      return d;
    };
    const s = svg("svg", { class: "r-svg" });
    Object.assign(s.style, { position: "absolute", left: 0, top: 0, overflow: "visible" });
    const col = b.arrow_color || "#555";
    const head = (x, y, ang) => {
      const L = 16, W = 8, c = Math.cos(ang), sn = Math.sin(ang);
      const p = [x - c * L + sn * W, y - sn * L - c * W], q = [x - c * L - sn * W, y - sn * L + c * W];
      s.appendChild(svg("polygon", { points: `${x},${y} ${p.join(",")} ${q.join(",")}`, fill: col }));
    };
    const nodes = b.nodes || [], ops = b.ops || [];
    let W, H;
    if ((b.style || "arc") === "arc") {
      const n0 = nodes[0] || {}, n1 = nodes[nodes.length - 1] || {};
      const w0 = n0.w ?? nw, w1 = n1.w ?? nw, h0 = n0.h ?? nh, h1 = n1.h ?? nh;
      const opsW = ops.reduce((a, o) => a + (o.w ?? ow), 0);
      const gap = Math.max(opsW + 40, b.gap ?? 0);
      W = w0 + gap + w1; const ny = oh + (b.rise ?? 30); H = ny + Math.max(h0, h1);
      place(n0, 0, ny, w0, h0, "box");
      place(n1, w0 + gap, ny, w1, h1, "box");
      // 끝 상자 뒤 글자 (나눗셈의 "··· 2" 처럼 나머지)
      if (n1.after) { const aw2 = n1.after_w ?? 160; place({ text: n1.after }, w0 + gap + w1 + 10, ny, aw2, h1, "plain"); W += aw2 + 10; }
      let ox = (W - opsW) / 2;
      const oy = 0, oxs = ox;
      ops.forEach((o) => { place(o, ox, oy, o.w ?? ow, o.h ?? oh, o.plain ? "plain" : "oval"); ox += o.w ?? ow; });
      const sx = w0 / 2, ex = w0 + gap + w1 / 2, my = oh / 2;
      s.appendChild(svg("path", { d: `M${sx},${ny} C${sx},${my} ${oxs - 30},${my} ${oxs},${my}`, fill: "none", stroke: col, "stroke-width": 3 }));
      s.appendChild(svg("path", { d: `M${ox},${my} C${ox + 30},${my} ${ex},${my} ${ex},${ny - 4}`, fill: "none", stroke: col, "stroke-width": 3 }));
      head(ex, ny - 2, Math.PI / 2);
    } else {
      const aw = b.arrow_w ?? 120;
      let x = 0; H = nh + oh * 0.9; const ny = oh * 0.9;
      nodes.forEach((n, i) => {
        const w = n.w ?? nw, h = n.h ?? nh;
        place(n, x, ny + (nh - h) / 2, w, h, "box");
        x += w;
        if (i < nodes.length - 1) {
          const ay = ny + nh / 2;
          s.appendChild(svg("line", { x1: x + 8, y1: ay, x2: x + aw - 10, y2: ay, stroke: col, "stroke-width": 3 }));
          head(x + aw - 8, ay, 0);
          const o = ops[i];
          if (o) place(o, x + (aw - (o.w ?? aw - 10)) / 2, ny - (o.h ?? oh * 0.8) - 4, o.w ?? aw - 10, o.h ?? oh * 0.8, o.plain === false ? "oval" : "plain");
          x += aw;
        }
      });
      W = x;
    }
    e.style.width = W + "px"; e.style.height = H + "px";
    s.setAttribute("width", W); s.setAttribute("height", H);
    e.insertBefore(s, e.firstChild);
    return e;
  });

  /* ---- solid: 입체도형 (겨냥도, 쌓기나무) ----
   * 좌표 x 오른쪽, y 안쪽(깊이), z 위. 사선 투영: 깊이는 오른쪽 위로 비스듬히(k 배) 줄여 그린다.
   * {kind:"solid", type:"cuboid", a:6, b:3, c:4, unit:40, labels:[{at:[3,0,0], text:"6 cm", dy:1}]}
   *   type: cuboid(a 가로, b 깊이, c 높이) / prism(n 각, r 반지름, h 높이) / pyramid(n, r, h)
   *         cylinder(r, h) / cone(r, h) / sphere(r) / cubes(heights 2차원: 행이 뒤→앞, 칸마다 쌓은 개수)
   *   fill, line, hidden:false(숨은 선 안 그림), k(깊이 비율 0.5), colors(cubes: heights 와 같은 모양, 층마다 색 글자 "r" "b" ...) */
  register("solid", (b) => {
    const u = b.unit ?? 40, ink = b.line || "#303030", sw = b.bw ?? 3, fs = b.size ?? 24;
    const fill = b.fill || "#e8f4ff", k = b.k ?? 0.5, c45 = Math.SQRT1_2;
    const s = svg("svg", { class: "r-svg", "data-solid-type": b.type || "cuboid" });
    s.style.overflow = "visible";
    const pts = [];
    let proj;
    const line = (p, q, hidden) => s.appendChild(svg("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: ink, "stroke-width": hidden ? 2 : sw,
      "stroke-linecap": "round", ...(hidden && { "stroke-dasharray": "6 6" }) }));
    const poly = (ps, f, st = "none", w = sw) => s.appendChild(svg("polygon", { points: ps.map((p) => p.join(",")).join(" "), fill: f, stroke: st, "stroke-width": w, "stroke-linejoin": "round" }));
    const shade = (hex, t) => {
      const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, bl = n & 255;
      const f = (v) => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t));
      return "#" + [f(r), f(g), f(bl)].map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    const T = b.type || "cuboid";
    if (T === "cubes") {
      // 겨냥도와 같은 사선 투영: 앞면이 정면, 깊이(뒤 행)는 오른쪽 위로. 보이는 면: 위, 앞, 오른쪽
      const H = b.heights, cs = b.cube ?? 46, kk = (b.k ?? 0.5) * c45, nr = H.length, iso = b.view === "iso";
      // view:"iso": 등각 투영(2학년 쌓기나무 그림처럼 비스듬히 돌려 본 모양). 열은 오른쪽 아래로, 뒤 행은 오른쪽 위로
      const c30 = Math.cos(Math.PI / 6), s30 = 0.5;
      proj = iso ? (x, y, z) => [(x + y) * c30 * cs, ((x - y) * s30 - z) * cs] : (x, y, z) => [(x + y * kk) * cs, -(z + y * kk) * cs];
      if (b.view === "illustration") proj=(x,y,z)=>[(x+y*(b.depth_x??0.52))*cs,(x*(b.tilt??0.14)-y*(b.depth_y??0.30)-z)*cs];
      const base = b.fill || "#d6b07a", cols = b.colors || [];
      const pal = { r: "#e8746a", b: "#7fb2e8", g: "#8fd16a", y: "#f6d65a", p: "#c79be8", w: "#fafafa", ...(b.palette||{}) };
      const cubes = [];
      // 행 r 은 뒤→앞, 깊이 d = 맨 앞 행이 0
      H.forEach((row, r) => row.forEach((h, c) => { for (let z = 0; z < h; z++) cubes.push([c, r, z, nr - 1 - r]); }));
      // 그리는 순서: 뒤(깊이 큰 것) 먼저, 같은 깊이는 왼쪽·아래 먼저
      // 등각 투영은 (열 - 깊이) 가 작은 것이 더 멀다
      cubes.sort(iso ? (p, q) => (p[0] - p[3]) - (q[0] - q[3]) || p[2] - q[2] : (p, q) => q[3] - p[3] || p[0] - q[0] || p[2] - q[2]);
      s.setAttribute("data-cube-count", cubes.length);
      for (const [c, r, z, d] of cubes) {
        const key = cols[r] && cols[r][c] ? String(cols[r][c])[z] : null;
        const f = (key && pal[key]) || base;
        const P = (dx, dy, dz) => proj(c + dx, d + dy, z + dz);
        const top = [P(0, 0, 1), P(1, 0, 1), P(1, 1, 1), P(0, 1, 1)];
        const front = [P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)];
        const right = [P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)];
        poly(top, shade(f, b.top_light ?? 0.35), b.edge || "#7a4b1e", b.edge_width ?? 2); poly(front, f, b.edge || "#7a4b1e", b.edge_width ?? 2); poly(right, shade(f, -0.18), b.edge || "#7a4b1e", b.edge_width ?? 2);
        [...top, ...front, ...right].forEach((p) => pts.push(p));
      }
    } else if (["cuboid", "prism", "pyramid"].includes(T)) {
      proj = (x, y, z) => [(x + y * k * c45) * u, -(z + y * k * c45) * u];
      const view = [-k * c45, 1, -k * c45];
      const faceVis = (n) => n[0] * view[0] + n[1] * view[1] + n[2] * view[2] < -1e-6;
      const polyhedron = (verts, faces) => {
        // faces 는 바깥에서 볼 때 반시계 순서. 보이는 면을 채우고, 보이는 면에 붙은 모서리는 실선, 아니면 점선
        const P3 = verts.map((v) => { const p = proj(...v); pts.push(p); return p; });
        const normal = (f) => {
          const [a, bb, c] = [verts[f[0]], verts[f[1]], verts[f[2]]];
          const u1 = [bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]], u2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          return [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]];
        };
        const vis = faces.map((f) => faceVis(normal(f)));
        // 면 방향으로 밝기: 윗면 밝게, 오른쪽 옆면 어둡게, 앞면은 그대로
        const tone = (n) => { const l = Math.hypot(...n) || 1; return n[2] / l > 0.5 ? 0.35 : n[0] / l > 0.3 ? -0.15 : 0; };
        faces.forEach((f, i) => { if (vis[i]) poly(f.map((j) => P3[j]), (b.face_fill && b.face_fill[i]) || shade(fill, tone(normal(f)))); });
        const edges = new Map();
        faces.forEach((f, i) => f.forEach((a, j) => {
          const c = f[(j + 1) % f.length], key = a < c ? a + "," + c : c + "," + a;
          edges.set(key, (edges.get(key) || false) || vis[i]);
        }));
        edges.forEach((v, key) => { const [a, c] = key.split(",").map(Number); if (v || b.hidden !== false) line(P3[a], P3[c], !v); });
      };
      if (T === "cuboid") {
        const a = b.a ?? 4, d = b.b ?? 2, h = b.c ?? 3;
        const v = [[0, 0, 0], [a, 0, 0], [a, d, 0], [0, d, 0], [0, 0, h], [a, 0, h], [a, d, h], [0, d, h]];
        polyhedron(v, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
      } else {
        const n = b.n ?? 3, r = b.r ?? 2, h = b.h ?? 3, rot = ((b.rotate ?? -90) * Math.PI) / 180;
        // 밑면 꼭짓점: 위에서 볼 때 반시계 (x 오른쪽, y 안쪽)
        const base = [...Array(n).keys()].map((i) => { const t = rot + (2 * Math.PI * i) / n; return [r + r * Math.cos(t), r + r * Math.sin(t), 0]; });
        if (T === "prism") {
          const v = [...base, ...base.map((p) => [p[0], p[1], h])];
          const faces = [[...Array(n).keys()].reverse(), [...Array(n).keys()].map((i) => i + n)];
          for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, (i + 1) % n + n, i + n]);
          polyhedron(v, faces);
        } else {
          const v = [...base, [r, r, h]];
          const faces = [[...Array(n).keys()].reverse()];
          for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
          polyhedron(v, faces);
        }
      }
    } else {
      // 원기둥·원뿔·구: 밑면은 납작한 타원(세로 k 배), 뒤쪽 반은 점선
      const r = (b.r ?? 1.5) * u, h = (b.h ?? 3) * u, ry = r * k;
      proj = (x, y, z) => [x * u, -z * u];
      const ell = (cy, dash) => {
        s.appendChild(svg("path", { d: `M${-r},${cy} A${r},${ry} 0 0 0 ${r},${cy}`, fill: "none", stroke: ink, "stroke-width": sw }));
        if (dash) s.appendChild(svg("path", { d: `M${-r},${cy} A${r},${ry} 0 0 1 ${r},${cy}`, fill: "none", stroke: ink, "stroke-width": 2, "stroke-dasharray": "6 6" }));
      };
      if (T === "cylinder") {
        pts.push([-r, -h - ry], [r, ry]);
        s.appendChild(svg("path", { d: `M${-r},0 L${-r},${-h} L${r},${-h} L${r},0 A${r},${ry} 0 0 1 ${-r},0 Z`, fill: shade(fill, -0.05), stroke: "none" }));
        s.appendChild(svg("ellipse", { cx: 0, cy: -h, rx: r, ry, fill: shade(fill, 0.4), stroke: ink, "stroke-width": sw }));
        line([-r, 0], [-r, -h]); line([r, 0], [r, -h]); ell(0, b.hidden !== false);
      } else if (T === "cone") {
        pts.push([-r, -h], [r, ry]);
        s.appendChild(svg("path", { d: `M${-r},0 L0,${-h} L${r},0 A${r},${ry} 0 0 1 ${-r},0 Z`, fill, stroke: "none" }));
        line([-r, 0], [0, -h]); line([r, 0], [0, -h]); ell(0, b.hidden !== false);
      } else {
        pts.push([-r, -r], [r, r]);
        s.appendChild(svg("circle", { cx: 0, cy: 0, r, fill, stroke: ink, "stroke-width": sw }));
        if (b.equator !== false) ell(0, true);
      }
    }
    if (b.surface && ["cylinder","sphere","cone"].includes(T)) {
      const id="solid-shade-"+(window.__solidShadeSerial=(window.__solidShadeSerial||0)+1);
      const defs=svg("defs",{}),grad=svg(T==="sphere"?"radialGradient":"linearGradient",{id,...(T==="sphere"?{cx:"30%",cy:"25%",r:"75%"}:{x1:"0%",x2:"100%",y1:"0%",y2:"0%"})});
      [["0%",shade(fill,0.45)],["45%",fill],["100%",shade(fill,-0.16)]].forEach(([offset,color])=>grad.appendChild(svg("stop",{offset,"stop-color":color})));
      defs.appendChild(grad);s.prepend(defs);
      const face=T==="sphere"?s.querySelector("circle"):s.querySelector("path");if(face)face.setAttribute("fill",`url(#${id})`);
    }
    // 글자: at 은 3차원 좌표 (cubes 는 칸 단위, 나머지는 unit 단위, 원기둥 등은 [x, 0, z]). dx, dy 는 글자 크기 배수로 옮김
    (b.labels || []).forEach((L) => {
      const p = proj(...L.at);
      const x = p[0] + (L.dx ?? 0) * fs, y = p[1] + (L.dy ?? 0) * fs, bw = fs * (String(L.text).length + 2), bh = fs * 2.6;
      pts.push([x - fs, y - fs * 0.6], [x + fs, y + fs * 0.6]);
      const fo = svg("foreignObject", { x: x - bw / 2, y: y - bh / 2, width: bw, height: bh });
      const wrap = el("div", "r-fig-wrap"); wrap.style.justifyContent = "center";
      const d = el("div", "r-fig-label", inline(String(L.text))); d.style.fontSize = fs + "px";
      if (L.color) d.style.color = L.color;
      wrap.appendChild(d); fo.appendChild(wrap); s.appendChild(fo);
    });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = 6;
    const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, W = Math.max(...xs) - x0 + m, Hh = Math.max(...ys) - y0 + m;
    s.setAttribute("width", W); s.setAttribute("height", Hh); s.setAttribute("viewBox", `${x0} ${y0} ${W} ${Hh}`);
    // lying: 눕힌 입체(굴러가는 원기둥·원뿔). 90 = 시계 방향으로 눕혀 밑면이 오른쪽, -90 = 왼쪽
    if (b.lying) {
      const box = el("div", "r-solid-lying"), deg = b.lying === true ? 90 : b.lying;
      box.style.width = Hh + "px"; box.style.height = W + "px"; box.style.position = "relative";
      s.style.position = "absolute"; s.style.left = (Hh - W) / 2 + "px"; s.style.top = (W - Hh) / 2 + "px";
      s.style.transform = `rotate(${deg}deg)`;
      box.appendChild(s);
      return box;
    }
    return s;
  });

  register("solid_scene", b=>{
    const e=el("div","r-solid-scene"),model=renderBlock(b.solid);
    Object.assign(e.style,{position:"relative",padding:"8px 76px 44px 8px",flexShrink:"0"});e.appendChild(model);
    (b.directions||["앞","오른쪽"]).forEach((text,i)=>{
      const label=el("div",null,inline(text));Object.assign(label.style,{position:"absolute",fontSize:(b.label_size||26)+"px",lineHeight:"34px",padding:"1px 10px",borderRadius:i?"12px":"50%",background:i?"#b5df91":"#ffdf59",whiteSpace:"nowrap"});
      if(i){label.style.right="0";label.style.top="55%";}else{label.style.left="22%";label.style.bottom="0";}e.appendChild(label);
    });return e;
  });

  /* Editable positioned illustrations; no complete-question bitmap substitution. */
  register("scatter_icons",b=>{
    const pos=[[22,17],[51,7],[78,21],[5,43],[35,43],[66,44],[89,50],[15,72],[47,71],[74,79]];
    const n=b.count??10,w=b.w??(n>5?116:64),h=b.h??110,e=el("div","r-scatter-icons");e.dataset.scatterCount=n;Object.assign(e.style,{position:"relative",width:w+"px",height:h+"px",flexShrink:"0"});
    for(let i=0;i<n;i++){let art;if(b.atlas){const a=b.atlas,index=a.indices?.[i]??i;art=el("img");Object.assign(art.style,{width:a.tile_w+"px",height:a.tile_h+"px"});art._ready=loadAtlas(a.src).then(im=>{const cv=document.createElement("canvas");cv.width=a.tile_w;cv.height=a.tile_h;cv.getContext("2d").drawImage(im,(index%a.cols)*a.tile_w,Math.floor(index/a.cols)*a.tile_h,a.tile_w,a.tile_h,0,0,a.tile_w,a.tile_h);art.src=cv.toDataURL();return art.decode()})}else art=renderBlock(b.srcs?.[i]?{kind:"pic",src:b.srcs[i],h:b.art_h??26}:{...b.art,h:26});const p=b.points?.[i]||(n>5?pos[i%10]:[8+(i%2)*28,8+Math.floor(i/2)*30]);Object.assign(art.style,{position:"absolute",left:p[0]+"px",top:p[1]+"px"});e.appendChild(art)}return e;
  });
  register("auditorium_seats",b=>{
    if(b.layout==="original_arc"){const n=b.count,rows=Math.floor(n/20),rest=n%20,W=484,H=rows*46+102,e=el("div");Object.assign(e.style,{position:"relative",width:W+"px",height:H+"px",flexShrink:"0"});let index=0;const put=(x,y,a)=>{const art=renderBlock({...b.art,h:27});art.dataset.seatIndex=index++;Object.assign(art.style,{position:"absolute",left:x+"px",top:y+"px",transform:`rotate(${a}deg)`});e.appendChild(art)};for(let r=0;r<rows;r++)for(let i=0;i<10;i++){const x=i*201/9,y=r*46+60*Math.sin(i/9*Math.PI/2);put(x,y,28*(1-i/9));put(454-x,y,-28*(1-i/9))}const rs=Math.min(49,(W-50)/Math.max(1,rest-1));for(let i=0;i<rest;i++)put((W-(rest-1)*rs-30)/2+i*rs,rows*46+55+16*Math.sin(i/Math.max(1,rest-1)*Math.PI),16*(1-2*i/Math.max(1,rest-1)));return e;}

    const n=b.count,rows=Math.floor(n/20),rest=n%20,e=el("div");Object.assign(e.style,{position:"relative",width:"500px",height:(rows*46+(rest?40:0)+35)+"px",flexShrink:"0"});
    const put=(x,y,angle)=>{const a=renderBlock({...b.art,h:24});Object.assign(a.style,{position:"absolute",left:x+"px",top:y+"px",transform:`rotate(${angle}deg)`});e.appendChild(a)};
    for(let r=0;r<rows;r++)for(let i=0;i<10;i++){const x=10+i*22,y=r*46+40*Math.sin(i/9*Math.PI/2);put(x,y,26*(1-i/9));put(465-x,y,-26*(1-i/9))}
    for(let i=0;i<rest;i++)put(250-rest*16+i*32,rows*46+25,0);return e;
  });
  register("flag_cards",b=>{
    const e=el("div");Object.assign(e.style,{display:"grid",gridTemplateColumns:`repeat(${b.cols||3}, ${b.cell_w||116}px)`,border:"2px solid #aaa",borderRadius:"12px",overflow:"hidden"});
    const flag=(name)=>{const s=svg("svg",{width:54,height:34,viewBox:"0 0 54 34"});
      const rect=(x,y,w,h,fill)=>s.appendChild(svg("rect",{x,y,width:w,height:h,fill}));
      if(name==="미국"){rect(0,0,54,34,"white");for(let i=0;i<7;i++)rect(0,i*2*34/13,54,34/13,"#c93a46");rect(0,0,23,19,"#27366e");for(let r=0;r<9;r++)for(let c=0;c<(r%2?5:6);c++){const x=1.8+c*3.7+(r%2?1.8:0),y=1.4+r*1.95;const points=Array.from({length:10},(_,i)=>{const t=-Math.PI/2+i*Math.PI/5,R=i%2?.35:.85;return `${x+Math.cos(t)*R},${y+Math.sin(t)*R}`}).join(" ");s.appendChild(svg("polygon",{points,fill:"white"}))}}
      else if(name==="영국"){rect(0,0,54,34,"#233970");[[0,0,54,34],[0,34,54,0]].forEach(([x1,y1,x2,y2])=>{s.appendChild(svg("line",{x1,y1,x2,y2,stroke:"white","stroke-width":8}));s.appendChild(svg("line",{x1,y1,x2,y2,stroke:"#cf3444","stroke-width":3}))});rect(21,0,12,34,"white");rect(0,11,54,12,"white");rect(24,0,6,34,"#cf3444");rect(0,14,54,6,"#cf3444");}
      else{rect(0,0,54,34,"#e53636");for(const [x,y,r] of [[10,10,6],[21,5,2],[25,10,2],[25,16,2],[21,21,2]]){const pts=Array.from({length:10},(_,i)=>{const t=-Math.PI/2+i*Math.PI/5,R=i%2?r*.4:r;return `${x+Math.cos(t)*R},${y+Math.sin(t)*R}`}).join(' ');s.appendChild(svg("polygon",{points:pts,fill:"#ffe267"}))}}return s;};
    for(const it of b.items){const cell=el("div"),text=el("div",null,inline(it.name)+"<br>"+inline(it.country));Object.assign(cell.style,{display:"flex",alignItems:"center",justifyContent:"space-around",border:"1px solid #aaa",height:(b.cell_h||94)+"px",padding:"2px",fontSize:"20px",background:"white"});cell.appendChild(text);cell.appendChild(flag(it.country));e.appendChild(cell)}return e;
  });
  register("positioned",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:b.w+"px",height:b.h+"px",flexShrink:"0"});for(const p of b.items){const host=el("div");Object.assign(host.style,{position:"absolute",left:p.x+"px",top:p.y+"px"});host.appendChild(renderBlock(p.block));e.appendChild(host)}if(b.guides){const s=svg("svg",{width:b.w,height:b.h,viewBox:`0 0 ${b.w} ${b.h}`});Object.assign(s.style,{position:"absolute",left:"0",top:"0",overflow:"visible",pointerEvents:"none"});for(const g of b.guides)s.appendChild(svg("line",{x1:g.a[0],y1:g.a[1],x2:g.b[0],y2:g.b[1],stroke:g.line||"#d966cc","stroke-width":g.bw??1.5,...(g.dash?{"stroke-dasharray":g.dash.join(" ")}:{})}));e.appendChild(s)}return e;});
  register("vector_scene",b=>{const s=svg("svg",{class:"r-svg",width:b.w,height:b.h,viewBox:`0 0 ${b.w} ${b.h}`});if(b.clip){s.style.overflow="hidden";s.style.borderRadius=(b.radius||0)+"px";}for(const n of b.items)s.appendChild(svg(n.tag,n.attrs,n.text));return s;});
  // Three editable model steps: remove the ones, then part of the ten.
  register("joining_cubes",b=>{
    const ns=b.groups.map(x=>x.count),W=600+Math.max(0,ns[2]-1)*94,s=svg("svg",{class:"r-svg",width:W,height:200,viewBox:`0 0 ${W} 200`});
    s.appendChild(svg("rect",{x:2,y:2,width:532,height:96,rx:24,fill:"none",stroke:"#e000db","stroke-width":5}));
    const palette=[["#359ed6","#075b90"],["#f24e53","#990c11"],["#72d840","#126500"]];
    for(let g=0;g<3;g++){const [fill,line]=palette[g],base=g===0?16:g===1?16+ns[0]*44+50:550,pitch=g===2?94:44;for(let i=0;i<ns[g];i++){const x=base+i*pitch;s.appendChild(svg("polygon",{points:`${x},38 ${x+14},24 ${x+58},24 ${x+44},38`,fill,stroke:line,"stroke-width":4}));s.appendChild(svg("polygon",{points:`${x+44},38 ${x+58},24 ${x+58},68 ${x+44},82`,fill,stroke:line,"stroke-width":4}));s.appendChild(svg("rect",{x,y:38,width:44,height:44,fill,stroke:line,"stroke-width":4,"data-joining-group":g}));s.appendChild(svg("circle",{cx:x+22,cy:60,r:10,fill:"none",stroke:line,"stroke-width":4}));}}
    const labels=b.labels.trim().split(/\s+/);labels.forEach((text,i)=>{const x=478+i*94;if(text==='[]')s.appendChild(svg("rect",{x:x-36,y:100,width:72,height:50,fill:'white',stroke:'#333','stroke-width':5}));else s.appendChild(svg("text",{x,y:140,'text-anchor':'middle','font-size':44},text));if(i<labels.length-1)s.appendChild(svg('path',{d:`M${x+10} 154Q${x+55} 184 ${x+94} 154m-14 0h14l-5 12`,fill:'none',stroke:'#e000db','stroke-width':2.5}));});
    if(b.max_width&&W>b.max_width){const scale=b.max_width/W,wrap=el('div');Object.assign(wrap.style,{width:b.max_width+'px',height:200*scale+'px',flexShrink:'0'});Object.assign(s.style,{transform:`scale(${scale})`,transformOrigin:'0 0'});wrap.appendChild(s);return wrap;}return s;
  });
  register("subtraction_steps",b=>{
    const s=svg("svg",{class:"r-svg",width:544,height:282,viewBox:"0 0 544 282","data-subtraction-value":b.value,"data-subtraction-first":b.first_part,"data-subtraction-second":b.second_part});
    const unit=(x,y,step)=>{s.appendChild(svg("rect",{x,y,width:25,height:25,fill:"#7fb4df",stroke:"#245581","stroke-width":2,"data-step-unit":step}));s.appendChild(svg("path",{d:`M${x} ${y}l7 -8h25l-7 8m0 0l7 -8v25l-7 8`,fill:"#b7d9ec",stroke:"#245581","stroke-width":2}));s.appendChild(svg("circle",{cx:x+13,cy:y+13,r:6,fill:"none",stroke:"#245581","stroke-width":2}));};
    for(let step=0;step<3;step++){
      const top=step*102,n=step===2?b.value-b.first_part:b.value;
      s.appendChild(svg("rect",{x:2,y:top+2,width:540,height:66,rx:12,fill:"#fff",stroke:"#c7c7c7","stroke-width":3}));
      for(let i=0;i<n;i++){const x=16+(i<10?i*25:286+(i-10)*42);unit(x,top+29,step);}
      if(step===1){const x=300;const width=Math.max(30,b.first_part*42-8);s.appendChild(svg("rect",{x,y:top+14,width,height:48,rx:12,fill:"none",stroke:"#e200cc","stroke-width":4}));}
      if(step===2){const x=16+(n-b.second_part)*25;s.appendChild(svg("rect",{x:x-4,y:top+14,width:b.second_part*25+8,height:48,rx:12,fill:"none",stroke:"#e200cc","stroke-width":4}));}
      if(step<2){s.appendChild(svg("path",{d:`M274 ${top+76}v17m-7 -7l7 8 7 -8`,fill:"none",stroke:"#947c61","stroke-width":4}));}
    }return s;
  });
  register("base10_pair",b=>{
    const e=el("div"),inner=el("div");let width=0;Object.assign(inner.style,{display:"flex",gap:(b.gap||34)+"px",width:"max-content"});for(const model of b.items){const panel=renderBlock({...model,kind:"base10_panel",pitch:50,panel_w:Math.max(340,model.tens*50+80+(model.ones>5?42:0))});width+=Number(panel.getAttribute("width"));inner.appendChild(panel)}width+=(b.items.length-1)*(b.gap||34);const scale=Math.min(1,(b.max_width||760)/width);Object.assign(e.style,{width:(width*scale)+"px",height:(234*scale)+"px",position:"relative",flexShrink:"0"});Object.assign(inner.style,{transform:`scale(${scale})`,transformOrigin:"0 0"});e.appendChild(inner);return e;
  });
  register("addition_regroup",b=>{
    const value=b.tens*10+b.ones,s=svg("svg",{class:"r-svg",width:748,height:254,viewBox:"0 0 748 254","data-addition-value":value});
    for(let stage=0;stage<2;stage++){
      const offset=stage*434,t=stage?b.tens+Math.floor(b.ones/10):b.tens,o=stage?b.ones%10:b.ones;
      const g=svg("g",{"data-addition-stage":stage,"data-stage-value":value,"data-tens":t,"data-ones":o,transform:`translate(${offset} 0)`});g.appendChild(svg("rect",{x:2,y:2,width:stage?300:360,height:232,rx:20,fill:"white",stroke:"#ccc","stroke-width":4}));
      const unit=(x,y,top)=>{g.appendChild(svg("rect",{x,y,width:17,height:18,fill:"#7eb3df",stroke:"#214a76","stroke-width":1.5,"data-addition-unit":stage}));g.appendChild(svg("polygon",{points:`${x+17},${y} ${x+23},${y-5} ${x+23},${y+13} ${x+17},${y+18}`,fill:"#4b92cf",stroke:"#214a76","stroke-width":1.2}));if(top)g.appendChild(svg("polygon",{points:`${x},${y} ${x+6},${y-5} ${x+23},${y-5} ${x+17},${y}`,fill:"#c7e3f6",stroke:"#214a76","stroke-width":1.2}));};
      if(!stage){
        const groups=[[b.first_tens,b.first_ones],[b.second_tens,b.second_ones]],totalWidth=(b.tens+Math.ceil(b.first_ones/5)+Math.ceil(b.second_ones/5))*40+20,scale=Math.min(1,340/totalWidth);let left=20;
        const content=svg("g",{transform:`translate(20 0) scale(${scale} 1) translate(-20 0)`});g.appendChild(content);
        for(const [gt,go] of groups){for(let i=0;i<gt;i++)for(let j=0;j<10;j++)unit(left+i*40,26+j*18,j===0);for(let i=0;i<go;i++)unit(left+gt*40+Math.floor(i/5)*40,26+(i%5)*36,true);if(b.ones>=10&&go){g.appendChild(svg("rect",{x:left+gt*40-4,y:16,width:30,height:196,rx:4,fill:"none",stroke:"#e500e4","stroke-width":3,"stroke-dasharray":"6 4"}));}left+=(gt+Math.ceil(go/5))*40+20;}
        // Move generated model units into the scaled content group; frames stay unchanged.
        const nodes=[...g.children].slice(2);for(const node of nodes)content.appendChild(node);
      }else{const content=svg("g",{transform:`translate(20 0) scale(${Math.min(1,270/(t*40+Math.ceil(o/5)*28))} 1) translate(-20 0)`});g.appendChild(content);for(let i=0;i<t;i++)for(let j=0;j<10;j++)unit(20+i*40,26+j*18,j===0);for(let i=0;i<o;i++)unit(20+t*40+Math.floor(i/5)*28,26+(i%5)*36,true);g.appendChild(svg("rect",{x:16+(t-1)*40,y:16,width:31,height:196,rx:4,fill:"none",stroke:"#e500e4","stroke-width":3,"stroke-dasharray":"6 4"}));for(const node of [...g.children].slice(2))content.appendChild(node);}
      s.appendChild(g);
    }
    s.appendChild(svg("path",{d:"M384 112h28m-6 -7l7 7 -7 7",fill:"none",stroke:"#70cda7","stroke-width":5}));return s;
  });
  function animalMark(s,raw,x,y,size,attributes={}){
    const [type,color,,edge]=raw.split(":"),at={fill:color||"#ffc4a8",stroke:edge||"#b47c61","stroke-width":2,"data-animal-mark":raw,...attributes};
    if(type==="circle")s.appendChild(svg("circle",{cx:x,cy:y,r:size/2,...at}));else if(type==="triangle")s.appendChild(svg("polygon",{points:`${x},${y-size/2} ${x+size/2},${y+size/2} ${x-size/2},${y+size/2}`,...at}));else s.appendChild(svg("rect",{x:x-size/2,y:y-size/2,width:size,height:size,...at}));
  }
  register("duck_pond",b=>{
    const s=svg("svg",{class:"r-svg",width:576,height:342,viewBox:"0 0 576 342"});
    s.appendChild(svg("path",{d:"M39 80Q88 28 230 38Q350 45 463 64Q552 72 558 159L565 258Q555 325 433 329L164 322Q55 304 43 225L20 144Q10 102 39 80Z",fill:"#33b6df"}));s.appendChild(svg("path",{d:"M57 92Q110 54 230 58Q363 65 465 82Q532 86 539 163L545 252Q538 301 429 308L168 302Q76 290 65 222L40 143Q32 108 57 92Z",fill:"#77d9ef"}));
    for(const [x,y,rx] of [[274,86,63],[391,290,66]]){s.appendChild(svg("ellipse",{cx:x,cy:y,rx,ry:20,fill:"#8fbd26"}));s.appendChild(svg("path",{d:`M${x-rx} ${y}h${rx*2}m-${rx} 0l32 -16m-32 16l-20 -16`,fill:"none",stroke:"#709b19","stroke-width":2}));}
    for(const [x,y,scale] of [[90,28,1],[336,78,.76]]){
      const g=svg("g",{transform:`translate(${x} ${y}) scale(${scale})`});g.appendChild(svg("path",{d:"M28 8Q57 -8 66 24Q69 45 56 61L57 117Q108 143 181 116Q171 180 104 185Q40 181 20 150Q8 130 22 102L31 57Q10 50 12 34Q13 17 28 8Z",fill:"#fff0b3",stroke:"#f2d996","stroke-width":2}));g.appendChild(svg("path",{d:"M25 33L0 41L25 48Z",fill:"#df9b4d"}));g.appendChild(svg("circle",{cx:34,cy:29,r:4,fill:"#373b35"}));g.appendChild(svg("circle",{cx:33,cy:28,r:1,fill:"white"}));g.appendChild(svg("path",{d:"M40 151Q98 180 153 149",fill:"none",stroke:"#e4cc87","stroke-width":3}));s.appendChild(g);
    }
    for(let i=0;i<3;i++)animalMark(s,'square:#d9f4a7:1:#80a354',139+i*48,176,27,{"data-duck":"large"});
    b.marks.forEach((raw,i)=>animalMark(s,raw,389+(i%3)*32,192+Math.floor(i/3)*30,24,{"data-duck":"small"}));
    for(const [x,y,rx] of [[193,220,100],[431,250,83]])for(let k=0;k<3;k++)s.appendChild(svg("path",{d:`M${x-rx-k*5} ${y+k*12}q${rx} 30 ${rx*2} 0`,fill:"none",stroke:"#d2faff","stroke-width":2}));
    for(const [x,y] of [[61,262],[99,287]]){for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;s.appendChild(svg("ellipse",{cx:x+Math.cos(angle)*12,cy:y+Math.sin(angle)*12,rx:10,ry:5,transform:`rotate(${i*72} ${x+Math.cos(angle)*12} ${y+Math.sin(angle)*12})`,fill:"white"}));}s.appendChild(svg("circle",{cx:x,cy:y,r:6,fill:"#ffdc57"}));}return s;
  });
  register("shape_animal",b=>{
    const s=svg("svg",{class:"r-svg",width:370,height:300,viewBox:"0 0 370 300"});s.appendChild(svg("text",{x:185,y:32,"text-anchor":"middle","font-size":30},b.title));
    if(b.title.includes('토끼')){s.appendChild(svg("ellipse",{cx:185,cy:190,rx:145,ry:82,fill:"#fff0d9",stroke:"#dabf9a","stroke-width":2}));for(const x of [65,91])s.appendChild(svg("ellipse",{cx:x,cy:94,rx:13,ry:45,fill:"#fff0d9",stroke:"#dabf9a","stroke-width":2}));s.appendChild(svg("circle",{cx:80,cy:137,r:38,fill:"#fff0d9"}));s.appendChild(svg("circle",{cx:63,cy:130,r:4,fill:"#333"}));}
    else{s.appendChild(svg("polygon",{points:"300,188 361,138 361,238",fill:"#94c9ec",stroke:"#6eaccd","stroke-width":2}));s.appendChild(svg("ellipse",{cx:172,cy:190,rx:151,ry:86,fill:"#c3e7f4",stroke:"#6eaccd","stroke-width":2}));s.appendChild(svg("circle",{cx:57,cy:167,r:6,fill:"#333"}));}
    const cols=Math.min(4,b.marks.length);b.marks.forEach((raw,i)=>animalMark(s,raw,112+(i%cols)*43,171+Math.floor(i/cols)*43,30));return s;
  });
  register("regroup_subtraction",b=>{
    const t=Math.floor(b.value/10),o=b.value%10,bt=Math.floor(b.subtract/10),bo=b.subtract%10,borrow=o<bo;
    const e=el("div"),draw=(tens,ones,mark)=>{
      const width=tens*44+Math.ceil(ones/5)*27+35,s=svg("svg",{class:"r-svg",width,height:234,viewBox:`0 0 ${width} 234`,"data-represented-value":tens*10+ones,"data-tens":tens,"data-ones":ones});
      s.appendChild(svg("rect",{x:2,y:22,width:width-4,height:210,rx:18,fill:"white",stroke:"#bbb","stroke-width":4}));
      const block=(x,y)=>{s.appendChild(svg("rect",{x,y,width:18,height:18,fill:"#82b9e7",stroke:"#315c84","stroke-width":1.4}));s.appendChild(svg("path",{d:`M${x},${y} l5,-4 h18 l-5,4 m5,-4 v18 l-5,4`,fill:"#b6d9f3",stroke:"#315c84","stroke-width":1.2}))};
      for(let i=0;i<tens;i++)for(let j=0;j<10;j++)block(22+i*44,44+j*18);
      for(let i=0;i<ones;i++)block(22+tens*44+Math.floor(i/5)*27,44+(i%5)*34);
      if(mark){const x=12+Math.max(0,tens-bt)*44,ox=22+tens*44,last=Math.floor((bo-1)/5),bottom=44+((bo-1)%5)*34+22;s.appendChild(svg("path",{d:`M${x},222 V34 H${ox+last*27+22} V${bottom} H${ox+last*27-4} V222 Z`,fill:"none",stroke:"#ed16cb","stroke-width":5,"stroke-linejoin":"round"}));if(borrow)s.appendChild(svg("path",{d:`M${30+tens*44},22 q0,-28 50,-18 l-10,9 m10,-9 l-14,-3`,fill:"none",stroke:"#ed16cb","stroke-width":4}));}return s;};
    Object.assign(e.style,{display:"flex",alignItems:"center",gap:"18px"});e.appendChild(draw(t,o,false));const a=renderBlock({kind:"arrow",dir:"right",len:36});e.appendChild(a);e.appendChild(draw(t-(borrow?1:0),o+(borrow?10:0),true));return e;
  });

  register("regroup_scene", b => {
    const t=Math.floor(b.value/10),o=b.value%10,bt=Math.floor(b.subtract/10),bo=b.subtract%10,borrow=o<bo,e=el("div");
    const draw=(tens,ones,mark)=>{const pitch=mark?50:54,op=mark?50:42,pad=mark?(b.after_pad??24):(b.before_pad??28),width=tens*pitch+Math.ceil(ones/5)*op+(mark?28:36)+(mark?(b.after_extra||0):(b.before_extra||0)),s=svg("svg",{class:"r-svg",width,height:250,viewBox:`0 0 ${width} 250`,"data-represented-value":tens*10+ones,"data-tens":tens,"data-ones":ones});s.appendChild(svg("rect",{x:3,y:3,width:width-6,height:244,rx:30,fill:"#fff",stroke:"#ccc","stroke-width":5}));
      const block=(x,y,cap)=>{s.appendChild(svg("rect",{x,y,width:20,height:18.5,fill:"#7eb3df",stroke:"#214a76","stroke-width":2}));s.appendChild(svg("polygon",{points:`${x+20},${y} ${x+27},${y-5} ${x+27},${y+13.5} ${x+20},${y+18.5}`,fill:"#4b92cf",stroke:"#214a76","stroke-width":2}));if(cap)s.appendChild(svg("polygon",{points:`${x},${y} ${x+7},${y-5} ${x+27},${y-5} ${x+20},${y}`,fill:"#c7e3f6",stroke:"#214a76","stroke-width":2}));};
      for(let i=0;i<tens;i++)for(let j=0;j<10;j++)block(pad+i*pitch,32+j*18.5,j===0);
      for(let i=0;i<ones;i++){const col=Math.floor(i/5),n=Math.min(5,ones-col*5),offset=b.ones_align==="bottom"?5-n:0;block(pad+tens*pitch+col*op,32+(offset+i%5)*42,true);}
      if(mark&&b.take_from_end&&bt===0){const ox=pad+tens*pitch,saved=ones-bo,col=Math.floor(saved/5),left=ox+col*op-12,right=ox+(Math.ceil(ones/5)-1)*op+35,cut=32+(saved%5)*42-12;s.appendChild(svg("path",{d:`M${left},235 V${cut} H${left+op} V22 H${right} V235 Z`,fill:"none",stroke:"#e500e4","stroke-width":5,"stroke-linejoin":"round"}));if(borrow)s.appendChild(svg("path",{d:`M${right-22},20 q20,-42 62,-34 l-13,12 m13,-12 l-18,-2`,fill:"none",stroke:"#e500e4","stroke-width":4}));}
      else if(mark){const left=pad+Math.max(0,tens-bt)*pitch-12,ox=pad+tens*pitch,last=Math.floor((bo-1)/5),bottom=32+((bo-1)%5)*42+29;s.appendChild(svg("path",{d:`M${left},235 V22 H${ox+last*op+35} V${bottom} H${ox+last*op-12} V235 Z`,fill:"none",stroke:"#e500e4","stroke-width":5,"stroke-linejoin":"round"}));if(borrow)s.appendChild(svg("path",{d:`M${pad+tens*pitch-70},20 q20,-42 62,-34 l-13,12 m13,-12 l-18,-2`,fill:"none",stroke:"#e500e4","stroke-width":4}));}return s;};
    Object.assign(e.style,{display:"flex",alignItems:"center",gap:(b.gap??18)+"px",flexShrink:"0"});e.appendChild(draw(t,o,false));e.appendChild(renderBlock({kind:"arrow",dir:"right",len:36}));e.appendChild(draw(t-(borrow?1:0),o+(borrow?10:0),true));if(b.max_width){const width=Number(e.children[0].getAttribute("width"))+Number(e.children[2].getAttribute("width"))+36+2*(b.gap??18);if(width>b.max_width){const scale=b.max_width/width,wrap=el("div");Object.assign(wrap.style,{position:"relative",width:b.max_width+"px",height:(250*scale)+"px",flexShrink:"0"});Object.assign(e.style,{width:width+"px",height:"250px",transform:`scale(${scale})`,transformOrigin:"0 0"});wrap.appendChild(e);return wrap;}}return e;
  });

  register("base10_panel",b=>{const t=b.tens||0,o=b.ones||0,pad=b.pad??(o>5?36:26),pitch=b.pitch||42,w=b.panel_w||t*pitch+Math.ceil(o/5)*42+(o>5?54:40),s=svg("svg",{class:"r-svg",width:w,height:234,viewBox:`0 0 ${w} 234`,"data-represented-value":t*10+o,"data-tens":t,"data-ones":o});s.appendChild(svg("rect",{x:3,y:3,width:w-6,height:228,rx:26,fill:"#fff",stroke:"#ccc","stroke-width":5}));
    const block=(x,y,cap)=>{s.appendChild(svg("rect",{x,y,width:20,height:18.5,fill:"#7eb3df",stroke:"#214a76","stroke-width":2}));s.appendChild(svg("polygon",{points:`${x+20},${y} ${x+27},${y-5} ${x+27},${y+13.5} ${x+20},${y+18.5}`,fill:"#4b92cf",stroke:"#214a76","stroke-width":2}));if(cap)s.appendChild(svg("polygon",{points:`${x},${y} ${x+7},${y-5} ${x+27},${y-5} ${x+20},${y}`,fill:"#c7e3f6",stroke:"#214a76","stroke-width":2}));};
    for(let i=0;i<t;i++)for(let j=0;j<10;j++)block(pad+i*pitch,28+j*18.5,j===0);for(let i=0;i<o;i++){const col=Math.floor(i/5),n=Math.min(5,o-col*5);block(pad+t*pitch+col*42,28+(5-n+i%5)*42,true)}return s;});

  let marbleSceneId=0;
  register("marble_tray",b=>{const id="marble-scene-"+(marbleSceneId++),s=svg("svg",{class:"r-svg",width:716,height:230,viewBox:"0 0 716 230"}),defs=svg("defs",{});for(const [name,dark,light] of [["green","#4f9c3b","#b1ef65"],["purple","#7846b7","#cf9cf2"]]){const g=svg("radialGradient",{id:id+name,cx:"35%",cy:"28%",r:"75%"});g.appendChild(svg("stop",{offset:"0%","stop-color":"#f8ffe8"}));g.appendChild(svg("stop",{offset:"35%","stop-color":light}));g.appendChild(svg("stop",{offset:"100%","stop-color":dark}));defs.appendChild(g)}s.appendChild(defs);
    s.appendChild(svg("path",{d:b.paper_path||"M93 82H669Q716 82 714 116L657 217Q647 225 624 225H34Q0 225 4 193L66 104Q77 82 93 82Z",fill:b.palette?.paper||"#eee6ca"}));
    if(b.tray_art){const a=b.tray_art;s.appendChild(svg("image",{href:a.src,x:a.x,y:a.y,width:a.w,height:a.h}));}
    if(!b.tray_art)for(const [points,fill] of [["70,163 144,69 144,100 96,163","#bda784"],["144,69 508,69 508,100 144,100","#d5c080"],["96,163 144,100 486,100 432,163","#ebf2d3"],["508,69 508,101 432,195 432,163","#b99b6a"]])s.appendChild(svg("polygon",{points,fill:b.palette?.[fill]||fill,stroke:b.face_line||"#9b815a","stroke-width":b.face_width??2}));
    const green=[[298,327],[323,320],[367,320],[401,323],[426,332],[459,333],[482,323],[518,322],[552,323],[578,330],[607,323],[326,344],[351,337],[382,337],[406,348],[429,354],[456,354],[503,340],[540,340],[282,358],[305,360],[345,360],[375,357],[482,360],[519,360],[557,359],[584,353]],purple=[[688,320],[710,317],[738,327],[782,325],[662,338],[688,342],[714,341],[760,342],[808,340],[651,362],[677,364],[706,367],[734,363],[759,368],[782,353],[797,374],[642,390],[669,391],[698,394],[721,399],[744,391],[776,396]];
    const draw=(name,n,original)=>{for(let i=0;i<n;i++){let x,y;if(n===original.length){[x,y]=original[i];x-=154;y-=210;}else{const rows=name==="green"?3:5,cols=Math.ceil(n/rows),r=Math.floor(i/cols),c=i%cols,rem=Math.min(cols,n-r*cols);if(name==="green"){x=156-r*15+c*300/Math.max(1,rem-1);y=111+r*18+(c%2?3:0)}else{x=520+c*125/Math.max(1,rem-1)+(r%2?5:-5);y=108+r*19}}if(b.marble_art?.[name]?.[i]){const a=b.marble_art[name][i];s.appendChild(svg("image",{href:a.src,x:x+a.dx,y:y+a.dy,width:a.w,height:a.h}));continue;}s.appendChild(svg("circle",{cx:x,cy:y,r:10,fill:`url(#${id+name})`,stroke:name==="green"?"#5a9a42":"#68409c","stroke-width":2,"data-marble-color":name}));s.appendChild(svg("ellipse",{cx:x-3,cy:y-4,rx:3,ry:5,fill:"#fff",opacity:.65,transform:`rotate(25 ${x-3} ${y-4})`}))}};
    draw("green",b.green_count,green);draw("purple",b.purple_count,purple);if(!b.tray_art)s.appendChild(svg("polygon",{points:b.front_points||"70,163 432,163 432,195 70,195",fill:b.palette?.front||"#ecd7a1",stroke:b.palette?.edge||"#a98b59","stroke-width":b.front_width??2}));
    for(const [i,[x,label]] of [[326,b.green_label||"초록색"],[558,b.purple_label||"보라색"]].entries()){const p=b.label_layout?.[i]||{},t=svg("text",{x:x+(p.dx??b.label_shift?.[0]??0),y:28+(p.dy??b.label_shift?.[1]??0),"font-size":p.size??b.label_size??28,"text-anchor":"middle",...(p.width?{textLength:p.width,lengthAdjust:"spacingAndGlyphs"}:{})},label);if(b.label_font){t.style.fontFamily=b.label_font;t.style.fontWeight=b.label_weight??400;}s.appendChild(t);s.appendChild(svg("line",{x1:x,y1:48,x2:x,y2:111,stroke:"#444","stroke-width":2}));s.appendChild(svg("circle",{cx:x,cy:48,r:4,fill:"#444"}))}return s;
  });

  register("count_cluster",b=>{const n=b.count,e=el("div");e.dataset.clusterCount=n;Object.assign(e.style,{position:"relative",width:"84px",height:"88px",flexShrink:"0"});const points=n===10?[[8,22],[22,3],[50,4],[64,19],[9,48],[34,27],[51,46],[64,43],[31,64],[50,62]]:n===8?[[10,22],[26,5],[53,10],[64,34],[58,57],[36,64],[15,58],[37,35]]:Array.from({length:n},(_,i)=>[8+(i%4)*19,4+Math.floor(i/4)*24]);for(let i=0;i<n;i++){const art=renderBlock({...b.art,h:22});Object.assign(art.style,{position:"absolute",left:points[i][0]+"px",top:points[i][1]+"px"});e.appendChild(art)}return e;});
  register("survey_grid",b=>{const e=el("div");Object.assign(e.style,{display:"grid",gridTemplateColumns:`repeat(${b.cols||3},138px)`,border:"3px solid #aaa",borderRadius:"12px",overflow:"hidden"});for(const it of b.items){const c=el("div"),name=el("div",null,inline(it.name)),caption=el("div",null,inline(it.label)),art=renderBlock({...it.art,h:50});Object.assign(c.style,{position:"relative",width:"138px",height:"88px",border:"1px solid #aaa",boxSizing:"border-box",background:"white"});Object.assign(name.style,{position:"absolute",left:"6px",top:"5px",fontSize:"22px",lineHeight:"24px"});Object.assign(art.style,{position:"absolute",left:"44px",top:"23px"});Object.assign(caption.style,{position:"absolute",right:"6px",bottom:"5px",fontSize:"22px",lineHeight:"24px"});c.append(name,art,caption);e.appendChild(c)}return e;});

  register("picture_grid",b=>{
    const cols=b.cols||3,cw=b.cell_w||104,ch=b.cell_h||90,e=el("div","r-picture-grid");e.dataset.pictureCount=b.items.length;Object.assign(e.style,{display:"grid",gridTemplateColumns:`repeat(${cols},${cw}px)`,border:b.frameless?"0":"2px solid #aaa",borderRadius:"12px",overflow:"hidden",flexShrink:"0"});
    for(const it of b.items){const c=el("div");Object.assign(c.style,{height:ch+"px",boxSizing:"border-box",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-around",border:b.frameless?"0":"1px solid #aaa",background:b.frameless?"transparent":"white"});
      if(it.name){const n=el("div",null,inline(it.name));n.style.fontSize=(b.name_size||24)+"px";if(b.text_line_height)n.style.lineHeight=b.text_line_height;c.appendChild(n)}c.appendChild(renderBlock(it.art));if(it.label&&!b.hide_labels){const n=el("div",null,inline(it.label));n.style.fontSize=(b.label_size||26)+"px";if(b.text_line_height)n.style.lineHeight=b.text_line_height;c.appendChild(n)}e.appendChild(c)}return e;
  });
  register("tally_table",b=>{
    const table=el("table","r-tally-table");Object.assign(table.style,{borderCollapse:"separate",borderSpacing:"0",border:"2px solid #aaa",borderRadius:"18px",overflow:"hidden",fontSize:"28px",textAlign:"center",flexShrink:"0",background:"white"});
    const headers=b.headers||["간식 종류","세면서\n표시하기","학생 수(명)"];
    for(let r=0;r<3;r++){const tr=el("tr"),th=el("td",null,inline(headers[r]));Object.assign(th.style,{width:(b.first_col||104)+"px",fontSize:(b.header_size||28)+"px",whiteSpace:"pre",background:b.head_fill||"#ffe1a7",border:"1px solid #aaa",height:(b.row_h?.[r]??[b.first_h||98,68,46][r])+"px"});tr.appendChild(th);
      for(const it of b.items){const td=el("td");Object.assign(td.style,{width:(b.col_w||98)+"px",border:"1px solid #aaa"});if(r===0){if(b.art_header!==false)td.appendChild(renderBlock({...it.art,h:b.art_h||50}));const lab=el("div",null,inline(it.label));lab.style.fontSize=(b.category_size||26)+"px";td.appendChild(lab)}else if(r===1){const n=Number(it.count),s=svg("svg",{width:b.tally_w||82,height:40,viewBox:`0 0 ${Math.max(70,Math.ceil(n/5)*40)} 40`,"data-tally-count":n});for(let i=0;i<n;i++){const g=Math.floor(i/5),k=i%5;s.appendChild(svg("line",{x1:g*40+(k===4?1:8+k*8),y1:k===4?32:32,x2:g*40+(k===4?37:20+k*8),y2:k===4?7:7,stroke:b.tally_color||"#333","stroke-width":2.3}))}td.appendChild(s)}else{td.textContent=it.count;if(b.number_size)td.style.fontSize=b.number_size+"px";}tr.appendChild(td)}table.appendChild(tr)}return table;
  });
  register("counting_cells",b=>{
    const cs=b.cell||44,e=el("div","r-counting-cells");e.dataset.count=b.count;Object.assign(e.style,{display:"flex",gap:"12px",flexWrap:"wrap",maxWidth:(b.max_width||780)+"px"});for(let offset=0;offset<b.count;offset+=10){const table=el("div");Object.assign(table.style,{display:"grid",gridTemplateColumns:`repeat(5,${cs}px)`,borderTop:"2px solid #999",borderLeft:"2px solid #999"});for(let i=0;i<10;i++){const cell=el("div");Object.assign(cell.style,{width:cs+"px",height:cs+"px",borderRight:"2px solid #999",borderBottom:"2px solid #999",display:"flex",alignItems:"center",justifyContent:"center",background:"white"});if(offset+i<b.count)cell.appendChild(renderBlock({...b.art,h:b.art_h||36}));table.appendChild(cell)}e.appendChild(table)}return e;
  });
  register("price_tags",b=>{const e=el("div");Object.assign(e.style,{display:"flex",gap:"20px"});for(const it of b.items){const c=el("div");Object.assign(c.style,{position:"relative",width:"116px",height:"188px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end"});const tag=el("div",null,inline(it.price));Object.assign(tag.style,{position:"absolute",top:"0",left:(b.tag_left??24)+"px",border:"3px solid #618ece",background:"#d6eeff",transform:"rotate(-12deg)",fontSize:(b.tag_size||28)+"px",padding:"3px 8px",whiteSpace:"nowrap"});c.appendChild(tag);c.appendChild(renderBlock({...it.art,h:106}));const n=el("div",null,inline(it.label));n.style.fontSize="30px";c.appendChild(n);e.appendChild(c)}return e;});
  register("display_case",b=>{
    const e=el("div","r-display-case");Object.assign(e.style,{position:"relative",width:"444px",height:"274px",flexShrink:"0",background:"linear-gradient(40deg,#5ad4f2 22%,#a8e6fa 22%,#a8e6fa 40%,#29aeda 40%,#29aeda 60%,#a8e6fa 60%)",border:"24px ridge #e0ddea",boxSizing:"border-box"});
    b.shelves.forEach((shelf,r)=>{const row=el("div");Object.assign(row.style,{position:"absolute",left:"8px",right:"8px",top:(r*96+15)+"px",display:"flex",justifyContent:"space-around",borderBottom:"5px solid #d7eef0"});for(const group of shelf.groups){const tray=el("div","r-case-tray");tray.dataset.count=group.count;Object.assign(tray.style,{background:"#bac2b888",padding:"1px 3px"});tray.appendChild(renderBlock({kind:"icons",count:group.count,per_row:2,src:group.art.src,icon_h:30,gap:2}));row.appendChild(tray)}const label=el("div",null,inline(shelf.label));Object.assign(label.style,{position:"absolute",top:"65px",left:"0",right:"0",textAlign:"center",fontSize:"28px",textShadow:"2px 2px white,-2px -2px white,2px -2px white,-2px 2px white"});row.appendChild(label);e.appendChild(row)});
    const vent=el("div");Object.assign(vent.style,{position:"absolute",left:"-20px",right:"-20px",bottom:"-24px",height:"20px",background:"repeating-linear-gradient(90deg,#555 0 4px,#ccc 4px 9px)",border:"3px solid #aaa"});e.appendChild(vent);return e;
  });

  register("base10_illustrated",b=>{
    const t=b.tens||0,o=b.ones||0,pitch=41,w=t*pitch+Math.ceil(o/5)*pitch+52,h=238,s=svg("svg",{class:"r-svg",width:w,height:h,viewBox:`0 0 ${w} ${h}`,"data-tens":t,"data-ones":o});
    s.appendChild(svg("rect",{x:3,y:3,width:w-6,height:h-6,rx:26,fill:"white",stroke:"#ccc","stroke-width":6}));
    const block=(x,y,cap=true)=>{s.appendChild(svg("rect",{x,y,width:18,height:18,fill:"#82b9e7",stroke:"#244b73","stroke-width":2}));s.appendChild(svg("polygon",{points:`${x+18},${y} ${x+24},${y-5} ${x+24},${y+13} ${x+18},${y+18}`,fill:"#589ad4",stroke:"#244b73","stroke-width":2}));if(cap)s.appendChild(svg("polygon",{points:`${x},${y} ${x+6},${y-5} ${x+24},${y-5} ${x+18},${y}`,fill:"#c2e1f8",stroke:"#244b73","stroke-width":2}));};
    for(let i=0;i<t;i++)for(let j=0;j<10;j++)block(28+i*pitch,28+j*18,j===0);
    for(let i=0;i<o;i++)block(28+t*pitch+Math.floor(i/5)*pitch,22+(4-i%5)*42);return s;
  });
  register("split_calculation",b=>{
    const lift=b.compact?18:0,s=svg("svg",{class:"r-svg",width:340,height:136-lift,viewBox:`0 0 340 ${136-lift}`}),xs=[95,175],split=b.split_index,other=1-split,base=xs[split],parts=[base-42,base+42],known=b.parts.findIndex(x=>String(x)!=="");
    if(known>=0)s.appendChild(svg("line",{x1:xs[other],y1:25,x2:parts[known],y2:112-lift,stroke:"#ff91cc","stroke-width":42,"stroke-linecap":"round",opacity:.8}));
    [[95,b.operands[0]],[135,"+"],[175,b.operands[1]],[215,"="],[270,b.total]].forEach(([x,text])=>s.appendChild(svg("text",{x,y:42,"text-anchor":"middle","font-size":38},text)));
    b.parts.forEach((text,i)=>{const x=parts[i],dx=x-base,dy=37-lift,L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;s.appendChild(svg("line",{x1:base,y1:51,x2:x,y2:88-lift,stroke:"#d815df","stroke-width":2.5}));s.appendChild(svg("polygon",{points:`${x},${88-lift} ${x-ux*9-uy*4},${88-lift-uy*9+ux*4} ${x-ux*9+uy*4},${88-lift-uy*9-ux*4}`,fill:"#d815df"}));if(String(text)==="")s.appendChild(svg("rect",{x:x-22,y:91-lift,width:44,height:42,fill:"white",stroke:"#333","stroke-width":5}));else s.appendChild(svg("text",{x,y:128-lift,"text-anchor":"middle","font-size":38},text));});return s;
  });
  register("aquarium",b=>{
    const cols=b.cols||10,rows=Math.ceil(b.count/cols),H=rows*37+25,W=608,e=el("div");Object.assign(e.style,{width:(W+20)+"px",height:(H+10)+"px",border:"10px solid #a5adb0",borderTop:"0",boxSizing:"border-box",background:"linear-gradient(135deg,#bdffff,#64b4d0)",flexShrink:"0"});
    const s=svg("svg",{class:"r-svg",width:W,height:H,viewBox:`0 0 ${W} ${H}`,"data-fish-count":b.count});s.appendChild(svg("rect",{x:0,y:H-28,width:W,height:28,fill:"#ffebb3"}));
    for(let i=0;i<b.count;i++){const r=Math.floor(i/cols),c=i%cols,rem=b.count%cols,last=r===rows-1&&rem>0,x=last?(rem===1?W/2:40+c*520/(rem-1)):37+c*54.5+(r%2?30:0),y=24+r*37,flip=i%5===1||i%5===2;const g=svg("g",{transform:`translate(${x} ${y}) rotate(${[-12,3,16,-9,8][i%5]}) scale(${flip?-1:1} 1)`,"data-fish":"1"});g.appendChild(svg("path",{d:"M-14 -4 L-24 -12 L-24 11 L-14 4 M-4 -8 L2 -15 L9 -8 M-4 8 L3 14 L9 8",fill:"#ffc386",stroke:"#ed9d59","stroke-width":1}));g.appendChild(svg("ellipse",{cx:0,cy:0,rx:17,ry:10,fill:"#ffc386"}));for(const x of [-8,-2,4,10])g.appendChild(svg("path",{d:`M${x},-9 q-5,9 0,18`,fill:"none",stroke:"#ed9d59","stroke-width":1.2}));g.appendChild(svg("circle",{cx:13,cy:-3,r:1.2,fill:"#b36f37"}));s.appendChild(g)}e.appendChild(s);return e;
  });

  register("stone_pattern",b=>{
    const e=el("div","r-stone-pattern");Object.assign(e.style,{display:"flex",alignItems:"center",gap:"16px",flexShrink:"0"});
    for(const raw of b.items){if(String(raw).startsWith("circle:")){const color=raw.split(":")[1],light=["#eeeeee","#ffffff","#fff"].includes(color),s=svg("svg",{width:42,height:44,viewBox:"0 0 42 44","data-stone-color":light?"white":"black"});s.appendChild(svg("circle",{cx:21,cy:22,r:20,fill:light?"#fafafa":"#383b39",stroke:light?"#d6d6d6":"#30332f","stroke-width":2}));s.appendChild(svg("ellipse",{cx:13,cy:11,rx:5,ry:2,fill:light?"white":"#999",transform:"rotate(-35 13 11)"}));s.appendChild(svg("path",{d:"M17 36 Q29 37 34 28",fill:"none",stroke:light?"#ddd":"#646762","stroke-width":6,"stroke-linecap":"round"}));e.appendChild(s)}else if(raw==="/"){const s=svg("svg",{width:24,height:64,viewBox:"0 0 24 64"});s.appendChild(svg("line",{x1:3,y1:62,x2:21,y2:2,stroke:"#05c2e7","stroke-width":5}));e.appendChild(s)}else{const t=el("span",null,inline(String(raw)));t.style.fontSize="46px";e.appendChild(t)}}return e;
  });

  /* 그림 위 글자: 분수·낱자음 마크업을 쓰려고 HTML 로 겹쳐 놓는다. host 는 position:relative 인 상자 */
  function overlay(host, x, y, text, o = {}) {
    const d = el("div", "r-ov" + (o.cls ? " " + o.cls : ""), inline(String(text)));
    d.style.left = x + "px"; d.style.top = y + "px";
    if (o.size) d.style.fontSize = o.size + "px";
    if (o.color) d.style.color = o.color;
    host.appendChild(d);
    return d;
  }

  /* ---- clock: 아날로그 시계 ----
   * {kind:"clock", h:9, m:30, r:46, rim:"#c0143c", label:"가"}
   * 시침은 h:m 에 맞춰 돌아간다. 일부러 틀린 시계(시침이 정각 자리)는 hour_at:9 처럼 시침 자리를 직접 준다.
   * hands:false 면 바늘 없이, numbers:false 면 숫자 없이. hour_color, min_color 로 바늘 색
   * 디지털 시계는 digital:"3:40" (h, m 은 무시) */
  register("clock", (b) => {
    if (b.digital !== undefined) {
      const d = style(el("div", "r-digital", inline(String(b.digital))), b, { size: 40 });
      if (!b.label && !b.caption) return d;
      const box = el("div", "r-clock");
      if (b.label) overlay(box, -12, 10, b.label, { size: b.label_size ?? 28 });
      box.appendChild(d);
      if (b.caption) box.appendChild(el("div", "r-clock-cap", inline(b.caption)));
      return box;
    }
    const r = b.r ?? 60, rim = b.rim || "#c0143c", rw = b.rim_w ?? r * 0.13, fs = b.size ?? r * 0.24;
    // outer: 시계 바깥 분 표시 동그라미 [{m:5, text:"5"}, {m:10, text:"[]"}] (몇 분인지 세는 문제)
    const op = b.outer ? fs * 1.9 : 0, D = (r + rw + op) * 2, c = D / 2;
    const box = style(el("div", "r-clock"), { ...b, size: undefined, w: undefined, h: undefined });
    const s = svg("svg", { class: "r-svg", width: D, height: D, viewBox: `0 0 ${D} ${D}` });
    s.appendChild(svg("circle", { cx: c, cy: c, r: r + rw / 2, fill: b.face || "#fff", stroke: rim, "stroke-width": rw }));
    const at = (deg, k) => [c + Math.sin((deg * Math.PI) / 180) * k, c - Math.cos((deg * Math.PI) / 180) * k];
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0, [x1, y1] = at(i * 6, r * 0.97), [x2, y2] = at(i * 6, r * (big ? 0.86 : 0.91));
      s.appendChild(svg("line", { x1, y1, x2, y2, stroke: "#555", "stroke-width": big ? 2 : 1 }));
    }
    if (b.numbers !== false) for (let i = 1; i <= 12; i++) {
      const [x, y] = at(i * 30, r * 0.7);
      const number=svg("text", { x, y: y + fs * 0.36, "font-size": fs, "text-anchor": "middle" }, String(i));
      if(b.number_font){number.style.fontFamily=b.number_font;number.style.fontWeight=String(b.number_weight??400);}
      s.appendChild(number);
    }
    const hand = (deg, len, w, col) => {
      const [x, y] = at(deg, len);
      if(b.hand_tip===false){s.appendChild(svg("line",{x1:c,y1:c,x2:x,y2:y,stroke:col,"stroke-width":w,"stroke-linecap":"round"}));return;}
      const [hx, hy] = at(deg, len - w * 2.2), [lx, ly] = at(deg - 90, w * 1.3), [rx, ry] = at(deg + 90, w * 1.3);
      s.appendChild(svg("line", { x1: c, y1: c, x2: hx, y2: hy, stroke: col, "stroke-width": w, "stroke-linecap": "round" }));
      // 바늘 끝 화살촉
      s.appendChild(svg("polygon", { points: `${x},${y} ${hx + lx - c},${hy + ly - c} ${hx + rx - c},${hy + ry - c}`, fill: col }));
    };
    // sector: 지난 시간 부채꼴 음영 {from:15, to:40, color} (분 단위, 12시=0). center_text: 시계 안 글자("?")
    if (b.sector) {
      const f = b.sector.from * 6, t = b.sector.to * 6, [x0, y0] = at(f, r * 0.95), [x1, y1] = at(t, r * 0.95), sp = (((t - f) % 360) + 360) % 360;
      s.appendChild(svg("path", { d: `M${c},${c} L${x0},${y0} A${r * 0.95},${r * 0.95} 0 ${sp > 180 ? 1 : 0} 1 ${x1},${y1} Z`, fill: b.sector.color || "#ffd0e4", opacity: 0.8 }));
    }
    if (b.center_text) overlay(box, c, c - r * 0.35, b.center_text, { cls: "center", size: fs * 1.3 });
    if (b.hands !== false) {
      const m = b.m ?? 0, hpos = b.hour_at ?? ((b.h ?? 12) % 12) + m / 60;
      // 한 바늘만 그리라는 문제(시침을 그려 넣으세요)는 hour_hand:false / min_hand:false
      if (b.hour_hand !== false) hand(hpos * 30, r * 0.5, b.hour_width ?? r * 0.07, b.hour_color || "#2a5bd7");
      if (b.min_hand !== false) hand(m * 6, r * 0.78, b.min_width ?? r * 0.05, b.min_color || "#e0287a");
      if (b.s !== undefined) {
        const [x, y] = at(b.s * 6, r * 0.88);
        s.appendChild(svg("line", { x1: c, y1: c, x2: x, y2: y, stroke: b.sec_color || "#f0a020", "stroke-width": r * 0.025, "stroke-linecap": "round" }));
      }
    }
    s.appendChild(svg("circle", { cx: c, cy: c, r: b.pivot_r??r * 0.06, fill: b.pivot_color||"#f0a020", stroke: "#555", "stroke-width": 1 }));
    // mirror:true — 거울에 비친 시계(숫자 글자까지 좌우를 뒤집는다). h·m 은 실제 시각
    if (b.mirror) s.style.transform = "scaleX(-1)";
    box.appendChild(s);
    (b.outer || []).forEach((o) => {
      const [x, y] = at(o.m * 6, r + rw + op * 0.5);
      s.appendChild(svg("circle", { cx: x, cy: y, r: fs * 0.85, fill: "#fff", stroke: "#888", "stroke-width": 1.5 }));
      overlay(box, x, y, o.text, { cls: "center", size: fs * 0.9 });
    });
    if (b.label){const label=overlay(box, -r * 0.5, r * 0.1, b.label, { size: b.label_size ?? 28 });if(b.label_bg)Object.assign(label.style,{background:b.label_bg,padding:"4px 8px",borderRadius:"4px"});}
    if (b.caption) { const cap = el("div", "r-clock-cap", inline(b.caption)); box.appendChild(cap); }
    return box;
  });

  /* ---- pie: 원그래프 / 회전판 ----
   * {kind:"pie", title:"등교 방법별 학생 수", r:80, items:[{label:"도보\n(30%)", value:30, color:"#fff3b0"}, …],
   *  scale:[0,25,50,75]}   — scale 을 주면 바깥에 눈금과 그 값 글자. 눈금은 scale_max 칸(기본 100, 생활계획표는 12·24)
   * 조각이 좁아 이름을 바깥에 지시선으로 달면 item 에 outside:true. start 는 시작 각(도, 12시=0)
   * 회전판은 같은 값 여러 칸에 labels 만: {kind:"pie", r:70, items:[{label:"1",value:1},…], pointer:true} */
  register("pie", (b) => {
    const out = b.items.some((it) => it.outside), sm = b.scale_max ?? 100;
    const r = b.r ?? 80, fs = b.size ?? 18, pad = out ? fs * 4 : b.scale ? fs * 1.8 : 4, D = (r + pad) * 2, c = D / 2;
    const box = style(el("div", "r-pie"), { ...b, size: undefined, w: undefined, h: undefined });
    box.style.fontSize = fs + "px";
    if (b.title) box.appendChild(el("div", "r-graph-title", inline(b.title)));
    const area = el("div", "r-pie-area"); area.style.width = D + "px"; area.style.height = D + "px";
    const s = svg("svg", { class: "r-svg", width: D, height: D, viewBox: `0 0 ${D} ${D}` });
    const total = b.items.reduce((a, it) => a + it.value, 0), pal = ["#fff3b0", "#ffb38a", "#b8f0d8", "#c7f0b0", "#f8b8f0", "#b8d8ff", "#e0d0ff", "#ddd"];
    const pt = (deg, k) => [c + Math.sin((deg * Math.PI) / 180) * k, c - Math.cos((deg * Math.PI) / 180) * k];
    let a0 = b.start ?? 0;
    b.items.forEach((it, i) => {
      const da = (it.value / total) * 360, a1 = a0 + da, [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
      const d = da >= 359.99 ? `M${c - r},${c} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r},0`
        : `M${c},${c} L${x0},${y0} A${r},${r} 0 ${da > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
      s.appendChild(svg("path", { d, fill: it.color || pal[i % pal.length], stroke: b.line || "#555", "stroke-width": 1.5 }));
      const mid = a0 + da / 2;
      if (it.outside) {
        const [p1x, p1y] = pt(mid, r * 0.85), [p2x, p2y] = pt(mid, r + fs * 1.2), [lx, ly] = pt(mid, r + fs * 2.4);
        s.appendChild(svg("line", { x1: p1x, y1: p1y, x2: p2x, y2: p2y, stroke: "#555", "stroke-width": 1.2 }));
        if (it.label !== undefined) overlay(area, lx, ly, it.label, { cls: "center" });
      } else {
        const [lx, ly] = pt(mid, r * (it.label_r ?? 0.6));
        if (it.label !== undefined) overlay(area, lx, ly, it.label, { cls: "center" });
      }
      a0 = a1;
    });
    if (b.scale) {
      const step = 360 / sm, major = sm % 5 === 0 && sm > 20 ? 5 : 1;
      for (let i = 0; i < sm; i++) {
        const [x1, y1] = pt(i * step, r), [x2, y2] = pt(i * step, r + (i % major === 0 ? 7 : 4));
        s.appendChild(svg("line", { x1, y1, x2, y2, stroke: "#555", "stroke-width": 1 }));
      }
      b.scale.forEach((v) => { const [x, y] = pt(v * step, r + fs * 0.95); overlay(area, x, y, v, { cls: "center", size: fs * 0.8 }); });
    }
    s.appendChild(svg("circle", { cx: c, cy: c, r, fill: "none", stroke: b.line || "#555", "stroke-width": 2 }));
    if (b.pointer) s.appendChild(svg("polygon", { points: `${c},${c - r * 0.75} ${c - r * 0.07},${c} ${c + r * 0.07},${c}`, fill: "#444" }));
    area.prepend(s);
    box.appendChild(area);
    return box;
  });

  /* ---- target: 과녁과 화살 ----
   * {kind:"target", items:["41","57","89","38"], hits:[1,3], r:150, size:60}
   * items 는 네 칸의 수(왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래 순). hits 는 화살이 꽂힌 칸 번호(0부터).
   * 화살 끝은 칸 가운데 각도, 반지름 0.78 자리(경계선에서 떨어진 곳)에 꽂힌다 */
  register("target", (b) => {
    const r = b.r ?? 150, fs = b.size ?? 60, pad = r * 0.62, D = (r + pad) * 2, c = D / 2;
    const box = el("div", "r-pie-area"); box.style.width = D + "px"; box.style.height = D + "px";
    const s = svg("svg", { class: "r-svg", width: D, height: D, viewBox: `0 0 ${D} ${D}` });
    const pk = "#ffb3b8", mt = "#96e8e2", MID = [315, 45, 225, 135];
    const pt = (deg, k) => [c + Math.sin((deg * Math.PI) / 180) * k, c - Math.cos((deg * Math.PI) / 180) * k];
    const sector = (a0, a1, r0, r1, fill) => {
      const [x0, y0] = pt(a0, r1), [x1, y1] = pt(a1, r1), [x2, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0);
      s.appendChild(svg("path", { d: `M${x3},${y3} L${x0},${y0} A${r1},${r1} 0 0 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`, fill, stroke: "#fff", "stroke-width": 4 }));
    };
    MID.forEach((m, i) => {
      const inner = i === 0 || i === 3 ? mt : pk, outer = inner === mt ? pk : mt;
      sector(m - 45, m + 45, 0.001, r * 0.86, inner);
      sector(m - 45, m + 45, r * 0.86, r * 0.91, outer);
      sector(m - 45, m + 45, r * 0.91, r, inner);
    });
    s.appendChild(svg("circle", { cx: c, cy: c, r: r * 0.09, fill: "#ff5a6e" }));
    b.items.forEach((t, i) => { const [x, y] = pt(MID[i], r * 0.42); overlay(box, x, y, t, { cls: "center", size: fs }); });
    // 화살: 끝(점) → 바늘 → 주황 고리 → 보라 몸통 → 깃. 몸통 방향은 반지름 바깥쪽
    (b.hits || []).forEach((i) => {
      const a = MID[i], ux = Math.sin((a * Math.PI) / 180), uy = -Math.cos((a * Math.PI) / 180);
      const P = (k, side = 0) => [c + ux * r * k - uy * side, c + uy * r * k + ux * side];
      const [tx, ty] = P(0.74), [nx, ny] = P(0.9), [kx, ky] = P(1.02), [ex, ey] = P(1.42);
      const g = svg("g", {});
      g.appendChild(svg("line", { x1: tx, y1: ty, x2: nx, y2: ny, stroke: "#4a5260", "stroke-width": 4, "stroke-linecap": "round" }));
      g.appendChild(svg("line", { x1: nx, y1: ny, x2: kx, y2: ky, stroke: "#f7a234", "stroke-width": 13, "stroke-linecap": "round" }));
      g.appendChild(svg("line", { x1: kx, y1: ky, x2: ex, y2: ey, stroke: "#7b52e0", "stroke-width": 10, "stroke-linecap": "round" }));
      const w = r * 0.16, f = [P(1.26), P(1.5, w), P(1.58, w), P(1.44), P(1.58, -w), P(1.5, -w)];
      g.appendChild(svg("polygon", { points: f.map((q) => q.join(",")).join(" "), fill: "#6a3fd6" }));
      g.appendChild(svg("circle", { cx: tx, cy: ty, r: 6, fill: "#2b2f38", stroke: "#fff", "stroke-width": 2 }));
      s.appendChild(g);
    });
    box.prepend(s);
    return box;
  });

  /* ---- strip: 띠그래프 ----
   * {kind:"strip", title:"양말 색깔별 어린이 수", w:360, h:44, items:[{label:"빨간색\n(40%)", value:40, color:"#ffaaa0"}, …], scale:true}
   * scale 을 주면 아래에 0~100 눈금 */
  register("strip", (b) => {
    const W = b.w ?? 360, H = b.h ?? 44, fs = b.size ?? 16;
    const box = style(el("div", "r-strip"), { ...b, size: undefined, w: undefined, h: undefined });
    box.style.fontSize = fs + "px";
    if (b.title) box.appendChild(el("div", "r-graph-title", inline(b.title)));
    const bar = el("div", "r-strip-bar"); bar.style.width = W + "px"; bar.style.height = H + "px";
    const total = b.items.reduce((a, it) => a + it.value, 0), pal = ["#ffaaa0", "#6fd0f8", "#fff07a", "#b8f0b0", "#e0c0ff", "#ccc"];
    b.items.forEach((it, i) => {
      const seg = el("div", "r-strip-seg", inline(it.label ?? ""));
      seg.style.width = (it.value / total) * 100 + "%";
      seg.style.background = it.color || pal[i % pal.length];
      bar.appendChild(seg);
    });
    box.appendChild(bar);
    if (b.scale) {
      const sc = el("div", "r-strip-scale"); sc.style.width = W + "px";
      for (let v = 0; v <= 100; v += b.scale_step ?? 10) overlay(sc, (v / 100) * W, 0, v, { cls: "top", size: fs * 0.8 });
      box.appendChild(sc);
    }
    return box;
  });

  /* ---- tape: 테이프(띠) 모형 ----
   * 길이 단위는 total(기본 1). 칸 나누기·색칠·위아래 길이 괄호를 단다.
   * {kind:"tape", w:300, h:30, total:1, parts:10, dashed:true, fill:[[0,0.4]], color:"#bfe0ff", line:"#4a90d0",
   *  left:"0.4", ticks:[{at:0,text:"0"},{at:1,text:"1"}],
   *  braces:[{from:0, to:0.5, text:"{1 5/28} m", side:"top"}, …], segs:[{from:0.2,to:0.8,color:"#a080f0"}]}
   * 여러 줄은 stack 으로 쌓는다 */
  register("tape", (b) => {
    const W = b.w ?? 300, H = b.h ?? 30, T = b.total ?? 1, fs = b.size ?? 22, line = b.line || "#4a90d0";
    const X = (v) => (v / T) * W;
    const box = style(el("div", "r-tape"), { ...b, size: undefined, w: undefined, h: undefined, fill: undefined, line: undefined });
    box.style.fontSize = fs + "px";
    const tTop = (b.ticks || []).some((t) => t.side === "top"), tBot = (b.ticks || []).some((t) => t.side !== "top");
    const top = (b.braces || []).some((x) => x.side !== "bottom") || tTop ? fs * 2.2 : 0, bottom = (b.braces || []).some((x) => x.side === "bottom") || tBot ? fs * 2.2 : 0;
    const L = b.left ? fs * 2.6 : 0;
    const area = el("div", "r-tape-area"); area.style.width = L + W + "px"; area.style.height = top + H + bottom + "px";
    const s = svg("svg", { class: "r-svg", width: L + W, height: top + H + bottom, viewBox: `${-L} ${-top} ${L + W} ${top + H + bottom}` });
    s.appendChild(svg("rect", { x: 0, y: 0, width: W, height: H, fill: b.bg || "#fff", stroke: "none" }));
    (b.fill || []).forEach(([f, t]) => s.appendChild(svg("rect", { x: X(f), y: 0, width: X(t) - X(f), height: H, fill: b.color || "#bfe0ff" })));
    // segs: 색 칸. text 를 주면 칸 가운데에 글자(띠 안 이름·값)
    (b.segs || []).forEach((g) => {
      s.appendChild(svg("rect", { x: X(g.from), y: 0, width: X(g.to) - X(g.from), height: H, fill: g.color || "#a080f0", stroke: g.line || "none" }));
      if (g.text !== undefined) overlay(area, L + (X(g.from) + X(g.to)) / 2, top + H / 2, g.text, { cls: "center", size: g.size ?? fs * 0.8 });
    });
    if (b.parts) for (let i = 1; i < b.parts; i++) {
      const x = (W / b.parts) * i;
      s.appendChild(svg("line", { x1: x, y1: 0, x2: x, y2: H, stroke: line, "stroke-width": 1.5, ...(b.dashed !== false && { "stroke-dasharray": "4 3" }) }));
    }
    (b.marks || []).forEach((v) => s.appendChild(svg("line", { x1: X(v), y1: 0, x2: X(v), y2: H, stroke: line, "stroke-width": 2 })));
    s.appendChild(svg("rect", { x: 0, y: 0, width: W, height: H, fill: "none", stroke: line, "stroke-width": b.bw ?? 2.5 }));
    // 길이 괄호: 점선 호 + 가운데 글자
    (b.braces || []).forEach((br) => {
      const x0 = X(br.from), x1 = X(br.to), up = br.side !== "bottom", y = up ? 0 : H, k = up ? -1 : 1, hh = fs * 0.9;
      s.appendChild(svg("path", { d: `M${x0},${y} Q${(x0 + x1) / 2},${y + k * hh * 2} ${x1},${y}`, fill: "none", stroke: br.color || "#5cc8e8", "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
      overlay(area, L + (x0 + x1) / 2, top + y + k * hh * 1.1, br.text, { cls: up ? "bottom" : "top", size: br.size });
    });
    // ticks: 아래 글자. side:"top" 이면 위에
    (b.ticks || []).forEach((t) => t.side === "top"
      ? overlay(area, L + X(t.at), top - 2, t.text, { cls: "bottom", size: t.size??fs * 0.8 })
      : overlay(area, L + X(t.at), top + H + 2, t.text, { cls: "top", size: t.size??fs * 0.8 }));
    if (b.left) overlay(area, L * 0.45, top + H / 2, b.left, { cls: "center" });
    area.prepend(s);
    box.appendChild(area);
    return box;
  });

  /* ---- base10: 수 모형 (백 판, 십 막대, 일 낱개) ----
   * {kind:"base10", hundreds:1, tens:3, ones:5, unit:9, color:"#6aaef0", box:true}
   * 십 막대는 세로로 나란히, 낱개는 오른쪽에 세로 두 줄로 쌓는다. color_ones 로 낱개 색만 바꿀 수 있다 */
  register("base10", (b) => {
    const u = b.unit ?? 9, col = b.color || "#6aaef0", colOne = b.color_ones || col, gap = b.group_gap??u * 0.6, ink = b.ink||"#2a4a7a";
    const items = [];
    let x = 0;
    const cube = (cx, cy, c) => items.push(svg("rect", { x: cx, y: cy, width: u, height: u, fill: c, stroke: ink, "stroke-width": b.grid_width??1 }));
    // 천 모형: 앞면 10×10 칸 + 비스듬한 윗면·옆면
    for (let k = 0; k < (b.thousands ?? 0); k++) {
      const S = u * 10, d = b.depth??u * 3;
      items.push(svg("polygon", { points: `${x},${d} ${x + d},0 ${x + S + d},0 ${x + S},${d}`, fill: col, stroke: ink, "stroke-width": 1 }));
      items.push(svg("polygon", { points: `${x + S},${d} ${x + S + d},0 ${x + S + d},${S} ${x + S},${S + d}`, fill: col, stroke: ink, "stroke-width": 1, opacity: 0.8 }));
      if(b.thousand_grid){for(let i=1;i<10;i++){for(const [x1,y1,x2,y2] of [[x+i*u,d,x+d+i*u,0],[x+i*d/10,d-i*d/10,x+S+i*d/10,d-i*d/10],[x+S,d+i*u,x+S+d,i*u],[x+S+i*d/10,d-i*d/10,x+S+i*d/10,S+d-i*d/10]])items.push(svg("line",{x1,y1,x2,y2,stroke:ink,"stroke-width":b.grid_width??1}));}}
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) cube(x + i * u, d + j * u, col);
      x += S + d + gap;
    }
    if(b.thousands)x+=b.after_thousands_extra||0;
    const ybase=b.align_bottom&&b.thousands?(b.align_y??u*3):0,hgap=b.hundred_gap??gap;
    let hundredsHeight = u * 10;
    const hc=b.hundreds??0,hcols=b.hundreds_per_row||hc||1,hstart=x;
    for (let k = 0; k < hc; k++) {
      const xx=b.hundred_stack?hstart+k*(b.hundred_stack_gap||6):hstart+(k%hcols)*(u*10+hgap),yy=b.hundred_stack?Math.max(ybase,(hc-1)*(b.hundred_stack_gap||6))-k*(b.hundred_stack_gap||6):ybase+Math.floor(k/hcols)*(u*10+hgap);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) cube(xx + i * u, yy+j * u, col);
    }
    if(hc){x=b.hundred_stack?hstart+u*10+(hc-1)*(b.hundred_stack_gap||6)+hgap:hstart+Math.min(hcols,hc)*(u*10+hgap);hundredsHeight=b.hundred_stack?Math.max(ybase,(hc-1)*(b.hundred_stack_gap||6))+u*10:ybase+Math.ceil(hc/hcols)*(u*10+hgap)-hgap;}
    for (let k = 0; k < (b.tens ?? 0); k++) { for (let j = 0; j < 10; j++) cube(x, ybase+j * u, col); x += u + (b.tens_gap??gap * 0.6); }
    const n1 = b.ones ?? 0;
    if (n1) { x += b.ones_gap??gap * 0.4; for (let i = 0; i < n1; i++) cube(x + Math.floor(i / 5) * (b.ones_pitch??u + 3), ybase+9*u-(i%5)*(b.ones_step??2*u), colOne); x += b.ones_pitch?(Math.ceil(n1/5)-1)*b.ones_pitch+u:Math.ceil(n1 / 5) * (u + 3); }
    const W = Math.max(x, u), Hh = Math.max(hundredsHeight, u * 10 + ((b.thousands ?? 0) ? b.depth??u * 3 : 0));
    const s = svg("svg", { class: "r-svg", width: W + 2, height: Hh + 2, viewBox: `-1 -1 ${W + 2} ${Hh + 2}`,"data-base10-value":(b.thousands||0)*1000+(b.hundreds||0)*100+(b.tens||0)*10+(b.ones||0),"data-thousands":b.thousands||0,"data-hundreds":b.hundreds||0,"data-tens":b.tens||0,"data-ones":b.ones||0 });
    items.forEach((e) => s.appendChild(e));
    const box = style(el("div", "r-base10" + (b.box !== false ? " boxed" : "")), { ...b, size: undefined, w: undefined, h: undefined });
    box.appendChild(s);
    if(b.box_pad)box.style.padding=b.box_pad;if(b.min_box_width)box.style.minWidth=b.min_box_width+"px";const totalWidth=Math.max(W+(b.box_pad?58:40),b.min_box_width||0),totalHeight=Hh+(b.box_pad?56:36);
    if(b.max_width && totalWidth>b.max_width){const scale=b.max_width/totalWidth,wrap=el("div");Object.assign(wrap.style,{width:b.max_width+"px",height:totalHeight*scale+"px",flexShrink:"0"});Object.assign(box.style,{transform:`scale(${scale})`,transformOrigin:"0 0"});wrap.appendChild(box);return wrap;}return box;
  });

  /* ---- symbol_graph: 표 칸에 ○·×·/ 를 쌓는 그래프 (2학년 표와 그래프) ----
   * {kind:"symbol_graph", title:"장래 희망별 학생 수", labels:["운동선수","선생님","방송인"], counts:[0,2,5], n:5,
   *  symbol:"○", corner:["장래희망","학생 수(명)"], vertical:false, head:"#ffd8dc"}
   * 가로(기본): 이름이 왼쪽 칸(위→아래), 맨 아래 줄이 1…n. vertical:true 면 이름이 맨 아래 줄, 왼쪽 칸이 n…1(아래가 1).
   * counts 에 null 이면 그 줄은 비운다. symbols 로 칸마다 기호를 직접 줄 수도 있다 */
  register("symbol_graph", (b) => {
    const n = b.n ?? Math.max(...b.counts.map((c) => c ?? 0)), sym = b.symbol ?? "○";
    const box = style(el("div", "r-symg"), { ...b, w: undefined, h: undefined }, { size: 22 });
    if (b.head) box.style.setProperty("--head", b.head);
    if (b.title) { const title=el("div", "r-graph-title", inline(b.title));if(b.title_gap!==undefined)title.style.marginBottom=b.title_gap+"px";if(b.title_line_height)title.style.lineHeight=b.title_line_height;if(b.title_bg)Object.assign(title.style,{background:b.title_bg,borderRadius:"8px",padding:"4px 8px",fontSize:(b.title_size||b.size||28)+"px"});box.appendChild(title); }
    const t = el("table", "r-symg-table");
    const mark = (i, j) => (b.symbols?.[i]?.[j]) ?? ((b.counts[i] ?? 0) > j ? sym : "");
    const corner = () => {
      const td = el("th", "r-symg-corner");
      if (b.corner) { td.appendChild(el("span", "tr", inline(b.corner[0]))); td.appendChild(el("span", "bl", inline(b.corner[1]))); }
      return td;
    };
    if (!b.vertical) {
      b.labels.forEach((lb, i) => {
        const tr = el("tr");
        tr.appendChild(el("th", "", inline(lb)));
        for (let j = 0; j < n; j++) tr.appendChild(el("td", "", inline(mark(i, j))));
        t.appendChild(tr);
      });
      const tr = el("tr");
      tr.appendChild(corner());
      for (let j = 1; j <= n; j++) tr.appendChild(el("th", "", String(j)));
      t.appendChild(tr);
    } else {
      for (let j = n - 1; j >= 0; j--) {
        const tr = el("tr");
        tr.appendChild(el("th", "", String(j + 1)));
        b.labels.forEach((_, i) => tr.appendChild(el("td", "", inline(mark(i, j)))));
        t.appendChild(tr);
      }
      const tr = el("tr");
      tr.appendChild(corner());
      b.labels.forEach((lb) => tr.appendChild(el("th", "", inline(lb))));
      t.appendChild(tr);
    }
    if(b.col_w){t.style.width=b.col_w.reduce((a,x)=>a+x,0)+"px";t.style.tableLayout="fixed";[...t.rows].forEach(row=>[...row.cells].forEach((cell,i)=>{const w=b.col_w[i]||b.col_w[b.col_w.length-1];cell.style.width=w+"px";cell.style.setProperty("min-width",w+"px","important");cell.style.padding="0";if(b.cell_h)cell.style.height=b.cell_h+"px";}));}
    if(b.symbol_font)t.querySelectorAll("td").forEach(cell=>{cell.style.fontFamily=b.symbol_font;cell.style.fontSize=(b.symbol_size||b.size||28)+"px";});
    if(b.vertical && b.label_size){const row=t.rows[t.rows.length-1];[...row.cells].slice(1).forEach((cell,i)=>{const width=b.col_w?.[i+1]||100;cell.style.fontSize=Math.min(b.label_size,Math.floor((width-4)/Math.max(1,cell.textContent.length)))+"px";});}
    if(b.symbol_shape==="cross")t.querySelectorAll("td").forEach(cell=>{if(cell.textContent.trim()!==sym)return;const mark=svg("svg",{width:b.mark_size||32,height:b.mark_size||32,viewBox:"0 0 32 32","data-graph-symbol":sym});for(const [x1,y1,x2,y2] of [[5,5,27,27],[5,27,27,5]])mark.appendChild(svg("line",{x1,y1,x2,y2,stroke:"#333","stroke-width":2}));Object.assign(mark.style,{display:"block",margin:"0 auto"});cell.replaceChildren(mark);});
    if(b.symbol_shape==="triangle")t.querySelectorAll("td").forEach(cell=>{if(cell.textContent.trim()!==sym)return;const mark=svg("svg",{width:22,height:22,viewBox:"0 0 28 28","data-graph-symbol":sym});mark.appendChild(svg("polygon",{points:"14,4 25,24 3,24",fill:"none",stroke:"#333","stroke-width":2}));Object.assign(mark.style,{display:"block",margin:"0 auto"});cell.replaceChildren(mark);});
    if(b.corner_h){const corner=t.querySelector(".r-symg-corner");if(corner)corner.style.setProperty("height",b.corner_h+"px","important");}
    box.appendChild(t);
    return box;
  });

  // 나눗셈 칸 글자: "□" 빈칸, "[㉠]" 처럼 대괄호로 감싸면 네모 테두리 글자
  const ldCell = (c, cls = "") => c === "□" ? el("span", "blank" + cls)
    : /^\[.+\]$/.test(c) ? el("span", "cell" + cls, `<span class="r-ld-box">${inline(c.slice(1, -1))}</span>`) : el("span", "cell" + cls, inline(c));

  /* ---- long_div: 긴 나눗셈 세로식 ----
   * {kind:"long_div", divisor:"8", dividend:"696", quotient:"87", steps:[{v:"64", end:1, line:true}, {v:"56", end:2}, …]}
   * 칸은 나뉠 수의 자리. steps 의 end 는 그 줄 마지막 숫자가 놓이는 칸 번호(0부터), line:true 면 아래에 줄.
   * quotient 는 오른쪽 끝을 나뉠 수 끝에 맞춘다(q_end 로 바꿀 수 있다). "□" 는 빈칸, "." 은 앞 숫자에 붙는다 */
  register("long_div", (b) => {
    const cells = (t) => { const o = []; let br = null;
      for (const ch of String(t ?? "")) {
        if (br !== null) { br += ch; if (ch === "]") { o.push(br); br = null; } continue; }
        if (ch === "[") br = "[";
        else if (ch === "." && o.length) o[o.length - 1] += ".";
        else if (ch !== " ") o.push(ch);
      }
      return o; };
    const dv = cells(b.dividend), n = dv.length, ds = cells(b.divisor);
    const e = style(el("div", "r-longdiv"), b, { size: 48 });
    // q_suffix: 몫 뒤 나머지 글자("··· 2") — 오른쪽에 칸을 하나 더 둔다
    const sx = b.q_suffix !== undefined;
    e.style.gridTemplateColumns = `repeat(${ds.length}, 0.75em) 0.45em repeat(${n}, 0.75em)` + (sx ? " auto" : "");
    const put = (c, cls = "") => e.appendChild(ldCell(c, cls));
    const tail = (t = "") => { if (sx) e.appendChild(el("span", "cell r-ld-suffix", inline(t))); };
    const row = (arr, end, cls = "", t) => {
      const r = new Array(ds.length + 1 + n).fill("");
      arr.forEach((c, k) => { const col = ds.length + 1 + end - (arr.length - 1 - k); if (col >= 0) r[col] = c; });
      r.forEach((c, i) => put(c, i > ds.length ? cls : ""));
      tail(t);
    };
    if (b.quotient !== undefined && b.quotient !== "") row(cells(b.quotient), b.q_end ?? n - 1, "", b.q_suffix);
    // 나누는 수 ) 나뉠 수 (나뉠 수 위로 줄)
    ds.forEach((c) => put(c));
    // 괄호는 글자 대신 둥근 선: ")" 글자는 줄 높이가 커서 크기 맞춤이 그 높이로 전체를 줄였다
    e.appendChild(el("span", "cell r-ld-paren", '<span class="r-ld-arc"></span>'));
    dv.forEach((c) => put(c, " top"));
    tail();
    (b.steps || []).forEach((st) => row(cells(st.v), st.end ?? n - 1, st.line ? " under" : ""));
    return e;
  });

  /* ---- ladder: 공약수·공배수 사다리 나눗셈 ----
   * {kind:"ladder", rows:[["2","12","18"],["3","6","9"],["","2","3"]]}  — 줄마다 [나누는 수, 수…], 마지막 줄은 나누는 수 "" */
  register("ladder", (b) => {
    const m = Math.max(...b.rows.map((r) => r.length - 1));
    const e = style(el("div", "r-ladder"), b, { size: 36 });
    e.style.gridTemplateColumns = `auto 0.4em repeat(${m}, 2em)`;
    b.rows.forEach((r, i) => {
      const last = i === b.rows.length - 1 && !r[0], u = last ? "" : " under";
      e.appendChild(ldCell(r[0] || ""));
      e.appendChild(el("span", "cell r-ld-paren", last ? "" : '<span class="r-ld-arc"></span>'));
      for (let k = 1; k <= m; k++) {
        const v = r[k] ?? "";
        e.appendChild(ldCell(v, u));
      }
    });
    return e;
  });

  /* ---- ruler: 자와 그 위에 놓인 물건 ----
   * {kind:"ruler", from:0, to:9, unit:36(1 칸 px), minor:10(한 칸 안 작은 눈금 수), label_every:1, unit_text:"(cm)",
   *  objects:[{from:0, to:8.4, color:"#f0a020", h:14, label:"8.4 cm"}], marks:[0, 8.4](점선 세로 줄), color:"#fbe6c8"}
   * 눈금 값 글자는 label_every 칸마다. labels 로 [{at, text}] 를 직접 줄 수도 있다 */
  register("ruler", (b) => {
    const u = b.unit ?? 36, from = b.from ?? 0, to = b.to ?? 10, mn = b.minor ?? 10, fs = b.size ?? 16;
    const oh = (o) => o.h ?? (o.src && o.ar ? ((o.to - o.from) * (b.unit ?? 36)) * o.ar : 14);
    const objH = Math.max(0, ...(b.objects || []).map((o) => oh(o) + (o.label ? fs * 1.4 : 0) + 8));
    // 단위 글자(cm)는 눈금 숫자와 겹치지 않게 자 오른쪽 끝 바깥에 둔다
    const W0 = (to - from) * u + 24, W = W0 + (b.unit_text && !b.unit_inside ? fs * 2.6 : 0), RH = b.h ?? 44, H = objH + RH + 4, X = (v) => 12 + (v - from) * u, y0 = objH;
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    s.appendChild(svg("rect", { x: 0, y: y0, width: W0, height: RH, fill: b.color || "#fbe6c8", stroke: b.line || "#c87830", "stroke-width": 2, rx: 3 }));
    for (let k = 0; k <= Math.round((to - from) * mn); k++) {
      const v = from + k / mn;
      // 1 cm 마다 한 눈금인 긴 자(minor 1)는 10 cm 를 길게, 5 cm 를 중간으로 그려 촘촘해도 셀 수 있게
      const big = mn === 1 && to - from > 30 ? Math.round(v) % 10 === 0 : k % mn === 0;
      const mid = mn === 1 && to - from > 30 ? Math.round(v) % 5 === 0 : mn % 2 === 0 && k % (mn / 2) === 0;
      s.appendChild(svg("line", { x1: X(v), x2: X(v), y1: y0, y2: y0 + (big ? b.major_tick??RH * 0.42 : mid ? b.mid_tick??RH * 0.3 : b.minor_tick??RH * 0.2), stroke: b.tick_line||"#6a3a10", "stroke-width": big ? 1.6 : 1 }));
    }
    const le = b.label_every ?? 1;
    const labels = b.labels || Array.from({ length: Math.floor((to - from) / le + 1e-9) + 1 }, (_, i) => ({ at: from + i * le, text: String(+(from + i * le).toFixed(4)) }));
    labels.forEach((L) => s.appendChild(svg("text", { x: X(L.at), y: y0 + RH - (b.label_bottom??6), "font-size": fs, "text-anchor": "middle" }, L.text)));
    if (b.unit_text) s.appendChild(svg("text", { x: b.unit_inside?W0-6:W0+6, y: y0 + RH - 6, "font-size": fs * 0.85, "text-anchor": b.unit_inside?"end":"start" }, b.unit_text));
    (b.objects || []).forEach((o) => {
      const h = o.h ?? (o.src && o.ar ? (X(o.to) - X(o.from)) * o.ar : 14), yy = y0 - h - 4;
      if (o.src) {
        // 원본 물건 그림(crop)을 from~to 길이에 맞춰 늘인다
        s.appendChild(svg("image", { href: o.src, x: X(o.from), y: yy, width: X(o.to) - X(o.from), height: h, preserveAspectRatio: "none" }));
        if (o.label) s.appendChild(svg("text", { x: (X(o.from) + X(o.to)) / 2, y: yy - 6, "font-size": fs, "text-anchor": "middle" }, o.label));
        return;
      }
      s.appendChild(svg("rect", { x: X(o.from), y: yy, width: X(o.to) - X(o.from), height: h, fill: o.color || "#f0a020", stroke: o.line || "#9a5a10", "stroke-width": 1.2, rx: Math.min(4, h / 3) }));
      if (o.label) s.appendChild(svg("text", { x: (X(o.from) + X(o.to)) / 2, y: yy - 6, "font-size": fs, "text-anchor": "middle" }, o.label));
    });
    (b.marks || []).forEach((v) => s.appendChild(svg("line", { x1: X(v), x2: X(v), y1: 0, y2: b.marks_to_top?y0:y0 + RH * 0.45, stroke: "#f04080", "stroke-width": 1.5, "stroke-dasharray": "4 3" })));
    // 긴 줄자(60칸 이상)는 끝 점선 부분을 크게 한 번 더 보인다(zoom_end:false 로 끈다)
    const end = Math.max(...(b.marks || []).filter((v) => v > from + 1e-9), -Infinity);
    if (b.zoom_end === false || to - from < 60 || !isFinite(end)) return s;
    const z0 = Math.max(from, Math.floor(end) - 3), z1 = Math.min(to, Math.floor(end) + 3);
    const zobj = (b.objects || []).filter((o) => o.to > z0 && o.from < z1).map((o) => ({ from: Math.max(z0, o.from), to: Math.min(z1, o.to), color: o.color, line: o.line, h: 18 }));
    const box = el("div", "r-stack"); box.style.gap = "4px";
    box.appendChild(s);
    const cap = el("div", "r-ruler-zoom", "끝부분을 크게 본 모양"); cap.style.fontSize = Math.max(16, fs) + "px";
    box.appendChild(cap);
    box.appendChild(renderBlock({ kind: "ruler", from: z0, to: z1, unit: 46, minor: 1, label_every: 1, size: Math.max(16, fs), objects: zobj, marks: [end], unit_text: b.unit_text, zoom_end: false }));
    return box;
  });

  /* ---- protractor: 각도기와 각 ----
   * {kind:"protractor", r:150, rays:[0, 60], arc:true, inner:true}
   * 각도는 오른쪽 밑변에서 시계 반대 방향(도). rays 의 반직선을 중심에서 그린다.
   * 바깥 눈금 숫자는 왼쪽이 0, 안쪽(빨강)은 오른쪽이 0. inner:false 면 안쪽 숫자 생략 */
  register("protractor", (b) => {
    const r = b.r ?? 150, fs = b.size ?? Math.max(10, r * 0.08), pad = b.ray_labels ? fs * 2.6 : 10, W = r * 2 + pad * 2, H = r + pad + (b.center_label ? fs * 2 : 14), cx = W / 2, cy = r + pad;
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const pt = (deg, k) => [cx + Math.cos((deg * Math.PI) / 180) * k, cy - Math.sin((deg * Math.PI) / 180) * k];
    s.appendChild(svg("path", { d: `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy} Z`, fill: b.fill || "rgba(200,230,255,0.55)", stroke: "#4a7aa8", "stroke-width": 1.5 }));
    for (let d = 0; d <= 180; d++) {
      const len = d % 10 === 0 ? r * 0.1 : d % 5 === 0 ? r * 0.07 : r * 0.04, [x1, y1] = pt(d, r), [x2, y2] = pt(d, r - len);
      s.appendChild(svg("line", { x1, y1, x2, y2, stroke: "#335", "stroke-width": d % 10 === 0 ? 1.2 : 0.7 }));
      if (d % 10 === 0) {
        const [ox, oy] = pt(d, r * 0.82);
        s.appendChild(svg("text", { x: ox, y: oy + fs * 0.35, "font-size": fs, "text-anchor": "middle" }, String(180 - d)));
        if (b.inner !== false) { const [ix, iy] = pt(d, r * 0.66); s.appendChild(svg("text", { x: ix, y: iy + fs * 0.35, "font-size": fs * 0.85, "text-anchor": "middle", fill: "#c03050" }, String(d))); }
      }
    }
    s.appendChild(svg("line", { x1: cx - r, y1: cy, x2: cx + r, y2: cy, stroke: "#335", "stroke-width": 1.2 }));
    s.appendChild(svg("circle", { cx, cy, r: 3, fill: "#335" }));
    const rays = b.rays || [];
    if (b.arc !== false && rays.length === 2) {
      const [a0, a1] = rays, rr = r * 0.25, [x0, y0] = pt(a0, rr), [x1, y1] = pt(a1, rr);
      s.appendChild(svg("path", { d: `M${cx},${cy} L${x0},${y0} A${rr},${rr} 0 0 0 ${x1},${y1} Z`, fill: "#ffd0e0", stroke: "#e04080", "stroke-width": 1.5 }));
    }
    rays.forEach((d, k) => {
      const [x, y] = pt(d, r * 1.08); s.appendChild(svg("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: b.ray_color || "#222", "stroke-width": 2.5 }));
      // ray_labels: 반직선 끝 이름(ㄱ, ㄴ …), center_label: 꼭짓점 이름
      const t = (b.ray_labels || [])[k]; if (t) { const [lx, ly] = pt(d, r * 1.08 + fs * 1.1); s.appendChild(svg("text", { x: lx, y: ly + fs * 0.35, "font-size": fs * 1.3, "text-anchor": "middle" }, t)); }
    });
    if (b.center_label) s.appendChild(svg("text", { x: cx, y: cy + fs * 1.4, "font-size": fs * 1.3, "text-anchor": "middle" }, b.center_label));
    return s;
  });

  /* ---- beaker: 눈금 비커·물통 ----
   * {kind:"beaker", max:1000, step:100, minor:50, level:600, unit:"mL", w:90, h:180, label_every:200, color:"#9fd8ff"}
   * level 까지 물을 채운다. 눈금 숫자는 label_every 마다(기본 step) */
  register("beaker", (b) => {
    const w = b.w ?? 90, h = b.h ?? 180, fs = b.size ?? 14, max = b.max ?? 1000, L = fs * 3.4;
    const W = w + L + 8, H = h + 16, x0 = L, y0 = 8, Y = (v) => y0 + h - (v / max) * h;
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    if (b.level) s.appendChild(svg("rect", { x: x0, y: Y(b.level), width: w, height: y0 + h - Y(b.level), fill: b.color || "#9fd8ff" }));
    s.appendChild(svg("path", { d: `M${x0},${y0 - 6} L${x0},${y0 + h} L${x0 + w},${y0 + h} L${x0 + w},${y0 - 6}`, fill: "none", stroke: "#557", "stroke-width": 2.5 }));
    const st = b.step ?? 100, mi = b.minor ?? st, le = b.label_every ?? st;
    for (let v = 0; v <= max + 1e-9; v += mi) {
      const big = Math.abs(v / st - Math.round(v / st)) < 1e-6;
      s.appendChild(svg("line", { x1: x0, x2: x0 + (big ? w * 0.3 : w * 0.15), y1: Y(v), y2: Y(v), stroke: "#557", "stroke-width": 1.2 }));
      if (v > 0 && Math.abs(v / le - Math.round(v / le)) < 1e-6) s.appendChild(svg("text", { x: x0 - 4, y: Y(v) + fs * 0.35, "font-size": fs, "text-anchor": "end" }, String(+v.toFixed(4))));
    }
    if (b.unit) s.appendChild(svg("text", { x: x0 + w - 4, y: y0 + fs, "font-size": fs * 0.85, "text-anchor": "end" }, b.unit));
    return s;
  });

  /* ---- dial: 저울 눈금판(바늘) ----
   * {kind:"dial", max:1000, step:100, minor:10, value:350, unit:"g", r:80}  — 0 이 맨 위, 시계 방향으로 한 바퀴가 max */
  register("dial", (b) => {
    const r = b.r ?? 80, fs = b.size ?? r * 0.15, max = b.max ?? 1000, D = r * 2 + 16, c = D / 2;
    const s = svg("svg", { class: "r-svg", width: D, height: D, viewBox: `0 0 ${D} ${D}` });
    const pt = (v, k) => { const a = ((v / max) * 360 * Math.PI) / 180; return [c + Math.sin(a) * k, c - Math.cos(a) * k]; };
    s.appendChild(svg("circle", { cx: c, cy: c, r: r + 4, fill: "#fff", stroke: b.rim || "#e05050", "stroke-width": 6 }));
    const st = b.step ?? 100, mi = b.minor ?? st / 10;
    for (let v = 0; v < max - 1e-9; v += mi) {
      const big = Math.abs(v / st - Math.round(v / st)) < 1e-6, mid = !big && Math.abs(v / (st / 2) - Math.round(v / (st / 2))) < 1e-6;
      const [x1, y1] = pt(v, r), [x2, y2] = pt(v, r * (big ? 0.86 : mid ? 0.9 : 0.94));
      s.appendChild(svg("line", { x1, y1, x2, y2, stroke: "#333", "stroke-width": big ? 1.6 : 0.8 }));
      if (big) { const [tx, ty] = pt(v, r * 0.72); s.appendChild(svg("text", { x: tx, y: ty + fs * 0.35, "font-size": fs, "text-anchor": "middle" }, String(+v.toFixed(4)))); }
    }
    if (b.unit) s.appendChild(svg("text", { x: c, y: c + r * 0.38, "font-size": fs, "text-anchor": "middle" }, b.unit));
    if (b.value !== undefined && b.value !== null) { const [x, y] = pt(b.value, r * 0.9); s.appendChild(svg("line", { x1: c, y1: c, x2: x, y2: y, stroke: b.needle || "#e02040", "stroke-width": 2.5, "stroke-linecap": "round" })); }
    s.appendChild(svg("circle", { cx: c, cy: c, r: 4, fill: "#333" }));
    return s;
  });
  /* ---- speech: 인물 + 말풍선 ----
   * {kind:"speech", items:[{text:"8은 0.8을\n나타내.", name:"규철", crop:[x0,y0,x1,y1], color:"#bfeee0"}],
   *  side:"top", w:180, size:26, person_h:130, gap:40}
   * side: 말풍선이 인물의 어디에 있나(top 위, left 왼쪽, right 오른쪽). crop 은 원본에서 인물 하나를 감싸는 상자
   * (검사기가 잘라 src 를 채운다). 인물 그림이 없으면 말풍선만 */
  const SPEECH_COLORS = ["#c2ece0", "#fde98c", "#f3dcc4", "#e8cbec", "#ffb8b8", "#cfe4ff", "#c9ec8e"];
  register("speech", (b) => {
    const side = b.side ?? "top", ph = b.person_h ?? 130;
    const e = el("div", "r-speech side-" + side);
    if(b.offset_x)e.style.transform=`translateX(${b.offset_x}px)`;
    e.style.gap = (b.gap ?? 40) + "px";
    b.items.forEach((it, i) => {
      const p = el("div", "sp");
      if(b.align_top)p.style.alignItems="flex-start";
      const col = it.color || b.color || SPEECH_COLORS[i % SPEECH_COLORS.length];
      p.style.setProperty("--bc", col);
      // 흰 말풍선은 흰 바탕에서 안 보이므로 회색 테두리
      if (/^#f{3}(f{3})?$/i.test(col) || col === "white") p.classList.add("white");
      const bub = el("div", "bubble", inline(String(it.text ?? "")));
      bub.style.fontSize = (it.size ?? b.size ?? 26) + "px";
      if(b.bubble_pad)bub.style.padding=b.bubble_pad;
      if(b.person_gap!==undefined && side==="top")bub.style.marginBottom=b.person_gap+"px";
      if(b.line_height)bub.style.lineHeight=b.line_height;
      if (it.w ?? b.w) bub.style.width = (it.w ?? b.w) + "px";
      p.appendChild(bub);
      if (it.src || it.name) {
        const who = el("div", "who");
        if (["right","outside","left"].includes(b.name_side)) Object.assign(who.style, {flexDirection:b.name_side==="left" || b.name_side==="outside" && side==="right"?"row-reverse":"row",alignItems:"center",gap:"10px"});
        if (it.src) { const img = el("img"); img.src = it.src; img.style.height = (it.h ?? ph) + "px"; who.appendChild(img); }
        if (it.name) { const nm = el("div", "name", inline(it.name)); nm.style.fontSize = (b.name_size ?? 30) + "px";if(b.name_gap!==undefined)nm.style.marginTop=b.name_gap+"px"; who.appendChild(nm); }
        p.appendChild(who);
      }
      e.appendChild(p);
    });
    return e;
  });

  /* ---- bond: 가르기·모으기 도식 (네모 셋을 선·화살표로 잇는다) ----
   * {kind:"bond", whole:"13", parts:["7",""], dir:"split", arrow:true, w:84, h:84, size:44}
   * dir: split(위 하나 → 아래 둘), join(위 둘 → 아래 하나). "" 는 빈 네모 */
  register("bond", (b) => {
    if(b.presentation==="branch"){
      const s=svg("svg",{class:"r-svg",width:160,height:92,viewBox:"0 0 160 92"});
      [[12,b.parts[0]],[148,b.parts[1]]].forEach(([x,t])=>{s.appendChild(svg("line",{x1:80,y1:0,x2:x,y2:36,stroke:"#e200cc","stroke-width":3}));s.appendChild(svg("polygon",{points:`${x},36 ${x+(x<80?18:-18)},32 ${x+(x<80?10:-10)},20`,fill:"#e200cc"}));s.appendChild(svg("text",{x,y:74,"text-anchor":"middle","font-size":b.size||32},t));});return s;
    }
    const w = b.w ?? 84, h = b.h ?? 84, ww = b.whole_w ?? w, gap = b.gap ?? 44, v = b.v ?? 60;
    const W = Math.max(w * 2 + gap, ww), H = h * 2 + v, join = b.dir === "join";
    const line = b.line_color || "#7eadd6", fill = b.fill_color || "#eaf2ff";
    const e = el("div", "r-bond");
    e.style.width = W + "px"; e.style.height = H + "px"; e.style.fontSize = (b.size ?? 44) + "px";
    const one = { x: (W - ww) / 2, y: join ? h + v : 0, w: ww, t: b.whole ?? "" };
    const two = (b.parts || ["", ""]).map((t, k) => ({ x: (W - (w * 2 + gap)) / 2 + k * (w + gap), y: join ? 0 : h + v, w, t }));
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    two.forEach((p) => {
      // 위 네모 아래 가운데 → 아래 네모 위 가운데
      const top = join ? p : one, bot = join ? one : p;
      const x0 = top.x + top.w / 2, y0 = h, x1 = bot.x + bot.w / 2 + (join ? (p.x < W / 2 ? -bot.w / 6 : bot.w / 6) : 0), y1 = h + v;
      const sx = join ? x0 : x0 + (p.x < W / 2 ? -top.w / 6 : top.w / 6);
      const dx = x1 - sx, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, a = b.arrow === false ? 0 : 16;
      s.appendChild(svg("line", { x1: sx, y1: y0 + 4, x2: x1 - ux * a * 0.6, y2: y1 - uy * a * 0.6 - 2, stroke: line, "stroke-width": 5 }));
      if (a) s.appendChild(svg("polygon", { points: `${x1},${y1 - 2} ${x1 - ux * a - uy * a * 0.6},${y1 - 2 - uy * a + ux * a * 0.6} ${x1 - ux * a + uy * a * 0.6},${y1 - 2 - uy * a - ux * a * 0.6}`, fill: line }));
    });
    e.appendChild(s);
    [one, ...two].forEach((p) => {
      const t = String(p.t);
      const x = el("div", "box", t === "" || t === "[]" ? "" : inline(t));
      Object.assign(x.style, { left: p.x + "px", top: p.y + "px", width: p.w + "px", height: h + "px", borderColor: line, background: t === "" || t === "[]" ? "#fff" : fill });
      e.appendChild(x);
    });
    return e;
  });

  /* ---- ten_frame: 10칸 틀(5칸 × 2줄)에 동그라미 ----
   * {kind:"ten_frame", frames:2, filled:13, crossed:4, symbol:"●", cell:56, color:"#444"}
   * filled: 전체 동그라미 수(앞 틀부터 채움), crossed: 마지막 몇 개에 사선(crossed_from 이면 그 번호부터),
   * frames_per_row: 한 줄에 틀 몇 개, cols(기본 5)·rows(기본 2), symbol: ● 채움 / ○ 빈 동그라미, colors: 동그라미마다 색 */
  register("ten_frame", (b) => {
    const cs = b.cell ?? 56, cols = b.cols ?? 5, rows = b.rows ?? 2, nf = b.frames ?? 1, fg = b.frame_gap ?? 24;
    const fr = b.frames_per_row ?? nf, nr = Math.ceil(nf / fr);
    const W = fr * cols * cs + (fr - 1) * fg + 4, H = nr * rows * cs + (nr - 1) * fg + 4;
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `-2 -2 ${W} ${H}` });
    const per = cols * rows, filled = b.filled ?? 0;
    const cx0 = b.crossed ? (b.crossed_from ?? filled - b.crossed) : Infinity, cx1 = cx0 + (b.crossed ?? 0);
    for (let f = 0; f < nf; f++) {
      const ox = (f % fr) * (cols * cs + fg), oy = Math.floor(f / fr) * (rows * cs + fg);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        s.appendChild(svg("rect", { x: ox + c * cs, y: oy + r * cs, width: cs, height: cs, fill: "#fff", stroke: b.line || "#555", "stroke-width": 2.5 }));
        const k = f * per + r * cols + c;
        if (k >= filled) continue;
        const x = ox + c * cs + cs / 2, y = oy + r * cs + cs / 2, col = (b.colors && b.colors[k]) || b.color || "#444", hollow = b.symbol === "○";
        s.appendChild(svg("circle", { cx: x, cy: y, r: cs * 0.32, fill: hollow ? "none" : col, stroke: col, "stroke-width": 3 }));
        if (k >= cx0 && k < cx1) s.appendChild(svg("line", { x1: x - cs * 0.36, y1: y + cs * 0.36, x2: x + cs * 0.36, y2: y - cs * 0.36, stroke: b.cross_color || "#f0509a", "stroke-width": 4, "stroke-linecap": "round" }));
      }
    }
    return s;
  });

  /* ---- dice: 주사위 눈·도미노 ----
   * {kind:"dice", faces:[2,7], domino:true, size:96, color:"#333"}  눈은 0~9 (7~9 는 3×3 배치) */
  const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
    7: [0, 1, 2, 4, 6, 7, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8] };
  register("dice", (b) => {
    const S = b.size ?? 96, n = b.faces.length, dom = !!b.domino, gap = dom ? 0 : (b.gap ?? 24);
    const W = n * S + (n - 1) * gap + 6, H = S + 6;
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `-3 -3 ${W} ${H}` });
    if (dom) s.appendChild(svg("rect", { x: 0, y: 0, width: n * S, height: S, rx: S * 0.12, fill: b.fill || "#fff", stroke: b.line || "#444", "stroke-width": 3 }));
    b.faces.forEach((v, i) => {
      const ox = i * (S + gap);
      if (!dom) s.appendChild(svg("rect", { x: ox, y: 0, width: S, height: S, rx: S * 0.16, fill: b.fill || "#fff", stroke: b.line || "#444", "stroke-width": 3 }));
      else if (i) s.appendChild(svg("line", { x1: ox, y1: S * 0.1, x2: ox, y2: S * 0.9, stroke: b.line || "#444", "stroke-width": 3 }));
      (PIPS[v] || []).forEach((p) => s.appendChild(svg("circle", { cx: ox + S * (0.24 + 0.26 * (p % 3)), cy: S * (0.24 + 0.26 * Math.floor(p / 3)), r: S * 0.085, fill: (v === 1 && !b.color) ? "#e0403a" : (b.color || "#333") })));
    });
    return s;
  });
  /* ---- frame: 테두리 상자 (보기 상자, 가/나/다 카드) ----
   * {kind:"frame", tag:"보기", title:"가", caption:"위에서 본 모양", items:[…], line:"#a3b5d6", bg:"#f4f4f4"}
   * tag: 위 테두리에 걸친 색 이름표, title: 상자 위 이름, caption: 상자 안 아래 글, dir:"row" 면 items 를 좌→우로 */
  register("frame", (b) => {
    const wrap = el("div", "r-frame");
    wrap.style.fontSize = (b.size ?? 26) + "px";
    if (b.title) wrap.appendChild(el("div", "ftitle", inline(b.title)));
    const box = el("div", "box");
    box.style.borderColor = b.line || "#d4d4d4";
    if(b.border_width!==undefined)box.style.borderWidth=b.border_width+"px";
    if(b.no_border)box.style.borderWidth="0";
    if (b.bg) box.style.background = b.bg;
    box.style.padding = b.pad ?? (b.tag ? "30px 28px 16px" : "18px 24px 14px");
    if (b.w) box.style.width = b.w + "px";
    if (b.h) box.style.minHeight = b.h + "px";
    if (b.tag) { const t = el("div", "tag", inline(b.tag)); t.style.background = b.tag_color || "#4c7e57"; if(b.tag_ink)t.style.color=b.tag_ink;box.appendChild(t); }
    const inner = el("div", "inner");
    inner.style.gap = (b.gap ?? 20) + "px";
    if (b.dir === "row") inner.style.flexDirection = "row";
    (b.items || []).forEach((x) => inner.appendChild(renderBlock(x)));
    box.appendChild(inner);
    if (b.caption) box.appendChild(el("div", "caption", inline(b.caption)));
    wrap.appendChild(box);
    return wrap;
  });

  /* ---- views: 쌓기나무를 위·앞·옆에서 본 모양 (정사각형 칸) ----
   * {kind:"views", cells:["-##", "##-", "#--"], cell:36, rotate:45}
   * cells: 줄마다 문자열(위→아래), 글자마다 칸. "#" 색칠, "-" 점선 빈 칸, " "·"." 없음,
   * 숫자 1~9 는 색칠 칸에 그 수를 씀(위에서 본 모양에 쌓은 개수), "*" 는 다른 색(alt) 칸.
   * rotate: 도(시계 방향, 45 면 마름모로 돌린 모양). 글자는 돌리지 않는다 */
  register("views", (b) => {
    const cs = b.cell ?? 36, rows = b.cells.map((r) => [...r]), nr = rows.length, nc = Math.max(...rows.map((r) => r.length));
    const a = ((b.rotate ?? 0) * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a), cx = (nc * cs) / 2, cy = (nr * cs) / 2;
    const P = (x, y) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co];
    const xs = [], ys = [];
    [[0, 0], [nc * cs, 0], [0, nr * cs], [nc * cs, nr * cs]].forEach(([x, y]) => { const [u, v] = P(x, y); xs.push(u); ys.push(v); });
    const x0 = Math.min(...xs) - 3, y0 = Math.min(...ys) - 3, W = Math.max(...xs) - x0 + 3, H = Math.max(...ys) - y0 + 3;
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `${x0} ${y0} ${W} ${H}` });
    const quad = (r, c) => [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]].map(([x, y]) => P(x * cs, y * cs).join(",")).join(" ");
    const fill = b.fill || "#efbd8b", alt = b.alt || "#7fc6f0", line = b.line || "#8a4b2c";
    rows.forEach((row, r) => row.forEach((ch, c) => {
      if (ch === "-") s.appendChild(svg("polygon", { points: quad(r, c), fill: "none", stroke: b.dash_color || "#22c3e6", "stroke-width": 2.5, "stroke-dasharray": "4 4" }));
    }));
    rows.forEach((row, r) => row.forEach((ch, c) => {
      if (ch === "-" || ch === " " || ch === "." || ch === "0") return;
      s.appendChild(svg("polygon", { points: quad(r, c), fill: ch === "*" ? alt : (/\d/.test(ch) && b.num_fill) || fill, stroke: line, "stroke-width": 2.5, "stroke-linejoin": "round" }));
      if (/\d/.test(ch)) {
        const [u, v] = P((c + 0.5) * cs, (r + 0.5) * cs);
        s.appendChild(svg("text", { x: u, y: v + cs * 0.2, "font-size": cs * 0.58, "text-anchor": "middle", fill: b.num_color || "#333" }, ch));
      }
    }));
    return s;
  });

  /* ---- balance: 양팔저울 ----
   * {kind:"balance", left:[{crop:[x0,y0,x1,y1]}], right:[{text:"300 g"}], tilt:"left", labels:["노란색","빨간색"], w:360, item_h:90}
   * tilt: 내려간 쪽(left/right), 없으면 수평. 접시 위 물건: crop(원본 그림 상자, 검사기가 잘라 src 를 채움)·src·text.
   * 물건이 여러 개면 배열에 여러 개 */
  register("balance", (b) => {
    const L = (b.w ?? 250) / 2, pw = b.pan_w ?? 130, ih = b.item_h ?? 90, fs = b.size ?? 28, hd = b.hang_h ?? ih + 40;
    const t = b.tilt === "left" ? 1 : b.tilt === "right" ? -1 : 0, th = ((b.angle ?? 8) * Math.PI) / 180 * t;
    const W = 2 * L + pw + 20, cx = W / 2, y0 = 34;
    const ends = [[cx - L * Math.cos(th), y0 + L * Math.sin(th)], [cx + L * Math.cos(th), y0 - L * Math.sin(th)]];
    const panY = ends.map(([, y]) => y + hd), baseY = Math.max(...panY) + 46;
    const H = Math.max(baseY + 18, Math.max(...panY) + 22 + (b.labels ? fs * 1.4 : 0));
    const e = el("div", "r-balance");
    Object.assign(e.style, { width: W + "px", height: H + "px", fontSize: fs + "px" });
    const s = svg("svg", { class: "r-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const metal = b.color || "#a7adb3", dark = "#5f656b";
    s.appendChild(svg("path", { d: `M${cx - 9},${y0} L${cx + 9},${y0} L${cx + 14},${baseY - 8} L${cx - 14},${baseY - 8} Z`, fill: metal }));
    s.appendChild(svg("path", { d: `M${cx - 60},${baseY} Q${cx - 56},${baseY - 26} ${cx},${baseY - 28} Q${cx + 56},${baseY - 26} ${cx + 60},${baseY} Z`, fill: dark }));
    s.appendChild(svg("line", { x1: ends[0][0], y1: ends[0][1], x2: ends[1][0], y2: ends[1][1], stroke: metal, "stroke-width": 9, "stroke-linecap": "round" }));
    s.appendChild(svg("circle", { cx, cy: y0, r: 9, fill: "#fff", stroke: dark, "stroke-width": 4 }));
    ends.forEach(([x, y], k) => {
      const py = panY[k];
      s.appendChild(svg("path", { d: `M${x - pw / 2},${py} L${x},${y} L${x + pw / 2},${py}`, fill: "none", stroke: "#b9bec3", "stroke-width": 1.5 }));
      s.appendChild(svg("circle", { cx: x, cy: y + 2, r: 5, fill: "#fff", stroke: dark, "stroke-width": 2.5 }));
      s.appendChild(svg("path", { d: `M${x - pw / 2},${py} L${x + pw / 2},${py} L${x + pw * 0.38},${py + 16} L${x - pw * 0.38},${py + 16} Z`, fill: b.pan_fill||"#8f959b" }));
      const box = el("div", "items");
      Object.assign(box.style, { left: x - pw / 2 - 20 + "px", width: pw + 40 + "px", top: py - ih + "px", height: ih + "px" });
      ((k ? b.right : b.left) || []).forEach((it) => {
        if (it.src) { const img = el("img"); img.src = it.src; img.style.height = (it.h ?? ih) + "px"; box.appendChild(img); }
        else box.appendChild(el("span", "txt", inline(String(it.text ?? ""))));
      });
      e.appendChild(box);
      if (b.labels && b.labels[k]) {
        const lb = el("div", "lab", inline(b.labels[k]));
        Object.assign(lb.style, { left: x - pw / 2 + "px", width: pw + "px", top: py + 22 + "px" });
        e.appendChild(lb);
      }
    });
    e.insertBefore(s, e.firstChild);
    return e;
  });
  /* ---- shapes: 색 도형 줄·격자 (규칙 찾기, 모양 세기) ----
   * {kind:"shapes", items:["circle:#f36","square:#39f","□","triangle"], size:56, gap:14, cols:6, boxed:true, labels:["가","나"]}
   * 글자 하나가 칸 하나: "모양:색:배율". 모양 circle·square·rect·triangle·tri_down·star·heart·diamond·hexagon·pentagon·semicircle,
   * 앞에 "o-" 를 붙이면 테두리만(빈 도형). "□" 빈 네모, "" 빈 칸, 그 밖의 글자는 그대로 쓴다(㉠, ?, 수).
   * boxed: 칸마다 테두리(표처럼 붙인 칸), cols: 한 줄 칸 수, labels: 칸 아래 글 */
  const SHAPE_COLORS = { red: "#f25c5c", blue: "#3d8fe8", yellow: "#ffcf33", green: "#4cbf6b", purple: "#a070e0", pink: "#ff8fbf", orange: "#ff9a3c", black: "#333", gray: "#aaa", sky: "#7fd0f5" };
  const shapePath = (t, S) => {
    const c = S / 2, r = S * 0.44, P = (n, rot, rr = r) => Array.from({ length: n }, (_, k) => { const a = rot + (k * 2 * Math.PI) / n; return [c + rr * Math.cos(a), c + rr * Math.sin(a)]; });
    const poly = (pts) => "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L") + "Z";
    switch (t) {
      case "circle": return { circle: true, r };
      case "square": return poly([[c - r * 0.86, c - r * 0.86], [c + r * 0.86, c - r * 0.86], [c + r * 0.86, c + r * 0.86], [c - r * 0.86, c + r * 0.86]]);
      case "rect": return poly([[c - r, c - r * 0.6], [c + r, c - r * 0.6], [c + r, c + r * 0.6], [c - r, c + r * 0.6]]);
      case "triangle": return poly([[c, c - r], [c + r, c + r * 0.8], [c - r, c + r * 0.8]]);
      case "tri_down": return poly([[c - r, c - r * 0.8], [c + r, c - r * 0.8], [c, c + r]]);
      case "diamond": return poly(P(4, -Math.PI / 2));
      case "pentagon": return poly(P(5, -Math.PI / 2));
      case "hexagon": return poly(P(6, 0));
      case "star": return poly(Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r * 1.05; return [c + rr * Math.cos(a), c + 0.06 * S + rr * Math.sin(a)]; }));
      case "heart": return `M${c},${c + r * 0.9} C${c - r * 1.5},${c - r * 0.1} ${c - r * 0.7},${c - r * 1.2} ${c},${c - r * 0.45} C${c + r * 0.7},${c - r * 1.2} ${c + r * 1.5},${c - r * 0.1} ${c},${c + r * 0.9}Z`;
      case "semicircle": return `M${c - r},${c + r * 0.4} A${r},${r} 0 0 1 ${c + r},${c + r * 0.4}Z`;
      default: return null;
    }
  };
  register("shapes", (b) => {
    const S = b.size ?? 56, cols = b.cols ?? b.items.length, boxed = !!b.boxed;
    const e = el("div", "r-shapes" + (boxed ? " boxed" : ""));
    e.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    if (!boxed) e.style.gap = (b.gap ?? 14) + "px";
    if (b.line) e.style.setProperty("--line", b.line);
    b.items.forEach((raw, i) => {
      const cell = el("div", "sh");
      if (boxed) { cell.style.width = (b.cell ?? S + 20) + "px"; cell.style.height = (b.cell ?? S + 20) + "px"; }
      const [t0, col, sc, sk] = String(raw).split(":"), hollow = t0.startsWith("o-"), t = hollow ? t0.slice(2) : t0;
      const d = b.fill_cells && t==="square" ? `M0 0H${S}V${S}H0Z` : shapePath(t, S);
      if (d) {
        const k = sc ? +sc : 1, s = svg("svg", { width: S * k, height: S * k, viewBox: `0 0 ${S} ${S}` });
        const fc = SHAPE_COLORS[col] || col || b.color || "#3d8fe8";
        const at = { fill: hollow ? "none" : fc, stroke: hollow ? fc : sk || b.stroke || "none", "stroke-width": hollow ? 4 : 2.5, "stroke-linejoin": "round" };
        s.appendChild(d.circle ? svg("circle", { cx: S / 2, cy: S / 2, r: d.r, ...at }) : svg("path", { d, ...at }));
        cell.appendChild(s);
      } else if (raw === "□") {
        const x = el("span", "blank"); x.style.width = x.style.height = S * 0.8 + "px"; cell.appendChild(x);
      } else if (raw) {
        const x = el("span", "txt", inline(String(raw))); x.style.fontSize = (b.text_size ?? S * 0.7) + "px"; cell.appendChild(x);
      }
      const wrap = b.labels ? el("div", "shw") : null;
      if (wrap) { wrap.appendChild(cell); wrap.appendChild(el("div", "lab", inline(b.labels[i] ?? ""))); e.appendChild(wrap); }
      else e.appendChild(cell);
    });
    if(b.portrait_rect)e.querySelectorAll(".sh svg").forEach(x=>{x.style.width="32px";x.style.height="44px";x.setAttribute("preserveAspectRatio","none")});
    if(b.case_grid){Object.assign(e.style,{gap:"10px 14px",border:"3px solid #aaa",borderRadius:"18px",padding:"14px"});for(const c of e.children){Object.assign(c.style,{border:"2px solid #777",borderRadius:"5px",padding:"4px",background:"white"})}}
    if(b.mask_layout){Object.assign(e.style,{display:"block",position:"relative",width:"640px",height:"300px"});const bg=svg("svg",{width:640,height:300,viewBox:"0 0 640 300"});for(const d of ["M120 65 C-30 0 -24 235 120 220","M520 65 C670 0 664 235 520 220"])bg.appendChild(svg("path",{d,fill:"none",stroke:"#697174","stroke-width":6}));bg.appendChild(svg("path",{d:"M130 38 Q320 12 510 38 V252 Q320 332 130 252 Z",fill:"#fff",stroke:"#697174","stroke-width":4}));bg.appendChild(svg("path",{d:"M140 45 Q320 25 500 45 M140 240 Q320 307 500 240",fill:"none",stroke:"#d9e4ef","stroke-width":16}));for(const d of ["M155 112 Q320 86 486 112","M155 175 Q320 209 486 175"])bg.appendChild(svg("path",{d,fill:"none",stroke:"#b8bec0","stroke-width":4}));e.prepend(bg);let sq=0,circ=0,tri=0;const circlePositions=[[250,116],[380,116],[316,172],[292,222],[338,222]];for(const [i,c]of [...e.querySelectorAll('.sh')].entries()){const type=String(b.items[i]).split(':')[0];let x,y,scale=1;if(type==='square'){x=160+sq++*48;y=54;scale=.55}else if(type==='rect'){x=260;y=244;scale=1}else if(type==='circle'){[x,y]=circlePositions[circ]||[220+circ*45,170];scale=circ<2?.6:circ===2?.9:.3;circ++}else{x=182+tri++*244;y=170;scale=.7}Object.assign(c.style,{position:"absolute",left:x+"px",top:y+"px",transform:`scale(${scale})`,transformOrigin:"0 0"})}}
    if (b.label_size) e.style.fontSize = b.label_size + "px";
    return e;
  });

  /* ---- coins: 동전·지폐 ----
   * {kind:"coins", items:[{v:100, n:3}, {v:10, n:5}], size:64, per_row:5, gap:10, group_gap:30}
   * v: 10·50·100·500(동전), 1000·5000·10000·50000(지폐). 종류마다 한 묶음 */
  const COIN = { 1: ["#e3e5e8", "#9aa0a6"], 5: ["#e8cf8a", "#a88a3a"], 10: ["#e0a46a", "#a8693a"], 50: ["#e3e5e8", "#9aa0a6"], 100: ["#e3e5e8", "#9aa0a6"], 500: ["#eceef0", "#8f969d"] };
  const BILL = { 1000: "#a9cdeb", 5000: "#f5c08a", 10000: "#b5dca8", 50000: "#f3d77a" };
  register("coins", (b) => {
    const S0 = b.size ?? 64, e = el("div", "r-coins");
    e.style.gap = (b.group_gap ?? 30) + "px";
    // dir:"column" 이면 묶음을 위→아래로 (왼쪽 맞춤)
    if (b.dir === "column") { e.style.flexDirection = "column"; e.style.alignItems = "flex-start"; }
    (b.items || []).forEach((g) => {
      const box = el("div", "grp"), bill = g.v >= 1000, S = S0 * (g.v === 1 ? 0.75 : g.v === 10 || g.v === 5 ? 0.9 : 1);
      const w = bill ? S * 2.1 : S, h = bill ? S : S;
      box.style.gap = (b.gap ?? 10) + "px";
      box.style.gridTemplateColumns = `repeat(${Math.max(1, Math.min(g.n, g.per_row ?? b.per_row ?? 10))}, ${w}px)`;
      for (let k = 0; k < g.n; k++) {
        const s = svg("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
        if (bill) {
          s.appendChild(svg("rect", { x: 1.5, y: 1.5, width: w - 3, height: h - 3, rx: 5, fill: BILL[g.v] || "#ddd", stroke: "#6b7b8c", "stroke-width": 2 }));
          s.appendChild(svg("circle", { cx: w * 0.72, cy: h / 2, r: h * 0.28, fill: "#fff", opacity: 0.55 }));
          s.appendChild(svg("text", { x: w * 0.08, y: h * 0.36, "font-size": h * 0.26, "font-weight": 700, fill: "#334" }, String(g.v)));
          s.appendChild(svg("text", { x: w * 0.08, y: h * 0.84, "font-size": h * 0.2, fill: "#334" }, "원"));
        } else {
          const [f, l] = COIN[g.v] || COIN[100];
          s.appendChild(svg("circle", { cx: S / 2, cy: S / 2, r: S / 2 - 2, fill: f, stroke: l, "stroke-width": 3 }));
          s.appendChild(svg("circle", { cx: S / 2, cy: S / 2, r: S / 2 - 7, fill: "none", stroke: l, "stroke-width": 1.2 }));
          s.appendChild(svg("text", { x: S / 2, y: S / 2 + S * 0.12, "font-size": S * (g.v >= 100 ? 0.32 : 0.36), "font-weight": 700, "text-anchor": "middle", fill: "#3a3a3a" }, String(g.v)));
        }
        box.appendChild(s);
      }
      if (g.label) { const w2 = el("div", "cg"); w2.appendChild(box); w2.appendChild(el("div", "lab", inline(g.label))); e.appendChild(w2); }
      else e.appendChild(box);
    });
    return e;
  });
  /* ---- pic: 꾸밈 그림 (원본에서 잘라 쓴다) ----
   * {kind:"pic", crop:[x0,y0,x1,y1], h:200}  수·개수·정답 정보가 없는 그림만(장면 삽화, 물건 하나). 검사기가 잘라 src 를 채운다.
   * h(높이 px)가 없으면 원본 크기, radius 로 둥근 모서리 */
  register("pic", (b) => {
    const img = el("img", "r-pic");
    img.src = b.src || "";
    if (b.h) img.style.height = b.h + "px";
    else if (b.w) img.style.width = b.w + "px";
    if (b.radius) img.style.borderRadius = b.radius + "px";
    if (!b.labels || !b.crop) return img;
    // labels: 그림 위 글자(원본 좌표). bg 를 주면 그 색 상자로 원본 글자를 덮고 그 위에 쓴다
    // [{at:[x,y](글자 가운데), text, size(원본 px, 기본 28), color, bg, w, h(덮개 상자 원본 px), bold}]
    const [x0, y0, x1, y1] = b.crop, k = b.h ? b.h / (y1 - y0) : b.w ? b.w / (x1 - x0) : 1;
    const e = el("div", "r-picbox");
    Object.assign(e.style, { width: (x1 - x0) * k + "px", height: (y1 - y0) * k + "px" });
    img.style.width = "100%"; img.style.height = "100%";
    e.appendChild(img);
    b.labels.forEach((L) => {
      const t = el("div", "lab", L.blank_render==="empty"?"":inline(String(L.text ?? "")));
      const fs = (L.size ?? 28) * k;
      Object.assign(t.style, { left: (L.at[0] - x0) * k + "px", top: (L.at[1] - y0) * k + "px", fontSize: fs + "px", color: L.color || "#333" });
      if (L.bg) { t.style.background = L.bg; t.style.width = (L.w ?? fs * 1.6 / k) * k + "px"; t.style.height = (L.h ?? fs * 1.4 / k) * k + "px"; t.style.borderRadius = (L.radius ?? 4) * k + "px"; }
      if(L.bg_polynomial){const cv=document.createElement("canvas"),w=Math.round((L.w??56)*k),h=Math.round((L.h??64)*k);cv.width=w;cv.height=h;const ctx=cv.getContext("2d"),im=ctx.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const xx=2*(x+.5)/w-1,yy=2*(y+.5)/h-1;for(let c=0;c<3;c++){let v=0;L.bg_polynomial.terms.forEach(([i,j],n)=>v+=L.bg_polynomial.coefficients[c][n]*xx**i*yy**j);im.data[(y*w+x)*4+c]=Math.max(0,Math.min(255,Math.round(v)))}im.data[(y*w+x)*4+3]=255;}ctx.putImageData(im,0,0);t.style.backgroundImage=`url(${cv.toDataURL()})`;t.style.backgroundSize="100% 100%";t.style.borderRadius="0";}
      if(L.text_shift){const span=el("span",null,inline(String(L.text??"")));span.style.transform=`translate(${L.text_shift[0]*k}px,${L.text_shift[1]*k}px) scaleX(${L.text_scale_x??1})`;t.innerHTML="";t.appendChild(span);}
      if(L.letter_spacing!==undefined)t.style.letterSpacing=L.letter_spacing+"px";
      if(L.blank_style)t.querySelectorAll(".blank-box").forEach(e=>Object.assign(e.style,L.blank_style));
      if(L.token_layout){t.innerHTML="";const tokens=String(L.text).match(/\S+/g)||[];L.token_layout.forEach((p,j)=>{const token=tokens[p.index??j]??"",span=el("span",null,inline(token));Object.assign(span.style,{position:"absolute",left:p.x*k+"px",top:p.y*k+"px",fontSize:(p.size??L.size??28)*k+"px",lineHeight:"1",whiteSpace:"pre",transform:p.scale_x!==undefined?`scaleX(${p.scale_x})`:"none",transformOrigin:"0 0"});if(token==="[]"){span.style.display="block";span.querySelectorAll(".blank-box").forEach(e=>Object.assign(e.style,{position:"absolute",left:"0",top:"0",margin:"0",...(L.blank_style||{}),width:p.w*k+"px",height:p.h*k+"px"}));}t.appendChild(span);});}

      if(L.text_stroke!==undefined){t.style.webkitTextStroke=L.text_stroke+"px "+(L.stroke_color||L.color||"#343434");if(L.stroke_color)t.style.paintOrder="stroke fill";}
      if(L.font_family)t.style.fontFamily=L.font_family;
      if(L.font_weight!==undefined)t.style.fontWeight=L.font_weight;
      if (L.bold === false) t.style.fontWeight = 400;
      e.appendChild(t);
    });
    return e;
  });

  // Scoped illustrations retain the original per-object quantities and crops.
  register("cookie_plate",b=>{
    const diameter=b.diameter||182,e=el("div","r-cookie-plate");Object.assign(e.style,{position:"relative",width:diameter+"px",height:(b.plate_height||diameter)+"px",borderRadius:"50%",background:"radial-gradient(ellipse,#e8e9ef 64%,#d6d8e0 65%,#f2f3f7 69%,#bfc5cf 72%,#f2f3f7 77%)"});
    for(let i=0;i<b.count;i++){let x,y;if(i===0){x=diameter/2;y=(b.plate_height||diameter)/2}else{const angle=(i-1)*Math.PI*2/Math.max(1,b.count-1)-Math.PI/2;x=diameter/2+Math.cos(angle)*diameter*.32;y=(b.plate_height||diameter)/2+Math.sin(angle)*(b.plate_height||diameter)*.32}const sz=b.item_size||Math.min(52,diameter*.29,diameter*1.7/Math.max(5,b.count-1)),a=renderBlock({...b.art,kind:"icons",count:1,per_row:1,frame:null,icon_h:sz,icon_w:sz,gap:0});Object.assign(a.style,{position:"absolute",left:(x-sz/2)+"px",top:(y-sz/2)+"px"});e.appendChild(a)}return e;
  });
  register("bird_branch",b=>{
    const e=el("div","r-bird-branch");Object.assign(e.style,{position:"relative",width:"552px",height:"200px"});const s=svg("svg",{width:552,height:200,viewBox:"0 0 552 200"});s.appendChild(svg("path",{d:"M6 163 Q165 108 382 151 L425 162 Q246 106 8 143 Z",fill:"#955e28"}));s.appendChild(svg("path",{d:"M260 140 Q256 190 282 194 Q285 155 260 140",fill:"#94b441"}));e.appendChild(s);
    b.groups.forEach((raw,k)=>{const g=raw.kind==="icons"?raw:raw.items.find(x=>x.kind==="icons");for(let i=0;i<g.count;i++){const x=k?145+i*96:22+i*92,y=k?(i%2?48:13):100-(i%3)*12;const a=renderBlock({...g,count:1,per_row:1,icon_h:k?58:64,icon_w:k?70:50});Object.assign(a.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(a)}});return e;
  });
  register("shape_train",b=>{
    if(b.groups.some(x=>x.kind!=="icons")){const e=el("div");Object.assign(e.style,{display:"flex",gap:"20px",alignItems:"center"});b.groups.forEach(x=>e.appendChild(renderBlock({...x,size:44,gap:8})));return e;}const s=svg("svg",{width:570,height:218,viewBox:"0 0 570 218",class:"r-shape-train"});
    b.groups.forEach((g,k)=>{for(let i=0;i<g.count;i++){const a={stroke:["#8b7445","#527f94","#428d7e"][k],"stroke-width":3,"data-train-group":k};if(k===0){const widths=[220,52,52],x=[100,48,320];s.appendChild(svg("rect",{...a,x:(x[i]??(100+i*55)),y:76,width:widths[i]??52,height:110,fill:["#ffe4b8","#b7ecfa","#e4f3ad"][i%3]}))}else if(k===1){const pts=i<4?`${100+i*55},76 ${127+i*55},32 ${154+i*55},76`:i===4?"0,136 48,87 48,136":`${374+(i-5)*65},186 ${374+(i-5)*65},136 ${439+(i-5)*65},186`;s.appendChild(svg("polygon",{...a,points:pts,fill:i<4?"#b7e7f5":i===4?"#ff9fc9":i%2?"#c6a8ee":"#ffbfa7"}))}else{s.appendChild(svg("circle",{...a,cx:136+i*66,cy:201,r:18,fill:"#91dfc8"}))}}});return s;
  });

 register("heart_sequence",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"664px",height:"152px",paddingTop:"56px"});const art=renderBlock(b.art);Object.assign(art.style,{border:"3px solid #aab7c7",borderRadius:"14px",padding:"14px 20px",width:"664px",boxSizing:"border-box"});e.appendChild(art);[["빨간색",14],["초록색",82],["노란색",150]].forEach(([text,x])=>{const l=el("div",null,text);Object.assign(l.style,{position:"absolute",top:"0",left:x+"px",fontSize:"22px"});e.appendChild(l);const line=el("div");Object.assign(line.style,{position:"absolute",top:"30px",left:(x+30)+"px",height:"28px",borderLeft:"2px solid #999"});e.appendChild(line)});return e});
 register("subtraction_blocks",b=>{
   const models=b.models,t=models.reduce((n,x)=>n+(x.tens||0),0),o=models.reduce((n,x)=>n+(x.ones||0),0),removed=models[models.length-1].ones||0,e=el("div");Object.assign(e.style,{display:"flex",gap:"14px",alignItems:"center"});
   for(let side=0;side<2;side++){const model=side?b.result:{tens:t,ones:o},s=renderBlock({...model,kind:"base10_panel",panel_w:358,pitch:41,pad:26});s.setAttribute("height",222);s.setAttribute("preserveAspectRatio","none");if(!side){const rects=[...s.querySelectorAll('rect[fill="#7eb3df"]')].slice(t*10);rects.slice(-removed).forEach(r=>{const x=Number(r.getAttribute('x')),y=Number(r.getAttribute('y'));s.appendChild(svg("line",{x1:x-2,y1:y+19,x2:x+19,y2:y-2,stroke:"#e020d0","stroke-width":3,"data-removal":1}))})}e.appendChild(s);if(!side)e.appendChild(renderBlock({kind:"arrow",dir:"right",color:"#5fd6a8",len:40}))}return e;
 });
 register("joining_addition",b=>{
   const e=el("div");Object.assign(e.style,{position:"relative",width:"660px",height:"380px"});const [blue,green]=b.groups,bonds=b.bonds.items;
   const bar=(a,x,y,n)=>{const v=renderBlock({...a,count:n,per_row:n,icon_h:41,icon_w:30,gap:0});Object.assign(v.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(v)};
   const s=svg("svg",{width:660,height:380,viewBox:"0 0 660 380"});for(const [x,y,w]of [[0,0,334],[386,0,274],[0,128,334],[386,128,274]])s.appendChild(svg("rect",{x:x+2,y:y+2,width:w-4,height:76,rx:14,fill:"#fff",stroke:"#ccc","stroke-width":4}));e.appendChild(s);bar(blue,24,18,blue.count);bar(green,424,18,green.count);
   const parts=bonds.map(x=>x.parts.map(Number));bar(blue,24,146,parts[0][0]);bar(blue,54+parts[0][0]*30,146,parts[0][1]);bar(green,424,146,parts[1][0]);bar(green,444+parts[1][0]*30,146,parts[1][1]);
   for(const [d,col]of [["M330 98 Q320 112 210 134","#d315ce"],["M530 212 Q400 254 280 208","#d315ce"]]){s.appendChild(svg("path",{d,fill:"none",stroke:col,"stroke-width":4}));}s.appendChild(svg("polygon",{points:"210,134 226,123 224,140",fill:"#d315ce"}));s.appendChild(svg("polygon",{points:"280,208 292,218 294,200",fill:"#d315ce"}));
   const ex=renderBlock({...b.expression,size:40});Object.assign(ex.style,{position:"absolute",left:"190px",top:"242px"});e.appendChild(ex);
   bonds.forEach((bond,i)=>{const x=158+i*166,whole=el("div",null,String(bond.whole));Object.assign(whole.style,{position:"absolute",left:(x+34)+"px",top:"264px",fontSize:"34px",opacity:"0"});e.appendChild(whole);bond.parts.forEach((part,j)=>{const text=el("div",null,String(part));Object.assign(text.style,{position:"absolute",left:(x+j*58)+"px",top:"328px",fontSize:"36px",background:j===0?"#ffb4d5":"transparent",borderRadius:"50%",padding:"3px 10px"});e.appendChild(text);s.appendChild(svg("line",{x1:x+40,y1:295,x2:x+j*58+20,y2:328,stroke:"#d315ce","stroke-width":4}));s.appendChild(svg("polygon",{points:`${x+j*58+20},328 ${x+j*58+12},314 ${x+j*58+28},314`,fill:"#d315ce"}))})});return e;
 });

 register("aquarium_question25",b=>{const e=el("div");Object.assign(e.style,{width:"248px",height:"108px",position:"relative"});const s=svg("svg",{width:248,height:108,viewBox:"0 0 248 108"});for(const [points,fill]of [["2,20 224,20 224,106 2,106","#81d8fa"],["2,20 26,2 246,2 224,20","#f2fcff"],["224,20 246,2 246,86 224,106","#c5f1ff"]])s.appendChild(svg("polygon",{points,fill,stroke:"#2ab4df","stroke-width":3}));e.appendChild(s);const a=renderBlock(b.art);Object.assign(a.style,{position:"absolute",left:"24px",top:"50px"});e.appendChild(a);return e});

 register("strawberry_split26",b=>{
  const e=el("div");Object.assign(e.style,{position:"relative",width:"880px",height:"300px"});const groups=b.groups,total=groups.reduce((n,x)=>n+x.count,0),sub=Number(b.expression.text.match(/-\s*(\d+)/)?.[1]||0),cols=5,cs=56;
  for(let row=0;row<2;row++){let offset=0;groups.forEach((g,k)=>{const grid=el("div","r-strawberry-grid");grid.dataset.count=g.count;Object.assign(grid.style,{position:"absolute",left:k*(cols*cs+12)+"px",top:row*146+"px",display:"grid",gridTemplateColumns:`repeat(${cols},${cs}px)`,borderTop:"2px solid #bbb",borderLeft:"2px solid #bbb"});for(let i=0;i<10;i++){const cell=el("div");Object.assign(cell.style,{width:cs+"px",height:cs+"px",borderRight:"2px solid #bbb",borderBottom:"2px solid #bbb",background:"white",boxSizing:"border-box",display:"flex",alignItems:"center",justifyContent:"center"});if(i<g.count){cell.appendChild(renderBlock({...g,kind:"icons",count:1,per_row:1,frame:null,icon_h:41,icon_w:37,gap:0,pad:"0"}));if(row&&offset+i<sub){cell.style.outline="3px solid #21a3d0";cell.style.outlineOffset="-2px"}}grid.appendChild(cell)}offset+=g.count;e.appendChild(grid)})}
  const ex=renderBlock({...b.expression,size:42});Object.assign(ex.style,{position:"absolute",left:"610px",top:"70px"});e.appendChild(ex);const s=svg("svg",{width:880,height:300,viewBox:"0 0 880 300"});for(const [x,col,dir]of [[156,"#19abd0",-1],[280,"#997a54",1]]){s.appendChild(svg("path",{d:dir<0?`M${x} 122 l-22 17`:`M${x} 122 v17`,stroke:col,"stroke-width":4,fill:"none"}));s.appendChild(svg("polygon",{points:dir<0?`${x-22},139 ${x-19},126 ${x-9},137`:`${x},139 ${x-8},129 ${x+8},129`,fill:col}))}e.appendChild(s);const bond=renderBlock({...b.bond,size:30,w:90,h:40});Object.assign(bond.style,{position:"absolute",left:"620px",top:"136px"});e.appendChild(bond);return e;
 });

 register("comparison_models27",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"788px",height:"234px"});const s=svg("svg",{width:788,height:234,viewBox:"0 0 788 234"});s.appendChild(svg("rect",{x:2,y:2,width:784,height:230,rx:18,fill:"#fff",stroke:"#519ecb","stroke-width":3}));s.appendChild(svg("path",{d:"M3 164 H785 V216 Q785 231 768 231 H20 Q3 231 3 216 Z",fill:"#d0e5ff"}));for(const [x1,y1,x2,y2]of [[394,2,394,232],[2,164,786,164]])s.appendChild(svg("line",{x1,y1,x2,y2,stroke:"#519ecb","stroke-width":3}));s.appendChild(svg("circle",{cx:394,cy:198,r:24,fill:"#efffff",stroke:"#9ec6e0","stroke-width":4}));e.appendChild(s);b.models.forEach((m,i)=>{const art=renderBlock(m),v=art.querySelector('svg'),w=Number(v.getAttribute('width')),h=Number(v.getAttribute('height')),scale=Math.min(1,350/w,136/h);Object.assign(art.style,{position:"absolute",left:(i*394+(394-w*scale)/2)+"px",top:(22+(136-h*scale)/2)+"px",transform:`scale(${scale})`,transformOrigin:"0 0"});e.appendChild(art)});[b.comparison.left,b.comparison.right].forEach((value,i)=>{const t=el("div",null,inline(String(value)));Object.assign(t.style,{position:"absolute",left:(i*394)+"px",top:"174px",width:"394px",textAlign:"center",fontSize:"42px"});e.appendChild(t)});return e;});
 register("sticker_notebook27",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"270px",height:"190px",background:"#aacd7f",border:"3px solid #74954d",boxShadow:"inset 0 0 0 6px #d4e8ab"});for(let i=0;i<10;i++){const ring=el("div");Object.assign(ring.style,{position:"absolute",left:(10+i*25)+"px",top:"-10px",width:"7px",height:"18px",border:"3px solid #bbb",borderRadius:"8px",background:"white"});e.appendChild(ring)}const pts=[[30,28],[112,48],[78,108],[208,114],[10,80],[182,28],[28,122],[68,112]];let index=0;b.groups.forEach(group=>{if(group.kind!=="icons"){const a=renderBlock({...group,size:36,gap:6});Object.assign(a.style,{position:"absolute",left:"12px",top:"24px"});e.appendChild(a);return;}for(let i=0;i<group.count;i++){const [x,y]=pts[index%pts.length],a=renderBlock({...group,count:1,per_row:1,frame:null,icon_h:48,icon_w:58});Object.assign(a.style,{position:"absolute",left:x+"px",top:y+"px",transform:`rotate(${index%2?4:-5}deg)`});e.appendChild(a);index++}});return e;});

 register("sequence_tiles27",b=>{const cw=b.cell||94,ch=b.h||94,e=el("div");Object.assign(e.style,{display:"flex",border:"3px solid #888",borderRadius:"12px",overflow:"hidden",width:(b.items.length*cw)+"px"});b.items.forEach((item,i)=>{const cell=el("div");Object.assign(cell.style,{width:cw+"px",height:ch+"px",display:"flex",justifyContent:"center",alignItems:"center",boxSizing:"border-box",borderLeft:i?"2px solid #aaa":"0"});cell.appendChild(renderBlock(item));e.appendChild(cell)});return e;});

 register("bead_line28",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"632px",height:"140px",paddingTop:"40px"});const a=renderBlock(b.shapes);Object.assign(a.style,{border:"3px solid #acb4c1",borderRadius:"16px",padding:"18px",background:"white"});e.appendChild(a);[["보라색",24],["초록색",84],["주황색",144]].forEach(([label,x])=>{const t=el("div",null,label);Object.assign(t.style,{position:"absolute",left:x+"px",top:"0",fontSize:"22px"});e.appendChild(t);const line=el("div");Object.assign(line.style,{position:"absolute",left:(x+26)+"px",top:"26px",height:"24px",borderLeft:"2px solid #aaa"});e.appendChild(line)});return e;});
 register("penguin_scene28",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"444px",height:"244px",overflow:"hidden",borderRadius:"14px",background:"#b4d8e9"});const s=svg("svg",{width:444,height:244,viewBox:"0 0 444 244"});for(const [points,fill]of [["0,86 80,10 152,82 216,20 290,78 366,2 444,70 444,136 0,136","#f2fcff"],["0,96 80,32 130,82 160,64 216,42 268,92 290,70 366,24 398,76 444,54 444,154 0,154","#9dc4d9"],["0,110 444,118 444,244 0,244","#3a8ab5"],["70,112 240,98 286,136 224,176 92,162","#e0f7fc"],["70,142 224,154 286,136 276,158 214,190 90,174","#a7d3e7"],["268,214 328,178 444,190 444,244 278,244","#e2f8ff"],["0,210 54,194 80,220 0,228","#e9fbff"]])s.appendChild(svg("polygon",{points,fill}));for(const [cx,cy,r]of [[66,24,9],[370,34,5],[406,20,4]])s.appendChild(svg("circle",{cx,cy,r,fill:"#fff"}));e.appendChild(s);const pts=[[[120,20],[270,10],[390,20],[220,66],[312,68],[164,130],[316,162],[390,120]],[[18,138],[80,125]]];b.groups.forEach((g,k)=>{for(let i=0;i<g.count;i++){const [x,y]=pts[k][i]||[24+(i%6)*64,24+Math.floor(i/6)*72],a=renderBlock({...g,count:1,per_row:1,frame:null,icon_h:k?56:69,icon_w:k?54:43,pad:"0"});Object.assign(a.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(a)}});return e;});
 register("crown28",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"250px",height:"230px"});let di=0,ti=0;b.groups.forEach(g=>{if(g.kind!=="icons"){e.appendChild(renderBlock({...g,size:40,gap:5}));return;}for(let i=0;i<g.count;i++){const rect=g.icon==='rect_blue',diamond=g.icon==='diamond',a=renderBlock({...g,count:1,per_row:1,frame:null,icon_h:rect?61:diamond?29:100,icon_w:rect?182:diamond?30:57,pad:"0"});let x,y;if(rect){x=20;y=150}else if(diamond){x=8+di++*102;y=0}else{x=12+ti++*76;y=28}Object.assign(a.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(a)}});return e;});
 register("bead_bracelet28",b=>{const W=440,H=210,e=el("div");Object.assign(e.style,{position:"relative",width:W+"px",height:H+"px"});const s=svg("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`});s.appendChild(svg("ellipse",{cx:220,cy:105,rx:180,ry:72,fill:"none",stroke:"#9b986a","stroke-width":2}));e.appendChild(s);b.shapes.items.forEach((raw,i)=>{const angle=-Math.PI+(i/b.shapes.items.length)*Math.PI*2,x=220+180*Math.cos(angle)-24,y=105+72*Math.sin(angle)-24,a=renderBlock({...b.shapes,items:[raw],cols:1,boxed:false,size:48,labels:null,gap:0});Object.assign(a.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(a)});return e;});
 register("bracelet_objects28",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"320px",height:"240px"});const s=svg("svg",{width:320,height:240,viewBox:"0 0 320 240"});s.appendChild(svg("ellipse",{cx:156,cy:118,rx:112,ry:78,fill:"none",stroke:"#3d452d","stroke-width":4}));s.appendChild(svg("path",{d:"M251 161 q-48 -44 -15 22 q21 15 15 -22 q47 -19 10 36 q-10 12 -10 -36 l-23 59 m23 -59 37 39",fill:"none",stroke:"#222","stroke-width":3}));e.appendChild(s);const flat=b.groups.flatMap(g=>Array.from({length:g.count},()=>g)),order=flat.length===9&&b.groups[0].count===1&&b.groups[1].count===5?[1,2,6,3,7,4,8,5,0]:flat.map((_,i)=>i);order.forEach((k,i)=>{const g=flat[k],a=renderBlock({...g,count:1,per_row:1,frame:null,icon_h:60,icon_w:60}),angle=-2.9+i*2*Math.PI/flat.length;Object.assign(a.style,{position:"absolute",left:(156+112*Math.cos(angle)-30)+"px",top:(118+78*Math.sin(angle)-30)+"px"});e.appendChild(a)});return e;});
 register("peacock28",b=>{const n=b.icon.count,s=svg("svg",{width:448,height:270,viewBox:"0 0 448 270","data-peacock-count":n});s.appendChild(svg("path",{d:"M64 174 Q-2 150 42 118 Q-2 78 67 66 Q70 26 129 44 Q174 4 211 38 Q264 8 296 42 Q366 16 378 58 Q444 54 414 104 Q466 140 414 164 Q418 218 354 208 Q316 252 271 216 Q218 244 185 216 Q112 244 101 202 Q40 218 64 174Z",fill:"#faffff",stroke:"#527f97","stroke-width":3}));const points=[[68,130],[108,170],[142,106],[194,40],[186,145],[266,102],[306,68],[334,142],[286,180]],colors=['#f25357','#209fe4','#8c46be','#ffe46e','#378fc9','#357cc7','#ff7e20','#ed95cc','#3cba98'];for(let i=0;i<n;i++){const [cx,cy]=points[i]||[74+(i%7)*46,48+Math.floor(i/7)*48];s.appendChild(svg("circle",{cx,cy,r:i<4?20:13,fill:colors[i%colors.length],stroke:"#44686b","stroke-width":2,"data-peacock-feather":i}))}s.appendChild(svg("path",{d:"M192 264 q-7 -73 19 -84 q-37 -66 8 -66 q41 5 10 68 q58 2 27 62 q-18 22 -64 20",fill:"#a2df9c"}));for(const x of [210,224]){s.appendChild(svg("circle",{cx:x,cy:142,r:6,fill:"white"}));s.appendChild(svg("circle",{cx:x+1,cy:143,r:2,fill:"#555"}))}s.appendChild(svg("polygon",{points:"211,153 229,153 219,164",fill:"#f3b64b"}));return s;});
 register("units_join28",b=>{const A=b.models[0],B=b.models[1],t=A.tens||0,o=A.ones||0,g=B.ones||0,pitch=46,w1=t*pitch+Math.ceil(o/5)*42+36,w2=Math.ceil(g/5)*42+44,w3=t*pitch+Math.ceil((o+g)/5)*42+38,W=w1+w2+w3+90,s=svg("svg",{width:W,height:244,viewBox:`0 0 ${W} 244`});const block=(group,x,y,col,cap=true)=>{group.appendChild(svg("rect",{x,y,width:20,height:18.5,fill:col,stroke:"#274a54","stroke-width":2,"data-join28-unit":1}));group.appendChild(svg("polygon",{points:`${x+20},${y} ${x+27},${y-5} ${x+27},${y+13} ${x+20},${y+18.5}`,fill:col,stroke:"#274a54","stroke-width":2}));if(cap)group.appendChild(svg("polygon",{points:`${x},${y} ${x+7},${y-5} ${x+27},${y-5} ${x+20},${y}`,fill:col,stroke:"#274a54","stroke-width":2}));};const draw=(left,w,tens,blue,green)=>{const group=svg("g",{"data-join28-value":tens*10+blue+green,transform:`translate(${left} 0)`});group.appendChild(svg("rect",{x:2,y:2,width:w-4,height:238,rx:24,fill:"white",stroke:"#ccc","stroke-width":5}));for(let i=0;i<tens;i++)for(let j=0;j<10;j++)block(group,26+i*pitch,26+j*18.5,'#7eb3df',j===0);const start=26+tens*pitch;for(let i=0;i<blue+green;i++){const col=Math.floor(i/5),row=4-i%5,c=i<blue?'#7eb3df':'#79b77d';block(group,start+col*42,26+row*42,c)} s.appendChild(group)};draw(0,w1,t,o,0);draw(w1+16,w2,0,0,g);draw(w1+w2+90,w3,t,o,g);s.appendChild(svg("path",{d:`M${w1+w2+31} 124 h30 v-12 l18 20 -18 20 v-12 h-30Z`,fill:"#72d5ad"}));if(W<=800)return s;const e=el("div"),scale=800/W;Object.assign(e.style,{width:"800px",height:(244*scale)+"px"});Object.assign(s.style,{transform:`scale(${scale})`,transformOrigin:"0 0"});e.appendChild(s);return e;});

 register("hand_marbles28",b=>{const n=b.icons.count,s=svg("svg",{width:136,height:230,viewBox:"0 0 136 230","data-hand-marbles":n});s.appendChild(svg("path",{d:"M47 230 L42 173 Q26 146 6 104 Q-4 84 7 84 Q17 86 38 117 L42 111 L43 8 Q44 -4 52 3 L62 96 L65 7 Q68 -6 75 3 L78 97 L89 18 Q94 8 100 18 L94 108 L117 48 Q124 39 129 49 L113 128 Q103 158 91 172 L94 230Z",fill:"#ff9567"}));const colors=['#58c7fb','#f487ba','#89c45e','#ffca4f'],points=[[59,99],[89,108],[53,135],[86,141]];for(let i=0;i<n;i++){const [cx,cy]=points[i]||[44+(i%3)*26,98+Math.floor(i/3)*28];s.appendChild(svg("circle",{cx,cy,r:14,fill:colors[i%4],stroke:colors[i%4],"stroke-width":3,"data-hand-marble":i}));s.appendChild(svg("circle",{cx:cx-3,cy:cy-3,r:8,fill:"white",opacity:.5}))}return s;});
 register("balloon_cluster28",b=>{const n=b.icons.count,s=svg("svg",{width:252,height:250,viewBox:"0 0 252 250","data-balloon-count":n}),source=[[[0,0],[80,0],[42,76]],[[0,30],[88,30]],[[0,0],[82,0],[170,0],[44,78],[126,78]]][b.layout];for(let i=0;i<n;i++){const [x,y]=source[i]||[(i%3)*74,Math.floor(i/3)*78],color=b.colors[i%b.colors.length];s.appendChild(svg("path",{d:`M${x+31} ${y+76} q-8 14 0 28 t0 28 t0 28`,fill:"none",stroke:"#bbb","stroke-width":1}));s.appendChild(svg("path",{d:`M${x+31} ${y} C${x-12} ${y+2} ${x-7} ${y+61} ${x+31} ${y+76} C${x+69} ${y+61} ${x+74} ${y+2} ${x+31} ${y} Z`,fill:color,"data-balloon-index":i}));s.appendChild(svg("path",{d:`M${x+27} ${y+77} l8 0 -4 -5 Z`,fill:color}));s.appendChild(svg("path",{d:`M${x+12} ${y+22} q3 -11 12 -14`,fill:"none",stroke:"#fff","stroke-width":3,"stroke-linecap":"round"}))}return s;});

 register("sloping_beads29",b=>{const n=b.shapes.items.length,W=n*44+20,H=Math.max(174,56+(n-1)*12),e=el("div");Object.assign(e.style,{position:"relative",width:W+"px",height:H+"px"});const s=svg("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`});s.appendChild(svg("path",{d:`M0 36 L${W-8} ${36+(n-1)*12}`,fill:"none",stroke:"#8a9a99","stroke-width":2}));e.appendChild(s);b.shapes.items.forEach((raw,i)=>{const a=renderBlock({...b.shapes,items:[raw],cols:1,boxed:false,size:40,gap:0,labels:null});Object.assign(a.style,{position:"absolute",left:(i*44)+"px",top:(16+i*12)+"px"});e.appendChild(a)});if(b.start){const t=el("div",null,"시작");Object.assign(t.style,{position:"absolute",left:"0",top:"-24px",fontSize:"24px",background:"#fff1bc",padding:"2px 8px",borderRadius:"4px"});e.appendChild(t)}return e;});
 register("joining_split29",b=>{const e=el("div");Object.assign(e.style,{position:"relative",width:"664px",height:"370px"});const [blue,white,green]=b.groups,parts=b.bond.parts.map(Number),s=svg("svg",{width:664,height:370,viewBox:"0 0 664 370"});for(const [x,y,w]of [[0,0,276],[298,0,366],[0,128,276],[298,128,366]])s.appendChild(svg("rect",{x:x+2,y:y+2,width:w-4,height:76,rx:16,fill:"#fff",stroke:"#ccc","stroke-width":4}));e.appendChild(s);const bar=(g,n,x,y)=>{const art=renderBlock({...g,count:n,per_row:n,icon_h:40,icon_w:30,gap:0});Object.assign(art.style,{position:"absolute",left:x+"px",top:y+"px"});e.appendChild(art)};bar(blue,blue.count,56,18);bar(white,white.count,322,18);bar(green,green.count,322+white.count*30,18);bar(blue,parts[0],28,146);bar(blue,parts[1],120,146);bar(blue,parts[1],322,146);bar(green,green.count,322+parts[1]*30,146);s.appendChild(svg("path",{d:"M252 100 Q224 112 188 134 M184 134 L202 122 M184 134 L204 136",fill:"none",stroke:"#ce19d9","stroke-width":4}));const ex=renderBlock({...b.expression,size:40,blank_width:64,blank_height:44,blank_bw:4});Object.assign(ex.style,{position:"absolute",left:"244px",top:"236px"});e.appendChild(ex);s.appendChild(svg("path",{d:"M264 298 L190 338 M264 298 L264 338 M190 338 L194 320 M190 338 L210 334 M264 338 L256 322 M264 338 L272 322",fill:"none",stroke:"#ce19d9","stroke-width":4}));b.bond.parts.forEach((p,i)=>{const t=el("div",null,inline(String(p)));Object.assign(t.style,{position:"absolute",left:(176+i*74)+"px",top:"332px",fontSize:"36px",background:i?"#ffb7db":"transparent",padding:"2px 10px",borderRadius:"50%"});e.appendChild(t)});return e;});

 register("scattered_base31",b=>{const m=b.model,t=m.tens||0,o=m.ones||0,s=svg("svg",{width:776,height:332,viewBox:"0 0 776 332","data-scattered31-tens":t,"data-scattered31-ones":o});s.appendChild(svg("rect",{x:3,y:3,width:770,height:326,rx:16,fill:"#fff",stroke:"#ccc","stroke-width":4}));const positions=[[36,86,-18],[444,48,6],[196,116,14],[514,144,30],[36,278,-25],[316,248,-4]],ones=[[140,166],[470,132],[680,154],[285,264]];const cube=(g,x,y,u,c)=>{g.appendChild(svg("rect",{x,y,width:u,height:u,fill:c,stroke:"#245777","stroke-width":1.6}));g.appendChild(svg("polygon",{points:`${x},${y} ${x+5},${y-5} ${x+u+5},${y-5} ${x+u},${y}`,fill:c,stroke:"#245777","stroke-width":1.6}));g.appendChild(svg("polygon",{points:`${x+u},${y} ${x+u+5},${y-5} ${x+u+5},${y+u-5} ${x+u},${y+u}`,fill:c,stroke:"#245777","stroke-width":1.6}));g.appendChild(svg("circle",{cx:x+u/2,cy:y+u/2,r:u*.23,fill:"none",stroke:"#245777","stroke-width":1.4}));};for(let i=0;i<t;i++){const [x,y,a]=positions[i]||[30+(i%3)*244,40+Math.floor(i/3)*75,0],g=svg("g",{transform:`translate(${x} ${y}) rotate(${a})`,"data-scattered31-bar":1});for(let j=0;j<10;j++)cube(g,j*23,0,23,m.color||"#5bbbe9");s.appendChild(g)}for(let i=0;i<o;i++){const [x,y]=ones[i]||[120+i*42,210],g=svg("g",{"data-scattered31-one":1});cube(g,x,y,24,m.color_ones||"#f16e6b");s.appendChild(g)}return s;});
})();
