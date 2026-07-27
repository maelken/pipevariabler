// Drag orchestration for the root DragDropProvider: what happens when a drag
// starts and where things land when it ends. Tab sorting is NOT handled here -
// TabBar runs its own nested provider for that.
import type { DragEventHandler } from '@thisbeyond/solid-dnd';
import { cloneItemWithNewUid } from '../lib/items';
import type { AppStore } from '../stores/app-store';
import type { DragStore } from '../stores/drag-store';
import type { Item } from '../types';
import { assertNever, classifyDropTarget, isChestDragId } from './ids';

export const createDragHandlers = (app: AppStore, drag: DragStore) => {
    const findChestContaining = (itemUid: string) => {
        for (const tab of app.state.tabs) {
            for (const chest of tab.chests) {
                const itemIndex = chest.items.findIndex((i) => i.uid === itemUid);
                if (itemIndex !== -1) return { chest, itemIndex };
            }
        }
        return null;
    };

    /**
     * Collect every selected item for a multi-drag, sorted by VISUAL order
     * (chest items by tab/chest/slot, then sidebar items by catalog order) so
     * the drop - and the generated command - matches what the user sees.
     * Sidebar items are cloned; chest items move as-is.
     */
    const gatherSelectedItems = (dragUid: string) => {
        const entries: { item: Item; sortKey: [number, number, number]; isGrabbed: boolean }[] = [];
        let sourceChestId: number | null = null;

        for (const uid of app.state.selectedItems) {
            const sidebarIndex = app.state.items.findIndex((i) => i.uid === uid);
            if (sidebarIndex !== -1) {
                entries.push({
                    item: cloneItemWithNewUid(app.state.items[sidebarIndex]),
                    sortKey: [Number.MAX_SAFE_INTEGER, 0, sidebarIndex],
                    isGrabbed: uid === dragUid,
                });
                continue;
            }
            for (let tabIndex = 0; tabIndex < app.state.tabs.length; tabIndex++) {
                const tab = app.state.tabs[tabIndex];
                let found = false;
                for (let chestIndex = 0; chestIndex < tab.chests.length; chestIndex++) {
                    const itemIndex = tab.chests[chestIndex].items.findIndex((i) => i.uid === uid);
                    if (itemIndex !== -1) {
                        entries.push({
                            item: tab.chests[chestIndex].items[itemIndex],
                            sortKey: [tabIndex, chestIndex, itemIndex],
                            isGrabbed: uid === dragUid,
                        });
                        if (uid === dragUid) sourceChestId = tab.chests[chestIndex].id;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        entries.sort((a, b) =>
            a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1] || a.sortKey[2] - b.sortKey[2]);
        return {
            items: entries.map((e) => e.item),
            sourceChestId,
            grabbedItem: entries.find((e) => e.isGrabbed)?.item ?? null,
        };
    };

    const onDragStart: DragEventHandler = ({ draggable }) => {
        app.beginUndoBatch(); // ét drag = ét undo-trin, uanset hvor mange actions det udløser
        if (isChestDragId(draggable.id)) return; // chest drags live in solid-dnd's context
        const uid = draggable.id as string;
        const isMultiSelect = app.state.selectedItems.has(uid) && app.state.selectedItems.size > 1;

        const sidebarItem = app.state.items.find((i) => i.uid === uid);
        if (sidebarItem) {
            if (isMultiSelect) {
                const { items, sourceChestId, grabbedItem } = gatherSelectedItems(uid);
                drag.startDrag(grabbedItem ?? items[0] ?? cloneItemWithNewUid(sidebarItem), items, sourceChestId);
            } else {
                const cloned = cloneItemWithNewUid(sidebarItem);
                drag.startDrag(cloned, [cloned], null);
            }
            return;
        }

        const found = findChestContaining(uid);
        if (!found) return;
        const chestItem = found.chest.items[found.itemIndex];
        if (isMultiSelect) {
            const { items, sourceChestId } = gatherSelectedItems(uid);
            drag.startDrag(chestItem, items, sourceChestId ?? found.chest.id);
        } else {
            drag.startDrag(chestItem, [chestItem], found.chest.id);
        }
    };

    /** Reorder within the active tab: move the dragged chest to another chest's slot */
    const reorderChestTo = (dragChestId: number, dropChestId: number) => {
        if (dragChestId === dropChestId) return;
        const chests = app.chests();
        const fromIndex = chests.findIndex((c) => c.id === dragChestId);
        const toIndex = chests.findIndex((c) => c.id === dropChestId);
        if (fromIndex !== -1 && toIndex !== -1) app.moveChest(fromIndex, toIndex);
    };

    const handleChestDrop = (chestId: number, dropId: string | number) => {
        const target = classifyDropTarget(dropId);
        switch (target.kind) {
            case 'tab-zone':
                // The hover auto-switch usually moved the chest already
                if (target.tabId !== app.state.activeTabId) app.moveChestToTab(chestId, target.tabId);
                return;
            case 'chest-sortable':
            case 'chest-zone':
                reorderChestTo(chestId, target.chestId);
                return;
            case 'item': {
                const found = findChestContaining(target.uid);
                if (found) reorderChestTo(chestId, found.chest.id);
                return;
            }
            case 'add-chest-zone':
                return;
            default:
                return assertNever(target);
        }
    };

    const handleItemDrop = (dragUid: string, dropId: string | number) => {
        const draggedItems = drag.draggedItems();
        const sourceChestId = drag.sourceChestId();
        if (draggedItems.length === 0) return;

        const moveTo = (targetChestId: number, insertBeforeUid?: string) => {
            app.moveItemsToChest({ items: draggedItems, targetChestId, insertBeforeUid });
            app.clearSelection();
        };

        const target = classifyDropTarget(dropId);
        switch (target.kind) {
            case 'item': {
                const found = findChestContaining(target.uid);
                if (!found) return;
                const dragIndex = found.chest.items.findIndex((i) => i.uid === dragUid);
                if (dragIndex !== -1 && draggedItems.length === 1) {
                    // Reorder within the same chest (kun ét item - flere
                    // trukne items skal flyttes, ikke bare omrokeres)
                    if (dragIndex !== found.itemIndex) {
                        app.reorderChestItems(found.chest.id, dragIndex, found.itemIndex);
                    }
                } else {
                    // Insert at the hovered item's position
                    moveTo(found.chest.id, target.uid);
                }
                return;
            }
            case 'chest-sortable':
            case 'chest-zone': {
                const targetChest = app.chests().find((c) => c.id === target.chestId);
                if (sourceChestId === target.chestId && targetChest && draggedItems.length === 1) {
                    // Dropped on the own chest's background: move to the end
                    const fromIndex = targetChest.items.findIndex((i) => i.uid === draggedItems[0].uid);
                    if (fromIndex !== -1) {
                        app.reorderChestItems(target.chestId, fromIndex, targetChest.items.length - 1);
                    }
                    return;
                }
                moveTo(target.chestId);
                return;
            }
            case 'add-chest-zone':
                app.createChestFromItems(draggedItems);
                app.clearSelection();
                return;
            case 'tab-zone':
                // Released on a tab: the hover already switched tabs, just cancel
                return;
            default:
                return assertNever(target);
        }
    };

    const onDragEnd: DragEventHandler = ({ draggable, droppable }) => {
        try {
            if (!droppable) return;
            if (isChestDragId(draggable.id)) handleChestDrop(draggable.id, droppable.id);
            else handleItemDrop(draggable.id as string, droppable.id);
        } finally {
            drag.endDrag();
            app.endUndoBatch();
        }
    };

    return { onDragStart, onDragEnd };
};
