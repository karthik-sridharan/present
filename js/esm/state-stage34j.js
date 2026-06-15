/* Stage 34J: browser-compatible ES module version of autosave/state helpers.
   Runtime note: optional parity diagnostics; selected modules may also be used by guarded live ESM runtime. */

var ROOT = (typeof window !== 'undefined') ? window : globalThis;

function createAutosaveApi(deps){
    if(!deps || !deps.key){
      throw new Error('LuminaState.createAutosaveApi requires a storage key.');
    }
    var G = deps.global || ROOT;
    var autosaveTimer = null;
    var autosaveDirtyCount = 0;

    function setStatus(message){
      if(typeof deps.setStatus === 'function') deps.setStatus(message);
    }

    function reportError(err, fallbackStatus){
      if(typeof deps.onError === 'function') deps.onError(err);
      else if(G.console && G.console.error) G.console.error(err);
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
        G.localStorage.setItem(deps.key, JSON.stringify(payload));
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
      G.clearTimeout(autosaveTimer);
      autosaveTimer = G.setTimeout(function(){ persistAutosaveNow(reason || 'Autosaved.'); }, 1200);
      return autosaveDirtyCount;
    }

    function restoreAutosave(){
      try{
        const raw = G.localStorage.getItem(deps.key);
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
      G.clearTimeout(autosaveTimer);
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

export { createAutosaveApi };
export default Object.freeze({ createAutosaveApi: createAutosaveApi });
