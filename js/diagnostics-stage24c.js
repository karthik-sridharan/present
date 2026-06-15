(function () {
  'use strict';
  var W = window;
  var D = W.LuminaDiagnostics = W.LuminaDiagnostics || {};
  D.stage = W.LUMINA_STAGE || 'stage24c-20260425-1';
  D.loaded = D.loaded || {};
  D.failed = D.failed || {};
  D.errors = D.errors || [];
  D.startedAt = new Date().toISOString();
  var previousBootError = W.luminaBootError;
  W.luminaBootError = function (message) {
    var msg = String(message || 'Unknown startup error');
    D.errors.push({ time: new Date().toISOString(), message: msg });
    if (typeof previousBootError === 'function') previousBootError(msg);
    else { W.LUMINA_BOOT_ERRORS = W.LUMINA_BOOT_ERRORS || []; W.LUMINA_BOOT_ERRORS.push(msg); }
  };
  D.markLoaded = function (asset) { D.loaded[String(asset)] = true; };
  D.markFailed = function (asset) { D.failed[String(asset)] = true; W.luminaBootError('Failed to load ' + asset); };
  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function expectedAssets() { return (W.LuminaModuleManifest && W.LuminaModuleManifest.assets ? W.LuminaModuleManifest.assets : (W.LUMINA_EXPECTED_ASSETS || [])).slice(); }
  function expectedGlobals() { return (W.LuminaModuleManifest && W.LuminaModuleManifest.globals ? W.LuminaModuleManifest.globals : [
    'LuminaUtils','LuminaBlockLibrary','LuminaTheme','LuminaPresets','LuminaParser','LuminaBlockStyle','LuminaImport','LuminaState','LuminaExport','LuminaRendererApi','LuminaDeck','LuminaFileIo','LuminaFigureInsert','LuminaDiagramEditor','LuminaFigureTools','LuminaEditorSelection','LuminaBlockEditor','LuminaCopilotCore','LuminaCopilotGuardStatus','LuminaCommands'
  ]).slice(); }
  function expectedDomIds() { return (W.LuminaModuleManifest && W.LuminaModuleManifest.domIds ? W.LuminaModuleManifest.domIds : ['leftTabs','slideType','preview','deckList','blockList','deckTitle']).slice(); }
  function esmStatus(esm) { return esm ? (esm.status || (esm.ok === true ? 'passed' : 'failed')) : 'not-started'; }
  function pickAiPatchStats() {
    return W.__LUMINA_STAGE43A_MATHPIX_REPAIR
      || W.__LUMINA_STAGE42O_PATCH_AI_IMPORT_REPAIR
      || W.__LUMINA_STAGE42N_PATCH_AI_IMPORT_REPAIR
      || W.__LUMINA_STAGE42L_PATCH_AI_IMPORT_REPAIR
      || W.__LUMINA_STAGE42J_PATCH_AI_IMPORT_REPAIR
      || W.__LUMINA_STAGE42I_PATCH_AI_IMPORT_REPAIR
      || W.__LUMINA_STAGE42H_PATCH_AI_IMPORT_REPAIR
      || W.__LUMINA_STAGE42C_SIMPLE_AI_IMPORT_REPAIR
      || null;
  }
  function pickAiBackgroundStatus() {
    return W.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || null;
  }
  function deriveAiRepairStatus() {
    var bg = pickAiBackgroundStatus();
    var patch = pickAiPatchStats();
    var config = W.__LUMINA_STAGE42C_SIMPLE_AI_IMPORT_REPAIR_STATUS || null;
    var importedSlides = Number((bg && bg.slideCount) || (patch && patch.sourceSlides) || 0) || 0;
    var repairedSlides = Number((bg && (bg.repairedSlides || bg.replacedSlides)) || 0) || 0;
    var changedCount = Number((patch && patch.changedCount) || 0) || 0;
    var patchesApplied = Number((patch && patch.patchesApplied) || 0) || 0;
    var changedSlides = patch && Array.isArray(patch.changedSlides) ? patch.changedSlides.slice() : [];
    var changedSlideCount = Number((patch && patch.changedSlideCount) || changedSlides.length || 0) || 0;
    var changeSummary = patch && patch.changeSummary ? String(patch.changeSummary) : '';
    var changeTrackingUnavailable = changedCount > 0 && changedSlideCount === 0;
    var didRun = !!(bg || patch);
    var worked = null;
    var state = didRun ? 'unknown' : 'idle';
    var message = didRun ? 'Mathpix patch repair status is available below.' : 'No Mathpix patch repair has run in this page session yet.';

    if (bg && bg.pending) {
      worked = null;
      state = 'pending';
      message = 'Mathpix patch repair is still running' + (importedSlides ? ' for ' + importedSlides + ' imported slide' + (importedSlides === 1 ? '' : 's') : '') + '.';
    } else if (bg && (bg.ok === true || bg.applied === true)) {
      worked = true;
      if (changedCount > 0) {
        state = 'applied';
        message = 'Mathpix patch repair worked. It repaired ' + (repairedSlides || importedSlides || 0) + ' slide' + ((repairedSlides || importedSlides || 0) === 1 ? '' : 's') + ' and applied ' + changedCount + ' change' + (changedCount === 1 ? '' : 's') + (changedSlideCount ? ' across ' + changedSlideCount + ' slide' + (changedSlideCount === 1 ? '' : 's') : '') + (changeTrackingUnavailable ? '. Per-slide detail was not recorded for this completed run; Stage 42P records it on the next import' : '') + '.';
      } else {
        state = 'completed-no-changes';
        message = 'Mathpix patch repair completed for ' + (repairedSlides || importedSlides || 0) + ' slide' + ((repairedSlides || importedSlides || 0) === 1 ? '' : 's') + ', but no patch changes were needed.';
      }
    } else if (bg && bg.skipped && bg.stale) {
      worked = false;
      state = 'skipped-stale';
      message = 'Mathpix patch repair finished, but it was skipped because the imported slides changed before repair finished.';
    } else if (bg && bg.keptSource) {
      worked = false;
      state = 'kept-source';
      message = 'Mathpix patch repair did not apply. The source-extracted slides stayed loaded.';
      if (bg.reason) message += ' Reason: ' + bg.reason;
      else if (bg.error) message += ' Error: ' + bg.error;
    } else if (patch && changedCount > 0) {
      worked = true;
      state = 'patch-ready';
      message = 'Mathpix patch repair produced ' + changedCount + ' change' + (changedCount === 1 ? '' : 's') + ', but final apply status was not captured.';
    } else if (patch) {
      worked = true;
      state = 'parsed-no-changes';
      message = 'Mathpix patch repair returned patch data, but there were no patch changes to apply.';
    }

    return {
      enabled: !!(config && config.enabled),
      configuredBehavior: config && config.behavior ? config.behavior : null,
      promptFile: config && config.promptFile ? config.promptFile : null,
      repairPromptFile: config && config.repairPromptFile ? config.repairPromptFile : null,
      didRun: didRun,
      worked: worked,
      state: state,
      pending: !!(bg && bg.pending),
      importedSlides: importedSlides,
      repairedSlides: repairedSlides,
      changedCount: changedCount,
      changedSlideCount: changedSlideCount,
      changedSlides: changedSlides,
      changeSummary: changeSummary,
      changedSlideTrackingUnavailable: changeTrackingUnavailable,
      patchesApplied: patchesApplied,
      backgroundStatus: bg,
      patchStats: patch,
      updatedAt: (bg && bg.at) || (patch && patch.at) || null,
      message: message
    };
  }
  function collectReport() {
    var assets = expectedAssets();
    var missingAssets = assets.filter(function (asset) {
      if (/\.css(?:\?|$)/.test(asset)) return false;
      return !hasOwn(D.loaded, asset) || D.loaded[asset] !== true;
    });
    var missingGlobals = expectedGlobals().filter(function (key) { return !W[key]; });
    var missingDom = expectedDomIds().filter(function (id) { return !document.getElementById(id); });
    var bootErrors = (W.LUMINA_BOOT_ERRORS || []).slice();
    var aiRepairStatus = deriveAiRepairStatus();
    return {
      stage: W.LUMINA_STAGE || D.stage,
      diagnosticScriptStage: D.stage,
      stageFromWindow: W.LUMINA_STAGE || null,
      indexStageSignature: W.LUMINA_STAGE_SIGNATURE || null,
      indexDatasetStage: document.documentElement ? document.documentElement.getAttribute('data-lumina-stage') : null,
      url: location.href,
      userAgent: navigator.userAgent,
      startedAt: D.startedAt,
      checkedAt: new Date().toISOString(),
      expectedAssetCount: assets.length,
      loadedScriptCount: Object.keys(D.loaded).length,
      missingAssets: missingAssets,
      missingGlobals: missingGlobals,
      missingDomIds: missingDom,
      basicUiBound: !!W.__LUMINA_BASIC_UI_BOUND,
      previewHasContent: !!(document.getElementById('preview') && document.getElementById('preview').children.length),
      rendererFunctionBased: !!(W.LuminaRendererApi && typeof W.LuminaRendererApi.buildSlideMarkup === 'function'),
      uiFunctionBased: typeof W.initPanelTabs === 'function' && typeof W.initUiCleanupLayout === 'function',
      manifestLoaded: !!W.LuminaModuleManifest,
      rendererApi: {
        exposed: typeof W.LuminaRendererApi,
        buildSlideMarkup: W.LuminaRendererApi ? typeof W.LuminaRendererApi.buildSlideMarkup : 'undefined',
        normalizeSlide: W.LuminaRendererApi ? typeof W.LuminaRendererApi.normalizeSlide : 'undefined',
        legacyBuildPreview: typeof W.buildPreview
      },
      appCommandBridge: !!W.LuminaAppCommands,
      copilotCoreExposed: !!W.LuminaCopilotCore,
      copilotGuardBound: !!(W.LuminaCopilotGuardStatus && W.LuminaCopilotGuardStatus.bound),
      copilotGuard: W.LuminaCopilotGuardStatus || null,
      copilotRuntimeStatus: W.LuminaCopilotRuntimeStatus || null,
      copilotValidationBound: !!(W.LuminaCopilotGuardStatus && W.LuminaCopilotGuardStatus.validationBound),
      commandsBound: !!W.__LUMINA_COMMANDS_BOUND,
      commandCount: W.LuminaCommands && typeof W.LuminaCommands.list === 'function' ? W.LuminaCommands.list().length : 0,
      bootErrors: bootErrors,
      capturedErrors: D.errors.map(function (e) { return e.message || String(e); }),
      esModuleDiagnostics: W.LuminaEsModuleDiagnostics || null,
      esModuleSmokePassed: !!(W.LuminaEsModuleDiagnostics && W.LuminaEsModuleDiagnostics.ok === true),
      esModuleSmokeStatus: esmStatus(W.LuminaEsModuleDiagnostics || null),
      optionalEsmAssets: ((W.LUMINA_OPTIONAL_ES_MODULE_ASSETS || W.LUMINA_OPTIONAL_ESM_ASSETS || [])).slice(),
      optionalEsmAssetCount: ((W.LUMINA_OPTIONAL_ES_MODULE_ASSETS || W.LUMINA_OPTIONAL_ESM_ASSETS || [])).length,
      aiImportRepairStatus: aiRepairStatus,
      aiImportRepairSummary: {
        state: aiRepairStatus.state,
        worked: aiRepairStatus.worked,
        pending: aiRepairStatus.pending,
        importedSlides: aiRepairStatus.importedSlides,
        repairedSlides: aiRepairStatus.repairedSlides,
        changedCount: aiRepairStatus.changedCount,
        changedSlideCount: aiRepairStatus.changedSlideCount,
        changedSlides: aiRepairStatus.changedSlides,
        changeSummary: aiRepairStatus.changeSummary,
        changedSlideTrackingUnavailable: aiRepairStatus.changedSlideTrackingUnavailable,
        updatedAt: aiRepairStatus.updatedAt,
        message: aiRepairStatus.message
      }
    };
  }
  D.collectReport = collectReport;
  D.copyReport = function () {
    var text = JSON.stringify(collectReport(), null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return text; });
    return Promise.resolve(text);
  };
  D.getAiRepairStatus = deriveAiRepairStatus;
  function getAiRepairTone(status) {
    var state = status && status.state;
    if (state === 'applied') return { bg:'#ecfdf5', border:'#10b981', text:'#065f46', chip:'#d1fae5' };
    if (state === 'completed-no-changes' || state === 'parsed-no-changes') return { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8', chip:'#dbeafe' };
    if (state === 'pending') return { bg:'#fffbeb', border:'#f59e0b', text:'#92400e', chip:'#fef3c7' };
    if (state === 'kept-source' || state === 'skipped-stale') return { bg:'#fff7ed', border:'#ea580c', text:'#9a3412', chip:'#fed7aa' };
    return { bg:'#f8fafc', border:'#64748b', text:'#0f172a', chip:'#e2e8f0' };
  }
  function renderAiRepairSummary(container, status) {
    var tone = getAiRepairTone(status);
    var repaired = Number(status && status.repairedSlides || 0) || 0;
    var imported = Number(status && status.importedSlides || 0) || 0;
    var changed = Number(status && status.changedCount || 0) || 0;
    container.innerHTML = '';
    container.style.cssText = 'padding:12px;border-radius:12px;border:1px solid ' + tone.border + ';background:' + tone.bg + ';color:' + tone.text + ';font:13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;';
    var top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;';
    var left = document.createElement('div');
    var heading = document.createElement('div');
    heading.style.cssText = 'font:700 14px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;margin-bottom:6px';
    heading.textContent = 'Mathpix patch repair status';
    var body = document.createElement('div');
    body.textContent = String(status && status.message || 'No Mathpix patch repair information yet.');
    left.appendChild(heading);
    left.appendChild(body);
    var chip = document.createElement('div');
    chip.style.cssText = 'flex:0 0 auto;align-self:flex-start;padding:6px 10px;border-radius:999px;background:' + tone.chip + ';font:700 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:' + tone.text + ';text-transform:capitalize;';
    chip.textContent = String((status && status.state) || 'idle').replace(/-/g, ' ');
    top.appendChild(left);
    top.appendChild(chip);
    var stats = document.createElement('div');
    stats.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px;';
    function card(label, value) {
      var el = document.createElement('div');
      el.style.cssText = 'border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.72);border-radius:10px;padding:10px;min-height:58px;';
      el.innerHTML = '<div style="font:600 11px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;opacity:.75;letter-spacing:.02em;text-transform:uppercase;margin-bottom:5px">' + label + '</div><div style="font:700 18px/1.1 system-ui,-apple-system,Segoe UI,sans-serif">' + value + '</div>';
      return el;
    }
    stats.appendChild(card('Imported slides', imported || 0));
    stats.appendChild(card('Slides repaired', repaired || 0));
    stats.appendChild(card('Changes applied', changed || 0));
    stats.appendChild(card('Slides changed', status && status.changedSlideTrackingUnavailable ? 'Not recorded' : (Number(status && status.changedSlideCount || 0) || 0)));
    var changedList = document.createElement('div');
    changedList.style.cssText = 'margin-top:12px;border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.72);border-radius:10px;padding:10px;';
    var changedSlides = status && Array.isArray(status.changedSlides) ? status.changedSlides : [];
    if (changedSlides.length) {
      var listTitle = document.createElement('div');
      listTitle.style.cssText = 'font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;opacity:.75;';
      listTitle.textContent = 'Changed slides';
      changedList.appendChild(listTitle);
      changedSlides.slice(0, 12).forEach(function(entry){
        var row = document.createElement('div');
        row.style.cssText = 'padding:8px 0;border-top:1px solid rgba(15,23,42,.08);';
        var title = document.createElement('div');
        title.style.cssText = 'font:700 13px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;';
        title.textContent = 'Slide ' + (entry.slideNumber || (Number(entry.slideIndex || 0) + 1)) + (entry.title ? ': ' + entry.title : '');
        var summary = document.createElement('div');
        summary.style.cssText = 'font:12px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;margin-top:3px;opacity:.85;';
        summary.textContent = entry.summary || (Array.isArray(entry.changes) ? entry.changes.join('; ') : 'Changed');
        row.appendChild(title);
        row.appendChild(summary);
        changedList.appendChild(row);
      });
      if (changedSlides.length > 12) {
        var more = document.createElement('div');
        more.style.cssText = 'padding-top:8px;font-size:12px;opacity:.8;';
        more.textContent = 'Plus ' + (changedSlides.length - 12) + ' more changed slide' + (changedSlides.length - 12 === 1 ? '' : 's') + ' in the copied diagnostics JSON.';
        changedList.appendChild(more);
      }
    } else {
      changedList.textContent = status && status.changedSlideTrackingUnavailable
        ? 'Changes were counted, but per-slide detail was not recorded for this completed run. Re-import after Stage 42P to get slide-by-slide summaries.'
        : (status && status.didRun ? 'No per-slide changes were recorded.' : 'No Mathpix patch repair run recorded yet.');
    }
    if (status && status.updatedAt) {
      var meta = document.createElement('div');
      meta.style.cssText = 'margin-top:10px;font-size:12px;opacity:.8;';
      meta.textContent = 'Last updated: ' + status.updatedAt;
      container.appendChild(top);
      container.appendChild(stats);
      container.appendChild(changedList);
      container.appendChild(meta);
      return;
    }
    container.appendChild(top);
    container.appendChild(stats);
    container.appendChild(changedList);
  }
  function makePanel() {
    var existing = document.getElementById('luminaDiagPanel'); if (existing) existing.remove();
    var panel = document.createElement('div'); panel.id = 'luminaDiagPanel';
    panel.style.cssText = 'position:fixed;right:12px;bottom:58px;z-index:999998;width:min(680px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#111;color:#f8fafc;border:1px solid #475569;border-radius:12px;box-shadow:0 18px 55px rgba(0,0,0,.35);font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;padding:12px;';
    var title = document.createElement('div'); title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;';
    title.innerHTML = '<span>Lumina diagnostics — ' + D.stage + '</span>';
    var controls = document.createElement('span'); controls.style.cssText = 'display:flex;gap:6px;';
    function mkButton(label) { var b=document.createElement('button'); b.type='button'; b.textContent=label; b.style.cssText='font:12px system-ui;padding:5px 8px;border-radius:8px;border:1px solid #64748b;background:#1e293b;color:#f8fafc;cursor:pointer;'; return b; }
    var copy = mkButton('Copy report'); copy.onclick = function () { D.copyReport().then(function () { copy.textContent='Copied'; setTimeout(function () { copy.textContent='Copy report'; }, 1200); }); };
    var close = mkButton('Close'); close.onclick = function () { panel.remove(); };
    controls.appendChild(copy); controls.appendChild(close); title.appendChild(controls);
    var aiBox = document.createElement('div'); aiBox.style.cssText = 'margin:0 0 10px 0;';
    renderAiRepairSummary(aiBox, deriveAiRepairStatus());
    var pre = document.createElement('pre'); pre.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;'; pre.textContent = JSON.stringify(collectReport(), null, 2);
    panel.appendChild(title); panel.appendChild(aiBox); panel.appendChild(pre); document.body.appendChild(panel);
  }
  function makeAiRepairPanel() {
    var existing = document.getElementById('luminaAiRepairPanel'); if (existing) existing.remove();
    var panel = document.createElement('div'); panel.id = 'luminaAiRepairPanel';
    panel.style.cssText = 'position:fixed;right:12px;bottom:102px;z-index:999998;width:min(520px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#ffffff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;box-shadow:0 18px 55px rgba(0,0,0,.22);padding:14px;';
    var title = document.createElement('div'); title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;font:600 14px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;';
    title.innerHTML = '<span>Mathpix patch repair monitor</span>';
    var controls = document.createElement('span'); controls.style.cssText = 'display:flex;gap:6px;';
    function mkButton(label, primary) { var b=document.createElement('button'); b.type='button'; b.textContent=label; b.style.cssText='font:12px system-ui;padding:6px 10px;border-radius:9px;border:1px solid ' + (primary ? '#1d4ed8' : '#cbd5e1') + ';background:' + (primary ? '#1d4ed8' : '#fff') + ';color:' + (primary ? '#fff' : '#0f172a') + ';cursor:pointer;'; return b; }
    var refresh = mkButton('Refresh', false);
    var copy = mkButton('Copy JSON', false);
    var close = mkButton('Close', false);
    var summary = document.createElement('div');
    var detail = document.createElement('pre'); detail.style.cssText = 'margin:12px 0 0 0;white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:12px;padding:12px;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;';
    function render() {
      var status = deriveAiRepairStatus();
      renderAiRepairSummary(summary, status);
      detail.textContent = JSON.stringify(status, null, 2);
    }
    refresh.onclick = render;
    copy.onclick = function () {
      var text = JSON.stringify(deriveAiRepairStatus(), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ copy.textContent='Copied'; setTimeout(function(){ copy.textContent='Copy JSON'; }, 1200); });
      } else {
        copy.textContent='Copy unavailable';
        setTimeout(function(){ copy.textContent='Copy JSON'; }, 1200);
      }
    };
    close.onclick = function () { panel.remove(); };
    controls.appendChild(refresh); controls.appendChild(copy); controls.appendChild(close); title.appendChild(controls);
    panel.appendChild(title); panel.appendChild(summary); panel.appendChild(detail); document.body.appendChild(panel);
    render();
  }
  function updateAiRepairButtonAppearance() {
    var btn = document.getElementById('luminaAiRepairButton');
    if (!btn) return;
    var status = deriveAiRepairStatus();
    var tone = getAiRepairTone(status);
    btn.style.background = tone.bg;
    btn.style.color = tone.text;
    btn.style.borderColor = tone.border;
    btn.title = status.message;
    var label = 'Mathpix repair';
    if (status.state === 'pending') label = 'Mathpix • pending';
    else if (status.state === 'applied') label = 'Mathpix • worked';
    else if (status.state === 'completed-no-changes' || status.state === 'parsed-no-changes') label = 'Mathpix • no changes';
    else if (status.state === 'kept-source' || status.state === 'skipped-stale') label = 'Mathpix • issue';
    btn.textContent = label;
  }
  function ensureButton() {
    if (document.getElementById('luminaDiagButton')) return;
    var btn = document.createElement('button'); btn.id = 'luminaDiagButton'; btn.type = 'button'; btn.textContent = 'Diagnostics'; btn.title = 'Show Lumina startup/module diagnostics';
    btn.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:999997;border:0;border-radius:999px;background:#0f172a;color:#f8fafc;padding:9px 12px;font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);cursor:pointer;';
    btn.onclick = makePanel; document.body.appendChild(btn);
  }
  function ensureAiRepairButton() {
    if (document.getElementById('luminaAiRepairButton')) return;
    var btn = document.createElement('button');
    btn.id = 'luminaAiRepairButton';
    btn.type = 'button';
    btn.style.cssText = 'position:fixed;right:12px;bottom:52px;z-index:999997;border:1px solid #64748b;border-radius:999px;background:#f8fafc;color:#0f172a;padding:9px 12px;font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.18);cursor:pointer;';
    btn.onclick = makeAiRepairPanel;
    document.body.appendChild(btn);
    updateAiRepairButtonAppearance();
  }
  D.openPanel = makePanel;
  D.openAiRepairPanel = makeAiRepairPanel;
  function delayedChecks() {
    var report = collectReport();
    if (report.missingAssets.length) W.luminaBootError('Missing script load markers: ' + report.missingAssets.join(', '));
    if (report.missingGlobals.length) W.luminaBootError('Missing globals after startup: ' + report.missingGlobals.join(', '));
    if (report.missingDomIds.length) W.luminaBootError('Missing DOM ids: ' + report.missingDomIds.join(', '));
    if (!report.basicUiBound) W.luminaBootError('Basic UI binding marker missing.');
    if (!report.manifestLoaded) W.luminaBootError('Module manifest did not load.');
    if (!report.commandsBound) W.luminaBootError('Command shortcut binding marker missing.');
    ensureButton();
    ensureAiRepairButton();
    updateAiRepairButtonAppearance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(delayedChecks, 1200); });
  else setTimeout(delayedChecks, 1200);
  setInterval(updateAiRepairButtonAppearance, 1500);
})();
