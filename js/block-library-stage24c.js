/*
 * block-library.js
 * Stage 4 migration: reusable block-library behavior extracted from legacy-app.js.
 *
 * This remains a classic browser script, not an ES module. legacy-app.js injects
 * the live app state/functions through createApi() so the runtime startup path
 * stays stable while migration continues.
 */
(function(global){
  'use strict';

  function required(deps, name){
    if(!deps || !(name in deps)){
      throw new Error('LuminaBlockLibrary missing dependency: ' + name);
    }
    return deps[name];
  }

  function createApi(deps){
    const clone = required(deps, 'clone');
    const escapeHtml = required(deps, 'escapeHtml');
    const showToast = required(deps, 'showToast');
    const getBlockLibrary = required(deps, 'getBlockLibrary');
    const setBlockLibrary = required(deps, 'setBlockLibrary');
    const getBlockLibraryList = required(deps, 'getBlockLibraryList');
    const getBlockLibraryKey = required(deps, 'getBlockLibraryKey');

    function defaultReusableBlock(kind){
      const presets = {
        theorem: { mode:'panel', title:'Theorem', content:'\\begin{card}{Theorem}\\nState the theorem clearly here.\\n\\end{card}' },
        proof: { mode:'panel', title:'Proof', content:'\\begin{card}{Proof}\\nSketch the argument here.\\n\\end{card}' },
        recap: { mode:'panel', title:'Recap', content:'\\begin{card}{Recap}\\n\\begin{itemize}\\n\\item First takeaway\\n\\item Second takeaway\\n\\end{itemize}\\n\\end{card}' },
        algorithm: { mode:'pseudocode-latex', title:'Algorithm', content:'Input: \\(x\\)\\n\\nfor \\(t = 1\\) to \\(T\\) do\\n  step\\nend\\n\\nreturn output' },
        citation: { mode:'panel', title:'Citation', content:'\\begin{card}{Citation}\\nAuthor, Title, Venue, Year.\\n\\end{card}' },
        reminder: { mode:'panel', title:'Speaker reminder', content:'\\begin{card}{Speaker reminder}\\nMention the intuition before the formal statement.\\n\\end{card}' }
      };
      return clone(presets[kind] || presets.recap);
    }

    function builtinLibraryEntries(){
      return [
        {id:'builtin-theorem', name:'Theorem box', builtin:true, block:defaultReusableBlock('theorem')},
        {id:'builtin-proof', name:'Proof box', builtin:true, block:defaultReusableBlock('proof')},
        {id:'builtin-recap', name:'Recap box', builtin:true, block:defaultReusableBlock('recap')},
        {id:'builtin-algorithm', name:'Algorithm box', builtin:true, block:defaultReusableBlock('algorithm')},
        {id:'builtin-citation', name:'Citation box', builtin:true, block:defaultReusableBlock('citation')},
        {id:'builtin-reminder', name:'Speaker reminder box', builtin:true, block:defaultReusableBlock('reminder')}
      ];
    }

    function loadBlockLibrary(){
      try{
        const raw = localStorage.getItem(getBlockLibraryKey());
        const saved = raw ? JSON.parse(raw) : [];
        setBlockLibrary(builtinLibraryEntries().concat(Array.isArray(saved) ? saved : []));
      }catch(err){
        setBlockLibrary(builtinLibraryEntries());
      }
    }

    function persistBlockLibrary(){
      const custom = getBlockLibrary().filter(item => !item.builtin);
      localStorage.setItem(getBlockLibraryKey(), JSON.stringify(custom));
    }

    function renderBlockLibrary(){
      const blockLibraryList = getBlockLibraryList();
      if(!blockLibraryList) return;
      const blockLibrary = getBlockLibrary();
      blockLibraryList.innerHTML = blockLibrary.map((item, idx)=>`<button class="library-item ${idx===renderBlockLibrary.selectedIndex?'active':''}" data-lib-index="${idx}">${escapeHtml(item.name || 'Reusable block')}<small>${escapeHtml(item.block?.mode || 'panel')}${item.builtin ? ' · built-in' : ''}</small></button>`).join('');
      blockLibraryList.querySelectorAll('[data-lib-index]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          renderBlockLibrary.selectedIndex = Number(btn.dataset.libIndex);
          renderBlockLibrary();
        });
      });
    }
    renderBlockLibrary.selectedIndex = 0;

    function saveCurrentBlockToLibrary(){
      const block = deps.currentBlockFromEditor();
      const suggested = block.title || 'Reusable block';
      const name = prompt('Save reusable block as', suggested);
      if(!name) return;
      const blockLibrary = getBlockLibrary();
      blockLibrary.push({
        id:'saved-' + Date.now(),
        name,
        builtin:false,
        block: clone(block)
      });
      renderBlockLibrary.selectedIndex = blockLibrary.length - 1;
      persistBlockLibrary();
      renderBlockLibrary();
      showToast('Saved reusable block.');
    }

    function insertSelectedLibraryBlock(){
      const blockLibrary = getBlockLibrary();
      const item = blockLibrary[renderBlockLibrary.selectedIndex];
      if(!item) return;
      const name = deps.currentColumnName();
      const arr = deps.blockArray(name);
      const idx = deps.selectedIndex(name);
      const insertAt = idx >= 0 ? idx + 1 : arr.length;
      arr.splice(insertAt, 0, clone(item.block));
      deps.setSelectedIndex(name, insertAt);
      deps.loadSelectedBlockIntoEditor();
      deps.renderBlockList();
      deps.buildPreview();
      deps.scheduleAutosave('Autosaved after inserting reusable block.');
      showToast('Inserted reusable block.');
    }

    function deleteSelectedLibraryBlock(){
      const blockLibrary = getBlockLibrary();
      const item = blockLibrary[renderBlockLibrary.selectedIndex];
      if(!item || item.builtin){
        showToast('Built-in reusable blocks cannot be deleted.');
        return;
      }
      blockLibrary.splice(renderBlockLibrary.selectedIndex, 1);
      renderBlockLibrary.selectedIndex = Math.max(0, Math.min(renderBlockLibrary.selectedIndex, blockLibrary.length - 1));
      persistBlockLibrary();
      renderBlockLibrary();
      showToast('Deleted saved reusable block.');
    }

    return {
      defaultReusableBlock,
      builtinLibraryEntries,
      loadBlockLibrary,
      persistBlockLibrary,
      renderBlockLibrary,
      saveCurrentBlockToLibrary,
      insertSelectedLibraryBlock,
      deleteSelectedLibraryBlock
    };
  }

  global.LuminaBlockLibrary = { createApi };
})(window);
