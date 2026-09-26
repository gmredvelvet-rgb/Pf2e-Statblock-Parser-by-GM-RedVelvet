// main.js — PF2E Statblock Parser (Foundry V13–V14, PF2e 7.x–8.x)

import { PF2eStatblockParser } from "./statblockparser.js";
import { PF2eTextInputDialog } from "./text-input.js";
import { PF2eUtils } from "./utils.js";
import { initParsers } from "./parsers.js";

class PF2eSBProgram {

    /**
     * El ActorDirectory es ApplicationV2 desde v13: `html` es un HTMLElement, y un render
     * parcial de la cabecera la reemplaza entera, así que el botón se vuelve a añadir.
     * Con clase y no id: el directorio puede estar abierto a la vez en la barra y en popout.
     */
    static ensureParseStatblockVisible(app, html) {
        if (!game.user.isGM) return;
        const headerActions = html?.querySelector?.(".directory-header .header-actions");
        if (!headerActions) {
            console.warn("PF2e-SBP | No se encontró cabecera (.header-actions) en Actor Directory.");
            return;
        }
        if (headerActions.querySelector(".pf2e-sbp-import")) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pf2e-sbp-import";
        btn.dataset.tooltip = "Import PF2e Statblock";
        btn.innerHTML = `<i class="fa-solid fa-file-import" inert></i><span>Import Statblock</span>`;
        btn.addEventListener("click", (ev) => { ev.preventDefault(); PF2eSBProgram.openParser(); });
        headerActions.append(btn);
    }

    static async openParser(folderId = null) {
        try {
            const result = await PF2eTextInputDialog.textInputDialog({ title: "Import Statblock de PF2e" });
            if (!result.result) return;

            const text = result.text.trim();
            if (!text) { ui.notifications.warn("No statblock was entered."); return; }

            const parser = new PF2eStatblockParser();
            const parsed = await parser.parseInput({ name: "Imported Creature", type: "npc", folder: folderId, system: {} }, text);

            if (!parsed.success) { ui.notifications.error("The statblock could not be parsed."); return; }

            const actorData    = parsed.characterData.actorData;
            const items        = parsed.characterData.items ?? [];
            const parts        = parsed.characterData.parts ?? [];
            const reactions    = parsed.characterData.reactions ?? [];
            const deathReaction = parsed.characterData.deathReaction ?? null;
            const errors       = parsed.errors ?? [];

            const actor = await Actor.create(actorData);
            if (!actor) { ui.notifications.error("Error creating the PF2e actor."); return; }

            for (const item of items) {
                try { delete item._id; await actor.createEmbeddedDocuments("Item", [item]); }
                catch (err) { console.error("PF2e-SBP | Error creando item:", err); errors.push(["Item", err]); }
            }

            await PF2eSBProgram.applyAztecsData(actor, actorData, parts, reactions, deathReaction);

            actor.sheet.render(true);
            if (errors.length > 0) PF2eSBProgram.logErrors(errors);

        } catch (err) {
            console.error("PF2E-SBP | Fatal:", err);
            ui.notifications.error("Fatal error while creating the NPC. Check the console.");
        }
    }

    static async applyAztecsData(actor, actorData, parts, reactions, deathReaction) {
        if (!parts.length && !reactions.length && !deathReaction) return;

        const aztecsActive  = game.modules.get("pf2e-aztecs-rip-n-tear")?.active;
        const aztecsEnabled = game.settings.get("pf2e-statblock-parser", "aztecsMode");

        if (!aztecsActive || !aztecsEnabled) {
            ui.notifications.warn("Aztecs data detected but pf2e-aztecs-rip-n-tear is not active or the mode is disabled.");
            return;
        }

        if (parts.length > 0) {
            const partHPSum = parts.reduce((s, p) => s + (p.hp?.max ?? 0), 0);
            const monsterHP = actorData.system?.attributes?.hp?.max ?? 0;
            if (monsterHP > 0 && partHPSum !== monsterHP) {
                ui.notifications.warn(
                    `Parts HP total (${partHPSum}) ≠ Monster HP (${monsterHP}). Adjust in the RIP & TEAR panel.`,
                    { permanent: true }
                );
            }
            await actor.setFlag("pf2e-aztecs-rip-n-tear", "parts", parts);
            PF2eUtils.log(`PF2e-SBP | ${parts.length} parts applied.`);
        }

        if (reactions.length > 0) {
            await actor.setFlag("pf2e-aztecs-rip-n-tear", "reactions", reactions);
            PF2eUtils.log(`PF2e-SBP | ${reactions.length} damage reactions applied.`);
        }

        if (deathReaction) {
            await actor.setFlag("pf2e-aztecs-rip-n-tear", "deathReaction", deathReaction);
            PF2eUtils.log("PF2e-SBP | Death reaction applied.");
        }

        const total = parts.length + reactions.length + (deathReaction ? 1 : 0);
        ui.notifications.info(`Aztecs: ${total} element(s) imported.`);
    }

    static logErrors(errors) {
        if (!errors.length) return;
        let msg = "";
        for (const e of errors) {
            const text = `Failed: "${e[0]}" — (${e[1]})`;
            PF2eUtils.log("  > " + text);
            msg += text + "<br/>";
        }
        ui.notifications.error("Some items failed to parse:<br>" + msg, { permanent: true });
    }
}

Hooks.on("renderActorDirectory", (app, html) => {
    PF2eSBProgram.ensureParseStatblockVisible(app, html);
});

// Los ajustes se registran en init, como espera Foundry: así existen antes del primer
// render del sidebar y la ventana de importación puede leerlos sin comprobar nada.
Hooks.once("init", () => {
    game.settings.register("pf2e-statblock-parser", "aztecsMode", {
        name: "Enable Body Parts parsing (pf2e-aztecs-rip-n-tear)",
        hint: "If the pf2e-aztecs-rip-n-tear module is active, enable parsing of monsters with individual body parts (HP and AC per part).",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
});

Hooks.once("ready", () => {
    initParsers();
    PF2eUtils.log("PF2e Statblock Parser inicializado.");
});
