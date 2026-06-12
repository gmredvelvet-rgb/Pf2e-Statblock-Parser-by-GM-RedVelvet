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
const EXAMPLE_AZTECS = `Iron Colossus                         Creature 12
Neutral, Huge Construct

Perception +22; darkvision, tremorsense (imprecise) 60 ft.
Languages —
Skills Athletics +26, Intimidation +22
Str +9, Dex -1, Con +7, Int -4, Wis +4, Cha +0
AC 32; Fort +25, Ref +17, Will +20
HP 300
Speed 30

Immunities bleed, death effects, disease, doomed, drained, fatigued, mental, paralyzed, poison, unconscious
Weaknesses electricity 15, vitality 15
Resistances physical 10 (except adamantine)

Melee [one-action] Iron Fist +25 (reach 15 ft.), Damage 3d10+15 bludgeoning
Melee [one-action] Stomp +23 (reach 5 ft.), Damage 3d8+15 bludgeoning
Ranged [one-action] Ballista Bolt +18 (range 120 ft.), Damage 3d8+10 piercing

Siege Engine
The Iron Colossus ignores the first 5 points of hardness from any structure it attacks. When it critically hits a creature, that creature is knocked prone and pushed 10 feet.

Relentless March [one-action] (move)
The Colossus Strides up to 30 feet ignoring difficult terrain. Any creature in its path must succeed a DC 30 Reflex save or take 2d10+15 bludgeoning damage and become off-guard until the end of their next turn.

Steam Punch [two-actions] (attack)
The Colossus vents superheated steam and delivers a devastating blow. Make an Iron Fist Strike with a +2 circumstance bonus. On a hit, the target is pushed 10 feet and becomes stunned 1. On a critical hit, they are also knocked prone.

Siege Mode [three-actions] (transformation)
The Colossus locks its legs and becomes a stationary siege platform until it uses this ability again. It gains a +4 circumstance bonus to Fortitude saves, resistances increase by 5, and all ranged attacks deal an additional 2d8 piercing damage. It cannot use movement actions while in Siege Mode.

Retaliation Strike [reaction]
Trigger: A creature within 15 feet critically hits the Colossus.
The Colossus retaliates immediately with an Iron Fist Strike against the triggering creature before they can move away.

Emergency Venting [free-action]
Trigger: The Colossus takes electricity damage.
The Colossus vents excess energy as a burst of scorching steam. All creatures within 10 feet take 2d6 fire damage (DC 28 basic Reflex save).

PARTS:
--- Head ---
HP: 40
AC: +3
Immunity: mental
Threshold 20: stunned 1
Destroy: blinded, confused

--- Torso ---
HP: 120
AC: 0
Resistance: physical 15
Threshold 60: slowed 1
Destroy: slowed 2, sickened 1

--- Left Arm ---
HP: 45
AC: +1
Weakness: slashing 10
Threshold 20: enfeebled 2
Destroy: immobilized

--- Right Arm ---
HP: 45
AC: +1
Weakness: slashing 10
Threshold 20: enfeebled 2
Destroy: immobilized

--- Left Leg ---
HP: 25
AC: -1
Weakness: bludgeoning 10
Destroy: slowed 2

--- Right Leg ---
HP: 25
AC: -1
Weakness: bludgeoning 10
Destroy: slowed 2

DAMAGE REACTIONS:
--- Emergency Venting ---
Trigger: 25
Action: free
Save: DC 30 Reflex basic
Damage: aura 15, 2d6 fire

--- Steam Burst ---
Trigger: 30 fire
Action: reaction
Effect: triggerer, blinded
Save: DC 28 Fortitude
Duration: 1 round

--- Shockwave ---
Trigger: 40
Action: reaction
Effect: aura 20, prone
Damage: aura 20, 3d6 bludgeoning

DEATH REACTION:
Name: Catastrophic Collapse
Effect: aura 40, prone, stunned 2
Duration: 1 round
Damage: aura 40, 6d10 bludgeoning`;

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
