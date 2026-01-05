import React, { useEffect, useState } from 'react';
import { X, Star, Gift } from 'lucide-react';
import BadgeDisplay from './BadgeDisplay';

interface BadgeNotificationProps {
  badge: {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    points_reward: number;
  };
  onClose: () => void;
  show: boolean;
}

export const BadgeNotification: React.FC<BadgeNotificationProps> = ({ 
  badge, 
  onClose, 
  show 
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  if (!show) return null;

  return (
    <div className={`
      fixed top-4 right-4 z-50 
      transform transition-all duration-300 ease-in-out
      ${visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
    `}>
      <div className="bg-white rounded-lg shadow-xl border-l-4 border-amber-500 p-6 max-w-sm">
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-4">
            <BadgeDisplay 
              badge={badge} 
              size="lg" 
              showTooltip={false} 
              isEarned={true} 
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                <Star className="w-5 h-5 text-amber-500 mr-2" />
                Badge Earned!
              </h4>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h5 className="font-medium text-gray-900 mb-1">{badge.name}</h5>
            <p className="text-sm text-gray-600 mb-3">{badge.description}</p>
            
            <div className="flex items-center justify-between">
              <span className={`
                inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${badge.tier === 'bronze' ? 'bg-amber-100 text-amber-800' :
                  badge.tier === 'silver' ? 'bg-gray-100 text-gray-800' :
                  badge.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                  badge.tier === 'platinum' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'}
              `}>
                {badge.tier.toUpperCase()} TIER
              </span>
              
              <div className="flex items-center text-sm text-green-600 font-medium">
                <Gift className="w-4 h-4 mr-1" />
                +{badge.points_reward} points
              </div>
            </div>
          </div>
        </div>
        
        {/* Celebration animation */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`
                absolute w-2 h-2 bg-amber-400 rounded-full
                animate-ping opacity-75
              `}
              style={{
                left: `${20 + (i * 12)}%`,
                top: `${10 + (i % 2) * 20}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BadgeNotification;
