/* Stage 20 migration note:
   Block editor/form synchronization and current-slide draft helpers live here.
   This is intentionally a classic browser script, not an ES module yet.
   legacy-app.js injects live state/functions through createApi() while migration continues.
*/
(function(global){
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
    function stage43hIsFreeformImportSlide(slide){
      const s = slide || {};
      const type = String(s.slideType || '').toLowerCase();
      return !!(s.importMeta && (s.importMeta.freeform || s.importMeta.coordinateSystem || s.importMeta.sourcePageNumber || s.importMeta.sourcePageIndex || s.importMeta.stage43gExactReviewImport))
        || type === 'freeform' || type === 'freeform-import' || type === 'pdf-import' || type === 'ppt-import'
        || !!s.__stage43gExactReviewImport;
    }
    function stage43hPreserveImportBlockMetadata(nextBlock, existing){
      if(!existing || !nextBlock) return nextBlock;
      [
        'importRole','importSubmode','sourceTextHint','mathImageSourceText','lineCount','visualBlobIndex',
        'importChoiceMode','importChoiceSourceIndex','__aiSourceBlockId','blockId','sourcePageNumber','sourcePageIndex'
      ].forEach(function(key){ if(existing[key] != null && nextBlock[key] == null) nextBlock[key] = clone(existing[key]); });
      if(existing.importSourceLayout && !nextBlock.importSourceLayout) nextBlock.importSourceLayout = clone(existing.importSourceLayout);
      if(existing.layout && !nextBlock.layout) nextBlock.layout = clone(existing.layout);
      return nextBlock;
    }
    function stage43jIsImportPreviewLocked(slide){
      const s = slide || {};
      const meta = s.importMeta && typeof s.importMeta === 'object' ? s.importMeta : {};
      return !!(s.__stage43jPreviewLocked || meta.stage43jPreviewLocked || s.__stage43gExactReviewImport || meta.stage43gExactReviewImport);
    }
    function stage43jCloneLockedFreeformSlide(slide, editedLeftBlocks, editedRightBlocks){
      const out = clone(slide || {});
      // Stage 43V: locked imported/freeform slides still need to accept edits
      // from the block editor. The old lock returned the stored slide verbatim,
      // so manual edits such as fixing ext{...} -> \text{...} could disappear.
      if(Array.isArray(editedLeftBlocks)) out.leftBlocks = clone(editedLeftBlocks);
      if(Array.isArray(editedRightBlocks)) out.rightBlocks = clone(editedRightBlocks);
      out.title = fields.title.value || out.title || '';
      out.kicker = fields.kicker.value || out.kicker || '';
      out.lede = fields.lede.value || out.lede || '';
      out.notesTitle = fields.notesTitle.value || out.notesTitle || 'Speaker notes';
      out.notesBody = fields.notesBody.value || out.notesBody || '';
      out.__stage43jPreviewLockPreserved = true;
      out.__stage43vLockedFreeformEditsMerged = true;
      out.importMeta = Object.assign({}, out.importMeta || {}, { stage43jPreviewLockPreserved:true, stage43vLockedFreeformEditsMerged:true });
      try{
        window.__LUMINA_STAGE43J_FREEFORM_IMPORT_PREVIEW_LOCK = {
          ok:true,
          activeIndex:getActiveIndex(),
          title:out.title || '',
          sourcePageNumber:out.importMeta && (out.importMeta.sourcePageNumber || out.importMeta.pageNumber) || null,
          blockCount:(Array.isArray(out.leftBlocks)?out.leftBlocks.length:0)+(Array.isArray(out.rightBlocks)?out.rightBlocks.length:0),
          reason:'Returned locked imported freeform slide with current edited draft blocks merged in.',
          stage43v:true,
          at:new Date().toISOString()
        };
      }catch(_err){}
      return out;
    }
    function stage43kCommitDraftBlocksToActiveSlide(reason){
      const activeIndex = getActiveIndex();
      const slides = getSlides();
      const slide = slides && slides[activeIndex];
      if(!slide) return false;
      const draftBlocks = getDraftBlocks();
      slide.leftBlocks = clone(draftBlocks.left || []);
      slide.rightBlocks = clone(draftBlocks.right || []);
      slide.importMeta = Object.assign({}, slide.importMeta || {}, { stage43kDraftBlocksCommitted:true, stage43kCommitReason:reason || 'block-edit', stage43kCommittedAt:new Date().toISOString() });
      try{
        window.__LUMINA_STAGE43K_IMPORT_BLOCK_EDIT_COMMIT = {
          ok:true,
          reason:reason || 'block-edit',
          activeIndex:activeIndex,
          leftBlocks:slide.leftBlocks.length,
          rightBlocks:slide.rightBlocks.length,
          at:new Date().toISOString()
        };
      }catch(_err){}
      return true;
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
        target[idx] = stage43hPreserveImportBlockMetadata(edited, existingArr[idx]);
      }
      const freeformImport = stage43hIsFreeformImportSlide(existingSlide);
      if(freeformImport && stage43jIsImportPreviewLocked(existingSlide)){
        return stage43jCloneLockedFreeformSlide(existingSlide, leftBlocks, rightBlocks);
      }
      const preservedSlideType = freeformImport ? (existingSlide.slideType || 'freeform-import') : fields.slideType.value;
      const twoCol = !freeformImport && fields.slideType.value === 'two-col';
      const draftSlide = {
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
        rightBlocks: twoCol ? rightBlocks : (freeformImport ? rightBlocks : []),
        notesTitle: fields.notesTitle.value,
        notesBody: fields.notesBody.value
      };
      if(existingSlide.importMeta) draftSlide.importMeta = clone(existingSlide.importMeta);
      if(freeformImport){
        draftSlide.importMeta = Object.assign({}, draftSlide.importMeta || {}, { stage43hFreeformDraftPreserved:true });
        ['__stage43gExactReviewImport','__stage43gReviewImportIndex','importChoiceMode','importChoiceSourceIndex'].forEach(function(key){
          if(existingSlide[key] != null) draftSlide[key] = clone(existingSlide[key]);
        });
      }
      try{
        if(freeformImport){
          window.__LUMINA_STAGE43H_FREEFORM_DRAFT_PRESERVE = {
            preserved:true,
            activeIndex:getActiveIndex(),
            slideType:draftSlide.slideType,
            fieldSlideType:fields.slideType.value,
            blockCount:(leftBlocks.length || 0) + (rightBlocks.length || 0),
            at:new Date().toISOString()
          };
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
      if(existing){
        ['importSubmode','sourceTextHint','mathImageSourceText','lineCount','visualBlobIndex','__aiSourceBlockId','blockId'].forEach(function(key){
          if(existing[key] != null && nextBlock[key] == null) nextBlock[key] = clone(existing[key]);
        });
      }
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
      stage43kCommitDraftBlocksToActiveSlide('add-block');
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
      stage43kCommitDraftBlocksToActiveSlide('update-block');
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
      stage43kCommitDraftBlocksToActiveSlide('duplicate-block');
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
      stage43kCommitDraftBlocksToActiveSlide('delete-block');
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
      stage43kCommitDraftBlocksToActiveSlide('move-block');
      renderBlockList();
      buildPreview();
      scheduleAutosave('Autosaved after block move.');
    }
    function replaceSelectedBlock(nextBlock, reason){
      const name = currentColumnName();
      const arr = blockArray(name);
      const idx = selectedIndex(name);
      if(idx < 0 || idx >= arr.length){ showToast('Select a block first.'); return false; }
      const existing = arr[idx] || {};
      const patched = stage43hPreserveImportBlockMetadata(clone(nextBlock || {}), existing);
      // Stage 43N: selected-block Mathpix/AI remake must replace the old block
      // in-place, not create a second immovable block. Always preserve the
      // exact existing geometry so the replacement remains movable/resizable
      // in imported/freeform slides.
      if(existing.layout) patched.layout = clone(existing.layout);
      if(existing.importSourceLayout) patched.importSourceLayout = clone(existing.importSourceLayout);
      if(!patched.layout){
        patched.layout = { x: 120, y: 160, w: 640, h: 160, z: 30 + idx };
      }
      patched.stage43nReplacedInPlace = true;
      patched.stage43nReplacementReason = reason || 'replace-selected-block';
      arr[idx] = patched;
      stage43kCommitDraftBlocksToActiveSlide(reason || 'replace-selected-block');
      loadSelectedBlockIntoEditor();
      renderBlockList();
      buildPreview();
      scheduleAutosave('Autosaved after selected block replacement.');
      try{
        window.__LUMINA_STAGE43N_LAST_BLOCK_REPLACE = { ok:true, column:name, index:idx, mode:patched.mode || '', title:patched.title || '', preservedLayout:!!existing.layout, reason:reason || 'replace-selected-block', at:new Date().toISOString() };
      }catch(_err){}
      return true;
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
      replaceSelectedBlock,
      clearBlockEditor
    };
  }

  global.LuminaBlockEditor = { createApi };
})(window);
