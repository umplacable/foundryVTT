import { systemDocumentActions, DocumentType, systemDocumentActionCallbacks } from './quick-insert.js';
import './vendor.js';

//spell.spellcasting.cast(spell, {})
function init() {
    systemDocumentActions[DocumentType.ITEM] = (item) => {
        if (item.spellcasting) {
            return [
                {
                    icon: "fas fa-wand",
                    id: "cast",
                    title: "PF2E.CastLabel",
                },
                {
                    icon: "fas fa-eye fa-fw",
                    id: "show",
                    title: "QUICKINSERT.ActionShow",
                },
            ];
        }
        return [
            {
                icon: "fas fa-eye fa-fw",
                id: "show",
                title: "QUICKINSERT.ActionShow",
            },
        ];
    };
    systemDocumentActionCallbacks[DocumentType.ITEM] = (action, item) => {
        if (action === "cast") {
            //@ts-expect-error no pf2e types
            item.spellcasting.cast(item, {});
            return true;
        }
        if (action === "show") {
            item.sheet?.render(true);
            return false;
        }
        return false;
    };
}

export { init };
//# sourceMappingURL=pf2e.js.map
