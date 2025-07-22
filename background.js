let visitedUrls = new Set();
let matchedLinks = new Map();
let followedLinksCount = 0;
let maxLinks = 5;
let config = {};
stage = config.volume_pattern ? 'volume' : 'issue';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processIssueLink(link) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: link, active: false }, (tab) => {
      const tabId = tab.id;

      chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-script.js']
      }).then(() => {
        console.log(`[Background] Injected content-script for: ${link}`);

        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { 
            type: 'SET_CONFIG', 
            config 
          });

          chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_AND_SEND' });
        }, 200);
      });

      let timeoutId;

      function cleanup() {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(onExtracted);
        chrome.tabs.remove(tabId, () => {
          console.log(`[Background] Closed tab ${tabId}`);
          resolve();
        });
      }

      function onExtracted(message, sender) {
        if (
          message.type === 'EXTRACTED_LINKS' &&
          sender.tab &&
          sender.tab.id === tabId
        ) {
          console.log(`[Background] Extracted from ${link}`);
          cleanup();
        }
      }

      timeoutId = setTimeout(() => {
        console.warn(`[Background] Timeout on tab ${tabId}`);
        cleanup();
      }, 7000);
      chrome.runtime.onMessage.addListener(onExtracted);
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SET_CONFIG') {
    config = message.config;
    maxLinks = config.maxLinks ?? null;
    visitedUrls.clear();
    matchedLinks.clear();
    followedLinksCount = 0;
    stage = config.volume_pattern ? 'volume' : 'issue';
  }

  if (message.type === 'REQUEST_LINKS') {
    const linksArray = Array.from(matchedLinks.entries()).map(([link, title]) => ({ link, title }));
    sendResponse({ links: linksArray });
  }

  if (message.type === 'EXTRACTED_LINKS') {
    const links = message.links;
    const volumeRegex = new RegExp(config.volume_pattern || '');
    const issueRegex = new RegExp(config.crawl_pattern);
    const extractionRegex = new RegExp(config.extraction_pattern);

    const currentUrl = sender.tab.url;
    let crawlCandidates = [];

    if (stage === 'volume') {
      crawlCandidates = links.filter(item => volumeRegex.test(item.link));
    } else if (stage === 'issue') {
      crawlCandidates = links.filter(item => issueRegex.test(item.link));
    }

    const toFollow = [];

    crawlCandidates.forEach(item => {
      if (!visitedUrls.has(item.link) && (maxLinks === null || followedLinksCount < maxLinks)) {
        visitedUrls.add(item.link);
        followedLinksCount++;
        toFollow.push(item.link);
      }
    });

    console.log(`[Background] Found ${toFollow.length} links to follow:`, toFollow);

    if (config.crawl && toFollow.length > 0) {
      (async () => {
        for (const link of toFollow) {
          await processIssueLink(link);
          await delay(1000);
        }

        if (stage === 'volume') {
          stage = 'issue';
          followedLinksCount = 0;

          const volumeLinks = Array.from(visitedUrls);
          for (const link of volumeLinks) {
            await processIssueLink(link);
            await delay(1000);
          }
        }
      })();
    }

    const extractionMatches = links.filter(item => extractionRegex.test(item.link));
    extractionMatches.forEach(item => {
      if (!matchedLinks.has(item.link)) {
        matchedLinks.set(item.link, item.title);
      }
    });

    const matchedLinksArray = Array.from(matchedLinks.entries()).map(([link, title]) => ({
      link,
      title
    }));

    chrome.runtime.sendMessage({
      type: 'DISPLAY_LINKS',
      links: matchedLinksArray
    });
  }
});
