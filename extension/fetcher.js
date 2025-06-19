import { loadAlternativesData } from './utils.js';

// Fetch eco-friendly alternatives for a given product
export async function fetchAlternatives(productInfo) {
  try {
    // Get alternatives data from our local JSON
    const allAlternatives = await loadAlternativesData();

    // Filter alternatives based on product category
    let matchingAlternatives = [];

    // Prioritize exact category matches
    if (productInfo.category) {
      matchingAlternatives = allAlternatives.filter(alt =>
        alt.replaces.some(cat =>
          cat.toLowerCase() === productInfo.category.toLowerCase()
        )
      );

      // If no exact matches, try partial matches
      if (matchingAlternatives.length === 0) {
        matchingAlternatives = allAlternatives.filter(alt =>
          alt.replaces.some(cat =>
            productInfo.category.toLowerCase().includes(cat.toLowerCase()) ||
            cat.toLowerCase().includes(productInfo.category.toLowerCase())
          )
        );
      }
    }

    // If still no matches or no category, fallback to keyword matching in the product title and detailsText
    if (matchingAlternatives.length === 0 && (productInfo.title || productInfo.detailsText)) {
      // Combine title and detailsText for a broader search area
      const combinedProductText = (productInfo.title || '') + ' ' + (productInfo.detailsText || '');
      const lowerCombinedProductText = combinedProductText.toLowerCase();

      matchingAlternatives = allAlternatives.filter(alt =>
        alt.keywords.some(keyword =>
          lowerCombinedProductText.includes(keyword.toLowerCase()) // Use .includes() for multi-word keywords
        )
      );
    }

    // If we still don't have matches, return all top rated alternatives as a fallback
    // The .slice(0, 5) has been removed here to show all fallback items
    if (matchingAlternatives.length === 0) {
      matchingAlternatives = allAlternatives
        .sort((a, b) => b.ecoScore - a.ecoScore);
    }

    // Sort alternatives by eco score (highest first)
    // The .slice(0, 10) has been removed here to show all matching items
    matchingAlternatives = matchingAlternatives
      .sort((a, b) => b.ecoScore - a.ecoScore);


    // Add relevance score based on how well it matches the product
    matchingAlternatives = matchingAlternatives.map(alt => {
      let relevanceScore = 0;

      // Increase relevance if category matches
      if (productInfo.category && alt.replaces.some(cat =>
        productInfo.category.toLowerCase().includes(cat.toLowerCase())
      )) {
        relevanceScore += 3; // Higher score for category match
      }

      // Increase relevance if keywords match in title/detailsText
      if (productInfo.title || productInfo.detailsText) {
        const combinedProductText = (productInfo.title || '') + ' ' + (productInfo.detailsText || '');
        const lowerCombinedProductText = combinedProductText.toLowerCase();

        const matchingKeywords = alt.keywords.filter(keyword =>
          lowerCombinedProductText.includes(keyword.toLowerCase())
        );
        relevanceScore += matchingKeywords.length * 2; // Each keyword phrase match gets a higher weight
      }

      return { ...alt, relevanceScore };
    });

    // Final sort by relevance (primary), then eco score (secondary)
    matchingAlternatives.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.ecoScore - a.ecoScore;
    });

    return matchingAlternatives;
  } catch (error) {
    console.error('Error fetching alternatives:', error);
    throw error;
  }
}

// Fetch detailed information about a specific alternative product (no changes needed here)
export async function fetchAlternativeDetails(alternativeId) {
  try {
    const allAlternatives = await loadAlternativesData();
    const alternative = allAlternatives.find(alt => alt.id === alternativeId);

    if (!alternative) {
      throw new Error('Alternative product not found');
    }
    return alternative;
  } catch (error) {
    console.error('Error fetching alternative details:', error);
    throw error;
  }
}