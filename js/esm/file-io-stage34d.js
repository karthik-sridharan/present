/* Stage 34D: browser-compatible ES module version of file/import workflow helpers.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */

export function createApi(deps) {
  deps = deps || {};
  var clone = deps.clone;
  var normalizeSlide = deps.normalizeSlide;
  var fields = deps.fields;
  var getDocument = deps.getDocument;
  var getSlides = deps.getSlides;
  var setSlides = deps.setSlides;
  var getActiveIndex = deps.getActiveIndex;
  var setActiveIndex = deps.setActiveIndex;
  var makeReferenceImageSlide = deps.makeReferenceImageSlide;
  var makeReferencePdfSlide = deps.makeReferencePdfSlide;
  var parseMarkdownToSlides = deps.parseMarkdownToSlides;
  var parseBeamerToSlides = deps.parseBeamerToSlides;
  var parseJsonOutlineToSlides = deps.parseJsonOutlineToSlides;
  var parsePowerPointTextToSlides = deps.parsePowerPointTextToSlides;
  var syncPreviewFiguresToDraft = deps.syncPreviewFiguresToDraft;
  var saveCurrentBlockToDraft = deps.saveCurrentBlockToDraft;
  var saveCurrentSlideToDeck = deps.saveCurrentSlideToDeck;
  var applySlideToForm = deps.applySlideToForm;
  var clearForm = deps.clearForm;
  var buildPreview = deps.buildPreview;
  var renderDeckList = deps.renderDeckList;
  var scheduleAutosave = deps.scheduleAutosave;
  var showToast = deps.showToast;
  var applyThemeToForm = deps.applyThemeToForm;
  var applyPresentationOptions = deps.applyPresentationOptions;

  var required = { clone:clone, normalizeSlide:normalizeSlide, fields:fields, getSlides:getSlides, setSlides:setSlides, getActiveIndex:getActiveIndex, setActiveIndex:setActiveIndex, makeReferenceImageSlide:makeReferenceImageSlide, makeReferencePdfSlide:makeReferencePdfSlide, parseMarkdownToSlides:parseMarkdownToSlides, parseBeamerToSlides:parseBeamerToSlides, parseJsonOutlineToSlides:parseJsonOutlineToSlides, parsePowerPointTextToSlides:parsePowerPointTextToSlides, syncPreviewFiguresToDraft:syncPreviewFiguresToDraft, saveCurrentBlockToDraft:saveCurrentBlockToDraft, saveCurrentSlideToDeck:saveCurrentSlideToDeck, applySlideToForm:applySlideToForm, clearForm:clearForm, buildPreview:buildPreview, renderDeckList:renderDeckList, scheduleAutosave:scheduleAutosave, showToast:showToast, applyThemeToForm:applyThemeToForm, applyPresentationOptions:applyPresentationOptions };
  Object.keys(required).forEach(function (name) {
    if (typeof required[name] === 'undefined' || required[name] === null) throw new Error('LuminaFileIo missing dependency: ' + name);
  });

  function doc() { return typeof getDocument === 'function' ? getDocument() : globalThis.document; }
  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read file: ' + (file && file.name ? file.name : 'unknown file'))); };
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.readAsDataURL(file);
    });
  }
  function importModeValue() {
    var el = doc().getElementById('importModeSelect');
    return ((el && el.value) || 'append') === 'replace' ? 'replace' : 'append';
  }
  function applyImportedSlides(importedSlides, opts) {
    opts = opts || {};
    var incoming = (importedSlides || []).map(normalizeSlide).filter(Boolean);
    if (!incoming.length) throw new Error('No slides were imported.');
    syncPreviewFiguresToDraft(false);
    saveCurrentBlockToDraft();
    saveCurrentSlideToDeck();
    var mode = opts.mode === 'replace' ? 'replace' : 'append';
    if (mode === 'replace') {
      setSlides(incoming);
      setActiveIndex(0);
      if (opts.deckTitle) fields.deckTitle.value = opts.deckTitle;
    } else {
      var current = getSlides();
      var base = current.length ? clone(current) : [];
      var next = base.concat(incoming);
      setSlides(next);
      setActiveIndex(base.length);
      if (opts.deckTitle && !fields.deckTitle.value) fields.deckTitle.value = opts.deckTitle;
    }
    var slides = getSlides();
    var activeIndex = getActiveIndex();
    applySlideToForm(slides[activeIndex]);
    renderDeckList();
    buildPreview();
    scheduleAutosave('Autosaved after import.');
    showToast('Imported ' + incoming.length + ' slide' + (incoming.length === 1 ? '' : 's') + '.');
  }
  function importSelectedFiles(fileList) {
    var files = Array.from(fileList || []);
    if (!files.length) return Promise.reject(new Error('Choose one or more files first.'));
    var imported = [];
    var deckTitle = '';
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () {
        var lower = String(file.name || '').toLowerCase();
        if (!deckTitle) deckTitle = String(file.name || 'Imported deck').replace(/.[^.]+$/, '');
        if ((file.type && file.type.indexOf('image/') === 0) || /.(png|jpe?g|gif|webp|svg)$/i.test(lower)) {
          return readFileAsDataUrl(file).then(function (dataUrl) { imported.push(makeReferenceImageSlide(dataUrl, file.name)); });
        }
        if (file.type === 'application/pdf' || /.pdf$/i.test(lower)) {
          return readFileAsDataUrl(file).then(function (dataUrl) { imported.push(makeReferencePdfSlide(dataUrl, file.name)); });
        }
        return file.text().then(function (text) {
          if (/(\.md|\.markdown)$/i.test(lower)) imported.push.apply(imported, parseMarkdownToSlides(text));
          else if (/(\.tex|\.ltx)$/i.test(lower)) imported.push.apply(imported, parseBeamerToSlides(text));
          else if (/\.json$/i.test(lower)) imported.push.apply(imported, parseJsonOutlineToSlides(text));
          else imported.push.apply(imported, parsePowerPointTextToSlides(text));
        });
      });
    });
    return chain.then(function () { applyImportedSlides(imported, { mode:importModeValue(), deckTitle:deckTitle }); });
  }
  function loadDeckFromFile(file) {
    return file.text().then(function (text) {
      var payload;
      if (/\.json$/i.test(file.name) || String(text).trim().charAt(0) === '{') payload = JSON.parse(text);
      else {
        var match = text.match(/<script id=["']deck-source["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!match) throw new Error('This file does not contain an editable deck-source block.');
        payload = JSON.parse(match[1]);
      }
      if (!payload || !Array.isArray(payload.slides)) throw new Error('Could not parse slides from this HTML file.');
      fields.deckTitle.value = payload.deckTitle || 'My HTML Presentation';
      if (payload.theme) applyThemeToForm(payload.theme);
      if (payload.presentationOptions) applyPresentationOptions(payload.presentationOptions);
      var nextSlides = payload.slides.map(normalizeSlide);
      setSlides(nextSlides);
      setActiveIndex(nextSlides.length ? 0 : -1);
      if (getActiveIndex() >= 0) applySlideToForm(getSlides()[0]); else clearForm(false);
      buildPreview();
      renderDeckList();
    });
  }
  function loadPresentationJsonFromFile(file) {
    return file.text().then(function (text) {
      var payload = JSON.parse(text);
      if (!payload || !Array.isArray(payload.slides)) throw new Error('This JSON file does not contain a presentation with a slides array.');
      fields.deckTitle.value = payload.deckTitle || 'My HTML Presentation';
      if (payload.theme) applyThemeToForm(payload.theme);
      if (payload.presentationOptions) applyPresentationOptions(payload.presentationOptions);
      var nextSlides = payload.slides.map(normalizeSlide);
      setSlides(nextSlides);
      setActiveIndex(nextSlides.length ? 0 : -1);
      if (getActiveIndex() >= 0) applySlideToForm(getSlides()[0]); else clearForm(false);
      buildPreview();
      renderDeckList();
    });
  }
  return { importModeValue:importModeValue, applyImportedSlides:applyImportedSlides, importSelectedFiles:importSelectedFiles, loadDeckFromFile:loadDeckFromFile, loadPresentationJsonFromFile:loadPresentationJsonFromFile };
}

export default { createApi:createApi };
