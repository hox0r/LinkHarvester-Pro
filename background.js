// Background service worker for Chrome extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Universal Link Extractor installed');
  });
  
  // Handle messages from content scripts
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'error') {
      console.error('Content script error:', request.details);
    }
    return true;
  });