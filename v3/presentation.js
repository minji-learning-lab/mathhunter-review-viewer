// Explicit presentation corrections. Source render JSON stays immutable.
window.applyVisualPresentation=async(root,contract,side,content,from)=>{
 for(const rule of contract?.visual_presentation||[]){
  if(side!==(rule.side||'q'))continue;
  if(rule.kind==='symbol_graph_raster'){
   const blocks=[];const walk=x=>{if(!x||typeof x!=='object')return;if(x.kind==='symbol_graph')blocks.push(x);Object.values(x).forEach(v=>{if(v&&typeof v==='object')walk(v);});};walk(content.body);
   const b=blocks[rule.index||0],graph=root.querySelectorAll('.r-symg')[rule.index||0];if(!b||!graph)throw Error('연결된 그래프 블록 없음');
   const image=await loadImg(from);if(!image||image.naturalWidth!==rule.source_width||image.naturalHeight!==rule.source_height)throw Error('그래프 원본 이미지 크기 불일치');
   const [x,y,w,h]=rule.crop,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.dataset.graphCounts=JSON.stringify(b.counts);const ctx=canvas.getContext('2d');ctx.drawImage(image,x,y,w,h,0,0,w,h);
   for(let i=0;i<rule.original_counts.length;i++)for(let j=0;j<rule.marker_x.length;j++){
    const [l,r]=[rule.columns[j],rule.columns[j+1]],[t,bottom]=[rule.rows[i],rule.rows[i+1]];ctx.fillStyle='#fff';ctx.fillRect(l+3-x,t+3-y,r-l-6,bottom-t-6);
    if(j<b.counts[i]){const own=j<rule.original_counts[i],sx=rule.marker_x[j],sy=own?rule.marker_y[i]:rule.marker_y[0];ctx.drawImage(image,sx,sy,rule.marker_size,rule.marker_size,sx-x,rule.marker_y[i]-y,rule.marker_size,rule.marker_size);}
   }
   graph.replaceChildren(canvas);Object.assign(graph.style,{width:w+'px',height:h+'px',transform:`translateY(${rule.offset_y||0}px)`});continue;
  }
  if(rule.kind!=='symbol_graph')throw Error('지원하지 않는 표현 보정');
  const graph=root.querySelectorAll('.r-symg')[rule.index||0];if(!graph)throw Error('보정할 그래프가 없습니다.');
  const table=graph.querySelector('table'),title=graph.querySelector('.r-graph-title'),p=rule;
  table.style.width=p.columns.reduce((a,b)=>a+b,0)+'px';table.style.tableLayout='fixed';table.style.background='#fff';table.style.border='2.5px solid #adadad';table.style.borderRadius='14px';table.style.clipPath='inset(0 round 14px)';
  graph.style.transform=`translateY(${p.offset_y||0}px)`;graph.style.fontSize=p.size+'px';graph.style.setProperty('--head',p.head);
  if(title)Object.assign(title.style,{fontSize:p.title_size+'px',lineHeight:'1.1',transform:'translateY(1px)',background:p.head,borderRadius:'8px',padding:'0 10px',height:'46px',display:'flex',alignItems:'center',width:'max-content',margin:'0 auto '+p.title_gap+'px'});
  [...table.rows].forEach((row,i)=>[...row.cells].forEach((cell,j)=>{cell.style.width=p.columns[j]+'px';cell.style.setProperty('min-width','0','important');cell.style.padding='0';cell.style.border='2.5px solid #adadad';cell.style.height=(i===table.rows.length-1?p.corner_h:p.cell_h)+'px';cell.style.fontSize=(i===table.rows.length-1?(p.axis_size||p.size):p.size)+'px';if(cell.tagName==='TD'){cell.style.background='#fff';cell.style.fontSize=(p.symbol_size||p.size)+'px';}}));
  const corner=table.querySelector('.r-symg-corner');if(corner){corner.style.setProperty('height',p.corner_h+'px','important');corner.style.fontSize=p.corner_size+'px';corner.style.setProperty('background',p.head,'important');const a=corner.querySelector('.tr'),b=corner.querySelector('.bl');Object.assign(a.style,{left:'8px',right:'auto',top:'2px'});Object.assign(b.style,{left:'auto',right:'4px',bottom:'1px'});const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${p.columns[0]} ${p.corner_h}`);Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',`M0 ${p.corner_h} L38 34 L104 34 L${p.columns[0]} 0`);line.setAttribute('fill','none');line.setAttribute('stroke','#adadad');line.setAttribute('stroke-width','2.5');svg.append(line);corner.prepend(svg);}
 }
};
