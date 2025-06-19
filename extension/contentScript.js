// Import utilities (note: in a real extension, we'd handle imports differently for content scripts)
// For this example, we'll assume these functions are defined in this file
const { extractProductInfo, getProductId, getProductCategory } = (() => {
  // Extract product info based on the current website (now only Amazon)
  const extractProductInfo = () => {
    // MODIFIED: Check for any amazon domain (e.g., .com, .in, .co.uk, etc.)
    if (window.location.hostname.includes('amazon.')) {
      return extractAmazonProductInfo();
    }
    return null;
  };

  // Extract product info from Amazon
  const extractAmazonProductInfo = () => {
    const productTitle = document.getElementById('productTitle')?.textContent.trim();
    const productPrice = document.querySelector('.a-price .a-offscreen')?.textContent.trim();
    const productImageUrl = document.getElementById('landingImage')?.src;
    const productId = getAmazonProductId();
    const category = getAmazonProductCategory();

    // --- Extraction for product details/description text ---
    const productDescriptionElement = document.getElementById('productDescription') || document.getElementById('feature-bullets');
    const productDetailsText = productDescriptionElement ? productDescriptionElement.innerText.trim() : ''; // Use innerText for full text

    return {
      id: productId,
      title: productTitle,
      price: productPrice,
      imageUrl: productImageUrl,
      category: category,
      detailsText: productDetailsText.toLowerCase(), // Store as lowercase for matching
      source: 'amazon'
    };
  };

  // Get product ID based on URL or DOM elements (now only Amazon)
  const getProductId = () => {
    // MODIFIED: Check for any amazon domain
    if (window.location.hostname.includes('amazon.')) {
      return getAmazonProductId();
    }
    return null;
  };

  // Get product category based on DOM elements (now only Amazon)
  const getProductCategory = () => {
    // MODIFIED: Check for any amazon domain
    if (window.location.hostname.includes('amazon.')) {
      return getAmazonProductCategory();
    }
    return 'Unknown';
  };


  // Helper function for extracting Amazon product ID
  const getAmazonProductId = () => {
    const match = window.location.pathname.match(/\/dp\/([A-Z0-9]+)/);
    return match ? match[1] : null;
  };

  // Helper function for extracting Amazon product category
  const getAmazonProductCategory = () => {
    const breadcrumbs = document.querySelector('#wayfinding-breadcrumbs_feature_div');
    return breadcrumbs ? breadcrumbs.textContent.trim().split('\n')[0].trim() : 'Unknown';
  };

  // Return the public functions
  return { extractProductInfo, getProductId, getProductCategory };
})();

// Detect when we're on an Amazon product page
const isProductPage = () => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // MODIFIED: Check for any amazon domain and the product page path
  if (hostname.includes('amazon.') && pathname.includes('/dp/')) {
    return true;
  }
  return false;
};

// Function to display a general message to the user
const showUserMessage = (message, type = 'info') => {
  const existingNotification = document.querySelector('.ecoswap-notification');
  if (existingNotification) {
      existingNotification.remove(); // Remove any previous notification/message
  }

  const notification = document.createElement('div');
  notification.className = `ecoswap-notification ecoswap-${type}`; // Add type class for styling
  notification.innerHTML = `
    <div class="ecoswap-notification-content">
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="EcoSwap" style="width: 32px; height: 32px;" />
      <p>${message}</p>
      <button id="ecoswap-close-btn" class="ecoswap-close-button">&times;</button>
    </div>
  `;
  document.body.appendChild(notification);

  // Handle close button click
  document.getElementById('ecoswap-close-btn').addEventListener('click', () => {
    notification.style.animation = 'ecoswap-slide-out 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300);
  });

  // Remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'ecoswap-slide-out 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }
  }, 10000);
};


// Create notification when alternatives are found
const showNotification = (count) => {
  const existingNotification = document.querySelector('.ecoswap-notification');
  if (existingNotification) {
      existingNotification.remove(); // Remove any previous message
  }

  const notification = document.createElement('div');
  notification.className = 'ecoswap-notification ecoswap-success'; // Add a success class for specific styling
  notification.innerHTML = `
    <div class="ecoswap-notification-content">
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="EcoSwap" style="width: 32px; height: 32px;" />
      <p>Found ${count} eco-friendly alternatives!</p>
      <button id="ecoswap-view-btn" class="ecoswap-action-button">View</button>
      <button id="ecoswap-close-btn" class="ecoswap-close-button">&times;</button>
    </div>
  `;
  document.body.appendChild(notification);


  // Handle view button click
  document.getElementById('ecoswap-view-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({type: 'OPEN_POPUP' });
    notification.style.animation = 'ecoswap-slide-out 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300); // Remove after view button click
  });

  // Handle close button click
  document.getElementById('ecoswap-close-btn').addEventListener('click', () => {
    notification.style.animation = 'ecoswap-slide-out 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300);
  });

  // Remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'ecoswap-slide-out 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }
  }, 10000);
};


// Main execution
const init = () => {
  // Check if we're on a product page
  if (!isProductPage()) {
    return;
  }

  // Wait for the page to fully load
  setTimeout(() => {
    // Extract product information
    const productInfo = extractProductInfo();

    if (productInfo && productInfo.id) {
      // Send the product info to the background script
      chrome.runtime.sendMessage(
        { action: 'scanProduct', productInfo },
        (response) => {
          if (chrome.runtime.lastError) {
            // This handles potential errors in message sending itself or if receiver not found
            console.error("Error sending message or no response:", chrome.runtime.lastError);
            showUserMessage("Oops! Something went wrong while scanning. Please try again.", 'error');
            return;
          }

          if (response && response.success) {
            if (response.alternatives.length > 0) {
              // Case 1: Alternatives found
              showNotification(response.alternatives.length);
            } else {
              // Case 2: No alternatives found
              showUserMessage("No eco-friendly alternatives found for this product.", 'info');
            }
          } else {
            // Case 3: Error occurred (response.success is false)
            console.error('Failed to get alternatives:', response.error);
            showUserMessage("Could not find alternatives. Please try again later.", 'error');
          }
        }
      );
    }
  }, 1500); // Wait for 1.5 seconds to ensure the page is loaded
};

// Initialize the content script
init();

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === 'getProductInfo') {
    const productInfo = extractProductInfo();
    sendResponse({ success: true, productInfo });
  }

  // Return true to indicate that the response will be sent asynchronously
  return true;
});

// --- STYLES FOR NOTIFICATIONS ---
const styleElement = document.createElement('style');
styleElement.textContent = `
  .ecoswap-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    background-color: #F5F5DC; /* Default/Success */
    border: 1px solid #4CAF50; /* Default/Success */
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 15px;
    font-family: 'Open Sans', sans-serif;
    animation: ecoswap-slide-in 0.3s ease-out;
    min-width: 280px; /* Ensure it's wide enough for messages */
    color: #333; /* Default text color */
  }

  .ecoswap-notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: space-between;
  }

  .ecoswap-notification img {
    width: 32px; /* Increased slightly for better visibility */
    height: 32px;
  }

  .ecoswap-notification p {
    margin: 0;
    color: inherit; /* Inherit color from notification type */
    flex-grow: 1;
    font-size: 0.95em; /* Slightly adjusted font size */
  }

  .ecoswap-action-button { /* Style for 'View' button */
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
    white-space: nowrap; /* Prevent text wrapping */
  }

  .ecoswap-action-button:hover {
    background-color: #3E8E41;
  }

  .ecoswap-close-button { /* Style for the close (x) button */
    background: none;
    border: none;
    font-size: 1.5em;
    line-height: 1;
    padding: 0 5px;
    margin-left: 10px;
    color: #888;
    cursor: pointer;
    transition: color 0.2s;
  }

  .ecoswap-close-button:hover {
    color: #333;
  }

  /* Specific styles for different notification types */
  .ecoswap-notification.ecoswap-success {
    background-color: #E6FFE6; /* Light green */
    border-color: #4CAF50; /* Green */
    color: #336633; /* Dark green text */
  }

  .ecoswap-notification.ecoswap-info {
    background-color: #E0F7FA; /* Light blue */
    border-color: #00BCD4; /* Cyan */
    color: #006064; /* Dark cyan text */
  }

  .ecoswap-notification.ecoswap-error {
    background-color: #FFEBEE; /* Light red */
    border-color: #F44336; /* Red */
    color: #B71C1C; /* Dark red text */
  }

  @keyframes ecoswap-slide-in {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes ecoswap-slide-out {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(styleElement);