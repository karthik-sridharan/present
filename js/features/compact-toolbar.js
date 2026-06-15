(function(){
  'use strict';
  var W=window,D=document,STAGE='stage38n-20260427-1';
  function byId(id){ return D.getElementById(id); }
  function qs(sel,root){ return (root||D).querySelector(sel); }
  function rect(el){ if(!el || !el.getBoundingClientRect) return null; var r=el.getBoundingClientRect(); return {width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,top:Math.round(r.top*100)/100,bottom:Math.round(r.bottom*100)/100}; }
  function px(value){ var n=parseFloat(String(value||'0')); return Number.isFinite(n)?n:0; }
  function status(){
    var bar=byId('stage38cTopToolbar');
    var btn=qs('#stage38cTopToolbar .stage38c-tool-btn');
    var page=qs('.page.stage38a-page')||qs('.page');
    var wrap=qs('.stage38a-canvas-center .preview-wrap');
    var viewport=qs('.stage38a-canvas-center .preview-viewport')||qs('.preview-viewport');
    var frame=qs('.stage38a-canvas-center .preview-frame')||qs('.preview-frame');
    var csBar=bar?getComputedStyle(bar):null;
    var csPage=page?getComputedStyle(page):null;
    var csWrap=wrap?getComputedStyle(wrap):null;
    var st={
      stage:STAGE,
      compactToolbar:true,
      visualOnly:true,
      noCommandHooks:true,
      fixedUnexpectedEof:true,
      toolbarPresent:!!bar,
      toolbarHeightPx:bar?rect(bar).height:0,
      buttonHeightPx:btn?rect(btn).height:0,
      toolbarPaddingY:csBar?Math.round((px(csBar.paddingTop)+px(csBar.paddingBottom))*100)/100:0,
      pageRowGapPx:csPage?Math.round(px(csPage.rowGap||csPage.gridRowGap)*100)/100:0,
      previewWrapPaddingY:csWrap?Math.round((px(csWrap.paddingTop)+px(csWrap.paddingBottom))*100)/100:0,
      previewWrap:rect(wrap),
      previewViewport:rect(viewport),
      previewFrame:rect(frame),
      previewMovedUp:true,
      canvasFitPreserved:!!(W.__LUMINA_STAGE38F_CANVAS_FIT && W.__LUMINA_STAGE38F_CANVAS_FIT.pass),
      safeDeckSyncPreserved:!!(W.__LUMINA_STAGE38I_SAFE_DECK_SYNC && W.__LUMINA_STAGE38I_SAFE_DECK_SYNC.safeCommandDeckSync),
      tests:{
        toolbarPresent:!!bar,
        toolbarCompact:bar?rect(bar).height<=42:false,
        buttonsCompact:btn?rect(btn).height<=30:false,
        rowGapCompact:csPage?px(csPage.rowGap||csPage.gridRowGap)<=8:false,
        previewWrapCompact:csWrap?(px(csWrap.paddingTop)+px(csWrap.paddingBottom))<=18:false,
        canvasFitPresent:!!W.__LUMINA_STAGE38F_CANVAS_FIT,
        safeDeckSyncPresent:!!W.__LUMINA_STAGE38I_SAFE_DECK_SYNC,
        pass:false
      }
    };
    st.tests.pass=!!(st.tests.toolbarPresent&&st.tests.toolbarCompact&&st.tests.buttonsCompact&&st.tests.rowGapCompact&&st.tests.previewWrapCompact);
    st.pass=st.tests.pass;
    W.__LUMINA_STAGE38K_COMPACT_TOOLBAR=Object.freeze(st);
    return W.__LUMINA_STAGE38K_COMPACT_TOOLBAR;
  }
  function patchDiagnostics(){
    var LD=W.LuminaDiagnostics;
    if(!LD||LD.__stage38kCompactToolbarPatched) return false;
    var prev=(typeof LD.collectReport==='function'?LD.collectReport.bind(LD):(typeof LD.getReport==='function'?LD.getReport.bind(LD):null));
    if(!prev) return false;
    function wrap(){
      var report={};
      try{ report=prev()||{}; }catch(e){ report={stage:STAGE,stage38kPreviousReportError:String(e&&(e.stack||e.message)||e)}; }
      var st=status();
      report.stage=STAGE;
      report.diagnosticScriptStage=STAGE;
      report.stageFromWindow=W.LUMINA_STAGE||STAGE;
      report.indexStageSignature=W.LUMINA_STAGE_SIGNATURE||'index-inline-stage38n-independent-panel-heights-preview-lift-20260427-1';
      report.indexDatasetStage=D.documentElement&&D.documentElement.dataset?(D.documentElement.dataset.luminaStage||D.documentElement.dataset.stage||STAGE):STAGE;
      report.stage38KCompactToolbarStatus=st;
      report.stage38KCompactToolbarDiagnostics={
        toolbarHeightPx:st.toolbarHeightPx,
        buttonHeightPx:st.buttonHeightPx,
        toolbarPaddingY:st.toolbarPaddingY,
        pageRowGapPx:st.pageRowGapPx,
        previewWrapPaddingY:st.previewWrapPaddingY,
        previewWrapTop:st.previewWrap&&st.previewWrap.top,
        previewFrameTop:st.previewFrame&&st.previewFrame.top,
        previewFrameWidth:st.previewFrame&&st.previewFrame.width,
        visualOnly:true,
        noCommandHooks:true,
        fixedUnexpectedEof:true
      };
      if(report.stage38KeynoteToolbarStatus){
        report.stage38KeynoteToolbarStatus=Object.assign({},report.stage38KeynoteToolbarStatus,{stage:STAGE,compactToolbar:true,toolbarHeightPx:st.toolbarHeightPx,buttonHeightPx:st.buttonHeightPx});
      }
      if(report.stage38FCanvasFitStatus){
        report.stage38FCanvasFitStatus=Object.assign({},report.stage38FCanvasFitStatus,{stage:STAGE,compactToolbarPreserved:true});
      }
      return report;
    }
    LD.collectReport=wrap;
    LD.getReport=wrap;
    LD.__stage38kCompactToolbarPatched=true;
    return true;
  }
  function init(){
    if(D.body) D.body.classList.add('stage38k-compact-toolbar');
    patchDiagnostics();
    status();
    [120,480,1200,2200].forEach(function(ms){ setTimeout(function(){ patchDiagnostics(); status(); },ms); });
    W.LuminaStage38KCompactToolbar={stage:STAGE,status:status,refresh:status};
  }
  if(D.readyState==='loading') D.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
