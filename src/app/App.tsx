import { useState } from 'react';
import type { GameState } from '@/core/state/GameState';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import { CampaignScreen } from '@/ui/screens/CampaignScreen';
import { LeaderSelectScreen } from '@/ui/screens/LeaderSelectScreen';
import { MainMenuScreen } from '@/ui/screens/MainMenuScreen';

type AppScreen = 'menu' | 'leader-select' | 'campaign';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);

  if (screen === 'menu') {
    return <MainMenuScreen onNewGame={() => setScreen('leader-select')} />;
  }

  if (screen === 'leader-select') {
    return (
      <LeaderSelectScreen
        onBack={() => setScreen('menu')}
        onStart={(leaderId) => {
          const seed = Date.now() >>> 0;
          setGameState(createPrototypeGameState(seed, leaderId));
          setScreen('campaign');
        }}
      />
    );
  }

  if (!gameState) {
    return <MainMenuScreen onNewGame={() => setScreen('leader-select')} />;
  }

  return <CampaignScreen initialState={gameState} onExit={() => setScreen('menu')} />;
}
