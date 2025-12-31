import { CharacterSheetContext, systemFields, DocumentType, systemDocumentActions, systemDocumentActionCallbacks, getSetting, QuickInsert, ModuleSetting } from './quick-insert.js';
import './vendor.js';

// D&D 5th edition integration
const SYSTEM_NAME = "dnd5e";
class Dnd5eSheetContext extends CharacterSheetContext {
    constructor(documentSheet, anchor, insertType, system) {
        super(documentSheet, anchor, insertType, system);
    }
}
const ignoredTypes = new Set(["passengers", "crew"]);
const listTypeMap = {
    spellbook: ["spell"],
    features: ["feat"],
};
const itemTypeMap = {
    all: ["weapon", "equipment", "consumable", "loot"],
};
const linkHtml = `<a class="item-control quick-insert-link" aria-label="Quick Insert" data-tooltip="Quick Insert"><i class="fas fa-search"></i></a>`;
function sheetNew5eRenderHook(app) {
    const elem = "find" in app.element ? app.element.get(0) : app.element;
    if (!elem ||
        !app.isEditable ||
        elem.querySelectorAll(".quick-insert-link").length > 0) {
        return;
    }
    elem.querySelectorAll("div.items-section").forEach((section) => {
        const itemType = section.dataset.type || section.dataset.groupType;
        const listType = section.parentElement?.dataset.itemList;
        if (!(itemType && listType)) {
            return;
        }
        if (itemType && ignoredTypes.has(itemType)) {
            return;
        }
        const types = listTypeMap[listType] || itemTypeMap[itemType] || [itemType];
        let system;
        if (types.length === 1 && types[0] === "spell" && section.dataset.level) {
            if (section.dataset.preparationMode === "pact") {
                // Legacy solution
                system = {
                    level: {
                        min: 1,
                        max: app.document.system.spells.pact.level,
                    },
                };
            }
            else if (section.dataset.method === "pact") {
                // Updated dnd5e solution
                system = {
                    level: {
                        min: 1,
                        max: parseInt(section.dataset.level, 10),
                    },
                };
            }
            else {
                system = { level: parseInt(section.dataset.level, 10) };
            }
        }
        const linkEl = $(linkHtml);
        $(section).find(".items-header .item-controls").append(linkEl);
        linkEl.on("click", () => {
            const context = new Dnd5eSheetContext(app, linkEl, types, system);
            QuickInsert.open(context);
        });
    });
}
function sheetLegacy5eRenderHook(app) {
    if (app.element.find(".quick-insert-link").length > 0) {
        return;
    }
    app.element.find("a.item-create").each((i, el) => {
        let type = el.dataset.type;
        if (!type) {
            let parent = el.parentElement;
            while (parent && parent !== app.element[0]) {
                if (parent.dataset.type) {
                    type = parent.dataset.type;
                    break;
                }
                parent = parent.parentElement;
            }
        }
        if (type && ignoredTypes.has(type)) {
            return;
        }
        const linkEl = $(linkHtml);
        $(el).after(linkEl);
        linkEl.on("click", () => {
            const context = new Dnd5eSheetContext(app, linkEl, type ? [type] : undefined);
            QuickInsert.open(context);
        });
    });
}
function sheet5eRenderHook(app) {
    if (!getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
        return;
    }
    if (
    //@ts-expect-error More type hacks :(
    app.element.classList?.contains("dnd5e2") ||
        app.element.hasClass("dnd5e2")) {
        sheetNew5eRenderHook(app);
    }
    else {
        sheetLegacy5eRenderHook(app);
    }
}
function init() {
    systemFields.push({
        documentType: DocumentType.ITEM,
        indexName: "level",
        fieldTitle: "Level",
    });
    systemDocumentActions[DocumentType.ITEM] = (item) => {
        const activities = Array.from(item.system.activities?.values() || []);
        const activityActions = activities.map((activity) => ({
            id: activity._id,
            icon: `fas fa-hand`,
            img: activity.img,
            title: activity.labels.activation
                ? `${activity.name} (${activity.labels.activation})`
                : activity.name,
        }));
        return [
            ...(activityActions.length
                ? activityActions
                : [
                    {
                        icon: "fas fa-hand",
                        id: "use",
                        title: "QUICKINSERT.ActionUse",
                    },
                ]),
            {
                icon: "fas fa-eye fa-fw",
                id: "show",
                title: "QUICKINSERT.ActionShow",
            },
        ];
    };
    systemDocumentActionCallbacks[DocumentType.ITEM] = (action, item) => {
        const act = item.system.activities?.get(action);
        if (!act?.use) {
            if (action === "use") {
                //@ts-expect-error Don't have dnd5e types
                item.use();
                return true;
            }
            return false;
        }
        act.use();
        return true;
    };
    Hooks.on("renderActorSheet5eCharacter", sheet5eRenderHook);
    Hooks.on("renderCharacterActorSheet", sheet5eRenderHook);
    Hooks.on("renderNPCActorSheet", sheet5eRenderHook);
    Hooks.on("renderActorSheet5eNPC", sheet5eRenderHook);
    Hooks.on("renderActorSheet5eVehicle", sheet5eRenderHook);
    Hooks.on("renderTidy5eSheet", sheet5eRenderHook);
    Hooks.on("renderTidy5eNPC", sheet5eRenderHook);
    try {
        const tidyApi = game.modules.get("tidy5e-sheet")?.api ??
            game.modules.get("tidy5e-sheet-kgar")?.api;
        if (tidyApi) {
            tidyApi.actorItem.registerSectionFooterCommands([
                {
                    enabled: (params) => getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED) &&
                        ["npc", "character", "vehicle"].includes(params.actor.type),
                    execute: (params) => {
                        const context = new Dnd5eSheetContext(params.actor.sheet, $(params.event.currentTarget), [params.section.dataset.type], params.section.dataset.system);
                        QuickInsert.open(context);
                    },
                    iconClass: "fas fa-search",
                    tooltip: "Quick Insert",
                },
            ]);
        }
    }
    catch (e) {
        console.error("Tidy 5e Sheet (Rewrite) Quick Insert compatibility failed to initialize", e);
    }
    console.log("Quick Insert | dnd5e system extensions initiated");
}

export { Dnd5eSheetContext, SYSTEM_NAME, init };
//# sourceMappingURL=dnd5e.js.map
