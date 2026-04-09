// Client-side copy of shared game data
export const TOKENS = ['🎩','🚂','🐕','🤠','⛵','🎸','🏆','🦋'];

export const PLAYER_COLORS = [
  '#FF4757','#2ED573','#1E90FF','#FFA502',
  '#FF6B81','#7BED9F','#70A1FF','#ECCC68'
];

export const COLOR_GROUPS = {
  brown:  { name:'Brown',   color:'#92400E', houseCost:50  },
  lblue:  { name:'Sky',     color:'#38BDF8', houseCost:50  },
  pink:   { name:'Magenta', color:'#EC4899', houseCost:100 },
  orange: { name:'Orange',  color:'#F97316', houseCost:100 },
  red:    { name:'Red',     color:'#EF4444', houseCost:150 },
  yellow: { name:'Gold',    color:'#EAB308', houseCost:150 },
  green:  { name:'Green',   color:'#22C55E', houseCost:200 },
  dblue:  { name:'Navy',    color:'#3B82F6', houseCost:200 },
};

export const BOARD = [
  { idx:0,  name:'GO',            type:'go',       icon:'🏁' },
  { idx:1,  name:'Elm St',        type:'property', group:'brown',  price:60,  rent:[2,10,30,90,160,250]   },
  { idx:2,  name:'Chest',         type:'chest',    icon:'📦' },
  { idx:3,  name:'Oak Ave',       type:'property', group:'brown',  price:60,  rent:[4,20,60,180,320,450]  },
  { idx:4,  name:'Tax $200',      type:'tax',      cost:200, icon:'💸' },
  { idx:5,  name:'Central Stn',   type:'railroad', price:200, rent:[25,50,100,200], icon:'🚂' },
  { idx:6,  name:'Maple Blvd',    type:'property', group:'lblue',  price:100, rent:[6,30,90,270,400,550]  },
  { idx:7,  name:'Chance',        type:'chance',   icon:'❓' },
  { idx:8,  name:'Cedar Ln',      type:'property', group:'lblue',  price:100, rent:[6,30,90,270,400,550]  },
  { idx:9,  name:'Pine Rd',       type:'property', group:'lblue',  price:120, rent:[8,40,100,300,450,600] },
  { idx:10, name:'Jail',          type:'jail',     icon:'⛓' },
  { idx:11, name:'Harbor Dr',     type:'property', group:'pink',   price:140, rent:[10,50,150,450,625,750] },
  { idx:12, name:'Power Grid',    type:'utility',  price:150, icon:'⚡' },
  { idx:13, name:'Summit Ave',    type:'property', group:'pink',   price:140, rent:[10,50,150,450,625,750] },
  { idx:14, name:'Ridgeline',     type:'property', group:'pink',   price:160, rent:[12,60,180,500,700,900] },
  { idx:15, name:'West Terminal', type:'railroad', price:200, rent:[25,50,100,200], icon:'🚂' },
  { idx:16, name:'Sunset Blvd',   type:'property', group:'orange', price:180, rent:[14,70,200,550,750,950] },
  { idx:17, name:'Chest',         type:'chest',    icon:'📦' },
  { idx:18, name:'Neon Strip',    type:'property', group:'orange', price:180, rent:[14,70,200,550,750,950] },
  { idx:19, name:'Highline St',   type:'property', group:'orange', price:200, rent:[16,80,220,600,800,1000] },
  { idx:20, name:'Free Parking',  type:'parking',  icon:'🅿️' },
  { idx:21, name:'Grand Ave',     type:'property', group:'red',    price:220, rent:[18,90,250,700,875,1050] },
  { idx:22, name:'Chance',        type:'chance',   icon:'❓' },
  { idx:23, name:'Lakeview Rd',   type:'property', group:'red',    price:220, rent:[18,90,250,700,875,1050] },
  { idx:24, name:'Metro Blvd',    type:'property', group:'red',    price:240, rent:[20,100,300,750,925,1100] },
  { idx:25, name:'North Hub',     type:'railroad', price:200, rent:[25,50,100,200], icon:'🚂' },
  { idx:26, name:'Skyline Dr',    type:'property', group:'yellow', price:260, rent:[22,110,330,800,975,1150] },
  { idx:27, name:'Civic Center',  type:'property', group:'yellow', price:260, rent:[22,110,330,800,975,1150] },
  { idx:28, name:'Waterworks',    type:'utility',  price:150, icon:'💧' },
  { idx:29, name:'Crown Ct',      type:'property', group:'yellow', price:280, rent:[24,120,360,850,1025,1200] },
  { idx:30, name:'Go to Jail',    type:'gojail',   icon:'🚔' },
  { idx:31, name:'Capital Sq',    type:'property', group:'green',  price:300, rent:[26,130,390,900,1100,1275] },
  { idx:32, name:'Bank Tower',    type:'property', group:'green',  price:300, rent:[26,130,390,900,1100,1275] },
  { idx:33, name:'Chest',         type:'chest',    icon:'📦' },
  { idx:34, name:'Apex Plaza',    type:'property', group:'green',  price:320, rent:[28,150,450,1000,1200,1400] },
  { idx:35, name:'South Gate',    type:'railroad', price:200, rent:[25,50,100,200], icon:'🚂' },
  { idx:36, name:'Chance',        type:'chance',   icon:'❓' },
  { idx:37, name:'Prestige Ave',  type:'property', group:'dblue',  price:350, rent:[35,175,500,1100,1300,1500] },
  { idx:38, name:'Luxury Tax',    type:'tax',      cost:100, icon:'💎' },
  { idx:39, name:'Pinnacle Blvd', type:'property', group:'dblue',  price:400, rent:[50,200,600,1400,1700,2000] },
];

export const GROUP_CELLS = {};
BOARD.forEach(c => {
  if (c.group) {
    if (!GROUP_CELLS[c.group]) GROUP_CELLS[c.group] = [];
    GROUP_CELLS[c.group].push(c.idx);
  }
});
