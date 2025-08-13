const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 350;
canvas.height = 400;

let score = 0;
let cookies = [];
let images = [];
let currentCookie = null;
let gameOver = false;

// Flash warning state
let warningFlash = false;
let lastFlashTime = 0;
let flashInterval = 500; // ms

// Non-cookie images
const backgroundImage = new Image();
backgroundImage.src = "./images/jar_back.png";
const overlayImage = new Image();
overlayImage.src = "./images/jar_back.png";

// Load and preload images
const cookiePaths = [
  "images/cookie01.png",
  "images/cookie02.png",
  "images/cookie03.png",
  "images/cookie04.png",
  "images/cookie05.png",
  "images/cookie06.png",
  "images/cookie07.png",
  "images/cookie08.png",
  "images/cookie09.png",
  "images/cookie10.png",
];

let totalImagesToLoad = cookiePaths.length + 2;
let imagesLoaded = 0;
// Get high scores from localStorage or initialize an empty array
let highScores = JSON.parse(localStorage.getItem('highScores')) || [];
const MAX_HIGH_SCORES = 3;

function checkAllImagesLoaded() {
  imagesLoaded++;
  if (imagesLoaded === totalImagesToLoad) {
    startGame();
  }
}

backgroundImage.onload = checkAllImagesLoaded;
overlayImage.onload = checkAllImagesLoaded;

cookiePaths.forEach((path, index) => {
  const img = new Image();
  img.onload = checkAllImagesLoaded;
  img.src = path;
  images[index] = img;
});

class Cookie {
  constructor(x, y, typeIndex, falling = false) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = falling ? 1 : 0;
    this.radius = 25 + typeIndex * 5;
    this.typeIndex = typeIndex;
    this.image = images[typeIndex] || new Image();
    this.merged = false;
    this.falling = falling;
    this.mass = this.radius * 0.5;
    this.isOnGround = false;
    this.dropTime = null;
  }

  draw() {
    ctx.drawImage(
      this.image,
      this.x - this.radius,
      this.y - this.radius,
      this.radius * 2,
      this.radius * 2
    );
  }

  update() {
    if (this.falling && !this.isOnGround) {
      this.vy += 0.3;
      this.x += this.vx;
      this.y += this.vy;

      if (this.x - this.radius < 0) {
        this.x = this.radius;
        this.vx *= -0.5;
      } else if (this.x + this.radius > canvas.width) {
        this.x = canvas.width - this.radius;
        this.vx *= -0.5;
      }

      if (this.y + this.radius > canvas.height) {
        this.y = canvas.height - this.radius;
        this.vy = 0;
        this.vx *= 0.7;
        if (Math.abs(this.vy) < 0.1) {
          this.isOnGround = true;
          this.vx = 0;
        }
      }
    }

    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.vx = 0;
    } else if (this.x + this.radius > canvas.width) {
      this.x = canvas.width - this.radius;
      this.vx = 0;
    }

    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = 0;
    }

    if (this.y + this.radius >= canvas.height) {
      this.y = canvas.height - this.radius;
      this.vy = 0;
      this.isOnGround = true;
      if (Math.abs(this.vx) < 0.05) this.vx = 0;
    }

    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;
  }
}

function spawnCookie() {
  const typeIndex = Math.floor(Math.random() * 2);
  currentCookie = new Cookie(canvas.width / 2, 30, typeIndex, false);
}

function dropCookie() {
  if (!currentCookie) return;
  currentCookie.falling = true;
  currentCookie.vy = 1;
  currentCookie.dropTime = Date.now();
  cookies.push(currentCookie);
  currentCookie = null;
}

function resolveCollisions() {
  const JITTER_THRESHOLD = 0.5;
  const REST_VELOCITY_THRESHOLD = 0.1;
  const DAMPING = 0.9;

  for (let i = 0; i < cookies.length; i++) {
    const c = cookies[i];
    c.isOnGround = false;
    for (let j = i + 1; j < cookies.length; j++) {
      const f1 = cookies[i];
      const f2 = cookies[j];

      if (
        !f1.falling &&
        f1.vx === 0 &&
        f1.vy === 0 &&
        !f2.falling &&
        f2.vx === 0 &&
        f2.vy === 0
      ) continue;

      const dx = f2.x - f1.x;
      const dy = f2.y - f1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = f1.radius + f2.radius;

      if (dist < minDist && dist > JITTER_THRESHOLD) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        if (overlap > JITTER_THRESHOLD) {
          f1.x -= (nx * overlap) / 2;
          f1.y -= (ny * overlap) / 2;
          f2.x += (nx * overlap) / 2;
          f2.y += (ny * overlap) / 2;
        }

        const vxRel = f2.vx - f1.vx;
        const vyRel = f2.vy - f1.vy;
        const velAlongNormal = vxRel * nx + vyRel * ny;

        if (velAlongNormal < 0) {
          const restitution = 0.2;
          const impulse =
            (-(1 + restitution) * velAlongNormal) / (f1.mass + f2.mass);
          const impulseX = impulse * nx;
          const impulseY = impulse * ny;

          f1.vx -= impulseX / f1.mass;
          f1.vy -= impulseY / f1.mass;
          f2.vx += impulseX / f2.mass;
          f2.vy += impulseY / f2.mass;
        }

        f1.vx *= DAMPING;
        f1.vy *= DAMPING;
        f2.vx *= DAMPING;
        f2.vy *= DAMPING;

        [f1, f2].forEach((f) => {
          if (Math.abs(f.vx) < REST_VELOCITY_THRESHOLD) f.vx = 0;
          if (Math.abs(f.vy) < REST_VELOCITY_THRESHOLD) f.vy = 0;
        });
      }
    }

    if (c.y + c.radius >= canvas.height - 1) {
      c.y = canvas.height - c.radius;
      c.vy = 0;
      c.vx *= 0.7;
      c.isOnGround = true;
      if (Math.abs(c.vx) < REST_VELOCITY_THRESHOLD) c.vx = 0;
    }
  }
}

function checkCollisions() {
  for (let i = 0; i < cookies.length; i++) {
    for (let j = i + 1; j < cookies.length; j++) {
      const f1 = cookies[i];
      const f2 = cookies[j];
      const dx = f1.x - f2.x;
      const dy = f1.y - f2.y;
      const dist = Math.hypot(dx, dy);

      if (
        dist < f1.radius + f2.radius &&
        f1.typeIndex === f2.typeIndex &&
        !f1.merged &&
        !f2.merged
      ) {
        let nextType = f1.typeIndex + 1;
        if (nextType >= images.length) nextType = 0;

        const newCookie = new Cookie(
          (f1.x + f2.x) / 2,
          (f1.y + f2.y) / 2,
          nextType,
          true
        );
        newCookie.vy = -1;
        cookies.push(newCookie);

        score += (nextType + 1) * 10;
        document.getElementById("score").textContent = score;

        f1.merged = true;
        f2.merged = true;
      }
    }
  }
  cookies = cookies.filter((cookie) => !cookie.merged);
}

function showGameOver() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "36px Fredoka One";
  ctx.textAlign = "center";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 20);

  document.getElementById("restartBtn").style.display = "block";

  // Save and display high scores
  saveHighScore(score);
  displayHighScores();
}

function gameLoop() {
  if (gameOver) {
    showGameOver();
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const jarYOffset = 70;
  const jarTopY = jarYOffset;
  ctx.drawImage(backgroundImage, 0, jarYOffset, canvas.width, canvas.height - jarYOffset);

  const now = Date.now();
  let warningNeeded = false;

  cookies.forEach((cookie) => {
    cookie.update();

    if (
      cookie.dropTime &&
      now - cookie.dropTime >= 5000 &&
      cookie.y - cookie.radius <= jarTopY
    ) {
      gameOver = true;
    }

    if (
      cookie.dropTime &&
      now - cookie.dropTime >= 3000 &&
      cookie.y - cookie.radius <= jarTopY + 20
    ) {
      warningNeeded = true;
    }
  });

  if (warningNeeded) {
    if (now - lastFlashTime >= flashInterval) {
      warningFlash = !warningFlash;
      lastFlashTime = now;
    }

    if (warningFlash) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
      ctx.fillRect(0, 0, canvas.width, jarTopY + 10);
    }
  }

  resolveCollisions();
  cookies.forEach((cookie) => cookie.draw());
  if (currentCookie) currentCookie.draw();

  checkCollisions();

  requestAnimationFrame(gameLoop);
}

function saveHighScore(newScore) {
  // Load existing scores or start with empty array
  let highScores = JSON.parse(localStorage.getItem('highScores')) || [];

  // Add the new score
  highScores.push(newScore);

  // Sort from highest to lowest
  highScores.sort((a, b) => b - a);

  // Keep only the top 3
  highScores = highScores.slice(0, 3);

  // Save back to localStorage
  localStorage.setItem('highScores', JSON.stringify(highScores));
}

function displayHighScores() {
  const highScoresList = document.getElementById('highScoresList');
  highScoresList.innerHTML = ''; // Clear previous list

  const highScores = JSON.parse(localStorage.getItem('highScores')) || [];

  for (let i = 0; i < 3; i++) {
    const li = document.createElement('li');
    if (highScores[i] !== undefined) {
      li.textContent = `${i + 1}. ${highScores[i]}`;
    } else {
      li.textContent = `${i + 1}. - - -`;
    }
    highScoresList.appendChild(li);
  }
}

window.onload = () => {
  displayHighScores(); // shows scores on load
};

canvas.addEventListener("mousemove", (e) => {
  if (gameOver || !currentCookie || currentCookie.falling) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  currentCookie.x = Math.max(
    currentCookie.radius,
    Math.min(canvas.width - currentCookie.radius, mouseX)
  );
});

canvas.addEventListener("click", () => {
  if (gameOver || !currentCookie || currentCookie.falling) return;
  dropCookie();
  setTimeout(spawnCookie, 500);
});

document.getElementById("restartBtn").addEventListener("click", () => {
  cookies = [];
  currentCookie = null;
  score = 0;
  gameOver = false;
  document.getElementById("score").textContent = "0";
  document.getElementById("restartBtn").style.display = "none";
  spawnCookie();
  gameLoop();
});

document.addEventListener('DOMContentLoaded', () => {
  const helpBubble = document.getElementById('helpBubble');
  const helpOverlay = document.getElementById('helpOverlay');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  helpBubble.addEventListener('click', () => {
    helpOverlay.style.display = 'flex';
  });

  closeHelpBtn.addEventListener('click', () => {
    helpOverlay.style.display = 'none';
  });
});

function startGame() {
  spawnCookie();
  gameLoop();
}

