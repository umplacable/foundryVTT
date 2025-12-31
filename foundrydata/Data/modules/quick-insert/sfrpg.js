import { CharacterSheetContext, QuickInsert, getSetting, ModuleSetting } from './quick-insert.js';
import './vendor.js';

// Starfinder integration
const SYSTEM_NAME = "sfrpg";
class SfrpgSheetContext extends CharacterSheetContext {
    constructor(documentSheet, anchor, sheetType, insertType) {
        super(documentSheet, anchor, insertType ? [insertType] : undefined);
    }
}
function sheetSfrpgRenderHook(app, sheetType) {
    if (app.element.find(".quick-insert-link").length > 0) {
        return;
    }
    const link = `<a class="item-control quick-insert-link" title="Quick Insert"><i class="fas fa-search"></i></a>`;
    app.element
        .find("a.item-create, .item-control.spell-browse")
        .each((i, el) => {
        const linkEl = $(link);
        $(el).after(linkEl);
        const type = el.dataset.type;
        linkEl.on("click", (evt) => {
            evt.stopPropagation();
            const context = new SfrpgSheetContext(app, linkEl, sheetType, type);
            QuickInsert.open(context);
        });
    });
}
function init() {
    Hooks.on("renderActorSheetSFRPGCharacter", (app) => {
        if (getSetting(ModuleSetting.FILTERS_SHEETS_ENABLED)) {
            sheetSfrpgRenderHook(app, "character");
        }
    });
    console.log("Quick Insert | sfrpg system extensions initiated");
}

export { SYSTEM_NAME, SfrpgSheetContext, init, sheetSfrpgRenderHook };
//# sourceMappingURL=sfrpg.js.map
