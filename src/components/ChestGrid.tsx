// ChestGrid - all tabs' chest grids. Inactive tabs stay mounted (hidden with
// CSS) so draggables never unmount mid-drag when the tab auto-switches.
import {
    createDroppable, createSortable, SortableProvider, useDragDropContext,
} from '@thisbeyond/solid-dnd';
import { FaSolidPlus } from 'solid-icons/fa';
import { createEffect, createMemo, createSignal, For, Show, type Component } from 'solid-js';

import { CHEST_ROW_HEIGHT } from '../constants';
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
                ref={droppable.ref}
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

const SortableChest: Component<{ chest: ChestData; index: number; gridView: boolean }> = (props) => {
    const sortable = createSortable(props.chest.id);
    const dndContext = useDragDropContext();

    const isChestDragActive = () => isChestDragId(dndContext?.[0]?.active.draggableId);

    return (
        <div
            ref={sortable.ref}
            data-chest-id={props.chest.id}
            style={{
                transform: `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`,
                // Hidden while dragging - ChestDragOverlay carries the visual
                opacity: sortable.isActiveDraggable ? 0 : 1,
                cursor: sortable.isActiveDraggable ? 'grabbing' : undefined,
                margin: CHEST_MARGIN,
            }}
        >
            <Chest
                chest={props.chest}
                index={props.index}
                gridView={props.gridView}
                dragHandle={sortable.dragActivators}
                isChestDragActive={isChestDragActive()}
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
    createEffect(() => {
        if (isAnyDrag()) {
            const activeId = app.state.activeTabId;
            setDragVisitedTabIds((prev) => (prev.has(activeId) ? prev : new Set(prev).add(activeId)));
        } else {
            setDragVisitedTabIds((prev) => (prev.size ? new Set<number>() : prev));
        }
    });

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
                const chestIds = createMemo(() => tab.chests.map((chest) => chest.id));

                return (
                    // Only the active tab is mounted - plus tabs the current drag
                    // has visited (they mount lazily when the drag switches to
                    // them and must not unmount before it ends)
                    <Show when={isActive() || (isAnyDrag() && dragVisitedTabIds().has(tab.id))}>
                        <div
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
                        <SortableProvider ids={chestIds()}>
                            <For each={tab.chests}>
                                {(chest, index) => (
                                    <SortableChest
                                        chest={chest}
                                        index={index()}
                                        gridView={app.state.chestGridView}
                                    />
                                )}
                            </For>
                        </SortableProvider>

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
