export interface Brand {
  id: string;
  name: string;
  category: string;
  metric: string;
  tagline: string;
  tier?: 'Hero' | 'Featured' | 'Partner';
  accentColor?: string;
  accentBg?: string;
  year?: string;
}

export const BRANDS_DATA: Brand[] = [
  {
    id: 'brand-mamaearth',
    name: 'Mamaearth',
    category: 'Natural Skincare & Haircare',
    metric: '18+ Campaigns',
    tagline: 'Toxin-Free Beauty & Goodness Inside',
    tier: 'Hero',
    accentColor: '#166534',
    accentBg: '#DCFCE7',
    year: '2026'
  },
  {
    id: 'brand-dot-and-key',
    name: 'Dot & Key',
    category: 'Targeted & Hydrating Skincare',
    metric: '3.4M Reach',
    tagline: 'Fruit-Forward Botanical Formulations',
    tier: 'Hero',
    accentColor: '#6D28D9',
    accentBg: '#EDE9FE',
    year: '2026'
  },
  {
    id: 'brand-plum-goodness',
    name: 'Plum Goodness',
    category: '100% Vegan Beauty',
    metric: '2.6M Reach',
    tagline: 'Clean, Cruelty-Free Skincare & Fragrance',
    tier: 'Hero',
    accentColor: '#9333EA',
    accentBg: '#F3E8FF',
    year: '2026'
  },
  {
    id: 'brand-oziva',
    name: 'Oziva',
    category: 'Plant-Based Clean Nutrition',
    metric: 'Viral UGC Launch',
    tagline: 'Holistic Wellness & Botanical Health',
    tier: 'Hero',
    accentColor: '#0D9488',
    accentBg: '#CCFBF1',
    year: '2026'
  },
  {
    id: 'brand-aqualogica',
    name: 'Aqualogica',
    category: 'Hydration & Sun Protection',
    metric: '14+ Creator Drops',
    tagline: 'Lightweight Glow & Unique Water-Lock Tech',
    tier: 'Hero',
    accentColor: '#0284C7',
    accentBg: '#E0F2FE',
    year: '2026'
  },
  {
    id: 'brand-boat',
    name: 'boAt',
    category: 'Wearables & Lifestyle Audio',
    metric: '5.8M Impressions',
    tagline: 'High-Energy Audio, Smartwatches & Gear',
    tier: 'Hero',
    accentColor: '#DC2626',
    accentBg: '#FEE2E2',
    year: '2026'
  },
  {
    id: 'brand-derma-co',
    name: 'The Derma Co',
    category: 'Active Science Skincare',
    metric: '12+ Campaigns',
    tagline: 'Dermatologist-Designed Potent Actives',
    tier: 'Hero',
    accentColor: '#0891B2',
    accentBg: '#CFFAFE',
    year: '2026'
  },
  {
    id: 'brand-sugar-cosmetics',
    name: 'Sugar Cosmetics',
    category: 'Bold Makeup & Color',
    metric: '4.2M Views',
    tagline: 'High-Performance Long-Wear Beauty',
    tier: 'Hero',
    accentColor: '#E11D48',
    accentBg: '#FFE4E6',
    year: '2026'
  }
];
