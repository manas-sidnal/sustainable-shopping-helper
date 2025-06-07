import { loadAlternativesData } from './utils.js';

// Fetch eco-friendly alternatives for a given product
export async function fetchAlternatives(productInfo) {
  try {
    // In a real-world scenario, this would call an API to get alternatives
    // For this example, we'll use our local data
    
    // Get alternatives data from our local JSON
    const allAlternatives = await loadAlternativesData();
    
    // Filter alternatives based on product category
    let matchingAlternatives = [];
     
    if (productInfo.category) {
      // First try to find exact category matches
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
    
    // If still no matches or no category, fallback to keyword matching in the product title
    if (matchingAlternatives.length === 0 && productInfo.title) {
      const keywords = productInfo.title.toLowerCase().split(' ');
      
      matchingAlternatives = allAlternatives.filter(alt => 
        alt.keywords.some(keyword => 
          keywords.includes(keyword.toLowerCase())
        )
      );
    }
    
    // If we still don't have matches, return the top rated alternatives as a fallback
    if (matchingAlternatives.length === 0) {
      matchingAlternatives = allAlternatives
        .sort((a, b) => b.ecoScore - a.ecoScore)
        .slice(0, 5);
    }
    
    // Sort alternatives by eco score (highest first)
    matchingAlternatives = matchingAlternatives
      .sort((a, b) => b.ecoScore - a.ecoScore)
      .slice(0, 10); // Limit to top 10
      
    // Add relevance score based on how well it matches the product
    matchingAlternatives = matchingAlternatives.map(alt => {
      let relevanceScore = 0;
      
      // Increase relevance if category matches
      if (productInfo.category && alt.replaces.some(cat => 
        productInfo.category.toLowerCase().includes(cat.toLowerCase())
      )) {
        relevanceScore += 3;
      }
      
      // Increase relevance if keywords match
      if (productInfo.title) {
        const productWords = productInfo.title.toLowerCase().split(' ');
        const matchingKeywords = alt.keywords.filter(keyword => 
          productWords.includes(keyword.toLowerCase())
        );
        relevanceScore += matchingKeywords.length;
      }
      
      return { ...alt, relevanceScore };
    });
    
    // Final sort by relevance, then eco score
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

// Fetch detailed information about a specific alternative product
export async function fetchAlternativeDetails(alternativeId) {
  try {
    // In a real-world scenario, this would call an API to get product details
    // For this example, we'll use our local data
    
    // Get alternatives data from our local JSON
    const allAlternatives = await loadAlternativesData();
    
    // Find the specific alternative
    const alternative = allAlternatives.find(alt => alt.id === alternativeId);
    
    if (!alternative) {
      throw new Error('Alternative product not found');
    }
    
    // In a real implementation, we would fetch additional details here
    return alternative;
  } catch (error) {
    console.error('Error fetching alternative details:', error);
    throw error;
  }
}