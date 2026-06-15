/* Stage 34D: browser-compatible ES module version of block editor helpers.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */
'use strict';

function required(deps, name){
    if(!deps || !(name in deps)){
      throw new Error('LuminaBlockEditor missing dependency: ' + name);
    }
    return deps[name];
  }

  function createApi(deps){
    deps = deps || {};
    const clone = required(deps, 'clone');
    const escapeHtml = required(deps, 'escapeHtml');
    const normalizeSlide = required(deps, 'normalizeSlide');
    const normalizeBlockStyle = required(deps, 'normalizeBlockStyle');
    const normalizeAnimation = required(deps, 'normalizeAnimation');
    const fields = required(deps, 'fields');
    const blockFields = required(deps, 'blockFields');
    const columnModeBadge = required(deps, 'columnModeBadge');
    const previewTitle = required(deps, 'previewTitle');
    const blockList = required(deps, 'blockList');
    const preview = required(deps, 'preview');
    const snippetOutput = required(deps, 'snippetOutput');
    const getDraftBlocks = required(deps, 'getDraftBlocks');
    const setDraftBlocks = required(deps, 'setDraftBlocks');
    const getSelectedBlock = required(deps, 'getSelectedBlock');
    const setSelectedBlockObject = required(deps, 'setSelectedBlock');
    const getDraftTitleStyle = required(deps, 'getDraftTitleStyle');
    const setDraftTitleStyle = required(deps, 'setDraftTitleStyle');
    const getDraftTitleAnimation = required(deps, 'getDraftTitleAnimation');
    const setDraftTitleAnimation = required(deps, 'setDraftTitleAnimation');
    const getSlides = required(deps, 'getSlides');
    const getActiveIndex = required(deps, 'getActiveIndex');
    const isSyncingPreviewFigures = required(deps, 'isSyncingPreviewFigures');
    const setSyncingPreviewFigures = required(deps, 'setSyncingPreviewFigures');
    const currentThemeFromFields = required(deps, 'currentThemeFromFields');
    const currentPresentationOptions = required(deps, 'currentPresentationOptions');
    const slideForSnippet = required(deps, 'slideForSnippet');
    const saveFigureEmbedToDraft = required(deps, 'saveFigureEmbedToDraft');
    const buildPreview = required(deps, 'buildPreview');
    const showToast = required(deps, 'showToast');
    const scheduleAutosave = required(deps, 'scheduleAutosave');
    const persistAutosaveNow = required(deps, 'persistAutosaveNow');

    function blankBlock(mode='panel'){
      return { mode, title:'', content:'' };
    }
    function currentDraftSlide(){
      if(!isSyncingPreviewFigures()) syncPreviewFiguresToDraft(false);
      const draftBlocks = getDraftBlocks();
      const leftBlocks = clone(draftBlocks.left);
      const rightBlocks = clone(draftBlocks.right);
      const name = currentColumnName();
      const idx = selectedIndex(name);
      const edited = currentBlockFromEditor();
      const target = name === 'right' ? rightBlocks : leftBlocks;
      if(idx >= 0 && idx < target.length){
        target[idx] = edited;
      }
      return {
        slideType: fields.slideType.value,
        headingLevel: fields.headingLevel.value,
        bgColor: fields.bgColor.value,
        fontColor: fields.fontColor.value,
        inheritTheme: fields.inheritTheme.checked,
        title: fields.title.value,
        kicker: fields.kicker.value,
        lede: fields.lede.value,
        titleStyle: clone(getDraftTitleStyle()),
        titleAnimation: clone(getDraftTitleAnimation()),
        leftBlocks: leftBlocks,
        rightBlocks: fields.slideType.value === 'two-col' ? rightBlocks : [],
        notesTitle: fields.notesTitle.value,
        notesBody: fields.notesBody.value
      };
    }
    function applySlideToForm(slide){
      const s = normalizeSlide(slide);
      fields.slideType.value = s.slideType || 'single';
      fields.headingLevel.value = s.headingLevel || 'h2';
      fields.bgColor.value = s.bgColor || '#ffffff';
      fields.fontColor.value = s.fontColor || '#111111';
      fields.inheritTheme.checked = s.inheritTheme !== false;
      fields.title.value = s.title || '';
      fields.kicker.value = s.kicker || '';
      fields.lede.value = s.lede || '';
      fields.notesTitle.value = s.notesTitle || 'Speaker notes';
      fields.notesBody.value = s.notesBody || '';
      setDraftTitleStyle(normalizeBlockStyle(s.titleStyle));
      setDraftTitleAnimation(normalizeAnimation(s.titleAnimation));
      setDraftBlocks({ left: clone(s.leftBlocks || []), right: clone(s.rightBlocks || []) });
      const draftBlocks = getDraftBlocks();
      const nextSelected = { left: draftBlocks.left.length ? 0 : -1, right: draftBlocks.right.length ? 0 : -1 };
      if(fields.slideType.value !== 'two-col') nextSelected.right = -1;
      setSelectedBlockObject(nextSelected);
      if(blockFields.column.value === 'right' && fields.slideType.value !== 'two-col') blockFields.column.value = 'left';
      syncFields();
      loadSelectedBlockIntoEditor();
    }
    function syncFields(){
      const twoCol = fields.slideType.value === 'two-col';
      columnModeBadge.textContent = twoCol ? 'Two-column slide' : 'Single-column slide';
      blockFields.column.querySelector('option[value="right"]').disabled = !twoCol;
      if(!twoCol && blockFields.column.value === 'right') blockFields.column.value = 'left';
      previewTitle.textContent = fields.title.value || 'Current slide';
    }
    function currentColumnName(){ return blockFields.column.value === 'right' ? 'right' : 'left'; }
    function blockArray(name){
      const draftBlocks = getDraftBlocks();
      return name === 'right' ? draftBlocks.right : draftBlocks.left;
    }
    function selectedIndex(name){
      const selectedBlock = getSelectedBlock();
      return selectedBlock[name];
    }
    function setSelectedIndex(name, idx){
      const selectedBlock = getSelectedBlock();
      selectedBlock[name] = idx;
    }
    function loadSelectedBlockIntoEditor(){
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      const block = arr[idx];
      if(!block){
        blockFields.mode.value = 'panel';
        blockFields.title.value = '';
        blockFields.content.value = '';
      } else {
        blockFields.mode.value = block.mode || 'panel';
        blockFields.title.value = block.title || '';
        blockFields.content.value = block.content || '';
      }
      renderBlockList();
    }
    function getDraftBlock(columnName, idx){
      const arr = blockArray(columnName);
      return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
    }
    function currentBlockFromEditor(){
      const existing = getDraftBlock(currentColumnName(), selectedIndex(currentColumnName()));
      return {
        mode: blockFields.mode.value,
        title: blockFields.title.value,
        content: blockFields.content.value,
        style: normalizeBlockStyle(existing && existing.style),
        animation: normalizeAnimation(existing && existing.animation)
      };
    }
    function syncPreviewFiguresToDraft(updateSnippet = true){
      if(isSyncingPreviewFigures()) return;
      setSyncingPreviewFigures(true);
      try{
        Array.from((preview || document).querySelectorAll('.figure-embed[data-column]')).forEach(embed=>saveFigureEmbedToDraft(embed));
        if(updateSnippet){
          snippetOutput.value = JSON.stringify(slideForSnippet(currentDraftSlide()), null, 2);
        }
      } finally {
        setSyncingPreviewFigures(false);
      }
    }
    function saveCurrentBlockToDraft(){
      if(!isSyncingPreviewFigures()) syncPreviewFiguresToDraft(false);
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      if(idx >= 0 && idx < arr.length){
        arr[idx] = currentBlockFromEditor();
      }
    }
    function saveCurrentSlideToDeck(){
      if(!isSyncingPreviewFigures()) syncPreviewFiguresToDraft(false);
      const activeIndex = getActiveIndex();
      const slides = getSlides();
      if(activeIndex >= 0 && activeIndex < slides.length){
        slides[activeIndex] = currentDraftSlide();
      }
    }
    function currentDeckData(){
      const slides = getSlides();
      return {
        deckTitle: fields.deckTitle.value || 'My HTML Presentation',
        theme: currentThemeFromFields(),
        presentationOptions: currentPresentationOptions(),
        slides: slides.length ? slides.map(normalizeSlide) : [currentDraftSlide()]
      };
    }
    function renderBlockList(){
      const name = currentColumnName();
      const arr = blockArray(name);
      blockList.innerHTML = arr.map((block, idx)=>`
        <button class="block-item ${idx === selectedIndex(name) ? 'active' : ''}" data-index="${idx}">
          ${escapeHtml(block.title || ('Block ' + (idx + 1)))}
          <span class="meta">${idx + 1}. ${escapeHtml(block.mode || 'panel')}</span>
        </button>
      `).join('');
      if(!arr.length){
        blockList.innerHTML = '<div class="placeholder" style="min-height:110px">No blocks in this column yet.</div>';
      } else {
        blockList.querySelectorAll('.block-item').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            setSelectedIndex(name, Number(btn.dataset.index));
            loadSelectedBlockIntoEditor();
            buildPreview();
          });
        });
      }
    }
    function addBlock(){
      const name = currentColumnName();
      const arr = blockArray(name);
      arr.push(currentBlockFromEditor());
      setSelectedIndex(name, arr.length - 1);
      renderBlockList();
      buildPreview();
      showToast('Added block.');
      scheduleAutosave('Autosaved after block add.');
    }
    function updateBlock(){
      syncPreviewFiguresToDraft(false);
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      if(idx < 0 || idx >= arr.length){ showToast('Select a block first.'); return; }
      arr[idx] = currentBlockFromEditor();
      renderBlockList();
      buildPreview();
      persistAutosaveNow('Autosaved after block update.');
      showToast('Updated block.');
    }
    function duplicateBlock(){
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      if(idx < 0 || idx >= arr.length){ showToast('Select a block first.'); return; }
      arr.splice(idx + 1, 0, clone(arr[idx]));
      setSelectedIndex(name, idx + 1);
      renderBlockList();
      buildPreview();
      showToast('Duplicated block.');
      scheduleAutosave('Autosaved after block duplicate.');
    }
    function deleteBlock(){
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      if(idx < 0 || idx >= arr.length){ showToast('Select a block first.'); return; }
      arr.splice(idx, 1);
      setSelectedIndex(name, arr.length ? Math.min(idx, arr.length - 1) : -1);
      loadSelectedBlockIntoEditor();
      buildPreview();
      showToast('Deleted block.');
      scheduleAutosave('Autosaved after block delete.');
    }
    function moveBlock(dir){
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      const next = idx + dir;
      if(idx < 0 || idx >= arr.length || next < 0 || next >= arr.length) return;
      const tmp = arr[idx]; arr[idx] = arr[next]; arr[next] = tmp;
      setSelectedIndex(name, next);
      renderBlockList();
      buildPreview();
      scheduleAutosave('Autosaved after block move.');
    }
    function clearBlockEditor(){
      blockFields.mode.value = 'panel';
      blockFields.title.value = '';
      blockFields.content.value = '';
    }

    return {
      blankBlock,
      currentDraftSlide,
      applySlideToForm,
      syncFields,
      currentColumnName,
      blockArray,
      selectedIndex,
      setSelectedIndex,
      loadSelectedBlockIntoEditor,
      getDraftBlock,
      currentBlockFromEditor,
      syncPreviewFiguresToDraft,
      saveCurrentBlockToDraft,
      saveCurrentSlideToDeck,
      currentDeckData,
      renderBlockList,
      addBlock,
      updateBlock,
      duplicateBlock,
      deleteBlock,
      moveBlock,
      clearBlockEditor
    };
  }

export { createApi };
export default { createApi };
