// ==UserScript==
// @name         DeepSeek Smart RTL Assistant - Emoji Fixed Version
// @namespace    https://chat.deepseek.com/
// @version      8.9.0
// @description  Fixed emoji/symbol positioning with unified font and Hebrew support
// @author       Seyed Jafar Mousavi
// @match        https://chat.deepseek.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  /* =========================
     CONFIG & STATE
  ========================= */

  const STORAGE_KEY = 'deepseek_rtl_enabled';
  let RTL_ENABLED = true;
  let processedElements = new WeakSet();
  
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'false') {
    RTL_ENABLED = false;
  } else {
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  const DEBUG = false;
  const log = (...args) => DEBUG && console.log(...args);

  // Unified font stack that works well for both Persian and English
  const UNIFIED_FONT = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Segoe UI", "Segoe UI Arabic", "Noto Sans Arabic", Tahoma, sans-serif';

  /* =========================
     CSS STYLESHEET
  ========================= */

  const addStyles = () => {
    const styleId = 'rtl-assistant-styles';
    if (document.getElementById(styleId)) return;
    
    const styleSheet = document.createElement('style');
    styleSheet.id = styleId;
    styleSheet.textContent = `
      .rtl-assistant-persian {
        direction: rtl !important;
        text-align: right;
        font-family: ${UNIFIED_FONT};
        font-weight: normal;
        unicode-bidi: plaintext !important;
      }
      
      .rtl-assistant-english {
        direction: ltr !important;
        text-align: left;
        unicode-bidi: isolate !important;
        font-family: ${UNIFIED_FONT};
        font-weight: normal;
      }
      
      .rtl-assistant-ltr-number {
        direction: ltr !important;
        unicode-bidi: embed !important;
        display: inline-block;
        font-family: ${UNIFIED_FONT};
      }
      
      .rtl-assistant-ltr-symbol {
        direction: ltr !important;
        unicode-bidi: embed !important;
        display: inline-block;
        margin-left: 2px;
        margin-right: 2px;
        font-family: ${UNIFIED_FONT};
      }
      
      .rtl-assistant-prefix-symbol {
        direction: ltr !important;
        unicode-bidi: embed !important;
        display: inline-block;
        margin-left: 2px;
        font-family: ${UNIFIED_FONT};
      }
      
      .rtl-assistant-textarea {
        direction: rtl !important;
        text-align: right;
        font-family: ${UNIFIED_FONT};
      }
      
      #rtl-toggle-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: bold;
        font-family: system-ui, sans-serif;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
      }
      
      #rtl-toggle-btn.rtl-on {
        background-color: #10b981;
        color: white;
      }
      
      #rtl-toggle-btn.rtl-off {
        background-color: #ef4444;
        color: white;
      }
      
      #rtl-toggle-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      }
    `;
    
    document.head.appendChild(styleSheet);
  };

  /* =========================
     TEXT ANALYSIS
  ========================= */

  // Updated to include Hebrew characters (U+0590 to U+05FF)
  const RTL_CHARS = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const ENGLISH_CHARS = /[A-Za-z]/;
  
  const EMOJI_AND_SYMBOLS = /[\u2600-\u26FF\u2700-\u27BF\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2000}-\u206F\u2100-\u214F\u2190-\u21FF\u2300-\u23FF\u2500-\u257F\u25A0-\u25FF\u2600-\u26FF\u2700-\u27BF\u2900-\u297F\u2B00-\u2BFF\u3000-\u303F}\u{1F000}-\u{1F02F}]/u;
  
  const PREFIX_SYMBOLS = /[\u2705\u2714\u2713\u2611\u2610\u2605\u2606\u272A\u2730\u273F\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|[\uD83C][\uDF00-\uDFFF]|[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]|[\uD83E][\uDD00-\uDDFF]/u;

  const analyzeText = (text) => {
    const cleanText = text.trim();
    if (cleanText.length < 2) return null;
    
    let rtlCount = 0;
    let englishCount = 0;
    let symbolCount = 0;
    let totalChars = 0;
    
    const sampleSize = Math.min(cleanText.length, 200);
    const step = Math.max(1, Math.floor(cleanText.length / sampleSize));
    
    for (let i = 0; i < cleanText.length; i += step) {
      const char = cleanText[i];
      if (RTL_CHARS.test(char)) {
        rtlCount++;
        totalChars++;
      } else if (ENGLISH_CHARS.test(char)) {
        englishCount++;
        totalChars++;
      } else if (EMOJI_AND_SYMBOLS.test(char)) {
        symbolCount++;
        totalChars++;
      }
    }
    
    if (totalChars === 0) return null;
    
    const rtlRatio = rtlCount / totalChars;
    const englishRatio = englishCount / totalChars;
    const symbolRatio = symbolCount / totalChars;
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    
    return {
      hasRTL: rtlCount > 0,
      hasEnglish: englishCount > 0,
      hasSymbols: symbolCount > 0,
      rtlRatio,
      englishRatio,
      symbolRatio,
      wordCount: words.length,
      totalChars: cleanText.length
    };
  };

  /* =========================
     ELEMENT FILTERING
  ========================= */

  const isSVGorRelated = (el) => {
    if (!el || el.nodeType !== 1) return false;
    
    const className = el.className || '';
    if (typeof className === 'string' && 
        (className.includes('icon') || 
         className.includes('svg') || 
         className.includes('feather'))) {
      return true;
    }
    
    return el.tagName.toUpperCase() === 'SVG' || 
           el.closest('svg') !== null ||
           el.hasAttribute('d') || 
           el.hasAttribute('points');
  };

  const isRealTextElement = (el) => {
    if (!el || el.nodeType !== 1) return false;
    
    if (
      el.hasAttribute('aria-label') ||
      el.getAttribute('role') === 'button' ||
      el.contentEditable === 'false'
    ) {
      return false;
    }
    
    if (isSVGorRelated(el)) return false;
    
    const ignoreTags = ['SCRIPT', 'STYLE', 'IMG', 'CANVAS', 'VIDEO', 'AUDIO', 
                       'INPUT', 'BUTTON', 'SELECT', 'OPTION', 'TEXTAREA', 
                       'META', 'LINK', 'BR', 'HR'];
    if (ignoreTags.includes(el.tagName.toUpperCase())) return false;
    
    if (el.closest('pre, code, .code-block, [class*="language-"]')) {
      return false;
    }
    
    const text = el.textContent || '';
    const trimmedText = text.trim();
    
    if (trimmedText.length < 2 || trimmedText.length > 10000) {
      return false;
    }
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || 
        parseFloat(style.opacity) === 0) {
      return false;
    }
    
    const textTags = ['P', 'DIV', 'SPAN', 'LI', 'ARTICLE', 'SECTION', 
                     'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 
                     'BLOCKQUOTE', 'FIGCAPTION', 'TD', 'TH', 'LABEL'];
    
    if (textTags.includes(el.tagName.toUpperCase())) {
      return true;
    }
    
    const className = el.className || '';
    if (typeof className === 'string') {
      const textClasses = ['message', 'chat', 'content', 'text', 'prose', 
                          'markdown', 'paragraph', 'bubble', 'response'];
      return textClasses.some(c => className.toLowerCase().includes(c.toLowerCase()));
    }
    
    return false;
  };

  /* =========================
     DIRECTION APPLICATION - FIXED
  ========================= */

  const processNumbersAndSymbolsSafely = (element) => {
    if (!element || !element.childNodes) return;
    
    if (element.dataset.rtlNumbers === '1') return;
    element.dataset.rtlNumbers = '1';
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const nodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && (/\d+/.test(node.textContent) || EMOJI_AND_SYMBOLS.test(node.textContent))) {
        nodes.push(node);
      }
    }
    
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const text = node.textContent;
      
      const combinedRegex = new RegExp(`(\\d+|${EMOJI_AND_SYMBOLS.source})`, 'gu');
      
      const parts = text.split(combinedRegex);
      
      if (parts.length <= 1) continue;
      
      const fragment = document.createDocumentFragment();
      let lastWasPrefixSymbol = false;
      
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (!part) continue;
        
        if (/^\d+$/.test(part)) {
          const span = document.createElement('span');
          span.className = 'rtl-assistant-ltr-number';
          span.textContent = part;
          fragment.appendChild(span);
          lastWasPrefixSymbol = false;
        } 
        else if (PREFIX_SYMBOLS.test(part)) {
          const span = document.createElement('span');
          span.className = 'rtl-assistant-prefix-symbol';
          span.textContent = part;
          fragment.appendChild(span);
          lastWasPrefixSymbol = true;
        }
        else if (EMOJI_AND_SYMBOLS.test(part)) {
          const span = document.createElement('span');
          span.className = 'rtl-assistant-ltr-symbol';
          span.textContent = part;
          fragment.appendChild(span);
          lastWasPrefixSymbol = false;
        }
        else {
          fragment.appendChild(document.createTextNode(part));
          lastWasPrefixSymbol = false;
        }
      }
      
      node.parentNode.replaceChild(fragment, node);
    }
  };

  const applyDirectionSafely = (el, force = false) => {
    if (!el || !el.isConnected) return;
    
    if (!force && processedElements.has(el)) return;
    
    if (!isRealTextElement(el)) return;
    
    try {
      const text = el.textContent || '';
      const trimmedText = text.trim();
      
      if (trimmedText.length < 2) {
        processedElements.add(el);
        el.dataset.rtlProcessed = '1';
        return;
      }
      
      el.classList.remove('rtl-assistant-persian', 'rtl-assistant-english');
      
      el.querySelectorAll('.rtl-assistant-ltr-number, .rtl-assistant-ltr-symbol, .rtl-assistant-prefix-symbol').forEach(span => {
        const parent = span.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(span.textContent), span);
        }
      });
      
      if (!RTL_ENABLED) {
        processedElements.add(el);
        el.dataset.rtlProcessed = '1';
        return;
      }
      
      const stats = analyzeText(trimmedText);
      if (!stats) {
        processedElements.add(el);
        el.dataset.rtlProcessed = '1';
        return;
      }
      
      if (
        stats.hasRTL &&
        (stats.rtlRatio > 0.2 || stats.wordCount < 5)
      ) {
        el.classList.add('rtl-assistant-persian');
        processNumbersAndSymbolsSafely(el);
      }
      else if (stats.hasEnglish && !stats.hasRTL) {
        if (stats.wordCount <= 3 && stats.totalChars < 20) {
          el.classList.add('rtl-assistant-persian');
          processNumbersAndSymbolsSafely(el);
        } else {
          el.classList.add('rtl-assistant-english');
        }
      }
      else if (stats.hasRTL && stats.rtlRatio <= 0.2) {
        el.classList.add('rtl-assistant-english');
      }
      
      processedElements.add(el);
      el.dataset.rtlProcessed = '1';
      
    } catch (error) {
      DEBUG && console.warn('Error applying direction:', error);
      processedElements.add(el);
      el.dataset.rtlProcessed = '1';
    }
  };

  /* =========================
     SCANNING WITH FORCE OPTION
  ========================= */

  let scanTimeout = null;
  const SCAN_DELAY = 300;

  const requestScan = (force = false) => {
    if (scanTimeout) {
      clearTimeout(scanTimeout);
    }
    
    scanTimeout = setTimeout(() => {
      scanImportantElements(force);
      scanTimeout = null;
    }, SCAN_DELAY);
  };

  const scanImportantElements = (force = false) => {
    if (!RTL_ENABLED && !force) return;
    
    try {
      const prioritySelectors = [
        '.message, .chat-message, [class*="message-"], [class*="chat-"]',
        '.prose, .markdown, [class*="content"], [class*="text"]',
        'p, h1, h2, h3, h4, h5, h6, li, blockquote'
      ];
      
      let elements = [];
      prioritySelectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        elements = elements.concat(Array.from(found));
      });
      
      const uniqueElements = [...new Set(elements)];
      
      const recentElements = uniqueElements.slice(-500);
      recentElements.forEach(el => applyDirectionSafely(el, force));
      
      document.querySelectorAll('textarea').forEach(ta => {
        if (RTL_ENABLED) {
          ta.classList.add('rtl-assistant-textarea');
        } else {
          ta.classList.remove('rtl-assistant-textarea');
        }
      });
      
    } catch (error) {
      DEBUG && console.warn('Scan error:', error);
    }
  };

  /* =========================
     OBSERVER
  ========================= */

  const setupEfficientObserver = () => {
    try {
      const mainContent = document.querySelector('main, .chat-container, [role="main"]') || document.body;
      
      const observer = new MutationObserver((mutations) => {
        let hasRelevantChanges = false;
        
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1) {
                if (node.matches && 
                   (node.matches('.message, .chat-message, p, [class*="content"]') || 
                    node.querySelector('.message, .chat-message, p, [class*="content"]'))) {
                  hasRelevantChanges = true;
                  
                  if (node.matches('.message, .chat-message')) {
                    applyDirectionSafely(node);
                  }
                }
              }
            });
          }
        }
        
        if (hasRelevantChanges) {
          requestScan();
        }
      });
      
      observer.observe(mainContent, {
        childList: true,
        subtree: true,
        characterData: false
      });
      
    } catch (error) {
      DEBUG && console.warn('Observer error:', error);
    }
  };

  /* =========================
     TOGGLE BUTTON - FIXED VERSION
  ========================= */

  const createToggleButton = () => {
    const oldBtn = document.getElementById('rtl-toggle-btn');
    if (oldBtn) oldBtn.remove();
    
    const btn = document.createElement('button');
    btn.id = 'rtl-toggle-btn';
    btn.className = RTL_ENABLED ? 'rtl-on' : 'rtl-off';
    btn.textContent = RTL_ENABLED ? 'RTL ON' : 'RTL OFF';
    
    btn.onclick = () => {
      RTL_ENABLED = !RTL_ENABLED;
      localStorage.setItem(STORAGE_KEY, RTL_ENABLED);
      
      btn.className = RTL_ENABLED ? 'rtl-on' : 'rtl-off';
      btn.textContent = RTL_ENABLED ? 'RTL ON' : 'RTL OFF';
      
      if (RTL_ENABLED) {
        processedElements = new WeakSet();
        
        document.querySelectorAll('.rtl-assistant-persian, .rtl-assistant-english').forEach(el => {
          el.classList.remove('rtl-assistant-persian', 'rtl-assistant-english');
        });
        
        document.querySelectorAll('.rtl-assistant-ltr-number, .rtl-assistant-ltr-symbol, .rtl-assistant-prefix-symbol').forEach(span => {
          const parent = span.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(span.textContent), span);
          }
        });
        
        document.querySelectorAll('textarea').forEach(ta => {
          ta.classList.add('rtl-assistant-textarea');
        });
        
        setTimeout(() => {
          scanImportantElements(true);
        }, 100);
        
      } else {
        // IMPORTANT FIX: Properly remove all classes
        document.querySelectorAll('[class*="rtl-assistant-"]').forEach(el => {
          el.classList.remove(
            'rtl-assistant-persian', 
            'rtl-assistant-english', 
            'rtl-assistant-ltr-number',
            'rtl-assistant-ltr-symbol', 
            'rtl-assistant-prefix-symbol', 
            'rtl-assistant-textarea'
          );
          
          delete el.dataset.rtlProcessed;
          delete el.dataset.rtlNumbers;
        });
        
        // Also restore all span elements to normal text
        document.querySelectorAll('.rtl-assistant-ltr-number, .rtl-assistant-ltr-symbol, .rtl-assistant-prefix-symbol').forEach(span => {
          const parent = span.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(span.textContent), span);
          }
        });
        
        // Reset textareas
        document.querySelectorAll('textarea').forEach(ta => {
          ta.classList.remove('rtl-assistant-textarea');
        });
        
        // Reset processed elements
        processedElements = new WeakSet();
        
        // Force a reflow to ensure all elements are reset
        setTimeout(() => {
          document.querySelectorAll('*').forEach(el => {
            delete el.dataset.rtlProcessed;
            delete el.dataset.rtlNumbers;
          });
        }, 50);
      }
    };
    
    document.body.appendChild(btn);
    return btn;
  };

  /* =========================
     INITIALIZATION
  ========================= */

  const init = () => {
    addStyles();
    
    createToggleButton();
    
    setTimeout(setupEfficientObserver, 500);
    
    setTimeout(() => {
      if (RTL_ENABLED) {
        scanImportantElements();
      }
    }, 1000);
    
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (RTL_ENABLED) {
          requestScan();
        }
      }, 2000);
    });
  };

  /* =========================
     STARTUP
  ========================= */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();