const socket = io();

// Game state (stub)
let gameState = {};

// Player management
let localPlayer = null;
let otherPlayers = [];
let projectiles = []; // Track projectiles
let predictedProjectiles = []; // Client-side predicted projectiles

// For client-side prediction and reconciliation
let predictedLocalPlayer = null;
let predictedBody = null;
let inputSequence = 0;
let pendingInputs = []; // {seq, input}

//Constants
const maxSpeed = 50;
const accel = 12.5;

// Input handling (stub)
const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    mouse: { x: 0, y: 0, down: false },
    angle: 0 // radians, direction player is facing
};

const keyMap = {
    'w': 'up',
    'a': 'left',
    's': 'down',
    'd': 'right',
    'ArrowUp': 'up',
    'ArrowLeft': 'left',
    'ArrowDown': 'down',
    'ArrowRight': 'right',
};

function sendInput() {
    inputSequence++;
    const inputCopy = { ...input, seq: inputSequence };
    pendingInputs.push(inputCopy);
    socket.emit('input', inputCopy);
}

document.addEventListener('keydown', (e) => {
    // Handle reload key
    if (e.key.toLowerCase() === 'r') {
        socket.emit('reload');
        return;
    }
    
    // Handle skin change keys (1, 2, 3)
    if (e.key >= '1' && e.key <= '3') {
        const skinIndex = parseInt(e.key) - 1;
        const skinName = availableSkins[skinIndex];
        if (skinName) {
            socket.emit('changeSkin', skinName);
        }
        return;
    }
    
    // Handle movement keys
    const key = e.key.toLowerCase();
    if (keyMap[key] && !input[keyMap[key]]) {
        input[keyMap[key]] = true;
        sendInput();
    }
});
document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keyMap[key] && input[keyMap[key]]) {
        input[keyMap[key]] = false;
        sendInput();
    }
});
document.addEventListener('mousemove', (e) => {
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    input.mouse.x = mouseX;
    input.mouse.y = mouseY;
    // Calculate angle from center of canvas to mouse
    const dx = mouseX - CENTER_X;
    const dy = mouseY - CENTER_Y;
    input.angle = Math.atan2(dy, dx);
    // Send input for angle updates (important for accurate shooting)
    sendInput();
});
document.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        input.mouse.down = true;
        sendInput();
        
        // Client-side projectile prediction for immediate visual feedback
        if (localPlayer && localPlayer.equippedWeapon && localPlayer.equippedWeapon.currentAmmo > 0) {
            const now = Date.now();
            const weapon = localPlayer.equippedWeapon;
            if (!weapon.reloading && 
                weapon.currentAmmo > 0 && 
                (!weapon.lastPredictedFire || (now - weapon.lastPredictedFire) >= weapon.fireRate)) {
                
                weapon.lastPredictedFire = now;
                const startX = (predictedBody ? predictedBody.position.x : localPlayer.x) + Math.cos(input.angle) * 35;
                const startY = (predictedBody ? predictedBody.position.y : localPlayer.y) + Math.sin(input.angle) * 35;
                
                const predictedProjectile = {
                    id: `predicted_${now}_${Math.random()}`,
                    x: startX,
                    y: startY,
                    angle: input.angle,
                    speed: 800, // Match server projectile speed
                    startTime: now,
                    predicted: true
                };
                
                predictedProjectiles.push(predictedProjectile);
            }
        }
    }
});
document.addEventListener('mouseup', (e) => {
    if (e.button === 0) { // Left click
        input.mouse.down = false;
        sendInput();
    }
});


// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dynamic canvas sizing
let WORLD_WIDTH = window.innerWidth;
let WORLD_HEIGHT = window.innerHeight;
let CENTER_X = WORLD_WIDTH / 2;
let CENTER_Y = WORLD_HEIGHT / 2;

// Set initial canvas size
function resizeCanvas() {
    WORLD_WIDTH = window.innerWidth;
    WORLD_HEIGHT = window.innerHeight;
    CENTER_X = WORLD_WIDTH / 2;
    CENTER_Y = WORLD_HEIGHT / 2;
    
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;
}

// Initialize canvas size
resizeCanvas();

// Handle window resize
window.addEventListener('resize', resizeCanvas);

const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

function drawMapBoundaries(playerX, playerY) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,150,0.8)'; // Gray walls
    ctx.fillStyle = 'rgba(100,100,100,0.3)'; // Slightly transparent fill
    ctx.lineWidth = 8;
    
    // Calculate boundary positions relative to player
    const leftBoundary = CENTER_X + (0 - playerX);
    const rightBoundary = CENTER_X + (MAP_WIDTH - playerX);
    const topBoundary = CENTER_Y + (0 - playerY);
    const bottomBoundary = CENTER_Y + (MAP_HEIGHT - playerY);
    
    // Draw boundaries if they're visible on screen
    const margin = 100; // Draw boundaries even slightly off-screen
    
    // Left wall
    if (leftBoundary > -margin && leftBoundary < WORLD_WIDTH + margin) {
        ctx.fillRect(leftBoundary - 4, -margin, 8, WORLD_HEIGHT + margin * 2);
        ctx.strokeRect(leftBoundary - 4, -margin, 8, WORLD_HEIGHT + margin * 2);
    }
    
    // Right wall
    if (rightBoundary > -margin && rightBoundary < WORLD_WIDTH + margin) {
        ctx.fillRect(rightBoundary - 4, -margin, 8, WORLD_HEIGHT + margin * 2);
        ctx.strokeRect(rightBoundary - 4, -margin, 8, WORLD_HEIGHT + margin * 2);
    }
    
    // Top wall
    if (topBoundary > -margin && topBoundary < WORLD_HEIGHT + margin) {
        ctx.fillRect(-margin, topBoundary - 4, WORLD_WIDTH + margin * 2, 8);
        ctx.strokeRect(-margin, topBoundary - 4, WORLD_WIDTH + margin * 2, 8);
    }
    
    // Bottom wall
    if (bottomBoundary > -margin && bottomBoundary < WORLD_HEIGHT + margin) {
        ctx.fillRect(-margin, bottomBoundary - 4, WORLD_WIDTH + margin * 2, 8);
        ctx.strokeRect(-margin, bottomBoundary - 4, WORLD_WIDTH + margin * 2, 8);
    }
    
    ctx.restore();
}

function drawGrid(playerX, playerY) {
    ctx.save();
    ctx.strokeStyle = 'rgba(200,200,200,0.15)';
    ctx.lineWidth = 1;
    const gridSize = 64;
    // Offset so grid scrolls with player
    const offsetX = (playerX % gridSize);
    const offsetY = (playerY % gridSize);
    
    // Draw grid lines across the full dynamic canvas
    for (let x = -gridSize; x < WORLD_WIDTH + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - offsetX, 0);
        ctx.lineTo(x - offsetX, WORLD_HEIGHT);
        ctx.stroke();
    }
    for (let y = -gridSize; y < WORLD_HEIGHT + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - offsetY);
        ctx.lineTo(WORLD_WIDTH, y - offsetY);
        ctx.stroke();
    }
    ctx.restore();
}


// Player image cache system
const playerImages = {};
const availableSkins = ['player.png', 'player2.png', 'player3.png'];

// Load all available skins
availableSkins.forEach(skin => {
    const img = new Image();
    img.src = skin;
    playerImages[skin] = img;
});

function isImageLoaded(img) {
    return img.complete && img.naturalHeight !== 0;
}

function getPlayerImage(skinName) {
    return playerImages[skinName] || playerImages['player.png'];
}

function drawProjectiles(worldPlayerX, worldPlayerY) {
    ctx.save();
    
    // Draw server projectiles
    ctx.fillStyle = '#ffff00'; // Yellow bullets
    projectiles.forEach(p => {
        const screenX = CENTER_X + (p.x - worldPlayerX);
        const screenY = CENTER_Y + (p.y - worldPlayerY);
        ctx.beginPath();
        ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw predicted projectiles (slightly different color)
    ctx.fillStyle = '#ffaa00'; // Orange predicted bullets
    const now = Date.now();
    predictedProjectiles.forEach(p => {
        const timeDelta = (now - p.startTime) / 1000;
        const distance = p.speed * timeDelta;
        const currentX = p.x + Math.cos(p.angle) * distance;
        const currentY = p.y + Math.sin(p.angle) * distance;
        
        const screenX = CENTER_X + (currentX - worldPlayerX);
        const screenY = CENTER_Y + (currentY - worldPlayerY);
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    
    ctx.restore();
}

function drawPlayers() {
    // Wait for at least the default image to load
    if (!isImageLoaded(playerImages['player.png'])) return;
    const size = 64; // 64x64 pixels
    const half = size / 2;
    // Centered player position
    let playerX = CENTER_X, playerY = CENTER_Y;
    let worldPlayerX = null, worldPlayerY = null, playerAngle = 0;
    if (predictedBody) {
        worldPlayerX = predictedBody.position.x;
        worldPlayerY = predictedBody.position.y;
        // Use input.angle for local player rotation
        playerAngle = input.angle;
    } else if (localPlayer) {
        worldPlayerX = localPlayer.x;
        worldPlayerY = localPlayer.y;
        playerAngle = input.angle;
    }
    // Draw grid first
    if (worldPlayerX !== null && worldPlayerY !== null) {
        drawGrid(worldPlayerX, worldPlayerY);
        drawMapBoundaries(worldPlayerX, worldPlayerY);
        drawProjectiles(worldPlayerX, worldPlayerY);
    }
    // Draw other players
    otherPlayers.forEach(p => {
        const img = getPlayerImage(p.skin);
        if (!isImageLoaded(img)) return; // Skip if skin not loaded yet
        
        ctx.save();
        // Offset other players relative to centered player
        ctx.translate(CENTER_X + (p.x - worldPlayerX), CENTER_Y + (p.y - worldPlayerY));
        // Use the angle provided by the server for each player
        ctx.rotate(p.angle || 0);
        ctx.drawImage(img, -half, -half, size, size);
        ctx.restore();
    });
    // Draw local player always at center
    if (localPlayer) {
        const img = getPlayerImage(localPlayer.skin);
        if (isImageLoaded(img)) {
            ctx.save();
            ctx.translate(CENTER_X, CENTER_Y);
            ctx.rotate(playerAngle);
            ctx.drawImage(img, -half, -half, size, size);
            ctx.restore();
        }
    }
}

function drawAmmoUI() {
    if (!localPlayer || !localPlayer.equippedWeapon) return;
    
    const weapon = localPlayer.equippedWeapon;
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.font = '16px Arial';
    
    // Position UI in bottom right corner
    const x = WORLD_WIDTH - 150;
    const y = WORLD_HEIGHT - 80;
    
    // Current ammo / capacity
    const ammoText = `${weapon.currentAmmo} / ${weapon.projectileCapacity}`;
    ctx.strokeText(ammoText, x, y);
    ctx.fillText(ammoText, x, y);
    
    // Reserve ammo
    const reserveText = `Reserve: ${weapon.reserveAmmo}`;
    ctx.strokeText(reserveText, x, y + 20);
    ctx.fillText(reserveText, x, y + 20);
    
    // Reload status
    if (weapon.reloading) {
        ctx.fillStyle = 'yellow';
        const reloadText = 'RELOADING...';
        ctx.strokeText(reloadText, x, y + 40);
        ctx.fillText(reloadText, x, y + 40);
    } else if (weapon.currentAmmo === 0) {
        ctx.fillStyle = 'red';
        const emptyText = 'PRESS R TO RELOAD';
        ctx.strokeText(emptyText, x, y + 40);
        ctx.fillText(emptyText, x, y + 40);
    }
    
    // Skin info
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    const skinText = `Skin: ${localPlayer.skin}`;
    ctx.strokeText(skinText, x, y + 60);
    ctx.fillText(skinText, x, y + 60);
    
    ctx.restore();
}

function drawControls() {
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';
    
    // Position controls in top left corner
    const x = 10;
    let y = 30;
    
    const controls = [
        'WASD: Move',
        'Mouse: Aim',
        'Click: Shoot',
        'R: Reload',
        '1-3: Change Skin'
    ];
    
    controls.forEach(control => {
        ctx.strokeText(control, x, y);
        ctx.fillText(control, x, y);
        y += 15;
    });
    
    ctx.restore();
}


function applyInputToBody(body, inputObj) {
    let vx = 0, vy = 0;
    if (inputObj.up) vy -= accel;
    if (inputObj.down) vy += accel;
    if (inputObj.left) vx -= accel;
    if (inputObj.right) vx += accel;
    if (vx !== 0 || vy !== 0) {
        Matter.Body.applyForce(body, body.position, { x: vx * 0.001, y: vy * 0.001 });
    }
    // Clamp velocity
    vx = body.velocity.x;
    vy = body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
        vx = (vx / speed) * maxSpeed;
        vy = (vy / speed) * maxSpeed;
        Matter.Body.setVelocity(body, { x: vx, y: vy });
    }
}

function predictLocalPlayerMovement() {
    if (!predictedBody) return;
    applyInputToBody(predictedBody, input);
    Matter.Engine.update(predictedEngine, 1000 / 60);
}

// Setup Matter.js for prediction
let predictedEngine = Matter.Engine.create();
predictedEngine.gravity.y = 0;
predictedEngine.gravity.x = 0;
function setupPredictedBody(x, y) {
    // Remove old body if it exists
    if (predictedBody) {
        Matter.World.remove(predictedEngine.world, predictedBody);
    }
    // Ensure gravity is always zero
    predictedEngine.gravity.y = 0;
    predictedEngine.gravity.x = 0;
    predictedBody = Matter.Bodies.circle(x, y, 32, { frictionAir: 0.18, label: 'player' });
    Matter.Body.setVelocity(predictedBody, { x: 0, y: 0 });
    Matter.World.add(predictedEngine.world, predictedBody);
}

function gameLoop() {
    predictLocalPlayerMovement();
    
    // Clean up old predicted projectiles (remove after 2 seconds)
    const now = Date.now();
    predictedProjectiles = predictedProjectiles.filter(p => (now - p.startTime) < 2000);
    
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawPlayers();
    drawAmmoUI();
    drawControls();
    requestAnimationFrame(gameLoop);
}

if (isImageLoaded(playerImages['player.png'])) {
    gameLoop();
} else {
    playerImages['player.png'].onload = () => gameLoop();
}

// Socket events (stub)
socket.on('connect', () => {
    console.log('Connected to server');
    // TODO: Join lobby
});

// Handle game state updates (players and projectiles)
socket.on('gameStateUpdate', (data) => {
    const players = data.players || [];
    projectiles = data.projectiles || [];
    
    // Clean up predicted projectiles that might match server projectiles
    // (Simple approach: remove predicted projectiles older than 100ms when server data comes in)
    const now = Date.now();
    predictedProjectiles = predictedProjectiles.filter(p => (now - p.startTime) < 100);
    
    // Find this client's player
    const serverPlayer = players.find(p => p.id === socket.id) || null;
    // All other players
    otherPlayers = players.filter(p => p.id !== socket.id);

    // Reconciliation: if we have a predicted player and serverPlayer, correct and replay
    if (predictedBody && serverPlayer) {
        // Set to authoritative server position
        Matter.Body.setPosition(predictedBody, { x: serverPlayer.x, y: serverPlayer.y });
        Matter.Body.setVelocity(predictedBody, { x: 0, y: 0 });
        
        // Remove all confirmed inputs (simplified for weapon system)
        pendingInputs = [];
        
        // Copy other properties
        if (!predictedLocalPlayer) predictedLocalPlayer = {};
        predictedLocalPlayer.health = serverPlayer.health;
        predictedLocalPlayer.maxHealth = serverPlayer.maxHealth;
        predictedLocalPlayer.angle = serverPlayer.angle;
        predictedLocalPlayer.score = serverPlayer.score;
        predictedLocalPlayer.equippedWeapon = serverPlayer.equippedWeapon;
    } else if (serverPlayer) {
        predictedLocalPlayer = { ...serverPlayer };
        setupPredictedBody(serverPlayer.x, serverPlayer.y);
    }
    localPlayer = serverPlayer;
});
