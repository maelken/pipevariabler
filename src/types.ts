// Shared domain types - single source of truth

export type Item = {
    /** Unique instance id (sidebar items are deterministic, chest items are random) */
    uid: string;
    /** Minecraft item name, e.g. "oak_planks" */
    item: string;
    /** Pipe variable written into the /signedit command */
    variable: string;
    /** Icon filename, e.g. "oak_planks.png" */
    image: string;
};

export type Chest = {
    id: number;
    label: string;
    items: Item[];
    icon: string;
    checked: boolean;
};

export type Tab = {
    id: number;
    name: string;
    chests: Chest[];
};

/** Grid row height for chests - 'unlimited' grows with content */
export type ChestHeight = 'small' | 'medium' | 'tall' | 'unlimited';
