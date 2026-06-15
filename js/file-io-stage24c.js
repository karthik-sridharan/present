/* Stage 42P file/import workflow helpers: patch-task AI repair avoids backend full-deck validation and preserves source math/figures.
   Classic browser script; exposes window.LuminaFileIo.
   Adds backend extraction plus optional AI Copilot cleanup for PDF/PPTX/PPT imports.
*/
(function(global){
  'use strict';

  function createApi(deps){
    deps = deps || {};
    const {
      clone,
      normalizeSlide,
      fields,
      getDocument,
      getSlides,
      setSlides,
      getActiveIndex,
      setActiveIndex,
      makeReferenceImageSlide,
      makeReferencePdfSlide,
      parseMarkdownToSlides,
      parseBeamerToSlides,
      parseJsonOutlineToSlides,
      parsePowerPointTextToSlides,
      syncPreviewFiguresToDraft,
      saveCurrentBlockToDraft,
      saveCurrentSlideToDeck,
      applySlideToForm,
      clearForm,
      buildPreview,
      renderDeckList,
      scheduleAutosave,
      showToast,
      applyThemeToForm,
      applyPresentationOptions
    } = deps;

    const required = {
      clone,
      normalizeSlide,
      fields,
      getSlides,
      setSlides,
      getActiveIndex,
      setActiveIndex,
      makeReferenceImageSlide,
      makeReferencePdfSlide,
      parseMarkdownToSlides,
      parseBeamerToSlides,
      parseJsonOutlineToSlides,
      parsePowerPointTextToSlides,
      syncPreviewFiguresToDraft,
      saveCurrentBlockToDraft,
      saveCurrentSlideToDeck,
      applySlideToForm,
      clearForm,
      buildPreview,
      renderDeckList,
      scheduleAutosave,
      showToast,
      applyThemeToForm,
      applyPresentationOptions
    };
    Object.keys(required).forEach(name=>{
      if(typeof required[name] === 'undefined' || required[name] === null){
        throw new Error('LuminaFileIo missing dependency: ' + name);
      }
    });

    const STORAGE_ENDPOINT = 'luminaExtractionEndpoint';
    const STORAGE_TOKEN = 'luminaExtractionToken';
    const STORAGE_ENABLED = 'luminaExtractionEnabled';
    const STORAGE_ENGINE = 'luminaExtractionEngine';
    const STORAGE_AI_ENABLED = 'luminaImportAiReviewEnabled';
    const STORAGE_AI_ENDPOINT = 'luminaImportAiEndpoint';
    const STORAGE_AI_TOKEN = 'luminaImportAiToken';
    const STORAGE_AI_PROVIDER = 'luminaImportAiProvider';
    const STORAGE_AI_MODEL = 'luminaImportAiModel';
    const DEFAULT_MAX_IMPORT_PAGES = 80;
    const DEFAULT_MAX_IMPORT_SLIDES = 160;

    function cloneJsonSafe(value){
      try{
        if(typeof clone === 'function') return clone(value);
        return JSON.parse(JSON.stringify(value == null ? null : value));
      }catch(_err){
        if(value && typeof value === 'object'){
          try{ return Array.isArray(value) ? value.slice() : Object.assign({}, value); }catch(_err2){}
        }
        return value;
      }
    }

    function doc(){ return typeof getDocument === 'function' ? getDocument() : global.document; }
    function readFileAsDataUrl(file){
      return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read file: ' + (file && file.name ? file.name : 'unknown file')));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      });
    }
    function storageGet(key, fallback=''){
      try{ return global.localStorage ? (global.localStorage.getItem(key) || fallback || '') : (fallback || ''); }
      catch(_err){ return fallback || ''; }
    }
    function storageSet(key, value){
      try{ if(global.localStorage) global.localStorage.setItem(key, String(value || '')); }
      catch(_err){}
    }
    function deriveAiEndpointFromExtractionEndpoint(endpoint){
      const value = String(endpoint || '').trim();
      if(!value) return '/api/lumina/ai';
      if(/\/api\/lumina\/extract\/?$/i.test(value)) return value.replace(/\/api\/lumina\/extract\/?$/i, '/api/lumina/ai');
      if(/\/api\/lumina\/import\/pdf-docai-semantic\/?$/i.test(value)) return value.replace(/\/api\/lumina\/import\/pdf-docai-semantic\/?$/i, '/api/lumina/ai');
      return '/api/lumina/ai';
    }
    function initExtractionFields(){
      const d = doc();
      const endpoint = d.getElementById('extractionEndpointInput');
      const token = d.getElementById('extractionTokenInput');
      const enabled = d.getElementById('useExtractionBackendCheckbox');
      const aiEnabled = d.getElementById('aiReviewAfterImportCheckbox');
      const engine = d.getElementById('extractionEngineSelect');
      const aiEndpoint = d.getElementById('importAiEndpointInput');
      const aiToken = d.getElementById('importAiTokenInput');
      const aiProvider = d.getElementById('importAiProviderSelect');
      const aiModel = d.getElementById('importAiModelInput');
      if(endpoint && !endpoint.value) endpoint.value = storageGet(STORAGE_ENDPOINT, '/api/lumina/extract');
      if(token && !token.value) token.value = storageGet(STORAGE_TOKEN, '');
      if(enabled && !enabled.__luminaExtractionInit){
        enabled.checked = storageGet(STORAGE_ENABLED, 'true') !== 'false';
        enabled.__luminaExtractionInit = true;
      }
      if(engine && !engine.__luminaExtractionEngineInit){
        engine.value = storageGet(STORAGE_ENGINE, engine.value || 'hybrid') || 'hybrid';
        engine.__luminaExtractionEngineInit = true;
      }
      if(aiEnabled && !aiEnabled.__luminaAiReviewInit){
        aiEnabled.checked = storageGet(STORAGE_AI_ENABLED, 'true') !== 'false';
        aiEnabled.__luminaAiReviewInit = true;
      }
      const derivedAiEndpoint = deriveAiEndpointFromExtractionEndpoint(endpoint && endpoint.value ? endpoint.value : storageGet(STORAGE_ENDPOINT, '/api/lumina/extract'));
      if(aiEndpoint){
        const savedAiEndpoint = storageGet(STORAGE_AI_ENDPOINT, '');
        const currentAiEndpoint = String(aiEndpoint.value || '').trim();
        if(!currentAiEndpoint || (currentAiEndpoint === '/api/lumina/ai' && derivedAiEndpoint !== '/api/lumina/ai')){
          aiEndpoint.value = (savedAiEndpoint && !(savedAiEndpoint === '/api/lumina/ai' && derivedAiEndpoint !== '/api/lumina/ai')) ? savedAiEndpoint : derivedAiEndpoint;
        }
      }
      if(aiToken && !aiToken.value) aiToken.value = storageGet(STORAGE_AI_TOKEN, token && token.value ? token.value : storageGet(STORAGE_TOKEN, ''));
      if(aiProvider && !aiProvider.__luminaAiProviderInit){
        aiProvider.value = storageGet(STORAGE_AI_PROVIDER, aiProvider.value || 'openai') || 'openai';
        aiProvider.__luminaAiProviderInit = true;
      }
      if(aiModel && !aiModel.value) aiModel.value = storageGet(STORAGE_AI_MODEL, 'gpt-4.1-mini');
    }
    function importModeValue(){
      return (doc().getElementById('importModeSelect')?.value || 'append') === 'replace' ? 'replace' : 'append';
    }
    function extractionBackendEnabled(){
      initExtractionFields();
      const el = doc().getElementById('useExtractionBackendCheckbox');
      if(!el) return true;
      storageSet(STORAGE_ENABLED, el.checked ? 'true' : 'false');
      return !!el.checked;
    }
    function extractionEngineValue(){
      initExtractionFields();
      const el = doc().getElementById('extractionEngineSelect');
      let value = String((el && el.value) || storageGet(STORAGE_ENGINE, 'hybrid') || 'hybrid').trim().toLowerCase();
      if(!['pymupdf','pymupdf-math-image','pymupdf-all-image','mineru-pymupdf','marker','hybrid','docai'].includes(value)) value = 'hybrid';
      storageSet(STORAGE_ENGINE, value);
      return value;
    }
    function extractionEndpointValue(){
      initExtractionFields();
      const el = doc().getElementById('extractionEndpointInput');
      const value = String((el && el.value) || storageGet(STORAGE_ENDPOINT, '/api/lumina/extract') || '').trim();
      if(value) storageSet(STORAGE_ENDPOINT, value);
      return value;
    }
    function semanticDocAiEndpointFromExtractionEndpoint(endpoint){
      const raw = String(endpoint || '').trim();
      if(!raw) return '/api/lumina/import/pdf-docai-semantic';
      if(/\/api\/lumina\/extract\/?$/i.test(raw)) return raw.replace(/\/api\/lumina\/extract\/?$/i, '/api/lumina/import/pdf-docai-semantic');
      return raw;
    }
    function effectiveExtractionEndpointForEngine(endpoint, engine){
      const value = String(endpoint || '').trim();
      return String(engine || '').toLowerCase() === 'docai' ? semanticDocAiEndpointFromExtractionEndpoint(value) : value;
    }
    function extractionTokenValue(){
      initExtractionFields();
      const el = doc().getElementById('extractionTokenInput');
      const value = String((el && el.value) || storageGet(STORAGE_TOKEN, '') || '').trim();
      storageSet(STORAGE_TOKEN, value);
      return value;
    }
    function aiReviewAfterImportEnabled(){
      initExtractionFields();
      const el = doc().getElementById('aiReviewAfterImportCheckbox');
      if(!el) return false;
      storageSet(STORAGE_AI_ENABLED, el.checked ? 'true' : 'false');
      return !!el.checked;
    }
    function isDirectProviderAiEndpoint(endpoint){
      return /(?:^|\/)api\.openai\.com\/v1\/(?:responses|chat\/completions)|api\.anthropic\.com\/v1\/messages|generativelanguage\.googleapis\.com/i.test(String(endpoint || ''));
    }
    function looksLikeExtractionEndpoint(endpoint){
      return /\/api\/lumina\/extract\/?$/i.test(String(endpoint || '').trim());
    }
    function isRelativeEndpoint(endpoint){
      return /^\//.test(String(endpoint || '').trim());
    }
    function isHostedOnStaticGithubPages(){
      try{ return /(^|\.)github\.io$/i.test(global.location && global.location.hostname || ''); }catch(_err){ return false; }
    }
    function normalizeAiReviewEndpoint(raw, fallback){
      let value = String(raw || '').trim();
      const fb = String(fallback || '').trim();
      if(!value) value = fb;
      // Stage 41O: users sometimes paste the OpenAI endpoint here. Browser calls to
      // OpenAI/Anthropic/Gemini are blocked by CORS and would expose keys. This field
      // must point to the Lumina Cloud Run proxy instead.
      if(isDirectProviderAiEndpoint(value) || looksLikeExtractionEndpoint(value)) value = fb;
      return value;
    }
    function validateAiReviewEndpointForBrowser(endpoint){
      const value = String(endpoint || '').trim();
      if(!value) throw new Error('Set an AI review endpoint first. Use your Lumina backend URL ending in /api/lumina/ai.');
      if(isDirectProviderAiEndpoint(value)){
        throw new Error('AI review endpoint is set to a direct provider API. Use your Lumina backend endpoint instead, for example https://lumina-backend-y4piylmfja-ue.a.run.app/api/lumina/ai. Do not use https://api.openai.com/v1/responses in the browser.');
      }
      if(looksLikeExtractionEndpoint(value)){
        throw new Error('AI review endpoint is pointing at the extraction endpoint. Change the ending from /api/lumina/extract to /api/lumina/ai.');
      }
      if(isHostedOnStaticGithubPages() && isRelativeEndpoint(value)){
        throw new Error('AI review endpoint is relative (' + value + ') while the app is hosted on GitHub Pages. Use the full Cloud Run URL ending in /api/lumina/ai.');
      }
      if(!/\/api\/lumina\/ai\/?$/i.test(value)){
        throw new Error('AI review endpoint should be your Lumina backend URL ending in /api/lumina/ai. Current value: ' + value);
      }
      return value;
    }
    function aiReviewEndpointValue(){
      initExtractionFields();
      const el = doc().getElementById('importAiEndpointInput');
      const fallback = deriveAiEndpointFromExtractionEndpoint(extractionEndpointValue());
      const stored = storageGet(STORAGE_AI_ENDPOINT, fallback);
      const value = normalizeAiReviewEndpoint((el && el.value) || stored || fallback, fallback);
      if(el && el.value !== value) el.value = value;
      if(value) storageSet(STORAGE_AI_ENDPOINT, value);
      return value;
    }
    function aiReviewTokenValue(){
      initExtractionFields();
      const el = doc().getElementById('importAiTokenInput');
      const fallback = extractionTokenValue();
      const value = String((el && el.value) || storageGet(STORAGE_AI_TOKEN, fallback) || fallback || '').trim();
      storageSet(STORAGE_AI_TOKEN, value);
      return value;
    }
    function aiReviewProviderValue(){
      initExtractionFields();
      const el = doc().getElementById('importAiProviderSelect');
      const value = String((el && el.value) || storageGet(STORAGE_AI_PROVIDER, 'openai') || 'openai').trim().toLowerCase();
      storageSet(STORAGE_AI_PROVIDER, value);
      return value;
    }
    function aiReviewModelValue(){
      initExtractionFields();
      const el = doc().getElementById('importAiModelInput');
      const value = String((el && el.value) || storageGet(STORAGE_AI_MODEL, 'gpt-4.1-mini') || 'gpt-4.1-mini').trim();
      storageSet(STORAGE_AI_MODEL, value);
      return value;
    }
    function stripHugeInlineAssets(text){
      return String(text || '')
        .replace(/data:image\/[^\s"')>]+/gi, '[embedded-image-omitted]')
        .replace(/<img\b[^>]*>/gi, '[image omitted]')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '[svg/custom figure omitted]');
    }
    function stripHtmlForAi(text){
      return String(text || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
    }
    function trunc(text, n){
      const st = String(text || '');
      return st.length > n ? st.slice(0, n) + '…' : st;
    }
    function blockLooksLikeFigure(block){
      const b = block || {};
      const mode = String(b.mode || '').toLowerCase();
      const content = String(b.content || '');
      return /image|figure|diagram|custom/.test(mode) || /<img\b|<svg\b|data:image\//i.test(content) || /\\begin\{figurehtml\}/i.test(content);
    }
    function blockLooksLikeMath(block){
      const b = block || {};
      const content = stripHugeInlineAssets(String(b.content || '')) + ' ' + String(b.title || '');
      const styleFamily = String((b.style && b.style.fontFamily) || '');
      if(/CMR|CMMI|CMSY|CMBX|MSBM|CMEX|Latin Modern|KaTeX|MathJax/i.test(styleFamily)) return true;
      if(/\\\(|\\\[|\$[^$]+\$|\\mathbb|\\operatorname|\\frac|\\sum|\\sigma|\\alpha|\\beta|\\gamma|\\top|\\times|softmax|LayerNorm|W_Q|W_K|W_V|QK|f_w|w_\{|\bR\^|ℝ|∑|σ|α|β|γ|μ|⇥|\b2\s*R\b|(^|[^A-Za-z])imes\b|(^|[^A-Za-z])ext\{|\^\s*op\b|<\/latexit>/i.test(content)) return true;
      if(Array.isArray(b.importRuns) && b.importRuns.some(r => /CMR|CMMI|CMSY|CMBX|MSBM|CMEX/i.test(String(r && r.fontFamily || '')))) return true;
      return false;
    }
    function compactBlockForAi(block){
      const b = block || {};
      const raw = String(b.content || '');
      const isFigure = blockLooksLikeFigure(b);
      const isMath = blockLooksLikeMath(b);
      const stripped = stripHugeInlineAssets(raw);
      const readable = stripHtmlForAi(stripped) || stripped;
      const repaired = isMath ? repairGarbledMathText(readable) : readable;
      const layout = b.layout || b.importSourceLayout || null;
      return {
        mode: String(b.mode || 'panel'),
        title: String(b.title || ''),
        content: trunc(repaired, isFigure ? 650 : 1200),
        isFigure,
        isMath,
        hasLayout: !!layout,
        layout: layout ? { x:layout.x, y:layout.y, w:layout.w, h:layout.h } : null,
        role: b.importRole || '',
        fontSize: b.style && b.style.fontSize || '',
        fontColor: b.style && b.style.fontColor || ''
      };
    }
    function slideSourceTextForAi(blocks){
      const parts = [];
      (blocks || []).forEach(block => {
        if(blockLooksLikeFigure(block)) return;
        const raw = stripHugeInlineAssets(block && block.content || '');
        const readable = stripHtmlForAi(raw) || raw;
        if(readable) parts.push(repairGarbledMathText(readable));
      });
      return trunc(parts.join('\n'), 3600);
    }
    function compactSlidesForAi(slides){
      return (slides || []).map((slide, idx)=>{
        const left = Array.isArray(slide.leftBlocks) ? slide.leftBlocks : [];
        const right = Array.isArray(slide.rightBlocks) ? slide.rightBlocks : [];
        const allBlocks = left.concat(right);
        const compactBlocks = allBlocks.slice(0, 24).map(compactBlockForAi);
        const mathCandidates = allBlocks.filter(blockLooksLikeMath).slice(0, 12).map((b, i)=>({
          index:i + 1,
          title:String(b.title || ''),
          suggested:trunc(repairGarbledMathText(stripHtmlForAi(stripHugeInlineAssets(b.content || '')) || stripHugeInlineAssets(b.content || '')), 900),
          raw:trunc(stripHtmlForAi(stripHugeInlineAssets(b.content || '')) || stripHugeInlineAssets(b.content || ''), 700)
        })).filter(x => x.suggested || x.raw);
        const figureCandidates = allBlocks.filter(blockLooksLikeFigure).slice(0, 8).map((b, i)=>({
          index:i + 1,
          mode:String(b.mode || ''),
          title:String(b.title || ''),
          contentHint:trunc(stripHtmlForAi(stripHugeInlineAssets(b.content || '')) || '[visual/figure content omitted; reconstruct as clean SVG/HTML if useful]', 700),
          layout:b.layout ? { x:b.layout.x, y:b.layout.y, w:b.layout.w, h:b.layout.h } : null
        }));
        return {
          index: idx + 1,
          slideType: slide.slideType || 'single',
          title: String(slide.title || ''),
          kicker: String(slide.kicker || ''),
          lede: trunc(slide.lede || '', 700),
          sourceText: slideSourceTextForAi(allBlocks),
          originalBlockCount: allBlocks.length,
          mathCandidateCount: mathCandidates.length,
          figureCandidateCount: figureCandidates.length,
          mathCandidates,
          figureCandidates,
          blocks: compactBlocks,
          notes: trunc((slide.notesTitle ? slide.notesTitle + ': ' : '') + (slide.notesBody || ''), 700)
        };
      });
    }
    const AI_IMPORT_REVIEW_PROMPT_PATH = 'prompt/ai_import_review_prompt.txt';
    const AI_IMPORT_REPAIR_PROMPT_PATH = 'prompt/ai_import_repair_prompt.txt';
    const DEFAULT_AI_IMPORT_REVIEW_PROMPT = String.raw`You are repairing an imported Lumina Presentation Maker deck.

IMPORTANT: Return a SMALL JSON PATCH, not a full deck.
Do not redesign the deck. Do not summarize the deck. Do not remove slides. Do not recreate images.
The app already loaded the source-extracted slides and will apply your patches deterministically.

Input:
- A source Lumina deck summary with one source slide per imported slide.
- Each block has a stable __aiSourceBlockId.
- Figure/image blocks are already preserved by the app; you should patch only their layout if clearly needed.
- Some text/math blocks contain PDF/OCR math corruption.

Output:
Return ONLY valid JSON of this form:
{
  "patches": [
    {
      "slideIndex": 0,
      "blockId": "s1-left-2",
      "content": "repaired text/math content",
      "layout": {"x": 120, "y": 180, "w": 520, "h": 90},
      "reason": "short reason"
    }
  ]
}

Rules:
1. Include a patch only for a block or slide field that actually needs repair.
2. For text/math blocks, repair garbled math.
3. Inline math must use: $ math goes here $
4. Displayed equations must use: \[ math goes here \]
5. Do not leave math as broken plain text.
6. Fix common extraction/OCR math errors:
   - " imes" or "⇥" -> "\\times"
   - " ext{" -> "\\text{"
   - " op" used as transpose -> "\\top"
   - "2 R" or "2 ℝ" used as membership -> "\\in \\mathbb{R}"
   - "QK^ op" -> "QK^\\top"
   - "ﬁ" -> "fi"
   - remove "</latexit>" fragments and base64/LaTeX debris
7. For figure/image blocks, do not include image data or placeholders. Only include a layout patch if the image is clearly too small, stretched, clipped, or misplaced.
8. Preserve freeform placement. Make only small x/y/w/h repairs to avoid overlaps, clipped equations, or wrong image sizing.
9. If no changes are needed, return {"patches":[]}.
10. Every LaTeX backslash in JSON strings must be escaped, e.g. "\\times", "\\text{}", "\\top", "\\operatorname{}".

Return the patch JSON only. Do not wrap in markdown.`;
    const DEFAULT_AI_IMPORT_REPAIR_PROMPT = String.raw`Your previous Lumina import repair patch JSON had these problems:
{{PROBLEMS}}

Repair the PATCH JSON only. Do not return a full deck. Do not redesign the deck.
Return ONLY valid JSON of the form {"patches":[...]}.
Use inline math as $ math goes here $ and displayed equations as \[ math goes here \].
Ensure every LaTeX backslash is JSON-escaped: use "\\times", "\\text{}", "\\top", "\\operatorname{}" inside JSON strings.

Source context:
{{SOURCE_CONTEXT}}

Previous output to repair:
{{PREVIOUS_OUTPUT}}`;
    const editableAiPromptCache = Object.create(null);
    function editablePromptUrl(path){
      const raw = String(path || '');
      try{ return new URL(raw, (global && global.location && global.location.href) || (document && document.baseURI) || '').toString(); }
      catch(_err){ return raw; }
    }
    async function loadEditableAiPrompt(path, fallback){
      const key = String(path || '');
      const fallbackText = String(fallback || '');
      if(!key || typeof fetch !== 'function') return editableAiPromptCache[key] || fallbackText;
      try{
        const sep = key.indexOf('?') >= 0 ? '&' : '?';
        const url = editablePromptUrl(key + sep + 'stage=stage43an-rate-limit-backoff-chunked-image-blob-20260517-1&promptCacheBust=' + Date.now());
        const res = await fetch(url, { cache:'no-store' });
        if(!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if(String(text || '').trim()){
          editableAiPromptCache[key] = text;
          try{ global.__LUMINA_STAGE41Q_LAST_PROMPT_LOAD = Object.assign(global.__LUMINA_STAGE41Q_LAST_PROMPT_LOAD || {}, { [key]: { ok:true, url, length:text.length, at:new Date().toISOString() } }); }catch(_err){}
          return text;
        }
      }catch(err){
        try{ global.__LUMINA_STAGE41Q_LAST_PROMPT_LOAD = Object.assign(global.__LUMINA_STAGE41Q_LAST_PROMPT_LOAD || {}, { [key]: { ok:false, error:err && err.message ? err.message : String(err), fallback:true, at:new Date().toISOString() } }); }catch(_err){}
      }
      return editableAiPromptCache[key] || fallbackText;
    }
    async function aiDeckSystemPrompt(){
      return loadEditableAiPrompt(AI_IMPORT_REVIEW_PROMPT_PATH, DEFAULT_AI_IMPORT_REVIEW_PROMPT);
    }
    function sourceExpectationsForAi(slides){
      const compactSlides = compactSlidesForAi(slides);
      const conceptKeywords = /attention|transformer|self-attention|token|embed|embedding|pool|convolution|convnet|residual|normalization|layernorm|feed-forward|multi-head/i;
      return {
        sourceSlideCount: compactSlides.length,
        slidesWithMath: compactSlides.filter(sl => sl.mathCandidateCount > 0).length,
        slidesWithFigures: compactSlides.filter(sl => sl.figureCandidateCount > 0).length,
        totalMathCandidates: compactSlides.reduce((n, sl) => n + (sl.mathCandidateCount || 0), 0),
        totalFigureCandidates: compactSlides.reduce((n, sl) => n + (sl.figureCandidateCount || 0), 0),
        conceptSlides: compactSlides.filter(sl => conceptKeywords.test([sl.title, sl.sourceText].join(' '))).length
      };
    }
    function aiDeckUserPrompt(deckTitle, slides){
      addAiSourceIdsToSourceSlides(slides || []);
      const payload = simpleAiRepairSourceDeckForAi(deckTitle, slides || []);
      return [
        'Repair this imported Lumina deck conservatively. Do not redesign it.',
        'For each slide and each block, fix garbled math, use the requested math delimiters, preserve image assets, and make only small layout/size repairs.',
        'Return ONLY JSON patch data of the form {"patches":[...]}. Preserve __aiSourceBlockId/blockId in every block patch so the app can apply changes to the source-extracted slides.',
        JSON.stringify(payload, null, 2)
      ].join('\n\n');
    }

    function deterministicAiSourceBlockId(slideIndex, column, blockIndex){
      return 's' + (slideIndex + 1) + '-' + String(column || 'left') + '-' + (blockIndex + 1);
    }
    function aiRepairBlockPayload(block, slideIndex, column, blockIndex){
      const b = block || {};
      const id = String(b.__aiSourceBlockId || deterministicAiSourceBlockId(slideIndex, column, blockIndex));
      const isFigure = blockLooksLikeFigure(b);
      let content = String(b.content || '');
      if(isFigure){
        content = stripHugeInlineAssets(content);
        if(!content || /\[large inline image omitted\]/i.test(content) || /\[image omitted\]/i.test(content) || /\[embedded-image-omitted\]/i.test(content)){
          content = '[source image/figure preserved by app; do not replace or delete; adjust layout only if needed]';
        }
      } else {
        content = repairGarbledMathText(stripHtmlForAi(stripHugeInlineAssets(content)) || stripHugeInlineAssets(content));
      }
      return {
        __aiSourceBlockId:id,
        blockId:id,
        sourceColumn:column,
        sourceBlockIndex:blockIndex,
        mode:String(b.mode || 'panel'),
        title:String(b.title || ''),
        content:content,
        layout:b.layout || null,
        importSourceLayout:b.importSourceLayout || null,
        importRole:b.importRole || '',
        style:b.style || {},
        animation:b.animation || {},
        isFigure:!!isFigure,
        preserveOriginalAsset:!!isFigure,
        repairInstruction:isFigure
          ? 'Preserve this source image/figure asset. Patch layout only if clearly needed; do not return image data.'
          : 'Repair OCR/PDF math corruption if present; keep placement similar to source.'
      };
    }
    function simpleAiRepairSourceDeckForAi(deckTitle, slides){
      const sourceSlides = Array.isArray(slides) ? slides : [];
      return {
        task:'simple-import-repair',
        deckTitle:deckTitle || 'Imported deck',
        sourceSlideCount:sourceSlides.length,
        rules:{
          outputFormat:'json-patches-only',
          preserveSlideCount:true,
          preserveBlockIds:true,
          preserveImages:true,
          conservativeLayoutRepair:true,
          inlineMathDelimiter:'$ math goes here $',
          displayedEquationDelimiter:'\\[ math goes here \\]'
        },
        slides:sourceSlides.map(function(slide, slideIndex){
          const left = Array.isArray(slide && slide.leftBlocks) ? slide.leftBlocks : [];
          const right = Array.isArray(slide && slide.rightBlocks) ? slide.rightBlocks : [];
          return {
            __aiSourceSlideIndex:slideIndex,
            slideIndex:slideIndex,
            slideNumber:slideIndex + 1,
            slideType:String(slide && slide.slideType || 'single'),
            title:String(slide && slide.title || ''),
            kicker:String(slide && slide.kicker || ''),
            lede:String(slide && slide.lede || ''),
            importMeta:(slide && slide.importMeta) || null,
            sourceWidth:slide && slide.importMeta && slide.importMeta.sourceWidth || null,
            sourceHeight:slide && slide.importMeta && slide.importMeta.sourceHeight || null,
            leftBlocks:left.map(function(block, blockIndex){ return aiRepairBlockPayload(block, slideIndex, 'left', blockIndex); }),
            rightBlocks:right.map(function(block, blockIndex){ return aiRepairBlockPayload(block, slideIndex, 'right', blockIndex); })
          };
        })
      };
    }
    function addAiSourceIdsToSourceSlides(slides){
      (Array.isArray(slides) ? slides : []).forEach(function(slide, slideIndex){
        ['leftBlocks','rightBlocks'].forEach(function(key){
          const arr = Array.isArray(slide && slide[key]) ? slide[key] : [];
          const col = key === 'rightBlocks' ? 'right' : 'left';
          arr.forEach(function(block, blockIndex){
            if(block && !block.__aiSourceBlockId) block.__aiSourceBlockId = deterministicAiSourceBlockId(slideIndex, col, blockIndex);
          });
        });
      });
      return slides;
    }
    function sourceBlockMapForSimpleRepair(sourceSlides){
      const map = Object.create(null);
      (Array.isArray(sourceSlides) ? sourceSlides : []).forEach(function(slide, slideIndex){
        ['leftBlocks','rightBlocks'].forEach(function(key){
          const arr = Array.isArray(slide && slide[key]) ? slide[key] : [];
          const col = key === 'rightBlocks' ? 'right' : 'left';
          arr.forEach(function(block, blockIndex){
            const id = String(block && block.__aiSourceBlockId || deterministicAiSourceBlockId(slideIndex, col, blockIndex));
            map[id] = { slideIndex, column:col, blockIndex, block:block || {} };
          });
        });
      });
      return map;
    }
    function blockHasRealImageAsset(content){
      return /<img\b[^>]*\bsrc=["']data:image\//i.test(String(content || '')) || /data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(content || ''));
    }
    function repairSimpleMathContainerText(content){
      let s = repairGarbledMathText(content);
      if(/^(EQ|Equation)\s*:/i.test(s)){
        let body = s.replace(/^(EQ|Equation)\s*:\s*/i, '').trim();
        if(body && !/^\$.*\$$/.test(body) && !/^\\\(.*\\\)$/.test(body) && !/^\\\[.*\\\]$/.test(body)){
          s = '\\[' + body + '\\]';
        }
      }
      return s;
    }
    function mergeSimpleAiRepairWithSource(deck, sourceSlides){
      if(!deck || !Array.isArray(deck.slides) || !Array.isArray(sourceSlides)) return deck;
      addAiSourceIdsToSourceSlides(sourceSlides);
      const sourceMap = sourceBlockMapForSimpleRepair(sourceSlides);
      const stats = { stage:'stage43an-rate-limit-backoff-chunked-image-blob-20260517-1', sourceSlides:sourceSlides.length, outputSlides:deck.slides.length, imageAssetsRestored:0, layoutsPreserved:0, blocksRestored:0, slidesRestored:0, mathFieldsRepaired:0, at:new Date().toISOString() };
      const outputSlides = [];
      const maxSlides = Math.max(sourceSlides.length, deck.slides.length);
      for(let si = 0; si < maxSlides; si++){
        const sourceSlide = sourceSlides[si] || null;
        let outSlide = deck.slides[si] || null;
        if(!outSlide && sourceSlide){
          outSlide = cloneJsonSafe(sourceSlide);
          stats.slidesRestored += 1;
        }
        if(!outSlide) continue;
        if(sourceSlide){
          outSlide.slideType = outSlide.slideType || sourceSlide.slideType || 'single';
          outSlide.headingLevel = outSlide.headingLevel || sourceSlide.headingLevel || 'h2';
          outSlide.importMeta = outSlide.importMeta || cloneJsonSafe(sourceSlide.importMeta || null);
          outSlide.bgColor = outSlide.bgColor || sourceSlide.bgColor || '#ffffff';
          outSlide.fontColor = outSlide.fontColor || sourceSlide.fontColor || '#111111';
        }
        const used = Object.create(null);
        function mergeColumn(key){
          const arr = Array.isArray(outSlide[key]) ? outSlide[key] : [];
          const col = key === 'rightBlocks' ? 'right' : 'left';
          const merged = arr.map(function(aiBlock, bi){
            aiBlock = aiBlock || {};
            const id = String(aiBlock.__aiSourceBlockId || aiBlock.sourceBlockId || aiBlock.blockId || deterministicAiSourceBlockId(si, col, bi));
            const srcInfo = sourceMap[id];
            if(srcInfo) used[id] = true;
            if(!srcInfo){
              if(typeof aiBlock.content === 'string' && !blockLooksLikeFigure(aiBlock)){
                const before = aiBlock.content;
                aiBlock.content = repairSimpleMathContainerText(before);
                if(before !== aiBlock.content) stats.mathFieldsRepaired += 1;
              }
              return aiBlock;
            }
            const srcBlock = srcInfo.block || {};
            const out = Object.assign({}, aiBlock);
            out.__aiSourceBlockId = id;
            out.style = Object.assign({}, srcBlock.style || {}, aiBlock.style || {});
            out.animation = Object.assign({}, srcBlock.animation || {}, aiBlock.animation || {});
            out.layout = aiBlock.layout || cloneJsonSafe(srcBlock.layout || null);
            out.importSourceLayout = aiBlock.importSourceLayout || cloneJsonSafe(srcBlock.importSourceLayout || null);
            if(!aiBlock.layout && srcBlock.layout) stats.layoutsPreserved += 1;
            if(blockLooksLikeFigure(srcBlock)){
              const aiContent = String(aiBlock.content || '');
              out.mode = srcBlock.mode || aiBlock.mode || 'import-image';
              out.content = blockHasRealImageAsset(aiContent) ? aiContent : String(srcBlock.content || '');
              out.title = String(aiBlock.title || srcBlock.title || 'Figure');
              out.importRole = srcBlock.importRole || aiBlock.importRole || 'source-figure';
              if(out.content === String(srcBlock.content || '')) stats.imageAssetsRestored += 1;
            } else {
              out.mode = String(aiBlock.mode || srcBlock.mode || 'panel');
              out.title = String(aiBlock.title || srcBlock.title || '');
              const before = String(aiBlock.content || srcBlock.content || '');
              out.content = repairSimpleMathContainerText(before);
              if(before !== out.content) stats.mathFieldsRepaired += 1;
            }
            return out;
          });
          if(sourceSlide){
            const sourceArr = Array.isArray(sourceSlide[key]) ? sourceSlide[key] : [];
            sourceArr.forEach(function(srcBlock, bi){
              const id = String(srcBlock && srcBlock.__aiSourceBlockId || deterministicAiSourceBlockId(si, col, bi));
              if(used[id]) return;
              const restored = cloneJsonSafe(srcBlock);
              restored.__aiSourceBlockId = id;
              if(!blockLooksLikeFigure(restored) && typeof restored.content === 'string') restored.content = repairSimpleMathContainerText(restored.content);
              restored.__stage42iRestoredMissingSourceBlock = true;
              merged.push(restored);
              used[id] = true;
              stats.blocksRestored += 1;
            });
          }
          outSlide[key] = merged;
        }
        mergeColumn('leftBlocks');
        mergeColumn('rightBlocks');
        if(sourceSlide && sourceSlide.importChoiceMode === 'image'){
          try{ outSlide = normalizeSlide(stripImportReviewInternals(cloneJsonSafe(sourceSlide))); stats.slidesRestored += 1; }catch(_err){}
        }
        outputSlides.push(outSlide);
      }
      deck.slides = outputSlides;
      repairAiImportDeckMath(deck);
      try{ globalThis.__LUMINA_STAGE42I_CLASSIC_AI_IMPORT_REPAIR = stats; globalThis.__LUMINA_STAGE42C_SIMPLE_AI_IMPORT_REPAIR = stats; }catch(_err){}
      return deck;
    }
    function extractJsonText(text){
      let s = String(text || '').trim();
      const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if(fence) s = fence[1].trim();
      const first = s.indexOf('{');
      const last = s.lastIndexOf('}');
      if(first >= 0 && last > first) s = s.slice(first, last + 1);
      return s;
    }
    function wrapCustomHtmlIfNeeded(content){
      const raw = String(content || '').trim();
      if(!raw) return '<!doctype html><html><body></body></html>';
      if(/<!doctype/i.test(raw) || /<html[\s>]/i.test(raw)) return raw;
      return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Inter,Arial,sans-serif}*{box-sizing:border-box}</style></head><body>' + raw + '</body></html>';
    }
    function normalizeAiReviewDeck(parsed, fallbackTitle){
      const deck = parsed && Array.isArray(parsed.slides) ? parsed : (parsed && parsed.deck && Array.isArray(parsed.deck.slides) ? parsed.deck : parsed);
      if(!deck || !Array.isArray(deck.slides) || !deck.slides.length) throw new Error('AI did not return a deck with a slides array.');
      const cleanSlides = deck.slides.map((slide, i)=>{
        const s = Object.assign({}, slide || {});
        s.slideType = ['title-center','single','two-col'].includes(String(s.slideType || '')) ? s.slideType : 'two-col';
        s.headingLevel = s.headingLevel || (s.slideType === 'title-center' ? 'h1' : 'h2');
        s.title = String(s.title || ('Slide ' + (i + 1)));
        s.kicker = String(s.kicker || '');
        s.lede = String(s.lede || '');
        function cleanBlock(block){
          const b = Object.assign({}, block || {});
          b.mode = String(b.mode || 'panel');
          if(b.mode === 'html') b.mode = 'custom';
          b.title = String(b.title || '');
          b.content = String(b.content || '');
          if(b.mode === 'custom') b.content = wrapCustomHtmlIfNeeded(b.content);
          b.style = Object.assign({ fontScale:1, fontSize:'', fontFamily:'inherit', fontColor:'#111111', bulletType:'disc' }, b.style || {});
          b.animation = Object.assign({ buildIn:'none', buildOut:'none', stepMode:'all', order:0 }, b.animation || {});
          return b;
        }
        s.leftBlocks = Array.isArray(s.leftBlocks) ? s.leftBlocks.map(cleanBlock) : [];
        s.rightBlocks = s.slideType === 'two-col' && Array.isArray(s.rightBlocks) ? s.rightBlocks.map(cleanBlock) : [];
        if(!s.leftBlocks.length) s.leftBlocks = [{ mode:'panel', title:'Main idea', content:s.lede || s.title }].map(cleanBlock);
        s.bgColor = s.bgColor || '#ffffff';
        s.fontColor = s.fontColor || '#111111';
        s.inheritTheme = s.inheritTheme !== false;
        return s;
      });
      return {
        deckTitle: String(deck.deckTitle || fallbackTitle || 'AI-cleaned imported deck'),
        theme: deck.theme || null,
        presentationOptions: deck.presentationOptions || null,
        summary: String(deck.summary || 'AI cleaned the imported deck.'),
        slides: cleanSlides
      };
    }
    function repairGarbledMathText(value){
      let s = String(value == null ? '' : value);
      if(!s) return s;
      // Repair the most common PDF/OCR + JSON-escape failures that turn LaTeX into visible garbage.
      // These are deliberately conservative and are applied only to deck text fields, not raw HTML/CSS.
      s = s.replace(/[A-Za-z0-9+/]{18,}<\/latexit>/gi, '');
      s = s.replace(/<\/latexit>/gi, '');
      s = s.replace(/\uFB01/g, 'fi').replace(/ﬁ/g, 'fi');
      s = s.replace(/⇥/g, '\\times');
      s = s.replace(/\t+imes\b/g, '\\times');
      s = s.replace(/\t+ext\s*\{/g, '\\text{');
      s = s.replace(/\t+op\b/g, '\\top');
      s = s.replace(/\t+operatorname\s*\{/g, '\\operatorname{');
      s = s.replace(/\t+mathbb\s*\{/g, '\\mathbb{');
      s = s.replace(/(^|[^A-Za-z])imes\b/g, '$1\\times');
      s = s.replace(/(^|[^A-Za-z])ext\s*\{/g, '$1\\text{');
      s = s.replace(/\^\s*op\b/g, '^\\top');
      s = s.replace(/\bQK\^\s*op\b/g, 'QK^\\top');
      s = s.replace(/(^|[^A-Za-z])operatorname\s*\{/g, '$1\\operatorname{');
      s = s.replace(/(^|[^A-Za-z])mathbb\s*\{/g, '$1\\mathbb{');
      s = s.replace(/(^|[^A-Za-z])frac\s*\{/g, '$1\\frac{');
      s = s.replace(/\b2\s*\{/g, '\\in \\{');
      s = s.replace(/\b2\s*R\s*(\d+|[nmdkr])\s*(?:\\times|×|x)\s*(\d+|[nmdkr])\b/g, '\\in \\mathbb{R}^{$1 \\times $2}');
      s = s.replace(/\b2\s*R\s*\^\s*\{?\s*([^}\s]+)\s*\}?/g, '\\in \\mathbb{R}^{$1}');
      s = s.replace(/\b2\s*R\s*(\d+|[nmdkr])\b/g, '\\in \\mathbb{R}^$1');
      s = s.replace(/\b2\s*R\b/g, '\\in \\mathbb{R}');
      s = s.replace(/(^|[\s({=,\[])(?:R|ℝ)\s*(\d+|[nmdkr])\s*(?:\\times|×|x)\s*(\d+|[nmdkr])\b/g, '$1\\mathbb{R}^{$2 \\times $3}');
      s = s.replace(/(^|[\s({=,\[])(?:R|ℝ)\s*\^\s*\{?\s*(\d+|[nmdkr])\s*(?:\\times|×|x)\s*(\d+|[nmdkr])\s*\}?/g, '$1\\mathbb{R}^{$2 \\times $3}');
      s = s.replace(/(^|[\s({=,\[])(?:R|ℝ)\s*\^\s*\{?\s*([^}\s]+)\s*\}?/g, '$1\\mathbb{R}^{$2}');
      s = s.replace(/(^|[\s({=,\[])(?:R|ℝ)\s*(\d+|[nmdkr])\b/g, '$1\\mathbb{R}^$2');
      s = s.replace(/\bfw\(([^)]*)\)/g, 'f_w($1)');
      s = s.replace(/\bf\s*~\s*w/g, 'f_{\\tilde w}');
      s = s.replace(/~\s*w/g, '\\tilde{w}');
      s = s.replace(/wfilter/g, 'w_{\\text{filter}}');
      s = s.replace(/w\s*filter/g, 'w_{\\text{filter}}');
      s = s.replace(/filter\s+2\s+R/g, 'filter \\in \\mathbb{R}');
      s = s.replace(/\bpositive\s*,\s*negative\b/g, '\\text{positive}, \\text{negative}');
      s = s.replace(/\s{2,}/g, ' ');
      return s.trim();
    }
    function repairCustomHtmlSizing(content){
      let s = String(content == null ? '' : content);
      if(!s) return s;
      // Keep iframe animations responsive. Do not rewrite pedagogical labels inside SVG/HTML.
      s = s.replace(/body\s*\{([^}]*)min-height\s*:\s*720px\s*;?/gi, 'body {$1height:100%;');
      s = s.replace(/\.stage\s*\{([^}]*)height\s*:\s*720px\s*;?/gi, '.stage {$1height:100%;');
      s = s.replace(/\.custom-frame\s*\{([^}]*)height\s*:\s*720px\s*;?/gi, '.custom-frame {$1height:100%;');
      if(/<style[\s\S]*?>/i.test(s) && !/html\s*,\s*body\s*\{[^}]*height\s*:\s*100%/i.test(s)){
        s = s.replace(/<style([\s\S]*?)>/i, '<style$1>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;}');
      }
      if(/<svg\b/i.test(s) && !/svg\s*\{[^}]*max-height\s*:\s*100%/i.test(s)){
        s = s.replace(/<style([\s\S]*?)>/i, '<style$1>svg{width:100%;height:100%;max-width:100%;max-height:100%;}');
      }
      return s;
    }
    function repairAiImportDeckMath(deck){
      if(!deck || !Array.isArray(deck.slides)) return deck;
      let repairedCount = 0;
      const changes = [];
      function compact(value, maxLen){
        var s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
        maxLen = Math.max(24, Number(maxLen || 90));
        return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
      }
      function slideTitle(slide, slideIndex){
        return compact(slide && (slide.title || slide.kicker || slide.lede || slide.notesTitle) || '', 70) || ('Slide ' + (Number(slideIndex || 0) + 1));
      }
      function blockLabel(block, blockIndex){
        var idx = Number(blockIndex || 0) + 1;
        var kind = block && (block.type || block.kind || block.role) || '';
        var title = compact(block && (block.title || block.label) || '', 40);
        return 'block ' + idx + (kind ? ' (' + kind + ')' : '') + (title ? ': ' + title : '');
      }
      function recordRepair(ctx, summary){
        repairedCount += 1;
        if(!ctx || ctx.slideIndex == null) return;
        changes.push({
          slideIndex: Number(ctx.slideIndex) || 0,
          slideNumber: (Number(ctx.slideIndex) || 0) + 1,
          title: slideTitle(ctx.slide, ctx.slideIndex),
          column: ctx.key || '',
          blockIndex: ctx.blockIndex == null ? null : Number(ctx.blockIndex),
          field: ctx.field || '',
          summary: compact(summary, 140)
        });
      }
      function repairField(obj, key, ctx){
        if(!obj || typeof obj[key] !== 'string') return;
        const before = obj[key];
        const after = repairGarbledMathText(before);
        if(after !== before){
          obj[key] = after;
          var label = ctx && ctx.block ? blockLabel(ctx.block, ctx.blockIndex) : 'slide';
          recordRepair(Object.assign({}, ctx || {}, { field:key }), 'Repaired math/text in ' + label + ' field "' + key + '"');
        }
      }
      const titleBefore = deck.deckTitle || 'AI-cleaned imported deck';
      const titleAfter = repairGarbledMathText(titleBefore);
      if(titleAfter !== titleBefore){ deck.deckTitle = titleAfter; repairedCount += 1; }
      else deck.deckTitle = titleAfter;
      deck.slides.forEach((slide, slideIndex)=>{
        ['title','kicker','lede','notesTitle','notesBody'].forEach(function(field){ repairField(slide, field, { slide, slideIndex, key:'slide', block:null, blockIndex:null }); });
        [['leftBlocks','left'], ['rightBlocks','right']].forEach(function(pair){
          const key = pair[0];
          const blocks = Array.isArray(slide && slide[key]) ? slide[key] : [];
          blocks.forEach(function(block, blockIndex){
            const ctx = { slide, slideIndex, key, block, blockIndex };
            repairField(block, 'title', ctx);
            if(blockLooksLikeFigure(block)){
              if(String(block && block.mode || '') === 'custom'){
                const before = String(block.content || '');
                const after = repairCustomHtmlSizing(before);
                if(after !== before){ block.content = after; recordRepair(Object.assign({}, ctx, { field:'content' }), 'Repaired custom figure/HTML sizing in ' + blockLabel(block, blockIndex)); }
              }
              return;
            }
            if(String(block && block.mode || '') === 'custom'){
              const before = String(block.content || '');
              const after = repairCustomHtmlSizing(before);
              if(after !== before){ block.content = after; recordRepair(Object.assign({}, ctx, { field:'content' }), 'Repaired custom HTML sizing in ' + blockLabel(block, blockIndex)); }
            } else {
              repairField(block, 'content', ctx);
            }
          });
        });
      });
      const changedSlideKeys = {};
      changes.forEach(function(change){ changedSlideKeys[String(change.slideIndex)] = true; });
      const changeSummary = changes.length ? changes.slice(0, 20).map(function(change){ return 'Slide ' + change.slideNumber + ': ' + change.summary; }).join(' | ') : '';
      try{ globalThis.__LUMINA_STAGE41R_LAST_MATH_REPAIR = { repairedCount, changes, changedSlideCount:Object.keys(changedSlideKeys).length, changeSummary, at:new Date().toISOString() }; }catch(_err){}
      try{ global.__LUMINA_STAGE41R_LAST_MATH_REPAIR = globalThis.__LUMINA_STAGE41R_LAST_MATH_REPAIR; }catch(_err){}
      return deck;
    }
    const AI_IMPORT_BAD_PATTERNS = [
      { label:'literal </latexit> fragment', re:/<\/latexit>/i },
      { label:'broken LaTeX \\times rendered as imes', re:/(^|[^a-zA-Z])imes\b/ },
      { label:'broken LaTeX \\text rendered as ext{...}', re:/(^|[^a-zA-Z])ext\{/ },
      { label:'broken LaTeX \\top rendered as op', re:/(^|[^a-zA-Z])op\b/ },
      { label:'bad multiplication glyph ⇥', re:/⇥/ },
      { label:'fi ligature ﬁ', re:/ﬁ/ },
      { label:'huge base64 image still present', re:/data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]{80000,}/i }
    ];
    function collectAiDeckText(deck){
      const parts = [];
      try{
        if(deck && deck.deckTitle) parts.push(deck.deckTitle);
        const slides = deck && Array.isArray(deck.slides) ? deck.slides : [];
        slides.forEach(slide=>{
          ['title','kicker','lede','notesTitle','notesBody'].forEach(k=>{ if(slide && slide[k]) parts.push(slide[k]); });
          const blocks = [].concat(Array.isArray(slide && slide.leftBlocks) ? slide.leftBlocks : [], Array.isArray(slide && slide.rightBlocks) ? slide.rightBlocks : []);
          blocks.forEach(block=>{
            if(block && block.title) parts.push(block.title);
            const content = String(block && block.content || '');
            parts.push(blockLooksLikeFigure(block) ? stripHugeInlineAssets(content) : content);
          });
        });
        return parts.join('\n');
      }catch(_err){ return stripHugeInlineAssets(String(deck || '')); }
    }
    function findAiImportDeckProblems(deck, rawText){
      const text = String(rawText || '') + '\n' + collectAiDeckText(deck);
      const found = [];
      AI_IMPORT_BAD_PATTERNS.forEach(item=>{ if(item.re.test(text)) found.push(item.label); });
      const slides = deck && Array.isArray(deck.slides) ? deck.slides : [];
      slides.forEach((slide, slideIndex)=>{
        const blocks = [].concat(Array.isArray(slide.leftBlocks) ? slide.leftBlocks : [], Array.isArray(slide.rightBlocks) ? slide.rightBlocks : []);
        blocks.forEach((block, blockIndex)=>{
          if(String(block && block.mode || '') !== 'custom') return;
          const content = String(block.content || '');
          if(/<script\b/i.test(content)) found.push('custom block has <script> on slide ' + (slideIndex + 1));
          if(/<iframe\b/i.test(content)) found.push('custom block contains nested iframe on slide ' + (slideIndex + 1));
          if(/https?:\/\//i.test(content)) found.push('custom block uses external URL on slide ' + (slideIndex + 1));
          if(/min-height\s*:\s*720px/i.test(content)) found.push('custom block uses body/stage min-height:720px on slide ' + (slideIndex + 1));
          if(/\.stage\s*\{[^}]*height\s*:\s*720px/i.test(content) && String(slide.slideType) === 'two-col') found.push('two-column custom animation uses fixed 720px stage height on slide ' + (slideIndex + 1));
          if(!content.trim()) found.push('custom block is empty on slide ' + (slideIndex + 1) + ', block ' + (blockIndex + 1));
        });
      });
      return Array.from(new Set(found)).slice(0, 30);
    }
    function deckBlockLooksLikeMath(block){
      return blockLooksLikeMath(block) || /\\\(|\\\[|\\mathbb|\\times|\\top|\\operatorname|\\frac|\\sum|\$[^$]+\$|EQ:/i.test(String(block && block.content || ''));
    }
    function deckBlockLooksLikeVisual(block){
      const mode = String(block && block.mode || '').toLowerCase();
      const content = String(block && block.content || '');
      return mode === 'custom' || mode === 'diagram' || /figure|image/.test(mode) || /<svg\b|<img\b|\\begin\{figurehtml\}/i.test(content);
    }
    function deckFeatureSummary(deck){
      const slides = deck && Array.isArray(deck.slides) ? deck.slides : [];
      let mathBlockCount = 0;
      let visualBlockCount = 0;
      let customBlockCount = 0;
      const slidesWithMath = new Set();
      const slidesWithVisuals = new Set();
      slides.forEach((slide, si)=>{
        const blocks = [].concat(Array.isArray(slide.leftBlocks) ? slide.leftBlocks : [], Array.isArray(slide.rightBlocks) ? slide.rightBlocks : []);
        blocks.forEach(block=>{
          if(deckBlockLooksLikeMath(block)){ mathBlockCount += 1; slidesWithMath.add(si); }
          if(deckBlockLooksLikeVisual(block)){ visualBlockCount += 1; slidesWithVisuals.add(si); }
          if(String(block && block.mode || '').toLowerCase() === 'custom') customBlockCount += 1;
        });
      });
      return { slideCount:slides.length, mathBlockCount, visualBlockCount, customBlockCount, slidesWithMath:slidesWithMath.size, slidesWithVisuals:slidesWithVisuals.size };
    }
    function findAiImportMissingSourceProblems(deck, sourceSlides){
      const expectations = sourceExpectationsForAi(sourceSlides || []);
      const features = deckFeatureSummary(deck);
      const problems = [];
      if(expectations.totalMathCandidates >= 2 && features.mathBlockCount < Math.min(4, expectations.slidesWithMath)){
        problems.push('source deck had ' + expectations.totalMathCandidates + ' math candidates across ' + expectations.slidesWithMath + ' slides, but cleaned deck has only ' + features.mathBlockCount + ' math/equation blocks; preserve or reconstruct the equations');
      }
      if(expectations.totalFigureCandidates >= 1 && features.visualBlockCount < Math.min(3, expectations.slidesWithFigures)){
        problems.push('source deck had ' + expectations.totalFigureCandidates + ' figure/image candidates, but cleaned deck has only ' + features.visualBlockCount + ' visual/custom blocks; reconstruct figures as clean SVG/HTML diagrams or animations');
      }
      if(expectations.conceptSlides >= 4 && features.customBlockCount < 3 && features.visualBlockCount < 3){
        problems.push('source deck contains multiple visual ML concepts, but cleaned deck has fewer than 3 custom SVG/HTML animations or recovered visual blocks; add pedagogically correct animations for key concepts such as embedding, pooling/convolution, attention, or transformer blocks');
      }
      return problems;
    }

    function normalizePreservedBlock(block, fallbackTitle){
      const src = block || {};
      const out = clone ? clone(src) : JSON.parse(JSON.stringify(src || {}));
      out.mode = String(out.mode || 'panel');
      out.title = String(out.title || fallbackTitle || 'Recovered source content');
      out.content = String(out.content || '');
      if(out.mode === 'custom') out.content = wrapCustomHtmlIfNeeded(repairCustomHtmlSizing(out.content));
      else if(blockLooksLikeFigure(out)){
        // Keep source figurehtml/import-image blocks intact. These often contain the only
        // available visual information from the PDF/PPT extraction.
        out.content = String(out.content || '');
      } else {
        out.mode = out.mode === 'import-text' ? 'panel' : out.mode;
        out.content = repairGarbledMathText(out.content);
      }
      out.style = Object.assign({ fontScale:1, fontSize:'', fontFamily:'inherit', fontColor:'#111111', bulletType:'disc' }, out.style || {});
      out.animation = Object.assign({ buildIn:'fade', buildOut:'none', stepMode:'all', order:0 }, out.animation || {});
      out.__stage41vPreservedFromSource = true;
      return out;
    }
    function sourceBlocksForPreservation(slide){
      const blocks = [].concat(Array.isArray(slide && slide.leftBlocks) ? slide.leftBlocks : [], Array.isArray(slide && slide.rightBlocks) ? slide.rightBlocks : []);
      const mathTexts = [];
      const mathBlocks = [];
      const figureBlocks = [];
      const seenMath = Object.create(null);
      blocks.forEach(block=>{
        if(blockLooksLikeFigure(block)){
          figureBlocks.push(normalizePreservedBlock(block, 'Recovered source figure'));
          return;
        }
        if(blockLooksLikeMath(block)){
          const raw = stripHtmlForAi(stripHugeInlineAssets(block && block.content || '')) || stripHugeInlineAssets(block && block.content || '');
          const repaired = repairGarbledMathText(raw).replace(/^P:\s*/i, '').trim();
          if(!repaired || seenMath[repaired]) return;
          seenMath[repaired] = true;
          mathTexts.push(repaired);
        }
      });
      if(mathTexts.length){
        const capped = mathTexts.slice(0, 10).map(t => t.length > 360 ? t.slice(0, 357) + '…' : t);
        const content = ['\\paragraph{Recovered source equations}', '\\begin{itemize}']
          .concat(capped.map(t => '\\item ' + t))
          .concat(['\\end{itemize}'])
          .join('\n');
        mathBlocks.push(normalizePreservedBlock({ mode:'panel', title:'Recovered source equations', content, style:{ fontScale:0.92, fontColor:'#111111' }, animation:{ buildIn:'fade', buildOut:'none', stepMode:'by-item', order:90 } }, 'Recovered source equations'));
      }
      return { mathBlocks, figureBlocks };
    }
    function hasMathOnSlide(slide){
      const blocks = [].concat(Array.isArray(slide && slide.leftBlocks) ? slide.leftBlocks : [], Array.isArray(slide && slide.rightBlocks) ? slide.rightBlocks : []);
      return blocks.some(deckBlockLooksLikeMath);
    }
    function hasVisualOnSlide(slide){
      const blocks = [].concat(Array.isArray(slide && slide.leftBlocks) ? slide.leftBlocks : [], Array.isArray(slide && slide.rightBlocks) ? slide.rightBlocks : []);
      return blocks.some(deckBlockLooksLikeVisual);
    }
    function appendBlocksToCleanSlide(cleanSlide, blocks, preferRight){
      if(!cleanSlide || !Array.isArray(blocks) || !blocks.length) return 0;
      cleanSlide.leftBlocks = Array.isArray(cleanSlide.leftBlocks) ? cleanSlide.leftBlocks : [];
      cleanSlide.rightBlocks = Array.isArray(cleanSlide.rightBlocks) ? cleanSlide.rightBlocks : [];
      if(preferRight){
        if(cleanSlide.slideType !== 'two-col' && cleanSlide.leftBlocks.length){
          cleanSlide.slideType = 'two-col';
        }
        const target = cleanSlide.slideType === 'two-col' ? cleanSlide.rightBlocks : cleanSlide.leftBlocks;
        blocks.forEach(b => target.push(b));
      } else {
        blocks.forEach(b => cleanSlide.leftBlocks.push(b));
      }
      return blocks.length;
    }
    function mergeSourcePreservationIntoAiDeck(deck, sourceSlides, originalProblems){
      if(!deck || !Array.isArray(deck.slides) || !Array.isArray(sourceSlides)) return deck;
      const stats = { slidesChecked:sourceSlides.length, rawSlidesAdded:0, mathBlocksAdded:0, figureBlocksAdded:0, touchedSlides:0, originalProblems:originalProblems || [], at:new Date().toISOString() };
      // If the AI over-summarized the deck, append the missing source slides first.
      // This is intentionally conservative: a rough recovered slide is better than
      // silently losing a lecture section with equations/figures.
      while(deck.slides.length < sourceSlides.length){
        const sourceSlide = sourceSlides[deck.slides.length];
        let recovered;
        try{ recovered = normalizeSlide(clone ? clone(sourceSlide) : JSON.parse(JSON.stringify(sourceSlide || {}))); }
        catch(_err){ recovered = Object.assign({ title:'Recovered source slide', slideType:'single', leftBlocks:[], rightBlocks:[] }, sourceSlide || {}); }
        recovered.title = String(recovered.title || ('Recovered source slide ' + (deck.slides.length + 1)));
        recovered.notesBody = String(recovered.notesBody || '') + (recovered.notesBody ? '\n\n' : '') + 'Stage 42F appended this source slide because AI cleanup returned too few slides.';
        recovered.__stage41vRecoveredSourceSlide = true;
        deck.slides.push(recovered);
        stats.rawSlidesAdded += 1;
      }
      sourceSlides.forEach((sourceSlide, i)=>{
        const cleanSlide = deck.slides[Math.min(i, Math.max(deck.slides.length - 1, 0))];
        if(!cleanSlide) return;
        const preserve = sourceBlocksForPreservation(sourceSlide);
        let touched = false;
        if(preserve.mathBlocks.length && !hasMathOnSlide(cleanSlide)){
          stats.mathBlocksAdded += appendBlocksToCleanSlide(cleanSlide, preserve.mathBlocks, false);
          touched = true;
        }
        if(preserve.figureBlocks.length && !hasVisualOnSlide(cleanSlide)){
          // Keep at most two original images per slide to prevent a single messy PDF page
          // from flooding the cleaned deck, while still preserving the visual content that
          // the AI dropped. Users can delete extra recovered figures manually.
          const figureBlocks = preserve.figureBlocks.slice(0, 2);
          stats.figureBlocksAdded += appendBlocksToCleanSlide(cleanSlide, figureBlocks, true);
          touched = true;
        }
        if(touched){
          stats.touchedSlides += 1;
          cleanSlide.notesBody = String(cleanSlide.notesBody || '') + (cleanSlide.notesBody ? '\n\n' : '') + 'Stage 42F restored source math/figure content that AI cleanup dropped.';
        }
      });
      // Stage 42F: preserve user-selected image alternatives exactly, even after AI cleanup.
      sourceSlides.forEach((sourceSlide, i)=>{
        if(sourceSlide && sourceSlide.importChoiceMode === 'image' && deck.slides[i]){
          try{ deck.slides[i] = normalizeSlide(stripImportReviewInternals(clone ? clone(sourceSlide) : JSON.parse(JSON.stringify(sourceSlide)))); stats.touchedSlides += 1; }catch(_err){}
        }
      });
      repairAiImportDeckMath(deck);
      try{ global.__LUMINA_STAGE41V_LAST_PRESERVE_MERGE = stats; global.__LUMINA_STAGE41W_LAST_PRESERVE_MERGE = stats; }catch(_err){}
      return deck;
    }
    function applyEditablePromptTemplate(template, values){
      let out = String(template || '');
      Object.keys(values || {}).forEach(function(key){
        out = out.split('{{' + key + '}}').join(String(values[key] || ''));
      });
      return out;
    }
    async function aiDeckRepairPrompt(previousText, problems, sourceContext){
      const prior = String(previousText || '').slice(0, 180000);
      const problemText = (problems || []).map(p => '- ' + p).join('\n');
      const template = await loadEditableAiPrompt(AI_IMPORT_REPAIR_PROMPT_PATH, DEFAULT_AI_IMPORT_REPAIR_PROMPT);
      return applyEditablePromptTemplate(template, {
        PROBLEMS: problemText,
        SOURCE_CONTEXT: String(sourceContext || '').slice(0, 90000),
        PREVIOUS_OUTPUT: prior
      });
    }
    async function requestAiReviewText(endpoint, token, provider, model, system, input, temperature, maxOutputTokens){
      const headers = { 'Content-Type':'application/json' };
      if(token) headers.Authorization = 'Bearer ' + token;
      let body;
      const isProxy = /\/api\/lumina\/ai\/?$/i.test(endpoint);
      if(isProxy){
        body = {
          provider,
          model,
          task:'import-repair-patch',
          payload:{ instructions:system, input, temperature, maxOutputTokens }
        };
      } else {
        body = {
          model,
          input:[{ role:'system', content:system }, { role:'user', content:[{ type:'input_text', text:input }] }],
          temperature,
          max_output_tokens:maxOutputTokens,
          store:false
        };
      }
      validateAiReviewEndpointForBrowser(endpoint);
    let res;
    try{
      res = await fetch(endpoint, { method:'POST', headers, body:JSON.stringify(body) });
    }catch(err){
      const hint = isDirectProviderAiEndpoint(endpoint)
        ? 'The AI review endpoint appears to be a direct provider API. Use your Lumina backend /api/lumina/ai endpoint instead.'
        : 'The browser could not reach the AI review endpoint. Check that it is the full Cloud Run URL ending in /api/lumina/ai, that the service is public, and that ALLOWED_ORIGINS includes https://karthik-sridharan.github.io.';
      try{ global.__LUMINA_STAGE41O_LAST_AI_FETCH_ERROR = { endpoint, provider, model, error:err && err.message ? err.message : String(err), hint, at:new Date().toISOString() }; }catch(_err){}
      throw new Error(hint + ' Browser error: ' + (err && err.message ? err.message : String(err)));
    }
    const raw = await res.text();
      let data = null;
      try{ data = raw ? JSON.parse(raw) : null; }catch(_err){ data = { raw }; }
      if(!res.ok || (data && data.ok === false)){
        const msg = data && data.error && data.error.message ? data.error.message : raw || ('AI review failed with HTTP ' + res.status + '.');
        throw new Error(msg);
      }
      let text = '';
      if(isProxy) text = String(data && data.text || '');
      else if(data && typeof data.output_text === 'string') text = data.output_text;
      else if(data && Array.isArray(data.output)){
        const parts = [];
        data.output.forEach(item => (item.content || []).forEach(c => { if(c && typeof c.text === 'string') parts.push(c.text); else if(c && typeof c.output_text === 'string') parts.push(c.output_text); }));
        text = parts.join('\n').trim();
      }
      if(!text) throw new Error('AI review returned an empty response.');
      return text;
    }
  
  function mathpixRepairEndpointFromAiEndpoint(endpoint){
    var value = String(endpoint || '').trim();
    if(!value) return value;
    if(/\/api\/lumina\/ai\/?$/i.test(value)) return value.replace(/\/api\/lumina\/ai\/?$/i, '/api/lumina/patch/mathpix-repair');
    if(/\/api\/lumina\/extract\/?$/i.test(value)) return value.replace(/\/api\/lumina\/extract\/?$/i, '/api/lumina/patch/mathpix-repair');
    return value.replace(/\/?$/, '/api/lumina/patch/mathpix-repair');
  }
  function deckHasImagePatchesForMathpix(slides){
    var found = false;
    (slides || []).forEach(function(slide){
      ['leftBlocks','rightBlocks'].forEach(function(key){
        (Array.isArray(slide && slide[key]) ? slide[key] : []).forEach(function(block){
          if(found || !block) return;
          var role = String(block.importRole || '').toLowerCase();
          var submode = String(block.importSubmode || block.mode || '').toLowerCase();
          var content = String(block.content || '');
          if(/data:image\//i.test(content) && (role === 'text-image' || role === 'math-image' || /visual-blob-patch|text-image-patch|math-image|patch/.test(submode))) found = true;
        });
      });
    });
    return found;
  }
  async function callMathpixPatchRepair(deckTitle, slides){
    var endpoint = mathpixRepairEndpointFromAiEndpoint(aiReviewEndpointValue());
    if(!endpoint) throw new Error('Set an AI review/backend endpoint first. Use your Lumina backend URL ending in /api/lumina/ai.');
    var token = aiReviewTokenValue();
    var headers = { 'Content-Type':'application/json' };
    if(token) headers.Authorization = 'Bearer ' + token;
    var body = { deck: { deckTitle:deckTitle || 'Imported deck', slides:slides || [] }, maxBlocks:120, timeoutMs:25000 };
    var startedAt = Date.now();
    try{ globalThis.__LUMINA_STAGE43A_MATHPIX_REPAIR = { pending:true, endpoint:endpoint, inputSlides:(slides||[]).length, at:new Date().toISOString() }; }catch(_err){}
    var res;
    try{
      res = await fetch(endpoint, { method:'POST', headers:headers, body:JSON.stringify(body), cache:'no-store', mode:'cors' });
    }catch(err){
      throw new Error('Could not reach Mathpix repair backend at ' + endpoint + ': ' + (err && err.message ? err.message : String(err)));
    }
    var raw = await res.text();
    var payload = null;
    try{ payload = raw ? JSON.parse(raw) : null; }catch(_err){ payload = null; }
    if(!res.ok || !payload || payload.ok === false){
      var msg = payload && payload.error && payload.error.message ? payload.error.message : raw || ('Mathpix repair failed with HTTP ' + res.status + '.');
      throw new Error(msg);
    }
    var deck = { deckTitle: payload.deckTitle || deckTitle || 'Imported deck', slides: payload.slides || [], theme:payload.theme || null, presentationOptions:payload.presentationOptions || null, aiReviewed:true, mathpixReviewed:true, aiPatchStats:payload.aiPatchStats || payload.mathpixPatchStats || null };
    try{
      var stats = deck.aiPatchStats || {};
      globalThis.__LUMINA_STAGE43A_MATHPIX_REPAIR = Object.assign({}, stats, { pending:false, ok:true, endpoint:endpoint, inputSlides:(slides||[]).length, outputSlides:deck.slides.length, elapsedMs:Date.now()-startedAt, at:new Date().toISOString() });
    }catch(_err){}
    return deck;
  }

  function parseAiPatchOrDeckResponseText(text, fallbackTitle, sourceSlides){
    const jsonText = extractJsonText(text);
    let parsed;
    try{ parsed = JSON.parse(jsonText); }
    catch(err){ throw new Error('AI returned text that was not valid JSON patch data: ' + String(text || '').slice(0, 300)); }
    const obj = parsed && parsed.deck ? parsed.deck : parsed;
    if(obj && Array.isArray(obj.patches)) return { kind:'patches', patches:obj.patches, raw:obj };
    if(obj && Array.isArray(obj.repairs)) return { kind:'patches', patches:obj.repairs, raw:obj };
    if(Array.isArray(obj)) return { kind:'patches', patches:obj, raw:{ patches:obj } };
    if(obj && Array.isArray(obj.slides)){
      const deck = repairAiImportDeckMath(normalizeAiReviewDeck(obj, fallbackTitle));
      return { kind:'deck', deck:mergeSimpleAiRepairWithSource(deck, sourceSlides || []) };
    }
    throw new Error('AI did not return {"patches":[...]} or a deck with slides.');
  }
  function finitePatchNumber(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function clampPatchNumber(value, min, max){
    const n = finitePatchNumber(value);
    if(n == null) return null;
    return Math.max(min, Math.min(max, n));
  }
  function normalizePatchLayout(layout){
    if(!layout || typeof layout !== 'object') return null;
    const out = {};
    const x = clampPatchNumber(layout.x, -1600, 3200);
    const y = clampPatchNumber(layout.y, -900, 1800);
    const w = clampPatchNumber(layout.w != null ? layout.w : layout.width, 8, 3200);
    const h = clampPatchNumber(layout.h != null ? layout.h : layout.height, 8, 1800);
    if(x != null) out.x = x;
    if(y != null) out.y = y;
    if(w != null) out.w = w;
    if(h != null) out.h = h;
    return Object.keys(out).length ? out : null;
  }
  function findPatchTarget(slides, patch){
    const blockId = String((patch && (patch.blockId || patch.__aiSourceBlockId || patch.sourceBlockId || patch.id)) || '');
    const slideIndexRaw = patch && (patch.slideIndex != null ? patch.slideIndex : patch.sourceSlideIndex != null ? patch.sourceSlideIndex : null);
    let preferredSlide = null;
    if(slideIndexRaw != null){
      let si = Number(slideIndexRaw);
      if(Number.isFinite(si)){
        if(si >= 1 && si <= slides.length && !(patch && patch.zeroBased)) si = si - 1;
        if(si >= 0 && si < slides.length) preferredSlide = Math.floor(si);
      }
    } else if(patch && patch.slideNumber != null){
      const sn = Number(patch.slideNumber);
      if(Number.isFinite(sn) && sn >= 1 && sn <= slides.length) preferredSlide = Math.floor(sn - 1);
    }
    function scanSlide(si){
      const slide = slides[si];
      if(!slide) return null;
      const keys = ['leftBlocks','rightBlocks'];
      for(let k = 0; k < keys.length; k++){
        const key = keys[k];
        const arr = Array.isArray(slide[key]) ? slide[key] : [];
        for(let bi = 0; bi < arr.length; bi++){
          const block = arr[bi] || {};
          if(blockId && String(block.__aiSourceBlockId || '') === blockId) return { slide, slideIndex:si, key, block, blockIndex:bi };
        }
      }
      return null;
    }
    if(blockId){
      if(preferredSlide != null){ const hit = scanSlide(preferredSlide); if(hit) return hit; }
      for(let si = 0; si < slides.length; si++){ const hit = scanSlide(si); if(hit) return hit; }
    }
    if(preferredSlide != null && patch){
      const slide = slides[preferredSlide];
      const col = String(patch.column || patch.sourceColumn || '').toLowerCase() === 'right' ? 'rightBlocks' : 'leftBlocks';
      let bi = patch.blockIndex != null ? Number(patch.blockIndex) : patch.sourceBlockIndex != null ? Number(patch.sourceBlockIndex) : null;
      if(Number.isFinite(bi)){
        if(bi >= 1 && !patch.zeroBasedBlockIndex) bi = bi - 1;
        bi = Math.floor(bi);
        const arr = Array.isArray(slide && slide[col]) ? slide[col] : [];
        if(arr[bi]) return { slide, slideIndex:preferredSlide, key:col, block:arr[bi], blockIndex:bi };
      }
      return { slide, slideIndex:preferredSlide, key:null, block:null, blockIndex:-1 };
    }
    return null;
  }
  function countPatchableChanges(stats){
    return Number(stats.contentPatches || 0) + Number(stats.titlePatches || 0) + Number(stats.layoutPatches || 0) + Number(stats.stylePatches || 0) + Number(stats.slideFieldPatches || 0) + Number(stats.localMathFieldsRepaired || 0);
  }
  function shortAiRepairText(value, maxLen){
    var s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    maxLen = Math.max(24, Number(maxLen || 90));
    return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
  }
  function aiRepairBlockLabel(target){
    if(!target || !target.block) return 'slide';
    var idx = Number(target.blockIndex || 0) + 1;
    var kind = target.block.type || target.block.kind || target.block.role || '';
    var title = shortAiRepairText(target.block.title || target.block.label || '', 40);
    return 'block ' + idx + (kind ? ' (' + kind + ')' : '') + (title ? ': ' + title : '');
  }
  function aiRepairSlideTitle(slide, index){
    var title = slide && (slide.title || slide.kicker || slide.lede || slide.notesTitle) || '';
    return shortAiRepairText(title, 70) || ('Slide ' + (Number(index || 0) + 1));
  }
  function ensureAiRepairSlideChange(stats, target){
    var slideIndex = Math.max(0, Number(target && target.slideIndex || 0));
    if(!stats.__changedSlideMap) stats.__changedSlideMap = {};
    var key = String(slideIndex);
    if(stats.__changedSlideMap[key]) return stats.__changedSlideMap[key];
    var entry = {
      slideIndex: slideIndex,
      slideNumber: slideIndex + 1,
      title: aiRepairSlideTitle(target && target.slide, slideIndex),
      changeCount: 0,
      changes: [],
      summary: ''
    };
    stats.__changedSlideMap[key] = entry;
    stats.changedSlides.push(entry);
    return entry;
  }
  function recordAiRepairChange(stats, target, summary){
    if(!stats || !target) return;
    var entry = ensureAiRepairSlideChange(stats, target);
    var text = shortAiRepairText(summary, 140);
    if(!text) return;
    entry.changes.push(text);
    entry.changeCount = entry.changes.length;
    entry.summary = entry.changes.slice(0, 4).join('; ') + (entry.changes.length > 4 ? '; …' : '');
  }
  function finalizeAiRepairChangeSummary(stats){
    try{
      delete stats.__changedSlideMap;
      stats.changedSlides = (stats.changedSlides || []).map(function(entry){
        entry.changeCount = Array.isArray(entry.changes) ? entry.changes.length : Number(entry.changeCount || 0);
        entry.summary = entry.summary || (Array.isArray(entry.changes) ? entry.changes.slice(0, 4).join('; ') : '');
        return entry;
      }).sort(function(a,b){ return Number(a.slideIndex || 0) - Number(b.slideIndex || 0); });
      stats.changedSlideCount = stats.changedSlides.length;
      stats.changeSummary = stats.changedSlides.length ? stats.changedSlides.map(function(entry){
        return 'Slide ' + entry.slideNumber + ': ' + (entry.summary || 'changed');
      }).join(' | ') : '';
    }catch(_err){
      stats.changedSlideCount = Array.isArray(stats.changedSlides) ? stats.changedSlides.length : 0;
      stats.changeSummary = stats.changeSummary || '';
    }
  }
  function recordLocalMathRepairChanges(stats, deck, repairStatus){
    var changes = repairStatus && Array.isArray(repairStatus.changes) ? repairStatus.changes : [];
    if(!stats || !deck || !Array.isArray(deck.slides) || !changes.length) return;
    changes.forEach(function(change){
      var si = Number(change && change.slideIndex);
      if(!Number.isFinite(si) || si < 0 || si >= deck.slides.length) return;
      var slide = deck.slides[Math.floor(si)];
      var target = { slide:slide, slideIndex:Math.floor(si), key:change.column || '', block:null, blockIndex:-1 };
      if(change.blockIndex != null){
        var bi = Number(change.blockIndex);
        var key = String(change.column || '').indexOf('right') >= 0 ? 'rightBlocks' : 'leftBlocks';
        var arr = Array.isArray(slide && slide[key]) ? slide[key] : [];
        if(Number.isFinite(bi) && arr[Math.floor(bi)]){
          target.key = key;
          target.blockIndex = Math.floor(bi);
          target.block = arr[Math.floor(bi)];
        }
      }
      recordAiRepairChange(stats, target, change.summary || 'Repaired local math/text formatting');
    });
  }
  function applyAiRepairPatchesToSource(deckTitle, sourceSlides, patchResult){
    const source = addAiSourceIdsToSourceSlides(cloneJsonSafe(sourceSlides || []) || []);
    const patches = patchResult && Array.isArray(patchResult.patches) ? patchResult.patches : [];
    const deck = { deckTitle:String(deckTitle || 'Imported deck'), theme:null, presentationOptions:null, summary:'AI patch-repaired imported deck.', slides:source.map(function(slide){ return normalizeSlide(slide); }) };
    const stats = { stage:'stage43an-rate-limit-backoff-chunked-image-blob-20260517-1', patchMode:true, sourceSlides:source.length, patchesReceived:patches.length, patchesApplied:0, contentPatches:0, titlePatches:0, layoutPatches:0, stylePatches:0, slideFieldPatches:0, ignoredImageContentPatches:0, invalidPatches:0, localMathFieldsRepaired:0, changedSlides:[], changedSlideCount:0, changeSummary:'', at:new Date().toISOString() };
    patches.forEach(function(patch){
      if(!patch || typeof patch !== 'object'){ stats.invalidPatches += 1; return; }
      const target = findPatchTarget(deck.slides, patch);
      if(!target){ stats.invalidPatches += 1; return; }
      let changed = false;
      var aiSummary = shortAiRepairText(patch.summary || patch.reason || patch.description || '', 100);
      if(!target.block){
        var changedFields = [];
        ['title','kicker','lede','notesTitle','notesBody'].forEach(function(field){
          const patchValue = patch[field] != null ? patch[field] : (field === 'title' && patch.slideTitle != null ? patch.slideTitle : null);
          if(patchValue != null && String(target.slide[field] || '') !== String(patchValue)){
            target.slide[field] = repairSimpleMathContainerText(String(patchValue));
            stats.slideFieldPatches += 1; changed = true; changedFields.push(field);
          }
        });
        if(changed){
          stats.patchesApplied += 1;
          recordAiRepairChange(stats, target, 'Updated slide field' + (changedFields.length === 1 ? '' : 's') + ': ' + changedFields.join(', ') + (aiSummary ? ' — ' + aiSummary : ''));
        }
        return;
      }
      const block = target.block;
      const blockLabel = aiRepairBlockLabel(target);
      const isFigure = blockLooksLikeFigure(block);
      if(patch.title != null && String(block.title || '') !== String(patch.title)){
        block.title = repairSimpleMathContainerText(String(patch.title));
        stats.titlePatches += 1; changed = true;
        recordAiRepairChange(stats, target, 'Updated ' + blockLabel + ' title' + (aiSummary ? ' — ' + aiSummary : ''));
      }
      if(patch.content != null){
        if(isFigure){
          const proposed = String(patch.content || '');
          if(blockHasRealImageAsset(proposed)){
            block.content = proposed;
            stats.contentPatches += 1; changed = true;
            recordAiRepairChange(stats, target, 'Updated image/figure content for ' + blockLabel + (aiSummary ? ' — ' + aiSummary : ''));
          } else {
            stats.ignoredImageContentPatches += 1;
          }
        } else {
          const nextContent = repairSimpleMathContainerText(String(patch.content));
          if(String(block.content || '') !== nextContent){
            block.content = nextContent;
            stats.contentPatches += 1; changed = true;
            recordAiRepairChange(stats, target, 'Updated text/math content for ' + blockLabel + (aiSummary ? ' — ' + aiSummary : ''));
          }
        }
      }
      const layout = normalizePatchLayout(patch.layout || patch.importSourceLayout || patch.box || null);
      if(layout){
        block.layout = Object.assign({}, block.layout || {}, layout);
        if(block.importSourceLayout) block.importSourceLayout = Object.assign({}, block.importSourceLayout || {}, layout);
        stats.layoutPatches += 1; changed = true;
        recordAiRepairChange(stats, target, 'Adjusted layout/position for ' + blockLabel + (aiSummary ? ' — ' + aiSummary : ''));
      }
      if(patch.style && typeof patch.style === 'object'){
        const allowed = {};
        ['fontSize','fontScale','fontColor','fontFamily','bulletType'].forEach(function(k){ if(patch.style[k] != null) allowed[k] = patch.style[k]; });
        if(Object.keys(allowed).length){
          block.style = Object.assign({}, block.style || {}, allowed);
          stats.stylePatches += 1; changed = true;
          recordAiRepairChange(stats, target, 'Adjusted style for ' + blockLabel + ': ' + Object.keys(allowed).join(', ') + (aiSummary ? ' — ' + aiSummary : ''));
        }
      }
      if(changed) stats.patchesApplied += 1;
    });
    const beforeLocal = globalThis.__LUMINA_STAGE41R_LAST_MATH_REPAIR && globalThis.__LUMINA_STAGE41R_LAST_MATH_REPAIR.repairedCount || 0;
    repairAiImportDeckMath(deck);
    const localMathRepairStatus = globalThis.__LUMINA_STAGE41R_LAST_MATH_REPAIR || null;
    const afterLocal = localMathRepairStatus && Number(localMathRepairStatus.repairedCount || 0) || 0;
    stats.localMathFieldsRepaired = Math.max(0, Number(afterLocal || 0));
    recordLocalMathRepairChanges(stats, deck, localMathRepairStatus);
    stats.changedCount = countPatchableChanges(stats);
    finalizeAiRepairChangeSummary(stats);
    deck.aiPatchStats = stats;
    try{
      globalThis.__LUMINA_STAGE42O_PATCH_AI_IMPORT_REPAIR = stats; globalThis.__LUMINA_STAGE42N_PATCH_AI_IMPORT_REPAIR = stats; globalThis.__LUMINA_STAGE42L_PATCH_AI_IMPORT_REPAIR = stats; globalThis.__LUMINA_STAGE42J_PATCH_AI_IMPORT_REPAIR = stats; globalThis.__LUMINA_STAGE42I_PATCH_AI_IMPORT_REPAIR = stats; globalThis.__LUMINA_STAGE42H_PATCH_AI_IMPORT_REPAIR = stats;
      globalThis.__LUMINA_STAGE42C_SIMPLE_AI_IMPORT_REPAIR = stats;
    }catch(_err){}
    return deck;
  }
  function parseAiReviewResponseText(text, fallbackTitle){
      const jsonText = extractJsonText(text);
      let parsed;
      try{ parsed = JSON.parse(jsonText); }
      catch(err){ throw new Error('AI returned text that was not valid deck JSON: ' + String(text || '').slice(0, 300)); }
      return repairAiImportDeckMath(normalizeAiReviewDeck(parsed, fallbackTitle));
    }
    async function callImportAiReview(deckTitle, slides){
    const endpoint = aiReviewEndpointValue();
    if(!endpoint) throw new Error('Set an AI review endpoint first. For your Cloud Run backend use the same URL as extraction, ending in /api/lumina/ai.');
    const token = aiReviewTokenValue();
    const provider = aiReviewProviderValue();
    const model = aiReviewModelValue();
    addAiSourceIdsToSourceSlides(slides || []);
    const system = await aiDeckSystemPrompt();
    const input = aiDeckUserPrompt(deckTitle, slides);
    let text = await requestAiReviewText(endpoint, token, provider, model, system, input, 0.03, 22000);
    let deck;
    let problems = [];
    let parsedKind = 'patches';
    try{
      const parsed = parseAiPatchOrDeckResponseText(text, deckTitle, slides || []);
      if(parsed.kind === 'deck'){
        parsedKind = 'deck-fallback';
        deck = parsed.deck;
      } else {
        parsedKind = 'patches';
        deck = applyAiRepairPatchesToSource(deckTitle, slides || [], parsed);
      }
      problems = findAiImportDeckProblems(deck, '');
    }catch(err){
      problems = ['AI returned invalid patch JSON: ' + (err && err.message ? err.message : String(err))];
    }
    if(problems.length){
      showToast('AI import repair needs one patch/JSON repair pass…');
      text = await requestAiReviewText(endpoint, token, provider, model, system, await aiDeckRepairPrompt(text, problems, input), 0.01, 22000);
      const parsed = parseAiPatchOrDeckResponseText(text, deckTitle, slides || []);
      if(parsed.kind === 'deck'){
        parsedKind = 'deck-fallback-after-repair';
        deck = parsed.deck;
      } else {
        parsedKind = 'patches-after-repair';
        deck = applyAiRepairPatchesToSource(deckTitle, slides || [], parsed);
      }
      problems = findAiImportDeckProblems(deck, '');
      if(problems.length){
        throw new Error('AI import repair still failed validation: ' + problems.join('; '));
      }
    }
    const stats = deck && deck.aiPatchStats || globalThis.__LUMINA_STAGE42O_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42N_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42L_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42J_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42I_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42H_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42C_SIMPLE_AI_IMPORT_REPAIR || null;
    try{
      globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR = {
        ok:true,
        endpoint, provider, model,
        inputSlides:(slides||[]).length,
        outputSlides:deck.slides.length,
        patchBasedRepair:true,
        parsedKind,
        patchStats:stats,
        changedCount:stats && stats.changedCount || 0,
        at:new Date().toISOString()
      };
      globalThis.__LUMINA_STAGE42J_LAST_AI_IMPORT_REPAIR = globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR;
      globalThis.__LUMINA_STAGE42I_LAST_AI_IMPORT_REPAIR = globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR;
      globalThis.__LUMINA_STAGE42H_LAST_AI_IMPORT_REPAIR = globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR;
      globalThis.__LUMINA_STAGE42C_LAST_AI_IMPORT_REPAIR = globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR;
      globalThis.__LUMINA_STAGE41V_LAST_AI_IMPORT_REVIEW = globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR;
      globalThis.__LUMINA_STAGE41R_LAST_AI_IMPORT_REVIEW = globalThis.__LUMINA_STAGE42L_LAST_AI_IMPORT_REPAIR;
    }catch(_err){}
    return deck;
  }
  async function maybeReviewImportedDeckWithAi(importedSlides, deckTitle){
      if(!aiReviewAfterImportEnabled()) return { deckTitle, slides:importedSlides, theme:null, presentationOptions:null, aiReviewed:false };
      showToast('Asking Mathpix backend to analyze image patches…');
      try{
        const deck = await callMathpixPatchRepair(deckTitle, importedSlides);
        const stats = deck && deck.aiPatchStats || global.__LUMINA_STAGE43A_MATHPIX_REPAIR || null;
        const changedCount = stats && Number(stats.changedCount || 0) || 0;
        if(changedCount > 0) showToast('Mathpix patch repair completed: converted ' + changedCount + ' image patch' + (changedCount === 1 ? '' : 'es') + '.');
        else showToast('Mathpix patch repair completed; no image patches were converted.');
        return Object.assign({ aiReviewed:true, mathpixReviewed:true }, deck);
      }catch(err){
        const message = err && err.message ? err.message : String(err);
        // Stage 42F: do not leave the user with no slides when the AI preserve-merge path
        // is too strict or the model drops equations/figures. Preserve the backend
        // extraction output and report the AI validation failure for diagnostics.
        const fallbackSlides = Array.isArray(importedSlides) ? importedSlides : [];
        try{
          global.__LUMINA_STAGE41V_LAST_AI_IMPORT_FALLBACK = {
            ok:false,
            loadedRawExtractedDeck:true,
            reason:message,
            inputSlides:fallbackSlides.length,
            sourceFeatures:sourceExpectationsForAi(fallbackSlides),
            at:new Date().toISOString()
          };
          global.__LUMINA_STAGE41R_LAST_AI_IMPORT_REVIEW = Object.assign({}, global.__LUMINA_STAGE41V_LAST_AI_IMPORT_FALLBACK);
        }catch(_err){}
        showToast('Mathpix patch repair failed; kept the source-extracted slides already loaded.');
        return {
          deckTitle,
          slides:fallbackSlides,
          theme:null,
          presentationOptions:null,
          aiReviewed:false,
          aiReviewFailed:true,
          aiReviewError:message
        };
      }
    }
    function hasImportReviewAlternates(slides){
      return (slides || []).some(slide => !!(slide && slide.importAlternates && slide.importAlternates.imageSlide));
    }
    function stripImportReviewInternals(slide){
      let out;
      try{ out = clone ? clone(slide) : JSON.parse(JSON.stringify(slide || {})); }
      catch(_err){ out = Object.assign({}, slide || {}); }
      if(out) delete out.importAlternates;
      return out;
    }
    function escapeMiniHtml(value){
      return String(value || '').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
    }
    function renderImportChoicePreview(slide, label){
      let html = '';
      try{
        const api = global.LuminaRendererApi || global.LuminaRenderer || null;
        const normalized = normalizeSlide(stripImportReviewInternals(slide));
        if(api && typeof api.buildSlideMarkup === 'function') html = api.buildSlideMarkup(normalized, { index:0, active:true });
      }catch(_err){ html = ''; }
      if(!html){
        const title = escapeMiniHtml(slide && slide.title || label || 'Slide');
        html = '<section class="slide single"><h2>' + title + '</h2></section>';
      }
      return '<div class="stage41w-choice-preview-frame"><div class="stage41w-choice-preview-scale">' + html + '</div></div>';
    }
    function ensureImportReviewStyles(){
      const d = doc();
      if(d.getElementById('stage41w-import-review-styles')) return;
      const style = d.createElement('style');
      style.id = 'stage41w-import-review-styles';
      style.textContent = '.stage41w-import-review-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.66);z-index:99998;display:grid;place-items:center;padding:18px}.stage41w-import-review-modal{width:min(1180px,96vw);max-height:92vh;background:#fff;color:#111827;border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}.stage41w-import-review-head{padding:14px 18px;border-bottom:1px solid rgba(15,23,42,.12);display:flex;justify-content:space-between;gap:12px;align-items:center}.stage41w-import-review-head h2{font-size:1.05rem;margin:0}.stage41w-import-review-body{padding:14px 18px;overflow:auto}.stage41w-import-review-slide{border:1px solid rgba(15,23,42,.14);border-radius:16px;margin-bottom:14px;background:#f8fafc;overflow:hidden}.stage41w-import-review-slide-title{padding:10px 12px;font-weight:700;color:#10233b;border-bottom:1px solid rgba(15,23,42,.10);display:flex;justify-content:space-between;gap:12px}.stage41w-import-review-choices{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.stage41w-import-choice{border:2px solid rgba(15,23,42,.15);border-radius:14px;background:#fff;padding:10px;cursor:pointer;min-width:0}.stage41w-import-choice input{margin-right:.45rem}.stage41w-import-choice.stage41w-selected{border-color:#2f6fed;box-shadow:0 0 0 4px rgba(47,111,237,.12)}.stage41w-choice-preview-frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:10px;background:#e5e7eb;overflow:hidden;margin-top:8px;border:1px solid rgba(15,23,42,.10)}.stage41w-choice-preview-scale{position:absolute;left:0;top:0;width:1600px;height:900px;transform-origin:top left;transform:scale(.26);pointer-events:none}.stage41w-choice-preview-scale .slide{width:1600px!important;height:900px!important;box-sizing:border-box}.stage41w-import-review-foot{padding:12px 18px;border-top:1px solid rgba(15,23,42,.12);display:flex;justify-content:flex-end;gap:10px}.stage41w-import-review-foot button{border-radius:999px;border:1px solid rgba(15,23,42,.18);background:#fff;color:#10233b;padding:.55rem .9rem;font-weight:700}.stage41w-import-review-foot button.primary{background:#17365d;color:#fff}@media (max-width:800px){.stage41w-import-review-choices{grid-template-columns:1fr}.stage41w-import-review-modal{width:98vw;max-height:94vh}}';
      d.head.appendChild(style);
    }
    function reviewExtractedSlidesWithAlternates(slides, deckTitle){
      slides = slides || [];
      if(!hasImportReviewAlternates(slides)) return Promise.resolve(slides.map(stripImportReviewInternals));
      ensureImportReviewStyles();
      return new Promise(resolve=>{
        const d = doc();
        let choices = slides.map(()=> 'semantic');
        const backdrop = d.createElement('div');
        backdrop.className = 'stage41w-import-review-backdrop';
        const body = slides.map((slide, i)=>{
          const imageSlide = slide && slide.importAlternates && slide.importAlternates.imageSlide;
          const title = escapeMiniHtml(slide && slide.title || ('Slide ' + (i + 1)));
          if(!imageSlide){
            return '<div class="stage41w-import-review-slide" data-slide-index="'+i+'"><div class="stage41w-import-review-slide-title"><span>'+(i+1)+'. '+title+'</span><span>No rendered alternative</span></div><div class="stage41w-import-review-choices"><label class="stage41w-import-choice stage41w-selected"><input type="radio" checked disabled> Editable extraction'+renderImportChoicePreview(slide, 'Editable extraction')+'</label></div></div>';
          }
          return '<div class="stage41w-import-review-slide" data-slide-index="'+i+'"><div class="stage41w-import-review-slide-title"><span>'+(i+1)+'. '+title+'</span><span>Choose version</span></div><div class="stage41w-import-review-choices"><label class="stage41w-import-choice stage41w-selected" data-choice="semantic"><input name="stage41w-choice-'+i+'" type="radio" value="semantic" checked> Editable semantic extraction'+renderImportChoicePreview(slide, 'Editable extraction')+'</label><label class="stage41w-import-choice" data-choice="image"><input name="stage41w-choice-'+i+'" type="radio" value="image"> Rendered image/background'+renderImportChoicePreview(imageSlide, 'Rendered image')+'</label></div></div>';
        }).join('');
        backdrop.innerHTML = '<div class="stage41w-import-review-modal" role="dialog" aria-modal="true" aria-label="Review imported slide choices"><div class="stage41w-import-review-head"><div><h2>Review PDF import choices</h2><div class="help">Left is editable extraction; right is exact rendered page image. Editable is selected by default. Mathpix patch repair starts after Continue, while the chosen slides load immediately.</div></div><button type="button" data-stage41w-close>×</button></div><div class="stage41w-import-review-body">'+body+'</div><div class="stage41w-import-review-foot"><button type="button" data-stage41w-all-semantic>Use editable for all</button><button type="button" data-stage41w-all-image>Use image for all</button><button type="button" class="primary" data-stage41w-continue>Continue import</button></div></div>';
        function refresh(){
          Array.from(backdrop.querySelectorAll('.stage41w-import-review-slide')).forEach(row=>{
            Array.from(row.querySelectorAll('.stage41w-import-choice')).forEach(choice=>{
              const input = choice.querySelector('input[type="radio"]');
              choice.classList.toggle('stage41w-selected', !!(input && input.checked));
            });
          });
        }
        backdrop.addEventListener('change', ev=>{
          const input = ev.target && ev.target.matches && ev.target.matches('input[type="radio"]') ? ev.target : null;
          if(input){
            const m = String(input.name || '').match(/stage41w-choice-(\d+)/);
            if(m) choices[Number(m[1])] = input.value === 'image' ? 'image' : 'semantic';
            refresh();
          }
        });
        backdrop.addEventListener('click', ev=>{
          if(ev.target && ev.target.closest && ev.target.closest('[data-stage41w-close]')){ backdrop.remove(); resolve(slides.map(stripImportReviewInternals)); return; }
          if(ev.target && ev.target.closest && ev.target.closest('[data-stage41w-all-semantic]')){
            choices = choices.map(()=> 'semantic');
            Array.from(backdrop.querySelectorAll('input[value="semantic"]')).forEach(input=>{ input.checked = true; }); refresh(); return;
          }
          if(ev.target && ev.target.closest && ev.target.closest('[data-stage41w-all-image]')){
            choices = choices.map((choice, i)=> slides[i] && slides[i].importAlternates && slides[i].importAlternates.imageSlide ? 'image' : 'semantic');
            Array.from(backdrop.querySelectorAll('.stage41w-import-review-slide')).forEach(row=>{
              const idx = Number(row.getAttribute('data-slide-index') || 0);
              const input = row.querySelector('input[value="' + choices[idx] + '"]');
              if(input) input.checked = true;
            }); refresh(); return;
          }
          if(ev.target && ev.target.closest && ev.target.closest('[data-stage41w-continue]')){
            const selected = slides.map((slide, i)=>{
              const imageSlide = slide && slide.importAlternates && slide.importAlternates.imageSlide;
              const chosen = choices[i] === 'image' && imageSlide ? imageSlide : slide;
              const out = stripImportReviewInternals(chosen);
              out.importChoiceMode = choices[i] === 'image' && imageSlide ? 'image' : 'semantic';
              out.importChoiceSourceIndex = i;
              return out;
            });
            try{ global.__LUMINA_STAGE41W_IMPORT_REVIEW_CHOICES = { deckTitle:deckTitle || '', slideCount:selected.length, choices:choices.slice(), firstSlides:selected.slice(0,6).map(function(s,idx){ return { idx:idx, choice:choices[idx], title:s&&s.title||'', sourcePageNumber:s&&s.importMeta&&(s.importMeta.sourcePageNumber||s.importMeta.pageNumber)||null, blockCount:(s&&s.leftBlocks?s.leftBlocks.length:0)+(s&&s.rightBlocks?s.rightBlocks.length:0), firstHint:(s&&s.leftBlocks&&s.leftBlocks[0]&&(s.leftBlocks[0].sourceTextHint||s.leftBlocks[0].title||'')||'').slice(0,120) }; }), at:new Date().toISOString() }; }catch(_err){}
            backdrop.remove(); resolve(selected.map(function(s){ return cloneJsonSafe(s); }));
          }
        });
        d.body.appendChild(backdrop);
        refresh();
      });
    }

    function isExtractablePresentationFile(file){
      const name = String(file && file.name || '').toLowerCase();
      return /\.(pdf|pptx|ppt)$/i.test(name) || file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || file.type === 'application/vnd.ms-powerpoint';
    }
    function fileKind(file){
      const name = String(file && file.name || '').toLowerCase();
      if(/\.pdf$/i.test(name) || file.type === 'application/pdf') return 'pdf';
      if(/\.pptx$/i.test(name)) return 'pptx';
      if(/\.ppt$/i.test(name)) return 'ppt';
      return '';
    }
    function extractionHealthEndpoint(endpoint){
      const raw = String(endpoint || '').trim();
      if(!raw) return '';
      try{
        const url = new URL(raw, global.location && global.location.href || undefined);
        url.pathname = url.pathname.replace(/\/api\/lumina\/import\/pdf-docai-semantic\/?$/, '/health').replace(/\/api\/lumina\/extract\/?$/, '/health');
        url.search = '';
        url.hash = '';
        return url.toString();
      }catch(_err){ return ''; }
    }
    async function describeExtractionFetchFailure(endpoint, err){
      const msg = err && err.message ? String(err.message) : String(err || 'Load failed');
      const health = extractionHealthEndpoint(endpoint);
      let hint = 'The browser could not complete the upload request.';
      if(health){
        try{
          const res = await fetch(health, { method:'GET', cache:'no-store', mode:'cors' });
          const text = await res.text();
          hint += ' Backend /health is reachable (HTTP ' + res.status + ').';
          if(text && /stage41w|stage41v|stage41q|stage40d/i.test(text)) hint += ' Health looks like an older backend/frontend stage may still be deployed.';
        }catch(_healthErr){
          hint += ' The browser also could not reach ' + health + ', which usually means the endpoint URL is wrong, Cloud Run is not public, CORS is blocked, or the service is down.';
        }
      }
      if(/Load failed|Failed to fetch|NetworkError/i.test(msg)){
        hint += ' Check that the extraction endpoint is the full Cloud Run URL ending in /api/lumina/extract, that ALLOWED_ORIGINS includes https://karthik-sridharan.github.io, and that the PDF is below Cloud Run/browser upload limits, and that the extraction JSON response was not too large. Stage 42F uses compact review images; if this persists, temporarily reduce Max PDF pages or set Include review alternates off.';
      }
      return msg + ' — ' + hint;
    }


    function stage42sPublishImportStatus(update){
      try{
        var prev = global.__LUMINA_STAGE42S_IMPORT_STATUS || {};
        var next = Object.assign({}, prev, update || {}, { stage:'stage43an-rate-limit-backoff-chunked-image-blob-20260517-1', updatedAt:new Date().toISOString() });
        if(!next.startedAt) next.startedAt = prev.startedAt || next.updatedAt;
        global.__LUMINA_STAGE42S_IMPORT_STATUS = next;
        global.__LUMINA_STAGE42R_IMPORT_STATUS = next;
        if(typeof global.LuminaStage42SUpdateImportPanel === 'function') global.LuminaStage42SUpdateImportPanel(next);
      }catch(_err){}
    }
    function stage42sCompactEndpoint(endpoint){
      try{ var u = new URL(String(endpoint || ''), global.location && global.location.href || undefined); return u.origin + u.pathname; }
      catch(_err){ return String(endpoint || '').slice(0, 180); }
    }

    function buildExtractionForm(file, attempt){
      const form = new FormData();
      form.append('file', file, file.name || 'presentation');
      const kind = fileKind(file);
      if(kind) form.append('kind', kind);
      form.append('maxPdfPages', String(attempt.maxPdfPages || DEFAULT_MAX_IMPORT_PAGES));
      if(attempt.pageStart) form.append('pageStart', String(attempt.pageStart));
      if(attempt.pageCount) form.append('pageCount', String(attempt.pageCount));
      if(attempt.pageEnd) form.append('pageEnd', String(attempt.pageEnd));
      form.append('maxPptxSlides', String(DEFAULT_MAX_IMPORT_SLIDES));
      form.append('maxSlides', String(DEFAULT_MAX_IMPORT_SLIDES));
      form.append('maxImagesPerSlide', String(attempt.maxImagesPerSlide || 24));
      form.append('includePdfBackground', String(attempt.includePdfBackground || '0'));
      form.append('includePdfReviewAlternates', String(attempt.includePdfReviewAlternates));
      form.append('includePdfRender', String(attempt.includePdfRender));
      form.append('extractEngine', String(attempt.extractEngine || extractionEngineValue()));
      if(String(attempt.extractEngine || '').toLowerCase().includes('all-image')){
        form.append('allTextAsImage', '1');
        form.append('textImageZoom', String(attempt.textImageZoom || '2.25'));
      }
      if(String(attempt.extractEngine || '').toLowerCase().includes('math-image')){
        form.append('mathAsImage', '1');
        form.append('mathImageZoom', '2.25');
      }
      if(String(attempt.extractEngine || '').toLowerCase().includes('docai')){
        form.append('semanticAi', '0');
        form.append('semanticMode', 'docai-fast-no-ai-rebuild');
        form.append('preserveFigures', '0');
        form.append('docAiTimeoutMs', '30000');
        form.append('allowFullPageBackground', '0');
        form.append('semanticProvider', aiReviewProviderValue());
        form.append('semanticModel', aiReviewModelValue());
      }
      form.append('reviewRenderZoom', String(attempt.reviewRenderZoom));
      form.append('reviewJpegQuality', String(attempt.reviewJpegQuality));
      form.append('vectorRenderZoom', String(attempt.vectorRenderZoom));
      form.append('vectorJpegQuality', String(attempt.vectorJpegQuality));
      form.append('httpSafeMb', String(attempt.httpSafeMb || 16));
      form.append('attemptLabel', String(attempt.label || 'extract'));
      return form;
    }
    function extractionAttemptsForFile(file){
      const engine = extractionEngineValue();
      if(engine === 'pymupdf-all-image'){
        return [{
          label:'PyMuPDF image-patch import: keep all PDF text and math as real cropped image blocks for later extraction',
          extractEngine:'pymupdf-all-image',
          includePdfReviewAlternates:'1',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:48,
          reviewRenderZoom:0.45,
          reviewJpegQuality:48,
          vectorRenderZoom:0.95,
          vectorJpegQuality:58,
          httpSafeMb:16
        },{
          label:'lean retry: PyMuPDF image-patch import without rendered review alternates',
          extractEngine:'pymupdf-all-image',
          includePdfReviewAlternates:'0',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:36,
          reviewRenderZoom:0.30,
          reviewJpegQuality:42,
          vectorRenderZoom:0.70,
          vectorJpegQuality:48,
          httpSafeMb:10
        }];
      }
      if(engine === 'pymupdf-math-image'){
        return [{
          label:'PyMuPDF hybrid: editable text with math/equation regions preserved as cropped images',
          extractEngine:'pymupdf-math-image',
          includePdfReviewAlternates:'1',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:24,
          reviewRenderZoom:0.45,
          reviewJpegQuality:48,
          vectorRenderZoom:0.95,
          vectorJpegQuality:58,
          httpSafeMb:16
        },{
          label:'lean retry: PyMuPDF math-image without rendered review alternates',
          extractEngine:'pymupdf-math-image',
          includePdfReviewAlternates:'0',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:12,
          reviewRenderZoom:0.30,
          reviewJpegQuality:42,
          vectorRenderZoom:0.70,
          vectorJpegQuality:48,
          httpSafeMb:10
        }];
      }
      if(engine === 'mineru-pymupdf'){
        return [{
          label:'MinerU + PyMuPDF: MinerU semantic text/math with PyMuPDF rendered review alternatives',
          extractEngine:'mineru-pymupdf',
          includePdfReviewAlternates:'1',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:24,
          reviewRenderZoom:0.45,
          reviewJpegQuality:48,
          vectorRenderZoom:0.95,
          vectorJpegQuality:58,
          httpSafeMb:18
        },{
          label:'MinerU + PyMuPDF lean retry without rendered review alternatives',
          extractEngine:'mineru-pymupdf',
          includePdfReviewAlternates:'0',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:12,
          reviewRenderZoom:0.30,
          reviewJpegQuality:42,
          vectorRenderZoom:0.70,
          vectorJpegQuality:48,
          httpSafeMb:10
        }];
      }
      if(engine === 'docai'){
        return [{
          label:'Google Document AI editable import with review choices (30s timeout, no backend AI rebuild)',
          extractEngine:'docai-semantic',
          includePdfReviewAlternates:'1',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:0,
          reviewRenderZoom:0.36,
          reviewJpegQuality:48,
          vectorRenderZoom:0.70,
          vectorJpegQuality:50,
          httpSafeMb:22
        }];
      }
      return [
        {
          label:'full hybrid extraction with review alternates',
          extractEngine: engine,
          includePdfReviewAlternates:'1',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:24,
          reviewRenderZoom:0.45,
          reviewJpegQuality:48,
          vectorRenderZoom:0.95,
          vectorJpegQuality:58,
          httpSafeMb:16
        },
        {
          label:'lean retry: hybrid without rendered review alternates',
          extractEngine: engine,
          includePdfReviewAlternates:'0',
          includePdfRender:'1',
          includePdfBackground:'0',
          maxImagesPerSlide:10,
          reviewRenderZoom:0.30,
          reviewJpegQuality:42,
          vectorRenderZoom:0.65,
          vectorJpegQuality:45,
          httpSafeMb:10
        },
        {
          label:'rescue retry: PyMuPDF only, no review alternates',
          extractEngine:'pymupdf',
          includePdfReviewAlternates:'0',
          includePdfRender:'0',
          includePdfBackground:'0',
          maxImagesPerSlide:6,
          reviewRenderZoom:0.25,
          reviewJpegQuality:38,
          vectorRenderZoom:0.50,
          vectorJpegQuality:40,
          httpSafeMb:8
        }
      ];
    }
    function extractionErrorLooksRetryable(errOrMessage){
      const msg = String(errOrMessage && errOrMessage.message || errOrMessage || '');
      if(/Unauthorized proxy request|Set an extraction backend endpoint|Unsupported extraction file type/i.test(msg)) return false;
      return /Load failed|Failed to fetch|NetworkError|response.*too large|too large|413|429|500|502|503|504|timeout|socket|interrupted|Empty response/i.test(msg) || !msg;
    }
    async function postExtractionAttempt(endpoint, headers, form, attempt){
      let res;
      const startedAt = Date.now();
      stage42sPublishImportStatus({ phase:'waiting-for-backend', message:'Uploaded file; waiting for extraction backend…', endpoint:stage42sCompactEndpoint(endpoint), attempt:attempt && attempt.label || '', extractEngine:attempt && attempt.extractEngine || extractionEngineValue(), pending:true });
      try{
        res = await fetch(endpoint, { method:'POST', headers, body:form, cache:'no-store', mode:'cors' });
      }catch(fetchErr){
        stage42sPublishImportStatus({ phase:'backend-fetch-error', pending:false, ok:false, message:'Extraction backend request failed before a response was received.', error:fetchErr && fetchErr.message ? fetchErr.message : String(fetchErr || 'Fetch failed'), elapsedMs:Date.now()-startedAt });
        throw new Error(await describeExtractionFetchFailure(endpoint, fetchErr));
      }
      stage42sPublishImportStatus({ phase:'reading-backend-response', message:'Backend responded; reading extracted slides…', httpStatus:res.status, elapsedMs:Date.now()-startedAt, pending:true });
      const text = await res.text();
      let payload = null;
      try{ payload = text ? JSON.parse(text) : null; }
      catch(_err){ payload = { ok:false, error:{ message: text ? text.slice(0, 500) : 'Empty response from extraction backend.' } }; }
      if(!res.ok || !payload || payload.ok === false){
        const msg = payload && payload.error && payload.error.message ? payload.error.message : ('Extraction backend failed with HTTP ' + res.status + '.');
        stage42sPublishImportStatus({ phase:'backend-error', pending:false, ok:false, message:msg, httpStatus:res.status, responsePreview:text ? text.slice(0, 900) : '', elapsedMs:Date.now()-startedAt });
        const err = new Error(msg);
        err.status = res.status;
        err.attemptLabel = attempt && attempt.label || '';
        throw err;
      }
      if(!Array.isArray(payload.slides) || !payload.slides.length){
        stage42sPublishImportStatus({ phase:'backend-empty', pending:false, ok:false, message:'Extraction backend returned no slides.', httpStatus:res.status, elapsedMs:Date.now()-startedAt });
        throw new Error('Extraction backend returned no slides.');
      }
      stage42sPublishImportStatus({ phase:'backend-success', pending:true, ok:true, message:'Backend returned ' + payload.slides.length + ' slide' + (payload.slides.length === 1 ? '' : 's') + '; preparing import…', slideCount:payload.slides.length, httpStatus:res.status, elapsedMs:Date.now()-startedAt, meta:payload.meta || null, source:payload.source || null });
      payload.warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
      if(attempt && attempt.label && !/^full/i.test(attempt.label)){
        payload.warnings.push('Stage 42F used ' + attempt.label + ' after the larger extraction attempt could not complete. The deck is loaded, but rendered image-review alternatives may be unavailable for some slides.');
      }
      payload.meta = Object.assign({}, payload.meta || {}, { stage41zAttempt: attempt && attempt.label || 'extract' });
      return payload;
    }

    function stage43anMergeChunkPayloads(chunks, previousErrors){
      chunks = Array.isArray(chunks) ? chunks.filter(Boolean) : [];
      const slides = [];
      const warnings = [];
      let first = null;
      let pageCount = 0;
      chunks.forEach(function(payload){
        if(!first) first = payload;
        if(payload && payload.source && payload.source.pageCount) pageCount = Math.max(pageCount, Number(payload.source.pageCount) || 0);
        if(Array.isArray(payload && payload.slides)) payload.slides.forEach(function(s){ slides.push(s); });
        if(Array.isArray(payload && payload.warnings)) payload.warnings.forEach(function(w){ warnings.push(w); });
      });
      warnings.unshift('Stage 43AN used chunked PyMuPDF image-blob extraction to avoid browser/Cloud Run response-size failures.');
      if(Array.isArray(previousErrors) && previousErrors.length) warnings.push('Initial full extraction attempts failed before chunking: ' + previousErrors.join(' | ').slice(0, 1600));
      return {
        ok:true,
        deckTitle:(first && first.deckTitle) || 'Imported PDF',
        source:Object.assign({}, (first && first.source) || {}, { importedPages:slides.length, pageCount:pageCount || ((first && first.source && first.source.pageCount) || slides.length), importMode:'pymupdf-all-image-chunked' }),
        slides:slides,
        warnings:warnings,
        meta:Object.assign({}, (first && first.meta) || {}, { stage43anChunkedImageBlob:true, chunkCount:chunks.length, previousErrors:previousErrors || [] })
      };
    }
    function stage43anSleep(ms){
      return new Promise(function(resolve){ setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
    }
    function stage43anRetryAfterMs(res, fallback){
      try{
        const raw = res && res.headers && res.headers.get && res.headers.get('Retry-After');
        if(raw){
          const n = Number(raw);
          if(Number.isFinite(n) && n >= 0) return Math.min(45000, Math.max(1000, n * 1000));
          const date = Date.parse(raw);
          if(Number.isFinite(date)) return Math.min(45000, Math.max(1000, date - Date.now()));
        }
      }catch(_err){}
      return fallback;
    }
    async function stage43anFetchWithBackoff(endpoint, request, context){
      const attempts = [0, 4500, 9000, 18000, 30000];
      let lastErr = null;
      for(let i=0;i<attempts.length;i++){
        if(attempts[i] > 0){
          stage42sPublishImportStatus({ phase:'chunked-extract-rate-limit-wait', message:'Chunked image-blob extraction paused before retry ' + (i + 1) + ' for pages ' + (context && context.pageStart || '?') + '-' + ((context && context.pageStart && context.pageCount) ? (context.pageStart + context.pageCount - 1) : '?') + '…', pending:true, retryIndex:i + 1, pageStart:context && context.pageStart, pageCount:context && context.pageCount, waitMs:attempts[i] });
          await stage43anSleep(attempts[i]);
        }
        let res;
        try{ res = await fetch(endpoint, request); }
        catch(err){
          lastErr = err;
          if(i >= attempts.length - 1) throw err;
          continue;
        }
        if(res && res.status === 429 && i < attempts.length - 1){
          const waitMs = stage43anRetryAfterMs(res, attempts[Math.min(i + 1, attempts.length - 1)] || 9000);
          try{ await res.text(); }catch(_err){}
          stage42sPublishImportStatus({ phase:'chunked-extract-rate-limited', message:'Backend rate limited chunked extraction; waiting and retrying pages ' + (context && context.pageStart || '?') + '-' + ((context && context.pageStart && context.pageCount) ? (context.pageStart + context.pageCount - 1) : '?') + '…', pending:true, httpStatus:429, pageStart:context && context.pageStart, pageCount:context && context.pageCount, waitMs:waitMs });
          await stage43anSleep(waitMs);
          continue;
        }
        return res;
      }
      if(lastErr) throw lastErr;
      throw new Error('Chunked extraction retry attempts exhausted.');
    }
    async function stage43anPostExtractionChunk(endpoint, headers, file, attempt){
      const form = buildExtractionForm(file, attempt);
      let res;
      const startedAt = Date.now();
      stage42sPublishImportStatus({ phase:'chunked-extract-attempt', message:'Chunked image-blob extraction: pages ' + attempt.pageStart + '-' + (attempt.pageStart + attempt.pageCount - 1) + '…', endpoint:stage42sCompactEndpoint(endpoint), attempt:attempt.label, extractEngine:attempt.extractEngine, pageStart:attempt.pageStart, pageCount:attempt.pageCount, pending:true });
      try{ res = await stage43anFetchWithBackoff(endpoint, { method:'POST', headers, body:form, cache:'no-store', mode:'cors' }, attempt); }
      catch(fetchErr){ throw new Error(await describeExtractionFetchFailure(endpoint, fetchErr)); }
      const text = await res.text();
      let payload = null;
      try{ payload = text ? JSON.parse(text) : null; }
      catch(_err){ throw new Error(text ? text.slice(0, 500) : 'Empty response from extraction backend.'); }
      if(!res.ok || !payload || payload.ok === false){
        const msg = payload && payload.error && payload.error.message ? payload.error.message : ('Extraction backend failed with HTTP ' + res.status + '.');
        throw new Error(msg);
      }
      payload.warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
      payload.meta = Object.assign({}, payload.meta || {}, { stage43anChunkAttempt:attempt.label, stage43anPageStart:attempt.pageStart, elapsedMs:Date.now()-startedAt });
      return payload;
    }
    async function stage43anExtractPresentationFileInChunks(file, endpoint, headers, previousErrors){
      const chunks = [];
      let pageStart = 1;
      let pageCountKnown = 0;
      const maxPages = DEFAULT_MAX_IMPORT_PAGES;
      const chunkSize = 2;
      while(pageStart <= maxPages){
        const baseAttempt = {
          label:'Stage 43AN chunked PyMuPDF image-patch import pages ' + pageStart + '-' + Math.min(maxPages, pageStart + chunkSize - 1),
          extractEngine:'pymupdf-all-image',
          includePdfReviewAlternates:'0',
          includePdfRender:'0',
          includePdfBackground:'0',
          maxImagesPerSlide:64,
          reviewRenderZoom:0.20,
          reviewJpegQuality:36,
          vectorRenderZoom:0.62,
          vectorJpegQuality:42,
          textImageZoom:1.65,
          httpSafeMb:6,
          maxPdfPages:chunkSize,
          pageStart:pageStart,
          pageCount:chunkSize
        };
        try{
          const payload = await stage43anPostExtractionChunk(endpoint, headers, file, baseAttempt);
          const slides = Array.isArray(payload.slides) ? payload.slides : [];
          if(!slides.length) break;
          chunks.push(payload);
          if(payload.source && payload.source.pageCount) pageCountKnown = Math.max(pageCountKnown, Number(payload.source.pageCount) || 0);
          try{ global.__LUMINA_STAGE43AN_CHUNK_RATE_LIMIT_BACKOFF = { ok:true, lastPageStart:pageStart, lastPageCount:chunkSize, chunks:chunks.length, at:new Date().toISOString() }; }catch(_err){}
          await stage43anSleep(Number(global.__LUMINA_STAGE43AN_CHUNK_DELAY_MS || 1200));
          pageStart += slides.length;
          if(pageCountKnown && pageStart > Math.min(pageCountKnown, maxPages)) break;
        }catch(err){
          const msg = err && err.message ? err.message : String(err || 'Chunked extraction failed.');
          if(pageStart > 1 && /No pages|no slides|out of range|beyond/i.test(msg)) break;
          if(chunkSize > 1){
            // Rescue this 2-page chunk one page at a time at lower crop zoom.
            let rescuedAny = false;
            for(let singleStart = pageStart; singleStart < pageStart + chunkSize && singleStart <= maxPages; singleStart++){
              const singleAttempt = Object.assign({}, baseAttempt, { label:'Stage 43AN single-page rescue image-patch import page ' + singleStart, maxPdfPages:1, pageStart:singleStart, pageCount:1, maxImagesPerSlide:72, textImageZoom:1.45, vectorRenderZoom:0.52, vectorJpegQuality:38, httpSafeMb:4 });
              try{
                const payload = await stage43anPostExtractionChunk(endpoint, headers, file, singleAttempt);
                const slides = Array.isArray(payload.slides) ? payload.slides : [];
                if(!slides.length){ if(rescuedAny) break; throw new Error('No slides in single-page rescue.'); }
                chunks.push(payload);
                rescuedAny = true;
                if(payload.source && payload.source.pageCount) pageCountKnown = Math.max(pageCountKnown, Number(payload.source.pageCount) || 0);
                try{ global.__LUMINA_STAGE43AN_CHUNK_RATE_LIMIT_BACKOFF = { ok:true, singlePageRescue:true, lastPageStart:singleStart, chunks:chunks.length, at:new Date().toISOString() }; }catch(_err){}
                await stage43anSleep(Number(global.__LUMINA_STAGE43AN_CHUNK_DELAY_MS || 1200));
              }catch(singleErr){
                const singleMsg = singleErr && singleErr.message ? singleErr.message : String(singleErr || 'Single-page chunk failed.');
                if(rescuedAny && /No pages|no slides|out of range|beyond/i.test(singleMsg)) break;
                throw new Error('Chunked image-blob extraction failed at page ' + singleStart + ': ' + singleMsg);
              }
            }
            pageStart += chunkSize;
            if(pageCountKnown && pageStart > Math.min(pageCountKnown, maxPages)) break;
          }else{
            throw err;
          }
        }
      }
      if(!chunks.length) throw new Error('Chunked image-blob extraction did not return any slides.');
      const merged = stage43anMergeChunkPayloads(chunks, previousErrors);
      stage42sPublishImportStatus({ phase:'chunked-extract-complete', message:'Chunked extraction finished with ' + merged.slides.length + ' slides.', slideCount:merged.slides.length, chunkCount:chunks.length, pending:true, ok:true });
      try{ global.__LUMINA_STAGE43AN_CHUNKED_IMAGE_BLOB_EXTRACTION = { ok:true, slides:merged.slides.length, chunks:chunks.length, previousErrors:previousErrors || [], at:new Date().toISOString() }; }catch(_err){}
      return merged;
    }

    async function extractPresentationFile(file){
      if(typeof fetch !== 'function' || typeof FormData !== 'function') throw new Error('This browser does not support fetch/FormData upload.');
      const engine = extractionEngineValue();
      const endpoint = effectiveExtractionEndpointForEngine(extractionEndpointValue(), engine);
      if(!endpoint) throw new Error('Set an extraction backend endpoint first.');
      const headers = {};
      const token = extractionTokenValue();
      if(token) headers.Authorization = 'Bearer ' + token;
      const attempts = extractionAttemptsForFile(file);
      stage42sPublishImportStatus({ phase:'extract-start', message:'Starting extraction for ' + (file && file.name || 'selected file') + ' using ' + engine + '…', filename:file && file.name || '', fileSize:file && file.size || 0, endpoint:stage42sCompactEndpoint(endpoint), extractEngine:engine, attemptCount:attempts.length, pending:true, startedAt:new Date().toISOString() });
      const errors = [];
      for(let i=0;i<attempts.length;i++){
        const attempt = attempts[i];
        try{
          try{ global.__LUMINA_STAGE41Z_EXTRACTION_ATTEMPT = { index:i + 1, count:attempts.length, label:attempt.label, at:new Date().toISOString() }; }catch(_err){}
          stage42sPublishImportStatus({ phase:'extract-attempt', message:'Running extraction attempt ' + (i + 1) + ' of ' + attempts.length + ': ' + attempt.label, attemptIndex:i + 1, attemptCount:attempts.length, attempt:attempt.label, extractEngine:attempt.extractEngine || engine, pending:true });
          const payload = await postExtractionAttempt(endpoint, headers, buildExtractionForm(file, attempt), attempt);
          try{ global.__LUMINA_STAGE41M_LAST_EXTRACTION = { ok:true, slideCount:payload.slides.length, source:payload.source || null, meta:payload.meta || null, warnings:payload.warnings || [], endpoint:endpoint, filename:file && file.name || '', attempt:attempt.label, previousErrors:errors.slice() }; }catch(_err){}
          stage42sPublishImportStatus({ phase:'extract-complete', message:'Extraction finished with ' + payload.slides.length + ' slide' + (payload.slides.length === 1 ? '' : 's') + '.', slideCount:payload.slides.length, pending:true, ok:true });
          return payload;
        }catch(err){
          const msg = err && err.message ? err.message : String(err || 'Extraction failed.');
          stage42sPublishImportStatus({ phase:'extract-attempt-error', message:'Extraction attempt failed: ' + msg, attempt:attempt.label, attemptIndex:i + 1, attemptCount:attempts.length, pending:i < attempts.length - 1, ok:false, error:msg });
          errors.push(attempt.label + ': ' + msg);
          try{ global.__LUMINA_STAGE41Z_EXTRACTION_ERRORS = errors.slice(); }catch(_err){}
          if(i >= attempts.length - 1 || !extractionErrorLooksRetryable(msg)){
            if(engine === 'pymupdf-all-image' && extractionErrorLooksRetryable(msg)){
              try{
                stage42sPublishImportStatus({ phase:'chunked-extract-start', message:'Full image-blob extraction failed; retrying in small page chunks to keep each response under browser/Cloud Run limits…', pending:true, previousErrors:errors.slice() });
                return await stage43anExtractPresentationFileInChunks(file, endpoint, headers, errors.slice());
              }catch(chunkErr){
                errors.push('chunked image-blob retry: ' + (chunkErr && chunkErr.message ? chunkErr.message : String(chunkErr || 'failed')));
              }
            }
            const finalErr = new Error(msg + (errors.length > 1 ? '\\n\\nTried extraction modes:\\n- ' + errors.join('\\n- ') : ''));
            finalErr.cause = err;
            throw finalErr;
          }
        }
      }
      throw new Error(errors.join('\\n'));
    }
    function stage43gIsFreeformReviewSlide(slide){
      return !!(slide && slide.importMeta && (slide.importMeta.freeform || slide.importMeta.coordinateSystem || slide.importMeta.sourcePageNumber || slide.importMeta.sourcePageIndex));
    }
    function stage43gPrepareImportedSlide(slide, index){
      if(stage43gIsFreeformReviewSlide(slide)){
        const out = cloneJsonSafe(slide || {});
        out.__stage43gExactReviewImport = true;
        out.__stage43gReviewImportIndex = index;
        out.__stage43jPreviewLocked = true;
        out.importMeta = Object.assign({}, out.importMeta || {}, { stage43gExactReviewImport:true, stage43jPreviewLocked:true });
        return out;
      }
      return normalizeSlide(slide);
    }
    function applyImportedSlides(importedSlides, opts={}){
      const incoming = (importedSlides || []).map(stage43gPrepareImportedSlide).filter(Boolean);
      try{ global.__LUMINA_STAGE43G_LAST_IMPORT_HANDOFF = { requestedSlides:(importedSlides||[]).length, importedSlides:incoming.length, mode:opts && opts.mode || 'append', exactFreeformSlides:incoming.filter(stage43gIsFreeformReviewSlide).length, previewLockedSlides:incoming.filter(function(s){ return !!(s && s.__stage43jPreviewLocked); }).length, firstSlides:incoming.slice(0,6).map(function(s,i){ return { i, title:s&&s.title||'', sourcePageNumber:s&&s.importMeta&&(s.importMeta.sourcePageNumber||s.importMeta.pageNumber)||null, previewLocked:!!(s&&s.__stage43jPreviewLocked), blockCount:(s&&s.leftBlocks?s.leftBlocks.length:0)+(s&&s.rightBlocks?s.rightBlocks.length:0), firstHint:(s&&s.leftBlocks&&s.leftBlocks[0]&&(s.leftBlocks[0].sourceTextHint||s.leftBlocks[0].title||'')||'').slice(0,120) }; }), at:new Date().toISOString() }; global.__LUMINA_STAGE43J_IMPORT_PREVIEW_LOCKED_BATCH = { ok:true, lockedSlides:incoming.filter(function(s){ return !!(s && s.__stage43jPreviewLocked); }).length, totalSlides:incoming.length, at:new Date().toISOString() }; global.__LUMINA_STAGE41M_LAST_IMPORT = global.__LUMINA_STAGE43G_LAST_IMPORT_HANDOFF; }catch(_err){}
      if(!incoming.length) throw new Error('No slides were imported.');
      syncPreviewFiguresToDraft(false);
      saveCurrentBlockToDraft();
      saveCurrentSlideToDeck();
      if(opts.theme) applyThemeToForm(opts.theme);
      if(opts.presentationOptions) applyPresentationOptions(opts.presentationOptions);
      const mode = opts.mode === 'replace' ? 'replace' : 'append';
      if(mode === 'replace'){
        setSlides(incoming);
        setActiveIndex(0);
        if(opts.deckTitle) fields.deckTitle.value = opts.deckTitle;
      } else {
        const current = getSlides();
        const base = current.length ? clone(current) : [];
        const next = base.concat(incoming);
        setSlides(next);
        setActiveIndex(base.length);
        if(opts.deckTitle && !fields.deckTitle.value) fields.deckTitle.value = opts.deckTitle;
      }
      const slides = getSlides();
      const activeIndex = getActiveIndex();
      // Stage 43I: isolate the import handoff from the previous preview DOM.
      // buildPreview() calls currentDraftSlide(), which normally syncs figure positions
      // from the existing preview before rendering. Right after importing, that existing
      // preview still belongs to the pre-import slide, so syncing it can overwrite the
      // freshly reviewed imported blocks with stale/cover-slide figure data.
      try{
        const previewEl = doc().getElementById('preview');
        if(previewEl) previewEl.innerHTML = '';
        global.__LUMINA_STAGE43I_IMPORT_PREVIEW_SYNC_ISOLATED = {
          ok:true,
          activeIndex:activeIndex,
          importedSlides:incoming.length,
          mode:mode,
          at:new Date().toISOString()
        };
      }catch(_err){}
      applySlideToForm(slides[activeIndex]);
      renderDeckList();
      buildPreview();
      scheduleAutosave('Autosaved after import.');
      showToast('Imported ' + incoming.length + ' slide' + (incoming.length === 1 ? '' : 's') + '.');
    }




    function stage42fEscapeHtml(value){
      return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
        return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;';
      });
    }
    function clearStage42fAiRepairNotice(){
      try{
        var d = doc();
        var box = d && d.getElementById ? d.getElementById('stage42f-ai-repair-notice') : null;
        if(box && box.parentNode) box.parentNode.removeChild(box);
      }catch(_err){}
    }
    function notifyStage42fAiRepairIssue(message, detail){
      var msg = String(message || 'Mathpix patch repair did not go through; kept the source-extracted slides.');
      var details = String(detail || 'The imported source slides remain loaded, so no content was lost.');
      try{
        globalThis.__LUMINA_STAGE42F_AI_REPAIR_NOTIFICATION = {
          ok:false,
          pending:false,
          message:msg,
          detail:details,
          keptSource:true,
          backgroundStatus:globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || null,
          at:new Date().toISOString()
        };
      }catch(_err){}
      try{ if(typeof showToast === 'function') showToast(msg); }catch(_err){}
      try{
        var d = doc();
        if(!d || !d.body) return;
        var box = d.getElementById('stage42f-ai-repair-notice');
        if(!box){
          box = d.createElement('div');
          box.id = 'stage42f-ai-repair-notice';
          box.setAttribute('role', 'status');
          box.setAttribute('aria-live', 'polite');
          box.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;max-width:min(460px,calc(100vw - 36px));background:#fff7ed;color:#7c2d12;border:1px solid #fdba74;border-left:6px solid #f97316;border-radius:16px;box-shadow:0 18px 50px rgba(15,23,42,.22);padding:14px 14px 12px 14px;font:14px/1.42 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
          d.body.appendChild(box);
        }
        box.innerHTML = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px"><div><strong style="display:block;margin-bottom:4px">Mathpix patch repair did not complete</strong><div>'+stage42fEscapeHtml(msg)+'</div><div style="font-size:12px;margin-top:6px;color:#9a3412">'+stage42fEscapeHtml(details)+'</div></div><button type="button" data-stage42f-close style="border:1px solid rgba(124,45,18,.25);background:#fff;color:#7c2d12;border-radius:999px;padding:4px 9px;font-weight:700;cursor:pointer">Close</button></div>';
        var close = box.querySelector('[data-stage42f-close]');
        if(close) close.onclick = function(){ clearStage42fAiRepairNotice(); };
      }catch(_err){}
    }
    function notifyStage42fAiRepairSlow(batchId){
      try{
        var status = globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || {};
        if(!status.pending || (batchId && status.batchId !== batchId)) return;
        notifyStage42fAiRepairIssue('Mathpix patch repair is taking longer than expected; source-extracted slides are already loaded.', 'You can keep editing. If Mathpix repair succeeds later, it will replace only this imported batch; otherwise the source slides stay loaded.');
      }catch(_err){}
    }


    function stage42lBlocksForStaleCompare(slide){
      var s = slide || {};
      try{ return (Array.isArray(s.leftBlocks) ? s.leftBlocks : []).concat(Array.isArray(s.rightBlocks) ? s.rightBlocks : []); }
      catch(_err){ return []; }
    }
    function stage42lCompactImportedSlideSignature(slide){
      var s = slide || {};
      var blocks = stage42lBlocksForStaleCompare(s);
      var meta = s.importMeta && typeof s.importMeta === 'object' ? s.importMeta : {};
      return JSON.stringify({
        slideType:String(s.slideType || ''),
        title:String(s.title || ''),
        sourcePage:String(meta.sourcePage || meta.page || meta.pageIndex || meta.sourceSlide || meta.slideIndex || ''),
        blockCount:blocks.length,
        blockHints:blocks.slice(0, 10).map(function(b){
          return {
            mode:String(b && b.mode || ''),
            role:String(b && b.importRole || ''),
            text:String(b && b.content || '').replace(/\s+/g, ' ').slice(0, 160)
          };
        })
      });
    }
    function stage42lLooksLikeSameImportedSlide(currentSlide, rawSlide){
      if(!currentSlide || !rawSlide) return false;
      try{
        if(currentSlide.__stage42eImportBatchId && rawSlide.__stage42eImportBatchId && currentSlide.__stage42eImportBatchId === rawSlide.__stage42eImportBatchId) return true;
        return stage42lCompactImportedSlideSignature(currentSlide) === stage42lCompactImportedSlideSignature(rawSlide);
      }catch(_err){ return false; }
    }
    function markStage42eImportBatch(slides, batchId){
      return (slides || []).map(function(slide, i){
        var out = cloneJsonSafe(slide || {});
        out.__stage42eImportBatchId = batchId;
        out.__stage42eImportBatchIndex = i;
        out.__stage42eRawImported = true;
        return out;
      });
    }

    function stage43fSlidePageNumber(slide, fallbackIndex){
      var meta = slide && slide.importMeta && typeof slide.importMeta === 'object' ? slide.importMeta : {};
      var raw = meta.sourcePageNumber || meta.pageNumber || meta.sourcePage || meta.page || meta.pageIndex || meta.sourceSlide || '';
      var n = Number(raw);
      if(Number.isFinite(n) && n > 0) return n;
      if(Number.isFinite(n) && n === 0) return 1;
      return Number(fallbackIndex || 0) + 1;
    }
    function stage43fLooksLikeCoverArtifact(value){
      var s = String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if(!s) return false;
      return /Instructors:\s*Sarah Dean|Thorsten Joachims|John Thickstun|CS3780\/CS5780|Attention\s+and\s+Transformers|Introduction\s+to\s+Machine\s+Learning/i.test(s);
    }
    function stage43fIsMathpixConvertedBlock(block){
      var role = String(block && block.importRole || '').toLowerCase();
      var sub = String(block && block.importSubmode || '').toLowerCase();
      return !!(block && (block.mathpix || role.indexOf('mathpix-') === 0 || sub.indexOf('mathpix-') === 0));
    }
    function stage43fMergeMathpixRepairOntoSourceSlides(sourceSlides, repairedSlides){
      var sources = Array.isArray(sourceSlides) ? sourceSlides : [];
      var repairs = Array.isArray(repairedSlides) ? repairedSlides : [];
      if(!sources.length || !repairs.length || sources.length !== repairs.length) return repairs;
      var merged = sources.map(function(sourceSlide, slideIndex){
        var out = cloneJsonSafe(sourceSlide || {});
        var repaired = repairs[slideIndex] || {};
        ['leftBlocks','rightBlocks'].forEach(function(column){
          var sourceList = Array.isArray(out[column]) ? out[column] : [];
          var repairList = Array.isArray(repaired[column]) ? repaired[column] : [];
          out[column] = sourceList.map(function(sourceBlock, blockIndex){
            var rb = repairList[blockIndex];
            if(!stage43fIsMathpixConvertedBlock(rb)) return sourceBlock;
            var pageNumber = stage43fSlidePageNumber(out, slideIndex);
            var repairedText = String((rb && (rb.content || rb.title || '')) || '');
            if(pageNumber > 1 && stage43fLooksLikeCoverArtifact(repairedText)){
              try{
                globalThis.__LUMINA_STAGE43F_SKIPPED_COVER_MATHPIX_BLOCKS = globalThis.__LUMINA_STAGE43F_SKIPPED_COVER_MATHPIX_BLOCKS || [];
                globalThis.__LUMINA_STAGE43F_SKIPPED_COVER_MATHPIX_BLOCKS.push({ slideIndex:slideIndex, pageNumber:pageNumber, column:column, blockIndex:blockIndex, preview:repairedText.slice(0,160), at:new Date().toISOString() });
              }catch(_err){}
              return sourceBlock;
            }
            var nextBlock = cloneJsonSafe(rb);
            // Preserve the exact source placement and source label. Mathpix should only
            // replace the inside of the patch, never the slide/page identity or geometry.
            nextBlock.layout = cloneJsonSafe(sourceBlock && sourceBlock.layout || nextBlock.layout || {});
            if(sourceBlock && sourceBlock.importSourceLayout) nextBlock.importSourceLayout = cloneJsonSafe(sourceBlock.importSourceLayout);
            if(sourceBlock && sourceBlock.title) nextBlock.title = sourceBlock.title;
            nextBlock.sourceTextHint = nextBlock.sourceTextHint || (sourceBlock && (sourceBlock.sourceTextHint || sourceBlock.mathImageSourceText)) || '';
            nextBlock.originalImagePatchContent = nextBlock.originalImagePatchContent || (sourceBlock && sourceBlock.content) || '';
            nextBlock.stage43fSafeMerged = true;
            return nextBlock;
          });
        });
        out.title = sourceSlide && sourceSlide.title || out.title || repaired.title || '';
        out.kicker = sourceSlide && sourceSlide.kicker || out.kicker || '';
        out.lede = sourceSlide && sourceSlide.lede || out.lede || '';
        out.notesTitle = sourceSlide && sourceSlide.notesTitle || out.notesTitle || '';
        out.notesBody = sourceSlide && sourceSlide.notesBody || out.notesBody || '';
        out.importMeta = cloneJsonSafe(sourceSlide && sourceSlide.importMeta || out.importMeta || {});
        out.mathpixReviewed = true;
        return out;
      });
      try{ globalThis.__LUMINA_STAGE43F_SAFE_MATHPIX_MERGE = { ok:true, sourceSlides:sources.length, repairedSlides:repairs.length, at:new Date().toISOString() }; }catch(_err){}
      return merged;
    }
    function applyStage42eBackgroundAiRepair(rawBatchSlides, repairedDeck, startIndex, batchId, deckTitle){
      var repairedSlides = repairedDeck && Array.isArray(repairedDeck.slides) ? repairedDeck.slides : [];
      if(repairedDeck && repairedDeck.mathpixReviewed){
        repairedSlides = stage43fMergeMathpixRepairOntoSourceSlides(rawBatchSlides, repairedSlides);
      }
      if(!repairedSlides.length) return false;
      var incoming = repairedSlides.map(function(slide, i){
        var out = normalizeSlide(slide);
        out.__stage42eImportBatchId = batchId;
        out.__stage42eImportBatchIndex = i;
        out.__stage42eAiRepaired = true;
        return out;
      }).filter(Boolean);
      if(!incoming.length) return false;
      var current = getSlides();
      var replaceCount = (rawBatchSlides || []).length;
      var expectedStart = Math.max(0, Number(startIndex) || 0);
      var stillSameBatch = true;
      var matchedByMarker = 0;
      var matchedBySignature = 0;
      for(var i = 0; i < replaceCount; i++){
        var slide = current[expectedStart + i];
        var rawSlide = (rawBatchSlides || [])[i];
        if(slide && slide.__stage42eImportBatchId === batchId){ matchedByMarker += 1; continue; }
        if(slide && stage42lLooksLikeSameImportedSlide(slide, rawSlide)){ matchedBySignature += 1; continue; }
        stillSameBatch = false; break;
      }
      if(!stillSameBatch){
        var mathpixStatsForForce = repairedDeck && (repairedDeck.aiPatchStats || repairedDeck.mathpixPatchStats || null) || null;
        var mathpixChangedForForce = mathpixStatsForForce && Number(mathpixStatsForForce.changedCount || mathpixStatsForForce.convertedText || 0) || 0;
        var canForceMathpixApply = !!(repairedDeck && repairedDeck.mathpixReviewed && incoming.length === replaceCount && current && current.length >= expectedStart + replaceCount && mathpixChangedForForce > 0);
        if(canForceMathpixApply){
          stillSameBatch = true;
          try{
            globalThis.__LUMINA_STAGE43C_MATHPIX_STALE_GUARD_FIX = {
              appliedDespiteStaleGuard:true,
              reason:'Mathpix repair returned concrete patch conversions and the imported slide range still exists; applying despite lost temporary batch markers.',
              batchId:batchId,
              expectedStart:expectedStart,
              replaceCount:replaceCount,
              changedCount:mathpixChangedForForce,
              matchedByMarker:matchedByMarker,
              matchedBySignature:matchedBySignature,
              at:new Date().toISOString()
            };
          }catch(_err){}
        }
      }
      if(!stillSameBatch){
        try{ globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR = Object.assign({}, globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || {}, { ok:false, pending:false, skipped:true, stale:true, reason:'Imported batch changed before Mathpix repair finished.', batchId:batchId, expectedStart:expectedStart, matchedByMarker:matchedByMarker, matchedBySignature:matchedBySignature, at:new Date().toISOString() }); }catch(_err){}
        try{ if(typeof showToast === 'function') showToast('Mathpix patch repair skipped because the imported slides changed. Source slides stayed loaded.'); }catch(_err){}
        return false;
      }
      var next = cloneJsonSafe(current || []);
      next.splice.apply(next, [expectedStart, replaceCount].concat(incoming));
      setSlides(next);
      setActiveIndex(expectedStart);
      var slidesNow = getSlides();
      if(slidesNow[expectedStart]) applySlideToForm(slidesNow[expectedStart]);
      renderDeckList();
      buildPreview();
      scheduleAutosave('Autosaved after Mathpix patch repair.');
      try{
        globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR = Object.assign({}, globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || {}, { ok:true, pending:false, applied:true, replacedSlides:replaceCount, repairedSlides:incoming.length, deckTitle:deckTitle || '', batchId:batchId, at:new Date().toISOString() });
      }catch(_err){}
      clearStage42fAiRepairNotice();
      const patchStats = repairedDeck && repairedDeck.aiPatchStats || globalThis.__LUMINA_STAGE42O_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42N_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42L_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42J_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42I_PATCH_AI_IMPORT_REPAIR || globalThis.__LUMINA_STAGE42H_PATCH_AI_IMPORT_REPAIR || null;
      const patchChanged = patchStats && Number(patchStats.changedCount || 0) || 0;
      if(patchChanged > 0) showToast('Mathpix patch repair applied to ' + incoming.length + ' imported slide' + (incoming.length === 1 ? '' : 's') + '.');
      else showToast('Mathpix patch repair completed; source slides stayed loaded because no patch changes were needed.');
      return true;
    }
    function isDocAiSemanticImportedBatch(slides){
      return (slides || []).some(function(slide){
        var meta = slide && slide.importMeta && typeof slide.importMeta === 'object' ? slide.importMeta : {};
        var engine = String(meta.engine || meta.importEngine || meta.stage || '').toLowerCase();
        return engine.indexOf('google-document-ai') >= 0 || engine.indexOf('docai') >= 0 || engine.indexOf('document-ai-semantic') >= 0;
      });
    }

    async function importSelectedFiles(fileList){
      initExtractionFields();
      const files = Array.from(fileList || []);
      if(!files.length) throw new Error('Choose one or more files first.');
      stage42sPublishImportStatus({ phase:'import-start', message:'Import started for ' + files.length + ' file' + (files.length === 1 ? '' : 's') + '.', fileCount:files.length, filenames:files.map(function(f){ return f && f.name || 'file'; }), pending:true, ok:null, startedAt:new Date().toISOString() });
      let imported = [];
      let deckTitle = '';
      const warnings = [];
      let usedExtractionBackend = false;
      for(const file of files){
        const lower = String(file.name || '').toLowerCase();
        if(!deckTitle) deckTitle = String(file.name || 'Imported deck').replace(/\.[^.]+$/,'');

        if(isExtractablePresentationFile(file)){
          if(extractionBackendEnabled()){
            stage42sPublishImportStatus({ phase:'extract-file', message:'Sending ' + (file.name || 'presentation') + ' to extraction backend…', filename:file.name || '', pending:true });
            try{
              const payload = await extractPresentationFile(file);
              usedExtractionBackend = true;
              if(payload.deckTitle && !deckTitle) deckTitle = payload.deckTitle;
              const payloadSlides = Array.isArray(payload.slides) ? payload.slides : [];
              imported.push(...payloadSlides);
              const expectedCount = payload && payload.source ? Number(payload.source.pageCount || payload.source.slideCount || 0) : 0;
              if(expectedCount && payloadSlides.length < expectedCount){
                const msg = 'Extraction backend returned only ' + payloadSlides.length + ' of ' + expectedCount + ' pages/slides. This usually means the frontend is still pointing to an old backend revision or the extraction response was too large. Check /health and redeploy Stage 41J or newer.';
                if(payloadSlides.length <= 1 && expectedCount > 1) throw new Error(msg);
                warnings.push(msg);
              }
              if(Array.isArray(payload.warnings)) warnings.push(...payload.warnings);
            } catch(err){
              throw new Error('Could not extract ' + (file.name || 'presentation') + ' with the Lumina extraction backend. ' + (err && err.message ? err.message : ''));
            }
          } else if(/\.pdf$/i.test(lower) || file.type === 'application/pdf'){
            const dataUrl = await readFileAsDataUrl(file);
            imported.push(makeReferencePdfSlide(dataUrl, file.name));
          } else {
            throw new Error('PPT/PPTX import requires the extraction backend. Enable it and set the backend endpoint.');
          }
          continue;
        }

        if((file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|gif|webp|svg)$/i.test(lower)){
          const dataUrl = await readFileAsDataUrl(file);
          imported.push(makeReferenceImageSlide(dataUrl, file.name));
        } else {
          const text = await file.text();
          if(/\.(md|markdown)$/i.test(lower)) imported.push(...parseMarkdownToSlides(text));
          else if(/\.(tex|ltx)$/i.test(lower)) imported.push(...parseBeamerToSlides(text));
          else if(/\.json$/i.test(lower)) imported.push(...parseJsonOutlineToSlides(text));
          else imported.push(...parsePowerPointTextToSlides(text));
        }
      }
      let importDeck = { deckTitle, slides: imported, theme:null, presentationOptions:null, aiReviewed:false, aiRepairPending:false };
      if(usedExtractionBackend){
        imported = await reviewExtractedSlidesWithAlternates(imported, deckTitle);
        const skipBackgroundAiRepair = isDocAiSemanticImportedBatch(imported);
        if(skipBackgroundAiRepair) warnings.push('Google Document AI fast import used layout/OCR fallback and skipped backend/background AI rebuild to avoid long waits. Use the import review dialog to choose editable extraction or rendered page image per slide.');
        importDeck = { deckTitle, slides: imported, theme:null, presentationOptions:null, aiReviewed:skipBackgroundAiRepair, aiRepairPending: aiReviewAfterImportEnabled() && !skipBackgroundAiRepair };
      }
      const mode = importModeValue();
      const startIndex = mode === 'replace' ? 0 : getSlides().length;
      const batchId = 'stage42e-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      let rawBatch = imported;
      if(importDeck.aiRepairPending){
        imported = markStage42eImportBatch(imported, batchId);
        rawBatch = imported;
      }
      stage42sPublishImportStatus({ phase:'applying-slides', message:'Loading ' + imported.length + ' imported slide' + (imported.length === 1 ? '' : 's') + ' into the deck…', slideCount:imported.length, pending:true });
      applyImportedSlides(imported, { mode, deckTitle, theme: importDeck.theme, presentationOptions: importDeck.presentationOptions });
      stage42sPublishImportStatus({ phase:'import-complete', message:'Imported ' + imported.length + ' slide' + (imported.length === 1 ? '' : 's') + '.', slideCount:imported.length, pending:false, ok:true, finishedAt:new Date().toISOString() });
      if(warnings.length) showToast(warnings[0]);
      if(importDeck.aiRepairPending){
        showToast('Imported source slides. Mathpix patch repair is running in the background…');
        try{ globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR = { ok:null, pending:true, applied:false, batchId, startIndex, slideCount:rawBatch.length, at:new Date().toISOString() }; }catch(_err){}
        setTimeout(function(){ notifyStage42fAiRepairSlow(batchId); }, 60000);
        maybeReviewImportedDeckWithAi(rawBatch, deckTitle).then(function(repairedDeck){
          if(repairedDeck && repairedDeck.aiReviewed && !repairedDeck.aiReviewFailed){
            applyStage42eBackgroundAiRepair(rawBatch, repairedDeck, startIndex, batchId, deckTitle);
          }else{
            try{ globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR = Object.assign({}, globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || {}, { ok:false, pending:false, applied:false, keptSource:true, reason:repairedDeck && repairedDeck.aiReviewError || 'AI repair did not return a repaired deck.', at:new Date().toISOString() }); }catch(_err){}
            notifyStage42fAiRepairIssue('Mathpix patch repair did not produce changes; kept the source-extracted slides.', repairedDeck && repairedDeck.aiReviewError || 'The Mathpix backend did not return a valid repaired deck.');
          }
        }).catch(function(err){
          try{ globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR = Object.assign({}, globalThis.__LUMINA_STAGE42E_BACKGROUND_AI_REPAIR || {}, { ok:false, pending:false, applied:false, keptSource:true, error:err && err.message ? err.message : String(err), at:new Date().toISOString() }); }catch(_err){}
          notifyStage42fAiRepairIssue('Mathpix patch repair failed; kept the source-extracted slides.', err && err.message ? err.message : String(err));
        });
      }
    }

    async function loadDeckFromFile(file){
      const text = await file.text();
      let payload;
      if(/\.json$/i.test(file.name) || String(text).trim().startsWith('{')){
        payload = JSON.parse(text);
      } else {
        const match = text.match(new RegExp('<script id=["\']deck-source["\'][^>]*type=["\']application\\/json["\'][^>]*>([\\s\\S]*?)<\\/script>', 'i'));
        if(!match) throw new Error('This file does not contain an editable deck-source block.');
        payload = JSON.parse(match[1]);
      }
      if(!payload || !Array.isArray(payload.slides)) throw new Error('Could not parse slides from this HTML file.');
      fields.deckTitle.value = payload.deckTitle || 'My HTML Presentation';
      if(payload.theme) applyThemeToForm(payload.theme);
      if(payload.presentationOptions) applyPresentationOptions(payload.presentationOptions);
      const nextSlides = payload.slides.map(normalizeSlide);
      setSlides(nextSlides);
      setActiveIndex(nextSlides.length ? 0 : -1);
      if(getActiveIndex() >= 0) applySlideToForm(getSlides()[0]);
      else clearForm(false);
      buildPreview();
      renderDeckList();
    }

    async function loadPresentationJsonFromFile(file){
      const text = await file.text();
      const payload = JSON.parse(text);
      if(!payload || !Array.isArray(payload.slides)) throw new Error('This JSON file does not contain a presentation with a slides array.');
      fields.deckTitle.value = payload.deckTitle || 'My HTML Presentation';
      if(payload.theme) applyThemeToForm(payload.theme);
      if(payload.presentationOptions) applyPresentationOptions(payload.presentationOptions);
      const nextSlides = payload.slides.map(normalizeSlide);
      setSlides(nextSlides);
      setActiveIndex(nextSlides.length ? 0 : -1);
      if(getActiveIndex() >= 0) applySlideToForm(getSlides()[0]);
      else clearForm(false);
      buildPreview();
      renderDeckList();
    }

    setTimeout(initExtractionFields, 0);

    const api = {
      importModeValue,
      applyImportedSlides,
      importSelectedFiles,
      loadDeckFromFile,
      loadPresentationJsonFromFile,
      extractPresentationFile,
      maybeReviewImportedDeckWithAi
    };
    try{
      global.__LUMINA_FILE_IO_API = api;
      global.__LUMINA_STAGE41T_FILE_IO_API = api;
      global.__LUMINA_STAGE41U_FILE_IO_API = api;
      global.__LUMINA_STAGE41V_FILE_IO_API = api;
      global.LuminaStage41TFileIoApi = api;
      global.LuminaStage41UFileIoApi = api;
      global.LuminaStage41VFileIoApi = api;
      global.__LUMINA_STAGE41V_FILE_IO_READY = { stage:'stage43an-rate-limit-backoff-chunked-image-blob-20260517-1', ready:true, at:new Date().toISOString(), apiKeys:Object.keys(api) };
      global.__LUMINA_STAGE41U_FILE_IO_READY = global.__LUMINA_STAGE41V_FILE_IO_READY;
      global.__LUMINA_STAGE41T_FILE_IO_READY = global.__LUMINA_STAGE41V_FILE_IO_READY; global.__LUMINA_STAGE41S_FILE_IO_READY = global.__LUMINA_STAGE41V_FILE_IO_READY;
    }catch(_err){}
    return api;
  }

  global.LuminaFileIo = { createApi };
})(window);
