(function(){
  'use strict';
  var W = window;
  var STAGE = W.LUMINA_STAGE || 'stage38n-20260427-1';
  var tight = false;
  var lastStatus = null;
  function rectOf(sel){
    var el = document.querySelector(sel);
    if(!el) return null;
    var r = el.getBoundingClientRect();
    return { width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  }
  function numberPx(value){
    var n = parseFloat(value);
    return isFinite(n) ? n : 0;
  }
  function measureDeadSpace(){
    var viewport = document.querySelector('.preview-viewport');
    var stage = document.querySelector('.preview-stage');
    var frame = document.querySelector('.preview-frame');
    if(!viewport || !stage || !frame) return null;
    var vp = viewport.getBoundingClientRect();
    var st = stage.getBoundingClientRect();
    var fr = frame.getBoundingClientRect();
    var cs = getComputedStyle(viewport);
    return {
      viewportHeight: Math.round(vp.height),
      stageHeight: Math.round(st.height),
      frameHeight: Math.round(fr.height),
      frameWidth: Math.round(fr.width),
      viewportPaddingY: Math.round(numberPx(cs.paddingTop) + numberPx(cs.paddingBottom)),
      verticalDeadSpaceApprox: Math.max(0, Math.round(st.height - fr.height))
    };
  }
  function applyFit(){
    var body = document.body;
    if(!body) return;
    var left = document.querySelector('.editor-shell');
    var right = document.querySelector('.right-shell');
    var preview = document.querySelector('.preview-wrap');
    if(!left || !right || !preview) return;
    var leftH = left.getBoundingClientRect().height;
    var rightH = right.getBoundingClientRect().height;
    var delta = rightH - leftH;
    if(!tight && delta > 18) tight = true;
    else if(tight && delta < -64) tight = false;
    body.classList.toggle('stage35o-right-tight', tight);
    /* Stage 35R: force a post-class style read before recording diagnostics.
       Previously status could still show the pre-tight delta, e.g. +36px. */
    try { void right.offsetHeight; } catch(_e) {}
    leftH = left.getBoundingClientRect().height;
    rightH = right.getBoundingClientRect().height;
    delta = rightH - leftH;
    lastStatus = {
      stage: STAGE,
      rightPanelFit: true,
      rightTightMode: tight,
      leftHeight: Math.round(leftH),
      rightHeight: Math.round(rightH),
      rightMinusLeft: Math.round(delta),
      previewWrap: rectOf('.preview-wrap'),
      previewViewport: rectOf('.preview-viewport'),
      previewFrame: rectOf('.preview-frame'),
      previewDeadSpace: measureDeadSpace(),
      behaviorChanged: false
    };
    W.__LUMINA_STAGE35O_RIGHT_PANEL_FIT = lastStatus;
  }
  function schedule(){
    W.requestAnimationFrame ? W.requestAnimationFrame(applyFit) : setTimeout(applyFit, 0);
  }
  function observe(){
    schedule();
    setTimeout(schedule, 120);
    setTimeout(schedule, 420);
    W.addEventListener('load', schedule);
    W.addEventListener('resize', schedule);
    var targets = ['.editor-shell', '.right-shell', '#previewFrame', '#preview', '#deckList'];
    targets.forEach(function(sel){
      var el = document.querySelector(sel);
      if(!el || !W.MutationObserver) return;
      try{ new MutationObserver(schedule).observe(el, { childList:true, subtree:true, attributes:true, characterData:true }); }catch(e){}
    });
    if(W.ResizeObserver){
      try{
        var ro = new ResizeObserver(schedule);
        ['.editor-shell', '.right-shell', '.preview-wrap', '.preview-frame'].forEach(function(sel){ var el = document.querySelector(sel); if(el) ro.observe(el); });
      }catch(e){}
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
  W.LuminaStage35ORightPanelFit = { apply: applyFit, getStatus: function(){ applyFit(); return lastStatus; } };
})();
