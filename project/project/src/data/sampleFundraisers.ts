// Sample Fundraisers Data - Easily toggleable sample data system
// Set ENABLE_SAMPLE_DATA to false to disable all sample data

import { isFundraiserSampleDataEnabled } from '../config/sampleDataConfig';

export const ENABLE_SAMPLE_DATA = isFundraiserSampleDataEnabled();

interface SampleFundraiser {
  id: string;
  title: string;
  description: string;
  story: string;
  goal: number;
  raised: number;
  image: string;
  category: string;
  supporters: number;
  daysLeft: number;
  creator: string;
  location: string;
}

// High quality Unsplash images for fundraisers
export const SAMPLE_FUNDRAISERS: SampleFundraiser[] = [
  {
    id: 'fund-1',
    title: 'Clean Water Wells for Rural Uganda',
    description: 'Bringing clean, safe drinking water to remote villages in Uganda through sustainable well construction.',
    story: 'Many communities in rural Uganda lack access to clean water, forcing families to walk hours daily for contaminated sources. Your donation will help build solar-powered wells that serve entire villages.',
    goal: 25000,
    raised: 18750,
    image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop&crop=center',
    category: 'Humanitarian',
    supporters: 342,
    daysLeft: 15,
    creator: 'Water for Life Foundation',
    location: 'Uganda, East Africa'
  },
  {
    id: 'fund-2',
    title: 'Save Paws Animal Shelter',
    description: 'Our beloved animal shelter is facing closure due to funding shortages. Help us save hundreds of animals.',
    story: 'Paws & Hearts Rescue has saved over 2,000 animals in the past 5 years. Due to rising costs and reduced donations, we risk closing our doors. Your support will keep us operational and save more lives.',
    goal: 15000,
    raised: 8500,
    image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=300&fit=crop&crop=center',
    category: 'Animals',
    supporters: 156,
    daysLeft: 8,
    creator: 'Paws & Hearts Rescue',
    location: 'Portland, Oregon'
  },
  {
    id: 'fund-3',
    title: 'Hurricane Relief Emergency Fund',
    description: 'Providing immediate assistance to hurricane survivors with food, shelter, and basic necessities.',
    story: 'Recent hurricanes have devastated communities, leaving thousands without homes or basic necessities. 100% of donations go directly to affected families through verified relief organizations.',
    goal: 50000,
    raised: 32100,
    image: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=300&fit=crop&crop=center',
    category: 'Emergency',
    supporters: 428,
    daysLeft: 30,
    creator: 'Disaster Relief Network',
    location: 'Gulf Coast, USA'
  },
  {
    id: 'fund-4',
    title: 'Scholarships for Underprivileged Students',
    description: 'Education is the key to breaking the cycle of poverty. Help us provide scholarships for deserving students.',
    story: 'Many brilliant students cannot afford higher education despite excellent grades. Our scholarship program has helped 200+ students attend college, with 95% graduation rate and meaningful careers.',
    goal: 30000,
    raised: 12300,
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=300&fit=crop&crop=center',
    category: 'Education',
    supporters: 189,
    daysLeft: 45,
    creator: 'Education First Initiative',
    location: 'Chicago, Illinois'
  },
  {
    id: 'fund-5',
    title: 'Community Garden Food Security',
    description: 'Creating sustainable food sources for low-income families while building community connections.',
    story: 'Food insecurity affects 1 in 8 families in our community. Our garden project will provide fresh produce year-round while teaching sustainable farming and bringing neighbors together.',
    goal: 8000,
    raised: 6200,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center',
    category: 'Community',
    supporters: 92,
    daysLeft: 22,
    creator: 'Green Community Alliance',
    location: 'Denver, Colorado'
  },
  {
    id: 'fund-6',
    title: 'Children\'s Cancer Treatment Support',
    description: 'Supporting families facing overwhelming costs of childhood cancer treatment with hope and healing.',
    story: 'No family should choose between saving their child and financial ruin. Our fund covers medical expenses, travel costs, and provides emotional support during the most challenging times.',
    goal: 40000,
    raised: 28900,
    image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=300&fit=crop&crop=center',
    category: 'Medical',
    supporters: 512,
    daysLeft: 60,
    creator: 'Children\'s Cancer Support Fund',
    location: 'Nationwide, USA'
  },
  {
    id: 'fund-7',
    title: 'Music Equipment for School Programs',
    description: 'Bringing music education to underserved schools by providing instruments and equipment.',
    story: 'Music education improves academic performance and provides creative outlets for students. Many schools lack basic instruments. Your donation will bring music to 500+ students.',
    goal: 7500,
    raised: 4200,
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop&crop=center',
    category: 'Arts',
    supporters: 128,
    daysLeft: 18,
    creator: 'Harmony Education Project',
    location: 'Nashville, Tennessee'
  },
  {
    id: 'fund-8',
    title: 'Youth Sports Equipment Drive',
    description: 'Providing sports equipment and opportunities for underprivileged youth to stay active and healthy.',
    story: 'Sports teach teamwork, discipline, and keep kids engaged. Many low-income families cannot afford equipment. Our program provides free gear and coaching to 200+ kids annually.',
    goal: 12000,
    raised: 8900,
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=300&fit=crop&crop=center',
    category: 'Sports',
    supporters: 203,
    daysLeft: 6,
    creator: 'Youth Sports Foundation',
    location: 'Los Angeles, California'
  },
  {
    id: 'fund-9',
    title: 'Senior Center Renovation Project',
    description: 'Renovating our local senior center to better serve elderly community members with modern facilities.',
    story: 'Our senior center serves 300+ elderly residents daily with meals, activities, and healthcare services. The 40-year-old building needs urgent repairs to continue serving our growing senior population.',
    goal: 25000,
    raised: 18500,
    image: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?w=400&h=300&fit=crop&crop=center',
    category: 'Community',
    supporters: 312,
    daysLeft: 20,
    creator: 'Golden Years Community Center',
    location: 'Phoenix, Arizona'
  },
  {
    id: 'fund-10',
    title: 'Mental Health Support Hotline',
    description: 'Establishing a 24/7 mental health crisis support hotline staffed by trained professionals.',
    story: 'Mental health crises don\'t wait for business hours. Our community lacks accessible mental health support. Your donation will fund trained counselors, phone systems, and resources to save lives.',
    goal: 35000,
    raised: 21200,
    image: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=300&fit=crop&crop=center',
    category: 'Health',
    supporters: 276,
    daysLeft: 35,
    creator: 'Mental Wellness Alliance',
    location: 'Seattle, Washington'
  },
  {
    id: 'fund-11',
    title: 'Homeless Veterans Support Program',
    description: 'Providing housing assistance, job training, and mental health support for homeless veterans.',
    story: 'Those who served our country deserve our support. Our program provides transitional housing, job placement, and counseling services. We\'ve helped 150+ veterans find stability and purpose.',
    goal: 45000,
    raised: 33750,
    image: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&h=300&fit=crop&crop=center',
    category: 'Veterans',
    supporters: 445,
    daysLeft: 42,
    creator: 'Heroes Support Network',
    location: 'Austin, Texas'
  },
  {
    id: 'fund-12',
    title: 'Reforestation Climate Action Project',
    description: 'Planting native trees to combat climate change and restore damaged ecosystems.',
    story: 'Climate change requires immediate action. Our reforestation project will plant 10,000 native trees, restore habitats, and remove CO2 from the atmosphere. Each $5 plants one tree.',
    goal: 50000,
    raised: 38200,
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&h=300&fit=crop&crop=center',
    category: 'Environment',
    supporters: 892,
    daysLeft: 28,
    creator: 'Earth Restoration Initiative',
    location: 'Pacific Northwest, USA'
  }
];

// Function to get fundraisers by category
export const getFundraisersByCategory = (category: string): SampleFundraiser[] => {
  if (!ENABLE_SAMPLE_DATA) return [];
  
  if (category === 'All' || category === '') {
    return SAMPLE_FUNDRAISERS;
  }
  
  return SAMPLE_FUNDRAISERS.filter(fundraiser => 
    fundraiser.category.toLowerCase() === category.toLowerCase()
  );
};

// Function to get all sample fundraisers
export const getAllSampleFundraisers = (): SampleFundraiser[] => {
  return ENABLE_SAMPLE_DATA ? SAMPLE_FUNDRAISERS : [];
};

// Function to get random fundraisers for sliders
export const getRandomFundraisers = (count: number = 6): SampleFundraiser[] => {
  if (!ENABLE_SAMPLE_DATA) return [];
  
  const shuffled = [...SAMPLE_FUNDRAISERS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

export default SAMPLE_FUNDRAISERS;
