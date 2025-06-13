// Import utilities (note: in a real extension, we'd handle imports differently for content scripts)
// For this example, we'll assume these functions are defined in this file
const { extractProductInfo, getProductId, getProductCategory } = (() => {
  // Extract product info based on the current website
  const extractProductInfo = () => {
    if (window.location.hostname.includes('amazon.com')) {
      return extractAmazonProductInfo();
    } else if (window.location.hostname.includes('walmart.com')) {
      return extractWalmartProductInfo();
    } else if (window.location.hostname.includes('target.com')) {
      return extractTargetProductInfo();
    } else if (window.location.hostname.includes('ebay.com')) {
      return extractEbayProductInfo(); 
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

    return {
      id: productId,
      title: productTitle,
      price: productPrice,
      imageUrl: productImageUrl,
      category: category,
      source: 'amazon'
    };
  };

  // Extract product info from Walmart
  const extractWalmartProductInfo = () => {
    const productTitle = document.querySelector('[data-testid="product-title"]')?.textContent.trim();
    const productPrice = document.querySelector('[data-testid="price-value"]')?.textContent.trim();
    const productImageUrl = document.querySelector('[data-testid="hero-image"]')?.src;
    const productId = getWalmartProductId();
    const category = getWalmartProductCategory();

    return {
      id: productId,
      title: productTitle,
      price: productPrice,
      imageUrl: productImageUrl,
      category: category,
      source: 'walmart'
    };
  };

  // Extract product info from Target
  const extractTargetProductInfo = () => {
    const productTitle = document.querySelector('[data-test="product-title"]')?.textContent.trim();
    const productPrice = document.querySelector('[data-test="product-price"]')?.textContent.trim();
    const productImageUrl = document.querySelector('[data-test="product-image"]')?.src;
    const productId = getTargetProductId();
    const category = getTargetProductCategory();

    return {
      id: productId,
      title: productTitle,
      price: productPrice,
      imageUrl: productImageUrl,
      category: category,
      source: 'target'
    };
  };

  // Extract product info from eBay
  const extractEbayProductInfo = () => {
    const productTitle = document.querySelector('h1.x-item-title__mainTitle')?.textContent.trim();
    const productPrice = document.querySelector('span[itemprop="price"]')?.textContent.trim();
    const productImageUrl = document.querySelector('img#icImg')?.src;
    const productId = getEbayProductId();
    const category = getEbayProductCategory();

    return {
      id: productId,
      title: productTitle,
      price: productPrice,
      imageUrl: productImageUrl,
      category: category,
      source: 'ebay'
    };
  };

  // Get product ID based on URL or DOM elements
  const getProductId = () => {
    if (window.location.hostname.includes('amazon.com')) {
      return getAmazonProductId();
    } else if (window.location.hostname.includes('walmart.com')) {
      return getWalmartProductId();
    } else if (window.location.hostname.includes('target.com')) {
      return getTargetProductId();
    } else if (window.location.hostname.includes('ebay.com')) {
      return getEbayProductId();
    }
    return null;
  };

  const getProductCategory = () => {
  if (window.location.hostname.includes('amazon.com')) {
    return getAmazonProductCategory();
  } else if (window.location.hostname.includes('walmart.com')) {
    return getWalmartProductCategory();
  } else if (window.location.hostname.includes('target.com')) {
    return getTargetProductCategory();
  } else if (window.location.hostname.includes('ebay.com')) {
    return getEbayProductCategory();
  }
  return 'Unknown';
};


  // Helper functions for extracting product IDs
  const getAmazonProductId = () => {
    const match = window.location.pathname.match(/\/dp\/([A-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const getWalmartProductId = () => {
    const match = window.location.pathname.match(/\/ip\/([0-9]+)/);
    return match ? match[1] : null;
  };

  const getTargetProductId = () => {
    const match = window.location.pathname.match(/\/p\/([A-Za-z0-9-]+)/);
    return match ? match[1] : null;
  };

  const getEbayProductId = () => {
    const match = window.location.pathname.match(/\/itm\/([0-9]+)/);
    return match ? match[1] : null;
  };

  // Helper functions for extracting product categories
  const getAmazonProductCategory = () => {
    const breadcrumbs = document.querySelector('#wayfinding-breadcrumbs_feature_div');
    return breadcrumbs ? breadcrumbs.textContent.trim().split('\n')[0].trim() : 'Unknown';
  };

  const getWalmartProductCategory = () => {
    const breadcrumbs = document.querySelector('.breadcrumb');
    return breadcrumbs ? breadcrumbs.textContent.trim().split('/')[0].trim() : 'Unknown';
  };

  const getTargetProductCategory = () => {
    const breadcrumbs = document.querySelector('.breadcrumbs');
    return breadcrumbs ? breadcrumbs.textContent.trim().split('/')[0].trim() : 'Unknown';
  };

  const getEbayProductCategory = () => {
    const breadcrumbs = document.querySelector('.breadcrumbs');
    return breadcrumbs ? breadcrumbs.textContent.trim().split('\n')[0].trim() : 'Unknown';
  };

  // Return the public functions
  return { extractProductInfo, getProductId, getProductCategory };
})();

// Detect when we're on a product page
const isProductPage = () => {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  if (hostname.includes('amazon.com') && pathname.includes('/dp/')) {
    return true;
  } else if (hostname.includes('walmart.com') && pathname.includes('/ip/')) {
    return true;
  } else if (hostname.includes('target.com') && pathname.includes('/p/')) {
    return true;
  } else if (hostname.includes('ebay.com') && pathname.includes('/itm/')) {
    return true;
  }

  return false;
};

// Create notification when alternatives are found
const showNotification = (count) => {
  const notification = document.createElement('div');
  notification.className = 'ecoswap-notification';
  notification.innerHTML = `
    <div class="ecoswap-notification-content" style="display: flex; align-items: center; gap: 10px;">
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="EcoSwap" style="width: 32px; height: 32px;" />
      <p>Found ${count} eco-friendly alternatives!</p>
      <button id="ecoswap-view-btn">View</button>
    </div>
  `;
  document.body.appendChild(notification);

  // Handle view button click
  document.getElementById('ecoswap-view-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({type: 'OPEN_POPUP' });
  });

  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .ecoswap-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      background-color: #F5F5DC;
      border: 1px solid #4CAF50;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 15px;
      font-family: 'Open Sans', sans-serif;
      animation: ecoswap-slide-in 0.3s ease-out;
    }
    
    .ecoswap-notification-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ecoswap-notification img {
      width: 24px;
      height: 24px;
    }
    
    .ecoswap-notification p {
      margin: 0;
      color: #333;
    }
    
    .ecoswap-notification button {
      background-color: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 5px 10px;
      cursor: pointer;
      font-weight: bold;
      transition: background-color 0.2s;
    }
    
    .ecoswap-notification button:hover {
      background-color: #3E8E41;
    }
    
    @keyframes ecoswap-slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Add to the page
  document.body.appendChild(notification);
  
  // Handle click on view button
  notification.querySelector('button').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
    notification.remove();
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
          if (response && response.success && response.alternatives.length > 0) {
            // Show notification with the number of alternatives found
            showNotification(response.alternatives.length);
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
