/* Stage 41D: browser-compatible ES module renderer helpers.
   Adds freeform import rendering for high-fidelity PDF/PPT/PPTX imports. */

function required(deps, name){
  var value = deps && deps[name];
  if(typeof value !== 'function') throw new Error('LuminaRenderer ESM missing dependency: ' + name);
  return value;
}

export function createApi(deps){
  deps = deps || {};
  var escapeAttr = required(deps, 'escapeAttr');
  var escapeHtml = required(deps, 'escapeHtml');
  var preserveMathTokens = required(deps, 'preserveMathTokens');
  var restoreMathTokens = required(deps, 'restoreMathTokens');
  var parseStructuredText = required(deps, 'parseStructuredText');
  var normalizeBlockStyle = required(deps, 'normalizeBlockStyle');
  var normalizeAnimation = required(deps, 'normalizeAnimation');
  var animationDataAttrs = required(deps, 'animationDataAttrs');
  var blockWrapperStyle = required(deps, 'blockWrapperStyle');
  var titleWrapperStyle = required(deps, 'titleWrapperStyle');
  var currentStyleClass = required(deps, 'currentStyleClass');
  var buildSlideStyle = required(deps, 'buildSlideStyle');
  var clone = deps.clone || function(value){ return JSON.parse(JSON.stringify(value == null ? {} : value)); };
  var expandDiagramSnippetChecked = deps.expandDiagramSnippetChecked || function(){ return false; };

  function diagramMarkup(){
    return '<div class="diag"><svg class="diagram" viewBox="0 0 760 430" role="img" aria-label="Tiny neural network diagram placeholder"><line x1="145" y1="145" x2="355" y2="125" class="edge"/><line x1="145" y1="145" x2="355" y2="295" class="edge"/><line x1="145" y1="285" x2="355" y2="125" class="edge"/><line x1="145" y1="285" x2="355" y2="295" class="edge"/><line x1="405" y1="125" x2="615" y2="215" class="edge"/><line x1="405" y1="295" x2="615" y2="215" class="edge"/><circle cx="115" cy="145" r="34" class="node"/><circle cx="115" cy="285" r="34" class="node"/><circle cx="375" cy="125" r="34" class="node"/><circle cx="375" cy="295" r="34" class="node"/><circle cx="645" cy="215" r="34" class="node"/><text x="88" y="153" class="label">x₁</text><text x="88" y="293" class="label">x₂</text><text x="350" y="133" class="label">h₁</text><text x="350" y="303" class="label">h₂</text><text x="632" y="223" class="label">ŷ</text></svg></div>';
  }
  function customFrameMarkup(raw){
    var html = String(raw || '').trim();
    if(!html) return '<div class="placeholder">Paste custom HTML here.</div>';
    return '<div class="custom-frame-wrap"><iframe class="custom-frame" sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads" referrerpolicy="no-referrer" srcdoc="' + escapeAttr(html) + '"></iframe></div>';
  }
  function diagramStandaloneDocument(innerHtml){
    var body = String(innerHtml || '').trim() || diagramMarkup();
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}*{box-sizing:border-box}.diag{display:grid;place-items:center;padding:.9rem}.diagram{width:100%;max-width:680px;height:auto}.diagram .edge{stroke:currentColor;stroke-opacity:.32;stroke-width:6;stroke-linecap:round}.diagram .node{fill:none;stroke:currentColor;stroke-width:6}.diagram .label{fill:currentColor;font:700 28px Inter,system-ui,sans-serif}</style></head><body>' + body + '</body></html>';
  }
  function expandDiagramBlocksForSnippet(slide){
    var s = normalizeSlide(slide);
    function convert(block){
      if((block.mode || 'panel') !== 'diagram') return clone(block);
      return {
        mode: 'custom',
        title: block.title || '',
        content: diagramStandaloneDocument(block.content || diagramMarkup()),
        style: normalizeBlockStyle(block.style),
        animation: normalizeAnimation(block.animation)
      };
    }
    s.leftBlocks = (s.leftBlocks || []).map(convert);
    s.rightBlocks = (s.rightBlocks || []).map(convert);
    return s;
  }
  function slideForSnippet(slide){
    return expandDiagramSnippetChecked() ? expandDiagramBlocksForSnippet(slide) : normalizeSlide(slide);
  }
  function safeNum(value, fallback){
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function decodeLiteralNewlines(value){
    return String(value || '')
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t(?![A-Za-z{])/g, ' ');
  }
  function normalizeLayout(layout){
    var l = layout || {};
    return {
      x: Math.max(-2000, Math.min(4000, safeNum(l.x, 0))),
      y: Math.max(-2000, Math.min(4000, safeNum(l.y, 0))),
      w: Math.max(1, Math.min(4000, safeNum(l.w, 320))),
      h: Math.max(1, Math.min(4000, safeNum(l.h, 80))),
      z: Math.max(0, Math.min(999, Math.round(safeNum(l.z, 1)))),
      rotate: Math.max(-360, Math.min(360, safeNum(l.rotate, 0)))
    };
  }
  function normalizeImportRun(run){
    var r = run || {};
    var fs = Math.max(4, Math.min(240, safeNum(r.fontSize, 18)));
    var color = /^#[0-9a-fA-F]{3,8}$/.test(String(r.fontColor || '')) ? String(r.fontColor) : '#111111';
    var weight = /^(?:[1-9]00|bold|normal)$/i.test(String(r.fontWeight || '')) ? String(r.fontWeight) : '400';
    var style = /^(?:normal|italic|oblique)$/i.test(String(r.fontStyle || '')) ? String(r.fontStyle) : 'normal';
    var family = String(r.fontFamily || 'Arial, sans-serif').replace(/[<>";]/g, '').slice(0, 160) || 'Arial, sans-serif';
    return { text: decodeLiteralNewlines(r.text || ''), fontSize: fs, fontFamily: family, fontColor: color, fontWeight: weight, fontStyle: style };
  }
  function normalizeBlock(block){
    block = block || {};
    var mode = block.mode || 'panel';
    var out;
    if(mode === 'diagram'){
      out = {
        mode: 'custom',
        title: block.title || 'Legacy diagram',
        content: diagramStandaloneDocument(block.content || diagramMarkup()),
        style: normalizeBlockStyle(block.style),
        animation: normalizeAnimation(block.animation)
      };
    } else {
      out = {
        mode: mode,
        title: block.title || '',
        content: decodeLiteralNewlines(block.content || ''),
        style: normalizeBlockStyle(block.style),
        animation: normalizeAnimation(block.animation)
      };
    }
    if(block.layout) out.layout = normalizeLayout(block.layout);
    if(Array.isArray(block.importRuns)) out.importRuns = block.importRuns.map(normalizeImportRun);
    if(block.importSourceLayout) out.importSourceLayout = normalizeLayout(block.importSourceLayout);
    if(block.importRole) out.importRole = String(block.importRole);
    return out;
  }

  function isTwoColumnSlideType(type){
    var value = String(type || '').toLowerCase();
    return value === 'two-col' || value === 'split' || value === 'split-slide';
  }
  function isFreeformSlideType(type){
    var value = String(type || '').toLowerCase();
    return value === 'freeform' || value === 'freeform-import' || value === 'pdf-import' || value === 'ppt-import';
  }
  function isFreeformSlide(slide){
    var s = slide || {};
    if(isFreeformSlideType(s.slideType)) return true;
    if(s.importMeta && (s.importMeta.stage || s.importMeta.freeform)) return true;
    var blocks = Array.isArray(s.leftBlocks) ? s.leftBlocks : [];
    return blocks.some(function(b){ return b && b.layout && /^import-/.test(String(b.mode || '')); });
  }

  function normalizeSlide(slide){
    var out = clone(slide || {});
    var leftBlocks = Array.isArray(out.leftBlocks) ? out.leftBlocks.map(normalizeBlock) : null;
    var rightBlocks = Array.isArray(out.rightBlocks) ? out.rightBlocks.map(normalizeBlock) : null;
    if(!leftBlocks){
      leftBlocks = [{ mode: out.leftMode || 'panel', title: '', content: out.leftHtml || '' }];
    }
    if(!rightBlocks){
      rightBlocks = isTwoColumnSlideType(out.slideType)
        ? [{ mode: out.rightMode || 'panel', title: '', content: out.rightHtml || '' }]
        : [];
    }
    out.leftBlocks = leftBlocks;
    out.rightBlocks = rightBlocks;
    out.titleStyle = normalizeBlockStyle(out.titleStyle);
    out.titleAnimation = normalizeAnimation(out.titleAnimation);
    return out;
  }
  function renderBlock(block, placeholderText, meta){
    block = block || {};
    var resolvedMode = block.mode || 'panel';
    var raw = block.content || '';
    var inner = '';
    if(resolvedMode === 'diagram') inner = diagramMarkup();
    else if(resolvedMode === 'custom') inner = customFrameMarkup(raw);
    else if(resolvedMode === 'placeholder') inner = '<div class="placeholder">' + escapeHtml(raw || placeholderText || 'Placeholder') + '</div>';
    else if(resolvedMode === 'pseudocode') inner = '<pre class="pseudo-block">' + escapeHtml(raw) + '</pre>';
    else if(resolvedMode === 'pseudocode-latex'){
      var p = preserveMathTokens(raw);
      inner = '<div class="pseudo-latex-block">' + restoreMathTokens(escapeHtml(p.out), p.tokens) + '</div>';
    } else {
      var richMeta = meta ? { column: meta.column, blockIndex: meta.blockIndex, figureIndex: 0 } : null;
      inner = '<div class="rich">' + parseStructuredText(raw, richMeta) + '</div>';
    }
    var attrs = meta ? ' data-column="' + escapeAttr(meta.column || 'left') + '" data-block-index="' + meta.blockIndex + '" data-block-mode="' + escapeAttr(resolvedMode) + '"' : '';
    return '<div class="preview-block"' + attrs + animationDataAttrs(block.animation) + ' style="' + blockWrapperStyle(block) + '">' + inner + '</div>';
  }
  function renderBlocks(blocks, placeholder, columnName){
    var list = blocks && blocks.length ? blocks : [{ mode:'placeholder', content: placeholder || 'Add a block' }];
    return '<div class="col-stack">' + list.map(function(block, idx){ return renderBlock(block, placeholder, { column: columnName || 'left', blockIndex: idx }); }).join('') + '</div>';
  }
  function layoutStyle(layout){
    var l = normalizeLayout(layout);
    var rot = l.rotate ? ('transform:rotate(' + l.rotate + 'deg);transform-origin:top left;') : '';
    return 'left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;height:' + l.h + 'px;z-index:' + l.z + ';' + rot;
  }
  function freeformFitMeta(slide){
    var meta = slide && slide.importMeta ? slide.importMeta : {};
    var sw = safeNum(meta.sourceWidth, 0);
    var sh = safeNum(meta.sourceHeight, 0);
    var tw = safeNum(meta.targetWidth || meta.canvasWidth, 1600);
    var th = safeNum(meta.targetHeight || meta.canvasHeight, 900);
    if(!(sw > 0 && sh > 0 && tw > 0 && th > 0)) return null;
    var scale = Math.min(tw / sw, th / sh);
    return { scale: scale, ox: (tw - sw * scale) / 2, oy: (th - sh * scale) / 2, tw: tw, th: th, sw: sw, sh: sh };
  }
  function sourceProjectedLayout(block, slide){
    // Stage 43O: prefer live Lumina layout after import/remake edits so
    // replacement blocks stay movable/resizable.
    if(block && block.layout) return block.layout;
    var src = block && block.importSourceLayout;
    var fit = freeformFitMeta(slide);
    if(!src || !fit) return block && block.layout;
    var l = normalizeLayout(src);
    return {
      x: fit.ox + l.x * fit.scale,
      y: fit.oy + l.y * fit.scale,
      w: l.w * fit.scale,
      h: l.h * fit.scale,
      z: l.z,
      rotate: l.rotate
    };
  }
  function runStyle(run){
    var r = normalizeImportRun(run);
    return 'font-size:' + r.fontSize + 'px;font-family:' + escapeAttr(r.fontFamily) + ';color:' + escapeAttr(r.fontColor) + ';font-weight:' + escapeAttr(r.fontWeight) + ';font-style:' + escapeAttr(r.fontStyle) + ';';
  }
  function renderRunText(text){
    return escapeHtml(decodeLiteralNewlines(text)).replace(/\n/g, '<br>');
  }
  function renderImportText(block){
    var runs = Array.isArray(block.importRuns) && block.importRuns.length ? block.importRuns : [{ text: block.content || '', fontSize: (block.style && parseFloat(block.style.fontSize)) || 18, fontFamily: block.style && block.style.fontFamily, fontColor: block.style && block.style.fontColor }];
    return '<div class="freeform-text-content">' + runs.map(function(run){ return '<span style="' + runStyle(run) + '">' + renderRunText(run.text) + '</span>'; }).join('') + '</div>';
  }
  function renderFreeformBlock(block, idx, slide){
    var mode = String(block && block.mode || 'panel');
    var roleClass = block && block.importRole ? ' import-role-' + escapeAttr(block.importRole) : '';
    var outerAttrs = ' data-freeform-index="' + idx + '" data-column="left" data-block-index="' + idx + '" data-block-mode="' + escapeAttr(mode) + '" style="' + layoutStyle(sourceProjectedLayout(block, slide)) + '"';
    if(mode === 'import-text'){
      return '<div class="freeform-block freeform-text-block' + roleClass + '"' + outerAttrs + '><div class="preview-block" data-column="left" data-block-index="' + idx + '" data-block-mode="import-text"' + animationDataAttrs(block.animation) + ' style="' + blockWrapperStyle(block) + '">' + renderImportText(block) + '</div></div>';
    }
    var rendered = renderBlock(block, '', { column: 'left', blockIndex: idx });
    var klass = mode === 'import-image' ? 'freeform-image-block' : 'freeform-generic-block';
    return '<div class="freeform-block ' + klass + roleClass + '"' + outerAttrs + '>' + rendered + '</div>';
  }
  function renderFreeformBlocks(blocks, slide){
    var list = blocks && blocks.length ? blocks : [];
    if(!list.length) return '<div class="placeholder">No importable objects found on this slide.</div>';
    return '<div class="freeform-layer">' + list.map(function(block, idx){ return renderFreeformBlock(block, idx, slide); }).join('') + '</div>';
  }
  function buildSlideInner(slide){
    slide = slide || {};
    var heading = slide.headingLevel || 'h2';
    var titleHtml = '<div class="preview-title" data-preview-role="title"' + animationDataAttrs(slide.titleAnimation) + ' style="' + titleWrapperStyle(slide.titleStyle, heading) + '"><' + heading + '>' + escapeHtml(slide.title || 'Untitled slide').replace(/\n/g,'<br>') + '</' + heading + '></div>';
    var kickerHtml = slide.kicker ? '<div class="kicker">' + escapeHtml(slide.kicker) + '</div>' : '';
    var ledeHtml = slide.lede ? '<div class="lede">' + escapeHtml(slide.lede) + '</div>' : '';
    var s = normalizeSlide(slide);
    if(s.slideType === 'title-center') return '<div class="title-center">' + titleHtml + kickerHtml + '</div>';
    if(isFreeformSlide(s)) return renderFreeformBlocks(s.leftBlocks, s);
    if(isTwoColumnSlideType(s.slideType)){
      return titleHtml + kickerHtml + ledeHtml + '<div class="slide-body"><div class="col">' + renderBlocks(s.leftBlocks, 'Left column', 'left') + '</div><div class="col">' + renderBlocks(s.rightBlocks, 'Right column', 'right') + '</div></div>';
    }
    return titleHtml + kickerHtml + ledeHtml + '<div class="slide-body"><div class="col">' + renderBlocks(s.leftBlocks, 'Main content', 'left') + '</div></div>';
  }
  function buildSlideMarkup(slide){
    slide = slide || {};
    var cls = slide.slideType === 'title-center' ? 'slide title-center' : (isFreeformSlide(slide) ? 'slide freeform-import' : (isTwoColumnSlideType(slide.slideType) ? 'slide two-col' : 'slide single'));
    return '<section class="' + cls + ' ' + currentStyleClass() + '" style="' + buildSlideStyle(slide) + '">' + buildSlideInner(slide).trim() + '</section>';
  }

  return {
    diagramMarkup: diagramMarkup,
    customFrameMarkup: customFrameMarkup,
    diagramStandaloneDocument: diagramStandaloneDocument,
    expandDiagramBlocksForSnippet: expandDiagramBlocksForSnippet,
    slideForSnippet: slideForSnippet,
    normalizeBlock: normalizeBlock,
    isTwoColumnSlideType: isTwoColumnSlideType,
    isFreeformSlideType: isFreeformSlideType,
  isFreeformSlide: isFreeformSlide,
    normalizeSlide: normalizeSlide,
    renderBlock: renderBlock,
    renderBlocks: renderBlocks,
    renderFreeformBlocks: renderFreeformBlocks,
    buildSlideInner: buildSlideInner,
    buildSlideMarkup: buildSlideMarkup
  };
}

export default Object.freeze({ createApi: createApi });
