/* Stage 34J: browser-compatible ES module version of small UI shell helpers.
   Runtime note: loaded with guarded classic fallback; exports both functions and createApi. */
  function initUiCleanupLayout(){
    const railShell=document.getElementById('slideRailShell');
    const railMount=document.getElementById('slideRailMount');
    const deckPanel=document.getElementById('deckList')?.closest('.panel');
    if(railMount && deckPanel && !railMount.contains(deckPanel)){
      railMount.appendChild(deckPanel);
    }
    const toggleBtn=document.getElementById('toggleSlideRailBtn');
    if(toggleBtn && railShell && !toggleBtn.dataset.bound){
      toggleBtn.dataset.bound='1';
      toggleBtn.addEventListener('click', ()=>{
        railShell.classList.toggle('collapsed');
        toggleBtn.textContent = railShell.classList.contains('collapsed') ? 'Show rail' : 'Hide rail';
      });
    }
  }

  function initPanelTabs(){
    document.querySelectorAll('[data-left-tab]').forEach(btn=>{
      if(btn.dataset.leftTabBound) return;
      btn.dataset.leftTabBound='1';
      btn.addEventListener('click', ()=>{
        const tab = btn.dataset.leftTab;
        document.querySelectorAll('[data-left-tab]').forEach(el=>el.classList.toggle('active', el === btn));
        document.querySelectorAll('[data-left-pane]').forEach(el=>el.classList.toggle('active', el.dataset.leftPane === tab));
      });
    });

    document.querySelectorAll('[data-subtab]').forEach(btn=>{
      if(btn.dataset.subtabBound) return;
      btn.dataset.subtabBound='1';
      btn.addEventListener('click', ()=>{
        const name = btn.dataset.subtab;
        const group = name.split(':')[0];
        document.querySelectorAll('[data-subtab]').forEach(el=>{
          if((el.dataset.subtab || '').startsWith(group + ':')) el.classList.toggle('active', el === btn);
        });
        document.querySelectorAll('[data-subpane]').forEach(el=>{
          if((el.dataset.subpane || '').startsWith(group + ':')) el.classList.toggle('active', el.dataset.subpane === name);
        });
      });
    });
  }

function createApi(){
  return { initUiCleanupLayout, initPanelTabs };
}

export { createApi, initUiCleanupLayout, initPanelTabs };
export default { createApi, initUiCleanupLayout, initPanelTabs };
