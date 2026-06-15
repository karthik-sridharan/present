/* Stage 34D: browser-compatible ES module version of interactive figure tools.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */
'use strict';

function createApi(deps){
    deps = deps || {};
    const {
      escapeAttr,
      blockArray,
      currentColumnName,
      selectedIndex,
      blockFields,
      snippetOutput,
      slideForSnippet,
      currentDraftSlide,
      isSyncingPreviewFigures,
      preview,
      previewGridOverlay,
      previewMarginOverlay,
      showGridToggle,
      showMarginsToggle,
      snapToGuidesToggle,
      lockAspectToggle,
      selectedFiguresStatus,
      updateAnimationControls,
      syncPreviewFiguresToDraft,
      saveCurrentBlockToDraft,
      saveCurrentSlideToDeck,
      persistAutosaveNow,
      buildPreview,
      scheduleAutosave
    } = deps;

function updatePreviewScale(){
  const frame = document.getElementById('previewFrame');
  const scaleEl = document.getElementById('previewScale');
  if(!frame || !scaleEl) return;
  const baseW = 1600, baseH = 900;
  const scale = Math.min(frame.clientWidth / baseW, frame.clientHeight / baseH);
  const scaledW = baseW * scale;
  const scaledH = baseH * scale;
  const offsetX = Math.max(0, (frame.clientWidth - scaledW) / 2);
  const offsetY = Math.max(0, (frame.clientHeight - scaledH) / 2);
  scaleEl.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}
function fitFiguresInSlide(slideEl){
  if(!slideEl) return;
  const figures = Array.from(slideEl.querySelectorAll('.figure-embed'));
  if(!figures.length) return;

  // Reset only auto-managed figures. Manually moved/resized figures should keep their saved box geometry.
  figures.forEach(embed=>{
    if(isManualFigureEmbed(embed)) return;
    embed.style.maxHeight = '';
    embed.style.maxWidth = '';
    embed.style.height = '';
    embed.style.width = '';
    const media = embed.querySelector('img,svg,canvas,iframe');
    if(media){
      media.style.maxHeight = '';
      media.style.maxWidth = '';
      media.style.height = '';
      media.style.width = '';
    }
  });

  const slideRect = slideEl.getBoundingClientRect();
  const slideMaxHeight = slideEl.clientHeight || 900;
  const bottomPadding = 20;

  // First pass: cap only auto-managed figures by the actual remaining space below their top edge.
  figures.forEach(embed=>{
    if(isManualFigureEmbed(embed)) return;
    const media = embed.querySelector('img,svg,canvas,iframe');
    const rect = embed.getBoundingClientRect();
    const remaining = Math.max(70, slideRect.bottom - rect.top - bottomPadding);
    const embedCap = Math.max(80, Math.min(remaining, slideMaxHeight * 0.62));
    const remainingW = Math.max(120, slideRect.right - rect.left - bottomPadding);
    embed.style.maxHeight = embedCap + 'px';
    embed.style.maxWidth = remainingW + 'px';
    embed.style.width = 'fit-content';
    if(media){
      const mediaCap = Math.max(60, embedCap - 12);
      media.style.maxHeight = mediaCap + 'px';
      media.style.maxWidth = Math.max(100, remainingW - 12) + 'px';
      media.style.width = 'auto';
      media.style.height = 'auto';
      if(media.tagName === 'IFRAME'){
        media.style.height = mediaCap + 'px';
        media.style.width = Math.max(100, remainingW - 12) + 'px';
      }
    }
  });

  // Second pass: if the slide still overflows, shrink only auto-managed figures.
  let guard = 0;
  while(slideEl.scrollHeight > slideMaxHeight + 2 && guard < 24){
    const overflow = slideEl.scrollHeight - slideMaxHeight;
    const candidates = figures.map(embed=>{
      if(isManualFigureEmbed(embed)) return null;
      const media = embed.querySelector('img,svg,canvas,iframe');
      const rect = embed.getBoundingClientRect();
      return {embed, media, h: rect.height || 0};
    }).filter(x=>x && x.h > 50).sort((a,b)=>b.h-a.h);

    if(!candidates.length) break;
    const c = candidates[0];
    const current = parseFloat(c.embed.style.maxHeight || c.h);
    const reduce = Math.min(Math.max(overflow + 12, 28), current * 0.40);
    const next = Math.max(60, current - reduce);
    c.embed.style.maxHeight = next + 'px';
    if(c.media){
      const mediaNext = Math.max(48, next - 12);
      c.media.style.maxHeight = mediaNext + 'px';
      if(c.media.tagName === 'IFRAME') c.media.style.height = mediaNext + 'px';
    }
    guard += 1;
  }
}
function parseTranslate(transform){
  const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform || '');
  return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 };
}
function replaceNthFigureHtml(blockContent, figIndex, newBody){
  let seen = -1;
  return String(blockContent || '').replace(/\\begin\{figurehtml\}[\r\n]*([\s\S]*?)[\r\n]*\\end\{figurehtml\}/g, (m, body)=>{
    seen += 1;
    if(seen !== figIndex) return m;
    return '\\begin{figurehtml}\n' + newBody + '\n\\end{figurehtml}';
  });
}
function getFigurePrimaryMedia(box){
  return box ? box.querySelector(':scope > img, :scope > svg, :scope > canvas, :scope > iframe, :scope > figure > img, :scope > figure > svg, :scope > figure > canvas, :scope > figure > iframe') : null;
}
function getSerializedImageFigure(box){
  if(!box) return null;
  const fig = box.querySelector(':scope > figure[data-figure-kind="image"]');
  if(fig && fig.querySelector('img')) return fig;
  const img = box.querySelector(':scope > img[data-figure-kind="image"]');
  return img || null;
}
function serializeFigureBox(box){
  const imageFigure = getSerializedImageFigure(box);
  if(imageFigure){
    const img = imageFigure.tagName.toLowerCase() === 'img' ? imageFigure : imageFigure.querySelector('img');
    if(img){
      const t = parseTranslate(box.style.transform);
      const w = parseFloat(box.style.width || '') || box.offsetWidth || img.naturalWidth || 220;
      const h = parseFloat(box.style.height || '') || box.offsetHeight || img.naturalHeight || 160;
      const ow = parseFloat(box.dataset.originalW || '') || img.naturalWidth || w;
      const oh = parseFloat(box.dataset.originalH || '') || img.naturalHeight || h;
      const lockAspect = box.dataset.lockAspect === '1' ? '1' : '0';
      const userMoved = box.dataset.userMoved === '1' || Math.abs(t.x) > 0.5 || Math.abs(t.y) > 0.5 ? '1' : '0';
      const userSized = box.dataset.userSized === '1' ? '1' : '0';
      const crop = box.dataset.crop === '1' ? '1' : '0';
      const z = String(box.style.zIndex || box.dataset.zIndex || '1');
      const objFit = escapeAttr((img.style.objectFit || imageFigure.dataset.objectFit || 'contain'));
      const safeSrc = escapeAttr(img.getAttribute('src') || '');
      const safeAlt = escapeAttr(img.getAttribute('alt') || '');
      return '<figure data-figure-kind="image" data-box-x="' + escapeAttr(String(Math.round(t.x))) + '" data-box-y="' + escapeAttr(String(Math.round(t.y))) + '" data-box-w="' + escapeAttr(String(Math.round(w))) + '" data-box-h="' + escapeAttr(String(Math.round(h))) + '" data-original-w="' + escapeAttr(String(Math.round(ow))) + '" data-original-h="' + escapeAttr(String(Math.round(oh))) + '" data-lock-aspect="' + lockAspect + '" data-user-moved="' + userMoved + '" data-user-sized="' + userSized + '" data-crop="' + crop + '" data-z-index="' + escapeAttr(z) + '" data-object-fit="' + objFit + '" data-build-in="' + escapeAttr(box.dataset.buildIn || 'none') + '" data-build-out="' + escapeAttr(box.dataset.buildOut || 'none') + '" data-step-mode="' + escapeAttr(box.dataset.stepMode || 'all') + '" data-anim-order="' + escapeAttr(box.dataset.animOrder || '0') + '"><img src="' + safeSrc + '" alt="' + safeAlt + '" /></figure>';
    }
  }
  const clean = box.cloneNode(true);
  clean.classList.remove('selected');
  clean.querySelectorAll('.figure-resize-handle').forEach(el=>el.remove());
  clean.style.touchAction = '';
  clean.style.cursor = '';
  clean.style.maxWidth = 'none';
  clean.style.maxHeight = 'none';
  return clean.outerHTML;
}
function applySerializedImageState(box){
  const fig = box ? box.querySelector(':scope > figure[data-figure-kind="image"]') : null;
  if(!fig) return false;
  const img = fig.querySelector('img');
  if(!img) return false;

  const x = parseFloat(fig.dataset.boxX || '0') || 0;
  const y = parseFloat(fig.dataset.boxY || '0') || 0;
  const w = parseFloat(fig.dataset.boxW || '') || 0;
  const h = parseFloat(fig.dataset.boxH || '') || 0;
  const ow = parseFloat(fig.dataset.originalW || '') || w || img.naturalWidth || 220;
  const oh = parseFloat(fig.dataset.originalH || '') || h || img.naturalHeight || 160;

  box.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)';
  if(w > 0) box.style.width = Math.round(w) + 'px';
  if(h > 0) box.style.height = Math.round(h) + 'px';
  box.dataset.originalW = String(Math.round(ow));
  box.dataset.originalH = String(Math.round(oh));
  box.dataset.lockAspect = fig.dataset.lockAspect || '1';
  box.dataset.userMoved = fig.dataset.userMoved || (Math.abs(x) > 0.5 || Math.abs(y) > 0.5 ? '1' : '0');
  box.dataset.userSized = fig.dataset.userSized || (w > 0 && h > 0 ? '1' : '0');
  box.dataset.crop = fig.dataset.crop || '0';
  box.dataset.zIndex = fig.dataset.zIndex || '1';
  box.style.zIndex = box.dataset.zIndex;
  box.dataset.buildIn = fig.dataset.buildIn || 'none';
  box.dataset.buildOut = fig.dataset.buildOut || 'none';
  box.dataset.stepMode = fig.dataset.stepMode || 'all';
  box.dataset.animOrder = fig.dataset.animOrder || '0';
  box.style.overflow = box.dataset.crop === '1' ? 'hidden' : 'visible';
  img.style.objectFit = fig.dataset.objectFit || (box.dataset.crop === '1' ? 'cover' : 'contain');
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.maxWidth = 'none';
  img.style.maxHeight = 'none';
  return true;
}

function stage43akFigureSrcFromHtml(html){
  try{
    const m = String(html || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    return m ? String(m[1] || '') : '';
  }catch(_err){ return ''; }
}
function stage43akImportedFigureSourceGuard(existingBlock, serializedFigure, embed){
  try{
    const block = existingBlock || {};
    const isImported = String(block.mode || '').toLowerCase() === 'import-image' || !!block.importRole || !!block.importSubmode || !!block.importSourceLayout;
    if(!isImported) return true;
    const beforeSrc = stage43akFigureSrcFromHtml(block.content || '');
    const afterSrc = stage43akFigureSrcFromHtml(serializedFigure || '');
    if(!beforeSrc || !afterSrc) return true;
    if(beforeSrc === afterSrc) return true;
    try{
      window.__LUMINA_STAGE43AK_IMAGE_BLOB_SOURCE_GUARD = {
        ok:false,
        skipped:true,
        reason:'Blocked stale preview figure sync because imported image src did not match the target block.',
        column:embed && embed.dataset ? embed.dataset.column || '' : '',
        blockIndex:embed && embed.dataset ? embed.dataset.blockIndex || '' : '',
        figureIndex:embed && embed.dataset ? embed.dataset.figureIndex || '' : '',
        beforePreview:beforeSrc.slice(0,96),
        afterPreview:afterSrc.slice(0,96),
        at:new Date().toISOString()
      };
    }catch(_err){}
    return false;
  }catch(_err){ return true; }
}

function isManualFigureEmbed(embed){
  const box = embed ? embed.querySelector('.figure-box') : null;
  if(!box) return false;
  return box.dataset.userMoved === '1' || box.dataset.userSized === '1';
}
function saveFigureEmbedToDraft(embed){
  const column = embed.dataset.column || 'left';
  const blockIndex = Number(embed.dataset.blockIndex);
  const figureIndex = Number(embed.dataset.figureIndex);
  const arr = blockArray(column);
  if(!arr[blockIndex]) return;
  const box = embed.querySelector('.figure-box');
  if(!box) return;
  const serialized = serializeFigureBox(box);
  if(!stage43akImportedFigureSourceGuard(arr[blockIndex], serialized, embed)) return;
  arr[blockIndex].content = replaceNthFigureHtml(arr[blockIndex].content, figureIndex, serialized);
  if(currentColumnName() === column && selectedIndex(column) === blockIndex){
    blockFields.content.value = arr[blockIndex].content;
  }
  if(!(typeof isSyncingPreviewFigures === 'function' ? isSyncingPreviewFigures() : false)){
    snippetOutput.value = JSON.stringify(slideForSnippet(currentDraftSlide()), null, 2);
  }
}
function getSelectedFigureBoxes(root){
  return Array.from((root || preview).querySelectorAll('.figure-box.selected'));
}
function updatePreviewGuides(){
  if(previewGridOverlay) previewGridOverlay.classList.toggle('show', !!showGridToggle?.checked);
  if(previewMarginOverlay) previewMarginOverlay.classList.toggle('show', !!showMarginsToggle?.checked);
}
function refreshFigureToolState(){
  const boxes = getSelectedFigureBoxes();
  if(selectedFiguresStatus){
    selectedFiguresStatus.textContent = boxes.length ? (boxes.length + ' figure' + (boxes.length===1?'':'s') + ' selected.') : 'No figure selected.';
  }
  if(boxes.length === 1 && lockAspectToggle){
    lockAspectToggle.checked = boxes[0].dataset.lockAspect === '1';
  }
  updateAnimationControls();
}
function getSlideMetricsForBox(box){
  const slide = box.closest('.slide, .deck-slide, .print-slide');
  const slideRect = slide.getBoundingClientRect();
  const styles = getComputedStyle(slide);
  const padL = parseFloat(styles.paddingLeft || '0') || 0;
  const padR = parseFloat(styles.paddingRight || '0') || 0;
  const padT = parseFloat(styles.paddingTop || '0') || 0;
  const padB = parseFloat(styles.paddingBottom || '0') || 0;
  const scale = getInteractionScale(slide);
  return {
    slide,
    slideRect,
    scaleX: scale.x || 1,
    scaleY: scale.y || 1,
    contentLeft: padL,
    contentRight: (slide.clientWidth || slide.offsetWidth || 1600) - padR,
    contentTop: padT,
    contentBottom: (slide.clientHeight || slide.offsetHeight || 900) - padB,
    contentWidth: (slide.clientWidth || slide.offsetWidth || 1600) - padL - padR,
    contentHeight: (slide.clientHeight || slide.offsetHeight || 900) - padT - padB
  };
}
function moveBoxTo(box, targetLeft, targetTop){
  const m = getSlideMetricsForBox(box);
  const rect = box.getBoundingClientRect();
  const current = parseTranslate(box.style.transform);
  const leftNow = (rect.left - m.slideRect.left) / m.scaleX;
  const topNow = (rect.top - m.slideRect.top) / m.scaleY;
  const nextX = current.x + (targetLeft - leftNow);
  const nextY = current.y + (targetTop - topNow);
  box.style.transform = `translate(${Math.round(nextX)}px, ${Math.round(nextY)}px)`;
}
function normalizeFigureSelection(singleBox, additive){
  const scope = preview;
  if(!additive){
    scope.querySelectorAll('.figure-box.selected').forEach(el=>{ if(el !== singleBox) el.classList.remove('selected'); });
  }
  if(singleBox) singleBox.classList.add('selected');
  refreshFigureToolState();
}
function figureRefFromBox(box){
  const embed = box ? box.closest('.figure-embed[data-column]') : null;
  if(!embed) return null;
  return {
    column: embed.dataset.column || 'left',
    blockIndex: Number(embed.dataset.blockIndex),
    figureIndex: Number(embed.dataset.figureIndex)
  };
}
function getFigureBoxByRef(ref){
  if(!ref || !preview) return null;
  const embeds = Array.from(preview.querySelectorAll('.figure-embed[data-column]'));
  const embed = embeds.find(el =>
    (el.dataset.column || 'left') === ref.column &&
    Number(el.dataset.blockIndex) === Number(ref.blockIndex) &&
    Number(el.dataset.figureIndex) === Number(ref.figureIndex)
  );
  return embed ? embed.querySelector('.figure-box') : null;
}
function restoreFigureSelection(refs){
  const wanted = (refs || []).filter(Boolean);
  if(!wanted.length) return;
  requestAnimationFrame(()=>{
    if(!preview) return;
    preview.querySelectorAll('.figure-box.selected').forEach(el=>el.classList.remove('selected'));
    wanted.forEach(ref=>{
      const box = getFigureBoxByRef(ref);
      if(box) box.classList.add('selected');
    });
    refreshFigureToolState();
  });
}
function duplicateNthFigureHtml(blockContent, figIndex){
  let seen = -1;
  let duplicated = false;
  const next = String(blockContent || '').replace(/\\begin\{figurehtml\}[\r\n]*([\s\S]*?)[\r\n]*\\end\{figurehtml\}/g, (m, body)=>{
    seen += 1;
    if(seen !== figIndex) return m;
    duplicated = true;
    return m + '\n\n\\begin{figurehtml}\n' + body + '\n\\end{figurehtml}';
  });
  return { content: next, duplicated };
}
function saveSelectedFigures(){
  getSelectedFigureBoxes().forEach(box=>{
    const embed = box.closest('.figure-embed[data-column]');
    if(embed) saveFigureEmbedToDraft(embed);
  });
  syncPreviewFiguresToDraft(false);
  saveCurrentBlockToDraft();
  saveCurrentSlideToDeck();
  persistAutosaveNow('Autosaved after figure edit.');
}
function snapValue(v, step=20){ return Math.round(v / step) * step; }
function applySnapToBox(box){
  const t = parseTranslate(box.style.transform);
  box.style.transform = `translate(${snapValue(t.x)}px, ${snapValue(t.y)}px)`;
}
function alignSelectedFigures(which){
  const boxes = getSelectedFigureBoxes();
  if(!boxes.length) return;
  boxes.forEach(box=>{
    const m = getSlideMetricsForBox(box);
    const rect = box.getBoundingClientRect();
    const w = rect.width / m.scaleX;
    const h = rect.height / m.scaleY;
    let left = (rect.left - m.slideRect.left) / m.scaleX;
    let top = (rect.top - m.slideRect.top) / m.scaleY;
    if(which === 'left') left = m.contentLeft;
    if(which === 'center') left = m.contentLeft + (m.contentWidth - w) / 2;
    if(which === 'right') left = m.contentRight - w;
    if(which === 'top') top = m.contentTop;
    if(which === 'middle') top = m.contentTop + (m.contentHeight - h) / 2;
    if(which === 'bottom') top = m.contentBottom - h;
    moveBoxTo(box, left, top);
  });
  saveSelectedFigures();
  buildPreview();
}
function distributeSelectedFigures(axis){
  const boxes = getSelectedFigureBoxes();
  if(boxes.length < 3) return;
  const items = boxes.map(box=>{
    const m = getSlideMetricsForBox(box);
    const rect = box.getBoundingClientRect();
    return {
      box, m,
      left: (rect.left - m.slideRect.left) / m.scaleX,
      top: (rect.top - m.slideRect.top) / m.scaleY,
      width: rect.width / m.scaleX,
      height: rect.height / m.scaleY
    };
  }).sort((a,b)=> axis==='x' ? a.left-b.left : a.top-b.top);
  const first = items[0], last = items[items.length-1];
  const total = items.slice(1,-1).reduce((s,it)=>s+(axis==='x'?it.width:it.height),0);
  const span = axis==='x' ? (last.left - (first.left + first.width)) : (last.top - (first.top + first.height));
  const gap = items.length > 2 ? (span - total) / (items.length - 1) : 0;
  let cursor = axis==='x' ? first.left + first.width + gap : first.top + first.height + gap;
  items.slice(1,-1).forEach(it=>{
    if(axis==='x') moveBoxTo(it.box, cursor, it.top);
    else moveBoxTo(it.box, it.left, cursor);
    cursor += (axis==='x' ? it.width : it.height) + gap;
  });
  saveSelectedFigures();
  buildPreview();
}
function bringSelectedFigures(delta){
  const boxes = getSelectedFigureBoxes();
  boxes.forEach(box=>{
    const z = parseInt(box.style.zIndex || '1', 10) || 1;
    box.style.zIndex = String(Math.max(1, z + delta));
  });
  saveSelectedFigures();
  buildPreview();
}
function toggleCropSelectedFigure(){
  const boxes = getSelectedFigureBoxes();
  if(!boxes.length) return;
  const refs = boxes.map(figureRefFromBox).filter(Boolean);
  boxes.forEach(box=>{
    const cropped = box.dataset.crop === '1';
    box.dataset.crop = cropped ? '0' : '1';
    box.dataset.userSized = box.dataset.userSized || '1';
    box.style.overflow = cropped ? 'visible' : 'hidden';
    const media = box.querySelector(':scope > img, :scope > svg, :scope > canvas, :scope > iframe, :scope > figure > img, :scope > figure > svg, :scope > figure > canvas, :scope > figure > iframe');
    if(media){
      media.style.objectFit = cropped ? 'contain' : 'cover';
    }
  });
  saveSelectedFigures();
  buildPreview();
  restoreFigureSelection(refs);
}
function duplicateSelectedFigure(){
  const boxes = getSelectedFigureBoxes();
  if(boxes.length !== 1) return;
  const embed = boxes[0].closest('.figure-embed[data-column]');
  if(!embed) return;
  saveFigureEmbedToDraft(embed);
  const column = embed.dataset.column || 'left';
  const blockIndex = Number(embed.dataset.blockIndex);
  const figureIndex = Number(embed.dataset.figureIndex);
  const arr = blockArray(column);
  if(!arr[blockIndex]) return;
  const result = duplicateNthFigureHtml(arr[blockIndex].content, figureIndex);
  if(!result.duplicated) return;
  arr[blockIndex].content = result.content;
  if(currentColumnName() === column && selectedIndex(column) === blockIndex){
    blockFields.content.value = arr[blockIndex].content;
  }
  if(snippetOutput){
    snippetOutput.value = JSON.stringify(slideForSnippet(currentDraftSlide()), null, 2);
  }
  saveCurrentSlideToDeck();
  buildPreview();
  restoreFigureSelection([{ column, blockIndex, figureIndex: figureIndex + 1 }]);
  scheduleAutosave('Autosaved after figure duplicate.');
}
function resetSelectedFigure(){
  getSelectedFigureBoxes().forEach(box=>{
    box.style.transform = 'translate(0px, 0px)';
    box.style.zIndex = '1';
    box.dataset.zIndex = '1';
    box.dataset.crop = '0';
    box.dataset.userMoved = '0';
    box.dataset.userSized = '0';
    box.style.overflow = 'visible';
    const ow = parseFloat(box.dataset.originalW || '220') || 220;
    const oh = parseFloat(box.dataset.originalH || '160') || 160;
    box.style.width = ow + 'px';
    box.style.height = oh + 'px';
    const media = box.querySelector(':scope > img, :scope > svg, :scope > canvas, :scope > iframe, :scope > figure > img, :scope > figure > svg, :scope > figure > canvas, :scope > figure > iframe');
    if(media) media.style.objectFit = 'contain';
  });
  saveSelectedFigures();
  buildPreview();
}
function applyGuideSnapping(box){
  const t = parseTranslate(box.style.transform);
  let x = t.x, y = t.y;
  const m = getSlideMetricsForBox(box);
  const rect = box.getBoundingClientRect();
  const w = rect.width / m.scaleX, h = rect.height / m.scaleY;
  const currentLeft = (rect.left - m.slideRect.left) / m.scaleX;
  const currentTop = (rect.top - m.slideRect.top) / m.scaleY;
  const currentCenterX = currentLeft + w/2;
  const currentCenterY = currentTop + h/2;
  const guideTol = 10;
  const targetsX = [m.contentLeft, m.contentLeft + m.contentWidth/2 - w/2, m.contentRight - w];
  const targetsY = [m.contentTop, m.contentTop + m.contentHeight/2 - h/2, m.contentBottom - h];
  targetsX.forEach(tx=>{ if(Math.abs(currentLeft - tx) < guideTol) x += tx - currentLeft; });
  targetsY.forEach(ty=>{ if(Math.abs(currentTop - ty) < guideTol) y += ty - currentTop; });
  box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function getInteractionScale(el){
  const target = el.closest('.slide, .deck-slide, .print-slide') || el;
  const rect = target.getBoundingClientRect();
  const ow = target.offsetWidth || parseFloat(getComputedStyle(target).width) || rect.width || 1;
  const oh = target.offsetHeight || parseFloat(getComputedStyle(target).height) || rect.height || 1;
  const scaleX = rect.width / ow || 1;
  const scaleY = rect.height / oh || 1;
  return {
    x: scaleX > 0 ? scaleX : 1,
    y: scaleY > 0 ? scaleY : 1
  };
}
function ensureInteractiveFigureBox(embed){
  let box = embed.querySelector('.figure-box');
  if(!box){
    box = document.createElement('div');
    box.className = 'figure-box';
    while(embed.firstChild) box.appendChild(embed.firstChild);
    embed.appendChild(box);
    const restored = applySerializedImageState(box);
    if(!restored){
      const rect = box.getBoundingClientRect();
      const media = getFigurePrimaryMedia(box);
      const ow = Math.max(80, Math.round(rect.width || (media && media.naturalWidth) || 220));
      const oh = Math.max(60, Math.round(rect.height || (media && media.naturalHeight) || 160));
      box.style.width = ow + 'px';
      box.style.height = oh + 'px';
      box.dataset.originalW = String(ow);
      box.dataset.originalH = String(oh);
      box.style.transform = box.style.transform || 'translate(0px, 0px)';
      box.style.zIndex = box.style.zIndex || '1';
    }
    box.style.cursor = 'grab';
  }
  if(!box.querySelector('.figure-resize-handle')){
    const handle = document.createElement('div');
    handle.className = 'figure-resize-handle';
    box.appendChild(handle);
  }
  return box;
}
function initFigureInteractions(root){
  const scope = root || document;
  if(scope.__figureInitDone){
    refreshFigureToolState();
    return;
  }
  scope.__figureInitDone = true;
  let active = null;

  scope.addEventListener('pointerdown', (e)=>{
    const handle = e.target.closest('.figure-resize-handle');
    const box = e.target.closest('.figure-box');
    if(!box) return;
    const embed = box.closest('.figure-embed[data-column]');
    if(!embed) return;

    if(handle){
      normalizeFigureSelection(box, e.shiftKey || e.metaKey || e.ctrlKey);
      const rect = box.getBoundingClientRect();
      const slideEl = embed.closest('.slide, .deck-slide, .print-slide') || embed.closest('[data-preview-root]') || document.body;
      const slideRect = slideEl.getBoundingClientRect();
      const slideStyles = window.getComputedStyle(slideEl);
      const padX = (parseFloat(slideStyles.paddingLeft || '0') + parseFloat(slideStyles.paddingRight || '0')) || 0;
      const padY = (parseFloat(slideStyles.paddingTop || '0') + parseFloat(slideStyles.paddingBottom || '0')) || 0;
      const scale = getInteractionScale(slideEl);
      active = {
        mode: 'resize',
        box, embed,
        pointerId: e.pointerId,
        startX: e.clientX, startY: e.clientY,
        startW: box.offsetWidth || parseFloat(box.style.width) || rect.width,
        startH: box.offsetHeight || parseFloat(box.style.height) || rect.height,
        maxW: Math.max(120, (slideEl.clientWidth || slideEl.offsetWidth || slideRect.width) - padX - 24),
        maxH: Math.max(80, (slideEl.clientHeight || slideEl.offsetHeight || slideRect.height) - padY - 24),
        scaleX: scale.x, scaleY: scale.y,
        aspect: (box.offsetWidth || rect.width) / Math.max(1, (box.offsetHeight || rect.height))
      };
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      refreshFigureToolState();
      return;
    }

    normalizeFigureSelection(box, e.shiftKey || e.metaKey || e.ctrlKey);
    const t = parseTranslate(box.style.transform);
    box.style.cursor = 'grabbing';
    const scale = getInteractionScale(box);
    active = {
      mode:'move',
      box, embed,
      pointerId:e.pointerId,
      startX:e.clientX, startY:e.clientY,
      startTX:t.x, startTY:t.y,
      scaleX:scale.x, scaleY:scale.y
    };
    box.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    refreshFigureToolState();
  });

  if(!window.__figureWindowHandlersBound){
    window.__figureWindowHandlersBound = true;
    window.addEventListener('pointermove', (e)=>{
      if(!active) return;
      e.preventDefault();
      if(active.mode === 'move'){
        let dx = (e.clientX - active.startX) / (active.scaleX || 1);
        let dy = (e.clientY - active.startY) / (active.scaleY || 1);
        let nextX = active.startTX + dx;
        let nextY = active.startTY + dy;
        if(showGridToggle?.checked || snapToGuidesToggle?.checked){
          nextX = snapValue(nextX);
          nextY = snapValue(nextY);
        }
        active.box.dataset.userMoved = '1';
        active.box.style.transform = `translate(${Math.round(nextX)}px, ${Math.round(nextY)}px)`;
        if(snapToGuidesToggle?.checked) applyGuideSnapping(active.box);
      }else if(active.mode === 'resize'){
        let dx = (e.clientX - active.startX) / (active.scaleX || 1);
        let dy = (e.clientY - active.startY) / (active.scaleY || 1);
        let w = Math.min(active.maxW || Infinity, Math.max(60, Math.round(active.startW + dx)));
        let h = Math.min(active.maxH || Infinity, Math.max(40, Math.round(active.startH + dy)));
        const lockAspect = lockAspectToggle?.checked || active.box.dataset.lockAspect === '1';
        if(lockAspect){
          if(Math.abs(dx) >= Math.abs(dy)) h = Math.max(40, Math.round(w / active.aspect));
          else w = Math.max(60, Math.round(h * active.aspect));
        }
        if(showGridToggle?.checked || snapToGuidesToggle?.checked){
          w = snapValue(w);
          h = snapValue(h);
        }
        active.box.dataset.userSized = '1';
        active.embed.style.maxWidth = 'none';
        active.embed.style.maxHeight = 'none';
        active.box.style.maxWidth = 'none';
        active.box.style.maxHeight = 'none';
        active.box.style.width = w + 'px';
        active.box.style.height = h + 'px';
        const direct = active.box.querySelector(':scope > img, :scope > svg, :scope > canvas, :scope > iframe, :scope > figure');
        active.embed.style.width = 'fit-content';
        if(direct){
          direct.style.maxWidth = 'none';
          direct.style.maxHeight = 'none';
          direct.style.width = '100%';
          direct.style.height = '100%';
          if(direct.tagName === 'FIGURE'){
            const inner = direct.querySelector('img,svg,canvas,iframe');
            if(inner){
              inner.style.maxWidth = 'none';
              inner.style.maxHeight = 'none';
              inner.style.width = '100%';
              inner.style.height = '100%';
            }
          }
        }
      }
    }, { passive:false });
    window.addEventListener('pointerup', ()=>{
      if(!active) return;
      if(active.box) active.box.style.cursor = 'grab';
      saveFigureEmbedToDraft(active.embed);
      syncPreviewFiguresToDraft(false);
      persistAutosaveNow('Autosaved after figure edit.');
      active = null;
    }, { passive:true });
    window.addEventListener('pointercancel', ()=>{
      if(!active) return;
      if(active.box) active.box.style.cursor = 'grab';
      saveFigureEmbedToDraft(active.embed);
      syncPreviewFiguresToDraft(false);
      persistAutosaveNow('Autosaved after figure edit.');
      active = null;
    }, { passive:true });
  }
  refreshFigureToolState();
}
function fitFiguresIn(root){
  const scope = root || document;
  scope.querySelectorAll('.figure-embed[data-column]').forEach(embed=>ensureInteractiveFigureBox(embed));
  scope.querySelectorAll('.slide, .deck-slide, .print-cell .slide').forEach(fitFiguresInSlide);
}


    return {
      updatePreviewScale,
      fitFiguresInSlide,
      parseTranslate,
      replaceNthFigureHtml,
      getFigurePrimaryMedia,
      getSerializedImageFigure,
      serializeFigureBox,
      applySerializedImageState,
      isManualFigureEmbed,
      saveFigureEmbedToDraft,
      getSelectedFigureBoxes,
      updatePreviewGuides,
      refreshFigureToolState,
      getSlideMetricsForBox,
      moveBoxTo,
      normalizeFigureSelection,
      saveSelectedFigures,
      snapValue,
      applySnapToBox,
      alignSelectedFigures,
      distributeSelectedFigures,
      bringSelectedFigures,
      toggleCropSelectedFigure,
      duplicateSelectedFigure,
      resetSelectedFigure,
      applyGuideSnapping,
      getInteractionScale,
      ensureInteractiveFigureBox,
      initFigureInteractions,
      fitFiguresIn
    };
  }

export { createApi };
export default { createApi };
