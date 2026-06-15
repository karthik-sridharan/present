// Stage 15 UI shell helpers extracted from legacy-app.js.
// Classic browser script: exposes helpers on window; no ES modules.
(function(){
  'use strict';

  function initUiCleanupLayout(){
    if(window.LuminaSlideRailApi && typeof window.LuminaSlideRailApi.install === 'function'){
      window.LuminaSlideRailApi.install();
      return;
    }
    const railShell=document.getElementById('slideRailShell');
    const railMount=document.getElementById('slideRailMount');
    const deckPanel=document.getElementById('deckList')?.closest('.panel');
    if(railMount && deckPanel && !railMount.contains(deckPanel)){
      railMount.appendChild(deckPanel);
    }
    const toggleBtn=document.getElementById('toggleSlideRailBtn');
    const storageKey='luminaSlideRailCollapsed';
    function setRailCollapsed(collapsed){
      if(!railShell) return;
      railShell.classList.toggle('collapsed', !!collapsed);
      railShell.dataset.collapsed = collapsed ? '1' : '0';
      railShell.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      const headerText = railShell.querySelector('.slide-rail-header > div');
      if(railMount){ railMount.hidden = !!collapsed; railMount.style.display = collapsed ? 'none' : ''; }
      if(headerText){ headerText.hidden = !!collapsed; headerText.style.display = collapsed ? 'none' : ''; }
      if(toggleBtn) toggleBtn.textContent = collapsed ? 'Show rail' : 'Hide rail';
      try{ localStorage.setItem(storageKey, collapsed ? '1' : '0'); }catch(_e){}
    }
    let initial=false;
    try{ initial = localStorage.getItem(storageKey) === '1'; }catch(_e){}
    setRailCollapsed(initial);
    if(toggleBtn && railShell && !toggleBtn.dataset.bound && !toggleBtn.dataset.basicLuminaRailBound){
      toggleBtn.dataset.bound='1';
      toggleBtn.dataset.basicLuminaRailBound='1';
      toggleBtn.addEventListener('click', (event)=>{
        event.preventDefault();
        event.stopPropagation();
        setRailCollapsed(!(railShell.dataset.collapsed === '1'));
      }, true);
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

  window.initUiCleanupLayout = initUiCleanupLayout;
  window.initPanelTabs = initPanelTabs;
})();
