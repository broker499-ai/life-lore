import { useState } from 'react';
import type { GameState } from '@/core/state/GameState';
import { createPrototypeGameState } from '@/core/state/createPrototypeGameState';
import {
  getCampaignSaveStatus,
  getDefaultCampaignUiSnapshot,
  loadCampaignSnapshot,
  type CampaignUiSnapshot,
} from '@/services/saves/CampaignStorage';
import { CampaignScreen } from '@/ui/screens/CampaignScreen';
import { LeaderSelectScreen } from '@/ui/screens/LeaderSelectScreen';
import { MainMenuScreen } from '@/ui/screens/MainMenuScreen';
import { IntroCutscene } from '@/ui/screens/IntroCutscene';

type AppScreen = 'menu' | 'leader-select' | 'intro' | 'campaign';

export function App() {
  const [screen, setScreen] = useState<AppScreen>('menu');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [campaignUi, setCampaignUi] = useState<CampaignUiSnapshot>(getDefaultCampaignUiSnapshot());

  if (screen === 'menu') {
    const saveStatus = getCampaignSaveStatus();
    return (
      <MainMenuScreen
        saveStatus={saveStatus}
        onNewGame={() => setScreen('leader-select')}
        onContinue={() => {
          const snapshot = loadCampaignSnapshot();
          if (!snapshot) return;
          setGameState(snapshot.state);
          setCampaignUi(snapshot.ui);
          setScreen('campaign');
        }}
      />
    );
  }

  if (screen === 'leader-select') {
    return (
      <LeaderSelectScreen
        onBack={() => setScreen('menu')}
        onStart={(leaderId) => {
          const seed = Date.now() >>> 0;
          setGameState(createPrototypeGameState(seed, leaderId));
          setCampaignUi(getDefaultCampaignUiSnapshot());
          setScreen('intro');
        }}
      />
    );
  }


  if (screen === 'intro') {
    return <IntroCutscene onComplete={() => setScreen('campaign')} />;
  }

  if (!gameState) {
    return (
      <MainMenuScreen
        saveStatus={getCampaignSaveStatus()}
        onNewGame={() => setScreen('leader-select')}
        onContinue={() => {
          const snapshot = loadCampaignSnapshot();
          if (!snapshot) return;
          setGameState(snapshot.state);
          setCampaignUi(snapshot.ui);
          setScreen('campaign');
        }}
      />
    );
  }

  return (
    <CampaignScreen
      initialState={gameState}
      initialUi={campaignUi}
      onExit={() => setScreen('menu')}
    />
  );
}
