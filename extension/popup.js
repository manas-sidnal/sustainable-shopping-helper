import { formatPrice, calculateEcoScore, getStoredAlternatives, getSavedAlternatives, saveAlternative, removeSavedAlternative, loadAlternativesData } from './utils.js';

// DOM elements
const currentProductImageElem = document.getElementById('current-product-image'); 
const currentProductTitleElem = document.getElementById('current-product-title'); 
const currentProductPriceElem = document.getElementById('current-product-price'); 
const currentProductCategoryElem = document.getElementById('current-product-category'); 
const alternativesListElem = document.getElementById('alternatives-list'); 
const savedListElem = document.getElementById('saved-list'); 
const categoryFilterElem = document.getElementById('category-filter'); 
const sortBySelectElem = document.getElementById('sort-by'); 
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const alternativeTemplate = document.getElementById('alternative-template');

// Global state
let currentProduct = null;
let allAlternatives = []; // Store all fetched alternatives before filtering/sorting
let displayedAlternatives = []; // The currently displayed alternatives (after filter/sort)
let categories = new Set();

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
    // Set up tab switching
    setupTabs();

    // Get the current product and alternatives
    await getCurrentProductInfo();

    // Set up event listeners for filters/sort
    setupEventListeners();

    // Activate the 'alternatives' tab by default
    activateTab('alternatives');
});
// --- Setup Functions ---
// Set up tab switching
function setupTabs() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            activateTab(tabId);
        });
    });
}

// Set up event listeners for filters and sorting
function setupEventListeners() {
    categoryFilterElem.addEventListener('change', applyFiltersAndSort);
    sortBySelectElem.addEventListener('change', applyFiltersAndSort);
}
// --- Data Fetching & Display Functions ---
// Get the current product info from the active tab
async function getCurrentProductInfo() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTab = tabs[0];

        if (!activeTab) {
            displayError('popup', 'Could not access the active tab.');
            return;
        }

        // Check if we're on a supported website (matches manifest.json host_permissions)
        // MODIFIED: Added 'amazon.in' to supportedDomains
        const supportedDomains = ['amazon.com', 'amazon.in', 'walmart.com', 'target.com', 'ebay.com']; 
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
                    console.error('Error sending message:', chrome.runtime.lastError.message);
                    displayError('popup', 'Could not communicate with the page. Please refresh and try again.');
                    return;
                }

                if (!response || !response.success || !response.productInfo) {
                    displayError('alternatives', 'Could not detect a product on this page.'); // Display on alternatives tab
                    currentProductTitleElem.textContent = 'Product Not Found'; // Update product summary
                    currentProductImageElem.src = chrome.runtime.getURL('icons/logo.png');
                    currentProductImageElem.alt = 'No Product';
                    currentProductImageElem.style.display = 'block';
                    currentProductPriceElem.textContent = '';
                    currentProductCategoryElem.textContent = '';
                    return;
                }

                currentProduct = response.productInfo;
                displayCurrentProduct();
                await getAlternativesForProduct();
            }
        );
    } catch (error) {
        console.error('Error getting current product info:', error);
        displayError('popup', 'An error occurred while detecting the product.');
    }
}

// Display the current product information
function displayCurrentProduct() {
    if (!currentProduct) return;

    currentProductTitleElem.textContent = currentProduct.title || 'Unknown Product';
    currentProductPriceElem.textContent = currentProduct.price ? formatPrice(currentProduct.price) : 'Price not available';
    currentProductCategoryElem.textContent = `Category: ${currentProduct.category || 'Unknown'}`;

    if (currentProduct.imageUrl) {
        currentProductImageElem.src = currentProduct.imageUrl;
        currentProductImageElem.alt = currentProduct.title || 'Product Image';
        currentProductImageElem.style.display = 'block';
    } else {
        currentProductImageElem.src = chrome.runtime.getURL('icons/logo.png'); // Fallback to your logo
        currentProductImageElem.alt = 'No Image Available';
        currentProductImageElem.style.display = 'block';
    }
}

// Get alternatives for the current product
async function getAlternativesForProduct() {
    // Show loading state
    alternativesListElem.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Finding eco-friendly alternatives...</p>
        </div>
    `;

    try {
        if (!currentProduct || !currentProduct.id) {
            displayError('alternatives', 'No product detected to find alternatives for.');
            return;
        }

        let response;
        // Try to get alternatives from storage first (from contentScript's last successful fetch)
        const storedAlternatives = await getStoredAlternatives(currentProduct.id);

        if (storedAlternatives && storedAlternatives.length > 0) {
            response = { success: true, alternatives: storedAlternatives };
        } else {
            // If not in storage, request from background script (which then calls fetcher.js)
            response = await new Promise(resolve => {
                chrome.runtime.sendMessage(
                    { action: 'getAlternatives', productId: currentProduct.id },
                    (result) => {
                        resolve(result);
                    }
                );
            });
        }

        if (response && response.success) {
            allAlternatives = response.alternatives;

            // Extract categories for filtering from *all* found alternatives
            categories = new Set();
            allAlternatives.forEach(alt => {
                if (alt.replaces && Array.isArray(alt.replaces)) {
                    alt.replaces.forEach(category => categories.add(category));
                }
            });
            populateCategoryFilter();

            applyFiltersAndSort(); // Apply initial filter and sort
        } else {
            // Error from background script or no alternatives found
            displayError('alternatives', response?.error || 'No eco-friendly alternatives found for this product.');
        }
    } catch (error) {
        console.error('Error getting alternatives:', error);
        displayError('alternatives', 'An unexpected error occurred while finding alternatives.');
    }
}

// Populate the category filter dropdown
function populateCategoryFilter() {
    // Clear existing options except the "All Categories" option
    while (categoryFilterElem.options.length > 1) {
        categoryFilterElem.remove(1);
    }

    // Add categories as options, sorted alphabetically
    Array.from(categories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilterElem.appendChild(option);
    });
}

// Create an element for an alternative
async function createAlternativeElement(alternative, isSaved) {
    const altElement = alternativeTemplate.content.cloneNode(true);

    // Set image and eco score
    const image = altElement.querySelector('.alternative-image img');
    image.src = alternative.imageUrl || chrome.runtime.getURL('icons/logo.png'); // Fallback to your logo
    image.alt = alternative.name || 'Alternative Product Image';

    const ecoScoreSpan = altElement.querySelector('.eco-score');
    // Ensure ecoScore is calculated or available as a number
    const score = calculateEcoScore(alternative);
    ecoScoreSpan.textContent = score.toFixed(1);

    // Add appropriate class for eco-score styling
    if (score >= 9) {
        ecoScoreSpan.classList.add('high');
    } else if (score >= 7) {
        ecoScoreSpan.classList.add('medium');
    } else if (score >= 5) {
        ecoScoreSpan.classList.add('low');
    } else {
        ecoScoreSpan.classList.add('very-low');
    }

    // Set text content
    altElement.querySelector('.alternative-name').textContent = alternative.name || 'No Name';
    altElement.querySelector('.alternative-brand').textContent = alternative.brand || 'No Brand';
    altElement.querySelector('.alternative-price').textContent = alternative.price ? formatPrice(alternative.price) : 'Price not available';
    altElement.querySelector('.alternative-description').textContent = (alternative.description && alternative.description.length > 100) ? alternative.description.substring(0, 97) + '...' : (alternative.description || 'No description available.');

    // Add features (limit to 3 for display)
    const featuresContainer = altElement.querySelector('.alternative-features');
    if (alternative.ecoFeatures && Array.isArray(alternative.ecoFeatures) && alternative.ecoFeatures.length > 0) {
        alternative.ecoFeatures.slice(0, 3).forEach(feature => {
            const featureElement = document.createElement('span');
            featureElement.className = 'feature-tag';
            featureElement.textContent = feature;
            featuresContainer.appendChild(featureElement);
        });
    }

    // Set up buy button
    const buyButton = altElement.querySelector('.btn-buy');
    if (alternative.purchaseUrl) {
        buyButton.href = alternative.purchaseUrl;
    } else {
        buyButton.style.display = 'none'; // Hide if no purchase URL
    }


    // Set up save button
    const saveButton = altElement.querySelector('.btn-save');
    if (isSaved) {
        saveButton.textContent = 'Saved';
        saveButton.classList.add('saved');
    }

    saveButton.addEventListener('click', async () => {
        if (saveButton.classList.contains('saved')) { // Check current state of button
            await removeSavedAlternative(alternative.id);
            saveButton.textContent = 'Save';
            saveButton.classList.remove('saved');
        } else {
            await saveAlternative(alternative);
            saveButton.textContent = 'Saved';
            saveButton.classList.add('saved');
        }
        // If on saved tab, refresh saved list
        if (document.getElementById('saved-tab').classList.contains('active')) {
            loadSavedAlternatives();
        }
    });

    return altElement.querySelector('.alternative-item');
}

// --- Display Functions (General) ---

// Displays messages in the alternatives list area
function displayError(targetTab, message) {
    if (targetTab === 'alternatives') {
        alternativesListElem.innerHTML = `<p class="empty-state error-message">${message}</p>`;
    } else if (targetTab === 'popup') {
        // For general popup errors not tied to alternatives list specifically
        currentProductTitleElem.textContent = 'Error Loading';
        currentProductImageElem.style.display = 'none';
        alternativesListElem.innerHTML = `<p class="empty-state error-message">${message}</p>`;
    }
}

function showInfoMessage(message) {
    alternativesListElem.innerHTML = `<p class="empty-state">${message}</p>`;
}

function displayNotSupportedMessage() {
    document.getElementById('current-product').style.display = 'none';
    document.querySelector('.filters').style.display = 'none'; // Assuming filters is within alternatives tab

    alternativesListElem.innerHTML = `
        <div class="empty-state not-supported">
            <h3>Website Not Supported</h3>
            <p>EcoSwap currently supports:</p>
            <ul>
                <li>Amazon</li>
                <li>Walmart</li>
                <li>Target</li>
                <li>eBay</li>
            </ul>
            <p>Please navigate to one of these websites to find alternatives.</p>
        </div>
    `;
    // Also ensure other tabs are not showing content unexpectedly
    tabPanes.forEach(pane => pane.classList.remove('active'));
    document.getElementById('info-tab').classList.add('active'); // Maybe default to info tab
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-tab="info"]').classList.add('active');
}

// --- Tab Specific Display Functions ---

// Main function to render alternatives after filtering/sorting
async function displayAlternatives(alternativesToDisplay) {
    alternativesListElem.innerHTML = ''; // Clear previous content

    if (!alternativesToDisplay || alternativesToDisplay.length === 0) {
        showInfoMessage('No eco-friendly alternatives found matching your criteria.');
        return;
    }

    const savedAlts = await getSavedAlternatives();
    const savedIds = new Set(savedAlts.map(alt => alt.id));

    for (const alternative of alternativesToDisplay) {
        const altElement = await createAlternativeElement(alternative, savedIds.has(alternative.id));
        alternativesListElem.appendChild(altElement);
    }
}

// Load saved alternatives when 'Saved' tab is activated
async function loadSavedAlternatives() {
    savedListElem.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading saved alternatives...</p>
        </div>
    `;
    try {
        const savedAlternatives = await getSavedAlternatives();
        savedListElem.innerHTML = ''; // Clear loading state

        if (!savedAlternatives || savedAlternatives.length === 0) {
            savedListElem.innerHTML = `
                <p class="empty-state">You haven't saved any alternatives yet.</p>
            `;
            return;
        }

        for (const alternative of savedAlternatives) {
            const altElement = await createAlternativeElement(alternative, true); // Always true for saved
            savedListElem.appendChild(altElement);
        }
    } catch (error) {
        console.error('Error loading saved alternatives:', error);
        savedListElem.innerHTML = `
            <p class="empty-state error-message">Error loading saved alternatives.</p>
        `;
    }
}
// --- Filtering & Sorting Logic ---

function applyFiltersAndSort() {
    let filtered = [...allAlternatives]; // Start with all fetched alternatives

    // Apply Category Filter
    const selectedCategory = categoryFilterElem.value;
    if (selectedCategory !== 'all') {
        filtered = filtered.filter(alt =>
            alt.replaces && Array.isArray(alt.replaces) && alt.replaces.includes(selectedCategory)
        );
    }

    // Apply Sorting
    const sortBy = sortBySelectElem.value;
    if (sortBy === 'eco-score') {
        filtered.sort((a, b) => calculateEcoScore(b) - calculateEcoScore(a)); // Descending eco-score
    } else if (sortBy === 'price-low') {
        filtered.sort((a, b) => {
            const priceA = parseFloat(a.price?.replace(/[^0-9.]/g, '')) || 0;
            const priceB = parseFloat(b.price?.replace(/[^0-9.]/g, '')) || 0;
            return priceA - priceB;
        });
    } else if (sortBy === 'price-high') {
        filtered.sort((a, b) => {
            const priceA = parseFloat(a.price?.replace(/[^0-9.]/g, '')) || 0;
            const priceB = parseFloat(b.price?.replace(/[^0-9.]/g, '')) || 0;
            return priceB - priceA;
        });
    }

    displayedAlternatives = filtered; // Update global state for displayed alternatives
    displayAlternatives(displayedAlternatives);
}
// --- Tab Activation Handler ---
function activateTab(tabId) {
    tabButtons.forEach(button => {
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    tabPanes.forEach(pane => {
        if (pane.id === `${tabId}-tab`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
    // Load content specific to the activated tab
    if (tabId === 'alternatives') {
        // Re-apply filters and sort in case category/sort was changed while on another tab
        applyFiltersAndSort();
    } else if (tabId === 'saved') {
        loadSavedAlternatives();
    } else if (tabId === 'info') {
        // Info tab is static, no dynamic loading needed
    }
}