const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const restartBtn = document.getElementById("restartBtn");

let score = 0;
let missed = 0;
let highScore = localStorage.getItem("catchHighScore") || 0;
let objects = [];
let gameOver = false;

// Player basket
const player = {
  x: canvas.width / 2 - 30,
  y: canvas.height - 30,
  width: 60,
  height: 20,
  speed: 7
};

// Keyboard controls
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" && player.x > 0) player.x -= player.speed;
  if (e.key === "ArrowRight" && player.x < canvas.width - player.width)
    player.x += player.speed;
});

// Create falling object
function createObject() {
  const type = Math.random() < 0.8 ? "good" : "bad"; // 80% 🍎, 20% 💣
  return {
    x: Math.random() * (canvas.width - 20),
    y: 0,
    width: 20,
    height: 20,
    speed: 2 + Math.random() * (2 + score / 10), // gets faster with score
    type
  };
}

// Reset game
function resetGame() {
  score = 0;
  missed = 0;
  objects = [];
  gameOver = false;
  restartBtn.style.display = "none";
  updateScore();
  gameLoop();
}

// Update score display
function updateScore() {
  scoreDisplay.textContent = `Score: ${score} | Missed: ${missed} | High Score: ${highScore}`;
}

// Game loop
function gameLoop() {
  if (gameOver) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw player
  ctx.fillStyle = "blue";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // Spawn objects
  if (Math.random() < 0.04) {
    objects.push(createObject());
  }

  // Move & draw objects
  for (let i = 0; i < objects.length; i++) {
    let obj = objects[i];
    obj.y += obj.speed;

    if (obj.type === "good") {
      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.arc(obj.x + 10, obj.y + 10, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "black";
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
    }

    // Collision detection
    if (
      obj.y + obj.height >= player.y &&
      obj.x < player.x + player.width &&
      obj.x + obj.width > player.x
    ) {
      if (obj.type === "good") {
        score++;
      } else {
        missed += 2; // 💣 counts as 2 misses
      }
      objects.splice(i, 1);
      i--;
      updateScore();
    } else if (obj.y > canvas.height) {
      if (obj.type === "good") missed++;
      objects.splice(i, 1);
      i--;
      updateScore();
      if (missed >= 5) {
        endGame();
      }
    }
  }

  requestAnimationFrame(gameLoop);
}

// End game
function endGame() {
  gameOver = true;

  // Update high score
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("catchHighScore", highScore);
  }

  ctx.fillStyle = "black";
  ctx.font = "24px Arial";
  ctx.fillText("Game Over! 😢", canvas.width / 2 - 70, canvas.height / 2);
  ctx.fillText(`Final Score: ${score}`, canvas.width / 2 - 70, canvas.height / 2 + 30);

  restartBtn.style.display = "block"; // Show restart button
}

// Restart button listener
restartBtn.addEventListener("click", resetGame);

// Start the game
resetGame();
