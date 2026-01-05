import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Heart, Users, MapPin } from 'lucide-react';
import { getRandomFundraisers, SampleFundraiser } from '../data/sampleFundraisers';
import { isFundraiserSampleDataEnabled } from '../config/sampleDataConfig';

const FundraiserSlider: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fundraisers, setFundraisers] = useState<SampleFundraiser[]>([]);
  const itemsPerView = 3;

  useEffect(() => {
    // Load sample fundraisers if enabled
    const sampleFundraisers = getRandomFundraisers(9); // Get 9 random fundraisers
    setFundraisers(sampleFundraisers);
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => 
      prev + itemsPerView >= fundraisers.length ? 0 : prev + 1
    );
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? Math.max(0, fundraisers.length - itemsPerView) : prev - 1
    );
  };

  useEffect(() => {
    if (fundraisers.length === 0) return;
    
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [fundraisers.length]);

  // Don't render if sample data is disabled or no fundraisers
  if (!isFundraiserSampleDataEnabled() || fundraisers.length === 0) {
    return null;
  }

  const visibleFundraisers = fundraisers.slice(currentIndex, currentIndex + itemsPerView);
  if (visibleFundraisers.length < itemsPerView && fundraisers.length >= itemsPerView) {
    visibleFundraisers.push(...fundraisers.slice(0, itemsPerView - visibleFundraisers.length));
  }

  const getProgressPercentage = (raised: number, goal: number) => {
    return Math.min((raised / goal) * 100, 100);
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Community Fundraisers</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Support meaningful causes and make a difference in communities worldwide
          </p>
        </div>

        <div className="relative">
          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-105"
          >
            <ChevronRight className="w-6 h-6 text-gray-600" />
          </button>

          {/* Fundraisers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mx-12">
            {visibleFundraisers.map((fundraiser, index) => (
              <div
                key={`${fundraiser.id}-${index}`}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={fundraiser.image}
                    alt={fundraiser.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.src = '/api/placeholder/300/200';
                    }}
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-green-500 text-white px-2 py-1 rounded-full text-sm font-medium">
                      {fundraiser.category}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm font-medium">
                      {fundraiser.daysLeft} days left
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs flex items-center justify-between">
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {fundraiser.location}
                      </span>
                      <span>by {fundraiser.creator}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-2 group-hover:text-green-600 transition-colors line-clamp-2">
                    {fundraiser.title}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {fundraiser.description}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        ${fundraiser.raised.toLocaleString()} raised
                      </span>
                      <span className="text-sm text-gray-500">
                        ${fundraiser.goal.toLocaleString()} goal
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${getProgressPercentage(fundraiser.raised, fundraiser.goal)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{fundraiser.supporters.toLocaleString()} supporters</span>
                      </div>
                      <span>{Math.round(getProgressPercentage(fundraiser.raised, fundraiser.goal))}% funded</span>
                    </div>
                  </div>
                  
                  <button className="w-full bg-gradient-to-r from-green-500 to-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:from-green-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2">
                    <Heart className="w-4 h-4" />
                    Support This Cause
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots Indicator */}
        <div className="flex justify-center mt-8 space-x-2">
          {Array.from({ length: Math.ceil(fundraisers.length / itemsPerView) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * itemsPerView)}
              className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                Math.floor(currentIndex / itemsPerView) === index
                  ? 'bg-green-500'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FundraiserSlider;