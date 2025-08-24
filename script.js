/* Dodge the Blocks — Vanilla JS
   - Move left/right, avoid falling blocks.
   - Score increases over time; speed ramps up.
   - Pause (P), Restart (R/overlay button).
   - Mobile: on-screen left/right buttons.
   - Local best score saved.
*/
(() => {
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  // HUD & overlay
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const overlay = document.getElementById('overlay');
  const ovlTitle = document.getElementById('ovlTitle');
  const ovlText = document.getElementById('ovlText');
  const startBtn = document.getElementById('startBtn');

  // Touch controls
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');

  // Persistent best score
  const BEST_KEY = 'dodgeBest';
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  // Game state
  const state = {
    running: false,
    paused: false,
    over: false,
    score: 0,
    speed: 1,          // global multiplier, ramps over time
    spawnCD: 0,        // spawn cooldown
    time: 0,
  };

  // Player
  const player = {
    w: 56, h: 16,
    x: canvas.width / 2 - 28,
    y: canvas.height - 48,
    vx: 0,
    accel: 0.9,
    maxSpeed: 6,
  };

  // Blocks
  const blocks = []; // {x,y,w,h,vy}

  // Input
  const keys = new Set();
  let leftHeld = false, rightHeld = false;

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','a','d','A','D',' ',"p","P","r","R"].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.key === ' ' && !state.running) start();
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 'r' || e.key === 'R') restart();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  // Touch buttons
  leftBtn.addEventListener('touchstart', () => leftHeld = true);
  leftBtn.addEventListener('touchend',   () => leftHeld = false);
  rightBtn.addEventListener('touchstart', () => rightHeld = true);
  rightBtn.addEventListener('touchend',   () => rightHeld = false);

  startBtn.addEventListener('click', () => {
    if (state.over) restart(); else start();
  });
  overlay.addEventListener('click', (e) => {
    // allow click on overlay background to start (but not when clicking panel controls)
    if (e.target === overlay && !state.running) start();
  });

  function start() {
    overlay.classList.add('hidden');
    state.running = true;
    state.paused = false;
    state.over = false;
    state.score = 0;
    state.speed = 1;
    state.spawnCD = 0;
    state.time = 0;
    blocks.length = 0;
    player.x = canvas.width / 2 - player.w/2;
    player.vx = 0;
    last = 0;
    requestAnimationFrame(loop);
  }

  function restart() {
    ovlTitle.textContent = 'Dodge the Blocks';
    ovlText.innerHTML = 'Press <b>Space</b> or tap to start.';
    startBtn.textContent = 'Start';
    state.running = false;
    state.over = false;
    overlay.classList.remove('hidden');
  }

  function togglePause() {
    if (!state.running || state.over) return;
    state.paused = !state.paused;
    if (state.paused) {
      ovlTitle.textContent = 'Paused';
      ovlText.textContent = 'Press Start/Resume or P to continue.';
      startBtn.textContent = 'Resume';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  function gameOver() {
    state.over = true;
    state.running = false;
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
    ovlTitle.textContent = 'Game Over';
    ovlText.innerHTML = `Score: <b>${state.score}</b><br>Best: <b>${best}</b><br>Press <b>R</b> to reset or Start to play again.`;
    startBtn.textContent = 'Start';
    overlay.classList.remove('hidden');
  }

  // Utilities
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;

  function spawnBlock() {
    // width varies; ensure gaps are fair
    const w = rand(60, 160);
    const x = rand(0, canvas.width - w);
    const h = rand(14, 20);
    const vy = rand(2.0, 3.2) * state.speed;
    blocks.push({ x, y: -h, w, h, vy });
  }

  function rectsIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Rendering
  function drawPlayer() {
    ctx.fillStyle = '#00d4ff';
    roundRect(ctx, player.x, player.y, player.w, player.h, 6);
    ctx.fill();
  }

  function drawBlock(b) {
    ctx.fillStyle = '#ff6b6b';
    roundRect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Game loop
  let last = 0;
  function loop(ts) {
    if (!state.running) return;
    const dt = Math.min(32, (ts - last) || 16) / 16.6667; // normalize ~60fps
    last = ts;

    if (state.paused) {
      requestAnimationFrame(loop);
      return;
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Input (keyboard + touch)
    const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A') || leftHeld;
    const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D') || rightHeld;

    // Player movement with acceleration & friction
    const accel = player.accel * (right ? 1 : 0) - player.accel * (left ? 1 : 0);
    player.vx += accel;
    // basic friction
    player.vx *= 0.92;
    player.vx = clamp(player.vx, -player.maxSpeed, player.maxSpeed);
    player.x += player.vx * dt;
    player.x = clamp(player.x, 0, canvas.width - player.w);

    // Difficulty ramp
    state.time += dt;
    state.speed = 1 + Math.min(2.5, state.time / 25); // up to ~3.5x over time
    speedEl.textContent = state.speed.toFixed(1) + 'x';

    // Spawn logic (faster with speed)
    state.spawnCD -= dt;
    const spawnEvery = clamp(0.9 - (state.speed - 1) * 0.18, 0.25, 0.9); // seconds
    if (state.spawnCD <= 0) {
      spawnBlock();
      // small chance of a second block at higher speeds
      if (state.speed > 2.2 && Math.random() < 0.35) spawnBlock();
      state.spawnCD = spawnEvery;
    }

    // Update & draw blocks
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      b.y += b.vy * dt;
      drawBlock(b);

      if (b.y > canvas.height + 4) {
        blocks.splice(i, 1);
        state.score += 5; // survived a block
      } else if (rectsIntersect(
        { x: player.x, y: player.y, w: player.w, h: player.h },
        b
      )) {
        // collision
        scoreEl.textContent = state.score;
        gameOver();
        return;
      }
    }

    // Score trickle over time
    state.score += Math.floor(1 * dt);
    scoreEl.textContent = state.score;

    // Draw player last
    drawPlayer();

    requestAnimationFrame(loop);
  }

  // Initial overlay
  restart();
})();
