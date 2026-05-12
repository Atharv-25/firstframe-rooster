export interface Creator {
  id: number;
  name: string;
  handle: string; // kept for reference, not displayed
  followers: string;
  avgViews: string;
  niches: string[];
  brandCollabs: number;
  videoFile?: string;
}

export const creators: Creator[] = [
  {
    id: 1,
    name: 'Sehajpreet Kaur',
    handle: '@sehajpreet_126',
    followers: '4.1K',
    avgViews: '85K',
    niches: ['Lifestyle', 'Campus'],
    brandCollabs: 11,
    videoFile: 'sehajpreet.MOV'
  },
  {
    id: 2,
    name: 'Siya Uppal',
    handle: '@siyauppall',
    followers: '735',
    avgViews: '67K',
    niches: ['Fashion', 'Beauty'],
    brandCollabs: 9,
    videoFile: 'siya.MP4'
  },
  {
    id: 3,
    name: 'Jewel Lopes',
    handle: '@jewel_lopes',
    followers: '2.1K',
    avgViews: '50K',
    niches: ['Fashion', 'Lifestyle', 'Beauty', 'Travel'],
    brandCollabs: 15,
    videoFile: 'jewel.mp4'
  },
  {
    id: 4,
    name: 'Riya Maheshwari',
    handle: '@therirrijournal',
    followers: '16.1K',
    avgViews: '28K',
    niches: ['Beauty', 'Fitness', 'Fashion', 'Lifestyle', 'UGC Ads', 'Travel'],
    brandCollabs: 7,
    videoFile: 'riya.mp4'
  },
  {
    id: 5,
    name: 'Aryahi Barde',
    handle: '@aaryahibarde',
    followers: '12.6K',
    avgViews: '20K',
    niches: ['Beauty', 'Fashion', 'Lifestyle'],
    brandCollabs: 0,
    videoFile: 'aaryahi barade.mp4'
  },
  {
    id: 6,
    name: 'Ananya Mehta',
    handle: '@punanyamehta',
    followers: '1.7K',
    avgViews: '15K',
    niches: ['Beauty', 'Fashion', 'Fitness', 'Food', 'Tech', 'Home', 'Family', 'Travel', 'UGC Ads', 'Unboxing', 'Lifestyle', 'Comedy'],
    brandCollabs: 8,
    videoFile: 'ananya.mp4'
  },
  {
    id: 7,
    name: 'Suryaja Mowade',
    handle: '@thisissuryjja',
    followers: '8.5K',
    avgViews: '15K',
    niches: ['Beauty', 'Fashion', 'Fitness', 'Food', 'Lifestyle', 'UGC Ads', 'Travel', 'Comedy'],
    brandCollabs: 16,
    videoFile: 'suryajaya.mp4'
  },
  {
    id: 8,
    name: 'Ayushi Singh',
    handle: '@ayushisingh.png',
    followers: '2.97K',
    avgViews: '9K',
    niches: ['UGC Ads', 'Lifestyle', 'Fashion'],
    brandCollabs: 0,
    videoFile: 'Aayushi Singh.mp4'
  },
  {
    id: 9,
    name: "Vimi D'silva",
    handle: '@with_weandme',
    followers: '167',
    avgViews: '5.5K',
    niches: ['Beauty', 'Fashion', 'Lifestyle', 'UGC Ads'],
    brandCollabs: 13,
    videoFile: 'vimi.mp4'
  },
  {
    id: 10,
    name: 'Arpita Mahajan',
    handle: '@arpitaaa.mahajan',
    followers: '850',
    avgViews: '2.6K',
    niches: ['Lifestyle', 'Campus'],
    brandCollabs: 12,
    videoFile: 'arpita.MP4'
  }
];
