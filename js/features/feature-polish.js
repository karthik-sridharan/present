/* Stage 35K: discoverability polish — keyboard/workflow help overlay. */
(function(){
  'use strict';
  var STAGE = 'stage38n-20260427-1';
  var HELP_ID = 'stage35k-help-overlay';
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
  function shortcutLabel(shortcut){
    if(!shortcut) return '';
    if(shortcut.label) return shortcut.label;
    if(shortcut.shortcut) return shortcut.shortcut;
    if(shortcut.key) return shortcut.key;
    return '';
  }
  function commandLabel(command){
    return command && (command.label || command.id || command.commandId) || '';
  }
  function commandGroup(command){
    return command && (command.group || command.section || '') || '';
  }
  function collectCommandInfo(){
    var commands = [];
    var shortcuts = [];
    try{
      var api = window.LuminaCommands;
      if(api && typeof api.list === 'function') commands = api.list() || [];
      if(api && typeof api.describeShortcuts === 'function') shortcuts = api.describeShortcuts() || [];
    }catch(e){
      window.LUMINA_BOOT_ERRORS = window.LUMINA_BOOT_ERRORS || [];
      window.LUMINA_BOOT_ERRORS.push('Stage35K command help collection failed: ' + (e && e.message ? e.message : e));
    }
    return { commands: commands, shortcuts: shortcuts };
  }
  function fallbackShortcuts(){
    return [
      { label:'Save current deck', shortcut:'Ctrl/⌘ + S' },
      { label:'Undo editor/deck change', shortcut:'Ctrl/⌘ + Z' },
      { label:'Redo editor/deck change', shortcut:'Ctrl/⌘ + Shift + Z or Ctrl/⌘ + Y' },
      { label:'Move through slides', shortcut:'Alt + ← / →' },
      { label:'Advance export build', shortcut:'Space' },
      { label:'Select/move figures', shortcut:'Click / drag' },
      { label:'Open this help', shortcut:'? or Ctrl/⌘ + /' },
      { label:'Close dialogs', shortcut:'Esc' }
    ];
  }
  function renderItems(items, kind){
    if(!items || !items.length) items = fallbackShortcuts();
    var limited = items.slice(0, 14);
    return limited.map(function(item){
      var left = kind === 'command' ? commandLabel(item) : (item.label || item.commandId || item.id || 'Shortcut');
      var group = kind === 'command' ? commandGroup(item) : '';
      var key = kind === 'command' ? (item.shortcut || item.id || '') : shortcutLabel(item);
      if(kind !== 'command' && item.commandId) key = shortcutLabel(item);
      return '<div class="stage35k-help-item"><span><strong>' + esc(left) + '</strong>' + (group ? '<br><span class="stage35k-help-muted">' + esc(group) + '</span>' : '') + '</span>' + (key ? '<span class="stage35k-help-key">' + esc(key) + '</span>' : '') + '</div>';
    }).join('');
  }
  function ensureOverlay(){
    var existing = document.getElementById(HELP_ID);
    if(existing) return existing;
    var overlay = document.createElement('div');
    overlay.id = HELP_ID;
    overlay.className = 'stage35k-help-backdrop';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','stage35k-help-title');
    overlay.innerHTML = '<div class="stage35k-help-dialog" role="document">'
      + '<div class="stage35k-help-head"><div><div class="smallcaps">Feature polish</div><h2 id="stage35k-help-title">Shortcuts & workflows</h2><div class="stage35k-help-muted">A compact guide to the fastest paths through the deck editor.</div></div><button class="btn mini stage35k-help-close" type="button" data-stage35k-help-close aria-label="Close help">×</button></div>'
      + '<div class="stage35k-help-body" data-stage35k-help-body></div>'
      + '</div>';
    overlay.addEventListener('click', function(event){
      if(event.target === overlay || event.target.closest('[data-stage35k-help-close]')) closeHelp();
    });
    document.body.appendChild(overlay);
    return overlay;
  }
  function refreshOverlay(){
    var overlay = ensureOverlay();
    var body = overlay.querySelector('[data-stage35k-help-body]');
    if(!body) return overlay;
    var data = collectCommandInfo();
    var shortcuts = data.shortcuts && data.shortcuts.length ? data.shortcuts.map(function(s){
      var command = data.commands.find(function(c){ return c && (c.id === s.commandId || c.commandId === s.commandId); });
      return { label: commandLabel(command) || s.commandId || 'Shortcut', shortcut: shortcutLabel(s) };
    }) : fallbackShortcuts();
    var quickPaths = [
      { label:'Build', shortcut:'Edit slide text and blocks' },
      { label:'Design', shortcut:'Theme, style, and motion' },
      { label:'Assets', shortcut:'Presets, import, figures, blocks' },
      { label:'Copilot', shortcut:'Generate or revise slides' },
      { label:'Present', shortcut:'Save, export, and diagnostics' },
      { label:'Quick dock', shortcut:'Update, add, duplicate, export' }
    ];
    body.innerHTML = ''
      + '<section class="stage35k-help-section"><h3>Workflow map</h3><div class="stage35k-help-grid">' + renderItems(quickPaths, 'shortcut') + '</div></section>'
      + '<section class="stage35k-help-section"><h3>Keyboard shortcuts</h3><div class="stage35k-help-grid">' + renderItems(shortcuts, 'shortcut') + '</div></section>'
      + '<section class="stage35k-help-section"><h3>Command registry</h3><div class="stage35k-help-grid">' + renderItems(data.commands, 'command') + '</div><div class="stage35k-help-muted" style="margin-top:.55rem">Showing up to 14 registered commands from the live command bridge.</div></section>';
    return overlay;
  }
  function openHelp(){
    var overlay = refreshOverlay();
    overlay.classList.add('active');
    document.body.classList.add('stage35k-help-open');
    var close = overlay.querySelector('[data-stage35k-help-close]');
    if(close && typeof close.focus === 'function') close.focus();
    window.__LUMINA_STAGE35K_FEATURE_POLISH = currentStatus(true);
    return true;
  }
  function closeHelp(){
    var overlay = document.getElementById(HELP_ID);
    if(overlay) overlay.classList.remove('active');
    document.body.classList.remove('stage35k-help-open');
    window.__LUMINA_STAGE35K_FEATURE_POLISH = currentStatus(false);
    return true;
  }
  function installHelpButton(){
    var dock = document.querySelector('.stage35c-quick-dock');
    if(!dock) return false;
    if(dock.querySelector('[data-stage35k-help-button]')) return true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn mini stage35k-help-button';
    btn.textContent = 'Help / keys';
    btn.setAttribute('aria-haspopup','dialog');
    btn.dataset.stage35kHelpButton = '1';
    btn.addEventListener('click', function(event){ event.preventDefault(); openHelp(); });
    dock.appendChild(btn);
    return true;
  }
  function currentStatus(open){
    var data = collectCommandInfo();
    return {
      stage: STAGE,
      helpOverlay: !!document.getElementById(HELP_ID),
      helpDockButton: !!document.querySelector('[data-stage35k-help-button]'),
      open: !!open,
      commandCount: data.commands.length,
      shortcutCount: data.shortcuts.length,
      keyboardHelpShortcut: '? or Ctrl/⌘+/',
      behaviorChanged: false
    };
  }
  function init(){
    installHelpButton();
    ensureOverlay();
    window.__LUMINA_STAGE35K_FEATURE_POLISH = currentStatus(false);
  }
  function scheduleInit(){
    init();
    retryTimers.forEach(function(t){ clearTimeout(t); });
    retryTimers = [250, 900, 1800].map(function(ms){ return setTimeout(init, ms); });
  }
  document.addEventListener('keydown', function(event){
    if(event.key === 'Escape' && document.getElementById(HELP_ID) && document.getElementById(HELP_ID).classList.contains('active')){
      event.preventDefault(); closeHelp(); return;
    }
    var wantsHelp = (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) || ((event.ctrlKey || event.metaKey) && event.key === '/');
    if(wantsHelp && !editableTarget(event.target)){
      event.preventDefault(); openHelp();
    }
  });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInit);
  else scheduleInit();
  window.LuminaStage35KFeaturePolish = { stage: STAGE, init: init, openHelp: openHelp, closeHelp: closeHelp };
})();
