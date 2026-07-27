// App - the provider stack around the shell
import { DragDropProvider, DragDropSensors } from '@thisbeyond/solid-dnd';
import type { Component } from 'solid-js';
import AppShell from './components/AppShell';
import { pointerWithin } from './dnd/collision';
import { AppProvider } from './stores/app-store';
import { DragProvider } from './stores/drag-store';

import './scss/index.scss';

const App: Component = () => (
    <AppProvider>
        <DragProvider>
            <DragDropProvider collisionDetector={pointerWithin}>
                <DragDropSensors>
                    <AppShell />
                </DragDropSensors>
            </DragDropProvider>
        </DragProvider>
    </AppProvider>
);

export default App;
