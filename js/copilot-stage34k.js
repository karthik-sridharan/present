/* Stage 34K: Guarded Copilot UI binding.
   The button handlers resolve window.LuminaCopilotCore at click time so the
   guarded ESM Copilot core can replace the classic fallback before use. */
(function(global){
  'use strict';
  var status = global.LuminaCopilotGuardStatus = {
    stage: 'stage37h-20260427-1',
    bound: false,
    validationBound: false,
    lastAction: '',
    buttonCount: 0,
    errors: [],
    generationInFlight: false,
    duplicateClicksIgnored: 0
  };
  function record(message, err){
    var msg = String(message || 'Copilot guard error');
    if(err && err.message) msg += ': ' + err.message;
    status.errors.push({ time: new Date().toISOString(), message: msg });
    if(global.console && console.warn) console.warn('[Lumina Copilot Guard]', msg, err || '');
  }
  function byId(id){ return document.getElementById(id); }
  function currentCore(){ return global.LuminaCopilotCore; }
  var generationButtonIds = ['copilotDraftSlideBtn','copilotAddSlideBtn','copilotGenerateDeckBtn','copilotGenerateSpecDeckBtn'];
  function setGenerationButtonsBusy(isBusy){
    generationButtonIds.forEach(function(id){
      var btn = byId(id);
      if(!btn) return;
      btn.dataset.copilotBusy = isBusy ? '1' : '0';
      btn.disabled = !!isBusy;
      btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    });
  }
  function add(id, type, fn){
    var el = byId(id);
    if(!el) return false;
    var eventType = type || 'click';
    var guardKey = '__luminaCopilotGuardBound_' + eventType;
    if(el[guardKey]) return false;
    el[guardKey] = true;
    el.addEventListener(eventType, function(evt){
      if(evt && evt.preventDefault) evt.preventDefault();
      if(evt && evt.stopPropagation) evt.stopPropagation();
      if(evt && evt.stopImmediatePropagation) evt.stopImmediatePropagation();
      if(el.dataset && el.dataset.copilotBusy === '1'){
        status.duplicateClicksIgnored += 1;
        return;
      }
      try{
        var result = fn(evt);
        if(result && typeof result.catch === 'function'){
          result.catch(function(err){
            record('Copilot action failed for #' + id, err);
            alert(setCoreError(err));
          });
        }
      }catch(err){
        record('Copilot action failed for #' + id, err);
        alert(setCoreError(err));
      }
    }, true);
    status.buttonCount += 1;
    return true;
  }

  function setCoreError(err){
    var core = currentCore();
    var msg = (err && err.message) || String(err || 'Copilot failed.');
    if(core && typeof core.recordCopilotError === 'function') msg = core.recordCopilotError(err || msg);
    if(core && typeof core.setCopilotStatus === 'function') core.setCopilotStatus(msg, true);
    return msg;
  }
  function safeValidate(){
    var core = currentCore();
    if(core && typeof core.updateCopilotKeyWarning === 'function'){
      try{ return core.updateCopilotKeyWarning(); }
      catch(err){ setCoreError(err); return false; }
    }
    return true;
  }
  function callCore(method){
    var core = currentCore();
    if(!core || typeof core[method] !== 'function') throw new Error('Copilot core is not ready: ' + method);
    return core[method].apply(core, Array.prototype.slice.call(arguments, 1));
  }

  function readSpecFileInput(evt){
    var input = evt && evt.target ? evt.target : byId('copilotSpecFile');
    var file = input && input.files && input.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      var text = String(reader.result || '');
      var core = currentCore();
      if(core && typeof core.setCopilotDeckSpecText === 'function') core.setCopilotDeckSpecText(text);
      else { var box = byId('copilotSpecText'); if(box) box.value = text; }
      if(core && typeof core.setCopilotStatus === 'function') core.setCopilotStatus('Loaded deck spec file: ' + file.name);
    };
    reader.onerror = function(){ record('Could not read deck spec file', reader.error || new Error(file.name)); };
    reader.readAsText(file);
  }
  function readReferenceFileInput(evt){
    var input = evt && evt.target ? evt.target : byId('copilotReferenceFile');
    var files = input && input.files ? Array.prototype.slice.call(input.files) : [];
    if(!files.length) return;
    var core = currentCore();
    var allowedText = /\.(txt|md|markdown|json|csv|tex|html?|xml|yaml|yml)$/i;
    var skipped = [];
    var maxPdfBytes = 50 * 1024 * 1024;
    var jobs = files.map(function(file){
      return new Promise(function(resolve){
        var name = file && file.name ? file.name : 'reference-file';
        var type = file && file.type ? file.type : '';
        var isPdf = /\.pdf$/i.test(name) || /application\/pdf/i.test(type);
        if(isPdf){
          if(file.size && file.size > maxPdfBytes){
            skipped.push(name + ' (PDF is larger than 50 MB)');
            resolve({ kind:'skip' });
            return;
          }
          var pdfReader = new FileReader();
          pdfReader.onload = function(){
            var dataUrl = String(pdfReader.result || '');
            var comma = dataUrl.indexOf(',');
            var base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            if(!base64){ skipped.push(name); resolve({ kind:'skip' }); return; }
            resolve({ kind:'pdf', file:{ filename:name, file_data:base64, bytes:file.size || 0 } });
          };
          pdfReader.onerror = function(){ skipped.push(name); resolve({ kind:'skip' }); };
          pdfReader.readAsDataURL(file);
          return;
        }
        if(file && name && !allowedText.test(name) && !/^text\//i.test(type) && !/json/i.test(type)){
          skipped.push(name);
          resolve({ kind:'skip' });
          return;
        }
        var reader = new FileReader();
        reader.onload = function(){
          var text = String(reader.result || '');
          var maxChars = 140000;
          if(text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[File truncated to ' + maxChars + ' characters before adding to Copilot references.]';
          resolve({ kind:'text', text:'--- Reference file: ' + name + ' ---\n' + text });
        };
        reader.onerror = function(){ skipped.push(name); resolve({ kind:'skip' }); };
        reader.readAsText(file);
      });
    });
    Promise.all(jobs).then(function(items){
      var textChunks = items.filter(function(x){ return x && x.kind === 'text' && x.text; }).map(function(x){ return x.text; });
      var pdfFiles = items.filter(function(x){ return x && x.kind === 'pdf' && x.file; }).map(function(x){ return x.file; });
      var added = textChunks.join('\n\n');
      if(added){
        if(core && typeof core.setCopilotReferenceText === 'function') core.setCopilotReferenceText(added, true);
        else { var box = byId('copilotReferenceText'); if(box) box.value = [box.value, added].filter(Boolean).join('\n\n'); }
      }
      if(pdfFiles.length && core && typeof core.setCopilotReferencePdfFiles === 'function') core.setCopilotReferencePdfFiles(pdfFiles, true);
      var loadedCount = textChunks.length + pdfFiles.length;
      var message = 'Loaded ' + loadedCount + ' reference file' + (loadedCount === 1 ? '' : 's') + '.';
      if(pdfFiles.length) message += ' Attached ' + pdfFiles.length + ' PDF' + (pdfFiles.length === 1 ? '' : 's') + ' for Copilot.';
      if(skipped.length) message += ' Skipped unsupported file(s): ' + skipped.join(', ') + '.';
      if(core && typeof core.setCopilotStatus === 'function') core.setCopilotStatus(message);
      if(input) input.value = '';
    });
  }
  function parseSpecOnly(){
    var core = currentCore();
    if(!core || typeof core.parseCopilotDeckSpecText !== 'function') throw new Error('Copilot spec parser is not ready.');
    var box = byId('copilotSpecText');
    var plan = core.parseCopilotDeckSpecText(box ? box.value : '');
    if(core && typeof core.summarizeCopilotDeckSpec === 'function' && typeof core.setCopilotStatus === 'function'){
      core.setCopilotStatus(core.summarizeCopilotDeckSpec(plan));
    }
    if(core && core.copilotRuntimeStatus) core.copilotRuntimeStatus.lastDeckSpecPreview = plan;
    return plan;
  }
  function runGeneration(label, method){
    var args = Array.prototype.slice.call(arguments, 2);
    if(status.generationInFlight){
      status.duplicateClicksIgnored += 1;
      var core = currentCore();
      if(core && typeof core.setCopilotStatus === 'function') core.setCopilotStatus('Copilot is already generating. Wait for the current request to finish.', true);
      return null;
    }
    status.generationInFlight = true;
    setGenerationButtonsBusy(true);
    var p;
    try{
      p = callCore.apply(null, [method].concat(args));
    }catch(err){
      status.generationInFlight = false;
      setGenerationButtonsBusy(false);
      throw err;
    }
    return Promise.resolve(p).finally(function(){
      status.generationInFlight = false;
      setGenerationButtonsBusy(false);
    });
  }

  function bind(){
    var core = currentCore();
    if(!core){
      record('LuminaCopilotCore is missing. Main app still works, but Copilot controls are disabled.');
      status.bound = false;
      return;
    }
    try{
      if(typeof core.loadCopilotSettings === 'function') core.loadCopilotSettings();
      ['copilotApiKey','copilotEndpoint'].forEach(function(id){ var el = byId(id); if(el) el.addEventListener('input', safeValidate); });
      status.validationBound = true;
      safeValidate();
      add('saveCopilotKeyBtn', 'click', function(){ status.lastAction = 'save settings'; return callCore('saveCopilotSettings', true); });
      var model = byId('copilotModel'); if(model) model.addEventListener('change', function(){ try{ callCore('saveCopilotSettings', false); }catch(err){ record('Could not save Copilot model setting', err); } });
      var endpoint = byId('copilotEndpoint'); if(endpoint) endpoint.addEventListener('change', function(){ try{ callCore('saveCopilotSettings', false); }catch(err){ record('Could not save Copilot endpoint setting', err); } });
      var tone = byId('copilotTone'); if(tone) tone.addEventListener('change', function(){ try{ callCore('saveCopilotSettings', false); }catch(err){ record('Could not save Copilot tone setting', err); } });
      var specFile = byId('copilotSpecFile'); if(specFile && !specFile.__luminaCopilotSpecFileBound){ specFile.__luminaCopilotSpecFileBound = true; specFile.addEventListener('change', readSpecFileInput); }
      var referenceFile = byId('copilotReferenceFile'); if(referenceFile && !referenceFile.__luminaCopilotReferenceFileBound){ referenceFile.__luminaCopilotReferenceFileBound = true; referenceFile.addEventListener('change', readReferenceFileInput); }
      add('copilotCheckRefsBtn', 'click', function(){ status.lastAction = 'check references'; var core=currentCore(); if(core && typeof core.summarizeCopilotReferences === 'function' && typeof core.setCopilotStatus === 'function') core.setCopilotStatus(core.summarizeCopilotReferences()); return false; });
      add('copilotClearRefsBtn', 'click', function(){ status.lastAction = 'clear references'; var core=currentCore(); if(core && typeof core.setCopilotReferenceText === 'function') core.setCopilotReferenceText('', false); else { var rt=byId('copilotReferenceText'); if(rt) rt.value=''; } if(core && typeof core.setCopilotReferenceUrls === 'function') core.setCopilotReferenceUrls(''); else { var ru=byId('copilotReferenceUrls'); if(ru) ru.value=''; } if(core && typeof core.setCopilotReferencePdfFiles === 'function') core.setCopilotReferencePdfFiles([], false); if(core && typeof core.setCopilotStatus === 'function') core.setCopilotStatus('Cleared Copilot reference material.'); return false; });
      add('copilotParseSpecBtn', 'click', function(){ status.lastAction = 'parse deck spec'; return parseSpecOnly(); });
      add('copilotGenerateSpecDeckBtn', 'click', function(){ status.lastAction = 'generate deck from spec'; return runGeneration('generate deck from spec', 'generateCopilotDeckFromSpec'); });
      add('copilotDraftSlideBtn', 'click', function(){ status.lastAction = 'draft current slide'; return runGeneration('draft current slide', 'generateCopilotSlide', 'replace'); });
      add('copilotAddSlideBtn', 'click', function(){ status.lastAction = 'append generated slide'; return runGeneration('append generated slide', 'generateCopilotSlide', 'append'); });
      add('copilotGenerateDeckBtn', 'click', function(){ status.lastAction = 'generate deck'; return runGeneration('generate deck', 'generateCopilotDeck'); });
      add('copilotApplyFirstSlideBtn', 'click', function(){ status.lastAction = 'apply first slide'; return callCore('applyCopilotFirstSlide'); });
      add('copilotAppendResultBtn', 'click', function(){ status.lastAction = 'append result'; return callCore('appendCopilotSlides'); });
      add('copilotReplaceDeckBtn', 'click', function(){ status.lastAction = 'replace deck'; return callCore('replaceDeckWithCopilot'); });
      status.bound = true;
      if(typeof currentCore().setCopilotStatus === 'function'){
        currentCore().setCopilotStatus('Copilot ready. Main app is guarded from Copilot startup failures.');
      }
    }catch(err){
      status.bound = false;
      record('Copilot binding failed. Main app should remain usable.', err);
      if(core && typeof core.setCopilotStatus === 'function') core.setCopilotStatus('Copilot failed to initialize. Main editor should still work.', true);
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once:true });
  else bind();
})(window);
