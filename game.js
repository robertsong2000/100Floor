const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const floorText = document.getElementById("floorText");
const scoreText = document.getElementById("scoreText");
const bestText = document.getElementById("bestText");

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 1450;
const PLAYER_W = 34;
const PLAYER_H = 44;
const SPIKE_H = 34;
const TOTAL_FLOORS = 100;

const state = {
  running: false,
  paused: false,
  ended: false,
  lastTime: 0,
  score: 0,
  floor: 1,
  cameraSpeed: 78,
  platformGap: 92,
  spawnY: 0,
  platforms: [],
  keys: { left: false, right: false },
  player: null,
  particles: [],
  best: Number(localStorage.getItem("floorDropBest") || 0),
};

const playerSheet = new Image();
playerSheet.src = "assets/player-sheet.png";
const spriteFrames = [];

const audio = {
  ctx: null,
  enabled: true,
  unlocked: false,
};

function unlockAudio() {
  if (!audio.enabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    audio.enabled = false;
    return;
  }
  if (!audio.ctx) audio.ctx = new AudioContext();
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  audio.unlocked = true;
}

function tone(freq, duration, type = "square", gain = 0.055, delay = 0) {
  if (!audio.ctx || !audio.unlocked) return;
  const now = audio.ctx.currentTime + delay;
  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0, now);
  amp.gain.linearRampToValueAtTime(gain, now + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(audio.ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noise(duration, gain = 0.07, delay = 0) {
  if (!audio.ctx || !audio.unlocked) return;
  const now = audio.ctx.currentTime + delay;
  const buffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate * duration, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = audio.ctx.createBufferSource();
  const filter = audio.ctx.createBiquadFilter();
  const amp = audio.ctx.createGain();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(amp);
  amp.connect(audio.ctx.destination);
  source.start(now);
  source.stop(now + duration);
}

const sfx = {
  start() {
    tone(330, 0.08, "square", 0.04);
    tone(660, 0.11, "square", 0.045, 0.08);
  },
  land(type) {
    if (type === "spring") {
      tone(360, 0.07, "triangle", 0.055);
      tone(760, 0.16, "triangle", 0.05, 0.055);
      return;
    }
    if (type === "crack") {
      noise(0.13, 0.08);
      tone(130, 0.09, "sawtooth", 0.035);
      return;
    }
    tone(190, 0.045, "square", 0.035);
  },
  milestone() {
    tone(540, 0.06, "square", 0.04);
    tone(720, 0.07, "square", 0.04, 0.06);
  },
  pause() {
    tone(260, 0.08, "triangle", 0.035);
  },
  gameOver() {
    noise(0.18, 0.075);
    tone(180, 0.16, "sawtooth", 0.04, 0.02);
    tone(92, 0.28, "sawtooth", 0.045, 0.12);
  },
  win() {
    [523, 659, 784, 1046].forEach((freq, index) => tone(freq, 0.12, "square", 0.045, index * 0.085));
  },
};

playerSheet.addEventListener("load", prepareSpriteFrames);

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetGame(playSound = true) {
  if (playSound) {
    unlockAudio();
    sfx.start();
  }
  state.running = true;
  state.paused = false;
  state.ended = false;
  state.lastTime = performance.now();
  state.score = 0;
  state.floor = 1;
  state.cameraSpeed = 78;
  state.platformGap = 92;
  state.spawnY = H - 34;
  state.platforms = [];
  state.particles = [];
  state.player = {
    x: W / 2 - PLAYER_W / 2,
    y: 126,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    anim: 0,
  };

  for (let y = 150; y < H + 120; y += state.platformGap) {
    state.platforms.push(makePlatform(y, y < 180 ? 150 : undefined));
  }
  updateHud();
  overlay.classList.remove("is-visible");
  pauseBtn.textContent = "暂停";
}

function makePlatform(y, forcedX) {
  const floorBand = Math.floor((H - y) / state.platformGap);
  const width = clamp(122 - state.floor * 0.45 + random(-18, 20), 62, 134);
  const types = state.floor > 36 ? ["normal", "normal", "spring", "crack"] : ["normal", "normal", "spring"];
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    x: forcedX ?? random(16, W - width - 16),
    y,
    w: width,
    h: type === "spring" ? 13 : 11,
    type,
    used: false,
    band: floorBand,
  };
}

function updateHud() {
  floorText.textContent = state.floor;
  scoreText.textContent = state.score;
  bestText.textContent = state.best;
}

function completeGame() {
  if (state.ended) return;
  state.running = false;
  state.ended = true;
  sfx.win();
  startBtn.textContent = "再来一次";
  overlay.querySelector(".badge").textContent = "通关 100 层！这手感可以。";
  overlay.classList.add("is-visible");
}

function gameOver(reason) {
  if (state.ended) return;
  state.running = false;
  state.ended = true;
  sfx.gameOver();
  startBtn.textContent = "再来一次";
  overlay.querySelector(".badge").textContent = reason;
  overlay.classList.add("is-visible");
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("floorDropBest", String(state.best));
  updateHud();
}

function update(dt) {
  if (!state.running || state.paused) return;

  const player = state.player;
  const accel = 1800;
  const maxSpeed = 235;
  const friction = player.grounded ? 0.82 : 0.94;
  const direction = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);

  if (direction !== 0) {
    player.vx += direction * accel * dt;
    player.facing = direction;
  } else {
    player.vx *= friction;
  }

  player.vx = clamp(player.vx, -maxSpeed, maxSpeed);
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < -PLAYER_W) player.x = W;
  if (player.x > W) player.x = -PLAYER_W;

  const scroll = state.cameraSpeed * dt;
  player.y -= scroll;
  state.spawnY -= scroll;
  state.cameraSpeed = 78 + state.floor * 2.45;
  state.platformGap = clamp(96 - state.floor * 0.3, 64, 96);
  player.grounded = false;

  for (const platform of state.platforms) {
    platform.y -= scroll;
    const wasAbove = player.y + PLAYER_H - player.vy * dt <= platform.y + 5;
    const isFalling = player.vy >= 0;
    const overlapsX = player.x + PLAYER_W > platform.x && player.x < platform.x + platform.w;
    const overlapsY = player.y + PLAYER_H >= platform.y && player.y + PLAYER_H <= platform.y + platform.h + 16;

    if (isFalling && wasAbove && overlapsX && overlapsY) {
      player.y = platform.y - PLAYER_H;
      player.vy = platform.type === "spring" ? -650 : -120;
      player.grounded = true;
      platform.used = true;
      sfx.land(platform.type);
      burst(player.x + PLAYER_W / 2, platform.y, platform.type === "spring" ? "#f0b43f" : "#f7ead2");
      if (platform.type === "crack") platform.breaking = true;
    }
  }

  state.platforms = state.platforms.filter((platform) => !platform.breaking && platform.y > -30);
  while (state.spawnY < H + 80) {
    state.spawnY += state.platformGap;
    state.platforms.push(makePlatform(state.spawnY));
  }

  const progressFloor = clamp(Math.floor(state.score / 10) + 1, 1, TOTAL_FLOORS);
  if (progressFloor !== state.floor) {
    state.floor = progressFloor;
    if (state.floor % 10 === 0) sfx.milestone();
    if (state.floor >= TOTAL_FLOORS) completeGame();
  }

  state.score += Math.max(1, Math.floor(scroll / 4));
  state.best = Math.max(state.best, state.score);

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  if (player.y < SPIKE_H - 6) gameOver("撞到顶部尖刺了！");
  if (player.y > H + 80) gameOver("没踩稳，掉下去了！");
  updateHud();
}

function burst(x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-90, 90),
      vy: random(-170, -35),
      life: random(0.28, 0.55),
      color,
    });
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#16243a");
  sky.addColorStop(0.5, "#20646e");
  sky.addColorStop(1, "#f0a24c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "#fff4a8";
  for (let y = 44; y < H; y += 78) {
    ctx.fillRect(0, y, W, 3);
  }
  ctx.globalAlpha = 1;
}

function drawSpikes() {
  ctx.fillStyle = "#f7ead2";
  ctx.strokeStyle = "#241b16";
  ctx.lineWidth = 3;
  for (let x = -8; x < W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 14, SPIKE_H);
    ctx.lineTo(x + 28, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawPlatform(platform) {
  const color = platform.type === "spring" ? "#f0b43f" : platform.type === "crack" ? "#d8452d" : "#f7ead2";
  ctx.fillStyle = "#241b16";
  ctx.fillRect(platform.x - 4, platform.y + 4, platform.w + 8, platform.h + 7);
  ctx.fillStyle = color;
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = platform.type === "spring" ? "#11766e" : "#315a95";
  for (let x = platform.x + 9; x < platform.x + platform.w - 8; x += 18) {
    ctx.fillRect(x, platform.y + 3, 8, 3);
  }
}

function prepareSpriteFrames() {
  const cols = 4;
  const rows = 2;
  const frameW = playerSheet.width / cols;
  const frameH = playerSheet.height / rows;
  const probe = document.createElement("canvas");
  probe.width = playerSheet.width;
  probe.height = playerSheet.height;
  const probeCtx = probe.getContext("2d");
  probeCtx.drawImage(playerSheet, 0, 0);

  for (let frame = 0; frame < cols * rows; frame += 1) {
    const baseX = (frame % cols) * frameW;
    const baseY = Math.floor(frame / cols) * frameH;
    const pixels = probeCtx.getImageData(baseX, baseY, frameW, frameH).data;
    let minX = frameW;
    let minY = frameH;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < frameH; y += 1) {
      for (let x = 0; x < frameW; x += 1) {
        if (pixels[(y * frameW + x) * 4 + 3] > 12) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const pad = 8;
    const sx = baseX + Math.max(0, minX - pad);
    const sy = baseY + Math.max(0, minY - pad);
    const right = Math.min(frameW, maxX + pad);
    const bottom = Math.min(frameH, maxY + pad);
    spriteFrames[frame] = {
      sx,
      sy,
      sw: Math.max(1, right - Math.max(0, minX - pad)),
      sh: Math.max(1, bottom - Math.max(0, minY - pad)),
    };
  }
}

function drawPlayer() {
  const player = state.player;
  const cols = 4;
  const rows = 2;
  const frameW = playerSheet.width / cols;
  const frameH = playerSheet.height / rows;
  let frame = 0;

  if (!player.grounded && player.vy > 220) frame = 5;
  else if (Math.abs(player.vx) > 30) frame = 1 + Math.floor(player.anim / 6) % 4;
  else frame = 0;

  player.anim += Math.abs(player.vx) > 30 ? 1 : 0.25;
  const sprite = spriteFrames[frame] || {
    sx: (frame % cols) * frameW,
    sy: Math.floor(frame / cols) * frameH,
    sw: frameW,
    sh: frameH,
  };
  const drawH = 55;
  const drawW = drawH * (sprite.sw / sprite.sh);

  ctx.save();
  ctx.translate(player.x + PLAYER_W / 2, player.y + PLAYER_H - drawH / 2 + 4);
  ctx.scale(player.facing < 0 ? -1 : 1, 1);
  if (playerSheet.complete && playerSheet.naturalWidth) {
    ctx.drawImage(playerSheet, sprite.sx, sprite.sy, sprite.sw, sprite.sh, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = "#d8452d";
    ctx.fillRect(-PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W, PLAYER_H);
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function render() {
  drawBackground();
  for (const platform of state.platforms) drawPlatform(platform);
  drawParticles();
  drawPlayer();
  drawSpikes();

  if (state.paused) {
    ctx.fillStyle = "rgba(20, 33, 44, 0.62)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f7ead2";
    ctx.font = "900 42px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("暂停", W / 2, H / 2);
  }
}

function loop(now) {
  const dt = Math.min(0.032, (now - state.lastTime) / 1000 || 0);
  state.lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function setButton(button, key) {
  const down = (event) => {
    event.preventDefault();
    unlockAudio();
    state.keys[key] = true;
  };
  const up = (event) => {
    event.preventDefault();
    state.keys[key] = false;
  };
  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointercancel", up);
  button.addEventListener("pointerleave", up);
}

window.addEventListener("keydown", (event) => {
  unlockAudio();
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") state.keys.left = true;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") state.keys.right = true;
  if (event.key === " " || event.key.toLowerCase() === "p") togglePause();
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") state.keys.left = false;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") state.keys.right = false;
});

function togglePause() {
  unlockAudio();
  if (!state.running) return;
  state.paused = !state.paused;
  sfx.pause();
  pauseBtn.textContent = state.paused ? "继续" : "暂停";
  state.lastTime = performance.now();
}

startBtn.addEventListener("click", resetGame);
restartBtn.addEventListener("click", resetGame);
pauseBtn.addEventListener("click", togglePause);
setButton(leftBtn, "left");
setButton(rightBtn, "right");

bestText.textContent = state.best;
resetGame(false);
state.paused = true;
state.running = false;
overlay.classList.add("is-visible");
requestAnimationFrame(loop);
