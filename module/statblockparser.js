// module/statblockparser.js

import { PF2eUtils } from "./utils.js";

const _SKILL_NAMES  = ["acrobatics","arcana","athletics","crafting","deception","diplomacy","intimidation","lore","medicine","nature","occultism","performance","religion","society","stealth","survival","thievery"];
const _STAT_SCALE   = ["extreme","high","moderate","low"];
const _DAMAGE_TYPES = ["bludgeoning","piercing","slashing","acid","cold","electricity","fire","sonic","chaotic","evil","good","lawful","mental","poison","bleed","force","negative","positive","vitality","void"];

/**
 * Parser completo para statblocks de PF2e.
 * Compatible con Foundry V11–V13 y sistema PF2e 5.x+
 */
export class PF2eStatblockParser {

    constructor() {
        this.errors = [];
    }

    /**
     * Punto de entrada principal del parser
     * @param {object} actorData  Datos base del actor (name, type, folder...)
     * @param {string} rawText    Statblock en texto plano
     */
    async parseInput(actorData, rawText) {
        PF2eUtils.log("PF2e-SBP | PF2e Parser > parseInput() (Super robust)");

        if (!rawText || !rawText.trim()) {
            return {
                success: false,
                characterData: { actorData, items: [] },
                errors: [["EmptyInput", "No statblock text provided"]]
            };
        }

        // Texto limpio
        const clean = rawText.replace(/\r/g, "");
        const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);

        // Parsear header
        let actorName = "Imported Creature";
        let actorLevel = 1;
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
            const line = lines[i];
            const m = line.match(/Creature\s+(\d+)/i);
            if (m) {
                actorLevel = Number(m[1]);
                if (line.trim().toLowerCase().startsWith("creature") && i > 0) {
                    actorName = lines[i-1].trim();
                } else {
                    const namePart = line.replace(/Creature\s+\d+/i, "").trim();
                    if (namePart) actorName = namePart;
                    else if (i > 0) actorName = lines[i-1].trim();
                }
                break;
            }
        }
        if (!actorName && lines.length > 0) actorName = lines[0].trim();

        // Parsear atributos principales
        const abilities = {};
        ["str","dex","con","int","wis","cha"].forEach(k => {
            const regex = new RegExp(`${k.charAt(0).toUpperCase()+k.slice(1)}\\s*[:]?\\s*([+\\-]?\\d+)`, "i");
            const m = clean.match(regex);
            abilities[k] = { mod: m ? Number(m[1]) : 0 };
        });

        // AC, HP, Speed
        const acMatch = clean.match(/AC\s*[:]?\s*(\d+)/i);
        const ac = acMatch ? Number(acMatch[1]) : 10;
        const hpMatch = clean.match(/HP\s*[:]?\s*(\d+)/i);
        const hp = hpMatch ? Number(hpMatch[1]) : 1;
        const speedMatch = clean.match(/^Speed\s*[:]?\s*(\d+)/im);
        const speed = speedMatch ? Number(speedMatch[1]) : 25;

        // Perception
        const perceptionMatch = clean.match(/Perception\s*[:]?\s*([+\-]?\d+)/im);
        const perception = perceptionMatch ? Number(perceptionMatch[1]) : 0;

        // Saves
        const fort = clean.match(/Fort(?:itude)?\s*[:]?\s*\+?(\d+)/i);
        const ref = clean.match(/Ref(?:lex)?\s*[:]?\s*\+?(\d+)/i);
        const will = clean.match(/Will\s*[:]?\s*\+?(\d+)/i);

        // Skills
        const skills = {};
        const skillLine = clean.match(/^Skills\s*[:]?\s*(.+)$/im);
        const SKILL_MAP = {
            athletics: "ath", deception: "dec", intimidation: "itm", stealth: "ste", survival: "sur", acrobatics: "acr", arcana: "arc", crafting: "cra", diplomacy: "dip", medicine: "med", nature: "nat", occultism: "occ", performance: "prf", religion: "rel", society: "soc", thievery: "thi"
        };
        if (skillLine) {
            const entries = skillLine[1].split(/\s*,\s*/);
            for (const entry of entries) {
                const m = entry.match(/^([A-Za-z]+)\s+([+\-]?\d+)/);
                if (!m) continue;
                const name = m[1].toLowerCase();
                const bonus = Number(m[2]);
                const key = SKILL_MAP[name];
                if (!key) continue;
                skills[key] = { base: bonus, mod: bonus, visible: true };
            }
        }
        // Inicializar skills faltantes y asegurar estructura
        const ALL_SKILLS = [
            "acr", "arc", "ath", "cra", "dec", "dip", "itm", "med",
            "nat", "occ", "prf", "rel", "soc", "ste", "sur", "thi"
        ];
        ALL_SKILLS.forEach(k => {
            if (!skills[k]) skills[k] = { base: 0, mod: 0, visible: true };
        });

        // Immunities, Weaknesses, Resistances
        const immunities = [];
        const weaknesses = [];
        const resistances = [];
        const linesArr = clean.split("\n").map(l => l.trim());

        const typeSlug = (s) => s.toLowerCase().trim()
            .replace(/\s+damage$/i, "")   // quita "damage" al final
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-]/g, "");

        const parseImmunities = (text) => {
            text.split(",").forEach(e => {
                const t = typeSlug(e);
                if (t) immunities.push({ type: t, exceptions: [] });
            });
        };

        const parseWeaknesses = (text) => {
            text.split(",").forEach(e => {
                // soporta "cold iron 5" y "silver 10"
                const m = e.trim().match(/^(.+?)\s+(\d+)$/);
                if (m) weaknesses.push({ type: typeSlug(m[1]), value: Number(m[2]) });
            });
        };

        const parseResistances = (text) => {
            text.split(",").forEach(e => {
                // soporta "physical 5 (except adamantine)"
                const m = e.trim().match(/^(.+?)\s+(\d+)(?:\s*\(([^)]+)\))?$/);
                if (m) resistances.push({
                    type: typeSlug(m[1]),
                    value: Number(m[2]),
                    exceptions: m[3] ? m[3].replace(/except\s*/i,"").split(/[,\s]+/).map(typeSlug).filter(Boolean) : []
                });
            });
        };

        for (const line of linesArr) {
            const parts = line.split(";").map(p => p.trim());
            for (const part of parts) {
                if (/^Immunities\b/i.test(part))
                    parseImmunities(part.replace(/^Immunities\s*[:]?\s*/i, ""));
                else if (/^Weaknesses\b/i.test(part))
                    parseWeaknesses(part.replace(/^Weaknesses\s*[:]?\s*/i, ""));
                else if (/^Resistances\b/i.test(part))
                    parseResistances(part.replace(/^Resistances\s*[:]?\s*/i, ""));
            }
        }

        // Traits, senses, languages
        const SIZE_CODES = { tiny: "tiny", small: "sm", medium: "med", large: "lg", huge: "huge", gargantuan: "grg" };
        let size = "med";
        let traits = [];
        let senses = [];
        let languages = [];
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].toLowerCase();
            const foundSize = ["tiny","small","medium","large","huge","gargantuan"].find(s => line.includes(s));
            if (foundSize) {
                size = SIZE_CODES[foundSize] || "med";
                traits = line.split(/[\s,;]+/)
                    .map(t => t.replace(/[^a-z0-9\-]/g, "").trim())
                    .filter(t => t && !["creature", foundSize, "neutral", "lawful", "chaotic", "good", "evil", "unaligned"].includes(t));
            }
        }
        // Perception senses
        const perceptionLine = linesArr.find(l => l.toLowerCase().startsWith("perception"));
        if (perceptionLine) {
            const sensesPart = perceptionLine.split(";")[1];
            if (sensesPart) senses = sensesPart.split(",").map(s => s.trim()).filter(Boolean);
        }
        // Languages
        const langLine = linesArr.find(l => l.toLowerCase().startsWith("languages"));
        if (langLine) {
            languages = langLine.replace(/^Languages\s*:?/i, "").split(",").map(l => l.trim()).filter(Boolean);
        }

        // Estructura mínima para evitar crashes
        const actorDataFinal = {
            name: actorName,
            type: "npc",
            system: {
                attributes: {
                    ac: { details: "", value: ac },
                    speed: { value: speed, otherSpeeds: [], details: "" },
                    hp: { details: "", value: hp, max: hp },
                    immunities,
                    weaknesses,
                    resistances,
                    perception: { value: perception },
                },
                abilities,
                perception: { mod: perception },
                saves: {
                    fortitude: { saveDetail: "", value: fort ? Number(fort[1]) : 0 },
                    reflex: { saveDetail: "", value: ref ? Number(ref[1]) : 0 },
                    will: { saveDetail: "", value: will ? Number(will[1]) : 0 }
                },
                details: { level: { value: actorLevel }, publicNotes: "", privateNotes: "" },
                skills,
                traits: {
                    size: { value: size },
                    value: traits,
                    languages: { value: languages, custom: "" }
                }
            }
        };

        // Items embebidos: strikes
        const items = [];
        for (const line of linesArr) {
            const m = line.match(/(Melee|Ranged)\s*(?:\[.*?\]|\u25C6+|1|2|3)?\s*([^\d\+]+?)\s*\+(\d+).*?Damage\s+([0-9d+\-]+)\s*([A-Za-z]+)/i);
            if (!m) continue;
            const name = m[2].trim();
            const bonus = Number(m[3]);
            const damageFormula = m[4];
            const rawType = m[5].toLowerCase();
            items.push({
                type: "melee",
                name,
                img: "systems/pf2e/icons/actions/Strike.webp",
                system: {
                    traits: { value: [] },
                    bonus: { value: bonus },
                    damageRolls: {
                        "0": {
                            damage: damageFormula,
                            damageType: rawType
                        }
                    },
                    weaponType: { value: m[1].toLowerCase() === "ranged" ? "ranged" : "melee" }
                }
            });
        }

        // Items embebidos: habilidades especiales y acciones
        this._parseAbilities(items, linesArr);

        // Partes, reactions y death reaction (pf2e-aztecs-rip-n-tear)
        const parts        = this._parseParts(rawText);
        const reactions    = this._parseDamageReactions(rawText);
        const deathReaction = this._parseDeathReaction(rawText);

        return {
            success: true,
            characterData: { actorData: actorDataFinal, items, parts, reactions, deathReaction },
            errors: this.errors
        };
    }

    // =========================================================================
    // ENRIQUECIMIENTO DE DESCRIPCIONES: inline rolls, saves, condiciones
    // =========================================================================

    _enrichDescription(text) {
        if (!text) return "";
        let r = text;

        // Daño persistente: "2d6 persistent bleed damage" / "2d6 persistent fire damage"
        // DEBE ir ANTES del patrón normal para que el "persistent" no quede suelto
        r = r.replace(
            /(\d+d\d+(?:[+\-]\d+)?)\s+persistent\s+(bleed|slashing|piercing|bludgeoning|fire|cold|electricity|sonic|poison|acid|mental|force|void|vitality)\s*(?:damage)?/gi,
            (_, formula, type) => `[[/r ${formula}[${type.toLowerCase()},persistent]]]`
        );

        // Bleed siempre es persistente aunque no lleve la palabra "persistent"
        // "2d6 bleed damage" → [[/r 2d6[bleed,persistent]]]
        r = r.replace(
            /(\d+d\d+(?:[+\-]\d+)?)\s+bleed\s*(?:damage)?(?!\s*\])/gi,
            (_, formula) => `[[/r ${formula}[bleed,persistent]]]`
        );

        // Daño normal: "2d8+6 bludgeoning" → [[/r 2d8+6[bludgeoning]]]
        r = r.replace(
            /(\d+d\d+(?:[+\-]\d+)?)\s*(slashing|piercing|bludgeoning|fire|cold|electricity|sonic|poison|acid|mental|force|negative|positive|void|vitality|spirit)/gi,
            (_, formula, type) => `[[/r ${formula}[${type.toLowerCase()}]]]`
        );

        // Tirada básica: "DC 22 basic Reflex save" / "DC 22 Reflex save"
        r = r.replace(
            /DC\s*(\d+)\s+(?:basic\s+)?(Reflex|Fortitude|Fort(?:itude)?|Will|Perception)\s+save/gi,
            (_, dc, raw) => {
                const type = /^fort/i.test(raw) ? "fortitude" : raw.toLowerCase();
                return `@Check[type:${type}|dc:${dc}|basic:true]{DC ${dc} ${raw} save}`;
            }
        );

        // Save sin "save": "DC 22 Reflex"
        r = r.replace(
            /\bDC\s*(\d+)\s+(Reflex|Fortitude|Fort(?:itude)?|Will)\b(?!\s*save|\])/gi,
            (_, dc, raw) => {
                const type = /^fort/i.test(raw) ? "fortitude" : raw.toLowerCase();
                return `@Check[type:${type}|dc:${dc}]{DC ${dc} ${raw}}`;
            }
        );

        // IDs extraídos del compendium real pf2e.conditionitems (v7.12.2)
        const COND_UUID = {
            blinded:      "XgEqL1kFApUbl5Z2",
            clumsy:       "i3OJZU2nk64Df3xm",
            concealed:    "DmAIPqOBomZ7H95W",
            confused:     "yblD8fOR1J8rDwEQ",
            dazzled:      "TkIyaNPgTZFBCCuh",
            deafened:     "9PR9y0bi4JPKnHPR",
            doomed:       "3uh1r86TzbQvosxv",
            drained:      "4D2KBtexWXa6oUMR",
            dying:        "yZRUzMqrMmfLu0V1",
            enfeebled:    "MIRkyAjyBeXivMa7",
            fascinated:   "AdPVz7rbaVSRxHFg",
            fatigued:     "HL2l2VRSaQHu9lUw",
            fleeing:      "sDPxOjQ9kx2RZE8D",
            frightened:   "TBSHQspnbcqxsmjL",
            grabbed:      "kWc1fhmv9LBiTuei",
            hidden:       "iU0fEDdBp3rXpTMC",
            immobilized:  "eIcWbB5o3pP6OIMe",
            invisible:    "zJxUflt9np0q4yML",
            "off-guard":  "AJh5ex99aV6VTggg",
            paralyzed:    "6uEgoh53GbXuHpTF",
            petrified:    "dTwPJuKgBQCMxixg",
            prone:        "j91X7x0XSomq8d60",
            quickened:    "nlCjDvLMf2EkV2dl",
            restrained:   "VcDeM8A5oI6VqhbM",
            sickened:     "fesd1n5eVhpCSS18",
            slowed:       "xYTAsEpcJE1Ccni3",
            stunned:      "dfCMdR4wnpbYNTix",
            stupefied:    "e1XGnhKNSQIm5IXg",
            unconscious:  "fBnFDH2MTzgFijKf",
            wounded:      "Yl48xTdMh3aeQYL2",
        };

        const uuid = (cond) => `Compendium.pf2e.conditionitems.Item.${COND_UUID[cond]}`;
        const cap  = (s) => s[0].toUpperCase() + s.slice(1);

        // Condiciones con valor: "Frightened 2"
        for (const cond of ["frightened","stunned","slowed","sickened","stupefied","clumsy","enfeebled","dazzled","doomed","drained","wounded"]) {
            if (!COND_UUID[cond]) continue;
            r = r.replace(
                new RegExp(`\\b${cond}\\s+(\\d+)`, "gi"),
                (_, val) => `@UUID[${uuid(cond)}]{${cap(cond)}${val}}`
            );
        }

        // Condiciones simples (sin valor)
        for (const cond of ["prone","blinded","deafened","concealed","hidden","paralyzed","unconscious","grabbed","immobilized","restrained","fleeing","confused","fatigued","invisible","dying","quickened","off-guard","petrified","fascinated"]) {
            if (!COND_UUID[cond]) continue;
            r = r.replace(
                new RegExp(`\\b${cond}\\b`, "gi"),
                `@UUID[${uuid(cond)}]{${cap(cond)}}`
            );
        }

        return r;
    }

    // =========================================================================
    // HABILIDADES ESPECIALES: parseo multi-línea
    // =========================================================================

    _parseAbilities(items, linesArr) {
        const SKIP = [
            /^(source|recall knowledge|perception|languages|skills)/i,
            /^(str|dex|con|int|wis|cha)\s*[:\+\-]?\s*[+\-]?\d+/i,
            /^ac\s/i,
            /^(fort|ref|will)\s*[+\-]?\d+/i,
            /^hp\s/i,
            /^(immunities|weaknesses|resistances|speed|melee|ranged|items|gear)/i,
            /^creature\s+\d+/i,
            /\bcreature\s+\d+/i,           // "Direwolf Creature 3" (nombre + nivel en misma línea)
            /^(neutral|lawful|chaotic|good|evil|unaligned)\b/i, // línea de alineación/tamaño
            /^(tiny|small|medium|large|huge|gargantuan)\b/i,    // línea de tamaño suelta
            /^(critical success|critical failure|success|failure)\b/i,
            /^PARTS\s*:/i,
            /^---/,                         // separadores de partes aztecs
            /^[A-Z][A-Z\s]{3,}$/, // todo-mayúsculas: "INSTINCT ACTIONS"
            /^\d/,
        ];

        // Palabras que inician descripción, nunca nombre de habilidad
        const DESC_START = /^(the |when |if |each |every |at |all |it |a |an |this |that |which |during |once |while |on |by |after |before |unless |maximum |applies |deal |make |move |stride |once )/i;

        const isStatLine = (l) => SKIP.some(r => r.test(l));

        // Nombre de habilidad = todas las palabras en Title Case, máximo 6 palabras, sin comas internas
        const isTitleCase = (l) => {
            // comas internas → línea de traits/alineación, no es un nombre de habilidad
            if (/,/.test(l.replace(/\(.*?\)/g, ""))) return false;
            const clean = l.replace(/\[.*?\]/g, "").replace(/\(.*?\)/g, "").replace(/[.:]$/, "").trim();
            const words = clean.split(/\s+/);
            // los dígitos solos (ej: "3" en "Creature 3") no cuentan como Title Case
            if (words.some(w => /^\d+$/.test(w))) return false;
            return words.length >= 1 && words.length <= 6 && words.every(w => !w || /^[A-Z]/.test(w));
        };

        const isHeader = (l) => {
            if (!l || !/^[A-Z]/.test(l)) return false;
            if (isStatLine(l)) return false;
            if (DESC_START.test(l)) return false;
            // marcador explícito de acción → siempre es cabecera
            if (/\[(one|two|three|free|reaction|one-action|two-actions|three-actions)[^\]]*\]/i.test(l)) return true;
            // tiene paréntesis de coste/rasgos y es corta
            if (/\([^)]+\)/.test(l) && l.length < 60) return true;
            // título corto en Title Case
            if (isTitleCase(l)) return true;
            return false;
        };

        let i = 0;
        while (i < linesArr.length) {
            const line = linesArr[i];
            if (!line || !isHeader(line)) { i++; continue; }

            // Parsear cabecera — regex greedy para capturar nombre completo
            const headerMatch = line.match(/^([A-Z][^\[\(]+)(?:\[([^\]]+)\])?(?:\(([^)]+)\))?\s*(.*)$/);
            if (!headerMatch) { i++; continue; }

            let name = headerMatch[1].trim();
            const actionText = (headerMatch[2] || "").toLowerCase();
            const traitsText = headerMatch[3] || "";
            const descFirst = headerMatch[4] || "";

            name = name.replace(/[:.\s]+$/, "").trim();
            if (!name) { i++; continue; }

            // Recolectar líneas de descripción
            i++;
            const descLines = descFirst ? [descFirst] : [];
            while (i < linesArr.length) {
                const next = linesArr[i];
                if (!next) { i++; continue; }
                if (isStatLine(next)) break;
                if (isHeader(next)) break;
                descLines.push(next);
                i++;
            }

            // Tipo de acción
            let actionType = "passive";
            let actions = null;
            if (/reaction/.test(actionText)) {
                actionType = "reaction";
            } else if (/free/.test(actionText)) {
                actionType = "free";
            } else if (/one|1/.test(actionText)) {
                actionType = "action"; actions = 1;
            } else if (/two|2/.test(actionText)) {
                actionType = "action"; actions = 2;
            } else if (/three|3/.test(actionText)) {
                actionType = "action"; actions = 3;
            }

            const traits = traitsText
                ? traitsText.split(",").map(t => this.slugifyTrait(t.trim())).filter(Boolean)
                : [];

            items.push(this.buildActionItem(name, actionType, actions, this._enrichDescription(descLines.join(" ")), traits));
        }
    }

    // =========================================================================
    // PARTES DEL MONSTRUO (pf2e-aztecs-rip-n-tear)
    // =========================================================================

    _parseParts(rawText) {
        const partsStart = rawText.search(/^PARTS\s*:/im);
        if (partsStart === -1) return [];

        let partsSection = rawText.slice(partsStart);
        const partsEnd = partsSection.search(/^(?:DAMAGE REACTIONS?|DEATH REACTION)\s*:/im);
        if (partsEnd > -1) partsSection = partsSection.slice(0, partsEnd);
        const partBlocks = partsSection.split(/^---\s*/m).slice(1);

        // Common aliases → valid PF2e condition slugs
        const COND_ALIASES = {
            "movement penalty":  "slowed",
            "penalty movement":  "slowed",
            "reduced movement":  "slowed",
            "slow":              "slowed",
            "no movement":       "immobilized",
            "cant move":         "immobilized",
            "can't move":        "immobilized",
            "blind":             "blinded",
            "deafen":            "deafened",
            "off guard":         "off-guard",
            "flatfooted":        "off-guard",
            "flat-footed":       "off-guard",
            "flat footed":       "off-guard",
            "stun":              "stunned",
            "paralyze":          "paralyzed",
            "petrify":           "petrified",
            "confuse":           "confused",
            "sicken":            "sickened",
            "slow down":         "slowed",
            "daze":              "stunned",
        };

        const parseCondStr = (text) => {
            const conditions = [];
            text.split(",").forEach(c => {
                let raw = c.trim().toLowerCase();
                // resolve alias (longest match first)
                const sorted = Object.keys(COND_ALIASES).sort((a, b) => b.length - a.length);
                for (const alias of sorted) {
                    if (raw === alias || raw.startsWith(alias + " ")) {
                        raw = raw.replace(alias, COND_ALIASES[alias]);
                        break;
                    }
                }
                // slug + optional value: "slowed 2", "blinded", "off-guard"
                const m = raw.match(/^([\w][\w\-]*(?:\s[\w\-]+)?)\s*(\d+)?$/);
                if (!m) return;
                const slug = m[1].trim().replace(/\s+/g, "-");
                conditions.push({ slug, value: m[2] ? Number(m[2]) : 1 });
            });
            return conditions;
        };

        const makeThreshold = (hpValue, condText) => ({
            hpValue,
            conditions: parseCondStr(condText),
            effects: [], macros: [], damages: [], ruleElements: [],
            linkedParts: [], disableAbilities: false, customDescription: ""
        });

        const parts = [];
        for (const block of partBlocks) {
            const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
            if (!lines.length) continue;

            const name = lines[0].replace(/---\s*$/, "").trim();
            if (!name) continue;

            let hp = 10;
            let acAdjustment = 0;
            let immune = "";
            let weak = "";
            let resist = "";
            const thresholds = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];

                const hpM = line.match(/^HP\s*[:]?\s*(\d+)/i);
                if (hpM) { hp = Number(hpM[1]); continue; }

                const acM = line.match(/^AC\s*[:]?\s*([+\-]?\d+)/i);
                if (acM) { acAdjustment = Number(acM[1]); continue; }

                const immM = line.match(/^Immunit(?:y|ies)\s*[:]?\s*(.+)/i);
                if (immM) { immune = immM[1].trim(); continue; }

                const weakM = line.match(/^Weakness(?:es)?\s*[:]?\s*(.+)/i);
                if (weakM) { weak = weakM[1].trim(); continue; }

                const resM = line.match(/^Resistance(?:s)?\s*[:]?\s*(.+)/i);
                if (resM) { resist = resM[1].trim(); continue; }

                // "Destroy: blinded, slowed 2"  →  threshold at hpValue 0
                const destroyM = line.match(/^(?:Destroy|On Destroy|At 0|Destroyed)\s*[:]?\s*(.+)/i);
                if (destroyM) {
                    thresholds.push(makeThreshold(0, destroyM[1]));
                    continue;
                }

                // "Threshold 10: frightened 2, prone"
                const thrM = line.match(/^Threshold\s+(\d+)\s*[:]?\s*(.+)/i);
                if (thrM) {
                    thresholds.push(makeThreshold(Number(thrM[1]), thrM[2]));
                    continue;
                }
            }

            parts.push({
                id: foundry.utils.randomID(),
                name,
                hp: { value: hp, max: hp },
                acAdjustment,
                saves: {
                    fortitude: { enabled: false, adjustment: 0 },
                    reflex: { enabled: false, adjustment: 0 },
                    will: { enabled: false, adjustment: 0 }
                },
                iwr: { immune, weak, resist, immuneExc: "", weakExc: "", resistExc: "" },
                customIWR: !!(immune || weak || resist),
                thresholds,
                linkedItems: [], linkedEntries: [], linkedSpells: [],
                useRupture: false, dealsDamage: false,
                persistentDealsDamage: false, failedRuptureDealsDamage: false,
                removeEffectsOnFullHeal: false,
                acceptedDmgTypes: [], isHidden: false
            });
        }

        return parts;
    }

    // =========================================================================
    // REACTIONS / DEATH REACTION (pf2e-aztecs-rip-n-tear)
    // =========================================================================

    _parseReactionTriggers(lines) {
        const triggers = [];

        const parseTarget = (s) => {
            const t = s.trim().toLowerCase();
            if (t.startsWith("aura")) {
                const m = t.match(/aura\s*(\d+)?/);
                return { target: "aura", radius: m?.[1] ? Number(m[1]) : 30, targetFilters: "enemies" };
            }
            if (/trigger|attacker/.test(t)) return { target: "triggerer" };
            return { target: "self" };
        };

        const parseDur = (s) => {
            if (!s) return { durationValue: -1, durationUnit: "unlimited" };
            const d = s.trim().toLowerCase();
            if (/unlimited|permanent/.test(d)) return { durationValue: -1, durationUnit: "unlimited" };
            const m = d.match(/(\d+)\s*(round|minute|hour)/);
            if (m) return { durationValue: Number(m[1]), durationUnit: m[2] + "s", expiry: "turn-end" };
            return { durationValue: -1, durationUnit: "unlimited" };
        };

        const parseDmgChunks = (rawParts) => {
            const damages = [];
            for (let i = 1; i < rawParts.length; i++) {
                const chunk = rawParts[i];
                // Formato enricher: [[/r 2d6[bleed]]] o [[/r 2d6[bleed,persistent]]]
                const enrichM = chunk.match(/\[\[\/r\s*(\d+)d(\d+)(?:[+\-]\d+)?\[([^\]]+)\]\]\]/i);
                if (enrichM) {
                    const tags = enrichM[3].split(",").map(t => t.trim().toLowerCase());
                    const isPersistent = tags.includes("persistent");
                    const dmgType = tags.find(t => t !== "persistent") || "slashing";
                    damages.push({ diceNum: Number(enrichM[1]), diceStep: enrichM[2], dmgType, dmgCategory: (isPersistent || dmgType === "bleed") ? "persistent" : "" });
                    continue;
                }
                // Formato texto: "2d6 persistent bleed" / "2d6 bleed" / "2d6 fire"
                const textM = chunk.match(/^(\d+)d(\d+)(?:[+\-]\d+)?\s+(?:(persistent)\s+)?([\w\-]+)/i);
                if (textM) {
                    const dmgType = textM[4].toLowerCase();
                    const isPersistent = textM[3] || dmgType === "bleed";
                    damages.push({ diceNum: Number(textM[1]), diceStep: textM[2], dmgType, dmgCategory: isPersistent ? "persistent" : "" });
                }
            }
            return damages;
        };

        // pendingEffect: accumulated Effect line waiting for optional Save:
        let pendingEffect = null;  // { targetInfo, conditions, durRaw }
        // pendingSave: standalone Save: waiting for Damage: (basic save)
        let pendingSave = null;    // { saveType, dc, isBasicSave }
        let pendingDur = null;

        const flushPendingEffect = () => {
            if (!pendingEffect) return;
            const dur = parseDur(pendingEffect.durRaw ?? pendingDur);
            for (const c of pendingEffect.conditions) {
                triggers.push({ type: "condition", ...pendingEffect.targetInfo, ...c, ...dur });
            }
            pendingEffect = null;
        };

        for (const line of lines) {
            // Duration: can attach to a pending effect or stand alone
            const durM = line.match(/^Duration\s*[:]?\s*(.+)/i);
            if (durM) {
                if (pendingEffect) pendingEffect.durRaw = durM[1];
                else pendingDur = durM[1];
                continue;
            }

            // Save: DC N Type [basic]
            // Pattern A (with pending Effect): Effect conditions → saving-throw with saveActions.failure
            // Pattern B (standalone): Save accumulates, next Damage provides target + basicDamages
            const saveM = line.match(/^Save\s*[:]?\s*DC\s*(\d+)\s+(fortitude|fort(?:itude)?|reflex|will)/i);
            if (saveM) {
                const dc = Number(saveM[1]);
                const saveType = /^fort/i.test(saveM[2]) ? "fortitude" : saveM[2].toLowerCase();
                const isBasicSave = /basic/i.test(line);

                if (pendingEffect) {
                    // Pattern A: Effect + Save → saving-throw with conditions on failure
                    const dur = parseDur(pendingEffect.durRaw ?? pendingDur);
                    const failConds = pendingEffect.conditions.map(c => ({ type: "condition", slug: c.slug, value: c.value }));
                    triggers.push({
                        type: "saving-throw",
                        ...pendingEffect.targetInfo,
                        saveType, dc, isBasicSave,
                        basicDamages: [], damages: [],
                        saveActions: { criticalSuccess: [], success: [], failure: failConds, criticalFailure: failConds },
                        ...dur
                    });
                    pendingEffect = null;
                    pendingDur = null;
                } else {
                    // Pattern B: standalone Save → wait for Damage line
                    pendingSave = { saveType, dc, isBasicSave };
                }
                continue;
            }

            // Effect: target, condition [value]...
            const effM = line.match(/^Effect\s*[:]?\s*(.+)/i);
            if (effM) {
                flushPendingEffect();
                pendingSave = null;
                const rawParts = effM[1].split(",").map(p => p.trim());
                const targetInfo = parseTarget(rawParts[0]);
                const conditions = [];
                for (let i = 1; i < rawParts.length; i++) {
                    const m = rawParts[i].match(/^([\w][\w\-]*(?:\s[\w\-]+)?)\s*(\d+)?$/);
                    if (!m) continue;
                    const slug = m[1].trim().replace(/\s+/g, "-").toLowerCase();
                    conditions.push({ slug, value: m[2] ? Number(m[2]) : 1 });
                }
                if (conditions.length) {
                    pendingEffect = { targetInfo, conditions, durRaw: pendingDur };
                    pendingDur = null;
                }
                continue;
            }

            // Damage: target, NdM [persistent] type
            const dmgM = line.match(/^Damage\s*[:]?\s*(.+)/i);
            if (dmgM) {
                flushPendingEffect();
                const rawParts = dmgM[1].split(",").map(p => p.trim());
                const targetInfo = parseTarget(rawParts[0]);
                const damages = parseDmgChunks(rawParts);

                if (damages.length) {
                    if (pendingSave) {
                        // Pattern B: Save + Damage → basic saving-throw
                        triggers.push({
                            type: "saving-throw",
                            ...targetInfo,
                            ...pendingSave,
                            basicDamages: damages, damages: [],
                            saveActions: { criticalSuccess: [], success: [], failure: [], criticalFailure: [] },
                            durationValue: -1, durationUnit: "unlimited"
                        });
                        pendingSave = null;
                    } else {
                        triggers.push({ type: "damage", ...targetInfo, damages });
                    }
                }
                pendingDur = null;
                continue;
            }
        }

        flushPendingEffect();
        return triggers;
    }

    _parseDamageReactions(rawText) {
        const start = rawText.search(/^DAMAGE REACTIONS?\s*:/im);
        if (start === -1) return [];

        let section = rawText.slice(start);
        const end = section.search(/^(?:DEATH REACTION|PARTS)\s*:/im);
        if (end > -1) section = section.slice(0, end);

        const reactions = [];
        for (const block of section.split(/^---\s*/m).slice(1)) {
            const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
            if (!lines.length) continue;

            const name = lines[0].replace(/---\s*$/, "").trim();
            if (!name) continue;

            let actionType = "reaction";
            let minDamage = 0;
            let damageTypes = [];

            for (const line of lines.slice(1)) {
                const tM = line.match(/^Trigger\s*[:]?\s*(\d+)(?:\s+([\w\-]+))?/i);
                if (tM) {
                    minDamage = Number(tM[1]);
                    if (tM[2] && !/^damage$/i.test(tM[2])) damageTypes = [tM[2].toLowerCase()];
                }
                const aM = line.match(/^Action\s*[:]?\s*(reaction|free)/i);
                if (aM) actionType = aM[1].toLowerCase();
            }

            reactions.push({
                id: foundry.utils.randomID(),
                name, actionType, minDamage, damageTypes,
                disabled: false, reactTo: "both", allParts: true, specificParts: [],
                sfxTrigger: "", playSfxNoTarget: false,
                conditionals: { onlyMelee: false, onlyUnarmed: false, onlyMagical: false, onlyPhysical: false, requiredRollOptions: "" },
                triggers: this._parseReactionTriggers(lines.slice(1))
            });
        }

        return reactions;
    }

    _parseDeathReaction(rawText) {
        const start = rawText.search(/^DEATH REACTION\s*:/im);
        if (start === -1) return null;

        const headerMatch = rawText.slice(start).match(/^DEATH REACTION\s*:[^\n]*/i);
        let section = rawText.slice(start + headerMatch[0].length);
        const end = section.search(/^(?:PARTS|DAMAGE REACTIONS?)\s*:/im);
        if (end > -1) section = section.slice(0, end);

        const lines = section.split("\n").map(l => l.trim()).filter(Boolean);
        if (!lines.length) return null;

        const nameM = lines.find(l => /^Name\s*[:]?/i.test(l));
        const name = nameM ? nameM.replace(/^Name\s*[:]?\s*/i, "").trim() : "Death Reaction";

        return {
            name, actionType: "reaction",
            useDelay: false, delayRounds: 1, expiry: "turn-end",
            disabled: false, sfxTrigger: "", playSfxNoTarget: false,
            triggers: this._parseReactionTriggers(lines)
        };
    }

    // Métodos de parseo adaptados para builderStats
    parseAbilityModifiersToBuilder(builderStats, text) {
        const abilMap = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
        for (const [key, label] of Object.entries(abilMap)) {
            const regex = new RegExp(`${label}\\s*[:]?\\s*([+\\-]?\\d+)`, "i");
            const m = text.match(regex);
            if (m) {
                // Convertir el valor numérico a la escala del builder
                builderStats[key].value = this.mapStatToBuilderScale(Number(m[1]));
            }
        }
    }

    parseACAndSavesToBuilder(builderStats, text) {
        const acMatch = text.match(/AC\s*[:]?\s*(\d+)/i);
        if (acMatch) builderStats.ac.value = this.mapStatToBuilderScale(Number(acMatch[1]));
        const fort = text.match(/Fort(?:itude)?\s*[:]?\s*\+?(\d+)/i);
        if (fort) builderStats.fort.value = this.mapStatToBuilderScale(Number(fort[1]));
        const ref = text.match(/Ref(?:lex)?\s*[:]?\s*\+?(\d+)/i);
        if (ref) builderStats.ref.value = this.mapStatToBuilderScale(Number(ref[1]));
        const will = text.match(/Will\s*[:]?\s*\+?(\d+)/i);
        if (will) builderStats.will.value = this.mapStatToBuilderScale(Number(will[1]));
    }

    parseHPToBuilder(builderStats, text) {
        const hpMatch = text.match(/HP\s*[:]?\s*(\d+)/i);
        if (hpMatch) builderStats.hp.value = this.mapHPToBuilderScale(Number(hpMatch[1]), builderStats.level);
    }

    parseSpeedToBuilder(builderStats, text) {
        const m = text.match(/^Speed\s*[:]?\s*(.+)$/im);
        if (m) builderStats.speed = m[1].trim();
    }

    parsePerceptionToBuilder(builderStats, text) {
        const m = text.match(/Perception\s*[:]?\s*([+\-]?\d+)/im);
        if (m) builderStats.perception.value = this.mapStatToBuilderScale(Number(m[1]));
    }

    parseSkillsToBuilder(builderStats, text) {
        const match = text.match(/^Skills\s*[:]?\s*(.+)$/im);
        if (!match) return;
        const body = match[1];
        const entries = body.split(/\s*,\s*/);
        let i = 1;
        for (const entry of entries) {
            const m = entry.match(/^([A-Za-z]+)\s+([+\-]?\d+)/);
            if (!m) continue;
            const name = m[1].toLowerCase();
            const bonus = Number(m[2]);
            builderStats.skills[`skill${i}`] = {
                trained: true,
                name,
                value: this.mapStatToBuilderScale(bonus),
                allowedNames: _SKILL_NAMES,
                allowedValues: _STAT_SCALE
            };
            i++;
        }
        builderStats.skillsCount = i - 1;
    }

    parseStrikesToBuilder(builderStats, lines) {
        let i = 1;
        for (const line of lines) {
            const lower = line.toLowerCase();
            if (!lower.startsWith("melee") && !lower.startsWith("ranged")) continue;
            const m = line.match(/(Melee|Ranged)\s*(?:\[.*?\]|\u25C6+|1|2|3)?\s*([^\d\+]+?)\s*\+(\d+).*?Damage\s+([0-9d+\-]+)\s*([A-Za-z]+)/i);
            if (!m) continue;
            const name = m[2].trim();
            const bonus = Number(m[3]);
            const damageFormula = m[4];
            const rawType = m[5].toLowerCase();
            builderStats.strikes[`strike${i}`] = {
                enabled: true,
                name,
                bonus: {
                    value: this.mapStatToBuilderScale(bonus),
                    allowedValues: _STAT_SCALE
                },
                damage: {
                    value: this.mapDamageToBuilderScale(damageFormula, builderStats.level),
                    allowedValues: _STAT_SCALE
                },
                range: {
                    value: lower.startsWith("ranged") ? "ranged" : "melee",
                    allowedValues: ["melee", "ranged"]
                },
                type: {
                    value: rawType,
                    allowedValues: _DAMAGE_TYPES
                }
            };
            i++;
        }
        builderStats.strikesCount = i - 1;
    }

    // Mapeo de valores numéricos a escala del builder
    mapStatToBuilderScale(value) {
        // Ejemplo simple: puedes ajustar los rangos según las tablas
        if (value >= 8) return 'extreme';
        if (value >= 5) return 'high';
        if (value >= 2) return 'moderate';
        return 'low';
    }

    mapHPToBuilderScale(hp, level) {
        // Ejemplo simple: puedes ajustar los rangos según las tablas
        if (hp > 200) return 'high';
        if (hp > 100) return 'moderate';
        return 'low';
    }

    mapDamageToBuilderScale(damageFormula, level) {
        // Ejemplo simple: puedes ajustar según la tabla de StatTables
        // Aquí podrías analizar el daño y mapearlo
        return 'moderate';
    }

    // =========================================================================
    // ESTRUCTURA MÍNIMA PF2E PARA EVITAR CRASHES DE SHEET
    // =========================================================================

    ensureMinimalPF2eStructure(actorData) {
        actorData.system ??= {};
        const sys = actorData.system;

        // Detalles básicos
        sys.details ??= {};
        sys.details.level ??= { value: 0 };
        sys.details.publicNotes ??= "";
        sys.details.privateNotes ??= "";

        // Rasgos
        sys.traits ??= {};
        sys.traits.size ??= "medium";
        sys.traits.value ??= [];
        sys.traits.senses ??= [];
        sys.traits.languages ??= { value: [], custom: "" };

        // Atributos
        sys.attributes ??= {};
        sys.attributes.perception ??= { value: 0 };
        sys.attributes.ac ??= { value: 10 };
        sys.attributes.hp ??= { value: 1, max: 1 };
        sys.attributes.speed ??= { value: "25 feet" };
        sys.attributes.immunities ??= [];
        sys.attributes.weaknesses ??= [];
        sys.attributes.resistances ??= [];

        // Salvaciones
        sys.saves ??= {};
        sys.saves.fortitude ??= { value: 0 };
        sys.saves.reflex ??= { value: 0 };
        sys.saves.will ??= { value: 0 };

        // Habilidades (skills): inicializar todas las skills requeridas por PF2e
        const ALL_SKILLS = [
            "acr", "arc", "ath", "cra", "dec", "dip", "itm", "med",
            "nat", "occ", "prf", "rel", "soc", "ste", "sur", "thi"
        ];
        sys.skills ??= {};
        for (const skill of ALL_SKILLS) {
            sys.skills[skill] ??= { value: 0, visible: true };
        }

        // Habilidades básicas
        ["str","dex","con","int","wis","cha"].forEach(k => {
            sys.abilities[k] ??= { mod: 0 };
        });

        // Inventario + monedas (clave para evitar el error de "coins")
        sys.inventory ??= {};
        sys.inventory.coins ??= {
            pp: 0,
            gp: 0,
            sp: 0,
            cp: 0
        };
    }

    // =========================================================================
    // HEADER: "Werewolf Alpha creature 10"
    // =========================================================================

    parseHeader(actorData, lines) {
        // Busca "Creature X" en las primeras 3 líneas para manejar headers de varias líneas
        let levelFound = false;
        for (let i = 0; i < Math.min(lines.length, 3); i++) {
            const line = lines[i];
            const m = line.match(/Creature\s+(\d+)/i);
            if (m) {
                actorData.system ??= {};
                actorData.system.details ??= {};
                actorData.system.details.level = { value: Number(m[1]) };
                levelFound = true;
                
                // Si la línea es SOLO "Creature X", el nombre es la línea anterior
                if (line.trim().toLowerCase().startsWith("creature") && i > 0) {
                    actorData.name = lines[i-1].trim();
                } else {
                    // "Werewolf Creature 3" en la misma línea
                    const namePart = line.replace(/Creature\s+\d+/i, "").trim();
                    if (namePart) actorData.name = namePart;
                    else if (i > 0) actorData.name = lines[i-1].trim();
                }
                break;
            }
        }
        
        // Si no se encontró nivel, usar primera línea como nombre por defecto
        if (!levelFound && lines.length > 0) {
            actorData.name = lines[0].trim();
        }
    }

    // =========================================================================
    // ALIGNMENT + SIZE + TRAITS
    // =========================================================================

    parseAlignmentTraitsSize(actorData, lines) {
        const sizes = ["tiny","small","medium","large","huge","gargantuan"];
        // Alignment ya no es core en Remaster, pero lo mantenemos por compatibilidad
        const alignments = ["lg","ng","cg","ln","n","cn","le","ne","ce"];
        
        let foundLine = "";
        
        // Buscar línea que contenga un tamaño (ej: "Huge Dragon Fire Primal")
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].toLowerCase();
            if (sizes.some(s => line.includes(s))) {
                foundLine = lines[i];
                break;
            }
        }
        
        if (!foundLine) return;
        
        const tokens = foundLine.split(/\s+/).filter(Boolean);
        const traits = [];
        let size = "medium";
        
        for (const t of tokens) {
            const lower = t.toLowerCase();
            if (sizes.includes(lower)) {
                size = lower;
            } else if (lower !== "creature" && !/^\d+$/.test(lower) && !alignments.includes(lower)) {
                traits.push(this.slugifyTrait(t));
            }
        }
        
        actorData.system.traits.size = { value: size };
        actorData.system.traits.value = traits;
    }

    // =========================================================================
    // PERCEPTION + SENSES
    // =========================================================================

    parsePerceptionAndSenses(actorData, text) {
        // Busca Perception con formato flexible (con o sin dos puntos)
        const m = text.match(/Perception\s*[:]?\s*([+\-]?\d+)\s*;?\s*(.*)$/im);
        if (!m) return;

        const bonus = Number(m[1]);
        // Toma el resto de la línea como sentidos
        const rest = m[2] ? m[2].split("\n")[0].trim() : "";

        actorData.system.attributes.perception = { value: bonus };

        if (rest) {
            const senses = rest.split(",").map(s => s.trim()).filter(Boolean);
            actorData.system.traits.senses = senses;
        }
    }

    // =========================================================================
    // SKILLS
    // =========================================================================

    parseSkills(actorData, text) {
        // Busca la línea de Skills/Habilidades
        const match = text.match(/^Skills\s*[:]?\s*(.+)$/im);
        if (!match) return;

        const body = match[1];
        const entries = body.split(/\s*,\s*/);

        const SKILL_MAP = {
            athletics: "ath",
            deception: "dec",
            intimidation: "itm",
            stealth: "ste",
            survival: "sur",
            acrobatics: "acr",
            arcana: "arc",
            crafting: "cra",
            diplomacy: "dip",
            medicine: "med",
            nature: "nat",
            occultism: "occ",
            performance: "prf",
            religion: "rel",
            society: "soc",
            thievery: "thi"
        };

        for (const entry of entries) {
            const m = entry.match(/^([A-Za-z]+)\s+([+\-]?\d+)/);
            if (!m) continue;

            const name = m[1].toLowerCase();
            const bonus = Number(m[2]);
            const key = SKILL_MAP[name];
            if (!key) continue;

            actorData.system.skills[key] = {
                value: bonus,
                visible: true
            };
        }
    }

    // =========================================================================
    // ABILITY MODIFIERS: "Str +7, Dex +4, Con +5, Int -1, Wis +3, Cha +3"
    // =========================================================================

    parseAbilityModifiers(actorData, text) {
        // Busca cada atributo individualmente para ser más robusto ante formatos variados
        // Ejemplo: "Str +5, Dex +2..." o "Str +5; Dex +2"
        const abilMap = { str: "Str", dex: "Dex", con: "Con", int: "Int", wis: "Wis", cha: "Cha" };
        
        for (const [key, label] of Object.entries(abilMap)) {
            // Busca "Str +X" o "Str: +X"
            const regex = new RegExp(`${label}\\s*[:]?\\s*([+\\-]?\\d+)`, "i");
            const m = text.match(regex);
            if (m) {
                actorData.system.abilities[key] = { mod: Number(m[1]) };
            }
        }
    }

    // =========================================================================
    // AC + SAVES: "AC 29; Fort +22, Ref +19, Will +16"
    // =========================================================================

    parseACAndSaves(actorData, text) {
        // AC: Busca "AC" seguido de un número, ignorando puntuación intermedia
        const acMatch = text.match(/AC\s*[:]?\s*(\d+)/i);
        if (acMatch) {
            actorData.system.attributes.ac = { value: Number(acMatch[1]) };
        }

        // Saves: Busca Fort, Ref, Will independientemente, permitiendo cualquier separador
        const fort = text.match(/Fort(?:itude)?\s*[:]?\s*\+?(\d+)/i);
        const ref = text.match(/Ref(?:lex)?\s*[:]?\s*\+?(\d+)/i);
        const will = text.match(/Will\s*[:]?\s*\+?(\d+)/i);

        if (fort) actorData.system.saves.fortitude = { value: Number(fort[1]) };
        if (ref) actorData.system.saves.reflex = { value: Number(ref[1]) };
        if (will) actorData.system.saves.will = { value: Number(will[1]) };
    }

    // =========================================================================
    // HP + DEFENSAS: "HP 220; Immunities ...; Weaknesses ...; Resistances ..."
    // =========================================================================

    parseHPAndDefenses(actorData, text) {
        // HP: Busca "HP" seguido de número
        const hpMatch = text.match(/HP\s*[:]?\s*(\d+)/i);
        if (hpMatch) {
            const hp = Number(hpMatch[1]);
            actorData.system.attributes.hp = { value: hp, max: hp };
        }

        // Reiniciar arrays
        actorData.system.attributes.immunities = [];
        actorData.system.attributes.weaknesses = [];
        actorData.system.attributes.resistances = [];

        // Escanear líneas para encontrar inmunidades/debilidades que pueden estar en líneas separadas
        const lines = text.split("\n").map(l => l.trim());
        for (const line of lines) {
            // También soporta si están en la misma línea separadas por ;
            const parts = line.split(";").map(p => p.trim());
            for (const part of parts) {
                if (/^Immunities/i.test(part)) {
                    this.parseImmunities(actorData, part.replace(/^Immunities\s*[:]?\s*/i, ""));
                } else if (/^Weaknesses/i.test(part)) {
                    this.parseWeaknesses(actorData, part.replace(/^Weaknesses\s*[:]?\s*/i, ""));
                } else if (/^Resistances/i.test(part)) {
                    this.parseResistances(actorData, part.replace(/^Resistances\s*[:]?\s*/i, ""));
                }
            }
        }
    }

    parseImmunities(actorData, text) {
        const entries = text.split(",").map(e => e.trim()).filter(Boolean);
        for (const e of entries) {
            const m = e.match(/(.+?)\s+damage/i);
            if (!m) continue;

            actorData.system.attributes.immunities.push({
                type: this.slugifyTrait(m[1]),
                exceptions: []
            });
        }
    }

    parseWeaknesses(actorData, text) {
        const entries = text.split(",").map(e => e.trim()).filter(Boolean);
        for (const e of entries) {
            const m = e.match(/([A-Za-z\-]+)\s+(\d+)/);
            if (!m) continue;

            actorData.system.attributes.weaknesses.push({
                type: this.slugifyTrait(m[1]),
                value: Number(m[2])
            });
        }
    }

    parseResistances(actorData, text) {
        const entries = text.split(",").map(e => e.trim()).filter(Boolean);
        for (const e of entries) {
            const m = e.match(/([A-Za-z\-]+)\s+(\d+)/);
            if (!m) continue;

            actorData.system.attributes.resistances.push({
                type: this.slugifyTrait(m[1]),
                value: Number(m[2])
            });
        }
    }

    // =========================================================================
    // SPEED: "Speed 25 feet"
    // =========================================================================

    parseSpeed(actorData, text) {
        // Busca Speed/Velocidad
        const m = text.match(/^Speed\s*[:]?\s*(.+)$/im);
        if (!m) return;

        actorData.system.attributes.speed = { value: m[1].trim() };
    }

    // =========================================================================
    // HABILIDADES ESPECIALES (bloques tipo "Curse of the Werewolf (traits)")
    // =========================================================================

    parseAbilitiesFromBlocks(items, text) {
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        
        // Prefijos de líneas que NO son habilidades
        const skipPrefixes = [
            "source", "recall knowledge", "perception", "languages", "skills",
            "str", "dex", "con", "int", "wis", "cha",
            "ac", "fort", "ref", "will", "hp", "immunities", "weaknesses", "resistances",
            "speed", "melee", "ranged", "items", "gear"
        ];

        for (const line of lines) {
            const lower = line.toLowerCase();
            if (skipPrefixes.some(p => lower.startsWith(p))) continue;
            if (/^creature \d+$/i.test(line)) continue; // Saltar línea de nivel
            
            // Regex flexible para capturar: Nombre [Action] (Traits) Descripción
            // Grupo 1: Nombre (hasta encontrar [ o ( o el final si no hay)
            // Grupo 2: Action (opcional, dentro de [])
            // Grupo 3: Traits (opcional, dentro de ())
            // Grupo 4: Descripción (resto de la línea)
            const match = line.match(/^([A-Z][^\[\(]+?)(?:\s*\[(.*?)\])?(?:\s*\(([^)]+)\))?\s*(.*)$/);
            
            if (match) {
                let name = match[1].trim();
                const actionText = match[2]; 
                const traitsText = match[3];
                const desc = match[4] || "";
                
                // Si no hay indicadores claros y el nombre es muy largo, probablemente sea texto basura o descripción continuada
                if (!actionText && !traitsText && name.length > 60) continue;

                // Detectar tipo de acción
                let actionType = "passive";
                let actions = null;
                
                if (actionText) {
                    const lowerAct = actionText.toLowerCase();
                    if (lowerAct.includes("reaction")) actionType = "reaction";
                    else if (lowerAct.includes("free")) actionType = "free";
                    else if (lowerAct.includes("one") || lowerAct.includes("1")) { actionType = "action"; actions = 1; }
                    else if (lowerAct.includes("two") || lowerAct.includes("2")) { actionType = "action"; actions = 2; }
                    else if (lowerAct.includes("three") || lowerAct.includes("3")) { actionType = "action"; actions = 3; }
                }
                
                // Traits
                const traits = traitsText ? traitsText.split(",").map(t => this.slugifyTrait(t.trim())) : [];
                
                // Limpieza final del nombre
                name = name.replace(/[:.]$/, "").trim();

                items.push(this.buildActionItem(name, actionType, actions, desc, traits));
            }
        }
    }

    // =========================================================================
    // STRIKES: "Melee [[A]] claw +21 (agile), Damage 2d6+10 slashing"
    // =========================================================================

    parseStrikes(items, lines) {
        // Regex mejorado para soportar [one-action] y variantes
        const strikeRegex =
            /(Melee|Ranged)\s*(?:\[.*?\]|\u25C6+|1|2|3)?\s*([^\d\+]+?)\s*\+(\d+).*?Damage\s+([0-9d+\-]+)\s*([A-Za-z]+)/i;

        const validDamageTypes = [
            "slashing","piercing","bludgeoning",
            "fire","cold","electricity","sonic",
            "poison","acid","mental","force",
            "negative","positive"
        ];

        const damageTypeMap = {
            "b": "bludgeoning",
            "p": "piercing",
            "s": "slashing"
        };

        for (const line of lines) {
            const lower = line.toLowerCase();
            if (!lower.startsWith("melee") && !lower.startsWith("ranged")) continue;

            const m = strikeRegex.exec(line);
            if (!m) {
                this.errors.push(["StrikeParse", `Cannot parse strike line: ${line}`]);
                continue;
            }

            const name = m[2].trim();
            const bonus = Number(m[3]);
            const damageFormula = m[4];
            const rawType = m[5].toLowerCase();

            const damageType = validDamageTypes.includes(rawType)
                ? rawType
                : (damageTypeMap[rawType] || "piercing");

            items.push({
                type: "melee",
                name,
                img: "systems/pf2e/icons/actions/Strike.webp",
                system: {
                    traits: { value: [] },
                    bonus: { value: bonus },
                    damageRolls: {
                        "0": { // Usar ID "0" es más seguro que "basic" en versiones nuevas
                            damage: damageFormula,
                            damageType
                        }
                    },
                    weaponType: { value: lower.startsWith("ranged") ? "ranged" : "melee" }
                }
            });
        }
    }

    // =========================================================================
    // CREACIÓN DE ITEM DE ACCIÓN (PF2e moderno)
    // =========================================================================

    buildActionItem(name, actionType, actions, description, traits = []) {
        const allowed = ["action","reaction","free","passive"];
        const finalActionType = allowed.includes(actionType) ? actionType : "passive";

        let actionData = { value: null };
        if (finalActionType === "action") {
            const val = actions && actions >= 1 && actions <= 3 ? actions : 1;
            actionData = { value: val };
        }

        return {
            type: "action",
            name,
            img: "systems/pf2e/icons/actions/Passive.webp",
            system: {
                actionType: { value: finalActionType },
                actions: actionData,
                traits: { value: traits },
                description: { value: description || "" }
            }
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    findLineStarting(text, prefix) {
        const lowerPrefix = prefix.toLowerCase();
        return text
            .split("\n")
            .map(l => l.trim())
            .find(l => l.toLowerCase().startsWith(lowerPrefix));
    }

    slugifyTrait(t) {
        return t
            .toLowerCase()
            .replace(/[()]/g, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-]/g, "");
    }
}
