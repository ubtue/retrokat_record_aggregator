let visitedUrls = new Set();
let matchedLinks = new Map();
let crawlingInProgress = false;
let crawlQueue = new Set();
let pendingVolumeUrls = new Set();
let pendingIssueUrls = new Set();
let followedLinksCount = 0;
let maxLinks = 5;
let config = {};
let stage = 'issue';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crawlNext() {
  if (crawlingInProgress) return;
  crawlingInProgress = true;

  while (crawlQueue.size > 0 && (maxLinks === null || followedLinksCount < maxLinks)) {
    const nextUrl = crawlQueue.values().next().value;
    crawlQueue.delete(nextUrl);
    if (pendingVolumeUrls.has(nextUrl)) pendingVolumeUrls.delete(nextUrl);

    if (visitedUrls.has(nextUrl)) continue;
    visitedUrls.add(nextUrl);
    followedLinksCount++;

    console.log(`[Background] Crawling link (${followedLinksCount}/${maxLinks || '∞'}): ${nextUrl}`);

    try {
      await processIssueLink(nextUrl);
      await delay(1000);
    } catch (err) {
      console.error(`[Background] Error processing link ${nextUrl}:`, err);
    }
  }

  if (stage === 'volume' && crawlQueue.size === 0 && pendingVolumeUrls.size === 0) {
    console.log('[Background] Volume stage complete — switching to issue stage.');
    stage = 'issue';
    followedLinksCount = 0;

    pendingIssueUrls.forEach(url => {
      if (!visitedUrls.has(url)) {
        crawlQueue.add(url);
      }
    });
    crawlingInProgress = false;
    console.log('[Background] CrawlQueue after moving issue URLs:', crawlQueue.size);
    pendingIssueUrls.clear();

    if (crawlQueue.size > 0) {
      await crawlNext();
    }
  }

  crawlingInProgress = false;
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
      }, 10000);
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

    crawlQueue.clear();
    pendingVolumeUrls.clear();
    pendingIssueUrls.clear();
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

    if (stage === 'volume') {
      links.forEach(item => {
        if (volumeRegex.test(item.link) && !visitedUrls.has(item.link) && !pendingVolumeUrls.has(item.link)) {
          pendingVolumeUrls.add(item.link);
          crawlQueue.add(item.link);
        }
      });

      links.forEach(item => {
        if (issueRegex.test(item.link) && !visitedUrls.has(item.link) && !pendingIssueUrls.has(item.link)) {
          pendingIssueUrls.add(item.link);
        }
      });

    } else if (stage === 'issue') {
      links.forEach(item => {
        if (issueRegex.test(item.link) && !visitedUrls.has(item.link)) {
          crawlQueue.add(item.link);
        }
      });
    }

    console.log(`[Background] Queues state - crawlQueue size: ${crawlQueue.size}, pendingVolumeUrls size: ${pendingVolumeUrls.size}, pendingIssueUrls size: ${pendingIssueUrls.size}`);

    if (config.crawl && !crawlingInProgress) {
      crawlNext();
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
