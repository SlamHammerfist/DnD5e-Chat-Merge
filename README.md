# D&D 5e Chat Merge

Folds attack, damage, healing and saving throw rolls into the item card that produced them, so one use of an item is one message in chat.

## Using it
- Use an item as normal. Rolls made from the card's buttons (**Attack**, **Damage**, **Healing**, **Saving Throw**) appear as rows inside that card instead of as separate messages.
- **Attack** rows show the total with crit/fumble marks (click it for the dice), ammunition, weapon mastery and hit or miss against each target.
- **Damage** and **Healing** rows show the total and damage types; click the total for the dice breakdown. The damage application tray is right under the row.
- **Saving throws** show one row per creature, with Legendary Resistance where it applies.
- Hold **Shift** to show a delete button on each row. Deleting the card deletes its merged rolls too.

## Requirements
The system setting **Summary Chat Cards** (Configure Settings → D&D Fifth Edition) must be on. It's on by default. The module uses the same summary system dnd5e 6 already uses for saving throws.

## Settings (per client, reload needed)
Merge attack rolls · Merge damage rolls · Merge healing rolls · Merge saving throws

Turning a type off shows those rolls as separate messages again; nothing is stored on the messages.

## What isn't merged
- Rolls not made from an item card's buttons (sheet rolls, macros).
- Rolls whose card you can't see (for example a whispered card): they show as normal messages.

## API
`game.modules.get("dnd5e-chat-merge").api` → `isMerged(type)` for `"attack" | "damage" | "healing" | "save"`, and `TYPES`.
