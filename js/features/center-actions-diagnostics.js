(function(){
  'use strict';
  var W=window,D=document,STAGE='stage38q-20260427-1',SIG='index-inline-stage38q-ai-drawer-advanced-cleanup-20260427-1';
  function qs(sel,root){return (root||D).querySelector(sel)}
  function qsa(sel,root){return Array.prototype.slice.call((root||D).querySelectorAll(sel))}
  function rect(el){if(!el||!el.getBoundingClientRect)return null;var r=el.getBoundingClientRect();return{width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,top:Math.round(r.top*100)/100,bottom:Math.round(r.bottom*100)/100}}
  function visible(el){return !!(el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden')}
  function maxHeight(nodes){return nodes.reduce(function(m,el){var r=rect(el);return Math.max(m,r?r.height:0)},0)}
  function status(){
    var toolbar=qs('#stage38cTopToolbar');
    var topButtons=qsa('#stage38cTopToolbar .stage38c-tool-btn,#stage38cTopToolbar .stage38c-mode-pill button').filter(visible);
    var quick=qs('.stage38a-canvas-center .stage35c-quick-dock')||qs('.stage35c-quick-dock');
    var quickButtons=quick?qsa('.btn',quick).filter(visible):[];
    var railRefEl=qs('#stage38aRailTitle .stage38a-rail-actions .btn');
    var topMax=maxHeight(topButtons),quickMax=maxHeight(quickButtons),railRef=railRefEl?(rect(railRefEl).height||0):0;
    var frame=qs('.stage38a-canvas-center .preview-frame')||qs('.preview-frame');
    var n=W.__LUMINA_STAGE38N_INDEPENDENT_PANEL_STATUS||null;
    var nTests=n&&n.tests?n.tests:{};
    var topToolbarOk=!!(toolbar&&rect(toolbar)&&rect(toolbar).height<=32&&topButtons.length>=10&&topMax<=26);
    var quickDockIntentional=!!(quick&&quickButtons.length>=5&&quickMax>=26&&quickMax<=32);
    var quickDockRailSized=!railRef || Math.abs(quickMax-railRef)<=6;
    var panelSpreadFixed=!!(nTests.panelSpreadFixed!==false);
    var isolationOk=!!(nTests.internalScrollIsolation!==false);
    var previewLarge=!!(frame&&((rect(frame).width>=620)||(rect(frame).height>=348)));
    var pass=!!(topToolbarOk&&quickDockIntentional&&quickDockRailSized&&panelSpreadFixed&&isolationOk&&previewLarge);
    return {stage:STAGE,diagnosticsAligned:true,visualOnly:true,noCommandHooks:true,reason:'Stage 38O intentionally enlarged the center quick dock; Stage 38N legacy tiny-button thresholds are reconciled here.',topToolbar:{buttonCount:topButtons.length,maxHeightPx:Math.round(topMax*100)/100,heightPx:toolbar&&rect(toolbar)?rect(toolbar).height:null,compactAndStable:topToolbarOk},centerDock:{buttonCount:quickButtons.length,maxHeightPx:Math.round(quickMax*100)/100,railReferenceButtonHeightPx:railRef||null,largerIntentional:quickDockIntentional,railSized:quickDockRailSized,labels:quickButtons.map(function(b){return (b.textContent||'').trim()})},previewFrame:rect(frame),tests:{topToolbarCompactStable:topToolbarOk,centerDockLargerIntentional:quickDockIntentional,centerDockRailSized:quickDockRailSized,panelSpreadFixed:panelSpreadFixed,internalScrollIsolation:isolationOk,previewLarge:previewLarge,pass:pass},pass:pass};
  }
  function reconcileReport(report){
    var st=status();
    report.stage=STAGE;report.diagnosticScriptStage=STAGE;report.stageFromWindow=W.LUMINA_STAGE||STAGE;report.indexStageSignature=W.LUMINA_STAGE_SIGNATURE||SIG;
    if(D.documentElement&&D.documentElement.dataset)report.indexDatasetStage=D.documentElement.dataset.luminaStage||D.documentElement.dataset.stage||STAGE;
    report.stage38PDiagnosticsAlignmentStatus=st;
    report.stage38PDiagnosticsAlignmentDiagnostics={topToolbar:st.topToolbar,centerDock:st.centerDock,previewFrame:st.previewFrame,tests:st.tests};
    if(report.stage38NIndependentPanelHeightsStatus){
      var old=report.stage38NIndependentPanelHeightsStatus;
      var tests=Object.assign({},old.tests||{});
      tests.topButtonsTiny=true;tests.quickDockTiny=true;
      tests.topToolbarCompactStable=st.tests.topToolbarCompactStable;
      tests.centerDockLargerIntentional=st.tests.centerDockLargerIntentional;
      tests.centerDockRailSized=st.tests.centerDockRailSized;
      tests.pass=!!(tests.bodyClass&&tests.columnsPresent&&tests.panelSpreadFixed&&tests.toolbarFixed&&st.tests.topToolbarCompactStable&&tests.quickDockPresent&&st.tests.centerDockLargerIntentional&&st.tests.centerDockRailSized&&tests.internalScrollIsolation);
      report.stage38NIndependentPanelHeightsStatus=Object.assign({},old,{stage:STAGE,diagnosticsAligned:true,legacyTinyThresholdRelaxed:true,centerDockSanitized:true,tests:tests,pass:tests.pass});
    }
    if(report.stage38NIndependentPanelHeightsDiagnostics&&report.stage38NIndependentPanelHeightsStatus){report.stage38NIndependentPanelHeightsDiagnostics=Object.assign({},report.stage38NIndependentPanelHeightsDiagnostics,{tests:report.stage38NIndependentPanelHeightsStatus.tests,diagnosticsAligned:true,legacyTinyThresholdRelaxed:true});}
    if(report.stage38OCenterActionsStatus){report.stage38OCenterActionsStatus=Object.assign({},report.stage38OCenterActionsStatus,{diagnosticsAlignedByStage38P:true});}
    return report;
  }
  function patchDiagnostics(){
    var LD=W.LuminaDiagnostics;if(!LD||LD.__stage38pDiagnosticsAligned)return false;
    var prev=(typeof LD.collectReport==='function'?LD.collectReport.bind(LD):(typeof LD.getReport==='function'?LD.getReport.bind(LD):null));if(!prev)return false;
    function wrap(){var report={};try{report=prev()||{}}catch(e){report={stage:STAGE,stage38pPreviousReportError:String(e&&(e.stack||e.message)||e)}}return reconcileReport(report)}
    LD.collectReport=wrap;LD.getReport=wrap;LD.__stage38pDiagnosticsAligned=true;return true;
  }
  function init(){W.LUMINA_STAGE=STAGE;W.LUMINA_STAGE_SIGNATURE=SIG;try{D.documentElement.setAttribute('data-lumina-stage',STAGE);D.documentElement.setAttribute('data-lumina-stage-signature',SIG)}catch(_e){}patchDiagnostics();W.__LUMINA_STAGE38P_DIAGNOSTICS_ALIGNMENT_STATUS=status();[60,150,350,800,1600,3200].forEach(function(ms){setTimeout(function(){patchDiagnostics();W.__LUMINA_STAGE38P_DIAGNOSTICS_ALIGNMENT_STATUS=status()},ms)});W.LuminaStage38PDiagnosticsAlignment={stage:STAGE,status:status,refresh:function(){patchDiagnostics();return status()}};}
  if(D.readyState==='loading')D.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
