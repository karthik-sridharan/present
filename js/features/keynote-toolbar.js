(function(){
  'use strict';
  var W=window,D=document,STAGE='stage38n-20260427-1';
  function byId(id){return D.getElementById(id)}
  function qs(sel,root){return (root||D).querySelector(sel)}
  function qsa(sel,root){return Array.prototype.slice.call((root||D).querySelectorAll(sel))}
  function clickEl(el){ if(el && typeof el.click==='function'){ el.click(); return true; } return false; }
  function clickId(id){ return clickEl(byId(id)); }
  function openDrawer(tab,subtab){
    if(W.LuminaStage38A && typeof W.LuminaStage38A.setDrawerOpen==='function') W.LuminaStage38A.setDrawerOpen(true);
    setTimeout(function(){
      var proxy=qs('[data-left-tab-proxy="'+tab+'"]')||qs('[data-left-tab="'+tab+'"]');
      clickEl(proxy);
      if(subtab) clickEl(qs('[data-subtab="'+subtab+'"]'));
    },0);
  }
  function runAction(action){
    if(action==='add') return (W.LuminaSlideActionsRestore&&W.LuminaSlideActionsRestore.invoke&&W.LuminaSlideActionsRestore.invoke('add')!==false)||clickId('addSlideBtn');
    if(action==='update') return (W.LuminaSlideActionsRestore&&W.LuminaSlideActionsRestore.invoke&&W.LuminaSlideActionsRestore.invoke('update')!==false)||clickId('updateSlideBtn');
    if(action==='duplicate') return (W.LuminaSlideActionsRestore&&W.LuminaSlideActionsRestore.invoke&&W.LuminaSlideActionsRestore.invoke('duplicate')!==false)||clickId('duplicateSlideBtn');
    if(action==='undo') return clickId('undoBtn') || (D.execCommand&&D.execCommand('undo'));
    if(action==='redo') return clickId('redoBtn') || (D.execCommand&&D.execCommand('redo'));
    if(action==='copilot'){openDrawer('copilot');return true;}
    if(action==='edit'){openDrawer('edit');return true;}
    if(action==='theme'){openDrawer('presets','presets:styles');return true;}
    if(action==='present'){openDrawer('files','files:save');return true;}
    if(action==='advanced'){openDrawer('slides');return true;}
    if(action==='diagnostics'){
      openDrawer('slides');
      setTimeout(function(){ if(W.LuminaDiagnostics&&W.LuminaDiagnostics.copyReport) W.LuminaDiagnostics.copyReport().catch(function(){}); },120);
      return true;
    }
    return false;
  }
  function setModeActive(mode){
    qsa('.stage38c-mode-pill button').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-stage38c-mode')===mode)});
  }
  function makeToolbar(){
    if(byId('stage38cTopToolbar')) return true;
    var page=qs('.page.stage38a-page')||qs('.page');
    if(!page) return false;
    var bar=D.createElement('div');
    bar.id='stage38cTopToolbar';
    bar.className='stage38c-top-toolbar';
    bar.setAttribute('role','toolbar');
    bar.setAttribute('aria-label','Keynote style presentation toolbar');
    bar.innerHTML=''
      +'<div class="stage38c-toolbar-brand"><div class="stage38c-toolbar-brand-mark">L</div><div>Lumina<small>Presenter</small></div></div>'
      +'<div class="stage38c-toolbar-group">'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="add"><span aria-hidden="true">＋</span>Add slide</button>'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="update"><span aria-hidden="true">✓</span>Update</button>'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="duplicate"><span aria-hidden="true">⧉</span>Duplicate</button>'
      +'<span class="stage38c-toolbar-divider" aria-hidden="true"></span>'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="undo"><span aria-hidden="true">↶</span>Undo</button>'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="redo"><span aria-hidden="true">↷</span>Redo</button>'
      +'<span class="stage38c-toolbar-divider" aria-hidden="true"></span>'
      +'<span class="stage38c-mode-pill" aria-label="Workspace mode"><button type="button" class="active" data-stage38c-mode="create" data-stage38c-action="copilot">Create</button><button type="button" data-stage38c-mode="edit" data-stage38c-action="edit">Edit</button><button type="button" data-stage38c-mode="present" data-stage38c-action="present">Present</button><button type="button" data-stage38c-mode="advanced" data-stage38c-action="advanced">Advanced</button></span>'
      +'</div>'
      +'<div class="stage38c-toolbar-group stage38c-toolbar-right">'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="theme"><span aria-hidden="true">◐</span>Theme</button>'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="copilot"><span aria-hidden="true">✨</span>AI</button>'
      +'<button class="stage38c-tool-btn" type="button" data-stage38c-action="present" data-primary="1"><span aria-hidden="true">▶</span>Export</button>'
      +'</div>';
    page.insertBefore(bar,page.firstChild);
    bar.addEventListener('click',function(evt){
      var t=evt.target&&evt.target.closest&&evt.target.closest('[data-stage38c-action]');
      if(!t) return;
      evt.preventDefault();
      var mode=t.getAttribute('data-stage38c-mode'); if(mode) setModeActive(mode);
      var ok=runAction(t.getAttribute('data-stage38c-action'));
      if(!ok && W.luminaBootError) W.luminaBootError('Stage 38C toolbar action failed: '+t.getAttribute('data-stage38c-action'));
      publishStatus();
    },true);
    return true;
  }
  function publishStatus(){
    var bar=byId('stage38cTopToolbar');
    var status={
      stage:STAGE,
      keynoteToolbar:!!bar,
      buttonCount:bar?qsa('[data-stage38c-action]',bar).length:0,
      modeButtonCount:bar?qsa('[data-stage38c-mode]',bar).length:0,
      canvasFirstStillActive:!!(D.body.classList.contains('stage38a-canvas-first')&&byId('stage38aCanvasCenter')),
      pass:false
    };
    status.pass=!!(status.keynoteToolbar&&status.buttonCount>=10&&status.modeButtonCount===4&&status.canvasFirstStillActive);
    W.__LUMINA_STAGE38B_STATUS=status;
    W.__LUMINA_STAGE38C_KEYNOTE_TOOLBAR_STATUS=status;
    return status;
  }
  function patchDiagnostics(){
    var LD=W.LuminaDiagnostics;
    if(!LD||LD.__stage38cPatched) return;
    var prev=(LD.getReport&&LD.getReport.bind(LD))||(LD.collectReport&&LD.collectReport.bind(LD));
    if(!prev) return;
    function reportWrap(){
      var report=prev()||{};
      report.stage38KeynoteToolbarStatus=publishStatus();
      report.stage38KeynoteToolbarDiagnostics={
        topToolbar:!!byId('stage38cTopToolbar'),
        actions:qsa('#stage38cTopToolbar [data-stage38c-action]').map(function(b){return b.getAttribute('data-stage38c-action')}),
        modePill:qsa('#stage38cTopToolbar [data-stage38c-mode]').map(function(b){return b.getAttribute('data-stage38c-mode')}),
        canvasCenter:!!byId('stage38aCanvasCenter'),
        inspectorColumn:!!byId('stage38aInspectorColumn')
      };
      return report;
    }
    if(LD.getReport) LD.getReport=reportWrap;
    if(LD.collectReport) LD.collectReport=reportWrap;
    LD.__stage38cPatched=true;
  }
  function init(){
    D.body.classList.add('stage38c-keynote-toolbar');
    makeToolbar();
    patchDiagnostics();
    setTimeout(function(){makeToolbar();patchDiagnostics();publishStatus();},400);
    setTimeout(function(){publishStatus();},1300);
  }
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  W.LuminaStage38B={makeToolbar:makeToolbar,publishStatus:publishStatus,runAction:runAction};
})();
