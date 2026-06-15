/* Stage 34C: browser-compatible ES module version of figure insertion helpers.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */

export function buildImageFigureHtml(src, alt, escapeAttr) {
  var esc = typeof escapeAttr === 'function' ? escapeAttr : function (value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var safeSrc = esc(src || '');
  var safeAlt = esc(alt || '');
  return '<figure data-figure-kind="image" data-box-x="0" data-box-y="0" data-box-w="" data-box-h="" data-original-w="" data-original-h="" data-lock-aspect="1" data-user-moved="0" data-user-sized="0" data-crop="0" data-z-index="1" data-object-fit="contain"><img src="' + safeSrc + '" alt="' + safeAlt + '" /></figure>';
}

export function insertTextAtCursor(textarea, snippet) {
  var value = textarea.value || '';
  var start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : value.length;
  var end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : value.length;
  textarea.value = value.slice(0, start) + snippet + value.slice(end);
  var pos = start + snippet.length;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = pos;
}

export function createApi(deps) {
  deps = deps || {};
  var getBlockFields = deps.getBlockFields || function () { return {}; };
  var currentColumnName = deps.currentColumnName;
  var blockArray = deps.blockArray;
  var selectedIndex = deps.selectedIndex;
  var setSelectedIndex = deps.setSelectedIndex;
  var loadSelectedBlockIntoEditor = deps.loadSelectedBlockIntoEditor;
  var buildPreview = deps.buildPreview;
  var persistAutosaveNow = deps.persistAutosaveNow;
  var saveCurrentBlockToDraft = deps.saveCurrentBlockToDraft;
  var showToast = deps.showToast || function () {};
  var escapeAttr = deps.escapeAttr;
  var getFigureModal = deps.getFigureModal || function () { return null; };
  var getFigureImagePanel = deps.getFigureImagePanel || function () { return null; };
  var getFigureEditorPanel = deps.getFigureEditorPanel || function () { return null; };

  function currentFigureMode() {
    var fields = getBlockFields();
    return fields.mode && fields.mode.value ? fields.mode.value : 'panel';
  }
  function wrapFigureHtml(html) { return '\n\\begin{figurehtml}\n' + html + '\n\\end{figurehtml}\n'; }
  function insertFigureAsNewCustomBlock(html) {
    var name = currentColumnName();
    var arr = blockArray(name);
    var idx = selectedIndex(name);
    var block = { mode:'plain', title:'Figure', content:wrapFigureHtml(String(html || '').trim()) };
    var insertAt = idx >= 0 ? idx + 1 : arr.length;
    arr.splice(insertAt, 0, block);
    setSelectedIndex(name, insertAt);
    loadSelectedBlockIntoEditor();
    buildPreview();
    persistAutosaveNow('Autosaved after inserting figure.');
    showToast('Added figure as a new block.');
  }
  function insertFigureHtml(html) {
    var blockFields = getBlockFields();
    var clean = String(html || '').trim();
    if (!clean) return;
    var mode = currentFigureMode();
    if (mode === 'custom') {
      insertTextAtCursor(blockFields.content, (blockFields.content.value && !blockFields.content.value.endsWith('\n') ? '\n' : '') + clean + '\n');
      saveCurrentBlockToDraft();
      buildPreview();
      persistAutosaveNow('Autosaved after inserting figure.');
      showToast('Inserted figure into custom HTML block.');
      return;
    }
    if (mode === 'panel' || mode === 'plain') {
      insertTextAtCursor(blockFields.content, wrapFigureHtml(clean));
      saveCurrentBlockToDraft();
      buildPreview();
      persistAutosaveNow('Autosaved after inserting figure.');
      showToast('Inserted figure into the current block.');
      return;
    }
    insertFigureAsNewCustomBlock(clean);
  }
  function openFigureModal() {
    var figureImagePanel = getFigureImagePanel();
    var figureEditorPanel = getFigureEditorPanel();
    var figureModal = getFigureModal();
    if (figureImagePanel) figureImagePanel.style.display = '';
    if (figureEditorPanel) figureEditorPanel.style.display = 'none';
    if (figureModal) figureModal.hidden = false;
  }
  function closeFigureModal() {
    var figureModal = getFigureModal();
    if (figureModal) figureModal.hidden = true;
  }
  return { insertTextAtCursor:insertTextAtCursor, currentFigureMode:currentFigureMode, wrapFigureHtml:wrapFigureHtml, insertFigureAsNewCustomBlock:insertFigureAsNewCustomBlock, insertFigureHtml:insertFigureHtml, buildImageFigureHtml:function (src, alt) { return buildImageFigureHtml(src, alt, escapeAttr); }, openFigureModal:openFigureModal, closeFigureModal:closeFigureModal };
}

export default { buildImageFigureHtml:buildImageFigureHtml, insertTextAtCursor:insertTextAtCursor, createApi:createApi };
