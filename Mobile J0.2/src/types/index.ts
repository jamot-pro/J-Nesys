export type NavTab = 'discover' | 'notes' | 'missions' | 'agent' | 'wallet' | 'profile';

export interface Task {
  id: string;
  title: string;
  client: string;
  distanceKm: number;
  deadline: string;
  payoutEur: number;
  coordinates: [number, number]; // [lat, lng]
  category: 'onsite' | 'remote';
  status?: 'active' | 'offered' | 'in_review' | 'closed' | 'accepted';
  description?: string;
  instructions?: string[];
}

export interface ProfileCompletenessItem {
  id: string;
  title: string;
  weightPercent: number;
  completed: boolean;
}

export interface AuraCategory {
  label: string;
  valueDescription: string;
  points: number;
  maxProgress?: number;
  currentProgress?: number;
}

export interface MissionJoined {
  id: string;
  name: string;
  role: string;
  since: string;
  earningsEur: number;
}

export interface UserProfile {
  name: string;
  surname: string;
  handle: string;
  headline: string;
  avatarUrl?: string;
  bannerUrl?: string;
  trustedScore: number;
  tierLevel: number;
  reputationStars: number;
  publicSlug: string;
  dreamStatement: string;
  skills: string[];
  asks: string[];
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  socials: {
    website: string;
    linkedin: string;
    x: string;
    github: string;
  };
  mbti: {
    type: string;
    source: string;
  };
  enneagram: {
    type: string;
    source: string;
  };
  bigFive: {
    stats: string;
    source: string;
  };
  humanDesign: {
    status: string;
    notes: string;
  };
}
