// ═══════════════════════════════════════════════
// METRO MAGNATE — Game Engine (Server-Side)
// ═══════════════════════════════════════════════

const {
  BOARD, GROUP_CELLS, COLOR_GROUPS,
  CHANCE_CARDS, CHEST_CARDS
} = require('../shared/gameData');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createGameState(players) {
  const board = BOARD.map(c => ({ ...c }));

  return {
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      token: p.token,
      color: p.color,
      cash: 1500,
      pos: 0,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      properties: [],
      bankrupt: false,
      movingSteps: 0,
    })),
    board,
    currentIdx: 0,
    phase: 'roll',        // roll | rolled | buy | card | jail | end
    dice: [1, 1],
    doublesCount: 0,
    rollDone: false,
    freeParking: 0,
    chanceIdx: 0,
    chestIdx: 0,
    chanceDeck: shuffle(CHANCE_CARDS.map((_, i) => i)),
    chestDeck: shuffle(CHEST_CARDS.map((_, i) => i)),
    log: [],
    winner: null,
    pendingCard: null,     // card waiting for player acknowledgement
    pendingRent: null,     // rent waiting for payment
    pendingAuction: null,  // auction in progress
    tradeOffer: null,      // pending trade
    isMoving: false,       // for movement animation
    movingPlayerId: null,  // player currently moving
  };
}

function addLog(state, msg, type = '') {
  state.log.unshift({ msg, type, ts: Date.now() });
  if (state.log.length > 60) state.log.pop();
}

function currentPlayer(state) {
  return state.players[state.currentIdx];
}

function ownsFullGroup(state, playerId, group) {
  const cells = GROUP_CELLS[group] || [];
  return cells.every(idx => state.board[idx].owner === playerId);
}

function adjustCash(state, playerId, amount) {
  const p = state.players.find(pl => pl.id === playerId);
  if (p) p.cash = Math.max(0, p.cash + amount);
}

function rollDice(state) {
  const die1 = Math.ceil(Math.random() * 6);
  const die2 = Math.ceil(Math.random() * 6);
  state.dice = [die1, die2];
  return { die: die1 + die2, doubles: die1 === die2 };
}

function sendToJail(state, playerId) {
  const p = state.players.find(pl => pl.id === playerId);
  p.pos = 10;
  p.inJail = true;
  p.jailTurns = 0;
  addLog(state, `${p.token} ${p.name} went to Jail!`, 'bad');
}

function netWorth(state, playerId) {
  const p = state.players.find(pl => pl.id === playerId);
  if (!p) return 0;
  return p.cash + p.properties.reduce((sum, idx) => {
    const cell = state.board[idx];
    return sum + Math.floor(cell.price / 2) + ((cell.houses || 0) * (COLOR_GROUPS[cell.group]?.houseCost || 50) * 0.5);
  }, 0);
}

// ─── ACTIONS ────────────────────────────────────

function actionRoll(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId || state.rollDone) return { error: 'Not your turn or already rolled' };

  const { die, doubles } = rollDice(state);
  const total = die;
  addLog(state, `${p.token} ${p.name} rolled ${total} ${doubles ? '(Doubles!)' : ''}`, '');

  if (p.inJail) {
    if (doubles) {
      p.inJail = false; p.jailTurns = 0;
      addLog(state, `${p.token} ${p.name} rolled doubles and left jail!`, 'good');
      state.rollDone = true; // Still one move
      return movePlayer(state, p, total);
    } else {
      p.jailTurns++;
      if (p.jailTurns >= 3) {
        adjustCash(state, p.id, -50);
        p.inJail = false; p.jailTurns = 0;
        addLog(state, `${p.token} ${p.name} paid $50 fine and left jail`, 'bad');
        state.rollDone = true;
        return movePlayer(state, p, total);
      }
      addLog(state, `${p.token} ${p.name} stays in jail (turn ${p.jailTurns}/3)`, 'bad');
      state.rollDone = true;
      state.phase = 'end';
      return { state };
    }
  }

  if (doubles) {
    state.doublesCount++;
    if (state.doublesCount >= 3) {
      addLog(state, `${p.token} ${p.name} rolled 3 doubles! Go to Jail!`, 'bad');
      state.doublesCount = 0;
      state.rollDone = true;
      sendToJail(state, p.id);
      state.phase = 'end';
      return { state };
    } else {
      state.rollDone = false; // Can roll again
    }
  } else {
    state.doublesCount = 0;
    state.rollDone = true;
  }

  return movePlayer(state, p, total);
}

function movePlayer(state, p, steps) {
  const oldPos = p.pos;
  const newPos = (p.pos + steps) % 40;
  if (newPos < oldPos) {
    adjustCash(state, p.id, 200);
    addLog(state, `${p.token} ${p.name} passed GO — collected $200!`, 'good');
  }
  p.pos = newPos;
  return landOn(state, p, state.board[newPos]);
}

function moveTo(state, p, targetIdx) {
  if (targetIdx <= p.pos && !p.inJail) {
    adjustCash(state, p.id, 200);
    addLog(state, `${p.token} ${p.name} passed GO — collected $200!`, 'good');
  }
  p.pos = targetIdx;
  return landOn(state, p, state.board[targetIdx]);
}

function landOn(state, p, cell) {
  addLog(state, `${p.token} ${p.name} landed on ${cell.name}`, '');

  if (cell.type === 'go') {
    state.phase = 'end';
  } else if (cell.type === 'gojail') {
    sendToJail(state, p.id);
    state.phase = 'end';
  } else if (cell.type === 'parking') {
    if (state.freeParking > 0) {
      adjustCash(state, p.id, state.freeParking);
      addLog(state, `${p.token} ${p.name} collected Free Parking pot: $${state.freeParking}!`, 'good');
      state.freeParking = 0;
    }
    state.phase = 'end';
  } else if (cell.type === 'jail') {
    state.phase = 'end';
  } else if (cell.type === 'tax') {
    adjustCash(state, p.id, -cell.cost);
    state.freeParking += cell.cost;
    addLog(state, `${p.token} ${p.name} paid $${cell.cost} tax`, 'bad');
    state.phase = 'end';
  } else if (cell.type === 'chance') {
    const cardIdx = state.chanceDeck[state.chanceIdx % state.chanceDeck.length];
    state.chanceIdx++;
    const card = CHANCE_CARDS[cardIdx];
    state.pendingCard = { ...card, deckType: 'chance' };
    state.phase = 'card';
  } else if (cell.type === 'chest') {
    const cardIdx = state.chestDeck[state.chestIdx % state.chestDeck.length];
    state.chestIdx++;
    const card = CHEST_CARDS[cardIdx];
    state.pendingCard = { ...card, deckType: 'chest' };
    state.phase = 'card';
  } else if (cell.type === 'railroad' || cell.type === 'utility' || cell.type === 'property') {
    if (cell.owner === undefined || cell.owner === null) {
      state.phase = 'buy';
    } else if (cell.owner === p.id) {
      state.phase = 'end';
    } else {
      const owner = state.players.find(pl => pl.id === cell.owner);
      if (!owner || owner.bankrupt || cell.mortgaged) {
        state.phase = 'end';
        return { state };
      }
      const rent = calcRent(state, cell, p);
      state.pendingRent = { cellIdx: cell.idx, ownerId: owner.id, debtorId: p.id, amount: rent };
      state.phase = 'rent';
    }
  }

  return { state };
}

function calcRent(state, cell, payer) {
  const owner = state.players.find(pl => pl.id === cell.owner);
  if (!owner) return 0;
  if (cell.type === 'railroad') {
    const count = owner.properties.filter(i => state.board[i].type === 'railroad').length;
    return cell.rent[count - 1];
  }
  if (cell.type === 'utility') {
    const count = owner.properties.filter(i => state.board[i].type === 'utility').length;
    return (state.dice[0] + state.dice[1]) * (count === 2 ? 10 : 4);
  }
  const houses = cell.houses || 0;
  let rent = cell.rent[houses];
  if (houses === 0 && ownsFullGroup(state, owner.id, cell.group)) rent *= 2;
  return rent;
}

function actionAcknowledgeCard(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId || !state.pendingCard) return { error: 'No card pending' };
  const card = state.pendingCard;
  state.pendingCard = null;

  if (card.action === 'cash') {
    if (card.amount > 0) {
      adjustCash(state, p.id, card.amount);
      addLog(state, `${p.token} ${p.name} received $${card.amount}`, 'good');
    } else {
      const amt = -card.amount;
      adjustCash(state, p.id, -amt);
      state.freeParking += amt;
      addLog(state, `${p.token} ${p.name} paid $${amt}`, 'bad');
    }
    state.phase = 'end';
  } else if (card.action === 'goto') {
    moveTo(state, p, card.target);
  } else if (card.action === 'move') {
    const newPos = ((p.pos + card.delta) + 40) % 40;
    p.pos = newPos;
    landOn(state, p, state.board[newPos]);
  } else if (card.action === 'gojail') {
    sendToJail(state, p.id);
    state.phase = 'end';
  } else if (card.action === 'jail-free') {
    p.jailFreeCards++;
    addLog(state, `${p.token} ${p.name} got a Get Out of Jail Free card!`, 'good');
    state.phase = 'end';
  } else if (card.action === 'repairs') {
    let cost = 0;
    p.properties.forEach(idx => {
      const c = state.board[idx];
      if (c.houses > 0 && c.houses < 5) cost += c.houses * card.h;
      if (c.houses === 5) cost += card.ho;
    });
    if (cost > 0) {
      adjustCash(state, p.id, -cost);
      state.freeParking += cost;
      addLog(state, `${p.token} ${p.name} paid $${cost} in repairs`, 'bad');
    }
    state.phase = 'end';
  } else if (card.action === 'pay-all') {
    state.players.filter(pl => !pl.bankrupt && pl.id !== p.id).forEach(pl => {
      adjustCash(state, p.id, -card.amount);
      adjustCash(state, pl.id, card.amount);
    });
    addLog(state, `${p.token} ${p.name} paid each player $${card.amount}`, 'bad');
    state.phase = 'end';
  } else if (card.action === 'collect-all') {
    state.players.filter(pl => !pl.bankrupt && pl.id !== p.id).forEach(pl => {
      adjustCash(state, pl.id, -card.amount);
      adjustCash(state, p.id, card.amount);
    });
    addLog(state, `${p.token} ${p.name} collected $${card.amount} from each player`, 'good');
    state.phase = 'end';
  }

  return { state };
}

function actionPayRent(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId || !state.pendingRent) return { error: 'No rent pending' };
  const { ownerId, debtorId, amount } = state.pendingRent;
  state.pendingRent = null;

  if (p.cash < amount) {
    addLog(state, `${p.token} ${p.name} can't afford rent of $${amount}!`, 'bad');
    checkBankruptcy(state, p.id, ownerId, amount);
  } else {
    adjustCash(state, debtorId, -amount);
    adjustCash(state, ownerId, amount);
    const owner = state.players.find(pl => pl.id === ownerId);
    addLog(state, `${p.token} ${p.name} paid $${amount} rent to ${owner.token} ${owner.name}`, 'bad');
  }
  state.phase = 'end';
  return { state };
}

function actionBuyProperty(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId) return { error: 'Not your turn' };
  const cell = state.board[p.pos];
  if (cell.owner !== undefined && cell.owner !== null) return { error: 'Already owned' };
  if (p.cash < cell.price) return { error: 'Not enough cash' };

  adjustCash(state, p.id, -cell.price);
  cell.owner = p.id;
  p.properties.push(cell.idx);
  addLog(state, `${p.token} ${p.name} bought ${cell.name} for $${cell.price}`, 'good');
  state.phase = 'end';
  return { state };
}

function actionPassBuy(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId) return { error: 'Not your turn' };
  const cell = state.board[p.pos];
  // Start auction
  state.pendingAuction = {
    cellIdx: cell.idx,
    bids: {},
    phase: 'bidding',
  };
  addLog(state, `${cell.name} goes to auction!`, 'info');
  state.phase = 'auction';
  return { state };
}

function actionBid(state, playerId, amount) {
  if (!state.pendingAuction) return { error: 'No auction' };
  const p = state.players.find(pl => pl.id === playerId);
  if (!p || p.bankrupt) return { error: 'Invalid player' };
  if (amount < 0 || amount > p.cash) return { error: 'Invalid bid' };
  state.pendingAuction.bids[playerId] = amount;

  const activePlayers = state.players.filter(pl => !pl.bankrupt);
  const allBid = activePlayers.every(pl => state.pendingAuction.bids[pl.id] !== undefined);

  if (allBid) {
    let winner = null, best = 0;
    activePlayers.forEach(pl => {
      const bid = state.pendingAuction.bids[pl.id] || 0;
      if (bid > best) { best = bid; winner = pl; }
    });
    if (winner && best > 0) {
      const cell = state.board[state.pendingAuction.cellIdx];
      adjustCash(state, winner.id, -best);
      cell.owner = winner.id;
      winner.properties.push(cell.idx);
      addLog(state, `${winner.token} ${winner.name} won auction for ${cell.name} at $${best}!`, 'good');
    } else {
      addLog(state, `Auction ended — no winner`, '');
    }
    state.pendingAuction = null;
    state.phase = 'end';
  }
  return { state };
}

function actionBuildHouse(state, playerId, cellIdx) {
  const p = state.players.find(pl => pl.id === playerId);
  const cp = currentPlayer(state);
  if (cp.id !== playerId) return { error: 'Not your turn' };
  const cell = state.board[cellIdx];
  if (!cell || cell.owner !== playerId || cell.type !== 'property') return { error: 'Invalid cell' };
  if (!ownsFullGroup(state, playerId, cell.group)) return { error: 'Need full color group' };
  const cost = COLOR_GROUPS[cell.group].houseCost;
  if (p.cash < cost) return { error: 'Not enough cash' };
  if ((cell.houses || 0) >= 5) return { error: 'Already has hotel' };

  adjustCash(state, playerId, -cost);
  cell.houses = (cell.houses || 0) + 1;
  addLog(state, `${p.token} ${p.name} built a ${cell.houses === 5 ? 'hotel' : 'house'} on ${cell.name}`, 'good');
  return { state };
}

function actionMortgage(state, playerId, cellIdx) {
  const p = state.players.find(pl => pl.id === playerId);
  const cell = state.board[cellIdx];
  if (!cell || cell.owner !== playerId || cell.mortgaged) return { error: 'Cannot mortgage' };
  const mv = Math.floor(cell.price / 2);
  cell.mortgaged = true;
  adjustCash(state, playerId, mv);
  addLog(state, `${p.token} ${p.name} mortgaged ${cell.name} for $${mv}`, 'good');
  return { state };
}

function actionUnmortgage(state, playerId, cellIdx) {
  const p = state.players.find(pl => pl.id === playerId);
  const cell = state.board[cellIdx];
  if (!cell || cell.owner !== playerId || !cell.mortgaged) return { error: 'Not mortgaged' };
  const cost = Math.floor(cell.price / 2 * 1.1);
  if (p.cash < cost) return { error: 'Not enough cash' };
  cell.mortgaged = false;
  adjustCash(state, playerId, -cost);
  addLog(state, `${p.token} ${p.name} unmortgaged ${cell.name}`, 'good');
  return { state };
}

function actionUseJailFree(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId || !p.inJail || p.jailFreeCards < 1) return { error: 'Cannot use' };
  p.jailFreeCards--;
  p.inJail = false; p.jailTurns = 0;
  addLog(state, `${p.token} ${p.name} used a Get Out of Jail Free card!`, 'good');
  state.phase = 'roll';
  return { state };
}

function actionProposeTrade(state, fromId, toId, offerCash, offerProps, wantCash, wantProps) {
  state.tradeOffer = { fromId, toId, offerCash, offerProps, wantCash, wantProps };
  addLog(state, `Trade proposed between players`, 'info');
  return { state };
}

function actionAcceptTrade(state, playerId) {
  const t = state.tradeOffer;
  if (!t || t.toId !== playerId) return { error: 'No trade for you' };
  const from = state.players.find(p => p.id === t.fromId);
  const to = state.players.find(p => p.id === t.toId);

  if (from.cash < t.offerCash || to.cash < t.wantCash) {
    state.tradeOffer = null;
    return { error: 'Insufficient cash' };
  }

  adjustCash(state, from.id, -t.offerCash + t.wantCash);
  adjustCash(state, to.id, -t.wantCash + t.offerCash);

  t.offerProps.forEach(idx => {
    state.board[idx].owner = to.id;
    from.properties = from.properties.filter(p => p !== idx);
    to.properties.push(idx);
  });
  t.wantProps.forEach(idx => {
    state.board[idx].owner = from.id;
    to.properties = to.properties.filter(p => p !== idx);
    from.properties.push(idx);
  });

  addLog(state, `Trade completed: ${from.name} ↔ ${to.name}`, 'good');
  state.tradeOffer = null;
  return { state };
}

function actionDeclineTrade(state, playerId) {
  if (!state.tradeOffer || state.tradeOffer.toId !== playerId) return { error: 'No trade' };
  addLog(state, `Trade declined`, '');
  state.tradeOffer = null;
  return { state };
}

function actionBankrupt(state, playerId) {
  const p = state.players.find(pl => pl.id === playerId);
  if (!p) return { error: 'Player not found' };
  p.bankrupt = true;
  p.properties.forEach(idx => {
    const c = state.board[idx];
    c.owner = null; c.houses = 0; c.mortgaged = false;
  });
  p.properties = [];
  addLog(state, `${p.token} ${p.name} declared bankruptcy!`, 'bad');

  // advance turn if it was their turn
  if (currentPlayer(state).id === playerId) {
    return advanceTurn(state);
  }
  checkWin(state);
  return { state };
}

function actionEndTurn(state, playerId) {
  const p = currentPlayer(state);
  if (p.id !== playerId) return { error: 'Not your turn' };
  if (!state.rollDone) return { error: 'Must roll first' };
  return advanceTurn(state);
}

function advanceTurn(state) {
  state.rollDone = false;
  state.doublesCount = 0;
  let next = (state.currentIdx + 1) % state.players.length;
  let tries = 0;
  while (state.players[next].bankrupt && tries < state.players.length) {
    next = (next + 1) % state.players.length;
    tries++;
  }
  state.currentIdx = next;
  state.phase = 'roll';
  const np = state.players[next];
  addLog(state, `— ${np.token} ${np.name}'s turn —`, 'info');
  checkWin(state);
  return { state };
}

function checkBankruptcy(state, debtorId, creditorId, amount) {
  const p = state.players.find(pl => pl.id === debtorId);
  const worth = netWorth(state, debtorId);
  if (worth < amount) {
    // force bankruptcy
    p.bankrupt = true;
    // transfer to creditor if creditor exists
    if (creditorId) {
      const cr = state.players.find(pl => pl.id === creditorId);
      if (cr) {
        p.properties.forEach(idx => {
          state.board[idx].owner = creditorId;
          cr.properties.push(idx);
        });
        adjustCash(state, creditorId, p.cash);
      }
    }
    p.properties = []; p.cash = 0;
    addLog(state, `${p.token} ${p.name} went bankrupt!`, 'bad');
    checkWin(state);
  }
}

function checkWin(state) {
  const alive = state.players.filter(p => !p.bankrupt);
  if (alive.length === 1) {
    state.winner = alive[0].id;
    state.phase = 'won';
    addLog(state, `🏆 ${alive[0].token} ${alive[0].name} wins Metro Magnate!`, 'info');
  }
}

module.exports = {
  createGameState, actionRoll, actionAcknowledgeCard, actionPayRent,
  actionBuyProperty, actionPassBuy, actionBid, actionBuildHouse,
  actionMortgage, actionUnmortgage, actionUseJailFree,
  actionProposeTrade, actionAcceptTrade, actionDeclineTrade,
  actionBankrupt, actionEndTurn,
};
