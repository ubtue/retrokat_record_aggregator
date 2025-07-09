(() => {
  let config = {};

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

      const { linkSelector = 'a', titleSelector } = config.selectors || {};

      const links = Array.from(document.querySelectorAll(linkSelector)).map(a => ({
        link: a.href,
        title: titleSelector ? a.closest(titleSelector)?.textContent.trim() || a.textContent.trim() : a.textContent.trim()
      }));

      console.log('[Content Script] Extracted links and titles:', links);

      chrome.runtime.sendMessage({ type: 'EXTRACTED_LINKS', links });
    }
  });
})();
