/**
 * Game Configuration Constants
 * Centralized constants for the Heidelberg RPG game
 * @module config
 */

export const CONFIG = {
    // Scene identifier
    SCENE_NAME: 'marktplatz',

    // Screen dimensions (Game Boy style)
    SCREEN: {
        W: 320,
        H: 240
    },

    // Player configuration
    PLAYER: {
        SPEED: 35,
        COLLISION_BOX: { W: 8, H: 6 },
        FOOT_OFFSET_Y: 15,
        BASE_SCALE: 0.15
    },

    // Particle system configuration
    PARTICLE: {
        COUNT: 300,
        MAGNET_RANGE: 200,
        RUBBER_BAND_RANGE: 150,
        MAX_SPEED: 0.375,
        COLLISION_RADIUS: 8
    },

    // Lore trigger configuration
    LORE: {
        TRIGGER_DIST: 6,
        EXIT_DIST: 25
    },

    // Sprite configuration
    SPRITE: {
        COLS: 4,
        BASE_SCALE: 0.15,
        FRAME_WIDTH: 128,
        FRAME_HEIGHT: 128
    },

    // Animation cycles
    ANIMATION: {
        FRONT_CYCLE: [0, 1, 2, 3, 2, 1],
        BACK_CYCLE: [0, 1, 2, 1],
        SIDE_CYCLE: [0, 1, 2, 3, 2, 1]
    },

    // Audio volumes
    AUDIO: {
        FOOTSTEP_VOLUME: 0.02,
        SHIMMER_VOLUME: 0.4,
        AMBIENT_VOLUME: 0.02,
        MAIN_VOLUME: 1.0
    },

    // Cloud system
    CLOUD: {
        MAX_COUNT: 3,
        MIN_SIZE: 100,
        MAX_SIZE: 250,
        MIN_SPEED: 0.15,
        MAX_SPEED: 0.25,
        ALPHA: 0.5,
        BLUR: 25
    },

    // Debug panel toggle key
    DEBUG_KEY: 'KeyD'
};

// Default export for non-ES6 usage
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
