(function(){
  'use strict';
  var W = window;
  var STAGE = W.LUMINA_STAGE || 'stage38n-20260427-1';
  var STATUS = {
    stage: STAGE,
    directPreviewEdit: true,
    editableRoles: ['title', 'kicker', 'lede', 'text-like blocks'],
    excluded: ['custom HTML / iframes', 'figure blocks', 'MathJax-rendered blocks'],
    annotatedCount: 0,
    lastEditRole: '',
    lastEditAt: '',
    lastEditSummary: '',
    lastSyncError: '',
    behaviorChanged: false
  };
  function publish(){ W.__LUMINA_STAGE35T_DIRECT_PREVIEW_EDIT = Object.assign({}, STATUS); return W.__LUMINA_STAGE35T_DIRECT_PREVIEW_EDIT; }
  function byId(id){ return document.getElementById(id); }
  function textOf(el){ return String((el && el.innerText) || (el && el.textContent) || '').replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim(); }
  function dispatchInput(el){ if(el) el.dispatchEvent(new Event('input', { bubbles:true })); }
  function dispatchChange(el){ if(el) el.dispatchEvent(new Event('change', { bubbles:true })); }
  function lineText(el){ return textOf(el).replace(/\s+/g, ' ').trim(); }
  function itemText(el){ return textOf(el).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function cleanBraces(text){ return String(text || '').replace(/[{}]/g, '').trim(); }
  function pushLine(out, line){ line = String(line || '').trim(); if(!line) return; line = line.replace(/^P:\s*/i, '').replace(/^UL:\s*/i, '- '); if(line) out.push(line); }
  function richNodeToLines(node, out){
    if(!node) return;
    if(node.nodeType === 3){
      var t = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if(t) pushLine(out, t);
      return;
    }
    if(node.nodeType !== 1) return;
    var tag = node.tagName ? node.tagName.toLowerCase() : '';
    if(tag === 'br'){ return; }
    if(tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'iframe' || tag === 'figure') return;
    if(node.classList && (node.classList.contains('figure-embed') || node.classList.contains('MathJax') || node.matches('mjx-container'))){ return; }
    if(/^h[1-6]$/.test(tag)){
      var h = lineText(node);
      if(h) pushLine(out, '\\paragraph{' + cleanBraces(h) + '}');
      return;
    }
    if(tag === 'p'){
      var p = lineText(node);
      if(p) pushLine(out, p);
      return;
    }
    if(tag === 'ul' || tag === 'ol'){
      var items = Array.from(node.children || []).filter(function(ch){ return ch.tagName && ch.tagName.toLowerCase() === 'li'; }).map(itemText).filter(Boolean);
      if(items.length){
        pushLine(out, tag === 'ol' ? '\\begin{enumerate}' : '\\begin{itemize}');
        items.forEach(function(it){ pushLine(out, '\\item ' + it); });
        pushLine(out, tag === 'ol' ? '\\end{enumerate}' : '\\end{itemize}');
      }
      return;
    }
    if(node.classList && (node.classList.contains('display-math') || node.classList.contains('pseudo-latex-block'))){
      var m = textOf(node);
      if(m) pushLine(out, m);
      return;
    }
    if(node.classList && node.classList.contains('bullet-card')){
      var label = '';
      var b = node.querySelector('b,strong');
      if(b) label = lineText(b);
      var body = textOf(node).replace(label, '').trim();
      if(label) pushLine(out, '\\paragraph{' + cleanBraces(label) + '}');
      if(body) pushLine(out, body.replace(/\n+/g, ' '));
      return;
    }
    var children = Array.from(node.childNodes || []);
    if(!children.length){
      var txt = lineText(node);
      if(txt) pushLine(out, txt);
      return;
    }
    if(tag === 'div' && !node.classList.contains('rich')){
      var before = out.length;
      children.forEach(function(ch){ richNodeToLines(ch, out); });
      if(out.length === before){
        var d = lineText(node);
        if(d) pushLine(out, d);
      }
      return;
    }
    children.forEach(function(ch){ richNodeToLines(ch, out); });
  }
  function richToGenerator(root){
    var out = [];
    Array.from(root && root.childNodes || []).forEach(function(ch){ richNodeToLines(ch, out); });
    out = out.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
    if(out.length) return out.join('\n');
    var txt = textOf(root);
    return txt ? txt : '';
  }
  function blockContentFromEditable(editable, blockEl){
    var mode = (blockEl && blockEl.dataset && blockEl.dataset.blockMode) || 'panel';
    if(mode === 'pseudocode' || mode === 'pseudocode-latex') return textOf(editable);
    if(mode === 'placeholder') return textOf(editable);
    var rich = editable.classList && editable.classList.contains('rich') ? editable : editable.querySelector('.rich');
    return richToGenerator(rich || editable);
  }
  function setStatus(role, summary){
    STATUS.lastEditRole = role || '';
    STATUS.lastEditAt = new Date().toISOString();
    STATUS.lastEditSummary = String(summary || '').slice(0, 120);
    STATUS.lastSyncError = '';
    publish();
  }
  function markError(err){
    STATUS.lastSyncError = err && err.message ? err.message : String(err || 'Unknown direct edit sync error');
    publish();
  }
  function commitRoleEdit(role, editable){
    try{
      var id = role === 'title' ? 'title' : role === 'kicker' ? 'kicker' : role === 'lede' ? 'lede' : '';
      var field = byId(id);
      if(!field) return;
      var value = textOf(editable);
      if(field.value !== value){ field.value = value; dispatchInput(field); }
      setStatus(role, value);
      var app = W.LuminaAppCommands || {};
      if(typeof app.showToast === 'function') app.showToast('Updated ' + (role === 'lede' ? 'intro line' : role) + ' from preview.');
    }catch(err){ markError(err); }
  }
  function commitBlockEdit(editable){
    try{
      var blockEl = editable.closest && editable.closest('.preview-block');
      if(!blockEl) return;
      var col = blockEl.dataset.column || 'left';
      var content = blockContentFromEditable(editable, blockEl);
      var column = byId('blockColumn');
      var contentField = byId('blockContent');
      if(column && column.value !== col){ column.value = col; dispatchChange(column); }
      if(contentField && contentField.value !== content){ contentField.value = content; dispatchInput(contentField); }
      setStatus('block', (col === 'right' ? 'Right' : 'Left') + ' block ' + (Number(blockEl.dataset.blockIndex || 0) + 1));
      var app = W.LuminaAppCommands || {};
      if(typeof app.showToast === 'function') app.showToast('Updated block text from preview.');
    }catch(err){ markError(err); }
  }
  function roleOfEditable(el){ return el && el.dataset && el.dataset.stage35tDirectRole || ''; }
  function makeEditable(el, role, label){
    if(!el || el.dataset.stage35tDirectEditable === '1') return 0;
    el.dataset.stage35tDirectEditable = '1';
    el.dataset.stage35tDirectRole = role;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', label || 'Editable preview text');
    el.addEventListener('focus', function(){ el.dataset.stage35tOriginalText = textOf(el); }, true);
    el.addEventListener('keydown', function(e){
      var r = roleOfEditable(el);
      if((r === 'title' || r === 'kicker') && e.key === 'Enter'){ e.preventDefault(); el.blur(); }
      if((e.metaKey || e.ctrlKey) && e.key === 'Enter'){ e.preventDefault(); el.blur(); }
      e.stopPropagation();
    });
    el.addEventListener('paste', function(e){
      if(!e.clipboardData || !document.execCommand) return;
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain') || '');
    });
    el.addEventListener('blur', function(){
      var r = roleOfEditable(el);
      if(r === 'block') commitBlockEdit(el);
      else commitRoleEdit(r, el);
    }, true);
    return 1;
  }
  function removeEditable(el){
    if(!el || el.dataset.stage35tDirectEditable !== '1') return;
    el.removeAttribute('contenteditable');
    el.removeAttribute('tabindex');
    delete el.dataset.stage35tDirectEditable;
    delete el.dataset.stage35tDirectRole;
  }
  function blockIsUnsafe(blockEl){
    if(!blockEl) return true;
    var mode = (blockEl.dataset && blockEl.dataset.blockMode) || 'panel';
    if(mode === 'custom' || mode === 'diagram') return true;
    if(blockEl.querySelector('iframe,.custom-frame-wrap,figure,.figure-box,.figure-embed,mjx-container,.MathJax')) return true;
    return false;
  }
  function editableForBlock(blockEl){
    var mode = (blockEl.dataset && blockEl.dataset.blockMode) || 'panel';
    if(mode === 'pseudocode') return blockEl.querySelector('pre.pseudo-block');
    if(mode === 'pseudocode-latex') return blockEl.querySelector('.pseudo-latex-block');
    if(mode === 'placeholder') return blockEl.querySelector('.placeholder');
    return blockEl.querySelector('.rich') || blockEl;
  }
  var annotateTimer = null;
  function scheduleAnnotate(){ if(annotateTimer) W.clearTimeout(annotateTimer); annotateTimer = W.setTimeout(annotatePreview, 90); }
  function annotatePreview(){
    annotateTimer = null;
    var preview = byId('preview');
    if(!preview) return publish();
    var titleText = preview.querySelector('.preview-title h1, .preview-title h2, .preview-title h3');
    makeEditable(titleText, 'title', 'Editable slide title');
    var kicker = preview.querySelector('.kicker');
    if(kicker) makeEditable(kicker, 'kicker', 'Editable slide subtitle or kicker');
    var lede = preview.querySelector('.lede');
    if(lede) makeEditable(lede, 'lede', 'Editable slide intro line');
    Array.from(preview.querySelectorAll('.preview-block')).forEach(function(blockEl){
      var editable = editableForBlock(blockEl);
      if(blockIsUnsafe(blockEl)){ removeEditable(editable); return; }
      makeEditable(editable, 'block', 'Editable slide content block');
    });
    var wrap = document.querySelector('.preview-wrap');
    if(wrap) wrap.classList.add('stage35t-direct-preview-edit-ready');
    STATUS.annotatedCount = preview.querySelectorAll('[data-stage35t-direct-editable="1"]').length;
    publish();
  }
  function init(){
    var preview = byId('preview');
    if(!preview){ publish(); return; }
    scheduleAnnotate();
    try{
      var observer = new MutationObserver(scheduleAnnotate);
      observer.observe(preview, { childList:true, subtree:true });
      W.__LUMINA_STAGE35T_DIRECT_PREVIEW_EDIT_OBSERVER = observer;
    }catch(e){ markError(e); }
    publish();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  W.LuminaStage35TDirectPreviewEdit = { stage: STAGE, init: init, annotate: annotatePreview, status: publish, commitBlockEdit: commitBlockEdit };
})();
