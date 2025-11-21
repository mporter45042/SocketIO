const Item = require('./Item');

class Weapon extends Item {
    constructor(id, weaponType, name) {
        super(id, 'weapon', name);
        this.equipable = true;
        this.weaponType = weaponType; // 'pistol', 'rifle', 'shotgun', etc.
        this.projectileCapacity = 10;
        this.currentAmmo = 10;
        this.projectileType = 'bullet';
        this.reloadTime = 2000; // milliseconds
        this.fireRate = 300; // milliseconds between shots
        this.lastFired = 0;
        this.reloading = false;
        this.reloadStartTime = 0;
        this.damage = 10;
        this.range = 800;
        this.projectileSpeed = 800; // Doubled from 400
    }
    
    canFire() {
        const now = Date.now();
        return !this.reloading && 
               this.currentAmmo > 0 && 
               (now - this.lastFired) >= this.fireRate;
    }
    
    fire() {
        if (!this.canFire()) return false;
        this.currentAmmo--;
        this.lastFired = Date.now();
        return true;
    }
    
    startReload() {
        if (this.reloading || this.currentAmmo >= this.projectileCapacity) return false;
        this.reloading = true;
        this.reloadStartTime = Date.now();
        return true;
    }
    
    updateReload() {
        if (!this.reloading) return;
        const now = Date.now();
        if (now - this.reloadStartTime >= this.reloadTime) {
            this.currentAmmo = this.projectileCapacity;
            this.reloading = false;
        }
    }
}

module.exports = Weapon;