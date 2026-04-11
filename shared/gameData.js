// ═══════════════════════════════════════════════
// METRO MAGNATE — Shared Game Data
// ═══════════════════════════════════════════════

const TOKENS = ['🎩','🚂','🐕','🤠','⛵','🎸','🏆','🦋'];

const PLAYER_COLORS = [
  '#FF4757','#2ED573','#1E90FF','#FFA502',
  '#FF6B81','#7BED9F','#70A1FF','#ECCC68'
];

const COLOR_GROUPS = {
  brown:  { name:'Brown',   color:'#92400E', houseCost:50  },
  lblue:  { name:'Sky',     color:'#38BDF8', houseCost:50  },
  pink:   { name:'Magenta', color:'#EC4899', houseCost:100 },
  orange: { name:'Orange',  color:'#F97316', houseCost:100 },
  red:    { name:'Red',     color:'#EF4444', houseCost:150 },
  yellow: { name:'Gold',    color:'#EAB308', houseCost:150 },
  green:  { name:'Green',   color:'#22C55E', houseCost:200 },
  dblue:  { name:'Navy',    color:'#3B82F6', houseCost:200 },
};

const BOARD_40 = [{"name":"GO","type":"go","icon":"\ud83c\udfc1","idx":0},{"name":"Havana","type":"property","group":"brown","price":60,"rent":[2,10,30,80,120,160],"idx":1},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":2},{"name":"Taipei","type":"property","group":"brown","price":60,"rent":[4,20,60,160,240,320],"idx":3},{"name":"Tax $200","type":"tax","cost":200,"icon":"\ud83d\udcb8","idx":4},{"name":"Railway","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\ud83d\ude82","idx":5},{"name":"Cairo","type":"property","group":"lblue","price":100,"rent":[6,30,90,240,360,480],"idx":6},{"name":"Chance","type":"chance","icon":"\u2753","idx":7},{"name":"Madrid","type":"property","group":"lblue","price":100,"rent":[6,30,90,240,360,480],"idx":8},{"name":"Athens","type":"property","group":"lblue","price":120,"rent":[8,40,120,320,480,640],"idx":9},{"name":"Jail","type":"jail","icon":"\u26d3","idx":10},{"name":"Bangkok","type":"property","group":"pink","price":140,"rent":[10,50,150,400,600,800],"idx":11},{"name":"Electricity","type":"utility","price":150,"icon":"\ud83d\udca1","idx":12},{"name":"Delhi","type":"property","group":"pink","price":140,"rent":[10,50,150,400,600,800],"idx":13},{"name":"Rio","type":"property","group":"pink","price":160,"rent":[12,60,180,480,720,960],"idx":14},{"name":"Harbor","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\u26f5","idx":15},{"name":"Dubai","type":"property","group":"orange","price":180,"rent":[14,70,210,560,840,1120],"idx":16},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":17},{"name":"Paris","type":"property","group":"orange","price":180,"rent":[14,70,210,560,840,1120],"idx":18},{"name":"Moscow","type":"property","group":"orange","price":200,"rent":[16,80,240,640,960,1280],"idx":19},{"name":"Free Parking","type":"parking","icon":"\ud83c\udd7f\ufe0f","idx":20},{"name":"London","type":"property","group":"red","price":220,"rent":[18,90,270,720,1080,1440],"idx":21},{"name":"Chance","type":"chance","icon":"\u2753","idx":22},{"name":"Tokyo","type":"property","group":"red","price":220,"rent":[18,90,270,720,1080,1440],"idx":23},{"name":"New York","type":"property","group":"red","price":240,"rent":[20,100,300,800,1200,1600],"idx":24},{"name":"Airport","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\u2708\ufe0f","idx":25},{"name":"Beijing","type":"property","group":"yellow","price":260,"rent":[22,110,330,880,1320,1760],"idx":26},{"name":"Sydney","type":"property","group":"yellow","price":260,"rent":[22,110,330,880,1320,1760],"idx":27},{"name":"Waterworks","type":"utility","price":150,"icon":"\ud83d\udca7","idx":28},{"name":"Toronto","type":"property","group":"yellow","price":280,"rent":[24,120,360,960,1440,1920],"idx":29},{"name":"Go to Jail","type":"gojail","icon":"\ud83d\ude94","idx":30},{"name":"Zurich","type":"property","group":"green","price":300,"rent":[26,130,390,1040,1560,2080],"idx":31},{"name":"Riyadh","type":"property","group":"green","price":300,"rent":[26,130,390,1040,1560,2080],"idx":32},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":33},{"name":"Stockholm","type":"property","group":"green","price":320,"rent":[28,140,420,1120,1680,2240],"idx":34},{"name":"Spaceport","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\ud83d\ude80","idx":35},{"name":"Chance","type":"chance","icon":"\u2753","idx":36},{"name":"Hong Kong","type":"property","group":"dblue","price":350,"rent":[35,175,525,1400,2100,2800],"idx":37},{"name":"Luxury Tax","type":"tax","cost":100,"icon":"\ud83d\udc8e","idx":38},{"name":"Singapore","type":"property","group":"dblue","price":400,"rent":[50,250,750,2000,3000,4000],"idx":39}];
const BOARD_48 = [{"name":"GO","type":"go","icon":"\ud83c\udfc1","idx":0},{"name":"Havana","type":"property","group":"brown","price":60,"rent":[2,10,30,80,120,160],"idx":1},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":2},{"name":"Taipei","type":"property","group":"brown","price":60,"rent":[4,20,60,160,240,320],"idx":3},{"name":"Tax $200","type":"tax","cost":200,"icon":"\ud83d\udcb8","idx":4},{"name":"Manila","type":"property","group":"brown","price":60,"rent":[6,30,90,240,360,480],"idx":5},{"name":"Railway","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\ud83d\ude82","idx":6},{"name":"Cairo","type":"property","group":"lblue","price":100,"rent":[6,30,90,240,360,480],"idx":7},{"name":"Chance","type":"chance","icon":"\u2753","idx":8},{"name":"Madrid","type":"property","group":"lblue","price":100,"rent":[6,30,90,240,360,480],"idx":9},{"name":"Athens","type":"property","group":"lblue","price":120,"rent":[8,40,120,320,480,640],"idx":10},{"name":"Rome","type":"property","group":"lblue","price":120,"rent":[10,50,150,400,600,800],"idx":11},{"name":"Jail","type":"jail","icon":"\u26d3","idx":12},{"name":"Bangkok","type":"property","group":"pink","price":140,"rent":[10,50,150,400,600,800],"idx":13},{"name":"Electricity","type":"utility","price":150,"icon":"\ud83d\udca1","idx":14},{"name":"Delhi","type":"property","group":"pink","price":140,"rent":[10,50,150,400,600,800],"idx":15},{"name":"Rio","type":"property","group":"pink","price":160,"rent":[12,60,180,480,720,960],"idx":16},{"name":"Seoul","type":"property","group":"pink","price":160,"rent":[14,70,210,560,840,1120],"idx":17},{"name":"Harbor","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\u26f5","idx":18},{"name":"Dubai","type":"property","group":"orange","price":180,"rent":[14,70,210,560,840,1120],"idx":19},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":20},{"name":"Paris","type":"property","group":"orange","price":180,"rent":[14,70,210,560,840,1120],"idx":21},{"name":"Moscow","type":"property","group":"orange","price":200,"rent":[16,80,240,640,960,1280],"idx":22},{"name":"Berlin","type":"property","group":"orange","price":200,"rent":[18,90,270,720,1080,1440],"idx":23},{"name":"Free Parking","type":"parking","icon":"\ud83c\udd7f\ufe0f","idx":24},{"name":"London","type":"property","group":"red","price":220,"rent":[18,90,270,720,1080,1440],"idx":25},{"name":"Chance","type":"chance","icon":"\u2753","idx":26},{"name":"Tokyo","type":"property","group":"red","price":220,"rent":[18,90,270,720,1080,1440],"idx":27},{"name":"New York","type":"property","group":"red","price":240,"rent":[20,100,300,800,1200,1600],"idx":28},{"name":"Amsterdam","type":"property","group":"red","price":240,"rent":[22,110,330,880,1320,1760],"idx":29},{"name":"Airport","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\u2708\ufe0f","idx":30},{"name":"Beijing","type":"property","group":"yellow","price":260,"rent":[22,110,330,880,1320,1760],"idx":31},{"name":"Sydney","type":"property","group":"yellow","price":260,"rent":[22,110,330,880,1320,1760],"idx":32},{"name":"Waterworks","type":"utility","price":150,"icon":"\ud83d\udca7","idx":33},{"name":"Toronto","type":"property","group":"yellow","price":280,"rent":[24,120,360,960,1440,1920],"idx":34},{"name":"Vienna","type":"property","group":"yellow","price":280,"rent":[26,130,390,1040,1560,2080],"idx":35},{"name":"Go to Jail","type":"gojail","icon":"\ud83d\ude94","idx":36},{"name":"Zurich","type":"property","group":"green","price":300,"rent":[26,130,390,1040,1560,2080],"idx":37},{"name":"Riyadh","type":"property","group":"green","price":300,"rent":[26,130,390,1040,1560,2080],"idx":38},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":39},{"name":"Stockholm","type":"property","group":"green","price":320,"rent":[28,140,420,1120,1680,2240],"idx":40},{"name":"Oslo","type":"property","group":"green","price":320,"rent":[30,150,450,1200,1800,2400],"idx":41},{"name":"Spaceport","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\ud83d\ude80","idx":42},{"name":"Chance","type":"chance","icon":"\u2753","idx":43},{"name":"Hong Kong","type":"property","group":"dblue","price":350,"rent":[35,175,525,1400,2100,2800],"idx":44},{"name":"Luxury Tax","type":"tax","cost":100,"icon":"\ud83d\udc8e","idx":45},{"name":"Singapore","type":"property","group":"dblue","price":400,"rent":[50,250,750,2000,3000,4000],"idx":46},{"name":"Monaco","type":"property","group":"dblue","price":400,"rent":[55,275,825,2200,3300,4400],"idx":47}];
const BOARD_56 = [{"name":"GO","type":"go","icon":"\ud83c\udfc1","idx":0},{"name":"Havana","type":"property","group":"brown","price":60,"rent":[2,10,30,80,120,160],"idx":1},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":2},{"name":"Taipei","type":"property","group":"brown","price":60,"rent":[4,20,60,160,240,320],"idx":3},{"name":"Tax $200","type":"tax","cost":200,"icon":"\ud83d\udcb8","idx":4},{"name":"Manila","type":"property","group":"brown","price":60,"rent":[6,30,90,240,360,480],"idx":5},{"name":"Lagos","type":"property","group":"brown","price":60,"rent":[8,40,120,320,480,640],"idx":6},{"name":"Railway","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\ud83d\ude82","idx":7},{"name":"Cairo","type":"property","group":"lblue","price":100,"rent":[6,30,90,240,360,480],"idx":8},{"name":"Chance","type":"chance","icon":"\u2753","idx":9},{"name":"Madrid","type":"property","group":"lblue","price":100,"rent":[6,30,90,240,360,480],"idx":10},{"name":"Athens","type":"property","group":"lblue","price":120,"rent":[8,40,120,320,480,640],"idx":11},{"name":"Rome","type":"property","group":"lblue","price":120,"rent":[10,50,150,400,600,800],"idx":12},{"name":"Istanbul","type":"property","group":"lblue","price":120,"rent":[12,60,180,480,720,960],"idx":13},{"name":"Jail","type":"jail","icon":"\u26d3","idx":14},{"name":"Bangkok","type":"property","group":"pink","price":140,"rent":[10,50,150,400,600,800],"idx":15},{"name":"Electricity","type":"utility","price":150,"icon":"\ud83d\udca1","idx":16},{"name":"Delhi","type":"property","group":"pink","price":140,"rent":[10,50,150,400,600,800],"idx":17},{"name":"Rio","type":"property","group":"pink","price":160,"rent":[12,60,180,480,720,960],"idx":18},{"name":"Seoul","type":"property","group":"pink","price":160,"rent":[14,70,210,560,840,1120],"idx":19},{"name":"Mumbai","type":"property","group":"pink","price":160,"rent":[16,80,240,640,960,1280],"idx":20},{"name":"Harbor","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\u26f5","idx":21},{"name":"Dubai","type":"property","group":"orange","price":180,"rent":[14,70,210,560,840,1120],"idx":22},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":23},{"name":"Paris","type":"property","group":"orange","price":180,"rent":[14,70,210,560,840,1120],"idx":24},{"name":"Moscow","type":"property","group":"orange","price":200,"rent":[16,80,240,640,960,1280],"idx":25},{"name":"Berlin","type":"property","group":"orange","price":200,"rent":[18,90,270,720,1080,1440],"idx":26},{"name":"Frankfurt","type":"property","group":"orange","price":200,"rent":[20,100,300,800,1200,1600],"idx":27},{"name":"Free Parking","type":"parking","icon":"\ud83c\udd7f\ufe0f","idx":28},{"name":"London","type":"property","group":"red","price":220,"rent":[18,90,270,720,1080,1440],"idx":29},{"name":"Chance","type":"chance","icon":"\u2753","idx":30},{"name":"Tokyo","type":"property","group":"red","price":220,"rent":[18,90,270,720,1080,1440],"idx":31},{"name":"New York","type":"property","group":"red","price":240,"rent":[20,100,300,800,1200,1600],"idx":32},{"name":"Amsterdam","type":"property","group":"red","price":240,"rent":[22,110,330,880,1320,1760],"idx":33},{"name":"Brussels","type":"property","group":"red","price":240,"rent":[24,120,360,960,1440,1920],"idx":34},{"name":"Airport","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\u2708\ufe0f","idx":35},{"name":"Beijing","type":"property","group":"yellow","price":260,"rent":[22,110,330,880,1320,1760],"idx":36},{"name":"Sydney","type":"property","group":"yellow","price":260,"rent":[22,110,330,880,1320,1760],"idx":37},{"name":"Waterworks","type":"utility","price":150,"icon":"\ud83d\udca7","idx":38},{"name":"Toronto","type":"property","group":"yellow","price":280,"rent":[24,120,360,960,1440,1920],"idx":39},{"name":"Vienna","type":"property","group":"yellow","price":280,"rent":[26,130,390,1040,1560,2080],"idx":40},{"name":"Melbourne","type":"property","group":"yellow","price":280,"rent":[28,140,420,1120,1680,2240],"idx":41},{"name":"Go to Jail","type":"gojail","icon":"\ud83d\ude94","idx":42},{"name":"Zurich","type":"property","group":"green","price":300,"rent":[26,130,390,1040,1560,2080],"idx":43},{"name":"Riyadh","type":"property","group":"green","price":300,"rent":[26,130,390,1040,1560,2080],"idx":44},{"name":"Chest","type":"chest","icon":"\ud83d\udce6","idx":45},{"name":"Stockholm","type":"property","group":"green","price":320,"rent":[28,140,420,1120,1680,2240],"idx":46},{"name":"Oslo","type":"property","group":"green","price":320,"rent":[30,150,450,1200,1800,2400],"idx":47},{"name":"Copenhagen","type":"property","group":"green","price":320,"rent":[32,160,480,1280,1920,2560],"idx":48},{"name":"Spaceport","type":"railroad","price":200,"rent":[25,50,100,200],"icon":"\ud83d\ude80","idx":49},{"name":"Chance","type":"chance","icon":"\u2753","idx":50},{"name":"Hong Kong","type":"property","group":"dblue","price":350,"rent":[35,175,525,1400,2100,2800],"idx":51},{"name":"Luxury Tax","type":"tax","cost":100,"icon":"\ud83d\udc8e","idx":52},{"name":"Singapore","type":"property","group":"dblue","price":400,"rent":[50,250,750,2000,3000,4000],"idx":53},{"name":"Monaco","type":"property","group":"dblue","price":400,"rent":[55,275,825,2200,3300,4400],"idx":54},{"name":"Macau","type":"property","group":"dblue","price":400,"rent":[60,300,900,2400,3600,4800],"idx":55}];

const BASE_CHANCE = [
  { text:'Advance to GO. Collect $200.', action:'goto_name', targetName:'GO', collect:true },
  { text:'Advance to Hong Kong.', action:'goto_name', targetName:'Hong Kong' },
  { text:'Advance to Railway.', action:'goto_name', targetName:'Railway' },
  { text:'Bank pays you a dividend of $50.', action:'cash', amount:50 },
  { text:'Get Out of Jail Free.', action:'jail-free' },
  { text:'Go directly to Jail.', action:'gojail' },
  { text:'Make general repairs: $25/house, $100/hotel.', action:'repairs', h:25, ho:100 },
  { text:'Pay a poor tax of $15.', action:'cash', amount:-15 },
  { text:'Advance to Stockholm.', action:'goto_name', targetName:'Stockholm' },
  { text:'You won a crossword competition! Collect $100.', action:'cash', amount:100 },
  { text:'Go back 3 spaces.', action:'move', delta:-3 },
  { text:'Elected chairman of the board — pay each player $50.', action:'pay-all', amount:50 },
  { text:'Building loan matures — collect $150.', action:'cash', amount:150 },
  { text:'Street repairs: $40/house, $115/hotel.', action:'repairs', h:40, ho:115 }
];

const BASE_CHEST = [
  { text:'Advance to GO. Collect $200.', action:'goto_name', targetName:'GO', collect:true },
  { text:'Bank error in your favour — collect $200.', action:'cash', amount:200 },
  { text:'Doctor\'s fees — pay $50.', action:'cash', amount:-50 },
  { text:'From sale of stock — collect $50.', action:'cash', amount:50 },
  { text:'Get Out of Jail Free.', action:'jail-free' },
  { text:'Go directly to Jail.', action:'gojail' },
  { text:'Grand Opera Night — collect $50 from each player.', action:'collect-all', amount:50 },
  { text:'Holiday fund matures — collect $100.', action:'cash', amount:100 },
  { text:'Income tax refund — collect $20.', action:'cash', amount:20 },
  { text:'It\'s your birthday — collect $10 from each player.', action:'collect-all', amount:10 },
  { text:'Life insurance matures — collect $100.', action:'cash', amount:100 },
  { text:'Pay hospital fees — $100.', action:'cash', amount:-100 },
  { text:'Pay school fees — $50.', action:'cash', amount:-50 },
  { text:'Consultancy fee received — $25.', action:'cash', amount:25 },
  { text:'Street repairs: $40/house, $115/hotel.', action:'repairs', h:40, ho:115 },
  { text:'Second prize in beauty contest — collect $10.', action:'cash', amount:10 },
  { text:'You inherit $100.', action:'cash', amount:100 }
];

function resolveCardsForBoard(board, baseCards) {
  return baseCards.map(c => {
    if (c.action === 'goto_name') {
      const idx = board.findIndex(cell => cell.name === c.targetName);
      return { ...c, action: 'goto', target: idx };
    }
    return c;
  });
}

function getGameData(playerCount) {
  let BOARD;
  if (playerCount <= 4) BOARD = BOARD_40;
  else if (playerCount <= 6) BOARD = BOARD_48;
  else BOARD = BOARD_56;

  const GROUP_CELLS = {};
  BOARD.forEach(c => {
    if (c.group) {
      if (!GROUP_CELLS[c.group]) GROUP_CELLS[c.group] = [];
      GROUP_CELLS[c.group].push(c.idx);
    }
  });

  const CHANCE_CARDS = resolveCardsForBoard(BOARD, BASE_CHANCE);
  const CHEST_CARDS = resolveCardsForBoard(BOARD, BASE_CHEST);

  return { BOARD, GROUP_CELLS, CHANCE_CARDS, CHEST_CARDS };
}

if (typeof module !== 'undefined') {
  module.exports = { TOKENS, PLAYER_COLORS, COLOR_GROUPS, getGameData };
}
