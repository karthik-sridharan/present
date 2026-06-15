/* Stage 7 parser migration
   Structured text parsing lives here. This is intentionally a classic browser script,
   not an ES module, while the app is being migrated incrementally.
*/
(function(global){
  'use strict';

  function createApi(deps){
    deps = deps || {};
    const preserveMathTokens = deps.preserveMathTokens;
    const restoreMathTokens = deps.restoreMathTokens;
    const escapeHtml = deps.escapeHtml;
    const escapeAttr = deps.escapeAttr;

    if(typeof preserveMathTokens !== 'function') throw new Error('LuminaParser missing dependency: preserveMathTokens');
    if(typeof restoreMathTokens !== 'function') throw new Error('LuminaParser missing dependency: restoreMathTokens');
    if(typeof escapeHtml !== 'function') throw new Error('LuminaParser missing dependency: escapeHtml');
    if(typeof escapeAttr !== 'function') throw new Error('LuminaParser missing dependency: escapeAttr');

    function parseStructuredText(raw, meta){
      const text = String(raw ?? '').replace(/\r\n/g, '\n').trim();
      if(!text) return '';
      function safeWithMath(str){
        const p = preserveMathTokens(str);
        return restoreMathTokens(escapeHtml(p.out), p.tokens);
      }
      const lines = text.split('\n');
      const parts = [];
      let paragraph = [];
      let listType = null;
      let listItems = [];
      function flushParagraph(){
        if(!paragraph.length) return;
        const joined = paragraph.join(' ').trim();
        if(joined) parts.push('<p>' + safeWithMath(joined) + '</p>');
        paragraph = [];
      }
      function flushList(){
        if(!listItems.length) return;
        const tag = listType === 'enumerate' ? 'ol' : 'ul';
        parts.push('<' + tag + '>' + listItems.map(item=>'<li>' + safeWithMath(item) + '</li>').join('') + '</' + tag + '>');
        listItems = [];
        listType = null;
      }
      function collectUntil(endPattern, startIndex){
        const chunk = [];
        let i = startIndex;
        while(i < lines.length && !endPattern.test(lines[i].trim())){
          chunk.push(lines[i]);
          i += 1;
        }
        return { body: chunk.join('\n').trim(), endIndex: i };
      }
      function simpleCardBody(body){
        const trimmed = body.trim();
        if(!trimmed) return '';
        return trimmed.split(/\n\s*\n/).map(block => '<p>' + safeWithMath(block.replace(/\s*\n\s*/g, ' ').trim()) + '</p>').join('');
      }

      for(let i = 0; i < lines.length; i += 1){
        const line = lines[i].trim();
        if(!line){ flushParagraph(); flushList(); continue; }
        const paragraphMatch = line.match(/^\\paragraph\{([\s\S]*)\}$/);
        if(paragraphMatch){ flushParagraph(); flushList(); parts.push('<p>' + safeWithMath(paragraphMatch[1].trim()) + '</p>'); continue; }
        if(/^\\begin\{itemize\}$/i.test(line)){
          flushParagraph(); flushList();
          const items = [];
          i += 1;
          while(i < lines.length && !/^\\end\{itemize\}$/i.test(lines[i].trim())){
            const itemLine = lines[i].trim();
            if(itemLine){
              const itemMatch = itemLine.match(/^\\item\s+([\s\S]*)$/);
              if(itemMatch) items.push(itemMatch[1].trim());
            }
            i += 1;
          }
          parts.push('<ul>' + items.map(item=>'<li>' + safeWithMath(item) + '</li>').join('') + '</ul>');
          continue;
        }
        if(/^\\begin\{enumerate\}$/i.test(line)){
          flushParagraph(); flushList();
          const items = [];
          i += 1;
          while(i < lines.length && !/^\\end\{enumerate\}$/i.test(lines[i].trim())){
            const itemLine = lines[i].trim();
            if(itemLine){
              const itemMatch = itemLine.match(/^\\item\s+([\s\S]*)$/);
              if(itemMatch) items.push(itemMatch[1].trim());
            }
            i += 1;
          }
          parts.push('<ol>' + items.map(item=>'<li>' + safeWithMath(item) + '</li>').join('') + '</ol>');
          continue;
        }
        if(/^\\begin\{equation\}$/i.test(line)){
          flushParagraph(); flushList();
          const collected = collectUntil(/^\\end\{equation\}$/i, i + 1);
          parts.push('<div class="display-math">\\[\\begin{aligned}' + escapeHtml(collected.body) + '\\end{aligned}\\]</div>');
          i = collected.endIndex;
          continue;
        }
        const cardBegin = line.match(/^\\begin\{card\}\{([\s\S]*)\}$/i);
        if(cardBegin){
          flushParagraph(); flushList();
          const collected = collectUntil(/^\\end\{card\}$/i, i + 1);
          parts.push('<div class="bullet-card"><b>' + safeWithMath(cardBegin[1].trim()) + '</b><div>' + simpleCardBody(collected.body) + '</div></div>');
          i = collected.endIndex;
          continue;
        }
        if(/^\\begin\{figurehtml\}$/i.test(line)){
          flushParagraph(); flushList();
          const collected = collectUntil(/^\\end\{figurehtml\}$/i, i + 1);
          const figAttrs = meta ? (' data-column="' + escapeAttr(meta.column || '') + '" data-block-index="' + meta.blockIndex + '" data-figure-index="' + (meta.figureIndex++) + '"') : ''; parts.push('<div class="figure-embed"' + figAttrs + '>' + collected.body + '</div>');
          i = collected.endIndex;
          continue;
        }
        if(/^UL:/i.test(line)){ flushParagraph(); if(listType && listType !== 'itemize') flushList(); listType = 'itemize'; listItems.push(line.replace(/^UL:/i, '').trim()); continue; }
        if(line.startsWith('- ')){ flushParagraph(); if(listType && listType !== 'itemize') flushList(); listType = 'itemize'; listItems.push(line.slice(2).trim()); continue; }
        flushList();
        if(line.startsWith('### ')){ flushParagraph(); parts.push('<h3>' + safeWithMath(line.slice(4).trim()) + '</h3>'); continue; }
        if(/^P:/i.test(line)){ flushParagraph(); parts.push('<p>' + safeWithMath(line.replace(/^P:/i, '').trim()) + '</p>'); continue; }
        if(/^EQ:/i.test(line)){ flushParagraph(); parts.push('<div class="display-math">' + safeWithMath(line.replace(/^EQ:/i, '').trim()) + '</div>'); continue; }
        if(/^CARD:/i.test(line)){
          flushParagraph();
          const payload = line.replace(/^CARD:/i, '').trim();
          const pieces = payload.split('|');
          const cardTitle = pieces.shift() || '';
          const cardBody = pieces.join('|');
          parts.push('<div class="bullet-card"><b>' + safeWithMath(cardTitle) + '</b><div><p>' + safeWithMath(cardBody) + '</p></div></div>');
          continue;
        }
        if((/^\\\(.+\\\)$/s).test(line)){ flushParagraph(); parts.push('<div class="display-math">\\[' + escapeHtml(line.replace(/^\\\(/, '').replace(/\\\)$/, '')) + '\\]</div>'); continue; }
        if((/^\\\[.+\\\]$/s).test(line) || (/^\$\$.+\$\$$/s).test(line)){ flushParagraph(); parts.push('<div class="display-math">' + safeWithMath(line) + '</div>'); continue; }
        paragraph.push(line);
      }
      flushParagraph(); flushList();
      return parts.join('\\n');
    }

    return { parseStructuredText };
  }

  global.LuminaParser = { createApi };
})(window);
