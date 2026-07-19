import { useState, useCallback } from 'react';
import { Tab, Profile, Chest } from '../types';
import { processItems } from '../itemUtils';
import { repairProfileEncoding } from '../encodingUtils';

interface UseProfileManagerProps {
    tabs: Tab[];
    setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
    profileName: string;
    setProfileName: React.Dispatch<React.SetStateAction<string>>;
    activeTabId: number;
    setActiveTabId: React.Dispatch<React.SetStateAction<number>>;
    setShowAll: React.Dispatch<React.SetStateAction<boolean>>;
    setProfileVersion: React.Dispatch<React.SetStateAction<number>>;
    setUndoStack: React.Dispatch<React.SetStateAction<Tab[][]>>;
    setRedoStack: React.Dispatch<React.SetStateAction<Tab[][]>>;
}

export const useProfileManager = ({
    tabs,
    setTabs,
    profileName,
    setProfileName,
    activeTabId,
    setActiveTabId,
    setShowAll,
    setProfileVersion,
    setUndoStack,
    setRedoStack,
}: UseProfileManagerProps) => {
    const [pendingProfile, setPendingProfile] = useState<Profile | null>(null);
    const [importProfileModalVisible, setImportProfileModalVisible] = useState(false);
    const [newProfileModalVisible, setNewProfileModalVisible] = useState(false);
    const [deleteTabModalVisible, setDeleteTabModalVisible] = useState(false);
    const [tabToDelete, setTabToDelete] = useState<number | null>(null);
    const [presetModalVisible, setPresetModalVisible] = useState(false);
    const [pendingPresetName, setPendingPresetName] = useState<string | null>(null);

    const getNextChestId = useCallback(() => {
        let maxId = 0;
        tabs.forEach(tab => tab.chests.forEach(chest => { if (chest.id > maxId) maxId = chest.id; }));
        return maxId + 1;
    }, [tabs]);

    const handleImportProfile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const fileReader = new FileReader();
        fileReader.onload = () => {
            try {
                const profile = repairProfileEncoding(JSON.parse(fileReader.result as string));
                setPendingProfile(profile);
                setImportProfileModalVisible(true);
            } catch (e) {
                console.error('Error parsing import file:', e);
                alert('Fejl ved læsning af fil: ' + e);
            }
        };
        if (event.target.files && event.target.files.length > 0) {
            fileReader.readAsText(event.target.files[0], 'UTF-8');
        }
    }, []);

    const handleExportProfile = useCallback(() => {
        const profile: Profile = { name: profileName, tabs };
        const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${profileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [profileName, tabs]);

    const confirmNewProfile = () => {
        setUndoStack(prev => [...prev, tabs]);
        setRedoStack([]);
        const defaultChest: Chest = { id: 1, label: 'Min første kiste', items: [], icon: 'barrel', checked: false };
        const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: [defaultChest] };
        setTabs([defaultTab]);
        setActiveTabId(1);
        setProfileName('Ny Profil');
        setShowAll(true);
        setNewProfileModalVisible(false);
        setProfileVersion(v => v + 1);
    };

    const createNewProfile = useCallback(() => {
        if (tabs.some(tab => tab.chests.length > 0)) {
            setNewProfileModalVisible(true);
        } else {
            setUndoStack(prev => [...prev, tabs]);
            setRedoStack([]);
            const defaultChest: Chest = { id: 1, label: 'Min første kiste', items: [], icon: 'barrel', checked: false };
            const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: [defaultChest] };
            setTabs([defaultTab]);
            setActiveTabId(1);
            setProfileName('Ny Profil');
            setShowAll(true);
            setProfileVersion(v => v + 1);
        }
    }, [tabs, setTabs, setActiveTabId, setProfileName, setShowAll, setProfileVersion, setUndoStack, setRedoStack]);

    const cancelNewProfile = () => setNewProfileModalVisible(false);

    const confirmImportProfile = () => {
        if (!pendingProfile) return;
        setUndoStack(prev => [...prev, tabs]);
        setRedoStack([]);
        tabs.forEach(tab => tab.chests.forEach(chest => localStorage.removeItem(`chest-checked-${chest.id}`)));
        setProfileName(pendingProfile.name || 'Imported Profile');

        if (pendingProfile.tabs && Array.isArray(pendingProfile.tabs)) {
            let globalChestId = 1;
            const processedTabs = pendingProfile.tabs.map((tab: any) => ({
                ...tab,
                chests: (tab.chests || []).map((chest: any) => ({
                    ...chest,
                    id: globalChestId++,
                    icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                    checked: chest.checked || false,
                    items: chest.items || [],
                }))
            }));
            setTabs(processedTabs);
            setActiveTabId(processedTabs[0]?.id || 1);
        } else if (pendingProfile.chests && Array.isArray(pendingProfile.chests)) {
            const processedChests = pendingProfile.chests.map((chest: any, index: number) => ({
                ...chest,
                id: index + 1,
                icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                checked: chest.checked || false,
                items: chest.items || [],
            }));
            const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: processedChests };
            setTabs([defaultTab]);
            setActiveTabId(1);
        } else {
            // Fallback
            const defaultChest: Chest = { id: 1, label: 'Min første kiste', items: [], icon: 'barrel', checked: false };
            const defaultTab: Tab = { id: 1, name: 'Tab 1', chests: [defaultChest] };
            setTabs([defaultTab]);
            setActiveTabId(1);
        }

        setPendingProfile(null);
        setImportProfileModalVisible(false);
        setProfileVersion(v => v + 1);
    };

    const cancelImportProfile = () => { setPendingProfile(null); setImportProfileModalVisible(false); };

    // Preset loading internal function wrapped in useCallback
    const confirmLoadPresetInternal = useCallback(async (presetName: string) => {
        try {
            const response = await fetch(`${import.meta.env.BASE_URL}presets/${presetName}.json`);
            if (!response.ok) throw new Error('Failed to load preset');
            const preset = await response.json();

            setUndoStack(prev => [...prev, tabs]);
            setRedoStack([]);
            tabs.forEach(tab => tab.chests.forEach(chest => localStorage.removeItem(`chest-checked-${chest.id}`)));
            setProfileName(preset.name || presetName);

            let globalChestId = 1;

            if (preset.tabs) {
                let tabId = 1;
                const processedTabs = preset.tabs.map((tab: { id?: number; name: string; chests: Partial<Chest>[] }) => ({
                    ...tab,
                    id: tabId++,
                    chests: tab.chests.map((chest) => ({
                        ...chest,
                        id: globalChestId++,
                        icon: chest.icon ? chest.icon.replace('.png', '') : 'barrel',
                        checked: chest.checked || false,
                        items: processItems(chest.items || [])
                    }))
                }));
                setTabs(processedTabs as Tab[]);
                setActiveTabId(processedTabs[0]?.id || 1);
            } else if (preset.chests) {
                const processedChests = preset.chests.map((chest: Partial<Chest>) => ({
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

            setProfileVersion(prev => prev + 1);
        } catch (error) {
            console.error('Error loading preset:', error);
            alert('Fejl ved indlæsning af skabelon');
        }
    }, [tabs, setUndoStack, setRedoStack, setProfileName, setTabs, setActiveTabId, setProfileVersion]);

    // Preset loading with confirmation
    const loadPreset = useCallback((presetName: string) => {
        if (tabs.some(tab => tab.chests.some(chest => chest.items.length > 0))) {
            setPendingPresetName(presetName);
            setPresetModalVisible(true);
        } else {
            confirmLoadPresetInternal(presetName);
        }
    }, [tabs, confirmLoadPresetInternal]);

    const confirmLoadPreset = () => {
        if (pendingPresetName) {
            confirmLoadPresetInternal(pendingPresetName);
            setPendingPresetName(null);
            setPresetModalVisible(false);
        }
    };

    const cancelLoadPreset = () => {
        setPendingPresetName(null);
        setPresetModalVisible(false);
    };

    const addTab = useCallback(() => {
        const newTabId = Math.max(...tabs.map(tab => tab.id), 0) + 1;
        const nextChestId = getNextChestId();
        const defaultChest: Chest = { id: nextChestId, label: 'Min første kiste', items: [], icon: 'barrel', checked: false };
        const newTab: Tab = { id: newTabId, name: `Tab ${newTabId}`, chests: [defaultChest] };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTabId);
    }, [tabs, getNextChestId, setTabs, setActiveTabId]);

    const moveTab = useCallback((fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;
        setTabs(prev => {
            const newTabs = [...prev];
            const [removed] = newTabs.splice(fromIndex, 1);
            newTabs.splice(toIndex, 0, removed);
            return newTabs;
        });
    }, [setTabs]);


    const handleDeleteTab = useCallback((tabId: number) => {
        const newTabs = tabs.filter(tab => tab.id !== tabId);
        setTabs(newTabs);
        if (activeTabId === tabId) setActiveTabId(newTabs[0]?.id || 1);
        setDeleteTabModalVisible(false);
    }, [tabs, activeTabId, setTabs, setActiveTabId]);

    const removeTab = useCallback((tabId: number) => {
        if (tabs.length === 1) return;
        const tabToRemove = tabs.find(tab => tab.id === tabId);
        if (tabToRemove && tabToRemove.chests.some(chest => chest.items.length > 0)) {
            setTabToDelete(tabId);
            setDeleteTabModalVisible(true);
        } else {
            handleDeleteTab(tabId);
        }
    }, [tabs, handleDeleteTab]);

    const confirmDeleteTab = () => {
        if (tabToDelete !== null) {
            handleDeleteTab(tabToDelete);
            setTabToDelete(null);
        }
    };

    const cancelDeleteTab = () => { setTabToDelete(null); setDeleteTabModalVisible(false); };

    const updateTabName = useCallback((tabId: number, name: string) => {
        setTabs(prev => prev.map(tab => (tab.id === tabId ? { ...tab, name } : tab)));
    }, [setTabs]);

    return {
        pendingProfile,
        importProfileModalVisible,
        newProfileModalVisible,
        deleteTabModalVisible,
        presetModalVisible,
        tabToDelete,
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
    };
};
