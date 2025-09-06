import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useNavigate } from 'react-router-dom';
import { Search, Grid, List, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SAMPLE_FUNDRAISERS, FUNDRAISER_CATEGORIES } from '../lib/sampleFundraisers';

interface Cause {
  id: string;
  title: string;
  story: string;
  goal_amount: number;
  raised_amount: number;
  image_url: string;
  creator_id: string;
  creator_name: string;
  created_at: string;
  end_date: string;
  category: string;
  is_active: boolean;
}

const FundraisersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [causes, setCauses] = useState<Cause[]>(SAMPLE_FUNDRAISERS);
  const [filteredCauses, setFilteredCauses] = useState<Cause[]>(SAMPLE_FUNDRAISERS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCauses();
  }, []);

  useEffect(() => {
    filterAndSortCauses();
  }, [causes, searchTerm, selectedCategory, sortBy]);

  const fetchCauses = async () => {
    setLoading(true);
    try {
      // Set a timeout for the database query
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 5000);
      });

      const queryPromise = supabase
        .from('causes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (error) throw error;
      
      // If database has data, use it; otherwise keep sample data
      if (data && data.length > 0) {
        console.log('Loaded fundraisers from database:', data.length);
        setCauses(data);
      } else {
        console.log('No database data, using sample fundraisers:', SAMPLE_FUNDRAISERS.length);
      }
    } catch (error) {
      console.error('Error fetching causes, using sample data:', error);
      // Ensure we're using sample data if database fails
      setCauses(SAMPLE_FUNDRAISERS);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCauses = () => {
    let filtered = causes.filter(cause => {
      const matchesSearch = cause.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          cause.story.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          cause.creator_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || cause.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });

    // Sort causes
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'goal_amount':
          return b.goal_amount - a.goal_amount;
        case 'raised_amount':
          return b.raised_amount - a.raised_amount;
        case 'progress':
          const progressA = (a.raised_amount / a.goal_amount) * 100;
          const progressB = (b.raised_amount / b.goal_amount) * 100;
          return progressB - progressA;
        case 'end_date':
          return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredCauses(filtered);
  };

  const calculateProgress = (raised: number, goal: number) => {
    return Math.min(100, (raised / goal) * 100);
  };

  const formatTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Ended';
    if (days === 0) return 'Last day';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  const FundraiserCard: React.FC<{ cause: Cause }> = ({ cause }) => {
    const progress = calculateProgress(cause.raised_amount, cause.goal_amount);
    const timeRemaining = formatTimeRemaining(cause.end_date);
    const category = FUNDRAISER_CATEGORIES.find(cat => cat.id === cause.category);

    if (viewMode === 'list') {
      return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
          <div className="flex">
            <div 
              onClick={() => navigate(`/fundraiser/${cause.id}`)}
              className="cursor-pointer"
            >
              <img 
                src={cause.image_url} 
                alt={cause.title}
                className="w-48 h-32 object-cover hover:opacity-90 transition-opacity"
              />
            </div>
            <div className="flex-1 p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 
                    onClick={() => navigate(`/fundraiser/${cause.id}`)}
                    className="text-xl font-semibold text-gray-900 mb-1 cursor-pointer hover:text-green-600 transition-colors"
                  >
                    {cause.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">by {cause.creator_name}</p>
                  {category && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {category.icon} {category.name}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">${cause.raised_amount.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">of ${cause.goal_amount.toLocaleString()}</div>
                </div>
              </div>
              
              <p className="text-gray-700 text-sm mb-4 overflow-hidden" style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>{cause.story}</p>
              
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{Math.round(progress)}% funded</span>
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {timeRemaining}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => navigate(`/fundraiser/${cause.id}`)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center"
                >
                  View <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div 
          onClick={() => navigate(`/fundraiser/${cause.id}`)}
          className="cursor-pointer"
        >
          <img 
            src={cause.image_url} 
            alt={cause.title}
            className="w-full h-48 object-cover hover:opacity-90 transition-opacity"
          />
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 
                onClick={() => navigate(`/fundraiser/${cause.id}`)}
                className="text-lg font-semibold text-gray-900 mb-1 cursor-pointer hover:text-green-600 transition-colors overflow-hidden"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {cause.title}
              </h3>
              <p className="text-sm text-gray-600 mb-2">by {cause.creator_name}</p>
              {category && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mb-2">
                  {category.icon} {category.name}
                </span>
              )}
            </div>
          </div>
          
          <p className="text-gray-700 text-sm mb-4 overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical'
          }}>{cause.story}</p>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm font-medium text-gray-900 mb-1">
              <span>${cause.raised_amount.toLocaleString()}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Goal: ${cause.goal_amount.toLocaleString()}</span>
              <span className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {timeRemaining}
              </span>
            </div>
          </div>
          
          <button 
            onClick={() => navigate(`/fundraiser/${cause.id}`)}
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            View Fundraiser
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Make a Difference Today
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Join thousands of people supporting causes that matter. Every contribution creates positive change.
          </p>
          <button
            onClick={() => {
              if (user) {
                navigate('/dashboard');
              } else {
                navigate('/signup');
              }
            }}
            className="bg-amber-500 text-white px-8 py-4 rounded-lg text-xl font-bold hover:bg-amber-600 transition-colors"
          >
            Start a Fundraiser
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search fundraisers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {FUNDRAISER_CATEGORIES.map(category => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="created_at">Newest First</option>
              <option value="goal_amount">Highest Goal</option>
              <option value="raised_amount">Most Raised</option>
              <option value="progress">Highest Progress</option>
              <option value="end_date">Ending Soon</option>
            </select>

            {/* View Mode */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {filteredCauses.length} Fundraiser{filteredCauses.length !== 1 ? 's' : ''} Found
          </h2>
          <button
            onClick={() => {
              if (user) {
                navigate('/dashboard');
              } else {
                navigate('/signup');
              }
            }}
            className="bg-amber-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-amber-600 transition-colors"
          >
            Create Fundraiser
          </button>
        </div>

        {/* Fundraiser Grid/List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading fundraisers...</div>
          </div>
        ) : filteredCauses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No fundraisers found matching your criteria.</div>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            : "space-y-4"
          }>
            {filteredCauses.map((cause) => (
              <FundraiserCard key={cause.id} cause={cause} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FundraisersPage;
