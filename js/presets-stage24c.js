(function(){
  'use strict';

const presets = {
  title: {
    slideType:'title-center', headingLevel:'h1', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Lecture title', kicker:'Course / subtitle', lede:'', leftBlocks:[], rightBlocks:[],
    notesTitle:'Speaker notes', notesBody:''
  },
  concept: {
    slideType:'single', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Concept slide', kicker:'', lede:'Introduce the main idea in one short sentence.',
    leftBlocks:[{mode:'panel', title:'Main points', content:'\\paragraph{Core idea}\n\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\item Third point\n\\end{itemize}'}],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  },
  twocol: {
    slideType:'two-col', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Two-column slide', kicker:'', lede:'',
    leftBlocks:[{mode:'panel', title:'Left column', content:'\\paragraph{Left column}\n\n\\begin{itemize}\n\\item Point A\n\\item Point B\n\\end{itemize}'}],
    rightBlocks:[{mode:'panel', title:'Right column', content:'\\paragraph{Right column}\n\n\\begin{itemize}\n\\item Detail 1\n\\item Detail 2\n\\end{itemize}'}],
    notesTitle:'Speaker notes', notesBody:''
  },
  callouts: {
    slideType:'title-two-callouts', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Title + two callout boxes', kicker:'', lede:'',
    leftBlocks:[{mode:'panel', title:'Callout A', content:'\\paragraph{Key insight}\n\nShort, emphasized idea.'}],
    rightBlocks:[{mode:'panel', title:'Callout B', content:'\\paragraph{Second insight}\n\nAnother emphasized point.'}],
    notesTitle:'Speaker notes', notesBody:''
  },
  figureExplain: {
    slideType:'title-figure-explanation', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Figure + explanation', kicker:'', lede:'',
    leftBlocks:[{mode:'placeholder', title:'Figure', content:'Add a figure or image block'}],
    rightBlocks:[{mode:'panel', title:'Explanation', content:'\\paragraph{Explain the figure}\\n\\begin{itemize}\\n\\item What the audience should notice\\n\\item Why it matters\\n\\end{itemize}'}],
    notesTitle:'Speaker notes', notesBody:''
  },
  theoremProof: {
    slideType:'theorem-proof', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Theorem / proof', kicker:'', lede:'',
    leftBlocks:[
      {mode:'panel', title:'Theorem', content:'\\paragraph{Theorem} State the theorem precisely.'},
      {mode:'panel', title:'Proof', content:'\\paragraph{Proof sketch} Give the main argument in a few steps.'}
    ],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  },
  algorithmLayout: {
    slideType:'algorithm-layout', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Algorithm', kicker:'', lede:'',
    leftBlocks:[
      {mode:'pseudocode-latex', title:'Algorithm', content:'Input: \\(x\\)\\n\\nfor \\(t=1\\) to \\(T\\) do\\n  \\(u^t \\leftarrow W[t]z^{t-1}+b^t\\)\\n  \\(z^t \\leftarrow \\sigma(u^t)\\)\\nend\\n\\nreturn \\(\\hat y\\)'},
      {mode:'panel', title:'Notes', content:'\\paragraph{Key notes}\\n\\begin{itemize}\\n\\item Mention initialization\\n\\item Mention stopping rule\\n\\end{itemize}'}
    ],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  },
  sectionDivider: {
    slideType:'section-divider', headingLevel:'h1', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Section title', kicker:'Part II', lede:'One sentence about the next section.', leftBlocks:[], rightBlocks:[],
    notesTitle:'Speaker notes', notesBody:''
  },
  comparison: {
    slideType:'comparison', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Comparison slide', kicker:'', lede:'',
    leftBlocks:[{mode:'panel', title:'Method A', content:'\\begin{itemize}\\n\\item Strength 1\\n\\item Strength 2\\n\\end{itemize}'}],
    rightBlocks:[{mode:'panel', title:'Method B', content:'\\begin{itemize}\\n\\item Strength 1\\n\\item Strength 2\\n\\end{itemize}'}],
    notesTitle:'Speaker notes', notesBody:''
  },
  imageText: {
    slideType:'image-left-text-right', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Image-left text-right', kicker:'', lede:'',
    leftBlocks:[{mode:'placeholder', title:'Image', content:'Add an image or figure block'}],
    rightBlocks:[{mode:'panel', title:'Text', content:'\\paragraph{Walkthrough}\\n\\begin{itemize}\\n\\item Describe the image\\n\\item Highlight the takeaway\\n\\end{itemize}'}],
    notesTitle:'Speaker notes', notesBody:''
  },
  fullFigureCaption: {
    slideType:'full-width-figure-caption', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Full-width figure', kicker:'', lede:'',
    leftBlocks:[
      {mode:'placeholder', title:'Figure', content:'Add a large figure or image block'},
      {mode:'panel', title:'Caption', content:'\\paragraph{Caption} Add a concise interpretation or citation.'}
    ],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  },
  appendix: {
    slideType:'single', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Summary / appendix', kicker:'', lede:'',
    leftBlocks:[{mode:'panel', title:'Summary', content:'\\begin{enumerate}\\n\\item First takeaway\\n\\item Second takeaway\\n\\item Third takeaway\\n\\end{enumerate}'}],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  },
  pseudocode: {
    slideType:'single', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Pseudocode', kicker:'', lede:'',
    leftBlocks:[{mode:'pseudocode', title:'Algorithm', content:'Input: x\\n\\nfor t = 1 to T do\\n  u^t <- W[t] z^(t-1) + b^t\\n  z^t <- sigma(u^t)\\nend\\n\\nreturn yhat'}],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  },
  pseudocodeLatex: {
    slideType:'single', headingLevel:'h2', bgColor:'#ffffff', fontColor:'#111111', inheritTheme:true,
    title:'Pseudocode with LaTeX', kicker:'', lede:'',
    leftBlocks:[{mode:'pseudocode-latex', title:'Algorithm', content:'Input: \\(x\\)\\n\\n\\(z^0 \\leftarrow x\\)\\nfor \\(t = 1\\) to \\(T\\) do\\n  \\(u^t \\leftarrow W[t] z^{t-1} + b^t\\)\\n  \\(z^t \\leftarrow \\sigma(u^t)\\)\\nend\\n\\nreturn \\(\\hat y\\)'}],
    rightBlocks:[], notesTitle:'Speaker notes', notesBody:''
  }
};

  window.LuminaPresets = { presets };
})();
