import { loadAlternativesData, storeAlternatives, getStoredAlternatives, saveAlternative, getSavedAlternatives, removeSavedAlternative } from './utils.js';

// DOM elements
const currentProductImage = document.getElementById('current-product-image');
const currentProductTitle = document.getElementById('current-product-title');
const currentProductPrice = document.getElementById('current-product-price');
const currentProductCategory = document.getElementById('current-product-category');
const alternativesList = document.getElementById('alternatives-list');
const savedList = document.getElementById('saved-list');
const categoryFilter = document.getElementById('category-filter');
const sortBySelect = document.getElementById('sort-by');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const alternativeTemplate = document.getElementById('alternative-template');

// Global state
let currentProduct = null;
let alternatives = [];
let categories = new Set();

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  // Set up tab switching
  setupTabs();
  
  // Get the current product and alternatives
  await getCurrentProductInfo();
  
  // Set up event listeners
  setupEventListeners();
});

// Set up tab switching
function setupTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Add active class to the clicked button and corresponding pane
      button.classList.add('active');
      const tabId = button.dataset.tab;
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      // Load content for the tab if needed
      if (tabId === 'saved') {
        loadSavedAlternatives();
      }
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  // Filter by category
  categoryFilter.addEventListener('change', filterAlternatives);
  
  // Sort alternatives
  sortBySelect.addEventListener('change', sortAlternatives);
}

// Get the current product info from the active tab
async function getCurrentProductInfo() {
  try {
    // Get the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (!activeTab) {
      displayError('Could not access the active tab.');
      return;
    }
    
    // Check if we're on a supported website
    const supportedDomains = ['amazon.com', 'walmart.com', 'target.com', 'ebay.com'];
    const isSupported = supportedDomains.some(domain => activeTab.url.includes(domain));
    
    if (!isSupported) {
      displayNotSupportedMessage();
      return;
    }
    
    // Get the product info from the content script
    chrome.tabs.sendMessage(
      activeTab.id,
      { action: 'getProductInfo' },
      async (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message:', chrome.runtime.lastError);
          displayError('Could not communicate with the page. Please refresh and try again.');
          return;
        }
        
        if (!response || !response.success) {
          displayError('Could not detect a product on this page.');
          return;
        }
        
        currentProduct = response.productInfo;
        
        // Display the current product
        displayCurrentProduct();
        
        // Get alternatives for the product
        await getAlternativesForProduct();
      }
    );
  } catch (error) {
    console.error('Error getting current product info:', error);
    displayError('An error occurred. Please try again.');
  }
}

// Display the current product
function displayCurrentProduct() {
  if (!currentProduct) return;
  
  currentProductTitle.textContent = currentProduct.title || 'Unknown Product';
  currentProductPrice.textContent = currentProduct.price || 'Price not available';
  currentProductCategory.textContent = `Category: ${currentProduct.category || 'Unknown'}`;
  
  if (currentProduct.imageUrl) {
    currentProductImage.src = currentProduct.imageUrl;
    currentProductImage.alt = currentProduct.title;
  }
}

// Get alternatives for the current product
async function getAlternativesForProduct() {
  try {
    // Show loading state
    alternativesList.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Finding eco-friendly alternatives...</p>
      </div>
    `;
    
    // Get alternatives from background script or local storage
    let response;
    
    if (currentProduct && currentProduct.id) {
      // Try to get alternatives from storage first
      const storedAlternatives = await getStoredAlternatives(currentProduct.id);
      
      if (storedAlternatives && storedAlternatives.length > 0) {
        response = { success: true, alternatives: storedAlternatives };
      } else {
        // If not in storage, request from background script
        response = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            { action: 'getAlternatives', productId: currentProduct.id },
            (result) => {
              resolve(result);
            }
          );
        });
      }
    } else {
      // If no product ID, load some default alternatives
      const allAlternatives = await loadAlternativesData();
      response = { 
        success: true, 
        alternatives: allAlternatives.slice(0, 5) 
      };
    }
    
    if (response && response.success) {
      alternatives = response.alternatives;
      
      // Extract categories for filtering
      categories = new Set();
      alternatives.forEach(alt => {
        if (alt.replaces && alt.replaces.length > 0) {
          alt.replaces.forEach(category => categories.add(category));
        }
      });
      
      // Populate category filter
      populateCategoryFilter();
      
      // Display alternatives
      displayAlternatives(alternatives);
    } else {
      displayError('Could not find alternatives for this product.');
    }
  } catch (error) {
    console.error('Error getting alternatives:', error);
    displayError('An error occurred while finding alternatives.');
  }
}

// Populate the category filter dropdown
function populateCategoryFilter() {
  // Clear existing options except the "All Categories" option
  while (categoryFilter.options.length > 1) {
    categoryFilter.remove(1);
  }
  
  // Add categories as options
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

// Display alternatives in the list
function displayAlternatives(alternatives) {
  // Clear the list
  alternativesList.innerHTML = '';
  
  if (!alternatives || alternatives.length === 0) {
    alternativesList.innerHTML = `
      <p class="empty-state">No eco-friendly alternatives found for this product.</p>
    `;
    return;
  }
  
  // Get saved alternatives to mark them
  getSavedAlternatives().then(savedAlts => {
    const savedIds = savedAlts.map(alt => alt.id);
    
    // Create elements for each alternative
    alternatives.forEach(alternative => {
      const altElement = createAlternativeElement(alternative, savedIds.includes(alternative.id));
      alternativesList.appendChild(altElement);
    });
  });
}

// Create an element for an alternative
function createAlternativeElement(alternative, isSaved) {
  // Clone the template
  const altElement = alternativeTemplate.content.cloneNode(true);
  
  // Set image and eco score
  const image = altElement.querySelector('.alternative-image img');
  image.src = alternative.imageUrl || 'https://via.placeholder.com/80';
  image.alt = alternative.name;
  
  const ecoScore = altElement.querySelector('.eco-score');
  ecoScore.textContent = alternative.ecoScore.toFixed(1);
  
  // Set text content
  altElement.querySelector('.alternative-name').textContent = alternative.name;
  altElement.querySelector('.alternative-brand').textContent = alternative.brand;
  altElement.querySelector('.alternative-price').textContent = alternative.price;
  altElement.querySelector('.alternative-description').textContent = alternative.description;
  
  // Add features
  const featuresContainer = altElement.querySelector('.alternative-features');
  if (alternative.ecoFeatures && alternative.ecoFeatures.length > 0) {
    alternative.ecoFeatures.slice(0, 3).forEach(feature => {
      const featureElement = document.createElement('span');
      featureElement.className = 'feature-tag';
      featureElement.textContent = feature;
      featuresContainer.appendChild(featureElement);
    });
  }
  
  // Set up buy button
  const buyButton = altElement.querySelector('.btn-buy');
  buyButton.href = alternative.purchaseUrl;
  
  // Set up save button
  const saveButton = altElement.querySelector('.btn-save');
  if (isSaved) {
    saveButton.textContent = 'Saved';
    saveButton.classList.add('saved');
  }
  
  saveButton.addEventListener('click', () => {
    if (isSaved) {
      // Remove from saved
      removeSavedAlternative(alternative.id).then(() => {
        saveButton.textContent = 'Save';
        saveButton.classList.remove('saved');
        isSaved = false;
      });
    } else {
      // Add to saved
      saveAlternative(alternative).then(() => {
        saveButton.textContent = 'Saved';
        saveButton.classList.add('saved');
        isSaved = true;
      });
    }
  });
  
  return altElement.querySelector('.alternative-item');
}

// Load saved alternatives
async function loadSavedAlternatives() {
  try {
    const savedAlternatives = await getSavedAlternatives();
    
    // Clear the list
    savedList.innerHTML = '';
    
    if (!savedAlternatives || savedAlternatives.length === 0) {
      savedList.innerHTML = `
        <p class="empty-state">You haven't saved any alternatives yet.</p>
      `;
      return;
    }
    
    // Create elements for each saved alternative
    savedAlternatives.forEach(alternative => {
      const altElement = createAlternativeElement(alternative, true);
      savedList.appendChild(altElement);
    });
  } catch (error) {
    console.error('Error loading saved alternatives:', error);
    savedList.innerHTML = `
      <p class="empty-state">Error loading saved alternatives.</p>
    `;
  }
}

// Filter alternatives by category
function filterAlternatives() {
  const category = categoryFilter.value;
  
  if (category === 'all') {
    // Show all alternatives
    displayAlternatives(alternatives);
  } else {
    // Filter by category
    const filtered = alternatives.filter(alt => 
      alt.replaces && alt.replaces.includes(category)
    );
    displayAlternatives(filtered);
  }
}

// Sort alternatives
function sortAlternatives() {
  const sortBy = sortBySelect.value;
  let sorted = [...alternatives];
  
  if (sortBy === 'eco-score') {
    sorted.sort((a, b) => b.ecoScore - a.ecoScore);
  } else if (sortBy === 'price-low') {
    sorted.sort((a, b) => {
      const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
      const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
      return priceA - priceB;
    });
  } else if (sortBy === 'price-high') {
    sorted.sort((a, b) => {
      const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
      const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
      return priceB - priceA;
    });
  }
  
  // Apply any active category filters
  const category = categoryFilter.value;
  if (category !== 'all') {
    sorted = sorted.filter(alt => 
      alt.replaces && alt.replaces.includes(category)
    );
  }
  
  displayAlternatives(sorted);
}

// Display error message
function displayError(message) {
  alternativesList.innerHTML = `
    <p class="empty-state">${message}</p>
  `;
}

// Display not supported message
function displayNotSupportedMessage() {
  document.querySelector('.current-product').style.display = 'none';
  document.querySelector('.filters').style.display = 'none';
  
  alternativesList.innerHTML = `
    <div class="not-supported">
      <p>This website is not currently supported by EcoSwap.</p>
      <p>We currently support Amazon, Walmart, Target, and eBay.</p>
    </div>
  `;
}