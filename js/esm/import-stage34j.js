/* Stage 34J: browser-compatible ES module version of import/parsing helpers. */

function compactStrings(values){
  var out = [];
  var arr = values || [];
  for(var i = 0; i < arr.length; i += 1){
    var v = String(arr[i] || '').trim();
    if(v) out.push(v);
  }
  return out;
}

export function createApi(deps){
  deps = deps || {};
  var normalizeSlide = deps.normalizeSlide;
  var escapeAttr = deps.escapeAttr;
  var buildImageFigureHtml = deps.buildImageFigureHtml;
  if(typeof normalizeSlide !== 'function') throw new Error('LuminaImport requires normalizeSlide.');
  if(typeof escapeAttr !== 'function') throw new Error('LuminaImport requires escapeAttr.');
  if(typeof buildImageFigureHtml !== 'function') throw new Error('LuminaImport requires buildImageFigureHtml.');

  function buildImportedContent(paragraphs, bullets, ordered){
    var parts = [];
    var paras = compactStrings(paragraphs);
    var ul = compactStrings(bullets);
    var ol = compactStrings(ordered);
    for(var i = 0; i < paras.length; i += 1) parts.push('P: ' + paras[i]);
    if(ul.length){
      parts.push('\\begin{itemize}');
      for(var j = 0; j < ul.length; j += 1) parts.push('\\item ' + ul[j]);
      parts.push('\\end{itemize}');
    }
    if(ol.length){
      parts.push('\\begin{enumerate}');
      for(var k = 0; k < ol.length; k += 1) parts.push('\\item ' + ol[k]);
      parts.push('\\end{enumerate}');
    }
    return parts.join('\n');
  }

  function makeImportedSlide(title, paragraphs, bullets, ordered){
    paragraphs = paragraphs || [];
    bullets = bullets || [];
    ordered = ordered || [];
    var content = buildImportedContent(paragraphs, bullets, ordered);
    return normalizeSlide({
      slideType:'single',
      headingLevel:'h2',
      bgColor:'#ffffff',
      fontColor:'#111111',
      title: String(title || 'Imported slide').trim() || 'Imported slide',
      kicker:'',
      lede:'',
      leftBlocks: content ? [{ mode:'panel', title:'', content: content }] : [],
      rightBlocks: [],
      notesTitle:'Speaker notes',
      notesBody:''
    });
  }

  function makeReferenceImageSlide(src, name){
    var fig = '\\begin{figurehtml}\n' + buildImageFigureHtml(src, name || 'Imported image') + '\n\\end{figurehtml}';
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
    var pdfHtml = '<div style="width:100%;height:100%;min-height:680px;background:#fff"><iframe src="' + escapeAttr(dataUrl) + '" style="width:100%;height:680px;border:0;background:#fff"></iframe></div>';
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

  function parseMarkdownToSlides(raw){
    var text = String(raw || '').replace(/\r\n/g,'\n');
    var lines = text.split('\n');
    var slidesOut = [];
    var current = null;
    function flush(){
      if(!current) return;
      slidesOut.push(makeImportedSlide(current.title, current.paragraphs, current.bullets, current.ordered));
      current = null;
    }
    function ensure(title){
      if(!current) current = { title: title || 'Imported slide', paragraphs:[], bullets:[], ordered:[] };
    }
    for(var i = 0; i < lines.length; i += 1){
      var line = lines[i].trim();
      if(!line) continue;
      var h = line.match(/^#{1,2}\s+(.+)$/);
      if(h){
        flush();
        current = { title: h[1].trim(), paragraphs:[], bullets:[], ordered:[] };
        continue;
      }
      if(/^---+$/.test(line)){ flush(); continue; }
      ensure();
      var bullet = line.match(/^[-*+]\s+(.+)$/);
      var ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if(bullet) current.bullets.push(bullet[1].trim());
      else if(ordered) current.ordered.push(ordered[1].trim());
      else current.paragraphs.push(line);
    }
    flush();
    return slidesOut;
  }

  function parseBeamerToSlides(raw){
    var text = String(raw || '');
    var slidesOut = [];
    var frameRe = /\\begin\{frame\}(?:\[[^\]]*\])?(?:\{([^}]*)\})?([\s\S]*?)\\end\{frame\}/g;
    var m;
    while((m = frameRe.exec(text))){
      var body = String(m[2] || '').trim();
      var titleMatch = body.match(/\\frametitle\{([^}]*)\}/);
      var kickerMatch = body.match(/\\framesubtitle\{([^}]*)\}/);
      var title = (m[1] || (titleMatch && titleMatch[1]) || 'Imported frame').trim();
      var cleaned = body
        .replace(/\\frametitle\{[^}]*\}/g,'')
        .replace(/\\framesubtitle\{[^}]*\}/g,'')
        .trim();
      slidesOut.push(normalizeSlide({
        slideType:'single',
        headingLevel:'h2',
        bgColor:'#ffffff',
        fontColor:'#111111',
        title:title,
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
    var title = item.title || item.heading || item.name || 'Imported slide';
    var paragraphs = Array.isArray(item.paragraphs) ? item.paragraphs : (item.text ? [item.text] : []);
    var bullets = Array.isArray(item.bullets) ? item.bullets : [];
    var ordered = Array.isArray(item.ordered) ? item.ordered : [];
    return makeImportedSlide(title, paragraphs, bullets, ordered);
  }

  function parseJsonOutlineToSlides(raw){
    var data = JSON.parse(String(raw || ''));
    if(data && Array.isArray(data.slides)){
      return data.slides.map(normalizeSlide);
    }
    if(Array.isArray(data)){
      return data.map(jsonItemToSlide).filter(Boolean);
    }
    if(data && Array.isArray(data.sections)){
      var out = [];
      data.sections.forEach(function(sec){
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
        var slides = (sec && Array.isArray(sec.slides)) ? sec.slides : [];
        slides.forEach(function(sl){ var s = jsonItemToSlide(sl); if(s) out.push(s); });
      });
      return out;
    }
    if(data && typeof data === 'object'){
      var s = jsonItemToSlide(data);
      return s ? [s] : [];
    }
    return [];
  }

  function parsePowerPointTextToSlides(raw){
    var text = String(raw || '').replace(/\r\n/g,'\n').trim();
    if(!text) return [];
    var blocks = text.split(/\n\s*\n+/);
    var out = [];
    blocks.forEach(function(block){
      var lines = compactStrings(block.split('\n'));
      if(!lines.length) return;
      var title = lines[0];
      var bullets = [];
      var paragraphs = [];
      lines.slice(1).forEach(function(line){
        var bullet = line.match(/^[-*+]\s+(.+)$/);
        var ordered = line.match(/^\d+[.)]\s+(.+)$/);
        if(bullet) bullets.push(bullet[1].trim());
        else if(ordered) bullets.push(ordered[1].trim());
        else paragraphs.push(line);
      });
      out.push(makeImportedSlide(title, paragraphs, bullets, []));
    });
    return out;
  }

  return {
    buildImportedContent: buildImportedContent,
    makeImportedSlide: makeImportedSlide,
    makeReferenceImageSlide: makeReferenceImageSlide,
    makeReferencePdfSlide: makeReferencePdfSlide,
    parseMarkdownToSlides: parseMarkdownToSlides,
    parseBeamerToSlides: parseBeamerToSlides,
    jsonItemToSlide: jsonItemToSlide,
    parseJsonOutlineToSlides: parseJsonOutlineToSlides,
    parsePowerPointTextToSlides: parsePowerPointTextToSlides
  };
}

export default Object.freeze({ createApi: createApi });
