import { useState, useEffect, useRef, useCallback } from "react";
import { BOARD, COLOR_GROUPS, GROUP_CELLS, TOKENS, PLAYER_COLORS } from "./gameData";
import "./index.css";

// ─── WS HOOK ────────────────────────────────────
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
        if (listeners.current['*']) listeners.current['*'](msg);
      } catch {}
    };
  }, [serverUrl]);

  useEffect(() => { connect(); return () => ws.current?.close(); }, [connect]);

  return { connected, send, on };
}

// ─── SCREENS ────────────────────────────────────
const SCREENS = { HOME: 'home', LOBBY: 'lobby', GAME: 'game', WIN: 'win' };

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
  const [isRolling, setIsRolling] = useState(false);

  // socket listeners
  useEffect(() => {
    on('created', (msg) => {
      setMyId(msg.playerId);
      setRoomCode(msg.code);
      setIsHost(true);
      const link = `${window.location.origin}?join=${msg.code}`;
      setShareLink(link);
      setScreen(SCREENS.LOBBY);
    });
    on('joined', (msg) => {
      setMyId(msg.playerId);
      setRoomCode(msg.code);
      setScreen(SCREENS.LOBBY);
    });
    on('lobby', (msg) => {
      setLobbyPlayers(msg.players);
      setIsHost(msg.host === myId);
    });
    on('state', (msg) => {
      setGameState(msg.state);
      setServerPlayers(msg.players);
      setShareLink('');
      if (msg.state.winner) setScreen(SCREENS.WIN);
      else setScreen(SCREENS.GAME);
    });
    on('error', (msg) => {
      if (msg.msg === 'duplicate_emoji') {
        setModal(
          <div className="confirm-modal">
            <h3>🎭 Emoji Already Taken</h3>
            <p>Another player is using {msg.playerToken}. Please choose a different emoji.</p>
            <div className="bm-btns">
              <button className="btn-primary" onClick={() => setModal(null)}>Change Emoji</button>
            </div>
          </div>
        );
      } else {
        showToast(msg.msg, 'error');
      }
    });
    on('player_disconnected', (msg) => {
      showToast(`${msg.name} disconnected`, 'warn');
    });
  }, [on, myId]);

  // Sync host flag when lobby updates
  useEffect(() => {
    if (lobbyPlayers.length && myId) {
      setIsHost(lobbyPlayers[0]?.id === myId);
    }
  }, [lobbyPlayers, myId]);

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function createRoom() {
    if (!myName.trim()) { setError('Enter your name'); return; }
    send({ type: 'create', name: myName.trim(), token: myToken, color: PLAYER_COLORS[0] });
  }

  function joinRoom(code) {
    if (!myName.trim()) { setError('Enter your name'); return; }
    const colorIdx = Math.floor(Math.random() * PLAYER_COLORS.length);
    send({ type: 'join', code: code.toUpperCase(), name: myName.trim(), token: myToken, color: PLAYER_COLORS[colorIdx] });
  }

  function startGame() {
    send({ type: 'start' });
  }

  function dispatch(type, extra = {}) {
    send({ type, ...extra });
  }

  const myPlayer = gameState?.players.find(p => p.id === myId);
  const currentPlayer = gameState?.players[gameState?.currentIdx];
  const isMyTurn = currentPlayer?.id === myId;

  return (
    <div className="app">
      {screen === SCREENS.HOME && (
        <HomeScreen
          myName={myName} setMyName={setMyName}
          myToken={myToken} setMyToken={setMyToken}
          connected={connected} error={error} setError={setError}
          onCreate={createRoom} onJoin={joinRoom}
        />
      )}
      {screen === SCREENS.LOBBY && (
        <LobbyScreen
          code={roomCode} players={lobbyPlayers}
          isHost={isHost} onStart={startGame}
          myId={myId} shareLink={shareLink}
        />
      )}
      {screen === SCREENS.GAME && gameState && (
        <GameScreen
          state={gameState} serverPlayers={serverPlayers}
          myId={myId} myPlayer={myPlayer}
          isMyTurn={isMyTurn}
          dispatch={dispatch}
          modal={modal} setModal={setModal}
          isRolling={isRolling} setIsRolling={setIsRolling}
        />
      )}
      {screen === SCREENS.WIN && gameState && (
        <WinScreen
          state={gameState}
          onRestart={() => { setScreen(SCREENS.HOME); setGameState(null); }}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════
function HomeScreen({ myName, setMyName, myToken, setMyToken, connected, error, setError, onCreate, onJoin }) {
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState('create'); // create | join

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
          <div className="ws-status">
            <span className={`ws-dot ${connected ? 'on' : 'off'}`} />
            {connected ? 'Server connected' : 'Connecting…'}
          </div>

          <div className="input-group">
            <label>Your Name</label>
            <input
              className="input-field"
              placeholder="Enter your name"
              value={myName}
              onChange={e => { setMyName(e.target.value); setError(''); }}
              maxLength={20}
            />
          </div>

          <div className="input-group">
            <label>Your Token</label>
            <div className="token-grid">
              {TOKENS.map(t => (
                <button
                  key={t}
                  className={`token-btn ${myToken === t ? 'active' : ''}`}
                  onClick={() => setMyToken(t)}
                >{t}</button>
              ))}
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="tab-row">
            <button className={`tab-btn ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>Create Room</button>
            <button className={`tab-btn ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>Join Room</button>
          </div>

          {tab === 'create' && (
            <button className="btn-primary" onClick={onCreate} disabled={!connected}>
              🏙 Create Game Room
            </button>
          )}

          {tab === 'join' && (
            <div className="join-row">
              <input
                className="input-field code-input"
                placeholder="ROOM CODE"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
              />
              <button className="btn-primary flex-1" onClick={() => onJoin(joinCode)} disabled={!connected || joinCode.length < 4}>
                Join →
              </button>
            </div>
          )}
        </div>

        <div className="home-features">
          <span>2–8 Players</span>
          <span>·</span>
          <span>Real-time Multiplayer</span>
          <span>·</span>
          <span>Mobile First</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// LOBBY SCREEN
// ═══════════════════════════════════════════════
function LobbyScreen({ code, players, isHost, onStart, myId, shareLink }) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="lobby-screen">
      <div className="lobby-header">
        <div className="lobby-title">Game Lobby</div>
        <div className="room-code-display" onClick={copyCode}>
          <span className="code-label">ROOM CODE</span>
          <span className="code-value">{code}</span>
          <span className="code-copy">{copied ? '✓' : '⎘'}</span>
        </div>
        {shareLink && (
          <div className="share-link-display" onClick={copyLink}>
            <span className="link-label">SHARE LINK</span>
            <span className="link-value">{shareLink.substring(0, 40)}...</span>
            <span className="link-copy">{linkCopied ? '✓' : '⎘'}</span>
          </div>
        )}
        <p className="lobby-hint">Share this code with friends on the same network or anywhere!</p>
      </div>

      <div className="lobby-players">
        {players.map((p, i) => (
          <div key={p.id} className={`lobby-player ${p.id === myId ? 'me' : ''}`}>
            <span className="lp-tok">{p.token}</span>
            <span className="lp-name" style={{ color: PLAYER_COLORS[i % 8] }}>{p.name}</span>
            {p.id === myId && <span className="lp-badge">You</span>}
            {i === 0 && <span className="lp-badge host">Host</span>}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="lobby-player empty">
            <span className="lp-tok">⏳</span>
            <span className="lp-name">Waiting for player…</span>
          </div>
        ))}
      </div>

      {isHost ? (
        <div className="lobby-footer">
          <p className="lobby-min">{players.length < 2 ? 'Need at least 2 players' : `${players.length} player${players.length > 1 ? 's' : ''} ready`}</p>
          <button
            className="btn-primary"
            onClick={onStart}
            disabled={players.length < 2}
          >
            🚀 Start Game
          </button>
        </div>
      ) : (
        <div className="lobby-footer">
          <p className="lobby-min">Waiting for host to start…</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// GAME SCREEN
// ═══════════════════════════════════════════════
function GameScreen({ state, serverPlayers, myId, myPlayer, isMyTurn, dispatch, modal, setModal, isRolling, setIsRolling }) {
  const [activeTab, setActiveTab] = useState('board'); // board | props | log
  const currentP = state.players[state.currentIdx];
  const isMe = currentP?.id === myId;

  return (
    <div className="game-screen">
      {/* ── TOP BAR ── */}
      <div className="game-topbar">
        <div className="turn-info">
          <span className="ti-tok">{currentP?.token}</span>
          <div>
            <div className="ti-name" style={{ color: currentP?.color }}>{currentP?.name}</div>
            <div className="ti-phase">{phaseLabel(state, isMe)}</div>
          </div>
        </div>
        <div className="dice-area">
          <span className={`die ${isRolling ? 'rolling' : ''}`}>{state.dice[0]}</span>
        </div>
      </div>

      {/* ── PLAYER STRIP ── */}
      <div className="player-strip">
        {state.players.map((p, i) => (
          <div key={p.id} className={`ps-player ${p.id === state.players[state.currentIdx].id ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`}>
            <span>{p.token}</span>
            <span className="ps-cash">${p.cash}</span>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="tab-bar">
        {['board','props','log'].map(t => (
          <button key={t} className={`tbar-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'board' ? '🗺 Board' : t === 'props' ? '🏠 Props' : '📋 Log'}
          </button>
        ))}
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="content-area">
        {activeTab === 'board' && (
          <MobileBoard state={state} myId={myId} dispatch={dispatch} setModal={setModal} />
        )}
        {activeTab === 'props' && (
          <PropertiesView state={state} myId={myId} dispatch={dispatch} isMyTurn={isMyTurn} />
        )}
        {activeTab === 'log' && (
          <LogView log={state.log} />
        )}
      </div>

      {/* ── ACTION BAR (only for current player) ── */}
      {isMyTurn && myPlayer && (
        <ActionBar state={state} myPlayer={myPlayer} dispatch={dispatch} setModal={setModal} />
      )}

      {/* ── MODAL ── */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          {modal}
        </ModalOverlay>
      )}

      {/* ── PENDING OVERLAYS (for current player) ── */}
      {isMyTurn && state.phase === 'card' && state.pendingCard && (
        <CardModal card={state.pendingCard} onAck={() => dispatch('ack_card')} />
      )}
      {isMyTurn && state.phase === 'rent' && state.pendingRent && (
        <RentModal state={state} rent={state.pendingRent} onPay={() => dispatch('pay_rent')} />
      )}
      {isMyTurn && state.phase === 'buy' && (
        <BuyModal state={state} player={myPlayer} onBuy={() => dispatch('buy')} onPass={() => dispatch('pass_buy')} />
      )}
      {state.phase === 'auction' && state.pendingAuction && (
        <AuctionModal state={state} myId={myId} onBid={(amount) => dispatch('bid', { amount })} />
      )}
      {state.tradeOffer && state.tradeOffer.toId === myId && (
        <TradeOfferModal state={state} trade={state.tradeOffer} onAccept={() => dispatch('trade_accept')} onDecline={() => dispatch('trade_decline')} />
      )}
    </div>
  );
}

function phaseLabel(state, isMe) {
  if (!isMe) {
    const p = state.players[state.currentIdx];
    return `${p.name}'s turn`;
  }
  const labels = {
    roll: 'Your turn — Roll!',
    rolled: 'Rolled',
    buy: 'Buy or Pass?',
    card: 'Draw a card',
    rent: 'Pay rent',
    auction: 'Auction!',
    end: 'End turn',
    won: 'Game over',
  };
  return labels[state.phase] || 'Your turn';
}

// ─── MOBILE BOARD ───────────────────────────────
function MobileBoard({ state, myId, dispatch, setModal }) {
  const [animatingPawns, setAnimatingPawns] = useState(new Set());
  const prevStateRef = useRef(null);

  // Detect movement and trigger animations
  useEffect(() => {
    if (!prevStateRef.current) {
      prevStateRef.current = state;
      return;
    }

    const prevPlayers = prevStateRef.current.players;
    const newAnimating = new Set();

    state.players.forEach(player => {
      const prevPlayer = prevPlayers.find(p => p.id === player.id);
      if (prevPlayer && prevPlayer.pos !== player.pos) {
        newAnimating.add(player.id);
      }
    });

    if (newAnimating.size > 0) {
      setAnimatingPawns(newAnimating);
      const timer = setTimeout(() => setAnimatingPawns(new Set()), 400);
      return () => clearTimeout(timer);
    }

    prevStateRef.current = state;
  }, [state]);

  useEffect(() => {
    prevStateRef.current = state;
  }, [state]);
  const cellSize = Math.floor((Math.min(window.innerWidth, 500) - 32) / 11);

  function getCellPos(idx) {
    if (idx <= 10) return { row: 10, col: 10 - idx };
    if (idx <= 20) return { row: 10 - (idx - 10), col: 0 };
    if (idx <= 30) return { row: 0, col: idx - 20 };
    return { row: idx - 30, col: 10 };
  }

  const pawnsByPos = {};
  state.players.forEach(p => {
    if (!p.bankrupt) {
      if (!pawnsByPos[p.pos]) pawnsByPos[p.pos] = [];
      pawnsByPos[p.pos].push(p);
    }
  });

  const size = cellSize;
  const totalSize = size * 11;

  return (
    <div className="board-container">
      <div className="board-scroll">
        <div className="board-grid" style={{ width: totalSize, height: totalSize, position: 'relative' }}>
          {state.board.map((cell, i) => {
            const pos = getCellPos(i);
            const owner = cell.owner != null ? state.players.find(p => p.id === cell.owner) : null;
            const pawns = pawnsByPos[i] || [];
            const isCorner = [0,10,20,30].includes(i);
            const gc = cell.group ? COLOR_GROUPS[cell.group] : null;

            return (
              <div
                key={i}
                className={`board-cell ${isCorner ? 'corner' : ''}`}
                style={{
                  position: 'absolute',
                  left: pos.col * size,
                  top: pos.row * size,
                  width: isCorner ? size : size,
                  height: isCorner ? size : size,
                  borderColor: owner ? owner.color : 'rgba(255,255,255,0.08)',
                }}
                onClick={() => showCellModal(cell, state, setModal)}
              >
                {gc && <div className="cell-stripe" style={{ background: gc.color }} />}
                {isCorner ? (
                  <span className="corner-icon">{cell.icon}</span>
                ) : (
                  <span className="cell-lbl">{cell.name.split('\n')[0].substring(0, 8)}</span>
                )}
                {cell.mortgaged && <span className="mort-badge">M</span>}
                {(cell.houses || 0) > 0 && (
                  <span className="house-badge">{cell.houses === 5 ? '🏨' : '🏠'.repeat(cell.houses)}</span>
                )}
                {pawns.length > 0 && (
                  <div className="pawn-cluster">
                    {pawns.map(p => (
                      <span key={p.id} className={`board-pawn ${animatingPawns.has(p.id) ? 'hopAnimation' : ''}`}>{p.token}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* center */}
          <div className="board-center" style={{ left: size, top: size, width: size * 9, height: size * 9 }}>
            <div className="bc-logo">METRO MAGNATE</div>
            {state.freeParking > 0 && <div className="bc-pot">🅿️ ${state.freeParking}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function showCellModal(cell, state, setModal) {
  const owner = cell.owner != null ? state.players.find(p => p.id === cell.owner) : null;
  const gc = cell.group ? COLOR_GROUPS[cell.group] : null;

  setModal(
    <div className="cell-info-modal">
      {gc && <div className="cim-stripe" style={{ background: gc.color }} />}
      <h3 className="cim-name">{cell.name}</h3>
      {cell.type === 'property' && (
        <>
          <div className="cim-group" style={{ color: gc?.color }}>
            {gc?.name} Group · ${cell.price}
          </div>
          <div className="cim-rents">
            {['0 houses','1 house','2 houses','3 houses','4 houses','Hotel'].map((l, i) => (
              <div key={i} className="cim-row">
                <span>{l}</span>
                <span>${cell.rent[i]}</span>
              </div>
            ))}
            <div className="cim-row"><span>Build cost</span><span>${gc?.houseCost}</span></div>
          </div>
        </>
      )}
      {cell.type === 'railroad' && (
        <div className="cim-rents">
          {[1,2,3,4].map((n,i) => (
            <div key={i} className="cim-row"><span>{n} railroad{n>1?'s':''}</span><span>${cell.rent[i]}</span></div>
          ))}
        </div>
      )}
      {cell.type === 'utility' && (
        <p className="cim-desc">Rent = 4× or 10× dice roll depending on how many utilities are owned.</p>
      )}
      {owner && (
        <div className="cim-owner" style={{ color: owner.color }}>
          {owner.token} Owned by {owner.name}
          {cell.mortgaged && ' (Mortgaged)'}
          {(cell.houses || 0) > 0 && ` · ${cell.houses === 5 ? '🏨 Hotel' : `${'🏠'.repeat(cell.houses)}`}`}
        </div>
      )}
      {!owner && cell.price && (
        <div className="cim-owner">Unowned · ${ cell.price}</div>
      )}
    </div>
  );
}

// ─── ACTION BAR ─────────────────────────────────
function ActionBar({ state, myPlayer, dispatch, setModal }) {
  const [showBuild, setShowBuild] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showMort, setShowMort] = useState(false);
  const phase = state.phase;
  const canRoll = !state.rollDone;
  const canEnd = state.rollDone && (phase === 'end' || phase === 'roll');

  const buildable = myPlayer.properties
    .map(idx => state.board[idx])
    .filter(c => c.type === 'property' && c.group &&
      GROUP_CELLS[c.group]?.every(i => state.board[i].owner === myPlayer.id) &&
      (c.houses || 0) < 5 &&
      myPlayer.cash >= COLOR_GROUPS[c.group].houseCost
    );

  return (
    <div className="action-bar">
      <div className="action-row">
        <ActionBtn icon="🎲" label="Roll" disabled={!canRoll} onClick={() => { setIsRolling(true); dispatch('roll'); setTimeout(() => setIsRolling(false), 600); }} highlight={canRoll} />
        <ActionBtn icon="🏗" label="Build" disabled={buildable.length === 0} onClick={() => setShowBuild(true)} />
        <ActionBtn icon="⇄" label="Trade" onClick={() => setShowTrade(true)} />
        <ActionBtn icon="🏦" label="Mort." onClick={() => setShowMort(true)} />
        {myPlayer.inJail && myPlayer.jailFreeCards > 0 && (
          <ActionBtn icon="🃏" label="Jail Free" onClick={() => dispatch('jail_free')} />
        )}
        <ActionBtn icon="💀" label="Bankrupt" onClick={() => {
          setModal(
            <ConfirmModal
              title="Declare Bankruptcy?"
              desc="All your assets will be lost."
              onYes={() => { dispatch('bankrupt'); setModal(null); }}
              onNo={() => setModal(null)}
            />
          );
        }} danger />
        <ActionBtn icon="⏭" label="End" disabled={!canEnd} onClick={() => dispatch('end_turn')} highlight={canEnd} />
      </div>

      {showBuild && (
        <ModalOverlay onClose={() => setShowBuild(false)}>
          <BuildMenu buildable={buildable} dispatch={dispatch} onClose={() => setShowBuild(false)} />
        </ModalOverlay>
      )}
      {showTrade && (
        <ModalOverlay onClose={() => setShowTrade(false)}>
          <TradeMenu state={state} myPlayer={myPlayer} dispatch={dispatch} onClose={() => setShowTrade(false)} />
        </ModalOverlay>
      )}
      {showMort && (
        <ModalOverlay onClose={() => setShowMort(false)}>
          <MortgageMenu state={state} myPlayer={myPlayer} dispatch={dispatch} onClose={() => setShowMort(false)} />
        </ModalOverlay>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, disabled, onClick, highlight, danger }) {
  return (
    <button
      className={`act-btn ${highlight ? 'highlight' : ''} ${danger ? 'danger' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="act-icon">{icon}</span>
      <span className="act-label">{label}</span>
    </button>
  );
}

// ─── BUILD MENU ─────────────────────────────────
function BuildMenu({ buildable, dispatch, onClose }) {
  return (
    <div className="sheet">
      <h3>🏗 Build Houses</h3>
      {buildable.map(cell => {
        const gc = COLOR_GROUPS[cell.group];
        return (
          <button key={cell.idx} className="sheet-item" onClick={() => { dispatch('build', { cellIdx: cell.idx }); onClose(); }}>
            <div className="si-stripe" style={{ background: gc.color }} />
            <span className="si-name">{cell.name}</span>
            <span className="si-detail">{cell.houses || 0}/4 🏠 · ${gc.houseCost}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── TRADE MENU ─────────────────────────────────
function TradeMenu({ state, myPlayer, dispatch, onClose }) {
  const [target, setTarget] = useState(null);
  const [offerCash, setOfferCash] = useState(0);
  const [wantCash, setWantCash] = useState(0);
  const [offerProps, setOfferProps] = useState([]);
  const [wantProps, setWantProps] = useState([]);
  const others = state.players.filter(p => !p.bankrupt && p.id !== myPlayer.id);

  function toggleProp(arr, setArr, idx) {
    setArr(arr.includes(idx) ? arr.filter(i => i !== idx) : [...arr, idx]);
  }

  if (!target) {
    return (
      <div className="sheet">
        <h3>⇄ Trade — Select Player</h3>
        {others.map(p => (
          <button key={p.id} className="sheet-item" onClick={() => setTarget(p)}>
            <span>{p.token}</span>
            <span className="si-name" style={{ color: p.color }}>{p.name}</span>
            <span className="si-detail">${p.cash}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="sheet">
      <h3>⇄ You ↔ {target.name}</h3>
      <div className="trade-grid">
        <div className="trade-col">
          <div className="tc-title">You offer</div>
          <input type="number" className="input-field" min="0" max={myPlayer.cash} value={offerCash}
            onChange={e => setOfferCash(+e.target.value)} placeholder="Cash $" />
          {myPlayer.properties.map(idx => (
            <label key={idx} className="prop-check">
              <input type="checkbox" checked={offerProps.includes(idx)}
                onChange={() => toggleProp(offerProps, setOfferProps, idx)} />
              {state.board[idx].name}
            </label>
          ))}
        </div>
        <div className="trade-col">
          <div className="tc-title">You want</div>
          <input type="number" className="input-field" min="0" max={target.cash} value={wantCash}
            onChange={e => setWantCash(+e.target.value)} placeholder="Cash $" />
          {target.properties.map(idx => (
            <label key={idx} className="prop-check">
              <input type="checkbox" checked={wantProps.includes(idx)}
                onChange={() => toggleProp(wantProps, setWantProps, idx)} />
              {state.board[idx].name}
            </label>
          ))}
        </div>
      </div>
      <button className="btn-primary mt-12" onClick={() => {
        dispatch('trade_propose', { toId: target.id, offerCash, offerProps, wantCash, wantProps });
        onClose();
      }}>Send Trade Offer</button>
    </div>
  );
}

// ─── MORTGAGE MENU ──────────────────────────────
function MortgageMenu({ state, myPlayer, dispatch, onClose }) {
  return (
    <div className="sheet">
      <h3>🏦 Mortgage Manager</h3>
      {myPlayer.properties.length === 0 && <p className="sheet-empty">No properties owned.</p>}
      {myPlayer.properties.map(idx => {
        const cell = state.board[idx];
        const mv = Math.floor(cell.price / 2);
        const liftCost = Math.floor(mv * 1.1);
        return (
          <div key={idx} className="mort-row">
            <span className={`mr-name ${cell.mortgaged ? 'muted' : ''}`}>{cell.name}</span>
            {cell.mortgaged ? (
              <button className="mr-btn green" onClick={() => { dispatch('unmortgage', { cellIdx: idx }); }}>
                Lift +${liftCost}
              </button>
            ) : (
              <button className="mr-btn" onClick={() => { dispatch('mortgage', { cellIdx: idx }); }}>
                Mortgage +${mv}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PROPERTIES VIEW ────────────────────────────
function PropertiesView({ state, myId, dispatch, isMyTurn }) {
  return (
    <div className="props-view">
      {state.players.filter(p => !p.bankrupt).map(player => (
        <div key={player.id} className="pv-section">
          <div className="pv-header">
            <span>{player.token}</span>
            <span style={{ color: player.color }}>{player.name}</span>
            <span className="pv-cash">${player.cash}</span>
          </div>
          {player.properties.length === 0 && <div className="pv-empty">No properties</div>}
          <div className="pv-props">
            {player.properties.map(idx => {
              const cell = state.board[idx];
              const gc = cell.group ? COLOR_GROUPS[cell.group] : null;
              return (
                <div key={idx} className={`pv-prop ${cell.mortgaged ? 'mortgaged' : ''}`}>
                  {gc && <div className="pvp-stripe" style={{ background: gc.color }} />}
                  <span className="pvp-name">{cell.name}</span>
                  {cell.houses > 0 && <span className="pvp-houses">{cell.houses === 5 ? '🏨' : '🏠'.repeat(cell.houses)}</span>}
                  {cell.mortgaged && <span className="pvp-mort">M</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LOG VIEW ───────────────────────────────────
function LogView({ log }) {
  return (
    <div className="log-view">
      {log.map((entry, i) => (
        <div key={i} className={`log-entry ${entry.type}`}>
          {entry.msg}
        </div>
      ))}
    </div>
  );
}

// ─── CARD MODAL ─────────────────────────────────
function CardModal({ card, onAck }) {
  const isChance = card.deckType === 'chance';
  return (
    <ModalOverlay>
      <div className={`card-modal ${isChance ? 'chance' : 'chest'}`}>
        <div className="card-type">{isChance ? '❓ Chance' : '📦 Community Chest'}</div>
        <p className="card-text">{card.text}</p>
        <button className="btn-primary" onClick={onAck}>OK</button>
      </div>
    </ModalOverlay>
  );
}

// ─── RENT MODAL ─────────────────────────────────
function RentModal({ state, rent, onPay }) {
  const owner = state.players.find(p => p.id === rent.ownerId);
  return (
    <ModalOverlay>
      <div className="rent-modal">
        <div className="rm-title">🏙 Rent Due</div>
        <p>You owe <span style={{ color: owner?.color }}>{owner?.token} {owner?.name}</span></p>
        <div className="rm-amount">${rent.amount}</div>
        <button className="btn-primary btn-danger" onClick={onPay}>Pay ${rent.amount}</button>
      </div>
    </ModalOverlay>
  );
}

// ─── BUY MODAL ──────────────────────────────────
function BuyModal({ state, player, onBuy, onPass }) {
  const cell = state.board[player.pos];
  const gc = cell.group ? COLOR_GROUPS[cell.group] : null;
  return (
    <ModalOverlay>
      <div className="buy-modal">
        {gc && <div className="bm-stripe" style={{ background: gc.color }} />}
        <div className="bm-name">{cell.name}</div>
        {gc && <div className="bm-group" style={{ color: gc.color }}>{gc.name} Group</div>}
        <div className="bm-price">${cell.price}</div>
        <div className="bm-cash">Your cash: ${player.cash} → ${player.cash - cell.price}</div>
        {cell.type === 'property' && (
          <div className="bm-rent">Base rent: ${cell.rent[0]}</div>
        )}
        <div className="bm-btns">
          <button className="btn-primary" onClick={onBuy} disabled={player.cash < cell.price}>Buy</button>
          <button className="btn-secondary" onClick={onPass}>Auction</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── AUCTION MODAL ──────────────────────────────
function AuctionModal({ state, myId, onBid }) {
  const [bid, setBid] = useState(0);
  const myPlayer = state.players.find(p => p.id === myId);
  const cell = state.board[state.pendingAuction.cellIdx];
  const myBid = state.pendingAuction.bids[myId];
  const gc = cell.group ? COLOR_GROUPS[cell.group] : null;
  const allCount = state.players.filter(p => !p.bankrupt).length;
  const bidCount = Object.keys(state.pendingAuction.bids).length;

  return (
    <ModalOverlay>
      <div className="auction-modal">
        <div className="am-title">🔨 Auction</div>
        {gc && <div className="am-stripe" style={{ background: gc.color }} />}
        <div className="am-prop">{cell.name}</div>
        <div className="am-status">{bidCount}/{allCount} bids placed</div>
        {myBid !== undefined ? (
          <div className="am-mybid">Your bid: ${myBid} submitted ✓</div>
        ) : (
          <>
            <input type="number" className="input-field" min="0" max={myPlayer?.cash || 0}
              value={bid} onChange={e => setBid(+e.target.value)} placeholder="Your bid" />
            <button className="btn-primary mt-12" onClick={() => onBid(bid)}>Submit Bid</button>
            <button className="btn-secondary mt-8" onClick={() => onBid(0)}>Pass (bid $0)</button>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

// ─── TRADE OFFER MODAL ──────────────────────────
function TradeOfferModal({ state, trade, onAccept, onDecline }) {
  const from = state.players.find(p => p.id === trade.fromId);
  return (
    <ModalOverlay>
      <div className="trade-offer-modal">
        <div className="tom-title">⇄ Trade Offer</div>
        <p>from <span style={{ color: from?.color }}>{from?.token} {from?.name}</span></p>
        <div className="tom-grid">
          <div className="tom-col">
            <div className="tc-title">They offer</div>
            {trade.offerCash > 0 && <div>${trade.offerCash}</div>}
            {trade.offerProps.map(i => <div key={i}>{state.board[i].name}</div>)}
          </div>
          <div className="tom-col">
            <div className="tc-title">They want</div>
            {trade.wantCash > 0 && <div>${trade.wantCash}</div>}
            {trade.wantProps.map(i => <div key={i}>{state.board[i].name}</div>)}
          </div>
        </div>
        <div className="bm-btns">
          <button className="btn-primary" onClick={onAccept}>Accept</button>
          <button className="btn-secondary" onClick={onDecline}>Decline</button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── CONFIRM MODAL ──────────────────────────────
function ConfirmModal({ title, desc, onYes, onNo }) {
  return (
    <div className="confirm-modal">
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="bm-btns">
        <button className="btn-primary btn-danger" onClick={onYes}>Confirm</button>
        <button className="btn-secondary" onClick={onNo}>Cancel</button>
      </div>
    </div>
  );
}

// ─── WIN SCREEN ─────────────────────────────────
function WinScreen({ state, onRestart }) {
  const winner = state.players.find(p => p.id === state.winner);
  return (
    <div className="win-screen">
      <div className="win-content">
        <div className="win-trophy">🏆</div>
        <div className="win-token">{winner?.token}</div>
        <div className="win-name" style={{ color: winner?.color }}>{winner?.name}</div>
        <div className="win-sub">City Tycoon Champion!</div>
        <div className="win-stats">
          {state.players.map(p => (
            <div key={p.id} className={`ws-row ${p.bankrupt ? 'bankrupt' : ''}`}>
              <span>{p.token} {p.name}</span>
              <span>${p.cash}</span>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-24" onClick={onRestart}>Play Again</button>
      </div>
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────
function ModalOverlay({ children, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="modal-box">
        {onClose && <button className="modal-close" onClick={onClose}>✕</button>}
        {children}
      </div>
    </div>
  );
}

function Toast({ msg, type }) {
  return <div className={`toast toast-${type}`}>{msg}</div>;
}
