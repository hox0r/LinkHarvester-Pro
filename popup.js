document.addEventListener('DOMContentLoaded', function() {
    const extractLinksBtn = document.getElementById('extractLinks');
    const copyAllBtn = document.getElementById('copyAll');
    const clearAllBtn = document.getElementById('clearAll');
    const retryBtn = document.getElementById('retryBtn');
    const linksContainer = document.getElementById('linksContainer');
    const linksCount = document.getElementById('linksCount');
    const filterInput = document.getElementById('filterInput');
    const linkTypeFilter = document.getElementById('linkTypeFilter');
    const statusMessage = document.getElementById('statusMessage');
    
    let allLinks = [];
    let currentTab = null;
  
    // Initialize
    init();
  
    async function init() {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      currentTab = tab;
      setupEventListeners();
    }
  
    function setupEventListeners() {
      extractLinksBtn.addEventListener('click', extractLinks);
      copyAllBtn.addEventListener('click', copyAllLinks);
      clearAllBtn.addEventListener('click', clearAllLinks);
      retryBtn.addEventListener('click', extractLinks);
      filterInput.addEventListener('input', applyFilters);
      linkTypeFilter.addEventListener('change', applyFilters);
    }
  
    async function extractLinks() {
      if (!currentTab) return;
      
      // Check for special browser pages
      if (isRestrictedPage(currentTab.url)) {
        showStatusMessage("Cannot extract from browser's internal pages", "error");
        return;
      }
  
      showStatusMessage("Extracting links...", "info");
      extractLinksBtn.disabled = true;
      retryBtn.disabled = true;
  
      try {
        let results;
        
        // Try primary method first
        try {
          results = await chrome.scripting.executeScript({
            target: {tabId: currentTab.id},
            func: extractAllLinksFromPage,
            args: []
          });
        } catch (primaryError) {
          console.log("Primary method failed, trying fallback:", primaryError);
          results = await tryFallbackMethods();
        }
  
        processResults(results);
      } catch (error) {
        console.error("Extraction failed:", error);
        showStatusMessage(getErrorMessage(error, currentTab.url), "error");
      } finally {
        extractLinksBtn.disabled = false;
        retryBtn.disabled = false;
      }
    }
  
    async function tryFallbackMethods() {
      // Method 1: Content script messaging
      try {
        const response = await chrome.tabs.sendMessage(currentTab.id, {action: "extractLinks"});
        if (response) return [{result: response}];
      } catch (e1) {
        console.log("Fallback method 1 failed:", e1);
      }
  
      // Method 2: Inject content script
      try {
        await chrome.scripting.executeScript({
          target: {tabId: currentTab.id},
          files: ['content.js']
        });
        const response = await chrome.tabs.sendMessage(currentTab.id, {action: "extractLinks"});
        if (response) return [{result: response}];
      } catch (e2) {
        console.log("Fallback method 2 failed:", e2);
      }
  
      return null;
    }
  
    function processResults(results) {
      if (results && results[0] && results[0].result) {
        allLinks = results[0].result;
        if (allLinks.length > 0) {
          displayLinks(allLinks);
          copyAllBtn.disabled = false;
          showStatusMessage(`Found ${allLinks.length} links`, "success");
        } else {
          showStatusMessage("No extractable links found", "info");
        }
      } else {
        showStatusMessage("No links could be extracted", "warning");
      }
    }
  
    function isRestrictedPage(url) {
      return url.startsWith('chrome://') || 
             url.startsWith('edge://') || 
             url.startsWith('about:') || 
             url.startsWith('moz-extension://') ||
             url.startsWith('chrome-extension://');
    }
  
    function getErrorMessage(error, url) {
      if (url.startsWith('http') === false) {
        return "Please navigate to a standard web page first";
      }
      if (error.message.includes('Cannot access contents')) {
        return "Page security policy blocked extraction";
      }
      return "Failed to extract links. Try a different page.";
    }
  
    function copyAllLinks() {
      const linksToCopy = getFilteredLinks()
        .map(link => link.url)
        .join('\n');
      
      navigator.clipboard.writeText(linksToCopy).then(() => {
        showStatusMessage("Links copied to clipboard!", "success");
      });
    }
  
    function clearAllLinks() {
      linksContainer.innerHTML = "";
      linksCount.textContent = "0 links found";
      allLinks = [];
      copyAllBtn.disabled = true;
      showStatusMessage("Cleared all links", "info");
    }
  
    function applyFilters() {
      const filteredLinks = getFilteredLinks();
      displayLinks(filteredLinks);
    }
  
    function getFilteredLinks() {
      const searchTerm = filterInput.value.toLowerCase();
      const typeFilter = linkTypeFilter.value;
      
      return allLinks.filter(link => {
        const matchesSearch = link.url.toLowerCase().includes(searchTerm) || 
                            (link.text && link.text.toLowerCase().includes(searchTerm));
        const matchesType = typeFilter === 'all' || 
                           (typeFilter === 'data-attr' ? link.attribute && link.attribute.startsWith('data-') : 
                           (typeFilter === 'iframe' ? link.type === 'iframe' || link.source === 'iframe-content' :
                           link.type === typeFilter));
        return matchesSearch && matchesType;
      });
    }
  
    function displayLinks(links) {
      linksContainer.innerHTML = "";
      linksCount.textContent = `${links.length} links found`;
      
      if (links.length === 0) {
        linksContainer.innerHTML = '<div class="no-links">No links match your filters</div>';
        return;
      }
      
      links.forEach(link => {
        const linkElement = document.createElement('div');
        linkElement.className = 'link-item';
        
        const typeLabel = getTypeLabel(link);
        const sourceIndicator = link.source === 'iframe-content' ? ' (iframe content)' : '';
        
        linkElement.innerHTML = `
          <span class="link-type" title="${link.attribute || link.type}">${typeLabel}${sourceIndicator}</span>
          <a href="${link.url}" target="_blank" class="link-url" title="${link.url}">${link.url}</a>
          ${link.text ? `<div class="link-text" title="${link.text}">${link.text}</div>` : ''}
          ${link.attribute ? `<div class="link-attribute">${link.attribute}</div>` : ''}
          <button class="copy-btn" title="Copy this link">⎘</button>
        `;
        
        const copyBtn = linkElement.querySelector('.copy-btn');
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(link.url).then(() => {
            copyBtn.textContent = '✓';
            setTimeout(() => {
              copyBtn.textContent = '⎘';
            }, 1000);
          });
        });
        
        linkElement.addEventListener('dblclick', () => {
          navigator.clipboard.writeText(link.url).then(() => {
            linkElement.classList.add('copied');
            setTimeout(() => {
              linkElement.classList.remove('copied');
            }, 1000);
          });
        });
        
        linksContainer.appendChild(linkElement);
      });
    }
  
    function getTypeLabel(link) {
      if (link.attribute && link.attribute.startsWith('data-')) {
        return link.attribute.toUpperCase();
      }
      
      const typeMap = {
        'a': 'LINK',
        'img': 'IMAGE',
        'script': 'SCRIPT',
        'link': 'CSS/FAVICON',
        'iframe': 'IFRAME',
        'video': 'VIDEO',
        'audio': 'AUDIO',
        'source': 'SOURCE',
        'embed': 'EMBED',
        'object': 'OBJECT',
        'css': 'CSS',
        'meta': 'META',
        'javascript': 'JS'
      };
      
      return typeMap[link.type] || link.type.toUpperCase();
    }
  
    function showStatusMessage(message, type) {
      statusMessage.textContent = message;
      statusMessage.className = `status-message ${type}`;
      
      if (type !== 'info') {
        setTimeout(() => {
          statusMessage.textContent = '';
          statusMessage.className = 'status-message';
        }, 5000);
      }
    }
  });