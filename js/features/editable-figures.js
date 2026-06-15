(function(){
  'use strict';
  var W = window;
  var STAGE = W.LUMINA_STAGE || 'stage38n-20260427-1';
  var STATUS = {
    stage: STAGE,
    editableFigures: true,
    doubleClickToEdit: true,
    supported: ['SVG diagram figures inside figurehtml blocks'],
    unsupported: ['raster images', 'PDF/iframe custom blocks', 'non-SVG figures'],
    bound: false,
    annotatedCount: 0,
    lastOpenAt: '',
    lastCommitAt: '',
    lastFigureIndex: null,
    lastBlock: null,
    lastError: '',
    previewPatchedForCommit: false,
    lastPreviewPatchAt: '',
    lastCommitContentHash: '',
    behaviorChanged: false
  };
  var editSession = null;
  function publish(){ W.__LUMINA_STAGE35U_EDITABLE_FIGURES = Object.assign({}, STATUS); return W.__LUMINA_STAGE35U_EDITABLE_FIGURES; }
  function byId(id){ return document.getElementById(id); }
  function showToast(msg){ var app = W.LuminaAppCommands || {}; if(typeof app.showToast === 'function') app.showToast(msg); }
  function dispatchInput(el){ if(el) el.dispatchEvent(new Event('input', { bubbles:true })); }
  function dispatchChange(el){ if(el) el.dispatchEvent(new Event('change', { bubbles:true })); }
  function setError(err){ STATUS.lastError = err && err.message ? err.message : String(err || 'Unknown figure edit error'); publish(); try { W.luminaBootError && W.luminaBootError('Stage35U editable figure: ' + STATUS.lastError); } catch(_e){} }
  function closestFigureTarget(target){
    if(!target || !target.closest) return null;
    return target.closest('.figure-box, .figure-embed, figure, svg');
  }
  function closestFigureEmbed(target){
    if(!target || !target.closest) return null;
    var embed = target.closest('.figure-embed');
    if(embed) return embed;
    var box = target.closest('.figure-box');
    if(box && box.closest) return box.closest('.figure-embed') || box;
    var fig = target.closest('figure');
    return fig || target.closest('svg');
  }
  function findPreviewBlock(target){ return target && target.closest ? target.closest('.preview-block') : null; }
  function figureIndexWithinBlock(figureTarget, blockEl){
    var explicit = figureTarget && figureTarget.dataset && figureTarget.dataset.figureIndex;
    if(explicit !== undefined && explicit !== null && explicit !== ''){
      var n = Number(explicit);
      if(isFinite(n) && n >= 0) return Math.floor(n);
    }
    var embed = figureTarget && figureTarget.closest && figureTarget.closest('.figure-embed');
    if(embed && embed.dataset && embed.dataset.figureIndex !== undefined){
      var m = Number(embed.dataset.figureIndex);
      if(isFinite(m) && m >= 0) return Math.floor(m);
    }
    var all = Array.from((blockEl || document).querySelectorAll('.figure-embed, .figure-box, figure svg'));
    var hit = figureTarget;
    for(var i=0;i<all.length;i++){
      if(all[i] === hit || (all[i].contains && all[i].contains(hit)) || (hit && hit.contains && hit.contains(all[i]))) return i;
    }
    return 0;
  }
  function selectBlock(blockEl){
    if(!blockEl) return;
    var col = blockEl.dataset && blockEl.dataset.column || 'left';
    var idx = Number(blockEl.dataset && blockEl.dataset.blockIndex || 0);
    var column = byId('blockColumn');
    if(column && column.value !== col){ column.value = col; dispatchChange(column); }
    try{
      blockEl.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view:W }));
    }catch(_e){ try{ blockEl.click(); }catch(_e2){} }
    // Some browsers update the block list synchronously after column change; click it as a fallback.
    try{
      var item = document.querySelector('#blockList .block-item[data-index="' + idx + '"]');
      if(item) item.click();
    }catch(_e3){}
  }
  function figureHtmlMatches(content){
    var text = String(content || '');
    var out = [];
    var re = /\\begin\{figurehtml\}\s*([\s\S]*?)\s*\\end\{figurehtml\}/g;
    var m;
    while((m = re.exec(text))) out.push({ start:m.index, end:re.lastIndex, inner:m[1], full:m[0], wrapped:true });
    if(out.length) return out;
    var figRe = /<figure\b[\s\S]*?<\/figure>/gi;
    while((m = figRe.exec(text))) out.push({ start:m.index, end:figRe.lastIndex, inner:m[0], full:m[0], wrapped:false });
    return out;
  }
  function extractSvgMarkup(html){
    var s = String(html || '');
    var m = s.match(/<svg\b[\s\S]*?<\/svg>/i);
    if(!m) return '';
    return m[0].replace(/\sdata-selected="1"/g, '').replace(/\sstroke-dasharray="[^\"]*"/g, '');
  }
  function replacementContent(originalContent, figureIndex, newFigureHtml){
    var matches = figureHtmlMatches(originalContent);
    if(!matches.length || !matches[figureIndex]) return null;
    var hit = matches[figureIndex];
    var clean = String(newFigureHtml || '').trim();
    // Preserve existing figure-box / figure metadata such as position, crop, z-index, and manual sizing.
    // Stage 35X only swaps the inner SVG when the original slot already contains one.
    var oldInner = String(hit.inner || '');
    var oldFigureOpen = oldInner.match(/<figure\b([^>]*)>/i);
    var newSvg = cleanSvgForStorage(clean) || extractSvgMarkup(clean);
    if(newSvg && /<svg\b/i.test(oldInner)){
      clean = oldInner.replace(/<svg\b[\s\S]*?<\/svg>/i, newSvg);
    } else if(oldFigureOpen && newSvg){
      clean = '<figure' + (oldFigureOpen[1] || '') + '>' + newSvg + '</figure>';
    }
    var replacement = hit.wrapped ? '\n\\begin{figurehtml}\n' + clean + '\n\\end{figurehtml}\n' : clean;
    return String(originalContent || '').slice(0, hit.start) + replacement + String(originalContent || '').slice(hit.end);
  }
  function currentBlockContent(){ var f = byId('blockContent'); return f ? String(f.value || '') : ''; }
  function stringHash(text){
    var s = String(text || ''), h = 0;
    for(var i=0;i<s.length;i++){ h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return String(h >>> 0);
  }
  function livePreviewBlockForSession(){
    if(!editSession) return null;
    var blockEl = editSession.blockEl;
    if(blockEl && document.body.contains(blockEl)) return blockEl;
    var blocks = Array.from(document.querySelectorAll('#preview .preview-block'));
    for(var i=0;i<blocks.length;i++){
      var b = blocks[i];
      var col = b.dataset && (b.dataset.column || 'left');
      var idx = Number(b.dataset && b.dataset.blockIndex || 0);
      if(col === editSession.column && idx === editSession.blockIndex) return b;
    }
    return blockEl || null;
  }
  function replaceFirstSvgInElement(root, newSvg){
    if(!root || !newSvg) return false;
    var svg = root.querySelector && root.querySelector('svg');
    if(svg){ svg.outerHTML = newSvg; return true; }
    try{ root.insertAdjacentHTML('afterbegin', newSvg); return true; }catch(_e){ return false; }
  }
  function patchLivePreviewFigureBeforeCommit(newFigureHtml){
    if(!editSession) return false;
    var blockEl = livePreviewBlockForSession();
    if(!blockEl || !blockEl.querySelectorAll) return false;
    var embeds = Array.from(blockEl.querySelectorAll('.figure-embed'));
    var embed = embeds[editSession.figureIndex] || null;
    if(!embed){
      var candidates = Array.from(blockEl.querySelectorAll('.figure-box, figure, svg'));
      embed = candidates[editSession.figureIndex] || candidates[0] || null;
    }
    if(!embed) return false;
    var clean = String(newFigureHtml || '').trim();
    var newSvg = extractSvgMarkup(clean);
    var box = embed.querySelector && embed.querySelector('.figure-box');
    var patched = false;
    if(box && newSvg){
      patched = replaceFirstSvgInElement(box, newSvg);
    } else if(newSvg && embed.classList && embed.classList.contains('figure-box')){
      patched = replaceFirstSvgInElement(embed, newSvg);
    } else if(clean && embed.classList && embed.classList.contains('figure-embed')){
      embed.innerHTML = clean;
      patched = true;
    } else if(newSvg){
      patched = replaceFirstSvgInElement(embed, newSvg);
    }
    if(patched){
      STATUS.previewPatchedForCommit = true;
      STATUS.lastPreviewPatchAt = new Date().toISOString();
      try { editSession.blockEl = blockEl; } catch(_e){}
      publish();
    }
    return patched;
  }
  function updateBlockContent(nextContent){
    var field = byId('blockContent');
    if(!field) throw new Error('Could not find blockContent field.');
    field.value = String(nextContent || '');
    dispatchInput(field);
    var app = W.LuminaAppCommands || {};
    if(typeof app.updateBlock === 'function') app.updateBlock();
    else {
      var btn = byId('updateBlockBtn');
      if(btn && typeof btn.click === 'function') btn.click();
    }
  }
  function onEditedFigureHtml(newFigureHtml){
    try{
      if(!editSession) throw new Error('No active figure edit session.');
      selectBlock(editSession.blockEl);
      var content = currentBlockContent() || editSession.originalContent || '';
      var next = replacementContent(content, editSession.figureIndex, newFigureHtml);
      if(next === null && editSession.originalContent){ next = replacementContent(editSession.originalContent, editSession.figureIndex, newFigureHtml); }
      if(next === null) throw new Error('Could not locate the original figure slot to replace.');
      var previewPatched = patchLivePreviewFigureBeforeCommit(newFigureHtml);
      updateBlockContent(next);
      STATUS.previewPatchedForCommit = !!previewPatched;
      STATUS.lastCommitAt = new Date().toISOString();
      STATUS.lastCommitContentHash = stringHash(next);
      STATUS.lastFigureIndex = editSession.figureIndex;
      STATUS.lastBlock = { column: editSession.column, index: editSession.blockIndex };
      STATUS.lastError = '';
      publish();
      showToast('Updated and saved figure from diagram editor.');
      editSession = null;
      setTimeout(annotateFigures, 120);
    }catch(err){ setError(err); }
  }
  W.__stage35uReplaceFigureHtmlFromEditor = onEditedFigureHtml;
  function rootAttrNumber(attrs, name){
    var re = new RegExp('\\s' + name + '\\s*=\\s*("([^"%]+)"|\\\'([^\\\'%]+)\\\'|([^\\s>%]+))', 'i');
    var m = re.exec(String(attrs || ''));
    if(!m) return 0;
    var raw = m[2] || m[3] || m[4] || '';
    var n = parseFloat(raw);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function rootStyleNumber(attrs, name){
    var m = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i.exec(String(attrs || ''));
    var style = m ? (m[2] || m[3] || '') : '';
    var re = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([0-9.]+)px', 'i');
    var hit = re.exec(style);
    var n = hit ? parseFloat(hit[1]) : 0;
    return isFinite(n) && n > 0 ? n : 0;
  }
  function cleanSvgRootForEditor(svgMarkup){
    var s = String(svgMarkup || '');
    return s.replace(/<svg\b([^>]*)>/i, function(_m, attrs){
      attrs = String(attrs || '');
      var view = /\sviewBox\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(attrs);
      var w = rootAttrNumber(attrs, 'width') || rootStyleNumber(attrs, 'width');
      var h = rootAttrNumber(attrs, 'height') || rootStyleNumber(attrs, 'height');
      if(!w || !h){
        var oldView = view && view[1] ? String(view[1]).replace(/^[\'\"]|[\'\"]$/g, '').trim().split(/[ ,]+/).map(Number) : [];
        if(oldView.length >= 4 && isFinite(oldView[2]) && isFinite(oldView[3]) && oldView[2] > 0 && oldView[3] > 0){ w = oldView[2]; h = oldView[3]; }
      }
      if(!w) w = 1000;
      if(!h) h = Math.round(w * 0.7) || 700;
      var cleaned = attrs
        .replace(/\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
        .replace(/\swidth\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
        .replace(/\sheight\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
        .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/ig, '')
        .trim();
      if(!/\sviewBox\s*=/i.test(cleaned)){ cleaned += (cleaned ? ' ' : '') + 'viewBox="0 0 ' + Math.round(w) + ' ' + Math.round(h) + '"'; }
      return '<svg id="svg"' + (cleaned ? ' ' + cleaned : '') + '>';
    });
  }
  function cleanSvgForStorage(svgMarkup){
    var s = extractSvgMarkup(svgMarkup);
    if(!s) return '';
    return s.replace(/<svg\b([^>]*)>/i, function(_m, attrs){
      var cleaned = String(attrs || '')
        .replace(/\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
        .replace(/\swidth\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
        .replace(/\sheight\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/ig, '')
        .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/ig, '')
        .trim();
      return '<svg' + (cleaned ? ' ' + cleaned : '') + '>';
    });
  }
  function safeInitialSvg(svgMarkup){
    var s = String(svgMarkup || '');
    if(!s || !/<svg\b/i.test(s)) return '<svg id="svg" viewBox="0 0 1000 700"></svg>';
    s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/\sdata-selected="1"/g, '').replace(/\sstroke-dasharray="[^\"]*"/g, '');
    return cleanSvgRootForEditor(s);
  }
  function openEditorPopup(initialSvgMarkup){
    var popup = W.open('', '_blank', 'width=1200,height=860');
    if(!popup){ alert('Popup blocked. Please allow popups for this page.'); return; }
    var initialSvgJson = JSON.stringify(safeInitialSvg(initialSvgMarkup));
    var editorHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Edit diagram figure</title><style>
      *{box-sizing:border-box} html,body{margin:0;height:100%;font-family:Inter,Arial,sans-serif;background:#f5f7fb} body{display:grid;grid-template-rows:auto 1fr}
      .bar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;padding:.9rem;background:#111827;color:#fff}.bar button,.bar select{font:inherit;padding:.55rem .75rem;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;cursor:pointer}.bar input[type="text"]{font:inherit;padding:.55rem .75rem;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#fff;color:#111;min-width:180px}.bar input[type="color"]{padding:0;width:44px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:#fff;cursor:pointer}.canvas-wrap{padding:1rem;height:100%;min-height:0}.canvas-wrap svg{width:100%;height:100%;display:block;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:18px;touch-action:none}.hint{margin-left:auto;opacity:.8;font-size:.92rem}[data-selected="1"]{stroke:#2563eb !important;stroke-dasharray:8 6 !important}text[data-selected="1"]{fill:#0b57d0 !important;paint-order:stroke;stroke:#93c5fd !important;stroke-width:2 !important}
    </style>

<style id="stage37h-ui-reset-css">
  :root { --stage37-surface:#f8fafc; --stage37-panel:#ffffff; --stage37-ink:#0f172a; --stage37-muted:#64748b; --stage37-blue:#17365d; --stage37-blue2:#1f4e79; --stage37-line:rgba(15,42,74,.14); --stage37-soft:#edf4fb; }
  body.stage37h-ui-reset { background:linear-gradient(180deg,#eef4fb 0,#f8fafc 38%,#ffffff 100%) !important; color:var(--stage37-ink); }
  body.stage37h-ui-reset .page { gap:1rem; align-items:stretch; }
  body.stage37h-ui-reset .editor-shell { padding:1rem !important; border-radius:24px !important; border:1px solid rgba(15,42,74,.12) !important; box-shadow:0 24px 60px rgba(15,42,74,.10) !important; background:rgba(255,255,255,.96) !important; }
  body.stage37h-ui-reset .editor-intro { padding:.2rem .2rem .7rem; }
  body.stage37h-ui-reset .editor-intro h1 { margin:.1rem 0 .22rem; font-size:clamp(1.35rem,2vw,1.85rem); }
  .stage37-topbar { display:flex; align-items:center; justify-content:space-between; gap:.8rem; margin:.15rem 0 .75rem; padding:.55rem; border:1px solid rgba(15,42,74,.12); border-radius:22px; background:linear-gradient(180deg,#ffffff,#eef4fb); box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 10px 26px rgba(15,42,74,.08); }
  .stage37-mode-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.42rem; flex:1 1 auto; }
  .stage37-mode-tab { appearance:none; border:1px solid rgba(23,54,93,.16); border-radius:17px; background:#fff; color:#17365d; min-height:3.15rem; padding:.55rem .66rem; text-align:left; cursor:pointer; box-shadow:0 2px 8px rgba(15,42,74,.05); transition:transform .14s ease, box-shadow .14s ease, background .14s ease; }
  .stage37-mode-tab:hover { transform:translateY(-1px); box-shadow:0 8px 18px rgba(15,42,74,.1); }
  .stage37-mode-tab.active, .stage37-mode-tab[aria-selected="true"] { background:linear-gradient(180deg,#1f4e79,#17365d); color:#fff; border-color:#17365d; box-shadow:0 10px 24px rgba(23,54,93,.22); }
  .stage37-mode-tab strong { display:block; font-size:.92rem; letter-spacing:-.01em; }
  .stage37-mode-tab span { display:block; margin-top:.14rem; font-size:.68rem; opacity:.76; font-weight:650; white-space:nowrap; }
  .stage37-quick-actions { display:flex; flex-wrap:wrap; gap:.35rem; justify-content:flex-end; flex:0 0 auto; }
  .stage37-quick-actions button { border-radius:999px !important; padding:.48rem .64rem !important; font-size:.72rem !important; }
  body.stage37h-ui-reset .left-tabs.mode-bar.stage35a-workflow-tabs { display:none !important; }
  .stage37-task-card { border:1px solid rgba(15,42,74,.12); border-radius:20px; background:linear-gradient(180deg,#fff,#f6f9fd); padding:.78rem .86rem; margin:0 0 .78rem; box-shadow:0 10px 24px rgba(15,42,74,.07); }
  .stage37-task-card h2 { margin:.08rem 0 .25rem; color:#10233b; font-size:1.08rem; letter-spacing:-.025em; }
  .stage37-task-card p { margin:.15rem 0; color:#64748b; font-size:.82rem; line-height:1.42; }
  .stage37-task-card .stage37-chip-row { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.55rem; }
  .stage37-chip { border:1px solid rgba(23,54,93,.16); background:#eef4fb; color:#17365d; border-radius:999px; padding:.35rem .52rem; font-size:.72rem; font-weight:760; }
  .stage37-step-list { counter-reset:stage37step; display:grid; gap:.45rem; margin-top:.6rem; }
  .stage37-step { position:relative; padding:.56rem .62rem .56rem 2.25rem; border:1px solid rgba(15,42,74,.1); border-radius:16px; background:#fff; color:#334155; font-size:.78rem; line-height:1.35; }
  .stage37-step:before { counter-increment:stage37step; content:counter(stage37step); position:absolute; left:.62rem; top:.54rem; width:1.15rem; height:1.15rem; display:grid; place-items:center; border-radius:999px; background:#17365d; color:#fff; font-size:.68rem; font-weight:800; }
  body.stage37h-ui-reset .left-pane { padding-bottom:.4rem; }
  body.stage37h-ui-reset .left-pane > .panel, body.stage37h-ui-reset .copilot-panel, body.stage37h-ui-reset .preview-wrap, body.stage37h-ui-reset .right-shell > .panel { border-radius:22px !important; border-color:rgba(15,42,74,.12) !important; box-shadow:0 16px 38px rgba(15,42,74,.09) !important; }
  body.stage37h-ui-reset .subtabs { border-radius:16px !important; background:#e8eff7 !important; padding:.25rem !important; gap:.25rem !important; }
  body.stage37h-ui-reset .subtab { border-radius:12px !important; }
  body.stage37h-ui-reset .field-grid { gap:.68rem !important; }
  body.stage37h-ui-reset .field label { font-size:.74rem; color:#17365d; }
  body.stage37h-ui-reset input, body.stage37h-ui-reset textarea, body.stage37h-ui-reset select { border-radius:13px !important; border-color:rgba(15,42,74,.18) !important; background:#fff !important; }
  body.stage37h-ui-reset textarea.code, body.stage37h-ui-reset .copilot-json, body.stage37h-ui-reset #slideJson { background:#0f172a !important; color:#e5eef8 !important; border-color:rgba(148,163,184,.35) !important; }
  .stage37-section-header { display:flex; align-items:flex-start; justify-content:space-between; gap:.8rem; margin:.1rem 0 .65rem; }
  .stage37-section-header h2 { margin:0; color:#10233b; font-size:1.12rem; letter-spacing:-.025em; }
  .stage37-section-header p { margin:.16rem 0 0; color:#64748b; font-size:.8rem; line-height:1.35; }
  .stage37-copilot-toolbar { position:sticky; top:.4rem; z-index:5; display:flex; flex-wrap:wrap; gap:.4rem; align-items:center; justify-content:space-between; margin:.2rem 0 .75rem; padding:.55rem; border-radius:18px; background:rgba(238,244,251,.94); border:1px solid rgba(23,54,93,.12); backdrop-filter:blur(10px); }
  .stage37-copilot-toolbar .stage37-copilot-actions-left { display:flex; gap:.38rem; flex-wrap:wrap; }
  body.stage37h-ui-reset .copilot-panel .field.full { padding:.65rem; border:1px solid rgba(15,42,74,.1); border-radius:18px; background:#fff; }
  body.stage37h-ui-reset .copilot-panel .field.full:has(#copilotModel), body.stage37h-ui-reset .copilot-panel .field.full:has(#copilotEndpoint), body.stage37h-ui-reset .copilot-panel .field.full:has(#copilotApiKey) { background:#f8fafc; }
  body.stage37h-ui-reset .copilot-actions { position:sticky; bottom:.55rem; z-index:6; background:rgba(255,255,255,.94); border:1px solid rgba(15,42,74,.12); border-radius:18px; padding:.55rem; backdrop-filter:blur(10px); box-shadow:0 10px 30px rgba(15,42,74,.12); }
  .stage37-inspector-card { position:relative; }
  .stage37-inspector-meta { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.54rem .6rem; margin:.55rem 0 .72rem; border-radius:15px; background:#eef4fb; border:1px solid rgba(23,54,93,.12); color:#17365d; }
  .stage37-inspector-meta strong { font-size:.79rem; }
  .stage37-inspector-meta span { font-size:.72rem; color:#64748b; }
  body.stage37-no-selection .preview-block-props .field-grid { opacity:.72; }
  body.stage37-selected-figure .preview-block-props .field-grid { display:none; }
  body.stage37-selected-figure .preview-block-props:after { content:'Figure selected: use the floating figure action palette for edit, crop, fit, align, and ordering controls.'; display:block; padding:.65rem .7rem; border-radius:15px; background:#f8fafc; color:#475569; border:1px dashed rgba(23,54,93,.22); font-size:.78rem; line-height:1.4; }
  .stage37-export-preview { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:.36rem; padding:.56rem; border:1px solid rgba(15,42,74,.1); border-radius:17px; background:#f8fafc; margin:.55rem 0 .65rem; }
  .stage37-export-preview span { text-align:center; font-size:.68rem; font-weight:760; color:#17365d; background:#fff; border:1px solid rgba(23,54,93,.12); border-radius:999px; padding:.36rem .2rem; }
  .stage37-advanced-note { border-left:4px solid #d97706; background:#fffbeb; color:#78350f; padding:.65rem .75rem; border-radius:14px; font-size:.78rem; line-height:1.4; margin:.5rem 0 .75rem; }
  .stage37-dev-only { outline:2px dashed rgba(217,119,6,.18); outline-offset:3px; }
  @media (max-width: 980px){
    .stage37-topbar { display:block; }
    .stage37-mode-tabs { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .stage37-quick-actions { margin-top:.45rem; justify-content:flex-start; }
    .stage37-mode-tab span { white-space:normal; }
    .stage37-export-preview { grid-template-columns:repeat(2,minmax(0,1fr)); }
  }
</style>

</head><body><div class="bar"><select id="tool"><option value="select">Select / move</option><option value="pen">Pen</option><option value="erase">Erase</option><option value="line">Line / arrow</option><option value="rect">Rectangle</option><option value="ellipse">Ellipse</option><option value="text">Text</option></select><select id="pointerSource"><option value="any" selected>Any pointer</option><option value="pen">Stylus only</option><option value="touch">Finger only</option><option value="mouse">Mouse only</option></select><input id="textInput" type="text" placeholder="Text for text tool" value="Label" /><label style="display:flex;align-items:center;gap:.35rem">Color <input id="drawColor" type="color" value="#111111" /></label><button id="undoBtn">Undo</button><button id="deleteBtn">Delete selected</button><button id="clearBtn">Clear</button><button id="insertBtn">Save back to slide</button><span class="hint">Double-clicked figure loaded from the slide. Edit, then save back.</span></div><div class="canvas-wrap" id="canvasWrap"></div><script>
    const INITIAL_SVG = ${initialSvgJson};
    const wrap = document.getElementById('canvasWrap');
    wrap.innerHTML = INITIAL_SVG;
    let svg = document.getElementById('svg') || wrap.querySelector('svg');
    if(!svg){ wrap.innerHTML = '<svg id="svg" viewBox="0 0 1000 700"></svg>'; svg = document.getElementById('svg'); }
    svg.setAttribute('id','svg');
    const toolEl = document.getElementById('tool'); const pointerSourceEl = document.getElementById('pointerSource'); const textInput = document.getElementById('textInput'); const drawColorInput = document.getElementById('drawColor');
    let drawing = null, selected = null, dragOffset = null; const made = Array.from(svg.querySelectorAll('rect,ellipse,line,polyline,text,path,circle')).filter(el=>el !== svg);
    function pt(evt){ const r=svg.getBoundingClientRect(); const vb=(svg.getAttribute('viewBox')||'0 0 1000 700').split(/\\s+/).map(Number); const vx=isFinite(vb[0])?vb[0]:0, vy=isFinite(vb[1])?vb[1]:0, vw=isFinite(vb[2])?vb[2]:1000, vh=isFinite(vb[3])?vb[3]:700; return {x:vx+(evt.clientX-r.left)*vw/r.width,y:vy+(evt.clientY-r.top)*vh/r.height}; }
    function allowedPointer(evt){ const pref=pointerSourceEl.value; if(pref==='any') return true; return (evt.pointerType||'mouse')===pref; }
    function currentDrawColor(){ return drawColorInput && drawColorInput.value ? drawColorInput.value : '#111111'; }
    function applyColorToSelected(){ if(!selected) return; const tag=selected.tagName.toLowerCase(); const color=currentDrawColor(); if(tag==='text') selected.setAttribute('fill',color); else selected.setAttribute('stroke',color); }
    function baseStyle(el,evt){ const pressure=evt&&typeof evt.pressure==='number'&&evt.pressure>0?evt.pressure:0.5; const width=evt&&evt.pointerType==='pen'?(2+pressure*4).toFixed(2):'3'; el.setAttribute('stroke',currentDrawColor()); el.setAttribute('stroke-width',width); el.setAttribute('fill','transparent'); el.style.vectorEffect='non-scaling-stroke'; const tag=(el.tagName||'').toLowerCase(); el.setAttribute('pointer-events', tag==='line'||tag==='polyline'?'visibleStroke':'all'); }
    function hitTarget(target){ if(!target||target===svg) return null; return target.closest('rect,ellipse,line,polyline,text,path,circle'); }
    function clearSelection(){ if(selected) selected.removeAttribute('data-selected'); selected=null; }
    function selectElement(el){ clearSelection(); if(el&&el!==svg){ selected=el; selected.setAttribute('data-selected','1'); } }
    function add(el,sel){ svg.appendChild(el); made.push(el); if(sel) selectElement(el); }
    function removeEl(el){ if(!el||el===svg) return; if(selected===el) clearSelection(); const i=made.indexOf(el); if(i>=0) made.splice(i,1); el.remove(); }
    function moveSelected(dx,dy){ if(!selected) return; const tag=selected.tagName.toLowerCase(); if(tag==='rect'){ selected.setAttribute('x',(parseFloat(selected.getAttribute('x'))||0)+dx); selected.setAttribute('y',(parseFloat(selected.getAttribute('y'))||0)+dy); } else if(tag==='ellipse'||tag==='circle'){ selected.setAttribute('cx',(parseFloat(selected.getAttribute('cx'))||0)+dx); selected.setAttribute('cy',(parseFloat(selected.getAttribute('cy'))||0)+dy); } else if(tag==='line'){ ['x1','x2'].forEach(k=>selected.setAttribute(k,(parseFloat(selected.getAttribute(k))||0)+dx)); ['y1','y2'].forEach(k=>selected.setAttribute(k,(parseFloat(selected.getAttribute(k))||0)+dy)); } else if(tag==='polyline'){ const pts=(selected.getAttribute('points')||'').trim().split(/\\s+/).filter(Boolean).map(p=>p.split(',').map(Number)); selected.setAttribute('points', pts.map(p=>(p[0]+dx)+','+(p[1]+dy)).join(' ')); } else if(tag==='text'){ selected.setAttribute('x',(parseFloat(selected.getAttribute('x'))||0)+dx); selected.setAttribute('y',(parseFloat(selected.getAttribute('y'))||0)+dy); } }
    svg.addEventListener('pointerdown',evt=>{ if(!allowedPointer(evt)) return; const tool=toolEl.value, p=pt(evt); if(tool==='select'){ const hit=hitTarget(evt.target); if(hit){ selectElement(hit); dragOffset={x:p.x,y:p.y}; } else clearSelection(); svg.setPointerCapture(evt.pointerId); return; } if(tool==='erase'){ const hit=hitTarget(evt.target); if(hit) removeEl(hit); svg.setPointerCapture(evt.pointerId); return; } clearSelection(); if(tool==='pen'){ const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline'); baseStyle(poly,evt); poly.setAttribute('points',p.x+','+p.y); drawing={tool,el:poly}; add(poly,false); } else if(tool==='line'){ const line=document.createElementNS('http://www.w3.org/2000/svg','line'); baseStyle(line,evt); line.setAttribute('x1',p.x); line.setAttribute('y1',p.y); line.setAttribute('x2',p.x); line.setAttribute('y2',p.y); drawing={tool,el:line,start:p}; add(line,false); } else if(tool==='rect'){ const rect=document.createElementNS('http://www.w3.org/2000/svg','rect'); baseStyle(rect,evt); rect.setAttribute('x',p.x); rect.setAttribute('y',p.y); rect.setAttribute('width',1); rect.setAttribute('height',1); drawing={tool,el:rect,start:p}; add(rect,false); } else if(tool==='ellipse'){ const e=document.createElementNS('http://www.w3.org/2000/svg','ellipse'); baseStyle(e,evt); e.setAttribute('cx',p.x); e.setAttribute('cy',p.y); e.setAttribute('rx',1); e.setAttribute('ry',1); drawing={tool,el:e,start:p}; add(e,false); } else if(tool==='text'){ const t=document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x',p.x); t.setAttribute('y',p.y); t.setAttribute('fill',currentDrawColor()); t.setAttribute('font-size','28'); t.setAttribute('font-family','Arial, Helvetica, sans-serif'); t.setAttribute('pointer-events','all'); t.textContent=textInput.value||'Text'; add(t,false); } svg.setPointerCapture(evt.pointerId); });
    svg.addEventListener('pointermove',evt=>{ if(!allowedPointer(evt)) return; const p=pt(evt); if(toolEl.value==='erase'&&(evt.buttons&1)){ const hit=hitTarget(evt.target); if(hit) removeEl(hit); return; } if(selected&&dragOffset&&toolEl.value==='select'){ const dx=p.x-dragOffset.x, dy=p.y-dragOffset.y; dragOffset=p; moveSelected(dx,dy); return; } if(!drawing) return; if(drawing.tool==='pen'){ drawing.el.setAttribute('points',(drawing.el.getAttribute('points')||'')+' '+p.x+','+p.y); } else if(drawing.tool==='line'){ drawing.el.setAttribute('x2',p.x); drawing.el.setAttribute('y2',p.y); } else if(drawing.tool==='rect'){ const x=Math.min(drawing.start.x,p.x), y=Math.min(drawing.start.y,p.y); drawing.el.setAttribute('x',x); drawing.el.setAttribute('y',y); drawing.el.setAttribute('width',Math.abs(p.x-drawing.start.x)); drawing.el.setAttribute('height',Math.abs(p.y-drawing.start.y)); } else if(drawing.tool==='ellipse'){ drawing.el.setAttribute('cx',(drawing.start.x+p.x)/2); drawing.el.setAttribute('cy',(drawing.start.y+p.y)/2); drawing.el.setAttribute('rx',Math.abs(p.x-drawing.start.x)/2); drawing.el.setAttribute('ry',Math.abs(p.y-drawing.start.y)/2); } });
    function stopInteraction(){ drawing=null; dragOffset=null; if(toolEl.value!=='select') clearSelection(); }
    svg.addEventListener('pointerup',stopInteraction); svg.addEventListener('pointercancel',stopInteraction); document.getElementById('undoBtn').addEventListener('click',()=>{ const el=made.pop(); if(el){ if(selected===el) clearSelection(); el.remove(); } }); document.getElementById('deleteBtn').addEventListener('click',()=>removeEl(selected)); document.getElementById('clearBtn').addEventListener('click',()=>{ while(svg.firstChild) svg.removeChild(svg.firstChild); made.length=0; clearSelection(); }); if(drawColorInput) drawColorInput.addEventListener('input',applyColorToSelected);
    function trimmedSvgMarkup(){ clearSelection(); const clone=svg.cloneNode(true); Array.from(clone.querySelectorAll('[data-selected]')).forEach(el=>el.removeAttribute('data-selected')); clone.removeAttribute('id'); clone.removeAttribute('width'); clone.removeAttribute('height'); clone.removeAttribute('style'); return clone.outerHTML; }
    document.getElementById('insertBtn').addEventListener('click',()=>{ const svgMarkup=trimmedSvgMarkup(); if(window.opener&&!window.opener.closed&&typeof window.opener.__stage35uReplaceFigureHtmlFromEditor==='function'){ window.opener.__stage35uReplaceFigureHtmlFromEditor('<figure>'+svgMarkup+'</figure>'); window.close(); } else alert('Could not send the diagram back to the generator.'); });
    window.addEventListener('keydown',evt=>{ if((evt.key==='Delete'||evt.key==='Backspace')&&selected){ evt.preventDefault(); removeEl(selected); } });
    <\/script>










</body></html>`;
    popup.document.open(); popup.document.write(editorHtml); popup.document.close();
  }
  function openFigureEditFromPreview(target){
    try{
      var figTarget = closestFigureEmbed(target);
      var blockEl = findPreviewBlock(target);
      if(!figTarget || !blockEl) return false;
      var svgEl = (figTarget.matches && figTarget.matches('svg')) ? figTarget : (figTarget.querySelector && figTarget.querySelector('svg'));
      if(!svgEl) return false;
      var figureIndex = figureIndexWithinBlock(figTarget, blockEl);
      selectBlock(blockEl);
      var content = currentBlockContent();
      var matches = figureHtmlMatches(content);
      var sourceHtml = matches[figureIndex] && matches[figureIndex].inner || '';
      var sourceSvg = extractSvgMarkup(sourceHtml) || (svgEl.outerHTML || '');
      if(!sourceSvg) throw new Error('Could not find an editable SVG in this figure.');
      editSession = {
        blockEl: blockEl,
        column: blockEl.dataset && blockEl.dataset.column || 'left',
        blockIndex: Number(blockEl.dataset && blockEl.dataset.blockIndex || 0),
        figureIndex: figureIndex,
        originalContent: content
      };
      STATUS.lastOpenAt = new Date().toISOString();
      STATUS.lastFigureIndex = figureIndex;
      STATUS.lastBlock = { column: editSession.column, index: editSession.blockIndex };
      STATUS.lastError = '';
      publish();
      openEditorPopup(sourceSvg);
      return true;
    }catch(err){ setError(err); showToast('Could not open this figure for editing.'); return false; }
  }
  function annotateFigures(){
    var preview = byId('preview');
    if(!preview) return publish();
    var count = 0;
    Array.from(preview.querySelectorAll('.figure-embed, .figure-box')).forEach(function(el){
      if(el.querySelector && el.querySelector('svg')){ el.dataset.stage35uFigureEditable = '1'; count += 1; }
    });
    STATUS.annotatedCount = count;
    publish();
  }
  function bind(){
    var preview = byId('preview');
    if(!preview){ publish(); return; }
    if(preview.dataset.stage35uEditableFiguresBound !== '1'){
      preview.dataset.stage35uEditableFiguresBound = '1';
      preview.addEventListener('dblclick', function(event){
        var target = closestFigureTarget(event.target);
        if(!target || !preview.contains(target)) return;
        var hasSvg = (target.matches && target.matches('svg')) || (target.querySelector && target.querySelector('svg'));
        if(!hasSvg) return;
        event.preventDefault();
        event.stopPropagation();
        openFigureEditFromPreview(target);
      }, true);
      try{
        var observer = new MutationObserver(annotateFigures);
        observer.observe(preview, { childList:true, subtree:true });
        W.__LUMINA_STAGE35U_EDITABLE_FIGURES_OBSERVER = observer;
      }catch(e){ setError(e); }
    }
    STATUS.bound = true;
    annotateFigures();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  W.LuminaStage35UEditableFigures = { stage: STAGE, init: bind, status: publish, openFromPreview: openFigureEditFromPreview, replaceFigureHtml: onEditedFigureHtml };
})();
