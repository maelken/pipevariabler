import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
    // hot: false = ingen solid-refresh komponent-HMR, alle aendringer giver
    // fuld reload. Solid-refresh har gentagne gange genskabt komponenter uden
    // deres context-providers midt i en session ("useApp must be used within
    // AppProvider", doede drag-handlers). App-state ligger i localStorage, saa
    // en fuld reload koster intet.
    plugins: [solidPlugin({ hot: false })],
    base: '/',
    build: {
        outDir: 'build',
        target: 'esnext'
    },
    resolve: {
        conditions: ['development', 'browser']
    }
});
