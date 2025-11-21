// Base Item System
class Item {
    constructor(id, type, name) {
        this.id = id; // unique identifier
        this.type = type; // 'weapon', 'consumable', 'powerup', etc.
        this.name = name;
        this.equipable = false;
        this.stackable = false;
        this.maxStack = 1;
        this.location = null; // 'player', 'ground', 'chest'
        this.ownerId = null; // player/chest/etc ID if owned
        this.worldX = 0; // position if on ground
        this.worldY = 0;
    }
}

module.exports = Item;