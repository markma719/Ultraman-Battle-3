
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Monster, Player, TOTAL_LEVELS, Difficulty, ScoreEntry } from './types';
import { MONSTER_PROMPTS, ULTRAMAN_IMAGE_PROMPT, LETTERS, FALLBACK_MONSTER, FALLBACK_ULTRAMAN, DIFFICULTY_CONFIG, BACKGROUNDS, GRADE_1_WORDS_SET_1, GRADE_1_WORDS_SET_2, MENU_BACKGROUND, GAME_OVER_BACKGROUND, VICTORY_BACKGROUND } from './constants';
import { generateMonsterImage, generateUltramanImage, checkPronunciation } from './services/genai';
import { BattleScene } from './components/BattleScene';

// --- Helper: Challenge Generator ---
interface Challenge {
  text: string;
  multiplier: number;
}

class ChallengeGenerator {
  private letters = [...LETTERS];
  private words1 = [...GRADE_1_WORDS_SET_1];
  private words2 = [...GRADE_1_WORDS_SET_2];
  private allWords = [...GRADE_1_WORDS_SET_1, ...GRADE_1_WORDS_SET_2];

  getChallenge(): Challenge {
    const rand = Math.random();

    // 25% Single Letter (0.8x damage - INCREASED)
    if (rand < 0.25) {
      return { 
        text: this.getRandom(this.letters), 
        multiplier: 0.8 
      };
    } 
    // 25% Two Letters (1x damage)
    else if (rand < 0.5) {
      return { 
        text: this.getRandom(this.letters) + this.getRandom(this.letters), 
        multiplier: 1.0 
      };
    } 
    // 25% Three Letters (2x damage)
    else if (rand < 0.75) {
      return { 
        text: this.getRandom(this.letters) + this.getRandom(this.letters) + this.getRandom(this.letters), 
        multiplier: 2.0 
      };
    } 
    // 25% Full Word (4x damage)
    else {
      return { 
        text: this.getRandom(this.allWords).toUpperCase(), 
        multiplier: 4.0 
      };
    }
  }

  private getRandom(arr: string[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

const App: React.FC = () => {
  // --- App State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  
  const [level, setLevel] = useState(1);
  const [player, setPlayer] = useState<Player>({
    name: "Ultraman Zero",
    imageUrl: FALLBACK_ULTRAMAN,
    maxHp: 100,
    currentHp: 100
  });
  const [monster, setMonster] = useState<Monster>({
    name: "Loading...",
    imageUrl: FALLBACK_MONSTER,
    maxHp: 50,
    currentHp: 50,
    level: 1
  });
  
  // Gameplay State
  const [currentChallenge, setCurrentChallenge] = useState<string>('A');
  const [damageMultiplier, setDamageMultiplier] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attackState, setAttackState] = useState<'none' | 'player_attack' | 'monster_attack'>('none');
  const [attackVariant, setAttackVariant] = useState<'emerium' | 'slugger' | 'wide'>('emerium');
  const [loadingMessage, setLoadingMessage] = useState("");
  const [lastScore, setLastScore] = useState<number | null>(null);

  // Logic Refs
  const challengeGen = useRef(new ChallengeGenerator());

  // --- Initialization ---

  useEffect(() => {
    const init = async () => {
      const storedLb = localStorage.getItem('ultraman_leaderboard');
      if (storedLb) {
        setLeaderboard(JSON.parse(storedLb));
      }
      // Auto-init player image in background
      initPlayerImage();
    };
    init();
  }, []);

  const initPlayerImage = async () => {
      const img = await generateUltramanImage(ULTRAMAN_IMAGE_PROMPT);
      setPlayer(p => ({ ...p, imageUrl: img }));
  };

  // --- Game Logic ---

  const saveScore = () => {
    const newEntry: ScoreEntry = {
      date: new Date().toLocaleDateString(),
      score: score,
      difficulty: difficulty
    };
    const newLb = [...leaderboard, newEntry].sort((a, b) => b.score - a.score).slice(0, 5);
    setLeaderboard(newLb);
    localStorage.setItem('ultraman_leaderboard', JSON.stringify(newLb));
  };

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    setScore(0);
    setLevel(1);
    setPlayer(p => ({ ...p, currentHp: p.maxHp, maxHp: 100 })); // Reset player
    setIsPaused(false);
    startLevel(1, diff);
  };

  const startLevel = async (lvl: number, diff: Difficulty) => {
    setGameState(GameState.GENERATING_LEVEL);
    setLoadingMessage(`WARNING! Level ${lvl} Kaiju Approaching!`);
    
    const prompt = MONSTER_PROMPTS[lvl - 1];
    const imgUrl = await generateMonsterImage(lvl, prompt);
    
    const isBoss = lvl === 10;
    // HP Formula: Increased by 6x as requested
    const baseHp = (40 + (lvl * 15)) * 6;
    const hp = Math.round(baseHp * DIFFICULTY_CONFIG[diff].hpMultiplier);

    const newMonster: Monster = {
      name: isBoss ? "BELIAL ATROCIOUS" : `KAIJU LEVEL ${lvl}`,
      imageUrl: imgUrl,
      maxHp: hp,
      currentHp: hp,
      level: lvl
    };

    setMonster(newMonster);
    
    // Heal player slightly 
    setPlayer(p => ({...p, currentHp: Math.min(p.maxHp, p.currentHp + 20)}));
    
    nextChallenge();
    setGameState(GameState.PLAYING);
  };

  const nextChallenge = () => {
    const challenge = challengeGen.current.getChallenge();
    setCurrentChallenge(challenge.text);
    setDamageMultiplier(challenge.multiplier);
    setAttackState('none');
    setLastScore(null);
  };

  // Called by BattleScene when audio is recorded
  const handleProcessAudio = async (audioBlob: Blob): Promise<{ score: number }> => {
    setIsProcessing(true);
    
    // Convert to Base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        // Handle potential data URI prefix
        const base64Data = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;

        const result = await checkPronunciation(base64Data, currentChallenge);
        setIsProcessing(false);
        setLastScore(result.score);
        resolve({ score: result.score });
      };
    });
  };

  // Called by BattleScene after score is determined and animation delay
  const handleAttackComplete = (scoreVal: number) => {
    const threshold = DIFFICULTY_CONFIG[difficulty].passThreshold;
    
    if (scoreVal >= threshold) {
      // Player Attacks
      
      // Determine Attack Variant
      if (damageMultiplier >= 4.0) {
        setAttackVariant('wide');
      } else if (damageMultiplier >= 1.0) {
        setAttackVariant('slugger');
      } else {
        setAttackVariant('emerium');
      }

      setAttackState('player_attack');
      
      // Damage logic
      setTimeout(() => {
        const baseDamage = 20 + (scoreVal >= 90 ? 10 : 0); // Crit bonus
        const finalDamage = Math.round(baseDamage * damageMultiplier);
        
        const newMonsterHp = Math.max(0, monster.currentHp - finalDamage);
        
        setMonster(m => ({ ...m, currentHp: newMonsterHp }));
        setScore(s => s + (finalDamage * 10) + (scoreVal));

        if (newMonsterHp === 0) {
          handleLevelWin();
        } else {
          setTimeout(() => nextChallenge(), 1500);
        }
      }, 800); // Wait for beam animation

    } else {
      // Monster Attacks
      setAttackState('monster_attack');
      setTimeout(() => {
        const damage = 15;
        const newPlayerHp = Math.max(0, player.currentHp - damage);
        
        setPlayer(p => ({ ...p, currentHp: newPlayerHp }));

        if (newPlayerHp === 0) {
          handleGameOver();
        } else {
           setTimeout(() => nextChallenge(), 1500);
        }
      }, 800); // Wait for attack animation
    }
  };

  // --- End Game Sequences ---

  const handleLevelWin = () => {
    setAttackState('none');
    if (level === TOTAL_LEVELS) {
      handleGameWin();
    } else {
      setGameState(GameState.LEVEL_COMPLETE);
    }
  };

  const nextLevel = () => {
    const nextLvl = level + 1;
    setLevel(nextLvl);
    startLevel(nextLvl, difficulty);
  };

  const handleGameWin = async () => {
    saveScore();
    setGameState(GameState.GAME_WON);
  };

  const handleGameOver = async () => {
    saveScore();
    setGameState(GameState.GAME_OVER);
  };

  // --- Background Selector ---
  const currentBg = BACKGROUNDS[(level - 1) % BACKGROUNDS.length];

  // --- Views ---

  if (gameState === GameState.MENU) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(${MENU_BACKGROUND})` }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 flex flex-col items-center text-center px-4">
            <h1 className="text-6xl md:text-8xl font-arcade text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] mb-4 animate-pulse">
            ULTRAMAN<br/>ZERO
            </h1>
            <h2 className="text-2xl font-bold text-white tracking-widest mb-8 border-b-2 border-cyan-500 pb-2">PHONICS BATTLE</h2>
            
            <button 
              onClick={() => setGameState(GameState.DIFFICULTY_SELECT)}
              className="px-12 py-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-2xl rounded-sm skew-x-[-10deg] shadow-[0_0_30px_rgba(220,38,38,0.6)] transition-all mb-4 transform hover:scale-110"
            >
              <span className="block skew-x-[10deg]">START MISSION</span>
            </button>

            <button 
              onClick={() => setGameState(GameState.LEADERBOARD)}
              className="text-cyan-400 hover:text-white underline font-mono tracking-wider"
            >
              VIEW LEADERBOARD
            </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.DIFFICULTY_SELECT) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white bg-cover bg-center"
        style={{ backgroundImage: `url(${MENU_BACKGROUND})` }}
      >
        <div className="absolute inset-0 bg-black/80"></div>
        <div className="z-10 flex flex-col items-center">
            <h2 className="text-4xl font-arcade text-yellow-400 mb-8 drop-shadow-[0_0_10px_yellow]">SELECT DIFFICULTY</h2>
            <div className="flex flex-col md:flex-row gap-6">
            {[Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD].map(diff => (
                <button
                key={diff}
                onClick={() => startGame(diff)}
                className={`
                    w-64 h-32 rounded-xl border-2 flex flex-col items-center justify-center transition-all hover:scale-105 backdrop-blur-md
                    ${diff === Difficulty.EASY ? 'border-green-400 bg-green-900/40 hover:bg-green-900/60 shadow-[0_0_15px_green]' : ''}
                    ${diff === Difficulty.NORMAL ? 'border-blue-400 bg-blue-900/40 hover:bg-blue-900/60 shadow-[0_0_15px_blue]' : ''}
                    ${diff === Difficulty.HARD ? 'border-red-400 bg-red-900/40 hover:bg-red-900/60 shadow-[0_0_15px_red]' : ''}
                `}
                >
                <span className="text-2xl font-bold font-arcade">{diff}</span>
                <span className="text-xs text-gray-300 mt-2 font-mono">
                    {diff === Difficulty.EASY && "Slow Speed • Low HP"}
                    {diff === Difficulty.NORMAL && "Standard Speed"}
                    {diff === Difficulty.HARD && "Fast Speed • High HP"}
                </span>
                </button>
            ))}
            </div>
            <button onClick={() => setGameState(GameState.MENU)} className="mt-12 text-gray-400 hover:text-white">Cancel</button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.LEADERBOARD) {
     return (
       <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
          <h2 className="text-4xl font-arcade text-cyan-400 mb-8">TOP COMMANDERS</h2>
          <div className="bg-black/50 p-8 rounded-xl border border-gray-700 w-full max-w-md">
             {leaderboard.length === 0 ? (
               <div className="text-center text-gray-500">No records yet.</div>
             ) : (
               leaderboard.map((entry, i) => (
                 <div key={i} className="flex justify-between border-b border-gray-800 py-3 last:border-0">
                    <span className="text-yellow-500 font-bold">#{i+1}</span>
                    <span>{entry.score} pts</span>
                    <span className="text-xs text-gray-400 pt-1">{entry.difficulty} - {entry.date}</span>
                 </div>
               ))
             )}
          </div>
          <button onClick={() => setGameState(GameState.MENU)} className="mt-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded">Back</button>
       </div>
     );
  }

  if (gameState === GameState.GENERATING_LEVEL) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white">
        <div className="w-20 h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_20px_cyan]"></div>
        <h2 className="text-2xl font-bold text-cyan-400 animate-pulse tracking-widest">{loadingMessage}</h2>
        <p className="text-gray-500 mt-2">Accessing Ultra Database...</p>
      </div>
    );
  }

  if (gameState === GameState.PLAYING) {
    return (
      <div className="h-screen w-full overflow-hidden relative">
        {/* Pause Button */}
        <button 
          onClick={() => setIsPaused(true)}
          className="absolute top-4 right-4 z-[60] bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full border border-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Pause Overlay */}
        {isPaused && (
           <div className="absolute inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
              <h2 className="text-6xl font-arcade text-yellow-400 mb-8 tracking-widest">PAUSED</h2>
              <button 
                onClick={() => setIsPaused(false)}
                className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xl rounded mb-4 w-64"
              >
                RESUME
              </button>
              <button 
                onClick={() => { setIsPaused(false); setGameState(GameState.MENU); }}
                className="px-12 py-4 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-bold text-xl rounded w-64"
              >
                ABORT MISSION
              </button>
           </div>
        )}

        {/* Game UI */}
        <div className="absolute top-4 left-4 z-50 text-yellow-400 font-arcade text-xl drop-shadow-md">SCORE: {score}</div>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
            <span className="text-xs font-mono text-gray-400 bg-black/50 px-2 rounded border border-gray-700">POWER x{damageMultiplier}</span>
        </div>
        <BattleScene 
          player={player}
          monster={monster}
          currentLetter={currentChallenge}
          isWordChallenge={damageMultiplier === 4.0}
          difficulty={difficulty}
          onProcessAudio={handleProcessAudio}
          onAttackComplete={handleAttackComplete}
          isProcessing={isProcessing}
          attackState={attackState}
          attackVariant={attackVariant}
          lastScore={lastScore}
          backgroundUrl={currentBg}
          isPaused={isPaused}
        />
      </div>
    );
  }

  if (gameState === GameState.LEVEL_COMPLETE) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl text-white">
        <h2 className="text-6xl font-arcade text-yellow-400 mb-4 drop-shadow-[0_0_10px_yellow]">VICTORY!</h2>
        <p className="text-2xl mb-8">{monster.name} Destroyed!</p>
        <div className="text-4xl font-bold mb-8">Score: {score}</div>
        <button 
          onClick={nextLevel}
          className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xl rounded-lg shadow-[0_0_20px_cyan]"
        >
          NEXT MISSION ({level + 1}/{TOTAL_LEVELS})
        </button>
      </div>
    );
  }

  if (gameState === GameState.GAME_WON) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center justify-center bg-cyan-900/50 bg-cover bg-center"
        style={{ backgroundImage: `url(${VICTORY_BACKGROUND})` }}
      >
         <div className="absolute inset-0 bg-black/60"></div>
         <div className="z-10 text-center">
             <h1 className="text-7xl font-arcade text-yellow-400 mb-4 drop-shadow-lg">UNIVERSE SAVED!</h1>
             <div className="text-9xl mb-8">🏆</div>
             <h3 className="text-4xl text-white font-bold mb-8">FINAL SCORE: {score}</h3>
             
             <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => setGameState(GameState.LEADERBOARD)}
                  className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded font-bold shadow-lg"
                >
                  LEADERBOARD
                </button>
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="px-8 py-3 border-2 border-white text-white hover:bg-white hover:text-black transition-colors font-bold"
                >
                  MAIN MENU
                </button>
             </div>
         </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center justify-center bg-red-900/50 bg-cover bg-center"
        style={{ backgroundImage: `url(${GAME_OVER_BACKGROUND})` }}
      >
         <div className="absolute inset-0 bg-black/60"></div>
         <div className="z-10 text-center animate-pulse">
             <h1 className="text-7xl font-arcade text-red-600 mb-4 drop-shadow-[0_0_15px_red]">MISSION FAILED</h1>
             <div className="text-9xl mb-8">☠️</div>
             <h3 className="text-3xl text-white font-bold mb-8">FINAL SCORE: {score}</h3>
             
             <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => startGame(difficulty)} // Retry same difficulty
                  className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded font-bold shadow-lg"
                >
                  RETRY
                </button>
                <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="px-8 py-3 border-2 border-white text-white hover:bg-white hover:text-black transition-colors font-bold"
                >
                  MAIN MENU
                </button>
             </div>
         </div>
      </div>
    );
  }

  return <div>Loading...</div>;
};

export default App;
