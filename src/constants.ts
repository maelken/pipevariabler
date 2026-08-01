// Application-wide constants

// The /signedit command a chest's items compile into
export const CMD_PREFIX = '/signedit 3 ';
export const CMD_LIMIT = 256;

// Timings
export const TAB_SWITCH_DELAY_MS = 500;
export const COPY_FEEDBACK_MS = 1500;
export const CHEST_HIGHLIGHT_MS = 1500;
export const ITEM_HIGHLIGHT_MS = 2000;

// Undo history cap - each entry is a full deep clone of all tabs
export const MAX_UNDO_STEPS = 50;

export const STORAGE_KEYS = {
    tabs: 'pipeVariablerTabs',
    chestGridView: 'pipeVariablerChestGridView',
    sidebarGridView: 'pipeVariablerSidebarGridView',
    chestHeight: 'pipeVariablerChestHeight',
    backups: 'pipeVariablerBackups',
} as const;

/** Rolling profile backups kept in localStorage */
export const MAX_PROFILE_BACKUPS = 5;

import type { ChestHeight } from './types';

/**
 * grid-auto-rows value per chest height setting.
 * Sized so the list view shows a WHOLE number of item rows:
 * grid row = 146px chrome (margins, header, progress, zone padding) + 50px per row.
 */
export const CHEST_ROW_HEIGHT: Record<ChestHeight, string> = {
    small: '246px', // 2 rows
    medium: '296px', // 3 rows
    tall: '446px', // 6 rows
    unlimited: 'auto',
};

export const APP_VERSION = '3.4.3';
