/* Stage 35L: feature polish — searchable jump-to-slide overlay backed by the existing deck rail. */
(function(){
  'use strict';
  var STAGE = 'stage38n-20260427-1';
  var OVERLAY_ID = 'stage35l-slide-jump-overlay';
  var retryTimers = [];

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function editableTarget(target){
    if(!target) return false;
    var tag = String(target.tagName || '').toLowerCase();
    return !!(target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');
  }
  function deckButtons(){
    return Array.prototype.slice.call(document.querySelectorAll('#deckList .deck-item[data-index], #deckList [data-index]'));
  }
  function cleanTitle(btn, fallback){
    var clone = btn.cloneNode(true);
    clone.querySelectorAll('.meta, small, .badge').forEach(function(node){ node.remove(); });
    var title = (clone.textContent || '').replace(/\s+/g,' ').trim();
    return title || ('Slide ' + fallback);
  }
  function collectSlides(){
    var buttons = deckButtons();
    return buttons.map(function(btn, i){
      var rawIndex = btn.getAttribute('data-index');
      var index = Number(rawIndex);
      if(!Number.isFinite(index)) index = i;
      var metaNode = btn.querySelector('.meta, small');
      return {
        index: index,
        number: index + 1,
        title: cleanTitle(btn, index + 1),
        meta: metaNode ? (metaNode.textContent || '').replace(/\s+/g,' ').trim() : '',
        active: btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true',
        button: btn
      };
    });
  }
  function ensureOverlay(){
    var existing = document.getElementById(OVERLAY_ID);
    if(existing) return existing;
    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'stage35l-jump-backdrop';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','stage35l-jump-title');
    overlay.innerHTML = '<div class="stage35l-jump-dialog" role="document">'
      + '<div class="stage35l-jump-head"><div><div class="smallcaps">Navigation polish</div><h2 id="stage35l-jump-title">Jump to slide</h2><div class="stage35k-help-muted">Search the live slide rail and jump without leaving the editor.</div></div><button class="btn mini stage35l-jump-close" type="button" data-stage35l-jump-close aria-label="Close slide jump">×</button></div>'
      + '<div class="stage35l-jump-search-wrap"><input class="stage35l-jump-search" data-stage35l-jump-search type="search" autocomplete="off" placeholder="Type a slide title or number…" aria-label="Search slides"></div>'
      + '<div class="stage35l-jump-list" data-stage35l-jump-list></div>'
      + '</div>';
    overlay.addEventListener('click', function(event){
      if(event.target === overlay || event.target.closest('[data-stage35l-jump-close]')) closeJump();
    });
    overlay.addEventListener('keydown', function(event){
      if(event.key === 'Enter'){
        var first = overlay.querySelector('.stage35l-jump-item:not([hidden])');
        if(first){ event.preventDefault(); first.click(); }
      }
    });
    document.body.appendChild(overlay);
    var search = overlay.querySelector('[data-stage35l-jump-search]');
    if(search) search.addEventListener('input', refreshList);
    return overlay;
  }
  function matches(slide, query){
    if(!query) return true;
    var q = query.toLowerCase();
    return String(slide.number).indexOf(q) !== -1 || String(slide.title || '').toLowerCase().indexOf(q) !== -1 || String(slide.meta || '').toLowerCase().indexOf(q) !== -1;
  }
  function jumpTo(index){
    var target = document.querySelector('#deckList .deck-item[data-index="' + index + '"], #deckList [data-index="' + index + '"]');
    if(target && typeof target.click === 'function'){
      target.click();
      closeJump();
      window.__LUMINA_STAGE35L_FEATURE_POLISH = currentStatus(false, index);
      return true;
    }
    if(window.luminaBootError) window.luminaBootError('Stage 35L slide jump failed: slide '+index+' not found');
    return false;
  }
  function refreshList(){
    var overlay = ensureOverlay();
    var list = overlay.querySelector('[data-stage35l-jump-list]');
    var search = overlay.querySelector('[data-stage35l-jump-search]');
    if(!list) return;
    var query = search ? search.value.trim() : '';
    var slides = collectSlides().filter(function(slide){ return matches(slide, query); });
    if(!slides.length){
      list.innerHTML = '<div class="stage35l-jump-empty">No matching slides found. Try clearing the search, or add slides first.</div>';
      return;
    }
    list.innerHTML = slides.map(function(slide){
      return '<button type="button" class="stage35l-jump-item ' + (slide.active ? 'active' : '') + '" data-stage35l-jump-index="' + slide.index + '">'
        + '<span class="stage35l-jump-index">' + esc(slide.number) + '</span>'
        + '<span class="stage35l-jump-title">' + esc(slide.title) + '</span>'
        + '<span class="stage35l-jump-meta">' + esc(slide.meta || (slide.active ? 'current' : 'jump')) + '</span>'
        + '</button>';
    }).join('');
    list.querySelectorAll('[data-stage35l-jump-index]').forEach(function(btn){
      btn.addEventListener('click', function(){ jumpTo(btn.getAttribute('data-stage35l-jump-index')); });
    });
  }
  function openJump(){
    var overlay = ensureOverlay();
    refreshList();
    overlay.classList.add('active');
    document.body.classList.add('stage35l-jump-open');
    var search = overlay.querySelector('[data-stage35l-jump-search]');
    if(search){ search.value = ''; refreshList(); setTimeout(function(){ search.focus(); search.select && search.select(); }, 0); }
    window.__LUMINA_STAGE35L_FEATURE_POLISH = currentStatus(true, null);
    return true;
  }
  function closeJump(){
    var overlay = document.getElementById(OVERLAY_ID);
    if(overlay) overlay.classList.remove('active');
    document.body.classList.remove('stage35l-jump-open');
    window.__LUMINA_STAGE35L_FEATURE_POLISH = currentStatus(false, window.__LUMINA_STAGE35L_FEATURE_POLISH && window.__LUMINA_STAGE35L_FEATURE_POLISH.lastJumpIndex);
    return true;
  }
  function isJumpOpen(){
    var overlay = document.getElementById(OVERLAY_ID);
    return !!(overlay && overlay.classList.contains('active'));
  }
  function liveStatus(){
    window.__LUMINA_STAGE35L_FEATURE_POLISH = currentStatus(isJumpOpen(), window.__LUMINA_STAGE35L_FEATURE_POLISH && window.__LUMINA_STAGE35L_FEATURE_POLISH.lastJumpIndex);
    return window.__LUMINA_STAGE35L_FEATURE_POLISH;
  }
  function installJumpButton(){
    var dock = document.querySelector('.stage35c-quick-dock');
    if(!dock) return false;
    if(dock.querySelector('[data-stage35l-jump-button]')) return true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn mini stage35l-jump-button';
    btn.textContent = 'Jump slide';
    btn.setAttribute('aria-haspopup','dialog');
    btn.dataset.stage35lJumpButton = '1';
    btn.addEventListener('click', function(event){ event.preventDefault(); openJump(); });
    var help = dock.querySelector('[data-stage35k-help-button], [data-stage35k-help-button]');
    if(help) dock.insertBefore(btn, help);
    else dock.appendChild(btn);
    return true;
  }
  function currentStatus(open, lastJumpIndex){
    var slides = collectSlides();
    return {
      stage: STAGE,
      slideJumpOverlay: !!document.getElementById(OVERLAY_ID),
      slideJumpButton: !!document.querySelector('[data-stage35l-jump-button]'),
      open: !!open,
      slideCount: slides.length,
      activeSlideNumber: (slides.find(function(s){ return s.active; }) || {}).number || null,
      lastJumpIndex: lastJumpIndex,
      keyboardSlideJumpShortcut: 'Ctrl/⌘+K',
      behaviorChanged: false
    };
  }
  function init(){
    installJumpButton();
    ensureOverlay();
    window.__LUMINA_STAGE35L_FEATURE_POLISH = currentStatus(false, null);
  }
  function scheduleInit(){
    init();
    retryTimers.forEach(function(t){ clearTimeout(t); });
    retryTimers = [250, 900, 1800].map(function(ms){ return setTimeout(init, ms); });
  }
  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape' && document.getElementById(OVERLAY_ID) && document.getElementById(OVERLAY_ID).classList.contains('active')){
      event.preventDefault(); closeJump(); return;
    }
    var wantsJump = (event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k';
    if(wantsJump && !editableTarget(event.target)){
      event.preventDefault(); openJump();
    }
  });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInit);
  else scheduleInit();
  window.LuminaStage35LFeaturePolish = { stage: STAGE, init: init, openJump: openJump, closeJump: closeJump, jumpTo: jumpTo, collectSlides: collectSlides, getStatus: liveStatus };
})();
