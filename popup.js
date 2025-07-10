// References to DOM elements
const patternInput = document.getElementById('extractionPattern');
const crawlPatternInput = document.getElementById('crawlPattern');
const volumePatternInput = document.getElementById('volumePattern');
const maxLinksInput = document.getElementById('maxLinksInput');
const startButton = document.getElementById('start');
const crawlCheckbox = document.getElementById('crawl');
const serverUrlInput = document.getElementById('serverUrl');
const portInput = document.getElementById('port');
const linksContainer = document.getElementById('links');
const sendButton = document.getElementById('send');
const downloadButton = document.getElementById('download');

let selectorConfig = {};

// Store extracted links
let extractedLinks = [];

// Load the site configuration from site-config.json
let currentJournalName = 'default';
let currentJournalPattern = 'default';

async function loadConfig() {
  const response = await fetch(chrome.runtime.getURL('site-config.json'));
  const config = await response.json();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab.url;

  const matchedEntry = Object.values(config).find(entry => {
    if (!entry.pattern) return false;
    const regex = new RegExp(entry.pattern);
    return regex.test(url);
  });

  currentJournalName = matchedEntry?.site || 'default';
  currentJournalPattern = matchedEntry?.pattern || '';
  return matchedEntry || config.default;
}

// Automatically fill in the corresponding patterns
document.addEventListener('DOMContentLoaded', async () => {
  const config = await loadConfig();

  patternInput.value = config.extraction_pattern || '';
  crawlPatternInput.value = config.crawl_pattern || '';
  volumePatternInput.value = config.volume_pattern || '';
  maxLinksInput.value = config.max_links || '';
  crawlCheckbox.checked = !! config.crawl;
  selectorConfig = config.selectors || 'a';
});

// Start the extraction process
startButton.addEventListener('click', async () => {

  let maxLinksValue = parseInt(maxLinksInput.value, 10);
  if (isNaN(maxLinksValue)) maxLinksValue = null;

  const config = {
    extraction_pattern: patternInput.value,
    crawl_pattern: crawlPatternInput.value,
    volume_pattern: volumePatternInput.value,
    crawl: crawlCheckbox.checked,
    selectors: selectorConfig,
    maxLinks: maxLinksValue
  };
  chrome.runtime.sendMessage({ type: 'SET_CONFIG', config });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content-script.js']
  });

  chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_AND_SEND' });

  linksContainer.innerHTML = '<p>Extracting links...</p>';
});

// Listen for extracted links from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DISPLAY_LINKS') {
    extractedLinks = message.links;
    linksContainer.innerHTML = '';

    const total = extractedLinks.length;

    if (total === 0) {
      linksContainer.innerHTML = '<p>No matching links found (yet).</p>';
      sendButton.hidden = true;
      downloadButton.hidden = true;
      document.getElementById('serverSettings').hidden = true;
      return;
    }

    const summary = document.createElement('p');
    summary.textContent = `Extracted ${total} article links.`;
    linksContainer.appendChild(summary);

    sendButton.hidden = false;
    downloadButton.hidden = false;
    document.getElementById('serverSettings').hidden = false;
  }
});

// Send selected links to webserver
sendButton.addEventListener('click', async () => {
  if (extractedLinks.length === 0) {
    alert('No links to send.');
    return;
  }

  const serverUrl = serverUrlInput.value || 'http://localhost';
  const port = portInput.value || '9500';
  const url = `${serverUrl}:${port}/submit_feed`;

  let lines = [];

  for (const entry of extractedLinks) {
    lines.push(
      `journal=${encodeURIComponent(currentJournalName)}`,
      `main_title=${encodeURIComponent(entry.title)}`,
      `article_link=${encodeURIComponent(entry.link)}`,
      `volume_pattern=${encodeURIComponent(volumePatternInput.value)}`,
      `crawl_pattern=${encodeURIComponent(crawlPatternInput.value)}`,
      `extraction_pattern=${encodeURIComponent(patternInput.value)}`,
      `pattern=${encodeURIComponent(currentJournalPattern)}`,
      ''
    );
  }

  const body = lines.join('\n');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: body
    });

    const result = await response.text();
    alert(`Server response: ${result}`);
  } catch (err) {
    console.error('Failed to send feed:', err);
    alert('Failed to send feed. Check console for details.');
  }
});

// Download the links as a text file
downloadButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'REQUEST_LINKS' }, (response) => {
    const links = response.links || [];
    if (links.length === 0) {
      alert('No links to download.');
      return;
    }

    const content = links.map(item => `Title: ${item.title}\nLink: ${item.link}\n`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_links.txt';
    a.click();

    URL.revokeObjectURL(url);
  });
});
