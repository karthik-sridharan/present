// Stage 16 figure insertion helpers extracted from legacy-app.js.
// Classic browser script: exposes helpers on window; no ES modules.
(function(){
  'use strict';

  function buildImageFigureHtml(src, alt, escapeAttr){
    const esc = typeof escapeAttr === 'function' ? escapeAttr : (value => String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
    const safeSrc = esc(src || '');
    const safeAlt = esc(alt || '');
    return '<figure data-figure-kind="image" data-box-x="0" data-box-y="0" data-box-w="" data-box-h="" data-original-w="" data-original-h="" data-lock-aspect="1" data-user-moved="0" data-user-sized="0" data-crop="0" data-z-index="1" data-object-fit="contain"><img src="' + safeSrc + '" alt="' + safeAlt + '" /></figure>';
  }

  function insertTextAtCursor(textarea, snippet){
    const value = textarea.value || '';
    const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : value.length;
    const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : value.length;
    textarea.value = value.slice(0, start) + snippet + value.slice(end);
    const pos = start + snippet.length;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = pos;
  }

  function createApi(deps){
    deps = deps || {};
    const getBlockFields = deps.getBlockFields || (()=>({}));
    const currentColumnName = deps.currentColumnName;
    const blockArray = deps.blockArray;
    const selectedIndex = deps.selectedIndex;
    const setSelectedIndex = deps.setSelectedIndex;
    const loadSelectedBlockIntoEditor = deps.loadSelectedBlockIntoEditor;
    const buildPreview = deps.buildPreview;
    const persistAutosaveNow = deps.persistAutosaveNow;
    const saveCurrentBlockToDraft = deps.saveCurrentBlockToDraft;
    const showToast = deps.showToast || (()=>{});
    const escapeAttr = deps.escapeAttr;
    const getFigureModal = deps.getFigureModal || (()=>null);
    const getFigureImagePanel = deps.getFigureImagePanel || (()=>null);
    const getFigureEditorPanel = deps.getFigureEditorPanel || (()=>null);

    function currentFigureMode(){
      return getBlockFields().mode?.value || 'panel';
    }
    function wrapFigureHtml(html){
      return '\n\\begin{figurehtml}\n' + html + '\n\\end{figurehtml}\n';
    }
    function insertFigureAsNewCustomBlock(html){
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      const block = { mode:'plain', title:'Figure', content: wrapFigureHtml(String(html || '').trim()) };
      const insertAt = idx >= 0 ? idx + 1 : arr.length;
      arr.splice(insertAt, 0, block);
      setSelectedIndex(name, insertAt);
      loadSelectedBlockIntoEditor();
      buildPreview();
      persistAutosaveNow('Autosaved after inserting figure.');
      showToast('Added figure as a new block.');
    }
    function insertFigureHtml(html){
      const blockFields = getBlockFields();
      const clean = String(html || '').trim();
      if(!clean) return;
      const mode = currentFigureMode();
      if(mode === 'custom'){
        insertTextAtCursor(blockFields.content, (blockFields.content.value && !blockFields.content.value.endsWith('\n') ? '\n' : '') + clean + '\n');
        saveCurrentBlockToDraft();
        buildPreview();
        persistAutosaveNow('Autosaved after inserting figure.');
        showToast('Inserted figure into custom HTML block.');
        return;
      }
      if(mode === 'panel' || mode === 'plain'){
        insertTextAtCursor(blockFields.content, wrapFigureHtml(clean));
        saveCurrentBlockToDraft();
        buildPreview();
        persistAutosaveNow('Autosaved after inserting figure.');
        showToast('Inserted figure into the current block.');
        return;
      }
      insertFigureAsNewCustomBlock(clean);
    }
    function openFigureModal(){
      const figureImagePanel = getFigureImagePanel();
      const figureEditorPanel = getFigureEditorPanel();
      const figureModal = getFigureModal();
      if(figureImagePanel) figureImagePanel.style.display = '';
      if(figureEditorPanel) figureEditorPanel.style.display = 'none';
      if(figureModal) figureModal.hidden = false;
    }
    function closeFigureModal(){
      const figureModal = getFigureModal();
      if(figureModal) figureModal.hidden = true;
    }

    return {
      insertTextAtCursor,
      currentFigureMode,
      wrapFigureHtml,
      insertFigureAsNewCustomBlock,
      insertFigureHtml,
      buildImageFigureHtml: (src, alt) => buildImageFigureHtml(src, alt, escapeAttr),
      openFigureModal,
      closeFigureModal
    };
  }

  window.LuminaFigureInsert = {
    buildImageFigureHtml,
    insertTextAtCursor,
    createApi
  };
})();
