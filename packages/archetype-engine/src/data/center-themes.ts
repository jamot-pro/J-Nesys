/**
 * Human Design Centers Themes
 * Contains detailed information about the 9 centers, their defined/undefined states.
 */

export const centerThemes = {
  Head: {
    name: "Head Center",
    key: "head",
    biologicalCorrelation: "Pineal Gland",
    definedTheme: "You have a consistent, fixed way of processing inspiration and mental pressure. You naturally radiate inspiration to others and process questions in a structured way.",
    undefinedTheme: "You are deeply open to receiving inspiration from everywhere and can easily see things from many perspectives. You may feel intense pressure to answer questions that don't actually matter to you.",
    definedStrengths: ["Consistent inspiration", "Inspiring others naturally", "Comfortable with mental pressure", "Fixed thinking style"],
    undefinedWisdom: ["Knowing which questions are worth answering", "Open-mindedness", "Deep empathy for others' confusion", "Not rushing to resolve mental pressure"],
    healthTip: "Release the pressure to figure everything out immediately; it's okay to just wonder.",
    questionForReflection: "Am I trying to answer questions that don't truly matter to me?"
  },
  Ajna: {
    name: "Ajna Center",
    key: "ajna",
    biologicalCorrelation: "Anterior and Posterior Pituitary Glands",
    definedTheme: "You have a fixed, reliable way of conceptualizing and processing information. Your mind operates consistently, giving you a strong sense of certainty in your opinions.",
    undefinedTheme: "Your mind is flexible and fluid, capable of holding multiple opposing viewpoints simultaneously. You are meant to be mentally adaptable rather than fixed in your beliefs.",
    definedStrengths: ["Reliable cognitive processing", "Certainty in perspective", "Ability to structure data", "Consistent mental framework"],
    undefinedWisdom: ["Ultimate open-mindedness", "Seeing all sides of an issue", "Recognizing truth without attaching to it", "Intellectual adaptability"],
    healthTip: "Allow your mind to be a playground of ideas rather than a fortress of fixed beliefs.",
    questionForReflection: "Am I trying to convince others (or myself) that I am certain about something?"
  },
  Throat: {
    name: "Throat Center",
    key: "throat",
    biologicalCorrelation: "Thyroid and Parathyroid Glands",
    definedTheme: "You have a consistent, fixed voice and way of expressing yourself, as well as a reliable mechanism for manifesting action in the world.",
    undefinedTheme: "Your voice adapts to the people around you, allowing you to speak to many different audiences effectively. You may feel pressure to speak or act just to be noticed.",
    definedStrengths: ["Reliable expression", "Ability to manifest action consistently", "Recognizable voice/style", "Impactful communication"],
    undefinedWisdom: ["Knowing when to speak and when to be silent", "Chameleonic communication skills", "Deep listening abilities", "Not needing to attract attention"],
    healthTip: "Wait for the energy to move naturally into your throat rather than forcing yourself to speak.",
    questionForReflection: "Am I speaking or acting right now just to attract attention?"
  },
  GCenter: {
    name: "G Center",
    key: "gcenter",
    biologicalCorrelation: "Liver and Blood",
    definedTheme: "You have a strong, fixed sense of identity, direction, and love. You reliably know who you are and where you are going in life.",
    undefinedTheme: "Your identity and sense of direction are fluid, adapting beautifully to different environments and people. You are here to experience many different ways of being.",
    definedStrengths: ["Strong sense of self", "Consistent life direction", "Radiating a specific frequency of love", "Grounding for others"],
    undefinedWisdom: ["Chameleonic adaptability", "Deep understanding of different identities", "Guiding others to their correct direction", "Fluidity in love"],
    healthTip: "Curate your physical environments carefully, as they deeply impact your well-being.",
    questionForReflection: "Am I fixating on trying to figure out exactly who I am or where I am going?"
  },
  Heart: {
    name: "Heart / Will Center",
    key: "heart",
    biologicalCorrelation: "Heart, Gall Bladder, Thymus, Stomach",
    definedTheme: "You possess consistent willpower, drive, and a natural ability to make and keep promises. You are designed to push through and achieve material or ego-driven goals.",
    undefinedTheme: "Your access to willpower is inconsistent, and you are not designed to prove yourself or make strict promises. Your value is inherent, not based on what you achieve.",
    definedStrengths: ["Consistent willpower", "Ability to keep commitments", "Drive for material success", "Healthy self-esteem"],
    undefinedWisdom: ["Knowing you have nothing to prove", "Wisdom about what is truly valuable", "Flexibility in commitments", "Guiding others in resource management"],
    healthTip: "Rest before you are tired and never make promises that require sustained willpower.",
    questionForReflection: "Am I pushing myself right now to prove my worth to myself or others?"
  },
  Sacral: {
    name: "Sacral Center",
    key: "sacral",
    biologicalCorrelation: "Ovaries and Testes",
    definedTheme: "You have access to a consistent, deeply powerful life-force energy that can be sustained for long periods when you are doing things you love.",
    undefinedTheme: "You absorb and amplify the life-force energy around you, experiencing life in bursts. You are not designed for consistent, prolonged physical labor.",
    definedStrengths: ["Sustained vitality", "Deep creative power", "Ability to bring things to completion", "Reliable gut response"],
    undefinedWisdom: ["Knowing when enough is enough", "Guiding others' energy efficiently", "Deep sensitivity to vitality", "Capacity for profound rest"],
    healthTip: "If undefined, clear out your energy by sleeping alone or resting before you are entirely depleted.",
    questionForReflection: "Do I know when enough is enough, or am I pushing past my exhaustion point?"
  },
  SolarPlexus: {
    name: "Solar Plexus Center",
    key: "solarplexus",
    biologicalCorrelation: "Kidneys, Prostate, Pancreas, Nervous System",
    definedTheme: "You experience life through a consistent wave of emotional highs and lows. Your emotions are a source of profound depth and act as your ultimate truth.",
    undefinedTheme: "You are deeply empathetic, taking in and amplifying the emotions of others. Your natural state is cool and calm, but you can be easily overwhelmed by emotional environments.",
    definedStrengths: ["Deep emotional intelligence", "Profound empathy", "Ability to ride emotional waves", "Emotional clarity over time"],
    undefinedWisdom: ["Reading the emotional state of others accurately", "Knowing which emotions are not yours", "Remaining objective in emotional situations", "Deep calm"],
    healthTip: "If undefined, regularly take time alone to discharge absorbed emotional energy.",
    questionForReflection: "Am I avoiding conflict or holding onto emotions that don't belong to me?"
  },
  Spleen: {
    name: "Spleen Center",
    key: "spleen",
    biologicalCorrelation: "Lymphatic System, Spleen, T-Cells",
    definedTheme: "You possess a consistent, reliable intuition that operates in the present moment to keep you safe and healthy. You feel grounded in your physical body.",
    undefinedTheme: "You are highly sensitive to the physical health, fears, and well-being of others. You may tend to hold onto things (people, jobs, habits) longer than is healthy for you.",
    definedStrengths: ["Instantaneous intuition", "Strong immune system", "Present-moment awareness", "Making others feel safe"],
    undefinedWisdom: ["Deep understanding of health and healing", "Recognizing the fears of others", "Knowing what is safe for others", "Ability to let go"],
    healthTip: "Practice the art of letting go of what no longer serves your well-being.",
    questionForReflection: "Am I holding onto something (or someone) simply because it feels familiar and safe?"
  },
  Root: {
    name: "Root Center",
    key: "root",
    biologicalCorrelation: "Adrenal Glands",
    definedTheme: "You have a consistent, pulsing energy that provides adrenaline and stress resistance. You are designed to use this pressure as fuel to move forward.",
    undefinedTheme: "You absorb and amplify stress and pressure from your environment, often feeling a rush to finish things just to get rid of the pressure.",
    definedStrengths: ["Ability to handle stress", "Consistent drive and momentum", "Grounding pressure into action", "Resilience"],
    undefinedWisdom: ["Knowing which pressure is actually important", "Enjoying stillness", "Not rushing through life", "Guiding others through stress"],
    healthTip: "Don't rush to finish things just to relieve the pressure; the pressure will always be there.",
    questionForReflection: "Am I rushing to get things done just so I can finally rest?"
  }
};
