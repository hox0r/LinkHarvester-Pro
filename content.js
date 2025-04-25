// Content script for fallback extraction
const extractionFunctions = {
    extractAllLinksFromPage: function() {
      const linkTypes = {
        'a': ['href', 'ping', 'download'],
        'img': ['src', 'srcset', 'data-src', 'data-srcset'],
        'script': ['src'],
        'link': ['href'],
        'iframe': ['src', 'data-src', 'data-embed-url', 'data-url'],
        'video': ['src', 'poster'],
        'audio': ['src'],
        'source': ['src', 'srcset'],
        'embed': ['src'],
        'object': ['data'],
        '*': ['data-embed-url', 'data-url', 'data-href', 'data-src', 'data-source']
      };
  
      const links = [];
  
      // Enhanced iframe handling
      document.querySelectorAll('iframe').forEach(iframe => {
        ['src', 'data-src', 'data-embed-url', 'data-url'].forEach(attr => {
          const url = iframe.getAttribute(attr);
          if (url && isValidUrl(url)) {
            links.push({
              type: 'iframe',
              url: cleanUrl(url),
              attribute: attr,
              text: iframe.getAttribute('title') || iframe.getAttribute('aria-label') || ''
            });
          }
        });
  
        try {
          if (iframe.contentDocument) {
            const iframeLinks = extractLinksFromDocument(iframe.contentDocument);
            iframeLinks.forEach(link => {
              links.push({
                ...link,
                source: 'iframe-content'
              });
            });
          }
        } catch (e) {
          console.log('Cannot access iframe content', e);
        }
      });
  
      // Extract all other links
      Object.entries(linkTypes).forEach(([tagName, attrs]) => {
        const elements = tagName === '*' ? document.querySelectorAll('*') : document.querySelectorAll(tagName);
        
        elements.forEach(el => {
          if (el.tagName.toLowerCase() === 'iframe') return;
          
          attrs.forEach(attr => {
            try {
              const value = el.getAttribute(attr);
              if (value && isValidUrl(value)) {
                if (attr === 'srcset') {
                  value.split(',').forEach(src => {
                    const url = src.trim().split(' ')[0];
                    if (url && isValidUrl(url)) {
                      links.push(createLinkObject(tagName, attr, url, el));
                    }
                  });
                } else {
                  links.push(createLinkObject(tagName, attr, value, el));
                }
              }
            } catch (e) {
              console.error(`Error processing ${tagName}[${attr}]`, e);
            }
          });
        });
      });
  
      // Extract other types of links
      extractCssUrls(document).forEach(url => {
        links.push({
          type: 'css',
          url: url,
          attribute: 'style'
        });
      });
  
      extractMetaUrls(document).forEach(meta => {
        links.push({
          type: 'meta',
          url: meta.url,
          attribute: 'content',
          text: meta.name
        });
      });
  
      extractScriptUrls(document).forEach(url => {
        links.push({
          type: 'javascript',
          url: url,
          attribute: 'script'
        });
      });
  
      return links;
    },
  
    extractLinksFromDocument: function(doc) {
      const links = [];
      
      ['a[href]', 'img[src]', 'iframe[src]', '*[data-embed-url]', '*[data-src]'].forEach(selector => {
        doc.querySelectorAll(selector).forEach(el => {
          const attr = selector.match(/\[(.*?)\]/)[1];
          const url = el.getAttribute(attr);
          if (url && isValidUrl(url)) {
            links.push({
              type: el.tagName.toLowerCase(),
              url: cleanUrl(url),
              attribute: attr,
              text: el.textContent?.trim() || ''
            });
          }
        });
      });
      
      return links;
    }
  };
  
  // Helper functions
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }
  
  function cleanUrl(url) {
    return url.replace(/^['"]|['"]$/g, '').trim();
  }
  
  function createLinkObject(tagName, attr, url, element) {
    return {
      type: tagName === '*' ? 'data-attr' : tagName,
      url: cleanUrl(url),
      attribute: attr,
      text: tagName === 'a' ? element.textContent.trim() : null,
      element: element.tagName
    };
  }
  
  function extractCssUrls(doc) {
    const urls = [];
    doc.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      const urlRegex = /url\(['"]?([^)'"]+)['"]?\)/g;
      let match;
      while ((match = urlRegex.exec(style))) {
        if (isValidUrl(match[1])) {
          urls.push(cleanUrl(match[1]));
        }
      }
    });
    return urls;
  }
  
  function extractMetaUrls(doc) {
    const metas = [];
    doc.querySelectorAll('meta[content]').forEach(meta => {
      const content = meta.getAttribute('content');
      if (isValidUrl(content)) {
        metas.push({
          url: cleanUrl(content),
          name: meta.getAttribute('property') || meta.getAttribute('name') || ''
        });
      }
    });
    return metas;
  }
  
  function extractScriptUrls(doc) {
    const urls = [];
    const scripts = doc.querySelectorAll('script:not([src])');
    const urlRegex = /(https?:\/\/[^"'\s>]+)/g;
    
    scripts.forEach(script => {
      const matches = script.textContent.match(urlRegex);
      if (matches) {
        matches.forEach(match => {
          if (isValidUrl(match)) {
            urls.push(cleanUrl(match));
          }
        });
      }
    });
    return urls;
  }
  
  // Message listener for fallback extraction
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractLinks") {
      try {
        const links = extractionFunctions.extractAllLinksFromPage();
        sendResponse(links);
      } catch (error) {
        console.error("Extraction failed in content script:", error);
        sendResponse([]);
      }
      return true; // Keep message port open for async response
    }
  });