// Utility functions for the EcoSwap extension

// Load alternatives data from the local JSON file
export async function loadAlternativesData() {
  try {
    const response = await fetch(chrome.runtime.getURL('alternatives.json'));
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading alternatives data:', error);
    return [];
  }
}

// Store alternatives in local storage for a product
export async function storeAlternatives(productId, alternatives) {
  if (!productId) return;
  
  try {
    // Get existing stored alternatives
    const storedData = await chrome.storage.local.get('productAlternatives');
    const productAlternatives = storedData.productAlternatives || {};
    
    // Add/update alternatives for this product
    productAlternatives[productId] = {
      alternatives,
      timestamp: Date.now()
    };
    
    // Store in local storage
    await chrome.storage.local.set({ productAlternatives });
    
    // Clear old data (older than 7 days)
    clearOldProductData();
  } catch (error) {
    console.error('Error storing alternatives:', error);
  }
}

// Get stored alternatives for a product
export async function getStoredAlternatives(productId) {
  if (!productId) return null;
  
  try {
    const storedData = await chrome.storage.local.get('productAlternatives');
    const productAlternatives = storedData.productAlternatives || {};
    
    if (productAlternatives[productId]) {
      return productAlternatives[productId].alternatives;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting stored alternatives:', error);
    return null;
  }
}

// Save an alternative to the saved list
export async function saveAlternative(alternative) {
  try {
    // Get existing saved alternatives
    const storedData = await chrome.storage.local.get('savedAlternatives');
    const savedAlternatives = storedData.savedAlternatives || [];
    
    // Check if already saved
    const index = savedAlternatives.findIndex(alt => alt.id === alternative.id);
    
    if (index === -1) {
      // Add to saved list
      savedAlternatives.push({
        ...alternative,
        savedAt: Date.now()
      });
      
      // Store in local storage
      await chrome.storage.local.set({ savedAlternatives });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving alternative:', error);
    return false;
  }
}

// Get all saved alternatives
export async function getSavedAlternatives() {
  try {
    const storedData = await chrome.storage.local.get('savedAlternatives');
    return storedData.savedAlternatives || [];
  } catch (error) {
    console.error('Error getting saved alternatives:', error);
    return [];
  }
}

// Remove an alternative from the saved list
export async function removeSavedAlternative(alternativeId) {
  try {
    // Get existing saved alternatives
    const storedData = await chrome.storage.local.get('savedAlternatives');
    let savedAlternatives = storedData.savedAlternatives || [];
    
    // Filter out the one to remove
    savedAlternatives = savedAlternatives.filter(alt => alt.id !== alternativeId);
    
    // Store updated list
    await chrome.storage.local.set({ savedAlternatives });
    
    return true;
  } catch (error) {
    console.error('Error removing saved alternative:', error);
    return false;
  }
}

// Clear old product data (older than 7 days)
async function clearOldProductData() {
  try {
    const storedData = await chrome.storage.local.get('productAlternatives');
    const productAlternatives = storedData.productAlternatives || {};
    
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    let hasChanges = false;
    
    // Check each product entry
    for (const productId in productAlternatives) {
      if (productAlternatives[productId].timestamp < sevenDaysAgo) {
        delete productAlternatives[productId];
        hasChanges = true;
      }
    }
    
    // Store updated data if changes were made
    if (hasChanges) {
      await chrome.storage.local.set({ productAlternatives });
    }
  } catch (error) {
    console.error('Error clearing old product data:', error);
  }
}

// Format price string to a consistent format
export function formatPrice(priceString) {
  if (!priceString) return '';
  
  // Remove any non-numeric characters except for the decimal point
  const numericPrice = priceString.replace(/[^0-9.]/g, '');
  
  // Parse the price as a float
  const price = parseFloat(numericPrice);
  
  // Format the price with 2 decimal places and add the dollar sign
  return `$${price.toFixed(2)}`;
}

// Calculate how eco-friendly a product is (simplified version)
export function calculateEcoScore(product) {
  let score = 5; // Base score
  
  // Add points for eco-friendly features
  if (product.ecoFeatures) {
    score += product.ecoFeatures.length * 0.5;
  }
  
  // Cap at 10
  return Math.min(score, 10);
}

// Generate a timestamp in human-readable format
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}