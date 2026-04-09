// ═══════════════════════════════════════════════
// METRO MAGNATE — WebSocket Server
// ═══════════════════════════════════════════════

const { WebSocketServer } = require('ws');
const http = require('http');
const { createGameState, ...actions } = require('./gameEngine');

const PORT = process.env.PORT || 3001;
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
        players: [{ id: playerId, ws, name: msg.name, token: msg.token, color: msg.color }],
        host: playerId,
        started: false,
      };
      sendTo(ws, { type: 'created', code, playerId });
      broadcast(rooms[code], { type: 'lobby', players: rooms[code].players.map(p=>({id:p.id,name:p.name,token:p.token,color:p.color})), host: playerId });
      return;
    }

    // ── JOIN ROOM ──
    if (msg.type === 'join') {
      const room = rooms[msg.code];
      if (!room) { sendTo(ws, { type: 'error', msg: 'Room not found' }); return; }
      if (room.started) { sendTo(ws, { type: 'error', msg: 'Game already started' }); return; }
      if (room.players.length >= 8) { sendTo(ws, { type: 'error', msg: 'Room is full (8 players max)' }); return; }

      // Check if reconnecting
      const existing = room.players.find(p => p.name === msg.name);
      if (existing && !existing.ws) {
        existing.ws = ws;
        playerId = existing.id;
      } else {
        playerId = 'p_' + Math.random().toString(36).substring(2, 9);
        room.players.push({ id: playerId, ws, name: msg.name, token: msg.token, color: msg.color });
      }
      roomCode = msg.code;
      sendTo(ws, { type: 'joined', code: msg.code, playerId });
      broadcast(room, { type: 'lobby', players: room.players.map(p=>({id:p.id,name:p.name,token:p.token,color:p.color})), host: room.host });
      return;
    }

    const room = rooms[roomCode];
    if (!room) return;

    // ── START GAME ──
    if (msg.type === 'start') {
      if (room.host !== playerId) { sendTo(ws, { type: 'error', msg: 'Only host can start' }); return; }
      if (room.players.length < 2) { sendTo(ws, { type: 'error', msg: 'Need at least 2 players' }); return; }
      room.state = createGameState(room.players);
      room.started = true;
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
      bid:         () => actions.actionBid(room.state, playerId, msg.amount),
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
        delete rooms[roomCode];
      }
    }, 5 * 60 * 1000);
  });
});

server.listen(PORT, () => {
  console.log(`🏙 Metro Magnate server running on port ${PORT}`);
});
