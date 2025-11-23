
import React, { useEffect, useState, useRef } from 'react';
import { Monster, Player, Difficulty } from '../types';
import { DIFFICULTY_CONFIG } from '../constants';
import { generateTTS } from '../services/genai';

interface BattleSceneProps {
  player: Player;
  monster: Monster;
  currentLetter: string;
  isWordChallenge: boolean;
  difficulty: Difficulty;
  onProcessAudio: (blob: Blob) => Promise<{ score: number }>;
  onAttackComplete: (score: number) => void;
  isProcessing: boolean;
  attackState: 'none' | 'player_attack' | 'monster_attack';
  attackVariant: 'emerium' | 'slugger' | 'wide';
  lastScore: number | null;
  backgroundUrl: string;
  isPaused: boolean;
}

// Sound Synthesizer Helper
const playSound = (type: 'charge' | 'laser' | 'explosion' | 'error' | 'success') => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'charge') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'laser') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'explosion') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.5);
  } else if (type === 'success') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554, now + 0.1); // C#
    osc.frequency.setValueAtTime(659, now + 0.2); // E
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  }
};

export const BattleScene: React.FC<BattleSceneProps> = ({
  player,
  monster,
  currentLetter,
  isWordChallenge,
  difficulty,
  onProcessAudio,
  onAttackComplete,
  isProcessing,
  attackState,
  attackVariant,
  lastScore,
  backgroundUrl,
  isPaused
}) => {
  // Local State
  const [timerProgress, setTimerProgress] = useState(100);
  const [phase, setPhase] = useState<'ready' | 'recording' | 'processing' | 'result'>('ready');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const ttsBufferRef = useRef<AudioBuffer | null>(null);
  const pausedStateRef = useRef<boolean>(false); // Track internal pause logic
  
  const config = DIFFICULTY_CONFIG[difficulty];

  // --- TTS Prefetch ---
  useEffect(() => {
    // When letter changes, prefetch the TTS audio
    const prefetch = async () => {
      ttsBufferRef.current = null; // Clear old
      const buffer = await generateTTS(currentLetter);
      ttsBufferRef.current = buffer;
    };
    if (currentLetter) {
      prefetch();
    }
  }, [currentLetter]);

  const playTTS = () => {
    if (ttsBufferRef.current) {
       const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
       if (!AudioContext) return;
       const ctx = new AudioContext();
       const source = ctx.createBufferSource();
       source.buffer = ttsBufferRef.current;
       source.connect(ctx.destination);
       source.start();
    }
  };

  // --- Game Loop Automation ---

  useEffect(() => {
    // Clean up on mount/unmount
    return () => stopEverything();
  }, []);

  // Handle Pause
  useEffect(() => {
    if (isPaused) {
      stopEverything();
      pausedStateRef.current = true;
    } else {
      if (pausedStateRef.current) {
        // Resume by restarting the turn cycle if we were interrupted
        // or just resetting to ready to ensure clean state
        pausedStateRef.current = false;
        startTurnCycle();
      }
    }
  }, [isPaused]);

  useEffect(() => {
    // Start cycle when letter changes or turn completes
    if (attackState === 'none' && !isProcessing && !isPaused) {
      startTurnCycle();
    }
  }, [currentLetter, attackState, isProcessing, isPaused]);

  const stopEverything = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
    }
  };

  const startTurnCycle = () => {
    setPhase('ready');
    setTimerProgress(100);
    
    // Small delay before recording starts to let user see the letter
    setTimeout(() => {
      if (!isPaused && !pausedStateRef.current) {
        startRecording();
      }
    }, 1500); 
  };

  const startRecording = async () => {
    if (isPaused) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // If we stopped because of Pause, do not process
        if (pausedStateRef.current) {
           stream.getTracks().forEach(t => t.stop());
           return;
        }

        setPhase('processing');
        // Ensure we have data
        if (chunksRef.current.length === 0) {
           console.warn("No audio recorded");
           setPhase('ready');
           startTurnCycle(); // Retry
           return;
        }

        // Use webm/audio explicitly
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        
        const result = await onProcessAudio(blob);
        
        // Result Handling
        setPhase('result');
        if (result.score >= config.passThreshold) playSound('success');
        else playSound('error');

        // Play Correct Pronunciation
        playTTS();

        // Notify parent to trigger attack logic
        onAttackComplete(result.score);
      };

      mediaRecorder.start();
      setPhase('recording');

      // Visual Timer
      const startTime = Date.now();
      const duration = config.recordingTimeMs;
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        if (isPaused) return; // Should be handled by useEffect but double check

        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setTimerProgress(remaining);
        
        if (elapsed >= duration) {
           if (timerRef.current) clearInterval(timerRef.current);
           stopRecording();
        }
      }, 50) as unknown as number;

    } catch (err) {
      console.error("Mic Error", err);
      // alert("Microphone access required!"); // annoying if looped
      setPhase('ready'); // Reset if error
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Trigger visual effects
  useEffect(() => {
    if (attackState === 'player_attack') playSound('laser');
    if (attackState === 'monster_attack') playSound('explosion');
  }, [attackState]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none overflow-hidden">
      
      {/* --- Dynamic Background --- */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
        style={{ backgroundImage: `url(${backgroundUrl})` }}
      >
         {/* Gradient Overlay for better UI contrast and blending */}
         <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"></div>
      </div>

      {/* --- HUD --- */}
      <div className="w-full flex justify-between items-start z-20 max-w-6xl mt-4 px-4">
        {/* Player Card */}
        <div className="flex flex-col items-start w-1/3 bg-slate-900/60 p-3 rounded-br-xl border-l-4 border-cyan-500 backdrop-blur-md shadow-lg transform skew-x-6">
          <div className="text-cyan-400 font-bold text-2xl font-arcade mb-1 tracking-widest -skew-x-6">{player.name}</div>
          <div className="w-full h-4 bg-gray-800 rounded-sm overflow-hidden border border-gray-600 relative -skew-x-6">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-white transition-all duration-500 shadow-[0_0_10px_cyan]"
              style={{ width: `${(player.currentHp / player.maxHp) * 100}%` }}
            />
          </div>
          <div className="text-xs font-bold text-white mt-1 -skew-x-6">{Math.round(player.currentHp)} / {player.maxHp}</div>
        </div>

        {/* VS / Timer */}
        <div className="flex flex-col items-center mt-2">
           <div className="text-5xl font-black text-yellow-500 italic drop-shadow-[0_0_15px_rgba(255,215,0,0.8)] font-arcade">VS</div>
           <div className="text-xs text-gray-300 font-mono mt-1 tracking-[0.2em] bg-black/50 px-2 rounded">{difficulty} MODE</div>
        </div>

        {/* Monster Card */}
        <div className="flex flex-col items-end w-1/3 bg-slate-900/60 p-3 rounded-bl-xl border-r-4 border-red-500 backdrop-blur-md shadow-lg transform -skew-x-6">
          <div className="text-red-500 font-bold text-2xl font-arcade mb-1 tracking-widest skew-x-6 text-right">{monster.name}</div>
          <div className="w-full h-4 bg-gray-800 rounded-sm overflow-hidden border border-gray-600 relative skew-x-6">
            <div 
              className="h-full bg-gradient-to-l from-red-700 via-red-500 to-orange-400 transition-all duration-500 shadow-[0_0_10px_red]"
              style={{ width: `${(monster.currentHp / monster.maxHp) * 100}%` }}
            />
          </div>
          <div className="text-xs font-bold text-white mt-1 skew-x-6">{Math.round(monster.currentHp)} / {monster.maxHp}</div>
        </div>
      </div>

      {/* --- BATTLE AREA --- */}
      <div className="relative flex-grow w-full max-w-7xl flex items-end justify-between px-8 pb-8 z-10">
        
        {/* Player Sprite Container */}
        <div className={`relative w-1/3 h-[50vh] md:h-[60vh] flex items-end justify-center transition-transform duration-200 ${attackState === 'monster_attack' ? 'shake-anim' : 'float-anim'}`}>
           {/* Ground Shadow */}
           <div className="absolute bottom-0 w-3/4 h-8 bg-black/60 blur-lg rounded-[100%]"></div>
           
           <img 
             src={player.imageUrl} 
             alt="Player" 
             className="h-full w-auto object-contain drop-shadow-[0_0_10px_rgba(0,255,255,0.2)] z-10"
           />
           
           {/* ATTACK: Emerium Beam (Single Letter) */}
           {attackState === 'player_attack' && attackVariant === 'emerium' && (
             <div className="emerium-beam" style={{ left: '55%', top: '20%' }} />
           )}

           {/* ATTACK: Zero Sluggers (Multi Letter) */}
           {attackState === 'player_attack' && attackVariant === 'slugger' && (
             <>
               <div className="slugger-projectile delay-0" style={{ left: '60%', top: '30%' }} />
               <div className="slugger-projectile delay-100" style={{ left: '60%', top: '50%' }} />
             </>
           )}

           {/* ATTACK: Wide Shot (Word/Boss) */}
           {attackState === 'player_attack' && attackVariant === 'wide' && (
             <div className="beam-attack w-[150%]" style={{ left: '60%', top: '40%' }} />
           )}
           
           {/* Hit marker */}
           {attackState === 'monster_attack' && (
             <div className="absolute top-1/3 left-0 text-6xl font-black text-red-500 damage-text stroke-white z-20">
               -HIT!
             </div>
           )}
        </div>

        {/* Center Interaction Area */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-50 w-full">
           
           {/* Last Score Feedback Popup */}
           {attackState !== 'none' && lastScore !== null && (
              <div className={`absolute -top-48 text-7xl font-black animate-bounce drop-shadow-[0_5px_5px_rgba(0,0,0,1)] font-arcade text-center ${lastScore >= config.passThreshold ? 'text-green-400' : 'text-red-500'}`}>
                  {lastScore >= config.passThreshold ? "CRITICAL!" : "MISS..."}
                  <div className="text-3xl text-white stroke-black stroke-2 mt-2">{lastScore} pts</div>
              </div>
           )}

           {/* Letter Display & Recorder */}
           <div className={`
              relative w-72 h-72 rounded-full flex flex-col items-center justify-center 
              bg-black/40 backdrop-blur-md border-[6px] transition-all duration-300
              ${phase === 'recording' && !isPaused ? 'border-red-500 shadow-[0_0_60px_red] scale-110' : 'border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.3)]'}
           `}>
             {/* Word Challenge Badge */}
             {isWordChallenge && (
               <div className="absolute -top-6 bg-yellow-600 text-white px-4 py-1 rounded border-2 border-yellow-400 font-bold animate-pulse shadow-[0_0_15px_gold]">
                 ⚠ WORD CHALLENGE ⚠
               </div>
             )}

             {/* Progress Ring */}
             <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
               <circle cx="50" cy="50" r="46" fill="none" stroke="#1e293b" strokeWidth="3" className="opacity-50" />
               {phase === 'recording' && !isPaused && (
                 <circle 
                   cx="50" cy="50" r="46" fill="none" stroke="#ef4444" strokeWidth="4" 
                   strokeDasharray="289"
                   strokeDashoffset={289 - (289 * timerProgress) / 100}
                   className="transition-all duration-100 ease-linear drop-shadow-[0_0_10px_red]"
                 />
               )}
             </svg>

             <div className="text-gray-300 text-sm font-bold uppercase tracking-[0.3em] mb-4 z-10 drop-shadow-md">PRONOUNCE</div>
             <div className={`font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)] z-10 leading-none text-center
                ${currentLetter.length > 3 ? 'text-4xl px-4 break-words' : currentLetter.length > 1 ? 'text-6xl' : 'text-9xl'}
             `}>
               {currentLetter}
             </div>

             {/* State Status Text */}
             <div className="absolute -bottom-14 text-xl font-bold text-white bg-black/80 px-6 py-2 rounded-full border border-gray-600 whitespace-nowrap">
               {isPaused ? <span className="text-yellow-400">PAUSED</span> : (
                 <>
                  {phase === 'ready' && "CHARGING..."}
                  {phase === 'recording' && <span className="text-red-400 animate-pulse flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full"></span> REC</span>}
                  {phase === 'processing' && <span className="text-yellow-400">ANALYZING...</span>}
                  {phase === 'result' && <span className={lastScore && lastScore > config.passThreshold ? "text-green-400" : "text-red-400"}>{lastScore !== null ? `${lastScore}% ACCURACY` : ""}</span>}
                 </>
               )}
             </div>

           </div>
        </div>

        {/* Monster Sprite Container */}
        <div className={`relative w-1/3 h-[50vh] md:h-[60vh] flex items-end justify-center transition-transform duration-200 ${attackState === 'player_attack' ? 'shake-anim' : 'float-anim'}`}>
           {/* Ground Shadow */}
           <div className="absolute bottom-0 w-3/4 h-8 bg-black/60 blur-lg rounded-[100%]"></div>

           <img 
             src={monster.imageUrl} 
             alt="Monster" 
             className="h-full w-auto object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.3)] z-10"
             style={{ transform: 'scaleX(-1)' }} // Flip monster to face left
           />
            {/* Monster Attack Effect */}
           {attackState === 'monster_attack' && (
             <div className="monster-attack" style={{ right: '20%', top: '30%' }} />
           )}
           {/* Hit marker */}
           {attackState === 'player_attack' && (
             <div className="absolute top-1/3 right-0 text-6xl font-black text-yellow-400 damage-text stroke-black z-20">
               {lastScore && lastScore > 90 ? "CRITICAL!" : "DAMAGE!"}
             </div>
           )}
        </div>
      </div>
      
      {/* Screen Effects (Vignette & Scanlines) */}
      <div className="absolute inset-0 pointer-events-none z-30 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)]"></div>
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-30 background-size-[100%_2px,3px_100%]" />
    </div>
  );
};
