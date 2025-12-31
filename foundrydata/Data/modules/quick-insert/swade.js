import { CharacterSheetContext, QuickInsert, getSetting, ModuleSetting } from './quick-insert.js';
import './vendor.js';

// Savage Worlds Adventure Edition integration
const SYSTEM_NAME = "swade";
const ignoredTypes = new Set(["advance", "choice"]);
class SwadeSheetContext extends CharacterSheetContext {
    equipped = false;
    constructor(documentSheet, anchor, sheetType, insertType, equipped) {
        super(documentSheet, anchor, insertType ? [insertType] : undefined);
        this.equipped = Boolean(equipped);
    }
    onSubmit(item) {
        const res = super.onSubmit(item);
        if (this.equipped && res) {
            res.then((items) => {
                const item = items.length && items[0];
                if (!item)
                    return;
                //@ts-expect-error Lacking system types
                if (item?.data?.equippable) {
                    item.update({ "data.equipped": true });
                }
            });
        }
        return res;
    }
}
function sheetSwadeRenderHook(app, sheetType) {
    if (app.element.find(".quick-insert-link").length > 0) {
        return;
    }
    // Legacy sheets
    const link = `<a class="quick-insert-link" title="Quick Insert"><i class="fas fa-search"></i></a>`;
    app.element.find("a.item-create").each((i, el) => {
        const type = el.dataset.type || "";
        if (type && ignoredTypes.has(type)) {
            return;
        }
        const equipped = el.dataset.equipped === "true";
        const linkEl = $(link);
        $(el).after(linkEl);
        linkEl.on("click", () => {
            const context = new SwadeSheetContext(app, linkEl, sheetType, type, equipped);
            QuickInsert.open(context);
        });
    });
    // New character sheet
    app.element.find("button.item-create").each((i, el) => {
        const type = el.dataset.type || "";
        const linkEl = $(link);
        $(el).after(linkEl);
        linkEl.on("click", () => {
            const context = new SwadeSheetContext(app, linkEl, sheetType, type);
            QuickInsert.open(context);
        });
    });
}
function init() {
    Hooks.on("renderCharacterSheet", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            sheetSwadeRenderHook(app, "character");
        }
    });
    Hooks.on("renderSwadeNPCSheet", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            sheetSwadeRenderHook(app, "npc");
        }
    });
    Hooks.on("renderSwadeVehicleSheet", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            sheetSwadeRenderHook(app, "vehicle");
        }
    });
    console.log("Quick Insert | swade system extensions initiated");
}

export { SYSTEM_NAME, SwadeSheetContext, init, sheetSwadeRenderHook };
//# sourceMappingURL=swade.js.map
