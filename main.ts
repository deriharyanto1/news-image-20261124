// THE WORLD TODAY — 24 November 2026
// One-page newspaper front page, drawn entirely by hand in code.
// Node 22 stdlib only. No network, no dependencies.
// Writes a single 1024x1024 PNG (entry.png) to MAKEFUN_OUTPUT_DIR.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const W = 1024;
const H = 1024;
const OUT = process.env.MAKEFUN_OUTPUT_DIR || 'out';

// ---------------------------------------------------------------------------
// Pixel buffer (RGB, white background)
// ---------------------------------------------------------------------------
const buf = Buffer.alloc(W * H * 3, 255);

function px(x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
}

const BLACK = [0, 0, 0];
const GREY = [120, 120, 120];

function fillRect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) px(i, j, c[0], c[1], c[2]);
  }
}

function hline(x0, x1, y, c, t = 1) {
  for (let j = 0; j < t; j++) {
    for (let i = x0; i <= x1; i++) px(i, y + j, c[0], c[1], c[2]);
  }
}

function vline(x, y0, y1, c, t = 1) {
  for (let i = 0; i < t; i++) {
    for (let j = y0; j <= y1; j++) px(x + i, j, c[0], c[1], c[2]);
  }
}

// Bresenham line with a square brush of side t.
function line(x0, y0, x1, y1, t, c) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(t / 2);
  for (;;) {
    for (let j = -half; j < t - half; j++) {
      for (let i = -half; i < t - half; i++) px(x + i, y + j, c[0], c[1], c[2]);
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// ---------------------------------------------------------------------------
// Hand-drawn vector stroke font.
// Grid: x 0..4, y 0..6 (y grows downward). Each glyph is a list of strokes;
// each stroke is a list of [x, y] points joined by straight lines.
// NOTE on '9': top bowl + straight right stem, NO bottom loop — a '9' with
// a bottom loop reads as '8'.
// ---------------------------------------------------------------------------
const FONT = {
  'A': [[[0, 6], [2, 0], [4, 6]], [[1, 3], [3, 3]]],
  'B': [[[0, 6], [0, 0], [3, 0], [4, 1], [3, 2], [0, 2]], [[0, 2], [3, 2], [4, 3], [4, 5], [3, 6], [0, 6]]],
  'C': [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5]]],
  'D': [[[0, 6], [0, 0], [3, 0], [4, 1], [4, 5], [3, 6], [0, 6]]],
  'E': [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  'F': [[[0, 6], [0, 0], [4, 0]], [[0, 3], [3, 3]]],
  'G': [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3]], [[4, 3], [2, 3]]],
  'H': [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  'I': [[[2, 0], [2, 6]], [[0, 0], [4, 0]], [[0, 6], [4, 6]]],
  'J': [[[4, 0], [4, 5], [3, 6], [1, 6], [0, 5]]],
  'K': [[[0, 0], [0, 6]], [[4, 0], [0, 3]], [[1, 3], [4, 6]]],
  'L': [[[0, 0], [0, 6], [4, 6]]],
  'M': [[[0, 6], [0, 0], [2, 3], [4, 0], [4, 6]]],
  'N': [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  'O': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  'P': [[[0, 6], [0, 0], [3, 0], [4, 1], [3, 2], [0, 2]]],
  'Q': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]], [[3, 4], [4, 6]]],
  'R': [[[0, 6], [0, 0], [3, 0], [4, 1], [3, 2], [0, 2]], [[1, 2], [4, 6]]],
  'S': [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5]]],
  'T': [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  'U': [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]]],
  'V': [[[0, 0], [2, 6], [4, 0]]],
  'W': [[[0, 0], [1, 6], [2, 3], [3, 6], [4, 0]]],
  'X': [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  'Y': [[[0, 0], [2, 3], [4, 0]], [[2, 3], [2, 6]]],
  'Z': [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '0': [[[1, 0], [3, 0], [4, 1], [4, 5], [3, 6], [1, 6], [0, 5], [0, 1], [1, 0]]],
  '1': [[[1, 1], [2, 0], [2, 6]], [[0, 6], [4, 6]]],
  '2': [[[0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [0, 6], [4, 6]]],
  '3': [[[0, 1], [1, 0], [3, 0], [4, 1], [3, 2], [2, 3]], [[2, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]]],
  '4': [[[0, 0], [0, 3], [4, 3]], [[3, 0], [3, 6]]],
  '5': [[[4, 0], [0, 0], [0, 2], [3, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5]]],
  '6': [[[4, 0], [3, 0], [1, 0], [0, 2], [0, 5], [1, 6], [3, 6], [4, 5], [4, 3], [1, 3]]],
  '7': [[[0, 0], [4, 0], [2, 6]]],
  '8': [[[1, 0], [3, 0], [4, 1], [3, 2], [1, 2], [0, 1], [1, 0]], [[1, 2], [3, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5], [0, 3], [1, 2]]],
  // '9': top bowl closed at the top, straight right stem to the baseline.
  '9': [[[0, 2], [0, 1], [1, 0], [3, 0], [4, 1], [4, 2], [3, 3], [1, 3], [0, 2]], [[4, 1], [4, 6]]],
  '.': [[[2, 6], [2, 6]]],
  ',': [[[2, 5], [2, 6]], [[2, 6], [1, 7]]],
  ':': [[[2, 1], [2, 2]], [[2, 4], [2, 5]]],
  ';': [[[2, 1], [2, 2]], [[2, 4], [2, 6]], [[2, 6], [1, 7]]],
  "'": [[[2, 0], [2, 1]], [[2, 1], [1, 3]]],
  '"': [[[1, 0], [1, 1], [0, 2]], [[3, 0], [3, 1], [2, 2]]],
  '-': [[[0, 3], [4, 3]]],
  '(': [[[3, 0], [2, 1], [1, 2], [1, 4], [2, 5], [3, 6]]],
  ')': [[[1, 0], [2, 1], [3, 2], [3, 4], [2, 5], [1, 6]]],
  '%': [[[1, 0], [1, 1]], [[3, 5], [3, 6]], [[4, 0], [0, 6]]],
  '+': [[[2, 1], [2, 5]], [[0, 3], [4, 3]]],
  '/': [[[4, 0], [0, 6]]],
  '&': [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [2, 3], [4, 4], [4, 5], [3, 6], [1, 6], [0, 5]], [[2, 3], [0, 6]]],
  '$': [[[4, 1], [3, 0], [1, 0], [0, 1], [0, 2], [4, 3], [4, 5], [3, 6], [1, 6], [0, 5]], [[2, 0], [2, 6]]],
  '!': [[[2, 0], [2, 4]], [[2, 6], [2, 6]]],
  '?': [[[1, 0], [3, 0], [4, 1], [3, 2], [2, 3]], [[2, 5], [2, 5]]],
  '=': [[[0, 2], [4, 2]], [[0, 4], [4, 4]]],
  ' ': [],
};

const CELL = 6; // glyph advance in font units (5 wide + 1 spacing)

function textWidth(text, s) {
  return text.length * CELL * s;
}

function drawChar(ch, ox, oy, s, c) {
  // Content is written in mixed case; the font only carries capitals,
  // so normalise here (digits and punctuation are unaffected).
  const strokes = FONT[ch.toUpperCase()];
  if (!strokes) return;
  const t = Math.max(1, Math.round(s * 0.72));
  for (const stroke of strokes) {
    for (let k = 0; k + 1 < stroke.length; k++) {
      const [x0, y0] = stroke[k];
      const [x1, y1] = stroke[k + 1];
      line(
        Math.round(ox + x0 * s), Math.round(oy + y0 * s),
        Math.round(ox + x1 * s), Math.round(oy + y1 * s),
        t, c,
      );
    }
    if (stroke.length === 1) {
      const [x0, y0] = stroke[0];
      line(Math.round(ox + x0 * s), Math.round(oy + y0 * s),
        Math.round(ox + x0 * s), Math.round(oy + y0 * s), t, c);
    }
  }
}

function drawText(x, y, text, s, c = BLACK) {
  let cx = x;
  for (const ch of text) {
    drawChar(ch, cx, y, s, c);
    cx += CELL * s;
  }
  return cx;
}

function drawTextCentered(cx, y, text, s, c = BLACK) {
  const w = textWidth(text, s);
  drawText(cx - w / 2, y, text, s, c);
}

function wrapText(text, maxW, s) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (textWidth(test, s) <= maxW || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawWrapped(x, y, text, maxW, s, lineH, c = BLACK) {
  const lines = wrapText(text, maxW, s);
  lines.forEach((ln, i) => drawText(x, y + i * lineH, ln, s, c));
  return lines.length;
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGB, filter 0, zlib deflate)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// CONTENT — 50 items from 10 regions, all first reported 24 Nov 2026
// ---------------------------------------------------------------------------
const TOP_HEADLINE = 'FOURTEEN NATIONS RECOGNISE ICJ GENOCIDE RULING';
const TOP_BODY = 'The United Kingdom, Spain, Canada, Australia and ten others affirmed on Monday they recognise the International Court of Justice ruling that Myanmar committed genocide against the Rohingya.';

const PANELS = [
  {
    kicker: 'LIBYA',
    headline: 'UKRAINE DRONES SINK RUSSIAN WARSHIP',
    body: 'UN seeks probe after a reported strike on the Russian corvette Merkury at the Benghazi naval base. Kyiv says seven naval drones sank the ship; Zelenskyy confirms the hit.',
  },
  {
    kicker: 'HORMUZ',
    headline: 'RECORD IRANIAN ATTACKS IN THE STRAIT',
    body: "UK logs record Iranian attacks in the Strait of Hormuz. Trump warns Iran of a 'very traumatic' outcome if the nuclear deal fails and weighs sending a second aircraft carrier.",
  },
  {
    kicker: 'NATO',
    headline: 'RUSSIA WARNS ESTONIA MOVES RISK WAR',
    body: "Russia warns Estonia's moves are 'on the verge of triggering open war'. NATO members logged 25 Russian airspace violations in 2026, over four times the 2024 total. NATO sends detection aircraft to Poland.",
  },
  {
    kicker: 'COP31',
    headline: 'COP31 COLLAPSE EXPOSES A DIVIDED WORLD',
    body: "What the failure of COP31 reveals about a divided world. Talks in Antalya ran nearly 50 hours into overtime, then more than 90 nations rejected the draft because it never said 'fossil fuels'.",
  },
  {
    kicker: 'TECH',
    headline: 'NVIDIA REINSTATES HUANG AS CEO',
    body: "Nvidia's board unanimously reinstates Jensen Huang as CEO after Trump intervention. Oregon and Virginia sue SpaceX over alleged Grok-generated child abuse images.",
  },
  {
    kicker: 'UKRAINE WAR',
    headline: 'RUSSIAN WAR DEAD NEAR 700,000',
    body: 'Russian war death toll likely near 700,000, a media report says after studying leaked government data. The Novoshakhtinsk oil refinery burns after a Ukrainian drone attack; Zaporizhzhia hit by new night attacks.',
  },
  {
    kicker: 'ASIA',
    headline: 'NEPAL QUAKE AS ASIA COUNTS LOSSES',
    body: 'A 5.6 magnitude earthquake strikes Nepal. Bangladesh begins a campaign to vaccinate 50 million children against typhoid. India keeps third in the Asia Power Index; rescue work goes on after the Cikande factory fire.',
  },
  {
    kicker: 'MARKETS',
    headline: 'STOCKS SOAR AS OIL AND GOLD SLIDE',
    body: 'S&P 500 +4.73%, Nasdaq +6.51%, Nikkei 58,644.63 +3.91%. Brent crude $86.7, down 2.99%; gold $3,620.4. Trump announces a Japan trade deal; SoftBank to invest $2B in Intel.',
  },
  {
    kicker: 'SPORT',
    headline: "ARYA'S 181 SETS INDIAN T20 RECORD",
    body: "Priyansh Arya hits a record 181, the highest T20 score by an Indian, with 19 sixes. Carlos Alcaraz wins his first ATP Finals title. Commanders beat Bengals 22-20; South Africa bowl Bangladesh out for 91.",
  },
];

const QUOTE = '"UN CHIEF ANTONIO GUTERRES CALLS ON MEMBER STATES TO DEVELOP, WITHIN A YEAR, A MULTILATERAL FRAMEWORK FOR MANAGING AI RISKS."';

const BRIEFS = [
  // North America (9)
  'NORTH AMERICA: Pennsylvania has a ninth measles death; 46 counties affected.',
  'NORTH AMERICA: Melat Kiros, 29, first Gen Z woman in Congress.',
  'NORTH AMERICA: Two New Jersey women indicted in faked anti-Trump attack.',
  'NORTH AMERICA: Princeton neuroscientist detained by ICE at D.C. airport.',
  'NORTH AMERICA: Two die in a US university shooting.',
  'NORTH AMERICA: US reveals planned changes to citizenship test and H-1B visas.',
  "NORTH AMERICA: US Senate to vote on Trump's $9.4B foreign aid and media cuts.",
  'NORTH AMERICA: Cuba: WHO chief visits a deteriorating health system.',
  "NORTH AMERICA: Nuggets beat Bulls 151-145; Jokic's 202nd triple-double, Murray 45.",
  // South America (2)
  'SOUTH AMERICA: Colombia car bomb destroys buildings in Villavicencio.',
  "SOUTH AMERICA: Mexico will try 'El Chapo Isidro' despite US extradition request.",
  // Western Europe (3)
  'WESTERN EUROPE: Brentford beat Everton; Keane Lewis-Potter scores twice.',
  'WESTERN EUROPE: Arsenal keeper David Raya misses training with shoulder injury.',
  "WESTERN EUROPE: Arm extends CEO Rene Haas' tenure to 2033 amid Nvidia speculation.",
  // Eastern Europe (2)
  'EASTERN EUROPE: Putin open to Article 5-style guarantees for Ukraine.',
  'EASTERN EUROPE: Zaporizhzhia targeted by new night attacks.',
  // Middle East (6)
  'MIDDLE EAST: Israeli strikes in Gaza kill at least three, including UNRWA worker.',
  "MIDDLE EAST: Oxfam describes Gaza as a territory transformed into a 'toxic land'.",
  'MIDDLE EAST: Houthis report dozens dead in Saudi airstrikes.',
  'MIDDLE EAST: Iran inflicts 74 lashes on singer Parastoo Ahmadi.',
  'MIDDLE EAST: Iran rules out negotiation until Washington meets seven conditions.',
  'MIDDLE EAST: UK logs record Iranian attacks in the Strait of Hormuz.',
  // Africa (3)
  'AFRICA: Somalia and Uganda step up operations against Al-Shabaab.',
  'AFRICA: UN seeks probe after reported strike on Russian warship off Libya.',
  'AFRICA: South Africa bowl Bangladesh out for 91 at Centurion.',
  // South Asia (7)
  'SOUTH ASIA: Indian Army searches for scores missing after Himalayan flood.',
  'SOUTH ASIA: Former Indian lawmaker Prajwal Revanna sentenced to life for rape.',
  'SOUTH ASIA: India vs New Zealand 1st Test drawn; New Zealand 239/5, 120 overs.',
  'SOUTH ASIA: Kerala beat Assam by 9 wickets.',
  'SOUTH ASIA: Bengal beat Uttar Pradesh by 93 runs.',
  'SOUTH ASIA: Bangladesh to vaccinate 50 million children against typhoid.',
  'SOUTH ASIA: A 5.6 magnitude earthquake strikes Nepal near the Chinese border.',
  // East Asia (3)
  'EAST ASIA: China opens Tiangong to first foreign astronaut, Pakistani Zeeshan Ali.',
  'EAST ASIA: Japan hosts the US Treasury Secretary as trade deal deadline looms.',
  'EAST ASIA: SoftBank to invest $2B in Intel.',
  // Southeast Asia (2)
  'SOUTHEAST ASIA: Thai-Cambodia border fighting on hold following a truce.',
  'SOUTHEAST ASIA: Rescue work goes on after the Cikande factory fire in Banten.',
  // Oceania (2)
  'OCEANIA: Blair Tickner out of NZ Test with hamstring injury; Matt Fisher called up.',
  'OCEANIA: Australia among 14 nations recognising the ICJ genocide ruling.',
];

// ---------------------------------------------------------------------------
// LAYOUT — 1024 x 1024
// ---------------------------------------------------------------------------
const M = 26;                 // page margin
const CW = W - 2 * M;         // 972 content width
const COLW = 316;             // panel / brief column width
const COLX = [M, M + COLW + 12, M + 2 * (COLW + 12)];

// Masthead
hline(M, W - M, 14, BLACK, 3);
hline(M, W - M, 19, BLACK, 1);
drawTextCentered(W / 2, 26, 'THE WORLD TODAY', 8);
hline(M, W - M, 88, BLACK, 2);

// Dateline bar
drawText(M, 96, 'TUESDAY 24 NOVEMBER 2026', 1.7);
const tagline = 'WORLD NEWS IN ONE IMAGE';
drawText(W - M - textWidth(tagline, 1.7), 96, tagline, 1.7);
hline(M, W - M, 112, BLACK, 1);

// Top story
drawText(M, 122, 'TOP STORY', 1.5, GREY);
drawTextCentered(W / 2, 138, TOP_HEADLINE, 3.3);
drawWrapped(M, 168, TOP_BODY, CW, 1.6, 13);
hline(M, W - M, 200, BLACK, 1);

// Panels: 3 columns x 3 rows
const PANEL_Y = [208, 344, 480];
const PANEL_H = 128;
PANELS.forEach((p, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = COLX[col];
  const y = PANEL_Y[row];
  drawText(x, y + 4, p.kicker, 1.5, GREY);
  drawWrapped(x, y + 20, p.headline, COLW, 1.9, 16);
  drawWrapped(x, y + 56, p.body, COLW, 1.3, 10.5);
});
// Vertical dividers between panel columns
vline(COLX[1] - 6, PANEL_Y[0], PANEL_Y[2] + PANEL_H, GREY);
vline(COLX[2] - 6, PANEL_Y[0], PANEL_Y[2] + PANEL_H, GREY);
// Horizontal dividers between panel rows
hline(M, W - M, PANEL_Y[1] - 4, GREY);
hline(M, W - M, PANEL_Y[2] - 4, GREY);
hline(M, W - M, PANEL_Y[2] + PANEL_H + 4, BLACK, 1);

// Quote box
drawWrapped(M, 622, QUOTE, CW, 1.55, 13);
hline(M, W - M, 660, BLACK, 1);

// Briefs header
drawTextCentered(W / 2, 668, 'THE WORLD IN BRIEF', 2.0);
hline(M, W - M, 690, BLACK, 1);

// Briefs: 39 items, 13 per column
const BRIEF_Y = 700;
const BRIEF_ROW = 21.5;
BRIEFS.forEach((b, i) => {
  const col = Math.floor(i / 13);
  const row = i % 13;
  const y = BRIEF_Y + row * BRIEF_ROW;
  drawWrapped(COLX[col], y, b, COLW, 1.25, 10.5);
});

// Footer
hline(M, W - M, 982, BLACK, 2);
drawTextCentered(W / 2, 990, '50 STORIES FROM 10 REGIONS', 1.8);

// ---------------------------------------------------------------------------
// Write output: ONLY entry.png
// ---------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'entry.png'), encodePNG());
console.log('wrote', path.join(OUT, 'entry.png'));
