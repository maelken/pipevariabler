// Shared wiring for elements that are both selectable and draggable.
// Selection updates on pointerdown (so a multi-selection can be dragged),
// then the event is forwarded to solid-dnd's drag activator manually because
// we need our handler to run first.

type DragActivators = Record<string, unknown>;

export type SelectHandler = (uid: string, ctrlKey: boolean, isClick?: boolean) => void;

export const createSelectAndDragHandlers = (options: {
    uid: () => string;
    dragActivators: () => DragActivators | undefined;
    onSelect: SelectHandler;
}) => ({
    onPointerDown: (e: PointerEvent) => {
        options.onSelect(options.uid(), e.ctrlKey || e.metaKey, false);
        // solid-dnd registers its activator under lowercase 'onpointerdown'
        const activators = options.dragActivators();
        const activate = activators?.onpointerdown ?? activators?.onPointerDown;
        if (typeof activate === 'function') activate(e);
    },
    // The trailing click (no drag happened) collapses a multi-selection
    onClick: (e: MouseEvent) => options.onSelect(options.uid(), e.ctrlKey || e.metaKey, true),
});
