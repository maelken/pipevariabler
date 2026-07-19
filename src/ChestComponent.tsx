import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import ItemComponent from './ItemComponent';
import { FaEdit, FaTimes, FaRegCopy, FaCheckSquare, FaRegSquare, FaCheck } from 'react-icons/fa';
import { CMD_LIMIT, buildCommand } from './chestUtils';
import ChestIconPicker from './components/ChestIconPicker';
import { SortableItem } from './dnd/SortableItem';
import { Item, Chest } from './types';
import { COPY_FEEDBACK_DURATION } from './constants';

interface ChestComponentProps {
  chest: Chest;
  index: number;
  removeChest: (id: number) => void;
  updateChestLabel: (id: number, label: string) => void;
  updateChestIcon: (id: number, icon: string) => void;
  removeItemFromChest: (chestId: number, item: Item) => void;
  gridView: boolean;
  isPlaceholder?: boolean;
  selectedItems?: Set<string>;
  onItemSelect?: (uid: string, ctrlKey: boolean, isClick?: boolean) => void;
  sidebarCloneId: string | null;
}

// Drop zone component for items inside a chest (no visual highlight - outer chest handles that)
const ItemsDropZone: React.FC<{
  chestId: number;
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  hasItems: boolean;
  isGridView: boolean;
}> = memo(({ chestId, children, containerRef, hasItems, isGridView }) => {
  const { active } = useDndContext();
  const { setNodeRef } = useDroppable({
    id: `chest-drop-${chestId}`,
    data: { chestId },
  });

  // Disable hover effects on items when dragging
  const isDragging = !!active;

  // Combine refs
  const handleRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    if (containerRef && 'current' in containerRef) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  };

  return (
    <div
      ref={handleRef}
      className={`mt-3 p-2 w-full flex-1 rounded-lg bg-neutral-900/50 border-2 transition-colors ${hasItems
        ? 'border-transparent'
        : 'border-dashed border-neutral-700'
        }`}
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <div style={{ pointerEvents: isDragging ? 'none' : 'auto', height: '100%' }}>
        {children}
      </div>
    </div>
  );
});


const ChestComponent: React.FC<ChestComponentProps> = memo(({
  chest,
  index,
  removeChest,
  updateChestLabel,
  updateChestIcon,
  removeItemFromChest,
  gridView,
  isPlaceholder,
  selectedItems,
  onItemSelect,
  sidebarCloneId,
}) => {
  const { over, active } = useDndContext();

  const [isEditing, setIsEditing] = useState(false);
  const [chestLabel, setChestLabel] = useState(chest.label || 'Barrel');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chest.id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : isPlaceholder ? 0.3 : 1,
    pointerEvents: isPlaceholder ? 'none' as const : 'auto' as const,
    height: '100%' as const,
  };


  // Highlight if dragging an item over this chest or the drop zone or any item inside
  const isDraggingItem = active && typeof active.id === 'string';
  const isOverChestDirectly = over?.id === chest.id;
  const isOverDropZone = over?.id === `chest-drop-${chest.id}`;

  // Check if hovering over an item that belongs to this chest
  const overIdStr = over?.id ? String(over.id) : '';
  const isOverItemInThisChest = chest.items.some(item =>
    (item.uid && item.uid === overIdStr) || item.item === overIdStr ||
    overIdStr === `item-drop-${item.uid}` // Also check for item-drop- prefix
  );

  const isOver = !!(isDraggingItem && (isOverChestDirectly || isOverDropZone || isOverItemInThisChest));

  // Simple stable item IDs for SortableContext - no dynamic placeholder to avoid infinite loops
  const sortableItemIds = useMemo(() => {
    return chest.items.map(i => i.uid);
  }, [chest.items]);


  const [isChecked, setIsChecked] = useState<boolean>(chest.checked);

  // Ref for scrolling to new items
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  const prevItemsCountRef = useRef(chest.items.length);

  const [copied, setCopied] = useState(false);

  // Sync checked state with props
  useEffect(() => {
    setIsChecked(chest.checked);
  }, [chest.checked]);

  // Scroll to bottom when new items are added (not on initial mount)
  const hasMountedRef = useRef(false);
  useEffect(() => {
    // Skip first render (initial mount or import)
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      prevItemsCountRef.current = chest.items.length;
      return;
    }

    // Only scroll if items were added (not removed or same)
    if (chest.items.length > prevItemsCountRef.current && itemsContainerRef.current) {
      itemsContainerRef.current.scrollTo({
        top: itemsContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
    prevItemsCountRef.current = chest.items.length;
  }, [chest.items.length]);

  // Sync title when chest changes
  useEffect(() => {
    setChestLabel(chest.label || 'Barrel');
  }, [chest.label]);

  const handleSave = () => {
    if (chestLabel.trim()) {
      updateChestLabel(chest.id, chestLabel);
      setIsEditing(false);
    }
  };

  const handleDoneToggle = () => {
    const newState = !isChecked;
    setIsChecked(newState);
    localStorage.setItem(`chest-checked-${chest.id}`, JSON.stringify(newState));
  };


  const command = useMemo(() => buildCommand(chest.items), [chest.items]);
  const cmdLength = command.length;
  const pct = Math.min(100, Math.round((cmdLength / CMD_LIMIT) * 100));
  const overLimit = cmdLength > CMD_LIMIT;

  // Render
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-chest-id={chest.id}
      className={`relative flex flex-col border rounded-2xl bg-neutral-900/80 border-neutral-800 p-3 shadow-sm hover:shadow-md transition ${isOver ? 'ring-2 ring-inset ring-blue-500 border-transparent' : ''}`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 cursor-grab active:cursor-grabbing border-b border-neutral-800/50"
        {...attributes}
        {...(isEditing ? {} : listeners)}
      >
        {/* Icon button */}

        <ChestIconPicker
          chestId={chest.id}
          currentIcon={chest.icon}
          updateChestIcon={updateChestIcon}
        />
        {/* Title Area */}
        <div className="group flex-1 min-w-0 text-left flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full">
              <input
                className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 flex-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                spellCheck={false}
                value={chestLabel}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onChange={(e) => setChestLabel(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
                autoFocus
              />
              <button className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium" onClick={(e) => { e.stopPropagation(); handleSave(); }} onPointerDown={e => e.stopPropagation()} aria-label="Gem navn">
                Gem
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="truncate text-base font-semibold cursor-pointer"
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                onPointerDown={(e) => e.stopPropagation()}
              >{chest.label || 'Barrel'}</span>
              <button className="text-blue-400 hover:text-blue-300 transition-colors" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} onPointerDown={e => e.stopPropagation()} aria-label="Rediger navn">
                <FaEdit />
              </button>
            </div>
          )}
        </div>

        {/* Right actions */}
        {!isEditing && (
          <div className="flex items-center gap-2 text-base">
            {/* Done toggle */}
            <button onClick={(e) => { e.stopPropagation(); handleDoneToggle(); }} onPointerDown={e => e.stopPropagation()} className={`transition-colors ${isChecked ? 'text-green-400 hover:text-green-300' : 'text-neutral-400 hover:text-neutral-200'}`} title={isChecked ? 'Markér som færdig' : 'Markér som ufærdig'}>
              {isChecked ? <FaCheckSquare /> : <FaRegSquare />}
            </button>

            {/* Copy command */}
            {chest.items.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(command);
                  setCopied(true);
                  setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
                }}
                onPointerDown={e => e.stopPropagation()}
                className={`transition-colors ${copied ? 'text-green-400' : 'text-green-500 hover:text-green-400'}`}
                title="Kopiér kommando"
              >
                {copied ? <FaCheck /> : <FaRegCopy />}
              </button>
            )}

            {/* Delete chest */}
            <button onClick={(e) => { e.stopPropagation(); removeChest(chest.id); }} onPointerDown={e => e.stopPropagation()} className="text-red-500 hover:text-red-400 transition-colors" title="Slet kiste">
              <FaTimes />
            </button>
          </div>
        )}

        {/* Position number */}
        <div className="absolute top-1 right-2 text-[11px] text-neutral-400 select-none">#{index + 1}</div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2">
        <div className="h-1.5 rounded bg-neutral-800 overflow-hidden">
          <div
            className={`h-full ${overLimit ? 'bg-red-600' : pct > 85 ? 'bg-yellow-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%`, transition: 'width 150ms ease-out' }}
          />
        </div>
        <div className="mt-1 text-[12px] text-neutral-400">
          {cmdLength}/{CMD_LIMIT} tegn {overLimit && <span className="text-red-500 ml-1">– for langt!</span>}
        </div>
      </div>

      {/* Items Drop Zone */}
      <ItemsDropZone chestId={chest.id} containerRef={itemsContainerRef} hasItems={chest.items.length > 0} isGridView={gridView}>
        {chest.items.length > 0 ? (
          <SortableContext items={sortableItemIds} strategy={gridView ? rectSortingStrategy : verticalListSortingStrategy}>
            {gridView ? (
              <div className="grid grid-cols-6 gap-2">
                {chest.items.map((item, itemIndex) => (
                  <SortableItem
                    key={item.uid || `${item.item}-${itemIndex}`}
                    id={item.uid || item.item}
                    style={sidebarCloneId === item.uid ? { opacity: 0.4 } : undefined}
                  >
                    <ItemComponent
                      item={item}
                      index={itemIndex}
                      lastIndex={chest.items.length - 1}
                      removeItem={() => removeItemFromChest(chest.id, item)}
                      isGridView={gridView}
                      isSelected={selectedItems?.has(item.uid)}
                      onSelect={onItemSelect}
                    />
                  </SortableItem>
                ))}
              </div>
            ) : (
              <ul className="chest-items dark-theme">
                {chest.items.map((item, i) => (
                  <SortableItem
                    key={item.uid || `${item.item}-${i}`}
                    id={item.uid || item.item}
                    style={sidebarCloneId === item.uid ? { opacity: 0.4 } : undefined}
                  >
                    <ItemComponent
                      item={item}
                      index={i}
                      lastIndex={chest.items.length - 1}
                      removeItem={() => removeItemFromChest(chest.id, item)}
                      isGridView={gridView}
                      isSelected={selectedItems?.has(item.uid)}
                      onSelect={onItemSelect}
                    />
                  </SortableItem>
                ))}
              </ul>
            )}
          </SortableContext>

        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 text-base font-medium">
            Træk ting her
          </div>
        )}
      </ItemsDropZone>
    </div>
  );
});

export default ChestComponent;
