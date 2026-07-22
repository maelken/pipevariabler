import { VARIABLER_CSV_URL, VARIABLER_DATA_JSON_URL } from './constants';

export interface VariablerEntry {
    item: string;
    variable: string;
}

const parseCsvLine = (line: string): string[] => {
    const fields: string[] = [];
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

export const parseVariablerCsv = (csv: string): VariablerEntry[] => {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const entries: VariablerEntry[] = [];

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

const parseVariablerJson = (data: unknown): VariablerEntry[] => {
    if (!data || typeof data !== 'object') return [];

    const items = (data as { items?: unknown }).items;
    if (!Array.isArray(items)) return [];

    return items
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;

            const record = entry as { item?: unknown; variable?: unknown; variabel?: unknown };
            const item = typeof record.item === 'string' ? record.item.trim() : '';
            const variable = typeof record.variable === 'string'
                ? record.variable.trim()
                : typeof record.variabel === 'string'
                    ? record.variabel.trim()
                    : '';

            if (!item || !variable) return null;
            return { item, variable };
        })
        .filter((entry): entry is VariablerEntry => entry !== null);
};

export const fetchVariablerEntries = async (): Promise<VariablerEntry[]> => {
    try {
        const jsonResponse = await fetch(VARIABLER_DATA_JSON_URL);
        if (jsonResponse.ok) {
            const data = await jsonResponse.json();
            const entries = parseVariablerJson(data);
            if (entries.length > 0) return entries;
        }
    } catch (error) {
        console.warn('Kunne ikke hente variabler som JSON:', error);
    }

    const csvResponse = await fetch(VARIABLER_CSV_URL);
    if (!csvResponse.ok) {
        throw new Error(`Kunne ikke hente variabler (${csvResponse.status})`);
    }

    const csv = await csvResponse.text();
    const entries = parseVariablerCsv(csv);
    if (entries.length === 0) {
        throw new Error('Ingen variabler fundet i CSV-data');
    }

    return entries;
};
