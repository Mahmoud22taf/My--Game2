/* Nebula Dash — Vanilla JS Canvas Game
   Mechanics:
   - Player moves horizontally. Dash with Shift (short burst).
   - Avoid meteors, collect orbs. Lives (3), Score, Levels (difficulty ramps).
   - Power-ups: Shield (absorb one hit), Slow-mo (temporary).
   - Pause (P), Restart (R). Local best score saved.
*/

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ----- Game State -----
  const state = {
    running: true,
    paused: false,
    over: false,
    score: 0,
    best: Number(localStorage.getItem('nebulaBest') || 0),
    lives: 3,
    level: 1,
    time: 0,
    spawnTimer: 0,
    orbTimer: 0,
    powerTimer: 0,
    slowMo: 0,
    shield: 0,
  };

  // ----- Entities -----
  const player = {
    x: canvas.width/2, y: canvas.height - 48,
    w: 36, h: 16, speed: 4.2, vx: 0,
    dashCD: 0
  };

  const meteors = []; // {x,y,r,vy}
  const orbs = [];    // {x,y,r,vy}
  const powerups = []; // {x,y,r,vy,type:'shield'|'slow'}

  // ----- Input -----
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','a','d','A','D','Shift','p','P','r','R'].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 'r' || e.key === 'R') restart();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  // UI elements
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('stateTitle');
  const textEl = document.getElementById('stateText');
  document.getElementById('resumeBtn').onclick = () => { if (state.over) restart(); else togglePause(false); };
  document.getElementById('restartBtn').onclick = restart;

  bestEl.textContent = state.best;

  // ----- Helpers -----
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const chance = (p) => Math.random() < p;

  function collideCircleRect(cx, cy, cr, rx, ry, rw, rh) {
    // closest point on rect to circle center
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function spawnMeteor() {
    const r = rand(10, 22);
    meteors.push({
      x: rand(r, canvas.width - r),
      y: -r - 10,
      r,
      vy: rand(1.8, 2.4) + state.level * 0.25
    });
  }

  function spawnOrb() {
    const r = 8;
    orbs.push({
      x: rand(r, canvas.width - r),
      y: -r - 10,
      r,
      vy: rand(1.6, 2.1)
    });
  }

  function spawnPower() {
    const r = 10;
    powerups.push({
      x: rand(r, canvas.width - r),
      y: -r - 10,
      r,
      vy: rand(1.5, 2),
      type: chance(0.5) ? 'shield' : 'slow'
    });
  }

  function togglePause(force=false) {
    if (state.over) return;
    state.paused = force === true ? true : !state.paused;
    overlay.classList.toggle('hidden', !state.paused);
    titleEl.textContent = 'Paused';
    textEl.textContent = 'Press Resume or P to continue.';
  }

  function gameOver() {
    state.over = true;
    state.running = false;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('nebulaBest', String(state.best));
      bestEl.textContent = state.best;
    }
    overlay.classList.remove('hidden');
    titleEl.textContent = 'Game Over';
    textEl.innerHTML = `Final Score: <b>${state.score}</b><br/>Level reached: <b>${state.level}</b>`;
  }

  function restart() {
    state.running = true;
    state.paused = false;
    state.over = false;
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.time = 0;
    state.spawnTimer = 0;
    state.orbTimer = 0;
    state.powerTimer = 0;
    state.slowMo = 0;
    state.shield = 0;
    meteors.length = 0;
    orbs.length = 0;
    powerups.length = 0;
    player.x = canvas.width/2;
    player.vx = 0;
    player.dashCD = 0;
    overlay.classList.add('hidden');
    loop(0);
  }

  // ----- Draw -----
  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    // body
    ctx.fillStyle = '#7c5cff';
    ctx.beginPath();
    ctx.roundRect(-player.w/2, -player.h/2, player.w, player.h, 4);
    ctx.fill();

    // nose
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(-2, -player.h/2 - 6, 4, 6);

    // shield aura
    if (state.shield > 0) {
      ctx.strokeStyle = 'rgba(124,92,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -4, 22, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCircle(x, y, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width || 2;
      ctx.stroke();
    }
  }

  // ----- Update & Loop -----
  let last = 0;
  function loop(ts) {
    if (!state.running) return;
    const dt = Math.min(32, ts - last || 16) / 16.6667; // normalize against ~60fps
    last = ts;

    if (state.paused) {
      requestAnimationFrame(loop);
      return;
    }

    const timeScale = state.slowMo > 0 ? 0.5 : 1;
    state.time += dt * timeScale;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Input → velocity
    const left = keys.has('ArrowLeft') || keys.has('a') || keys.has('A');
    const right = keys.has('ArrowRight') || keys.has('d') || keys.has('D');
    player.vx = 0;
    if (left) player.vx = -player.speed;
    if (right) player.vx = player.speed;

    // Dash (short burst, cooldown)
    if (keys.has('Shift') && player.dashCD <= 0) {
      player.vx *= 2.2;
      player.dashCD = 60; // frames
    } else {
      player.dashCD = Math.max(0, player.dashCD - 1 * timeScale);
    }

    // Move player + clamp
    player.x += player.vx * dt * timeScale * 1.0;
    player.x = clamp(player.x, player.w/2 + 6, canvas.width - player.w/2 - 6);

    // Spawning — scale with level
    const meteorInterval = Math.max(18, 50 - state.level * 4);
    state.spawnTimer += dt * timeScale;
    if (state.spawnTimer >= meteorInterval/60) {
      state.spawnTimer = 0;
      spawnMeteor();
      if (chance(0.1 + state.level*0.01)) spawnMeteor(); // occasional extra
    }

    state.orbTimer += dt * timeScale;
    if (state.orbTimer >= 1.0) { // every ~1s
      state.orbTimer = 0;
      if (chance(0.7)) spawnOrb();
    }

    state.powerTimer += dt * timeScale;
    if (state.powerTimer >= 6.0) {
      state.powerTimer = 0;
      if (chance(0.6)) spawnPower();
    }

    // Increase level over time
    if (state.time >= state.level * 15) { // new level every 15s
      state.level++;
    }

    // Update meteors
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.y += m.vy * dt * timeScale;
      drawCircle(m.x, m.y, m.r, '#ff735a', { color: 'rgba(255,255,255,0.25)' });

      // collision
      if (collideCircleRect(m.x, m.y, m.r, player.x - player.w/2, player.y - player.h/2, player.w, player.h)) {
        meteors.splice(i, 1);
        if (state.shield > 0) {
          state.shield = 0; // shield absorbs one hit
        } else {
          state.lives--;
          if (state.lives <= 0) {
            updateHUD();
            gameOver();
            return requestAnimationFrame(loop);
          }
        }
      } else if (m.y - m.r > canvas.height) {
        meteors.splice(i, 1);
      }
    }

    // Update orbs (score)
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.y += o.vy * dt * timeScale;
      drawCircle(o.x, o.y, o.r, '#00d4ff', { color: 'rgba(255,255,255,0.18)' });

      if (collideCircleRect(o.x, o.y, o.r, player.x - player.w/2, player.y - player.h/2, player.w, player.h)) {
        state.score += 10 + state.level; // reward increases with level
        orbs.splice(i, 1);
      } else if (o.y - o.r > canvas.height) {
        orbs.splice(i, 1);
      }
    }

    // Update power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt * timeScale;
      const col = p.type === 'shield' ? '#7c5cff' : '#88ffb2';
      drawCircle(p.x, p.y, p.r, col, { color: 'rgba(255,255,255,0.2)' });

      if (collideCircleRect(p.x, p.y, p.r, player.x - player.w/2, player.y - player.h/2, player.w, player.h)) {
        if (p.type === 'shield') state.shield = 1;
        else state.slowMo = 180; // ~3s at 60fps
        powerups.splice(i, 1);
      } else if (p.y - p.r > canvas.height) {
        powerups.splice(i, 1);
      }
    }

    // slow-mo timer
    if (state.slowMo > 0) state.slowMo -= 1;

    // Draw player last (on top)
    drawPlayer();

    updateHUD();

    requestAnimationFrame(loop);
  }

  function updateHUD() {
    scoreEl.textContent = state.score;
    livesEl.textContent = state.lives;
    levelEl.textContent = state.level;
  }

  // Start
  updateHUD();
  requestAnimationFrame(loop);
})();
