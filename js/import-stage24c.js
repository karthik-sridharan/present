/* Stage 9 import helpers.
   Classic browser script; exposes window.LuminaImport.
   Keeps file/import parsing separate from the legacy editor runtime.
*/
(function(global){
  function createApi(deps){
    deps = deps || {};
    const normalizeSlide = deps.normalizeSlide;
    const escapeAttr = deps.escapeAttr;
    const buildImageFigureHtml = deps.buildImageFigureHtml;
    if(typeof normalizeSlide !== 'function') throw new Error('LuminaImport requires normalizeSlide.');
    if(typeof escapeAttr !== 'function') throw new Error('LuminaImport requires escapeAttr.');
    if(typeof buildImageFigureHtml !== 'function') throw new Error('LuminaImport requires buildImageFigureHtml.');

function buildImportedContent(paragraphs=[], bullets=[], ordered=[]){
  const parts = [];
  (paragraphs || []).map(x=>String(x||'').trim()).filter(Boolean).forEach(p=>parts.push('P: ' + p));
  const ul = (bullets || []).map(x=>String(x||'').trim()).filter(Boolean);
  if(ul.length){
    parts.push('\\begin{itemize}');
    ul.forEach(b=>parts.push('\\item ' + b));
    parts.push('\\end{itemize}');
  }
  const ol = (ordered || []).map(x=>String(x||'').trim()).filter(Boolean);
  if(ol.length){
    parts.push('\\begin{enumerate}');
    ol.forEach(b=>parts.push('\\item ' + b));
    parts.push('\\end{enumerate}');
  }
  return parts.join('\n');
}
function makeImportedSlide(title, paragraphs=[], bullets=[], ordered=[]){
  const content = buildImportedContent(paragraphs, bullets, ordered);
  return normalizeSlide({
    slideType:'single',
    headingLevel:'h2',
    bgColor:'#ffffff',
    fontColor:'#111111',
    title: String(title || 'Imported slide').trim() || 'Imported slide',
    kicker:'',
    lede:'',
    leftBlocks: content ? [{ mode:'panel', title:'', content }] : [],
    rightBlocks: [],
    notesTitle:'Speaker notes',
    notesBody:''
  });
}
function makeReferenceImageSlide(src, name){
  const fig = '\\begin{figurehtml}\n' + buildImageFigureHtml(src, name || 'Imported image') + '\n\\end{figurehtml}';
  return normalizeSlide({
    slideType:'full-width-figure-caption',
    headingLevel:'h2',
    bgColor:'#ffffff',
    fontColor:'#111111',
    title: String(name || 'Imported image'),
    kicker:'Reference asset',
    lede:'',
    leftBlocks:[{ mode:'panel', title:'', content: fig }, { mode:'panel', title:'', content:'P: Imported reference image' }],
    rightBlocks:[],
    notesTitle:'Speaker notes',
    notesBody:''
  });
}
function makeReferencePdfSlide(dataUrl, name){
  const pdfHtml = '<div style="width:100%;height:100%;min-height:680px;background:#fff"><iframe src="' + escapeAttr(dataUrl) + '" style="width:100%;height:680px;border:0;background:#fff"></iframe></div>';
  return normalizeSlide({
    slideType:'single',
    headingLevel:'h2',
    bgColor:'#ffffff',
    fontColor:'#111111',
    title: String(name || 'Imported PDF'),
    kicker:'Reference asset',
    lede:'',
    leftBlocks:[{ mode:'custom', title:'', content: pdfHtml }],
    rightBlocks:[],
    notesTitle:'Speaker notes',
    notesBody:''
  });
}
function applyImportedSlides(importedSlides, opts={}){
  const incoming = (importedSlides || []).map(normalizeSlide).filter(Boolean);
  if(!incoming.length) throw new Error('No slides were imported.');
  syncPreviewFiguresToDraft(false);
  saveCurrentBlockToDraft();
  saveCurrentSlideToDeck();
  const mode = opts.mode === 'replace' ? 'replace' : 'append';
  if(mode === 'replace'){
    slides = incoming;
    activeIndex = 0;
    if(opts.deckTitle) fields.deckTitle.value = opts.deckTitle;
  } else {
    const base = slides.length ? clone(slides) : [];
    slides = base.concat(incoming);
    activeIndex = base.length;
    if(opts.deckTitle && !fields.deckTitle.value) fields.deckTitle.value = opts.deckTitle;
  }
  applySlideToForm(slides[activeIndex]);
  renderDeckList();
  buildPreview();
  scheduleAutosave('Autosaved after import.');
  showToast('Imported ' + incoming.length + ' slide' + (incoming.length === 1 ? '' : 's') + '.');
}
function parseMarkdownToSlides(raw){
  const text = String(raw || '').replace(/\r\n/g,'\n');
  const lines = text.split('\n');
  const slidesOut = [];
  let current = null;
  function flush(){
    if(!current) return;
    slidesOut.push(makeImportedSlide(current.title, current.paragraphs, current.bullets, current.ordered));
    current = null;
  }
  function ensure(title='Imported slide'){
    if(!current) current = { title, paragraphs:[], bullets:[], ordered:[] };
  }
  for(const lineRaw of lines){
    const line = lineRaw.trim();
    if(!line) continue;
    const h = line.match(/^#{1,2}\s+(.+)$/);
    if(h){
      flush();
      current = { title: h[1].trim(), paragraphs:[], bullets:[], ordered:[] };
      continue;
    }
    if(/^---+$/.test(line)){ flush(); continue; }
    ensure();
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if(bullet) current.bullets.push(bullet[1].trim());
    else if(ordered) current.ordered.push(ordered[1].trim());
    else current.paragraphs.push(line);
  }
  flush();
  return slidesOut;
}
function parseBeamerToSlides(raw){
  const text = String(raw || '');
  const slidesOut = [];
  const frameRe = /\\begin\{frame\}(?:\[[^\]]*\])?(?:\{([^}]*)\})?([\s\S]*?)\\end\{frame\}/g;
  let m;
  while((m = frameRe.exec(text))){
    const body = String(m[2] || '').trim();
    const titleMatch = body.match(/\\frametitle\{([^}]*)\}/);
    const kickerMatch = body.match(/\\framesubtitle\{([^}]*)\}/);
    const title = (m[1] || (titleMatch && titleMatch[1]) || 'Imported frame').trim();
    const cleaned = body
      .replace(/\\frametitle\{[^}]*\}/g,'')
      .replace(/\\framesubtitle\{[^}]*\}/g,'')
      .trim();
    slidesOut.push(normalizeSlide({
      slideType:'single',
      headingLevel:'h2',
      bgColor:'#ffffff',
      fontColor:'#111111',
      title,
      kicker: kickerMatch ? kickerMatch[1].trim() : '',
      lede:'',
      leftBlocks: cleaned ? [{ mode:'panel', title:'', content: cleaned }] : [],
      rightBlocks:[],
      notesTitle:'Speaker notes',
      notesBody:''
    }));
  }
  if(slidesOut.length) return slidesOut;
  return parseMarkdownToSlides(text
    .replace(/\\section\{([^}]*)\}/g, '# $1\n')
    .replace(/\\subsection\{([^}]*)\}/g, '## $1\n')
    .replace(/\\item\s+/g, '- ')
    .replace(/\\begin\{itemize\}|\\end\{itemize\}|\\begin\{enumerate\}|\\end\{enumerate\}/g,''));
}
function jsonItemToSlide(item){
  if(typeof item === 'string') return makeImportedSlide(item, [], []);
  if(!item || typeof item !== 'object') return null;
  if(Array.isArray(item.slides)) return null;
  if(item.leftBlocks || item.rightBlocks || item.slideType) return normalizeSlide(item);
  const title = item.title || item.heading || item.name || 'Imported slide';
  const paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs : (item.text ? [item.text] : []);
  const bullets = Array.isArray(item.bullets) ? item.bullets : [];
  const ordered = Array.isArray(item.ordered) ? item.ordered : [];
  return makeImportedSlide(title, paragraphs, bullets, ordered);
}
function parseJsonOutlineToSlides(raw){
  const data = JSON.parse(String(raw || ''));
  if(data && Array.isArray(data.slides)){
    return data.slides.map(normalizeSlide);
  }
  if(Array.isArray(data)){
    return data.map(jsonItemToSlide).filter(Boolean);
  }
  if(data && Array.isArray(data.sections)){
    const out = [];
    data.sections.forEach(sec=>{
      if(sec && sec.title){
        out.push(normalizeSlide({
          slideType:'section-divider',
          headingLevel:'h2',
          bgColor:'#ffffff',
          fontColor:'#111111',
          title: sec.title,
          kicker: sec.kicker || 'Section',
          lede: sec.lede || '',
          leftBlocks:[],
          rightBlocks:[]
        }));
      }
      (Array.isArray(sec?.slides) ? sec.slides : []).forEach(sl=>{ const s = jsonItemToSlide(sl); if(s) out.push(s); });
    });
    return out;
  }
  if(data && typeof data === 'object'){
    const s = jsonItemToSlide(data);
    return s ? [s] : [];
  }
  return [];
}
function parsePowerPointTextToSlides(raw){
  const text = String(raw || '').replace(/\r\n/g,'\n').trim();
  if(!text) return [];
  const blocks = text.split(/\n\s*\n+/);
  const out = [];
  blocks.forEach(block=>{
    const lines = block.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!lines.length) return;
    const title = lines[0];
    const bullets = [];
    const paragraphs = [];
    lines.slice(1).forEach(line=>{
      const bullet = line.match(/^[-*+]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if(bullet) bullets.push(bullet[1].trim());
      else if(ordered) bullets.push(ordered[1].trim());
      else paragraphs.push(line);
    });
    out.push(makeImportedSlide(title, paragraphs, bullets, []));
  });
  return out;
}

    return {
      buildImportedContent,
      makeImportedSlide,
      makeReferenceImageSlide,
      makeReferencePdfSlide,
      parseMarkdownToSlides,
      parseBeamerToSlides,
      jsonItemToSlide,
      parseJsonOutlineToSlides,
      parsePowerPointTextToSlides
    };
  }

  global.LuminaImport = { createApi };
})(window);
