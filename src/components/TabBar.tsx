import React, { memo, useMemo } from 'react';
import { FaEdit, FaTimes, FaPlus, FaTh, FaBars, FaUndo, FaRedo } from 'react-icons/fa';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import SettingsDropdown from './SettingsDropdown';
import SortableTab from './SortableTab';
import { useProfile, useTabs, useSettings, useView, useLayout } from '../context/AppContext';

const TabBar: React.FC = () => {
    // Use context hooks instead of props
    const { profileName, setProfileName, isEditingProfileName, setIsEditingProfileName } = useProfile();
    const { tabs, activeTabId, setActiveTabId, isEditingTabName, setIsEditingTabName, updateTabName, addTab, moveTab, removeTab } = useTabs();
    const { tabScrollRef } = useLayout();

    // Tab IDs for sortable context
    const tabIds = useMemo(() => tabs.map(tab => `tab-${tab.id}`), [tabs]);
    const { onImport, onExport, onShare, onCopyCode, onImportCode, onNewProfile, onLoadPreset, onUndo, onRedo, undoDisabled, redoDisabled } = useSettings();
    const { chestGridView, setChestGridView } = useView();

    return (
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 h-8 w-full">
            {/* Profile name */}
            <div className="flex items-center gap-2">
                {isEditingProfileName ? (
                    <>
                        <input
                            type="text"
                            spellCheck="false"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Profilnavn"
                            className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <button className="text-blue-400 hover:text-blue-300 transition-colors" onClick={() => setIsEditingProfileName(false)}>Gem</button>
                    </>
                ) : (
                    <>
                        <span className="text-xl font-bold">{profileName}</span>
                        <button className="text-blue-400 hover:text-blue-300 transition-colors" onClick={() => setIsEditingProfileName(true)} aria-label="Rediger profilnavn">
                            <FaEdit />
                        </button>
                    </>
                )}
            </div>

            {/* Tabs */}
            <div className="min-w-0 overflow-hidden">
                <div
                    ref={tabScrollRef}
                    onWheel={(e) => {
                        const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
                        if (dx !== 0) {
                            e.preventDefault();
                            e.currentTarget.scrollLeft += dx;
                        }
                    }}
                    className="flex items-center gap-2 overflow-x-auto overflow-y-hidden dark-theme"
                    style={{ maxWidth: '100%', width: '100%' }}
                >
                    <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
                        {tabs.map((tab, tabIndex) => {
                            // Compute chest ID range for this tab
                            let startId = 1;
                            for (let i = 0; i < tabIndex; i++) {
                                startId += tabs[i].chests.length;
                            }
                            const endId = startId + tab.chests.length - 1;
                            const rangeText = tab.chests.length > 0
                                ? startId === endId ? ` (${startId})` : ` (${startId}-${endId})`
                                : '';

                            return (
                                <SortableTab
                                    key={tab.id}
                                    tabId={tab.id}
                                    isActive={activeTabId === tab.id}
                                    isEditing={isEditingTabName === tab.id}
                                    onSwitchTab={setActiveTabId}
                                >
                                    {(showHighlight) => (
                                        <div className="flex items-center flex-shrink-0">
                                            {isEditingTabName === tab.id ? (
                                                <input
                                                    type="text"
                                                    spellCheck="false"
                                                    value={tab.name}
                                                    onChange={(e) => updateTabName(tab.id, e.target.value)}
                                                    onBlur={() => setIsEditingTabName(null)}
                                                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') setIsEditingTabName(null); }}
                                                    className="px-3 py-1 text-sm rounded bg-neutral-800 text-white focus:outline-none ring-2 ring-inset ring-blue-500 min-w-[100px]"
                                                    autoFocus
                                                />
                                            ) : (
                                                <button
                                                    id={`tab-btn-${tab.id}`}
                                                    type="button"
                                                    className={`flex-shrink-0 px-3 py-1 text-sm rounded border-b-2 transition-colors flex items-center gap-1 ${showHighlight
                                                        ? 'ring-2 ring-inset ring-blue-500'
                                                        : ''} ${activeTabId === tab.id
                                                            ? 'bg-neutral-800 border-blue-400 text-white'
                                                            : 'bg-neutral-900 border-transparent text-neutral-300 hover:text-white hover:bg-neutral-800'
                                                        }`}
                                                    onClick={() => setActiveTabId(tab.id)}
                                                    onDoubleClick={() => setIsEditingTabName(tab.id)}
                                                >
                                                    <span className="truncate">{tab.name}{rangeText}</span>
                                                    {tabs.length > 1 && (
                                                        <span
                                                            className="text-red-500 hover:text-red-400 transition-colors flex-shrink-0"
                                                            onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                                                            title="Luk tab"
                                                        >
                                                            <FaTimes size={10} />
                                                        </span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </SortableTab>
                            );
                        })}
                    </SortableContext>
                    <button
                        type="button"
                        className="flex-shrink-0 px-2 py-1 text-sm rounded border-2 border-dashed border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors"
                        onClick={addTab}
                        title="Tilføj nyt tab"
                    >
                        <FaPlus size={12} />
                    </button>
                </div>
            </div>

            {/* Right-side actions */}
            <div className="flex items-center gap-2">
                {/* Undo/Redo buttons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onUndo}
                        disabled={undoDisabled}
                        className={`p-2 rounded transition-colors ${undoDisabled
                            ? 'text-neutral-600 cursor-not-allowed'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-700'
                            }`}
                        title="Fortryd (Ctrl+Z)"
                        aria-label="Fortryd"
                    >
                        <FaUndo size={14} />
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={redoDisabled}
                        className={`p-2 rounded transition-colors ${redoDisabled
                            ? 'text-neutral-600 cursor-not-allowed'
                            : 'text-neutral-300 hover:text-white hover:bg-neutral-700'
                            }`}
                        title="Gentag (Ctrl+Y)"
                        aria-label="Gentag"
                    >
                        <FaRedo size={14} />
                    </button>
                </div>

                {/* Chest grid/list toggle */}
                <button
                    onClick={() => setChestGridView(!chestGridView)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm text-neutral-300 hover:text-white"
                    title={chestGridView ? 'Kister: Listevisning' : 'Kister: Gittervisning'}
                    aria-pressed={chestGridView}
                >
                    {chestGridView ? <FaBars size={14} /> : <FaTh size={14} />}
                    <span>{chestGridView ? 'Liste' : 'Gitter'}</span>
                </button>

                {/* Settings */}
                <SettingsDropdown
                    onImport={onImport}
                    onExport={onExport}
                    onShare={onShare}
                    onCopyCode={onCopyCode}
                    onImportCode={onImportCode}
                    onNewProfile={onNewProfile}
                    onLoadPreset={onLoadPreset}
                    onUndo={onUndo}
                    onRedo={onRedo}
                    undoDisabled={undoDisabled}
                    redoDisabled={redoDisabled}
                />
            </div>
        </div>
    );
};

export default memo(TabBar);
