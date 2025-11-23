
export enum GameState {
  MENU = 'MENU',
  DIFFICULTY_SELECT = 'DIFFICULTY_SELECT',
  GENERATING_LEVEL = 'GENERATING_LEVEL',
  PLAYING = 'PLAYING',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
  GAME_OVER = 'GAME_OVER',
  GAME_WON = 'GAME_WON',
  LEADERBOARD = 'LEADERBOARD'
}

export enum Difficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export interface Monster {
  name: string;
  imageUrl: string;
  maxHp: number;
  currentHp: number;
  level: number;
}

export interface Player {
  name: string;
  imageUrl: string;
  maxHp: number;
  currentHp: number;
}

export interface PronunciationResult {
  correct: boolean;
  score: number; // 0-100
  heard?: string;
}

export interface ScoreEntry {
  date: string;
  score: number;
  difficulty: Difficulty;
}

export const TOTAL_LEVELS = 10;
