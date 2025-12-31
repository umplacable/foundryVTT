import { CharacterSheetContext, QuickInsert, getSetting, ModuleSetting } from './quick-insert.js';
import './vendor.js';

// Shadow of the Demon Lord integration
const SYSTEM_NAME = "demonlord";
class DemonLordSheetContext extends CharacterSheetContext {
    constructor(documentSheet, anchor, sheetType, insertType) {
        super(documentSheet, anchor, insertType ? [insertType] : undefined);
    }
}
function demonlordRenderHook(app, sheetType) {
    if (app.element.find(".quick-insert-link").length > 0) {
        return;
    }
    const link = `<a class="item-control quick-insert-link" title="Quick Insert"><i class="fas fa-search"></i></a>`;
    app.element.find("a.item-create,a.spell-create").each((i, el) => {
        const linkEl = $(link);
        $(el).after(linkEl);
        const type = el.dataset.type;
        linkEl.on("click", () => {
            const context = new DemonLordSheetContext(app, linkEl, sheetType, type);
            QuickInsert.open(context);
        });
    });
    app.element.find(".ancestry-frame ~ h3").each((i, el) => {
        const linkEl = $(link);
        $(el).after(linkEl);
        linkEl.on("click", () => {
            const context = new DemonLordSheetContext(app, linkEl, sheetType, "ancestry");
            QuickInsert.open(context);
        });
    });
    app.element.find(".path-frame ~ h3").each((i, el) => {
        const linkEl = $(link);
        $(el).after(linkEl);
        linkEl.on("click", () => {
            const context = new DemonLordSheetContext(app, linkEl, sheetType, "path");
            QuickInsert.open(context);
        });
    });
}
function init() {
    Hooks.on("renderDLCharacterSheet", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            demonlordRenderHook(app, "character");
        }
    });
    Hooks.on("renderDLCreatureSheet", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            demonlordRenderHook(app, "creature");
        }
    });
    console.log("Quick Insert | demonlord system extensions initiated");
}

export { DemonLordSheetContext, SYSTEM_NAME, demonlordRenderHook, init };
//# sourceMappingURL=demonlord.js.map
