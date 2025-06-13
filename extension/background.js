import { fetchAlternatives } from './fetcher.js';
import { storeAlternatives, getStoredAlternatives } from './utils.js';

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if(request.type === 'OPEN_POPUP') {
    chrome.action.openPopup();
    sendResponse({ status: 'opened'})
  }

  if (request.action === 'scanProduct') {
    const productInfo = request.productInfo;
    
    // Log the detected product
    console.log('Product detected:', productInfo);
    
    // Fetch eco-friendly alternatives
    fetchAlternatives(productInfo)
      .then(alternatives => {
        // Store the alternatives in local storage
        storeAlternatives(productInfo.id, alternatives);
        
        // Send the alternatives back to the content script
        sendResponse({ success: true, alternatives });
      })
      .catch(error => {
        console.error('Error fetching alternatives:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
  
  if (request.action === 'getAlternatives') {
    const productId = request.productId;
    
    // Get the alternatives from local storage
    getStoredAlternatives(productId)
      .then(alternatives => {
        sendResponse({ success: true, alternatives });
      })
      .catch(error => {
        console.error('Error retrieving alternatives:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});

// Initial setup when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('EcoSwap extension installed');
});