import { useMemo, useState } from 'react';
import { useWorm } from './hooks/useWorm';
import { CareScreen } from './components/CareScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GameMenu } from './components/games/GameMenu';
import { WiggleRace } from './components/games/WiggleRace';
import { BugCatch } from './components/games/BugCatch';
import { MemoryMunch } from './components/games/MemoryMunch';
import { FriendsScreen } from './components/FriendsScreen';
import type { GameId, GameResult } from './components/games/gameTypes';

type Screen = 'care' | 'game-menu' | 'friends' | GameId;

function getToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    localStorage.setItem('worm_token', urlToken);
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    return urlToken;
  }
  return localStorage.getItem('worm_token');
}

export default function App() {
  const token = useMemo(() => getToken(), []);
  const { worm, loading, hatch, feed, cuddle, completeGame, heal, addFriend } = useWorm(token);
  const [screen, setScreen] = useState<Screen>('care');

  // Loading state — show spinner while fetching from API
  if (loading && !worm) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100dvh',
        background: 'linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%)',
        color: 'rgba(0,245,255,0.6)',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
      }}>
        loading...
      </div>
    );
  }

  if (!token || !worm) return <WelcomeScreen />;

  const handleGameComplete = (result: GameResult) => {
    completeGame(result.xpGained, result.moodBoost);
    setScreen('care');
  };

  const gameProps = { onComplete: handleGameComplete, onExit: () => setScreen('care') };

  return (
    <>
      <CareScreen
        worm={worm}
        onFeed={feed}
        onCuddle={cuddle}
        onOpenGames={() => setScreen('game-menu')}
        onOpenFriends={() => setScreen('friends')}
        onHeal={heal}
        onHatch={hatch}
      />

      {screen === 'game-menu' && (
        <GameMenu onSelect={(id) => setScreen(id)} onClose={() => setScreen('care')} />
      )}
      {screen === 'friends' && (
        <FriendsScreen
          myToken={worm.token}
          friends={worm.friends}
          onAddFriend={addFriend}
          onClose={() => setScreen('care')}
        />
      )}
      {screen === 'wiggle-race'  && <WiggleRace  {...gameProps} />}
      {screen === 'bug-catch'    && <BugCatch    {...gameProps} />}
      {screen === 'memory-munch' && <MemoryMunch {...gameProps} />}
    </>
  );
}
