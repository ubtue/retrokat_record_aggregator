(() => {
  let config = {};

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SET_CONFIG') {
      config = message.config;
      console.log('[Content Script] Configuration received:', config);
    }

    if (message.type === 'EXTRACT_AND_SEND') {
      if (!config) {
        console.warn('[Content Script] No configuration available.');
        chrome.runtime.sendMessage({ type: 'EXTRACTED_LINKS', links: [] });
        return;
      }

      const { linkSelector, titleSelector } = config.selectors || {};

      const allAnchors = Array.from(document.querySelectorAll('a')).filter(a => a.href);

      const extractedLinks = allAnchors.map(a => {
        const isArticle = linkSelector ? a.matches(linkSelector) : true;

        let title = '';
        const selector = titleSelector || null;

        if (isArticle) {
          let titleEl = null;

          if (selector) {
            titleEl = a.querySelector(selector);
          }

          if (!titleEl && selector) {
            const container = a.closest('td, article, div, li, tr');
            if (container) {
              titleEl = container.querySelector(selector);
            }
          }

          if (!titleEl && a.previousElementSibling?.matches?.(selector)) {
            titleEl = a.previousElementSibling;
          }
          if (!titleEl && a.nextElementSibling?.matches?.(selector)) {
            titleEl = a.nextElementSibling;
          }

          title = titleEl?.textContent?.trim() || a.textContent.trim();
        } else {
          title = a.textContent.trim();
        }

        return { link: a.href, title };
      });
      console.log('[Content Script] Extracted links:', extractedLinks);

      chrome.runtime.sendMessage({
        type: 'EXTRACTED_LINKS',
        links: extractedLinks
      });
    }
  });
})();
