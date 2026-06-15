/* Stage 10 migration: autosave/state persistence helpers.
   Classic browser script. Exposes window.LuminaState.
*/
(function(global){
  'use strict';

  function createAutosaveApi(deps){
    if(!deps || !deps.key){
      throw new Error('LuminaState.createAutosaveApi requires a storage key.');
    }
    let autosaveTimer = null;
    let autosaveDirtyCount = 0;

    function setStatus(message){
      if(typeof deps.setStatus === 'function') deps.setStatus(message);
    }

    function reportError(err, fallbackStatus){
      if(typeof deps.onError === 'function') deps.onError(err);
      else if(global.console && console.error) console.error(err);
      setStatus(fallbackStatus);
    }

    function persistAutosaveNow(reason){
      const label = reason || 'Autosaved.';
      try{
        if(typeof deps.beforePersist === 'function') deps.beforePersist();
        if(typeof deps.buildPayload !== 'function'){
          throw new Error('LuminaState autosave requires buildPayload().');
        }
        const payload = deps.buildPayload();
        global.localStorage.setItem(deps.key, JSON.stringify(payload));
        autosaveDirtyCount = 0;
        setStatus(label);
        if(typeof deps.afterPersist === 'function') deps.afterPersist(payload);
        return true;
      }catch(err){
        reportError(err, 'Autosave failed.');
        return false;
      }
    }

    function scheduleAutosave(reason){
      autosaveDirtyCount += 1;
      setStatus('Unsaved changes…');
      global.clearTimeout(autosaveTimer);
      autosaveTimer = global.setTimeout(function(){ persistAutosaveNow(reason || 'Autosaved.'); }, 1200);
      return autosaveDirtyCount;
    }

    function restoreAutosave(){
      try{
        const raw = global.localStorage.getItem(deps.key);
        if(!raw) return false;
        const payload = JSON.parse(raw);
        if(typeof deps.applyPayload !== 'function'){
          throw new Error('LuminaState autosave requires applyPayload().');
        }
        const applied = deps.applyPayload(payload);
        if(applied === false) return false;
        setStatus('Restored autosave.');
        return true;
      }catch(err){
        reportError(err, 'Could not restore autosave.');
        return false;
      }
    }

    function clearScheduledAutosave(){
      global.clearTimeout(autosaveTimer);
      autosaveTimer = null;
      autosaveDirtyCount = 0;
    }

    return {
      persistAutosaveNow,
      scheduleAutosave,
      restoreAutosave,
      clearScheduledAutosave,
      getDirtyCount: function(){ return autosaveDirtyCount; }
    };
  }

  global.LuminaState = {
    createAutosaveApi
  };
})(window);
