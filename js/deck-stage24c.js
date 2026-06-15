/* Stage 35S migration note:
   Slide rail now renders thumbnail cards instead of text-only deck entries.
   Deck list, slide CRUD, snippet load/save, and clipboard helpers live here.
   This is intentionally a classic browser script, not an ES module yet.
*/
(function(){
  function createApi(deps){
    const {
      clone,
      escapeHtml,
      normalizeSlide,
      slideForSnippet,
      snippetOutput,
      deckCount,
      deckList,
      fields,
      getSlides,
      setSlides,
      getActiveIndex,
      setActiveIndex,
      saveCurrentBlockToDraft,
      saveCurrentSlideToDeck,
      applySlideToForm,
      buildPreview,
      scheduleAutosave,
      showToast,
      currentDraftSlide
    } = deps;

    function parseSnippetSlide(){
      const raw = snippetOutput.value.trim();
      if(!raw) throw new Error('The snippet box is empty.');
      const parsed = JSON.parse(raw);
      return normalizeSlide(parsed);
    }

    function safeDeckThumbHex(value, fallback){
      value = String(value || '').trim();
      return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? value : fallback;
    }
    function deckThumbBlockKind(block){
      const raw = String(block && block.content || '').toLowerCase();
      const mode = String(block && block.mode || 'panel').toLowerCase();
      if(mode === 'diagram' || mode === 'custom' || mode === 'placeholder' || raw.indexOf('figurehtml') >= 0 || raw.indexOf('<img') >= 0 || raw.indexOf('<svg') >= 0) return 'figure';
      if(mode.indexOf('pseudo') >= 0 || raw.indexOf('for ') >= 0 || raw.indexOf('return') >= 0) return 'code';
      return 'text';
    }
    function deckThumbLines(block, fallback){
      const raw = String(block && block.content || '').replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}|\\item/g, '\n');
      const lines = raw.split(/\n+/).map(s=>s.trim()).filter(Boolean).length;
      return Math.max(2, Math.min(5, lines || fallback || 3));
    }
    function deckThumbBlockMarkup(block, idx){
      const kind = deckThumbBlockKind(block);
      const lines = deckThumbLines(block, idx === 0 ? 4 : 3);
      if(kind === 'figure') return '<span class="deck-thumb-figure"><span></span><span></span></span>';
      if(kind === 'code') return '<span class="deck-thumb-code">' + Array.from({length:Math.min(5, lines)}, (_, i)=>'<span style="--w:' + (82 - i * 8) + '%"></span>').join('') + '</span>';
      return '<span class="deck-thumb-lines">' + Array.from({length:lines}, (_, i)=>'<span style="--w:' + (92 - (i % 3) * 14) + '%"></span>').join('') + '</span>';
    }
    function currentDeckThumbAccent(){
      try{
        const themeApi = window.LuminaTheme;
        const theme = themeApi && themeApi.currentThemeFromFields ? themeApi.currentThemeFromFields() : null;
        return theme && theme.accentColor;
      }catch(_e){ return ''; }
    }
    function buildDeckThumbnail(slide, idx){
      const normalized = normalizeSlide(slide);
      const type = normalized.slideType || 'single';
      const bg = safeDeckThumbHex(normalized.bgColor, '#ffffff');
      const fg = safeDeckThumbHex(normalized.fontColor, '#111111');
      const accent = safeDeckThumbHex(currentDeckThumbAccent() || normalized.accentColor, '#2f6fed');
      const left = normalized.leftBlocks || [];
      const right = normalized.rightBlocks || [];
      const title = escapeHtml(normalized.title || ('Slide ' + (idx + 1)));
      const kicker = normalized.kicker ? '<span class="deck-thumb-kicker-line"></span>' : '';
      let body = '';
      if(type === 'title-center' || type === 'section-divider'){
        body = '<span class="deck-thumb-center-title"><span></span><span></span></span>';
      } else if(type === 'two-col'){
        body = '<span class="deck-thumb-grid two"><span class="deck-thumb-col">' + (left.length ? left.slice(0,2).map(deckThumbBlockMarkup).join('') : deckThumbBlockMarkup({content:'Main'},0)) + '</span><span class="deck-thumb-col">' + (right.length ? right.slice(0,2).map(deckThumbBlockMarkup).join('') : deckThumbBlockMarkup({content:'Details'},1)) + '</span></span>';
      } else if(type === 'full-width-figure-caption'){
        body = '<span class="deck-thumb-full-figure">' + deckThumbBlockMarkup(left[0] || {mode:'placeholder', content:'Figure'}, 0) + '</span>';
      } else if(type === 'image-left-text-right'){
        body = '<span class="deck-thumb-grid two image-text"><span class="deck-thumb-col">' + deckThumbBlockMarkup(left[0] || {mode:'placeholder', content:'Image'}, 0) + '</span><span class="deck-thumb-col">' + (right.length ? right.slice(0,2).map(deckThumbBlockMarkup).join('') : deckThumbBlockMarkup({content:'Text'},1)) + '</span></span>';
      } else {
        body = '<span class="deck-thumb-grid one"><span class="deck-thumb-col">' + (left.length ? left.slice(0,3).map(deckThumbBlockMarkup).join('') : deckThumbBlockMarkup({content:'Main content'},0)) + '</span></span>';
      }
      return '<span class="deck-thumb" aria-hidden="true" style="--thumb-bg:' + bg + ';--thumb-fg:' + fg + ';--thumb-accent:' + accent + '"><span class="deck-thumb-stage deck-thumb-type-' + escapeHtml(type) + '">' + kicker + '<span class="deck-thumb-title-line">' + title + '</span>' + body + '</span></span>';
    }
    function renderDeckRailItem(slide, idx, activeIndex){
      const normalized = normalizeSlide(slide);
      const title = slide.title || ('Untitled slide ' + (idx + 1));
      const type = slide.slideType || 'single';
      const meta = (idx + 1) + '. ' + type + ' · ' + normalized.leftBlocks.length + ' left' + (type === 'two-col' ? ' · ' + normalized.rightBlocks.length + ' right' : '');
      return '<button class="deck-item deck-thumb-item ' + (idx === activeIndex ? 'active' : '') + '" data-index="' + idx + '" aria-label="Slide ' + (idx + 1) + ': ' + escapeHtml(title) + '">' + buildDeckThumbnail(slide, idx) + '<span class="deck-thumb-caption"><span class="deck-thumb-number">Slide ' + (idx + 1) + '</span><span class="deck-thumb-title">' + escapeHtml(title) + '</span><span class="meta deck-thumb-meta">' + escapeHtml(meta) + '</span></span></button>';
    }
    function updateThumbnailRailStatus(slides, activeIndex){
      try{
        if(deckList) deckList.classList.toggle('stage35s-thumbnail-rail', !!(slides && slides.length));
        window.__LUMINA_STAGE35S_THUMBNAIL_RAIL = Object.freeze({
          stage:'stage35s-20260425-1', thumbnailRail:true, deckItemMode:'thumbnail', slideCount:slides ? slides.length : 0,
          activeSlideNumber:activeIndex >= 0 ? activeIndex + 1 : null,
          renderedThumbCount:deckList ? deckList.querySelectorAll('.deck-thumb').length : 0,
          textOnlyDeckItems:deckList ? deckList.querySelectorAll('.deck-item:not(.deck-thumb-item)').length : 0,
          behaviorChanged:false
        });
      }catch(_e){}
    }

    function loadSnippetIntoEditor(){
      const slide = parseSnippetSlide();
      applySlideToForm(slide);
      buildPreview();
      showToast('Loaded snippet into editor.');
      scheduleAutosave('Autosaved after loading snippet.');
    }
    function replaceSelectedSlideFromSnippet(){
      const activeIndex = getActiveIndex();
      const slides = getSlides();
      if(activeIndex < 0 || activeIndex >= slides.length){
        throw new Error('Select a slide first.');
      }
      slides[activeIndex] = parseSnippetSlide();
      setSlides(slides);
      applySlideToForm(slides[activeIndex]);
      buildPreview();
      renderDeckList();
      showToast('Replaced selected slide from snippet.');
      scheduleAutosave('Autosaved after replacing slide from snippet.');
    }
    function addSlideFromSnippet(){
      const slide = parseSnippetSlide();
      const slides = getSlides();
      slides.push(slide);
      setSlides(slides);
      setActiveIndex(slides.length - 1);
      applySlideToForm(slide);
      buildPreview();
      renderDeckList();
      showToast('Added slide from snippet.');
      scheduleAutosave('Autosaved after adding slide from snippet.');
    }
    function formatSnippet(){
      const slide = parseSnippetSlide();
      snippetOutput.value = JSON.stringify(slideForSnippet(slide), null, 2);
      showToast('Formatted snippet.');
    }
    function stage43akClearPreviewBeforeSlideSwitch(nextIndex){
      try{
        const p = document.getElementById('preview');
        if(p){
          p.innerHTML = '';
          p.removeAttribute('data-lumina-preview-active-index');
          p.setAttribute('data-lumina-preview-switching-to', String(nextIndex));
        }
        window.__LUMINA_STAGE43AK_SLIDE_SWITCH_PREVIEW_CLEARED = { nextIndex:nextIndex, at:new Date().toISOString() };
      }catch(_err){}
    }
    function renderDeckList(){
      const slides = getSlides();
      const activeIndex = getActiveIndex();
      deckCount.textContent = slides.length + ' slide' + (slides.length === 1 ? '' : 's');
      if(!slides.length){
        deckList.innerHTML = `
          <div class="deck-empty" role="status">
            <strong>No slides yet.</strong>
            <span>Start from the current editor contents, or choose a layout/preset and then add it.</span>
            <button class="btn primary mini" type="button" data-empty-add-slide>Add first slide</button>
          </div>
        `;
        const emptyAddBtn = deckList.querySelector('[data-empty-add-slide]');
        if(emptyAddBtn) emptyAddBtn.addEventListener('click', addSlide);
        updateThumbnailRailStatus(slides, activeIndex);
        return;
      }
      deckList.innerHTML = slides.map((slide, idx)=>renderDeckRailItem(slide, idx, activeIndex)).join('');
      updateThumbnailRailStatus(slides, activeIndex);
      deckList.querySelectorAll('.deck-item').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          saveCurrentBlockToDraft();
          saveCurrentSlideToDeck();
          const nextIndex = Number(btn.dataset.index);
          stage43akClearPreviewBeforeSlideSwitch(nextIndex);
          setActiveIndex(nextIndex);
          applySlideToForm(getSlides()[nextIndex]);
          buildPreview();
          renderDeckList();
          scheduleAutosave('Autosaved after slide switch.');
        });
      });
    }
    function addSlide(){
      const slides = getSlides();
      slides.push(currentDraftSlide());
      setSlides(slides);
      setActiveIndex(slides.length - 1);
      renderDeckList();
      showToast('Added slide.');
      scheduleAutosave('Autosaved after slide add.');
    }
    function updateSlide(){
      const activeIndex = getActiveIndex();
      const slides = getSlides();
      if(activeIndex < 0 || activeIndex >= slides.length){ showToast('Select a slide first.'); return; }
      slides[activeIndex] = currentDraftSlide();
      setSlides(slides);
      renderDeckList();
      showToast('Updated slide.');
      scheduleAutosave('Autosaved after slide update.');
    }
    function duplicateSlide(){
      let activeIndex = getActiveIndex();
      const slides = getSlides();
      if(activeIndex < 0 || activeIndex >= slides.length){ showToast('Select a slide first.'); return; }
      slides.splice(activeIndex + 1, 0, clone(slides[activeIndex]));
      activeIndex += 1;
      setSlides(slides);
      setActiveIndex(activeIndex);
      renderDeckList();
      showToast('Duplicated slide.');
      scheduleAutosave('Autosaved after slide duplicate.');
    }
    function deleteSlide(){
      let activeIndex = getActiveIndex();
      const slides = getSlides();
      if(activeIndex < 0 || activeIndex >= slides.length){ showToast('Select a slide first.'); return; }
      slides.splice(activeIndex, 1);
      if(activeIndex >= slides.length) activeIndex = slides.length - 1;
      setSlides(slides);
      setActiveIndex(activeIndex);
      if(activeIndex >= 0) applySlideToForm(slides[activeIndex]); else clearForm(false);
      buildPreview();
      renderDeckList();
      showToast('Deleted slide.');
      scheduleAutosave('Autosaved after slide delete.');
    }
    function moveSlide(dir){
      let activeIndex = getActiveIndex();
      const slides = getSlides();
      if(activeIndex < 0 || activeIndex >= slides.length) return;
      const next = activeIndex + dir;
      if(next < 0 || next >= slides.length) return;
      const tmp = slides[activeIndex];
      slides[activeIndex] = slides[next];
      slides[next] = tmp;
      activeIndex = next;
      setSlides(slides);
      setActiveIndex(activeIndex);
      renderDeckList();
      scheduleAutosave('Autosaved after slide move.');
    }
    function clearForm(resetPreview = true){
      applySlideToForm({
        slideType:'single',
        headingLevel:'h2',
        bgColor:'#ffffff',
        fontColor:'#111111',
        title:'',
        kicker:'',
        lede:'',
        leftBlocks:[],
        rightBlocks:[],
        notesTitle:'Speaker notes',
        notesBody:''
      });
      if(resetPreview) buildPreview();
    }
    async function copyText(text, success){
      await navigator.clipboard.writeText(text);
      showToast(success);
    }
    function copyCurrentSnippet(){ copyText(snippetOutput.value, 'Copied snippet.'); }
    function copyMathJaxHelper(){
      copyText(String.raw`Inline: \( a^t = \sigma(u^t) \)
Display:
\[
\nabla_{W[t]} \ell = \delta^t (z^{t-1})^\top
\]`, 'Copied MathJax helper.');
    }

    return {
      parseSnippetSlide,
      loadSnippetIntoEditor,
      replaceSelectedSlideFromSnippet,
      addSlideFromSnippet,
      formatSnippet,
      renderDeckList,
      addSlide,
      updateSlide,
      duplicateSlide,
      deleteSlide,
      moveSlide,
      clearForm,
      copyText,
      copyCurrentSnippet,
      copyMathJaxHelper
    };
  }

  window.LuminaDeck = { createApi };
})();
