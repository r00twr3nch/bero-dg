const canvas = document.querySelector("#screen");
const ctx = canvas.getContext("2d");
const hint = document.querySelector("#hint");
const progressCount = document.querySelector("#progress-count");
const finishModal = document.querySelector("#finish-modal");
const closeModal = document.querySelector("#close-modal");
const muteButton = document.querySelector("#mute-concert");

const TILE = 24;
const WORLD_W = 132;
const WORLD_H = 18;
const GRAVITY = 0.35;
const JUMP = -7.4;
const MOVE = 2.15;

const sayings = [
  "That shit is so\ndisrespectful",
  "mmhm thats what\ni am talking about",
  "sue when\nwas this",
  "firavun faresi\nyunus selam",
];

const solids = new Set();
const qblocks = new Set();
const visited = new Set();
const keys = new Set();

function tileKey(x, y) { return x + "," + y; }
function addPlatform(x, y, width) {
  for (let i = 0; i < width; i += 1) solids.add(tileKey(x + i, y));
}

for (let x = 0; x < WORLD_W; x += 1) {
  solids.add(tileKey(x, WORLD_H - 2));
  solids.add(tileKey(x, WORLD_H - 1));
}
addPlatform(8, 13, 6);
addPlatform(16, 12, 5);
addPlatform(23, 13, 6);
addPlatform(31, 12, 5);
addPlatform(38, 13, 6);
addPlatform(46, 12, 6);
addPlatform(100, 13, 7);
addPlatform(109, 12, 6);
qblocks.add(tileKey(14, 11));
qblocks.add(tileKey(29, 11));
solids.add(tileKey(14, 11));
solids.add(tileKey(29, 11));

const CHAR_H = 72;
const PLAYER_H = 46;
const npcs = [
  { x: 9 * TILE, y: 13 * TILE - CHAR_H, kind: "woman", line: 0 },
  { x: 24 * TILE, y: 13 * TILE - CHAR_H, kind: "dev", line: 1 },
  { x: 39 * TILE, y: 13 * TILE - CHAR_H, kind: "cat", line: 2 },
  { x: 47 * TILE, y: 12 * TILE - CHAR_H, kind: "wizard", line: 3 },
];

const player = {
  x: 2 * TILE,
  y: (WORLD_H - 2) * TILE - PLAYER_H,
  vx: 0,
  vy: 0,
  w: 22,
  h: PLAYER_H,
  facing: 1,
  onGround: false,
  frame: 0,
};

let cameraX = 0;
let talkTimer = 0;
let activeLine = null;
let signText = null;
const bungalow = { x: 48 * TILE, y: (WORLD_H - 2) * TILE - 108, w: 132, h: 108 };
const stage = { x: 108 * TILE, y: (WORLD_H - 2) * TILE - 128, w: 300, h: 128 };
let finished = false;
let last = performance.now();
let showTime = 0;
let audioMuted = false;
let concertOn = false;
const concertAudio = new Audio("konser.mp3");
concertAudio.loop = true;
concertAudio.volume = 0.55;

function concertWanted() {
  return !audioMuted && (concertOn || !finishModal.hidden);
}

function stopConcert() {
  concertAudio.pause();
}

function startConcert() {
  if (!concertWanted()) return;
  const play = concertAudio.play();
  if (play) play.catch(() => {});
}

function setConcert(active) {
  concertOn = active;
  if (concertWanted()) startConcert();
  else if (finishModal.hidden) stopConcert();
}

function hits(x, y, w, h) {
  const left = Math.floor(x / TILE);
  const right = Math.floor((x + w - 1) / TILE);
  const top = Math.floor(y / TILE);
  const bottom = Math.floor((y + h - 1) / TILE);
  for (let ty = top; ty <= bottom; ty += 1) {
    for (let tx = left; tx <= right; tx += 1) {
      if (solids.has(tileKey(tx, ty))) return true;
    }
  }
  return false;
}

function moveAxis(axis, amount) {
  const step = Math.sign(amount);
  for (let i = 0; i < Math.abs(amount); i += 1) {
    const nextX = axis === "x" ? player.x + step : player.x;
    const nextY = axis === "y" ? player.y + step : player.y;
    if (hits(nextX, nextY, player.w, player.h)) {
      if (axis === "y" && step > 0) player.onGround = true;
      if (axis === "y") player.vy = 0;
      return;
    }
    player.x = nextX;
    player.y = nextY;
    if (axis === "y") player.onGround = false;
  }
}

function update(dt) {
  const left = keys.has("arrowleft") || keys.has("a");
  const right = keys.has("arrowright") || keys.has("d");
  player.vx = left === right ? 0 : (right ? MOVE : -MOVE) * dt;
  if (player.vx !== 0) player.facing = Math.sign(player.vx);
  if ((keys.has(" ") || keys.has("arrowup") || keys.has("w")) && player.onGround) {
    player.vy = JUMP;
    player.onGround = false;
  }
  player.vy = Math.min(player.vy + GRAVITY * dt, 8);
  player.onGround = false;
  moveAxis("x", player.vx);
  moveAxis("y", player.vy * dt);
  player.x = Math.max(0, Math.min(player.x, WORLD_W * TILE - player.w));
  if (Math.abs(player.vx) > 0.2 && player.onGround) player.frame += dt * 0.18;

  cameraX = Math.max(0, Math.min(player.x - canvas.width * 0.38, WORLD_W * TILE - canvas.width));

  let near = null;
  npcs.forEach((npc, index) => {
    const distance = Math.hypot((player.x + 6) - (npc.x + 8), (player.y + 8) - (npc.y + 8));
    if (distance < 46 && (!near || distance < near.distance)) near = { index, distance };
  });
  if (near) {
    hint.textContent = "Yakinsin";
    if (activeLine !== near.index) {
      activeLine = near.index;
      talkTimer = 240;
      visited.add(near.index);
      progressCount.textContent = "x" + String(visited.size).padStart(2, "0");
    }
  } else if (talkTimer <= 0) {
    activeLine = null;
    hint.textContent = "NPC ye yaklas";
  }
  const px = player.x + player.w / 2;
  if (px > bungalow.x - 24 && px < bungalow.x + bungalow.w + 24) signText = "muhafazakar\nyungalow";
  else if (px > stage.x - 20 && px < stage.x + stage.w + 30) {
    signText = "SABRINA\nCARPENTER";
    setConcert(true);
    if (!finished) {
      finished = true;
      window.setTimeout(() => { finishModal.hidden = false; }, 700);
    }
  }
  else {
    signText = null;
    setConcert(false);
  }
  talkTimer = Math.max(0, talkTimer - dt);
  showTime += dt;
}

function sprite(x, y, rows, palette, flip, scale = 3) {
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      const cell = row[rx];
      if (cell === ".") continue;
      const col = flip ? row.length - 1 - rx : rx;
      ctx.fillStyle = palette[cell];
      ctx.fillRect(x + col * scale, y + ry * scale, scale, scale);
    }
  });
}

function drawBero(x, y, flip, step) {
  const stepOn = player.onGround && Math.abs(player.vx) > 0.2 && Math.floor(step) % 2;
  const legs = stepOn ? "..KK..........KK.." : "...KK........KK...";
  sprite(Math.round(x - 8), Math.round(y), [
    "...CCCCCCCCCCCC...",
    "..CCCCCCCCCCCCCC..",
    ".CCC..CCCCCC..CCC.",
    "CCC..SSSSSSSS..CCC",
    "CC.SSSSSSSSSSSS.CC",
    "C.SSSGGGGGGSSS.CC.",
    "..SSSGWWWWWGSSS...",
    "..SSSGWSSSWGSSS...",
    "...SSSGSSSGSSS....",
    "....SSSSPSSSS.....",
    ".....SSSSSSS......",
    "......RRRRR.......",
    ".....RRRRRRR......",
    "....RRRRRRRRR.....",
    "....RRRYYYRRR.....",
    ".....RRRRRRR......",
    ".....RRRRRRR......",
    "....AA.RRR.AA.....",
    "...AA...R...AA....",
    legs,
    "..KK........KK....",
  ], {
    C: "#241c18", S: "#f0bc96", G: "#101820", W: "#f8fbff",
    P: "#d15b68", R: "#e4453a", Y: "#ffd84a", A: "#f0bc96", K: "#2a211c",
  }, flip, 2);
}

function drawWoman(x, y) {
  sprite(x - 18, y, [
    "...SSSSSSSSSSSS...",
    "..SSSSSSSSSSSSSS..",
    ".SS............SS.",
    "SS..KK....KK..SSSS",
    "S..KKKK..KKKK..SS.",
    "S..KK.SSSS.KK..SS.",
    "..KKSSSSSSSSKK.S..",
    "...KKSSPPSSKK.....",
    "....KKSSSSKK......",
    ".....EEEEEE.......",
    "....EEEEEEEE......",
    "...EEEEEEEEEE.....",
    "...EEEELLLLLL.....",
    "....EEEEEEEE......",
    "...EEEEEEEEEE.....",
    "..EEEEEEEEEEEE....",
    "..AA........AA....",
    ".AAA........AAA...",
    "..B..........B....",
    ".BB..........BB...",
  ], {
    S: "#6a3828", K: "#140e0c", P: "#e38998",
    E: "#e23b78", L: "#f6d2b4", A: "#6a3828", B: "#241812",
  }, false);
}

function drawDev(x, y) {
  sprite(x - 18, y, [
    "...HHHHHHHHHHHH...",
    "..HHHHHHHHHHHHHH..",
    ".HHHSSSSSSSSSSHHH.",
    ".HHSSSSSSSSSSSSHH.",
    "..SSKK....KKSSS...",
    "..SSKKSSSSKKSSS...",
    "...SSSSSSSSSSS....",
    "....SSSSPPSSS.....",
    ".....SSSSSSS......",
    "......CCCCC.......",
    ".....CCCCCCC......",
    "....CCCCCCCCC.....",
    "....CCLLLLLCC.....",
    ".....CCCCCCC......",
    "....CCC...CCC.....",
    "...CC.......CC....",
    "...AA.......AA....",
    "..AAA.......AAA...",
    "...B.........B....",
    "..BB.........BB...",
  ], {
    H: "#3a2a22", S: "#f0bc96", K: "#172033", P: "#d15b68",
    C: "#2b7592", L: "#d7f4f6", A: "#f0bc96", B: "#241c18",
  }, false);
}

function drawCat(x, y) {
  sprite(x - 20, y + 8, [
    "EE..............EE",
    "EEE............EEE",
    ".EEE..........EEE.",
    "..EEEEEEEEEEEEEE..",
    "..EEKKKKKKKKKKEE..",
    "..EEKKWWWWWWKKEE..",
    "...EEKKKKKKKKEE...",
    "....EEEPPPPEEE....",
    "......EEEEEE......",
    "......OOOOOO......",
    ".....OOOOOOOO.....",
    "....OOOOOOOOOO....",
    "....OOOOYYOOOO....",
    ".....OOOOOOOO.....",
    "....OO......OO....",
    "...OO........OO...",
    "..OO..........OO..",
    "..O............O..",
  ], {
    E: "#fffdf8", K: "#202038", W: "#ffffff",
    P: "#ff8aab", O: "#f29a2e", Y: "#ffe08a",
  }, false);
}

function drawWizard(x, y) {
  sprite(x - 18, y, [
    ".......HH.......",
    "......HHHH......",
    ".....HHHHHH.....",
    "....HHHHHHHH....",
    "...HHHHHHHHHH...",
    "..HHHHHHHHHHHH..",
    ".HHHSSSSSSSSHHH.",
    ".HHSSSSSSSSSSHH.",
    "..SSKK....KKSS..",
    "..SSKKSSSSKKSS..",
    "...SSSSSSSSSS...",
    "....SSSSPPSS....",
    ".....RRRRRR.....",
    "....RRRRRRRR....",
    "...RRRRRRRRRR...",
    "...RRRRRRRRRR...",
    "....RRRRRRRR....",
    "...AA......AA...",
    "..AAA......AAA..",
    "...B........B...",
    "..BB........BB..",
  ], {
    H: "#6d4ad8", S: "#f0bc96", K: "#172033",
    P: "#d15b68", R: "#ffd84a", A: "#f0bc96", B: "#241c18",
  }, false);
}

function drawCloud(x, y) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 8, y + 8, 28, 12);
  ctx.fillRect(x + 16, y, 18, 12);
  ctx.fillRect(x + 28, y + 6, 16, 12);
}

function drawTile(x, y, question) {
  ctx.fillStyle = question ? "#e0a020" : "#6e2418";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = question ? "#f8d030" : "#c84c31";
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = question ? "#fff4a0" : "#e07040";
  ctx.fillRect(x + 4, y + 4, 7, 7);
  ctx.fillRect(x + 13, y + 13, 7, 7);
  ctx.fillStyle = question ? "#c08020" : "#8d2e22";
  ctx.fillRect(x + TILE - 3, y + 3, 1, TILE - 6);
  ctx.fillRect(x + 3, y + TILE - 3, TILE - 6, 1);
  if (question) {
    ctx.fillStyle = "#8a4b10";
    ctx.fillRect(x + 9, y + 5, 6, 3);
    ctx.fillRect(x + 11, y + 8, 3, 6);
    ctx.fillRect(x + 11, y + 16, 3, 3);
  }
}

function drawBubble(x, y, text) {
  const lines = text.split("\n");
  ctx.font = "8px 'Press Start 2P', monospace";
  const width = Math.max.apply(null, lines.map((line) => ctx.measureText(line).width)) + 16;
  const height = lines.length * 14 + 12;
  const left = Math.round(Math.min(Math.max(8, x - width / 2), canvas.width - width - 8));
  const top = Math.round(Math.max(8, y - height - 12));
  ctx.fillStyle = "#101830";
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.strokeRect(left + 2, top + 2, width - 4, height - 4);
  ctx.fillStyle = "#ffffff";
  lines.forEach((line, index) => ctx.fillText(line, left + 8, top + 16 + index * 14));
}

function drawBungalow(x, groundY) {
  ctx.fillStyle = "#8d5a32";
  ctx.beginPath();
  ctx.moveTo(x - 12, groundY - 64);
  ctx.lineTo(x + 66, groundY - 108);
  ctx.lineTo(x + 144, groundY - 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f3ddb0";
  ctx.fillRect(x + 12, groundY - 64, 108, 64);
  ctx.fillStyle = "#6b3d24";
  ctx.fillRect(x + 50, groundY - 38, 26, 38);
  ctx.fillStyle = "#9fd7ef";
  ctx.fillRect(x + 22, groundY - 52, 20, 16);
  ctx.fillRect(x + 90, groundY - 52, 20, 16);
  ctx.fillStyle = "#5c94fc";
  ctx.fillRect(x + 30, groundY - 46, 4, 4);
  ctx.fillRect(x + 98, groundY - 46, 4, 4);
}

function drawConcert(x, groundY, time) {
  ctx.fillStyle = "#241910";
  ctx.fillRect(x, groundY - 30, 300, 30);
  ctx.fillStyle = "#5a4634";
  ctx.fillRect(x + 16, groundY - 54, 268, 24);
  ctx.fillStyle = "#111111";
  ctx.fillRect(x + 40, groundY - 30, 10, 30);
  ctx.fillRect(x + 250, groundY - 30, 10, 30);
  const pulse = Math.floor(time / 18) % 2;
  ctx.fillStyle = pulse ? "#ff4f9a" : "#ffd84a";
  ctx.fillRect(x + 48, groundY - 128, 8, 74);
  ctx.fillRect(x + 244, groundY - 128, 8, 74);
  ctx.fillStyle = pulse ? "#7cf0ff" : "#ff4f9a";
  ctx.fillRect(x + 80, groundY - 108, 140, 8);
  sprite(x + 126, groundY - 100, [
    "..HHHHHHHH..",
    ".HHHHHHHHHH.",
    "HHSSSSSSSSHH",
    ".SSKKKKKKSS.",
    ".SSKSSSSKSS.",
    "..SSSPPSSS..",
    "...PPPPPP...",
    "..PPPPPPPP..",
    "..PPYYYYPP..",
    "...PPPPPP...",
    "..K......K..",
    "..KK....KK..",
  ], {
    H: "#f2d16b", S: "#f0bc96", K: "#172033",
    P: "#ff4f9a", Y: "#fff4d0",
  }, false);
  ctx.fillStyle = "#20304f";
  for (let i = 0; i < 8; i += 1) ctx.fillRect(x + 22 + i * 34, groundY - 16, 16, 16);
}

function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#5c94fc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 6; i += 1) {
    drawCloud(((i * 180 - cameraX * 0.2) % (canvas.width + 120) + canvas.width + 120) % (canvas.width + 120) - 40, 24 + (i % 3) * 28);
  }
  ctx.fillStyle = "#80d010";
  ctx.fillRect(0, canvas.height - 8, canvas.width, 8);

  const start = Math.max(0, Math.floor(cameraX / TILE) - 1);
  const end = Math.min(WORLD_W, Math.ceil((cameraX + canvas.width) / TILE) + 1);
  for (let y = 0; y < WORLD_H; y += 1) {
    for (let x = start; x < end; x += 1) {
      if (!solids.has(tileKey(x, y))) continue;
      drawTile(Math.round(x * TILE - cameraX), y * TILE, qblocks.has(tileKey(x, y)));
    }
  }
  const groundY = (WORLD_H - 2) * TILE;
  drawBungalow(Math.round(bungalow.x - cameraX), groundY);
  drawConcert(Math.round(stage.x - cameraX), groundY, showTime);

  const painters = { woman: drawWoman, dev: drawDev, cat: drawCat, wizard: drawWizard };
  npcs.forEach((npc) => painters[npc.kind](Math.round(npc.x - cameraX), npc.y));
  drawBero(player.x - cameraX, player.y, player.facing < 0, player.frame);

  if (activeLine !== null && talkTimer > 0) {
    const npc = npcs[activeLine];
    drawBubble(npc.x - cameraX + 8, npc.y, sayings[npc.line]);
  } else if (signText) {
    const anchor = signText.startsWith("muhafazakar") ? bungalow.x + 46 : stage.x + 75;
    const anchorY = signText.startsWith("muhafazakar") ? bungalow.y : stage.y + 8;
    drawBubble(anchor - cameraX, anchorY, signText);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText("BERO", 16, 24);
  ctx.fillText(String(visited.size * 100).padStart(6, "0"), 16, 40);
  ctx.fillText("ANILAR " + visited.size + "/4", canvas.width - 132, 24);
}

function frame(now) {
  const dt = Math.min(2.2, (now - last) / 16.67);
  last = now;
  if (finishModal.hidden) update(dt);
  render();
  requestAnimationFrame(frame);
}

function toggleMute() {
  audioMuted = !audioMuted;
  muteButton.setAttribute("aria-pressed", String(audioMuted));
  muteButton.textContent = audioMuted ? "SES KAPALI" : "SES ACIK";
  if (audioMuted) stopConcert();
  else if (concertWanted()) startConcert();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowup", " ", "w", "a", "d"].includes(key)) event.preventDefault();
  if (!event.repeat) keys.add(key);
  if (key === "escape") finishModal.hidden = true;
  if (key === "m" && !event.repeat) toggleMute();
  if (concertWanted()) startConcert();
});
document.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
closeModal.addEventListener("click", () => {
  finishModal.hidden = true;
  if (!concertOn) stopConcert();
});
muteButton.addEventListener("click", toggleMute);
canvas.addEventListener("pointerdown", () => canvas.focus());
requestAnimationFrame(frame);