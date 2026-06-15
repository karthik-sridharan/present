/* Stage 34C: browser-compatible ES module version of reusable block-library helpers.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */

function required(deps, name) {
  if (!deps || !(name in deps)) throw new Error('LuminaBlockLibrary missing dependency: ' + name);
  return deps[name];
}

export function createApi(deps) {
  var clone = required(deps, 'clone');
  var escapeHtml = required(deps, 'escapeHtml');
  var showToast = required(deps, 'showToast');
  var getBlockLibrary = required(deps, 'getBlockLibrary');
  var setBlockLibrary = required(deps, 'setBlockLibrary');
  var getBlockLibraryList = required(deps, 'getBlockLibraryList');
  var getBlockLibraryKey = required(deps, 'getBlockLibraryKey');

  function defaultReusableBlock(kind) {
    var presets = {
      theorem: { mode:'panel', title:'Theorem', content:'\\begin{card}{Theorem}\\nState the theorem clearly here.\\n\\end{card}' },
      proof: { mode:'panel', title:'Proof', content:'\\begin{card}{Proof}\\nSketch the argument here.\\n\\end{card}' },
      recap: { mode:'panel', title:'Recap', content:'\\begin{card}{Recap}\\n\\begin{itemize}\\n\\item First takeaway\\n\\item Second takeaway\\n\\end{itemize}\\n\\end{card}' },
      algorithm: { mode:'pseudocode-latex', title:'Algorithm', content:'Input: \\(x\\)\\n\\nfor \\(t = 1\\) to \\(T\\) do\\n  step\\nend\\n\\nreturn output' },
      citation: { mode:'panel', title:'Citation', content:'\\begin{card}{Citation}\\nAuthor, Title, Venue, Year.\\n\\end{card}' },
      reminder: { mode:'panel', title:'Speaker reminder', content:'\\begin{card}{Speaker reminder}\\nMention the intuition before the formal statement.\\n\\end{card}' }
    };
    return clone(presets[kind] || presets.recap);
  }
  function builtinLibraryEntries() {
    return [
      {id:'builtin-theorem', name:'Theorem box', builtin:true, block:defaultReusableBlock('theorem')},
      {id:'builtin-proof', name:'Proof box', builtin:true, block:defaultReusableBlock('proof')},
      {id:'builtin-recap', name:'Recap box', builtin:true, block:defaultReusableBlock('recap')},
      {id:'builtin-algorithm', name:'Algorithm box', builtin:true, block:defaultReusableBlock('algorithm')},
      {id:'builtin-citation', name:'Citation box', builtin:true, block:defaultReusableBlock('citation')},
      {id:'builtin-reminder', name:'Speaker reminder box', builtin:true, block:defaultReusableBlock('reminder')}
    ];
  }
  function loadBlockLibrary() {
    try {
      var raw = localStorage.getItem(getBlockLibraryKey());
      var saved = raw ? JSON.parse(raw) : [];
      setBlockLibrary(builtinLibraryEntries().concat(Array.isArray(saved) ? saved : []));
    } catch (err) {
      setBlockLibrary(builtinLibraryEntries());
    }
  }
  function persistBlockLibrary() {
    var custom = getBlockLibrary().filter(function (item) { return !item.builtin; });
    localStorage.setItem(getBlockLibraryKey(), JSON.stringify(custom));
  }
  function renderBlockLibrary() {
    var blockLibraryList = getBlockLibraryList();
    if (!blockLibraryList) return;
    var blockLibrary = getBlockLibrary();
    blockLibraryList.innerHTML = blockLibrary.map(function (item, idx) {
      var block = item.block || {};
      return '<button class="library-item ' + (idx === renderBlockLibrary.selectedIndex ? 'active' : '') + '" data-lib-index="' + idx + '">' + escapeHtml(item.name || 'Reusable block') + '<small>' + escapeHtml(block.mode || 'panel') + (item.builtin ? ' · built-in' : '') + '</small></button>';
    }).join('');
    blockLibraryList.querySelectorAll('[data-lib-index]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderBlockLibrary.selectedIndex = Number(btn.dataset.libIndex);
        renderBlockLibrary();
      });
    });
  }
  renderBlockLibrary.selectedIndex = 0;
  function saveCurrentBlockToLibrary() {
    var block = deps.currentBlockFromEditor();
    var suggested = block.title || 'Reusable block';
    var name = prompt('Save reusable block as', suggested);
    if (!name) return;
    var blockLibrary = getBlockLibrary();
    blockLibrary.push({ id:'saved-' + Date.now(), name:name, builtin:false, block:clone(block) });
    renderBlockLibrary.selectedIndex = blockLibrary.length - 1;
    persistBlockLibrary();
    renderBlockLibrary();
    showToast('Saved reusable block.');
  }
  function insertSelectedLibraryBlock() {
    var blockLibrary = getBlockLibrary();
    var item = blockLibrary[renderBlockLibrary.selectedIndex];
    if (!item) return;
    var name = deps.currentColumnName();
    var arr = deps.blockArray(name);
    var idx = deps.selectedIndex(name);
    var insertAt = idx >= 0 ? idx + 1 : arr.length;
    arr.splice(insertAt, 0, clone(item.block));
    deps.setSelectedIndex(name, insertAt);
    deps.loadSelectedBlockIntoEditor();
    deps.renderBlockList();
    deps.buildPreview();
    deps.scheduleAutosave('Autosaved after inserting reusable block.');
    showToast('Inserted reusable block.');
  }
  function deleteSelectedLibraryBlock() {
    var blockLibrary = getBlockLibrary();
    var item = blockLibrary[renderBlockLibrary.selectedIndex];
    if (!item || item.builtin) { showToast('Built-in reusable blocks cannot be deleted.'); return; }
    blockLibrary.splice(renderBlockLibrary.selectedIndex, 1);
    renderBlockLibrary.selectedIndex = Math.max(0, Math.min(renderBlockLibrary.selectedIndex, blockLibrary.length - 1));
    persistBlockLibrary();
    renderBlockLibrary();
    showToast('Deleted saved reusable block.');
  }
  return { defaultReusableBlock:defaultReusableBlock, builtinLibraryEntries:builtinLibraryEntries, loadBlockLibrary:loadBlockLibrary, persistBlockLibrary:persistBlockLibrary, renderBlockLibrary:renderBlockLibrary, saveCurrentBlockToLibrary:saveCurrentBlockToLibrary, insertSelectedLibraryBlock:insertSelectedLibraryBlock, deleteSelectedLibraryBlock:deleteSelectedLibraryBlock };
}

export default { createApi:createApi };
