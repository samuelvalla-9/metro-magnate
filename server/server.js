// ═══════════════════════════════════════════════
// METRO MAGNATE — WebSocket Server
// ═══════════════════════════════════════════════

const { WebSocketServer } = require('ws');
const http = require('http');
const { createGameState, ...actions } = require('./gameEngine');
const { PLAYER_COLORS } = require('../shared/gameData');

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Metro Magnate Game Server');
});

const wss = new WebSocketServer({ server });

// rooms: { [roomCode]: { state, players: [{id, ws, name, token, color}], host } }
const rooms = {};

function genCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function broadcast(room, message) {
  room.players.forEach(p => {
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(message));
    }
  });
}

function sendTo(ws, message) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

function roomState(room) {
  return {
    type: 'state',
    state: room.state,
    players: room.players.map(p => ({ id: p.id, name: p.name, token: p.token, color: p.color, connected: p.ws?.readyState === 1 })),
  };
}

wss.on('connection', (ws) => {
  let playerId = null;
  let roomCode = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── CREATE ROOM ──
    if (msg.type === 'create') {
      const code = genCode();
      playerId = 'p_' + Math.random().toString(36).substring(2, 9);
      roomCode = code;
      rooms[code] = {
        state: null,
        players: [{ id: playerId, ws, name: msg.name, token: msg.token, color: PLAYER_COLORS[0] }],
        host: playerId,
        started: false,
        settings: msg.settings || { rounds: 0, netWorth: 0 },
      };
      sendTo(ws, { type: 'created', code, playerId });
      broadcast(rooms[code], { type: 'lobby', players: rooms[code].players.map(p=>({id:p.id,name:p.name,token:p.token,color:p.color})), host: playerId });
      return;
    }

    // ── JOIN ROOM ──
    if (msg.type === 'join') {
      const room = rooms[msg.code];
      if (!room) { sendTo(ws, { type: 'error', msg: 'Room not found' }); return; }

      // Check if this is a reconnection attempt (by ID or Name)
      const existing = room.players.find(p => (msg.playerId && p.id === msg.playerId) || (msg.name && p.name === msg.name));
      
      if (existing) {
        // Allow reconnection even if game started
        existing.ws = ws;
        playerId = existing.id;
        roomCode = msg.code;
        sendTo(ws, { type: 'joined', code: msg.code, playerId: existing.id });
        
        if (room.started) {
          sendTo(ws, roomState(room));
        } else {
          broadcast(room, { type: 'lobby', players: room.players.map(p=>({id:p.id,name:p.name,token:p.token,color:p.color})), host: room.host });
        }
        return;
      }

      // If not reconnecting, standard join rules apply
      if (room.started) { sendTo(ws, { type: 'error', msg: 'Game already started' }); return; }
      if (room.players.length >= 8) { sendTo(ws, { type: 'error', msg: 'Room is full (8 players max)' }); return; }

      // Check for duplicate emoji
      const hasDuplicate = room.players.some(p => p.token === msg.token);
      if (hasDuplicate) { sendTo(ws, { type: 'error', msg: 'duplicate_emoji', playerToken: msg.token }); return; }

      playerId = 'p_' + Math.random().toString(36).substring(2, 9);
      const color = PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];
      room.players.push({ id: playerId, ws, name: msg.name, token: msg.token, color });
      roomCode = msg.code;
      
      sendTo(ws, { type: 'joined', code: msg.code, playerId });
      broadcast(room, { type: 'lobby', players: room.players.map(p=>({id:p.id,name:p.name,token:p.token,color:p.color})), host: room.host });
      return;
    }

    const room = rooms[roomCode];
    if (!room) return;

    // Reset idle timer on any action from the current player
    const currentPlayer = room.state?.players[room.state.currentIdx];
    if (currentPlayer && currentPlayer.id === playerId) {
      room.lastActionAt = Date.now();
    }

    // ── START GAME ──
    if (msg.type === 'start') {
      if (room.host !== playerId) { sendTo(ws, { type: 'error', msg: 'Only host can start' }); return; }
      if (room.players.length < 2) { sendTo(ws, { type: 'error', msg: 'Need at least 2 players' }); return; }
      room.state = createGameState(room.players, room.settings);
      room.started = true;
      room.lastActionAt = Date.now();
      broadcast(room, roomState(room));
      return;
    }

    if (!room.state) return;

    // ── GAME ACTIONS ──
    const dispatch = {
      roll:        () => actions.actionRoll(room.state, playerId),
      ack_card:    () => actions.actionAcknowledgeCard(room.state, playerId),
      pay_rent:    () => actions.actionPayRent(room.state, playerId),
      buy:         () => actions.actionBuyProperty(room.state, playerId),
      pass_buy:    () => actions.actionPassBuy(room.state, playerId),
      build:       () => actions.actionBuildHouse(room.state, playerId, msg.cellIdx),
      mortgage:    () => actions.actionMortgage(room.state, playerId, msg.cellIdx),
      unmortgage:  () => actions.actionUnmortgage(room.state, playerId, msg.cellIdx),
      jail_free:   () => actions.actionUseJailFree(room.state, playerId),
      trade_propose: () => actions.actionProposeTrade(room.state, playerId, msg.toId, msg.offerCash, msg.offerProps, msg.wantCash, msg.wantProps),
      trade_accept:  () => actions.actionAcceptTrade(room.state, playerId),
      trade_decline: () => actions.actionDeclineTrade(room.state, playerId),
      bankrupt:    () => actions.actionBankrupt(room.state, playerId),
      end_turn:    () => actions.actionEndTurn(room.state, playerId),
    };

    if (dispatch[msg.type]) {
      const result = dispatch[msg.type]();
      if (result?.error) {
        sendTo(ws, { type: 'error', msg: result.error });
      } else {
        broadcast(room, roomState(room));
        
        // Handle Auto-End Turn if phase is 'end'
        if (room.state.phase === 'end') {
          if (room.autoEndTimeout) clearTimeout(room.autoEndTimeout);
          room.autoEndTimeout = setTimeout(() => {
            if (room.state && room.state.phase === 'end') {
              const currentP = room.state.players[room.state.currentIdx];
              actions.actionEndTurn(room.state, currentP.id);
              broadcast(room, roomState(room));
              room.lastActionAt = Date.now();
              room.autoEndTimeout = null;
            }
          }, 2000);
        }
      }
    }
  });

  ws.on('close', () => {
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.ws = null;
      broadcast(room, { type: 'player_disconnected', playerId, name: player.name });
    }
    // Cleanup empty rooms after delay
    setTimeout(() => {
      if (rooms[roomCode] && rooms[roomCode].players.every(p => !p.ws)) {
        if (rooms[roomCode].autoEndTimeout) clearTimeout(rooms[roomCode].autoEndTimeout);
        delete rooms[roomCode];
      }
    }, 5 * 60 * 1000);
  });
});

// Global heartbeat for Idle Timers
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(code => {
    const room = rooms[code];
    if (room.started && room.state && !room.state.winner) {
      if (room.state.phase === 'roll' && !room.state.rollDone) {
        if (now - room.lastActionAt > 60000) {
          const currentP = room.state.players[room.state.currentIdx];
          console.log(`[Auto-Roll] Room ${code}, Player ${currentP.name}`);
          actions.actionRoll(room.state, currentP.id);
          broadcast(room, roomState(room));
          room.lastActionAt = now;
        }
      }
    }
  });
}, 1000);

server.listen(PORT, () => {
  console.log(`🏙 Metro Magnate server running on port ${PORT}`);
});
