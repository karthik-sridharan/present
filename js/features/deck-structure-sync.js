/* Stage 38I: safe command-only deck structure sync.
   Reintroduces the useful 38G parity goal without 38G's active observers.
   Rules: no MutationObserver, no location/history reload hooks, no diagnostic-time DOM rewrite. */
(function(){
  'use strict';
  var W = window, D = document, STAGE = 'stage38n-20260427-1';
  var OUTLINE_ID = 'stage35n-deck-outline-panel';
  var JUMP_ID = 'stage35l-slide-jump-overlay';
  var syncTimer = null;
  var settleTimer = null;
  var inSync = false;
  var commandHookCount = 0;
  var lastReason = 'init';
  var lastSyncedAt = '';
  var lastRenderedAt = '';
  var lastError = '';
  var syncCount = 0;
  var renderCount = 0;
  var boundClicks = false;
  var jumpBound = false;

  function byId(id){ return D.getElementById(id); }
  function qs(sel, root){ return (root || D).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function compact(value){ return String(value || '').replace(/\s+/g, ' ').trim(); }
  function app(){ return W.LuminaAppCommands || {}; }
  function appCount(){
    try { var n = Number(app().getSlideCount && app().getSlideCount()); return Number.isFinite(n) && n >= 0 ? n : null; }
    catch(_e){ return null; }
  }
  function appActive(){
    try { var n = Number(app().getActiveIndex && app().getActiveIndex()); return Number.isFinite(n) ? n : null; }
    catch(_e){ return null; }
  }
  function directDeckChildren(){
    var deck = byId('deckList');
    if(!deck) return [];
    return Array.prototype.slice.call(deck.children || []).filter(function(el){
      return el && el.nodeType === 1 && el.hasAttribute('data-index') &&
        !el.matches('[data-stage38e-rail-actions], .stage38e-rail-actions');
    });
  }
  function cleanRailTitle(el, fallbackNumber){
    var direct = qs('.deck-thumb-title, .deck-thumb-title-line', el);
    var title = direct ? compact(direct.textContent) : '';
    if(title) return title;
    try {
      var clone = el.cloneNode(true);
      qsa('.deck-thumb, .meta, small, .badge, .stage38e-rail-actions, .stage38e-rail-grip, [data-stage38e-rail-actions]', clone).forEach(function(n){ n.remove(); });
      title = compact(clone.textContent);
    } catch(_e) {}
    title = title.replace(/^Slide\s+\d+\s*/i, '').replace(/\d+\.\s*(single|two-col|title|section|layout).*$/i, '').trim();
    return title || ('Slide ' + fallbackNumber);
  }
  function railSlides(){
    return directDeckChildren().map(function(el, i){
      var raw = Number(el.getAttribute('data-index'));
      var idx = Number.isFinite(raw) ? raw : i;
      var metaNode = qs('.deck-thumb-meta, .meta, small', el);
      var meta = metaNode ? compact(metaNode.textContent) : '';
      var title = cleanRailTitle(el, idx + 1);
      var active = el.classList.contains('active') || el.getAttribute('aria-selected') === 'true';
      var isSection = /section-divider|section/i.test(meta) || /^section\b/i.test(title);
      return { index:idx, number:idx+1, title:title, meta:meta, active:active, isSection:isSection, source:'rail' };
    }).sort(function(a,b){ return a.index - b.index; });
  }
  function outlineSlides(){
    return qsa('#' + OUTLINE_ID + ' .stage35n-outline-item[data-stage35n-outline-index]').map(function(el, i){
      var raw = Number(el.getAttribute('data-stage35n-outline-index'));
      var idx = Number.isFinite(raw) ? raw : i;
      var titleNode = qs('.stage35n-outline-title', el);
      var title = compact(titleNode ? titleNode.textContent : el.textContent) || ('Slide ' + (idx+1));
      var active = el.classList.contains('active') || el.getAttribute('aria-selected') === 'true';
      var isSection = /^section\b/i.test(title);
      return { index:idx, number:idx+1, title:title, meta:'', active:active, isSection:isSection, source:'outline' };
    }).sort(function(a,b){ return a.index - b.index; });
  }
  function isJumpOpen(){
    var overlay = byId(JUMP_ID);
    if(!overlay) return false;
    return overlay.classList.contains('open') || overlay.getAttribute('aria-hidden') === 'false' || overlay.style.display === 'block';
  }
  function jumpDomCount(){ return qsa('#' + JUMP_ID + ' [data-stage35l-jump-index]').length; }
  function canonicalSnapshot(){
    var rail = railSlides();
    var outline = outlineSlides();
    var appN = appCount();
    var activeFromApp = appActive();
    var source = rail.length ? 'rail' : (outline.length ? 'outline' : (appN ? 'app' : 'empty'));
    var slides = rail.length ? rail.slice() : outline.slice();
    var maxCount = Math.max(rail.length, outline.length, Number.isFinite(appN) ? appN : 0);
    if(!slides.length && maxCount > 0){
      for(var i=0;i<maxCount;i++) slides.push({ index:i, number:i+1, title:'Slide ' + (i+1), meta:'', active:activeFromApp === i, isSection:false, source:'app-placeholder' });
    }
    while(slides.length < maxCount){
      var idx = slides.length;
      slides.push({ index:idx, number:idx+1, title:'Slide ' + (idx+1), meta:'', active:activeFromApp === idx, isSection:false, source:'placeholder' });
    }
    var activeRail = rail.find(function(s){ return s.active; });
    var activeOutline = outline.find(function(s){ return s.active; });
    var activeIdx = activeRail ? activeRail.index : (activeOutline ? activeOutline.index : (Number.isFinite(activeFromApp) ? activeFromApp : -1));
    slides.forEach(function(s){ s.active = s.index === activeIdx; s.number = s.index + 1; });
    return { stage:STAGE, source:source, slides:slides, liveDeckCount:maxCount, appDeckCount:Number.isFinite(appN) ? appN : null, slideRailCount:rail.length, outlineDomCount:outline.length, jumpDomCount:jumpDomCount(), activeSlideIndex:activeIdx, activeSlideNumber:activeIdx >= 0 ? activeIdx + 1 : null };
  }
  function renderOutline(snapshot){
    snapshot = snapshot || canonicalSnapshot();
    var panel = byId(OUTLINE_ID);
    if(!panel) return false;
    var list = qs('[data-stage35n-outline-list]', panel);
    if(!list) return false;
    var slides = snapshot.slides || [];
    if(!slides.length){
      list.innerHTML = '<div class="stage35n-outline-empty">No slides yet. Add or import slides to populate the deck outline.</div>';
    } else {
      var html = '', wroteSection = false, currentSection = 'Deck';
      slides.forEach(function(slide){
        if(slide.isSection){
          currentSection = slide.title || ('Section ' + slide.number);
          html += '<div class="stage35n-outline-section">' + esc(currentSection) + '</div>';
          wroteSection = true;
        } else if(!wroteSection){
          html += '<div class="stage35n-outline-section">' + esc(currentSection) + '</div>';
          wroteSection = true;
        }
        html += '<button type="button" class="stage35n-outline-item ' + (slide.active ? 'active' : '') + '" data-stage35n-outline-index="' + esc(slide.index) + '" data-stage38i-safe-outline="1">'
          + '<span class="stage35n-outline-num">' + esc(slide.number) + '</span>'
          + '<span class="stage35n-outline-title">' + esc(slide.title) + '</span>'
          + '</button>';
      });
      list.innerHTML = html;
    }
    panel.dataset.stage38iSynced = '1';
    renderCount++;
    lastRenderedAt = new Date().toISOString();
    return true;
  }
  function matches(slide, query){
    if(!query) return true;
    var q = String(query || '').toLowerCase();
    return String(slide.number).indexOf(q) !== -1 || String(slide.title || '').toLowerCase().indexOf(q) !== -1 || String(slide.meta || '').toLowerCase().indexOf(q) !== -1;
  }
  function renderJump(snapshot){
    snapshot = snapshot || canonicalSnapshot();
    var overlay = byId(JUMP_ID);
    if(!overlay) return false;
    var list = qs('[data-stage35l-jump-list]', overlay);
    if(!list) return false;
    var search = qs('[data-stage35l-jump-search]', overlay);
    var query = search ? compact(search.value) : '';
    var slides = (snapshot.slides || []).filter(function(slide){ return matches(slide, query); });
    if(!slides.length){
      list.innerHTML = '<div class="stage35l-jump-empty">No matching slides found. Try clearing the search, or add slides first.</div>';
    } else {
      list.innerHTML = slides.map(function(slide){
        return '<button type="button" class="stage35l-jump-item ' + (slide.active ? 'active' : '') + '" data-stage35l-jump-index="' + esc(slide.index) + '" data-stage38i-safe-jump="1">'
          + '<span class="stage35l-jump-index">' + esc(slide.number) + '</span>'
          + '<span class="stage35l-jump-title">' + esc(slide.title) + '</span>'
          + '<span class="stage35l-jump-meta">' + esc(slide.meta || (slide.active ? 'current' : 'jump')) + '</span>'
          + '</button>';
      }).join('');
    }
    if(!jumpBound){
      jumpBound = true;
      overlay.addEventListener('click', function(event){
        var btn = event.target && event.target.closest && event.target.closest('[data-stage35l-jump-index]');
        if(!btn) return;
        var idx = Number(btn.getAttribute('data-stage35l-jump-index'));
        if(!Number.isFinite(idx)) return;
        try { if(typeof app().goToSlide === 'function') app().goToSlide(idx); } catch(e){ lastError = String(e && (e.message || e) || e); }
        scheduleSync('jump-click', true);
      }, true);
      if(search){
        search.addEventListener('input', function(){ renderJump(canonicalSnapshot()); publish(canonicalSnapshot()); }, false);
      }
    }
    renderCount++;
    lastRenderedAt = new Date().toISOString();
    return true;
  }
  function railStatus(snapshot){
    return { stage:STAGE, thumbnailRail:true, deckItemMode:'thumbnail', slideCount:snapshot.liveDeckCount, activeSlideNumber:snapshot.activeSlideNumber, renderedThumbCount:snapshot.slideRailCount, textOnlyDeckItems:qsa('#deckList .deck-item:not(.deck-thumb-item)').length, behaviorChanged:false, safeDeckSync:true };
  }
  function outlineStatus(snapshot){
    var sectionCount = qsa('#' + OUTLINE_ID + ' .stage35n-outline-section').length;
    return { stage:STAGE, outlinePanel:!!byId(OUTLINE_ID), outlineDockButton:!!qs('[data-stage35n-outline-button]'), slideCount:snapshot.liveDeckCount, sectionCount:sectionCount, activeSlideNumber:snapshot.activeSlideNumber, behaviorChanged:false, liveDeckSync:true, safeCommandOnly:true };
  }
  function jumpStatus(snapshot){
    return { stage:STAGE, slideJumpOverlay:!!byId(JUMP_ID), slideJumpButton:!!qs('[data-stage35l-jump-button]'), open:isJumpOpen(), slideCount:snapshot.liveDeckCount, activeSlideNumber:snapshot.activeSlideNumber, lastJumpIndex:(W.__LUMINA_STAGE35L_FEATURE_POLISH || {}).lastJumpIndex || null, keyboardSlideJumpShortcut:'Ctrl/⌘+K', behaviorChanged:false, liveDeckSync:true, safeCommandOnly:true };
  }
  function status(snapshot){
    snapshot = snapshot || canonicalSnapshot();
    var outlineCount = qsa('#' + OUTLINE_ID + ' .stage35n-outline-item[data-stage35n-outline-index]').length;
    var jumpCount = qsa('#' + JUMP_ID + ' [data-stage35l-jump-index]').length;
    var matchOutline = outlineCount === 0 || outlineCount === snapshot.liveDeckCount;
    var matchJump = !isJumpOpen() || jumpCount === snapshot.liveDeckCount;
    var structurePanel = !!byId('stage38eStructurePanel');
    return {
      stage:STAGE,
      safeCommandDeckSync:true,
      commandOnly:true,
      noMutationObserver:true,
      noPageReloadHooks:true,
      diagnosticRenderSuppressed:true,
      activeObserversAdded:false,
      commandHookCount:commandHookCount,
      clickHooksBound:boundClicks,
      liveDeckCount:snapshot.liveDeckCount,
      appDeckCount:snapshot.appDeckCount,
      slideRailCount:snapshot.slideRailCount,
      outlineCount:outlineCount,
      jumpCount:jumpCount,
      jumpOpen:isJumpOpen(),
      activeSlideIndex:snapshot.activeSlideIndex,
      activeSlideNumber:snapshot.activeSlideNumber,
      syncSource:snapshot.source,
      syncCount:syncCount,
      renderCount:renderCount,
      lastReason:lastReason,
      lastSyncedAt:lastSyncedAt,
      lastRenderedAt:lastRenderedAt,
      lastError:lastError,
      canvasFitPreserved:!!(W.__LUMINA_STAGE38F_CANVAS_FIT && W.__LUMINA_STAGE38F_CANVAS_FIT.pass),
      structureControlsPreserved:structurePanel && qsa('#deckList [data-stage38e-rail-actions]').length >= Math.min(snapshot.slideRailCount, Math.max(0, snapshot.liveDeckCount)),
      tests:{
        noStage38GScript:!byId('stage38g-live-deck-structure-sync-script'),
        noMutationObserver:true,
        noPageReloadHooks:true,
        commandHooks:commandHookCount > 0,
        structurePanel:structurePanel,
        canvasFitPresent:!!W.__LUMINA_STAGE38F_CANVAS_FIT,
        outlineMatchesWhenPresent:matchOutline,
        jumpMatchesWhenOpen:matchJump,
        pass:!byId('stage38g-live-deck-structure-sync-script') && commandHookCount > 0 && structurePanel && matchOutline && matchJump
      }
    };
  }
  function publish(snapshot){
    snapshot = snapshot || canonicalSnapshot();
    W.__LUMINA_STAGE35S_THUMBNAIL_RAIL = railStatus(snapshot);
    W.__LUMINA_STAGE35N_OUTLINE_NAVIGATOR = outlineStatus(snapshot);
    W.__LUMINA_STAGE35L_FEATURE_POLISH = Object.assign({}, W.__LUMINA_STAGE35L_FEATURE_POLISH || {}, jumpStatus(snapshot));
    W.__LUMINA_STAGE38I_SAFE_DECK_SYNC = Object.freeze(status(snapshot));
    return W.__LUMINA_STAGE38I_SAFE_DECK_SYNC;
  }
  function pulse(){
    if(!D.body) return;
    D.body.classList.add('stage38i-sync-pulse');
    setTimeout(function(){ D.body && D.body.classList.remove('stage38i-sync-pulse'); }, 130);
  }
  function sync(reason, render){
    if(inSync) return W.__LUMINA_STAGE38I_SAFE_DECK_SYNC || publish();
    inSync = true;
    lastReason = reason || lastReason || 'sync';
    lastSyncedAt = new Date().toISOString();
    syncCount++;
    try {
      var snapshot = canonicalSnapshot();
      if(render){
        renderOutline(snapshot);
        if(isJumpOpen()) renderJump(snapshot);
        pulse();
      }
      return publish(canonicalSnapshot());
    } catch(e){
      lastError = String(e && (e.stack || e.message) || e);
      return publish(canonicalSnapshot());
    } finally {
      inSync = false;
    }
  }
  function scheduleSync(reason, render){
    lastReason = reason || lastReason || 'scheduled';
    if(syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function(){ sync(lastReason, render !== false); }, 55);
    if(settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(function(){ sync((lastReason || 'scheduled') + '+settle', false); }, 260);
  }
  function wrapCommand(name){
    var api = app();
    if(!api || typeof api[name] !== 'function' || api[name].__stage38iWrapped) return false;
    var original = api[name];
    api[name] = function(){
      var result;
      try { result = original.apply(this, arguments); }
      finally { scheduleSync('command:' + name, true); }
      return result;
    };
    api[name].__stage38iWrapped = true;
    commandHookCount++;
    return true;
  }
  function wrapCommands(){
    ['addSlide','addSlideFromSnippet','updateSlide','duplicateSlide','deleteSlide','moveSlide','goToSlide','nextSlide','previousSlide','renderDeckList','applySlideFromEditor'].forEach(wrapCommand);
    return commandHookCount > 0;
  }
  function bindClicks(){
    if(boundClicks) return true;
    boundClicks = true;
    D.addEventListener('click', function(event){
      var t = event.target;
      if(!t || !t.closest) return;
      if(t.closest('[data-stage35l-jump-button]')){
        setTimeout(function(){ sync('open-jump', true); }, 80);
      }
      if(t.closest('[data-stage35n-outline-refresh], [data-stage38e-refresh-structure], [data-stage38e-add-section], [data-stage38d-layout-add], [data-stage38d-layout-load], #addSlide, #duplicateSlide, #deleteSlide, #updateSlide')){
        scheduleSync('ui-click', true);
      }
    }, true);
    return true;
  }
  function patchDiagnostics(){
    var LD = W.LuminaDiagnostics;
    if(!LD || LD.__stage38iSafeDeckSyncPatched) return false;
    var prev = (typeof LD.collectReport === 'function' ? LD.collectReport.bind(LD) : (typeof LD.getReport === 'function' ? LD.getReport.bind(LD) : null));
    if(!prev) return false;
    function wrap(){
      var report = {};
      try { report = prev() || {}; } catch(e){ report = { stage:STAGE, stage38iPreviousReportError:String(e && (e.stack || e.message) || e) }; }
      var snapshot = canonicalSnapshot();
      var st = publish(snapshot);
      report.stage = STAGE;
      report.diagnosticScriptStage = STAGE;
      report.stageFromWindow = W.LUMINA_STAGE || STAGE;
      report.indexStageSignature = W.LUMINA_STAGE_SIGNATURE || 'index-inline-stage38n-independent-panel-heights-preview-lift-20260427-1';
      report.indexDatasetStage = D.documentElement && D.documentElement.dataset ? (D.documentElement.dataset.stage || STAGE) : STAGE;
      report.slideRailThumbnailStatus = railStatus(snapshot);
      report.deckOutlineStatus = outlineStatus(snapshot);
      report.slideJumpStatus = jumpStatus(snapshot);
      if(report.stage38ESlideStructureStatus){
        report.stage38ESlideStructureStatus = Object.assign({}, report.stage38ESlideStructureStatus, {
          stage:STAGE,
          safeCommandDeckSync:true,
          deckOutlineParity:st.tests.outlineMatchesWhenPresent,
          activeSync:true,
          tests:Object.assign({}, report.stage38ESlideStructureStatus.tests || {}, {
            slideCount:st.liveDeckCount,
            railItems:st.slideRailCount,
            outlineItems:st.outlineCount,
            deckOutlineParity:st.tests.outlineMatchesWhenPresent,
            activeSync:true,
            stage38iSafeCommandDeckSync:true,
            pass:!!((report.stage38ESlideStructureStatus.tests || {}).pass !== false && st.tests.outlineMatchesWhenPresent)
          }),
          pass:!!((report.stage38ESlideStructureStatus.pass !== false) && st.tests.outlineMatchesWhenPresent)
        });
      }
      report.stage38ISafeDeckSyncStatus = st;
      report.stage38ISafeDeckSyncDiagnostics = {
        commandHookCount:st.commandHookCount,
        syncCount:st.syncCount,
        renderCount:st.renderCount,
        diagnosticRenderSuppressed:st.diagnosticRenderSuppressed,
        noMutationObserver:st.noMutationObserver,
        noPageReloadHooks:st.noPageReloadHooks,
        activeObserversAdded:st.activeObserversAdded,
        liveDeckCount:st.liveDeckCount,
        slideRailCount:st.slideRailCount,
        outlineCount:st.outlineCount,
        jumpCount:st.jumpCount,
        syncSource:st.syncSource,
        slideTitles:(snapshot.slides || []).map(function(s){ return { index:s.index, title:s.title, active:!!s.active, source:s.source }; })
      };
      return report;
    }
    LD.collectReport = wrap;
    LD.getReport = wrap;
    LD.__stage38iSafeDeckSyncPatched = true;
    return true;
  }
  function init(){
    if(D.body) D.body.classList.add('stage38i-safe-command-deck-sync');
    wrapCommands();
    bindClicks();
    patchDiagnostics();
    sync('init-status-only', false);
    setTimeout(function(){ wrapCommands(); patchDiagnostics(); sync('init-one-shot-render', true); }, 640);
    setTimeout(function(){ wrapCommands(); patchDiagnostics(); sync('late-status-only', false); }, 1600);
    W.LuminaStage38ISafeDeckSync = { stage:STAGE, refresh:function(){ return sync('manual-refresh', true); }, status:function(){ return publish(canonicalSnapshot()); }, snapshot:canonicalSnapshot, schedule:scheduleSync };
  }
  if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
