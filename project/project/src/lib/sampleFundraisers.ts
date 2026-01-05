// Sample fundraiser data for fallback when database is not available
export const SAMPLE_FUNDRAISERS = [
  {
    id: 'fundraiser-1',
    title: 'Help Build Clean Water Wells in Uganda',
    story: 'Join us in bringing clean, safe drinking water to remote villages in Uganda. Your contribution will help build sustainable water wells that will serve communities for generations to come.',
    goal_amount: 25000,
    raised_amount: 18750,
    image_url: 'https://images.pexels.com/photos/1739855/pexels-photo-1739855.jpeg?auto=compress&cs=tinysrgb&w=800',
    creator_id: 'sample-creator-1',
    creator_name: 'Water for Life Foundation',
    created_at: '2024-01-15T00:00:00Z',
    end_date: '2025-12-31T23:59:59Z',
    category: 'humanitarian',
    is_active: true
  },
  {
    id: 'fundraiser-2',
    title: 'Save the Local Animal Shelter',
    story: 'Our beloved animal shelter is facing closure due to funding shortages. Help us save hundreds of animals and continue our mission of rescue, rehabilitation, and rehoming.',
    goal_amount: 15000,
    raised_amount: 8500,
    image_url: 'https://images.pexels.com/photos/1851164/pexels-photo-1851164.jpeg?auto=compress&cs=tinysrgb&w=800',
    creator_id: 'sample-creator-2',
    creator_name: 'Paws & Hearts Rescue',
    created_at: '2024-02-01T00:00:00Z',
    end_date: '2025-08-15T23:59:59Z',
    category: 'animals',
    is_active: true
  },
  {
    id: 'fundraiser-3',
    title: 'Emergency Relief for Hurricane Victims',
    story: 'Hurricane survivors need immediate assistance with food, shelter, and basic necessities. 100% of donations go directly to affected families through verified relief organizations.',
    goal_amount: 50000,
    raised_amount: 32100,
    image_url: 'https://images.pexels.com/photos/1261728/pexels-photo-1261728.jpeg?auto=compress&cs=tinysrgb&w=800',
    creator_id: 'sample-creator-3',
    creator_name: 'Disaster Relief Network',
    created_at: '2024-01-20T00:00:00Z',
    end_date: '2025-06-30T23:59:59Z',
    category: 'emergency',
    is_active: true
  },
  {
    id: 'fundraiser-4',
    title: 'Scholarships for Underprivileged Students',
    story: 'Education is the key to breaking the cycle of poverty. Help us provide scholarships and educational resources to deserving students who cannot afford higher education.',
    goal_amount: 30000,
    raised_amount: 12300,
    image_url: 'https://images.pexels.com/photos/159844/pexels-photo-159844.jpeg?auto=compress&cs=tinysrgb&w=800',
    creator_id: 'sample-creator-4',
    creator_name: 'Education First Initiative',
    created_at: '2024-01-10T00:00:00Z',
    end_date: '2025-12-01T23:59:59Z',
    category: 'education',
    is_active: true
  },
  {
    id: 'fundraiser-5',
    title: 'Community Garden & Food Security Project',
    story: 'Creating sustainable food sources for low-income families while building community connections. Help us establish gardens that will feed hundreds of families year-round.',
    goal_amount: 8000,
    raised_amount: 6200,
    image_url: 'https://images.pexels.com/photos/1459505/pexels-photo-1459505.jpeg?auto=compress&cs=tinysrgb&w=800',
    creator_id: 'sample-creator-5',
    creator_name: 'Green Community Alliance',
    created_at: '2024-02-05T00:00:00Z',
    end_date: '2025-09-30T23:59:59Z',
    category: 'community',
    is_active: true
  },
  {
    id: 'fundraiser-6',
    title: 'Medical Treatment for Children with Cancer',
    story: 'Supporting families facing the overwhelming costs of childhood cancer treatment. Every donation helps provide hope, healing, and support during the most challenging times.',
    goal_amount: 40000,
    raised_amount: 28900,
    image_url: 'https://images.pexels.com/photos/236151/pexels-photo-236151.jpeg?auto=compress&cs=tinysrgb&w=800',
    creator_id: 'sample-creator-6',
    creator_name: 'Children\'s Cancer Support Fund',
    created_at: '2024-01-25T00:00:00Z',
    end_date: '2025-12-25T23:59:59Z',
    category: 'medical',
    is_active: true
  }
];

export const FUNDRAISER_CATEGORIES = [
  { id: 'all', name: 'All Causes', icon: '🌟' },
  { id: 'humanitarian', name: 'Humanitarian', icon: '🤝' },
  { id: 'animals', name: 'Animals', icon: '🐾' },
  { id: 'emergency', name: 'Emergency Relief', icon: '🚨' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'community', name: 'Community', icon: '🏘️' },
  { id: 'medical', name: 'Medical', icon: '🏥' },
  { id: 'environment', name: 'Environment', icon: '🌱' },
  { id: 'sports', name: 'Sports & Recreation', icon: '⚽' }
];
