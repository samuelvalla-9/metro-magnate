import { useState, useEffect, useRef, useCallback } from "react";
import { COLOR_GROUPS, TOKENS, PLAYER_COLORS } from "./gameData";
import "./index.css";

// ─── WS HOOK ─────────────────────────────────────
function useGameSocket(serverUrl) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const listeners = useRef({});
  const on = useCallback((type, fn) => { listeners.current[type] = fn; }, []);
  const send = useCallback((msg) => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(msg));
  }, []);
  const connect = useCallback(() => {
    ws.current = new WebSocket(serverUrl);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (listeners.current[msg.type]) listeners.current[msg.type](msg);
      } catch {}
    };
  }, [serverUrl]);
  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);
  return { connected, send, on };
}

// ─── PWA INSTALL HOOK ────────────────────────────
function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check for iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (isIOSDevice && !isStandalone) {
      setIsIOS(true);
      setIsInstallable(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (isIOS) return 'ios';
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  return { isInstallable, isIOS, install };
}

const SCREENS = { HOME: 'home', LOBBY: 'lobby', GAME: 'game', WIN: 'win' };

function getCellPos(idx, totalCells) {
  const c = totalCells / 4;
  if (idx <= c) return { row: c, col: c - idx };
  if (idx <= c * 2) return { row: c - (idx - c), col: 0 };
  if (idx <= c * 3) return { row: 0, col: idx - c * 2 };
  return { row: idx - c * 3, col: c };
}

// ─── SEQUENTIAL ANIMATION MANAGER ────────────────
// Strictly sequential: roll die (2s) → show total (0.8s pause) → pawn hops → idle
function useAnimationSequence() {
  const [phase, setPhase] = useState('idle');
  const [dieDisplay, setDieDisplay] = useState(2);
  const [finalTotal, setFinalTotal] = useState(null);
  const [animPos, setAnimPos] = useState({});
  const timerRef = useRef([]);

  function clearAll() {
    timerRef.current.forEach(id => clearInterval(id));
    timerRef.current.forEach(id => clearTimeout(id));
    timerRef.current = [];
  }

  function startSequence(playerId, fromPos, toPos, targetTotal, onComplete, boardLength = 40) {
    clearAll();
    setFinalTotal(null);
    setPhase('rolling');
    setAnimPos(prev => ({ ...prev, [playerId]: fromPos }));

    let ticks = 0;
    const iv = setInterval(() => {
      setDieDisplay(Math.ceil(Math.random() * 12));
      ticks++;
      if (ticks >= 22) {
        clearInterval(iv);
        setDieDisplay(targetTotal);
        setFinalTotal(targetTotal);
        setPhase('show-total');
        
        const pause = setTimeout(() => {
          setPhase('moving');
          const steps = [];
          if (((toPos - fromPos + boardLength) % boardLength) > Math.floor(boardLength / 3)) {
            // Must be a jump (Jail, Card), skip step-by-step
            steps.push(toPos);
          } else {
            let p = fromPos;
            while (p !== toPos) { p = (p + 1) % boardLength; steps.push(p); }
          }
          if (steps.length === 0) { 
            setPhase('idle'); 
            onComplete?.(); 
            return; 
          }
          let i = 0;
          const iv2 = setInterval(() => {
            setAnimPos(prev => ({ ...prev, [playerId]: steps[i] }));
            i++;
            if (i >= steps.length) {
              clearInterval(iv2);
              const pause2 = setTimeout(() => {
                setPhase('idle');
                onComplete?.();
              }, 400);
              timerRef.current.push(pause2);
            }
          }, 320);
          timerRef.current.push(iv2);
        }, 900);
        timerRef.current.push(pause);
      }
    }, 90);
    timerRef.current.push(iv);
  }

  function reset() {
    clearAll();
    setPhase('idle');
    setAnimPos({});
    setDieDisplay(2);
    setFinalTotal(null);
  }

  return { phase, dieDisplay, finalTotal, animPos, startSequence, reset };
}

export default function App() {
  const WS_URL = import.meta.env.VITE_WS_URL || `wss://${window.location.host}`;
  const { connected, send, on } = useGameSocket(WS_URL);

  const [screen, setScreen] = useState(SCREENS.HOME);
  const [myId, setMyId] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [serverPlayers, setServerPlayers] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);
  const [myName, setMyName] = useState('');
  const [myToken, setMyToken] = useState(TOKENS[0]);
  const [shareLink, setShareLink] = useState('');
  const [roomPlayers, setRoomPlayers] = useState([]);

  const anim = useAnimationSequence();
  const pendingState = useRef(null);
  // track who is currently rolling so we know whether to show overlay
  const [rollingPlayerId, setRollingPlayerId] = useState(null);
  const [initialJoinCode, setInitialJoinCode] = useState('');

  const pwa = usePWAInstall();

  // Handle URL parameters for joining
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) setInitialJoinCode(code.toUpperCase());
  }, []);

  // Reconnect on mount if session exists
  useEffect(() => {
    if (connected) {
      const savedRoom = localStorage.getItem('metro_room');
      const savedId = localStorage.getItem('metro_id');
      if (savedRoom && savedId && !myId) {
        send({ type: 'join', code: savedRoom, playerId: savedId });
      }
    }
  }, [connected, send, myId]);

  useEffect(() => {
    on('created', (msg) => {
      localStorage.setItem('metro_room', msg.code);
      localStorage.setItem('metro_id', msg.playerId);
      setMyId(msg.playerId); setRoomCode(msg.code); setIsHost(true); setShareLink(`${window.location.origin}?join=${msg.code}`); setScreen(SCREENS.LOBBY);
    });
    on('joined', (msg) => {
      localStorage.setItem('metro_room', msg.code);
      localStorage.setItem('metro_id', msg.playerId);
      setMyId(msg.playerId); setRoomCode(msg.code); setScreen(SCREENS.LOBBY);
    });
    on('lobby', (msg) => { setRoomPlayers(msg.players); setLobbyPlayers(msg.players); setIsHost(msg.host === myId); });
    on('state', (msg) => {
      setServerPlayers(msg.players);
      if (msg.state.winner) {
        localStorage.removeItem('metro_room');
        localStorage.removeItem('metro_id');
        setGameState(msg.state); setScreen(SCREENS.WIN); return;
      }
      setScreen(SCREENS.GAME);

      setGameState(prev => {
        if (!prev) return msg.state;

        let moverId = null, fromPos = null, toPos = null;
        msg.state.players.forEach(newP => {
          const oldP = prev.players.find(p => p.id === newP.id);
          if (oldP && oldP.pos !== newP.pos) { moverId = newP.id; fromPos = oldP.pos; toPos = newP.pos; }
        });

        if (moverId !== null) {
          const total = msg.state.dice.length > 1 ? msg.state.dice[0] + msg.state.dice[1] : msg.state.dice[0];
          const blen = msg.state.board?.length || 40;
          setRollingPlayerId(moverId);
          anim.startSequence(moverId, fromPos, toPos, total, () => {
            setRollingPlayerId(null);
          }, blen);
        }

        // Update component state immediately; MobileBoard uses animPos for visual display
        return msg.state; 
      });
    });
    on('error', (msg) => {
      if (msg.msg === 'Room not found' || msg.msg === 'Game already started') {
        localStorage.removeItem('metro_room');
        localStorage.removeItem('metro_id');
      }
      if (msg.msg === 'duplicate_emoji') setError(`⚠ Emoji ${msg.playerToken} is taken. Choose another.`);
      else showToast(msg.msg, 'error');
    });
    on('player_disconnected', (msg) => { showToast(`${msg.name} disconnected`, 'warn'); });
  }, [on, myId, connected, send]);

  useEffect(() => {
    if (lobbyPlayers.length && myId) setIsHost(lobbyPlayers[0]?.id === myId);
  }, [lobbyPlayers, myId]);

  function showToast(msg, type = 'info') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }
  function createRoom(settings) { if (!myName.trim()) { setError('Enter your name'); return; } send({ type: 'create', name: myName.trim(), token: myToken, color: PLAYER_COLORS[0], settings }); }
  function joinRoom(code, checkPlayers = []) {
    if (!myName.trim()) { setError('Enter your name'); return; }
    if (!code) { setError('Enter a room code'); return; }
    if (checkPlayers.some(p => p.token === myToken)) { setError(`⚠ Emoji ${myToken} is taken. Choose another.`); return; }
    const colorIdx = Math.floor(Math.random() * PLAYER_COLORS.length);
    send({ type: 'join', code: code.toUpperCase(), name: myName.trim(), token: myToken, color: PLAYER_COLORS[colorIdx] });
  }
  function startGame() { send({ type: 'start' }); }
  function dispatch(type, extra = {}) { send({ type, ...extra }); }

  const myPlayer = gameState?.players.find(p => p.id === myId);
  const currentPlayer = gameState?.players[gameState?.currentIdx];
  const isMyTurn = currentPlayer?.id === myId;
  // Only show full-screen overlay to the player who is rolling
  const iAmRolling = rollingPlayerId === myId;

  return (
    <div className="app">
      {screen === SCREENS.HOME && (
        <HomeScreen
          myName={myName} setMyName={setMyName}
          myToken={myToken} setMyToken={setMyToken}
          connected={connected}
          error={error} setError={setError}
          onCreate={createRoom} onJoin={joinRoom}
          roomPlayers={roomPlayers}
          initialJoinCode={initialJoinCode}
          pwa={pwa}
        />
      )}
      {screen === SCREENS.LOBBY && <LobbyScreen code={roomCode} players={lobbyPlayers} isHost={isHost} onStart={startGame} myId={myId} shareLink={shareLink} myToken={myToken} setMyToken={setMyToken} />}
      {screen === SCREENS.GAME && gameState && (
        <GameScreen
          state={gameState} serverPlayers={serverPlayers}
          myId={myId} myPlayer={myPlayer}
          isMyTurn={isMyTurn} dispatch={dispatch}
          modal={modal} setModal={setModal}
          anim={anim} iAmRolling={iAmRolling}
        />
      )}
      {screen === SCREENS.WIN && gameState && <WinScreen state={gameState} onRestart={() => { setScreen(SCREENS.HOME); setGameState(null); anim.reset(); }} />}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ═══ HOME ═══════════════════════════════════════
function HomeScreen({ myName, setMyName, myToken, setMyToken, connected, error, setError, onCreate, onJoin, roomPlayers = [], initialJoinCode = '', pwa }) {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [tab, setTab] = useState(initialJoinCode ? 'join' : 'create');

  useEffect(() => {
    if (initialJoinCode) {
      setJoinCode(initialJoinCode);
      setTab('join');
    }
  }, [initialJoinCode]);

  const [rounds, setRounds] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  return (
    <div className="home-screen">
      <div className="home-bg-grid" />
      <div className="home-content">
        <div className="home-logo">
          <div className="logo-text">METRO</div>
          <div className="logo-accent">MAGNATE</div>
          <div className="logo-tagline">The City Empire Game</div>
        </div>
        <div className="home-card">
          <div className="ws-status"><span className={`ws-dot ${connected ? 'on' : 'off'}`} />{connected ? 'Server connected' : 'Connecting…'}</div>
          <div className="input-group"><label>Your Name</label><input className="input-field" placeholder="Enter your name" value={myName} onChange={e => { setMyName(e.target.value); setError(''); }} maxLength={20} /></div>
          <div className="input-group"><label>Your Token</label>
            <div className="token-grid">{TOKENS.map(t => <button key={t} className={`token-btn ${myToken === t ? 'active' : ''}`} onClick={() => setMyToken(t)}>{t}</button>)}</div>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="tab-row">
            <button className={`tab-btn ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Create Room</button>
            <button className={`tab-btn ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>Join Room</button>
          </div>
          {tab === 'create' && (
            <div className="create-settings">
              <div className="input-group">
                <label>Round Limit</label>
                <select className="input-field" value={rounds} onChange={e=>setRounds(+e.target.value)}>
                  <option value={0}>Unlimited</option>
                  <option value={15}>15 Rounds</option>
                  <option value={20}>20 Rounds</option>
                  <option value={30}>30 Rounds</option>
                  <option value={50}>50 Rounds</option>
                </select>
              </div>
              <div className="input-group">
                <label>Net Worth Goal to Win</label>
                <select className="input-field" value={netWorth} onChange={e=>setNetWorth(+e.target.value)}>
                  <option value={0}>Unlimited</option>
                  {[3000,4000,5000,6000,7000,8000,9000,10000].map(v => <option key={v} value={v}>${v}</option>)}
                </select>
              </div>
              <button className="btn-primary mt-12" onClick={() => onCreate({ rounds, netWorth })} disabled={!connected}>🏙 Create Game Room</button>
            </div>
          )}
          {tab === 'join' && (
            <div className="join-row">
              <input className="input-field code-input" placeholder="ROOM CODE" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={5} />
              <button className="btn-primary flex-1" onClick={() => onJoin(joinCode, roomPlayers)} disabled={!connected || joinCode.length < 4}>Join →</button>
            </div>
          )}
        </div>
        <div className="home-features"><span>2–8 Players</span><span>·</span><span>Real-time Multiplayer</span><span>·</span><span>Mobile First</span></div>
      </div>

      {pwa.isInstallable && (
        <div className="pwa-install-banner">
          <div className="pwa-info">
            <div className="pwa-title">{pwa.isIOS ? 'Install on iOS' : 'Metro Magnate App'}</div>
            <div className="pwa-desc">{pwa.isIOS ? 'Add to Home Screen for best experience' : 'Install for offline access & full screen'}</div>
          </div>
          <button className="pwa-install-btn" onClick={async () => {
            const res = await pwa.install();
            if (res === 'ios') {
              alert("To install on iOS: Tap the 'Share' icon (square with arrow) and select 'Add to Home Screen' (plus icon).");
            }
          }}>
            {pwa.isIOS ? 'How to →' : 'Install Sekarang'}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══ LOBBY ══════════════════════════════════════
function LobbyScreen({ code, players, isHost, onStart, myId, shareLink, myToken, setMyToken }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  useEffect(() => {
    if (players.some(p => p.id !== myId && p.token === myToken)) setShowTokenPicker(true);
  }, [players, myId, myToken]);

  const takenTokens = players.filter(p => p.id !== myId).map(p => p.token);
  function copyCode() { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  function copyLink() { navigator.clipboard?.writeText(shareLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }

  return (
    <div className="lobby-screen">
      {showTokenPicker && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:3, color:'var(--accent)', marginBottom:10 }}>Token Already Taken!</h3>
            <p style={{ fontSize:14, color:'var(--text2)', marginBottom:14 }}>Another player has {myToken}. Pick a different one:</p>
            <div className="token-grid" style={{ marginBottom:16 }}>
              {TOKENS.map(t => (
                <button key={t} className={`token-btn ${myToken===t?'active':''} ${takenTokens.includes(t)?'taken':''}`}
                  disabled={takenTokens.includes(t)}
                  onClick={() => { if (!takenTokens.includes(t)) { setMyToken(t); setShowTokenPicker(false); } }}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="lobby-header">
        <div className="lobby-title">Game Lobby</div>
        <div className="room-code-display" onClick={copyCode}><span className="code-label">ROOM CODE</span><span className="code-value">{code}</span><span className="code-copy">{copied?'✓':'⎘'}</span></div>
        {shareLink && <div className="share-link-display" onClick={copyLink}><span className="link-label">SHARE LINK</span><span className="link-value">{shareLink.substring(0,38)}…</span><span className="link-copy">{linkCopied?'✓':'⎘'}</span></div>}
        <p className="lobby-hint">Share this code with friends anywhere!</p>
      </div>
      <div className="lobby-players">
        {players.map((p,i) => (
          <div key={p.id} className={`lobby-player ${p.id===myId?'me':''}`}>
            <span className="lp-tok">{p.token}</span>
            <span className="lp-name" style={{ color:PLAYER_COLORS[i%8] }}>{p.name}</span>
            {p.id===myId && <span className="lp-badge">You</span>}
            {i===0 && <span className="lp-badge host">Host</span>}
          </div>
        ))}
        {Array.from({ length:Math.max(0,2-players.length) }).map((_,i) => (
          <div key={`e${i}`} className="lobby-player empty"><span className="lp-tok">⏳</span><span className="lp-name">Waiting for player…</span></div>
        ))}
      </div>
      {isHost
        ? <div className="lobby-footer"><p className="lobby-min">{players.length<2?'Need at least 2 players':`${players.length} players ready`}</p><button className="btn-primary" onClick={onStart} disabled={players.length<2}>🚀 Start Game</button></div>
        : <div className="lobby-footer"><p className="lobby-min">Waiting for host to start…</p></div>}
    </div>
  );
}

// ═══ GAME SCREEN ════════════════════════════════
function GameScreen({ state, myId, myPlayer, isMyTurn, dispatch, modal, setModal, anim, iAmRolling }) {
  const [activeTab, setActiveTab] = useState('board');
  const [queuedNotifications, setQueuedNotifications] = useState([]);
  const [displayedNotifications, setDisplayedNotifications] = useState([]);
  const seenLogs = useRef(new Set());
  const logInitialized = useRef(false);
  const previousLogLength = useRef(0);
  const notificationTimers = useRef({});
  const nextNotificationTimer = useRef(null);

  const currentP = state.players[state.currentIdx];
  const isMe = currentP?.id === myId;
  const isAnimating = anim.phase !== 'idle';

  const enqueueNotification = useCallback((entry) => {
    const id = entry.ts || `${Date.now()}-${Math.random()}`;
    setQueuedNotifications(prev => [...prev, { ...entry, id }]);
  }, []);

  const scheduleNextNotification = useCallback((next) => {
    setDisplayedNotifications(prev => [...prev, { ...next, fading: false }]);
    notificationTimers.current[next.id] = {
      fade: window.setTimeout(() => {
        setDisplayedNotifications(prev => prev.map(n => n.id === next.id ? { ...n, fading: true } : n));
      }, 2600),
      remove: window.setTimeout(() => {
        setDisplayedNotifications(prev => prev.filter(n => n.id !== next.id));
        delete notificationTimers.current[next.id];
      }, 3200),
    };
  }, []);

  const showNextNotification = useCallback(() => {
    if (queuedNotifications.length === 0) return;
    const [next, ...rest] = queuedNotifications;
    setQueuedNotifications(rest);
    scheduleNextNotification(next);
  }, [queuedNotifications, scheduleNextNotification]);

  useEffect(() => {
    if (queuedNotifications.length === 0) return;
    if (nextNotificationTimer.current) return;

    nextNotificationTimer.current = window.setTimeout(() => {
      showNextNotification();
      nextNotificationTimer.current = null;
    }, 420);
  }, [queuedNotifications, showNextNotification]);

  useEffect(() => {
    if (!logInitialized.current) {
      state.log.forEach(entry => { if (entry?.ts != null) seenLogs.current.add(entry.ts); });
      previousLogLength.current = state.log.length;
      logInitialized.current = true;
      return;
    }

    if (state.log.length < previousLogLength.current) {
      seenLogs.current.clear();
      state.log.forEach(entry => { if (entry?.ts != null) seenLogs.current.add(entry.ts); });
      previousLogLength.current = state.log.length;
      return;
    }

    const newEntries = [];
    for (let i = state.log.length - 1; i >= 0; i--) {
      const entry = state.log[i];
      if (entry?.ts != null && !seenLogs.current.has(entry.ts)) {
        newEntries.push(entry);
      }
    }
    if (newEntries.length) {
      newEntries.forEach(entry => {
        seenLogs.current.add(entry.ts);
        if (!isMyTurn) enqueueNotification(entry);
      });
    }
    previousLogLength.current = state.log.length;
  }, [state.log, isMyTurn, enqueueNotification]);

  useEffect(() => {
    return () => {
      Object.values(notificationTimers.current).forEach(timer => {
        window.clearTimeout(timer.fade);
        window.clearTimeout(timer.remove);
      });
      if (nextNotificationTimer.current) {
        window.clearTimeout(nextNotificationTimer.current);
      }
      nextNotificationTimer.current = null;
      notificationTimers.current = {};
    };
  }, []);

  return (
    <div className="game-screen">
      <div className="game-topbar">
        <div className="turn-info">
          <span className="ti-tok">{currentP?.token}</span>
          <div>
            <div className="ti-name" style={{ color:currentP?.color }}>{currentP?.name}</div>
            <div className="ti-phase">{phaseLabel(state, isMe)}</div>
          </div>
        </div>
        {/* Corner die — always visible, shows dots, only animates for the roller */}
        <CornerDie value={anim.dieDisplay} isRolling={anim.phase === 'rolling'} lastTotal={state.dice[0] + state.dice[1]} phase={anim.phase} />
      </div>



      <div className="tab-bar">
        {['board','props','log'].map(t => (
          <button key={t} className={`tbar-btn ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>
            {t==='board'?'🗺 Board':t==='props'?'🏠 Props':'📋 Log'}
          </button>
        ))}
      </div>

      <BoardNotification notifications={displayedNotifications} hidden={isMyTurn || displayedNotifications.length === 0} />

      <div className="content-area">
        {activeTab==='board' && <MobileBoard state={state} myId={myId} setModal={setModal} animPos={anim.animPos} />}
        {activeTab==='props' && <PropertiesView state={state} myId={myId} />}
        {activeTab==='log'   && <LogView log={state.log} />}
      </div>

      {/* Full-screen roll overlay — ONLY for the player who just rolled */}
      {iAmRolling && (anim.phase==='rolling' || anim.phase==='show-total') && (
        <div className="dice-overlay">
          <DiceOverlay value={anim.dieDisplay} phase={anim.phase} finalTotal={anim.finalTotal} />
        </div>
      )}

      {/* Action bar — hidden while animating */}
      {isMyTurn && myPlayer && !isAnimating && (
        <ActionBar state={state} myPlayer={myPlayer} dispatch={dispatch} setModal={setModal} />
      )}

      {modal && <ModalOverlay onClose={() => setModal(null)}>{modal}</ModalOverlay>}
      {!isAnimating && isMyTurn && state.phase==='card' && state.pendingCard && <CardModal card={state.pendingCard} onAck={() => dispatch('ack_card')} />}
      {!isAnimating && isMyTurn && state.phase==='rent' && state.pendingRent && <RentModal state={state} rent={state.pendingRent} onPay={() => dispatch('pay_rent')} />}
      {!isAnimating && isMyTurn && state.phase==='buy' && <BuyModal state={state} player={myPlayer} onBuy={() => dispatch('buy')} onPass={() => dispatch('pass_buy')} />}
      {!isAnimating && state.tradeOffer && state.tradeOffer.toId===myId && <TradeOfferModal state={state} trade={state.tradeOffer} onAccept={() => dispatch('trade_accept')} onDecline={() => dispatch('trade_decline')} />}
    </div>
  );
}

function phaseLabel(state, isMe) {
  if (!isMe) return `${state.players[state.currentIdx]?.name}'s turn`;
  const labels = { roll:'Your turn — Roll!', buy:'Buy or Pass?', card:'Draw a card', rent:'Pay rent', auction:'Auction!', end:'End turn', won:'Game over' };
  return labels[state.phase] || 'Your turn';
}

// ═══ CORNER DIE (top-right, always visible) ══════
// Shows dots. Wiggles only during rolling phase.
// Shows settled number next to it — no NaN: only shows after a real roll has happened.
function CornerDie({ value, isRolling, lastTotal, phase }) {
  const safeVal = (value && !isNaN(value)) ? Math.min(Math.max(value, 1), 12) : null;
  const dots = safeVal ? getDotPattern(safeVal) : getDotPattern(1);
  // Only show the numeric total when a roll has actually settled
  const showTotal = phase === 'show-total' || phase === 'moving' || phase === 'idle';
  const displayTotal = (lastTotal && !isNaN(lastTotal) && lastTotal > 0) ? lastTotal : null;

  return (
    <div className="corner-die-wrap">
      <div className={`corner-die-face ${isRolling ? 'corner-rolling' : ''}`}>
        <div className="corner-die-dots">
          {dots.map((on, i) => <span key={i} className={`corner-dot ${on ? 'on' : ''}`} />)}
        </div>
      </div>
      {showTotal && displayTotal && (
        <div className="corner-die-total">{displayTotal}</div>
      )}
    </div>
  );
}

// ═══ FULL-SCREEN DICE OVERLAY (only for roller) ══
function DiceOverlay({ value, phase, finalTotal }) {
  const safeVal = (value && !isNaN(value)) ? Math.min(Math.max(value, 1), 12) : 1;
  const dots = getDotPattern(safeVal);
  const isRolling = phase === 'rolling';
  const isSettled = phase === 'show-total';
  const displayNumber = isSettled && finalTotal ? finalTotal : (isRolling ? null : safeVal);

  return (
    <div className="dice-overlay-inner">
      <div className={`overlay-die-face ${isRolling ? 'spinning' : 'landing'}`}>
        <div className="overlay-die-dots">
          {dots.map((on, i) => <span key={i} className={`overlay-dot ${on ? 'on' : ''}`} />)}
        </div>
      </div>
      {isSettled && finalTotal && (
        <>
          <div className="overlay-total">{finalTotal}</div>
          <div className="overlay-subtitle">You rolled {finalTotal}!</div>
        </>
      )}
    </div>
  );
}

function getDotPattern(val) {
  const p = {
    1:  [0,0,0, 0,1,0, 0,0,0],
    2:  [1,0,0, 0,0,0, 0,0,1],
    3:  [1,0,0, 0,1,0, 0,0,1],
    4:  [1,0,1, 0,0,0, 1,0,1],
    5:  [1,0,1, 0,1,0, 1,0,1],
    6:  [1,0,1, 1,0,1, 1,0,1],
    7:  [1,1,1, 0,1,0, 1,1,1],
    8:  [1,1,1, 1,0,1, 1,1,1],
    9:  [1,1,1, 1,1,1, 0,1,0],
    10: [1,1,1, 1,1,1, 1,0,1],
    11: [1,1,1, 1,1,1, 1,1,0],
    12: [1,1,1, 1,1,1, 1,1,1],
  };
  return (p[val] || p[6]).map(v => v===1);
}

function MobileBoard({ state, myId, setModal, animPos }) {
  const [boardWidth, setBoardWidth] = useState(380);

  useEffect(() => {
    function handleResize() {
      setBoardWidth(Math.min(window.innerWidth, 500) - 16);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalCells = state.board.length;
  const cellsPerEdge = totalCells / 4;
  const numCols = cellsPerEdge + 1;
  const size = Math.floor(boardWidth / numCols);
  const boardSize = size * numCols;
  const innerSize = size * (numCols - 2);

  const displayPos = {};
  state.players.forEach(p => { displayPos[p.id] = animPos[p.id] !== undefined ? animPos[p.id] : p.pos; });

  const pawnsByPos = {};
  state.players.forEach(p => {
    if (!p.bankrupt) {
      const dp = displayPos[p.id];
      if (!pawnsByPos[dp]) pawnsByPos[dp] = [];
      pawnsByPos[dp].push(p);
    }
  });

  return (
    <div className="board-container">
      <div className="board-scroll">
        <div className="board-grid" style={{ width:boardSize, height:boardSize, position:'relative' }}>
          {state.board.map((cell, i) => {
            const pos = getCellPos(i, totalCells);
            const owner = cell.owner != null ? state.players.find(p => p.id===cell.owner) : null;
            const pawns = pawnsByPos[i] || [];
            const isCorner = i % cellsPerEdge === 0;
            const gc = cell.group ? COLOR_GROUPS[cell.group] : null;
            return (
              <div key={i} className={`board-cell ${isCorner?'corner':''}`}
                style={{ position:'absolute', left:pos.col*size, top:pos.row*size, width:size, height:size,
                  borderColor: owner ? owner.color+'aa' : 'rgba(0,0,0,0.12)',
                  borderWidth: owner ? 2 : 1,
                  background: gc ? gc.color+'80' : isCorner ? '#e8e0d0' : '#fefdfb' }}
                onClick={() => showCellModal(cell, state, setModal)}>
                {gc && <div className="cell-stripe" style={{ background:gc.color }} />}
                
                {isCorner ? (
                   <span className="corner-icon">{cell.icon}</span>
                ) : (
                   <div className={`cell-content ${!gc ? 'no-stripe' : ''}`}>
                     <span className="cell-lbl">{cell.name.split('\n')[0].substring(0,12)}</span>
                     {cell.mortgaged && <span className="mort-badge">M</span>}
                     {(cell.houses||0)>0 && <span className="house-badge">{cell.houses===5?'🏨':'🏠'.repeat(cell.houses)}</span>}
                   </div>
                )}
                
                {pawns.length>0 && (
                  <div className="pawn-cluster">
                    {pawns.map(p => (
                      <span key={p.id} className="board-pawn pawn-hop" style={{ backgroundColor: p.color }}>
                        <span className="pawn-emoji">{p.token}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="board-center" style={{ left:size, top:size, width:innerSize, height:innerSize }}>
            {state.players.map((p, idx) => {
              // Symmetrically position players around the corners of the center box
              const totalP = state.players.length;
              let top, left, right, bottom, transform;
              if (idx === 0) { top = 8; left = 8; }
              else if (idx === 1) { top = 8; right = 8; }
              else if (idx === 2) { bottom = 8; left = 8; }
              else if (idx === 3) { bottom = 8; right = 8; }
              else if (idx === 4) { top = 8; left = '50%'; transform = 'translateX(-50%)'; }
              else if (idx === 5) { bottom = 8; left = '50%'; transform = 'translateX(-50%)'; }
              else if (idx === 6) { top = '50%'; left = 8; transform = 'translateY(-50%)'; }
              else { top = '50%'; right = 8; transform = 'translateY(-50%)'; }

              const nw = p.cash + p.properties.reduce((s, i) => {
                const c = state.board[i];
                const hc = COLOR_GROUPS[c.group]?.houseCost || 50;
                return s + Math.floor(c.price / 2) + (c.houses || 0) * hc * 0.5;
              }, 0);
              const isActive = p.id === state.players[state.currentIdx].id;
              return (
                <div key={p.id}
                     className={`bc-player ${isActive ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`}
                     style={{ position:'absolute', top, left, right, bottom, transform,
                       background: isActive ? 'rgba(240,180,41,0.12)' : 'var(--surface)',
                       border: `2px solid ${isActive ? 'var(--accent)' : p.color}`,
                       borderRadius: 16, padding: '5px 10px', display:'flex', flexDirection:'column',
                       alignItems:'center', gap:1, zIndex: 10, minWidth: 60,
                       boxShadow: isActive ? '0 0 12px rgba(240,180,41,0.4)' : '0 2px 8px rgba(0,0,0,0.25)' }}>
                  <span style={{ fontSize: 16 }}>{p.token}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'var(--accent)', fontWeight:'bold', lineHeight:1 }}>${p.cash.toLocaleString()}</span>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color: p.color, fontWeight:'600', lineHeight:1 }}>NW ${Math.round(nw).toLocaleString()}</span>
                </div>
              );
            })}
            <div className="bc-logo">METRO MAGNATE</div>
            {state.freeParking>0 && <div className="bc-pot">🅿️ ${state.freeParking}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function showCellModal(cell, state, setModal) {
  const owner = cell.owner != null ? state.players.find(p => p.id===cell.owner) : null;
  const gc = cell.group ? COLOR_GROUPS[cell.group] : null;
  setModal(
    <div className="cell-info-modal">
      {gc && <div className="cim-stripe" style={{ background:gc.color }} />}
      <h3 className="cim-name">{cell.name}</h3>
      {cell.type==='property' && (<>
        <div className="cim-group" style={{ color:gc?.color }}>{gc?.name} Group · ${cell.price}</div>
        <div className="cim-rents">
          {['0 houses','1 house','2 houses','3 houses','4 houses','Hotel'].map((l,i) => <div key={i} className="cim-row"><span>{l}</span><span>${cell.rent[i]}</span></div>)}
          <div className="cim-row"><span>Build cost</span><span>${gc?.houseCost}</span></div>
        </div>
      </>)}
      {cell.type==='railroad' && <div className="cim-rents">{[1,2,3,4].map((n,i) => <div key={i} className="cim-row"><span>{n} railroad{n>1?'s':''}</span><span>${cell.rent[i]}</span></div>)}</div>}
      {cell.type==='utility' && <p className="cim-desc">Rent = 4× or 10× dice roll.</p>}
      {owner && <div className="cim-owner" style={{ color:owner.color }}>{owner.token} Owned by {owner.name}{cell.mortgaged&&' (Mortgaged)'}{(cell.houses||0)>0&&` · ${cell.houses===5?'🏨 Hotel':'🏠'.repeat(cell.houses)}`}</div>}
      {!owner && cell.price && <div className="cim-owner">Unowned · ${cell.price}</div>}
    </div>
  );
}

// ═══ ACTION BAR ════════════════════════════════
// Big prominent button: ROLL when canRoll, END TURN when canEnd
function ActionBar({ state, myPlayer, dispatch, setModal }) {
  const [showBuild, setShowBuild] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showMort,  setShowMort]  = useState(false);
  const phase = state.phase;
  const canRoll = !state.rollDone;
  const canEnd  = state.rollDone && (phase==='end' || phase==='roll');

  const buildable = myPlayer.properties.map(idx => state.board[idx])
    .filter(c => c.type==='property' && c.group &&
      state.groupCells[c.group]?.every(i => state.board[i].owner===myPlayer.id) &&
      (c.houses||0)<5 && myPlayer.cash>=COLOR_GROUPS[c.group].houseCost);

  return (
    <div className="action-bar">
      {/* Primary action: Roll */}
      {canRoll && (
        <button className="primary-action-btn roll-active" onClick={() => dispatch('roll')}>
          <span className="pa-icon">🎲</span>
          <span className="pa-label">ROLL DICE</span>
        </button>
      )}
      {!canRoll && (
        <div className="primary-action-btn waiting">
          <span className="pa-icon">⌛</span>
          <span className="pa-label">WAITING…</span>
        </div>
      )}

      {/* Secondary pills */}
      <div className="action-pills">
        <button className="pill-btn" onClick={() => setShowBuild(true)} disabled={buildable.length===0}><span>🏗</span><span>Build</span></button>
        <button className="pill-btn" onClick={() => setShowTrade(true)}><span>⇄</span><span>Trade</span></button>
        <button className="pill-btn" onClick={() => setShowMort(true)}><span>🏦</span><span>Mortgage</span></button>
        {myPlayer.inJail && myPlayer.jailFreeCards>0 && (
          <button className="pill-btn" onClick={() => dispatch('jail_free')}><span>🃏</span><span>Jail Free</span></button>
        )}
        <button className="pill-btn danger" onClick={() => setModal(
          <ConfirmModal title="Declare Bankruptcy?" desc="All your assets will be lost."
            onYes={() => { dispatch('bankrupt'); setModal(null); }} onNo={() => setModal(null)} />
        )}><span>💀</span><span>Bankrupt</span></button>
      </div>

      {showBuild && <ModalOverlay onClose={() => setShowBuild(false)}><BuildMenu buildable={buildable} dispatch={dispatch} onClose={() => setShowBuild(false)} /></ModalOverlay>}
      {showTrade && <ModalOverlay onClose={() => setShowTrade(false)}><TradeMenu state={state} myPlayer={myPlayer} dispatch={dispatch} onClose={() => setShowTrade(false)} /></ModalOverlay>}
      {showMort  && <ModalOverlay onClose={() => setShowMort(false)}><MortgageMenu state={state} myPlayer={myPlayer} dispatch={dispatch} /></ModalOverlay>}
    </div>
  );
}

function BuildMenu({ buildable, dispatch, onClose }) {
  return (
    <div className="sheet"><h3>🏗 Build Houses</h3>
      {buildable.map(cell => { const gc=COLOR_GROUPS[cell.group]; return (
        <button key={cell.idx} className="sheet-item" onClick={() => { dispatch('build',{cellIdx:cell.idx}); onClose(); }}>
          <div className="si-stripe" style={{background:gc.color}} /><span className="si-name">{cell.name}</span>
          <span className="si-detail">{cell.houses||0}/4 🏠 · ${gc.houseCost}</span>
        </button>); })}
    </div>
  );
}

function TradeMenu({ state, myPlayer, dispatch, onClose }) {
  const [target, setTarget] = useState(null);
  const [offerCash, setOfferCash] = useState(0);
  const [wantCash,  setWantCash]  = useState(0);
  const [offerProps, setOfferProps] = useState([]);
  const [wantProps,  setWantProps]  = useState([]);
  const others = state.players.filter(p => !p.bankrupt && p.id!==myPlayer.id);
  const toggleProp = (arr, setArr, idx) => setArr(arr.includes(idx) ? arr.filter(i=>i!==idx) : [...arr,idx]);

  if (!target) return (
    <div className="sheet"><h3>⇄ Trade — Select Player</h3>
      {others.map(p => <button key={p.id} className="sheet-item" onClick={() => setTarget(p)}><span>{p.token}</span><span className="si-name" style={{color:p.color}}>{p.name}</span><span className="si-detail">${p.cash}</span></button>)}
    </div>
  );
  return (
    <div className="sheet"><h3>⇄ You ↔ {target.name}</h3>
      <div className="trade-grid">
        <div className="trade-col"><div className="tc-title">You offer</div>
          <input type="number" className="input-field" min="0" max={myPlayer.cash} value={offerCash} onChange={e=>setOfferCash(+e.target.value)} placeholder="Cash $" />
          {myPlayer.properties.map(idx=><label key={idx} className="prop-check"><input type="checkbox" checked={offerProps.includes(idx)} onChange={()=>toggleProp(offerProps,setOfferProps,idx)}/>{state.board[idx].name}</label>)}
        </div>
        <div className="trade-col"><div className="tc-title">You want</div>
          <input type="number" className="input-field" min="0" max={target.cash} value={wantCash} onChange={e=>setWantCash(+e.target.value)} placeholder="Cash $" />
          {target.properties.map(idx=><label key={idx} className="prop-check"><input type="checkbox" checked={wantProps.includes(idx)} onChange={()=>toggleProp(wantProps,setWantProps,idx)}/>{state.board[idx].name}</label>)}
        </div>
      </div>
      <button className="btn-primary mt-12" onClick={()=>{dispatch('trade_propose',{toId:target.id,offerCash,offerProps,wantCash,wantProps});onClose();}}>Send Trade Offer</button>
    </div>
  );
}

function MortgageMenu({ state, myPlayer, dispatch }) {
  return (
    <div className="sheet"><h3>🏦 Mortgage Manager</h3>
      {myPlayer.properties.length===0 && <p className="sheet-empty">No properties owned.</p>}
      {myPlayer.properties.map(idx => { const cell=state.board[idx]; const mv=Math.floor(cell.price/2); const lc=Math.floor(mv*1.1); return (
        <div key={idx} className="mort-row">
          <span className={`mr-name ${cell.mortgaged?'muted':''}`}>{cell.name}</span>
          {cell.mortgaged
            ? <button className="mr-btn green" onClick={()=>dispatch('unmortgage',{cellIdx:idx})}>Lift +${lc}</button>
            : <button className="mr-btn" onClick={()=>dispatch('mortgage',{cellIdx:idx})}>Mortgage +${mv}</button>}
        </div>); })}
    </div>
  );
}

function PropertiesView({ state }) {
  return (
    <div className="props-view">
      {state.players.filter(p=>!p.bankrupt).map(player=>(
        <div key={player.id} className="pv-section">
          <div className="pv-header"><span>{player.token}</span><span style={{color:player.color}}>{player.name}</span><span className="pv-cash">${player.cash}</span></div>
          {player.properties.length===0 && <div className="pv-empty">No properties</div>}
          <div className="pv-props">
            {player.properties.map(idx => { const cell=state.board[idx]; const gc=cell.group?COLOR_GROUPS[cell.group]:null; return (
              <div key={idx} className={`pv-prop ${cell.mortgaged?'mortgaged':''}`}>
                {gc&&<div className="pvp-stripe" style={{background:gc.color}}/>}
                <span className="pvp-name">{cell.name}</span>
                {cell.houses>0&&<span className="pvp-houses">{cell.houses===5?'🏨':'🏠'.repeat(cell.houses)}</span>}
                {cell.mortgaged&&<span className="pvp-mort">M</span>}
              </div>); })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LogView({ log }) {
  return <div className="log-view">{log.map((e,i)=><div key={i} className={`log-entry ${e.type}`}>{e.msg}</div>)}</div>;
}

function CardModal({ card, onAck }) {
  const isChance = card.deckType==='chance';
  return <ModalOverlay><div className={`card-modal ${isChance?'chance':'chest'}`}><div className="card-type">{isChance?'❓ Chance':'📦 Community Chest'}</div><p className="card-text">{card.text}</p><button className="btn-primary" onClick={onAck}>OK</button></div></ModalOverlay>;
}

function RentModal({ state, rent, onPay }) {
  const owner = state.players.find(p=>p.id===rent.ownerId);
  return <ModalOverlay><div className="rent-modal"><div className="rm-title">🏙 Rent Due</div><p>You owe <span style={{color:owner?.color}}>{owner?.token} {owner?.name}</span></p><div className="rm-amount">${rent.amount}</div><button className="btn-primary btn-danger" onClick={onPay}>Pay ${rent.amount}</button></div></ModalOverlay>;
}

function BuyModal({ state, player, onBuy, onPass }) {
  const cell = state.board[player.pos];
  const gc = cell.group ? COLOR_GROUPS[cell.group] : null;
  return <ModalOverlay><div className="buy-modal">{gc&&<div className="bm-stripe" style={{background:gc.color}}/>}<div className="bm-name">{cell.name}</div>{gc&&<div className="bm-group" style={{color:gc.color}}>{gc.name} Group</div>}<div className="bm-price">${cell.price}</div><div className="bm-cash">Your cash: ${player.cash} → ${player.cash-cell.price}</div>{cell.type==='property'&&<div className="bm-rent">Base rent: ${cell.rent[0]}</div>}<div className="bm-btns"><button className="btn-primary" onClick={onBuy} disabled={player.cash<cell.price}>Buy</button><button className="btn-secondary" onClick={onPass}>Skip</button></div></div></ModalOverlay>;
}

function TradeOfferModal({ state, trade, onAccept, onDecline }) {
  const from=state.players.find(p=>p.id===trade.fromId);
  return <ModalOverlay><div className="trade-offer-modal"><div className="tom-title">⇄ Trade Offer</div><p>from <span style={{color:from?.color}}>{from?.token} {from?.name}</span></p><div className="tom-grid"><div className="tom-col"><div className="tc-title">They offer</div>{trade.offerCash>0&&<div>${trade.offerCash}</div>}{trade.offerProps.map(i=><div key={i}>{state.board[i].name}</div>)}</div><div className="tom-col"><div className="tc-title">They want</div>{trade.wantCash>0&&<div>${trade.wantCash}</div>}{trade.wantProps.map(i=><div key={i}>{state.board[i].name}</div>)}</div></div><div className="bm-btns"><button className="btn-primary" onClick={onAccept}>Accept</button><button className="btn-secondary" onClick={onDecline}>Decline</button></div></div></ModalOverlay>;
}

function ConfirmModal({ title, desc, onYes, onNo }) {
  return <div className="confirm-modal"><h3>{title}</h3><p>{desc}</p><div className="bm-btns"><button className="btn-primary btn-danger" onClick={onYes}>Confirm</button><button className="btn-secondary" onClick={onNo}>Cancel</button></div></div>;
}

function WinScreen({ state, onRestart }) {
  const winner = state.players.find(p => p.id === state.winner);
  const ranked = [...state.players].sort((a, b) => {
    const nwA = a.cash + a.properties.reduce((s, i) => s + Math.floor((state.board[i]?.price||0) / 2), 0);
    const nwB = b.cash + b.properties.reduce((s, i) => s + Math.floor((state.board[i]?.price||0) / 2), 0);
    return nwB - nwA;
  });
  const settings = state.settings || {};
  return (
    <div className="win-screen">
      <div className="win-content">
        <div className="win-trophy">🏆</div>
        <div className="win-token">{winner?.token}</div>
        <div className="win-name" style={{color:winner?.color}}>{winner?.name}</div>
        <div className="win-sub">City Tycoon Champion!</div>
        {settings.rounds > 0 && <div className="win-sub" style={{fontSize:12,opacity:.7}}>After {settings.rounds} rounds</div>}
        {settings.netWorth > 0 && <div className="win-sub" style={{fontSize:12,opacity:.7}}>Net Worth Goal: ${settings.netWorth.toLocaleString()}</div>}
        <div className="win-stats">
          {ranked.map((p, i) => {
            const nw = p.cash + p.properties.reduce((s, idx) => s + Math.floor((state.board[idx]?.price||0) / 2), 0);
            return (
              <div key={p.id} className={`ws-row ${p.bankrupt ? 'bankrupt' : ''} ${p.id === state.winner ? 'winner' : ''}`}>
                <span className="ws-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
                <span>{p.token} {p.name}</span>
                <span style={{color:'var(--accent)', fontFamily:"'JetBrains Mono',monospace", fontSize:12}}>NW ${nw.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
        <button className="btn-primary mt-24" onClick={onRestart}>Play Again</button>
      </div>
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget&&onClose)onClose();}}><div className="modal-box">{onClose&&<button className="modal-close" onClick={onClose}>✕</button>}{children}</div></div>;
}

function BoardNotification({ notifications, hidden }) {
  if (!notifications || notifications.length === 0) return null;
  return (
    <div className={`board-notification-container ${hidden ? 'board-notification-hidden' : ''}`}>
      {notifications.map((notification) => (
        <div key={notification.id} className={`board-notification ${notification.type || 'info'} ${notification.fading ? 'fade-out' : 'visible'}`}>
          <span>{notification.msg}</span>
        </div>
      ))}
    </div>
  );
}

function Toast({ msg, type }) { return <div className={`toast toast-${type}`}>{msg}</div>; }
