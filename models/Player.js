const { Matter } = require('../physics');
const Weapon = require('./Weapon');
const Projectile = require('./Projectile');

class Player {
    constructor(id, name, world) {
        this.id = id; // socket.id
        this.name = name || `Player_${id.substring(0, 4)}`;
        // Randomly assign a starting skin
        const availableSkins = ['player.png', 'player2.png', 'player3.png'];
        this.skin = availableSkins[Math.floor(Math.random() * availableSkins.length)];
        this.health = 100;
        this.maxHealth = 100;
        this.x = Math.random() * 700 + 50; // spawn within bounds
        this.y = Math.random() * 500 + 50;
        this.angle = 0;
        this.score = 0;
        this.eliminations = 0;
        this.damageDealt = 0;
        // Inventory system
        this.inventory = [];
        this.maxInventorySlots = 6;
        this.equippedWeapon = null;
        // Create a Matter.js body for the player
        this.body = Matter.Bodies.circle(this.x, this.y, 32, { frictionAir: 0.18, label: 'player' });
        Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        Matter.World.add(world, this.body);
        
        // Give player a starting weapon
        this.giveStartingWeapon();
    }
    
    giveStartingWeapon() {
        const startingWeapon = new Weapon(`weapon_${this.id}_starter`, 'pistol', 'Basic Pistol');
        startingWeapon.location = 'player';
        startingWeapon.ownerId = this.id;
        this.addToInventory(startingWeapon);
        this.equipWeapon(startingWeapon.id);
    }
    
    addToInventory(item) {
        if (this.inventory.length >= this.maxInventorySlots) return false;
        item.location = 'player';
        item.ownerId = this.id;
        this.inventory.push(item);
        return true;
    }
    
    removeFromInventory(itemId) {
        const index = this.inventory.findIndex(item => item.id === itemId);
        if (index === -1) return null;
        const item = this.inventory.splice(index, 1)[0];
        if (this.equippedWeapon && this.equippedWeapon.id === itemId) {
            this.equippedWeapon = null;
        }
        return item;
    }
    
    equipWeapon(weaponId) {
        const weapon = this.inventory.find(item => item.id === weaponId && item.type === 'weapon');
        if (!weapon) return false;
        this.equippedWeapon = weapon;
        return true;
    }
    
    canFire() {
        return this.equippedWeapon && this.equippedWeapon.canFire();
    }
    
    fire() {
        if (!this.canFire()) return null;
        if (!this.equippedWeapon.fire()) return null;
        
        // Create projectile
        const projectileId = `proj_${Date.now()}_${Math.random()}`;
        const startX = this.x + Math.cos(this.angle) * 35; // Start slightly in front of player
        const startY = this.y + Math.sin(this.angle) * 35;
        
        return new Projectile(
            projectileId,
            this.equippedWeapon.projectileType,
            startX,
            startY,
            this.angle,
            this.equippedWeapon.projectileSpeed,
            this.equippedWeapon.damage,
            this.equippedWeapon.range,
            this.id
        );
    }
    
    updateWeapons() {
        if (this.equippedWeapon) {
            this.equippedWeapon.updateReload();
        }
    }
    
    syncFromBody() {
        this.x = this.body.position.x;
        this.y = this.body.position.y;
    }
    
    removeBody() {
        Matter.World.remove(require('../physics').world, this.body);
    }
    
    setSkin(skinName) {
        // Validate skin name to prevent path traversal
        const validSkins = ['player.png', 'player2.png', 'player3.png'];
        if (validSkins.includes(skinName)) {
            this.skin = skinName;
            return true;
        }
        return false;
    }
}

module.exports = Player;