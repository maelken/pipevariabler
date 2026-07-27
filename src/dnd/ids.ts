// Draggable/droppable ID scheme for the root DragDropProvider.
//
//   number                  chest sortable (the chest's id)
//   "sidebar-*" / uuid      item instance (the item's uid)
//   "chest-<id>"            chest body drop zone
//   "tab-drop-<id>"         fixed overlay zone above a tab button
//   "add-chest-drop-zone"   the "Tilføj kiste" zone
//
// Item uids never collide with the prefixed zones: sidebar uids are
// "sidebar-<name>-<n>" and chest item uids are crypto.randomUUID().
// (The nested provider in TabBar uses its own "tab-<id>" sortable ids.)

export type DndId = string | number;

export const ADD_CHEST_ZONE_ID = 'add-chest-drop-zone';

export const chestZoneId = (chestId: number) => `chest-${chestId}`;
export const tabZoneId = (tabId: number) => `tab-drop-${tabId}`;
export const tabSortableId = (tabId: number) => `tab-${tabId}`;

/** DOM id of a tab's button - TabDropOverlay aligns its drop zones to these */
export const tabButtonId = (tabId: number) => `tab-btn-${tabId}`;

/** A number draggable/droppable is always a chest sortable */
export const isChestDragId = (id: DndId | undefined | null): id is number =>
    typeof id === 'number';

export type DropTarget =
    | { kind: 'chest-sortable'; chestId: number }
    | { kind: 'chest-zone'; chestId: number }
    | { kind: 'tab-zone'; tabId: number }
    | { kind: 'add-chest-zone' }
    | { kind: 'item'; uid: string };

export const classifyDropTarget = (id: DndId): DropTarget => {
    if (typeof id === 'number') return { kind: 'chest-sortable', chestId: id };
    if (id === ADD_CHEST_ZONE_ID) return { kind: 'add-chest-zone' };
    if (id.startsWith('tab-drop-')) {
        return { kind: 'tab-zone', tabId: Number.parseInt(id.slice('tab-drop-'.length), 10) };
    }
    if (/^chest-\d+$/.test(id)) {
        return { kind: 'chest-zone', chestId: Number.parseInt(id.slice('chest-'.length), 10) };
    }
    return { kind: 'item', uid: id };
};

export const assertNever = (value: never): never => {
    throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
};
