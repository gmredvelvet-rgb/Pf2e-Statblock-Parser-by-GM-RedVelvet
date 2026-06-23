// module/text-input.js

// ─────────────────────────────────────────────────────────────────────────────
// EJEMPLO NORMAL — demuestra TODAS las funciones del parser estándar:
//   header, alineación/tamaño/rasgos, percepción+sentidos, idiomas, skills,
//   atributos, AC/saves, HP, Speed, inmunidades/debilidades/resistencias
//   (con excepciones), ataques cuerpo a cuerpo y a distancia,
//   pasivo, acción 1/2/3, reacción, acción libre,
//   dados inline, tiradas de salvación inline, condiciones stackeables y simples
// ─────────────────────────────────────────────────────────────────────────────
const EXAMPLE_NORMAL = `Thornback Wyvern                      Creature 7
Neutral Evil, Large Dragon

Perception +15; darkvision, scent (imprecise) 60 ft.
Languages Draconic
Skills Athletics +17, Intimidation +13, Stealth +13, Survival +15
Str +6, Dex +2, Con +4, Int -2, Wis +3, Cha +1
AC 24; Fort +17, Ref +13, Will +14
HP 115
Speed 25, fly 60

Immunities paralyzed, sleep
Weaknesses cold 10
Resistances fire 5, piercing 5 (except cold iron)

Melee [one-action] Jaws +17 (reach 10 ft.), Damage 2d8+9 piercing
Melee [one-action] Stinger +17 (agile, reach 10 ft.), Damage 2d6+9 piercing
Ranged [one-action] Spine Shot +15 (range 60 ft.), Damage 2d4+6 piercing

Venomous Spines
Any creature that strikes the wyvern with a non-reach melee weapon must succeed a DC 23 Fortitude save or take 2d6 poison damage and become sickened 1.

Predator's Instinct
The wyvern gains a +2 circumstance bonus to Perception checks against hidden or concealed creatures. It ignores the concealed condition when attacking creatures it has scented.

Darting Strike [one-action] (move)
The wyvern Strides up to half its Speed, then makes a Jaws Strike. This movement does not trigger reactions.

Stinging Volley [two-actions] (attack, poison)
The wyvern launches a barrage of venomous spines. All creatures in a 30-foot cone must attempt a DC 24 Reflex save. On a failure, they take 4d6+8 piercing damage and become off-guard until the end of their next turn. On a critical failure, they also become frightened 2.

Lethal Dive [three-actions] (attack, move)
The wyvern flies up to its fly Speed and then makes a Stinger Strike. If it moved at least 20 feet before striking, it deals an additional 2d6 piercing damage and the target must succeed a DC 24 Fortitude save or become stunned 1. The wyvern then lands in an adjacent space.

Spine Counter [reaction]
Trigger: A creature within reach makes a melee attack against the wyvern.
The wyvern lashes its tail, making a Stinger Strike against the triggering creature. On a hit, the creature is also knocked prone.

Poison Burst [free-action] (poison)
Trigger: The wyvern takes fire damage.
The heat causes the wyvern's venom sacs to rupture. All creatures within 10 feet take 3d6 poison damage (DC 23 basic Fortitude save). Creatures that fail become sickened 2; those that critically fail are also paralyzed for 1 round.`;

// ─────────────────────────────────────────────────────────────────────────────
// EJEMPLO AZTECS — incluye lo anterior MÁS:
//   PARTS: cada parte con HP, AC (ajuste), Immunity, Weakness, Resistance,
//          Threshold N (debuff al llegar a N HP), Destroy (alias de Threshold 0)
//   DAMAGE REACTIONS: cada reacción con Trigger (daño mínimo + tipo opcional),
//          Action (reaction/free), opciones de trigger:
//          A) Save: DC N Type [basic]  +  Damage: → salvación con daño básico
//          B) Effect: target, condición  +  Save: DC N Type → condición si falla
//          C) Effect: target, condición  +  Damage: → automático (sin salvación)
//   DEATH REACTION: Name, Effect, Duration, Damage
//
//   REGLA HP: la suma de HP de todas las partes debe ser igual al HP del monstruo
//             (300 = 40+120+45+45+25+25 en este ejemplo)
// ─────────────────────────────────────────────────────────────────────────────
const EXAMPLE_AZTECS = `Frostfang Dire Wolf                Creature 5
Neutral, Large Beast

Perception +14; low-light vision, scent (imprecise) 60 ft.
Languages —
Skills Acrobatics +12, Athletics +15, Stealth +11, Survival +13
Str +5, Dex +3, Con +4, Int -3, Wis +2, Cha +1

AC 22
Fort +15, Ref +12, Will +10

HP 100

Speed 40 ft.

Immunities cold
Weaknesses fire 5

Melee [one-action] Jaws +15 (reach 10 ft.)
Damage 2d10+7 piercing plus Knockdown

Melee [one-action] Claw +15 (agile)
Damage 2d6+7 slashing

Frozen Breath [two-actions] (cold)
30-foot cone
DC 22 Reflex
4d8 cold damage

Ice Pounce [two-actions]
Stride twice and make a Jaws Strike.

PARTS:
Maximum HP Pool: 100

--- Head ---
HP: 15
AC: +3
Threshold 8: dazzled
Destroy: blinded

--- Torso ---
HP: 35
AC: 0
Resistance: physical 5
Threshold 18: slowed 1
Destroy: slowed 2

--- Left Foreleg ---
HP: 10
AC: +1
Threshold 5: clumsy 1
Destroy: slowed 1

--- Right Foreleg ---
HP: 10
AC: +1
Threshold 5: clumsy 1
Destroy: slowed 1

--- Left Hind Leg ---
HP: 10
AC: 0
Threshold 5: slowed 1
Destroy: knocked prone

--- Right Hind Leg ---
HP: 10
AC: 0
Threshold 5: slowed 1
Destroy: knocked prone

--- Tail ---
HP: 10
AC: +2
Threshold 5: off-guard
Destroy: loses Ice Pounce

DAMAGE REACTIONS:

--- Ice Shards ---
Trigger: 20
Action: free
Save: DC 22 Reflex basic
Damage: aura 10, 2d6 cold

--- Frozen Blood ---
Trigger: 30
Action: reaction
Effect: aura 15 difficult terrain
Duration: 1 round

--- Howl of Pain ---
Trigger: Head Destroyed
Action: reaction
Effect: aura 30 frightened 1
Save: DC 22 Will

DEATH REACTION:

Name: Frozen Collapse

Effect: aura 20, prone
Save: DC 22 Reflex
Damage: aura 20, 5d8 cold

Critical Failure:
prone and immobilized 1 round`;

/**
 * Dialog para ingresar el statblock PF2e
 */
export class PF2eTextInputDialog extends FormApplication {

    constructor(options = {}) {
        super(options);
        this.resolver = options.resolve ?? null;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "pf2e-statblock-input",
            title: "Enter PF2e Statblock",
            template: "modules/pf2e-statblock-parser/templates/text-input.html",
            width: 620,
            height: "auto",
            closeOnSubmit: false,
            submitOnChange: false
        });
    }

    static async textInputDialog(options = {}) {
        return new Promise(resolve => {
            const dlg = new PF2eTextInputDialog({
                title: options.title || "Enter PF2e Statblock",
                resolve
            });
            dlg.render(true);
        });
    }

    getData() {
        const settingReady = game.settings.settings.has("pf2e-statblock-parser.aztecsMode");
        const aztecsMode = settingReady
            ? game.settings.get("pf2e-statblock-parser", "aztecsMode") &&
              !!(game.modules.get("pf2e-aztecs-rip-n-tear")?.active)
            : false;

        return {
            formats: [
                { id: "pf2e", name: "PF2e Standard" }
            ],
            aztecsMode
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find("#sbp-copy-example").on("click", () => {
            navigator.clipboard.writeText(EXAMPLE_NORMAL).then(() => {
                ui.notifications.info("Example statblock copied to clipboard.");
            }).catch(() => {
                html.find("textarea[name='statblock']").val(EXAMPLE_NORMAL);
            });
        });

        html.find("#sbp-copy-aztecs-example").on("click", () => {
            navigator.clipboard.writeText(EXAMPLE_AZTECS).then(() => {
                ui.notifications.info("Parts example statblock copied to clipboard.");
            }).catch(() => {
                html.find("textarea[name='statblock']").val(EXAMPLE_AZTECS);
            });
        });
    }

    async _updateObject(event, formData) {
        const text = (formData.statblock || "").trim();
        const format = formData.dataFormat || "pf2e";

        if (!text) {
            ui.notifications.warn("No ingresaste ningún statblock.");
            return;
        }

        if (this.resolver) {
            this.resolver({ result: true, text, dataFormat: format });
        }

        this.close();
    }

    close(options = {}) {
        if (this.resolver) {
            this.resolver({ result: false });
        }
        return super.close(options);
    }
}
