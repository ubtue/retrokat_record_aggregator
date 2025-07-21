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
        let isArticle = a.matches(linkSelector);
        let title;
        if (isArticle) {
          const titleEl = titleSelector ? a.closest(titleSelector) : null;
          title = titleEl?.textContent.trim() || a.textContent.trim();
        } else {
          title = a.textContent.trim();
        }
        return {
          link: a.href,
          title
        };
      });
      console.log('[Content Script] Extracted links:', extractedLinks);

      chrome.runtime.sendMessage({
        type: 'EXTRACTED_LINKS',
        links: extractedLinks
      });
    }
  });
})();
