/* Stage 34J: browser-compatible ES module version of command registry and keyboard shortcuts.
   Runtime note: guarded live ESM command runtime with classic Stage 24C shadow fallback. */
'use strict';

function createApi(globalLike) {
  var global = globalLike || (typeof window !== 'undefined' ? window : {});
  var registry = new Map();
  var shortcuts = [];
  var bound = false;

  function app(){ return global.LuminaAppCommands || {}; }
  function normalizeCommand(id, label, run, options){
    return {
      id: String(id),
      label: String(label || id),
      run: typeof run === 'function' ? run : function(){},
      description: options && options.description ? String(options.description) : '',
      group: options && options.group ? String(options.group) : 'General'
    };
  }
  function register(id, label, run, options){
    var command = normalizeCommand(id, label, run, options || {});
    registry.set(command.id, command);
    return command;
  }
  function list(){
    return Array.from(registry.values()).map(function(cmd){
      return Object.assign({}, cmd, { run: undefined });
    });
  }
  function run(id){
    var command = registry.get(String(id));
    if(!command) throw new Error('Unknown Lumina command: ' + id);
    return command.run();
  }
  function isEditableTarget(target){
    if(!target) return false;
    if(target.isContentEditable) return true;
    var tag = String(target.tagName || '').toLowerCase();
    if(tag === 'textarea' || tag === 'select') return true;
    if(tag === 'input'){
      var type = String(target.type || 'text').toLowerCase();
      return !['button','submit','reset','checkbox','radio','range','color','file'].includes(type);
    }
    return !!(target.closest && target.closest('[contenteditable="true"]'));
  }
  function keyLabel(evt){
    var mods = [];
    if(evt.ctrlKey) mods.push('Ctrl');
    if(evt.metaKey) mods.push('Meta');
    if(evt.altKey) mods.push('Alt');
    if(evt.shiftKey) mods.push('Shift');
    mods.push(evt.code || evt.key || '');
    return mods.join('+');
  }
  function addShortcut(code, commandId, options){
    shortcuts.push(Object.assign({ code: code, commandId: commandId }, options || {}));
  }
  function matches(evt, shortcut){
    return (evt.code === shortcut.code || evt.key === shortcut.key) &&
      !!evt.altKey === !!shortcut.altKey &&
      !!evt.shiftKey === !!shortcut.shiftKey &&
      !!evt.ctrlKey === !!shortcut.ctrlKey &&
      !!evt.metaKey === !!shortcut.metaKey;
  }
  function commandRunSafely(id){
    try{
      return run(id);
    }catch(err){
      if(global.console && global.console.error) global.console.error(err);
      if(global.luminaBootError) global.luminaBootError('Command failed: ' + id + ': ' + (err.message || err));
      if(app().showToast) app().showToast('Command failed: ' + id);
      return false;
    }
  }
  function handleKeydown(evt){
    var editable = isEditableTarget(evt.target);
    var appEditableShortcut = ((evt.code === 'KeyS' || evt.code === 'KeyZ' || evt.code === 'KeyY') && (evt.metaKey || evt.ctrlKey) && !evt.altKey);
    if(editable && !appEditableShortcut) return;
    for(var i=0; i<shortcuts.length; i++){
      var shortcut = shortcuts[i];
      if(!matches(evt, shortcut)) continue;
      if(shortcut.ignoreWhenEditable !== false && editable && !(shortcut.allowInEditable === true)) return;
      if(evt.preventDefault) evt.preventDefault();
      if(evt.stopPropagation) evt.stopPropagation();
      commandRunSafely(shortcut.commandId);
      return;
    }
  }
  function registerDefaultCommands(){
    register('preview.refresh', 'Refresh preview', function(){ app().buildPreview && app().buildPreview(); app().showToast && app().showToast('Preview refreshed.'); }, { group: 'Preview' });
    register('deck.saveCurrent', 'Save current slide to deck', function(){ app().saveCurrentBlockToDraft && app().saveCurrentBlockToDraft(); app().saveCurrentSlideToDeck && app().saveCurrentSlideToDeck(); app().persistAutosaveNow && app().persistAutosaveNow('Autosaved from shortcut.'); app().showToast && app().showToast('Saved current slide.'); }, { group: 'Slides' });
    register('slide.add', 'Add slide', function(){ return app().addSlide && app().addSlide(); }, { group: 'Slides' });
    register('slide.update', 'Update selected slide', function(){ return app().updateSlide && app().updateSlide(); }, { group: 'Slides' });
    register('slide.duplicate', 'Duplicate selected slide', function(){ return app().duplicateSlide && app().duplicateSlide(); }, { group: 'Slides' });
    register('slide.delete', 'Delete selected slide', function(){ return app().deleteSlide && app().deleteSlide(); }, { group: 'Slides' });
    register('slide.moveUp', 'Move slide up', function(){ return app().moveSlide && app().moveSlide(-1); }, { group: 'Slides' });
    register('slide.moveDown', 'Move slide down', function(){ return app().moveSlide && app().moveSlide(1); }, { group: 'Slides' });
    register('slide.previous', 'Previous slide', function(){ return app().previousSlide && app().previousSlide(); }, { group: 'Slides' });
    register('slide.next', 'Next slide', function(){ return app().nextSlide && app().nextSlide(); }, { group: 'Slides' });
    register('block.add', 'Add block', function(){ return app().addBlock && app().addBlock(); }, { group: 'Blocks' });
    register('block.update', 'Update selected block', function(){ return app().updateBlock && app().updateBlock(); }, { group: 'Blocks' });
    register('block.duplicate', 'Duplicate selected block', function(){ return app().duplicateBlock && app().duplicateBlock(); }, { group: 'Blocks' });
    register('block.delete', 'Delete selected block', function(){ return app().deleteBlock && app().deleteBlock(); }, { group: 'Blocks' });
    register('block.moveUp', 'Move block up', function(){ return app().moveBlock && app().moveBlock(-1); }, { group: 'Blocks' });
    register('block.moveDown', 'Move block down', function(){ return app().moveBlock && app().moveBlock(1); }, { group: 'Blocks' });
    register('history.undo', 'Undo', function(){ return app().undo && app().undo(); }, { group: 'History' });
    register('history.redo', 'Redo', function(){ return app().redo && app().redo(); }, { group: 'History' });
    register('modal.closeFigure', 'Close figure modal', function(){ return app().closeFigureModal && app().closeFigureModal(); }, { group: 'UI' });
  }
  function registerDefaultShortcuts(){
    addShortcut('KeyS', 'deck.saveCurrent', { ctrlKey: true, allowInEditable: true });
    addShortcut('KeyS', 'deck.saveCurrent', { metaKey: true, allowInEditable: true });
    addShortcut('KeyZ', 'history.undo', { ctrlKey: true, allowInEditable: true });
    addShortcut('KeyZ', 'history.undo', { metaKey: true, allowInEditable: true });
    addShortcut('KeyZ', 'history.redo', { ctrlKey: true, shiftKey: true, allowInEditable: true });
    addShortcut('KeyZ', 'history.redo', { metaKey: true, shiftKey: true, allowInEditable: true });
    addShortcut('KeyY', 'history.redo', { ctrlKey: true, allowInEditable: true });
    addShortcut('KeyY', 'history.redo', { metaKey: true, allowInEditable: true });
    addShortcut('KeyP', 'preview.refresh', { altKey: true, shiftKey: true });
    addShortcut('KeyN', 'slide.add', { altKey: true, shiftKey: true });
    addShortcut('KeyU', 'slide.update', { altKey: true, shiftKey: true });
    addShortcut('KeyD', 'slide.duplicate', { altKey: true, shiftKey: true });
    addShortcut('ArrowUp', 'slide.moveUp', { altKey: true, shiftKey: true });
    addShortcut('ArrowDown', 'slide.moveDown', { altKey: true, shiftKey: true });
    addShortcut('ArrowLeft', 'slide.previous', { altKey: true, shiftKey: true });
    addShortcut('ArrowRight', 'slide.next', { altKey: true, shiftKey: true });
    addShortcut('KeyB', 'block.add', { altKey: true, shiftKey: true });
    addShortcut('KeyE', 'block.update', { altKey: true, shiftKey: true });
    addShortcut('KeyX', 'block.delete', { altKey: true, shiftKey: true });
    addShortcut('Escape', 'modal.closeFigure', { ignoreWhenEditable: false });
  }
  function initShortcuts(){
    if(bound) return;
    if(!registry.size) registerDefaultCommands();
    if(!shortcuts.length) registerDefaultShortcuts();
    var doc = global.document || (typeof document !== 'undefined' ? document : null);
    if(doc && doc.addEventListener) doc.addEventListener('keydown', handleKeydown, true);
    bound = true;
    global.__LUMINA_COMMANDS_BOUND = true;
  }
  function describeShortcuts(){
    return shortcuts.map(function(sc){
      return {
        shortcut: [sc.ctrlKey?'Ctrl':null, sc.metaKey?'Meta':null, sc.altKey?'Alt':null, sc.shiftKey?'Shift':null, sc.code || sc.key].filter(Boolean).join('+'),
        commandId: sc.commandId
      };
    });
  }

  return {
    register: register,
    run: run,
    list: list,
    initShortcuts: initShortcuts,
    describeShortcuts: describeShortcuts,
    _isEditableTarget: isEditableTarget,
    _keyLabel: keyLabel,
    _handleKeydown: handleKeydown,
    _commandRunSafely: commandRunSafely
  };
}

export { createApi };
export default { createApi };
