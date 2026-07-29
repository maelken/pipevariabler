// ChestItem - the INTERACTIVE wrapper around ChestItemView: registers the
// item's draggable + droppable and wires selection. Every chest item is both
// draggable AND droppable (dropping onto an item inserts at its position).
import { createDraggable, createDroppable, useDragDropContext } from '@thisbeyond/solid-dnd';
import { type Component } from 'solid-js';
import { createSelectAndDragHandlers, type SelectHandler } from '../dnd/activators';
import { isChestDragId } from '../dnd/ids';
import { useDrag } from '../stores/drag-store';
import type { Item } from '../types';
import { ChestItemView, type ItemViewMode } from './ChestView';

type ChestItemProps = {
    item: Item;
    index: number;
    view: ItemViewMode;
    isSelected: boolean;
    /** True while a chest is being dragged - items must not swallow pointer events */
    isChestDragActive?: boolean;
    onSelect: SelectHandler;
    onRemove: () => void;
};

const ChestItem: Component<ChestItemProps> = (props) => {
    const drag = useDrag();
    const dndContext = useDragDropContext();
    const draggable = createDraggable(props.item.uid);
    const droppable = createDroppable(props.item.uid);

    const isBeingDragged = () =>
        drag.isDragging() && drag.draggedItems().some((i) => i.uid === props.item.uid);

    // Only register the droppable outside chest drags, so a dragged chest's
    // sortable can be detected through the items
    const setRef = (el: HTMLElement) => {
        draggable.ref(el);
        if (!isChestDragId(dndContext?.[0]?.active.draggableId)) droppable.ref(el);
    };

    const handlers = createSelectAndDragHandlers({
        uid: () => props.item.uid,
        dragActivators: () => draggable.dragActivators,
        onSelect: (...args) => props.onSelect(...args),
    });

    return (
        <ChestItemView
            item={props.item}
            index={props.index}
            view={props.view}
            isSelected={props.isSelected}
            hidden={isBeingDragged()}
            disablePointerEvents={props.isChestDragActive}
            elementRef={setRef}
            onPointerDown={handlers.onPointerDown}
            onClick={handlers.onClick}
            onRemove={() => props.onRemove()}
        />
    );
};

export default ChestItem;
