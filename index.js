// 2D CQB Breach Prototype (Canvas)
// Levels 1–5, Hostages, Flashbangs, and NEW Level 5 Extraction Zone

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const W = canvas.width, H = canvas.height;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function aabbIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function lineIntersectsRect(x1, y1, x2, y2, r) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 6);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

function circleInRect(cx, cy, r, rect) {
  return (
    cx + r >= rect.x &&
    cx - r <= rect.x + rect.w &&
    cy + r >= rect.y &&
    cy - r <= rect.y + rect.h
  );
}

// ----- Input -----
const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (["w", "a", "s", "d", "e", "g", "f"].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

let mouse = { x: W / 2, y: H / 2, down: false };
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
  mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
});
canvas.addEventListener("mousedown", () => (mouse.down = true));
canvas.addEventListener("mouseup", () => (mouse.down = false));

// ----- Entities -----
const player = {
  x: 120, y: 120, r: 14,
  speed: 2.8,
  aim: 0,
  hp: 100,
  flashbangs: 3,
  shootCooldown: 0,
  throwCooldown: 0
};

function mkEnemy(x, y) {
  return {
    x, y, r: 13,
    baseSpeed: 2.0,
    state: "patrol", // patrol, chase, stunned
    t: 0,
    patrolDir: Math.random() * Math.PI * 2,
    stunTime: 0,
    hp: 60,
    seen: false
  };
}

function mkHostage(x, y) {
  return {
    x, y, r: 12,
    alive: true,
    secured: false,
    extracted: false, // ✅ NEW (for Level 5 extraction)
    panicDir: Math.random() * Math.PI * 2,
    panicT: Math.floor(Math.random() * 60),
    followDist: 42
  };
}

// Runtime world state
let walls = [];
let doors = [];
let enemies = [];
let hostages = [];

const bullets = [];
const grenades = [];
const particles = [];

// ----- Levels -----
const levels = [
  {
    name: "Level 1: Two Rooms + Hallway",
    playerSpawn: { x: 120, y: 120 },
    flashbangs: 3,
    walls: [
      { x: 40, y: 40, w: W - 80, h: 20 },
      { x: 40, y: H - 60, w: W - 80, h: 20 },
      { x: 40, y: 60, w: 20, h: H - 120 },
      { x: W - 60, y: 60, w: 20, h: H - 120 },

      { x: 300, y: 60, w: 20, h: 240 },
      { x: 300, y: 360, w: 20, h: 230 },

      { x: 680, y: 60, w: 20, h: 220 },
      { x: 680, y: 340, w: 20, h: 270 },

      { x: 320, y: 300, w: 360, h: 20 },
    ],
    doors: [
      { x: 300, y: 245, w: 20, h: 70, open: false },
      { x: 680, y: 265, w: 20, h: 90, open: false },
      { x: 480, y: 300, w: 100, h: 20, open: false },
    ],
    enemies: [
      { x: 860, y: 120 },
      { x: 880, y: 540 },
      { x: 520, y: 520 },
    ],
    hostages: []
  },

  {
    name: "Level 2: Split Office + Side Closet",
    playerSpawn: { x: 120, y: 540 },
    flashbangs: 4,
    walls: [
      { x: 40, y: 40, w: W - 80, h: 20 },
      { x: 40, y: H - 60, w: W - 80, h: 20 },
      { x: 40, y: 60, w: 20, h: H - 120 },
      { x: W - 60, y: 60, w: 20, h: H - 120 },

      { x: 520, y: 60, w: 20, h: H - 120 },

      { x: 60, y: 190, w: 460, h: 20 },
      { x: 540, y: 190, w: 400, h: 20 },

      { x: 180, y: 320, w: 20, h: 220 },
      { x: 180, y: 320, w: 220, h: 20 },
      { x: 380, y: 320, w: 20, h: 220 },
      { x: 180, y: 520, w: 220, h: 20 },
    ],
    doors: [
      { x: 520, y: 340, w: 20, h: 90, open: false },
      { x: 720, y: 190, w: 110, h: 20, open: false },
      { x: 380, y: 410, w: 20, h: 80, open: false },
    ],
    enemies: [
      { x: 860, y: 120 },
      { x: 820, y: 520 },
      { x: 620, y: 360 },
      { x: 260, y: 420 },
    ],
    hostages: []
  },

  // ✅ LEVEL 3 (fixed: corridor connects to rooms, no sealed boxes)
  {
    name: "Level 3: Hostage Rescue",
    playerSpawn: { x: 500, y: 110 }, // spawn in corridor
    flashbangs: 5,

    walls: [
      // Outer border
      { x: 40, y: 40, w: W - 80, h: 20 },
      { x: 40, y: H - 60, w: W - 80, h: 20 },
      { x: 40, y: 60, w: 20, h: H - 120 },
      { x: W - 60, y: 60, w: 20, h: H - 120 },

      // Main corridor walls
      { x: 380, y: 80, w: 20, h: 490 },  // left corridor wall
      { x: 600, y: 80, w: 20, h: 490 },  // right corridor wall

      // LEFT TOP room (touches corridor at x=380; no right wall)
      { x: 80,  y: 120, w: 300, h: 20 },
      { x: 80,  y: 120, w: 20,  h: 200 },
      { x: 80,  y: 300, w: 300, h: 20 },

      // LEFT BOTTOM room
      { x: 80,  y: 360, w: 300, h: 20 },
      { x: 80,  y: 360, w: 20,  h: 180 },
      { x: 80,  y: 540, w: 300, h: 20 },

      // RIGHT TOP room (touches corridor at x=600; no left wall)
      { x: 620, y: 120, w: 320, h: 20 },
      { x: 920, y: 120, w: 20,  h: 200 },
      { x: 620, y: 300, w: 320, h: 20 },

      // RIGHT BOTTOM room
      { x: 620, y: 360, w: 320, h: 20 },
      { x: 920, y: 360, w: 20,  h: 180 },
      { x: 620, y: 540, w: 320, h: 20 },
    ],

    doors: [
      { x: 380, y: 180, w: 20, h: 70, open: false }, // corridor -> left-top
      { x: 380, y: 420, w: 20, h: 70, open: false }, // corridor -> left-bottom
      { x: 600, y: 180, w: 20, h: 70, open: false }, // corridor -> right-top
      { x: 600, y: 420, w: 20, h: 70, open: false }, // corridor -> right-bottom
    ],

    enemies: [
      { x: 500, y: 260 }, // corridor (not on spawn)
      { x: 500, y: 520 }, // corridor
      { x: 780, y: 220 }, // right-top room
      { x: 220, y: 450 }, // left-bottom room
    ],

    hostages: [
      { x: 200, y: 220 }, // left-top room
      { x: 820, y: 450 }, // right-bottom room
      { x: 500, y: 560 }, // corridor bottom
    ]
  },

  // ✅ LEVEL 4: Cross Hall + 4 Rooms
  {
    name: "Level 4: Crossfire Extraction",
    playerSpawn: { x: 500, y: 110 },
    flashbangs: 6,

    walls: [
      // Outer border
      { x: 40, y: 40, w: W - 80, h: 20 },
      { x: 40, y: H - 60, w: W - 80, h: 20 },
      { x: 40, y: 60, w: 20, h: H - 120 },
      { x: W - 60, y: 60, w: 20, h: H - 120 },

      // Vertical corridor walls
      { x: 380, y: 80,  w: 20, h: 510 },
      { x: 600, y: 80,  w: 20, h: 510 },

      // Horizontal corridor walls (“cross”)
      { x: 120, y: 300, w: 280, h: 20 },
      { x: 600, y: 300, w: 280, h: 20 },

      // TOP-LEFT room
      { x: 80,  y: 120, w: 300, h: 20 },
      { x: 80,  y: 120, w: 20,  h: 160 },
      { x: 80,  y: 260, w: 300, h: 20 },

      // TOP-RIGHT room
      { x: 620, y: 120, w: 320, h: 20 },
      { x: 920, y: 120, w: 20,  h: 160 },
      { x: 620, y: 260, w: 320, h: 20 },

      // BOTTOM-LEFT room
      { x: 80,  y: 360, w: 300, h: 20 },
      { x: 80,  y: 360, w: 20,  h: 200 },
      { x: 80,  y: 540, w: 300, h: 20 },

      // BOTTOM-RIGHT room
      { x: 620, y: 360, w: 320, h: 20 },
      { x: 920, y: 360, w: 20,  h: 200 },
      { x: 620, y: 540, w: 320, h: 20 },
    ],

    doors: [
      { x: 380, y: 165, w: 20, h: 70, open: false },
      { x: 600, y: 165, w: 20, h: 70, open: false },
      { x: 380, y: 430, w: 20, h: 70, open: false },
      { x: 600, y: 430, w: 20, h: 70, open: false },
    ],

    enemies: [
      { x: 500, y: 240 },
      { x: 500, y: 520 },
      { x: 240, y: 200 },
      { x: 780, y: 200 },
      { x: 240, y: 470 },
      { x: 780, y: 470 },
    ],

    hostages: [
      { x: 150, y: 190 },
      { x: 900, y: 190 },
      { x: 150, y: 500 },
      { x: 900, y: 500 },
    ]
  },
  // ✅ LEVEL 5: NEW MECHANIC — Escort + Extraction Zone (with REAL rooms + doors)
{
  name: "Level 5: Escort & Extract",
  playerSpawn: { x: 500, y: 120 },
  flashbangs: 6,

  extractionZone: { x: 70, y: 70, w: 160, h: 110 },

  walls: [
    // Outer border
    { x: 40, y: 40, w: W - 80, h: 20 },
    { x: 40, y: H - 60, w: W - 80, h: 20 },
    { x: 40, y: 60, w: 20, h: H - 120 },
    { x: W - 60, y: 60, w: 20, h: H - 120 },

    // Main vertical corridor walls
    { x: 380, y: 80,  w: 20, h: 510 },
    { x: 600, y: 80,  w: 20, h: 510 },

    // LEFT rooms (touch corridor at x=380, no right wall needed)
    // Left-Top room
    { x: 80,  y: 120, w: 300, h: 20 },
    { x: 80,  y: 120, w: 20,  h: 160 },
    { x: 80,  y: 260, w: 300, h: 20 },

    // Left-Bottom room
    { x: 80,  y: 380, w: 300, h: 20 },
    { x: 80,  y: 380, w: 20,  h: 170 },
    { x: 80,  y: 530, w: 300, h: 20 },

    // RIGHT rooms (touch corridor at x=600, no left wall needed)
    // Right-Top room
    { x: 620, y: 120, w: 320, h: 20 },
    { x: 920, y: 120, w: 20,  h: 160 },
    { x: 620, y: 260, w: 320, h: 20 },

    // Right-Bottom room
    { x: 620, y: 380, w: 320, h: 20 },
    { x: 920, y: 380, w: 20,  h: 170 },
    { x: 620, y: 530, w: 320, h: 20 },
  ],

  doors: [
    // Doors cut INTO corridor walls to enter rooms
    { x: 380, y: 155, w: 20, h: 70, open: false }, // corridor -> left-top
    { x: 380, y: 430, w: 20, h: 70, open: false }, // corridor -> left-bottom

    { x: 600, y: 155, w: 20, h: 70, open: false }, // corridor -> right-top
    { x: 600, y: 430, w: 20, h: 70, open: false }, // corridor -> right-bottom
  ],

  enemies: [
    { x: 500, y: 240 }, // corridor
    { x: 500, y: 520 }, // corridor
    { x: 240, y: 200 }, // left-top room
    { x: 780, y: 200 }, // right-top room
    { x: 240, y: 470 }, // left-bottom room
    { x: 780, y: 470 }, // right-bottom room
  ],

  hostages: [
    { x: 150, y: 190 }, // left-top
    { x: 900, y: 190 }, // right-top
    { x: 900, y: 500 }, // right-bottom
  ]
},
]

let levelIndex = 0;
let levelCleared = false;
let nextLevelTimer = 0;
let hostageDown = false;

// ----- Collision helpers -----
function collidesWithSolidCircle(x, y, r) {
  const box = { x: x - r, y: y - r, w: r * 2, h: r * 2 };

  for (const w of walls) {
    if (!aabbIntersect(box, w)) continue;

    let doorwayGap = false;
    for (const d of doors) {
      if (!d.open) continue;
      if (!aabbIntersect(d, w)) continue;
      if (aabbIntersect(box, d)) { doorwayGap = true; break; }
    }
    if (!doorwayGap) return true;
  }

  for (const d of doors) {
    if (d.open) continue;
    if (aabbIntersect(box, d)) return true;
  }

  return false;
}

function hasLineOfSight(ax, ay, bx, by) {
  for (const w of walls) {
    if (lineIntersectsRect(ax, ay, bx, by, w)) return false;
  }
  for (const d of doors) {
    if (!d.open && lineIntersectsRect(ax, ay, bx, by, d)) return false;
  }
  return true;
}

function tryMove(ent, vx, vy) {
  const nx = ent.x + vx;
  if (!collidesWithSolidCircle(nx, ent.y, ent.r)) ent.x = nx;

  const ny = ent.y + vy;
  if (!collidesWithSolidCircle(ent.x, ny, ent.r)) ent.y = ny;
}

function pushSpawnsAwayFromPlayer(minDist = 150) {
  for (const en of enemies) {
    let tries = 0;
    while (dist(en.x, en.y, player.x, player.y) < minDist && tries < 60) {
      const ang = Math.random() * Math.PI * 2;
      const step = 18;
      const nx = en.x + Math.cos(ang) * step;
      const ny = en.y + Math.sin(ang) * step;
      if (!collidesWithSolidCircle(nx, ny, en.r)) {
        en.x = nx;
        en.y = ny;
      }
      tries++;
    }
  }
}

function loadLevel(i) {
  levelIndex = i;

  walls = levels[i].walls.map(w => ({ ...w }));
  doors = levels[i].doors.map(d => ({ ...d }));
  enemies = levels[i].enemies.map(e => mkEnemy(e.x, e.y));
  hostages = levels[i].hostages.map(h => mkHostage(h.x, h.y));

  bullets.length = 0;
  grenades.length = 0;
  particles.length = 0;

  player.x = levels[i].playerSpawn.x;
  player.y = levels[i].playerSpawn.y;
  player.hp = 100;
  player.flashbangs = levels[i].flashbangs;
  player.shootCooldown = 0;
  player.throwCooldown = 0;

  levelCleared = false;
  nextLevelTimer = 0;
  hostageDown = false;

  // ✅ Guarantee no enemy spawns on you
  pushSpawnsAwayFromPlayer(160);
}

loadLevel(0);

// ----- Actions -----
function shoot() {
  if (player.shootCooldown > 0) return;
  player.shootCooldown = 9;

  const ang = player.aim;
  const speed = 10.5;

  bullets.push({
    x: player.x + Math.cos(ang) * (player.r + 6),
    y: player.y + Math.sin(ang) * (player.r + 6),
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    life: 70
  });

  for (let i = 0; i < 7; i++) {
    particles.push({
      x: player.x + Math.cos(ang) * (player.r + 6),
      y: player.y + Math.sin(ang) * (player.r + 6),
      vx: Math.cos(ang + (Math.random() - 0.5) * 0.8) * (2 + Math.random() * 3),
      vy: Math.sin(ang + (Math.random() - 0.5) * 0.8) * (2 + Math.random() * 3),
      life: 18
    });
  }
}

function breachOrOpenDoor() {
  let best = null;
  let bestD = 9999;

  for (const d of doors) {
    if (d.open) continue;
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    const dd = dist(player.x, player.y, cx, cy);
    if (dd < 60 && dd < bestD) { best = d; bestD = dd; }
  }
  if (!best) return;

  best.open = true;

  for (let i = 0; i < 20; i++) {
    particles.push({
      x: best.x + best.w / 2,
      y: best.y + best.h / 2,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 22
    });
  }
}

function throwFlashbang() {
  if (player.flashbangs <= 0) return;
  if (player.throwCooldown > 0) return;

  player.throwCooldown = 40;
  player.flashbangs--;

  const ang = player.aim;
  const power = 7.2;

  grenades.push({
    x: player.x + Math.cos(ang) * (player.r + 8),
    y: player.y + Math.sin(ang) * (player.r + 8),
    vx: Math.cos(ang) * power,
    vy: Math.sin(ang) * power,
    life: 55,
    detonate: false,
    radius: 130
  });
}

function secureNearestHostage() {
  let best = null;
  let bestD = 9999;
  for (const h of hostages) {
    if (!h.alive || h.secured || h.extracted) continue;
    const d = dist(player.x, player.y, h.x, h.y);
    if (d < 55 && d < bestD) { best = h; bestD = d; }
  }
  if (best) best.secured = true;
}

// ----- Input edge detection -----
let prevE = false;
let prevG = false;
let prevF = false;

// ----- Main Loop -----
function update() {
  player.aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  if (hostageDown) {
    draw();
    requestAnimationFrame(update);
    return;
  }

  // If level cleared, wait then load next
  if (levelCleared) {
    nextLevelTimer--;
    if (nextLevelTimer <= 0) {
      if (levelIndex < levels.length - 1) loadLevel(levelIndex + 1);
      else nextLevelTimer = 999999;
    }
    draw();
    requestAnimationFrame(update);
    return;
  }

  // movement
  let mx = 0, my = 0;
  if (keys.has("w")) my -= 1;
  if (keys.has("s")) my += 1;
  if (keys.has("a")) mx -= 1;
  if (keys.has("d")) mx += 1;

  const mag = Math.hypot(mx, my) || 1;
  mx = (mx / mag) * player.speed;
  my = (my / mag) * player.speed;

  tryMove(player, mx, my);

  // actions
  if (mouse.down) shoot();

  const eDown = keys.has("e");
  if (eDown && !prevE) breachOrOpenDoor();
  prevE = eDown;

  const gDown = keys.has("g");
  if (gDown && !prevG) throwFlashbang();
  prevG = gDown;

  const fDown = keys.has("f");
  if (fDown && !prevF) secureNearestHostage();
  prevF = fDown;

  // cooldowns
  player.shootCooldown = Math.max(0, player.shootCooldown - 1);
  player.throwCooldown = Math.max(0, player.throwCooldown - 1);

  // bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    const hitBox = { x: b.x - 2, y: b.y - 2, w: 4, h: 4 };
    let hit = false;

    // walls with open-door holes
    for (const w of walls) {
      if (!aabbIntersect(hitBox, w)) continue;

      let doorwayGap = false;
      for (const d of doors) {
        if (!d.open) continue;
        if (!aabbIntersect(d, w)) continue;
        if (aabbIntersect(hitBox, d)) { doorwayGap = true; break; }
      }
      if (!doorwayGap) hit = true;
    }

    for (const d of doors) if (!d.open && aabbIntersect(hitBox, d)) hit = true;

    // hostages (FAIL)
    for (const h of hostages) {
      if (!h.alive || h.extracted) continue;
      if (dist(b.x, b.y, h.x, h.y) < h.r + 2) {
        h.alive = false;
        hostageDown = true;
        hit = true;
        break;
      }
    }

    // enemies
    for (const en of enemies) {
      if (en.hp <= 0) continue;
      if (dist(b.x, b.y, en.x, en.y) < en.r + 2) {
        en.hp -= 20;
        hit = true;
        for (let k = 0; k < 10; k++) {
          particles.push({
            x: en.x, y: en.y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 20
          });
        }
        break;
      }
    }

    if (hit || b.life <= 0) bullets.splice(i, 1);
  }

  // grenades
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];

    const nx = g.x + g.vx;
    const ny = g.y + g.vy;

    if (collidesWithSolidCircle(nx, g.y, 6)) g.vx *= -0.6;
    else g.x = nx;

    if (collidesWithSolidCircle(g.x, ny, 6)) g.vy *= -0.6;
    else g.y = ny;

    g.vx *= 0.98;
    g.vy *= 0.98;

    g.life--;
    if (g.life === 0 && !g.detonate) {
      g.detonate = true;

      for (let p = 0; p < 70; p++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 7;
        particles.push({
          x: g.x, y: g.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 26
        });
      }

      for (const en of enemies) {
        if (en.hp <= 0) continue;
        const d = dist(g.x, g.y, en.x, en.y);
        if (d <= g.radius && hasLineOfSight(g.x, g.y, en.x, en.y)) {
          en.state = "stunned";
          en.stunTime = 120;
        }
      }
    }

    if (g.detonate) grenades.splice(i, 1);
  }

  // enemies AI (only chase while seeing you)
  for (const en of enemies) {
    if (en.hp <= 0) continue;

    en.seen = false;

    if (en.state === "stunned") {
      en.stunTime--;
      if (en.stunTime <= 0) en.state = "patrol";
      continue;
    }

    const canSee = hasLineOfSight(en.x, en.y, player.x, player.y);
    const dToPlayer = dist(en.x, en.y, player.x, player.y);

    if (canSee && dToPlayer < 280) {
      en.state = "chase";
      en.seen = true;
    } else {
      en.state = "patrol";
    }

    if (en.state === "patrol") {
      en.t++;
      if (en.t % 120 === 0) en.patrolDir = Math.random() * Math.PI * 2;

      const vx = Math.cos(en.patrolDir) * en.baseSpeed * 0.7;
      const vy = Math.sin(en.patrolDir) * en.baseSpeed * 0.7;

      const bx = en.x, by = en.y;
      tryMove(en, vx, vy);
      if (Math.abs(en.x - bx) + Math.abs(en.y - by) < 0.2) {
        en.patrolDir = Math.random() * Math.PI * 2;
      }
    }

    if (en.state === "chase") {
      const ang = Math.atan2(player.y - en.y, player.x - en.x);
      const vx = Math.cos(ang) * en.baseSpeed;
      const vy = Math.sin(ang) * en.baseSpeed;
      tryMove(en, vx, vy);

      if (dToPlayer < en.r + player.r + 4) {
        player.hp = Math.max(0, player.hp - 0.25);
      }
    }
  }

  // hostage AI:
  const aliveEnemies = enemies.filter(e => e.hp > 0).length;

  for (const h of hostages) {
    if (!h.alive || h.extracted) continue;

    if (h.secured) {
      const d = dist(h.x, h.y, player.x, player.y);
      if (d > h.followDist) {
        const ang = Math.atan2(player.y - h.y, player.x - h.x);
        const vx = Math.cos(ang) * 1.8;
        const vy = Math.sin(ang) * 1.8;
        tryMove(h, vx, vy);
      }
    } else if (aliveEnemies > 0) {
      h.panicT++;
      if (h.panicT % 50 === 0) h.panicDir = Math.random() * Math.PI * 2;

      const vx = Math.cos(h.panicDir) * 0.8;
      const vy = Math.sin(h.panicDir) * 0.8;

      const bx = h.x, by = h.y;
      tryMove(h, vx, vy);
      if (Math.abs(h.x - bx) + Math.abs(h.y - by) < 0.1) {
        h.panicDir = Math.random() * Math.PI * 2;
      }
    }
  }

  // ✅ Extraction zone logic (Level 5 only)
  const ex = levels[levelIndex].extractionZone;
  if (ex) {
    for (const h of hostages) {
      if (!h.alive) continue;
      if (!h.secured || h.extracted) continue;
      if (circleInRect(h.x, h.y, h.r, ex)) {
        h.extracted = true;
      }
    }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // clear conditions
  const aliveHostages = hostages.filter(h => h.alive).length;
  const securedHostages = hostages.filter(h => h.alive && h.secured).length;
  const extractedHostages = hostages.filter(h => h.alive && h.extracted).length;

  if (aliveEnemies === 0) {
    if (hostages.length === 0) {
      levelCleared = true;
      nextLevelTimer = 120;
    } else if (aliveHostages === hostages.length) {
      if (ex) {
        if (extractedHostages === hostages.length) {
          levelCleared = true;
          nextLevelTimer = 120;
        }
      } else {
        if (securedHostages === hostages.length) {
          levelCleared = true;
          nextLevelTimer = 120;
        }
      }
    }
  }

  // status UI
  statusEl.textContent =
    `${levels[levelIndex].name} • HP: ${Math.round(player.hp)} • Flashbangs: ${player.flashbangs} • Enemies: ${aliveEnemies} • ` +
    (hostages.length
      ? (ex
          ? `Hostages: ${extractedHostages}/${hostages.length} extracted (F to secure, escort to zone)`
          : `Hostages: ${securedHostages}/${hostages.length} secured (F to secure)`)
      : `No hostages`);

  draw();
  requestAnimationFrame(update);
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // ✅ extraction zone (if exists)
  const ex = levels[levelIndex].extractionZone;
  if (ex) {
    ctx.fillStyle = "rgba(80, 255, 120, 0.18)";
    ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
    ctx.strokeStyle = "rgba(80, 255, 120, 0.45)";
    ctx.strokeRect(ex.x + 1, ex.y + 1, ex.w - 2, ex.h - 2);
  }

  // floor grid
  ctx.globalAlpha = 0.18;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.strokeStyle = "#cfe3ff";
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.strokeStyle = "#cfe3ff";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // walls
  ctx.fillStyle = "#23324a";
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);

  // doors
  for (const d of doors) {
    if (d.open) {
      ctx.fillStyle = "rgba(180, 230, 255, 0.18)";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = "rgba(180, 230, 255, 0.35)";
      ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2);
    } else {
      ctx.fillStyle = "#3a2d1b";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2);
    }
  }

  // hostages (GREEN if not secured, CYAN if secured)
  for (const h of hostages) {
    if (!h.alive || h.extracted) continue;
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    ctx.fillStyle = h.secured ? "#40e0ff" : "#3dff7b";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
  }

  // grenades
  for (const g of grenades) {
    ctx.beginPath();
    ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#e8f2ff";
    ctx.fill();
  }

  // bullets
  ctx.fillStyle = "#e8f2ff";
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);

  // enemies
  for (const en of enemies) {
    if (en.hp <= 0) continue;

    ctx.beginPath();
    ctx.arc(en.x, en.y, en.r, 0, Math.PI * 2);
    ctx.fillStyle = en.state === "stunned" ? "rgba(200,220,255,0.75)" : "#ff5d5d";
    ctx.fill();

    if (en.seen) {
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.lineTo(player.x, player.y);
      ctx.strokeStyle = "rgba(255,120,120,0.35)";
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(en.x - 18, en.y - en.r - 16, 36, 6);
    ctx.fillStyle = "rgba(230,240,255,0.85)";
    ctx.fillRect(en.x - 18, en.y - en.r - 16, 36 * (en.hp / 60), 6);
  }

  // player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fillStyle = "#5dd1ff";
  ctx.fill();

  // aim line
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.aim) * 30, player.y + Math.sin(player.aim) * 30);
  ctx.strokeStyle = "rgba(220,245,255,0.85)";
  ctx.stroke();

  // particles
  ctx.globalAlpha = 0.7;
  for (const p of particles) {
    ctx.fillStyle = "#e8f2ff";
    ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;

  // overlays
  const aliveEnemies = enemies.filter(e => e.hp > 0).length;
  const aliveHostages = hostages.filter(h => h.alive).length;
  const securedHostages = hostages.filter(h => h.alive && h.secured).length;
  const extractedHostages = hostages.filter(h => h.alive && h.extracted).length;

  if (hostageDown) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e7eefc";
    ctx.font = "bold 42px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Hostage Hit!", W / 2, H / 2 - 10);
    ctx.font = "16px system-ui";
    ctx.fillText("Mission Failed • Refresh to restart", W / 2, H / 2 + 26);
  } else if (player.hp <= 0) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e7eefc";
    ctx.font = "bold 42px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Mission Failed", W / 2, H / 2 - 10);
    ctx.font = "16px system-ui";
    ctx.fillText("Refresh to restart", W / 2, H / 2 + 26);
  } else if (levelCleared) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e7eefc";
    ctx.font = "bold 40px system-ui";
    ctx.textAlign = "center";
    if (levelIndex < levels.length - 1) {
      ctx.fillText("Room Cleared!", W / 2, H / 2 - 10);
      ctx.font = "16px system-ui";
      ctx.fillText("Loading next level…", W / 2, H / 2 + 26);
    } else {
      ctx.fillText("All Levels Cleared!", W / 2, H / 2 - 10);
      ctx.font = "16px system-ui";
      ctx.fillText("You beat the prototype 🔥", W / 2, H / 2 + 26);
    }
  } else {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#e7eefc";
    ctx.font = "14px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(levels[levelIndex].name, 16, H - 16);

    if (hostages.length > 0) {
      ctx.textAlign = "right";
      if (levels[levelIndex].extractionZone) {
        ctx.fillText(
          `Objective: Secure (F) + escort to GREEN zone + clear enemies • Extracted ${extractedHostages}/${hostages.length}`,
          W - 16,
          H - 16
        );
      } else {
        ctx.fillText(
          `Objective: Secure hostages (F) + clear enemies • Secured ${securedHostages}/${hostages.length}`,
          W - 16,
          H - 16
        );
      }
    }
    ctx.globalAlpha = 1;
  }
}

// Start
update();
