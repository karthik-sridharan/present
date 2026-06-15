(function(){
  'use strict';
  var W = window;
  var STAGE = 'stage38n-20260427-1';
  var STATUS = { stage:STAGE, uiReset:true, modes:['create','edit','present','advanced'], mode:'create', tests:{}, lastSwitchedAt:'', diagnosticsPatched:false };
  function qs(sel, root){ return (root || document).querySelector(sel); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function byId(id){ return document.getElementById(id); }
  function publish(){ W.LuminaStage37UiResetStatus = Object.assign({}, STATUS, { tests:Object.assign({}, STATUS.tests) }); return W.LuminaStage37UiResetStatus; }
  function clickLegacy(tab){
    var btn = qs('[data-left-tab="' + tab + '"]');
    if(btn){ btn.click(); return true; }
    return false;
  }
  function activeLegacy(){
    var btn = qs('[data-left-tab].active,[data-left-tab][aria-selected="true"]');
    return btn && btn.getAttribute('data-left-tab') || '';
  }
  function setMode(mode, preferredTab){
    var map = { create:'copilot', edit:'edit', present:'files', advanced:'slides' };
    mode = map[mode] ? mode : 'edit';
    var tab = preferredTab || map[mode];
    STATUS.mode = mode;
    STATUS.lastSwitchedAt = new Date().toISOString();
    document.body.classList.add('stage37h-ui-reset');
    document.body.setAttribute('data-stage37-mode', mode);
    qsa('.stage37-mode-tab').forEach(function(b){
      var on = b.getAttribute('data-stage37-mode') === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    clickLegacy(tab);
    annotateModeCard(mode, tab);
    publish();
  }
  function makeModeButton(mode, title, desc){
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'stage37-mode-tab';
    b.setAttribute('data-stage37-mode', mode);
    b.setAttribute('aria-selected', 'false');
    b.innerHTML = '<strong>' + title + '</strong><span>' + desc + '</span>';
    b.addEventListener('click', function(){ setMode(mode); });
    return b;
  }
  function ensureTopbar(){
    if(byId('stage37Topbar')) return;
    var intro = qs('.editor-intro');
    var leftTabs = byId('leftTabs');
    if(!intro || !leftTabs) return;
    var bar = document.createElement('div');
    bar.id = 'stage37Topbar';
    bar.className = 'stage37-topbar';
    var tabs = document.createElement('div');
    tabs.className = 'stage37-mode-tabs';
    tabs.setAttribute('role','tablist');
    tabs.setAttribute('aria-label','Main workflow modes');
    tabs.appendChild(makeModeButton('create','Create','Copilot, outline, references'));
    tabs.appendChild(makeModeButton('edit','Edit','Slides, blocks, figures'));
    tabs.appendChild(makeModeButton('present','Present','Export, PDF, controls'));
    tabs.appendChild(makeModeButton('advanced','Advanced','JSON, help, diagnostics'));
    var quick = document.createElement('div');
    quick.className = 'stage37-quick-actions';
    quick.innerHTML = '<button class="btn mini" type="button" data-stage37-quick="copilot">Ask Copilot</button><button class="btn mini" type="button" data-stage37-quick="update">Update slide</button><button class="btn mini" type="button" data-stage37-quick="export">Export</button>';
    bar.appendChild(tabs);
    bar.appendChild(quick);
    leftTabs.parentNode.insertBefore(bar, leftTabs);
    quick.addEventListener('click', function(evt){
      var action = evt.target && evt.target.getAttribute && evt.target.getAttribute('data-stage37-quick');
      if(!action) return;
      if(action === 'copilot') setMode('create','copilot');
      if(action === 'update'){ setMode('edit','edit'); setTimeout(function(){ var btn=qs('[data-slide-action-proxy="update"]'); if(btn) btn.focus(); },50); }
      if(action === 'export') setMode('present','files');
    });
  }
  function annotateModeCard(mode, tab){
    var existing = byId('stage37TaskCard');
    var pane = qs('.left-pane.active');
    if(!pane) return;
    if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var title = { create:'Create workspace', edit:'Edit workspace', present:'Present / export workspace', advanced:'Advanced workspace' }[mode] || 'Workspace';
    var body = {
      create:'Generate slides from a prompt, uploaded deck spec, references, URLs, or PDFs. Copilot output stays editable.',
      edit:'Keep the slide preview central. Select text, blocks, or figures and use the contextual inspector on the right.',
      present:'Choose the generated-presentation controls, export HTML, print/PDF, and annotate/pointer options from one place.',
      advanced:'Raw JSON, diagnostics, import helpers, recovery tools, and syntax references live here so the main workflow stays calm.'
    }[mode] || '';
    var card = document.createElement('div');
    card.id = 'stage37TaskCard';
    card.className = 'stage37-task-card';
    card.innerHTML = '<div class="stage37-section-header"><div><div class="smallcaps">Stage 37 UI reset</div><h2>' + title + '</h2><p>' + body + '</p></div><span class="stage37-chip">' + tab + '</span></div>';
    if(mode === 'create'){
      card.innerHTML += '<div class="stage37-step-list"><div class="stage37-step">Describe the deck or upload an outline/spec.</div><div class="stage37-step">Add reference files, URLs, or PDFs.</div><div class="stage37-step">Choose target slide count and tone.</div><div class="stage37-step">Generate, review, then append or replace.</div></div>';
    } else if(mode === 'edit'){
      card.innerHTML += '<div class="stage37-chip-row"><span class="stage37-chip">Slide rail</span><span class="stage37-chip">Direct preview edit</span><span class="stage37-chip">Contextual inspector</span><span class="stage37-chip">Figure actions</span></div>';
    } else if(mode === 'present'){
      card.innerHTML += '<div class="stage37-export-preview"><span>Prev/Next</span><span>Slides</span><span>Pointer</span><span>Draw</span><span>PDF</span></div>';
    } else if(mode === 'advanced'){
      card.innerHTML += '<div class="stage37-advanced-note">Advanced/debug tools are intentionally separated from day-to-day authoring. Use them for raw slide JSON, diagnostics, syntax help, and recovery.</div>';
    }
    pane.insertBefore(card, pane.firstChild);
  }
  function setupCopilotWizard(){
    var panel = qs('.copilot-panel');
    if(!panel || panel.dataset.stage37Wizard) return;
    panel.dataset.stage37Wizard = '1';
    var head = document.createElement('div');
    head.className = 'stage37-copilot-toolbar';
    head.innerHTML = '<div><div class="smallcaps">Create with Copilot</div><strong>Prompt → outline/spec → references → generate</strong></div><div class="stage37-copilot-actions-left"><button class="btn mini" type="button" data-stage37-focus="prompt">Prompt</button><button class="btn mini" type="button" data-stage37-focus="spec">Spec</button><button class="btn mini" type="button" data-stage37-focus="refs">References</button><button class="btn mini" type="button" data-stage37-focus="settings">Settings</button></div>';
    var firstGrid = qs('.field-grid', panel);
    if(firstGrid) panel.insertBefore(head, firstGrid);
    head.addEventListener('click', function(evt){
      var f = evt.target && evt.target.getAttribute && evt.target.getAttribute('data-stage37-focus');
      var id = f === 'prompt' ? 'copilotPrompt' : f === 'spec' ? 'copilotSpecText' : f === 'refs' ? 'copilotReferenceText' : f === 'settings' ? 'copilotModel' : '';
      var el = id && byId(id);
      if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(function(){ try{ el.focus(); }catch(_e){} },260); }
    });
  }
  function setupInspector(){
    var panel = qs('.right-shell .preview-wrap + .panel') || qs('.right-shell .panel:not(.preview-wrap)');
    if(!panel || panel.dataset.stage37Inspector) return;
    panel.dataset.stage37Inspector = '1';
    panel.classList.add('stage37-inspector-card');
    var label = byId('previewBlockLabel');
    var meta = document.createElement('div');
    meta.className = 'stage37-inspector-meta';
    meta.id = 'stage37InspectorMeta';
    meta.innerHTML = '<div><strong>Selection</strong><br><span id="stage37InspectorText">No item selected</span></div><span class="stage37-chip" id="stage37InspectorKind">Slide</span>';
    var props = qs('.preview-block-props', panel);
    if(props) panel.insertBefore(meta, props);
    function update(){
      var txt = label ? String(label.value || label.getAttribute('value') || '').trim() : '';
      var kind = 'Slide';
      var p = byId('preview');
      if(p && qs('.figure-box.selected,.figure-box[data-stage35z-selected="1"]', p)) kind = 'Figure';
      else if(txt && !/^No block selected/i.test(txt)) kind = /title/i.test(txt) ? 'Title' : 'Text';
      document.body.classList.toggle('stage37-no-selection', kind === 'Slide');
      document.body.classList.toggle('stage37-selected-figure', kind === 'Figure');
      var out = byId('stage37InspectorText');
      var badge = byId('stage37InspectorKind');
      if(out) out.textContent = kind === 'Slide' ? 'No item selected. Slide-level settings remain in the left workspace.' : txt || kind;
      if(badge) badge.textContent = kind;
      STATUS.selectionKind = kind;
      publish();
    }
    setInterval(update, 900);
    ['click','keyup','pointerup'].forEach(function(ev){ document.addEventListener(ev, function(){ setTimeout(update, 60); }, true); });
    update();
  }
  function setupAdvanced(){
    var slidesPane = qs('.left-pane[data-left-pane="slides"]');
    if(slidesPane && !byId('stage37AdvancedCard')){
      var card = document.createElement('div');
      card.id = 'stage37AdvancedCard';
      card.className = 'stage37-task-card stage37-dev-only';
      card.innerHTML = '<div class="stage37-section-header"><div><div class="smallcaps">Advanced / developer</div><h2>Raw deck tools</h2><p>Use this workspace for JSON, deck organization, diagnostics, and recovery. Normal authoring is in Create and Edit.</p></div></div><div class="stage37-chip-row"><button class="btn mini" type="button" data-stage37-adv="diagnostics">Copy diagnostics</button><button class="btn mini" type="button" data-left-tab-proxy="help">Syntax help</button><button class="btn mini" type="button" data-left-tab-proxy="files">Save/export</button></div>';
      slidesPane.insertBefore(card, slidesPane.firstChild);
      card.addEventListener('click', function(evt){
        if(evt.target && evt.target.getAttribute('data-stage37-adv') === 'diagnostics'){
          if(W.LuminaDiagnostics && W.LuminaDiagnostics.copyReport){
            W.LuminaDiagnostics.copyReport().then(function(){ alert('Diagnostics copied to clipboard.'); }).catch(function(){ alert('Could not copy diagnostics.'); });
          } else alert('Diagnostics are not available yet.');
        }
      });
    }
  }
  function setupExportWorkspace(){
    var menu = byId('exportControlsMenu');
    if(!menu || byId('stage37ExportControlsPreview')) return;
    var p = document.createElement('div');
    p.id = 'stage37ExportControlsPreview';
    p.className = 'stage37-export-preview';
    p.innerHTML = '<span>Prev/Next always</span><span>Slides</span><span>Draw</span><span>Annotate</span><span>PDF</span>';
    menu.parentNode.insertBefore(p, menu);
  }
  function patchDiagnostics(){
    var D = W.LuminaDiagnostics;
    if(!D || D.__stage37hUiResetPatched) return;
    var original = typeof D.collectReport === 'function' ? D.collectReport.bind(D) : null;
    D.collectReport = function(){
      var report = original ? original() : {};
      report.stage37UiResetStatus = publish();
      report.stage37UiResetDiagnostics = {
        modeButtons:qsa('.stage37-mode-tab').length,
        oldWorkflowTabsHidden: !!qs('.left-tabs.mode-bar.stage35a-workflow-tabs'),
        copilotWizard: !!qs('.copilot-panel[data-stage37-wizard="1"],.copilot-panel[data-stage37Wizard="1"]'),
        inspector: !!byId('stage37InspectorMeta'),
        exportPreview: !!byId('stage37ExportControlsPreview'),
        advancedCard: !!byId('stage37AdvancedCard')
      };
      return report;
    };
    D.__stage37hUiResetPatched = true;
    STATUS.diagnosticsPatched = true;
    publish();
  }
  function runInternalTests(){
    STATUS.tests = {
      topbar: !!byId('stage37Topbar'),
      modeButtonCount: qsa('.stage37-mode-tab').length,
      createTarget: !!qs('[data-left-tab="copilot"]'),
      editTarget: !!qs('[data-left-tab="edit"]'),
      presentTarget: !!qs('[data-left-tab="files"]'),
      advancedTarget: !!qs('[data-left-tab="slides"]'),
      copilotPrompt: !!byId('copilotPrompt'),
      copilotSpec: !!byId('copilotSpecText'),
      copilotReferences: !!byId('copilotReferenceText'),
      selectedInspector: !!byId('stage37InspectorMeta'),
      exportControls: !!byId('exportControlsMenu'),
      advancedDiagnostics: !!byId('stage37AdvancedCard')
    };
    STATUS.tests.pass = STATUS.tests.topbar && STATUS.tests.modeButtonCount === 4 && STATUS.tests.createTarget && STATUS.tests.editTarget && STATUS.tests.presentTarget && STATUS.tests.advancedTarget && STATUS.tests.copilotPrompt && STATUS.tests.selectedInspector && STATUS.tests.exportControls;
    W.__LUMINA_STAGE37H_TESTS = Object.assign({}, STATUS.tests);
    publish();
  }
  function init(){
    document.body.classList.add('stage37h-ui-reset');
    ensureTopbar();
    setupCopilotWizard();
    setupInspector();
    setupAdvanced();
    setupExportWorkspace();
    setMode('create','copilot');
    runInternalTests();
    patchDiagnostics();
    setTimeout(function(){ setupCopilotWizard(); setupInspector(); setupAdvanced(); setupExportWorkspace(); runInternalTests(); patchDiagnostics(); }, 1200);
    setTimeout(function(){ runInternalTests(); patchDiagnostics(); }, 3000);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
