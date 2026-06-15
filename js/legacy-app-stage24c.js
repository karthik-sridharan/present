/* Stage 20 migration note:
   Shared helpers live in js/utils.js.
   Reusable block library logic lives in js/block-library.js.
   Theme/style-builder logic lives in js/theme.js.
   Slide presets live in js/presets.js.
   Structured text parsing lives in js/parser.js.
   Block/title style and animation helpers live in js/block-style.js.
   Import parsers live in js/import.js.
   Autosave/state persistence helpers live in js/state.js.
   Export and save/PDF helpers live in js/export.js.
   Rendering/slide normalization helpers live in js/renderer.js.
   Deck list, slide CRUD, snippets, and clipboard helpers live in js/deck.js.
   Import/file-loading workflow lives in js/file-io.js.
   UI shell helpers live in js/ui.js.
   Figure insertion helpers live in js/figure-insert.js.
   Simple diagram editor popup lives in js/diagram-editor.js.
   Interactive figure editing helpers live in js/figure-tools.js.
   Preview block/title selection and animation controls live in js/editor-selection.js.
   Block editor/form synchronization and current-slide draft helpers live in js/block-editor.js.
   Stage 36E adds deck/editor undo-redo history around autosaved mutations.
   legacy-app.js intentionally remains a classic script while we migrate gradually.
*/
const LuminaUtils = window.LuminaUtils;
if(!LuminaUtils){
  throw new Error('LuminaUtils failed to load. Check that js/utils.js is included before js/legacy-app.js.');
}
const {
  clone,
  escapeHtml,
  escapeAttr,
  preserveMathTokens,
  restoreMathTokens,
  hexToRgb,
  rgbaFromHex,
  normalizeTheme
} = LuminaUtils;

const LuminaBlockStyle = window.LuminaBlockStyle;
if(!LuminaBlockStyle){
  throw new Error('LuminaBlockStyle failed to load. Check that js/block-style.js is included before js/legacy-app.js.');
}
const blockStyleApi = LuminaBlockStyle.createApi({ escapeAttr });
const {
  normalizeBlockStyle,
  normalizeAnimation,
  animationDataAttrs,
  blockWrapperStyle,
  titleWrapperStyle
} = blockStyleApi;

const LuminaFigureInsert = window.LuminaFigureInsert;
if(!LuminaFigureInsert){
  throw new Error('LuminaFigureInsert failed to load. Check that js/figure-insert.js is included before js/legacy-app.js.');
}
const figureInsertApi = LuminaFigureInsert.createApi({
  escapeAttr,
  getBlockFields: () => blockFields,
  currentColumnName: () => currentColumnName(),
  blockArray: name => blockArray(name),
  selectedIndex: name => selectedIndex(name),
  setSelectedIndex: (name, idx) => setSelectedIndex(name, idx),
  loadSelectedBlockIntoEditor: () => loadSelectedBlockIntoEditor(),
  buildPreview: () => buildPreview(),
  persistAutosaveNow: reason => persistAutosaveNow(reason),
  saveCurrentBlockToDraft: () => saveCurrentBlockToDraft(),
  showToast,
  getFigureModal: () => figureModal,
  getFigureImagePanel: () => figureImagePanel,
  getFigureEditorPanel: () => figureEditorPanel
});
const {
  insertTextAtCursor,
  currentFigureMode,
  wrapFigureHtml,
  insertFigureAsNewCustomBlock,
  insertFigureHtml,
  buildImageFigureHtml,
  openFigureModal,
  closeFigureModal
} = figureInsertApi;
window.insertFigureHtmlFromEditor = insertFigureHtml;

const LuminaImport = window.LuminaImport;
if(!LuminaImport){
  throw new Error('LuminaImport failed to load. Check that js/import.js is included before js/legacy-app.js.');
}
const LuminaState = window.LuminaState;
if(!LuminaState){
  throw new Error('LuminaState failed to load. Check that js/state.js is included before js/legacy-app.js.');
}
const importApi = LuminaImport.createApi({ normalizeSlide, escapeAttr, buildImageFigureHtml });
const {
  buildImportedContent,
  makeImportedSlide,
  makeReferenceImageSlide,
  makeReferencePdfSlide,
  parseMarkdownToSlides,
  parseBeamerToSlides,
  jsonItemToSlide,
  parseJsonOutlineToSlides,
  parsePowerPointTextToSlides
} = importApi;

/**
 * legacy-app.js
 * Exact runtime JS extracted from index-working.html.
 * Safe stage-1 reset: no imports, no ES modules.
 */

const fields = {
  deckTitle: document.getElementById('deckTitle'),
  slideType: document.getElementById('slideType'),
  headingLevel: document.getElementById('headingLevel'),
  bgColor: document.getElementById('bgColor'),
  fontColor: document.getElementById('fontColor'),
  inheritTheme: document.getElementById('inheritTheme'),
  title: document.getElementById('title'),
  kicker: document.getElementById('kicker'),
  lede: document.getElementById('lede'),
  notesTitle: document.getElementById('notesTitle'),
  notesBody: document.getElementById('notesBody')
};
const blockFields = {
  column: document.getElementById('blockColumn'),
  mode: document.getElementById('blockMode'),
  title: document.getElementById('blockTitle'),
  content: document.getElementById('blockContent')
};

const themeFields = {
  name: document.getElementById('themeName'),
  bgColor: document.getElementById('themeBgColor'),
  fontColor: document.getElementById('themeFontColor'),
  accentColor: document.getElementById('themeAccentColor'),
  panelRadius: document.getElementById('themePanelRadius'),
  titleScale: document.getElementById('themeTitleScale'),
  beamerStyle: document.getElementById('themeBeamerStyle'),
  chromeColor: document.getElementById('themeChromeColor'),
  chromeTextColor: document.getElementById('themeChromeTextColor'),
  sidebarWidth: document.getElementById('themeSidebarWidth'),
  titleCaps: document.getElementById('themeTitleCaps')
};
const preview = document.getElementById('preview');
const snippetOutput = document.getElementById('snippetOutput');
const deckList = document.getElementById('deckList');
const blockList = document.getElementById('blockList');
const deckCount = document.getElementById('deckCount');
const previewTitle = document.getElementById('previewTitle');
const toast = document.getElementById('toast');
const columnModeBadge = document.getElementById('columnModeBadge');
const expandDiagramSnippet = document.getElementById('expandDiagramSnippet');
const figureModal = document.getElementById('figureModal');
const figureUrlInput = document.getElementById('figureUrlInput');
const figureAltInput = document.getElementById('figureAltInput');
const figureFileInput = document.getElementById('figureFileInput');
const figureImagePanel = document.getElementById('figureImagePanel');
const figureEditorPanel = document.getElementById('figureEditorPanel');
const blockLibraryList = document.getElementById('blockLibraryList');
const showGridToggle = document.getElementById('showGridToggle');
const showMarginsToggle = document.getElementById('showMarginsToggle');
const snapToGuidesToggle = document.getElementById('snapToGuidesToggle');
const lockAspectToggle = document.getElementById('lockAspectToggle');
const selectedFiguresStatus = document.getElementById('selectedFiguresStatus');
const previewGridOverlay = document.getElementById('previewGridOverlay');
const previewMarginOverlay = document.getElementById('previewMarginOverlay');
const previewBlockLabel = document.getElementById('previewBlockLabel');
const previewBlockFontScale = document.getElementById('previewBlockFontScale');
const previewBlockFontFamily = document.getElementById('previewBlockFontFamily');
const previewBlockFontColor = document.getElementById('previewBlockFontColor');
const previewBlockBulletType = document.getElementById('previewBlockBulletType');
const animateTargetLabel = document.getElementById('animateTargetLabel');
const animateBuildIn = document.getElementById('animateBuildIn');
const animateBuildOut = document.getElementById('animateBuildOut');
const animateStepMode = document.getElementById('animateStepMode');
const animateOrder = document.getElementById('animateOrder');
const copilotEls = {
  prompt: document.getElementById('copilotPrompt'),
  slideCount: document.getElementById('copilotSlideCount'),
  tone: document.getElementById('copilotTone'),
  mode: document.getElementById('copilotMode'),
  model: document.getElementById('copilotModel'),
  endpoint: document.getElementById('copilotEndpoint'),
  apiKey: document.getElementById('copilotApiKey'),
  webSearch: document.getElementById('copilotWebSearch'),
  specText: document.getElementById('copilotSpecText'),
  referenceText: document.getElementById('copilotReferenceText'),
  referenceUrls: document.getElementById('copilotReferenceUrls'),
  status: document.getElementById('copilotStatus'),
  resultJson: document.getElementById('copilotResultJson'),
  keyWarning: document.getElementById('copilotKeyWarning')
};
const COPILOT_API_KEY_STORAGE = 'html-presentation-generator-openai-api-key-v1';
const COPILOT_SETTINGS_STORAGE = 'html-presentation-generator-copilot-settings-v1';

const COPILOT_DEFAULT_ENDPOINT = 'https://api.openai.com/v1/responses';
const COPILOT_DECK_PROMPT_FILE = 'prompts/deck.txt';
const COPILOT_DEFAULT_DECK_PROMPT_PREFIX = [
  'Deck-level generation instructions:',
  'Create a coherent complete presentation, not a loose collection of slides.',
  'Use a strong narrative arc: title/context, motivation, key ideas, details/examples, synthesis, and closing recap.',
  'Make slide titles specific and informative.',
  'Use speaker notes to explain transitions, emphasis, and teaching guidance.',
  'Keep the deck editable: prefer normal text/panel blocks and avoid embedding large custom HTML unless explicitly requested.'
].join('\n');
let deckPromptPrefixCache = null;
let copilotReferencePdfFiles = [];
const copilotRuntimeStatus = window.LuminaCopilotRuntimeStatus = {
  stage: window.LUMINA_STAGE || 'stage34m-20260425-1',
  lastValidationWarning: '',
  lastError: '',
  lastErrorAt: '',
  lastSuccessAt: '',
  lastStatus: '',
  requestInFlight: false,
  requestCount: 0
};
function updateCopilotRuntime(patch){
  Object.assign(copilotRuntimeStatus, patch || {});
  return copilotRuntimeStatus;
}
function isDefaultOpenAiEndpoint(endpoint){
  try{
    const host = new URL(endpoint || COPILOT_DEFAULT_ENDPOINT, location.href).hostname;
    return /(^|\.)api\.openai\.com$/i.test(host);
  }catch(_){
    return false;
  }
}
function visibleKeyPrefix(key){
  const k = String(key || '').trim();
  if(!k) return '';
  return k.slice(0, Math.min(10, k.length)) + (k.length > 10 ? '…' : '');
}
function validateCopilotApiKey(key, endpoint, options={}){
  const k = String(key || '').trim();
  const usingOpenAI = isDefaultOpenAiEndpoint(endpoint);
  if(k && /^https?:\/\//i.test(k)){
    throw new Error('The API key field contains a URL. Paste the secret key value itself, usually starting with sk-proj- or sk-, not the API keys page link.');
  }
  if(usingOpenAI && options.requireKey && !k){
    throw new Error('Enter an OpenAI API key, or change the endpoint to your own backend proxy that injects credentials server-side.');
  }
  if(usingOpenAI && k && !/^sk-/i.test(k)){
    throw new Error('This does not look like an OpenAI API key. OpenAI keys usually start with sk-proj- or sk-. Current value begins with: ' + visibleKeyPrefix(k));
  }
  if(!usingOpenAI && k && /^sk-/i.test(k)){
    return 'You are using a custom endpoint with a key that looks like a direct OpenAI key. For production, prefer keeping the key only on your backend.';
  }
  if(usingOpenAI && k){
    return 'Looks like an OpenAI key. For public deployment, move requests through a backend proxy instead of storing the key in the browser.';
  }
  return '';
}
function updateCopilotKeyWarning(){
  const endpoint = (copilotEls.endpoint?.value || '').trim() || COPILOT_DEFAULT_ENDPOINT;
  const key = (copilotEls.apiKey?.value || '').trim();
  let warning = '';
  let isError = false;
  try{
    warning = validateCopilotApiKey(key, endpoint, { requireKey:false }) || '';
  }catch(err){
    warning = err.message || String(err);
    isError = true;
  }
  updateCopilotRuntime({ lastValidationWarning: warning });
  if(copilotEls.keyWarning){
    copilotEls.keyWarning.textContent = warning;
    copilotEls.keyWarning.style.display = warning ? '' : 'none';
    copilotEls.keyWarning.style.color = isError ? '#ffb4b4' : '#ffd6a0';
    copilotEls.keyWarning.style.borderLeftColor = isError ? 'rgba(255,120,120,.8)' : 'rgba(255,214,160,.8)';
  }
  return !isError;
}
function friendlyCopilotHttpError(status, message){
  const raw = String(message || '').trim();
  if(status === 401){
    return 'OpenAI rejected the API key. Check that you pasted the secret key value itself, not the API keys page URL, and that the key has not been revoked. Details: ' + raw;
  }
  if(status === 403){
    return 'The request was forbidden. Check project permissions, model access, endpoint, and whether your key is allowed to use this API. Details: ' + raw;
  }
  if(status === 404){
    return 'The endpoint or model was not found. Check the endpoint URL and model name. Details: ' + raw;
  }
  if(status === 429){
    return 'OpenAI returned a rate limit/quota error. Check billing, project limits, or wait and retry. Details: ' + raw;
  }
  if(status >= 500){
    return 'The API service returned a server error. Retry later or check the endpoint/backend logs. Details: ' + raw;
  }
  return raw || ('Copilot request failed with status ' + status);
}
function recordCopilotError(err){
  const msg = (err && err.message) || String(err || 'Copilot failed.');
  updateCopilotRuntime({ lastError: msg, lastErrorAt: new Date().toISOString(), requestInFlight:false });
  return msg;
}
function recordCopilotSuccess(summary){
  updateCopilotRuntime({ lastSuccessAt: new Date().toISOString(), lastStatus: summary || 'success', lastError:'', requestInFlight:false });
}


let slides = [];
let activeIndex = -1;
let draftBlocks = { left: [], right: [] };
let draftTitleStyle = normalizeBlockStyle();
let draftTitleAnimation = normalizeAnimation();
let selectedBlock = { left: -1, right: -1 };
let syncingPreviewFigures = false;
const AUTOSAVE_KEY = 'html-presentation-generator-autosave-v5';
const BLOCK_LIBRARY_KEY = 'html-presentation-generator-block-library-v1';
let autosaveTimer = null;
let autosaveDirtyCount = 0;
let blockLibrary = [];

const HISTORY_LIMIT = 80;
let undoStack = [];
let redoStack = [];
let lastHistoryState = null;
let lastHistoryKey = '';
let historyApplying = false;
let historyTypingOpen = false;
let historyTypingTimer = null;


function showToast(message){
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.classList.remove('show'), 1400);
}
function setAutosaveStatus(msg){
  const el = document.getElementById('autosaveStatus');
  if(el) el.textContent = msg;
}
const LuminaBlockLibrary = window.LuminaBlockLibrary;
if(!LuminaBlockLibrary){
  throw new Error('LuminaBlockLibrary failed to load. Check that js/block-library.js is included before js/legacy-app.js.');
}
const blockLibraryApi = LuminaBlockLibrary.createApi({
  clone,
  escapeHtml,
  showToast,
  getBlockLibrary: () => blockLibrary,
  setBlockLibrary: value => { blockLibrary = value; },
  getBlockLibraryList: () => blockLibraryList,
  getBlockLibraryKey: () => BLOCK_LIBRARY_KEY,
  currentBlockFromEditor: () => currentBlockFromEditor(),
  currentColumnName: () => currentColumnName(),
  blockArray: name => blockArray(name),
  selectedIndex: name => selectedIndex(name),
  setSelectedIndex: (name, idx) => setSelectedIndex(name, idx),
  loadSelectedBlockIntoEditor: () => loadSelectedBlockIntoEditor(),
  renderBlockList: () => renderBlockList(),
  buildPreview: () => buildPreview(),
  scheduleAutosave: reason => scheduleAutosave(reason)
});
const {
  defaultReusableBlock,
  builtinLibraryEntries,
  loadBlockLibrary,
  persistBlockLibrary,
  renderBlockLibrary,
  saveCurrentBlockToLibrary,
  insertSelectedLibraryBlock,
  deleteSelectedLibraryBlock
} = blockLibraryApi;

const LuminaTheme = window.LuminaTheme;
if(!LuminaTheme){
  throw new Error('LuminaTheme failed to load. Check that js/theme.js is included before js/legacy-app.js.');
}
const themeApi = LuminaTheme.createApi({
  themeFields,
  normalizeTheme,
  rgbaFromHex,
  showToast,
  getDocument: () => document,
  buildPreview: () => buildPreview(),
  renderDeckList: () => renderDeckList(),
  scheduleAutosave: reason => scheduleAutosave(reason)
});
const {
  themeFieldValue,
  setThemeFieldValue,
  currentThemeFromFields,
  applyThemeToForm,
  currentPresentationOptions,
  applyPresentationOptions,
  currentStyleClass,
  buildSlideStyle,
  beamerPresetTheme,
  applyStylePreset,
  randomHexColor,
  applyStyleBuilder,
  randomizeStyleBuilder
} = themeApi;

const autosaveApi = LuminaState.createAutosaveApi({
  key: AUTOSAVE_KEY,
  setStatus: setAutosaveStatus,
  onError: err => console.error(err),
  beforePersist: () => {
    syncPreviewFiguresToDraft(false);
    saveCurrentBlockToDraft();
    saveCurrentSlideToDeck();
  },
  buildPayload: () => ({
    deckTitle: fields.deckTitle.value || 'My HTML Presentation',
    theme: currentThemeFromFields(),
    presentationOptions: currentPresentationOptions(),
    slides: slides.length ? slides.map(normalizeSlide) : [currentDraftSlide()],
    activeIndex,
    draftSlide: currentDraftSlide(),
    selectedBlock,
    blockColumn: blockFields.column.value,
    ts: Date.now()
  }),
  afterPersist: () => {
    if(!syncingPreviewFigures){
      snippetOutput.value = JSON.stringify(slideForSnippet(currentDraftSlide()), null, 2);
    }
  },
  applyPayload: payload => {
    if(payload.deckTitle) fields.deckTitle.value = payload.deckTitle;
    if(payload.theme) applyThemeToForm(payload.theme);
    if(payload.presentationOptions) applyPresentationOptions(payload.presentationOptions);
    slides = Array.isArray(payload.slides) ? payload.slides.map(normalizeSlide) : [];
    activeIndex = typeof payload.activeIndex === 'number' ? payload.activeIndex : (slides.length ? 0 : -1);
    if(activeIndex >= 0 && activeIndex < slides.length){
      applySlideToForm(slides[activeIndex]);
    }else if(payload.draftSlide){
      applySlideToForm(normalizeSlide(payload.draftSlide));
      activeIndex = -1;
    }
    if(payload.selectedBlock && typeof payload.selectedBlock === 'object'){
      selectedBlock = { left: payload.selectedBlock.left ?? -1, right: payload.selectedBlock.right ?? -1 };
    }
    if(payload.blockColumn) blockFields.column.value = payload.blockColumn;
    renderDeckList();
    buildPreview();
    return true;
  }
});

function serializeHistoryState(state){
  try{ return JSON.stringify(state || {}); }catch(_err){ return ''; }
}
function captureHistoryState(){
  try{
    if(typeof syncPreviewFiguresToDraft === 'function' && !syncingPreviewFigures) syncPreviewFiguresToDraft(false);
    if(typeof saveCurrentBlockToDraft === 'function') saveCurrentBlockToDraft();
    if(typeof saveCurrentSlideToDeck === 'function') saveCurrentSlideToDeck();
  }catch(err){ console.warn('Could not fully sync before history snapshot', err); }
  return {
    deckTitle: fields.deckTitle.value || 'My HTML Presentation',
    theme: currentThemeFromFields(),
    presentationOptions: currentPresentationOptions(),
    slides: Array.isArray(slides) ? slides.map(normalizeSlide) : [],
    activeIndex,
    draftSlide: (typeof currentDraftSlide === 'function') ? normalizeSlide(currentDraftSlide()) : null,
    selectedBlock: { left: selectedBlock ? (selectedBlock.left ?? -1) : -1, right: selectedBlock ? (selectedBlock.right ?? -1) : -1 },
    blockColumn: blockFields.column.value
  };
}
function applyHistoryState(state){
  if(!state) return false;
  clearScheduledAutosave();
  if(state.deckTitle) fields.deckTitle.value = state.deckTitle;
  if(state.theme) applyThemeToForm(state.theme);
  if(state.presentationOptions) applyPresentationOptions(state.presentationOptions);
  slides = Array.isArray(state.slides) ? state.slides.map(normalizeSlide) : [];
  activeIndex = typeof state.activeIndex === 'number' ? state.activeIndex : (slides.length ? 0 : -1);
  if(activeIndex >= slides.length) activeIndex = slides.length - 1;
  if(activeIndex >= 0 && activeIndex < slides.length){
    applySlideToForm(slides[activeIndex]);
  }else if(state.draftSlide){
    applySlideToForm(normalizeSlide(state.draftSlide));
    activeIndex = -1;
  }else{
    clearForm(false);
    activeIndex = -1;
  }
  if(state.selectedBlock && typeof state.selectedBlock === 'object'){
    selectedBlock = { left: state.selectedBlock.left ?? -1, right: state.selectedBlock.right ?? -1 };
  }
  if(state.blockColumn) blockFields.column.value = state.blockColumn;
  try{ loadSelectedBlockIntoEditor(); }catch(_err){}
  renderDeckList();
  buildPreview();
  return true;
}
function pushUndoState(state){
  if(!state) return;
  const key = serializeHistoryState(state);
  if(!key) return;
  const last = undoStack.length ? serializeHistoryState(undoStack[undoStack.length - 1]) : '';
  if(last && last === key) return;
  undoStack.push(JSON.parse(key));
  if(undoStack.length > HISTORY_LIMIT) undoStack.shift();
}
function updateHistoryButtons(){
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  document.querySelectorAll('[data-history-action="undo"]').forEach(btn=>{
    btn.disabled = !canUndo;
    btn.setAttribute('aria-disabled', canUndo ? 'false' : 'true');
  });
  document.querySelectorAll('[data-history-action="redo"]').forEach(btn=>{
    btn.disabled = !canRedo;
    btn.setAttribute('aria-disabled', canRedo ? 'false' : 'true');
  });
  window.__LUMINA_STAGE36E_HISTORY = Object.freeze({
    stage: window.LUMINA_STAGE || 'stage36j-20260426-1',
    undoDepth: undoStack.length,
    redoDepth: redoStack.length,
    limit: HISTORY_LIMIT,
    canUndo,
    canRedo
  });
}
function resetUndoRedoHistory(){
  undoStack = [];
  redoStack = [];
  historyTypingOpen = false;
  clearTimeout(historyTypingTimer);
  lastHistoryState = captureHistoryState();
  lastHistoryKey = serializeHistoryState(lastHistoryState);
  updateHistoryButtons();
}
function recordHistoryChange(reason){
  if(historyApplying) return;
  const current = captureHistoryState();
  const currentKey = serializeHistoryState(current);
  if(!currentKey) return;
  if(!lastHistoryState){
    lastHistoryState = current;
    lastHistoryKey = currentKey;
    updateHistoryButtons();
    return;
  }
  if(currentKey === lastHistoryKey) return;
  const isTypingLike = !reason || String(reason) === 'Autosaved.';
  if(isTypingLike){
    if(!historyTypingOpen) pushUndoState(lastHistoryState);
    historyTypingOpen = true;
    clearTimeout(historyTypingTimer);
    historyTypingTimer = setTimeout(()=>{ historyTypingOpen = false; }, 900);
  }else{
    historyTypingOpen = false;
    clearTimeout(historyTypingTimer);
    pushUndoState(lastHistoryState);
  }
  redoStack = [];
  lastHistoryState = current;
  lastHistoryKey = currentKey;
  updateHistoryButtons();
}
function undoHistory(){
  if(!undoStack.length){ showToast('Nothing to undo.'); updateHistoryButtons(); return false; }
  const current = captureHistoryState();
  const prev = undoStack.pop();
  redoStack.push(current);
  if(redoStack.length > HISTORY_LIMIT) redoStack.shift();
  historyApplying = true;
  try{
    applyHistoryState(prev);
    lastHistoryState = captureHistoryState();
    lastHistoryKey = serializeHistoryState(lastHistoryState);
    autosaveApi.persistAutosaveNow('Autosaved after undo.');
    showToast('Undo.');
  }finally{
    historyApplying = false;
    historyTypingOpen = false;
    clearTimeout(historyTypingTimer);
    updateHistoryButtons();
  }
  return true;
}
function redoHistory(){
  if(!redoStack.length){ showToast('Nothing to redo.'); updateHistoryButtons(); return false; }
  const current = captureHistoryState();
  const next = redoStack.pop();
  pushUndoState(current);
  historyApplying = true;
  try{
    applyHistoryState(next);
    lastHistoryState = captureHistoryState();
    lastHistoryKey = serializeHistoryState(lastHistoryState);
    autosaveApi.persistAutosaveNow('Autosaved after redo.');
    showToast('Redo.');
  }finally{
    historyApplying = false;
    historyTypingOpen = false;
    clearTimeout(historyTypingTimer);
    updateHistoryButtons();
  }
  return true;
}
function persistAutosaveNow(reason){
  recordHistoryChange(reason || 'Autosaved.');
  return autosaveApi.persistAutosaveNow(reason);
}
function scheduleAutosave(reason){
  recordHistoryChange(reason);
  return autosaveApi.scheduleAutosave(reason);
}
function restoreAutosave(){
  return autosaveApi.restoreAutosave();
}
function clearScheduledAutosave(){
  return autosaveApi.clearScheduledAutosave();
}

const LuminaParser = window.LuminaParser;
if(!LuminaParser){
  throw new Error('LuminaParser failed to load. Check that js/parser.js is included before js/legacy-app.js.');
}
const parserApi = LuminaParser.createApi({
  preserveMathTokens,
  restoreMathTokens,
  escapeHtml,
  escapeAttr
});
const { parseStructuredText } = parserApi;
/* moved to js/renderer-stage12.js: slide rendering and normalization helpers */

const LuminaBlockEditor = window.LuminaBlockEditor;
if(!LuminaBlockEditor){
  throw new Error('LuminaBlockEditor failed to load. Check that js/block-editor.js is included before js/legacy-app.js.');
}
const blockEditorApi = LuminaBlockEditor.createApi({
  clone,
  escapeHtml,
  normalizeSlide,
  normalizeBlockStyle,
  normalizeAnimation,
  fields,
  blockFields,
  columnModeBadge,
  previewTitle,
  blockList,
  preview,
  snippetOutput,
  getDraftBlocks: () => draftBlocks,
  setDraftBlocks: value => { draftBlocks = value; },
  getSelectedBlock: () => selectedBlock,
  setSelectedBlock: value => { selectedBlock = value; },
  getDraftTitleStyle: () => draftTitleStyle,
  setDraftTitleStyle: value => { draftTitleStyle = normalizeBlockStyle(value); },
  getDraftTitleAnimation: () => draftTitleAnimation,
  setDraftTitleAnimation: value => { draftTitleAnimation = normalizeAnimation(value); },
  getSlides: () => slides,
  getActiveIndex: () => activeIndex,
  isSyncingPreviewFigures: () => syncingPreviewFigures,
  setSyncingPreviewFigures: value => { syncingPreviewFigures = !!value; },
  currentThemeFromFields: () => currentThemeFromFields(),
  currentPresentationOptions: () => currentPresentationOptions(),
  slideForSnippet: slide => slideForSnippet(slide),
  saveFigureEmbedToDraft: embed => saveFigureEmbedToDraft(embed),
  buildPreview: () => buildPreview(),
  showToast,
  scheduleAutosave: reason => scheduleAutosave(reason),
  persistAutosaveNow: reason => persistAutosaveNow(reason)
});
const {
  blankBlock,
  currentDraftSlide,
  applySlideToForm,
  syncFields,
  currentColumnName,
  blockArray,
  selectedIndex,
  setSelectedIndex,
  loadSelectedBlockIntoEditor,
  getDraftBlock,
  currentBlockFromEditor,
  syncPreviewFiguresToDraft,
  saveCurrentBlockToDraft,
  saveCurrentSlideToDeck,
  currentDeckData,
  renderBlockList,
  addBlock,
  updateBlock,
  duplicateBlock,
  deleteBlock,
  moveBlock,
  replaceSelectedBlock,
  clearBlockEditor
} = blockEditorApi;

// Stage 17: figure insertion/modal helpers moved to js/figure-insert-stage16.js.
const LuminaDiagramEditor = window.LuminaDiagramEditor;
if(!LuminaDiagramEditor){
  throw new Error('LuminaDiagramEditor failed to load. Check that js/diagram-editor.js is included before js/legacy-app.js.');
}
const diagramEditorApi = LuminaDiagramEditor.createApi({
  closeFigureModal: () => closeFigureModal()
});
const { openSimpleDiagramEditor } = diagramEditorApi;

// Stage 17: simple diagram editor popup moved to js/diagram-editor-stage17.js.

// Stage 18: interactive figure fitting/editing helpers moved to js/figure-tools-stage18.js.
const LuminaFigureTools = window.LuminaFigureTools;
if(!LuminaFigureTools){
  throw new Error('LuminaFigureTools failed to load. Check that js/figure-tools.js is included before js/legacy-app.js.');
}
const figureToolsApi = LuminaFigureTools.createApi({
  escapeAttr,
  blockArray: name => blockArray(name),
  currentColumnName: () => currentColumnName(),
  selectedIndex: name => selectedIndex(name),
  blockFields,
  snippetOutput,
  slideForSnippet: slide => slideForSnippet(slide),
  currentDraftSlide: () => currentDraftSlide(),
  isSyncingPreviewFigures: () => syncingPreviewFigures,
  preview,
  previewGridOverlay,
  previewMarginOverlay,
  showGridToggle,
  showMarginsToggle,
  snapToGuidesToggle,
  lockAspectToggle,
  selectedFiguresStatus,
  updateAnimationControls: () => updateAnimationControls(),
  syncPreviewFiguresToDraft: updateSnippet => syncPreviewFiguresToDraft(updateSnippet),
  saveCurrentBlockToDraft: () => saveCurrentBlockToDraft(),
  saveCurrentSlideToDeck: () => saveCurrentSlideToDeck(),
  persistAutosaveNow: reason => persistAutosaveNow(reason),
  buildPreview: () => buildPreview(),
  scheduleAutosave: reason => scheduleAutosave(reason)
});
const {
  updatePreviewScale,
  fitFiguresInSlide,
  parseTranslate,
  replaceNthFigureHtml,
  getFigurePrimaryMedia,
  getSerializedImageFigure,
  serializeFigureBox,
  applySerializedImageState,
  isManualFigureEmbed,
  saveFigureEmbedToDraft,
  getSelectedFigureBoxes,
  updatePreviewGuides,
  refreshFigureToolState,
  getSlideMetricsForBox,
  moveBoxTo,
  normalizeFigureSelection,
  saveSelectedFigures,
  snapValue,
  applySnapToBox,
  alignSelectedFigures,
  distributeSelectedFigures,
  bringSelectedFigures,
  toggleCropSelectedFigure,
  duplicateSelectedFigure,
  resetSelectedFigure,
  applyGuideSnapping,
  getInteractionScale,
  ensureInteractiveFigureBox,
  initFigureInteractions,
  fitFiguresIn
} = figureToolsApi;

const LuminaEditorSelection = window.LuminaEditorSelection;
if(!LuminaEditorSelection){
  throw new Error('LuminaEditorSelection failed to load. Check that js/editor-selection.js is included before js/legacy-app.js.');
}
const editorSelectionApi = LuminaEditorSelection.createApi({
  normalizeBlockStyle,
  normalizeAnimation,
  preview,
  blockFields,
  snippetOutput,
  previewBlockLabel,
  previewBlockFontScale,
  previewBlockFontFamily,
  previewBlockFontColor,
  previewBlockBulletType,
  animateTargetLabel,
  animateBuildIn,
  animateBuildOut,
  animateStepMode,
  animateOrder,
  getDraftBlock: (column, idx) => getDraftBlock(column, idx),
  getDraftTitleStyle: () => draftTitleStyle,
  setDraftTitleStyle: value => { draftTitleStyle = normalizeBlockStyle(value); },
  getDraftTitleAnimation: () => draftTitleAnimation,
  setDraftTitleAnimation: value => { draftTitleAnimation = normalizeAnimation(value); },
  getSelectedFigureBoxes: () => getSelectedFigureBoxes(),
  refreshFigureToolState: () => refreshFigureToolState(),
  saveSelectedFigures: () => saveSelectedFigures(),
  saveCurrentBlockToDraft: () => saveCurrentBlockToDraft(),
  loadSelectedBlockIntoEditor: () => loadSelectedBlockIntoEditor(),
  setSelectedIndex: (name, idx) => setSelectedIndex(name, idx),
  slideForSnippet: slide => slideForSnippet(slide),
  currentDraftSlide: () => currentDraftSlide(),
  buildPreview: () => buildPreview(),
  scheduleAutosave: reason => scheduleAutosave(reason)
});
const {
  selectedPreviewBlock,
  selectedPreviewTitleStyle,
  selectedPreviewTarget,
  populatePreviewBlockStyleEditor,
  populatePreviewTitleStyleEditor,
  updatePreviewBlockSelectionUI,
  selectPreviewBlock,
  selectPreviewTitle,
  applySelectedPreviewBlockStyle,
  resetSelectedPreviewBlockStyle,
  selectedAnimationTargetInfo,
  updateAnimationControls,
  applySelectedAnimation,
  clearSelectedAnimation,
  initPreviewBlockSelection
} = editorSelectionApi;

function buildPreview(){
  const draftForPreview = currentDraftSlide();
  preview.innerHTML = buildSlideMarkup(draftForPreview);
  try{
    preview.setAttribute('data-lumina-preview-active-index', String(activeIndex));
    preview.setAttribute('data-lumina-preview-rendered-at', new Date().toISOString());
    const meta = draftForPreview && draftForPreview.importMeta || {};
    window.__LUMINA_STAGE43AK_PREVIEW_OWNER = { activeIndex:activeIndex, sourcePage:meta.sourcePageNumber || meta.pageNumber || meta.sourcePageIndex || null, at:new Date().toISOString() };
  }catch(_err){}
  snippetOutput.value = JSON.stringify(slideForSnippet(draftForPreview), null, 2);
  initPreviewBlockSelection();
  updatePreviewScale();
  updatePreviewGuides();
  const finalizePreview = ()=>{ fitFiguresIn(preview); initFigureInteractions(preview); updatePreviewScale(); refreshFigureToolState(); updatePreviewBlockSelectionUI(); };
  if(window.MathJax && typeof window.MathJax.typesetPromise === 'function'){
    if(typeof window.MathJax.typesetClear === 'function') window.MathJax.typesetClear([preview]);
    window.MathJax.typesetPromise([preview]).then(finalizePreview).catch(finalizePreview);
  } else {
    finalizePreview();
  }
}

function setCopilotStatus(message, isError=false){
  updateCopilotRuntime({ lastStatus: String(message || ''), lastError: isError ? String(message || '') : copilotRuntimeStatus.lastError });
  if(copilotEls.status){
    copilotEls.status.textContent = message;
    copilotEls.status.style.color = isError ? '#ffb4b4' : '';
    copilotEls.status.style.borderColor = isError ? 'rgba(255,120,120,.35)' : '';
  }
}
function loadCopilotSettings(){
  try{
    const raw = localStorage.getItem(COPILOT_SETTINGS_STORAGE);
    const s = raw ? JSON.parse(raw) : {};
    if(copilotEls.model && s.model) copilotEls.model.value = s.model;
    if(copilotEls.endpoint && s.endpoint) copilotEls.endpoint.value = s.endpoint;
    if(copilotEls.tone && s.tone) copilotEls.tone.value = s.tone;
    const key = localStorage.getItem(COPILOT_API_KEY_STORAGE);
    if(copilotEls.apiKey && key) copilotEls.apiKey.value = key;
    updateCopilotKeyWarning();
  }catch(err){ console.warn('Could not load Copilot settings', err); updateCopilotKeyWarning(); }
}
function saveCopilotSettings(saveKey=false){
  try{
    const s = {
      model: copilotEls.model?.value || 'gpt-4.1-mini',
      endpoint: copilotEls.endpoint?.value || COPILOT_DEFAULT_ENDPOINT,
      tone: copilotEls.tone?.value || 'clear and concise'
    };
    const key = (copilotEls.apiKey?.value || '').trim();
    validateCopilotApiKey(key, s.endpoint, { requireKey:false });
    localStorage.setItem(COPILOT_SETTINGS_STORAGE, JSON.stringify(s));
    if(saveKey && copilotEls.apiKey){
      if(key) localStorage.setItem(COPILOT_API_KEY_STORAGE, key);
      else localStorage.removeItem(COPILOT_API_KEY_STORAGE);
      showToast(key ? 'Saved Copilot key locally.' : 'Cleared saved Copilot key.');
    }
    updateCopilotKeyWarning();
    return true;
  }catch(err){
    const msg = recordCopilotError(err);
    console.warn('Could not save Copilot settings', err);
    setCopilotStatus(msg, true);
    updateCopilotKeyWarning();
    showToast('Copilot settings need attention.');
    return false;
  }
}
function copilotBlockSchema(){
  return {
    type:'object',
    additionalProperties:false,
    properties:{
      mode:{ type:'string', enum:['panel','plain','pseudocode','pseudocode-latex','placeholder','custom','image'] },
      title:{ type:'string', description:'Short editor-only label for the block.' },
      content:{ type:'string', description:'Slide content. For panel/plain, use generator syntax. For custom blocks, use self-contained HTML. For image blocks, use this as a short caption.' },
        assetPrompt:{ type:'string', description:'For image blocks, the prompt used to generate the image. Use an empty string for non-image blocks.' },
        assetAlt:{ type:'string', description:'For image blocks, short alt text. Use an empty string for non-image blocks.' },
        assetSize:{ type:'string', description:'For image blocks, one of wide, square, tall, 1536x1024, 1024x1024, or 1024x1536. Use an empty string for non-image blocks.' }
    },
    required:['mode','title','content','assetPrompt','assetAlt','assetSize']
  };
}
function copilotSlideSchema(){
  const block = copilotBlockSchema();
  return {
    type:'object',
    additionalProperties:false,
    properties:{
      slideType:{ type:'string', enum:['title-center','single','two-col'] },
      headingLevel:{ type:'string', enum:['h1','h2'] },
      bgColor:{ type:'string' },
      fontColor:{ type:'string' },
      inheritTheme:{ type:'boolean' },
      title:{ type:'string' },
      kicker:{ type:'string' },
      lede:{ type:'string' },
      leftBlocks:{ type:'array', items:block },
      rightBlocks:{ type:'array', items:block },
      notesTitle:{ type:'string' },
      notesBody:{ type:'string' }
    },
    required:['slideType','headingLevel','bgColor','fontColor','inheritTheme','title','kicker','lede','leftBlocks','rightBlocks','notesTitle','notesBody']
  };
}
function copilotDeckSchema(){
  return {
    type:'object',
    additionalProperties:false,
    properties:{
      deckTitle:{ type:'string' },
      summary:{ type:'string' },
      slides:{ type:'array', items:copilotSlideSchema() }
    },
    required:['deckTitle','summary','slides']
  };
}
function copilotSystemPrompt(){
  return [
    'You are a presentation copilot embedded in an HTML slide generator.',
    'Return only JSON that matches the provided schema.',
    'Create editable slide objects that work in the generator.',
    'Use only slideType values title-center, single, or two-col.',
    'Use h1 for title slides and h2 for normal slides.',
    'Set inheritTheme to true unless the user explicitly asks for custom colors.',
    'For panel/plain blocks, use this lightweight syntax: \\paragraph{Heading}, \\begin{itemize}, \\item item text, \\end{itemize}, \\begin{card}{Title}content\\end{card}.',
    'Keep each slide focused, with 1-3 content blocks. Put speaker guidance in notesBody.',
    'Return exactly one deck, never two alternate decks concatenated together. Include at most one title slide unless the user explicitly asks for multiple decks.',
    'Do not invent citations or external image-file URLs. When a figure is needed, prefer mode image with a concrete assetPrompt; the app will generate the image.',
    'For image blocks, set mode to image, put a short caption in content, a detailed generation prompt in assetPrompt, concise alt text in assetAlt, and a size hint in assetSize.',
    'When several small related visuals are needed on one slide, ask for one composite image/mosaic in a single image block instead of many separate image blocks.',
    'For demos, animations, simulations, calculators, or arbitrary HTML, use mode custom and put complete self-contained HTML/CSS/JS in content.'
  ].join('\n');
}
function compactDeckForCopilot(){
  const deck = currentDeckData();
  return {
    deckTitle: deck.deckTitle,
    theme: deck.theme,
    slideCount: deck.slides.length,
    slides: deck.slides.slice(0, 20).map((s, idx)=>({
      index: idx + 1,
      slideType: s.slideType,
      title: s.title,
      kicker: s.kicker,
      lede: s.lede,
      leftBlocks: (s.leftBlocks || []).map(b=>({ mode:b.mode, title:b.title, content:String(b.content || '').slice(0, 700) })),
      rightBlocks: (s.rightBlocks || []).map(b=>({ mode:b.mode, title:b.title, content:String(b.content || '').slice(0, 700) }))
    }))
  };
}
function deckPromptUrl(){
  const base = String(COPILOT_DECK_PROMPT_FILE || 'prompts/deck.txt').trim() || 'prompts/deck.txt';
  const version = String(window.LUMINA_STAGE || copilotRuntimeStatus.stage || 'stage34m-20260425-1');
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(version);
}
async function loadDeckPromptPrefix(){
  if(deckPromptPrefixCache !== null) return deckPromptPrefixCache;
  let fileText = '';
  let source = 'builtin-default';
  let status = 'builtin-default';
  try{
    if(typeof fetch === 'function'){
      const res = await fetch(deckPromptUrl(), { cache:'no-store' });
      if(res && res.ok){
        fileText = String(await res.text() || '').trim();
        if(fileText){
          source = COPILOT_DECK_PROMPT_FILE;
          status = 'loaded-file';
        }else{
          status = 'blank-file-used-builtin-default';
        }
      }else if(res){
        status = 'file-http-' + res.status + '-used-builtin-default';
      }
    }else{
      status = 'fetch-unavailable-used-builtin-default';
    }
  }catch(err){
    status = 'file-load-error-used-builtin-default';
    updateCopilotRuntime({ deckPromptLastError: (err && err.message) || String(err) });
  }
  deckPromptPrefixCache = fileText || COPILOT_DEFAULT_DECK_PROMPT_PREFIX;
  updateCopilotRuntime({
    deckPromptFile: COPILOT_DECK_PROMPT_FILE,
    deckPromptSource: source,
    deckPromptStatus: status,
    deckPromptAppliesTo: 'deck-only',
    deckPromptLoadedAt: new Date().toISOString()
  });
  return deckPromptPrefixCache;
}

function parseCopilotDeckSpecText(rawText){
  const text = safeString(rawText || '').trim();
  if(!text) throw new Error('Paste or upload a deck spec/outline first.');
  try{
    const parsed = JSON.parse(text);
    if(parsed && typeof parsed === 'object'){
      const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
      const targetFromJson = Number(parsed.targetSlideCount || parsed.slideCount || parsed.slidesCount || rawSlides.length || 0);
      const jsonPlan = {
        mode:'deck-spec', sourceFormat:'json', deckTitle:safeString(parsed.deckTitle || parsed.title || ''),
        targetSlideCount:Number.isFinite(targetFromJson) && targetFromJson > 0 ? Math.min(30, Math.max(1, targetFromJson)) : (rawSlides.length || null),
        themeHint:safeString(parsed.themeHint || parsed.theme || parsed.style || ''), operation:safeString(parsed.operation || 'generateDeck'),
        rawText:text, slides:rawSlides, globalInstructions:Array.isArray(parsed.globalInstructions) ? parsed.globalInstructions : []
      };
      updateCopilotRuntime({ lastDeckSpecStatus:'parsed-json', lastDeckSpecSlideCount:jsonPlan.targetSlideCount || 0 });
      return jsonPlan;
    }
  }catch(_){ }
  const plan = { mode:'deck-spec', sourceFormat:'text/markdown', deckTitle:'', targetSlideCount:null, themeHint:'', operation:'generateDeck', rawText:text, slides:[], globalInstructions:[], warnings:[] };
  const lines = text.replace(/\r\n?/g,'\n').split('\n');
  let current = null;
  let activeRequirement = null;
  let activeField = '';
  function clean(s){ return safeString(s).replace(/^[-*•]\s*/, '').trim(); }
  function ensureSlide(title){
    if(!current){ current = { rangeStart:plan.slides.length + 1, rangeEnd:plan.slides.length + 1, title:title || '', content:[], figures:[], demos:[], instructions:[], topics:[] }; plan.slides.push(current); }
    return current;
  }
  function addRequirement(kind, value){
    const s = ensureSlide('');
    const req = kind === 'demo'
      ? { kind:'customHtmlDemo', prompt:clean(value || ''), requirement:'Create a self-contained HTML/CSS/JS custom block for this demo or animation.' }
      : { kind:'image', prompt:clean(value || ''), size:'wide', requirement:'Create a generated-image block with assetPrompt and alt text.' };
    if(kind === 'demo') s.demos.push(req); else s.figures.push(req);
    activeRequirement = req; activeField = kind; return req;
  }
  function expandNextSlides(count, topic){
    const start = plan.slides.reduce((m,s)=>Math.max(m, Number(s.rangeEnd || s.rangeStart || 0)), 0) + 1;
    const s = { rangeStart:start, rangeEnd:start + count - 1, title:topic || 'Additional topic slides', content:[], figures:[], demos:[], instructions:['Expand this range into ' + count + ' individual slides.'], topics: topic ? [topic] : [] };
    plan.slides.push(s); current=s; activeRequirement=null; activeField='instructions';
  }
  lines.forEach(rawLine=>{
    const line = safeString(rawLine).trim(); if(!line) return;
    let m;
    if((m=line.match(/^#\s*Deck\s*:\s*(.+)$/i)) || (m=line.match(/^Deck\s*:\s*(.+)$/i))){ plan.deckTitle=clean(m[1]); activeField=''; return; }
    if((m=line.match(/^Slides?\s*:\s*(\d+)\s*$/i))){ plan.targetSlideCount=Math.max(1, Math.min(30, Number(m[1]))); activeField=''; return; }
    if((m=line.match(/^(?:Style|Theme)\s*:\s*(.+)$/i))){ plan.themeHint=clean(m[1]); activeField=''; return; }
    if((m=line.match(/^(?:Operation|Mode)\s*:\s*(.+)$/i))){ plan.operation=clean(m[1]) || plan.operation; activeField=''; return; }
    if((m=line.match(/add\s+(?:the\s+)?next\s+(\d+)\s+slides?\s+(?:on|about)\s+(.+)$/i))){ expandNextSlides(Math.max(1, Math.min(12, Number(m[1]))), clean(m[2])); return; }
    if((m=line.match(/^#{1,4}\s*Slide\s+(\d+)\s*(?:[-–]\s*(\d+))?\s*:?\s*(.*)$/i)) || (m=line.match(/^Slide\s+(\d+)\s*(?:[-–]\s*(\d+))?\s*:?\s*(.*)$/i))){
      current = { rangeStart:Number(m[1]), rangeEnd:Number(m[2] || m[1]), title:clean(m[3] || ''), content:[], figures:[], demos:[], instructions:[], topics:[] };
      plan.slides.push(current); activeRequirement=null; activeField='content'; return;
    }
    if((m=line.match(/^#{2,4}\s*(.+)$/)) && !/^#{1,4}\s*Slide\s+/i.test(line)){ current={ rangeStart:plan.slides.length + 1, rangeEnd:plan.slides.length + 1, title:clean(m[1]), content:[], figures:[], demos:[], instructions:[], topics:[] }; plan.slides.push(current); activeRequirement=null; activeField='content'; return; }
    if((m=line.match(/^Content\s*:\s*(.*)$/i))){ ensureSlide(''); activeField='content'; if(clean(m[1])) current.content.push(clean(m[1])); return; }
    if((m=line.match(/^Instruction\s*:\s*(.*)$/i))){ ensureSlide(''); activeField='instructions'; if(clean(m[1])) current.instructions.push(clean(m[1])); activeRequirement=null; return; }
    if((m=line.match(/^Topics?\s*:\s*(.*)$/i))){ ensureSlide(''); activeField='topics'; if(clean(m[1])) current.topics.push(clean(m[1])); activeRequirement=null; return; }
    if((m=line.match(/^Figure\s*:\s*(.*)$/i)) || (m=line.match(/^Image\s*:\s*(.*)$/i))){ addRequirement('figure', m[1] || ''); return; }
    if((m=line.match(/^Demo\s*:\s*(.*)$/i)) || (m=line.match(/^HTML\s*Demo\s*:\s*(.*)$/i))){ addRequirement('demo', m[1] || ''); return; }
    if((m=line.match(/^Prompt\s*:\s*(.*)$/i))){ if(activeRequirement) activeRequirement.prompt=[activeRequirement.prompt, clean(m[1])].filter(Boolean).join(' '); else ensureSlide('').instructions.push('Prompt: ' + clean(m[1])); return; }
    if((m=line.match(/^Size\s*:\s*(.*)$/i))){ if(activeRequirement && activeRequirement.kind === 'image') activeRequirement.size=clean(m[1]) || 'wide'; return; }
    if((m=line.match(/^Type\s*:\s*(.*)$/i))){ ensureSlide('').slideTypeHint=clean(m[1]); return; }
    const item = clean(line); if(!item) return; ensureSlide('');
    if(activeRequirement && (activeField === 'figure' || activeField === 'demo')) activeRequirement.prompt=[activeRequirement.prompt, item].filter(Boolean).join(' ');
    else if(activeField === 'topics') current.topics.push(item);
    else if(activeField === 'instructions') current.instructions.push(item);
    else current.content.push(item);
  });
  plan.slides = plan.slides.map((s, idx)=>{ const start=Number(s.rangeStart || idx + 1); const end=Math.max(start, Number(s.rangeEnd || start)); return Object.assign({}, s, { rangeStart:start, rangeEnd:end, requiredBlocks:[].concat(s.figures || [], s.demos || []) }); });
  const maxSlide = plan.slides.reduce((m,s)=>Math.max(m, Number(s.rangeEnd || s.rangeStart || 0)), 0);
  if(!plan.targetSlideCount) plan.targetSlideCount = maxSlide || Math.max(1, Math.min(30, plan.slides.length || 6));
  if(!plan.deckTitle){ const titleLine=lines.map(l=>l.trim()).find(l=>/^#\s+/.test(l) && !/^#\s*Slide/i.test(l)); plan.deckTitle = titleLine ? clean(titleLine.replace(/^#+\s*/,'')) : ''; }
  if(!plan.slides.length) plan.globalInstructions.push('Treat the raw text as a complete deck outline/specification. Preserve slide order and all requested figures/demos.');
  updateCopilotRuntime({ lastDeckSpecStatus:'parsed-text', lastDeckSpecSlideCount:plan.targetSlideCount || 0, lastDeckSpecParsedSlides:plan.slides.length });
  return plan;
}
function getCopilotDeckSpecText(){ return safeString(copilotEls.specText && copilotEls.specText.value || '').trim(); }
function setCopilotDeckSpecText(text){ if(copilotEls.specText) copilotEls.specText.value = safeString(text || ''); }
function summarizeCopilotDeckSpec(plan){ const slideSpecs=Array.isArray(plan && plan.slides) ? plan.slides : []; const figures=slideSpecs.reduce((n,s)=>n + ((s.figures || []).length), 0); const demos=slideSpecs.reduce((n,s)=>n + ((s.demos || []).length), 0); return 'Deck spec parsed: ' + (plan.targetSlideCount || slideSpecs.length || '?') + ' target slides, ' + slideSpecs.length + ' slide specs, ' + figures + ' figures, ' + demos + ' demos.'; }
function normalizeCopilotReferenceUrls(raw){
  return safeString(raw || '')
    .split(/\n+/)
    .map(s=>s.trim())
    .filter(Boolean)
    .filter((value, idx, arr)=>arr.indexOf(value) === idx);
}
function isLikelyPdfReferenceUrl(url){ return /\.pdf(?:$|[?#])/i.test(safeString(url || '')); }
function getCopilotReferenceText(){ return safeString(copilotEls.referenceText && copilotEls.referenceText.value || '').trim(); }
function setCopilotReferenceText(text, append=false){
  if(!copilotEls.referenceText) return;
  const incoming = safeString(text || '').trim();
  if(!append){ copilotEls.referenceText.value = incoming; return; }
  const existing = safeString(copilotEls.referenceText.value || '').trim();
  copilotEls.referenceText.value = [existing, incoming].filter(Boolean).join('\n\n');
}
function getCopilotReferenceUrls(){ return normalizeCopilotReferenceUrls(copilotEls.referenceUrls && copilotEls.referenceUrls.value || ''); }
function setCopilotReferenceUrls(text){ if(copilotEls.referenceUrls) copilotEls.referenceUrls.value = safeString(text || ''); }
function setCopilotReferencePdfFiles(files, append=false){
  const incoming = Array.isArray(files) ? files.map((file, idx)=>({
    filename: safeString(file && (file.filename || file.name) || ('reference-' + (idx + 1) + '.pdf')),
    file_data: safeString(file && file.file_data || ''),
    bytes: Number(file && file.bytes || 0) || 0
  })).filter(file=>file.file_data) : [];
  copilotReferencePdfFiles = append ? copilotReferencePdfFiles.concat(incoming) : incoming;
  const seen = new Set();
  copilotReferencePdfFiles = copilotReferencePdfFiles.filter(file=>{
    const key = file.filename + ':' + file.bytes + ':' + file.file_data.slice(0, 32);
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  updateCopilotRuntime({ referencePdfFileCount: copilotReferencePdfFiles.length, referencePdfBytes: copilotReferencePdfFiles.reduce((n,file)=>n + (Number(file.bytes)||0), 0) });
}
function getCopilotReferencePdfFiles(){ return copilotReferencePdfFiles.slice(); }
function getCopilotReferenceMaterial(){
  const urls = getCopilotReferenceUrls();
  const text = getCopilotReferenceText();
  const pdfFiles = getCopilotReferencePdfFiles();
  const pdfUrls = urls.filter(isLikelyPdfReferenceUrl);
  const maxChars = 70000;
  const clipped = text.length > maxChars ? text.slice(0, maxChars) + '\n\n[Reference text truncated to ' + maxChars + ' characters by Lumina before sending to Copilot.]' : text;
  return {
    hasAny: !!(urls.length || clipped.trim() || pdfFiles.length),
    urls,
    pdfUrls,
    pdfFiles,
    text: clipped,
    originalTextLength: text.length,
    truncated: text.length > maxChars,
    pdfBytes: pdfFiles.reduce((n,file)=>n + (Number(file.bytes)||0), 0)
  };
}
function summarizeCopilotReferences(){
  const refs = getCopilotReferenceMaterial();
  const parts = [];
  parts.push(refs.urls.length + ' URL' + (refs.urls.length === 1 ? '' : 's'));
  parts.push(refs.originalTextLength + ' reference text characters');
  parts.push(refs.pdfFiles.length + ' uploaded PDF' + (refs.pdfFiles.length === 1 ? '' : 's'));
  if(refs.pdfUrls.length) parts.push(refs.pdfUrls.length + ' PDF URL' + (refs.pdfUrls.length === 1 ? '' : 's'));
  if(refs.truncated) parts.push('text will be truncated in the API prompt');
  return 'Reference material: ' + parts.join(', ') + '. PDFs are attached directly when using the default OpenAI Responses endpoint.';
}
function appendCopilotPdfReferenceInputs(content, endpoint){
  const refs = getCopilotReferenceMaterial();
  if(!refs.pdfFiles.length && !refs.pdfUrls.length) return { attached:0, skipped:0 };
  if(!isDefaultOpenAiEndpoint(endpoint)) return { attached:0, skipped:refs.pdfFiles.length + refs.pdfUrls.length };
  refs.pdfFiles.forEach(file=>{
    content.push({ type:'input_file', filename:file.filename || 'reference.pdf', file_data:file.file_data });
  });
  refs.pdfUrls.forEach(url=>{
    content.push({ type:'input_file', file_url:url });
  });
  return { attached:refs.pdfFiles.length + refs.pdfUrls.length, skipped:0 };
}

async function buildCopilotUserPrompt(kind, deckSpecPlan){
  const prompt = (copilotEls.prompt?.value || '').trim();
  const isSpecMode = kind === 'deck-spec';
  if(!prompt && !isSpecMode) throw new Error('Tell Copilot what to create first.');
  const specCount = deckSpecPlan && Number(deckSpecPlan.targetSlideCount || 0);
  const count = Math.max(1, Math.min(30, Number(specCount || copilotEls.slideCount?.value || 1)));
  const tone = copilotEls.tone?.value || 'clear and concise';
  const mode = isSpecMode ? 'Create a complete deck from the parsed DeckPlan specification.' : (kind === 'deck' ? 'Create a complete deck.' : 'Create exactly one slide.');
  const parts = [mode];
  if(kind === 'deck' || isSpecMode){
    const deckPromptPrefix = await loadDeckPromptPrefix();
    if(deckPromptPrefix) parts.push('Deck prompt file instructions (from prompts/deck.txt, or built-in fallback if missing/blank):\n' + deckPromptPrefix);
  }
  if(isSpecMode && deckSpecPlan){
    parts.push(
      'Parsed DeckPlan JSON. This is the source of truth for the requested deck. Satisfy every slide range, topic, figure requirement, and demo requirement:',
      JSON.stringify(deckSpecPlan, null, 2),
      'Hard DeckPlan rules:',
      '- Expand slide ranges such as Slide 4-6 into separate slides while staying at the target slide count.',
      '- Every requiredBlocks item with kind=image must become a mode image block with assetPrompt, assetAlt, and assetSize.',
      '- Every requiredBlocks item with kind=customHtmlDemo must become a mode custom block with self-contained HTML/CSS/JS in content.',
      '- Do not replace required demos or figures with placeholders unless the spec explicitly says placeholder.',
      '- Preserve the requested order of slides and topics. Do not add a second alternate deck.'
    );
  }
  const referenceMaterial = getCopilotReferenceMaterial();
  if(referenceMaterial.hasAny){
    parts.push(
      'Reference material supplied by the user. Use this as grounding/source material for the deck. Prioritize it over generic background knowledge. Do not invent facts that conflict with it.',
      referenceMaterial.urls.length ? ('Reference URLs to use, in order:\n' + referenceMaterial.urls.map((url, idx)=>(idx + 1) + '. ' + url).join('\n')) : 'Reference URLs: none',
      referenceMaterial.pdfFiles.length ? ('Uploaded PDF reference files attached to this request: ' + referenceMaterial.pdfFiles.map(file=>file.filename).join(', ')) : 'Uploaded PDF reference files: none',
      referenceMaterial.pdfUrls.length ? ('PDF reference URLs attached as file inputs: ' + referenceMaterial.pdfUrls.join(', ')) : 'PDF reference URLs attached as file inputs: none',
      referenceMaterial.text ? ('Uploaded/pasted reference text:\n' + referenceMaterial.text) : 'Uploaded/pasted reference text: none',
      'Reference material rules: preserve the important definitions, examples, notation, claims, figures, examples, and ordering from the supplied references; use attached PDFs as source documents when present; use web search for listed non-PDF URLs when available; mention in summary if URL content could not be accessed.'
    );
  }
  parts.push(
    'User request: ' + (prompt || '(Follow the uploaded/pasted DeckPlan exactly.)'),
    'Target slide count: ' + (kind === 'slide' ? 1 : count),
    'Do not exceed the target slide count. Do not append a second alternative deck after the first deck.',
    'Tone/style: ' + tone,
    collectCopilotStyleContext(),
    'Current deck context JSON:',
    JSON.stringify(compactDeckForCopilot(), null, 2),
    'Important: output JSON with deckTitle, summary, and slides. For single-slide requests, slides must contain exactly one slide.'
  );
  return parts.join('\n\n');
}

function extractResponsesOutputText(data){
  if(data && typeof data.output_text === 'string') return data.output_text;
  const parts = [];
  (data?.output || []).forEach(item=>{
    (item.content || []).forEach(c=>{
      if(typeof c.text === 'string') parts.push(c.text);
      else if(typeof c.output_text === 'string') parts.push(c.output_text);
    });
  });
  return parts.join('\n').trim();
}


function safeString(value){ return String(value == null ? '' : value); }
function collectCopilotStyleContext(){
  const lines = [];
  try{
    const deck = typeof deps !== 'undefined' && typeof deps.currentDeckData === 'function' ? deps.currentDeckData() : (typeof currentDeckData === 'function' ? currentDeckData() : {});
    const theme = deck && deck.theme ? deck.theme : {};
    const activeSlides = typeof deps !== 'undefined' && typeof deps.getSlides === 'function' ? deps.getSlides() : (typeof slides !== 'undefined' ? slides : []);
    const activeIdx = typeof deps !== 'undefined' && typeof deps.getActiveIndex === 'function' ? deps.getActiveIndex() : (typeof activeIndex !== 'undefined' ? activeIndex : -1);
    const currentSlide = activeIdx >= 0 && activeSlides && activeSlides[activeIdx] ? activeSlides[activeIdx] : null;
    lines.push('Presentation style context:');
    lines.push('Deck title: ' + safeString(deck && deck.deckTitle || fields.deckTitle?.value || 'Untitled presentation'));
    if(theme && typeof theme === 'object'){
      lines.push('Theme style: ' + safeString(theme.style || theme.name || 'default'));
      lines.push('Theme accent color: ' + safeString(theme.accentColor || theme.accent || theme.primary || ''));
      lines.push('Theme background: ' + safeString(theme.bgColor || theme.background || ''));
      lines.push('Theme font color: ' + safeString(theme.fontColor || theme.textColor || ''));
    }
    if(currentSlide){
      lines.push('Current slide title: ' + safeString(currentSlide.title || ''));
      lines.push('Current slide type: ' + safeString(currentSlide.slideType || ''));
      lines.push('Current slide background: ' + safeString(currentSlide.bgColor || ''));
      lines.push('Current slide font color: ' + safeString(currentSlide.fontColor || ''));
    }
  }catch(err){
    lines.push('Presentation style context unavailable: ' + ((err && err.message) || safeString(err)));
  }
  return lines.join('\n');
}
function collectCopilotCssText(){
  const pieces = [];
  try{
    Array.from(document.styleSheets || []).forEach(sheet=>{
      try{ Array.from(sheet.cssRules || []).forEach(rule=>pieces.push(rule.cssText)); }catch(_){ }
    });
  }catch(_){ }
  return pieces.join('\n');
}
async function captureCopilotStyleScreenshot(){
  try{
    const previewRoot = document.getElementById('preview');
    const node = previewRoot && (previewRoot.querySelector('.slide') || previewRoot.firstElementChild);
    if(!node || typeof XMLSerializer === 'undefined'){
      updateCopilotRuntime({ styleScreenshotStatus:'unavailable' });
      return '';
    }
    const rect = node.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || node.offsetWidth || 960));
    const height = Math.max(1, Math.round(rect.height || node.offsetHeight || 540));
    const clone = node.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    const markup = new XMLSerializer().serializeToString(clone);
    const cssText = collectCopilotCssText();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style><![CDATA[' + cssText + ']]></style>' + markup + '</div></foreignObject></svg>';
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const dataUrl = await new Promise(resolve=>{
      img.onload = ()=>{
        try{ ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/png')); }
        catch(_){ resolve(''); }
      };
      img.onerror = ()=>resolve('');
      img.src = url;
    });
    updateCopilotRuntime({ styleScreenshotStatus:dataUrl ? 'attached' : 'capture-failed', lastStyleScreenshotAt:new Date().toISOString() });
    return dataUrl;
  }catch(err){
    updateCopilotRuntime({ styleScreenshotStatus:'capture-error', styleScreenshotError:(err && err.message) || safeString(err) });
    return '';
  }
}
function copilotEscapeAttr(value){
  return safeString(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
function deriveCopilotImagesEndpoint(endpoint){
  try{
    const url = new URL(endpoint || COPILOT_DEFAULT_ENDPOINT, (typeof location !== 'undefined' && location.href) || 'https://example.invalid/');
    const path = url.pathname || '/v1/responses';
    if(/\/responses\/?$/i.test(path)) url.pathname = path.replace(/\/responses\/?$/i, '/images/generations');
    else if(/\/chat\/completions\/?$/i.test(path)) url.pathname = path.replace(/\/chat\/completions\/?$/i, '/images/generations');
    else if(/\/v\d+\/?$/i.test(path)) url.pathname = path.replace(/\/?$/, '/images/generations');
    else url.pathname = path.replace(/\/$/, '') + '/images/generations';
    url.search = '';
    return url.toString();
  }catch(_){
    return 'https://api.openai.com/v1/images/generations';
  }
}
function copilotImageSizeHint(value){
  const hint = safeString(value).toLowerCase();
  if(hint.includes('square') || hint.includes('1024x1024')) return '1024x1024';
  if(hint.includes('tall') || hint.includes('portrait') || hint.includes('1024x1536')) return '1024x1536';
  return '1536x1024';
}
function buildCopilotFigureHtml(src, alt){
  return '<figure data-figure-kind="image" data-box-x="0" data-box-y="0" data-box-w="" data-box-h="" data-original-w="" data-original-h="" data-lock-aspect="1" data-user-moved="0" data-user-sized="0" data-crop="0" data-z-index="1" data-object-fit="contain"><img src="' + copilotEscapeAttr(src) + '" alt="' + copilotEscapeAttr(alt || 'Generated image') + '" /></figure>';
}
function materializeCopilotImageBlock(block, src){
  const caption = safeString(block.content || '').trim();
  return {
    mode:'plain',
    title:block.title || 'Generated image',
    content:'\\begin{figurehtml}\n' + buildCopilotFigureHtml(src, block.assetAlt || block.title || 'Generated image') + '\n\\end{figurehtml}' + (caption ? ('\n\n' + caption) : '')
  };
}
function materializeCopilotImageFallback(block, reason){
  const prompt = safeString(block.assetPrompt || block.content || block.title).trim();
  return {
    mode:'placeholder',
    title:block.title || 'Image placeholder',
    content:'Image requested but automatic generation failed. Prompt: ' + prompt + (reason ? ('\nReason: ' + reason) : '')
  };
}
async function generateCopilotImageAsset(block, endpoint, apiKey, slide){
  const imageFetch = (typeof fetchImpl === 'function') ? fetchImpl : (typeof fetch === 'function' ? fetch.bind(window) : null);
  if(!imageFetch) throw new Error('Fetch is unavailable for image generation.');
  const prompt = safeString(block.assetPrompt || block.content || block.title).trim();
  if(!prompt) throw new Error('Image block is missing assetPrompt.');
  const headers = { 'Content-Type':'application/json' };
  if(apiKey) headers.Authorization = 'Bearer ' + apiKey;
  const body = {
    model:'gpt-image-1',
    prompt:[
      'Create an original slide image. Match the presentation style and avoid dense embedded text unless explicitly requested.',
      collectCopilotStyleContext(),
      slide && slide.title ? ('Slide title: ' + slide.title) : '',
      'Image request: ' + prompt
    ].filter(Boolean).join('\n'),
    size: copilotImageSizeHint(block.assetSize || (slide && slide.slideType === 'two-col' ? 'square' : 'wide'))
  };
  const res = await imageFetch(deriveCopilotImagesEndpoint(endpoint), { method:'POST', headers, body:JSON.stringify(body) });
  const raw = await res.text();
  let data;
  try{ data = raw ? JSON.parse(raw) : {}; }catch(_){ data = { raw }; }
  if(!res.ok){
    const message = data?.error?.message || raw || ('Image generation failed with status ' + res.status);
    throw new Error(friendlyCopilotHttpError(res.status, message));
  }
  const first = data && Array.isArray(data.data) ? data.data[0] : null;
  const firstOutput = data && Array.isArray(data.output) ? data.output[0] : null;
  const imagePayload = firstOutput && Array.isArray(firstOutput.content)
    ? firstOutput.content.find(item => item && (item.type === 'output_image' || item.b64_json || item.image_base64 || item.base64 || item.url))
    : null;
  const b64 = (first && (first.b64_json || first.base64 || first.image_base64))
    || (imagePayload && (imagePayload.b64_json || imagePayload.base64 || imagePayload.image_base64))
    || (firstOutput && (firstOutput.b64_json || firstOutput.base64 || firstOutput.image_base64));
  const url = (first && first.url) || (imagePayload && imagePayload.url) || (firstOutput && firstOutput.url);
  if(b64) return 'data:image/png;base64,' + b64;
  if(url) return safeString(url);
  throw new Error('Image generation returned no usable image payload.');
}
function normalizeCopilotCustomBlock(block){
  if(!block || block.mode !== 'custom') return block;
  const raw = safeString(block.content || '').trim();
  if(/<html[\s>]/i.test(raw) || /<!DOCTYPE/i.test(raw) || !raw) return block;
  return Object.assign({}, block, {
    content:'<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}*{box-sizing:border-box}body{min-height:100vh}</style></head><body>' + raw + '</body></html>'
  });
}
async function enrichCopilotDeckAssets(rawDeck, endpoint, apiKey){
  const deck = rawDeck && typeof rawDeck === 'object' ? rawDeck : {};
  const deckSlides = Array.isArray(deck.slides) ? deck.slides : [];
  const pending = [];
  deckSlides.forEach((slide)=>{
    ['leftBlocks','rightBlocks'].forEach(column=>{
      const arr = Array.isArray(slide[column]) ? slide[column] : [];
      arr.forEach((block, blockIndex)=>{
        if(block && block.mode === 'custom') arr[blockIndex] = normalizeCopilotCustomBlock(block);
        if(block && block.mode === 'image') pending.push({ slide, column, blockIndex, block });
      });
    });
  });
  if(!pending.length) return deck;
  const totalImages = pending.length;
  updateCopilotRuntime({ requestedGeneratedImages:pending.length, generatedImagesPlanned:totalImages });
  for(let i=0; i<pending.length; i+=1){
    const item = pending[i];
    setCopilotStatus('Generating image ' + (i + 1) + ' of ' + totalImages + '…');
    try{
      const src = await generateCopilotImageAsset(item.block, endpoint, apiKey, item.slide);
      item.slide[item.column][item.blockIndex] = materializeCopilotImageBlock(item.block, src);
    }catch(err){
      item.slide[item.column][item.blockIndex] = materializeCopilotImageFallback(item.block, (err && err.message) || safeString(err));
    }
  }
  return deck;
}

async function callCopilot(kind, deckSpecPlan){
  saveCopilotSettings(false);
  const endpoint = (copilotEls.endpoint?.value || '').trim() || COPILOT_DEFAULT_ENDPOINT;
  const apiKey = (copilotEls.apiKey?.value || '').trim();
  const model = (copilotEls.model?.value || '').trim() || 'gpt-4.1-mini';
  validateCopilotApiKey(apiKey, endpoint, { requireKey: isDefaultOpenAiEndpoint(endpoint) });
  updateCopilotKeyWarning();
  const headers = { 'Content-Type':'application/json' };
  if(apiKey) headers.Authorization = 'Bearer ' + apiKey;
  const userPrompt = await buildCopilotUserPrompt(kind, deckSpecPlan);
  callCopilot._styleScreenshot = await captureCopilotStyleScreenshot();
  const body = {
    model,
    input:[
      { role:'system', content: copilotSystemPrompt() },
      { role:'user', content: (function(){
        const content = [{ type:'input_text', text:userPrompt }];
        if(callCopilot._styleScreenshot){
          content.push({ type:'input_text', text:'The next image is a screenshot of the current slide preview. Use it only as visual style context.' });
          content.push({ type:'input_image', image_url:callCopilot._styleScreenshot });
        }
        const pdfAttachStatus = appendCopilotPdfReferenceInputs(content, endpoint);
        callCopilot._pdfAttachStatus = pdfAttachStatus;
        if(pdfAttachStatus.skipped){
          content.push({ type:'input_text', text:'PDF references were uploaded but not attached because the current endpoint is not the default OpenAI Responses endpoint. Use pasted text or the default OpenAI endpoint for direct PDF input.' });
        }
        return content;
      })() }
    ],
    text:{ format:{ type:'json_schema', name:'presentation_deck', schema:copilotDeckSchema(), strict:true } },
    store:false
  };
  const referenceMaterialForSearch = getCopilotReferenceMaterial();
  const shouldUseRefsWebSearch = !!(copilotEls.webSearch && copilotEls.webSearch.checked && isDefaultOpenAiEndpoint(endpoint) && referenceMaterialForSearch.urls.length && (kind === 'deck' || kind === 'deck-spec'));
  if(shouldUseRefsWebSearch){
    body.tools = [{ type:'web_search' }];
    body.tool_choice = 'auto';
  }
  updateCopilotRuntime({ referenceUrlCount: referenceMaterialForSearch.urls.length, referencePdfUrlCount: referenceMaterialForSearch.pdfUrls.length, referencePdfFileCount: referenceMaterialForSearch.pdfFiles.length, referencePdfBytes: referenceMaterialForSearch.pdfBytes, referencePdfInputsAttached: callCopilot._pdfAttachStatus ? callCopilot._pdfAttachStatus.attached : 0, referencePdfInputsSkipped: callCopilot._pdfAttachStatus ? callCopilot._pdfAttachStatus.skipped : 0, referenceTextChars: referenceMaterialForSearch.originalTextLength, referenceTextTruncated: !!referenceMaterialForSearch.truncated, webSearchEnabled: shouldUseRefsWebSearch, webSearchStatus: shouldUseRefsWebSearch ? 'enabled-reference-urls' : (referenceMaterialForSearch.urls.length ? 'reference-urls-without-web-search' : 'no-reference-urls') });
  setCopilotStatus(kind === 'deck' ? 'Generating deck…' : 'Generating slide…');
  updateCopilotRuntime({ requestInFlight:true, requestCount: copilotRuntimeStatus.requestCount + 1, lastError:'' });
  const res = await fetch(endpoint, { method:'POST', headers, body:JSON.stringify(body) });
  const raw = await res.text();
  let data;
  try{ data = raw ? JSON.parse(raw) : {}; }catch(err){ data = { raw }; }
  if(!res.ok){
    const message = data?.error?.message || raw || ('Copilot request failed with status ' + res.status);
    throw new Error(friendlyCopilotHttpError(res.status, message));
  }
  const output = extractResponsesOutputText(data);
  if(!output) throw new Error('Copilot returned an empty response.');
  let parsed;
  try{ parsed = JSON.parse(output); }
  catch(err){ throw new Error('Copilot returned text that was not valid JSON: ' + output.slice(0, 300)); }
  const enriched = await enrichCopilotDeckAssets(parsed, endpoint, apiKey);
  const normalized = normalizeCopilotDeck(enriched, kind, deckSpecPlan);
  copilotEls.resultJson.value = JSON.stringify(normalized, null, 2);
  const successMessage = (normalized.summary || 'Copilot generated slides.') + ' Ready to apply.';
  setCopilotStatus(successMessage);
  recordCopilotSuccess(successMessage);
  return normalized;
}
function normalizeCopilotDeck(deck, kind='deck', deckSpecPlan=null){
  const rawSlides = Array.isArray(deck?.slides) ? deck.slides : [];
  if(!rawSlides.length) throw new Error('Copilot did not return any slides.');
  const normalizedSlides = rawSlides.map(normalizeCopilotSlide);
  const specCount = deckSpecPlan && Number(deckSpecPlan.targetSlideCount || 0);
  const requestedCount = Math.max(1, Math.min(30, Number(specCount || copilotEls.slideCount?.value || normalizedSlides.length || 1)));
  const deckSlides = normalizedSlides.slice(0, requestedCount);
  if((kind === 'deck' || kind === 'deck-spec') && normalizedSlides.length > deckSlides.length){
    updateCopilotRuntime({ trimmedReturnedSlides: normalizedSlides.length - deckSlides.length, requestedSlideCount: requestedCount });
  }
  return {
    deckTitle: String(deck?.deckTitle || (deckSpecPlan && deckSpecPlan.deckTitle) || fields.deckTitle.value || 'Generated presentation'),
    summary: String(deck?.summary || (deckSpecPlan ? 'Generated from deck specification.' : '')),
    slides: kind === 'slide' ? normalizedSlides.slice(0, 1) : deckSlides
  };
}
function normalizeCopilotSlide(slide){
  const s = normalizeSlide(slide || {});
  if(!['title-center','single','two-col'].includes(s.slideType)) s.slideType = 'single';
  s.headingLevel = ['h1','h2'].includes(s.headingLevel) ? s.headingLevel : (s.slideType === 'title-center' ? 'h1' : 'h2');
  s.bgColor = s.bgColor || '#ffffff';
  s.fontColor = s.fontColor || '#111111';
  s.inheritTheme = s.inheritTheme !== false;
  s.title = s.title || 'Untitled slide';
  s.kicker = s.kicker || '';
  s.lede = s.lede || '';
  s.leftBlocks = Array.isArray(s.leftBlocks) ? s.leftBlocks.map(normalizeBlock) : [];
  s.rightBlocks = s.slideType === 'two-col' && Array.isArray(s.rightBlocks) ? s.rightBlocks.map(normalizeBlock) : [];
  if(s.slideType === 'title-center'){
    s.leftBlocks = [];
    s.rightBlocks = [];
  }
  s.notesTitle = s.notesTitle || 'Speaker notes';
  s.notesBody = s.notesBody || '';
  return s;
}
function parseCopilotResult(){
  const raw = (copilotEls.resultJson?.value || '').trim();
  if(!raw) throw new Error('No Copilot result to apply yet.');
  return normalizeCopilotDeck(JSON.parse(raw), 'deck');
}
function applyCopilotFirstSlide(deck){
  const payload = deck || parseCopilotResult();
  const slide = payload.slides[0];
  if(!slide) throw new Error('No slide found in Copilot result.');
  applySlideToForm(slide);
  if(activeIndex >= 0 && activeIndex < slides.length){
    slides[activeIndex] = slide;
  }
  buildPreview();
  renderDeckList();
  scheduleAutosave('Autosaved after Copilot slide apply.');
  showToast('Applied Copilot slide.');
}
function appendCopilotSlides(deck){
  const payload = deck || parseCopilotResult();
  const newSlides = payload.slides.map(normalizeCopilotSlide);
  if(!newSlides.length) throw new Error('No slides found in Copilot result.');
  slides = (slides.length ? slides : []).concat(newSlides);
  activeIndex = slides.length - newSlides.length;
  applySlideToForm(slides[activeIndex]);
  buildPreview();
  renderDeckList();
  scheduleAutosave('Autosaved after appending Copilot slides.');
  showToast('Appended Copilot slides.');
}
function replaceDeckWithCopilot(deck){
  const payload = deck || parseCopilotResult();
  const newSlides = payload.slides.map(normalizeCopilotSlide);
  if(!newSlides.length) throw new Error('No slides found in Copilot result.');
  fields.deckTitle.value = payload.deckTitle || fields.deckTitle.value;
  slides = newSlides;
  activeIndex = 0;
  applySlideToForm(slides[0]);
  buildPreview();
  renderDeckList();
  persistAutosaveNow('Autosaved after replacing deck with Copilot result.');
  showToast('Replaced deck with Copilot result.');
}
let copilotGenerationInFlight = false;
function setCopilotGenerationButtonsBusy(isBusy){
  ['copilotDraftSlideBtn','copilotAddSlideBtn','copilotGenerateDeckBtn','copilotGenerateSpecDeckBtn'].forEach(id=>{
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.dataset.copilotBusy = isBusy ? '1' : '0';
    btn.disabled = !!isBusy;
    btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  });
}
async function withCopilotGenerationLock(label, task){
  if(copilotGenerationInFlight || copilotRuntimeStatus.requestInFlight){
    setCopilotStatus('Copilot is already generating. Wait for the current request to finish before starting another.', true);
    return null;
  }
  copilotGenerationInFlight = true;
  setCopilotGenerationButtonsBusy(true);
  updateCopilotRuntime({ activeGenerationAction: label || 'generation', requestInFlight:true });
  try{
    return await task();
  }finally{
    copilotGenerationInFlight = false;
    setCopilotGenerationButtonsBusy(false);
    updateCopilotRuntime({ activeGenerationAction:'', requestInFlight:false });
  }
}
async function generateCopilotSlide(applyMode){
  return withCopilotGenerationLock('slide', async ()=>{
    try{
      const deck = await callCopilot('slide');
      if(applyMode === 'append') appendCopilotSlides(deck);
      else applyCopilotFirstSlide(deck);
    }catch(err){
      console.error(err);
      const msg = recordCopilotError(err);
      setCopilotStatus(msg, true);
      alert(msg);
    }
  });
}
async function generateCopilotDeck(){
  return withCopilotGenerationLock('deck', async ()=>{
    try{
      const deck = await callCopilot('deck');
      if((copilotEls.mode?.value || 'append') === 'replace') replaceDeckWithCopilot(deck);
      else appendCopilotSlides(deck);
    }catch(err){
      console.error(err);
      const msg = recordCopilotError(err);
      setCopilotStatus(msg, true);
      alert(msg);
    }
  });
}

async function generateCopilotDeckFromSpec(){
  return withCopilotGenerationLock('deck-spec', async ()=>{
    try{
      const plan = parseCopilotDeckSpecText(getCopilotDeckSpecText());
      if(plan.targetSlideCount && copilotEls.slideCount) copilotEls.slideCount.value = String(plan.targetSlideCount);
      setCopilotStatus(summarizeCopilotDeckSpec(plan) + ' Generating…');
      updateCopilotRuntime({ lastDeckSpecPlan: plan, lastDeckSpecGeneratedAt: new Date().toISOString() });
      const deck = await callCopilot('deck-spec', plan);
      if((copilotEls.mode?.value || 'append') === 'replace') replaceDeckWithCopilot(deck);
      else appendCopilotSlides(deck);
    }catch(err){
      console.error(err);
      const msg = recordCopilotError(err);
      setCopilotStatus(msg, true);
      alert(msg);
    }
  });
}

// Stage 34K: expose the narrow dependency bridge needed by the guarded ESM Copilot core.
// The bridge keeps mutable deck state inside legacy-app while allowing Copilot logic to migrate.
window.LuminaCopilotDepsStage34K = {
  stage: window.LUMINA_STAGE || 'stage34m-20260425-1',
  copilotEls,
  apiKeyStorage: COPILOT_API_KEY_STORAGE,
  settingsStorage: COPILOT_SETTINGS_STORAGE,
  defaultEndpoint: COPILOT_DEFAULT_ENDPOINT,
  deckPromptFile: COPILOT_DECK_PROMPT_FILE,
  copilotRuntimeStatus,
  updateRuntime: updateCopilotRuntime,
  showToast,
  fields,
  normalizeSlide,
  normalizeBlock,
  currentDeckData: () => currentDeckData(),
  applySlideToForm: slide => applySlideToForm(slide),
  getSlides: () => slides,
  setSlides: value => { slides = Array.isArray(value) ? value : []; },
  getActiveIndex: () => activeIndex,
  setActiveIndex: value => { activeIndex = Number.isFinite(Number(value)) ? Number(value) : -1; },
  buildPreview: () => buildPreview(),
  renderDeckList: () => renderDeckList(),
  scheduleAutosave: reason => scheduleAutosave(reason),
  persistAutosaveNow: reason => persistAutosaveNow(reason),
  alert: message => alert(message),
  fetch: window.fetch ? window.fetch.bind(window) : null,
  localStorage: window.localStorage,
  locationHref: window.location && window.location.href
};

// Stage 24C: expose Copilot core, but let js/copilot-stage24c.js bind UI events after the main app has loaded.
// This keeps Copilot failures from blocking preview/tabs/editor startup.
window.LuminaCopilotCore = {
  setCopilotStatus,
  loadCopilotSettings,
  saveCopilotSettings,
  validateCopilotApiKey,
  updateCopilotKeyWarning,
  friendlyCopilotHttpError,
  recordCopilotError,
  recordCopilotSuccess,
  copilotRuntimeStatus,
  copilotBlockSchema,
  copilotSlideSchema,
  copilotDeckSchema,
  copilotSystemPrompt,
  compactDeckForCopilot,
  buildCopilotUserPrompt,
  loadDeckPromptPrefix,
  parseCopilotDeckSpecText,
  getCopilotDeckSpecText,
  setCopilotDeckSpecText,
  summarizeCopilotDeckSpec,
  getCopilotReferenceText,
  setCopilotReferenceText,
  getCopilotReferenceUrls,
  setCopilotReferenceUrls,
  setCopilotReferencePdfFiles,
  getCopilotReferencePdfFiles,
  getCopilotReferenceMaterial,
  summarizeCopilotReferences,
  extractResponsesOutputText,
  callCopilot,
  normalizeCopilotDeck,
  normalizeCopilotSlide,
  parseCopilotResult,
  applyCopilotFirstSlide,
  appendCopilotSlides,
  replaceDeckWithCopilot,
  generateCopilotSlide,
  generateCopilotDeck,
  generateCopilotDeckFromSpec
};

const LuminaDeck = window.LuminaDeck;
if(!LuminaDeck){
  throw new Error('LuminaDeck failed to load. Check that js/deck.js is included before js/legacy-app.js.');
}
const deckApi = LuminaDeck.createApi({
  clone,
  escapeHtml,
  normalizeSlide,
  slideForSnippet,
  snippetOutput,
  deckCount,
  deckList,
  fields,
  getSlides: () => slides,
  setSlides: value => { slides = value; },
  getActiveIndex: () => activeIndex,
  setActiveIndex: value => { activeIndex = value; },
  saveCurrentBlockToDraft: () => saveCurrentBlockToDraft(),
  saveCurrentSlideToDeck: () => saveCurrentSlideToDeck(),
  applySlideToForm: slide => applySlideToForm(slide),
  buildPreview: () => buildPreview(),
  scheduleAutosave: reason => scheduleAutosave(reason),
  showToast: message => showToast(message),
  currentDraftSlide: () => currentDraftSlide()
});
const {
  parseSnippetSlide,
  loadSnippetIntoEditor,
  replaceSelectedSlideFromSnippet,
  addSlideFromSnippet,
  formatSnippet,
  renderDeckList,
  addSlide,
  updateSlide,
  duplicateSlide,
  deleteSlide,
  moveSlide,
  clearForm,
  copyText,
  copyCurrentSnippet,
  copyMathJaxHelper
} = deckApi;

const LuminaExport = window.LuminaExport;
if(!LuminaExport){
  throw new Error('LuminaExport failed to load. Check that js/export.js is included before js/legacy-app.js.');
}
const exportApi = LuminaExport.createApi({
  escapeHtml,
  clone,
  normalizeSlide,
  fields,
  getSlides: () => slides,
  currentThemeFromFields: () => currentThemeFromFields(),
  currentPresentationOptions: () => currentPresentationOptions(),
  currentDraftSlide: () => currentDraftSlide(),
  buildSlideStyle: (slide, theme) => buildSlideStyle(slide, theme),
  buildSlideInner: slide => buildSlideInner(slide),
  fitFiguresIn: root => fitFiguresIn(root),
  showToast: message => showToast(message),
  slideForSnippet: slide => slideForSnippet(slide)
});
const {
  buildStandaloneViewer,
  downloadTextFile,
  saveBlobWithDialog,
  saveTextFileAs,
  currentPayload,
  sanitizeBlockForPdf,
  sanitizeSlideForPdf,
  getPrintLayout,
  buildPrintableViewer,
  parseSlideSelection,
  waitFrames,
  makeFallbackSlideImage,
  wrapCanvasText,
  withTimeout,
  renderSlideForPdf,
  openPrintablePdf,
  exportPdfReadyHtml,
  downloadStandalone,
  downloadDeck,
  saveCurrentSlideJson,
  savePresentationJson
} = exportApi;

const LuminaFileIo = window.LuminaFileIo;
if(!LuminaFileIo){
  throw new Error('LuminaFileIo failed to load. Check that js/file-io.js is included before js/legacy-app.js.');
}
const fileIoApi = LuminaFileIo.createApi({
  clone,
  normalizeSlide,
  fields,
  getDocument: () => document,
  getSlides: () => slides,
  setSlides: value => { slides = value; },
  getActiveIndex: () => activeIndex,
  setActiveIndex: value => { activeIndex = value; },
  makeReferenceImageSlide,
  makeReferencePdfSlide,
  parseMarkdownToSlides,
  parseBeamerToSlides,
  parseJsonOutlineToSlides,
  parsePowerPointTextToSlides,
  syncPreviewFiguresToDraft: updateSnippet => syncPreviewFiguresToDraft(updateSnippet),
  saveCurrentBlockToDraft: () => saveCurrentBlockToDraft(),
  saveCurrentSlideToDeck: () => saveCurrentSlideToDeck(),
  applySlideToForm: slide => applySlideToForm(slide),
  clearForm: preserve => clearForm(preserve),
  buildPreview: () => buildPreview(),
  renderDeckList: () => renderDeckList(),
  scheduleAutosave: reason => scheduleAutosave(reason),
  showToast: message => showToast(message),
  applyThemeToForm: theme => applyThemeToForm(theme),
  applyPresentationOptions: options => applyPresentationOptions(options)
});
const {
  importModeValue,
  applyImportedSlides,
  importSelectedFiles,
  loadDeckFromFile,
  loadPresentationJsonFromFile
} = fileIoApi;
try{
  window.__LUMINA_FILE_IO_API = fileIoApi;
  window.__LUMINA_STAGE41T_FILE_IO_API = fileIoApi;
  window.LuminaStage41TFileIoApi = fileIoApi;
}catch(_err){}

const LuminaPresets = window.LuminaPresets || {};
const presets = LuminaPresets.presets || {};

function applyPreset(name){
  applySlideToForm(presets[name]);
  buildPreview();
  scheduleAutosave('Autosaved after preset apply.');
}

Object.values(fields).forEach(el=>{
  el.addEventListener('input', ()=>{ syncFields(); buildPreview(); scheduleAutosave(); });
  el.addEventListener('change', ()=>{ syncFields(); buildPreview(); scheduleAutosave(); });
});
blockFields.column.addEventListener('change', ()=>{
  saveCurrentBlockToDraft();
  loadSelectedBlockIntoEditor();
  buildPreview();
  scheduleAutosave('Autosaved after block switch.');
});
blockFields.mode.addEventListener('change', ()=>{ saveCurrentBlockToDraft(); buildPreview(); scheduleAutosave(); });
blockFields.title.addEventListener('input', ()=>{ saveCurrentBlockToDraft(); buildPreview(); scheduleAutosave(); });
blockFields.content.addEventListener('input', ()=>{ saveCurrentBlockToDraft(); buildPreview(); scheduleAutosave(); });

document.querySelectorAll('[data-history-action="undo"]').forEach(btn=>btn.addEventListener('click', undoHistory));
document.querySelectorAll('[data-history-action="redo"]').forEach(btn=>btn.addEventListener('click', redoHistory));
updateHistoryButtons();


function stage43kAiEndpointFromImportSettings(){
  const explicit = String(document.getElementById('importAiEndpointInput')?.value || '').trim();
  if(explicit) return explicit;
  const extraction = String(document.getElementById('extractionEndpointInput')?.value || '').trim();
  if(/\/api\/lumina\/extract\/?$/i.test(extraction)) return extraction.replace(/\/api\/lumina\/extract\/?$/i, '/api/lumina/ai');
  return extraction ? extraction.replace(/\/?$/, '/api/lumina/ai') : '/api/lumina/ai';
}
function stage43kEndpoint(base, suffix){
  const value = String(base || '').trim();
  if(/\/api\/lumina\/ai\/?$/i.test(value)) return value.replace(/\/api\/lumina\/ai\/?$/i, suffix);
  if(/\/api\/lumina\/extract\/?$/i.test(value)) return value.replace(/\/api\/lumina\/extract\/?$/i, suffix);
  return value.replace(/\/?$/, suffix);
}
function stage43sLuminaBackendEndpoint(suffix){
  const extraction = String(document.getElementById('extractionEndpointInput')?.value || '').trim();
  const ai = String(document.getElementById('importAiEndpointInput')?.value || '').trim();
  const candidates = [extraction, ai].filter(Boolean);
  for(const candidate of candidates){
    if(/\/api\/lumina\/extract\/?$/i.test(candidate) || /\/api\/lumina\/ai\/?$/i.test(candidate)){
      return stage43kEndpoint(candidate, suffix);
    }
    if(/lumina-backend|run\.app|localhost|127\.0\.0\.1/i.test(candidate) && !/api\.openai\.com|generativelanguage\.googleapis\.com|anthropic\.com/i.test(candidate)){
      return candidate.replace(/\/?$/, suffix);
    }
  }
  if(extraction) return stage43kEndpoint(extraction, suffix);
  return suffix;
}
function stage43kAiTokenFromImportSettings(){
  return String(document.getElementById('importAiTokenInput')?.value || document.getElementById('extractionTokenInput')?.value || '').trim();
}
function stage43kAiProviderFromImportSettings(){
  return String(document.getElementById('importAiProviderSelect')?.value || 'openai').trim().toLowerCase();
}
function stage43kAiModelFromImportSettings(){
  return String(document.getElementById('importAiModelInput')?.value || 'gpt-4.1-mini').trim();
}
function stage43mExtractFirstImageSrcFromHtml(value){
  const s = String(value || '');
  const direct = s.trim();
  if(/^data:image\//i.test(direct)) return direct.replace(/\s+/g, '');
  const m = s.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if(m && /^data:image\//i.test(m[1])) return m[1].replace(/\s+/g, '');
  const any = s.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/i);
  return any ? any[0].replace(/\s+/g, '') : '';
}
function stage43alExtractFirstAnyImageSrcFromHtml(value){
  const s = String(value || '');
  const direct = s.trim();
  if(/^(?:data:image\/|blob:|https?:\/\/|\/)/i.test(direct)) return direct;
  const m = s.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  if(m && m[1]) return String(m[1]).trim();
  const any = s.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/i);
  return any ? any[0].replace(/\s+/g, '') : '';
}
function stage43alIsDataImage(src){ return /^data:image\//i.test(String(src || '').trim()); }
function stage43alCssAttr(value){ return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
function stage43alFindPreviewElementForInfo(info){
  try{
    const root = document.getElementById('preview') || document;
    if(info && info.fromFigureBox){
      const boxes = typeof getSelectedFigureBoxes === 'function' ? getSelectedFigureBoxes(root) : [];
      if(boxes && boxes.length) return boxes[0];
    }
    const column = stage43alCssAttr(info && info.column || 'left');
    const index = Number(info && info.index);
    if(Number.isFinite(index)){
      const selectors = [
        '.figure-embed[data-column="' + column + '"][data-block-index="' + index + '"] .figure-box',
        '.preview-block[data-column="' + column + '"][data-block-index="' + index + '"]',
        '.freeform-block[data-column="' + column + '"][data-block-index="' + index + '"]',
        '.freeform-block[data-freeform-index="' + index + '"]'
      ];
      for(const sel of selectors){
        const el = root.querySelector(sel);
        if(el) return el;
      }
    }
    const freeform = root.querySelector('.freeform-block.stage43o-freeform-selected');
    if(freeform) return freeform;
  }catch(_err){}
  return null;
}
function stage43alSelectedFreeformBlockInfo(){
  try{
    const root = document.getElementById('preview') || document;
    const el = root.querySelector('.freeform-block.stage43o-freeform-selected[data-block-index], .freeform-block.stage43o-freeform-selected[data-freeform-index]');
    if(!el) return null;
    const idx = Number(el.dataset.blockIndex || el.dataset.freeformIndex);
    const arr = blockArray('left');
    const block = Number.isFinite(idx) && idx >= 0 && idx < arr.length ? arr[idx] : null;
    if(!block) return null;
    const src = stage43mExtractFirstImageSrcFromHtml(block.content || '') || stage43alExtractFirstAnyImageSrcFromHtml(block.content || '');
    return { column:'left', index:idx, block, imageSrc:src, fromFreeformBlock:true, previewElement:el };
  }catch(_err){ return null; }
}
function stage43alBlobToDataUrl(blob){
  return new Promise(function(resolve, reject){
    try{
      const reader = new FileReader();
      reader.onload = function(){ resolve(String(reader.result || '')); };
      reader.onerror = function(){ reject(reader.error || new Error('Could not read image blob.')); };
      reader.readAsDataURL(blob);
    }catch(err){ reject(err); }
  });
}
function stage43alLoadImage(src){
  return new Promise(function(resolve, reject){
    const img = new Image();
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ reject(new Error('Could not load selected image source.')); };
    try{ img.crossOrigin = 'anonymous'; }catch(_err){}
    img.src = src;
  });
}
async function stage43alImageElementToDataUrl(img){
  if(!img) return '';
  const src = img.currentSrc || (img.getAttribute && img.getAttribute('src')) || '';
  if(stage43alIsDataImage(src)) return src.replace(/\s+/g, '');
  try{
    const w = Math.max(1, img.naturalWidth || img.width || img.clientWidth || 0);
    const h = Math.max(1, img.naturalHeight || img.height || img.clientHeight || 0);
    if(w && h){
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(8192, Math.max(1, Math.round(w)));
      canvas.height = Math.min(8192, Math.max(1, Math.round(h)));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    }
  }catch(_err){}
  if(src){
    try{
      const res = await fetch(src, { cache:'no-store' });
      if(res.ok) return await stage43alBlobToDataUrl(await res.blob());
    }catch(_err){}
  }
  return '';
}
async function stage43alSvgElementToDataUrl(svg){
  if(!svg) return '';
  try{
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const rect = svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || Number(svg.getAttribute('width')) || 800));
    const h = Math.max(1, Math.round(rect.height || Number(svg.getAttribute('height')) || 600));
    if(!clone.getAttribute('width')) clone.setAttribute('width', String(w));
    if(!clone.getAttribute('height')) clone.setAttribute('height', String(h));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    const img = await stage43alLoadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(8192, w);
    canvas.height = Math.min(8192, h);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }catch(_err){ return ''; }
}
async function stage43alMediaElementToDataUrl(media){
  if(!media) return '';
  const tag = String(media.tagName || '').toLowerCase();
  if(tag === 'canvas'){
    try{ return media.toDataURL('image/png'); }catch(_err){ return ''; }
  }
  if(tag === 'svg') return await stage43alSvgElementToDataUrl(media);
  if(tag === 'img') return await stage43alImageElementToDataUrl(media);
  return '';
}
async function stage43alElementToDataUrl(el){
  if(!el) return '';
  try{
    const media = el.matches && el.matches('img,canvas,svg') ? el : el.querySelector && el.querySelector('img,canvas,svg');
    const mediaUrl = await stage43alMediaElementToDataUrl(media);
    if(mediaUrl) return mediaUrl;
  }catch(_err){}
  try{
    if(typeof html2canvas === 'function'){
      const canvas = await html2canvas(el, { backgroundColor:'#ffffff', scale:Math.max(1, Math.min(3, window.devicePixelRatio || 2)), useCORS:true, allowTaint:false, logging:false });
      return canvas.toDataURL('image/png');
    }
  }catch(_err){}
  return '';
}
function stage43alBlockWithImage(info, imageSrc){
  const block = Object.assign({}, info && info.block || {});
  const existing = stage43mExtractFirstImageSrcFromHtml(block.content || '');
  if(!existing && imageSrc){
    const safe = String(imageSrc).replace(/"/g, '&quot;');
    block.content = '\\begin{figurehtml}\n<figure data-figure-kind="image"><img src="' + safe + '" alt="Selected image block" /></figure>\n\\end{figurehtml}';
    block.mode = block.mode || 'import-image';
  }
  return block;
}
async function stage43alResolveSelectedBlockImageDataUrl(info){
  let src = info && info.imageSrc || '';
  if(!src && info && info.block) src = stage43mExtractFirstImageSrcFromHtml(info.block.content || '') || stage43alExtractFirstAnyImageSrcFromHtml(info.block.content || '');
  if(stage43alIsDataImage(src)) return { imageSrc:src.replace(/\s+/g, ''), block:stage43alBlockWithImage(info, src), source:'block-data-src' };
  if(src){
    try{
      const img = await stage43alLoadImage(src);
      const dataUrl = await stage43alImageElementToDataUrl(img);
      if(dataUrl) return { imageSrc:dataUrl, block:stage43alBlockWithImage(info, dataUrl), source:'loaded-src' };
    }catch(_err){}
    try{
      const res = await fetch(src, { cache:'no-store' });
      if(res.ok){
        const dataUrl = await stage43alBlobToDataUrl(await res.blob());
        if(dataUrl) return { imageSrc:dataUrl, block:stage43alBlockWithImage(info, dataUrl), source:'fetch-src' };
      }
    }catch(_err){}
  }
  const el = (info && info.previewElement) || stage43alFindPreviewElementForInfo(info);
  const dataUrl = await stage43alElementToDataUrl(el);
  if(dataUrl) return { imageSrc:dataUrl, block:stage43alBlockWithImage(info, dataUrl), source:'visible-raster' };
  return { imageSrc:'', block:info && info.block || null, source:'none' };
}
function stage43mFigureBoxSelectedBlockInfo(){
  try{
    const boxes = typeof getSelectedFigureBoxes === 'function' ? getSelectedFigureBoxes() : [];
    if(!boxes || !boxes.length) return null;
    const box = boxes[0];
    const embed = box.closest && box.closest('.figure-embed[data-column]');
    if(!embed) return null;
    const column = embed.dataset.column === 'right' ? 'right' : 'left';
    const idx = Number(embed.dataset.blockIndex);
    const arr = blockArray(column);
    if(!Number.isFinite(idx) || idx < 0 || idx >= arr.length) return null;
    const block = arr[idx];
    const media = box.querySelector && box.querySelector('img,canvas,svg') || embed.querySelector && embed.querySelector('img,canvas,svg');
    let imageSrc = '';
    if(media){
      if(media.tagName && media.tagName.toLowerCase() === 'canvas'){
        try{ imageSrc = media.toDataURL('image/png'); }catch(_err){}
      } else if(media.getAttribute){
        imageSrc = media.getAttribute('src') || '';
      }
    }
    if(!/^data:image\//i.test(imageSrc)) imageSrc = stage43mExtractFirstImageSrcFromHtml(block && block.content || '');
    const blockForRequest = Object.assign({}, block || {});
    if(imageSrc && !stage43mExtractFirstImageSrcFromHtml(blockForRequest.content || '')){
      blockForRequest.content = '\\begin{figurehtml}\n<figure data-figure-kind="image"><img src="' + imageSrc + '" alt="Selected image block" /></figure>\n\\end{figurehtml}';
      blockForRequest.mode = blockForRequest.mode || 'import-image';
    }
    return { column, index:idx, block:blockForRequest, imageSrc, fromFigureBox:true };
  }catch(_err){ return null; }
}
function stage43kSelectedBlockInfo(){
  saveCurrentBlockToDraft();
  // Stage 43AL: actual selected image/freeform DOM wins. Freeform image-blob
  // clicks update selectedIndex but not always selectedPreviewTarget; using a
  // stale preview target here caused Mathpix to receive a text block with no image.
  const figureInfo = stage43mFigureBoxSelectedBlockInfo();
  if(figureInfo && figureInfo.block) return figureInfo;
  const freeformInfo = stage43alSelectedFreeformBlockInfo();
  if(freeformInfo && freeformInfo.block) return freeformInfo;
  const target = typeof selectedPreviewTarget === 'function' ? selectedPreviewTarget() : null;
  if(target && target.type === 'block'){
    const column = target.column === 'right' ? 'right' : 'left';
    const idx = Number(target.index);
    const arr = blockArray(column);
    const block = Number.isFinite(idx) && idx >= 0 && idx < arr.length ? arr[idx] : null;
    if(block) return { column, index:idx, block, imageSrc:stage43mExtractFirstImageSrcFromHtml(block && block.content || ''), fromPreviewTarget:true };
  }
  const column = currentColumnName();
  const idx = selectedIndex(column);
  const arr = blockArray(column);
  const block = idx >= 0 && idx < arr.length ? arr[idx] : null;
  if(block) return { column, index:idx, block, imageSrc:stage43mExtractFirstImageSrcFromHtml(block && block.content || ''), fromBlockEditor:true };
  return { column, index:idx, block:null, imageSrc:'', fromBlockEditor:true };
}
async function stage43kPostJson(endpoint, body){
  const headers = { 'Content-Type':'application/json' };
  const token = stage43kAiTokenFromImportSettings();
  if(token) headers.Authorization = 'Bearer ' + token;
  const payload = JSON.stringify(body);
  try{ window.__LUMINA_STAGE43S_LAST_BLOCK_ACTION_REQUEST = { endpoint, payloadBytes:payload.length, at:new Date().toISOString() }; }catch(_err){}
  let res;
  try{
    res = await fetch(endpoint, { method:'POST', headers, body:payload, cache:'no-store', mode:'cors' });
  }catch(err){
    const msg = err && err.message ? String(err.message) : String(err || 'Load failed');
    try{ window.__LUMINA_STAGE43S_LAST_BLOCK_ACTION_REQUEST = Object.assign({}, window.__LUMINA_STAGE43S_LAST_BLOCK_ACTION_REQUEST || {}, { ok:false, networkError:msg, endpoint, at:new Date().toISOString() }); }catch(_err){}
    throw new Error('Could not reach Lumina backend at ' + endpoint + '. Check that the Extraction endpoint field points to https://lumina-backend-1046042377096.us-east1.run.app/api/lumina/extract and that the Stage 43R+ backend is deployed. Browser error: ' + msg);
  }
  const raw = await res.text();
  let data = null;
  try{ data = raw ? JSON.parse(raw) : {}; }catch(_err){ data = { ok:false, error:{ message:raw || 'Non-JSON backend response.' } }; }
  if(!res.ok || data.ok === false) throw new Error(data && data.error && data.error.message || raw || ('Backend request failed with HTTP ' + res.status));
  return data;
}

function stage43nSelectBlockInfo(info){
  if(!info || !info.block || !Number.isFinite(Number(info.index))) return false;
  const column = info.column === 'right' ? 'right' : 'left';
  const idx = Number(info.index);
  const arr = blockArray(column);
  if(idx < 0 || idx >= arr.length) return false;
  blockFields.column.value = column;
  setSelectedIndex(column, idx);
  loadSelectedBlockIntoEditor();
  return true;
}
function stage43nReplacementBlockForInfo(info, replacement, reason){
  const existing = info && info.block || {};
  const next = clone(replacement || {});
  if(existing.layout) next.layout = clone(existing.layout);
  if(existing.importSourceLayout) next.importSourceLayout = clone(existing.importSourceLayout);
  ['blockId','__aiSourceBlockId','sourceTextHint','mathImageSourceText','lineCount','visualBlobIndex','sourcePageNumber','sourcePageIndex'].forEach(function(key){
    if(existing[key] != null && next[key] == null) next[key] = clone(existing[key]);
  });
  if(!next.layout) next.layout = { x:120, y:160, w:640, h:160, z:40 + (Number(info && info.index) || 0) };
  next.stage43nSelectedBlockReplacement = true;
  next.stage43nReplacementReason = reason || 'selected-block-replace';
  return next;
}
function stage43nCheckpointBeforeBlockMutation(reason){
  try{
    saveCurrentBlockToDraft();
    saveCurrentSlideToDeck();
    persistAutosaveNow('Checkpoint before ' + (reason || 'selected block change') + '.');
  }catch(_err){}
}
function stage43nReplaceBlockFromInfo(info, replacement, reason){
  if(!info || !info.block){ showToast('Select a block first.'); return false; }
  stage43nCheckpointBeforeBlockMutation(reason || 'selected block replacement');
  if(!stage43nSelectBlockInfo(info)){
    return replaceSelectedBlock(stage43nReplacementBlockForInfo(info, replacement, reason), reason || 'selected-block-replace');
  }
  const nextBlock = stage43nReplacementBlockForInfo(info, replacement, reason);
  const ok = replaceSelectedBlock(nextBlock, reason || 'selected-block-replace');
  try{
    window.__LUMINA_STAGE43N_SELECTED_BLOCK_REPLACE = {
      ok:!!ok,
      column:info.column,
      index:info.index,
      mode:nextBlock.mode || '',
      title:nextBlock.title || '',
      preservedLayout:!!(info.block && info.block.layout),
      reason:reason || 'selected-block-replace',
      at:new Date().toISOString()
    };
  }catch(_err){}
  return ok;
}
function stage43nDeleteSelectedBlock(){
  const info = stage43kSelectedBlockInfo();
  if(!info || !info.block){ showToast('Select a block first.'); return false; }
  stage43nCheckpointBeforeBlockMutation('selected block delete');
  if(!stage43nSelectBlockInfo(info)) return deleteBlock();
  const ok = deleteBlock();
  try{
    window.__LUMINA_STAGE43N_LAST_BLOCK_DELETE = { ok:!!ok, column:info.column, index:info.index, title:info.block && info.block.title || '', at:new Date().toISOString() };
  }catch(_err){}
  return ok;
}
async function extractSelectedBlockWithMathpix(){
  const info = stage43kSelectedBlockInfo();
  if(!info.block){ showToast('Select a block first.'); return; }
  try{
    showToast('Extracting selected block with Mathpix…');
    const endpoint = stage43sLuminaBackendEndpoint('/api/lumina/block/mathpix-extract');
    const resolved = await stage43alResolveSelectedBlockImageDataUrl(info);
    if(!resolved.imageSrc) throw new Error('Selected block does not contain an extractable image. Click the imported image patch itself, or select the visible freeform/image block and try again.');
    const requestBlock = resolved.block || info.block;
    const data = await stage43kPostJson(endpoint, { block:requestBlock, imageSrc:resolved.imageSrc || null, timeoutMs:30000 });
    if(!data.block) throw new Error('Mathpix backend did not return a replacement block.');
    stage43nReplaceBlockFromInfo(info, data.block, 'selected-block-mathpix');
    window.__LUMINA_STAGE43K_LAST_SELECTED_BLOCK_MATHPIX = { ok:true, stage:'stage43al-selected-block-mathpix-raster-fallback-20260516-1', column:info.column, index:info.index, endpoint, fromFigureBox:!!info.fromFigureBox, fromPreviewTarget:!!info.fromPreviewTarget, fromFreeformBlock:!!info.fromFreeformBlock, hadImageSrc:!!resolved.imageSrc, imageSource:resolved.source || '', stats:data.stats || null, at:new Date().toISOString() }; window.__LUMINA_STAGE43M_SELECTED_MATHPIX_IMAGE_DETECTION = window.__LUMINA_STAGE43K_LAST_SELECTED_BLOCK_MATHPIX;
    showToast('Selected block extracted with Mathpix.');
  }catch(err){
    window.__LUMINA_STAGE43K_LAST_SELECTED_BLOCK_MATHPIX = { ok:false, stage:'stage43al-selected-block-mathpix-raster-fallback-20260516-1', column:info.column, index:info.index, fromFigureBox:!!info.fromFigureBox, fromPreviewTarget:!!info.fromPreviewTarget, fromFreeformBlock:!!info.fromFreeformBlock, hadImageSrc:!!info.imageSrc, error:err && err.message ? err.message : String(err), at:new Date().toISOString() }; window.__LUMINA_STAGE43M_SELECTED_MATHPIX_IMAGE_DETECTION = window.__LUMINA_STAGE43K_LAST_SELECTED_BLOCK_MATHPIX;
    alert('Could not extract selected block with Mathpix: ' + (err && err.message ? err.message : String(err)));
  }
}

async function extractSelectedBlockWithMineru(){
  const info = stage43kSelectedBlockInfo();
  if(!info.block){ showToast('Select a block first.'); return; }
  let resolved = null;
  try{ resolved = await stage43alResolveSelectedBlockImageDataUrl(info); }catch(_err){ resolved = null; }
  if(!resolved || !resolved.imageSrc){
    alert('MinerU selected-block extraction needs an image patch or visible image/figure block. Select the image region itself, then try again.');
    return;
  }
  try{
    showToast('Extracting selected block with MinerU…');
    const endpoint = stage43sLuminaBackendEndpoint('/api/lumina/block/mineru-extract');
    const data = await stage43kPostJson(endpoint, { block:resolved.block || info.block, imageSrc:resolved.imageSrc || null, timeoutMs:900000 });
    if(!data.block) throw new Error('MinerU backend did not return a replacement block.');
    stage43nReplaceBlockFromInfo(info, data.block, 'selected-block-mineru');
    window.__LUMINA_STAGE43R_LAST_SELECTED_BLOCK_MINERU = { ok:true, stage:'stage43al-selected-block-mathpix-raster-fallback-20260516-1', column:info.column, index:info.index, endpoint, fromFigureBox:!!info.fromFigureBox, fromPreviewTarget:!!info.fromPreviewTarget, fromFreeformBlock:!!info.fromFreeformBlock, hadImageSrc:!!resolved.imageSrc, imageSource:resolved.source || '', stats:data.stats || null, meta:data.meta || null, at:new Date().toISOString() };
    showToast('Selected block extracted with MinerU.');
  }catch(err){
    window.__LUMINA_STAGE43R_LAST_SELECTED_BLOCK_MINERU = { ok:false, stage:'stage43al-selected-block-mathpix-raster-fallback-20260516-1', column:info.column, index:info.index, fromFigureBox:!!info.fromFigureBox, fromPreviewTarget:!!info.fromPreviewTarget, fromFreeformBlock:!!info.fromFreeformBlock, hadImageSrc:!!(resolved && resolved.imageSrc), error:err && err.message ? err.message : String(err), at:new Date().toISOString() };
    alert('Could not extract selected block with MinerU: ' + (err && err.message ? err.message : String(err)));
  }
}
function openAiRemakeSelectedBlockDialog(){
  const info = stage43kSelectedBlockInfo();
  if(!info.block){ showToast('Select a block first.'); return; }
  const existing = document.getElementById('stage43kAiRemakeOverlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'stage43kAiRemakeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;padding:18px;';
  overlay.innerHTML = '<div style="width:min(720px,calc(100vw - 28px));background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:16px;color:#0f172a"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><div class="smallcaps">Selected block AI remake</div><h2 style="margin:.2rem 0 .15rem">Remake selected block</h2><div class="help">Describe how to transform this block. Examples: make this a clean SVG figure; make an interactive demo; convert to concise bullets; animate the concept.</div></div><button class="btn mini" type="button" data-stage43k-close>×</button></div><textarea id="stage43kAiRemakePrompt" class="code" style="width:100%;min-height:150px;margin-top:12px" placeholder="Example: remake this as an interactive custom HTML demo explaining self-attention, preserving the main equation."></textarea><div class="toolbar" style="margin-top:12px"><button class="btn primary" type="button" data-stage43k-submit>Submit remake</button><button class="btn" type="button" data-stage43k-close>Cancel</button></div></div>';
  overlay.addEventListener('click', async function(evt){
    if(evt.target === overlay || evt.target.closest('[data-stage43k-close]')){ overlay.remove(); return; }
    if(evt.target.closest('[data-stage43k-submit]')){
      const prompt = String(document.getElementById('stage43kAiRemakePrompt')?.value || '').trim();
      if(!prompt){ alert('Enter a remake prompt first.'); return; }
      const submit = evt.target.closest('[data-stage43k-submit]');
      submit.disabled = true; submit.textContent = 'Remaking…';
      try{
        const endpoint = stage43sLuminaBackendEndpoint('/api/lumina/block/ai-remake');
        const data = await stage43kPostJson(endpoint, { provider:stage43kAiProviderFromImportSettings(), model:stage43kAiModelFromImportSettings(), prompt, block:info.block, maxOutputTokens:10000 });
        if(!data.block) throw new Error('AI backend did not return a replacement block.');
        stage43nReplaceBlockFromInfo(info, data.block, 'selected-block-ai-remake');
        window.__LUMINA_STAGE43K_LAST_SELECTED_BLOCK_AI_REMAKE = { ok:true, column:info.column, index:info.index, endpoint, prompt, provider:data.provider || stage43kAiProviderFromImportSettings(), model:data.model || stage43kAiModelFromImportSettings(), at:new Date().toISOString() };
        overlay.remove();
        showToast('Selected block remade with AI.');
      }catch(err){
        window.__LUMINA_STAGE43K_LAST_SELECTED_BLOCK_AI_REMAKE = { ok:false, column:info.column, index:info.index, prompt, error:err && err.message ? err.message : String(err), at:new Date().toISOString() };
        alert('Could not remake selected block with AI: ' + (err && err.message ? err.message : String(err)));
        submit.disabled = false; submit.textContent = 'Submit remake';
      }
    }
  });
  document.body.appendChild(overlay);
  const ta = document.getElementById('stage43kAiRemakePrompt');
  if(ta) ta.focus();
}

document.getElementById('addBlockBtn').addEventListener('click', addBlock);
document.getElementById('updateBlockBtn').addEventListener('click', updateBlock);
document.getElementById('duplicateBlockBtn').addEventListener('click', duplicateBlock);
document.getElementById('deleteBlockBtn').addEventListener('click', stage43nDeleteSelectedBlock);
document.getElementById('extractSelectedBlockMathpixBtn')?.addEventListener('click', extractSelectedBlockWithMathpix);
document.getElementById('extractSelectedBlockMineruBtn')?.addEventListener('click', extractSelectedBlockWithMineru);
document.getElementById('remakeSelectedBlockAiBtn')?.addEventListener('click', openAiRemakeSelectedBlockDialog);


function stage43lSelectedBlockSummary(){
  try{
    const info = stage43kSelectedBlockInfo();
    return Object.assign({}, info || {}, { hasBlock:!!(info && info.block) });
  }catch(_err){ return { column:'left', index:-1, block:null, hasBlock:false }; }
}
function stage43lEnsureFloatingBlockActions(){
  if(document.getElementById('stage43lFloatingBlockActions')) return;
  const bar = document.createElement('div');
  bar.id = 'stage43lFloatingBlockActions';
  bar.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:999996;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);overflow:auto;background:rgba(15,23,42,.96);color:#f8fafc;border:1px solid rgba(148,163,184,.45);border-radius:999px;box-shadow:0 16px 50px rgba(15,23,42,.28);padding:8px 10px;font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;';
  bar.innerHTML = '<span data-stage43l-label style="white-space:nowrap;opacity:.92;padding:0 6px">No block selected</span><button type="button" data-stage43l-action="delete" style="border:1px solid rgba(248,113,113,.55);background:#7f1d1d;color:#fff;border-radius:999px;padding:7px 10px;font:700 12px system-ui;cursor:pointer;white-space:nowrap">Delete block</button><button type="button" data-stage43l-action="mathpix" style="border:1px solid rgba(96,165,250,.55);background:#1d4ed8;color:#fff;border-radius:999px;padding:7px 10px;font:700 12px system-ui;cursor:pointer;white-space:nowrap">Mathpix extract</button><button type="button" data-stage43l-action="mineru" style="border:1px solid rgba(251,191,36,.65);background:#92400e;color:#fff;border-radius:999px;padding:7px 10px;font:700 12px system-ui;cursor:pointer;white-space:nowrap">MinerU extract</button><button type="button" data-stage43l-action="ai" style="border:1px solid rgba(52,211,153,.55);background:#047857;color:#fff;border-radius:999px;padding:7px 10px;font:700 12px system-ui;cursor:pointer;white-space:nowrap">Remake with AI</button>';
  bar.addEventListener('click', function(evt){
    const btn = evt.target && evt.target.closest ? evt.target.closest('[data-stage43l-action]') : null;
    if(!btn) return;
    const info = stage43lSelectedBlockSummary();
    if(!info.hasBlock){ showToast('Select a block first.'); stage43lRefreshFloatingBlockActions(); return; }
    const action = btn.getAttribute('data-stage43l-action');
    if(action === 'delete') stage43nDeleteSelectedBlock();
    else if(action === 'mathpix') extractSelectedBlockWithMathpix();
    else if(action === 'mineru') extractSelectedBlockWithMineru();
    else if(action === 'ai') openAiRemakeSelectedBlockDialog();
    setTimeout(stage43lRefreshFloatingBlockActions, 60);
  });
  document.body.appendChild(bar);
  stage43lRefreshFloatingBlockActions();
}
function stage43lRefreshFloatingBlockActions(){
  const bar = document.getElementById('stage43lFloatingBlockActions');
  if(!bar) return;
  const info = stage43lSelectedBlockSummary();
  const label = bar.querySelector('[data-stage43l-label]');
  if(label){
    label.textContent = info.hasBlock ? ('Selected: ' + (info.block.title || ('Block ' + (info.index + 1))) + ' • ' + (info.block.mode || 'block') + (info.imageSrc ? ' • image-ready' : '')) : 'No block selected';
  }
  bar.querySelectorAll('button').forEach(function(btn){
    btn.disabled = !info.hasBlock;
    btn.style.opacity = info.hasBlock ? '1' : '.42';
    btn.style.cursor = info.hasBlock ? 'pointer' : 'not-allowed';
  });
  try{
    window.__LUMINA_STAGE43L_FLOATING_BLOCK_ACTIONS = { ready:true, stage:'stage43v-block-edit-mathpix-selection-fix-20260514-1', mineruButton:true, hasBlock:info.hasBlock, column:info.column, index:info.index, mode:info.block && info.block.mode || null, title:info.block && info.block.title || '', hasImageSrc:!!info.imageSrc, fromFigureBox:!!info.fromFigureBox, fromPreviewTarget:!!info.fromPreviewTarget, at:new Date().toISOString() };
  }catch(_err){}
}
setTimeout(stage43lEnsureFloatingBlockActions, 800);
setInterval(stage43lRefreshFloatingBlockActions, 1000);
['click','pointerup','keyup','change'].forEach(function(evtName){
  document.addEventListener(evtName, function(evt){
    if(evt && evt.target && evt.target.closest && (evt.target.closest('#preview') || evt.target.closest('#blockList') || evt.target.closest('#blockColumn') || evt.target.closest('#blockMode'))){
      setTimeout(stage43lRefreshFloatingBlockActions, 80);
    }
  }, true);
});
document.getElementById('clearBlockBtn').addEventListener('click', clearBlockEditor);
document.getElementById('addFigureBtn').addEventListener('click', openFigureModal);
const toolsAddFigureBtn = document.getElementById('toolsAddFigureBtn');
if(toolsAddFigureBtn) toolsAddFigureBtn.addEventListener('click', openFigureModal);
const toolsOpenDiagramEditorBtn = document.getElementById('toolsOpenDiagramEditorBtn');
if(toolsOpenDiagramEditorBtn) toolsOpenDiagramEditorBtn.addEventListener('click', ()=>{ openSimpleDiagramEditor(); });
document.getElementById('closeFigureModalBtn').addEventListener('click', closeFigureModal);
document.getElementById('figureSourceImageBtn').addEventListener('click', ()=>{
  figureImagePanel.style.display = '';
  figureEditorPanel.style.display = 'none';
});
document.getElementById('figureSourceEditorBtn').addEventListener('click', ()=>{
  figureImagePanel.style.display = 'none';
  figureEditorPanel.style.display = '';
  openSimpleDiagramEditor();
});
document.getElementById('insertFigureUrlBtn').addEventListener('click', ()=>{
  const src = (figureUrlInput.value || '').trim();
  if(!src){ alert('Enter an image URL first.'); return; }
  insertFigureHtml(buildImageFigureHtml(src, (figureAltInput.value || '').trim()));
  closeFigureModal();
});
document.getElementById('insertFigureFileBtn').addEventListener('click', ()=>{
  const file = figureFileInput.files && figureFileInput.files[0];
  if(!file){ alert('Choose an image file first.'); return; }
  const reader = new FileReader();
  reader.onload = ()=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      const embedded = c.toDataURL('image/jpeg', 0.92);
      insertFigureHtml(buildImageFigureHtml(String(embedded || ''), (figureAltInput.value || file.name || '').trim()));
      closeFigureModal();
      figureFileInput.value = '';
    };
    img.src = String(reader.result || '');
  };
  reader.readAsDataURL(file);
});
figureModal.addEventListener('click', (e)=>{
  if(e.target === figureModal) closeFigureModal();
});
document.getElementById('moveBlockUpBtn').addEventListener('click', ()=>moveBlock(-1));
document.getElementById('moveBlockDownBtn').addEventListener('click', ()=>moveBlock(1));

document.getElementById('addSlideBtn').addEventListener('click', addSlide);
document.getElementById('updateSlideBtn').addEventListener('click', updateSlide);
document.getElementById('duplicateSlideBtn').addEventListener('click', duplicateSlide);
document.getElementById('deleteSlideBtn').addEventListener('click', deleteSlide);
document.getElementById('moveUpBtn').addEventListener('click', ()=>moveSlide(-1));
document.getElementById('moveDownBtn').addEventListener('click', ()=>moveSlide(1));
document.getElementById('clearFormBtn').addEventListener('click', clearForm);
document.getElementById('applyThemeToCurrentBtn').addEventListener('click', ()=>{
  fields.inheritTheme.checked = true;
  buildPreview();
  scheduleAutosave('Autosaved after applying theme to current slide.');
});
document.getElementById('applyThemeToAllBtn').addEventListener('click', ()=>{
  slides = (slides.length ? slides : [currentDraftSlide()]).map(s=>({ ...normalizeSlide(s), inheritTheme:true }));
  fields.inheritTheme.checked = true;
  renderDeckList();
  buildPreview();
  scheduleAutosave('Autosaved after applying theme to all slides.');
});
Object.values(themeFields).forEach(el=>{
  el.addEventListener('input', ()=>{ buildPreview(); renderDeckList(); scheduleAutosave(); });
  el.addEventListener('change', ()=>{ buildPreview(); renderDeckList(); scheduleAutosave(); });
});
document.getElementById('copySnippetBtn').addEventListener('click', copyCurrentSnippet);
document.getElementById('copyMathJaxBtn').addEventListener('click', copyMathJaxHelper);
document.getElementById('downloadStandaloneBtn').addEventListener('click', ()=>downloadStandalone().catch(err=>alert(err.message || 'Could not save current slide.')));
document.getElementById('downloadDeckBtn').addEventListener('click', ()=>downloadDeck().catch(err=>alert(err.message || 'Could not save presentation.')));
document.getElementById('saveCurrentSlideJsonBtn').addEventListener('click', ()=>saveCurrentSlideJson().catch(err=>alert(err.message || 'Could not save current slide JSON.')));
document.getElementById('savePresentationJsonBtn').addEventListener('click', ()=>savePresentationJson().catch(err=>alert(err.message || 'Could not save presentation JSON.')));
document.getElementById('loadSnippetToEditorBtn').addEventListener('click', ()=>{
  try{ loadSnippetIntoEditor(); }catch(err){ alert(err.message || 'Could not load snippet.'); }
});
document.getElementById('replaceSlideFromSnippetBtn').addEventListener('click', ()=>{
  try{ replaceSelectedSlideFromSnippet(); }catch(err){ alert(err.message || 'Could not replace slide from snippet.'); }
});
document.getElementById('addSlideFromSnippetBtn').addEventListener('click', ()=>{
  try{ addSlideFromSnippet(); }catch(err){ alert(err.message || 'Could not add slide from snippet.'); }
});
document.getElementById('formatSnippetBtn').addEventListener('click', ()=>{
  try{ formatSnippet(); }catch(err){ alert(err.message || 'Could not format snippet.'); }
});
const exportPdfReadyHtmlBtn=document.getElementById('exportPdfReadyHtmlBtn');
if(exportPdfReadyHtmlBtn) exportPdfReadyHtmlBtn.addEventListener('click', ()=>exportPdfReadyHtml().catch(err=>alert(err.message || 'Could not save PDF-ready HTML.')));
const printPdfBtn=document.getElementById('printPdfBtn');
if(printPdfBtn) printPdfBtn.addEventListener('click', openPrintablePdf);
document.getElementById('loadDeckBtn').addEventListener('click', ()=>document.getElementById('loadDeckInput').click());
document.getElementById('loadDeckInput').addEventListener('change', async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  try{
    await loadDeckFromFile(file);
    showToast('Loaded editable presentation.');
  }catch(err){
    alert(err.message || 'Could not load this HTML file.');
  }finally{
    e.target.value = '';
  }
});
const loadPresentationJsonBtn = document.getElementById('loadPresentationJsonBtn');
const loadPresentationJsonInput = document.getElementById('loadPresentationJsonInput');
if(loadPresentationJsonBtn && loadPresentationJsonInput){
  loadPresentationJsonBtn.addEventListener('click', ()=>loadPresentationJsonInput.click());
  loadPresentationJsonInput.addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      await loadPresentationJsonFromFile(file);
      showToast('Loaded presentation JSON.');
    }catch(err){
      alert(err.message || 'Could not load this presentation JSON file.');
    }finally{
      e.target.value = '';
    }
  });
}

document.getElementById('importMarkdownBtn')?.addEventListener('click', ()=>{
  try{
    const slidesIn = parseMarkdownToSlides(document.getElementById('importMarkdownText')?.value || '');
    applyImportedSlides(slidesIn, { mode: importModeValue() });
  }catch(err){
    alert(err.message || 'Could not import markdown outline.');
  }
});
document.getElementById('importBeamerBtn')?.addEventListener('click', ()=>{
  try{
    const slidesIn = parseBeamerToSlides(document.getElementById('importBeamerText')?.value || '');
    applyImportedSlides(slidesIn, { mode: importModeValue() });
  }catch(err){
    alert(err.message || 'Could not import LaTeX / Beamer outline.');
  }
});
document.getElementById('importJsonBtn')?.addEventListener('click', ()=>{
  try{
    const slidesIn = parseJsonOutlineToSlides(document.getElementById('importJsonText')?.value || '');
    applyImportedSlides(slidesIn, { mode: importModeValue() });
  }catch(err){
    alert(err.message || 'Could not import JSON outline.');
  }
});
document.getElementById('importPptBtn')?.addEventListener('click', ()=>{
  try{
    const slidesIn = parsePowerPointTextToSlides(document.getElementById('importPptText')?.value || '');
    applyImportedSlides(slidesIn, { mode: importModeValue() });
  }catch(err){
    alert(err.message || 'Could not import PowerPoint-style text.');
  }
});
document.getElementById('importFilesBtn')?.addEventListener('click', async ()=>{
  try{
    const btn = document.getElementById('importFilesBtn');
    if(btn && btn.__luminaStage41SBound) return;
    window.__LUMINA_STAGE41T_LEGACY_IMPORT_CLICK = { at:new Date().toISOString(), fileCount:(document.getElementById('importFilesInput')?.files || []).length }; window.__LUMINA_STAGE41S_LEGACY_IMPORT_CLICK = window.__LUMINA_STAGE41T_LEGACY_IMPORT_CLICK;
    await importSelectedFiles(document.getElementById('importFilesInput')?.files || []);
  }catch(err){
    alert(err.message || 'Could not import selected files.');
  }
});

// Stage 15: UI layout and tab helpers moved to js/ui-stage15.js.


function applySelectedInspectorStylePatch(patch){
  const target = typeof selectedPreviewTarget === 'function' ? selectedPreviewTarget() : null;
  if(target){
    applySelectedPreviewBlockStyle(patch);
    return;
  }
  saveCurrentBlockToDraft();
  const column = blockFields.column.value === 'right' ? 'right' : 'left';
  const idx = selectedBlock && Number.isFinite(Number(selectedBlock[column])) ? Number(selectedBlock[column]) : -1;
  const block = getDraftBlock(column, idx);
  if(!block){
    showToast('Select a slide title or block first.');
    return;
  }
  block.style = normalizeBlockStyle({ ...(block.style || {}), ...(patch || {}) });
  snippetOutput.value = JSON.stringify(slideForSnippet(currentDraftSlide()), null, 2);
  buildPreview();
  scheduleAutosave('Autosaved after block style change.');
}

document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click', ()=>applyPreset(btn.dataset.preset)));
document.querySelectorAll('[data-style-preset]').forEach(btn=>btn.addEventListener('click', ()=>applyStylePreset(btn.dataset.stylePreset)));
document.getElementById('applyStyleBuilderBtn')?.addEventListener('click', applyStyleBuilder);
document.getElementById('randomizeStyleBtn')?.addEventListener('click', randomizeStyleBuilder);
previewBlockFontScale?.addEventListener('input', ()=>{
  const px = Number(previewBlockFontScale.value || 20);
  const fontSize = Number.isFinite(px) ? (Math.max(8, Math.min(120, px)) + 'px') : '';
  applySelectedInspectorStylePatch({ fontSize });
});
previewBlockFontFamily?.addEventListener('change', ()=>applySelectedInspectorStylePatch({ fontFamily: previewBlockFontFamily.value || 'inherit' }));
previewBlockFontColor?.addEventListener('input', ()=>applySelectedInspectorStylePatch({ fontColor: previewBlockFontColor.value || '#111111' }));
previewBlockBulletType?.addEventListener('change', ()=>applySelectedInspectorStylePatch({ bulletType: previewBlockBulletType.value || 'disc' }));
document.getElementById('resetPreviewBlockStyleBtn')?.addEventListener('click', resetSelectedPreviewBlockStyle);
document.getElementById('applyAnimationBtn')?.addEventListener('click', applySelectedAnimation);
document.getElementById('clearAnimationBtn')?.addEventListener('click', clearSelectedAnimation);
document.querySelectorAll('[data-block-template]').forEach(btn=>btn.addEventListener('click', ()=>{
  const kind = btn.dataset.blockTemplate;
  const block = defaultReusableBlock(kind);
  blockFields.mode.value = block.mode;
  blockFields.title.value = block.title || '';
  blockFields.content.value = block.content || '';
  buildPreview();
}));
document.getElementById('saveCurrentBlockToLibraryBtn').addEventListener('click', saveCurrentBlockToLibrary);
document.getElementById('insertLibraryBlockBtn').addEventListener('click', insertSelectedLibraryBlock);
document.getElementById('deleteLibraryBlockBtn').addEventListener('click', deleteSelectedLibraryBlock);
showGridToggle.addEventListener('change', updatePreviewGuides);
showMarginsToggle.addEventListener('change', updatePreviewGuides);
lockAspectToggle.addEventListener('change', ()=>{
  getSelectedFigureBoxes().forEach(box=>{ box.dataset.lockAspect = lockAspectToggle.checked ? '1' : '0'; });
  saveSelectedFigures();
});
document.getElementById('alignFigureLeftBtn').addEventListener('click', ()=>alignSelectedFigures('left'));
document.getElementById('alignFigureCenterBtn').addEventListener('click', ()=>alignSelectedFigures('center'));
document.getElementById('alignFigureRightBtn').addEventListener('click', ()=>alignSelectedFigures('right'));
document.getElementById('alignFigureTopBtn').addEventListener('click', ()=>alignSelectedFigures('top'));
document.getElementById('alignFigureMiddleBtn').addEventListener('click', ()=>alignSelectedFigures('middle'));
document.getElementById('alignFigureBottomBtn').addEventListener('click', ()=>alignSelectedFigures('bottom'));
document.getElementById('distributeFigureHorizBtn').addEventListener('click', ()=>distributeSelectedFigures('x'));
document.getElementById('distributeFigureVertBtn').addEventListener('click', ()=>distributeSelectedFigures('y'));
document.getElementById('snapFigureBtn').addEventListener('click', ()=>{ getSelectedFigureBoxes().forEach(applySnapToBox); saveSelectedFigures(); buildPreview(); });
document.getElementById('bringForwardBtn').addEventListener('click', ()=>bringSelectedFigures(1));
document.getElementById('sendBackwardBtn').addEventListener('click', ()=>bringSelectedFigures(-1));
document.getElementById('cropFigureBtn').addEventListener('click', toggleCropSelectedFigure);
document.getElementById('duplicateFigureBtn').addEventListener('click', duplicateSelectedFigure);
document.getElementById('resetFigureBtn').addEventListener('click', resetSelectedFigure);
// Stage 24C: Copilot UI event binding moved to js/copilot-stage24c.js.
// The main app no longer calls Copilot setup during startup.
loadBlockLibrary();
renderBlockLibrary();
if(expandDiagramSnippet){ expandDiagramSnippet.addEventListener('change', buildPreview); }

if(!restoreAutosave()){
  applyThemeToForm(normalizeTheme({}));
  applyPreset('concept');
  // Stage 38L: on a clean launch, seed the editable deck with the visible
  // default concept slide. Earlier builds showed a preview but left the
  // slide rail/outline with zero items after clearLuminaStorage=1.
  slides = [currentDraftSlide()];
  activeIndex = 0;
  buildPreview();
  renderDeckList();
}
resetUndoRedoHistory();
initPanelTabs();
initUiCleanupLayout();


// Stage 22B: expose a narrow command surface for keyboard shortcuts/command helpers.
window.LuminaAppCommands = {
  buildPreview,
  renderDeckList,
  addSlide,
  updateSlide,
  duplicateSlide,
  deleteSlide,
  moveSlide,
  addBlock,
  updateBlock,
  duplicateBlock,
  deleteBlock,
  moveBlock,
  replaceSelectedBlock,
  clearBlockEditor,
  undo: () => undoHistory(),
  redo: () => redoHistory(),
  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
  resetUndoRedoHistory,
  saveCurrentBlockToDraft,
  saveCurrentSlideToDeck,
  scheduleAutosave,
  persistAutosaveNow,
  showToast,
  closeFigureModal,
  getActiveIndex: () => activeIndex,
  getSlideCount: () => slides.length,
  goToSlide: (idx) => {
    if(!slides.length) return false;
    const next = Math.max(0, Math.min(slides.length - 1, Number(idx) || 0));
    saveCurrentBlockToDraft();
    saveCurrentSlideToDeck();
    activeIndex = next;
    applySlideToForm(slides[activeIndex]);
    buildPreview();
    renderDeckList();
    scheduleAutosave('Autosaved after slide navigation.');
    return true;
  },
  nextSlide: () => window.LuminaAppCommands.goToSlide(activeIndex + 1),
  previousSlide: () => window.LuminaAppCommands.goToSlide(activeIndex - 1)
};

window.addEventListener('beforeunload', ()=>{ try{ persistAutosaveNow('Autosaved.'); }catch(e){} });
window.addEventListener('resize', ()=>updatePreviewScale());

