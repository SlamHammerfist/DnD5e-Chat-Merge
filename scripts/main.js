/**
 * D&D 5e Chat Merge
 *
 * dnd5e 6 already folds some roll messages into the usage card that started them: when a message type has a
 * `summaryTemplate` and its `system.origin` is a usage card, the system hides the roll message in the log and renders
 * it as a `.card-summary` inside the card (saving throws work this way out of the box). Deleting the card also
 * deletes its summarized rolls.
 *
 * This module gives attack, damage and healing messages a summary template so they take the same path, and lets each
 * roll type be switched on or off. Nothing is written to the messages themselves: turning a type off shows those rolls
 * as separate messages again.
 */

export const MODULE_ID = "dnd5e-chat-merge";

const TEMPLATES = {
  attack: `modules/${MODULE_ID}/templates/attack-summary.hbs`,
  damage: `modules/${MODULE_ID}/templates/damage-summary.hbs`
};

/**
 * Roll message types this module handles. `template: null` keeps the system's own summary template.
 * @type {Record<string, { setting: string, template: string|null, name: string, hint: string }>}
 */
const TYPES = {
  attack: {
    setting: "attack", template: TEMPLATES.attack,
    name: "Merge attack rolls",
    hint: "Show attack rolls inside the item card, with hit or miss against each target."
  },
  damage: {
    setting: "damage", template: TEMPLATES.damage,
    name: "Merge damage rolls",
    hint: "Show damage rolls inside the item card, with the damage application tray."
  },
  healing: {
    setting: "healing", template: TEMPLATES.damage,
    name: "Merge healing rolls",
    hint: "Show healing rolls inside the item card, with the healing application tray."
  },
  save: {
    setting: "save", template: null,
    name: "Merge saving throws",
    hint: "Show saving throws rolled from an item card's save button inside that card (the system's default)."
  }
};

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

Hooks.once("init", () => {
  for ( const { setting, name, hint } of Object.values(TYPES) ) {
    game.settings.register(MODULE_ID, setting, {
      name, hint: `${hint} Needs the system's "Summary Chat Cards" setting.`,
      scope: "client", config: true, type: Boolean, default: true, requiresReload: true
    });
  }
});

/** Whether rolls of a message type should be folded into their card for this client. */
function isMerged(type) {
  const config = TYPES[type];
  return !!config && game.settings.get(MODULE_ID, config.setting);
}

/* -------------------------------------------- */
/*  Patching the message data models            */
/* -------------------------------------------- */

/**
 * Find a getter by walking up the prototype chain.
 * @param {object} proto
 * @param {string} name
 * @returns {Function|undefined}
 */
function findGetter(proto, name) {
  for ( let p = proto; p; p = Object.getPrototypeOf(p) ) {
    const descriptor = Object.getOwnPropertyDescriptor(p, name);
    if ( descriptor ) return descriptor.get;
  }
}

/**
 * Give each handled type a summaryTemplate getter that honours this module's settings.
 * Originals are captured before anything is redefined, because healing's model extends damage's.
 */
function patchSummaryTemplates() {
  const models = CONFIG.ChatMessage.dataModels ?? {};
  const patches = Object.entries(TYPES)
    .filter(([type]) => models[type])
    .map(([type, { template }]) => ({ type, template, cls: models[type], original: findGetter(models[type].prototype, "summaryTemplate") }));

  for ( const { type, template, cls, original } of patches ) {
    Object.defineProperty(cls.prototype, "summaryTemplate", {
      configurable: true,
      get() {
        const fallback = original?.call(this) ?? "";
        // Healing's model inherits from damage's, so resolve by the message's own type.
        const own = this.parent?.type ?? type;
        if ( !(own in TYPES) ) return fallback;
        if ( !isMerged(own) ) return TYPES[own].template ? fallback : "";
        return TYPES[own].template ?? fallback;
      }
    });
  }
  return patches.map(p => p.type);
}

/**
 * Add a few values the summary templates need on top of each model's own render context.
 */
function patchContexts() {
  const { attack, damage } = CONFIG.ChatMessage.dataModels ?? {};

  if ( attack ) {
    const original = attack.prototype._prepareContext;
    attack.prototype._prepareContext = async function(options={}) {
      const context = await original.call(this, options);
      if ( options.summary ) context.chatMerge = attackSummary(this, context);
      return context;
    };
  }

  // Covers healing too, which inherits damage's _prepareContext.
  if ( damage ) {
    const original = damage.prototype._prepareContext;
    damage.prototype._prepareContext = async function(options={}) {
      const context = await original.call(this, options);
      if ( options.summary ) context.chatMerge = damageSummary(this, context);
      return context;
    };
  }
}

/** Localize a key, falling back to plain text if the key doesn't exist. */
function label(key, fallback) {
  return game.i18n.has(key) ? game.i18n.localize(key) : fallback;
}

/**
 * @param {AttackMessageData} system
 * @param {object} context
 */
function attackSummary(system, context) {
  const isPrivate = !system.parent.isContentVisible;
  const ammo = isPrivate ? null : system.ammunitionItem;
  return {
    label: label("DND5E.Attack", "Attack"),
    ammunition: ammo?.name ?? null
  };
}

/**
 * @param {DamageMessageData} system
 * @param {object} context
 */
function damageSummary(system, context) {
  const isHealing = system.isHealing;
  const title = isHealing ? label("DND5E.Healing", "Healing") : label("DND5E.Damage", "Damage");
  const types = context.isPrivate ? [] : Array.from(new Set(context.parts.map(p => p.label).filter(Boolean)));
  return {
    title,
    label: types.length ? types.join(", ") : title,
    icon: isHealing ? "fa-heart" : "fa-burst",
    critical: !context.isPrivate && (system.parent.rolls[0]?.isCritical === true),
    healing: isHealing
  };
}

/* -------------------------------------------- */
/*  Setup                                       */
/* -------------------------------------------- */

Hooks.once("setup", () => {
  if ( game.system.id !== "dnd5e" ) return;
  const patched = patchSummaryTemplates();
  patchContexts();
  foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));
  console.log(`${MODULE_ID} | Merging ${patched.join(", ")} rolls into item cards.`);
});

Hooks.once("ready", () => {
  game.modules.get(MODULE_ID).api = { isMerged, TYPES };
  if ( game.system.id === "dnd5e" && !game.settings.get("dnd5e", "chatCardSummary") ) {
    console.warn(`${MODULE_ID} | The dnd5e "Summary Chat Cards" setting is off, so no rolls are merged.`);
  }
});
