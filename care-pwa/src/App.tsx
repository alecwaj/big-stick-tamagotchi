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

  // No token = genuinely new user → show welcome
  // Token but no worm after loading = API unreachable, not a new user
  if (!token) return <WelcomeScreen />;
  if (!worm) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100dvh',
      background: 'linear-gradient(160deg, #06000f 0%, #0a0020 50%, #060010 100%)',
      color: 'rgba(255,0,85,0.8)',
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 8, gap: 24, padding: 32, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>🪱</div>
      <p>hive signal lost</p>
      <p style={{ color: 'rgba(150,150,200,0.5)', fontSize: 7, lineHeight: 2 }}>
        make sure the acceptance studio is on{"\n"}and you&apos;re on the same wifi
      </p>
    </div>
  );

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
