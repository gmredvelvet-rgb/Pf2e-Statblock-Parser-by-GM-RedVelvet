// main.js — PF2E Statblock Parser — FINAL VERSION (PF2e 5.x + Foundry V13 Ready)

import { PF2eStatblockParser } from "./statblockparser.js";
import { PF2eTextInputDialog } from "./text-input.js";
import { PF2eUtils } from "./utils.js";
import { initParsers } from "./parsers.js";

class PF2eSBProgram {

    static ensureParseStatblockVisible(app, html) {
        if (!game.user.isGM) return;
        const el = html[0] ?? html;
        if (!el?.querySelector) return;
        if (el.querySelector("#PF2E-SBP-button")) return;

        const headerActions = el.querySelector(".header-actions") || el.querySelector(".action-buttons");
        if (!headerActions) {
            console.warn("PF2e-SBP | No se encontró cabecera (.header-actions) en Actor Directory.");
            return;
        }

        const btn = document.createElement("button");
        btn.id = "PF2E-SBP-button";
        btn.classList.add("header-control");
        btn.innerHTML = `<i class="fas fa-file-import"></i> Import Statblock`;
        btn.title = "Import PF2e Statblock";
        btn.type = "button";
        btn.onclick = (ev) => { ev.preventDefault(); PF2eSBProgram.openParser(); };
        headerActions.appendChild(btn);
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

Hooks.on("ready", () => {
    game.settings.register("pf2e-statblock-parser", "aztecsMode", {
        name: "Enable Body Parts parsing (pf2e-aztecs-rip-n-tear)",
        hint: "If the pf2e-aztecs-rip-n-tear module is active, enable parsing of monsters with individual body parts (HP and AC per part).",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
    initParsers();
    PF2eUtils.log("PF2e Statblock Parser inicializado.");
});
