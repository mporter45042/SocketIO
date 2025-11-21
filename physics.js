// This file will contain Matter.js setup and utility functions for the server-side physics engine.
// We'll use this to keep server.js clean and modular.

const Matter = require('matter-js');

// Create engine and world
const engine = Matter.Engine.create();
engine.gravity.y = 0;
engine.gravity.x = 0;
const world = engine.world;

// Export engine and world for use in server.js
module.exports = {
    Matter,
    engine,
    world
};
