import { CharacterSheetContext, QuickInsert, getSetting, ModuleSetting } from './quick-insert.js';
import './vendor.js';

// Warhammer Fantasy Roleplay 4th edition integration
const SYSTEM_NAME = "wfrp4e";
class Wfrp4eSheetContext extends CharacterSheetContext {
    constructor(documentSheet, anchor, sheetType, insertType) {
        super(documentSheet, anchor, insertType ? [insertType] : undefined);
        this.spawnCSS = {
            ...this.spawnCSS,
            left: this.spawnCSS?.left - 10,
            bottom: this.spawnCSS?.bottom + 10,
        };
    }
}
function sheetWfrp4eRenderHook(app, sheetType) {
    if (app.element.find(".quick-insert-link").length > 0) {
        return;
    }
    const link = `<a class="quick-insert-link" title="Quick Insert"><i class="fas fa-search"></i></a>`;
    app.element.find("a.item-create").each((i, el) => {
        const type = el.dataset.type || "";
        if (!Object.keys(CONFIG.Item.typeLabels).includes(type))
            return;
        const linkEl = $(link);
        $(el).after(linkEl);
        linkEl.on("click", () => {
            const context = new Wfrp4eSheetContext(app, linkEl, sheetType, type);
            QuickInsert.open(context);
        });
    });
}
function init() {
    Hooks.on("renderActorSheetWfrp4eCharacter", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            sheetWfrp4eRenderHook(app, "character");
        }
    });
    console.log("Quick Insert | wfrp4e system extensions initiated");
}

export { SYSTEM_NAME, Wfrp4eSheetContext, init, sheetWfrp4eRenderHook };
//# sourceMappingURL=wfrp4e.js.map
