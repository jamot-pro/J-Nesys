/**
 * Human Design Types, Authorities, and Profiles Narratives
 * Contains rich personality descriptions for the personality test engine.
 */

export const typeNarratives = {
  Generator: {
    description: "You are the vibrant life force of the world, endowed with an incredible capacity for sustained energy and creation. When you are engaged in work or activities you truly love, your energy becomes self-replenishing and profoundly magnetic. You are here to master your passions and bring things to life through dedicated, joyous effort.",
    strengths: ["Boundless energy when inspired", "Mastery of skills over time", "Deeply grounded and enveloping aura", "Capacity for immense productivity"],
    challenges: ["Feeling stuck when engaged in unfulfilling work", "Pushing through rather than listening to your body", "Frustration when you skip steps or hit a plateau"],
    lifeTheme: "To build, create, and master through the joy of doing.",
    notSelfBehavior: "Quitting too soon or feeling deep frustration when trying to force things to happen.",
    signatureFeeling: "Deep satisfaction and peace after a day of meaningful exhaustion."
  },
  ManifestingGenerator: {
    description: "You are a dynamic, multi-passionate force of nature who moves through life with incredible speed and efficiency. You possess the unique ability to envision a goal and rapidly skip steps to achieve it, often juggling several passions simultaneously. Your non-linear approach to life allows you to innovate and find the fastest route to success.",
    strengths: ["Incredible speed and efficiency", "Ability to multitask and pivot quickly", "Pioneering new ways of doing things", "Abundant, highly active energy"],
    challenges: ["Impatience with others who move slower", "Skipping crucial steps and having to go back", "Scattering energy too broadly"],
    lifeTheme: "To find the most efficient pathways and joyously respond to multiple passions.",
    notSelfBehavior: "Anger and frustration when slowed down by others or when forced to stick to a single rigid path.",
    signatureFeeling: "Satisfaction combined with the peaceful freedom of moving at your own pace."
  },
  Projector: {
    description: "You are a gifted guide and visionary, here to see the systems and people around you with unparalleled clarity. You are not designed to work in the traditional sense of endless physical labor; instead, your gift lies in your piercing wisdom, efficiency, and ability to organize and direct the energy of others. Your aura naturally absorbs and focuses on the other.",
    strengths: ["Deep insight into people and systems", "Natural leadership and guidance capabilities", "Mastery of efficiency", "Ability to see the big picture"],
    challenges: ["Burnout from trying to keep up with Generators", "Bitterness when your wisdom goes unrecognized", "Waiting for the right invitation"],
    lifeTheme: "To guide, direct, and refine the energy of others through profound understanding.",
    notSelfBehavior: "Feeling bitter, exhausted, and unseen when giving uninvited advice.",
    signatureFeeling: "Profound success and recognition when your guidance is valued and applied."
  },
  Manifestor: {
    description: "You are the natural initiator and trailblazer of the world, designed to spark action and start movements. With a powerful, independent aura, you don't need to wait for others; you are here to impact the world through your sheer will and innovative ideas. You are the match that lights the fire, clearing the path for others to build upon.",
    strengths: ["Ability to initiate action independently", "Strong, impactful presence", "Visionary capability to start new things", "Deep need for and comfort with autonomy"],
    challenges: ["Feeling controlled or restricted by others", "Forgetting to inform people before acting, causing resistance", "Inconsistent energy levels"],
    lifeTheme: "To initiate action, have an impact, and experience freedom.",
    notSelfBehavior: "Deep anger when your flow is interrupted or your freedom is restricted.",
    signatureFeeling: "Peace and tranquility when you are free to act and have successfully cleared the way."
  },
  Reflector: {
    description: "You are a rare and extraordinary mirror to society, designed to sample and reflect the health and environment of your community. Your aura is completely open and resilient, allowing you to take in the world without being permanently conditioned by it. You are the ultimate evaluator, moving in harmony with the lunar cycle to gain profound wisdom.",
    strengths: ["Incredible adaptability and fluidity", "Profound wisdom about the state of groups and environments", "Ability to see what others miss", "Objective perspective"],
    challenges: ["Feeling invisible or overwhelmed by the energy of others", "Pressure to make quick decisions", "Identifying too closely with temporary energies"],
    lifeTheme: "To reflect truth, assess the environment, and be surprised by life's unfolding.",
    notSelfBehavior: "Deep disappointment when environments or people are inauthentic or unhealthy.",
    signatureFeeling: "Delightful surprise and wonder at the beauty and authenticity of the world."
  }
};

export const authorityNarratives = {
  Emotional: {
    description: "Your truth reveals itself over time, riding a wave of emotional highs and lows. You possess a profound depth of feeling and are not designed to be spontaneous with important choices.",
    howToDecide: "Wait out your emotional wave. Sleep on it. True clarity comes when you feel calm and neutral about a decision, having experienced it through all your emotional lenses.",
    waitingPeriod: "Typically days to weeks, depending on the magnitude of the decision.",
    commonPitfalls: "Making impulsive decisions in the heat of an emotional high or a desperate low."
  },
  Sacral: {
    description: "Your body has a reliable, immediate compass that speaks through guttural sounds (uh-huh for yes, uhn-un for no) or physical pulls. You are wired to respond to life in the present moment.",
    howToDecide: "Tune into your gut response in the exact moment a question or opportunity arises. If it's a hell yes, you'll feel the energy for it. If it's a maybe, it's a no for now.",
    waitingPeriod: "Immediate. The truth is in the present moment.",
    commonPitfalls: "Letting your mind rationalize or override what your gut clearly told you."
  },
  Splenic: {
    description: "You possess a highly attuned, instantaneous intuitive intelligence. Your body speaks to you in whispers, subtle hits, or sudden knowings that happen in a fraction of a second to keep you safe and aligned.",
    howToDecide: "Listen to the very first quiet voice or instinct. It only speaks once and won't repeat itself or provide logical explanations.",
    waitingPeriod: "Instantaneous. Trust the split-second knowing.",
    commonPitfalls: "Ignoring the quiet whisper because your mind demands a logical reason."
  },
  Ego: {
    description: "Your truth comes from a place of willpower and heart-centered desire. When you commit to something, it must be because you genuinely have the heart for it and it serves your material or ego path.",
    howToDecide: "Listen to what you say without thinking, or ask yourself: 'Do I really have the will/heart for this? Is there something in this for me?'",
    waitingPeriod: "Relatively immediate, found in your spontaneous speech or clear internal commitment.",
    commonPitfalls: "Committing to things out of obligation rather than genuine willpower."
  },
  SelfProjected: {
    description: "Your truth is expressed through your own voice and identity. You need to hear yourself speak in an unfiltered way to discover what is truly right for you.",
    howToDecide: "Talk things out with a trusted sounding board who won't give advice, but will just listen. Pay attention to what comes out of your mouth naturally.",
    waitingPeriod: "Immediate as you speak, but may require time to have the necessary conversations.",
    commonPitfalls: "Seeking advice from others instead of just listening to your own words."
  },
  Mental: {
    description: "You receive guidance by sensing how different environments feel. You do not have an inner compass; instead, your truth is reflected by your surroundings and your ability to bounce ideas off trusted people.",
    howToDecide: "Spend time in the physical environment related to the decision. Talk things out with various people to hear your own thoughts reflecting back to you.",
    waitingPeriod: "Can take significant time as you sample different environments and conversations.",
    commonPitfalls: "Trying to make a logical decision in your head while sitting in the wrong physical space."
  },
  Lunar: {
    description: "As a Reflector, your process is uniquely tied to the 28.5-day cycle of the moon. You need to experience a decision through all the different daily energies before finding clarity.",
    howToDecide: "Wait a full lunar cycle (around 28-29 days) for major decisions. Talk about your options with different people throughout the month to see how your perspective shifts.",
    waitingPeriod: "Approximately 28.5 days.",
    commonPitfalls: "Rushing into a decision because of pressure from others or societal expectations."
  }
};

export const profileNarratives = {
  "1/3": {
    name: "Investigator / Martyr",
    theme: "Foundational Discovery",
    personality: "You are deeply curious and driven to understand the bedrock of how things work. You combine intensive research with hands-on trial and error.",
    lifePath: "To build a solid foundation of knowledge and then test it in the real world to see what actually holds up.",
    strengths: ["Deep expertise", "Resilience", "Practical wisdom"],
    challenges: ["Insecurity when lacking information", "Fear of failure"]
  },
  "1/4": {
    name: "Investigator / Opportunist",
    theme: "Networked Foundation",
    personality: "You are a studious researcher who naturally shares your deep knowledge with your trusted network of friends and colleagues.",
    lifePath: "To become an authority in your chosen field and externalize that foundation to influence your close circle.",
    strengths: ["Reliability", "Strong networking", "Depth of knowledge"],
    challenges: ["Inflexibility", "Burnout from social obligations"]
  },
  "2/4": {
    name: "Hermit / Opportunist",
    theme: "Natural Networker",
    personality: "You have innate talents that you might not even recognize, yet your network constantly draws you out to share your natural gifts.",
    lifePath: "To balance your deep need for alone time with the correct invitations from your social sphere.",
    strengths: ["Effortless talent", "Warmth", "Natural influence"],
    challenges: ["Not seeing your own gifts", "Depletion from too much socializing"]
  },
  "2/5": {
    name: "Hermit / Heretic",
    theme: "Unconventional Savior",
    personality: "You possess mysterious, innate talents and naturally draw the projections of others who see you as the answer to their problems.",
    lifePath: "To protect your private time while selectively stepping out to provide practical, universal solutions.",
    strengths: ["Natural genius", "Problem-solving", "Magnetic aura"],
    challenges: ["Heavy expectations from others", "Withdrawing too much to avoid pressure"]
  },
  "3/5": {
    name: "Martyr / Heretic",
    theme: "Practical Rebel",
    personality: "You learn through a process of discovery and mistakes, adapting quickly to bring highly practical, unconventional solutions to the masses.",
    lifePath: "To bump into life, figure out what doesn't work, and universally share what does.",
    strengths: ["Adaptability", "Resilience", "Crisis management"],
    challenges: ["Pessimism", "Reputation damage when projections fail"]
  },
  "3/6": {
    name: "Martyr / Role Model",
    theme: "Experiential Wisdom",
    personality: "Your life is a dramatic arc: early years of chaotic trial and error, followed by a period of healing and objectivity, culminating in deep, embodied wisdom.",
    lifePath: "To transition from a life of intense experimentation to becoming an objective, wise role model for others.",
    strengths: ["Vast life experience", "Deep empathy", "Eventual profound wisdom"],
    challenges: ["Exhaustion in early life", "Aloofness in mid-life"]
  },
  "4/6": {
    name: "Opportunist / Role Model",
    theme: "Trusted Authority",
    personality: "You are highly relational and build deep trust within your network, eventually becoming a wise, objective leader that others look up to.",
    lifePath: "To influence your community through deep connections and mature into an authoritative role model after a period of observation.",
    strengths: ["Networking", "Friendliness", "Objective leadership"],
    challenges: ["Fear of rejection", "Struggling with the transition periods of the 6th line"]
  },
  "4/1": {
    name: "Opportunist / Investigator",
    theme: "Fixed Foundation",
    personality: "You have a very fixed, solid destiny. You take your deeply researched, unshakeable foundation and bring it straight to your community.",
    lifePath: "To be a stable, inflexible pillar of truth and share your specific foundational knowledge with your network.",
    strengths: ["Unwavering stability", "Deep research", "Loyalty"],
    challenges: ["Extreme rigidity", "Difficulty adapting to change"]
  },
  "5/1": {
    name: "Heretic / Investigator",
    theme: "Practical Authority",
    personality: "You are the ultimate problem solver. You build a deep foundation of knowledge to support the massive projections others place on you to save the day.",
    lifePath: "To provide practical, foundational solutions in times of crisis while managing the high expectations of others.",
    strengths: ["Leadership in crisis", "Deep problem-solving", "Magnetic influence"],
    challenges: ["Paranoia", "The burden of unrealistic expectations"]
  },
  "5/2": {
    name: "Heretic / Hermit",
    theme: "Reluctant Savior",
    personality: "You have a natural, unforced genius that others project upon, expecting you to solve their problems, though you prefer to be left alone.",
    lifePath: "To carefully choose which calls to action you respond to, bringing your innate gifts to the public only when correct.",
    strengths: ["Effortless brilliance", "Practical solutions", "Self-containment"],
    challenges: ["Feeling overwhelmed by demands", "Hiding away completely"]
  },
  "6/2": {
    name: "Role Model / Hermit",
    theme: "Objective Guide",
    personality: "You carry natural talents and a deeply objective view of the world. After a tumultuous early life, you prefer to observe from afar until called out to lead.",
    lifePath: "To move through intense early experiences, retreat to find perspective, and eventually re-emerge as an embodied, natural role model.",
    strengths: ["Profound objectivity", "Natural gifts", "Wise leadership"],
    challenges: ["Aloofness", "Hypocrisy if not living your own truth"]
  },
  "6/3": {
    name: "Role Model / Martyr",
    theme: "Eternal Pioneer",
    personality: "You are in a constant state of dynamic change, balancing the objective wisdom of the role model with an unending drive for trial and error.",
    lifePath: "To continually learn through experience, never quite settling down, always refining your profound wisdom through action.",
    strengths: ["Incredible resilience", "Deeply grounded wisdom", "Fearlessness"],
    challenges: ["Chaos", "Difficulty finding peace or settling"]
  }
};
