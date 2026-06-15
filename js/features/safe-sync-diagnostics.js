/* Stage 38H: emergency rollback of Stage 38G active deck-sync loop.
   Preserves Stage 38F canvas-fit cleanup and all Stage 38E structure controls. */
(function(){
  'use strict';
  var W=window,D=document,STAGE='stage38n-20260427-1';
  function qsa(sel){ return Array.prototype.slice.call(D.querySelectorAll(sel)); }
  function status(){
    var rail=qsa('#deckList [data-index]').filter(function(el){ return !el.matches('[data-stage38e-rail-actions], .stage38e-rail-actions'); });
    var outline=qsa('#stage35n-deck-outline-panel .stage35n-outline-item[data-stage35n-outline-index]');
    var st={
      stage:STAGE,
      emergencyRollback:true,
      disabledStage38GActiveSync:true,
      preservedStage38FCanvasFit:!!(W.__LUMINA_STAGE38F_CANVAS_FIT && W.__LUMINA_STAGE38F_CANVAS_FIT.pass),
      preservedStage38EStructureControls:!!D.getElementById('stage38eStructurePanel'),
      railItemCount:rail.length,
      outlineItemCount:outline.length,
      bootGuard:W.__LUMINA_STAGE38H_BOOT_GUARD||null,
      noPageReloadHooks:true,
      activeObserversAdded:false,
      tests:{
        noStage38GScript:!D.getElementById('stage38g-live-deck-structure-sync-script'),
        canvasFitPresent:!!W.__LUMINA_STAGE38F_CANVAS_FIT,
        structurePanelPresent:!!D.getElementById('stage38eStructurePanel'),
        pass:!D.getElementById('stage38g-live-deck-structure-sync-script') && !!D.getElementById('stage38eStructurePanel')
      }
    };
    st.pass=st.tests.pass;
    W.__LUMINA_STAGE38H_RECOVERY=Object.freeze(st);
    return W.__LUMINA_STAGE38H_RECOVERY;
  }
  function patchDiagnostics(){
    var LD=W.LuminaDiagnostics;
    if(!LD||LD.__stage38hRecoveryPatched) return false;
    var prev=(typeof LD.collectReport==='function'?LD.collectReport.bind(LD):(typeof LD.getReport==='function'?LD.getReport.bind(LD):null));
    if(!prev) return false;
    function wrap(){
      var report={};
      try{ report=prev()||{}; }catch(e){ report={stage:STAGE,stage38hPreviousReportError:String(e&&(e.stack||e.message)||e)}; }
      report.stage=STAGE;
      report.diagnosticScriptStage=STAGE;
      report.stageFromWindow=W.LUMINA_STAGE||STAGE;
      report.indexStageSignature=W.LUMINA_STAGE_SIGNATURE||'index-inline-stage38n-independent-panel-heights-preview-lift-20260427-1';
      report.indexDatasetStage=D.documentElement&&D.documentElement.dataset?(D.documentElement.dataset.stage||STAGE):STAGE;
      report.stage38HRecoveryStatus=status();
      report.stage38HRecoveryDiagnostics={
        removedScripts:['stage38g-live-deck-structure-sync-script'],
        reason:'Stage 38G active live deck sync could cause repeated refresh/re-render loops before diagnostics could be collected.',
        fallbackBase:'Stage 38F canvas-fit regression cleanup',
        bootGuard:W.__LUMINA_STAGE38H_BOOT_GUARD||null
      };
      return report;
    }
    LD.collectReport=wrap;
    LD.getReport=wrap;
    LD.__stage38hRecoveryPatched=true;
    return true;
  }
  function init(){
    D.body&&D.body.classList.add('stage38i-safe-sync-base');
    W.__LUMINA_DISABLE_STAGE38G_LIVE_DECK_SYNC=true;
    patchDiagnostics();
    status();
    [100,400,1000].forEach(function(ms){ setTimeout(function(){ patchDiagnostics(); status(); },ms); });
  }
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init);else init();
})();
