/* Stage 34D: browser-compatible ES module version of deck/snippet workflow helpers.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */

export function createApi(deps) {
  deps = deps || {};
  var clone = deps.clone;
  var escapeHtml = deps.escapeHtml;
  var normalizeSlide = deps.normalizeSlide;
  var slideForSnippet = deps.slideForSnippet;
  var snippetOutput = deps.snippetOutput;
  var deckCount = deps.deckCount;
  var deckList = deps.deckList;
  var getSlides = deps.getSlides;
  var setSlides = deps.setSlides;
  var getActiveIndex = deps.getActiveIndex;
  var setActiveIndex = deps.setActiveIndex;
  var saveCurrentBlockToDraft = deps.saveCurrentBlockToDraft;
  var saveCurrentSlideToDeck = deps.saveCurrentSlideToDeck;
  var applySlideToForm = deps.applySlideToForm;
  var buildPreview = deps.buildPreview;
  var scheduleAutosave = deps.scheduleAutosave;
  var showToast = deps.showToast;
  var currentDraftSlide = deps.currentDraftSlide;

  function parseSnippetSlide() {
    var raw = snippetOutput.value.trim();
    if (!raw) throw new Error('The snippet box is empty.');
    var parsed = JSON.parse(raw);
    return normalizeSlide(parsed);
  }
  function loadSnippetIntoEditor() {
    var slide = parseSnippetSlide();
    applySlideToForm(slide);
    buildPreview();
    showToast('Loaded snippet into editor.');
    scheduleAutosave('Autosaved after loading snippet.');
  }
  function replaceSelectedSlideFromSnippet() {
    var activeIndex = getActiveIndex();
    var slides = getSlides();
    if (activeIndex < 0 || activeIndex >= slides.length) throw new Error('Select a slide first.');
    slides[activeIndex] = parseSnippetSlide();
    setSlides(slides);
    applySlideToForm(slides[activeIndex]);
    buildPreview();
    renderDeckList();
    showToast('Replaced selected slide from snippet.');
    scheduleAutosave('Autosaved after replacing slide from snippet.');
  }
  function addSlideFromSnippet() {
    var slide = parseSnippetSlide();
    var slides = getSlides();
    slides.push(slide);
    setSlides(slides);
    setActiveIndex(slides.length - 1);
    applySlideToForm(slide);
    buildPreview();
    renderDeckList();
    showToast('Added slide from snippet.');
    scheduleAutosave('Autosaved after adding slide from snippet.');
  }
  function formatSnippet() {
    var slide = parseSnippetSlide();
    snippetOutput.value = JSON.stringify(slideForSnippet(slide), null, 2);
    showToast('Formatted snippet.');
  }
  function renderDeckList() {
    var slides = getSlides();
    var activeIndex = getActiveIndex();
    deckCount.textContent = slides.length + ' slide' + (slides.length === 1 ? '' : 's');
    if (!slides.length) {
      deckList.innerHTML = `
        <div class="deck-empty" role="status">
          <strong>No slides yet.</strong>
          <span>Start from the current editor contents, or choose a layout/preset and then add it.</span>
          <button class="btn primary mini" type="button" data-empty-add-slide>Add first slide</button>
        </div>
      `;
      var emptyAddBtn = deckList.querySelector('[data-empty-add-slide]');
      if (emptyAddBtn) emptyAddBtn.addEventListener('click', addSlide);
      return;
    }
    deckList.innerHTML = slides.map(function (slide, idx) {
      var normalized = normalizeSlide(slide);
      return `
        <button class="deck-item ${idx === activeIndex ? 'active' : ''}" data-index="${idx}">
          ${escapeHtml(slide.title || ('Untitled slide ' + (idx + 1)))}
          <span class="meta">${idx + 1}. ${escapeHtml(slide.slideType || 'single')} · ${normalized.leftBlocks.length} left block(s)${slide.slideType === 'two-col' ? ' · ' + normalized.rightBlocks.length + ' right block(s)' : ''}</span>
        </button>
      `;
    }).join('');
    deckList.querySelectorAll('.deck-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveCurrentBlockToDraft();
        saveCurrentSlideToDeck();
        var nextIndex = Number(btn.dataset.index);
        setActiveIndex(nextIndex);
        applySlideToForm(getSlides()[nextIndex]);
        buildPreview();
        renderDeckList();
        scheduleAutosave('Autosaved after slide switch.');
      });
    });
  }
  function addSlide() {
    var slides = getSlides();
    slides.push(currentDraftSlide());
    setSlides(slides);
    setActiveIndex(slides.length - 1);
    renderDeckList();
    showToast('Added slide.');
    scheduleAutosave('Autosaved after slide add.');
  }
  function updateSlide() {
    var activeIndex = getActiveIndex();
    var slides = getSlides();
    if (activeIndex < 0 || activeIndex >= slides.length) { showToast('Select a slide first.'); return; }
    slides[activeIndex] = currentDraftSlide();
    setSlides(slides);
    renderDeckList();
    showToast('Updated slide.');
    scheduleAutosave('Autosaved after slide update.');
  }
  function duplicateSlide() {
    var activeIndex = getActiveIndex();
    var slides = getSlides();
    if (activeIndex < 0 || activeIndex >= slides.length) { showToast('Select a slide first.'); return; }
    slides.splice(activeIndex + 1, 0, clone(slides[activeIndex]));
    activeIndex += 1;
    setSlides(slides);
    setActiveIndex(activeIndex);
    renderDeckList();
    showToast('Duplicated slide.');
    scheduleAutosave('Autosaved after slide duplicate.');
  }
  function deleteSlide() {
    var activeIndex = getActiveIndex();
    var slides = getSlides();
    if (activeIndex < 0 || activeIndex >= slides.length) { showToast('Select a slide first.'); return; }
    slides.splice(activeIndex, 1);
    if (activeIndex >= slides.length) activeIndex = slides.length - 1;
    setSlides(slides);
    setActiveIndex(activeIndex);
    if (activeIndex >= 0) applySlideToForm(slides[activeIndex]); else clearForm(false);
    buildPreview();
    renderDeckList();
    showToast('Deleted slide.');
    scheduleAutosave('Autosaved after slide delete.');
  }
  function moveSlide(dir) {
    var activeIndex = getActiveIndex();
    var slides = getSlides();
    if (activeIndex < 0 || activeIndex >= slides.length) return;
    var next = activeIndex + dir;
    if (next < 0 || next >= slides.length) return;
    var tmp = slides[activeIndex];
    slides[activeIndex] = slides[next];
    slides[next] = tmp;
    activeIndex = next;
    setSlides(slides);
    setActiveIndex(activeIndex);
    renderDeckList();
    scheduleAutosave('Autosaved after slide move.');
  }
  function clearForm(resetPreview) {
    if (typeof resetPreview === 'undefined') resetPreview = true;
    applySlideToForm({
      slideType:'single', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', title:'', kicker:'', lede:'', leftBlocks:[], rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
    });
    if (resetPreview) buildPreview();
  }
  function copyText(text, success) {
    return navigator.clipboard.writeText(text).then(function () { showToast(success); });
  }
  function copyCurrentSnippet() { copyText(snippetOutput.value, 'Copied snippet.'); }
  function copyMathJaxHelper() {
    copyText('Inline: \\( a^t = \\sigma(u^t) \\)\nDisplay:\n\\[\n\\nabla_{W[t]} \\ell = \\delta^t (z^{t-1})^\\top\n\\]', 'Copied MathJax helper.');
  }

  return { parseSnippetSlide:parseSnippetSlide, loadSnippetIntoEditor:loadSnippetIntoEditor, replaceSelectedSlideFromSnippet:replaceSelectedSlideFromSnippet, addSlideFromSnippet:addSlideFromSnippet, formatSnippet:formatSnippet, renderDeckList:renderDeckList, addSlide:addSlide, updateSlide:updateSlide, duplicateSlide:duplicateSlide, deleteSlide:deleteSlide, moveSlide:moveSlide, clearForm:clearForm, copyText:copyText, copyCurrentSnippet:copyCurrentSnippet, copyMathJaxHelper:copyMathJaxHelper };
}

export default { createApi:createApi };
