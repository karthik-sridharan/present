(function(){
  'use strict';
  var STAGE = 'stage38n-20260427-1';
  var EXPORT_OVERLAY_ID = 'stage35m-export-diagnostics-overlay';
  var OUTLINE_PANEL_ID = 'stage35n-deck-outline-panel';
  var exportRetryTimers = [];
  var outlineRetryTimers = [];
  var lastExport = {
    action: '',
    type: '',
    at: '',
    status: 'No export action recorded yet.',
    error: '',
    probe: null
  };

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function compact(value){ return String(value || '').replace(/\s+/g, ' ').trim(); }
  function editableTarget(target){
    if(!target) return false;
    var tag = String(target.tagName || '').toLowerCase();
    return !!(target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select');
  }
  function now(){ return new Date().toISOString(); }
  function exportSupportProbe(){
    var probe = {
      checkedAt: now(),
      blob: typeof Blob === 'function',
      urlCreateObjectURL: !!(window.URL && typeof window.URL.createObjectURL === 'function'),
      urlRevokeObjectURL: !!(window.URL && typeof window.URL.revokeObjectURL === 'function'),
      anchorDownload: false,
      clipboard: !!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'),
      fileReader: typeof FileReader === 'function',
      localStorage: false,
      userAgent: navigator.userAgent,
      href: location.href,
      testBlobUrlCreated: false,
      ok: false,
      warnings: []
    };
    try { probe.anchorDownload = 'download' in document.createElement('a'); } catch(_e) {}
    try {
      var key = 'lumina_stage35m_probe';
      localStorage.setItem(key, '1');
      probe.localStorage = localStorage.getItem(key) === '1';
      localStorage.removeItem(key);
    } catch(e) { probe.warnings.push('localStorage unavailable: ' + (e && e.message ? e.message : e)); }
    try {
      if(probe.blob && probe.urlCreateObjectURL){
        var blob = new Blob(['stage35m export probe'], { type:'text/plain' });
        var url = URL.createObjectURL(blob);
        probe.testBlobUrlCreated = !!url;
        if(url && probe.urlRevokeObjectURL) URL.revokeObjectURL(url);
      }
    } catch(e) { probe.warnings.push('Blob URL probe failed: ' + (e && e.message ? e.message : e)); }
    probe.ok = !!(probe.blob && probe.urlCreateObjectURL && probe.anchorDownload && probe.testBlobUrlCreated);
    if(!probe.anchorDownload) probe.warnings.push('Anchor download attribute is not available; browser may open files instead of downloading.');
    if(!probe.urlCreateObjectURL) probe.warnings.push('URL.createObjectURL is unavailable; Blob-based downloads may fail.');
    if(!probe.blob) probe.warnings.push('Blob constructor is unavailable; generated file export cannot be packaged normally.');
    lastExport.probe = probe;
    window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(false);
    return probe;
  }
  function inferExportType(id){
    if(id === 'downloadDeckBtn') return 'standalone-html-deck';
    if(id === 'downloadStandaloneBtn') return 'standalone-html-current-slide';
    if(id === 'savePresentationJsonBtn') return 'presentation-json';
    if(id === 'saveCurrentSlideJsonBtn') return 'current-slide-json';
    if(id === 'copySnippetBtn') return 'copy-current-slide-snippet';
    if(id === 'copyMathJaxBtn') return 'copy-mathjax-helper';
    return id || 'export-action';
  }
  function noteExportClick(button){
    var id = button && button.id || '';
    lastExport.action = id || compact(button && button.textContent) || 'export';
    lastExport.type = inferExportType(id);
    lastExport.at = now();
    lastExport.status = 'Export action clicked; waiting for browser handoff.';
    lastExport.error = '';
    exportSupportProbe();
    setTimeout(function(){
      if(lastExport.status === 'Export action clicked; waiting for browser handoff.'){
        lastExport.status = 'No JavaScript exception captured after export click; if Safari still reports download failed, copy this diagnostics report.';
        window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(false);
        renderExportBody();
      }
    }, 900);
    window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(false);
    renderExportBody();
  }
  function installExportHooks(){
    var ids = ['downloadDeckBtn','downloadStandaloneBtn','savePresentationJsonBtn','saveCurrentSlideJsonBtn','copySnippetBtn','copyMathJaxBtn'];
    ids.forEach(function(id){
      var btn = document.getElementById(id);
      if(btn && btn.dataset.stage35mExportHooked !== '1'){
        btn.dataset.stage35mExportHooked = '1';
        btn.addEventListener('click', function(){ noteExportClick(btn); }, true);
      }
    });
  }
  function captureExportError(message){
    lastExport.error = compact(message || 'Unknown export/runtime error');
    lastExport.status = 'JavaScript error captured after export attempt.';
    lastExport.at = lastExport.at || now();
    window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(false);
    renderExportBody();
  }
  window.addEventListener('error', function(event){
    if(lastExport && lastExport.at) captureExportError(event.message || (event.error && event.error.message) || 'window error');
  });
  window.addEventListener('unhandledrejection', function(event){
    if(lastExport && lastExport.at){
      var reason = event.reason;
      captureExportError((reason && reason.message) || String(reason || 'unhandled rejection'));
    }
  });
  function exportReport(){
    var probe = lastExport.probe || exportSupportProbe();
    return {
      stage: STAGE,
      checkedAt: now(),
      lastExport: {
        action: lastExport.action,
        type: lastExport.type,
        at: lastExport.at,
        status: lastExport.status,
        error: lastExport.error
      },
      support: probe,
      deck: {
        title: (document.getElementById('deckTitle') && document.getElementById('deckTitle').value) || '',
        slideCount: collectSlides().length,
        activeSlideNumber: activeSlideNumber()
      },
      hints: [
        'If Safari says download failed, try Save presentation JSON first to isolate JSON vs standalone HTML export.',
        'If Blob URL support is false, generated file downloads cannot use the normal browser export path.',
        'If no JavaScript exception is captured, the failure is likely browser download policy, file size, popup/download blocking, or storage/permission handling.'
      ]
    };
  }
  function renderExportBody(){
    var overlay = document.getElementById(EXPORT_OVERLAY_ID);
    if(!overlay) return;
    var body = overlay.querySelector('[data-stage35m-export-body]');
    if(!body) return;
    var report = exportReport();
    var support = report.support || {};
    var cards = [
      ['Blob support', support.blob ? 'available' : 'missing'],
      ['Blob URL creation', support.testBlobUrlCreated ? 'probe passed' : 'probe failed'],
      ['Anchor download', support.anchorDownload ? 'available' : 'missing'],
      ['Clipboard copy', support.clipboard ? 'available' : 'missing'],
      ['Last action', report.lastExport.type || 'none'],
      ['Last status', report.lastExport.status || 'not recorded']
    ];
    body.innerHTML = '<div class="stage35m-export-grid">' + cards.map(function(card){
      return '<div class="stage35m-export-card"><strong>' + esc(card[0]) + '</strong><span>' + esc(card[1]) + '</span></div>';
    }).join('') + '</div>'
      + (support.warnings && support.warnings.length ? '<div class="stage35m-export-card"><strong>Warnings</strong><span>' + esc(support.warnings.join(' | ')) + '</span></div>' : '')
      + (report.lastExport.error ? '<div class="stage35m-export-card"><strong>Captured error</strong><span>' + esc(report.lastExport.error) + '</span></div>' : '')
      + '<div><span class="stage35m-export-pill">Copy/paste report</span><pre class="stage35m-export-pre" data-stage35m-export-pre>' + esc(JSON.stringify(report, null, 2)) + '</pre></div>';
  }
  function ensureExportOverlay(){
    var existing = document.getElementById(EXPORT_OVERLAY_ID);
    if(existing) return existing;
    var overlay = document.createElement('div');
    overlay.id = EXPORT_OVERLAY_ID;
    overlay.className = 'stage35m-export-backdrop';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'stage35m-export-title');
    overlay.innerHTML = '<div class="stage35m-export-dialog" role="document">'
      + '<div class="stage35m-export-head"><div><div class="smallcaps">Export reliability</div><h2 id="stage35m-export-title">Export diagnostics</h2><div class="stage35k-help-muted">Checks browser download support, records export attempts, and gives you a copyable report for Safari download failures.</div></div><button class="btn mini stage35m-export-close" type="button" data-stage35m-export-close aria-label="Close export diagnostics">×</button></div>'
      + '<div class="stage35m-export-body" data-stage35m-export-body></div>'
      + '<div class="stage35m-export-foot"><button class="btn mini" type="button" data-stage35m-export-refresh>Run probe</button><button class="btn mini primary" type="button" data-stage35m-export-copy>Copy report</button><button class="btn mini" type="button" data-stage35m-export-close>Close</button></div>'
      + '</div>';
    overlay.addEventListener('click', function(event){
      if(event.target === overlay || event.target.closest('[data-stage35m-export-close]')) closeExportDiagnostics();
      if(event.target.closest('[data-stage35m-export-refresh]')) { exportSupportProbe(); renderExportBody(); }
      if(event.target.closest('[data-stage35m-export-copy]')) copyExportReport();
    });
    document.body.appendChild(overlay);
    return overlay;
  }
  function openExportDiagnostics(){
    var overlay = ensureExportOverlay();
    exportSupportProbe();
    renderExportBody();
    overlay.classList.add('active');
    document.body.classList.add('stage35m-export-open');
    window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(true);
    return true;
  }
  function closeExportDiagnostics(){
    var overlay = document.getElementById(EXPORT_OVERLAY_ID);
    if(overlay) overlay.classList.remove('active');
    document.body.classList.remove('stage35m-export-open');
    window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(false);
    return true;
  }
  function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function(resolve, reject){
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly','');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        ok ? resolve() : reject(new Error('execCommand copy returned false'));
      } catch(e) { reject(e); }
    });
  }
  function toast(message){
    var t = document.getElementById('toast');
    if(t){
      t.textContent = message;
      t.classList.add('show');
      setTimeout(function(){ t.classList.remove('show'); }, 1300);
    }
  }
  function copyExportReport(){
    var text = JSON.stringify(exportReport(), null, 2);
    return copyText(text).then(function(){ toast('Copied export diagnostics.'); }).catch(function(e){
      captureExportError('Copy diagnostics failed: ' + (e && e.message ? e.message : e));
    });
  }
  function installExportButton(){
    /* Stage 35P: keep export diagnostics internal, but remove the visible quick-dock button. */
    var existing = document.querySelectorAll('[data-stage35m-export-button], .stage35m-export-button');
    existing.forEach(function(btn){ if(btn && btn.parentNode) btn.parentNode.removeChild(btn); });
    return false;
  }
  function currentExportStatus(open){
    var probe = lastExport.probe || null;
    return {
      stage: STAGE,
      exportDiagnosticsOverlay: !!document.getElementById(EXPORT_OVERLAY_ID),
      exportDiagnosticsButton: !!document.querySelector('[data-stage35m-export-button]'),
      open: !!open,
      browserDownloadSupport: probe ? !!probe.ok : null,
      lastExportType: lastExport.type || '',
      lastExportStatus: lastExport.status || '',
      lastExportError: lastExport.error || '',
      behaviorChanged: false
    };
  }

  function deckButtons(){
    return Array.prototype.slice.call(document.querySelectorAll('#deckList .deck-item[data-index], #deckList [data-index]'));
  }
  function cleanSlideTitle(btn, fallback){
    var clone = btn.cloneNode(true);
    clone.querySelectorAll('.meta, small, .badge').forEach(function(node){ node.remove(); });
    var title = compact(clone.textContent || '');
    return title || ('Slide ' + fallback);
  }
  function collectSlides(){
    return deckButtons().map(function(btn, i){
      var rawIndex = btn.getAttribute('data-index');
      var index = Number(rawIndex);
      if(!Number.isFinite(index)) index = i;
      var metaNode = btn.querySelector('.meta, small');
      var meta = metaNode ? compact(metaNode.textContent || '') : '';
      var title = cleanSlideTitle(btn, index + 1);
      var isSection = /section-divider/i.test(meta) || /^section/i.test(title);
      return {
        index: index,
        number: index + 1,
        title: title,
        meta: meta,
        isSection: isSection,
        active: btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true'
      };
    });
  }
  function activeSlideNumber(){
    var slides = collectSlides();
    var active = slides.find(function(s){ return s.active; });
    return active ? active.number : null;
  }
  function jumpToSlide(index){
    if(window.LuminaStage35LFeaturePolish && typeof window.LuminaStage35LFeaturePolish.jumpTo === 'function'){
      return window.LuminaStage35LFeaturePolish.jumpTo(index);
    }
    var target = document.querySelector('#deckList .deck-item[data-index="' + index + '"], #deckList [data-index="' + index + '"]');
    if(target && typeof target.click === 'function'){
      target.click();
      return true;
    }
    return false;
  }
  function ensureOutlinePanel(){
    var existing = document.getElementById(OUTLINE_PANEL_ID);
    var railMount = document.getElementById('slideRailMount');
    var deckList = document.getElementById('deckList');
    var deckPanel = deckList && deckList.closest ? deckList.closest('.panel') : null;
    var parent = (railMount && (deckPanel ? deckPanel.parentNode : railMount)) || (deckPanel && deckPanel.parentNode);
    if(existing) return existing;
    if(!parent) return null;
    var panel = document.createElement('div');
    panel.id = OUTLINE_PANEL_ID;
    panel.className = 'stage35n-outline-panel';
    panel.innerHTML = '<div class="section-head"><div><div class="smallcaps">Deck outline</div><div class="muted">Persistent table of contents grouped by section divider slides.</div></div><button class="btn mini" type="button" data-stage35n-outline-refresh>Refresh</button></div><div class="stage35n-outline-list" data-stage35n-outline-list></div>';
    panel.addEventListener('click', function(event){
      var refresh = event.target.closest('[data-stage35n-outline-refresh]');
      if(refresh){ event.preventDefault(); renderOutline(); return; }
      var item = event.target.closest('[data-stage35n-outline-index]');
      if(item){ event.preventDefault(); jumpToSlide(item.getAttribute('data-stage35n-outline-index')); setTimeout(renderOutline, 80); }
    });
    if(deckPanel && deckPanel.parentNode === parent) parent.insertBefore(panel, deckPanel.nextSibling);
    else parent.appendChild(panel);
    return panel;
  }
  function renderOutline(){
    var panel = ensureOutlinePanel();
    if(!panel) return false;
    var list = panel.querySelector('[data-stage35n-outline-list]');
    if(!list) return false;
    var slides = collectSlides();
    if(!slides.length){
      list.innerHTML = '<div class="stage35n-outline-empty">No slides yet. Add or import slides to populate the deck outline.</div>';
      window.__LUMINA_STAGE35N_OUTLINE_NAVIGATOR = currentOutlineStatus();
      return true;
    }
    var html = '';
    var currentSection = 'Deck';
    var wroteSection = false;
    slides.forEach(function(slide){
      if(slide.isSection){
        currentSection = slide.title || ('Section ' + slide.number);
        html += '<div class="stage35n-outline-section">' + esc(currentSection) + '</div>';
        wroteSection = true;
      } else if(!wroteSection){
        html += '<div class="stage35n-outline-section">' + esc(currentSection) + '</div>';
        wroteSection = true;
      }
      html += '<button type="button" class="stage35n-outline-item ' + (slide.active ? 'active' : '') + '" data-stage35n-outline-index="' + esc(slide.index) + '">'
        + '<span class="stage35n-outline-num">' + esc(slide.number) + '</span>'
        + '<span class="stage35n-outline-title">' + esc(slide.title) + '</span>'
        + '</button>';
    });
    list.innerHTML = html;
    window.__LUMINA_STAGE35N_OUTLINE_NAVIGATOR = currentOutlineStatus();
    return true;
  }
  function installOutlineButton(){
    var dock = document.querySelector('.stage35c-quick-dock');
    if(!dock) return false;
    if(dock.querySelector('[data-stage35n-outline-button]')) return true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn mini stage35n-outline-dock-button';
    btn.textContent = 'Outline';
    btn.dataset.stage35nOutlineButton = '1';
    btn.addEventListener('click', function(event){
      event.preventDefault();
      renderOutline();
      var panel = document.getElementById(OUTLINE_PANEL_ID);
      if(panel && panel.scrollIntoView) panel.scrollIntoView({ block:'nearest', behavior:'smooth' });
    });
    var jump = dock.querySelector('[data-stage35l-jump-button]');
    if(jump) dock.insertBefore(btn, jump.nextSibling);
    else dock.appendChild(btn);
    return true;
  }
  function currentOutlineStatus(){
    var slides = collectSlides();
    var sections = slides.filter(function(s){ return s.isSection; }).length;
    return {
      stage: STAGE,
      outlinePanel: !!document.getElementById(OUTLINE_PANEL_ID),
      outlineDockButton: !!document.querySelector('[data-stage35n-outline-button]'),
      slideCount: slides.length,
      sectionCount: sections,
      activeSlideNumber: activeSlideNumber(),
      behaviorChanged: false
    };
  }
  function observeDeckList(){
    var deckList = document.getElementById('deckList');
    if(!deckList || deckList.dataset.stage35nOutlineObserved === '1') return false;
    deckList.dataset.stage35nOutlineObserved = '1';
    try {
      var observer = new MutationObserver(function(){ renderOutline(); });
      observer.observe(deckList, { childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-selected'] });
      window.__LUMINA_STAGE35N_OUTLINE_OBSERVER = observer;
    } catch(_e) {}
    return true;
  }
  function initExportDiagnostics(){
    installExportButton();
    ensureExportOverlay();
    installExportHooks();
    exportSupportProbe();
    window.__LUMINA_STAGE35M_EXPORT_DIAGNOSTICS = currentExportStatus(false);
  }
  function initOutlineNavigator(){
    installOutlineButton();
    ensureOutlinePanel();
    observeDeckList();
    renderOutline();
    window.__LUMINA_STAGE35N_OUTLINE_NAVIGATOR = currentOutlineStatus();
  }
  function init(){
    initExportDiagnostics();
    initOutlineNavigator();
  }
  function scheduleInit(){
    init();
    exportRetryTimers.forEach(function(t){ clearTimeout(t); });
    outlineRetryTimers.forEach(function(t){ clearTimeout(t); });
    exportRetryTimers = [250, 900, 1800].map(function(ms){ return setTimeout(initExportDiagnostics, ms); });
    outlineRetryTimers = [300, 1000, 2200].map(function(ms){ return setTimeout(initOutlineNavigator, ms); });
  }
  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape' && document.getElementById(EXPORT_OVERLAY_ID) && document.getElementById(EXPORT_OVERLAY_ID).classList.contains('active')){
      event.preventDefault(); closeExportDiagnostics(); return;
    }
    var wantsExportHealth = (event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key || '').toLowerCase() === 'e';
    if(wantsExportHealth && !editableTarget(event.target)){
      event.preventDefault(); openExportDiagnostics();
    }
  });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInit);
  else scheduleInit();
  window.LuminaStage35MExportDiagnostics = { stage: STAGE, init: initExportDiagnostics, open: openExportDiagnostics, close: closeExportDiagnostics, report: exportReport, probe: exportSupportProbe };
  window.LuminaStage35NOutlineNavigator = { stage: STAGE, init: initOutlineNavigator, render: renderOutline, status: currentOutlineStatus };
})();
