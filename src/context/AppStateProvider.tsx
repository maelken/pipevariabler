import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import pako from 'pako';
import { processItems, getAllItems } from '../itemUtils';
import {
    AppContextType,
    AppProvider
} from './AppContext';
import { useProfileManager } from '../hooks/useProfileManager';
import { useDragController } from '../hooks/useDragController';
import { useChests } from '../hooks/useChests';
import { SIDEBAR_HEIGHT_OFFSET } from '../constants';

import { Item, Chest, Tab, Profile } from '../types';
import ConfirmationModal from '../ConfirmationModal';
import { uint8ToBase64, base64ToUint8, repairProfileEncoding } from '../encodingUtils';

interface AppStateProviderProps {
    children: React.ReactNode;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children }) => {
    // -------------------------------------------------------------------------
    // STATE
    // -------------------------------------------------------------------------
    const [searchTerm, setSearchTerm] = useState('');
    const [items, setItems] = useState<Item[]>([]);
    const [profileName, setProfileName] = useState<string>('');
    const [profileVersion, setProfileVersion] = useState(0);
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTabId, setActiveTabId] = useState<number>(1);

    const [showAll, setShowAll] = useState<boolean>(() => JSON.parse(localStorage.getItem('showAll') || 'true'));
    const [isGridView, setIsGridView] = useState<boolean>(() => JSON.parse(localStorage.getItem('isGridView') || 'false'));
    const [chestGridView, setChestGridView] = useState<boolean>(() => JSON.parse(localStorage.getItem('chestGridView') || 'true'));

    const [listHeight, setListHeight] = useState(window.innerHeight - SIDEBAR_HEIGHT_OFFSET);
    const [undoStack, setUndoStack] = useState<Tab[][]>([]);
    const [redoStack, setRedoStack] = useState<Tab[][]>([]);

    // Modals
    const [modalVisible, setModalVisible] = useState(false);
    const [isEditingProfileName, setIsEditingProfileName] = useState(false);
    const [isEditingTabName, setIsEditingTabName] = useState<number | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [chestToDelete, setChestToDelete] = useState<number | null>(null);
    const [importCodeModalVisible, setImportCodeModalVisible] = useState(false);
    const [importCodeValue, setImportCodeValue] = useState('');

    const listContainerRef = useRef<HTMLDivElement>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const tabScrollRef = useRef<HTMLDivElement>(null);

    // -------------------------------------------------------------------------
    // HOOKS & UTILS
    // -------------------------------------------------------------------------

    const {
        importProfileModalVisible,
        newProfileModalVisible,
        deleteTabModalVisible,
        presetModalVisible,
        handleImportProfile,
        handleExportProfile,
        confirmNewProfile,
        createNewProfile,
        cancelNewProfile,
        confirmImportProfile,
        cancelImportProfile,
        loadPreset,
        confirmLoadPreset,
        cancelLoadPreset,
        addTab,
        moveTab,
        removeTab,
        confirmDeleteTab,
        cancelDeleteTab,
        updateTabName,
        getNextChestId
    } = useProfileManager({
        tabs,
        setTabs,
        profileName,
        setProfileName,
        activeTabId,
        setActiveTabId,
        setShowAll,
        setProfileVersion,
        setUndoStack,
        setRedoStack
    });

    const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
    const chests = useMemo(() => activeTab?.chests || [], [activeTab]);

    const globalChestOffset = useMemo(() => {
        let offset = 0;
        for (const tab of tabs) {
            if (tab.id === activeTabId) break;
            offset += tab.chests.length;
        }
        return offset;
    }, [tabs, activeTabId]);

    // -------------------------------------------------------------------------
    // DATA LOADING & PERSISTENCE
    // -------------------------------------------------------------------------

    useEffect(() => {
        const loadProfile = (profile: Profile) => {
            setProfileName(profile.name || 'Delt Profil');
            let globalChestId = 1;
            let tabId = 1;

            if (profile.tabs) {
                const processedTabs = profile.tabs.map((tab: any) => ({
                    ...tab,
                    id: tabId++,
                    chests: tab.chests.map((chest: any) => ({
                        ...chest,
                        id: globalChestId++,
                        icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                        checked: chest.checked || false,
                        items: processItems(chest.items || [])
                    }))
                }));
                setTabs(processedTabs);
                setActiveTabId(processedTabs[0]?.id || 1);
            } else if (profile.chests) {
                const processedChests = profile.chests.map((chest: any) => ({
                    ...chest,
                    id: globalChestId++,
                    icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                    checked: chest.checked || false,
                    items: processItems(chest.items || [])
                }));
                const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: processedChests };
                setTabs([defaultTab]);
                setActiveTabId(1);
            }
        };

        const hash = window.location.hash;
        if (hash.startsWith('#p=') || hash.startsWith('#profile=')) {
            try {
                let jsonStr: string;
                if (hash.startsWith('#p=')) {
                    const base64 = hash.substring('#p='.length);
                    const bytes = base64ToUint8(base64);
                    jsonStr = pako.inflate(bytes, { to: 'string' });
                } else {
                    const base64 = hash.substring('#profile='.length);
                    jsonStr = decodeURIComponent(escape(atob(base64)));
                }
                const sharedProfile = repairProfileEncoding(JSON.parse(jsonStr));
                loadProfile(sharedProfile);
                window.history.replaceState(null, '', window.location.pathname);
                return;
            } catch (error) {
                console.error('Error loading shared profile:', error);
            }
        }

        const savedProfile = localStorage.getItem('profile');
        if (savedProfile) {
            const profile = repairProfileEncoding(JSON.parse(savedProfile));
            loadProfile(profile);
        } else {
            setProfileName('Ny Profil');
            const defaultChest: Chest = { id: 1, label: 'Min første kiste', items: [], icon: 'barrel', checked: false };
            const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: [defaultChest] };
            setTabs([defaultTab]);
            setActiveTabId(1);
        }
    }, []);

    useEffect(() => {
        const sortedItems = getAllItems().sort((a, b) => a.item.localeCompare(b.item));
        setItems(sortedItems);
    }, []);

    useEffect(() => {
        if (tabs.length > 0 && profileName) {
            const profile: Profile = { name: profileName, tabs };
            localStorage.setItem('profile', JSON.stringify(profile));
        }
    }, [tabs, profileName]);

    useEffect(() => { localStorage.setItem('showAll', JSON.stringify(showAll)); }, [showAll]);
    useEffect(() => { localStorage.setItem('isGridView', JSON.stringify(isGridView)); }, [isGridView]);
    useEffect(() => { localStorage.setItem('chestGridView', JSON.stringify(chestGridView)); }, [chestGridView]);

    useEffect(() => {
        const el = document.getElementById(`tab-btn-${activeTabId}`);
        const scroller = tabScrollRef.current;
        if (!el || !scroller) return;
        const elLeft = (el as HTMLElement).offsetLeft;
        const elRight = elLeft + (el as HTMLElement).offsetWidth;
        const visibleLeft = scroller.scrollLeft;
        const visibleRight = visibleLeft + scroller.clientWidth;
        if (elLeft < visibleLeft) scroller.scrollTo({ left: elLeft - 16, behavior: 'smooth' });
        else if (elRight > visibleRight) scroller.scrollTo({ left: elRight - scroller.clientWidth + 16, behavior: 'smooth' });
    }, [activeTabId]);

    // -------------------------------------------------------------------------
    // ACTIONS & HANDLERS
    // -------------------------------------------------------------------------

    const updateChests = useCallback((newChests: Chest[]) => {
        setTabs(prev => prev.map(tab => (tab.id === activeTabId ? { ...tab, chests: newChests } : tab)));
    }, [activeTabId]);

    const {
        addChest,
        handleDeleteChest,
        confirmDeleteChest,
        updateChestLabel,
        updateChestIcon,
        removeItemFromChest,
    } = useChests({
        chests,
        tabs,
        updateChests,
        getNextChestId,
        setUndoStack,
        setRedoStack,
        setModalVisible,
        setChestToDelete,
    });

    const filteredItems = useMemo(
        () => items.filter(item => item.item.toLowerCase().includes(searchTerm.toLowerCase().replace(/ /g, '_'))),
        [items, searchTerm]
    );

    const chestItemsMap = useMemo(() => {
        const map = new Map<string, { chestId: number; displayIndex: number }[]>();
        let globalIndex = 1;
        tabs.forEach(tab => {
            tab.chests.forEach(chest => {
                const currentDisplayIndex = globalIndex;
                chest.items.forEach(item => {
                    if (!map.has(item.item)) map.set(item.item, []);
                    map.get(item.item)!.push({ chestId: chest.id, displayIndex: currentDisplayIndex });
                });
                globalIndex++;
            });
        });
        return map;
    }, [tabs]);

    const {
        sensors,
        activeId,
        activeItem,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,
        handleItemSelect,
        dropAnimation,
        dragSourceIsItemRef,
        sidebarCloneId
    } = useDragController({
        items,
        setItems,
        tabs,
        setTabs,
        activeTab,
        activeTabId,
        setActiveTabId,
        updateChests,
        selectedItems,
        setSelectedItems,
        setUndoStack,
        setRedoStack,
        getNextChestId
    });

    const itemsToShow = useMemo(
        () => (showAll ? filteredItems : filteredItems.filter(item => !chestItemsMap.has(item.item))),
        [filteredItems, showAll, chestItemsMap]
    );

    const handleUndo = useCallback(() => {
        if (undoStack.length > 0) {
            const newUndo = [...undoStack];
            const prevState = newUndo.pop()!;
            setRedoStack(prev => [...prev, tabs]);
            setTabs(prevState);
            setUndoStack(newUndo);
        }
    }, [undoStack, tabs]);

    const handleRedo = useCallback(() => {
        if (redoStack.length > 0) {
            const newRedo = [...redoStack];
            const nextState = newRedo.pop()!;
            setUndoStack(prev => [...prev, tabs]);
            setTabs(nextState);
            setRedoStack(newRedo);
        }
    }, [redoStack, tabs]);

    // Share & Code Logic
    const handleShare = useCallback(() => {
        const minimalProfile = {
            name: profileName,
            tabs: tabs.map(tab => ({
                name: tab.name,
                chests: tab.chests.map(chest => ({
                    label: chest.label,
                    icon: chest.icon,
                    items: chest.items.map(item => ({ item: item.item }))
                }))
            }))
        };

        try {
            const jsonStr = JSON.stringify(minimalProfile);
            const compressed = pako.deflate(new TextEncoder().encode(jsonStr));
            const base64 = uint8ToBase64(compressed);
            const shareUrl = `${window.location.origin}${window.location.pathname}#p=${base64}`;

            if (shareUrl.length > 2000) {
                const proceed = window.confirm(
                    `URL'en er ${shareUrl.length.toLocaleString()} tegn lang - for stor til de fleste browsere.\n\n` +
                    `For store profiler anbefales "Eksporter Profil" i stedet.\n\n` +
                    `Vil du stadig kopiere URL'en?`
                );
                if (!proceed) return;
            }

            navigator.clipboard.writeText(shareUrl).then(() => {
                alert(`URL kopieret! (${shareUrl.length.toLocaleString()} tegn)`);
            }).catch(() => {
                prompt('Kopier dette link:', shareUrl);
            });
        } catch (error) {
            console.error('Error sharing profile:', error);
            alert('Kunne ikke generere delelink');
        }
    }, [tabs, profileName]);

    const handleCopyCode = useCallback(() => {
        const minimalProfile = {
            name: profileName,
            tabs: tabs.map(tab => ({
                name: tab.name,
                chests: tab.chests.map(chest => ({
                    label: chest.label,
                    icon: chest.icon,
                    items: chest.items.map(item => ({ item: item.item }))
                }))
            }))
        };

        try {
            const jsonStr = JSON.stringify(minimalProfile);
            const compressed = pako.deflate(new TextEncoder().encode(jsonStr));
            console.log("compressed", compressed);
            const base64 = uint8ToBase64(compressed);

            navigator.clipboard.writeText(base64).then(() => {
                alert(`Kode kopieret! (${base64.length.toLocaleString()} tegn)\n\nDel denne kode med andre - de kan importere den via "Importer Kode".`);
            }).catch(() => {
                prompt('Kopier denne kode:', base64);
            });
        } catch (error) {
            console.error('Error copying code:', error);
            alert('Kunne ikke generere kode');
        }
    }, [tabs, profileName]);

    const handleImportCode = useCallback(() => {
        setImportCodeValue('');
        setImportCodeModalVisible(true);
    }, []);

    const processImportCode = useCallback(() => {
        const code = importCodeValue.trim();
        if (!code) {
            alert('Indtast venligst en kode');
            return;
        }

        try {
            const bytes = base64ToUint8(code);
            const jsonStr = pako.inflate(bytes, { to: 'string' });
            const profile = repairProfileEncoding(JSON.parse(jsonStr));

            setUndoStack(prev => [...prev, tabs]);
            setRedoStack([]);
            setProfileName(profile.name || 'Importeret Profil');

            let globalChestId = 1;
            let tabId = 1;
            setProfileVersion(v => v + 1);

            if (profile.tabs) {
                const processedTabs = profile.tabs.map((tab: any) => ({
                    ...tab,
                    id: tabId++,
                    chests: tab.chests.map((chest: any) => ({
                        ...chest,
                        id: globalChestId++,
                        icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                        checked: chest.checked || false,
                        items: processItems(chest.items || [])
                    }))
                }));
                setTabs(processedTabs);
                setActiveTabId(processedTabs[0]?.id || 1);
            } else if (profile.chests) {
                const processedChests = profile.chests.map((chest: any) => ({
                    ...chest,
                    id: globalChestId++,
                    icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                    checked: chest.checked || false,
                    items: processItems(chest.items || [])
                }));
                const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: processedChests };
                setTabs([defaultTab]);
                setActiveTabId(1);
            }
            setImportCodeModalVisible(false);
            setImportCodeValue('');
            alert('Profil importeret!');
        } catch (error) {
            console.error('Error importing code:', error);
            alert('Ugyldig kode. Tjek at du har kopieret hele koden korrekt.');
        }
    }, [importCodeValue, tabs, setUndoStack, setRedoStack]);

    const handleChestClick = useCallback((chestId: number, itemName?: string) => {
        for (const tab of tabs) {
            const chest = tab.chests.find(c => c.id === chestId);
            if (chest) {
                if (tab.id !== activeTabId) {
                    setActiveTabId(tab.id);
                }
                setTimeout(() => {
                    const chestElement = document.querySelector(`[data-chest-id="${chestId}"]`) as HTMLElement;
                    if (chestElement) {
                        chestElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                        chestElement.classList.add('ring-2', 'ring-inset', 'ring-blue-500');
                        setTimeout(() => {
                            chestElement.classList.remove('ring-2', 'ring-inset', 'ring-blue-500');
                        }, 1500);

                        if (itemName) {
                            const itemInChest = chest.items.find(i => i.item === itemName);
                            if (itemInChest) {
                                setSelectedItems(new Set([itemInChest.uid]));
                                setTimeout(() => {
                                    const itemElement = chestElement.querySelector(`[data-item-id="${itemInChest.uid}"]`) as HTMLElement;
                                    if (itemElement) {
                                        itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                }, 200);
                                setTimeout(() => setSelectedItems(new Set()), 2000);
                            }
                        }
                    }
                }, 150);
                return;
            }
        }
    }, [tabs, activeTabId]);

    const updateHeights = () => {
        const listContainer = listContainerRef.current;
        const gridContainer = gridContainerRef.current;
        if (listContainer) {
            const boundingRect = listContainer.getBoundingClientRect();
            setListHeight(window.innerHeight - boundingRect.top - 20);
        }
        if (gridContainer) {
            const boundingRect = gridContainer.getBoundingClientRect();
            gridContainer.style.maxHeight = `${window.innerHeight - boundingRect.top - 20}px`;
        }
    };

    useEffect(() => {
        updateHeights();
        window.addEventListener('resize', updateHeights);
        return () => window.removeEventListener('resize', updateHeights);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
                event.preventDefault();
                handleUndo();
            } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
                event.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const incomingChest = useMemo(() => {
        if (activeId === null || typeof activeId !== 'number') return null;
        if (chests.some(c => c.id === activeId)) return null;
        for (const tab of tabs) {
            if (tab.id === activeTabId) continue;
            const chest = tab.chests.find(c => c.id === activeId);
            if (chest) return chest;
        }
        return null;
    }, [activeId, chests, tabs, activeTabId]);

    const displayChests = useMemo(() => {
        if (!incomingChest) return chests;
        return [...chests, incomingChest];
    }, [chests, incomingChest]);

    const appContextValue: AppContextType = useMemo(() => ({
        profile: {
            profileName,
            setProfileName,
            isEditingProfileName,
            setIsEditingProfileName,
        },
        tabs: {
            tabs,
            activeTabId,
            setActiveTabId,
            isEditingTabName,
            setIsEditingTabName,
            updateTabName,
            addTab,
            moveTab,
            removeTab,
        },
        settings: {
            onImport: handleImportProfile,
            onExport: handleExportProfile,
            onShare: handleShare,
            onCopyCode: handleCopyCode,
            onImportCode: handleImportCode,
            onNewProfile: createNewProfile,
            onLoadPreset: loadPreset,
            onUndo: handleUndo,
            onRedo: handleRedo,
            undoDisabled: undoStack.length === 0,
            redoDisabled: redoStack.length === 0,
            profileVersion,
        },
        view: {
            chestGridView,
            setChestGridView,
            isGridView,
            setIsGridView,
            showAll,
            setShowAll,
        },
        selection: {
            selectedItems,
            handleItemSelect,
        },
        search: {
            searchTerm,
            setSearchTerm,
        },
        data: {
            items,
            itemsToShow,
            chestItemsMap,
            handleChestClick
        },
        layout: {
            listHeight,
            setListHeight,
            listContainerRef,
            gridContainerRef,
            tabScrollRef,
        },
        chests: {
            addChest,
            confirmDeleteChest,
            updateChestLabel,
            updateChestIcon,
            removeItemFromChest,
            updateChests,
            globalChestOffset,
            incomingChest,
            sidebarCloneId,
            displayChests,
        },
        dnd: {
            sensors,
            activeId,
            activeItem,
            handleDragStart,
            handleDragOver,
            handleDragEnd,
            handleDragCancel,
            dropAnimation,
            dragSourceIsItemRef,
        }
    }), [
        profileName, setProfileName, isEditingProfileName, setIsEditingProfileName,
        tabs, activeTabId, setActiveTabId, isEditingTabName, setIsEditingTabName, updateTabName, addTab, moveTab, removeTab,
        handleImportProfile, handleExportProfile, handleShare, handleCopyCode, handleImportCode, createNewProfile, loadPreset, handleUndo, handleRedo, undoStack.length, redoStack.length, profileVersion,
        chestGridView, setChestGridView, isGridView, setIsGridView, showAll, setShowAll,
        selectedItems, handleItemSelect,
        searchTerm, setSearchTerm,
        items, itemsToShow, chestItemsMap, handleChestClick,
        listHeight,
        addChest, confirmDeleteChest, updateChestLabel, updateChestIcon, removeItemFromChest, updateChests, globalChestOffset, incomingChest, sidebarCloneId, displayChests,
        sensors, activeId, activeItem, handleDragStart, handleDragOver, handleDragEnd, handleDragCancel, dropAnimation
    ]);

    return (
        <AppProvider value={appContextValue}>
            {children}

            {/* Global Modals that depend on state inside provider */}
            {modalVisible && (
                <ConfirmationModal
                    onConfirm={() => handleDeleteChest(chestToDelete!)}
                    onCancel={() => setModalVisible(false)}
                    message="Er du sikker på, at du vil slette denne kiste? Den er ikke tom."
                    title="Bekræft Sletning"
                    variant="danger"
                    confirmText="Slet"
                    cancelText="Annuller"
                />
            )}

            {newProfileModalVisible && (
                <ConfirmationModal
                    onConfirm={confirmNewProfile}
                    onCancel={cancelNewProfile}
                    message="Har du husket at eksportere den nuværende profil? Ændringer kan gå tabt, hvis du fortsætter uden at gemme."
                    title="Ny Profil"
                    variant="warning"
                    confirmText="Fortsæt"
                    cancelText="Annuller"
                />
            )}

            {importProfileModalVisible && (
                <ConfirmationModal
                    onConfirm={confirmImportProfile}
                    onCancel={cancelImportProfile}
                    message="Har du husket at eksportere den nuværende profil? Ændringer kan gå tabt, hvis du fortsætter uden at gemme."
                    title="Importer Profil"
                    variant="warning"
                    confirmText="Importer"
                    cancelText="Annuller"
                />
            )}

            {deleteTabModalVisible && (
                <ConfirmationModal
                    onConfirm={confirmDeleteTab}
                    onCancel={cancelDeleteTab}
                    message="Er du sikker på, at du vil slette dette tab? Det indeholder kister med indhold."
                    title="Bekræft Tab Sletning"
                    variant="danger"
                    confirmText="Slet"
                    cancelText="Annuller"
                />
            )}

            {importCodeModalVisible && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl max-w-lg w-full p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Importer Kode</h2>
                        <p className="text-neutral-400 text-sm mb-4">
                            Indsæt den kode du har modtaget fra en anden bruger herunder.
                        </p>
                        <textarea
                            value={importCodeValue}
                            onChange={(e) => setImportCodeValue(e.target.value)}
                            placeholder="Indsæt kode her..."
                            className="w-full h-32 bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setImportCodeModalVisible(false);
                                    setImportCodeValue('');
                                }}
                                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                            >
                                Annuller
                            </button>
                            <button
                                onClick={processImportCode}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                            >
                                Importer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppProvider>
    );
};
