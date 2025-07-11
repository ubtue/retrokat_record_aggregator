# Record Aggregator

A flexible browser extension for extracting article links (and their titles) from academic websites or archives. You define patterns for crawling and extraction, and the extension can either:

- Send the data to a custom server (e.g., for MySQL storage)
- Or download the results as a plain `.txt` file

It supports **deep crawling**, starting from volumes → issues → articles, based on pattern-matching rules defined per site.

---

## Features

- Extract links and titles using customizable CSS selectors
- Pattern-based crawling through volume and issue pages
- Send extracted data to a custom backend via HTTP POST
- Export results as a `.txt` file
- Uses a flexible [site-config.json](./site-config.json) to auto-configure patterns per site
- Built with plain JavaScript and standard WebExtension APIs (no frameworks)

---

## Installation

1. Clone or download this repository.
2. Open your browser's extensions page:
   - Chrome: `chrome://extensions/`
   - Firefox: `about:debugging#/runtime/this-firefox`
3. Enable **Developer Mode**
4. Click **"Load unpacked"** and select the extension's root folder

---

## How It Works

### 1. Auto-configuration via [site-config.json](./site-config.json)

When you open a supported site, the extension reads [site-config.json](./site-config.json) and fills in extraction patterns automatically.

### 2. Extraction & Crawling

Click **Start** to begin extracting links:

- If **Crawling is enabled**, the extension will follow links matching `volume_pattern` → `crawl_pattern`
- It extracts links matching `extraction_pattern` and tries to grab associated titles

### 3. Exporting

Once extraction is complete:

- Click **Send Articles to Webserver** to POST the results to a custom server
- Or click **Download Links** to save a text file

---

## Configuration Fields

### Site Patterns ([site-config.json](./site-config.json))

Example entry:

```json
{
    "onlinelibrary.wiley.com": {
      "pattern": "onlinelibrary\\.wiley\\.com/loi/14781913(/year/\\d{4})?",
      "volume_pattern": "onlinelibrary\\.wiley\\.com/loi/14781913/year/\\d{4}$",
      "crawl_pattern": "onlinelibrary\\.wiley\\.com/toc/14781913/\\d{4}/\\d+/(\\d+|\\d+-\\d+)$",
      "extraction_pattern": "onlinelibrary\\.wiley\\.com/doi/10\\.1111/((j\\.)?1478-1913\\.\\d+(?:\\.\\w+)?|muwo\\.\\d+)",
      "crawl": true,
      "site": "The Muslim World",
      "selectors": {
        "article": "a.issue-item__title",
        "title": "h2",
        "linkAttr": "href"
      },
      "max_links": 5
    }
}
```

---

### In the Popup UI:

* **Extraction Pattern** – Regex to identify article links

* **Crawl Pattern** – Regex to identify issue links

* **Volume Pattern** – Regex for volume navigation (optional)

* **Max Crawl Depth** – How many links to follow per stage (optional)

* **Enable Crawling** – Enables deep crawl

* **Server URL & Port** – If sending to a server

---

## Server Endpoint

Your server should accept 'POST' requests with a body of type 'text/plain'. Each article is submitted with the following fields:

```plaintext
journal=...
main_title=...
article_link=...
volume_pattern=...
crawl_pattern=...
extraction_pattern=...
pattern=...
```

>Default endpoint: 'http://localhost:9500/submit_feed'

Update the server URL and port in the popup and the default value in [popup.js](./popup.js) as needed.

---

## Example Output (Downloaded File)

```plaintext
Title: Two Museums and the Simpson Portrait of Yarrow Mamout
Link: https://onlinelibrary.wiley.com/doi/10.1111/muwo.12348

Title: Political Philosophy of Shaykhīsm: Conservative Nationalism in the Time of Crisis
Link: https://onlinelibrary.wiley.com/doi/10.1111/muwo.12485
```

---

## File Structure

```plaintext
.
├── background.js       // Handles tab crawling and link collection
├── content-script.js   // Extracts links & titles using selectors
├── popup.html          // User interface for inputting patterns
├── popup.js            // Main logic to handle UI and messaging
├── site-config.json    // Site-specific extraction rules
├── manifest.json       // WebExtension manifest
└── README.md
```

---

## Permissions

This extension requests:

* 'tabs' and 'scripting': for tab manipulation and injecting scripts

* 'activeTab': to extract from the currently open site

---

## License

This project is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html).  
See the [LICENSE](./LICENSE) file for details.