/**
 * Application-wide constants
 * Centralized magic numbers and configuration values
 */

// Drag & Drop
export const DRAG_ACTIVATION_DISTANCE = 3; // pixels before drag activates

// Animation & Feedback Durations (in milliseconds)
export const COPY_FEEDBACK_DURATION = 1500;
export const TAB_SWITCH_DELAY = 500;
export const CHEST_HIGHLIGHT_DURATION = 1500;
export const ITEM_HIGHLIGHT_DURATION = 2000;

// Scroll Timing (in milliseconds)
export const SCROLL_DELAY = 100;
export const ITEM_SCROLL_DELAY = 150;

// Auto-scroll Configuration
export const AUTO_SCROLL_ACCELERATION = 25;
export const AUTO_SCROLL_THRESHOLD = 0.1;

// Layout
export const SIDEBAR_HEIGHT_OFFSET = 250; // pixels subtracted from window height

// CraftBook variabler fra maelk.net Google Sheet
export const VARIABLER_BASE_URL = 'https://variabler.maelk.net';
export const VARIABLER_DATA_JSON_URL = `${VARIABLER_BASE_URL}/data.json`;
export const VARIABLER_CSV_URL = `${VARIABLER_BASE_URL}/export?format=csv`;
