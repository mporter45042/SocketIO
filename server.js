// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public
app.use(express.static('public'));

//Constants
const maxSpeed = 30;
const accel = 8;
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;

// Physics engine
const { Matter, engine, world } = require('./physics');

// Import game classes
const Player = require('./models/Player');
const Weapon = require('./models/Weapon');
const Projectile = require('./models/Projectile');
const Item = require('./models/Item');

// Game state and lobby management (stub)
const lobbies = {}; // For future use

const players = {}; // { [id]: Player }
const projectiles = {}; // { [id]: Projectile }
const groundItems = {}; // { [id]: Item } - items on the ground

// Store input states and last processed input sequence
const playerInputs = {}; // { [id]: input }
const playerInputSeq = {}; // { [id]: last seq }

//serialize player data for sending to clients
function serializePlayer(player) {
    return {
        id: player.id,
        name: player.name,
        health: player.health,
        maxHealth: player.maxHealth,
        x: player.x,
        y: player.y,
        angle: player.angle,
        eliminations: player.eliminations,
        damageDealt: player.damageDealt,
        equippedWeapon: player.equippedWeapon ? {
            id: player.equippedWeapon.id,
            name: player.equippedWeapon.name,
            weaponType: player.equippedWeapon.weaponType,
            currentAmmo: player.equippedWeapon.currentAmmo,
            projectileCapacity: player.equippedWeapon.projectileCapacity,
            reserveAmmo: player.equippedWeapon.reserveAmmo,
            reserveCapacity: player.equippedWeapon.reserveCapacity,
            reloading: player.equippedWeapon.reloading
        } : null
    };
}

function serializeProjectile(projectile) {
    return {
        id: projectile.id,
        type: projectile.type,
        x: projectile.x,
        y: projectile.y,
        angle: projectile.angle,
        ownerId: projectile.ownerId
    };
}

// Main game loop
function gameLoop() {
    const deltaTime = 1000 / 60; // 16.67ms
    
    // Process player input and movement
    for (const id in players) {
        const input = playerInputs[id];
        const player = players[id];
        if (input && player && player.body) {
            // Update authoritative angle from input every frame
            if (typeof input.angle === 'number') {
                player.angle = input.angle;
            }
            
            // Handle shooting
            if (input.mouse && input.mouse.down && player.canFire()) {
                const projectile = player.fire();
                if (projectile) {
                    projectiles[projectile.id] = projectile;
                }
            }
            
            // Handle movement
            let ax = 0, ay = 0;
            if (input.up) ay -= accel;
            if (input.down) ay += accel;
            if (input.left) ax -= accel;
            if (input.right) ax += accel;
            // Apply force for acceleration only if input
            if (ax !== 0 || ay !== 0) {
                Matter.Body.applyForce(player.body, player.body.position, { x: ax * 0.001, y: ay * 0.001 });
            }
            // Clamp velocity
            let vx = player.body.velocity.x;
            let vy = player.body.velocity.y;
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed > maxSpeed) {
                vx = (vx / speed) * maxSpeed;
                vy = (vy / speed) * maxSpeed;
                Matter.Body.setVelocity(player.body, { x: vx, y: vy });
            }
            
            // Update weapons
            player.updateWeapons();
        }
    }
    
    // Update projectiles
    for (const id in projectiles) {
        const projectile = projectiles[id];
        projectile.update(deltaTime);
        
        // Check if projectile is out of bounds or inactive
        if (!projectile.active || 
            projectile.x < 0 || projectile.x > MAP_WIDTH ||
            projectile.y < 0 || projectile.y > MAP_HEIGHT) {
            delete projectiles[id];
            continue;
        }
        
        // Check projectile collisions with players
        for (const playerId in players) {
            if (playerId === projectile.ownerId) continue; // Don't hit yourself
            
            const player = players[playerId];
            const dx = projectile.x - player.x;
            const dy = projectile.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 32) { // Player radius
                // Hit!
                player.health -= projectile.damage;
                if (player.health <= 0) {
                    player.health = 0;
                    // Handle player death here
                }
                projectile.active = false;
                delete projectiles[id];
                break;
            }
        }
    }

    // Step the physics engine
    Matter.Engine.update(engine, deltaTime);
    
    // Sync player objects from their Matter bodies and enforce map boundaries
    for (const id in players) {
        players[id].syncFromBody();
        
        // Enforce map boundaries for players
        const player = players[id];
        let needsCorrection = false;
        let newX = player.x;
        let newY = player.y;
        
        // Check and correct X boundaries
        if (player.x < 32) { // Player radius is 32
            newX = 32;
            needsCorrection = true;
        } else if (player.x > MAP_WIDTH - 32) {
            newX = MAP_WIDTH - 32;
            needsCorrection = true;
        }
        
        // Check and correct Y boundaries
        if (player.y < 32) {
            newY = 32;
            needsCorrection = true;
        } else if (player.y > MAP_HEIGHT - 32) {
            newY = MAP_HEIGHT - 32;
            needsCorrection = true;
        }
        
        // Apply correction if needed
        if (needsCorrection) {
            Matter.Body.setPosition(player.body, { x: newX, y: newY });
            Matter.Body.setVelocity(player.body, { x: 0, y: 0 }); // Stop movement when hitting boundary
            player.x = newX;
            player.y = newY;
        }
    }

    // Broadcast updated game state to all clients
    const serializablePlayers = Object.values(players).map(serializePlayer);
    const serializableProjectiles = Object.values(projectiles).map(serializeProjectile);
    
    io.emit('gameStateUpdate', {
        players: serializablePlayers,
        projectiles: serializableProjectiles
    });
    
    setTimeout(gameLoop, deltaTime);
}
gameLoop();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    // Create new player
    const player = new Player(socket.id, null, world);
    players[socket.id] = player;

    // Receive input from client
    socket.on('input', (input) => {
        playerInputs[socket.id] = input;
        if (typeof input.seq === 'number') {
            playerInputSeq[socket.id] = input.seq;
        }
    });
    
    socket.on('reload', () => {
        const player = players[socket.id];
        if (player && player.equippedWeapon) {
            player.equippedWeapon.startReload();
        }
    });

    // Notify all clients of new player list (serialize data)
    const serializablePlayers = Object.values(players).map(serializePlayer);
    io.emit('playersUpdate', serializablePlayers);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (players[socket.id]) players[socket.id].removeBody();
        delete players[socket.id];
        // Notify all clients of updated player list (serialize data)
        const serializablePlayers = Object.values(players).map(serializePlayer);
        io.emit('playersUpdate', serializablePlayers);
    });
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
