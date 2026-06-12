// module/utils.js

/**
 * Utilidades generales del PF2e Statblock Parser
 */

export class PF2eUtils {

    /**
     * Log con prefijo del módulo
     */
    static log(msg) {
        console.log(`PF2e-SBP | ${msg}`);
    }

    /**
     * Elimina espacios dobles, saltos repetidos, tabs… 
     */
    static cleanText(text) {
        if (!text || typeof text !== "string") return "";
        return text
            .replace(/\r/g, "")
            .replace(/\t/g, " ")
            .replace(/ +/g, " ")
            .replace(/\n{2,}/g, "\n")
            .trim();
    }

    /**
     * Intenta extraer un número desde un match regex
     * Devuelve null si no lo encuentra.
     */
    static extractNumber(regex, text) {
        const m = regex.exec(text);
        if (!m) return null;

        const n = parseInt(m[1]);
        return isNaN(n) ? null : n;
    }

    /**
     * Extrae lista de elementos separada por coma
     */
    static extractList(regex, text) {
        const m = regex.exec(text);
        if (!m) return [];

        return m[1]
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    /**
     * Extrae texto bruto (sin dividir)
     */
    static extractText(regex, text) {
        const m = regex.exec(text);
        if (!m) return "";
        return m[1].trim();
    }

    /**
     * Convierte algo a número seguro o null
     */
    static toInt(value) {
        const n = parseInt(value);
        return isNaN(n) ? null : n;
    }

    /**
     * Notificación rápida
     */
    static notify(msg, type = "info") {
        switch (type) {
            case "warn": ui.notifications.warn(msg); break;
            case "error": ui.notifications.error(msg); break;
            default: ui.notifications.info(msg);
        }
    }

    /**
     * Divide el texto en líneas limpias
     */
    static lines(text) {
        if (!text) return [];
        return text.split("\n").map(l => l.trim()).filter(l => l);
    }

    /**
     * Busca una línea que contenga un patrón
     */
    static findLine(lines, pattern) {
        return lines.find(l => l.toLowerCase().includes(pattern.toLowerCase())) || null;
    }

    /**
     * Parsea un ataque tipo PF2e:
     * “Melee [one-action] jaws +12 (reach 10 ft), Damage 2d8+4 piercing”
     * y devuelve un objeto parcial usable para crear un Item PF2e.
     */
    static parseAttackLine(line) {
        // Nombre del ataque
        const nameMatch = line.match(/^\w+(?:\s+\[.*?\])?\s+([\w\s'-]+)/i);
        const attackName = nameMatch ? nameMatch[1].trim() : "Attack";

        // Bonificador
        const attackBonusMatch = line.match(/\+(\d{1,3})/);
        const attackBonus = attackBonusMatch ? parseInt(attackBonusMatch[1]) : null;

        // Daño
        const damageMatch = line.match(/(\d+d\d+(?:[+-]\d+)?)/i);
        const damage = damageMatch ? damageMatch[1] : null;

        // Tipo de daño
        const dtypeMatch = line.match(/(?:damage|daño)[^a-zA-Z]*([a-zA-Z]+)/i);
        const damageType = dtypeMatch ? dtypeMatch[1].toLowerCase() : null;

        return {
            name: attackName,
            attackBonus,
            damage,
            damageType
        };
    }
}
