import React from 'react';
import { 
  Trophy, Award, Medal, Crown, Gem, Star, DollarSign, Banknote, 
  PiggyBank, Wallet, CreditCard, Diamond, Users, UserPlus, 
  Flame, Zap, Eye, TrendingUp, Globe, Share, Share2, Megaphone
} from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  earned_at?: string;
  progress_value?: number;
  requirement_value?: number;
}

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  isEarned?: boolean;
}

const iconMap = {
  Trophy, Award, Medal, Crown, Gem, Star, DollarSign, Banknote,
  PiggyBank, Wallet, CreditCard, Diamond, Users, UserPlus,
  Flame, Zap, Eye, TrendingUp, Globe, Share, Share2, Megaphone,
  // Map database icon names to actual lucide icons
  Fire: Flame  // Database uses 'Fire' but lucide-react has 'Flame'
};

const tierColors = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-400 to-gray-600', 
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-yellow-400 to-yellow-600',
  diamond: 'from-blue-400 to-blue-600'
};

const tierBorders = {
  bronze: 'border-amber-500',
  silver: 'border-gray-400',
  gold: 'border-yellow-400', 
  platinum: 'border-yellow-400',
  diamond: 'border-blue-400'
};

export const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ 
  badge, 
  size = 'md', 
  showTooltip = true,
  isEarned = false 
}) => {
  const IconComponent = iconMap[badge.icon as keyof typeof iconMap] || Trophy;
  
  const sizeClasses = {
    sm: 'w-8 h-8 p-1',
    md: 'w-12 h-12 p-2',
    lg: 'w-16 h-16 p-3'
  };
  
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div className="relative group">
      <div className={`
        ${sizeClasses[size]} 
        rounded-full 
        ${isEarned ? `bg-gradient-to-br ${tierColors[badge.tier]} ${tierBorders[badge.tier]} border-2` : 'bg-gray-200 border-2 border-gray-300'}
        flex items-center justify-center
        ${isEarned ? 'shadow-lg' : 'opacity-50'}
        transition-all duration-200 hover:scale-110
      `}>
        <IconComponent 
          className={`${iconSizes[size]} ${isEarned ? 'text-white' : 'text-gray-400'}`} 
        />
      </div>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
          <div className="font-semibold text-center mb-1">{badge.name}</div>
          <div className="text-gray-300 text-xs text-center mb-2">{badge.description}</div>
          
          {isEarned ? (
            <div className="text-center">
              <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                badge.tier === 'bronze' ? 'bg-amber-600' :
                badge.tier === 'silver' ? 'bg-gray-400' :
                badge.tier === 'gold' ? 'bg-yellow-400 text-black' :
                badge.tier === 'platinum' ? 'bg-yellow-400' :
                'bg-blue-400'
              }`}>
                {badge.tier.toUpperCase()}
              </span>
              {badge.earned_at && (
                <div className="text-xs text-gray-400 mt-1">
                  Earned {new Date(badge.earned_at).toLocaleDateString()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-xs text-gray-400">
                Progress: {badge.progress_value || 0} / {badge.requirement_value || 0}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div 
                  className={`h-2 rounded-full bg-gradient-to-r ${tierColors[badge.tier]}`}
                  style={{ 
                    width: `${Math.min(100, ((badge.progress_value || 0) / (badge.requirement_value || 1)) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

export default BadgeDisplay;
