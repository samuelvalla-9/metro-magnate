// ═══════════════════════════════════════════════
// METRO MAGNATE — Client-side Game Data (ESM)
// Static constants only — dynamic board comes from server state
// ═══════════════════════════════════════════════

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
