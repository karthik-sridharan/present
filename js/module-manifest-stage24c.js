/* Stage 23A migration note:
   Stable filename cleanup. Runtime now loads stable names such as js/utils-stage24c.js
   while stage-tagged files can remain in the repository as rollback references.
   This is a classic browser script and does not change editor behavior.
*/
(function(global){
  'use strict';
  global.LuminaModuleManifest = Object.freeze({
    stage: 'stage24c-20260425-1',
    assets: [
    "css/styles-stage24c.css",
    "js/diagnostics-stage24c.js",
    "js/module-manifest-stage24c.js",
    "js/utils-stage24c.js",
    "js/block-library-stage24c.js",
    "js/theme-stage24c.js",
    "js/presets-stage24c.js",
    "js/parser-stage24c.js",
    "js/block-style-stage24c.js",
    "js/import-stage24c.js",
    "js/state-stage24c.js",
    "js/export-stage24c.js",
    "js/renderer-stage24c.js",
    "js/deck-stage24c.js",
    "js/file-io-stage24c.js",
    "js/ui-stage24c.js",
    "js/figure-insert-stage24c.js",
    "js/diagram-editor-stage24c.js",
    "js/figure-tools-stage24c.js",
    "js/editor-selection-stage24c.js",
    "js/block-editor-stage24c.js",
    "js/legacy-app-stage24c.js",
    "js/copilot-stage24c.js",
    "js/commands-stage24c.js"
],
    globals: [
    "LuminaUtils",
    "LuminaBlockLibrary",
    "LuminaTheme",
    "LuminaPresets",
    "LuminaParser",
    "LuminaBlockStyle",
    "LuminaImport",
    "LuminaState",
    "LuminaExport",
    "LuminaRendererApi",
    "LuminaDeck",
    "LuminaFileIo",
    "LuminaFigureInsert",
    "LuminaDiagramEditor",
    "LuminaFigureTools",
    "LuminaEditorSelection",
    "LuminaBlockEditor",
    "LuminaCopilotCore",
    "LuminaCopilotGuardStatus",
    "LuminaCopilotRuntimeStatus",
    "LuminaCommands"
],
    domIds: [
    "leftTabs",
    "slideType",
    "preview",
    "deckList",
    "blockList",
    "deckTitle"
],
    notes: [
      'Classic script runtime; no ES modules yet.',
      'Stage 23B aligns diagnostics with the actual renderer API.',
      'Stage-tagged files remain cache-proof rollback artifacts.',
      'Stage 24C hardens guarded Copilot with key validation, friendly API errors, and runtime diagnostics.',
      'Commands live in LuminaCommands and app bridge lives in LuminaAppCommands.'
    ],
    loadOrder: [
    "js/diagnostics-stage24c.js",
    "js/module-manifest-stage24c.js",
    "js/utils-stage24c.js",
    "js/block-library-stage24c.js",
    "js/theme-stage24c.js",
    "js/presets-stage24c.js",
    "js/parser-stage24c.js",
    "js/block-style-stage24c.js",
    "js/import-stage24c.js",
    "js/state-stage24c.js",
    "js/export-stage24c.js",
    "js/renderer-stage24c.js",
    "js/deck-stage24c.js",
    "js/file-io-stage24c.js",
    "js/ui-stage24c.js",
    "js/figure-insert-stage24c.js",
    "js/diagram-editor-stage24c.js",
    "js/figure-tools-stage24c.js",
    "js/editor-selection-stage24c.js",
    "js/block-editor-stage24c.js",
    "js/legacy-app-stage24c.js",
    "js/copilot-stage24c.js",
    "js/commands-stage24c.js"
]
  });
})(window);
