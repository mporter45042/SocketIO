class Projectile {
    constructor(id, type, startX, startY, angle, speed, damage, range, ownerId) {
        this.id = id;
        this.type = type;
        this.x = startX;
        this.y = startY;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.range = range;
        this.ownerId = ownerId;
        this.distanceTraveled = 0;
        this.active = true;
        this.createdAt = Date.now();
    }
    
    update(deltaTime) {
        if (!this.active) return;
        
        const distance = this.speed * (deltaTime / 1000);
        this.x += Math.cos(this.angle) * distance;
        this.y += Math.sin(this.angle) * distance;
        this.distanceTraveled += distance;
        
        if (this.distanceTraveled >= this.range) {
            this.active = false;
        }
    }
}

module.exports = Projectile;