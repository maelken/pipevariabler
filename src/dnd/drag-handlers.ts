// Drag orchestration for the root DragDropProvider: what happens when a drag
// starts and where things land when it ends. Tab sorting is NOT handled here -
// TabBar runs its own nested provider for that.
import type { DragEventHandler } from '@thisbeyond/solid-dnd';
import { cloneItemWithNewUid } from '../lib/items';
import type { AppStore } from '../stores/app-store';
import type { DragStore } from '../stores/drag-store';
import type { Item } from '../types';
import { createAutoScroll } from './auto-scroll';
import { assertNever, classifyDropTarget, isChestDragId } from './ids';
import { pointerPosition } from './pointer';

/** De solid-dnd context-actions handlerne skal bruge til scroll-resync */
export type DndActions = {
    detectCollisions: () => void;
};

export const createDragHandlers = (app: AppStore, drag: DragStore, dnd: DndActions) => {
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

    // Kistens index ved drag-start: uden for grid'et snapper den tilbage
    // hertil, saa et drop paa tabs/sidebar/tomrum annullerer omrokeringen
    let chestDragStartIndex = -1;
    let activeDragId: string | number | null = null;

    // Scroll under et drag (auto ELLER manuelt hjul) flytter alt under
    // cursoren, men solid-dnd fyrer kun collision ved pointer-BEVAEGELSE - saa
    // hvert scroll-ryk skal re-koere hit-testen og (for kister) omrokerings-
    // geometrien. Begge er DOM-baserede og billige (ingen layout-recompute).
    // RAF-throttled: eet resync pr. frame uanset antal scroll-events.
    let resyncQueued = false;
    const queueScrollResync = () => {
        if (resyncQueued) return;
        resyncQueued = true;
        requestAnimationFrame(() => {
            resyncQueued = false;
            if (activeDragId === null) return;
            dnd.detectCollisions();
            if (isChestDragId(activeDragId)) updateChestReorder(activeDragId);
        });
    };
    const autoScroll = createAutoScroll(queueScrollResync);

    const onDragStart: DragEventHandler = ({ draggable }) => {
        document.body.classList.add('is-dragging'); // global grabbing-cursor (se _layout.scss)
        activeDragId = draggable.id;
        autoScroll.start();
        // Capture: scroll-events bobler ikke, men de captures - fanger baade
        // autoscroll-ryk og brugerens egne hjul-scroll paa alle containere
        document.addEventListener('scroll', queueScrollResync, { capture: true, passive: true });
        app.beginUndoBatch(); // ét drag = ét undo-trin, uanset hvor mange actions det udløser
        if (isChestDragId(draggable.id)) {
            chestDragStartIndex = app.chests().findIndex((c) => c.id === draggable.id);
            return; // chest drags live in solid-dnd's context
        }
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

    /**
     * LIVE chest reordering, driven by cursor GEOMETRY instead of droppable
     * hover: directly over another chest the dragged chest takes its index
     * immediately; in margins/empty space the insertion index is "how many
     * other chests come before the cursor in reading order" (rows fully above
     * the cursor, plus chests on the cursor's row whose center is left of
     * it). This makes first and last
     * positions trivially reachable (cursor before the first chest / past the
     * last or over empty grid space) and never depends on solid-dnd's cached
     * layouts. The dragged chest's own hidden slot IS the live preview, and
     * undo-batching collapses all moves into one step.
     */
    const updateChestReorder = (draggableId: number) => {
        const grid = document.querySelector('[data-active-grid]');
        if (!grid) return;
        const gridRect = grid.getBoundingClientRect();
        const { x, y } = pointerPosition;
        const chests = app.chests();
        const fromIndex = chests.findIndex((c) => c.id === draggableId);
        if (fromIndex === -1) return; // fx efter dwell-skift til en anden tab

        // Outside the grid (tab zones, sidebar, blank chrome): snap back to the
        // start position, so dropping out there cancels the reorder entirely
        if (x < gridRect.left || x > gridRect.right || y < gridRect.top || y > gridRect.bottom) {
            if (chestDragStartIndex !== -1 && fromIndex !== chestDragStartIndex) {
                app.moveChest(fromIndex, chestDragStartIndex);
            }
            return;
        }

        // Een scoped DOM-pass i stedet for et querySelector pr. kiste
        const rects = new Map<number, DOMRect>();
        for (const el of grid.querySelectorAll('[data-chest-id]')) {
            rects.set(Number(el.getAttribute('data-chest-id')), el.getBoundingClientRect());
        }

        let insertionIndex = 0;
        let hoveredIndex = -1;
        for (let i = 0; i < chests.length; i++) {
            const chest = chests[i];
            if (chest.id === draggableId) continue;
            const rect = rects.get(chest.id);
            if (!rect) continue;
            // Direkte over en anden kiste: tag dens plads med det samme - der
            // skal ikke ventes paa at cursoren krydser kistens midtpunkt
            if (rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom) hoveredIndex = i;
            if (rect.bottom < y) insertionIndex++; // hele raekken er over cursoren
            else if (rect.top <= y && y <= rect.bottom && rect.left + rect.width / 2 < x) insertionIndex++;
        }

        // Margener og tom grid-plads falder tilbage til laeseordens-taellingen
        const targetIndex = hoveredIndex !== -1 ? hoveredIndex : insertionIndex;
        if (targetIndex !== fromIndex) app.moveChest(fromIndex, targetIndex);
    };

    const onDragMove: DragEventHandler = ({ draggable }) => {
        if (isChestDragId(draggable.id)) updateChestReorder(draggable.id);
    };

    // Reordering happens live in onDragMove - at drop time only the tab-zone
    // case still needs handling (drop directly on a tab before the dwell fires)
    const handleChestDrop = (chestId: number, dropId: string | number) => {
        const target = classifyDropTarget(dropId);
        if (target.kind === 'tab-zone' && target.tabId !== app.state.activeTabId) {
            app.moveChestToTab(chestId, target.tabId);
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
            chestDragStartIndex = -1;
            activeDragId = null;
            autoScroll.stop();
            document.removeEventListener('scroll', queueScrollResync, { capture: true });
            document.body.classList.remove('is-dragging');
            drag.endDrag();
            app.endUndoBatch();
        }
    };

    return { onDragStart, onDragMove, onDragEnd };
};
