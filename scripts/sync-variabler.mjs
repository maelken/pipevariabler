#!/usr/bin/env node

/**
 * Synkroniserer src/data.json med variabler fra variabler.maelk.net.
 * Bevarer eksisterende billeder og tilføjer nye items med standard-billede.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../src/data.json');
const VARIABLER_DATA_JSON_URL = 'https://variabler.maelk.net/data.json';
const VARIABLER_CSV_URL = 'https://variabler.maelk.net/export?format=csv';

const parseCsvLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    fields.push(current);
    return fields;
};

const parseCsv = (csv) => {
    const lines = csv.trim().split(/\r?\n/);
    const entries = [];

    for (const line of lines.slice(1)) {
        if (!line.trim()) continue;
        const [item = '', variable = ''] = parseCsvLine(line);
        const normalizedItem = item.trim();
        const normalizedVariable = variable.trim();
        if (!normalizedItem || !normalizedVariable) continue;
        entries.push({ item: normalizedItem, variable: normalizedVariable });
    }

    return entries;
};

const parseJson = (data) => {
    if (!data?.items || !Array.isArray(data.items)) return [];

    return data.items
        .map((entry) => {
            const item = typeof entry.item === 'string' ? entry.item.trim() : '';
            const variable = typeof entry.variable === 'string'
                ? entry.variable.trim()
                : typeof entry.variabel === 'string'
                    ? entry.variabel.trim()
                    : '';

            if (!item || !variable) return null;
            return { item, variable };
        })
        .filter(Boolean);
};

const fetchEntries = async () => {
    try {
        const jsonResponse = await fetch(VARIABLER_DATA_JSON_URL);
        if (jsonResponse.ok) {
            const data = await jsonResponse.json();
            const entries = parseJson(data);
            if (entries.length > 0) return entries;
        }
    } catch (error) {
        console.warn('JSON-hentning fejlede, prøver CSV:', error.message);
    }

    const csvResponse = await fetch(VARIABLER_CSV_URL);
    if (!csvResponse.ok) {
        throw new Error(`CSV-hentning fejlede (${csvResponse.status})`);
    }

    const entries = parseCsv(await csvResponse.text());
    if (entries.length === 0) {
        throw new Error('Ingen variabler fundet');
    }

    return entries;
};

const main = async () => {
    console.log('Henter variabler fra variabler.maelk.net...');
    const remoteEntries = await fetchEntries();

    const existingData = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const imageByItem = new Map(
        (existingData.items || []).map((entry) => [entry.item, entry.image])
    );

    const items = remoteEntries.map((entry) => ({
        item: entry.item,
        variable: entry.variable,
        image: imageByItem.get(entry.item) || `${entry.item}.png`,
    }));

    fs.writeFileSync(DATA_PATH, `${JSON.stringify({ items }, null, 4)}\n`, 'utf8');
    console.log(`Opdateret ${items.length} items i ${DATA_PATH}`);
};

main().catch((error) => {
    console.error('Synkronisering fejlede:', error.message);
    process.exit(1);
});
