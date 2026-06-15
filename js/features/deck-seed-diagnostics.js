/* Stage 38L: fresh-launch deck seeding diagnostics. */
(function(){
  'use strict';
  var W = window, D = document, STAGE = W.LUMINA_STAGE || 'stage38n-20260427-1';
  function byId(id){ return D.getElementById(id); }
  function qsa(sel, root){ return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }
  function text(el){ return (el && (el.textContent || '') || '').trim(); }
  function appSlideCount(){ try{ return W.LuminaAppCommands && typeof W.LuminaAppCommands.getSlideCount === 'function' ? W.LuminaAppCommands.getSlideCount() : null; }catch(_e){ return null; } }
  function activeIndex(){ try{ return W.LuminaAppCommands && typeof W.LuminaAppCommands.getActiveIndex === 'function' ? W.LuminaAppCommands.getActiveIndex() : null; }catch(_e){ return null; } }
  function status(){
    var deck = byId('deckList');
    var outline = byId('stage35n-deck-outline-panel');
    var items = deck ? qsa(':scope > .deck-thumb-item[data-index], :scope > .deck-item[data-index]', deck) : [];
    var empty = deck ? !!deck.querySelector('.deck-empty') : false;
    var countText = text(byId('deckCount'));
    var previewHasContent = !!(byId('preview') && text(byId('preview')));
    var count = appSlideCount();
    var ai = activeIndex();
    return {
      stage: STAGE,
      freshDeckSeed: true,
      defaultPreviewSeededIntoDeck: !!(count && count > 0 && items.length > 0 && !empty),
      appSlideCount: count,
      activeSlideIndex: ai,
      activeSlideNumber: ai != null && ai >= 0 ? ai + 1 : null,
      deckCountText: countText,
      railItemCount: items.length,
      railThumbCount: deck ? qsa('.deck-thumb', deck).length : 0,
      deckEmptyShown: empty,
      previewHasContent: previewHasContent,
      outlinePanelPresent: !!outline,
      compactToolbarPreserved: !!(W.__LUMINA_STAGE38K_COMPACT_TOOLBAR && W.__LUMINA_STAGE38K_COMPACT_TOOLBAR.compactToolbar),
      safeDeckSyncPreserved: !!(W.__LUMINA_STAGE38I_SAFE_DECK_SYNC && W.__LUMINA_STAGE38I_SAFE_DECK_SYNC.safeCommandDeckSync),
      tests: {
        appHasSlide: !!(count && count > 0),
        railHasItem: items.length > 0,
        railHasThumb: deck ? qsa('.deck-thumb', deck).length > 0 : false,
        noDeckEmptyCard: !empty,
        previewHasContent: previewHasContent,
        pass: !!(count && count > 0 && items.length > 0 && !empty && previewHasContent)
      }
    };
  }
  function publish(){ W.__LUMINA_STAGE38L_FRESH_DECK_SEED = status(); return W.__LUMINA_STAGE38L_FRESH_DECK_SEED; }
  function patchDiagnostics(){
    var LD = W.LuminaDiagnostics;
    if(!LD || LD.__stage38lFreshDeckSeedPatched) return false;
    var prev = (typeof LD.collectReport === 'function' ? LD.collectReport.bind(LD) : (typeof LD.getReport === 'function' ? LD.getReport.bind(LD) : null));
    if(!prev) return false;
    function wrap(){
      var report = {};
      try { report = prev() || {}; } catch(e) { report = { stage: STAGE, stage38lPreviousReportError: String(e && (e.stack || e.message) || e) }; }
      var st = publish();
      report.stage38LFreshDeckSeedStatus = st;
      report.stage38LFreshDeckSeedDiagnostics = {
        appSlideCount: st.appSlideCount,
        railItemCount: st.railItemCount,
        railThumbCount: st.railThumbCount,
        deckCountText: st.deckCountText,
        deckEmptyShown: st.deckEmptyShown,
        activeSlideNumber: st.activeSlideNumber,
        compactToolbarPreserved: st.compactToolbarPreserved,
        safeDeckSyncPreserved: st.safeDeckSyncPreserved
      };
      return report;
    }
    LD.collectReport = wrap;
    LD.getReport = wrap;
    LD.__stage38lFreshDeckSeedPatched = true;
    return true;
  }
  function init(){ publish(); patchDiagnostics(); setTimeout(publish, 80); setTimeout(publish, 400); setTimeout(publish, 1200); }
  if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init, { once:true }); else init();
  W.LuminaStage38LFreshDeckSeed = { stage: STAGE, status: status, publish: publish };
})();
