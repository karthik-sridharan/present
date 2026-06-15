(function(){
  'use strict';
  var W=window,D=document,STAGE='stage38r-20260427-1',SIG='index-inline-stage38r-diagnostics-ai-drawer-alignment-20260427-1';
  function qs(sel,root){return (root||D).querySelector(sel)}
  function qsa(sel,root){return Array.prototype.slice.call((root||D).querySelectorAll(sel))}
  function now(){return new Date().toISOString()}
  function rect(el){if(!el||!el.getBoundingClientRect)return null;var r=el.getBoundingClientRect();return {width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,top:Math.round(r.top*100)/100,bottom:Math.round(r.bottom*100)/100}}
  function visibleButtons(){var dock=qs('.stage38a-canvas-center .stage35c-quick-dock')||qs('.stage35c-quick-dock');if(!dock)return [];return qsa('.btn',dock).filter(function(b){try{return getComputedStyle(b).display!=='none'&&getComputedStyle(b).visibility!=='hidden'}catch(_e){return true}})}
  function getLabels(){return visibleButtons().map(function(b){return (b.textContent||'').replace(/\s+/g,' ').trim()}).filter(Boolean)}
  function hasAiDrawer(labels){return labels.some(function(x){return /\bAI\s*drawer\b/i.test(x)||/\bCopilot\b/i.test(x)})}
  function alignCenterStatus(report){
    var st=report&&report.stage38OCenterActionsStatus;if(!st)return null;
    var labels=(st.buttons&&Array.isArray(st.buttons.labels)?st.buttons.labels.slice():getLabels());
    var aiOk=hasAiDrawer(labels);
    var tests=Object.assign({},st.tests||{});
    tests.copilotPresent=!!aiOk;
    tests.aiDrawerAcceptedAsCopilot=!!aiOk;
    tests.pass=!!(tests.dockPresent&&tests.removedUpdate&&tests.removedOutline&&tests.buttonsLarger&&tests.duplicatePresent&&tests.copilotPresent&&tests.delegateBound&&tests.previewLarge);
    var next=Object.assign({},st,{stage:STAGE,diagnosticsAlignedByStage38R:true,aiDrawerAcceptedAsCopilot:!!aiOk,tests:tests,pass:tests.pass});
    if(next.buttons)next.buttons=Object.assign({},next.buttons,{labels:labels});
    report.stage38OCenterActionsStatus=next;
    report.stage38OCenterActionsDiagnostics={buttons:next.buttons,previewFrame:next.previewFrame||rect(qs('.stage38a-canvas-center .preview-frame')||qs('.preview-frame')),lastAction:next.lastAction||null,tests:tests,diagnosticsAlignedByStage38R:true};
    return next;
  }
  function status(report){
    var labels=getLabels();
    var aiOk=hasAiDrawer(labels);
    var hasOld=!!(report&&report.stage38OCenterActionsStatus);
    var st=hasOld?report.stage38OCenterActionsStatus:{};
    var tests={oldCenterDiagnosticPresent:hasOld,aiDrawerLabelPresent:aiOk,copilotSuccessorAccepted:!!(st.tests&&st.tests.copilotPresent),centerActionsPass:!!st.pass,stage38QStillPass:!!(report&&report.stage38QAiDrawerAdvancedStatus&&report.stage38QAiDrawerAdvancedStatus.pass),behaviorChanged:false};
    tests.pass=!!(tests.oldCenterDiagnosticPresent&&tests.aiDrawerLabelPresent&&tests.copilotSuccessorAccepted&&tests.centerActionsPass&&tests.stage38QStillPass);
    return {stage:STAGE,diagnosticsAligned:true,visualOnly:true,noCommandHooks:true,reason:'Stage 38Q intentionally relabeled the center Copilot action to AI drawer; Stage 38R accepts AI drawer as the Copilot successor in Stage 38O diagnostics.',labels:labels,tests:tests,pass:tests.pass,checkedAt:now()};
  }
  function patchDiagnostics(){
    var LD=W.LuminaDiagnostics;if(!LD||LD.__stage38rPatched)return false;
    var prev=(typeof LD.collectReport==='function'?LD.collectReport.bind(LD):(typeof LD.getReport==='function'?LD.getReport.bind(LD):null));if(!prev)return false;
    function wrap(){
      var r={};try{r=prev()||{}}catch(e){r={stage:STAGE,stage38rPreviousReportError:String(e&&(e.stack||e.message)||e)}}
      alignCenterStatus(r);
      var s=status(r);
      r.stage=STAGE;r.diagnosticScriptStage=STAGE;r.stageFromWindow=W.LUMINA_STAGE||STAGE;r.indexStageSignature=W.LUMINA_STAGE_SIGNATURE||SIG;
      if(D.documentElement&&D.documentElement.dataset)r.indexDatasetStage=D.documentElement.dataset.luminaStage||D.documentElement.dataset.stage||STAGE;
      r.stage38RDiagnosticsAlignmentStatus=s;
      r.stage38RDiagnosticsAlignmentDiagnostics={labels:s.labels,tests:s.tests,reason:s.reason};
      if(r.featurePolishSummary)r.featurePolishSummary=Object.assign({},r.featurePolishSummary,{centerDockAiDrawerAccepted:true,staleCenterDiagnosticAligned:true});
      return r;
    }
    LD.collectReport=wrap;LD.getReport=wrap;LD.__stage38rPatched=true;return true;
  }
  function refresh(){var report=null;try{report=W.LuminaDiagnostics&&typeof W.LuminaDiagnostics.collectReport==='function'?W.LuminaDiagnostics.collectReport():null}catch(_e){}W.__LUMINA_STAGE38R_DIAGNOSTICS_ALIGNMENT_STATUS=status(report);return W.__LUMINA_STAGE38R_DIAGNOSTICS_ALIGNMENT_STATUS}
  function init(){W.LUMINA_STAGE=STAGE;W.LUMINA_STAGE_SIGNATURE=SIG;try{D.documentElement.setAttribute('data-lumina-stage',STAGE);D.documentElement.setAttribute('data-lumina-stage-signature',SIG)}catch(_e){}patchDiagnostics();refresh();[80,180,420,900,1800,3600].forEach(function(ms){setTimeout(function(){patchDiagnostics();refresh()},ms)});W.LuminaStage38RDiagnosticsAlignment={stage:STAGE,status:refresh,refresh:refresh,alignCenterStatus:alignCenterStatus};}
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
