/* Stage 36Y: Copilot core with deck-only dev prompt, reference-link web search, and stronger figure directives.
   Stage 34K filename retained for cache-compatible loader continuity.

   It receives a narrow dependency bridge from legacy-app-stage24c.js and keeps
   the main editor protected by the Stage 24C/34K guarded binder. */
function safeString(value){ return String(value == null ? '' : value); }
function noop(){ }
function createApi(deps){
  deps = deps || {};
  const classicCore = deps.classicCore || null;
  const classicCompat = !!deps.__classicCompat && !!classicCore;
  function maybeClassic(method, fallback){
    return function(){
      if(classicCompat && classicCore && typeof classicCore[method] === 'function'){
        return classicCore[method].apply(classicCore, arguments);
      }
      return fallback.apply(null, arguments);
    };
  }
  const copilotEls = deps.copilotEls || {};
  const COPILOT_API_KEY_STORAGE = deps.apiKeyStorage || 'html-presentation-generator-openai-api-key-v1';
  const COPILOT_SETTINGS_STORAGE = deps.settingsStorage || 'html-presentation-generator-copilot-settings-v1';
  const COPILOT_DEFAULT_ENDPOINT = deps.defaultEndpoint || 'https://api.openai.com/v1/responses';
  const COPILOT_DEV_PROMPT_FILE = deps.devPromptFile || 'prompts/dev.txt';
  const COPILOT_DECK_PROMPT_FILE = deps.deckPromptFile || 'prompts/deck.txt';
  const COPILOT_DEFAULT_DECK_PROMPT_PREFIX = [
    'Deck-level generation instructions:',
    'Treat these as deck-only developer instructions.',
    'Create a coherent complete presentation, not a loose collection of slides.',
    'Use a strong narrative arc: title/context, motivation, key ideas, details/examples, synthesis, and closing recap.',
    'Make slide titles specific and informative.',
    'When the user provides reference lecture notes, pasted excerpts, or URLs, follow that source structure closely instead of giving a generic topic overview.',
    'When the request or these instructions ask for figures, include explicit placeholder figure blocks with concrete figure descriptions, even if no image file is available.',
    'Use speaker notes to explain transitions, emphasis, and teaching guidance.',
    'Keep the deck editable: prefer normal text/panel blocks and avoid embedding large custom HTML unless explicitly requested.'
  ].join('\n');
  let deckPromptPrefixCache = null;
  let copilotReferencePdfFiles = [];
  const store = deps.localStorage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  const fetchImpl = deps.fetch || (typeof globalThis !== 'undefined' ? globalThis.fetch : null);
  const showToast = typeof deps.showToast === 'function' ? deps.showToast : noop;
  const alertFn = typeof deps.alert === 'function' ? deps.alert : function(message){ if(typeof globalThis !== 'undefined' && globalThis.alert) globalThis.alert(message); };
  const fields = deps.fields || {};
  const normalizeSlide = typeof deps.normalizeSlide === 'function' ? deps.normalizeSlide : function(slide){ return Object.assign({ leftBlocks:[], rightBlocks:[] }, slide || {}); };
  const normalizeBlock = typeof deps.normalizeBlock === 'function' ? deps.normalizeBlock : function(block){ return Object.assign({ mode:'panel', title:'Block', content:'' }, block || {}); };
  const runtimeStatus = deps.copilotRuntimeStatus || { stage:'stage37h-20260427-1' };

  function updateCopilotRuntime(patch){
    if(typeof deps.updateRuntime === 'function') return deps.updateRuntime(Object.assign({ runtimeSource:'esm:js/esm/copilot-stage34k.js' }, patch || {}));
    Object.assign(runtimeStatus, { runtimeSource:'esm:js/esm/copilot-stage34k.js' }, patch || {});
    return runtimeStatus;
  }
  updateCopilotRuntime({ stage:'stage37h-20260427-1', lastRuntimeLoadedAt:new Date().toISOString(), devPromptFile:COPILOT_DEV_PROMPT_FILE, deckPromptFile:COPILOT_DECK_PROMPT_FILE, deckPromptAppliesTo:'deck-only' });

  function setCopilotStatus(message, isError=false){
    updateCopilotRuntime({ lastStatus: safeString(message), lastError: isError ? safeString(message) : runtimeStatus.lastError });
    if(copilotEls.status){
      copilotEls.status.textContent = message;
      copilotEls.status.style.color = isError ? '#ffb4b4' : '';
      copilotEls.status.style.borderColor = isError ? 'rgba(255,120,120,.35)' : '';
    }
  }
  function getStorageItem(key){ try{ return store ? store.getItem(key) : null; }catch(_){ return null; } }
  function setStorageItem(key, value){ try{ if(store) store.setItem(key, value); }catch(_){ } }
  function removeStorageItem(key){ try{ if(store) store.removeItem(key); }catch(_){ } }

  function isDefaultOpenAiEndpoint(endpoint){
    try{
      const host = new URL(endpoint || COPILOT_DEFAULT_ENDPOINT, deps.locationHref || (typeof location !== 'undefined' ? location.href : 'https://example.invalid/')).hostname;
      return /(^|\.)api\.openai\.com$/i.test(host);
    }catch(_){
      return false;
    }
  }
  function visibleKeyPrefix(key){
    const k = safeString(key).trim();
    if(!k) return '';
    return k.slice(0, Math.min(10, k.length)) + (k.length > 10 ? '…' : '');
  }
  function validateCopilotApiKey(key, endpoint, options={}){
    const k = safeString(key).trim();
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
    try{ warning = validateCopilotApiKey(key, endpoint, { requireKey:false }) || ''; }
    catch(err){ warning = err.message || String(err); isError = true; }
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
    const raw = safeString(message).trim();
    if(status === 401) return 'OpenAI rejected the API key. Check that you pasted the secret key value itself, not the API keys page URL, and that the key has not been revoked. Details: ' + raw;
    if(status === 403) return 'The request was forbidden. Check project permissions, model access, endpoint, and whether your key is allowed to use this API. Details: ' + raw;
    if(status === 404) return 'The endpoint or model was not found. Check the endpoint URL and model name. Details: ' + raw;
    if(status === 429) return 'OpenAI returned a rate limit/quota error. Check billing, project limits, or wait and retry. Details: ' + raw;
    if(status >= 500) return 'The API service returned a server error. Retry later or check the endpoint/backend logs. Details: ' + raw;
    return raw || ('Copilot request failed with status ' + status);
  }
  function recordCopilotError(err){
    const msg = (err && err.message) || safeString(err || 'Copilot failed.');
    updateCopilotRuntime({ lastError: msg, lastErrorAt: new Date().toISOString(), requestInFlight:false });
    return msg;
  }
  function recordCopilotSuccess(summary){
    updateCopilotRuntime({ lastSuccessAt: new Date().toISOString(), lastStatus: summary || 'success', lastError:'', requestInFlight:false });
  }

  function loadCopilotSettings(){
    try{
      const raw = getStorageItem(COPILOT_SETTINGS_STORAGE);
      const s = raw ? JSON.parse(raw) : {};
      if(copilotEls.model && s.model) copilotEls.model.value = s.model;
      if(copilotEls.endpoint && s.endpoint) copilotEls.endpoint.value = s.endpoint;
      if(copilotEls.tone && s.tone) copilotEls.tone.value = s.tone;
      if(copilotEls.webSearch && typeof s.webSearch === 'boolean') copilotEls.webSearch.checked = s.webSearch;
      const key = getStorageItem(COPILOT_API_KEY_STORAGE);
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
      setStorageItem(COPILOT_SETTINGS_STORAGE, JSON.stringify(s));
      if(saveKey && copilotEls.apiKey){
        if(key) setStorageItem(COPILOT_API_KEY_STORAGE, key);
        else removeStorageItem(COPILOT_API_KEY_STORAGE);
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
      'Do not invent citations or external image-file URLs. When a figure is needed, prefer an image block with a concrete assetPrompt; the app will generate the image.',
      'If the user asks to follow lecture notes or a reference link, do not answer as a generic topic summary; organize the deck around the referenced material and say in the summary when reference content could not be accessed.',
      'If the instructions mention figures, diagrams, plots, pictures, or visuals, prefer mode image with a concrete assetPrompt instead of a vague placeholder.',
      'For image blocks, set mode to image, put a short caption in content, a detailed generation prompt in assetPrompt, concise alt text in assetAlt, and a size hint in assetSize. Use empty asset fields for non-image blocks.',
      'When several small related visuals are needed on one slide, ask for one composite image/mosaic in a single image block instead of many separate image blocks.',
      'Write image prompts that match the slide style and avoid dense embedded text unless the user explicitly asks for text inside the image.',
      'For demos, animations, simulations, calculators, or arbitrary HTML, use mode custom and put a complete self-contained HTML document or fragment in content. Use inline CSS and JavaScript. Keep it sandbox-friendly: no external libraries, no network calls, no popups, no tracking, and no infinite heavy loops.',
      'When provided with style context or a style screenshot, use it to match colors, spacing, and visual tone. Do not embed the screenshot itself unless the user explicitly asks.'
    ].join('\n');
  }
  function compactDeckForCopilot(){
    const deck = typeof deps.currentDeckData === 'function' ? deps.currentDeckData() : {};
    const slides = Array.isArray(deck.slides) ? deck.slides : [];
    return {
      deckTitle: deck.deckTitle,
      theme: deck.theme,
      slideCount: slides.length,
      slides: slides.slice(0, 20).map((s, idx)=>({
        index: idx + 1,
        slideType: s.slideType,
        title: s.title,
        kicker: s.kicker,
        lede: s.lede,
        leftBlocks: (s.leftBlocks || []).map(b=>({ mode:b.mode, title:b.title, content:safeString(b.content).slice(0, 700) })),
        rightBlocks: (s.rightBlocks || []).map(b=>({ mode:b.mode, title:b.title, content:safeString(b.content).slice(0, 700) }))
      }))
    };
  }
  function cacheBustedPromptUrl(fileName){
    const base = safeString(fileName || '').trim();
    const version = safeString(deps.stage || runtimeStatus.stage || 'stage37h-20260427-1');
    if(!base || /^data:/i.test(base)) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(version);
  }
  async function fetchPromptFile(fileName){
    const name = safeString(fileName || '').trim();
    if(!name || typeof fetchImpl !== 'function') return { text:'', source:name, status: typeof fetchImpl === 'function' ? 'empty-file-name' : 'fetch-unavailable' };
    try{
      const res = await fetchImpl(cacheBustedPromptUrl(name), { cache:'no-store' });
      if(res && res.ok){
        const text = safeString(await res.text()).trim();
        return { text, source:name, status: text ? 'loaded-file' : 'blank-file' };
      }
      return { text:'', source:name, status: res ? ('file-http-' + res.status) : 'file-no-response' };
    }catch(err){
      return { text:'', source:name, status:'file-load-error', error:(err && err.message) || safeString(err) };
    }
  }
  async function loadDeckPromptPrefix(){
    if(deckPromptPrefixCache !== null) return deckPromptPrefixCache;
    const attempts = [];
    const dev = await fetchPromptFile(COPILOT_DEV_PROMPT_FILE);
    attempts.push(dev);
    let chosen = dev;
    if(!chosen.text){
      const deck = await fetchPromptFile(COPILOT_DECK_PROMPT_FILE);
      attempts.push(deck);
      if(deck.text) chosen = deck;
    }
    const lastError = attempts.map(a=>a.error).filter(Boolean).join('\n');
    if(lastError) updateCopilotRuntime({ deckPromptLastError:lastError });
    deckPromptPrefixCache = chosen.text || COPILOT_DEFAULT_DECK_PROMPT_PREFIX;
    const status = chosen.text ? chosen.status : attempts.map(a=>a.source + ':' + a.status).join(';') + ';used-builtin-default';
    const source = chosen.text ? chosen.source : 'builtin-default';
    updateCopilotRuntime({
      devPromptFile: COPILOT_DEV_PROMPT_FILE,
      deckPromptFile: COPILOT_DECK_PROMPT_FILE,
      deckPromptSource: source,
      deckPromptStatus: status,
      deckPromptAttempts: attempts.map(a=>({ source:a.source, status:a.status })),
      deckPromptAppliesTo: 'deck-only',
      deckPromptLoadedAt: new Date().toISOString()
    });
    return deckPromptPrefixCache;
  }
  function textHasUrl(text){ return /https?:\/\/\S+/i.test(safeString(text)); }
  function shouldUseOpenAiWebSearch(kind, endpoint, promptText, deckPromptPrefix){
    const enabled = !!(copilotEls.webSearch && copilotEls.webSearch.checked);
    if(kind !== 'deck' && kind !== 'deck-spec') return { use:false, status:'deck-only' };
    if(!enabled) return { use:false, status:'disabled' };
    if(!isDefaultOpenAiEndpoint(endpoint)) return { use:false, status:'custom-endpoint-disabled' };
    if(!textHasUrl(promptText + '\n' + deckPromptPrefix)) return { use:false, status:'no-url-detected' };
    return { use:true, status:'enabled-url-detected' };
  }
  function normalizeCopilotReferenceUrls(raw){
    return safeString(raw || '').split(/\n+/).map(s=>s.trim()).filter(Boolean).filter((value, idx, arr)=>arr.indexOf(value) === idx);
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
    updateCopilotRuntime({ referencePdfFileCount:copilotReferencePdfFiles.length, referencePdfBytes:copilotReferencePdfFiles.reduce((n,file)=>n + (Number(file.bytes)||0), 0) });
  }
  function getCopilotReferencePdfFiles(){ return copilotReferencePdfFiles.slice(); }
  function getCopilotReferenceMaterial(){
    const urls = getCopilotReferenceUrls();
    const text = getCopilotReferenceText();
    const pdfFiles = getCopilotReferencePdfFiles();
    const pdfUrls = urls.filter(isLikelyPdfReferenceUrl);
    const maxChars = 70000;
    const clipped = text.length > maxChars ? text.slice(0, maxChars) + '\n\n[Reference text truncated to ' + maxChars + ' characters by Lumina before sending to Copilot.]' : text;
    return { hasAny: !!(urls.length || clipped.trim() || pdfFiles.length), urls, pdfUrls, pdfFiles, text:clipped, originalTextLength:text.length, truncated:text.length > maxChars, pdfBytes:pdfFiles.reduce((n,file)=>n + (Number(file.bytes)||0), 0) };
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
    refs.pdfFiles.forEach(file=>content.push({ type:'input_file', filename:file.filename || 'reference.pdf', file_data:file.file_data }));
    refs.pdfUrls.forEach(url=>content.push({ type:'input_file', file_url:url }));
    return { attached:refs.pdfFiles.length + refs.pdfUrls.length, skipped:0 };
  }
  async function buildCopilotUserPrompt(kind, deckSpecPlan){
    const prompt = (copilotEls.prompt?.value || '').trim();
    if(!prompt && !deckSpecPlan && !getCopilotReferenceMaterial().hasAny) throw new Error('Tell Copilot what to create first, provide a deck spec, or add reference material.');
    const specCount = deckSpecPlan && Number(deckSpecPlan.targetSlideCount || 0);
    const count = Math.max(1, Math.min(30, Number(specCount || copilotEls.slideCount?.value || 1)));
    const tone = copilotEls.tone?.value || 'clear and concise';
    const mode = deckSpecPlan ? 'Create a complete deck from the parsed DeckPlan specification.' : (kind === 'deck' ? 'Create a complete deck.' : 'Create exactly one slide.');
    const parts = [mode];
    if(deckSpecPlan){
      parts.push('Parsed DeckPlan JSON. This is the source of truth for the requested deck. Satisfy every requested slide, figure, and custom HTML demo:', JSON.stringify(deckSpecPlan, null, 2));
      parts.push('Hard rules: expand ranges into slides; every Figure requirement becomes a mode image block; every Demo requirement becomes a mode custom block with self-contained HTML/CSS/JS; do not append a second alternate deck.');
    }
    const referenceMaterial = getCopilotReferenceMaterial();
    if(referenceMaterial.hasAny){
      parts.push(
        'Reference material supplied by the user. Use this as grounding/source material for the deck. Prioritize it over generic background knowledge. Do not invent facts that conflict with it.',
        referenceMaterial.urls.length ? ('Reference URLs to use, in order:\n' + referenceMaterial.urls.map((url, idx)=>(idx + 1) + '. ' + url).join('\n')) : 'Reference URLs: none',
        referenceMaterial.pdfFiles.length ? ('Uploaded PDF reference files attached to this request: ' + referenceMaterial.pdfFiles.map(file=>file.filename).join(', ')) : 'Uploaded PDF reference files: none',
        referenceMaterial.pdfUrls.length ? ('PDF reference URLs attached as file inputs: ' + referenceMaterial.pdfUrls.join(', ')) : 'PDF reference URLs attached as file inputs: none',
        referenceMaterial.text ? ('Uploaded/pasted reference text:\n' + referenceMaterial.text) : 'Uploaded/pasted reference text: none',
        'Reference material rules: preserve important definitions, examples, notation, claims, figures, examples, and ordering from the supplied references; use attached PDFs as source documents when present; use web search for listed non-PDF URLs when available; mention in summary if URL content could not be accessed.'
      );
    }
    parts.push(
      'User request: ' + (prompt || '(Follow the uploaded/pasted DeckPlan and reference material.)'),
      'Target slide count: ' + (kind === 'slide' ? 1 : count),
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


function parseCopilotDeckSpecText(rawText){
  const text = safeString(rawText || '').trim();
  if(!text) throw new Error('Paste or upload a deck spec/outline first.');
  try{
    const parsed = JSON.parse(text);
    if(parsed && typeof parsed === 'object'){
      const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
      return { mode:'deck-spec', sourceFormat:'json', deckTitle:safeString(parsed.deckTitle || parsed.title || ''), targetSlideCount:Number(parsed.targetSlideCount || parsed.slideCount || slides.length || 0) || null, themeHint:safeString(parsed.themeHint || parsed.theme || ''), rawText:text, slides, globalInstructions:Array.isArray(parsed.globalInstructions) ? parsed.globalInstructions : [] };
    }
  }catch(_){ }
  const slideMatches = Array.from(text.matchAll(/(?:^|\n)\s*#{0,4}\s*Slide\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*:?\s*([^\n]*)/gi));
  const targetMatch = text.match(/^\s*Slides?\s*:\s*(\d+)/im);
  const titleMatch = text.match(/^\s*#\s*Deck\s*:\s*(.+)$/im) || text.match(/^\s*Deck\s*:\s*(.+)$/im) || text.match(/^\s*#\s+(.+)$/m);
  const slides = slideMatches.map((m, i)=>({ rangeStart:Number(m[1]), rangeEnd:Number(m[2] || m[1]), title:safeString(m[3] || ('Slide ' + (i+1))).trim(), requiredBlocks:[] }));
  const maxSlide = slides.reduce((n,s)=>Math.max(n, s.rangeEnd || s.rangeStart || 0), 0);
  return { mode:'deck-spec', sourceFormat:'text/markdown', deckTitle:titleMatch ? safeString(titleMatch[1]).trim() : '', targetSlideCount:targetMatch ? Number(targetMatch[1]) : (maxSlide || null), themeHint:(text.match(/^\s*(?:Theme|Style)\s*:\s*(.+)$/im) || [,''])[1].trim(), rawText:text, slides, globalInstructions:['Follow the raw outline/spec exactly. Convert Demo: items to custom HTML blocks and Figure: items to image blocks.'] };
}
function getCopilotDeckSpecText(){ return safeString(copilotEls.specText && copilotEls.specText.value || '').trim(); }
function setCopilotDeckSpecText(text){ if(copilotEls.specText) copilotEls.specText.value = safeString(text || ''); }
function summarizeCopilotDeckSpec(plan){ const slideSpecs=Array.isArray(plan && plan.slides) ? plan.slides : []; return 'Deck spec parsed: ' + (plan.targetSlideCount || slideSpecs.length || '?') + ' target slides, ' + slideSpecs.length + ' slide specs.'; }
async function generateCopilotDeckFromSpec(){
  return withCopilotGenerationLock('deck-spec', async ()=>{
    try{
      const plan = parseCopilotDeckSpecText(getCopilotDeckSpecText());
      if(plan.targetSlideCount && copilotEls.slideCount) copilotEls.slideCount.value = String(plan.targetSlideCount);
      setCopilotStatus(summarizeCopilotDeckSpec(plan) + ' Generating…');
      const deck = await callCopilot('deck-spec', plan);
      if((copilotEls.mode?.value || 'append') === 'replace') replaceDeckWithCopilot(deck);
      else appendCopilotSlides(deck);
    }catch(err){ console.error(err); const msg=recordCopilotError(err); setCopilotStatus(msg, true); alertFn(msg); }
  });
}
async function callCopilot(kind, deckSpecPlan){
    if(typeof fetchImpl !== 'function') throw new Error('Fetch is not available in this browser, so Copilot cannot call the API endpoint.');
    saveCopilotSettings(false);
    const endpoint = (copilotEls.endpoint?.value || '').trim() || COPILOT_DEFAULT_ENDPOINT;
    const apiKey = (copilotEls.apiKey?.value || '').trim();
    const model = (copilotEls.model?.value || '').trim() || 'gpt-4.1-mini';
    validateCopilotApiKey(apiKey, endpoint, { requireKey: isDefaultOpenAiEndpoint(endpoint) });
    updateCopilotKeyWarning();
    const headers = { 'Content-Type':'application/json' };
    if(apiKey) headers.Authorization = 'Bearer ' + apiKey;
    const deckPromptPrefix = (kind === 'deck' || kind === 'deck-spec') ? await loadDeckPromptPrefix() : '';
    const userPrompt = await buildCopilotUserPrompt(kind, deckSpecPlan);
    let systemContent = copilotSystemPrompt();
    if((kind === 'deck' || kind === 'deck-spec') && deckPromptPrefix){
      systemContent += '\n\nDeck-only developer instructions from ' + (runtimeStatus.deckPromptSource || COPILOT_DEV_PROMPT_FILE || COPILOT_DECK_PROMPT_FILE) + ':\n' + deckPromptPrefix;
    }
    const webSearch = shouldUseOpenAiWebSearch(kind, endpoint, userPrompt, deckPromptPrefix);
    callCopilot._styleScreenshot = await captureCopilotStyleScreenshot();
    const body = {
      model,
      input:[
        { role:'system', content: systemContent },
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
    if(webSearch.use){
      body.tools = [{ type:'web_search' }];
      body.tool_choice = 'auto';
    }
    const referenceMaterialForRuntime = getCopilotReferenceMaterial();
    updateCopilotRuntime({ webSearchEnabled: !!webSearch.use, webSearchStatus: webSearch.status, referenceUrlCount: referenceMaterialForRuntime.urls.length, referencePdfUrlCount: referenceMaterialForRuntime.pdfUrls.length, referencePdfFileCount: referenceMaterialForRuntime.pdfFiles.length, referencePdfBytes: referenceMaterialForRuntime.pdfBytes, referencePdfInputsAttached: callCopilot._pdfAttachStatus ? callCopilot._pdfAttachStatus.attached : 0, referencePdfInputsSkipped: callCopilot._pdfAttachStatus ? callCopilot._pdfAttachStatus.skipped : 0, referenceTextChars: referenceMaterialForRuntime.originalTextLength, referenceTextTruncated: !!referenceMaterialForRuntime.truncated });
    setCopilotStatus(kind === 'deck' ? 'Generating deck…' : 'Generating slide…');
    updateCopilotRuntime({ requestInFlight:true, requestCount: Number(runtimeStatus.requestCount || 0) + 1, lastError:'' });
    const res = await fetchImpl(endpoint, { method:'POST', headers, body:JSON.stringify(body) });
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
    if(copilotEls.resultJson) copilotEls.resultJson.value = JSON.stringify(normalized, null, 2);
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
    if(kind === 'deck' && normalizedSlides.length > deckSlides.length){
      updateCopilotRuntime({ trimmedReturnedSlides: normalizedSlides.length - deckSlides.length, requestedSlideCount: requestedCount });
    }
    return {
      deckTitle: safeString(deck?.deckTitle || fields.deckTitle?.value || 'Generated presentation'),
      summary: safeString(deck?.summary || ''),
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
  function getSlides(){ return typeof deps.getSlides === 'function' ? deps.getSlides() : []; }
  function setSlides(value){ if(typeof deps.setSlides === 'function') deps.setSlides(value); }
  function getActiveIndex(){ return typeof deps.getActiveIndex === 'function' ? deps.getActiveIndex() : -1; }
  function setActiveIndex(value){ if(typeof deps.setActiveIndex === 'function') deps.setActiveIndex(value); }
  function applyCopilotFirstSlide(deck){
    const payload = deck || parseCopilotResult();
    const slide = payload.slides[0];
    if(!slide) throw new Error('No slide found in Copilot result.');
    if(typeof deps.applySlideToForm === 'function') deps.applySlideToForm(slide);
    const currentSlides = getSlides().slice();
    const idx = getActiveIndex();
    if(idx >= 0 && idx < currentSlides.length){
      currentSlides[idx] = slide;
      setSlides(currentSlides);
    }
    if(typeof deps.buildPreview === 'function') deps.buildPreview();
    if(typeof deps.renderDeckList === 'function') deps.renderDeckList();
    if(typeof deps.scheduleAutosave === 'function') deps.scheduleAutosave('Autosaved after Copilot slide apply.');
    showToast('Applied Copilot slide.');
  }
  function appendCopilotSlides(deck){
    const payload = deck || parseCopilotResult();
    const newSlides = payload.slides.map(normalizeCopilotSlide);
    if(!newSlides.length) throw new Error('No slides found in Copilot result.');
    const combined = (getSlides().length ? getSlides().slice() : []).concat(newSlides);
    setSlides(combined);
    setActiveIndex(combined.length - newSlides.length);
    if(typeof deps.applySlideToForm === 'function') deps.applySlideToForm(combined[getActiveIndex()]);
    if(typeof deps.buildPreview === 'function') deps.buildPreview();
    if(typeof deps.renderDeckList === 'function') deps.renderDeckList();
    if(typeof deps.scheduleAutosave === 'function') deps.scheduleAutosave('Autosaved after appending Copilot slides.');
    showToast('Appended Copilot slides.');
  }
  function replaceDeckWithCopilot(deck){
    const payload = deck || parseCopilotResult();
    const newSlides = payload.slides.map(normalizeCopilotSlide);
    if(!newSlides.length) throw new Error('No slides found in Copilot result.');
    if(fields.deckTitle) fields.deckTitle.value = payload.deckTitle || fields.deckTitle.value;
    setSlides(newSlides);
    setActiveIndex(0);
    if(typeof deps.applySlideToForm === 'function') deps.applySlideToForm(newSlides[0]);
    if(typeof deps.buildPreview === 'function') deps.buildPreview();
    if(typeof deps.renderDeckList === 'function') deps.renderDeckList();
    if(typeof deps.persistAutosaveNow === 'function') deps.persistAutosaveNow('Autosaved after replacing deck with Copilot result.');
    showToast('Replaced deck with Copilot result.');
  }
  let copilotGenerationInFlight = false;
  function setCopilotGenerationButtonsBusy(isBusy){
    ['copilotDraftSlideBtn','copilotAddSlideBtn','copilotGenerateDeckBtn'].forEach(id=>{
      const btn = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if(!btn) return;
      btn.dataset.copilotBusy = isBusy ? '1' : '0';
      btn.disabled = !!isBusy;
      btn.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    });
  }
  async function withCopilotGenerationLock(label, task){
    if(copilotGenerationInFlight || runtimeStatus.requestInFlight){
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
        alertFn(msg);
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
        alertFn(msg);
      }
    });
  }

  return Object.freeze({
    __stage:'stage37h-20260427-1',
    __source:'esm:js/esm/copilot-stage34k.js',
    __classicCompat: classicCompat,
    setCopilotStatus: maybeClassic('setCopilotStatus', setCopilotStatus),
    loadCopilotSettings: maybeClassic('loadCopilotSettings', loadCopilotSettings),
    saveCopilotSettings: maybeClassic('saveCopilotSettings', saveCopilotSettings),
    validateCopilotApiKey: maybeClassic('validateCopilotApiKey', validateCopilotApiKey),
    updateCopilotKeyWarning: maybeClassic('updateCopilotKeyWarning', updateCopilotKeyWarning),
    friendlyCopilotHttpError: maybeClassic('friendlyCopilotHttpError', friendlyCopilotHttpError),
    recordCopilotError: maybeClassic('recordCopilotError', recordCopilotError),
    recordCopilotSuccess: maybeClassic('recordCopilotSuccess', recordCopilotSuccess),
    copilotRuntimeStatus: runtimeStatus,
    copilotBlockSchema: maybeClassic('copilotBlockSchema', copilotBlockSchema),
    copilotSlideSchema: maybeClassic('copilotSlideSchema', copilotSlideSchema),
    copilotDeckSchema: maybeClassic('copilotDeckSchema', copilotDeckSchema),
    copilotSystemPrompt: maybeClassic('copilotSystemPrompt', copilotSystemPrompt),
    compactDeckForCopilot: maybeClassic('compactDeckForCopilot', compactDeckForCopilot),
    buildCopilotUserPrompt: maybeClassic('buildCopilotUserPrompt', buildCopilotUserPrompt),
    loadDeckPromptPrefix: maybeClassic('loadDeckPromptPrefix', loadDeckPromptPrefix),
    parseCopilotDeckSpecText: maybeClassic('parseCopilotDeckSpecText', parseCopilotDeckSpecText),
    getCopilotDeckSpecText: maybeClassic('getCopilotDeckSpecText', getCopilotDeckSpecText),
    setCopilotDeckSpecText: maybeClassic('setCopilotDeckSpecText', setCopilotDeckSpecText),
    summarizeCopilotDeckSpec: maybeClassic('summarizeCopilotDeckSpec', summarizeCopilotDeckSpec),
    getCopilotReferenceText: maybeClassic('getCopilotReferenceText', getCopilotReferenceText),
    setCopilotReferenceText: maybeClassic('setCopilotReferenceText', setCopilotReferenceText),
    getCopilotReferenceUrls: maybeClassic('getCopilotReferenceUrls', getCopilotReferenceUrls),
    setCopilotReferenceUrls: maybeClassic('setCopilotReferenceUrls', setCopilotReferenceUrls),
    setCopilotReferencePdfFiles: maybeClassic('setCopilotReferencePdfFiles', setCopilotReferencePdfFiles),
    getCopilotReferencePdfFiles: maybeClassic('getCopilotReferencePdfFiles', getCopilotReferencePdfFiles),
    getCopilotReferenceMaterial: maybeClassic('getCopilotReferenceMaterial', getCopilotReferenceMaterial),
    summarizeCopilotReferences: maybeClassic('summarizeCopilotReferences', summarizeCopilotReferences),
    shouldUseOpenAiWebSearch: maybeClassic('shouldUseOpenAiWebSearch', shouldUseOpenAiWebSearch),
    extractResponsesOutputText: maybeClassic('extractResponsesOutputText', extractResponsesOutputText),
    callCopilot: maybeClassic('callCopilot', callCopilot),
    normalizeCopilotDeck: maybeClassic('normalizeCopilotDeck', normalizeCopilotDeck),
    normalizeCopilotSlide: maybeClassic('normalizeCopilotSlide', normalizeCopilotSlide),
    parseCopilotResult: maybeClassic('parseCopilotResult', parseCopilotResult),
    applyCopilotFirstSlide: maybeClassic('applyCopilotFirstSlide', applyCopilotFirstSlide),
    appendCopilotSlides: maybeClassic('appendCopilotSlides', appendCopilotSlides),
    replaceDeckWithCopilot: maybeClassic('replaceDeckWithCopilot', replaceDeckWithCopilot),
    generateCopilotSlide: maybeClassic('generateCopilotSlide', generateCopilotSlide),
    generateCopilotDeck: maybeClassic('generateCopilotDeck', generateCopilotDeck),
    generateCopilotDeckFromSpec: maybeClassic('generateCopilotDeckFromSpec', generateCopilotDeckFromSpec)
  });
}

export { createApi };
export default { createApi };
