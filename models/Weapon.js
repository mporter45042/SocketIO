const Item = require('./Item');

class Weapon extends Item {
    constructor(id, weaponType, name) {
        super(id, 'weapon', name);
        this.equipable = true;
        this.weaponType = weaponType; // 'pistol', 'rifle', 'shotgun', etc.
        this.projectileCapacity = 10; // Maximum ammo in weapon
        this.currentAmmo = 10; // Current ammo in weapon
        this.reserveCapacity = 120; // Maximum reserve ammo
        this.reserveAmmo = 120; // Current reserve ammo (start with full reserves for testing)
        this.projectileType = 'bullet';
        this.reloadTime = 2000; // milliseconds
        this.fireRate = 300; // milliseconds between shots
        this.lastFired = 0;
        this.reloading = false;
        this.reloadStartTime = 0;
        this.damage = 10;
        this.range = 1500;
        this.projectileSpeed = 1200; 
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
        if (this.reloading || 
            this.currentAmmo >= this.projectileCapacity || 
            this.reserveAmmo <= 0) {
            return false;
        }
        this.reloading = true;
        this.reloadStartTime = Date.now();
        return true;
    }
    
    updateReload() {
        if (!this.reloading) return;
        const now = Date.now();
        if (now - this.reloadStartTime >= this.reloadTime) {
            // Calculate how much ammo is needed to fill the weapon
            const ammoNeeded = this.projectileCapacity - this.currentAmmo;
            // Take from reserves, but only what's available and needed
            const ammoToTransfer = Math.min(ammoNeeded, this.reserveAmmo);
            
            // Transfer ammo from reserves to current ammo
            this.currentAmmo += ammoToTransfer;
            this.reserveAmmo -= ammoToTransfer;
            
            this.reloading = false;
        }
    }
    
    // Add method to check if reload is possible
    canReload() {
        return !this.reloading && 
               this.currentAmmo < this.projectileCapacity && 
               this.reserveAmmo > 0;
    }
    
    // Add method to get ammo status
    getAmmoStatus() {
        return {
            current: this.currentAmmo,
            capacity: this.projectileCapacity,
            reserve: this.reserveAmmo,
            reserveCapacity: this.reserveCapacity,
            reloading: this.reloading
        };
    }
}

module.exports = Weapon;