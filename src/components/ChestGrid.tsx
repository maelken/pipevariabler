// ChestGrid - all tabs' chest grids. Inactive tabs stay mounted (hidden with
// CSS) so draggables never unmount mid-drag when the tab auto-switches.
import { createDraggable, createDroppable, useDragDropContext } from '@thisbeyond/solid-dnd';
import { FaSolidPlus } from 'solid-icons/fa';
import { createEffect, createMemo, createSignal, For, Show, type Component } from 'solid-js';

import { CHEST_ROW_HEIGHT } from '../constants';
import { markDroppable } from '../dnd/collision';
import { ADD_CHEST_ZONE_ID, isChestDragId } from '../dnd/ids';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';
import type { Chest as ChestData } from '../types';
import Chest from './Chest';

// Chests and the add-zone are inset by the same margin (instead of grid gap)
// so sortable transforms don't have to account for gaps
const CHEST_MARGIN = '0.375rem';

// Drop an item here (or click) to create a new chest
const AddChestDropZone: Component<{ onAddChest: () => void }> = (props) => {
    const droppable = createDroppable(ADD_CHEST_ZONE_ID);
    const drag = useDrag();

    const showHighlight = () =>
        drag.isDragging() && drag.activeItem() && droppable.isActiveDroppable;

    return (
        <div style={{ margin: CHEST_MARGIN }}>
            <div
                ref={(el) => {
                    markDroppable(el, ADD_CHEST_ZONE_ID);
                    droppable.ref(el);
                }}
                onClick={props.onAddChest}
                class={`h-full flex items-center justify-center border-2 border-dashed rounded-2xl p-4 transition-colors cursor-pointer ${showHighlight()
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-neutral-700 hover:border-neutral-600 hover:bg-neutral-900'}`}
            >
                <div class="flex flex-col items-center gap-3 p-6 text-neutral-400">
                    <FaSolidPlus size={24} />
                    <span class="text-lg font-medium">
                        {showHighlight() ? 'Slip for at oprette kiste' : 'Tilføj kiste'}
                    </span>
                </div>
            </div>
        </div>
    );
};

// Draggable + droppable chest wrapper. Deliberately NOT createSortable:
// solid-dnd's sort-preview transforms are built for 1-D lists and shift both
// visuals AND collision layouts nonsensically in a multi-row grid ("hit areas
// land in the margins"). Chests reorder LIVE on dragOver instead (same proven
// pattern as the tab bar), so no transforms are needed at all.
const DraggableChest: Component<{ chest: ChestData; index: number; gridView: boolean; liteItems?: boolean }> = (props) => {
    const draggable = createDraggable(props.chest.id);
    const droppable = createDroppable(props.chest.id);
    const dndContext = useDragDropContext();

    const isChestDragActive = () => isChestDragId(dndContext?.[0]?.active.draggableId);

    const setRef = (el: HTMLElement) => {
        markDroppable(el, props.chest.id);
        draggable.ref(el);
        droppable.ref(el);
    };

    return (
        <div
            ref={setRef}
            data-chest-id={props.chest.id}
            style={{
                // Hidden while dragging - ChestDragOverlay carries the visual
                opacity: draggable.isActiveDraggable ? 0 : 1,
                cursor: draggable.isActiveDraggable ? 'grabbing' : undefined,
                margin: CHEST_MARGIN,
            }}
        >
            <Chest
                chest={props.chest}
                index={props.index}
                gridView={props.gridView}
                dragHandle={draggable.dragActivators}
                isChestDragActive={isChestDragActive()}
                liteItems={props.liteItems}
            />
        </div>
    );
};

const ChestGrid: Component = () => {
    const app = useApp();
    const drag = useDrag();
    const dndContext = useDragDropContext();

    // Item drag (drag store) OR chest drag (solid-dnd context)
    const isAnyDrag = createMemo(
        () => drag.isDragging() || isChestDragId(dndContext?.[0].active.draggableId),
    );

    // Tabs that have been active at some point during the current drag.
    // They must STAY mounted until the drag ends (removing droppables/draggables
    // mid-drag breaks solid-dnd), but tabs the drag never visited don't need to
    // mount at all - mounting everything at drag start froze big profiles.
    const [dragVisitedTabIds, setDragVisitedTabIds] = createSignal(new Set<number>());
    // The tab the drag STARTED on keeps full item interactivity; tabs visited
    // mid-drag mount in "lite" mode (pure item views, no dnd hooks) - mounting
    // hundreds of draggables/droppables mid-drag froze the hover-switch, and
    // their guarded registration left unbalanced removals behind.
    const [dragOriginTabId, setDragOriginTabId] = createSignal<number | null>(null);
    createEffect(() => {
        if (isAnyDrag()) {
            const activeId = app.state.activeTabId;
            if (dragOriginTabId() === null) setDragOriginTabId(activeId);
            setDragVisitedTabIds((prev) => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
        } else {
            setDragOriginTabId(null);
            setDragVisitedTabIds((prev) => (prev.size ? new Set<number>() : prev));
        }
    });
    const isLiteTab = (tabId: number) => {
        if (!isAnyDrag()) return false;
        const originTabId = dragOriginTabId();
        // Drag just started and the origin isn't stamped yet (the effect runs
        // after render) - treating the transient as "lite" would unmount and
        // remount every interactive item on the active tab at every drag start
        if (originTabId === null) return false;
        return tabId !== originTabId;
    };

    const handleAddChest = () => {
        app.addChest({
            id: app.getNextChestId(),
            label: 'Ny Kiste',
            items: [],
            icon: 'barrel',
            checked: false,
        });
    };

    return (
        <For each={app.state.tabs}>
            {(tab) => {
                const isActive = () => app.state.activeTabId === tab.id;
                // MEMOIZED so renderItem only re-runs on a real true/false flip:
                // isLiteTab reads isAnyDrag(), and an unmemoized read here would
                // remount every item at drag start/end - each remount re-registers
                // with solid-dnd, which recomputes ALL layouts per registration
                // (quadratic: ~225k getBoundingClientRect on a full profile)
                const liteItems = createMemo(() => isLiteTab(tab.id));

                return (
                    // Only the active tab is mounted - plus tabs the current drag
                    // has visited (they mount lazily when the drag switches to
                    // them and must not unmount before it ends)
                    <Show when={isActive() || (isAnyDrag() && dragVisitedTabIds().has(tab.id))}>
                        <div
                        data-active-grid={isActive() ? '' : undefined}
                        class="grid-cols-auto-fit dark-theme overflow-x-hidden min-h-full"
                        style={{
                            gap: 0, // chests carry their own margin
                            'grid-template-columns': 'repeat(auto-fill, minmax(330px, 1fr))',
                            'grid-auto-rows': CHEST_ROW_HEIGHT[app.state.chestHeight],
                            // Inactive tabs: gone from layout normally, but kept
                            // mounted (off-screen) during drags so droppables survive
                            display: isActive() ? undefined : isAnyDrag() ? 'grid' : 'none',
                            visibility: isActive() ? 'visible' : 'hidden',
                            position: isActive() ? 'relative' : 'absolute',
                            ...(isAnyDrag() && !isActive() ? { left: '-9999px', top: 0 } : {}),
                        }}
                    >
                        <For each={tab.chests}>
                                {(chest, index) => (
                                <DraggableChest
                                        chest={chest}
                                        index={index()}
                                        gridView={app.state.chestGridView}
                                        liteItems={liteItems()}
                                    />
                            )}
                        </For>

                        <Show when={isActive()}>
                            <AddChestDropZone onAddChest={handleAddChest} />
                        </Show>
                        </div>
                    </Show>
                );
            }}
        </For>
    );
};

export default ChestGrid;
