/* Stage 34B: browser-compatible ES module version of diagram editor popup helpers.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */
'use strict';

function createApi(deps){
    deps = deps || {};
    const closeFigureModal = typeof deps.closeFigureModal === 'function' ? deps.closeFigureModal : function(){};

    function openSimpleDiagramEditor(){
      const popup = window.open('', '_blank', 'width=1200,height=860');
      if(!popup){
        alert('Popup blocked. Please allow popups for this page.');
        return;
      }
      const editorHtml = `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Simple diagram editor</title>
    <style>
      :root{--bg:#0f1630;--panel:#121933;--text:#eef3ff;--line:rgba(255,255,255,.12);--sel:#2563eb;--sel2:#93c5fd}
      *{box-sizing:border-box}
      html,body{margin:0;height:100%;font-family:Inter,Arial,sans-serif;background:#f5f7fb}
      body{display:grid;grid-template-rows:auto 1fr}
      .bar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;padding:.9rem;background:#111827;color:#fff}
      .bar button,.bar select{font:inherit;padding:.55rem .75rem;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;cursor:pointer}
      .bar input[type="text"]{font:inherit;padding:.55rem .75rem;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#fff;color:#111;min-width:180px}
      .canvas-wrap{padding:1rem;height:100%}
      svg{width:100%;height:100%;display:block;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:18px;touch-action:none}
      .hint{margin-left:auto;opacity:.8;font-size:.92rem}
      [data-selected="1"]{stroke:var(--sel) !important;stroke-dasharray:8 6 !important}
      text[data-selected="1"]{fill:#0b57d0 !important;paint-order:stroke;stroke:var(--sel2) !important;stroke-width:2 !important}
    </style>
    </head>
    <body>
    <div class="bar">
      <select id="tool">
        <option value="select">Select / move</option>
        <option value="pen">Pen</option>
        <option value="erase">Erase</option>
        <option value="line">Line / arrow</option>
        <option value="rect">Rectangle</option>
        <option value="ellipse">Ellipse</option>
        <option value="text">Text</option>
      </select>
      <select id="pointerSource">
        <option value="any" selected>Any pointer</option>
        <option value="pen">Stylus only</option>
        <option value="touch">Finger only</option>
        <option value="mouse">Mouse only</option>
      </select>
      <input id="textInput" type="text" placeholder="Text for text tool" value="Label" />
      <label style="display:flex;align-items:center;gap:.35rem">Color <input id="drawColor" type="color" value="#111111" style="padding:0;width:44px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#fff;cursor:pointer" /></label>
      <button id="undoBtn">Undo</button>
      <button id="deleteBtn">Delete selected</button>
      <button id="clearBtn">Clear</button>
      <button id="insertBtn">Insert into slide</button>
      <span class="hint">Supports mouse, trackpad, finger, and Apple Pencil / stylus.</span>
    </div>
    <div class="canvas-wrap">
      <svg id="svg" viewBox="0 0 1000 700"></svg>
    </div>
    <script>
    const svg = document.getElementById('svg');
    const toolEl = document.getElementById('tool');
    const pointerSourceEl = document.getElementById('pointerSource');
    const textInput = document.getElementById('textInput');
    const drawColorInput = document.getElementById('drawColor');
    let drawing = null;
    let selected = null;
    let dragOffset = null;
    const made = [];
    
    function pt(evt){
      const r = svg.getBoundingClientRect();
      const x = (evt.clientX - r.left) * 1000 / r.width;
      const y = (evt.clientY - r.top) * 700 / r.height;
      return {x,y};
    }
    function allowedPointer(evt){
      const pref = pointerSourceEl.value;
      if(pref === 'any') return true;
      const type = evt.pointerType || 'mouse';
      return type === pref;
    }
    function currentDrawColor(){
      return (drawColorInput && drawColorInput.value) ? drawColorInput.value : '#111111';
    }
    function applyColorToSelected(){
      if(!selected) return;
      const tag = selected.tagName.toLowerCase();
      const color = currentDrawColor();
      if(tag === 'text') selected.setAttribute('fill', color);
      else selected.setAttribute('stroke', color);
    }
    function baseStyle(el, evt){
      const pressure = evt && typeof evt.pressure === 'number' && evt.pressure > 0 ? evt.pressure : 0.5;
      const width = evt && evt.pointerType === 'pen' ? (2 + pressure * 4).toFixed(2) : '3';
      el.setAttribute('stroke', currentDrawColor());
      el.setAttribute('stroke-width', width);
      el.setAttribute('fill', 'transparent');
      el.style.vectorEffect = 'non-scaling-stroke';
      const tag = (el.tagName || '').toLowerCase();
      if(tag === 'line' || tag === 'polyline') el.setAttribute('pointer-events', 'visibleStroke');
      else el.setAttribute('pointer-events', 'all');
    }
    function hitTarget(target){
      if(!target || target === svg) return null;
      return target.closest('rect,ellipse,line,polyline,text');
    }
    function add(el, shouldSelect){
      svg.appendChild(el);
      made.push(el);
      if(shouldSelect) selectElement(el);
    }
    function clearSelection(){
      if(selected) selected.removeAttribute('data-selected');
      selected = null;
    }
    function selectElement(el){
      clearSelection();
      if(el && el !== svg){
        selected = el;
        selected.setAttribute('data-selected', '1');
      }
    }
    function removeEl(el){
      if(!el || el === svg) return;
      if(selected === el) clearSelection();
      const idx = made.indexOf(el);
      if(idx >= 0) made.splice(idx, 1);
      el.remove();
    }
    function moveSelected(dx, dy){
      if(!selected) return;
      const tag = selected.tagName.toLowerCase();
      if(tag === 'rect'){
        selected.setAttribute('x', parseFloat(selected.getAttribute('x')) + dx);
        selected.setAttribute('y', parseFloat(selected.getAttribute('y')) + dy);
      } else if(tag === 'ellipse'){
        selected.setAttribute('cx', parseFloat(selected.getAttribute('cx')) + dx);
        selected.setAttribute('cy', parseFloat(selected.getAttribute('cy')) + dy);
      } else if(tag === 'line'){
        ['x1','x2'].forEach(k=>selected.setAttribute(k, parseFloat(selected.getAttribute(k)) + dx));
        ['y1','y2'].forEach(k=>selected.setAttribute(k, parseFloat(selected.getAttribute(k)) + dy));
      } else if(tag === 'polyline'){
        const pts = selected.getAttribute('points').trim().split(/\s+/).filter(Boolean).map(pair=>pair.split(',').map(Number));
        selected.setAttribute('points', pts.map(([x,y]) => (x+dx)+','+(y+dy)).join(' '));
      } else if(tag === 'text'){
        selected.setAttribute('x', parseFloat(selected.getAttribute('x')) + dx);
        selected.setAttribute('y', parseFloat(selected.getAttribute('y')) + dy);
      }
    }
    
    svg.addEventListener('pointerdown', (evt)=>{
      if(!allowedPointer(evt)) return;
      const tool = toolEl.value;
      const p = pt(evt);
    
      if(tool === 'select'){
        const hit = hitTarget(evt.target);
        if(hit){
          selectElement(hit);
          dragOffset = {x:p.x, y:p.y};
        } else {
          clearSelection();
        }
        svg.setPointerCapture(evt.pointerId);
        return;
      }
    
      if(tool === 'erase'){
        const hit = hitTarget(evt.target);
        if(hit){
          removeEl(hit);
        }
        svg.setPointerCapture(evt.pointerId);
        return;
      }
    
      clearSelection();
    
      if(tool === 'pen'){
        const poly = document.createElementNS('http://www.w3.org/2000/svg','polyline');
        baseStyle(poly, evt);
        poly.setAttribute('points', p.x + ',' + p.y);
        drawing = {tool, el: poly};
        add(poly, false);
      } else if(tool === 'line'){
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        baseStyle(line, evt);
        line.setAttribute('x1', p.x); line.setAttribute('y1', p.y); line.setAttribute('x2', p.x); line.setAttribute('y2', p.y);
        drawing = {tool, el: line, start: p};
        add(line, false);
      } else if(tool === 'rect'){
        const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
        baseStyle(rect, evt);
        rect.setAttribute('x', p.x); rect.setAttribute('y', p.y); rect.setAttribute('width', 1); rect.setAttribute('height', 1);
        drawing = {tool, el: rect, start: p};
        add(rect, false);
      } else if(tool === 'ellipse'){
        const e = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
        baseStyle(e, evt);
        e.setAttribute('cx', p.x); e.setAttribute('cy', p.y); e.setAttribute('rx', 1); e.setAttribute('ry', 1);
        drawing = {tool, el: e, start: p};
        add(e, false);
      } else if(tool === 'text'){
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x', p.x);
        t.setAttribute('y', p.y);
        t.setAttribute('fill', currentDrawColor());
        t.setAttribute('font-size', '28');
        t.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
        t.setAttribute('pointer-events', 'all');
        t.textContent = textInput.value || 'Text';
        add(t, false);
      }
      svg.setPointerCapture(evt.pointerId);
    });
    
    svg.addEventListener('pointermove', (evt)=>{
      if(!allowedPointer(evt)) return;
      const p = pt(evt);
    
      if(toolEl.value === 'erase' && (evt.buttons & 1)){
        const hit = hitTarget(evt.target);
        if(hit) removeEl(hit);
        return;
      }
    
      if(selected && dragOffset && toolEl.value === 'select'){
        const dx = p.x - dragOffset.x, dy = p.y - dragOffset.y;
        dragOffset = p;
        moveSelected(dx, dy);
        return;
      }
    
      if(!drawing) return;
      if(drawing.tool === 'pen'){
        const pts = drawing.el.getAttribute('points');
        drawing.el.setAttribute('points', pts + ' ' + p.x + ',' + p.y);
      } else if(drawing.tool === 'line'){
        drawing.el.setAttribute('x2', p.x); drawing.el.setAttribute('y2', p.y);
      } else if(drawing.tool === 'rect'){
        const x = Math.min(drawing.start.x, p.x), y = Math.min(drawing.start.y, p.y);
        const w = Math.abs(p.x - drawing.start.x), h = Math.abs(p.y - drawing.start.y);
        drawing.el.setAttribute('x', x); drawing.el.setAttribute('y', y); drawing.el.setAttribute('width', w); drawing.el.setAttribute('height', h);
      } else if(drawing.tool === 'ellipse'){
        drawing.el.setAttribute('cx', (drawing.start.x + p.x) / 2);
        drawing.el.setAttribute('cy', (drawing.start.y + p.y) / 2);
        drawing.el.setAttribute('rx', Math.abs(p.x - drawing.start.x) / 2);
        drawing.el.setAttribute('ry', Math.abs(p.y - drawing.start.y) / 2);
      }
    });
    function stopInteraction(){
      drawing = null;
      dragOffset = null;
      if(toolEl.value !== 'select') clearSelection();
    }
    svg.addEventListener('pointerup', stopInteraction);
    svg.addEventListener('pointercancel', stopInteraction);
    
    document.getElementById('undoBtn').addEventListener('click', ()=>{
      const el = made.pop();
      if(el){
        if(selected === el) clearSelection();
        el.remove();
      }
    });
    document.getElementById('deleteBtn').addEventListener('click', ()=> removeEl(selected));
    document.getElementById('clearBtn').addEventListener('click', ()=>{
      while(svg.firstChild) svg.removeChild(svg.firstChild);
      made.length = 0;
      clearSelection();
    });
    if(drawColorInput) drawColorInput.addEventListener('input', applyColorToSelected);
    function trimmedSvgMarkup(){
      clearSelection();
      const clone = svg.cloneNode(true);
      Array.from(clone.querySelectorAll('[data-selected]')).forEach(el=>el.removeAttribute('data-selected'));
      const elems = made.filter(el => el && el.ownerSVGElement === svg);
      if(!elems.length) return clone.outerHTML;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      elems.forEach(el=>{
        try{
          const bb = el.getBBox();
          const sw = parseFloat(el.getAttribute('stroke-width') || 0) || 0;
          minX = Math.min(minX, bb.x - sw);
          minY = Math.min(minY, bb.y - sw);
          maxX = Math.max(maxX, bb.x + bb.width + sw);
          maxY = Math.max(maxY, bb.y + bb.height + sw);
        }catch(e){}
      });
      if(!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return clone.outerHTML;
      const pad = 18;
      const vbX = Math.max(0, minX - pad);
      const vbY = Math.max(0, minY - pad);
      const vbW = Math.max(40, (maxX - minX) + 2 * pad);
      const vbH = Math.max(40, (maxY - minY) + 2 * pad);
      clone.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
      clone.setAttribute('width', vbW);
      clone.setAttribute('height', vbH);
      clone.removeAttribute('style');
      return clone.outerHTML;
    }
    document.getElementById('insertBtn').addEventListener('click', ()=>{
      const svgMarkup = trimmedSvgMarkup();
      if(window.opener && !window.opener.closed && typeof window.opener.insertFigureHtmlFromEditor === 'function'){
        window.opener.insertFigureHtmlFromEditor('<figure>' + svgMarkup + '</figure>');
        window.close();
      } else {
        alert('Could not send the diagram back to the generator.');
      }
    });
    window.addEventListener('keydown', (evt)=>{
      if((evt.key === 'Delete' || evt.key === 'Backspace') && selected){
        evt.preventDefault();
        removeEl(selected);
      }
    });
    <\/script>
    </body>
    </html>`;
      popup.document.open();
      popup.document.write(editorHtml);
      popup.document.close();
      closeFigureModal();
    }

    return { openSimpleDiagramEditor };
  }

export { createApi };
export default { createApi };
