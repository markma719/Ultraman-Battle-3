
export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');

// Real Ultraman Kaiju Prompts for better visual style
export const MONSTER_PROMPTS = [
  "Pigmon, small friendly monster, red organic balloons, tokusatsu suit style, photography", // Level 1
  "Alien Baltan, cicada-like alien, large claws, blueish tint, tokusatsu suit style, classic ultraman villain", // Level 2
  "Gomora, ancient dinosaur monster, large crescent horns, powerful tail, tokusatsu suit style", // Level 3
  "Red King, skull-like face, bulky body, yellow and blue distinct colors, massive strength, tokusatsu suit style", // Level 4
  "Eleking, electric eel monster, white and black rotating horns, yellow lightning, tokusatsu suit style", // Level 5
  "King Joe, gold robot combinat, mechanical texture, glowing lights, tokusatsu suit style", // Level 6
  "Zetton, black and white alien beetle, yellow glowing chest, space dinosaur, tokusatsu suit style, menacing", // Level 7
  "Tyrant, chimera monster, axe hand, mace tail, various monster parts, tokusatsu suit style", // Level 8
  "Hyper Zetton, sleek insectoid armor, glowing wings, teleporting aura, high quality CGI style", // Level 9
  "Ultraman Belial Atrocious, ultimate evil ultra, black and red spiked armor, glowing red eyes, holding Giga Battlenizer, cinematic lighting" // Level 10
];

export const ULTRAMAN_IMAGE_PROMPT = "Ultraman Zero Beyond, shining gold and silver armor, dual eye sluggers, heroic stance, cinematic lighting, high detail digital art";

// Difficulty Configuration
export const DIFFICULTY_CONFIG = {
  EASY: {
    hpMultiplier: 0.7,
    recordingTimeMs: 4000,
    passThreshold: 40 // Lowered from 70
  },
  NORMAL: {
    hpMultiplier: 1.0,
    recordingTimeMs: 3000,
    passThreshold: 60 // Lowered from 80
  },
  HARD: {
    hpMultiplier: 1.5,
    recordingTimeMs: 2500,
    passThreshold: 80 // Lowered from 90
  }
};

// Fallback images
export const FALLBACK_ULTRAMAN = "https://picsum.photos/seed/ultraman/400/600";
export const FALLBACK_MONSTER = "https://picsum.photos/seed/monster/400/600";

// Themed Backgrounds
export const MENU_BACKGROUND = "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1920&auto=format&fit=crop"; // Nebula M78 vibe
export const GAME_OVER_BACKGROUND = "https://images.unsplash.com/photo-1627556592933-ffe99c1cd9eb?q=80&w=1920&auto=format&fit=crop"; // Burning city/Apocalypse
export const VICTORY_BACKGROUND = "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1920&auto=format&fit=crop"; // Blue Earth/Space

export const BACKGROUNDS = [
  "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1518066000714-58c45f1a2c0a?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504333638930-c8787321eee0?q=80&w=1920&auto=format&fit=crop"
];

// Phonics Words
export const GRADE_1_WORDS_SET_1 = [
  "cat", "dog", "bat", "sun", "hat", "run", "sit", "map", "top", "pen",
  "bed", "red", "big", "pig", "box", "fox", "hot", "pot", "rug", "bug"
];

export const GRADE_1_WORDS_SET_2 = [
  "stop", "jump", "milk", "fast", "slow", "tree", "blue", "fish", "ship", "star",
  "play", "rain", "snow", "wind", "moon", "bird", "frog", "duck", "cake", "book"
];
