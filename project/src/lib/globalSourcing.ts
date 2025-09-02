// Global Product Sourcing and Distribution System
import { SupportedCurrency } from './stripe';

// Zapier Integration Types
export interface AutomationTrigger {
  id: string;
  name: string;
  description: string;
  webhookUrl: string;
  triggerConditions: {
    inventoryThreshold?: number;
    priceChange?: number;
    demandIncrease?: number;
    seasonalTrend?: string;
    stockLevel?: 'low' | 'medium' | 'high';
    regionDemand?: string[];
  };
  zapierWorkflow: {
    workflowId: string;
    workflowName: string;
    lastTriggered?: Date;
    successRate: number;
    actions: ZapierAction[];
  };
}

export interface ZapierAction {
  actionType: 'reorder' | 'price_update' | 'inventory_alert' | 'supplier_notify' | 'affiliate_update';
  targetRegion: string;
  parameters: {
    [key: string]: any;
  };
}

export interface SourcingResult {
  optimalSource: ProductSource;
  estimatedCost: number;
  savings: number;
  riskLevel: 'low' | 'medium' | 'high';
  leadTime: number;
  certifications: string[];
  alternativeSources: ProductSource[];
  automationTriggers: AutomationTrigger[];
  zapierIntegration: {
    isEnabled: boolean;
    webhookUrl?: string;
    automatedReordering: boolean;
    priceMonitoring: boolean;
    inventorySync: boolean;
  };
}

// Product sourcing configuration
export interface ProductSource {
  sourceCountry: string;
  sourceRegion: string;
  warehouseLocation: string;
  supplierId: string;
  supplierName: string;
  leadTime: number; // days
  minimumOrderQuantity: number;
  shippingCost: number;
  tariffRate: number;
  taxRate: number;
  certifications: string[];
  qualityGrade: 'A' | 'B' | 'C';
}

export interface GlobalProduct {
  id: string;
  baseProductId: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  baseCurrency: SupportedCurrency;
  
  // Multi-sourcing configuration
  sources: ProductSource[];
  
  // Market availability
  availableMarkets: string[];
  restrictedMarkets: string[];
  
  // Localization
  localizations: {
    [countryCode: string]: {
      localName: string;
      localDescription: string;
      localPrice: number;
      localCurrency: SupportedCurrency;
      complianceCertifications: string[];
      marketingImages: string[];
      localSupplier: ProductSource;
    }
  };
  
  // Logistics
  shippingMethods: {
    [targetCountry: string]: {
      domestic: ShippingMethod[];
      international: ShippingMethod[];
      recommended: string;
    }
  };
}

export interface ShippingMethod {
  provider: string;
  method: string;
  estimatedDays: string;
  cost: number;
  trackingIncluded: boolean;
  insuranceIncluded: boolean;
  signatureRequired: boolean;
}

// Global sourcing strategies
export const sourcingStrategies = {
  // Electronics: Source from multiple tech hubs
  electronics: {
    primarySources: ['CN', 'KR', 'JP', 'TW'],
    fallbackSources: ['US', 'DE'],
    qualityTiers: {
      premium: ['JP', 'KR', 'DE'],
      standard: ['CN', 'TW'],
      budget: ['CN', 'IN']
    }
  },
  
  // Fashion: Source from manufacturing centers
  fashion: {
    primarySources: ['BD', 'VN', 'TR', 'IT'],
    fallbackSources: ['PT', 'MX'],
    qualityTiers: {
      luxury: ['IT', 'FR'],
      standard: ['TR', 'VN'],
      budget: ['BD', 'IN']
    }
  },
  
  // Home & Garden: Regional sourcing to avoid shipping costs
  homeGarden: {
    primarySources: ['CN', 'VN', 'PL'],
    fallbackSources: ['MX', 'TR'],
    qualityTiers: {
      premium: ['DE', 'IT'],
      standard: ['PL', 'CZ'],
      budget: ['CN', 'VN']
    }
  },
  
  // Food & Supplements: Local sourcing required
  foodSupplements: {
    regionalSourcing: {
      'North America': ['US', 'CA'],
      'Europe': ['DE', 'NL', 'FR'],
      'Asia Pacific': ['AU', 'NZ', 'JP'],
      'Latin America': ['BR', 'AR']
    }
  }
};

// Tariff optimization matrix
export const tariffOptimization = {
  // US market sourcing preferences to minimize tariffs
  'US': {
    preferredSources: ['MX', 'CA', 'US'], // USMCA benefits
    avoidSources: ['CN'], // High tariffs
    freeTradePartners: ['MX', 'CA', 'SG', 'AU'],
    dutyRates: {
      'CN': 25, // High tariff example
      'MX': 0,  // USMCA
      'EU': 2.5, // Most favored nation
      'IN': 5
    }
  },
  
  // EU market sourcing preferences
  'EU': {
    preferredSources: ['DE', 'FR', 'IT', 'ES', 'PL'], // EU internal market
    freeTradePartners: ['CH', 'NO', 'UK'],
    dutyRates: {
      'CN': 12,
      'US': 6,
      'TR': 0, // Customs union
      'CH': 0  // Free trade
    }
  },
  
  // Asia Pacific sourcing
  'APAC': {
    preferredSources: ['CN', 'JP', 'KR', 'SG', 'VN'],
    freeTradePartners: ['SG', 'MY', 'TH', 'VN'],
    regionalBlocs: ['ASEAN', 'CPTPP'],
    dutyRates: {
      'US': 8,
      'EU': 10,
      'ASEAN': 0,
      'CN': 3
    }
  }
};

// Logistics optimization
export const getOptimalSourceForTarget = (
  productCategory: string, 
  targetCountry: string, 
  qualityTier: 'premium' | 'standard' | 'budget'
): ProductSource | null => {
  
  const strategy = sourcingStrategies[productCategory as keyof typeof sourcingStrategies];
  if (!strategy) return null;

  // Get quality-appropriate sources
  let possibleSources: string[] = [];
  
  if ('qualityTiers' in strategy) {
    const qualityTiers = strategy.qualityTiers as any;
    possibleSources = qualityTiers[qualityTier] || strategy.primarySources;
  } else if ('regionalSourcing' in strategy) {
    // For food/supplements, must source regionally
    const targetRegion = getRegionForCountry(targetCountry);
    const regionalSourcing = strategy.regionalSourcing as any;
    possibleSources = regionalSourcing[targetRegion] || [];
  }

  // Apply tariff optimization
  const tariffConfig = tariffOptimization[getRegionForCountry(targetCountry) as keyof typeof tariffOptimization];
  if (tariffConfig) {
    // Prefer sources with lower tariffs
    possibleSources = possibleSources.sort((a, b) => {
      const tariffA = tariffConfig.dutyRates[a as keyof typeof tariffConfig.dutyRates] || 15;
      const tariffB = tariffConfig.dutyRates[b as keyof typeof tariffConfig.dutyRates] || 15;
      return tariffA - tariffB;
    });
  }

  // Return the optimal source (simplified)
  const optimalSourceCountry = possibleSources[0];
  if (!optimalSourceCountry) return null;

  return {
    sourceCountry: optimalSourceCountry,
    sourceRegion: getRegionForCountry(optimalSourceCountry),
    warehouseLocation: `${optimalSourceCountry}-WH-01`,
    supplierId: `SUP-${optimalSourceCountry}-001`,
    supplierName: `Premium Supplier ${optimalSourceCountry}`,
    leadTime: calculateLeadTime(optimalSourceCountry, targetCountry),
    minimumOrderQuantity: qualityTier === 'premium' ? 1 : 10,
    shippingCost: calculateShippingCost(optimalSourceCountry, targetCountry),
    tariffRate: tariffConfig?.dutyRates[optimalSourceCountry as keyof typeof tariffConfig.dutyRates] || 0,
    taxRate: getLocalTaxRate(targetCountry),
    certifications: getRequiredCertifications(productCategory, targetCountry),
    qualityGrade: qualityTier === 'premium' ? 'A' : qualityTier === 'standard' ? 'B' : 'C'
  };
};

// Helper functions
const getRegionForCountry = (countryCode: string): string => {
  const regionMap: { [key: string]: string } = {
    'US': 'North America', 'CA': 'North America', 'MX': 'North America',
    'DE': 'Europe', 'FR': 'Europe', 'IT': 'Europe', 'ES': 'Europe', 'UK': 'Europe',
    'CN': 'APAC', 'JP': 'APAC', 'KR': 'APAC', 'SG': 'APAC', 'AU': 'APAC',
    'BR': 'Latin America', 'AR': 'Latin America', 'CL': 'Latin America'
  };
  return regionMap[countryCode] || 'Other';
};

const calculateLeadTime = (sourceCountry: string, targetCountry: string): number => {
  if (sourceCountry === targetCountry) return 1; // Local sourcing
  
  const region1 = getRegionForCountry(sourceCountry);
  const region2 = getRegionForCountry(targetCountry);
  
  if (region1 === region2) return 3; // Same region
  return 7; // Cross-region
};

const calculateShippingCost = (sourceCountry: string, targetCountry: string): number => {
  if (sourceCountry === targetCountry) return 5; // Local shipping
  
  const region1 = getRegionForCountry(sourceCountry);
  const region2 = getRegionForCountry(targetCountry);
  
  if (region1 === region2) return 15; // Regional shipping
  return 35; // International shipping
};

const getLocalTaxRate = (countryCode: string): number => {
  const taxRates: { [key: string]: number } = {
    'US': 8.25, 'CA': 13, 'MX': 16,
    'DE': 19, 'FR': 20, 'IT': 22, 'ES': 21, 'UK': 20,
    'JP': 10, 'CN': 13, 'KR': 10, 'SG': 7, 'AU': 10,
    'BR': 17, 'AR': 21, 'CL': 19
  };
  return taxRates[countryCode] || 10;
};

const getRequiredCertifications = (category: string, targetCountry: string): string[] => {
  const certifications: { [key: string]: { [key: string]: string[] } } = {
    electronics: {
      'US': ['FCC', 'UL'],
      'EU': ['CE', 'RoHS'],
      'JP': ['PSE', 'VCCI'],
      'CN': ['CCC', '3C']
    },
    fashion: {
      'US': ['CPSIA'],
      'EU': ['REACH', 'Oeko-Tex'],
      'JP': ['JIS'],
      'CN': ['GB']
    },
    foodSupplements: {
      'US': ['FDA', 'USDA'],
      'EU': ['EU Organic', 'EFSA'],
      'JP': ['JAS', 'MHLW'],
      'CN': ['CFDA']
    }
  };
  
  return certifications[category]?.[targetCountry] || [];
};

// Zapier Integration Functions
export const createAutomationTrigger = (
  productId: string,
  targetRegion: string,
  triggerType: 'inventory' | 'pricing' | 'demand' | 'seasonal'
): AutomationTrigger => {
  const baseWebhookUrl = 'https://hooks.zapier.com/hooks/catch/';
  
  const triggers: { [key: string]: Partial<AutomationTrigger> } = {
    inventory: {
      name: `Inventory Monitor - ${targetRegion}`,
      description: `Auto-reorder when inventory drops below threshold in ${targetRegion}`,
      triggerConditions: {
        inventoryThreshold: 50,
        stockLevel: 'low'
      },
      zapierWorkflow: {
        workflowId: `workflow_inventory_${Date.now()}`,
        workflowName: 'Auto Reorder Workflow',
        successRate: 98,
        actions: [
          {
            actionType: 'reorder',
            targetRegion,
            parameters: {
              quantity: 100,
              priority: 'high',
              supplier: 'preferred'
            }
          },
          {
            actionType: 'supplier_notify',
            targetRegion,
            parameters: {
              urgency: 'medium',
              expectedDelivery: '7-10 days'
            }
          }
        ]
      }
    },
    pricing: {
      name: `Price Monitor - ${targetRegion}`,
      description: `Auto-adjust pricing based on market conditions in ${targetRegion}`,
      triggerConditions: {
        priceChange: 10 // 10% change threshold
      },
      zapierWorkflow: {
        workflowId: `workflow_pricing_${Date.now()}`,
        workflowName: 'Dynamic Pricing Workflow',
        successRate: 95,
        actions: [
          {
            actionType: 'price_update',
            targetRegion,
            parameters: {
              adjustmentType: 'competitive',
              maxIncrease: 15,
              maxDecrease: 20
            }
          },
          {
            actionType: 'affiliate_update',
            targetRegion,
            parameters: {
              notifyPriceChange: true,
              updateCommission: true
            }
          }
        ]
      }
    },
    demand: {
      name: `Demand Surge - ${targetRegion}`,
      description: `Scale up sourcing when demand increases in ${targetRegion}`,
      triggerConditions: {
        demandIncrease: 50, // 50% increase
        regionDemand: [targetRegion]
      },
      zapierWorkflow: {
        workflowId: `workflow_demand_${Date.now()}`,
        workflowName: 'Demand Response Workflow',
        successRate: 92,
        actions: [
          {
            actionType: 'reorder',
            targetRegion,
            parameters: {
              quantity: 200,
              expedited: true,
              multipleSuppliers: true
            }
          },
          {
            actionType: 'inventory_alert',
            targetRegion,
            parameters: {
              alertType: 'demand_surge',
              recommendedAction: 'scale_up'
            }
          }
        ]
      }
    },
    seasonal: {
      name: `Seasonal Prep - ${targetRegion}`,
      description: `Prepare inventory for seasonal trends in ${targetRegion}`,
      triggerConditions: {
        seasonalTrend: 'upcoming_season'
      },
      zapierWorkflow: {
        workflowId: `workflow_seasonal_${Date.now()}`,
        workflowName: 'Seasonal Preparation Workflow',
        successRate: 89,
        actions: [
          {
            actionType: 'reorder',
            targetRegion,
            parameters: {
              quantity: 150,
              advanceOrder: true,
              seasonalProducts: true
            }
          }
        ]
      }
    }
  };

  const trigger = triggers[triggerType];
  if (!trigger) throw new Error(`Invalid trigger type: ${triggerType}`);

  return {
    id: `trigger_${productId}_${targetRegion}_${triggerType}_${Date.now()}`,
    webhookUrl: `${baseWebhookUrl}${Math.random().toString(36).substr(2, 9)}/`,
    zapierWorkflow: {
      lastTriggered: undefined,
      ...trigger.zapierWorkflow!
    },
    ...trigger
  } as AutomationTrigger;
};

export const triggerZapierWebhook = async (
  webhookUrl: string,
  payload: {
    productId: string;
    targetRegion: string;
    triggerType: string;
    data: any;
  }
): Promise<boolean> => {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...payload
      })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Zapier webhook trigger failed:', error);
    return false;
  }
};

export const getSourceWithAutomation = (
  productCategory: string,
  targetCountry: string,
  qualityTier: 'premium' | 'standard' | 'budget',
  enableZapier: boolean = true
): SourcingResult => {
  const optimalSource = getOptimalSourceForTarget(productCategory, targetCountry, qualityTier);
  
  if (!optimalSource) {
    throw new Error(`No suitable source found for ${productCategory} in ${targetCountry}`);
  }

  // Calculate costs and savings
  const baseCost = 100; // Base product cost
  const totalCost = baseCost + optimalSource.shippingCost + (baseCost * optimalSource.tariffRate / 100);
  const directImportCost = baseCost + 50 + (baseCost * 0.25); // Estimated direct import cost
  const savings = Math.max(0, directImportCost - totalCost);

  // Create automation triggers if Zapier is enabled
  const automationTriggers: AutomationTrigger[] = [];
  if (enableZapier) {
    const productId = `prod_${productCategory}_${Date.now()}`;
    
    automationTriggers.push(
      createAutomationTrigger(productId, targetCountry, 'inventory'),
      createAutomationTrigger(productId, targetCountry, 'pricing'),
      createAutomationTrigger(productId, targetCountry, 'demand')
    );
  }

  return {
    optimalSource,
    estimatedCost: totalCost,
    savings,
    riskLevel: optimalSource.leadTime > 10 ? 'high' : optimalSource.leadTime > 5 ? 'medium' : 'low',
    leadTime: optimalSource.leadTime,
    certifications: optimalSource.certifications,
    alternativeSources: [], // Could be populated with alternative sources
    automationTriggers,
    zapierIntegration: {
      isEnabled: enableZapier,
      webhookUrl: enableZapier ? automationTriggers[0]?.webhookUrl : undefined,
      automatedReordering: enableZapier,
      priceMonitoring: enableZapier,
      inventorySync: enableZapier
    }
  };
};

export default {
  sourcingStrategies,
  tariffOptimization,
  getOptimalSourceForTarget,
  getSourceWithAutomation,
  createAutomationTrigger,
  triggerZapierWebhook
};
