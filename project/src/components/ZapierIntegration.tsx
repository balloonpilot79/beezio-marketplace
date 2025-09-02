import React, { useState, useEffect } from 'react';
import { AutomationTrigger, createAutomationTrigger, triggerZapierWebhook } from '../lib/globalSourcing';

interface ZapierIntegrationProps {
  productId: string;
  targetRegions: string[];
  onTriggersUpdated?: (triggers: AutomationTrigger[]) => void;
}

export const ZapierIntegration: React.FC<ZapierIntegrationProps> = ({
  productId,
  targetRegions,
  onTriggersUpdated
}) => {
  const [triggers, setTriggers] = useState<AutomationTrigger[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedTriggerTypes, setSelectedTriggerTypes] = useState<{
    [region: string]: string[];
  }>({});

  const triggerTypes = [
    { id: 'inventory', name: 'Inventory Management', icon: '📦', description: 'Auto-reorder when stock is low' },
    { id: 'pricing', name: 'Dynamic Pricing', icon: '💰', description: 'Adjust prices based on market conditions' },
    { id: 'demand', name: 'Demand Response', icon: '📈', description: 'Scale up when demand surges' },
    { id: 'seasonal', name: 'Seasonal Prep', icon: '🗓️', description: 'Prepare for seasonal trends' }
  ];

  useEffect(() => {
    // Load existing triggers from localStorage or API
    const savedTriggers = localStorage.getItem(`zapier_triggers_${productId}`);
    if (savedTriggers) {
      setTriggers(JSON.parse(savedTriggers));
    }
  }, [productId]);

  const handleConnect = () => {
    if (webhookUrl) {
      setIsConnected(true);
      localStorage.setItem(`zapier_webhook_${productId}`, webhookUrl);
    }
  };

  const handleCreateTrigger = (region: string, triggerType: string) => {
    try {
      const newTrigger = createAutomationTrigger(
        productId,
        region,
        triggerType as 'inventory' | 'pricing' | 'demand' | 'seasonal'
      );

      const updatedTriggers = [...triggers, newTrigger];
      setTriggers(updatedTriggers);
      
      // Save to localStorage
      localStorage.setItem(`zapier_triggers_${productId}`, JSON.stringify(updatedTriggers));
      
      // Notify parent component
      onTriggersUpdated?.(updatedTriggers);
    } catch (error) {
      console.error('Failed to create trigger:', error);
    }
  };

  const handleTestTrigger = async (trigger: AutomationTrigger) => {
    const success = await triggerZapierWebhook(trigger.webhookUrl, {
      productId,
      targetRegion: trigger.zapierWorkflow.actions[0]?.targetRegion || 'US',
      triggerType: 'test',
      data: {
        testMessage: 'This is a test trigger from Beezio',
        timestamp: new Date().toISOString()
      }
    });

    if (success) {
      alert('Test trigger sent successfully! Check your Zapier dashboard.');
    } else {
      alert('Test trigger failed. Please check your webhook URL.');
    }
  };

  const handleToggleTriggerType = (region: string, triggerType: string) => {
    setSelectedTriggerTypes(prev => {
      const regionTriggers = prev[region] || [];
      const isSelected = regionTriggers.includes(triggerType);
      
      return {
        ...prev,
        [region]: isSelected 
          ? regionTriggers.filter(t => t !== triggerType)
          : [...regionTriggers, triggerType]
      };
    });
  };

  const handleActivateSelected = () => {
    Object.entries(selectedTriggerTypes).forEach(([region, triggerTypes]) => {
      triggerTypes.forEach(triggerType => {
        handleCreateTrigger(region, triggerType);
      });
    });
    
    // Clear selection
    setSelectedTriggerTypes({});
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <span className="text-orange-600 font-bold text-sm">⚡</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Zapier Integration</h3>
            <p className="text-sm text-gray-600">Automate your global sourcing workflow</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-300'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {!isConnected ? (
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-blue-900 mb-2">Connect to Zapier</h4>
          <p className="text-sm text-blue-700 mb-4">
            Enter your Zapier webhook URL to start automating your global sourcing operations.
          </p>
          
          <div className="flex space-x-3">
            <input
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="flex-1 px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleConnect}
              disabled={!webhookUrl}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Connect
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Automation Setup */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-4">Setup Automation Triggers</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {triggerTypes.map(triggerType => (
                <div key={triggerType.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className="text-2xl">{triggerType.icon}</span>
                    <div>
                      <h5 className="font-medium text-gray-900">{triggerType.name}</h5>
                      <p className="text-sm text-gray-600">{triggerType.description}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {targetRegions.map(region => (
                      <label key={`${triggerType.id}-${region}`} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={(selectedTriggerTypes[region] || []).includes(triggerType.id)}
                          onChange={() => handleToggleTriggerType(region, triggerType.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">{region}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleActivateSelected}
              disabled={Object.values(selectedTriggerTypes).flat().length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Activate Selected Triggers
            </button>
          </div>

          {/* Active Triggers */}
          {triggers.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Active Automation Triggers</h4>
              
              <div className="space-y-3">
                {triggers.map(trigger => (
                  <div key={trigger.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h5 className="font-medium text-gray-900">{trigger.name}</h5>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          trigger.zapierWorkflow.successRate > 95 ? 'bg-green-100 text-green-800' :
                          trigger.zapierWorkflow.successRate > 90 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {trigger.zapierWorkflow.successRate}% success
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{trigger.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Workflow: {trigger.zapierWorkflow.workflowName}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleTestTrigger(trigger)}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => {
                          const updatedTriggers = triggers.filter(t => t.id !== trigger.id);
                          setTriggers(updatedTriggers);
                          localStorage.setItem(`zapier_triggers_${productId}`, JSON.stringify(updatedTriggers));
                          onTriggersUpdated?.(updatedTriggers);
                        }}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Zapier Setup Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h5 className="font-medium text-gray-900 mb-2">🚀 Zapier Setup Instructions</h5>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Create a new Zap in your Zapier dashboard</li>
          <li>Choose "Webhooks by Zapier" as the trigger app</li>
          <li>Select "Catch Hook" as the trigger event</li>
          <li>Copy the webhook URL and paste it above</li>
          <li>Set up actions like:
            <ul className="ml-4 mt-1 list-disc list-inside text-xs">
              <li>Send emails via Gmail/Outlook</li>
              <li>Update inventory in Shopify/WooCommerce</li>
              <li>Create tasks in Asana/Trello</li>
              <li>Send Slack notifications</li>
              <li>Update Google Sheets</li>
            </ul>
          </li>
        </ol>
      </div>
    </div>
  );
};
