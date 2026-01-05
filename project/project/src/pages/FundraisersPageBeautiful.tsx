import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, Users, Target, Clock, TrendingUp, Filter } from 'lucide-react';
import { SAMPLE_FUNDRAISERS } from '../lib/sampleFundraisers';

const FundraisersPageBeautiful = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const categories = [
    { id: 'all', name: 'All Causes' },
    { id: 'humanitarian', name: 'Humanitarian' },
    { id: 'animal-welfare', name: 'Animal Welfare' },
    { id: 'education', name: 'Education' },
    { id: 'health', name: 'Health' },
    { id: 'environment', name: 'Environment' },
    { id: 'disaster-relief', name: 'Disaster Relief' }
  ];

  // Use sample data safely
  const fundraisers = SAMPLE_FUNDRAISERS || [];

  // Filter and sort fundraisers
  const filteredFundraisers = fundraisers
    .filter(fundraiser => {
      const matchesSearch = fundraiser.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           fundraiser.story.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || fundraiser.category === selectedCategory;
      return matchesSearch && matchesCategory && fundraiser.is_active;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'progress':
          const progressA = (a.raised_amount / a.goal_amount) * 100;
          const progressB = (b.raised_amount / b.goal_amount) * 100;
          return progressB - progressA;
        case 'goal':
          return b.goal_amount - a.goal_amount;
        case 'raised':
          return b.raised_amount - a.raised_amount;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const getProgressPercentage = (raised: number, goal: number) => {
    return Math.min((raised / goal) * 100, 100);
  };

  const getDaysLeft = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Beautiful Hero Section */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Support Meaningful <span className="text-amber-600">Causes</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Make a difference with every purchase. Discover fundraisers that matter and help create positive change in the world.
            </p>
          </div>

          {/* Enhanced Search Bar */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search fundraisers by cause, organization, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-14 pr-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white shadow-lg"
              />
              <div className="absolute inset-y-0 right-0 pr-6 flex items-center">
                <button className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition-colors font-semibold">
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Impact Stats */}
          <div className="grid md:grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">$485K+</div>
              <div className="text-gray-600">Total Raised</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{fundraisers.length}</div>
              <div className="text-gray-600">Active Causes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">12K+</div>
              <div className="text-gray-600">Supporters</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Category Bar */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Category Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === category.id
                      ? 'bg-amber-100 text-amber-800 shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center space-x-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="newest">Newest First</option>
                <option value="progress">Most Progress</option>
                <option value="goal">Highest Goal</option>
                <option value="raised">Most Raised</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCategory === 'all' ? 'All Fundraisers' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
            <p className="text-gray-600 mt-1">
              {filteredFundraisers.length} active {filteredFundraisers.length === 1 ? 'fundraiser' : 'fundraisers'}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        </div>
      </div>

      {/* Fundraisers Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {filteredFundraisers.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">No fundraisers found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors font-medium"
            >
              View All Fundraisers
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredFundraisers.map((fundraiser) => {
              const progress = getProgressPercentage(fundraiser.raised_amount, fundraiser.goal_amount);
              const daysLeft = getDaysLeft(fundraiser.end_date);
              
              return (
                <div
                  key={fundraiser.id}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
                >
                  <div className="relative">
                    <img
                      src={fundraiser.image_url}
                      alt={fundraiser.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        {Math.round(progress)}% Funded
                      </span>
                    </div>
                    {daysLeft > 0 && daysLeft <= 30 && (
                      <div className="absolute top-4 right-4">
                        <span className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{daysLeft}d left</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors line-clamp-2">
                        <Link to={`/fundraiser/${fundraiser.id}`} className="hover:underline">
                          {fundraiser.title}
                        </Link>
                      </h3>
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {fundraiser.story}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm font-bold text-green-600">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          ${fundraiser.raised_amount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Raised</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          ${fundraiser.goal_amount.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Goal</div>
                      </div>
                    </div>

                    {/* Creator & Action */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {fundraiser.creator_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{fundraiser.creator_name}</div>
                          <div className="text-xs text-gray-600 capitalize">{fundraiser.category.replace('-', ' ')}</div>
                        </div>
                      </div>
                      <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Heart className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <Link
                        to={`/fundraiser/${fundraiser.id}`}
                        className="flex-1 bg-amber-600 text-white text-center py-3 px-4 rounded-lg hover:bg-amber-700 transition-colors font-semibold"
                      >
                        Learn More
                      </Link>
                      <button className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold">
                        Donate Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundraisersPageBeautiful;
