(function(){
  'use strict';
  var W = window;
  var STAGE = W.LUMINA_STAGE || 'stage38n-20260427-1';
  var STATUS = {
    stage: STAGE,
    hotfix: true,
    clickDoubleTapFallback: true,
    visibleEditButton: true,
    bound: false,
    selected: false,
    lastSelectAt: '',
    lastOpenAt: '',
    lastOpenSource: '',
    lastError: '',
    behaviorChanged: false
  };
  var selectedTarget = null;
  var lastTap = { time: 0, x: 0, y: 0, target: null };
  var lastTouchAt = 0;
  var lastOpenMs = 0;
  var button = null;
  function publish(){ W.__LUMINA_STAGE35V_EDITABLE_FIGURE_HOTFIX = Object.assign({}, STATUS); return W.__LUMINA_STAGE35V_EDITABLE_FIGURE_HOTFIX; }
  function byId(id){ return document.getElementById(id); }
  function hasSvg(el){ return !!(el && ((el.matches && el.matches('svg')) || (el.querySelector && el.querySelector('svg')))); }
  function closestFigureTarget(target){
    if(!target || !target.closest) return null;
    return target.closest('#preview .figure-embed, #preview .figure-box, #preview figure, #preview svg');
  }
  function preferredTarget(target){
    if(!target || !target.closest) return target;
    return target.closest('#preview .figure-embed') || target.closest('#preview .figure-box') || target.closest('#preview figure') || target.closest('#preview svg') || target;
  }
  function sameTarget(a,b){ return !!(a && b && (a === b || (a.contains && a.contains(b)) || (b.contains && b.contains(a)))); }
  function pointFromEvent(event){
    var t = event && event.changedTouches && event.changedTouches[0];
    return { x: t ? t.clientX : (event && typeof event.clientX === 'number' ? event.clientX : 0), y: t ? t.clientY : (event && typeof event.clientY === 'number' ? event.clientY : 0) };
  }
  function clearSelection(){
    Array.from(document.querySelectorAll('#preview [data-stage35v-figure-selected="1"]')).forEach(function(el){ delete el.dataset.stage35vFigureSelected; });
    selectedTarget = null;
    STATUS.selected = false;
    publish();
    hideButton();
  }
  function ensureButton(){
    if(button && document.body.contains(button)) return button;
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'stage35vFigureEditButton';
    button.textContent = 'Edit figure';
    button.setAttribute('aria-label', 'Edit selected figure');
    button.addEventListener('click', function(event){
      event.preventDefault();
      event.stopPropagation();
      if(selectedTarget) openSelected('edit-button');
    });
    document.body.appendChild(button);
    return button;
  }
  function hideButton(){ if(button) button.style.display = 'none'; }
  function positionButton(){
    if(!selectedTarget || !document.body.contains(selectedTarget)){ hideButton(); return; }
    var b = ensureButton();
    var r = selectedTarget.getBoundingClientRect();
    if(!r || !isFinite(r.top)){ hideButton(); return; }
    b.style.display = 'inline-flex';
    var top = Math.max(8, r.top + 8);
    var left = Math.min(window.innerWidth - 128, Math.max(8, r.left + r.width - 112));
    b.style.top = top + 'px';
    b.style.left = left + 'px';
  }
  function selectFigure(target){
    var t = preferredTarget(target);
    if(!t || !hasSvg(t)) return false;
    Array.from(document.querySelectorAll('#preview [data-stage35v-figure-selected="1"]')).forEach(function(el){ if(el !== t) delete el.dataset.stage35vFigureSelected; });
    t.dataset.stage35vFigureSelected = '1';
    selectedTarget = t;
    STATUS.selected = true;
    STATUS.lastSelectAt = new Date().toISOString();
    STATUS.lastError = '';
    publish();
    positionButton();
    return true;
  }
  function openSelected(source){
    try{
      var now = Date.now();
      if(now - lastOpenMs < 700) return true;
      if(!selectedTarget || !document.body.contains(selectedTarget)) throw new Error('No selected figure to edit.');
      var api = W.LuminaStage35UEditableFigures;
      if(!api || typeof api.openFromPreview !== 'function') throw new Error('Stage 35U figure editor bridge is not available.');
      lastOpenMs = now;
      STATUS.lastOpenAt = new Date().toISOString();
      STATUS.lastOpenSource = source || 'unknown';
      STATUS.lastError = '';
      publish();
      return api.openFromPreview(selectedTarget);
    }catch(err){
      STATUS.lastError = err && err.message ? err.message : String(err || 'Could not open figure editor.');
      publish();
      try { W.luminaBootError && W.luminaBootError('Stage35V editable figure hotfix: ' + STATUS.lastError); } catch(_e){}
      return false;
    }
  }
  function handleTap(event, source){
    var preview = byId('preview');
    if(!preview) return;
    var rawTarget = closestFigureTarget(event.target);
    if(!rawTarget || !preview.contains(rawTarget) || !hasSvg(rawTarget)){
      if(source === 'click' && button && !button.contains(event.target)) clearSelection();
      return;
    }
    var target = preferredTarget(rawTarget);
    selectFigure(target);
    var now = Date.now();
    var p = pointFromEvent(event);
    var dx = p.x - (lastTap.x || 0), dy = p.y - (lastTap.y || 0);
    var close = Math.sqrt(dx*dx + dy*dy) < 32;
    var isDouble = sameTarget(target, lastTap.target) && close && (now - lastTap.time) > 40 && (now - lastTap.time) < 720;
    lastTap = { time: now, x: p.x, y: p.y, target: target };
    if(isDouble){
      event.preventDefault();
      event.stopPropagation();
      openSelected(source + '-double');
    }
  }
  function handleDblClick(event){
    var preview = byId('preview');
    var target = closestFigureTarget(event.target);
    if(!preview || !target || !preview.contains(target) || !hasSvg(target)) return;
    event.preventDefault();
    event.stopPropagation();
    selectFigure(target);
    openSelected('dblclick-hotfix');
  }
  function bind(){
    var preview = byId('preview');
    if(!preview){ publish(); return; }
    if(preview.dataset.stage35vEditableFigureHotfixBound === '1') return publish();
    preview.dataset.stage35vEditableFigureHotfixBound = '1';
    preview.addEventListener('dblclick', handleDblClick, true);
    preview.addEventListener('touchend', function(event){ lastTouchAt = Date.now(); handleTap(event, 'touchend'); }, true);
    preview.addEventListener('click', function(event){ if(Date.now() - lastTouchAt < 520) return; handleTap(event, 'click'); }, true);
    window.addEventListener('resize', positionButton);
    window.addEventListener('scroll', positionButton, true);
    document.addEventListener('keydown', function(event){
      if((event.key === 'Enter' || event.key === ' ') && selectedTarget && document.activeElement === button){
        event.preventDefault(); openSelected('keyboard-button');
      }
      if(event.key === 'Escape') clearSelection();
    }, true);
    try{
      var observer = new MutationObserver(function(){
        if(selectedTarget && !document.body.contains(selectedTarget)) clearSelection();
        else positionButton();
      });
      observer.observe(preview, { childList:true, subtree:true });
      W.__LUMINA_STAGE35V_EDITABLE_FIGURE_HOTFIX_OBSERVER = observer;
    }catch(_e){}
    STATUS.bound = true;
    publish();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  W.LuminaStage35VEditableFigureHotfix = { stage: STAGE, init: bind, status: publish, openSelected: openSelected, clearSelection: clearSelection };
})();
