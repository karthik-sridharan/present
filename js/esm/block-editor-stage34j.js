/* Stage 34J: browser-compatible ES module version of block editor helpers.
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
    function decodeLiteralNewlines(value){
      return String(value || '')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n')
        .replace(/\\t(?![A-Za-z{])/g, ' ');
    }
    function cleanEditableContent(value, mode){
      const resolvedMode = String(mode || '').toLowerCase();
      const text = decodeLiteralNewlines(value);
      if(resolvedMode === 'pseudocode' || resolvedMode === 'pseudocode-latex' || resolvedMode === 'custom') return text;
      return text
        .split('\n')
        .map(line => String(line || '').replace(/^\s*P:\s*/i, '').replace(/^\s*UL:\s*/i, '- '))
        .join('\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .trim();
    }
    function stage43vIsFreeformImportSlide(slide){
      const s = slide || {};
      const type = String(s.slideType || '').toLowerCase();
      const meta = s.importMeta && typeof s.importMeta === 'object' ? s.importMeta : {};
      return type === 'freeform' || type === 'freeform-import' || type === 'pdf-import' || type === 'ppt-import'
        || !!(meta.freeform || meta.coordinateSystem || meta.sourcePageNumber || meta.sourcePageIndex || meta.stage43gExactReviewImport)
        || !!s.__stage43gExactReviewImport;
    }
    function stage43vIsLockedImportSlide(slide){
      const s = slide || {};
      const meta = s.importMeta && typeof s.importMeta === 'object' ? s.importMeta : {};
      return !!(s.__stage43jPreviewLocked || meta.stage43jPreviewLocked || s.__stage43gExactReviewImport || meta.stage43gExactReviewImport);
    }
    function stage43vPreserveImportBlockMetadata(nextBlock, existing){
      if(!existing || !nextBlock) return nextBlock;
      ['importRole','importSubmode','sourceTextHint','mathImageSourceText','lineCount','visualBlobIndex','importChoiceMode','importChoiceSourceIndex','__aiSourceBlockId','blockId','sourcePageNumber','sourcePageIndex'].forEach(function(key){
        if(existing[key] != null && nextBlock[key] == null) nextBlock[key] = clone(existing[key]);
      });
      if(existing.importSourceLayout && !nextBlock.importSourceLayout) nextBlock.importSourceLayout = clone(existing.importSourceLayout);
      if(existing.layout && !nextBlock.layout) nextBlock.layout = clone(existing.layout);
      return nextBlock;
    }
    function currentDraftSlide(){
      if(!isSyncingPreviewFigures()) syncPreviewFiguresToDraft(false);
      const draftBlocks = getDraftBlocks();
      const leftBlocks = clone(draftBlocks.left);
      const rightBlocks = clone(draftBlocks.right);
      const name = currentColumnName();
      const idx = selectedIndex(name);
      const existingSlide = getSlides()[getActiveIndex()] || {};
      const edited = currentBlockFromEditor();
      const target = name === 'right' ? rightBlocks : leftBlocks;
      if(idx >= 0 && idx < target.length){
        const existingArr = name === 'right' ? (existingSlide.rightBlocks || []) : (existingSlide.leftBlocks || []);
        target[idx] = stage43vPreserveImportBlockMetadata(edited, existingArr[idx]);
      }
      const freeformImport = stage43vIsFreeformImportSlide(existingSlide);
      const preservedSlideType = freeformImport ? (existingSlide.slideType || 'freeform-import') : fields.slideType.value;
      const draftSlide = freeformImport && stage43vIsLockedImportSlide(existingSlide) ? clone(existingSlide) : {};
      Object.assign(draftSlide, {
        slideType: preservedSlideType,
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
        rightBlocks: (fields.slideType.value === 'two-col' || freeformImport) ? rightBlocks : [],
        notesTitle: fields.notesTitle.value,
        notesBody: fields.notesBody.value
      });
      if(existingSlide.importMeta) draftSlide.importMeta = clone(existingSlide.importMeta);
      if(freeformImport){
        draftSlide.importMeta = Object.assign({}, draftSlide.importMeta || {}, { stage43vFreeformDraftEditsMerged:true });
        draftSlide.__stage43vLockedFreeformEditsMerged = true;
      }
      try{
        if(freeformImport){
          window.__LUMINA_STAGE43V_BLOCK_EDITOR_SAVE_FIX = { ok:true, activeIndex:getActiveIndex(), slideType:draftSlide.slideType, leftBlocks:leftBlocks.length, rightBlocks:rightBlocks.length, at:new Date().toISOString() };
        }
      }catch(_err){}
      return draftSlide;
    }
    function applySlideToForm(slide){
      const s = normalizeSlide(slide);
      fields.slideType.value = s.slideType || 'single';
      if(!fields.slideType.value) fields.slideType.value = 'single';
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
        blockFields.content.value = cleanEditableContent(block.content || '', block.mode || 'panel');
      }
      renderBlockList();
    }
    function getDraftBlock(columnName, idx){
      const arr = blockArray(columnName);
      return (idx >= 0 && idx < arr.length) ? arr[idx] : null;
    }
    function currentBlockFromEditor(){
      const existing = getDraftBlock(currentColumnName(), selectedIndex(currentColumnName()));
      const nextContent = cleanEditableContent(blockFields.content.value, blockFields.mode.value || (existing && existing.mode) || 'panel');
      const nextBlock = {
        mode: blockFields.mode.value || (existing && existing.mode) || 'panel',
        title: blockFields.title.value,
        content: nextContent,
        style: normalizeBlockStyle(existing && existing.style),
        animation: normalizeAnimation(existing && existing.animation)
      };
      if(existing && existing.layout) nextBlock.layout = clone(existing.layout);
      if(existing && existing.importSourceLayout) nextBlock.importSourceLayout = clone(existing.importSourceLayout);
      if(existing && existing.importRole) nextBlock.importRole = existing.importRole;
      if(existing && Array.isArray(existing.importRuns)){
        const oldContent = cleanEditableContent(existing.content || '', existing.mode || 'panel');
        if(nextContent === oldContent){
          nextBlock.importRuns = clone(existing.importRuns).map(run=>Object.assign({}, run, { text: decodeLiteralNewlines(run && run.text || '') }));
        }
      }
      return nextBlock;
    }
    function stage43akPreviewBelongsToActiveSlide(){
      try{
        if(!preview || !preview.querySelector) return true;
        if(!preview.querySelector('.slide')) return true;
        const owner = preview.getAttribute('data-lumina-preview-active-index');
        if(owner == null || owner === '') return true;
        const active = String(getActiveIndex());
        if(owner === active) return true;
        try{ window.__LUMINA_STAGE43AK_PREVIEW_SYNC_GUARD = { ok:false, skipped:true, ownerIndex:owner, activeIndex:active, reason:'Skipped automatic preview figure sync from stale preview DOM.', at:new Date().toISOString() }; }catch(_err){}
        return false;
      }catch(_err){ return false; }
    }
    function syncPreviewFiguresToDraft(updateSnippet = true){
      if(isSyncingPreviewFigures()) return;
      if(!stage43akPreviewBelongsToActiveSlide()) return;
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
