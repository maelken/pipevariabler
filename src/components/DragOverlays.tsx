// Custom drag overlays rendered at the app root so they survive tab switches.
// Both track the real cursor via pointer events instead of solid-dnd's
// transform, so the preview stays glued to the cursor.
import { useDragDropContext } from '@thisbeyond/solid-dnd';
import {
    createEffect, createMemo, createSignal, onCleanup, onMount, Show, type Component,
} from 'solid-js';
import { isChestDragId } from '../dnd/ids';
import { pointerPosition } from '../dnd/pointer';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';
import { ChestCardView, ChestItemView } from './ChestView';
import SpriteIcon from './SpriteIcon';

/** Track the cursor while `isActive` holds; snaps to the cursor when it turns on */
const createCursorPosition = (isActive: () => boolean) => {
    const [pos, setPos] = createSignal({ x: 0, y: 0 });

    onMount(() => {
        const handler = (e: PointerEvent) => {
            if (isActive()) setPos({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('pointermove', handler);
        onCleanup(() => window.removeEventListener('pointermove', handler));
    });

    createEffect(() => {
        if (isActive()) setPos({ x: pointerPosition.x, y: pointerPosition.y });
    });

    return pos;
};

/** Dragged item(s): icon centered on the cursor, with a multi-select count badge */
const ItemDragOverlay: Component = () => {
    const drag = useDrag();
    const pos = createCursorPosition(() => drag.isDragging() && drag.activeItem() !== null);

    return (
        <Show when={drag.activeItem()}>
            {(item) => (
                <div
                    class="pointer-events-none fixed z-[9999]"
                    style={{
                        left: `${pos().x}px`,
                        top: `${pos().y}px`,
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <SpriteIcon icon={item().image} size={48} class="drop-shadow-xl" />
                    <Show when={drag.draggedItems().length > 1}>
                        <div class="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                            {drag.draggedItems().length}
                        </div>
                    </Show>
                </div>
            )}
        </Show>
    );
};

/**
 * Dragged chest: renders the PURE view layer (ChestCardView/ChestItemView),
 * offset to where the chest was grabbed. The view layer never touches
 * solid-dnd, so this live preview cannot collide with the real chest's
 * draggable/droppable ids - and it stays reactive (the #n badge updates
 * when the chest moves between tabs mid-drag).
 */
const ChestDragOverlay: Component = () => {
    const app = useApp();
    const dndContext = useDragDropContext();
    const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
    // Measured from the grabbed chest - grid cells are minmax(330px, 1fr), so
    // the real width varies with the viewport
    const [dragSize, setDragSize] = createSignal({ width: 330, height: 268 });

    const isChestDrag = createMemo(() => isChestDragId(dndContext?.[0]?.active.draggableId));
    const pos = createCursorPosition(isChestDrag);

    // The chest may already have been moved to another tab mid-drag - search
    // all tabs, and keep the position live so the "#n" badge updates
    const activeChest = createMemo(() => {
        const draggableId = dndContext?.[0]?.active.draggableId;
        if (!isChestDragId(draggableId)) return null;
        for (const tab of app.state.tabs) {
            const index = tab.chests.findIndex((c) => c.id === draggableId);
            if (index !== -1) return { chest: tab.chests[index], index };
        }
        return null;
    });

    // Capture the grab offset when the drag starts
    createEffect(() => {
        const draggableId = dndContext?.[0]?.active.draggableId;
        if (!isChestDragId(draggableId)) return;
        const el = document.querySelector<HTMLElement>(`[data-chest-id="${draggableId}"]`);
        if (el) {
            const rect = el.getBoundingClientRect();
            setDragOffset({ x: pointerPosition.x - rect.left, y: pointerPosition.y - rect.top });
            setDragSize({ width: rect.width, height: rect.height });
        }
    });

    return (
        <Show when={activeChest()}>
            {(active) => (
                <div
                    class="pointer-events-none fixed z-[9999]"
                    style={{
                        left: `${pos().x - dragOffset().x}px`,
                        top: `${pos().y - dragOffset().y}px`,
                        width: `${dragSize().width}px`,
                        height: `${dragSize().height}px`,
                        opacity: 0.95,
                    }}
                >
                    <ChestCardView
                        chest={active().chest}
                        index={active().index}
                        gridView={app.state.chestGridView}
                        renderItem={(item, index, view) => (
                            <ChestItemView item={item} index={index} view={view} />
                        )}
                    />
                </div>
            )}
        </Show>
    );
};

const DragOverlays: Component = () => (
    <>
        <ItemDragOverlay />
        <ChestDragOverlay />
    </>
);

export default DragOverlays;
