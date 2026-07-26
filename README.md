# PF2e Statblock Parser — by GM RedVelvet

A **Foundry VTT** module that converts plain-text **Pathfinder 2e** statblocks into fully built NPC Actors in a single click. Supports standard statblock parsing and, optionally, multi-part monsters through integration with **pf2e-aztecs-rip-n-tear**.

> Created by [GM RedVelvet](https://www.gmredvelvet.com/) · Community: [The GM Studio](https://thegmstudio.com/) · [Mesas Roleras](https://mesasroleras.com/)

---

## Installation

In Foundry VTT → **Add-on Modules → Install Module** → paste the manifest URL:

```
https://raw.githubusercontent.com/gmredvelvet-rgb/Pf2e-Statblock-Parser-by-GM-RedVelvet/main/module.json
```

**Requirements:**
- Foundry VTT v12 or higher
- **pf2e** system (Pathfinder 2e)

---

## Basic Usage

1. Open the **Actors** tab in Foundry VTT
2. Click the **Importar Statblock** button in the directory header
3. Paste your statblock text and click **Parsear Statblock**
4. The NPC is created automatically with all attributes, attacks, and abilities

Use the **Ejemplo Normal** button in the dialog to copy a ready-to-use example statblock.

---

## Statblock Format

The parser recognizes the standard PF2e statblock layout.

### Structure

```
Creature Name                         Creature N
Alignment, Size Type

Perception +X; senses
Languages language1, language2
Skills Skill1 +X, Skill2 +Y
Str +X, Dex +X, Con +X, Int +X, Wis +X, Cha +X
AC N; Fort +X, Ref +X, Will +X
HP N
Speed N

Immunities type1, type2
Weaknesses type N
Resistances type N (except exception)

Melee [one-action] Name +X (traits), Damage NdM+N type
Ranged [one-action] Name +X (range N ft.), Damage NdM+N type

Passive Ability Name
Description of the passive ability.

Action Name [one-action] (trait1, trait2)
Description of the action.

Reaction Name [reaction]
Trigger: trigger description.
Description of the reaction.
```

### Automatic Inline Enrichers

The parser automatically converts damage text and conditions into interactive PF2e buttons:

| Statblock text | Result |
|---|---|
| `2d6 fire damage` | `[[/r 2d6[fire]]]` — clickable roll button |
| `2d6 persistent bleed damage` | `[[/r 2d6[bleed,persistent]]]` |
| `DC 24 basic Reflex save` | `@Check[type:reflex\|dc:24\|basic:true]` — save button |
| `become frightened 2` | `@UUID[...]{Frightened 2}` — condition link |

### Full Example (standard statblock)

```
Thornback Wyvern                      Creature 7
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
Any creature that strikes the wyvern with a non-reach melee weapon must succeed
a DC 23 Fortitude save or take 2d6 poison damage and become sickened 1.

Darting Strike [one-action] (move)
The wyvern Strides up to half its Speed, then makes a Jaws Strike.
This movement does not trigger reactions.

Stinging Volley [two-actions] (attack, poison)
All creatures in a 30-foot cone must attempt a DC 24 Reflex save.
On a failure, they take 4d4+8 piercing damage and become off-guard until the
end of their next turn. On a critical failure, they also become frightened 2.

Spine Counter [reaction]
Trigger: A creature within reach makes a melee attack against the wyvern.
The wyvern lashes its tail, making a Stinger Strike against the triggering creature.
On a hit, the creature is also knocked prone.
```

---

## Integration with pf2e-aztecs-rip-n-tear

For monsters with **independent body parts** — each with its own HP, AC, and damage thresholds — the parser integrates with the **pf2e-aztecs-rip-n-tear** module.

### Setup

1. Install and enable the **pf2e-aztecs-rip-n-tear** module
2. In Foundry → **Settings → Modules → PF2e Statblock Parser**, enable:
   > ☑ **Habilitar parseo de Partes (pf2e-aztecs-rip-n-tear)**

Once enabled, an **Ejemplo con Partes** button will appear in the import dialog.

> **Important:** The sum of HP across all parts must equal the monster's total HP.

---

### `PARTS:` — Body Parts

Each part is delimited by `---`.

```
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
```

| Field | Description |
|---|---|
| `HP: N` | Hit points for this part |
| `AC: +N / -N / 0` | AC adjustment relative to the creature's AC |
| `Immunity: type` | Immunity specific to this part |
| `Weakness: type N` | Weakness specific to this part |
| `Resistance: type N` | Resistance specific to this part |
| `Threshold N: condition` | Condition applied when this part reaches N HP |
| `Destroy: condition` | Alias for `Threshold 0:` — triggers when the part is destroyed |

---

### `DAMAGE REACTIONS:` — Damage-Triggered Reactions

Fire automatically when the creature takes a minimum amount of damage.

```
DAMAGE REACTIONS:
--- Reaction Name ---
Trigger: N [damage_type]
Action: reaction
[Effect / Save / Damage lines]
```

**Pattern A — Basic saving throw with damage** (module auto-applies full/half/none):
```
--- Steam Discharge ---
Trigger: 25
Action: free
Save: DC 30 Reflex basic
Damage: aura 15, 2d6 fire
```

**Pattern B — Condition on failed save**:
```
--- Venom Cloud ---
Trigger: 30 poison
Action: reaction
Effect: aura 10, sickened 1
Save: DC 28 Fortitude
Duration: 1 round
```

**Pattern C — Automatic effect, no saving throw**:
```
--- Shockwave ---
Trigger: 40
Action: reaction
Effect: aura 20, prone
Damage: aura 20, 3d6 bludgeoning
```

| Field | Values |
|---|---|
| `Trigger: N [type]` | N = minimum damage to trigger; optional type filter (fire, cold, etc.) |
| `Action: reaction / free` | Action type |
| `Effect: target, condition` | Target: `self`, `triggerer`, or `aura R` (radius in feet) |
| `Save: DC N Fortitude/Reflex/Will [basic]` | Saving throw; add `basic` for a basic save |
| `Damage: target, NdM type` | Damage applied to the target |
| `Duration: N round/minute` | Duration of the applied condition |

---

### `DEATH REACTION:` — Death Reaction

Triggers once when the creature drops to 0 HP.

```
DEATH REACTION:
Name: Catastrophic Collapse
Effect: aura 40, prone, stunned 2
Duration: 1 round
Damage: aura 40, 6d10 bludgeoning
```

---

### Full Multi-Part Example (Iron Colossus)

<details>
<summary>Click to expand full statblock</summary>

```
Iron Colossus                         Creature 12
Neutral, Huge Construct

Perception +22; darkvision, tremorsense (imprecise) 60 ft.
Languages —
Skills Athletics +26, Intimidation +22
Str +9, Dex -1, Con +7, Int -4, Wis +4, Cha +0
AC 32; Fort +25, Ref +17, Will +20
HP 300
Speed 30

Immunities bleed, death effects, disease, doomed, drained, fatigued, mental,
paralyzed, poison, unconscious
Weaknesses electricity 15, vitality 15
Resistances physical 10 (except adamantine)

Melee [one-action] Iron Fist +25 (reach 15 ft.), Damage 3d10+15 bludgeoning
Melee [one-action] Stomp +23 (reach 5 ft.), Damage 3d8+15 bludgeoning
Ranged [one-action] Ballista Bolt +18 (range 120 ft.), Damage 3d8+10 piercing

Siege Engine
The Iron Colossus ignores the first 5 points of hardness from any structure it
attacks. When it critically hits a creature, that creature is knocked prone and
pushed 10 feet.

Relentless March [one-action] (move)
The Colossus Strides up to 30 feet ignoring difficult terrain. Any creature in
its path must succeed a DC 30 Reflex save or take 2d10+15 bludgeoning damage
and become off-guard until the end of their next turn.

Steam Punch [two-actions] (attack)
Make an Iron Fist Strike with a +2 circumstance bonus. On a hit, the target is
pushed 10 feet and becomes stunned 1. On a critical hit, they are also knocked prone.

Siege Mode [three-actions] (transformation)
The Colossus locks its legs and becomes a stationary siege platform. It gains a
+4 circumstance bonus to Fortitude saves and resistances increase by 5. It
cannot use movement actions while in Siege Mode.

Retaliation Strike [reaction]
Trigger: A creature within 15 feet critically hits the Colossus.
The Colossus retaliates immediately with an Iron Fist Strike.

Emergency Venting [free-action]
Trigger: The Colossus takes electricity damage.
The Colossus vents excess energy as a burst of scorching steam. All creatures
within 10 feet take 2d6 fire damage (DC 28 basic Reflex save).

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
Damage: aura 40, 6d10 bludgeoning
```

</details>

---

## Credits

- **[GM RedVelvet](https://www.gmredvelvet.com/)** — module development and design
- Inspired by the original Starfinder statblock parser by *Deepflame*
- Body-part integration powered by **pf2e-aztecs-rip-n-tear**

---

## Licensing

**This module is free.** It needs no subscription, no activation and no account, and it keeps working offline and forever — unlike the subscription-based modules in the Velvet range, it contains no licence check of any kind.

If it earns its keep at your table, support is welcome but never required: [Patreon](https://www.patreon.com/gmredvelvet).

See [LICENSE](LICENSE) for the full terms.
