// Chest - the INTERACTIVE wrapper around ChestCardView: registers the chest's
// drop zone, tracks the insertion placeholder, and decides the highlight ring.
// All markup lives in ChestView.tsx (which the drag overlay also renders).
import { createDroppable, useDragDropContext } from '@thisbeyond/solid-dnd';
import { createEffect, createMemo, type Component, type JSX } from 'solid-js';
import { chestZoneId } from '../dnd/ids';
import { useApp } from '../stores/app-store';
import { useDrag } from '../stores/drag-store';
import type { Chest as ChestData } from '../types';
import ChestItem from './ChestItem';
import { ChestCardView, ChestItemView, type ChestRing } from './ChestView';

type ChestProps = {
    chest: ChestData;
    index: number;
    gridView?: boolean;
    /** Drag activators from the surrounding sortable, spread onto the header */
    dragHandle?: JSX.HTMLAttributes<HTMLDivElement>;
    /** True while a chest is being dragged (disables item pointer events) */
    isChestDragActive?: boolean;
    /**
     * Tab mounted mid-drag: render items as pure views (no dnd hooks).
     * Mounting hundreds of draggables/droppables mid-drag freezes the
     * hover-switch; the items upgrade to interactive when the drag ends.
     */
    liteItems?: boolean;
};

const Chest: Component<ChestProps> = (props) => {
    const app = useApp();
    const drag = useDrag();
    const [dndState] = useDragDropContext()!;
    const droppable = createDroppable(chestZoneId(props.chest.id));

    // ----- Insertion placeholder tracking -----
    createEffect(() => {
        const { droppableId, draggableId } = dndState.active;
        if (typeof draggableId !== 'string' || !draggableId) return; // only item drags

        // Hovering the chest itself (zone or sortable): insert at the end
        if (droppableId === chestZoneId(props.chest.id) || droppableId === props.chest.id) {
            drag.updatePlaceholder(props.chest.id, props.chest.items.length);
            return;
        }
        // Hovering an item in THIS chest: insert at its position
        if (typeof droppableId === 'string') {
            const hoveredIndex = props.chest.items.findIndex((item) => item.uid === droppableId);
            if (hoveredIndex !== -1) {
                drag.updatePlaceholder(props.chest.id, hoveredIndex);
                return;
            }
        }
        // Left this chest: clear our placeholder
        if (drag.hoverChestId() === props.chest.id) drag.updatePlaceholder(null, -1);
    });

    // A drop only does something if it's a reorder within this chest, or at
    // least one dragged item isn't already here (duplicates are skipped on
    // drop) - hide the insertion preview and highlight otherwise
    const wouldAcceptDrop = () => {
        if (drag.sourceChestId() === props.chest.id) return true;
        const existingVariables = new Set(props.chest.items.map((item) => item.variable));
        return drag.draggedItems().some((item) => !existingVariables.has(item.variable));
    };

    // Highlight while an item drag hovers anything belonging to this chest -
    // but only when the drop would actually change something
    const isOver = () => {
        const { draggableId, droppableId } = dndState.active;
        if (typeof draggableId !== 'string') return false;
        if (!wouldAcceptDrop()) return false;
        if (droppable.isActiveDroppable) return true;
        if (droppableId === props.chest.id) return true;
        return props.chest.items.some((item) => droppableId === item.uid);
    };

    // Amber ring when the sidebar search matches an item in this chest
    // (opt-in via the toggle next to the search field)
    const matchesSearch = createMemo(() => {
        if (!app.state.highlightChestMatches) return false;
        const term = app.state.searchTerm.toLowerCase();
        if (!term) return false;
        return props.chest.items.some(
            (item) => item.item.toLowerCase().includes(term) || item.variable.toLowerCase().includes(term),
        );
    });

    const ring = (): ChestRing => (isOver() ? 'drop' : matchesSearch() ? 'search' : 'none');

    return (
        <ChestCardView
            chest={props.chest}
            index={props.index}
            gridView={props.gridView}
            dragHandle={props.dragHandle}
            ring={ring()}
            dropZoneRef={droppable.ref}
            renderItem={(item, index, view) => props.liteItems ? (
                <ChestItemView
                    item={item}
                    index={index}
                    view={view}
                    isSelected={app.state.selectedItems.has(item.uid)}
                    disablePointerEvents={props.isChestDragActive}
                />
            ) : (
                <ChestItem
                    item={item}
                    index={index}
                    view={view}
                    isSelected={app.state.selectedItems.has(item.uid)}
                    isChestDragActive={props.isChestDragActive}
                    onSelect={app.toggleItemSelection}
                    onRemove={() => {
                        // X på et multi-markeret item fjerner hele markeringen
                        if (app.state.selectedItems.has(item.uid) && app.state.selectedItems.size > 1) {
                            app.removeSelectedItems();
                        } else {
                            app.removeItemFromChest(props.chest.id, item.uid);
                        }
                    }}
                />
            )}
        />
    );
};

export default Chest;
