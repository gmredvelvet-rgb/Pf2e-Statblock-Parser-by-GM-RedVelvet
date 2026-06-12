// module/parsers.js

import { PF2eStatblockParser } from "./statblockparser.js";

/**
 * Registro general de parsers disponibles
 * (por ahora solo tenemos el estándar PF2e)
 */
export const PF2E_PARSERS = {
    pf2e: {
        id: "pf2e",
        name: "PF2e Standard",
        cls: PF2eStatblockParser
    }
};

/**
 * Punto de inicialización.
 * En el futuro podrías añadir:
 * - importadores de AoN
 * - importadores de Herolab
 * - importadores de Markdown
 */
export function initParsers() {
    console.log("PF2e-SBP | Parsers initialized:", Object.keys(PF2E_PARSERS));
}

/**
 * Obtiene una instancia del parser indicado
 */
export function getParser(formatId = "pf2e") {
    const entry = PF2E_PARSERS[formatId];
    if (!entry) {
        ui.notifications.warn(`Parser '${formatId}' no encontrado. Usando PF2e estándar.`);
        return new PF2eStatblockParser();
    }
    return new entry.cls();
}
