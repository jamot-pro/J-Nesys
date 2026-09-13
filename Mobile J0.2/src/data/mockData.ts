import type { Task, UserProfile, ProfileCompletenessItem, MissionJoined, AuraCategory } from '../types';

export const INITIAL_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Photograph the mooring line at pier 3',
    client: 'Tidal Grid',
    distanceKm: 8.2,
    deadline: 'before 18:40',
    payoutEur: 60,
    coordinates: [51.9054, 4.4320], // Delfshaven / Waalhaven area
    category: 'onsite',
    status: 'accepted',
    description: 'Take 4 high-res photos of the mooring cleat and line integrity at pier 3 in Delfshaven.',
    instructions: [
      'Ensure timestamp and geo-location metadata is enabled on your camera.',
      'Capture clear close-ups of any fraying or wear on the line.',
      'Submit through the verification portal before 18:40.'
    ]
  },
  {
    id: 't2',
    title: 'Record 20 phrases in Mirandese',
    client: 'Lumen Schools',
    distanceKm: 0,
    deadline: 'by Friday',
    payoutEur: 45,
    coordinates: [51.9180, 4.4150],
    category: 'remote',
    description: 'Linguistic preservation initiative. Record 20 designated conversational sentences in clear Mirandese dialect.',
    instructions: [
      'Use a quiet room with minimal background echo.',
      'Record in WAV or MP3 format with clear articulation.'
    ]
  },
  {
    id: 't3',
    title: 'Survey the grid cabinet on Vlieland',
    client: 'Tidal Grid',
    distanceKm: 14.0,
    deadline: 'Thu window',
    payoutEur: 90,
    coordinates: [51.9280, 4.4750],
    category: 'onsite',
    description: 'Verify optical seal on substation cabinet #4B and take meter read photo.',
    instructions: [
      'Inspect physical lock and tamper tags.',
      'Record kilowatt meter counter reading.'
    ]
  },
  {
    id: 't4',
    title: 'Collect Fanø council minutes in person',
    client: 'Tidal Grid',
    distanceKm: 3.1,
    deadline: 'today',
    payoutEur: 35,
    coordinates: [51.9120, 4.4600],
    category: 'onsite',
    description: 'Pick up physical stamped printout from municipal office archives.',
    instructions: [
      'Present operator authorization ID at counter 3.'
    ]
  }
];

export const INITIAL_USER_PROFILE: UserProfile = {
  name: 'Mara',
  surname: 'Jansen',
  handle: 'mara',
  headline: 'Operations lead — agentic systems',
  trustedScore: 742,
  tierLevel: 6,
  reputationStars: 742,
  publicSlug: 'jamot.pro/mara',
  dreamStatement: 'Give small operators the same leverage as large ones — agentic infrastructure that pays out in outcomes, not seats.',
  skills: ['Ops automation design', 'Agent evaluation', 'Contract review', 'Supply-chain modelling'],
  asks: ['Qualified inbound in logistics', 'Research digests, weekly', 'Draft SOPs I can edit'],
  birthDate: '1990-04-17',
  birthTime: '06:35',
  birthPlace: 'Utrecht, Netherlands',
  socials: {
    website: 'https://jamot.pro',
    linkedin: 'linkedin.com/in/mara-jansen',
    x: '@marajansen',
    github: 'github.com/'
  },
  mbti: {
    type: 'INTJ',
    source: '16personalities, Mar 2026'
  },
  enneagram: {
    type: 'Type 5 · wing 4',
    source: 'Self-reported'
  },
  bigFive: {
    stats: 'O 88 · C 74 · E 41',
    source: 'IPIP-NEO, Jan 2026'
  },
  humanDesign: {
    status: 'Not generated',
    notes: 'Needs birth time and place'
  }
};

export const INITIAL_COMPLETENESS_ITEMS: ProfileCompletenessItem[] = [
  { id: 'c1', title: 'Verify email and phone', weightPercent: 12, completed: true },
  { id: 'c2', title: 'Write a dream statement', weightPercent: 12, completed: true },
  { id: 'c3', title: 'Fill skills, ask and offer', weightPercent: 18, completed: true },
  { id: 'c4', title: 'Record a 30-second voice intro', weightPercent: 14, completed: false },
  { id: 'c5', title: 'Add birth data and generate charts', weightPercent: 10, completed: true },
  { id: 'c6', title: 'Connect an on-chain wallet', weightPercent: 20, completed: true },
  { id: 'c7', title: 'Add two references from past missions', weightPercent: 14, completed: false },
];

export const AURA_BREAKDOWN: AuraCategory[] = [
  { label: 'Tasks completed on time', valueDescription: '18 of 19', points: 412, currentProgress: 95, maxProgress: 100 },
  { label: 'People believing in your dreams', valueDescription: '96 believers', points: 140, currentProgress: 40, maxProgress: 100 },
  { label: 'Dreams you believe in', valueDescription: '7 backed', points: 96, currentProgress: 28, maxProgress: 100 },
  { label: 'Tasks assigned to agents', valueDescription: '23 assigned', points: 62, currentProgress: 18, maxProgress: 100 },
  { label: 'Missions created', valueDescription: '2 created', points: 32, currentProgress: 8, maxProgress: 100 }
];

export const MISSIONS_JOINED: MissionJoined[] = [
  {
    id: 'm1',
    name: 'Tidal Grid',
    role: 'Agent maintainer · since Mar 2026',
    since: 'Mar 2026',
    earningsEur: 1340
  },
  {
    id: 'm2',
    name: 'Lumen Schools',
    role: 'Contributor · since Jun 2026',
    since: 'Jun 2026',
    earningsEur: 380
  },
  {
    id: 'm3',
    name: 'Open Seed Bank',
    role: 'Field contributor · since Aug 2026',
    since: 'Aug 2026',
    earningsEur: 122
  }
];
