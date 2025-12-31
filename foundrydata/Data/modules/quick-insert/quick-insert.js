import { writable, get, readable, derived, fuzziersort_default, Fuse, append_styles, prop, template, slot, child, template_effect, set_class, append, push, first_child, sibling, if_block, bind_checked, store_get, pop, setup_stores, set_text, set_attribute, store_set, init_select, each, bind_this, event, get$1, derived$1, select_option, delegate, html, index, text, clsx, stopPropagation, comment, snippet, noop, user_effect, component, createEventDispatcher, set_checked, preventDefault, bubble_event, state, bind_value, set, proxy, user_pre_effect, onMount, transition, fade, blur, set_value, set_selected, unmount, mount } from './vendor.js';

const MODULE_NAME = "quick-insert";
function registerSetting(setting, callback, { ...options }) {
    //@ts-expect-error Settings system needs alignment with new types
    game.settings.register(MODULE_NAME, setting, {
        config: false,
        scope: "client",
        ...options,
        onChange: callback || undefined,
    });
}
function getSetting(setting) {
    //@ts-expect-error Settings system needs alignment with new types
    return game.settings.get(MODULE_NAME, setting);
}
function setSetting(setting, value) {
    //@ts-expect-error Settings system needs alignment with new types
    return game.settings.set(MODULE_NAME, setting, value);
}
function registerMenu({ menu, ...options }) {
    game.settings.registerMenu(MODULE_NAME, menu, options);
}

const SAVE_SETTINGS_REVISION = 1;
var ModuleKeyBinds;
(function (ModuleKeyBinds) {
    ModuleKeyBinds["TOGGLE_OPEN"] = "toggleOpen";
    ModuleKeyBinds["OPEN_SETTINGS"] = "openSettings";
    // Unimplemented
    ModuleKeyBinds["TOGGLE_FILTER"] = "toggleFilter";
    ModuleKeyBinds["TOGGLE_QUICK_FILTER"] = "toggleQuickFilter";
})(ModuleKeyBinds || (ModuleKeyBinds = {}));
var ModuleSetting;
(function (ModuleSetting) {
    // Dead settings, do not reuse!
    // QUICKOPEN = "quickOpen",
    // INDEX_TIMEOUT = "indexTimeout",
    // FILTERS_INCLUDE_DEFAULTS = "filtersIncludeDefaults",
    ModuleSetting["ENABLE_GLOBAL_CONTEXT"] = "enableGlobalContext";
    ModuleSetting["INDEXING_DISABLED"] = "indexingDisabled";
    ModuleSetting["FILTERS_CLIENT"] = "filtersClient";
    ModuleSetting["FILTERS_WORLD"] = "filtersWorld";
    ModuleSetting["FILTERS_ADD_DEFAULT_SUBTYPE"] = "filtersAddDefaultSuptype";
    ModuleSetting["FILTERS_ADD_DEFAULT_PACKS"] = "filtersAddDefaultPack";
    ModuleSetting["FILTERS_ADD_DEFAULT_TYPE"] = "filtersAddDefaultType";
    ModuleSetting["FILTERS_SHEETS_ENABLED"] = "filtersSheetsEnabled";
    ModuleSetting["GM_ONLY"] = "gmOnly";
    ModuleSetting["AUTOMATIC_INDEXING"] = "automaticIndexing";
    ModuleSetting["SEARCH_BUTTON"] = "searchButton";
    ModuleSetting["DEFAULT_ACTION_SCENE"] = "defaultActionScene";
    ModuleSetting["DEFAULT_ACTION_ROLL_TABLE"] = "defaultActionRollTable";
    ModuleSetting["DEFAULT_ACTION_MACRO"] = "defaultActionMacro";
    ModuleSetting["SEARCH_TOOLTIPS"] = "searchTooltips";
    ModuleSetting["EMBEDDED_INDEXING"] = "embeddedIndexing";
    ModuleSetting["TOC_INDEXING"] = "tocIndexing";
    ModuleSetting["SEARCH_DENSITY"] = "searchDensity";
    ModuleSetting["ENHANCED_TOOLTIPS"] = "enhancedTooltips";
    ModuleSetting["SEARCH_ENGINE"] = "searchEngine";
    ModuleSetting["QUICK_FILTER_EDIT"] = "quickFilterEdit";
    ModuleSetting["REMEMBER_BROWSE_INPUT"] = "rememberBrowseInput";
    ModuleSetting["SEARCH_FOOTER"] = "searchFooter";
    ModuleSetting["SHOW_FOLDERS_IN_INDEXING_TAB"] = "showFoldersInIndexingtab";
})(ModuleSetting || (ModuleSetting = {}));

const namespace = "QUICKINSERT";
// Module-localized
const mloc = (name, replacements) => {
    if (!name)
        return "";
    if (name.includes(".")) {
        // TODO: Remove this when sure
        console.error("don't use mloc", name);
    }
    if (replacements) {
        return game.i18n.format(`${namespace}.${name}`, replacements);
    }
    return game.i18n.localize(`${namespace}.${name}`);
};
// Global-localized
const loc = (name, replacements) => {
    if (!name)
        return "";
    if (replacements) {
        return game.i18n.format(name, replacements);
    }
    return game.i18n.localize(name);
};
function isTextInputElement(element) {
    return (element.tagName == "TEXTAREA" ||
        (element.tagName == "INPUT" && element.type == "text"));
}
// General utils
const ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randomId(idLength = 10) {
    const values = new Uint8Array(idLength);
    window.crypto.getRandomValues(values);
    return String.fromCharCode(...values.map((x) => ALPHA.charCodeAt(x % ALPHA.length)));
}
// Simple utility function for async waiting
// Nicer to await waitFor(100) than nesting setTimeout callback hell
function resolveAfter(msec) {
    return new Promise((res) => setTimeout(res, msec));
}
class TimeoutError extends Error {
    constructor(timeoutMsec) {
        super(`did not complete within ${timeoutMsec}ms`);
    }
}
function withDeadline(p, timeoutMsec) {
    return Promise.race([
        p,
        new Promise((res, rej) => setTimeout(() => rej(new TimeoutError(timeoutMsec)), timeoutMsec)),
    ]);
}
// Match keybinds even if it's in input fields or with explicit context
function customKeybindHandler(evt, context) {
    if (evt.isComposing || (!evt.key && !evt.code)) {
        return;
    }
    if (!context && !game.keyboard?.hasFocus)
        return;
    const ctx = KeyboardManager.getKeyboardEventContext(evt, false);
    if (ctx.event.target?.dataset?.engine === "prosemirror") {
        return;
    }
    if (context) {
        ctx._quick_insert_extra = { context };
    }
    // ProseMirror handles keys itself!
    if (document.activeElement?.classList.contains("ProseMirror")) {
        return;
    }
    const actions = KeyboardManager._getMatchingActions(ctx)
        .map((action) => game.keybindings.actions.get(action.action))
        .filter((action) => action?.textInput);
    if (!actions.length)
        return;
    let consumed = false;
    for (const action of actions) {
        consumed = Boolean(action?.onDown?.(ctx));
        if (consumed)
            break;
    }
    if (consumed) {
        evt.preventDefault();
        evt.stopPropagation();
    }
}

const systemFields = [];
const memoized = {};
function getSystemFields(type) {
    if (memoized[type]) {
        return memoized[type];
    }
    memoized[type] = systemFields.filter((f) => f.documentType === type);
    return memoized[type];
}

var DocumentType;
(function (DocumentType) {
    DocumentType["ACTOR"] = "Actor";
    DocumentType["ITEM"] = "Item";
    DocumentType["JOURNALENTRY"] = "JournalEntry";
    DocumentType["JOURNALENTRYPAGE"] = "JournalEntryPage";
    DocumentType["MACRO"] = "Macro";
    DocumentType["ROLLTABLE"] = "RollTable";
    DocumentType["SCENE"] = "Scene";
    DocumentType["PLAYLIST"] = "Playlist";
    DocumentType["CARDS"] = "Cards";
    DocumentType["ADVENTURE"] = "Adventure";
})(DocumentType || (DocumentType = {}));
// Types that have their own indexes
const IndexedDocumentTypes = [
    DocumentType.ACTOR,
    DocumentType.ITEM,
    DocumentType.JOURNALENTRY,
    DocumentType.MACRO,
    DocumentType.ROLLTABLE,
    DocumentType.SCENE,
];
// Types that can show up in searches
const AvailableDocumentTypes = [
    DocumentType.ACTOR,
    DocumentType.ITEM,
    DocumentType.JOURNALENTRY,
    DocumentType.JOURNALENTRYPAGE,
    DocumentType.MACRO,
    DocumentType.ROLLTABLE,
    DocumentType.SCENE,
];
const EmbeddedDocumentTypes = {
    [DocumentType.JOURNALENTRY]: "JournalEntryPage",
};
const EmbeddedDocumentCollections = {
    [DocumentType.JOURNALENTRY]: "pages",
};
const DocumentMeta = {
    [DocumentType.ACTOR]: CONFIG.Actor.documentClass.metadata,
    [DocumentType.ITEM]: CONFIG.Item.documentClass.metadata,
    [DocumentType.JOURNALENTRY]: CONFIG.JournalEntry.documentClass.metadata,
    [DocumentType.JOURNALENTRYPAGE]: CONFIG.JournalEntryPage.documentClass.metadata,
    [DocumentType.MACRO]: CONFIG.Macro.documentClass.metadata,
    [DocumentType.ROLLTABLE]: CONFIG.RollTable.documentClass.metadata,
    [DocumentType.SCENE]: CONFIG.Scene.documentClass.metadata,
    [DocumentType.PLAYLIST]: CONFIG.Playlist.documentClass.metadata,
    [DocumentType.CARDS]: CONFIG.Cards.documentClass.metadata,
    [DocumentType.ADVENTURE]: CONFIG.Adventure.documentClass.metadata,
};
const documentIcons = {
    [DocumentType.ACTOR]: "fa-user",
    [DocumentType.ITEM]: "fa-suitcase",
    [DocumentType.JOURNALENTRY]: "fa-book-open",
    [DocumentType.MACRO]: "fa-terminal",
    [DocumentType.ROLLTABLE]: "fa-th-list",
    [DocumentType.SCENE]: "fa-map",
    [DocumentType.PLAYLIST]: "fa-music",
    [DocumentType.CARDS]: "fa-id-badge",
    [DocumentType.ADVENTURE]: "fa-globe-asia",
    [DocumentType.JOURNALENTRYPAGE]: "fa-duotone fa-book-open",
};
function packEnabled$1(pack) {
    const disabled = getSetting(ModuleSetting.INDEXING_DISABLED);
    // Pack document type enabled?
    const role = game.user?.role;
    if (role) {
        if (disabled?.entities?.[pack.metadata.type]?.includes(role)) {
            return false;
        }
        // Pack enabled?
        if (disabled?.packs?.[pack.collection]?.includes(role)) {
            return false;
        }
        // Pack entity type indexed?
        if (!IndexedDocumentTypes.includes(pack.metadata.type)) {
            return false;
        }
    }
    // Not hidden?
    return Boolean(pack.visible || game.user?.isGM);
}

function createStore(setting) {
    const store = writable();
    const { subscribe, set } = store;
    return {
        subscribe,
        set: (value) => {
            if (value !== get(store)) {
                setSetting(setting, value);
            }
            return value;
        },
        update: (updater) => {
            const value = updater(get(store));
            setSetting(setting, value);
        },
        load: () => {
            const value = getSetting(setting);
            set(value);
        },
    };
}
const stores = {
    [ModuleSetting.GM_ONLY]: createStore(ModuleSetting.GM_ONLY),
    [ModuleSetting.FILTERS_SHEETS_ENABLED]: createStore(ModuleSetting.FILTERS_SHEETS_ENABLED),
    [ModuleSetting.AUTOMATIC_INDEXING]: createStore(ModuleSetting.AUTOMATIC_INDEXING),
    [ModuleSetting.SEARCH_BUTTON]: createStore(ModuleSetting.SEARCH_BUTTON),
    [ModuleSetting.ENABLE_GLOBAL_CONTEXT]: createStore(ModuleSetting.ENABLE_GLOBAL_CONTEXT),
    [ModuleSetting.INDEXING_DISABLED]: createStore(ModuleSetting.INDEXING_DISABLED),
    [ModuleSetting.FILTERS_CLIENT]: createStore(ModuleSetting.FILTERS_CLIENT),
    [ModuleSetting.FILTERS_WORLD]: createStore(ModuleSetting.FILTERS_WORLD),
    [ModuleSetting.FILTERS_ADD_DEFAULT_SUBTYPE]: createStore(ModuleSetting.FILTERS_ADD_DEFAULT_SUBTYPE),
    [ModuleSetting.FILTERS_ADD_DEFAULT_PACKS]: createStore(ModuleSetting.FILTERS_ADD_DEFAULT_PACKS),
    [ModuleSetting.FILTERS_ADD_DEFAULT_TYPE]: createStore(ModuleSetting.FILTERS_ADD_DEFAULT_TYPE),
    [ModuleSetting.DEFAULT_ACTION_MACRO]: createStore(ModuleSetting.DEFAULT_ACTION_MACRO),
    [ModuleSetting.DEFAULT_ACTION_ROLL_TABLE]: createStore(ModuleSetting.DEFAULT_ACTION_ROLL_TABLE),
    [ModuleSetting.DEFAULT_ACTION_SCENE]: createStore(ModuleSetting.DEFAULT_ACTION_SCENE),
    [ModuleSetting.SEARCH_TOOLTIPS]: createStore(ModuleSetting.SEARCH_TOOLTIPS),
    [ModuleSetting.EMBEDDED_INDEXING]: createStore(ModuleSetting.EMBEDDED_INDEXING),
    [ModuleSetting.TOC_INDEXING]: createStore(ModuleSetting.TOC_INDEXING),
    [ModuleSetting.SEARCH_DENSITY]: createStore(ModuleSetting.SEARCH_DENSITY),
    [ModuleSetting.ENHANCED_TOOLTIPS]: createStore(ModuleSetting.ENHANCED_TOOLTIPS),
    [ModuleSetting.SEARCH_ENGINE]: createStore(ModuleSetting.SEARCH_ENGINE),
    [ModuleSetting.QUICK_FILTER_EDIT]: createStore(ModuleSetting.QUICK_FILTER_EDIT),
    [ModuleSetting.REMEMBER_BROWSE_INPUT]: createStore(ModuleSetting.REMEMBER_BROWSE_INPUT),
    [ModuleSetting.SEARCH_FOOTER]: createStore(ModuleSetting.SEARCH_FOOTER),
    [ModuleSetting.SHOW_FOLDERS_IN_INDEXING_TAB]: createStore(ModuleSetting.SHOW_FOLDERS_IN_INDEXING_TAB),
};
Hooks.on("ready", () => {
    Object.values(stores).forEach((store) => store.load());
});

function filterDisplayed(contents) {
    return contents.filter((i) => i.displayed);
}
function createCollectionStore(getCollection) {
    return readable([], function start(set) {
        const collection = getCollection();
        function onCreate() {
            set(filterDisplayed(collection.contents));
        }
        function onDelete() {
            set(filterDisplayed(collection.contents));
        }
        const type = collection.documentName;
        Hooks.on(`create${type}`, onCreate);
        Hooks.on(`delete${type}`, onDelete);
        set(filterDisplayed(collection.contents));
        return function stop() {
            Hooks.off(`create${type}`, onCreate);
            Hooks.off(`delete${type}`, onDelete);
        };
    });
}
const collectionStores = {
    folders: createCollectionStore(() => game.folders),
};

// Generate view data from IndexingDisabledSetting
const enabledRoles = (disabled) => {
    return [1, 2, 3, 4].reduce(function (map, role) {
        map[role] = !disabled?.includes(role);
        return map;
    }, {});
};
function createDisabled() {
    const { subscribe, update } = stores[ModuleSetting.INDEXING_DISABLED];
    return {
        subscribe,
        toggleRole: (type, id, role, disabled) => update((value) => {
            if (!value[type])
                value[type] = { root: [] };
            let roles = value[type][id];
            if (!roles) {
                value[type][id] = roles = [];
            }
            const roleIndex = roles.indexOf(role);
            if (disabled && roleIndex === -1) {
                roles.push(role);
            }
            else if (!disabled && roleIndex !== -1) {
                roles.splice(roleIndex, 1);
            }
            if (roles.length === 0) {
                delete value[type][id];
            }
            return value;
        }),
        toggleAll: (type, id, disabled) => update((value) => {
            if (!value[type])
                return value;
            if (disabled) {
                value[type][id] = [1, 2, 3, 4];
            }
            else {
                delete value[type][id];
            }
            return value;
        }),
    };
}
function getAllChildFolders(folder) {
    if (!folder) {
        return [];
    }
    return folder.children
        .map((child) => {
        if (!child.folder) {
            return [];
        }
        return [
            child.folder.id,
            getAllChildFolders(child.folder),
        ].flat();
    })
        .flat();
}
const disabled = createDisabled();
// Derived read-only stores used for views
const documents = derived(disabled, ($disabled) => {
    return IndexedDocumentTypes.map((type) => ({
        type: "entities",
        id: type,
        title: loc(`DOCUMENT.${type}`),
        enabled: enabledRoles($disabled.entities[type]),
    }));
});
const packs = derived(disabled, ($disabled) => {
    return game.packs
        ? [...game.packs.contents].map((pack) => ({
            type: "packs",
            id: pack.collection,
            title: pack.title,
            documentType: pack.documentName,
            subTitle: `${loc(`DOCUMENT.${pack.documentName}`)} (${pack.metadata.packageName})`,
            enabled: enabledRoles($disabled.packs[pack.collection]),
        }))
        : [];
});
const directory = derived([disabled, collectionStores.folders], ([$disabled, $folders]) => {
    return [
        {
            type: "directory",
            id: "root",
            title: mloc("FilterEditorDirectory"),
            enabled: enabledRoles($disabled.directory?.["root"]),
        },
        ...$folders
            .filter((folder) => !folder.folder &&
            IndexedDocumentTypes.includes(folder.type))
            .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : 0))
            .map((folder) => ({
            type: "directory",
            id: folder.id,
            title: folder.name,
            documentType: folder.type,
            subTitle: `${loc(`DOCUMENT.${folder.type}`)}`,
            enabled: enabledRoles($disabled.directory?.[folder.id]),
        })),
    ];
});
const enabledDocumentTypes$1 = derived([stores[ModuleSetting.INDEXING_DISABLED]], ([$disabled]) => {
    const role = game.user?.role ?? 0;
    return IndexedDocumentTypes.filter((t) => !$disabled?.entities?.[t]?.includes(role));
});
const enabledPacks = derived([stores[ModuleSetting.INDEXING_DISABLED]], () => (game.packs ? game.packs.filter(packEnabled$1) : []));
const disabledFolders = derived([stores[ModuleSetting.INDEXING_DISABLED], collectionStores.folders], ([disabled]) => {
    const role = game.user?.role;
    const ignoredFolders = new Set();
    if (!role ||
        !disabled?.directory ||
        (disabled.directory["root"] &&
            Object.keys(disabled.directory).length === 1)) {
        return ignoredFolders;
    }
    for (const [id, folderIgnores] of Object.entries(disabled.directory)) {
        if (folderIgnores.includes(role)) {
            ignoredFolders.add(id);
            const children = getAllChildFolders(game.folders.get(id));
            children.forEach((c) => ignoredFolders.add(c));
        }
    }
    return ignoredFolders;
});

function extractEmbeddedIndex(item, pack) {
    if (!("pages" in item))
        return;
    if (pack && item.pages?.length && item.pages[0]._id) {
        return item.pages.map((page) => new EmbeddedCompendiumSearchItem(pack, {
            _id: page._id,
            parentName: item.name,
            embeddedName: page.name,
            subType: page.type,
            parentId: item._id,
            documentType: DocumentType.JOURNALENTRYPAGE,
            tagline: `${pack?.metadata?.label || pack.title}`,
        }));
    }
}
function showDocument(doc, item) {
    if (!doc) {
        return;
    }
    if (doc.documentName === "JournalEntry" ||
        doc.documentName === "JournalEntryPage") {
        const fakeTarget = {
            dataset: {
                hash: item?.anchor?.slug,
            },
            getAttribute: (val) => {
                if (val === "data-hash") {
                    return item?.anchor?.slug;
                }
            },
        };
        doc._onClickDocumentLink({
            //@ts-expect-error This is good enough for now
            currentTarget: fakeTarget,
            //@ts-expect-error This is good enough for now
            target: { closest: () => fakeTarget },
        });
    }
    else {
        doc.sheet?.render(true);
    }
}
function getCollectionFromType(type) {
    return CONFIG[type].collection.instance;
}
function getLocationIcon(item) {
    if (item.folder) {
        return `<i class="fas fa-folder location-icon" data-tooltip="${loc("DOCUMENT.Folder")}" data-tooltip-direction="RIGHT"></i>`;
    }
    if (item.packageName) {
        return `<i class="fas fa-atlas location-icon" data-tooltip="${loc("PACKAGE.TagCompendium")} (${item.packageId})" data-tooltip-direction="RIGHT"></i>`;
    }
    if (item.__source !== "quick-insert:native") {
        return `<i class="fas fa-cube location-icon" data-tooltip="External Module" data-tooltip-direction="RIGHT"></i></span>`;
    }
    return `<i class="fas fa-globe location-icon" data-tooltip="${loc("QUICKINSERT.FilterEditorFolderRoot")}" data-tooltip-direction="RIGHT"></i>`;
}
const ignoredFolderNames = { _fql_quests: true };
function directoryEnabled() {
    const disabled = getSetting(ModuleSetting.INDEXING_DISABLED);
    const role = game.user?.role;
    if (!role)
        return false;
    return !disabled?.directory?.["root"]?.includes(role);
}
function enabledDocumentTypes() {
    const disabled = getSetting(ModuleSetting.INDEXING_DISABLED);
    const role = game.user?.role;
    if (!role)
        return [];
    return IndexedDocumentTypes.filter((t) => !disabled?.entities?.[t]?.includes(role));
}
function enabledEmbeddedDocumentTypes() {
    if (enabledDocumentTypes().includes(DocumentType.JOURNALENTRY) &&
        getSetting(ModuleSetting.EMBEDDED_INDEXING)) {
        return [EmbeddedDocumentTypes[DocumentType.JOURNALENTRY]];
    }
    return [];
}
function packEnabled(pack) {
    const disabled = getSetting(ModuleSetting.INDEXING_DISABLED);
    // Pack document type enabled?
    const role = game.user?.role;
    if (role) {
        if (disabled?.entities?.[pack.metadata.type]?.includes(role)) {
            return false;
        }
        // Pack enabled?
        if (disabled?.packs?.[pack.collection]?.includes(role)) {
            return false;
        }
        // Pack entity type indexed?
        if (!IndexedDocumentTypes.includes(pack.metadata.type)) {
            return false;
        }
    }
    // Not hidden?
    return Boolean(pack.visible || game.user?.isGM);
}
function getDirectoryName(type) {
    const documentLabel = DocumentMeta[type].labelPlural;
    return documentLabel ? loc(documentLabel) : type;
}
function getSubTypeName(documentType, subType) {
    //@ts-expect-error typeLabels not in types yet
    return loc(CONFIG[documentType].typeLabels?.[subType]);
}
class BaseSearchItem {
    __source = "quick-insert:native";
    id;
    uuid;
    name;
    documentType;
    subType;
    img;
    system;
    packageName;
    packageId;
    folder;
    anchor;
    constructor(data) {
        this.id = data.id;
        this.uuid = data.uuid;
        this.name = data.name;
        this.documentType = data.documentType;
        this.subType = data.subType;
        this.img = data.img;
        this.system = data.system;
    }
    get dragData() {
        return {};
    }
    get icon() {
        return "";
    }
    get journalLink() {
        return "";
    }
    get script() {
        return "";
    }
    get tagline() {
        return "";
    }
    get tooltip() {
        const type = this.subType
            ? getSubTypeName(this.documentType, this.subType)
            : loc(DocumentMeta[this.documentType].label);
        return `${type} · ${this.tagline}`;
    }
    async show() {
        return;
    }
    async get() {
        return null;
    }
}
class EntitySearchItem extends BaseSearchItem {
    static fromDocuments(documents) {
        const ignoredFolderIds = get(disabledFolders);
        return documents
            .filter((e) => {
            if (e.folder) {
                if (ignoredFolderNames[e.folder.name] ||
                    ignoredFolderIds.has(e.folder.id || "")) {
                    return false;
                }
            }
            return e.visible;
        })
            .map((document) => {
            let embedded;
            if (EmbeddedDocumentTypes[document.documentName] &&
                enabledEmbeddedDocumentTypes().includes(EmbeddedDocumentTypes[document.documentName])) {
                const collection = 
                //@ts-expect-error can't type this right now
                document[EmbeddedDocumentCollections[document.documentName]];
                embedded = collection
                    .map((embeddedDoc) => {
                    if (!getSetting(ModuleSetting.TOC_INDEXING)) {
                        return EmbeddedEntitySearchItem.fromDocument(embeddedDoc);
                    }
                    let tocItems = [];
                    const toc = embeddedDoc.toc;
                    if (toc) {
                        tocItems = Object.values(toc).map((tocEntry) => EmbeddedEntitySearchItem.fromToc(embeddedDoc, tocEntry));
                    }
                    const pdfToc = embeddedDoc.flags["pdf-pager"]?.toc;
                    if (pdfToc) {
                        const toc = JSON.parse(pdfToc);
                        tocItems = Object.values(toc).map((tocEntry) => EmbeddedEntitySearchItem.fromToc(embeddedDoc, tocEntry));
                    }
                    return [
                        EmbeddedEntitySearchItem.fromDocument(embeddedDoc),
                        ...tocItems.filter((t) => !!t),
                    ];
                })
                    .flat();
            }
            return embedded
                ? [this.fromDocument(document), ...embedded]
                : [this.fromDocument(document)];
        })
            .flat();
    }
    static fromDocument(doc) {
        return new EntitySearchItem({
            id: doc.id,
            uuid: doc.uuid,
            name: doc.name,
            documentType: doc.documentName,
            //@ts-expect-error data is merged wih doc
            subType: doc.type,
            //@ts-expect-error data is merged wih doc
            img: doc.img,
            folder: doc.folder || undefined,
            system: "system" in doc ? doc.system : undefined,
        });
    }
    // Get the drag data for drag operations
    get dragData() {
        return {
            type: this.documentType,
            uuid: this.uuid,
        };
    }
    get icon() {
        return `<i class="fas ${documentIcons[this.documentType]} entity-icon"></i>`;
    }
    // Reference the entity in a journal, chat or other places that support it
    get journalLink() {
        return `@UUID[${this.uuid}]{${this.name}}`;
    }
    // Reference the entity in a script
    get script() {
        return `game.${DocumentMeta[this.documentType].collection}.get("${this.id}")`;
    }
    // Short tagline that explains where this is
    get tagline() {
        if (this.folder) {
            return `${this.folder.name}`;
        }
        return getDirectoryName(this.documentType);
    }
    async show() {
        showDocument(await this.get(), this);
    }
    async get() {
        return getCollectionFromType(this.documentType).get(this.id);
    }
    constructor(data) {
        super(data);
        const folder = data.folder;
        if (folder && folder.id) {
            this.folder = {
                id: folder.id,
                name: folder.name,
            };
        }
    }
}
class CompendiumSearchItem extends BaseSearchItem {
    package;
    packageName;
    static fromCompendium(pack) {
        const cIndex = pack.index;
        return cIndex
            .map((item) => {
            const embedded = extractEmbeddedIndex(item, pack);
            const searchItem = new CompendiumSearchItem(pack, item);
            return embedded ? [searchItem, embedded] : searchItem;
        })
            .flat(2);
    }
    constructor(pack, item) {
        const packName = pack.collection;
        super({
            id: item._id,
            uuid: `Compendium.${packName}.${item._id}`,
            name: item.name,
            documentType: pack.metadata.type,
            subType: item.type,
            img: item.img,
            system: item.system,
        });
        this.package = packName;
        this.packageName = pack?.metadata?.label || pack.title;
        this.packageId = pack.metadata.id;
        this.documentType = pack.metadata.type;
        this.uuid = `Compendium.${this.package}.${this.id}`;
    }
    // Get the drag data for drag operations
    get dragData() {
        return {
            type: this.documentType,
            uuid: this.uuid,
        };
    }
    get icon() {
        return `<i class="fas ${documentIcons[this.documentType]} entity-icon"></i>`;
    }
    // Reference the entity in a journal, chat or other places that support it
    get journalLink() {
        return `@UUID[${this.uuid}]{${this.name}}`;
    }
    // Reference the entity in a script
    get script() {
        return `fromUuid("${this.uuid}")`; // TODO: note that this is async somehow?
    }
    // Short tagline that explains where this is
    get tagline() {
        return `${this.packageName}`;
    }
    async show() {
        showDocument(await this.get(), this);
    }
    async get() {
        return (await fromUuid(this.uuid));
    }
}
class EmbeddedEntitySearchItem extends BaseSearchItem {
    #tagline;
    #embeddedName;
    anchor;
    static fromDocument(document) {
        if (!document.parent || !document.id) {
            throw new Error("Not properly embedded");
        }
        let tagline = document.parent.name;
        let name = document.name;
        // Extend journal page data
        if (document.documentName === DocumentType.JOURNALENTRYPAGE) {
            tagline = `${document.parent.folder?.name ||
                getDirectoryName(document.parent.documentName)}`;
            name = `${document.name} @ ${document.parent.name}`;
        }
        return new EmbeddedEntitySearchItem({
            id: document.id,
            uuid: document.uuid,
            name,
            embeddedName: document.name,
            documentType: document.documentName,
            //@ts-expect-error data is merged wih doc
            subType: document.type,
            //@ts-expect-error data is merged wih doc
            img: document.img,
            folder: document.parent.folder || undefined,
            tagline,
        });
    }
    static fromToc(document, tocEntry) {
        if (!document.parent || !document.id || !tocEntry.slug) {
            console.warn("Tried to index TOC from invalid entry", {
                tocEntry,
                document,
            });
            return undefined;
        }
        const text = tocEntry.text.trim();
        let tagline = document.parent.name;
        let name = `${text} @ ${document.name}`;
        // Extend journal page data
        if (document.documentName === DocumentType.JOURNALENTRYPAGE) {
            tagline = `${document.parent.folder?.name ||
                getDirectoryName(document.parent.documentName)}`;
            name = `${text} · ${document.name} @ ${document.parent.name}`;
        }
        return new EmbeddedEntitySearchItem({
            id: `${document.uuid}#${tocEntry.slug}`,
            uuid: document.uuid,
            name,
            embeddedName: text,
            documentType: document.documentName,
            //@ts-expect-error data is merged wih doc
            subType: document.type,
            //@ts-expect-error data is merged wih doc
            img: document.img,
            folder: document.parent.folder || undefined,
            tagline,
            anchor: { name: text, slug: tocEntry.slug },
        });
    }
    constructor(data) {
        super(data);
        const folder = data.folder;
        if (folder && folder.id) {
            this.folder = {
                id: folder.id,
                name: folder.name,
            };
        }
        this.anchor = data.anchor;
        this.#embeddedName = data.embeddedName;
        this.#tagline = data.tagline;
    }
    // Get the drag data for drag operations
    get dragData() {
        if (this.anchor) {
            return {
                anchor: this.anchor,
                type: this.documentType,
                uuid: this.uuid,
            };
        }
        return {
            type: this.documentType,
            uuid: this.uuid,
        };
    }
    get icon() {
        return `<i class="fas ${documentIcons[this.documentType]} entity-icon"></i>`;
    }
    // Reference the entity in a journal, chat or other places that support it
    get journalLink() {
        if (this.anchor) {
            return `@UUID[${this.uuid}#${this.anchor.slug}]{${this.anchor.name}}`;
        }
        return `@UUID[${this.uuid}]{${this.#embeddedName}}`;
    }
    // Reference the entity in a script
    get script() {
        return `fromUuid("${this.uuid}")`;
    }
    // Short tagline that explains where this is
    get tagline() {
        return this.#tagline;
    }
    get tooltip() {
        const type = this.subType
            ? getSubTypeName(this.documentType, this.subType)
            : loc(DocumentMeta[this.documentType].label);
        return `${type} · ${this.tagline}`;
    }
    async show() {
        showDocument(await this.get(), this);
    }
    async get() {
        return (await fromUuid(this.uuid));
    }
}
class EmbeddedCompendiumSearchItem extends BaseSearchItem {
    package;
    packageName;
    // Inject overrides??
    #tagline;
    static fromDocument(document) {
        if (!document.parent) {
            throw new Error("Document is not embedded");
        }
        if (!document.pack) {
            throw new Error("Document has no pack");
        }
        const pack = game.packs.get(document.pack);
        if (!pack) {
            throw new Error("Document has invalid pack");
        }
        return new EmbeddedCompendiumSearchItem(pack, {
            _id: document.id,
            parentName: document.parent.name || undefined,
            embeddedName: document.name,
            parentId: document.parent.id,
            documentType: DocumentType.JOURNALENTRYPAGE,
            tagline: `${pack?.metadata?.label || pack.title}`,
        });
    }
    constructor(pack, item) {
        const packName = pack.collection;
        const uuid = `Compendium.${packName}.${item.parentId}.${item.documentType}.${item._id}`;
        super({
            id: item._id,
            uuid,
            name: `${item.embeddedName} @ ${item.parentName}`,
            documentType: item.documentType,
            subType: item.subType,
            img: item.img,
        });
        this.uuid = uuid;
        this.package = packName;
        this.packageName = pack?.metadata?.label || pack.title;
        this.packageId = pack.metadata?.id;
        // this.documentType = DocumentType.JOURNALENTRYPAGE;
        this.#tagline = item.tagline;
    }
    // Get the drag data for drag operations
    get dragData() {
        return {
            // TODO: Use type from index
            type: "JournalEntryPage",
            uuid: this.uuid,
        };
    }
    get icon() {
        // TODO: Add table tor subtypes
        return `<i class="fa-duotone fa-book-open entity-icon"></i>`;
    }
    // Reference the entity in a journal, chat or other places that support it
    get journalLink() {
        return `@UUID[${this.uuid}]{${this.name}}`;
    }
    // Reference the entity in a script
    get script() {
        return `fromUuid("${this.uuid}")`; // TODO: note that this is async somehow?
    }
    // Short tagline that explains where this is
    get tagline() {
        return this.#tagline;
    }
    get tooltip() {
        const type = this.subType
            ? getSubTypeName(this.documentType, this.subType)
            : loc(DocumentMeta[this.documentType].label);
        return `${type} · ${this.tagline}`;
    }
    async show() {
        showDocument(await this.get(), this);
    }
    async get() {
        return (await fromUuid(this.uuid));
    }
}
// Create individual item from updated or added doc
function searchItemFromDocument(document) {
    if (document.parent) {
        if (document.compendium) {
            return EmbeddedCompendiumSearchItem.fromDocument(document);
        }
        return EmbeddedEntitySearchItem.fromDocument(document);
    }
    if (document.compendium) {
        return new CompendiumSearchItem(document.compendium, {
            _id: document.id,
            name: document.name,
            //@ts-expect-error it exists on most docs, it's ok if it's undefined
            img: document.img,
            //@ts-expect-error it exists on most docs, it's ok if it's undefined
            type: document.type,
        });
    }
    return EntitySearchItem.fromDocument(document);
}
function isEntity(item) {
    return item instanceof EntitySearchItem;
}
function isEmbeddedEntity(item) {
    return item instanceof EmbeddedEntitySearchItem;
}
function isCompendiumEntity(item) {
    return item instanceof CompendiumSearchItem;
}
function isEmbeddedCompendiumEntity(item) {
    return item instanceof EmbeddedCompendiumSearchItem;
}
class FuseSearchIndex {
    everything = [];
    fuse = new Fuse([], {
        keys: ["name"],
        includeMatches: true,
        threshold: 0.3,
    });
    #formatMatch(matches) {
        const match = matches[0];
        if (!match?.value)
            return;
        let text = match.value;
        [...match.indices].reverse().forEach(([start, end]) => {
            text =
                text.substring(0, start) +
                    `<strong>${text.substring(start, end + 1)}</strong>` +
                    text.substring(end + 1);
        });
        return text;
    }
    getSize() {
        return this.everything.length;
    }
    addAll(items) {
        for (const item of items) {
            this.add(item);
        }
    }
    add(item) {
        this.fuse.add(item);
        this.everything.push({ item });
    }
    replaceItem(item) {
        // Remove/add
        this.fuse.remove((i) => i?.uuid == item.uuid);
        this.fuse.add(item);
        // Replace
        const index = this.everything.findIndex((result) => result.item.uuid === item.uuid);
        this.everything[index] = { item };
    }
    removeByUuid(uuid) {
        this.fuse.remove((i) => i?.uuid == uuid);
        const index = this.everything.findIndex((result) => result.item.uuid === uuid);
        if (index > -1) {
            this.everything.splice(index, 1);
        }
    }
    search(query) {
        if (query === "") {
            return this.everything;
        }
        return this.fuse.search(query).map((res) => ({
            item: res.item,
            formattedMatch: this.#formatMatch(res.matches || []),
        }));
    }
}
class FuzzySortSearchIndex {
    everything = [];
    getSize() {
        return this.everything.length;
    }
    addAll(items) {
        for (const item of items) {
            this.add(item);
        }
    }
    add(item) {
        this.everything.push(item);
    }
    replaceItem(item) {
        // Replace
        const index = this.everything.findIndex((result) => result.uuid === item.uuid);
        this.everything[index] = item;
    }
    removeByUuid(uuid) {
        const index = this.everything.findIndex((result) => result.uuid === uuid);
        if (index > -1) {
            this.everything.splice(index, 1);
        }
    }
    search(query) {
        if (query === "") {
            return this.everything.map((item) => ({ item }));
        }
        return fuzziersort_default
            .go(query, this.everything, {
            key: "name",
            all: true,
            threshold: 0.5,
        })
            .map((res) => {
            return {
                item: res.obj,
                formattedMatch: res.highlight("<strong>", "</strong>"),
            };
        });
    }
}
class SearchLib {
    index;
    systemFields = systemFields.reduce((result, registreredField) => {
        result[registreredField.documentType] =
            result[registreredField.documentType] || [];
        result[registreredField.documentType].push(`system.${registreredField.indexName}`);
        return result;
    }, {});
    constructor() {
        const engine = getSetting(ModuleSetting.SEARCH_ENGINE);
        if (engine === "fuzzysort") {
            this.index = new FuzzySortSearchIndex();
        }
        else {
            this.index = new FuseSearchIndex();
        }
    }
    indexCompendium(compendium) {
        if (!compendium)
            return;
        if (packEnabled(compendium)) {
            const index = CompendiumSearchItem.fromCompendium(compendium);
            this.index.addAll(index);
        }
    }
    async indexCompendiums() {
        if (!game.packs)
            return;
        for await (const res of loadIndexes(this.systemFields)) {
            if (res.error) {
                console.log("Quick Insert | Index loading failure", res);
                continue;
            }
            this.indexCompendium(game.packs.get(res.pack));
        }
    }
    indexDocuments() {
        if (!directoryEnabled())
            return;
        for (const type of enabledDocumentTypes()) {
            this.index.addAll(EntitySearchItem.fromDocuments(getCollectionFromType(type).contents));
        }
    }
    addItem(item) {
        this.index.add(item);
    }
    removeItem(uuid) {
        this.index.removeByUuid(uuid);
    }
    replaceItem(item) {
        this.index.replaceItem(item);
    }
    search(text, filter, max) {
        if (filter) {
            return this.index.search(text).filter(filter).slice(0, max);
        }
        return this.index.search(text).slice(0, max);
    }
}
async function* loadIndexes(systemFields) {
    if (!game.packs) {
        console.error("Can't load indexes before packs are initialized");
        return;
    }
    // Information about failures
    const failures = {};
    const timeout = 1000;
    const packsRemaining = [];
    for (const pack of game.packs) {
        if (packEnabled(pack)) {
            failures[pack.collection] = { errors: 0 };
            packsRemaining.push(pack);
        }
    }
    while (packsRemaining.length > 0) {
        const pack = packsRemaining.shift();
        if (!pack)
            break;
        let promise;
        try {
            let options;
            if (getSetting(ModuleSetting.EMBEDDED_INDEXING)) {
                if (pack.documentClass.documentName === "JournalEntry") {
                    options = { fields: ["pages"] };
                }
            }
            if (systemFields?.[pack.documentClass.documentName]) {
                options = { fields: systemFields[pack.documentClass.documentName] };
            }
            promise = failures[pack.collection].waiting ?? pack.getIndex(options);
            await withDeadline(promise, timeout * (failures[pack.collection].errors + 1));
        }
        catch (error) {
            ++failures[pack.collection].errors;
            if (error instanceof TimeoutError) {
                failures[pack.collection].waiting = promise;
            }
            else {
                delete failures[pack.collection].waiting;
            }
            yield {
                error: error,
                pack: pack.collection,
                packsLeft: packsRemaining.length,
                errorCount: failures[pack.collection].errors,
            };
            if (failures[pack.collection].errors <= 4) {
                // Pack failed, will be retried later.
                packsRemaining.push(pack);
            }
            else {
                console.warn(`Quick Insert | Package "${pack.collection}" could not be indexed `);
            }
            continue;
        }
        yield {
            pack: pack.collection,
            packsLeft: packsRemaining.length,
            errorCount: failures[pack.collection].errors,
        };
    }
}

function checkIndexed(document, embedded = false) {
    if (!document.visible)
        return false;
    // Check embedded state
    if ((embedded && !document.parent) || (!embedded && document.parent)) {
        return false;
    }
    // Check enabled types
    if (document.parent) {
        if (!enabledEmbeddedDocumentTypes().includes(document.documentName))
            return false;
    }
    else {
        if (!enabledDocumentTypes().includes(document.documentName))
            return false;
    }
    // Check disabled packs
    return !(document.pack &&
        document.compendium &&
        !packEnabled$1(document.compendium));
}
function setupDocumentHooks(quickInsert) {
    enabledDocumentTypes().forEach((type) => {
        Hooks.on(`create${type}`, (document) => {
            if (!directoryEnabled())
                return;
            if (document.parent || !checkIndexed(document))
                return;
            quickInsert.searchLib?.addItem(searchItemFromDocument(document));
        });
        Hooks.on(`update${type}`, (document) => {
            if (!directoryEnabled())
                return;
            if (document.parent)
                return;
            if (!checkIndexed(document)) {
                quickInsert.searchLib?.removeItem(document.uuid);
                return;
            }
            quickInsert.searchLib?.replaceItem(searchItemFromDocument(document));
        });
        Hooks.on(`delete${type}`, (document) => {
            if (!directoryEnabled())
                return;
            if (document.parent || !checkIndexed(document))
                return;
            quickInsert.searchLib?.removeItem(document.uuid);
        });
    });
    enabledEmbeddedDocumentTypes().forEach((type) => {
        Hooks.on(`create${type}`, (document) => {
            if (!directoryEnabled())
                return;
            if (!document.parent || !checkIndexed(document, true))
                return;
            const item = searchItemFromDocument(document);
            quickInsert.searchLib?.addItem(item);
        });
        Hooks.on(`update${type}`, (document) => {
            if (!directoryEnabled())
                return;
            if (!document.parent)
                return;
            if (!checkIndexed(document, true)) {
                quickInsert.searchLib?.removeItem(document.uuid);
                return;
            }
            const item = searchItemFromDocument(document);
            quickInsert.searchLib?.replaceItem(item);
        });
        Hooks.on(`delete${type}`, (document) => {
            if (!directoryEnabled())
                return;
            if (!document.parent || !checkIndexed(document, true))
                return;
            quickInsert.searchLib?.removeItem(document.uuid);
        });
    });
}

async function importSystemIntegration() {
    let system = null;
    switch (game.system.id) {
        case "dnd5e":
            system = await import('./dnd5e.js');
            break;
        case "swade":
            system = await import('./swade.js');
            break;
        case "wfrp4e":
            system = await import('./wfrp4e.js');
            break;
        case "sfrpg":
            system = await import('./sfrpg.js');
            break;
        case "demonlord":
            system = await import('./demonlord.js');
            break;
        case "pf2e":
            system = await import('./pf2e.js');
            break;
        default:
            return;
    }
    return {
        id: game.system.id,
        ...system,
    };
}

var FilterType;
(function (FilterType) {
    FilterType[FilterType["Default"] = 0] = "Default";
    FilterType[FilterType["World"] = 1] = "World";
    FilterType[FilterType["Client"] = 2] = "Client";
    FilterType[FilterType["Temporary"] = 3] = "Temporary";
})(FilterType || (FilterType = {}));
const FILTER_FOLDER_ROOT = "ROOT";
const FILTER_COMPENDIUM_ALL = "ALL";
function cloneFilterConfig(original) {
    return {
        compendiums: [...original.compendiums],
        folders: [...original.folders],
        documentTypes: [...original.documentTypes],
        ...(original.system ? { system: { ...original.system } } : undefined),
    };
}

var ContextMode;
(function (ContextMode) {
    ContextMode[ContextMode["Browse"] = 0] = "Browse";
    ContextMode[ContextMode["Insert"] = 1] = "Insert";
})(ContextMode || (ContextMode = {}));
class BaseSearchContext {
    mode = ContextMode.Insert;
    spawnCSS = {};
    classes;
    filter;
    startText;
    allowMultiple = true;
    restrictTypes;
    onClose = () => {
        return;
    };
}
// Default browse context
class BrowseContext extends BaseSearchContext {
    constructor() {
        super();
        this.startText = document.getSelection()?.toString();
    }
    mode = ContextMode.Browse;
    onSubmit(item) {
        // Render the sheet for selected item
        item.show();
    }
}
class InputContext extends BaseSearchContext {
    input;
    selectionStart = null;
    selectionEnd = null;
    constructor(input) {
        super();
        this.input = input;
        const targetRect = input.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        const top = targetRect.top - bodyRect.top;
        // TODO: Real calculation!!!
        this.spawnCSS = {
            left: targetRect.left + 5,
            bottom: bodyRect.height - top - 30,
            width: targetRect.width - 10,
        };
        this.selectionStart = input.selectionStart;
        this.selectionEnd = input.selectionEnd;
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            if (this.selectionStart != this.selectionEnd) {
                this.startText = this.input.value.slice(this.selectionStart, this.selectionEnd);
            }
        }
        $(input).addClass("quick-insert-context");
    }
    insertResult(result) {
        if (this.selectionStart !== null && this.selectionEnd !== null) {
            this.input.value =
                this.input.value.slice(0, this.selectionStart) +
                    result +
                    this.input.value.slice(this.selectionEnd);
        }
        else {
            this.input.value = result;
        }
    }
    onSubmit(item) {
        if (typeof item == "string") {
            this.insertResult(item);
        }
        else {
            this.insertResult(item.journalLink);
        }
    }
    onClose = () => {
        $(this.input).removeClass("quick-insert-context");
        this.input.focus();
    };
}
class ScriptMacroContext extends InputContext {
    onSubmit(item) {
        if (typeof item == "string") {
            this.insertResult(`"${item}"`);
        }
        else {
            this.insertResult(item.script);
        }
    }
}
class RollTableContext extends InputContext {
    allowMultiple = false;
    constructor(input) {
        super(input);
        // Set filter depending on selected dropdown!
        // const resultRow = this.input.closest("li.table-result")
    }
    onSubmit(item) {
        if (typeof item == "string") {
            this.insertResult(item);
            return;
        }
        const row = $(this.input).closest(".table-result");
        const resultId = row.data("result-id");
        const appId = row.closest(".window-app").data("appid");
        const app = ui.windows[parseInt(appId)];
        if (isEntity(item)) {
            app.object.updateEmbeddedDocuments("TableResult", [
                {
                    _id: resultId,
                    documentId: item.id,
                    documentCollection: item.documentType,
                    type: 1,
                    resultId: item.id,
                    text: item.name,
                    img: item.img || null,
                },
            ]);
        }
        else if (isCompendiumEntity(item)) {
            app.object.updateEmbeddedDocuments("TableResult", [
                {
                    _id: resultId,
                    documentId: item.id,
                    documentCollection: item.package,
                    type: 2,
                    resultId: item.id,
                    text: item.name,
                    img: item.img || null,
                },
            ]);
        }
    }
}
class TinyMCEContext extends BaseSearchContext {
    editor;
    constructor(editor) {
        super();
        const targetRect = editor.selection.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        const containerRect = editor.contentAreaContainer.getBoundingClientRect();
        const top = containerRect.top + targetRect.top;
        this.spawnCSS = {
            left: containerRect.left + targetRect.left,
            bottom: bodyRect.height - top - 20,
        };
        this.editor = editor;
        this.startText = editor.selection.getContent().trim();
    }
    onSubmit(item) {
        if (typeof item == "string") {
            this.editor.insertContent(item);
        }
        else {
            this.editor.insertContent(item.journalLink);
        }
    }
    onClose = () => {
        this.editor.focus();
    };
}
class ProseMirrorContext extends BaseSearchContext {
    state;
    dispatch;
    view;
    constructor(state, dispatch, view) {
        super();
        this.state = state;
        this.dispatch = dispatch;
        this.view = view;
        this.startText = document.getSelection()?.toString();
        const start = view.coordsAtPos(state.selection.from);
        const bodyRect = document.body.getBoundingClientRect();
        const bottom = bodyRect.height - start.top - 22;
        this.spawnCSS = {
            left: start.left,
            bottom,
        };
    }
    onSubmit(item) {
        const tr = this.state.tr;
        const text = typeof item == "string" ? item : item.journalLink;
        const textNode = this.state.schema.text(text);
        tr.replaceSelectionWith(textNode);
        this.dispatch(tr);
        this.view.focus();
    }
    onClose = () => {
        this.view.focus();
    };
}
class CharacterSheetContext extends BaseSearchContext {
    documentSheet;
    anchor;
    restrictTypes = [DocumentType.ITEM];
    constructor(documentSheet, anchor, subTypes, system) {
        super();
        this.documentSheet = documentSheet;
        this.anchor = anchor;
        const targetRect = anchor.get()[0].getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        const top = bodyRect.top + targetRect.top;
        this.spawnCSS = {
            left: targetRect.left - 330,
            bottom: bodyRect.height - top - 23,
        };
        if (subTypes && subTypes.length) {
            const types = subTypes.map((subType) => `Item:${subType}`);
            const label = subTypes
                .map((subType) => loc(CONFIG.Item.typeLabels[subType]))
                .join(", ");
            this.filter = {
                id: "",
                type: FilterType.Temporary,
                tag: "auto",
                subTitle: mloc("HintAutoFilter", { name: label }),
                filterConfig: {
                    compendiums: [],
                    folders: [],
                    documentTypes: types,
                    system,
                },
                role: 0,
            };
        }
    }
    onSubmit(item) {
        if (typeof item == "string")
            return;
        const dataTransfer = new DataTransfer();
        dataTransfer.dropEffect = "copy";
        dataTransfer.setData("text/plain", JSON.stringify({
            type: item.documentType,
            uuid: item.uuid,
        }));
        //@ts-expect-error Protected shmotected
        this.documentSheet._onDrop({
            dataTransfer,
            target: this.anchor[0],
            preventDefault: () => { },
        });
    }
}
function identifyContext(target) {
    if (target && isTextInputElement(target)) {
        if (target.name === "command") {
            if (target
                .closest(".macro-sheet")
                ?.querySelector('select[name="type"]')?.value === "script") {
                return new ScriptMacroContext(target);
            }
            return new InputContext(target);
        }
        else if (target.name.startsWith("results.") &&
            target.closest(".result-details")) {
            return new RollTableContext(target);
        }
        // Right now, only allow in chat!
        if (target.id === "chat-message") {
            return new InputContext(target);
        }
    }
    // No/unknown context, browse only.
    if (getSetting(ModuleSetting.ENABLE_GLOBAL_CONTEXT) === true) {
        return new BrowseContext();
    }
    return null;
}

function typeLabel(type, subType) {
    if (type.includes(":")) {
        [type, subType] = type.split(":");
    }
    else if (!subType) {
        return loc(`DOCUMENT.${type}`);
    }
    //@ts-expect-error can't be arsed to type
    return loc(CONFIG[type]?.typeLabels?.[subType] || subType);
}
function getSubTypes(type) {
    if (type === DocumentType.JOURNALENTRY ||
        type === DocumentType.MACRO ||
        type === DocumentType.ROLLTABLE ||
        type === DocumentType.PLAYLIST ||
        type === DocumentType.SCENE ||
        type === DocumentType.ADVENTURE) {
        return [];
    }
    if (Array.isArray(game.system.documentTypes[type])) {
        return (game.system.documentTypes[type]
            .filter((t) => t !== "base")
            .map((subType) => `${type}:${subType}`) || []);
    }
    return Object.keys(game.system.documentTypes[type]).map((subType) => `${type}:${subType}`);
}

function createDefaultStore() {
    return derived([
        enabledDocumentTypes$1,
        stores[ModuleSetting.FILTERS_ADD_DEFAULT_PACKS],
        stores[ModuleSetting.FILTERS_ADD_DEFAULT_TYPE],
        stores[ModuleSetting.FILTERS_ADD_DEFAULT_SUBTYPE],
    ], ([$enabledTypes, enablePacks, enableTypes, enableSubtypes]) => {
        let filters = [];
        if (enableTypes) {
            const typeFilters = $enabledTypes.map((type) => {
                const metadata = DocumentMeta[type];
                return {
                    id: metadata.collection,
                    type: FilterType.Default,
                    tag: metadata.collection,
                    subTitle: `${game.i18n.localize(metadata.label)}`,
                    filterConfig: {
                        documentTypes: [metadata.name],
                        folders: [],
                        compendiums: [],
                    },
                    role: CONST.USER_ROLES.PLAYER,
                };
            });
            filters = filters.concat(typeFilters);
        }
        if (enablePacks && game.packs) {
            const packFilters = game.packs
                .filter(packEnabled$1)
                .map((pack) => {
                return {
                    id: pack.collection,
                    type: FilterType.Default,
                    tag: pack.collection,
                    subTitle: pack.metadata.label,
                    filterConfig: {
                        documentTypes: [],
                        folders: [],
                        compendiums: [pack.collection],
                    },
                    role: CONST.USER_ROLES.PLAYER,
                };
            });
            filters = filters.concat(packFilters);
        }
        if (enableSubtypes) {
            const subTypes = $enabledTypes
                .filter((type) => type === DocumentType.ITEM || type === DocumentType.ACTOR)
                .map(getSubTypes)
                .flat();
            const subTypeFilters = subTypes.map((subType) => {
                return {
                    id: subType,
                    type: FilterType.Default,
                    tag: subType.split(":")[1],
                    subTitle: typeLabel(subType),
                    filterConfig: {
                        documentTypes: [subType],
                        folders: [],
                        compendiums: [],
                    },
                    role: CONST.USER_ROLES.PLAYER,
                };
            });
            filters = filters.concat(subTypeFilters);
        }
        return filters;
    });
}
const defaultFilters = createDefaultStore();
function createCompoundStore() {
    return derived([
        defaultFilters,
        stores[ModuleSetting.FILTERS_CLIENT],
        stores[ModuleSetting.FILTERS_WORLD],
    ], ([$default, $client, $world]) => {
        const filters = {};
        $default.forEach((filter) => (filters[filter.id] = filter));
        $client.filters.forEach((filter) => (filters[filter.id] = filter));
        $world.filters.forEach((filter) => (filters[filter.id] = filter));
        Object.keys(filters).forEach((id) => (filters[id].disabled = false));
        $client.disabled.forEach((key) => {
            if (key in filters)
                filters[key].disabled = true;
        });
        return filters;
    });
}
const filterStore = createCompoundStore();
const visibleFilters = derived(filterStore, (filters) => {
    return Object.values(filters).filter((filter) => filter.role <= (game.user?.role || 0) && !filter.disabled);
});
function toggleFilter(id) {
    stores[ModuleSetting.FILTERS_CLIENT].update((v) => {
        const disabled = v.disabled.includes(id)
            ? v.disabled.filter((d) => d !== id)
            : [...v.disabled, id];
        return { ...v, disabled };
    });
}
function deleteFilter(id) {
    const store = get(filterStore);
    if (store[id].type === FilterType.Client) {
        stores[ModuleSetting.FILTERS_CLIENT].update((v) => {
            return { ...v, filters: v.filters.filter((f) => f.id !== id) };
        });
    }
    else if (store[id].type === FilterType.World) {
        stores[ModuleSetting.FILTERS_WORLD].update((v) => {
            return { ...v, filters: v.filters.filter((f) => f.id !== id) };
        });
    }
}
function addFilter(filter) {
    if (filter.type === FilterType.Client) {
        stores[ModuleSetting.FILTERS_CLIENT].update((v) => {
            return { ...v, filters: [...v.filters, filter] };
        });
    }
    else if (filter.type === FilterType.World) {
        stores[ModuleSetting.FILTERS_WORLD].update((v) => {
            return { ...v, filters: [...v.filters, filter] };
        });
    }
}
function updateFilter(filter) {
    if (filter.type === FilterType.Client) {
        stores[ModuleSetting.FILTERS_CLIENT].update((v) => {
            const i = v.filters.findIndex((f) => f.id === filter.id);
            if (i !== -1) {
                v.filters[i] = filter;
            }
            return { ...v };
        });
    }
    else if (filter.type === FilterType.World) {
        stores[ModuleSetting.FILTERS_WORLD].update((v) => {
            const i = v.filters.findIndex((f) => f.id === filter.id);
            if (i !== -1) {
                v.filters[i] = filter;
            }
            return { ...v };
        });
    }
}

class SearchFilterCollection {
    filters = [];
    init() {
        visibleFilters.subscribe((v) => (this.filters = v));
    }
    search(query) {
        if (!query) {
            return [...this.filters];
        }
        return this.filters.filter((f) => f.tag.includes(query));
    }
    getFilter(id) {
        return this.filters.find((f) => f.id == id);
    }
    getFilterByTag(tag) {
        return this.filters.filter((f) => !f.disabled).find((f) => f.tag == tag);
    }
}
// Is parentFolder inside targetFolder?
function isInFolder(parentFolder, targetFolder) {
    if (targetFolder === FILTER_FOLDER_ROOT)
        return true;
    while (parentFolder) {
        if (parentFolder === targetFolder)
            return true;
        parentFolder = game.folders?.get(parentFolder)?.folder?.id;
    }
    return false;
}
function hasSystem(config) {
    return config.system !== undefined && Object.keys(config.system).length !== 0;
}
function matchFilterConfig(config, resultItem) {
    let entityMatch = true;
    if (config.documentTypes.length) {
        entityMatch =
            config.documentTypes.includes(resultItem.item.documentType) ||
                Boolean(resultItem.item.subType &&
                    config.documentTypes.includes(`${resultItem.item.documentType}:${resultItem.item.subType}`));
    }
    if (!entityMatch) {
        return false;
    }
    const filterByLocation = Boolean(config.folders.length + config.compendiums.length);
    if (filterByLocation) {
        let locationMatch = false;
        if (isEntity(resultItem.item) || isEmbeddedEntity(resultItem.item)) {
            const filterRoot = config.folders.length === 1 && config.folders[0] === FILTER_FOLDER_ROOT;
            if (filterRoot) {
                locationMatch = true;
            }
            else {
                for (const f of config.folders) {
                    if (isInFolder(resultItem.item.folder?.id, f)) {
                        locationMatch = true;
                        break;
                    }
                }
            }
        }
        else if (isCompendiumEntity(resultItem.item) ||
            isEmbeddedCompendiumEntity(resultItem.item)) {
            const filterAll = config.compendiums.length === 1 &&
                config.compendiums[0] === FILTER_COMPENDIUM_ALL;
            locationMatch =
                filterAll || config.compendiums.includes(resultItem.item.package);
        }
        if (!locationMatch) {
            return false;
        }
    }
    const fieldsToMatch = getSystemFields(resultItem.item.documentType);
    const filterBySystemExtension = fieldsToMatch.length !== 0 && hasSystem(config);
    if (filterBySystemExtension && resultItem.item.system) {
        return fieldsToMatch.every((f) => {
            const field = f.indexName;
            const configValue = config.system[field];
            const resultValue = resultItem.item.system?.[field];
            if (configValue === undefined) {
                return true;
            }
            if (resultValue === undefined) {
                return false;
            }
            if (typeof configValue === "object") {
                // Range filter
                if (typeof resultValue !== "number") {
                    return false;
                }
                return resultValue >= configValue.min && resultValue <= configValue.max;
            }
            else {
                return resultValue === configValue;
            }
        });
    }
    return true;
}

// Module singleton class that contains everything
class QuickInsertCore {
    app;
    searchLib;
    filters = new SearchFilterCollection();
    systemIntegration;
    get hasIndex() {
        return Boolean(this.searchLib?.index);
    }
    /**
     * Incorrect to match like this with new keybinds!
     * @deprecated
     */
    matchBoundKeyEvent() {
        return false;
    }
    // If the global key binds are not enough - e.g. in a custom editor,
    // include the custom search context!
    handleKeybind(evt, context) {
        if (!context)
            throw new Error("A custom context is required!");
        customKeybindHandler(evt, context);
    }
    open(context) {
        this.app?.render({ context });
    }
    toggle(context) {
        if (this.app?.rendered) {
            this.app.close();
        }
        else {
            this.open(context);
        }
    }
    search(text, filter = null, max = 100) {
        return this.searchLib?.search(text, filter, max) || [];
    }
    async forceIndex() {
        return loadSearchIndex();
    }
}
const QuickInsert = new QuickInsertCore();
// Ensure that only one loadSearchIndex function is running at any one time.
let isLoading = false;
async function loadSearchIndex() {
    if (isLoading)
        return;
    isLoading = true;
    console.log("Quick Insert | Preparing search index...");
    const start = performance.now();
    QuickInsert.searchLib = new SearchLib();
    QuickInsert.searchLib.indexDocuments();
    console.log(`Quick Insert | Indexing compendiums`);
    await QuickInsert.searchLib.indexCompendiums();
    console.log(`Quick Insert | Search index and filters completed. Indexed ${QuickInsert.searchLib?.index.getSize() || 0} items in ${performance.now() - start}ms`);
    isLoading = false;
    Hooks.callAll("QuickInsert:IndexCompleted", QuickInsert);
}

function registerTinyMCEPlugin() {
    // TinyMCE addon registration
    tinymce.PluginManager.add("quickinsert", function (editor) {
        editor.on("keydown", (evt) => {
            const context = new TinyMCEContext(editor);
            customKeybindHandler(evt, context);
        });
        editor.ui.registry.addButton("quickinsert", {
            tooltip: "Quick Insert",
            icon: "search",
            onAction: function () {
                // Open window
                QuickInsert.open(new TinyMCEContext(editor));
            },
        });
    });
    CONFIG.TinyMCE.plugins = CONFIG.TinyMCE.plugins + " quickinsert";
    CONFIG.TinyMCE.toolbar = CONFIG.TinyMCE.toolbar + " quickinsert";
}

const AppV2$2 = foundry.applications.api.ApplicationV2;
class AboutApp extends AppV2$2 {
    static DEFAULT_OPTIONS = {
        id: "qi-about-app",
        classes: ["application"],
        window: {
            title: "QUICKINSERT.AboutTitle",
            frame: true,
            positioned: true,
            minimizable: false,
            resizable: false,
            content: false,
        },
        position: {
            width: 350,
        },
    };
    async _renderHTML() {
        return "";
    }
    _replaceHTML(result, content) {
        content.innerHTML = `
    <img src="../modules/quick-insert/images/fvtt-modules-lab.png">
        <p>${mloc("AboutThanks")}</p>
        <p>${mloc("AboutDescription")}</p>
        <ul>
            <li>
                <a href="https://discord.gg/jM4XQ33EjK" target="_blank">
                  ${mloc("AboutDiscord")}
                </a>
            </li>
            <li>
                <a href="https://gitlab.com/fvtt-modules-lab/quick-insert/-/issues" target="_blank">
                  ${mloc("AboutIssues")}
                </a>
            </li>
            <li>
                <a href="https://ko-fi.com/sunspots" target="_blank">
                  ${mloc("AboutSupport")}
                </a>
            </li>
        <ul>
    `;
    }
}
function openAboutApp() {
    new AboutApp({}).render(true);
}

var root$t = template(`<div><!></div>`);

const $$css$w = {
	hash: 'svelte-5hycqw',
	code: '.form-group.svelte-5hycqw:last-child {border-bottom:none;}.subfield.svelte-5hycqw {margin-left:2.3em;border-bottom:none;}'
};

function FormGroup($$anchor, $$props) {
	append_styles($$anchor, $$css$w);

	let sub = prop($$props, 'sub', 3, false);
	var div = root$t();
	let classes;
	var node = child(div);

	slot(node, $$props, 'default', {});
	template_effect(($0) => classes = set_class(div, 1, 'form-group svelte-5hycqw', null, classes, $0), [() => ({ subfield: sub() })]);
	append($$anchor, div);
}

var root_2$d = template(`<p class="hint"> </p>`);
var root_1$m = template(`<label class="svelte-oi272j"> </label> <div class="form-fields"><input type="checkbox" data-dtype="Boolean"></div> <!>`, 1);

const $$css$v = {
	hash: 'svelte-oi272j',
	code: 'label.svelte-oi272j {white-space:nowrap;}'
};

function FormCheckbox($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$v);

	const [$$stores, $$cleanup] = setup_stores();
	const $checked = () => store_get(checked, '$checked', $$stores);
	let sub = prop($$props, 'sub', 3, false);
	const checked = stores[$$props.setting];

	FormGroup($$anchor, {
		get sub() {
			return sub();
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$m();
			var label_1 = first_child(fragment_1);
			var text = child(label_1);

			var div = sibling(label_1, 2);
			var input = child(div);

			var node = sibling(div, 2);

			{
				var consequent = ($$anchor) => {
					var p = root_2$d();
					var text_1 = child(p);
					template_effect(() => set_text(text_1, $$props.notes));
					append($$anchor, p);
				};

				if_block(node, ($$render) => {
					if ($$props.notes) $$render(consequent);
				});
			}

			template_effect(() => {
				set_attribute(label_1, 'for', $$props.setting);
				set_text(text, $$props.label);
				set_attribute(input, 'name', $$props.setting);
				set_attribute(input, 'id', $$props.setting);
			});

			bind_checked(input, $checked, ($$value) => store_set(checked, $$value));
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	pop();
	$$cleanup();
}

var root_2$c = template(`<option> </option>`);
var root_3$3 = template(`<p class="hint"> </p>`);
var root_1$l = template(`<label class="svelte-oi272j"> </label> <div class="form-fields"><select></select></div> <!>`, 1);

const $$css$u = {
	hash: 'svelte-oi272j',
	code: 'label.svelte-oi272j {white-space:nowrap;}'
};

function FormSelect($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$u);

	const [$$stores, $$cleanup] = setup_stores();
	const $value = () => store_get(value, '$value', $$stores);
	const value = stores[$$props.setting];
	const registration = game.settings.settings.get(`quick-insert.${$$props.setting}`);
	const type = registration?.type;
	const options = Object.entries(registration?.choices || {}).map(([id, title]) => ({ id, title: loc(title) }));
	let select;

	FormGroup($$anchor, {
		get sub() {
			return $$props.sub;
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$l();
			var label_1 = first_child(fragment_1);
			var text = child(label_1);

			var div = sibling(label_1, 2);
			var select_1 = child(div);
			const expression = derived$1(() => $value().toString());

			init_select(select_1, () => get$1(expression));

			var select_1_value;

			each(select_1, 21, () => options, (option) => option.id, ($$anchor, option) => {
				var option_1 = root_2$c();
				var option_1_value = {};
				var text_1 = child(option_1);

				template_effect(
					($0) => {
						if (option_1_value !== (option_1_value = $0)) {
							option_1.value = null == (option_1.__value = $0) ? '' : $0;
						}

						set_text(text_1, get$1(option).title);
					},
					[() => get$1(option).id.toString()]
				);

				append($$anchor, option_1);
			});
			bind_this(select_1, ($$value) => select = $$value, () => select);

			var node = sibling(div, 2);

			{
				var consequent = ($$anchor) => {
					var p = root_3$3();
					var text_2 = child(p);
					template_effect(() => set_text(text_2, $$props.notes));
					append($$anchor, p);
				};

				if_block(node, ($$render) => {
					if ($$props.notes) $$render(consequent);
				});
			}

			template_effect(() => {
				set_attribute(label_1, 'for', $$props.setting);
				set_text(text, $$props.label);
				set_attribute(select_1, 'name', $$props.setting);
				set_attribute(select_1, 'id', $$props.setting);

				if (select_1_value !== (select_1_value = get$1(expression))) {
					(
						select_1.value = null == (select_1.__value = get$1(expression)) ? '' : get$1(expression),
						select_option(select_1, get$1(expression))
					);
				}

				select_1.disabled = $$props.disabled;
			});

			event('blur', select_1, () => store_set(value, type === Number ? parseFloat(select.value) : select.value));
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	pop();
	$$cleanup();
}

var root$s = template(`<fieldset class="svelte-z8u5q7"><legend class="svelte-z8u5q7"> </legend> <!></fieldset>`);

const $$css$t = {
	hash: 'svelte-z8u5q7',
	code: 'fieldset.svelte-z8u5q7 {display:flex;align-items:flex-start;flex-wrap:wrap;gap:0 1em;flex-direction:row;}legend.svelte-z8u5q7 {color:var(--color-text-primary);text-shadow:none;}'
};

function SettingsGroup($$anchor, $$props) {
	append_styles($$anchor, $$css$t);

	var fieldset = root$s();
	var legend = child(fieldset);
	var text = child(legend);

	var node = sibling(legend, 2);

	slot(node, $$props, 'default', {});
	template_effect(() => set_text(text, $$props.title));
	append($$anchor, fieldset);
}

var root_1$k = template(`<div class="options svelte-1kbg508"><!> <!> <!> <!> <!> <!></div>`);
var root$r = template(`<div role="tabpanel"><p class="notes svelte-1kbg508"> </p> <!></div>`);

const $$css$s = {
	hash: 'svelte-1kbg508',
	code: '.gmtab.svelte-1kbg508 {overflow:auto;height:100%;padding:0.6em;}.hidden.svelte-1kbg508 {display:none;}.gmtab.svelte-1kbg508 .form-fields:first-child {flex-grow:0;margin-right:0.2em;}.options.svelte-1kbg508 {display:flex;flex-direction:column;flex-grow:1;width:50%;gap:1rem;}p.notes.svelte-1kbg508 {margin-top:0;}kbd {flex:none;padding:0 4px;min-width:24px;background:rgba(255, 255, 255, 0.25);border:1px solid var(--color-border-light-2);border-radius:5px;box-shadow:1px 1px #444;text-align:center;}'
};

function GmTab($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$s);

	let active = prop($$props, 'active', 3, false);
	var div = root$r();
	let classes;
	var p = child(div);
	var text = child(p);

	var node = sibling(p, 2);

	SettingsGroup(node, {
		title: 'General Settings',
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$k();
			var node_1 = child(div_1);
			const expression = derived$1(() => mloc("SettingsGmOnly"));
			const expression_1 = derived$1(() => mloc("SettingsGmOnlyHint"));

			FormCheckbox(node_1, {
				get label() {
					return get$1(expression);
				},
				get setting() {
					return ModuleSetting.GM_ONLY;
				},
				get notes() {
					return get$1(expression_1);
				}
			});

			var node_2 = sibling(node_1, 2);
			const expression_2 = derived$1(() => mloc("SettingsFiltersSheetsEnabled"));
			const expression_3 = derived$1(() => mloc("SettingsFiltersSheetsEnabledHint"));

			FormCheckbox(node_2, {
				get label() {
					return get$1(expression_2);
				},
				get setting() {
					return ModuleSetting.FILTERS_SHEETS_ENABLED;
				},
				get notes() {
					return get$1(expression_3);
				}
			});

			var node_3 = sibling(node_2, 2);
			const expression_4 = derived$1(() => mloc("SettingsAutomaticIndexing"));
			const expression_5 = derived$1(() => mloc("SettingsAutomaticIndexingHint"));

			FormSelect(node_3, {
				get label() {
					return get$1(expression_4);
				},
				get setting() {
					return ModuleSetting.AUTOMATIC_INDEXING;
				},
				get notes() {
					return get$1(expression_5);
				}
			});

			var node_4 = sibling(node_3, 2);
			const expression_6 = derived$1(() => mloc("SettingsSearchButton"));
			const expression_7 = derived$1(() => mloc("SettingsSearchButtonHint"));

			FormCheckbox(node_4, {
				get label() {
					return get$1(expression_6);
				},
				get setting() {
					return ModuleSetting.SEARCH_BUTTON;
				},
				get notes() {
					return get$1(expression_7);
				}
			});

			var node_5 = sibling(node_4, 2);
			const expression_8 = derived$1(() => mloc("SettingsEmbeddedIndexing"));
			const expression_9 = derived$1(() => mloc("SettingsEmbeddedIndexingHint"));

			FormCheckbox(node_5, {
				get label() {
					return get$1(expression_8);
				},
				get setting() {
					return ModuleSetting.EMBEDDED_INDEXING;
				},
				get notes() {
					return get$1(expression_9);
				}
			});

			var node_6 = sibling(node_5, 2);
			const expression_10 = derived$1(() => mloc("SettingsTocIndexing"));
			const expression_11 = derived$1(() => mloc("SettingsTocIndexingHint"));

			FormCheckbox(node_6, {
				get label() {
					return get$1(expression_10);
				},
				get setting() {
					return ModuleSetting.TOC_INDEXING;
				},
				get notes() {
					return get$1(expression_11);
				}
			});
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});

	template_effect(
		($0, $1) => {
			classes = set_class(div, 1, 'gmtab standard-form svelte-1kbg508', null, classes, $0);
			set_text(text, $1);
		},
		[
			() => ({ hidden: !active() }),
			() => mloc("SettingsGlobalSettingDescription")
		]
	);

	append($$anchor, div);
	pop();
}

const DOCUMENTACTIONS = {
    show: (item) => item.show(),
    roll: (item) => item.get().then((d) => d.draw()),
    viewScene: (item) => item.get().then((d) => d.view()),
    activateScene: (item) => item.get().then((d) => {
        if (game.user?.isGM) {
            d.activate();
        }
    }),
    execute: (item) => item.get().then((d) => d.execute()),
    insert: (item) => item,
    rollInsert: (item) => item.get().then(async (d) => {
        const roll = await d.roll();
        for (const data of roll.results) {
            if (!data.documentId) {
                return data.text;
            }
            if (data.documentCollection.includes(".")) {
                const pack = game.packs.get(data.documentCollection);
                if (!pack)
                    return data.text;
                const indexItem = game.packs
                    .get(data.documentCollection)
                    ?.index.find((i) => i._id === data.documentId);
                return indexItem
                    ? new CompendiumSearchItem(pack, indexItem)
                    : data.text;
            }
            else {
                const entity = getCollectionFromType(data.documentCollection).get(data.documentId);
                return entity ? new EntitySearchItem(entity) : data.text;
            }
        }
    }),
};
let memoizedBrowseDocumentActions = undefined;
function getBrowseDocumentActions() {
    if (memoizedBrowseDocumentActions) {
        return memoizedBrowseDocumentActions;
    }
    const actions = {
        [DocumentType.SCENE]: [
            {
                id: "activateScene",
                icon: "fas fa-bullseye",
                title: foundry.utils.isNewerVersion(game.version, "13")
                    ? "SCENE.Activate"
                    : "SCENES.Activate",
            },
            {
                id: "viewScene",
                icon: "fas fa-eye",
                title: foundry.utils.isNewerVersion(game.version, "13")
                    ? "SCENE.View"
                    : "SCENES.View",
            },
            {
                id: "show",
                icon: "fas fa-cogs",
                title: foundry.utils.isNewerVersion(game.version, "13")
                    ? "SCENE.Configure"
                    : "SCENES.Configure",
            },
        ],
        [DocumentType.ROLLTABLE]: [
            {
                id: "roll",
                icon: "fas fa-dice-d20",
                title: foundry.utils.isNewerVersion(game.version, "13")
                    ? "TABLE.ACTIONS.DrawResult"
                    : "TABLE.Roll",
            },
            {
                id: "show",
                icon: `fas ${documentIcons[DocumentType.ROLLTABLE]}`,
                title: "QUICKINSERT.ActionEdit",
            },
        ],
        [DocumentType.MACRO]: [
            {
                id: "execute",
                icon: "fas fa-play",
                title: "QUICKINSERT.ActionExecute",
            },
            {
                id: "show",
                icon: `fas ${documentIcons[DocumentType.ROLLTABLE]}`,
                title: "QUICKINSERT.ActionEdit",
            },
        ],
    };
    AvailableDocumentTypes.forEach((type) => {
        if (type in actions)
            return;
        actions[type] = [
            {
                id: "show",
                icon: `fas ${documentIcons[type]}`,
                title: "QUICKINSERT.ActionShow",
            },
        ];
    });
    memoizedBrowseDocumentActions = actions;
    return actions;
}
// Same for all inserts
const insertAction = {
    id: "insert",
    icon: `fas fa-plus`,
    title: "Insert",
};
let memoizedInsertDocumentActions = undefined;
function getInsertDocumentActions() {
    if (memoizedInsertDocumentActions) {
        return memoizedInsertDocumentActions;
    }
    const actions = {
        [DocumentType.SCENE]: [
            {
                id: "show",
                icon: "fas fa-cogs",
                title: "Configure",
            },
        ],
        [DocumentType.ROLLTABLE]: [
            {
                id: "rollInsert",
                icon: "fas fa-play",
                title: "Roll and Insert",
            },
            {
                id: "show",
                icon: `fas ${documentIcons[DocumentType.ROLLTABLE]}`,
                title: "Show",
            },
        ],
    };
    // Add others
    AvailableDocumentTypes.forEach((type) => {
        if (!actions[type]) {
            // If nothing else, add "Show"
            actions[type] = [
                {
                    id: "show",
                    icon: `fas ${documentIcons[type]}`,
                    title: "Show",
                },
            ];
        }
        actions[type].push(insertAction);
    });
    memoizedInsertDocumentActions = actions;
    return actions;
}
function getActions(type, isInsertContext) {
    return isInsertContext
        ? getInsertDocumentActions()[type]
        : getBrowseDocumentActions()[type];
}
function getDefaultActions() {
    return {
        [DocumentType.SCENE]: getSetting(ModuleSetting.DEFAULT_ACTION_SCENE),
        [DocumentType.ROLLTABLE]: getSetting(ModuleSetting.DEFAULT_ACTION_ROLL_TABLE),
        [DocumentType.MACRO]: getSetting(ModuleSetting.DEFAULT_ACTION_MACRO),
    };
}
function defaultAction(type, isInsertContext) {
    if (!isInsertContext) {
        switch (type) {
            case DocumentType.SCENE:
                return getSetting(ModuleSetting.DEFAULT_ACTION_SCENE);
            case DocumentType.ROLLTABLE:
                return getSetting(ModuleSetting.DEFAULT_ACTION_ROLL_TABLE);
            case DocumentType.MACRO:
                return getSetting(ModuleSetting.DEFAULT_ACTION_MACRO);
        }
    }
    const actions = getActions(type, isInsertContext);
    return actions[actions.length - 1].id;
}

const basicData = {
    item: {
        name: "Shield",
        documentType: DocumentType.ITEM,
        img: "icons/equipment/shield/heater-steel-boss-red.webp",
    },
    actor: {
        name: "Forest Giant",
        documentType: DocumentType.ACTOR,
        img: "icons/creatures/magical/humanoid-giant-forest-blue.webp",
    },
    journalEntry: {
        name: "JournalEntry 1",
        documentType: DocumentType.JOURNALENTRY,
    },
    macro: {
        name: "Macro 1",
        documentType: DocumentType.MACRO,
    },
    rollTable: {
        name: "RollTable 1",
        documentType: DocumentType.ROLLTABLE,
    },
    scene: {
        name: "Scene 1",
        documentType: DocumentType.SCENE,
    },
};
function makeNew(base, insertContext = false) {
    const id = randomId(10);
    const item = new EntitySearchItem({
        id: id,
        uuid: id,
        img: null,
        ...base,
    });
    item.__source = "quick-insert:native";
    return {
        item,
        actions: getActions(base.documentType, insertContext),
        defaultAction: defaultAction(base.documentType, insertContext),
    };
}
function fakeSearchResults(insertContext = false) {
    return [
        makeNew(basicData.item, insertContext),
        makeNew(basicData.actor, insertContext),
        makeNew(basicData.journalEntry, insertContext),
        makeNew(basicData.macro, insertContext),
        makeNew(basicData.rollTable, insertContext),
        makeNew(basicData.scene, insertContext),
    ];
}

// https://stackoverflow.com/a/75355272
// WTF!
// parseFloat('-0') => -0 vs parseFloat(-0) => 0
// -0 === 0 => true vs Object.is(-0, 0) => false
const minus0Hack = (value) => (Object.is(value, -0) ? "-0" : value);
const operators = {
    "+": {
        func: (x, y) => `${minus0Hack(Number(x) + Number(y))}`,
        precedence: 1,
        associativity: "left",
        arity: 2,
    },
    "-": {
        func: (x, y) => `${minus0Hack(Number(x) - Number(y))}`,
        precedence: 1,
        associativity: "left",
        arity: 2,
    },
    "*": {
        func: (x, y) => `${minus0Hack(Number(x) * Number(y))}`,
        precedence: 2,
        associativity: "left",
        arity: 2,
    },
    "/": {
        func: (x, y) => `${minus0Hack(Number(x) / Number(y))}`,
        precedence: 2,
        associativity: "left",
        arity: 2,
    },
    "%": {
        func: (x, y) => `${minus0Hack(Number(x) % Number(y))}`,
        precedence: 2,
        associativity: "left",
        arity: 2,
    },
    "^": {
        // Why Math.pow() instead of **?
        // -2 ** 2 => "SyntaxError: Unary operator used immediately before exponentiation expression..."
        // Math.pow(-2, 2) => -4
        // eslint-disable-next-line prefer-exponentiation-operator, no-restricted-properties
        func: (x, y) => `${minus0Hack(Math.pow(Number(x), Number(y)))}`,
        precedence: 3,
        associativity: "right",
        arity: 2,
    },
};
const operatorsKeys = Object.keys(operators);
const functions = {
    min: {
        func: (x, y) => `${minus0Hack(Math.min(Number(x), Number(y)))}`,
        arity: 2,
    },
    max: {
        func: (x, y) => `${minus0Hack(Math.max(Number(x), Number(y)))}`,
        arity: 2,
    },
    sin: { func: (x) => `${minus0Hack(Math.sin(Number(x)))}`, arity: 1 },
    cos: { func: (x) => `${minus0Hack(Math.cos(Number(x)))}`, arity: 1 },
    tan: { func: (x) => `${minus0Hack(Math.tan(Number(x)))}`, arity: 1 },
    log: { func: (x) => `${Math.log(Number(x))}`, arity: 1 }, // No need for -0 hack
};
const functionsKeys = Object.keys(functions);
const top = (stack) => stack[stack.length - 1];
/**
 * Shunting yard algorithm: converts infix expression to postfix expression (reverse Polish notation)
 *
 * Example: ['1', '+', '2'] => ['1', '2', '+']
 *
 * https://en.wikipedia.org/wiki/Shunting_yard_algorithm
 * https://github.com/poteat/shunting-yard-typescript
 * https://blog.kallisti.net.nz/2008/02/extension-to-the-shunting-yard-algorithm-to-allow-variable-numbers-of-arguments-to-functions/
 */
function shuntingYard(tokens) {
    const output = new Array();
    const operatorStack = new Array();
    for (const token of tokens) {
        if (functions[token] !== undefined) {
            operatorStack.push(token);
        }
        else if (token === ",") {
            while (operatorStack.length > 0 && top(operatorStack) !== "(") {
                output.push(operatorStack.pop());
            }
            if (operatorStack.length === 0) {
                throw new Error("Misplaced ','");
            }
        }
        else if (operators[token] !== undefined) {
            const o1 = token;
            while (operatorStack.length > 0 &&
                top(operatorStack) !== undefined &&
                top(operatorStack) !== "(" &&
                (operators[top(operatorStack)].precedence >
                    operators[o1].precedence ||
                    (operators[o1].precedence ===
                        operators[top(operatorStack)].precedence &&
                        operators[o1].associativity === "left"))) {
                output.push(operatorStack.pop()); // o2
            }
            operatorStack.push(o1);
        }
        else if (token === "(") {
            operatorStack.push(token);
        }
        else if (token === ")") {
            while (operatorStack.length > 0 && top(operatorStack) !== "(") {
                output.push(operatorStack.pop());
            }
            if (operatorStack.length > 0 && top(operatorStack) === "(") {
                operatorStack.pop();
            }
            else {
                throw new Error("Parentheses mismatch");
            }
            if (functions[top(operatorStack)] !== undefined) {
                output.push(operatorStack.pop());
            }
        }
        else {
            output.push(token);
        }
    }
    // Remaining items
    while (operatorStack.length > 0) {
        const operator = top(operatorStack);
        if (operator === "(") {
            throw new Error("Parentheses mismatch");
        }
        else {
            output.push(operatorStack.pop());
        }
    }
    return output;
}
/**
 * Evaluates reverse Polish notation (RPN) (postfix expression).
 *
 * Example: ['1', '2', '+'] => 3
 *
 * https://en.wikipedia.org/wiki/Reverse_Polish_notation
 * https://github.com/poteat/shunting-yard-typescript
 */
function evalReversePolishNotation(tokens) {
    const stack = new Array();
    const ops = { ...operators, ...functions };
    for (const token of tokens) {
        const op = ops[token];
        if (op !== undefined) {
            const parameters = [];
            for (let i = 0; i < op.arity; i++) {
                parameters.push(stack.pop());
            }
            stack.push(op.func(...parameters.reverse()));
        }
        else {
            stack.push(token);
        }
    }
    if (stack.length > 1) {
        throw new Error("Insufficient operators");
    }
    return Number(stack[0]);
}
/**
 * Breaks a mathematical expression into tokens.
 *
 * Example: "1 + 2" => [1, '+', 2]
 *
 * https://gist.github.com/tchayen/44c28e8d4230b3b05e9f
 */
function tokenize(expression) {
    // "1  +" => "1 +"
    const expr = expression.replace(/\s+/g, " ");
    const tokens = [];
    let acc = "";
    let currentNumber = "";
    for (let i = 0; i < expr.length; i++) {
        const c = expr.charAt(i);
        const prev_c = expr.charAt(i - 1); // '' if index out of range
        const next_c = expr.charAt(i + 1); // '' if index out of range
        const lastToken = top(tokens);
        const numberParsingStarted = currentNumber !== "";
        if (
        // 1
        /\d/.test(c) ||
            // Unary operator: +1 or -1
            ((c === "+" || c === "-") &&
                !numberParsingStarted &&
                (lastToken === undefined ||
                    lastToken === "," ||
                    lastToken === "(" ||
                    operatorsKeys.includes(lastToken)) &&
                /\d/.test(next_c))) {
            currentNumber += c;
        }
        else if (c === ".") {
            if (numberParsingStarted && currentNumber.includes(".")) {
                throw new Error(`Double '.' in number: '${currentNumber}${c}'`);
            }
            else {
                currentNumber += c;
            }
        }
        else if (c === " ") {
            if (/\d/.test(prev_c) && /\d/.test(next_c)) {
                throw new Error(`Space in number: '${currentNumber}${c}${next_c}'`);
            }
        }
        else if (functionsKeys.includes(acc + c)) {
            acc += c;
            if (!functionsKeys.includes(acc + next_c)) {
                tokens.push(acc);
                acc = "";
            }
        }
        else if (operatorsKeys.includes(c) ||
            c === "(" ||
            c === ")" ||
            c === ",") {
            if (operatorsKeys.includes(c) &&
                !numberParsingStarted &&
                operatorsKeys.includes(lastToken)) {
                throw new Error(`Consecutive operators: '${lastToken}${c}'`);
            }
            if (numberParsingStarted) {
                tokens.push(currentNumber);
            }
            tokens.push(c);
            currentNumber = "";
        }
        else {
            acc += c;
        }
    }
    if (acc !== "") {
        throw new Error(`Invalid characters: '${acc}'`);
    }
    // Add last number to the tokens
    if (currentNumber !== "") {
        tokens.push(currentNumber);
    }
    // ['+', '1'] => ['0', '+', '1']
    // ['-', '1'] => ['0', '-', '1']
    if (tokens[0] === "+" || tokens[0] === "-") {
        tokens.unshift("0");
    }
    return tokens;
}
function calculate(expression) {
    const tokens = tokenize(expression);
    const rpn = shuntingYard(tokens);
    return evalReversePolishNotation(rpn);
}

function getContents() {
    return CONFIG.Playlist.collection.instance.contents
        .filter((i) => i.visible)
        .map((c) => {
        // typing doesn't understand the collection instance type
        const instance = c;
        return {
            id: instance._id,
            instance,
            track: instance.playing
                ? instance.sounds.find((s) => s.playing)?.name || undefined
                : undefined,
        };
    });
}
function searchPlaylists(query) {
    if (!query) {
        return getContents().map((item) => ({
            item,
        }));
    }
    return fuzziersort_default
        .go(query, getContents(), {
        key: (i) => i.instance.name,
        all: true,
        threshold: 0.5,
    })
        .map((res) => {
        return {
            item: res.obj,
            formattedMatch: res.highlight("<strong>", "</strong>"),
        };
    });
}

const systemDocumentActions = {};
const systemDocumentActionCallbacks = {};

var SearchMode;
(function (SearchMode) {
    SearchMode["DOCUMENT"] = "DOCUMENT";
    SearchMode["FILTER"] = "FILTER";
    SearchMode["HELP"] = "HELP";
    SearchMode["COMMANDS"] = "COMMANDS";
    SearchMode["SLASH"] = "SLASH";
    SearchMode["CALC"] = "CALC";
    SearchMode["AUDIO"] = "AUDIO";
    SearchMode["OWNED"] = "OWNED";
})(SearchMode || (SearchMode = {}));
class SearchController {
}
class DocumentController extends SearchController {
    hint = undefined;
    #close;
    #context;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onTab(_item) { }
    get isInsertMode() {
        return this.#context?.mode == ContextMode.Insert;
    }
    constructor(options) {
        super();
        this.#context = options.getContext();
        this.#close = options.close;
    }
    async onAction(item, action, shiftKey) {
        if (!action) {
            return;
        }
        const searchItem = item;
        console.info(`Quick Insert | Invoked Action [${action}] on [${searchItem.name}] shiftKey:${shiftKey}`);
        const val = await DOCUMENTACTIONS[action](searchItem);
        if (val && this.isInsertMode) {
            // this.app.keepOpen = shiftKey; // Keep open until onSubmit completes
            this.#context?.onSubmit?.(val);
        }
        if (!shiftKey || this.#context?.allowMultiple === false) {
            this.#close();
        }
    }
    search = (textInput, filter) => {
        if (!QuickInsert.searchLib)
            return [];
        textInput = textInput.trim();
        if (!filter && textInput.length == 0) {
            return [];
        }
        // Set a lower maximum if search is zero or one char (single-character search is fast, but rendering is slow).
        const max = textInput.length <= 1 ? 20 : 100;
        let results = [];
        if (filter) {
            if (filter.filterConfig) {
                results = QuickInsert.searchLib.search(textInput, (item) => filter?.filterConfig
                    ? matchFilterConfig(filter.filterConfig, item)
                    : true, max);
            }
        }
        else {
            results = QuickInsert.searchLib.search(textInput, null, max);
        }
        if (this.#context?.restrictTypes &&
            this.#context?.restrictTypes.length > 0) {
            results = results.filter((i) => this.#context?.restrictTypes?.includes(i.item.documentType));
        }
        const defaultActions = getDefaultActions();
        return results
            .map((res) => {
            const actions = getActions(res.item.documentType, this.isInsertMode);
            return {
                item: res.item,
                formattedMatch: res.formattedMatch,
                actions: actions,
                defaultAction: (!this.isInsertMode && defaultActions[res.item.documentType]) ||
                    actions[actions.length - 1].id,
            };
        })
            .reverse();
    };
}
class FilterController extends SearchController {
    hint = "QUICKINSERT.SearchModeTitleFilter";
    setFilter;
    constructor(callbacks) {
        super();
        this.setFilter = callbacks.setFilter;
    }
    onTab(item) {
        this.setFilter(item.item);
    }
    onAction(item) {
        this.setFilter(item);
    }
    search(textInput) {
        const cleanedInput = textInput.replace("@", "").toLowerCase().trim();
        if (/\s$/g.test(textInput)) {
            // User has added a space after tag -> selected
            const matchingFilter = QuickInsert.filters.getFilterByTag(cleanedInput);
            if (matchingFilter) {
                this.setFilter(matchingFilter);
                return [];
            }
        }
        return QuickInsert.filters.filters
            .filter((f) => !f.disabled)
            .filter((f) => f.tag.includes(cleanedInput))
            .map((f) => ({ item: f }));
    }
}
const helpItems = [
    {
        id: "/",
        name: "/",
        description: "SearchHelpChatCommand",
        inputString: "/",
    },
    {
        id: ">",
        name: ">",
        description: "SearchHelpKeyboardCommand",
        inputString: ">",
    },
    {
        id: "@",
        name: "@",
        description: "SearchHelpSearchFilter",
        inputString: "@",
    },
    {
        id: "=",
        name: "=",
        description: "SearchHelpCalculator",
        inputString: "=",
    },
    {
        id: "#",
        name: "#",
        description: "SearchHelpAudio",
        inputString: "#",
    },
    {
        id: "!",
        name: "!",
        description: "SearchHelpOwned",
        inputString: "!",
    },
];
class HelpController extends SearchController {
    hint = "QUICKINSERT.SearchModeTitleHelp";
    setInputText;
    constructor(callbacks) {
        super();
        this.setInputText = callbacks.setInputText;
    }
    onTab(item) {
        this.setInputText(item.item.inputString);
    }
    onAction(item) {
        this.setInputText(item.inputString);
    }
    search(textInput) {
        const cleanedInput = textInput.replace("?", "").toLowerCase().trim();
        return helpItems
            .filter((item) => item.id.startsWith(cleanedInput))
            .map((item) => ({ item }));
    }
}
const moduleAilases = {
    "quick-insert": "Quick Insert",
};
class KeybindController extends SearchController {
    hint = "QUICKINSERT.SearchModeTitleKeyboardCommand";
    static stringKeybinds(binds) {
        return (binds?.map((k) => 
        //@ts-expect-error Don't care if protected, I need it
        KeybindingsConfig._humanizeBinding?.(k) ||
            //@ts-expect-error Missing types
            KeybindingsConfig.humanizeBinding?.(k)) || []);
    }
    close;
    constructor(callbacks) {
        super();
        this.close = callbacks.close;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onTab(_item) { }
    onAction(item, _action, shiftKey) {
        try {
            item.onDown?.({});
        }
        catch (error) {
            ui.notifications?.error("Failed to execute command");
            console.warn(error);
        }
        if (!shiftKey)
            this.close();
    }
    search(textInput) {
        const cleanedInput = textInput.replace(">", "").toLowerCase().trim();
        const actions = [...game.keybindings.actions]
            .filter(([, conf]) => conf.editable)
            .map(([id, conf]) => {
            if (!conf.namespace)
                return;
            const namespaceName = conf.namespace === "core"
                ? "Core" // TODO: localized string???
                : conf.namespace === game.system.id
                    ? game.system.title
                    : moduleAilases[conf.namespace] ||
                        game.modules.get(conf.namespace)?.title;
            const bindings = game.keybindings.bindings?.get(id);
            return {
                item: {
                    id,
                    name: `${namespaceName}: ${loc(conf.name)}`,
                    namespace: conf.namespace,
                    description: conf.hint && loc(conf.hint),
                    keybinds: KeybindController.stringKeybinds(bindings),
                    onDown: conf.onDown,
                },
            };
        })
            .filter((i) => i !== undefined);
        return actions.filter((item) => item.item.name.toLowerCase().includes(cleanedInput));
    }
}
const slashCommands = [
    {
        id: "ic",
        commandText: "/ic",
        args: "{message}",
        description: "QUICKINSERT.SearchChatCommandIc",
    },
    {
        id: "ooc",
        commandText: "/ooc",
        args: "{message}",
        description: "QUICKINSERT.SearchChatCommandOoc",
    },
    {
        id: "emote",
        commandText: "/emote",
        args: "{message}",
        description: "QUICKINSERT.SearchChatCommandEmote",
    },
    {
        id: "em",
        commandText: "/em",
        args: "{message}",
        description: "QUICKINSERT.SearchChatCommandEmote",
    },
    {
        id: "me",
        commandText: "/me",
        args: "{message}",
        description: "QUICKINSERT.SearchChatCommandEmote",
    },
    {
        id: "whisper",
        commandText: "/whisper",
        args: "{target} {message}",
        description: "QUICKINSERT.SearchChatCommandWhisper",
    },
    {
        id: "w",
        commandText: "/w",
        args: "{target} {message}",
        description: "QUICKINSERT.SearchChatCommandWhisper",
    },
    {
        id: "roll",
        commandText: "/roll",
        args: "{dice formula}",
        description: "QUICKINSERT.SearchChatCommandRoll",
    },
    {
        id: "r",
        commandText: "/r",
        args: "{dice formula}",
        description: "QUICKINSERT.SearchChatCommandRoll",
    },
    {
        id: "gmroll",
        commandText: "/gmroll",
        args: "{dice formula}",
        description: "CHAT.RollPrivate",
    },
    {
        id: "gmr",
        commandText: "/gmr",
        args: "{dice formula}",
        description: "CHAT.RollPrivate",
    },
    {
        id: "blindroll",
        commandText: "/blindroll",
        args: "{target}",
        description: "CHAT.RollBlind",
    },
    {
        id: "broll",
        commandText: "/broll",
        args: "{target}",
        description: "CHAT.RollBlind",
    },
    {
        id: "br",
        commandText: "/br",
        args: "{target}",
        description: "CHAT.RollBlind",
    },
    {
        id: "selfroll",
        commandText: "/selfroll",
        args: "{dice formula}",
        description: "CHAT.RollSelf",
    },
    {
        id: "sr",
        commandText: "/sr",
        args: "{dice formula}",
        description: "CHAT.RollSelf",
    },
    {
        id: "publicroll",
        commandText: "/publicroll",
        args: "{dice formula}",
        description: "CHAT.RollPublic",
    },
    {
        id: "pr",
        commandText: "/pr",
        args: "{dice formula}",
        description: "CHAT.RollPublic",
    },
].reverse();
class SlashController extends SearchController {
    hint = "QUICKINSERT.SearchModeTitleChatCommand";
    #input = "";
    callbacks;
    constructor(callbacks) {
        super();
        this.callbacks = callbacks;
    }
    #onExampleSelected(commandText) {
        this.callbacks.setInputText(commandText);
    }
    onTab(resultItem) {
        const item = resultItem.item;
        if (item.commandText !== this.#input) {
            this.#onExampleSelected(item.commandText);
        }
    }
    onAction(item) {
        if (item.commandText === this.#input) {
            if (item.commandText === "/" || item.commandText.startsWith("/ "))
                return;
            ui.chat
                //@ts-expect-error Don't care about protected
                .processMessage(item.commandText)
                .catch((error) => ui.notifications.error(error));
            this.callbacks.close();
        }
        else {
            this.#onExampleSelected(item.commandText);
        }
    }
    search(textInput) {
        this.#input = textInput;
        const cleanedInput = textInput.replace("/", "").toLowerCase().trim();
        return [
            ...slashCommands
                .filter((item) => item.commandText.includes(cleanedInput))
                .map((item) => ({ item })),
            { item: { commandText: textInput, id: "textInput" } },
        ];
    }
}
class CalcController extends SearchController {
    hint = "QUICKINSERT.SearchModeTitleCalculator";
    #history = [];
    setInputText;
    constructor(callbacks) {
        super();
        this.setInputText = callbacks.setInputText;
    }
    onTab() { }
    onAction(item) {
        if (item.result === undefined) {
            return;
        }
        if (!item.history) {
            this.#history.push({ item: { ...item, id: randomId(), history: true } });
        }
        this.setInputText("=" + item.result.toString());
    }
    search(textInput) {
        const cleanedInput = textInput.replace("=", "").toLowerCase().trim();
        if (!cleanedInput) {
            return [];
        }
        let result;
        try {
            result = calculate(cleanedInput);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }
        catch (error) {
            // Not useful
        }
        if (result === undefined || isNaN(result)) {
            result = undefined;
        }
        const item = {
            id: "-1",
            input: cleanedInput,
            result,
        };
        return [...this.#history, { item }];
    }
}
class AudioController extends SearchController {
    hint = "QUICKINSERT.SearchModeTitlePlaylists";
    static #stoppedActions = [
        {
            id: "play",
            icon: "fas fa-play",
            title: "PLAYLIST.Play",
        },
    ];
    static #playingActions = [
        {
            id: "previous",
            icon: "fas fa-backward",
            title: "PLAYLIST.Backward",
        },
        {
            id: "next",
            icon: "fas fa-forward",
            title: "PLAYLIST.Forward",
        },
        {
            id: "stop",
            icon: "fas fa-stop",
            title: "PLAYLIST.Stop",
        },
    ];
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    onTab() { }
    onAction(item, action) {
        switch (action) {
            case "play":
                item.instance.playAll();
                break;
            case "stop":
                item.instance.stopAll();
                break;
            case "next":
                item.instance.playNext(undefined, { direction: 1 });
                break;
            case "previous":
                item.instance.playNext(undefined, { direction: -1 });
                break;
            default:
                if (item.instance.playing) {
                    item.instance.stopAll();
                }
                else {
                    item.instance.playAll();
                }
                break;
        }
        Hooks.once("updatePlaylist", () => this.#options.refresh());
    }
    search(textInput) {
        const cleanedInput = textInput.replace("#", "").toLowerCase().trim();
        return searchPlaylists(cleanedInput)
            .reverse()
            .map((item) => ({
            ...item,
            defaultAction: item.item.instance.playing ? "stop" : "play",
            actions: item.item.instance.playing
                ? AudioController.#playingActions
                : AudioController.#stoppedActions,
        }));
    }
}
function getOwnedActors() {
    if (canvas.tokens?.controlled.length) {
        return canvas.tokens.controlled
            .map((token) => token.actor)
            .filter((actor) => actor !== null)
            .filter((actor) => actor.visible);
    }
    return [game.user?.character].filter((actor) => !!actor);
}
function getInventory(actors) {
    return actors
        .map((actor) => Array.from(actor.items.values()))
        .flat()
        .filter((item) => item.visible);
}
function searchInventory(actors, query) {
    if (!query) {
        return getInventory(actors).map((item) => ({
            item: EmbeddedEntitySearchItem.fromDocument(item),
            original: item,
        }));
    }
    return fuzziersort_default
        .go(query, getInventory(actors), {
        key: (i) => i.name,
        all: true,
        threshold: 0.5,
    })
        .map((res) => {
        return {
            item: EmbeddedEntitySearchItem.fromDocument(res.obj),
            original: res.obj,
            formattedMatch: res.highlight("<strong>", "</strong>"),
        };
    });
}
class OwnedController extends SearchController {
    #options;
    #actors;
    get hint() {
        return this.#actors.length === 1
            ? this.#actors[0].name
            : loc("QUICKINSERT.SearchOwnedSelected", {
                tokenCount: this.#actors.length.toString(),
            });
    }
    constructor(options) {
        super();
        this.#actors = getOwnedActors();
        this.#options = options;
    }
    onTab() { }
    async onAction(item, action, shiftKey) {
        const instance = await item.get();
        if (action) {
            const acted = systemDocumentActionCallbacks[instance.documentName]?.(action, instance);
            if (acted) {
                if (!shiftKey) {
                    this.#options.close();
                }
                return;
            }
        }
        if (action === "show") {
            item.show();
        }
        else if (action) {
            instance.use?.();
        }
        else {
            item.show();
        }
        if (!shiftKey) {
            this.#options.close();
        }
    }
    search(textInput) {
        const cleanedInput = textInput.replace("!", "").toLowerCase().trim();
        const r = searchInventory(this.#actors, cleanedInput);
        return r.map((item) => {
            const actions = systemDocumentActions[item.original.documentName]?.(item.original);
            return {
                ...item,
                actions,
                defaultAction: actions?.[actions.length - 1]?.id,
            };
        });
    }
}
const modeConfig = {
    [SearchMode.DOCUMENT]: {
        showInInsertMode: true,
        controller: (options) => new DocumentController(options),
    },
    [SearchMode.FILTER]: {
        showInInsertMode: true,
        prefix: "@",
        controller: (options) => new FilterController(options),
    },
    [SearchMode.HELP]: {
        prefix: "?",
        controller: (options) => new HelpController(options),
    },
    [SearchMode.COMMANDS]: {
        prefix: ">",
        controller: (options) => new KeybindController(options),
    },
    [SearchMode.SLASH]: {
        prefix: "/",
        controller: (options) => new SlashController(options),
    },
    [SearchMode.CALC]: {
        prefix: "=",
        controller: (options) => new CalcController(options),
    },
    [SearchMode.AUDIO]: {
        prefix: "#",
        controller: (options) => new AudioController(options),
    },
    [SearchMode.OWNED]: {
        prefix: "!",
        controller: (options) => new OwnedController(options),
    },
};

var on_click$5 = (e, $$props, item) => $$props.callAction({
	actionId: undefined,
	item: get$1(item),
	shiftKey: e.shiftKey
});

var root_2$b = template(`<i class="fa-solid fa-play"></i> `, 1);
var root_1$j = template(`<div class="two-line-item"><span class="title"><!></span> <span class="sub"><!></span></div>`);
var root_4$5 = template(`<i class="fa-solid fa-play"></i> `, 1);
var root_3$2 = template(`<span class="title"><!></span> <span class="sub"><!></span>`, 1);

var on_click_1 = (e, $$props, action, item) => $$props.callAction({
	actionId: get$1(action).id,
	item: get$1(item),
	shiftKey: e.shiftKey
});

var root_5$1 = template(`<i data-tooltip-direction="UP"></i>`);
var root$q = template(`<li><a draggable="true" class="svelte-1hm5nbg"><i class="fa-solid fa-music entity-icon"></i> <!> <span class="action-icons"></span></a></li>`);

const $$css$r = {
	hash: 'svelte-1hm5nbg',
	code: 'a.svelte-1hm5nbg {padding:4px;}'
};

function AudioResultItem($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$r);

	let item = derived$1(() => $$props.resultItem.item);

	let formattedMatch = derived$1(() => $$props.resultItem.formattedMatch),
		actions = derived$1(() => $$props.resultItem.actions),
		defaultAction = derived$1(() => $$props.resultItem.defaultAction);

	var li = root$q();
	let classes;
	var a_1 = child(li);

	a_1.__click = [on_click$5, $$props, item];

	var node = sibling(child(a_1), 2);

	{
		var consequent_1 = ($$anchor) => {
			var div = root_1$j();
			var span = child(div);
			var node_1 = child(span);

			html(node_1, () => get$1(formattedMatch) || get$1(item).instance.name);

			var span_1 = sibling(span, 2);
			var node_2 = child(span_1);

			{
				var consequent = ($$anchor) => {
					var fragment = root_2$b();
					var text = sibling(first_child(fragment));

					template_effect(() => set_text(text, ` ${get$1(item).track ?? ''}`));
					append($$anchor, fragment);
				};

				if_block(node_2, ($$render) => {
					if (get$1(item).instance.playing) $$render(consequent);
				});
			}
			append($$anchor, div);
		};

		var alternate = ($$anchor) => {
			var fragment_1 = root_3$2();
			var span_2 = first_child(fragment_1);
			var node_3 = child(span_2);

			html(node_3, () => get$1(formattedMatch) || get$1(item).instance.name);

			var span_3 = sibling(span_2, 2);
			var node_4 = child(span_3);

			{
				var consequent_2 = ($$anchor) => {
					var fragment_2 = root_4$5();
					var text_1 = sibling(first_child(fragment_2));

					template_effect(() => set_text(text_1, ` ${get$1(item).track ?? ''}`));
					append($$anchor, fragment_2);
				};

				if_block(node_4, ($$render) => {
					if (get$1(item).instance.playing) $$render(consequent_2);
				});
			}
			append($$anchor, fragment_1);
		};

		if_block(node, ($$render) => {
			if ($$props.density === "spacious") $$render(consequent_1); else $$render(alternate, false);
		});
	}

	var span_4 = sibling(node, 2);

	each(span_4, 21, () => get$1(actions) || [], index, ($$anchor, action) => {
		var i = root_5$1();
		let classes_1;

		i.__click = [on_click_1, $$props, action, item];

		template_effect(
			($0) => {
				classes_1 = set_class(i, 1, `${get$1(action).icon ?? ''} action-icon`, null, classes_1, $0);
				set_attribute(i, 'data-tooltip', get$1(action).title);
				set_attribute(i, 'data-action-id', get$1(action).id);
			},
			[
				() => ({
					selected: $$props.selected && (get$1(actions)?.some((a) => a.id === $$props.selectedAction) ? get$1(action).id === $$props.selectedAction : get$1(action).id == get$1(defaultAction))
				})
			]
		);

		append($$anchor, i);
	});

	template_effect(($0) => classes = set_class(li, 1, 'no-icon-result', null, classes, $0), [
		() => ({ 'search-selected': $$props.selected })
	]);

	event('dragstart', a_1, (event) => event.dataTransfer?.setData("text/plain", JSON.stringify({
		type: "Playlist",
		uuid: get$1(item).instance.uuid
	})));

	append($$anchor, li);
	pop();
}

delegate(['click']);

var on_click$4 = (e, $$props, item) => $$props.callAction({ item: get$1(item), shiftKey: e.shiftKey });
var root_2$a = template(` <!>`, 1);
var root_4$4 = template(`<span class="result svelte-1xfx1k6"> </span>`);
var root_1$i = template(`<div class="one-line-item svelte-1xfx1k6"><!> <!></div>`);
var root_5 = template(`<div class="two-line-item svelte-1xfx1k6"><span> <!></span> <span><span class="result svelte-1xfx1k6"> </span></span></div>`);
var root$p = template(`<li><a class="svelte-1xfx1k6"><i></i> <!></a></li>`);

const $$css$q = {
	hash: 'svelte-1xfx1k6',
	code: '.one-line-item.svelte-1xfx1k6 {display:flex;align-items:center;flex-grow:1;}.two-line-item.svelte-1xfx1k6 {display:flex;flex-direction:column;flex-grow:1;}.density-comfortable .result.svelte-1xfx1k6,\n  .density-spacious .result.svelte-1xfx1k6 {font-size:120%;}.result.svelte-1xfx1k6 {font-weight:bold;padding:0 !important;}li.svelte-1xfx1k6 a:where(.svelte-1xfx1k6) {height:auto !important;}'
};

function CalcResultItem($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$q);

	let item = derived$1(() => $$props.resultItem.item);
	var li = root$p();
	let classes;
	var a = child(li);

	a.__click = [on_click$4, $$props, item];

	var i = child(a);
	var node = sibling(i, 2);

	{
		var consequent_3 = ($$anchor) => {
			var div = root_1$i();
			var node_1 = child(div);

			{
				var consequent_1 = ($$anchor) => {
					var fragment = root_2$a();
					var text$1 = first_child(fragment);
					var node_2 = sibling(text$1);

					{
						var consequent = ($$anchor) => {
							var text_1 = text(' = ');

							append($$anchor, text_1);
						};

						if_block(node_2, ($$render) => {
							if (get$1(item).result !== undefined) $$render(consequent);
						});
					}

					template_effect(() => set_text(text$1, get$1(item).input));
					append($$anchor, fragment);
				};

				if_block(node_1, ($$render) => {
					if (get$1(item).input !== get$1(item).result?.toString()) $$render(consequent_1);
				});
			}

			var node_3 = sibling(node_1, 2);

			{
				var consequent_2 = ($$anchor) => {
					var span = root_4$4();
					var text_2 = child(span);
					template_effect(() => set_text(text_2, get$1(item).result ?? ""));
					append($$anchor, span);
				};

				if_block(node_3, ($$render) => {
					if (get$1(item).result !== undefined) $$render(consequent_2);
				});
			}
			append($$anchor, div);
		};

		var alternate = ($$anchor) => {
			var div_1 = root_5();
			var span_1 = child(div_1);
			var text_3 = child(span_1);
			var node_4 = sibling(text_3);

			{
				var consequent_4 = ($$anchor) => {
					var text_4 = text(' = ');

					append($$anchor, text_4);
				};

				if_block(node_4, ($$render) => {
					if (get$1(item).result !== undefined) $$render(consequent_4);
				});
			}

			var span_2 = sibling(span_1, 2);
			var span_3 = child(span_2);
			var text_5 = child(span_3);

			template_effect(() => {
				set_text(text_3, get$1(item).input);
				set_text(text_5, get$1(item).result ?? "");
			});

			append($$anchor, div_1);
		};

		if_block(node, ($$render) => {
			if ($$props.density === "compact") $$render(consequent_3); else $$render(alternate, false);
		});
	}

	template_effect(
		($0) => {
			classes = set_class(li, 1, 'no-icon-result svelte-1xfx1k6', null, classes, $0);
			set_class(i, 1, `fas ${(get$1(item).history ? 'fa-clock-rotate-left' : 'fa-calculator') ?? ''} entity-icon`);
		},
		[
			() => ({ 'search-selected': $$props.selected })
		]
	);

	append($$anchor, li);
	pop();
}

delegate(['click']);

var root_1$h = template(`<img class="doc-image" draggable="false">`);
var root_3$1 = template(`<div class="two-line-item"><span class="title"><!></span> <span class="sub"> <!></span></div>`);
var root_4$3 = template(`<span class="title"><!></span> <span class="sub"> </span> <!>`, 1);
var root_6 = template(`<i draggable="false" data-tooltip-direction="UP"><img></i>`);
var root_7 = template(`<i data-tooltip-direction="UP"></i>`);
var root$o = template(`<li role="option"><a draggable="true"><!> <!> <span class="action-icons"></span></a></li>`);

function DocumentResultItem($$anchor, $$props) {
	push($$props, true);

	const [$$stores, $$cleanup] = setup_stores();
	const $tooltipModeSetting = () => store_get(tooltipModeSetting, '$tooltipModeSetting', $$stores);
	const $enhancedTooltips = () => store_get(enhancedTooltips, '$enhancedTooltips', $$stores);
	let tooltips = prop($$props, 'tooltips', 3, "LEFT");
	let tooltipModeSetting = stores[ModuleSetting.SEARCH_TOOLTIPS];
	let enhancedTooltips = stores[ModuleSetting.ENHANCED_TOOLTIPS];
	let tooltipMode = $tooltipModeSetting();
	let item = $$props.resultItem.item;

	let formattedMatch = derived$1(() => $$props.resultItem.formattedMatch),
		actions = derived$1(() => $$props.resultItem.actions),
		defaultAction = derived$1(() => $$props.resultItem.defaultAction);

	function getTooltip(item, side, tooltipMode) {
		if (tooltipMode === "off" || side === "OFF") return "";

		const showImage = tooltipMode === "full" || tooltipMode === "image";
		const img = showImage && item.img ? `<img src="${item.img}" style="max-width: 80px; margin: 0 auto 0.5rem auto; border-radius: 10px;"/>` : "";
		const text = tooltipMode !== "image"
			? `<p style='margin:0;text-align:center; max-width: 260px;'>${item.name}</p>
           <p style='text-align: center;font-size: 90%; opacity:0.8;margin:0; max-width: 260px;'>${item.icon} ${item.tooltip}</p>`
			: "";

		return img + text;
	}

	var li = root$o();
	let classes;
	var a = child(li);
	var node = child(a);

	{
		var consequent = ($$anchor) => {
			var img_1 = root_1$h();

			template_effect(() => set_attribute(img_1, 'src', item.img));
			append($$anchor, img_1);
		};

		var alternate = ($$anchor) => {
			var fragment = comment();
			var node_1 = first_child(fragment);

			html(node_1, () => item.icon);
			append($$anchor, fragment);
		};

		if_block(node, ($$render) => {
			if (item.img) $$render(consequent); else $$render(alternate, false);
		});
	}

	var node_2 = sibling(node, 2);

	{
		var consequent_1 = ($$anchor) => {
			var div = root_3$1();
			var span = child(div);
			var node_3 = child(span);

			html(node_3, () => get$1(formattedMatch) || item.name);

			var span_1 = sibling(span, 2);
			var text_1 = child(span_1);
			var node_4 = sibling(text_1);

			html(node_4, () => getLocationIcon(item));
			template_effect(() => set_text(text_1, `${item.tooltip ?? ''} `));
			append($$anchor, div);
		};

		var alternate_1 = ($$anchor) => {
			var fragment_1 = root_4$3();
			var span_2 = first_child(fragment_1);
			var node_5 = child(span_2);

			html(node_5, () => get$1(formattedMatch) || item.name);

			var span_3 = sibling(span_2, 2);
			var text_2 = child(span_3);

			var node_6 = sibling(span_3, 2);

			html(node_6, () => getLocationIcon(item));
			template_effect(() => set_text(text_2, item.tagline));
			append($$anchor, fragment_1);
		};

		if_block(node_2, ($$render) => {
			if ($$props.density === "spacious") $$render(consequent_1); else $$render(alternate_1, false);
		});
	}

	var span_4 = sibling(node_2, 2);

	each(span_4, 21, () => get$1(actions) || [], index, ($$anchor, action) => {
		var fragment_2 = comment();
		var node_7 = first_child(fragment_2);

		{
			var consequent_2 = ($$anchor) => {
				var i = root_6();
				let classes_1;
				var img_2 = child(i);

				template_effect(
					($0) => {
						classes_1 = set_class(i, 1, 'action-icon', null, classes_1, $0);
						set_attribute(i, 'data-tooltip', get$1(action).title);
						set_attribute(i, 'data-action-id', get$1(action).id);
						set_attribute(img_2, 'src', get$1(action).img);
					},
					[
						() => ({
							selected: $$props.selected && ($$props.selectedAction ? get$1(action).id === $$props.selectedAction : get$1(action).id == get$1(defaultAction))
						})
					]
				);

				event('click', i, stopPropagation((e) => $$props.callAction({
					actionId: get$1(action).id,
					item,
					shiftKey: e.shiftKey
				})));

				append($$anchor, i);
			};

			var alternate_2 = ($$anchor) => {
				var i_1 = root_7();
				let classes_2;

				template_effect(
					($0) => {
						classes_2 = set_class(i_1, 1, `${get$1(action).icon ?? ''} action-icon`, null, classes_2, $0);
						set_attribute(i_1, 'data-tooltip', get$1(action).title);
						set_attribute(i_1, 'data-action-id', get$1(action).id);
					},
					[
						() => ({
							selected: $$props.selected && ($$props.selectedAction ? get$1(action).id === $$props.selectedAction : get$1(action).id == get$1(defaultAction))
						})
					]
				);

				event('click', i_1, stopPropagation((e) => $$props.callAction({
					actionId: get$1(action).id,
					item,
					shiftKey: e.shiftKey
				})));

				append($$anchor, i_1);
			};

			if_block(node_7, ($$render) => {
				if (get$1(action).img) $$render(consequent_2); else $$render(alternate_2, false);
			});
		}

		append($$anchor, fragment_2);
	});

	template_effect(
		($0, $1) => {
			set_attribute(li, 'aria-selected', $$props.selected);
			set_attribute(li, 'data-tooltip', $0);
			classes = set_class(li, 1, clsx($enhancedTooltips() ? "content-link" : undefined), null, classes, $1);
			set_attribute(li, 'data-uuid', item.uuid);
			set_attribute(li, 'data-hash', item.anchor?.slug);
			set_attribute(li, 'id', `result_${item.id}${item.uuid}`);
			set_attribute(a, 'title', tooltipMode === "off" || tooltipMode === "image" ? `${item.name} - ${item.tooltip}` : undefined);
		},
		[
			() => getTooltip(item, tooltips(), $tooltipModeSetting()),
			() => ({ 'search-selected': $$props.selected })
		]
	);

	event('dragstart', a, (event) => event.dataTransfer?.setData("text/plain", JSON.stringify(item.dragData)));

	event('click', a, stopPropagation((e) => $$props.callAction({
		actionId: get$1(defaultAction),
		item,
		shiftKey: e.shiftKey
	})));

	append($$anchor, li);
	pop();
	$$cleanup();
}

var on_click$3 = (_, $$props, item) => $$props.callAction({ item });
var root$n = template(`<li><a><span class="title"> </span> <span class="sub"> </span></a></li>`);

function FilterResultItem($$anchor, $$props) {
	push($$props, true);

	let item = $$props.resultItem.item;
	var li = root$n();
	let classes;
	var a = child(li);

	a.__click = [on_click$3, $$props, item];

	var span = child(a);
	var text = child(span);

	var span_1 = sibling(span, 2);
	var text_1 = child(span_1);

	template_effect(
		($0) => {
			classes = set_class(li, 1, 'no-icon-result', null, classes, $0);
			set_text(text, `@${item.tag ?? ''}`);
			set_text(text_1, item.subTitle);
		},
		[
			() => ({ 'search-selected': $$props.selected })
		]
	);

	append($$anchor, li);
	pop();
}

delegate(['click']);

var on_click$2 = (_, $$props, item) => $$props.callAction({ item });
var root$m = template(`<li><a><span class="title svelte-1v29e8i"> </span> <span class="sub"> </span></a></li>`);

const $$css$p = {
	hash: 'svelte-1v29e8i',
	code: '.title.svelte-1v29e8i {min-width:auto;}'
};

function HelpResultItem($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$p);

	let item = $$props.resultItem.item;
	var li = root$m();
	let classes;
	var a = child(li);

	a.__click = [on_click$2, $$props, item];

	var span = child(a);
	var text = child(span);

	var span_1 = sibling(span, 2);
	var text_1 = child(span_1);

	template_effect(
		($0, $1) => {
			classes = set_class(li, 1, 'no-icon-result', null, classes, $0);
			set_text(text, item.name);
			set_text(text_1, $1);
		},
		[
			() => ({ 'search-selected': $$props.selected }),
			() => mloc(item.description)
		]
	);

	append($$anchor, li);
	pop();
}

delegate(['click']);

var root$l = template(`<kbd class="svelte-olmfu0"><!></kbd>`);

const $$css$o = {
	hash: 'svelte-olmfu0',
	code: 'kbd.svelte-olmfu0 {display:inline-flex;\n    /* background: rgba(255, 255, 255, 0.25); */background:var(--qiItemSelectedColor);padding:0em 0.25em;border:1px solid var(--color-border-light-2);border-radius:3px;font-size:90%;flex-grow:0;flex:none;min-width:24px;justify-content:center;align-items:center;}'
};

function KeyboardKey($$anchor, $$props) {
	append_styles($$anchor, $$css$o);

	var kbd = root$l();
	var node = child(kbd);

	snippet(node, () => $$props.children ?? noop);
	append($$anchor, kbd);
}

var on_click$1 = (e, $$props, item) => $$props.callAction({ item, shiftKey: e.shiftKey });
var root_1$g = template(`<span class="sub"> </span>`);
var root$k = template(`<li><a class="svelte-gi3tor"><span> </span> <span class="secondary svelte-gi3tor"><!> <!></span></a></li>`);

const $$css$n = {
	hash: 'svelte-gi3tor',
	code: '.density-spacious a.svelte-gi3tor {display:flex;flex-direction:column;align-items:stretch;}.secondary.svelte-gi3tor {display:flex;flex-direction:row;justify-content:end;flex-shrink:0;gap:0.4em;}'
};

function KeybindResultItem($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$n);

	let item = $$props.resultItem.item;
	var li = root$k();
	let classes;
	var a = child(li);

	a.__click = [on_click$1, $$props, item];

	var span = child(a);
	var text$1 = child(span);

	var span_1 = sibling(span, 2);
	var node = child(span_1);

	{
		var consequent = ($$anchor) => {
			var span_2 = root_1$g();
			var text_1 = child(span_2);
			template_effect(() => set_text(text_1, item.description));
			append($$anchor, span_2);
		};

		if_block(node, ($$render) => {
			if ($$props.density === "spacious" && item.description) $$render(consequent);
		});
	}

	var node_1 = sibling(node, 2);

	each(node_1, 17, () => item.keybinds, index, ($$anchor, bind) => {
		KeyboardKey($$anchor, {
			children: ($$anchor, $$slotProps) => {

				var text_2 = text();

				template_effect(() => set_text(text_2, get$1(bind)));
				append($$anchor, text_2);
			}});
	});

	template_effect(
		($0) => {
			classes = set_class(li, 1, 'no-icon-result', null, classes, $0);
			set_attribute(li, 'title', item.name);
			set_text(text$1, item.name);
		},
		[
			() => ({ 'search-selected': $$props.selected })
		]
	);

	append($$anchor, li);
	pop();
}

delegate(['click']);

var on_click = (_, $$props, item) => $$props.callAction({ item });
var root_1$f = template(`<span> </span>`);
var root$j = template(`<li><a class="svelte-1hm5nbg"><span> </span> <!></a></li>`);

const $$css$m = {
	hash: 'svelte-1hm5nbg',
	code: 'a.svelte-1hm5nbg {padding:4px;}'
};

function SlashResultItem($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$m);

	let item = $$props.resultItem.item;
	var li = root$j();
	let classes;
	var a = child(li);

	a.__click = [on_click, $$props, item];

	var span = child(a);
	var text = child(span);

	var node = sibling(span, 2);

	{
		var consequent = ($$anchor) => {
			var span_1 = root_1$f();
			var text_1 = child(span_1);
			template_effect(($0) => set_text(text_1, $0), [() => loc(item.description)]);
			append($$anchor, span_1);
		};

		if_block(node, ($$render) => {
			if (item.description) $$render(consequent);
		});
	}

	template_effect(
		($0) => {
			classes = set_class(li, 1, 'no-icon-result', null, classes, $0);
			set_text(text, `${item.commandText ?? ''} ${item.args || ""}`);
		},
		[
			() => ({ 'search-selected': $$props.selected })
		]
	);

	append($$anchor, li);
	pop();
}

delegate(['click']);

const resultItems = {
    [SearchMode.AUDIO]: AudioResultItem,
    [SearchMode.CALC]: CalcResultItem,
    [SearchMode.COMMANDS]: KeybindResultItem,
    [SearchMode.DOCUMENT]: DocumentResultItem,
    [SearchMode.FILTER]: FilterResultItem,
    [SearchMode.HELP]: HelpResultItem,
    [SearchMode.OWNED]: DocumentResultItem,
    [SearchMode.SLASH]: SlashResultItem,
};

var root$i = template(`<ul tabindex="-1" role="listbox"></ul>`);

function SearchResults($$anchor, $$props) {
	push($$props, true);

	const [$$stores, $$cleanup] = setup_stores();
	const $tooltipModeSetting = () => store_get(tooltipModeSetting, '$tooltipModeSetting', $$stores);
	const $density = () => store_get(density, '$density', $$stores);

	let tooltips = prop($$props, 'tooltips', 3, "LEFT"),
		embedded = prop($$props, 'embedded', 3, false),
		results = prop($$props, 'results', 19, () => []);

	let density = stores[ModuleSetting.SEARCH_DENSITY];
	let tooltipModeSetting = stores[ModuleSetting.SEARCH_TOOLTIPS];
	let tooltipMode = $tooltipModeSetting();
	let resultList;
	const ResultComponent = derived$1(() => resultItems[$$props.searchMode]);

	user_effect(() => {
		if (embedded()) {
			return;
		}

		if (resultList?.children[$$props.selectedIndex]) {
			const selected = resultList.children[$$props.selectedIndex];

			selected.scrollIntoView({ block: "nearest" });

			if (tooltipMode !== "off" && selected.dataset?.tooltip && !embedded()) {
				game.tooltip.activate(selected);
			} else {
				game.tooltip.deactivate();
			}
		} else {
			if (tooltipMode !== "off") {
				game.tooltip.deactivate();
			}
		}
	});

	function getId(resultItem) {
		if (!resultItem) {
			return undefined;
		}

		if ("id" in resultItem.item && "uuid" in resultItem.item) {
			return resultItem.item.id + resultItem.item.uuid;
		}

		return resultItem.item.id;
	}

	var ul = root$i();

	each(ul, 23, results, (resultItem) => getId(resultItem), ($$anchor, resultItem, index) => {
		var fragment = comment();
		var node = first_child(fragment);
		const expression = derived$1(() => $$props.selectedIndex === get$1(index));

		component(node, () => get$1(ResultComponent), ($$anchor, $$component) => {
			$$component($$anchor, {
				get selected() {
					return get$1(expression);
				},
				get density() {
					return $density();
				},
				get resultItem() {
					return get$1(resultItem);
				},
				get selectedAction() {
					return $$props.selectedAction;
				},
				get callAction() {
					return $$props.callAction;
				}
			});
		});

		append($$anchor, fragment);
	});
	bind_this(ul, ($$value) => resultList = $$value, () => resultList);

	template_effect(
		($0) => {
			set_class(ul, 1, `quick-insert-result density-${$density() ?? ''}`);
			set_attribute(ul, 'data-tooltip-direction', tooltips());
			set_attribute(ul, 'aria-activedescendant', $0);
		},
		[
			() => `result_${getId(results()[$$props.selectedIndex])}`
		]
	);

	append($$anchor, ul);
	pop();
	$$cleanup();
}

var root$h = template(`<div class="example-results svelte-zptd4e"><!> <span class="notes svelte-zptd4e"><!></span></div>`);

const $$css$l = {
	hash: 'svelte-zptd4e',
	code: '.example-results.svelte-zptd4e {overflow:hidden;display:flex;flex-shrink:0;flex-grow:1;flex-direction:column;align-items:center;width:275px;margin-top:1em;}.example-results.svelte-zptd4e .quick-insert-result {border-radius:4px;border:1px solid #7a7971;width:275px;background:var(--qiBackground);}\n\n  /* Dorako UI compatibility */[data-theme].application\n    .example-results.svelte-zptd4e\n    .quick-insert-result {background:var(--app-background);border:var(--app-border-width) solid var(--app-border-color);}.example-results.svelte-zptd4e .notes:where(.svelte-zptd4e) {text-align:center;}'
};

function ExampleResults($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$l);

	let selectedIndex = prop($$props, 'selectedIndex', 19, () => $$props.results.length - 1),
		searchMode = prop($$props, 'searchMode', 19, () => SearchMode.DOCUMENT);

	var div = root$h();
	var node = child(div);

	SearchResults(node, {
		embedded: true,
		get searchMode() {
			return searchMode();
		},
		get results() {
			return $$props.results;
		},
		get selectedIndex() {
			return selectedIndex();
		},
		selectedAction: '',
		callAction: () => {}
	});

	var span = sibling(node, 2);
	var node_1 = child(span);

	slot(node_1, $$props, 'default', {});
	append($$anchor, div);
	pop();
}

var root_1$e = template(`<div class="options svelte-15t6cpc"><!> <!> <!> <!> <!> <!></div>`);
var root_2$9 = template(`<p class="notes svelte-15t6cpc"><!></p> <div class="options svelte-15t6cpc"><!> <!> <legend> </legend> <p class="notes svelte-15t6cpc"><!></p> <!> <!> <!></div> <!>`, 1);
var root_4$2 = template(`<div class="options svelte-15t6cpc"><p class="notes svelte-15t6cpc"><!></p></div> <!>`, 1);
var root$g = template(`<div role="tabpanel"><p class="notes svelte-15t6cpc"> </p> <!> <!> <!></div>`);

const $$css$k = {
	hash: 'svelte-15t6cpc',
	code: '.usertab.svelte-15t6cpc {overflow:auto;height:100%;padding:0.6em;}.hidden.svelte-15t6cpc {display:none;}.usertab.svelte-15t6cpc .form-fields:first-child {flex-grow:0;margin-right:0.2em;}.options.svelte-15t6cpc {display:flex;flex-direction:column;flex-grow:1;width:50%;gap:1rem;}p.notes.svelte-15t6cpc {margin-top:0;}kbd {flex:none;padding:0 4px;min-width:24px;background:rgba(255, 255, 255, 0.25);border:1px solid var(--color-border-light-2);border-radius:5px;box-shadow:1px 1px #444;text-align:center;}'
};

function UserTab($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$k);

	const [$$stores, $$cleanup] = setup_stores();
	const $defaultActionMacro = () => store_get(defaultActionMacro, '$defaultActionMacro', $$stores);
	const $defaultActionRollTable = () => store_get(defaultActionRollTable, '$defaultActionRollTable', $$stores);
	const $defaultActionScene = () => store_get(defaultActionScene, '$defaultActionScene', $$stores);
	let active = prop($$props, 'active', 3, false);
	const insertResults = fakeSearchResults(true);
	let defaultActionMacro = stores[ModuleSetting.DEFAULT_ACTION_MACRO];
	let defaultActionRollTable = stores[ModuleSetting.DEFAULT_ACTION_ROLL_TABLE];
	let defaultActionScene = stores[ModuleSetting.DEFAULT_ACTION_SCENE];
	let browseResults = derived$1(() => $defaultActionMacro() && $defaultActionRollTable() && $defaultActionScene() && fakeSearchResults());
	var div = root$g();
	let classes;
	var p = child(div);
	var text = child(p);

	var node = sibling(p, 2);

	SettingsGroup(node, {
		title: 'General Settings',
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$e();
			var node_1 = child(div_1);
			const expression = derived$1(() => mloc("SettingsSearchDensity"));
			const expression_1 = derived$1(() => mloc("SettingsSearchDensityHint"));

			FormSelect(node_1, {
				get label() {
					return get$1(expression);
				},
				get setting() {
					return ModuleSetting.SEARCH_DENSITY;
				},
				get notes() {
					return get$1(expression_1);
				}
			});

			var node_2 = sibling(node_1, 2);
			const expression_2 = derived$1(() => mloc("SettingsSearchFooter"));
			const expression_3 = derived$1(() => mloc("SettingsSearchFooterHint"));

			FormCheckbox(node_2, {
				get label() {
					return get$1(expression_2);
				},
				get setting() {
					return ModuleSetting.SEARCH_FOOTER;
				},
				get notes() {
					return get$1(expression_3);
				}
			});

			var node_3 = sibling(node_2, 2);
			const expression_4 = derived$1(() => mloc("SettingsSearchTooltips"));
			const expression_5 = derived$1(() => mloc("SettingsSearchTooltipsHint"));

			FormSelect(node_3, {
				get label() {
					return get$1(expression_4);
				},
				get setting() {
					return ModuleSetting.SEARCH_TOOLTIPS;
				},
				get notes() {
					return get$1(expression_5);
				}
			});

			var node_4 = sibling(node_3, 2);
			const expression_6 = derived$1(() => mloc("SettingsEnhancedTooltips"));
			const expression_7 = derived$1(() => mloc("SettingsEnhancedTooltipsHint"));

			FormCheckbox(node_4, {
				get label() {
					return get$1(expression_6);
				},
				get setting() {
					return ModuleSetting.ENHANCED_TOOLTIPS;
				},
				get notes() {
					return get$1(expression_7);
				}
			});

			var node_5 = sibling(node_4, 2);
			const expression_8 = derived$1(() => mloc("SettingsSearchEngine"));
			const expression_9 = derived$1(() => mloc("SettingsSearchEngineHint"));

			FormSelect(node_5, {
				get label() {
					return get$1(expression_8);
				},
				get setting() {
					return ModuleSetting.SEARCH_ENGINE;
				},
				get notes() {
					return get$1(expression_9);
				}
			});

			var node_6 = sibling(node_5, 2);
			const expression_10 = derived$1(() => mloc("SettingsQuickFilterEdit"));
			const expression_11 = derived$1(() => mloc("SettingsQuickFilterEditHint"));

			FormCheckbox(node_6, {
				get label() {
					return get$1(expression_10);
				},
				get setting() {
					return ModuleSetting.QUICK_FILTER_EDIT;
				},
				get notes() {
					return get$1(expression_11);
				}
			});
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});

	var node_7 = sibling(node, 2);
	const expression_12 = derived$1(() => mloc("ModeBrowse"));

	SettingsGroup(node_7, {
		get title() {
			return get$1(expression_12);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment = root_2$9();
			var p_1 = first_child(fragment);
			var node_8 = child(p_1);

			html(node_8, () => mloc("ModeBrowseDescription"));

			var div_2 = sibling(p_1, 2);
			var node_9 = child(div_2);
			const expression_13 = derived$1(() => mloc("SettingsEnableGlobalContext"));
			const expression_14 = derived$1(() => mloc("SettingsEnableGlobalContextHint"));

			FormCheckbox(node_9, {
				get label() {
					return get$1(expression_13);
				},
				get setting() {
					return ModuleSetting.ENABLE_GLOBAL_CONTEXT;
				},
				get notes() {
					return get$1(expression_14);
				}
			});

			var node_10 = sibling(node_9, 2);
			const expression_15 = derived$1(() => mloc("SettingsRememberBrowseInput"));
			const expression_16 = derived$1(() => mloc("SettingsRememberBrowseInputHint"));

			FormCheckbox(node_10, {
				get label() {
					return get$1(expression_15);
				},
				get setting() {
					return ModuleSetting.REMEMBER_BROWSE_INPUT;
				},
				get notes() {
					return get$1(expression_16);
				}
			});

			var legend = sibling(node_10, 2);
			var text_1 = child(legend);

			var p_2 = sibling(legend, 2);
			var node_11 = child(p_2);

			html(node_11, () => mloc("SettingsDefaultActionDescription"));

			var node_12 = sibling(p_2, 2);

			FormSelect(node_12, {
				sub: true,
				label: 'Scenes',
				get setting() {
					return ModuleSetting.DEFAULT_ACTION_SCENE;
				}
			});

			var node_13 = sibling(node_12, 2);

			FormSelect(node_13, {
				sub: true,
				label: 'Rollable Tables',
				get setting() {
					return ModuleSetting.DEFAULT_ACTION_ROLL_TABLE;
				}
			});

			var node_14 = sibling(node_13, 2);

			FormSelect(node_14, {
				sub: true,
				label: 'Macros',
				get setting() {
					return ModuleSetting.DEFAULT_ACTION_MACRO;
				}
			});

			var node_15 = sibling(div_2, 2);
			const expression_17 = derived$1(() => get$1(browseResults) || []);

			ExampleResults(node_15, {
				get results() {
					return get$1(expression_17);
				},
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = comment();
					var node_16 = first_child(fragment_1);

					html(node_16, () => mloc("SettingsExampleBrowse"));
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});

			template_effect(($0) => set_text(text_1, $0), [
				() => mloc("SettingsDefaultActionCategory")
			]);

			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});

	var node_17 = sibling(node_7, 2);
	const expression_18 = derived$1(() => mloc("ModeInsert"));

	SettingsGroup(node_17, {
		get title() {
			return get$1(expression_18);
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_2 = root_4$2();
			var div_3 = first_child(fragment_2);
			var p_3 = child(div_3);
			var node_18 = child(p_3);

			html(node_18, () => mloc("ModeInsertDescription"));

			var node_19 = sibling(div_3, 2);

			ExampleResults(node_19, {
				results: insertResults,
				children: ($$anchor, $$slotProps) => {
					var fragment_3 = comment();
					var node_20 = first_child(fragment_3);

					html(node_20, () => mloc("SettingsExampleInsert"));
					append($$anchor, fragment_3);
				},
				$$slots: { default: true }
			});

			append($$anchor, fragment_2);
		},
		$$slots: { default: true }
	});

	template_effect(
		($0, $1) => {
			classes = set_class(div, 1, 'usertab standard-form svelte-15t6cpc', null, classes, $0);
			set_text(text, $1);
		},
		[
			() => ({ hidden: !active() }),
			() => mloc("SettingsUserSettingDescription")
		]
	);

	append($$anchor, div);
	pop();
	$$cleanup();
}

const checkAll = (evt, dispatch, indeterminate) => dispatch("change", {
	disabled: !evt.target.checked || get$1(indeterminate)
});

var root_1$d = template(`<span class="hint"> </span>`);
var root$f = template(`<div><div class="row-label svelte-mwyaxl"><input type="checkbox" class="svelte-mwyaxl"> <label class="index svelte-mwyaxl"> <!></label></div> <div class="form-fields svelte-mwyaxl"><input type="checkbox" class="svelte-mwyaxl"> <input type="checkbox" class="svelte-mwyaxl"> <input type="checkbox" class="svelte-mwyaxl"> <input type="checkbox" class="svelte-mwyaxl"></div></div>`);

const $$css$j = {
	hash: 'svelte-mwyaxl',
	code: '.form-group.svelte-mwyaxl {padding:0.2em;margin:0;align-items:center;border-top:1px solid var(--color-border-dark-4);color:var(--color-form-label);}.form-group.sublevel.svelte-mwyaxl .row-label:where(.svelte-mwyaxl) {padding-left:2em;}.form-group.svelte-mwyaxl label:where(.svelte-mwyaxl) {font-weight:bold;}.form-group.svelte-mwyaxl:hover {color:var(--color-form-label-hover);}.row-label.svelte-mwyaxl {flex:0 0 calc(45% + 0.4em);display:flex;align-items:center;}.row-label.svelte-mwyaxl label:where(.svelte-mwyaxl) {flex:unset;}.form-fields.svelte-mwyaxl {justify-content:space-around;}input.svelte-mwyaxl:disabled {opacity:0.6;filter:saturate(0);}'
};

function IndexingRow($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$j);

	const [$$stores, $$cleanup] = setup_stores();
	const $disabled = () => store_get(disabled, '$disabled', $$stores);
	const dispatch = createEventDispatcher();
	let disabledRoles = derived$1(() => $$props.row.documentType && $$props.row.documentType in $disabled().entities ? $disabled().entities[$$props.row.documentType] : []);
	let checked = derived$1(() => Object.values($$props.row.enabled).some((v) => v));
	let indeterminate = derived$1(() => get$1(checked) && !Object.values($$props.row.enabled).every((v) => v));
	const all = [1, 2, 3, 4];
	let allDisabled = derived$1(() => all.every((r) => get$1(disabledRoles).includes(r)));
	const check = (role) => (evt) => dispatch("change", { role, disabled: !evt.target?.checked });
	var div = root$f();
	let classes;
	var div_1 = child(div);
	var input = child(div_1);
	input.__click = [checkAll, dispatch, indeterminate];

	var label = sibling(input, 2);
	var text = child(label);
	var node = sibling(text);

	{
		var consequent = ($$anchor) => {
			var span = root_1$d();
			var text_1 = child(span);
			template_effect(() => set_text(text_1, $$props.row.subTitle));
			append($$anchor, span);
		};

		if_block(node, ($$render) => {
			if ($$props.row.subTitle) $$render(consequent);
		});
	}

	var div_2 = sibling(div_1, 2);
	var input_1 = child(div_2);

	var event_handler = derived$1(() => check(1));

	input_1.__click = function (...$$args) {
		get$1(event_handler)?.apply(this, $$args);
	};

	var input_2 = sibling(input_1, 2);

	var event_handler_1 = derived$1(() => check(2));

	input_2.__click = function (...$$args) {
		get$1(event_handler_1)?.apply(this, $$args);
	};

	var input_3 = sibling(input_2, 2);

	var event_handler_2 = derived$1(() => check(3));

	input_3.__click = function (...$$args) {
		get$1(event_handler_2)?.apply(this, $$args);
	};

	var input_4 = sibling(input_3, 2);

	var event_handler_3 = derived$1(() => check(4));

	input_4.__click = function (...$$args) {
		get$1(event_handler_3)?.apply(this, $$args);
	};

	template_effect(
		($0, $1, $2, $3, $4) => {
			classes = set_class(div, 1, 'form-group svelte-mwyaxl', null, classes, $0);
			set_attribute(input, 'name', `${$$props.row.id ?? ''}.All`);
			set_attribute(input, 'id', `${$$props.row.id ?? ''}.All`);
			set_checked(input, get$1(checked));
			input.indeterminate = get$1(indeterminate);
			input.disabled = get$1(allDisabled);
			set_attribute(label, 'for', `${$$props.row.id ?? ''}.All`);
			set_text(text, `${$$props.row.title ?? ''} `);
			set_attribute(input_1, 'name', `${$$props.row.id ?? ''}.1`);
			set_attribute(input_1, 'id', `${$$props.row.id ?? ''}.1`);
			set_checked(input_1, $$props.row.enabled[1]);
			input_1.disabled = $1;
			set_attribute(input_2, 'name', `${$$props.row.id ?? ''}.2`);
			set_attribute(input_2, 'id', `${$$props.row.id ?? ''}.2`);
			set_checked(input_2, $$props.row.enabled[2]);
			input_2.disabled = $2;
			set_attribute(input_3, 'name', `${$$props.row.id ?? ''}.3`);
			set_attribute(input_3, 'id', `${$$props.row.id ?? ''}.3`);
			set_checked(input_3, $$props.row.enabled[3]);
			input_3.disabled = $3;
			set_attribute(input_4, 'name', `${$$props.row.id ?? ''}.4`);
			set_attribute(input_4, 'id', `${$$props.row.id ?? ''}.4`);
			set_checked(input_4, $$props.row.enabled[4]);
			input_4.disabled = $4;
		},
		[
			() => ({
				sublevel: $$props.row.type === "directory" && $$props.row.id !== "root"
			}),
			() => get$1(disabledRoles).includes(1),
			() => get$1(disabledRoles).includes(2),
			() => get$1(disabledRoles).includes(3),
			() => get$1(disabledRoles).includes(4)
		]
	);

	append($$anchor, div);
	pop();
	$$cleanup();
}

delegate(['click']);

var root$e = template(`<button><!></button>`);

const $$css$i = {
	hash: 'svelte-96f0xp',
	code: 'button.svelte-96f0xp {color:var(--color-text-primary);border:none;background:rgba(255, 255, 255, 0.2);width:100%;margin:6px;transition:box-shadow 100ms ease-out;}button.svelte-96f0xp:hover {color:var(--color-text-primary);background:rgba(255, 255, 255, 0.3);box-shadow:0 0 2px 1px #0003;}button.svelte-96f0xp:focus {box-shadow:0 0 0 2px #0003;}button.svelte-96f0xp:active {box-shadow:inset 0 0 0 1px #0004;}.round.svelte-96f0xp {background:rgba(255, 255, 255, 0.2);border-radius:15px;height:30px;padding:0 16px 0 8px;}.round.svelte-96f0xp:hover {background:rgba(255, 255, 255, 0.3);}'
};

function NiceButton($$anchor, $$props) {
	append_styles($$anchor, $$css$i);

	let round = prop($$props, 'round', 3, false);
	var button = root$e();
	let classes;
	var node = child(button);

	slot(node, $$props, 'default', {});

	template_effect(
		($0) => {
			set_attribute(button, 'title', $$props.title);
			classes = set_class(button, 1, 'svelte-96f0xp', null, classes, $0);
		},
		[() => ({ round: round() })]
	);

	event('click', button, preventDefault(function ($$arg) {
		bubble_event.call(this, $$props, $$arg);
	}));

	append($$anchor, button);
}

var root_2$8 = template(`<span class="notes"> </span>`);
var root_9 = template(`<span class="notes"> </span>`);
var root$d = template(`<div role="tabpanel"><p class="notes svelte-pz15tt"> </p> <header class="table-header flexrow svelte-pz15tt"><span class="index svelte-pz15tt"><input class="filter-input svelte-pz15tt" type="text"></span> <span> </span> <span> </span> <span> </span> <span> </span></header> <div class="indexing-list svelte-pz15tt"><h3 class="svelte-pz15tt"> </h3> <!> <h3 class="svelte-pz15tt"> <label class="inline-checkbox svelte-pz15tt"><input type="checkbox" name="showFolders" id="showFolders"> </label></h3> <!> <!> <h3 class="svelte-pz15tt"> </h3> <div class="form-group"><!> <!></div> <!></div></div>`);

const $$css$h = {
	hash: 'svelte-pz15tt',
	code: '.indexingtab.svelte-pz15tt {display:flex;flex-direction:column;height:100%;gap:0;}.hidden.svelte-pz15tt {display:none;}.indexingtab.svelte-pz15tt > :where(.svelte-pz15tt) {flex:unset;}.filter-input.svelte-pz15tt {color:inherit;font-weight:normal;}.filter-input.svelte-pz15tt::placeholder {color:inherit;opacity:0.6;}.indexing-list.svelte-pz15tt {overflow-y:auto;overflow-x:hidden;height:500px;scrollbar-width:thin;flex:1;}.index.svelte-pz15tt {flex:0 0 45%;font-weight:bold;padding:0 1em;}header.table-header.svelte-pz15tt {background:#2229;line-height:2em;text-align:center;color:#f0f0e0;font-weight:bold;text-shadow:1px 1px #000d;box-shadow:0 2px 2px #0006;position:relative;z-index:2;}.indexing-list.svelte-pz15tt h3:where(.svelte-pz15tt) {color:#f0f0e0;background:rgba(0, 0, 0, 0.5);border:none;text-shadow:1px 1px #000d;padding:0.2em;font-size:120%;margin:0;}.inline-checkbox.svelte-pz15tt {opacity:0.8;font-size:80%;display:inline-flex;align-items:center;}p.notes.svelte-pz15tt {margin:0.6em;}'
};

function IndexingTab($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$h);

	const [$$stores, $$cleanup] = setup_stores();
	const $packs = () => store_get(packs, '$packs', $$stores);
	const $documents = () => store_get(documents, '$documents', $$stores);
	const $showFolders = () => store_get(showFolders, '$showFolders', $$stores);
	const $directory = () => store_get(directory, '$directory', $$stores);
	let filter = state("");
	let showFolders = stores[ModuleSetting.SHOW_FOLDERS_IN_INDEXING_TAB];
	const filterRows = (filter, rows) => rows.filter((row) => row.title.toLowerCase().includes(filter.toLowerCase()) || row.subTitle?.toLowerCase().includes(filter.toLowerCase()));

	const change = (row) => (event) => {
		if (event.detail.role) {
			disabled.toggleRole(row.type, row.id, event.detail.role, event.detail.disabled);
		} else {
			disabled.toggleAll(row.type, row.id, event.detail.disabled);
		}
	};

	function selectAll() {
		filterRows(get$1(filter), $packs()).forEach((row) => change(row)(new CustomEvent("", { detail: { disabled: false } })));
	}

	function deselectAll() {
		filterRows(get$1(filter), $packs()).forEach((row) => change(row)(new CustomEvent("", { detail: { disabled: true } })));
	}

	var div = root$d();
	let classes;
	var p = child(div);
	var text$1 = child(p);

	var header = sibling(p, 2);
	var span = child(header);
	var input = child(span);

	var span_1 = sibling(span, 2);
	var text_1 = child(span_1);

	var span_2 = sibling(span_1, 2);
	var text_2 = child(span_2);

	var span_3 = sibling(span_2, 2);
	var text_3 = child(span_3);

	var span_4 = sibling(span_3, 2);
	var text_4 = child(span_4);

	var div_1 = sibling(header, 2);
	var h3 = child(div_1);
	var text_5 = child(h3);

	var node = sibling(h3, 2);

	each(
		node,
		1,
		() => filterRows(get$1(filter), $documents()),
		(row) => row.id,
		($$anchor, row) => {
			var event_handler = derived$1(() => change(get$1(row)));

			IndexingRow($$anchor, {
				get row() {
					return get$1(row);
				},
				$$events: {
					change(...$$args) {
						get$1(event_handler)?.apply(this, $$args);
					}
				}
			});
		},
		($$anchor) => {
			var span_5 = root_2$8();
			var text_6 = child(span_5);

			template_effect(($0) => set_text(text_6, $0), [
				() => mloc("IndexingSettingsNoMatchType", { filter: get$1(filter) })
			]);

			append($$anchor, span_5);
		}
	);

	var h3_1 = sibling(node, 2);
	var text_7 = child(h3_1);
	var label = sibling(text_7);
	var input_1 = child(label);

	var text_8 = sibling(input_1);

	var node_1 = sibling(h3_1, 2);

	each(node_1, 1, () => filterRows(get$1(filter), $directory().slice(0, 1)), (row) => row.id, ($$anchor, row) => {
		var event_handler_1 = derived$1(() => change(get$1(row)));

		IndexingRow($$anchor, {
			get row() {
				return get$1(row);
			},
			$$events: {
				change(...$$args) {
					get$1(event_handler_1)?.apply(this, $$args);
				}
			}
		});
	});

	var node_2 = sibling(node_1, 2);

	{
		var consequent = ($$anchor) => {
			var fragment_2 = comment();
			var node_3 = first_child(fragment_2);

			each(node_3, 1, () => filterRows(get$1(filter), $directory().slice(1)), (row) => row.id, ($$anchor, row) => {
				var event_handler_2 = derived$1(() => change(get$1(row)));

				IndexingRow($$anchor, {
					get row() {
						return get$1(row);
					},
					$$events: {
						change(...$$args) {
							get$1(event_handler_2)?.apply(this, $$args);
						}
					}
				});
			});

			append($$anchor, fragment_2);
		};

		if_block(node_2, ($$render) => {
			if ($showFolders()) $$render(consequent);
		});
	}

	var h3_2 = sibling(node_2, 2);
	var text_9 = child(h3_2);

	var div_2 = sibling(h3_2, 2);
	var node_4 = child(div_2);

	NiceButton(node_4, {
		$$events: { click: selectAll },
		children: ($$anchor, $$slotProps) => {

			var text_10 = text();

			template_effect(($0) => set_text(text_10, $0), [() => mloc("IndexingSettingsSelectAll")]);
			append($$anchor, text_10);
		},
		$$slots: { default: true }
	});

	var node_5 = sibling(node_4, 2);

	NiceButton(node_5, {
		$$events: { click: deselectAll },
		children: ($$anchor, $$slotProps) => {

			var text_11 = text();

			template_effect(($0) => set_text(text_11, $0), [() => mloc("IndexingSettingsDeselectAll")]);
			append($$anchor, text_11);
		},
		$$slots: { default: true }
	});

	var node_6 = sibling(div_2, 2);

	each(
		node_6,
		1,
		() => filterRows(get$1(filter), $packs()),
		(row) => row.id,
		($$anchor, row) => {
			var event_handler_3 = derived$1(() => change(get$1(row)));

			IndexingRow($$anchor, {
				get row() {
					return get$1(row);
				},
				$$events: {
					change(...$$args) {
						get$1(event_handler_3)?.apply(this, $$args);
					}
				}
			});
		},
		($$anchor) => {
			var span_6 = root_9();
			var text_12 = child(span_6);

			template_effect(($0) => set_text(text_12, $0), [
				() => mloc("IndexingSettingsNoMatchCompendium", { filter: get$1(filter) })
			]);

			append($$anchor, span_6);
		}
	);

	template_effect(
		(
			$0,
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10
		) => {
			classes = set_class(div, 1, 'indexingtab standard-form svelte-pz15tt', null, classes, $0);
			set_text(text$1, $1);
			set_attribute(input, 'placeholder', $2);
			set_text(text_1, $3);
			set_text(text_2, $4);
			set_text(text_3, $5);
			set_text(text_4, $6);
			set_text(text_5, $7);
			set_text(text_7, `${$8 ?? ''} `);
			set_text(text_8, ` ${$9 ?? ''}`);
			set_text(text_9, $10);
		},
		[
			() => ({ hidden: !$$props.active }),
			() => mloc("IndexingSettingsIntroduction"),
			() => mloc("FilterEditorOptionFilter"),
			() => loc("USER.RolePlayer"),
			() => loc("USER.RoleTrusted"),
			() => loc("USER.RoleAssistant"),
			() => loc("USER.RoleGamemaster"),
			() => loc("COMPENDIUM.Type"),
			() => mloc("FilterEditorDirectory"),
			() => mloc("IndexingSettingsShowFolders"),
			() => loc("SIDEBAR.TabCompendium")
		]
	);

	bind_value(input, () => get$1(filter), ($$value) => set(filter, $$value));
	bind_checked(input_1, $showFolders, ($$value) => store_set(showFolders, $$value));
	append($$anchor, div);
	pop();
	$$cleanup();
}

var root_1$c = template(`<span> </span>`);
var root_2$7 = template(`<i class="fas fa-filter edit-filter svelte-18cyknh"></i>`);
var root$c = template(`<div class="search-editable-input svelte-18cyknh"><!> <input aria-haspopup="listbox" type="text" spellcheck="false" class="svelte-18cyknh"> <!></div>`);

const $$css$g = {
	hash: 'svelte-18cyknh',
	code: '.search-editable-input.svelte-18cyknh {white-space:nowrap;height:var(--input-height);display:flex;align-items:center;flex-shrink:0;cursor:auto;pointer-events:all;}input[type="text"].svelte-18cyknh {padding:0 0.2em;border:none;box-shadow:none;background:none;width:auto;flex-grow:1;outline:none;font-size:inherit;height:100%;}input[type="text"].svelte-18cyknh:focus {outline:none;}.search-tag.svelte-18cyknh {position:relative;background:var(--qiFilterAccent);color:#f0f0e0;display:flex;padding:0 0.3em;border-radius:0.25em;max-width:60%;overflow:hidden;text-overflow:ellipsis;margin-right:3px;height:1.8em;align-items:center;}.search-tag.filter-opened.svelte-18cyknh {outline:1px solid #0003;}.edit-filter.svelte-18cyknh {margin-right:0.5em;}'
};

function SearchInput($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$g);

	const [$$stores, $$cleanup] = setup_stores();
	const $quickEditEnabled = () => store_get(get$1(quickEditEnabled), '$quickEditEnabled', $$stores);
	const dispatch = createEventDispatcher();

	let quickEditable = prop($$props, 'quickEditable', 3, true),
		filterEditorOpen = prop($$props, 'filterEditorOpen', 3, false),
		showHelp = prop($$props, 'showHelp', 3, true),
		value = prop($$props, 'value', 7, "");

	let selectedFilterTag = derived$1(() => $$props.filter?.tag);
	let quickEditEnabled = derived$1(() => stores[ModuleSetting.QUICK_FILTER_EDIT]);

	function onKeydown(event) {
		if (event.key === "Backspace" && !value()) {
			dispatch("clearFilter");
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			dispatch("navigateUp");
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			dispatch("navigateDown");
		}

		if (event.key === "Tab") {
			event.preventDefault();
			dispatch("switchAction", { shiftKey: event.shiftKey });
		}

		if (event.key === "Enter") {
			event.preventDefault();
			dispatch("submitInput", { shiftKey: event.shiftKey });
		}

		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			dispatch("close");
		}
	}

	function inputChanged() {
		dispatch("inputChanged", value());
	}

	var div = root$c();
	var node = child(div);

	{
		var consequent = ($$anchor) => {
			var span = root_1$c();
			let classes;
			var text = child(span);

			template_effect(
				($0) => {
					classes = set_class(span, 1, 'search-tag svelte-18cyknh', null, classes, $0);
					set_attribute(span, 'title', `@${get$1(selectedFilterTag) ?? ''} - ${$$props.filter?.subTitle ?? ''}`);
					set_text(text, `@${get$1(selectedFilterTag) ?? ''}`);
				},
				[
					() => ({ 'filter-opened': filterEditorOpen() })
				]
			);

			append($$anchor, span);
		};

		if_block(node, ($$render) => {
			if (get$1(selectedFilterTag)) $$render(consequent);
		});
	}

	var input = sibling(node, 2);

	var node_1 = sibling(input, 2);

	{
		var consequent_1 = ($$anchor) => {
			var i = root_2$7();

			template_effect(($0) => set_attribute(i, 'title', $0), [() => mloc("FilterPopupTitle")]);
			event('click', i, () => dispatch("openFilterEditor"));
			append($$anchor, i);
		};

		if_block(node_1, ($$render) => {
			if ($quickEditEnabled() && quickEditable()) $$render(consequent_1);
		});
	}

	template_effect(($0) => set_attribute(input, 'placeholder', $0), [
		() => showHelp() ? mloc("SearchHelpHint") : ""
	]);

	bind_value(input, value);
	event('keydown', input, onKeydown);
	event('input', input, inputChanged);

	event('blur', input, function ($$arg) {
		bubble_event.call(this, $$props, $$arg);
	});

	event('focus', input, function ($$arg) {
		bubble_event.call(this, $$props, $$arg);
	});

	append($$anchor, div);
	pop();
	$$cleanup();
}

var root_4$1 = template(`<i class="separator svelte-cfqetz"></i> <span> <!></span>`, 1);
var root_2$6 = template(`<span> <!></span> <!>`, 1);
var root_1$b = template(`<div class="input-footer svelte-cfqetz"><span class="hint svelte-cfqetz"> </span> <!></div>`);
var root$b = template(`<div role="dialog" tabindex="0"><!> <div class="drag-container svelte-cfqetz"><div class="input-container svelte-cfqetz"><!></div> <!></div></div>`);

const $$css$f = {
	hash: 'svelte-cfqetz',
	code: '.quick-insert-app.svelte-cfqetz {width:100%;max-height:100%;min-height:unset !important;overflow:hidden;display:flex;flex-direction:column;border:1px solid var(--qiBorderColor);box-shadow:0 0 20px #000;border-radius:6px;backdrop-filter:blur(6px);pointer-events:auto;background:var(--qiBackground);}\n\n  /* Dorako UI compatibility */[data-theme].quick-insert-app.svelte-cfqetz,\n  [data-theme].application .quick-insert-app.svelte-cfqetz {background:var(--app-background);border:var(--app-border-width) solid var(--app-border-color);}.drag-container.svelte-cfqetz {cursor:move;}.input-container.svelte-cfqetz {pointer-events:none;padding:0.4em 0.7em;} .quick-insert-app:has(input:focus) {border-color:var(--qiBorderColorFocused);}.input-footer.svelte-cfqetz {display:flex;height:36px;gap:0.5em;flex-shrink:0;padding:0.4em 0.7em;border-top:1px solid var(--qiBorderColor);align-items:center;white-space:nowrap;pointer-events:none;line-height:1.3em;}.hint.svelte-cfqetz {opacity:0.5;flex-grow:1;text-overflow:ellipsis;overflow:hidden;}.input-footer.svelte-cfqetz .separator:where(.svelte-cfqetz) {width:2px;height:0.9em;flex-shrink:0;display:inline-block;background:var(--qiBorderColor);opacity:0.6;}'
};

function SearchApp($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$f);

	const [$$stores, $$cleanup] = setup_stores();
	const $showFootersetting = () => store_get(get$1(showFootersetting), '$showFootersetting', $$stores);
	const $density = () => store_get(get$1(density), '$density', $$stores);
	const dispatch = createEventDispatcher();

	let embedded = prop($$props, 'embedded', 3, false),
		filterEditorOpen = prop($$props, 'filterEditorOpen', 3, false),
		filter = prop($$props, 'filter', 7),
		searchText = prop($$props, 'searchText', 23, () => $$props.context?.startText || ""),
		tooltips = prop($$props, 'tooltips', 19, () => embedded() ? "OFF" : "LEFT");

	let mode = state(proxy(SearchMode.DOCUMENT));
	let selectedAction = state(void 0);
	let appElement;
	let density = derived$1(() => stores[ModuleSetting.SEARCH_DENSITY]);
	let showFootersetting = derived$1(() => stores[ModuleSetting.SEARCH_FOOTER]);
	let selectedIndex = state(-1);
	let results = state([]);
	let showFooter = derived$1(() => $showFootersetting() && !embedded());

	user_effect(() => {
		dispatch("setFilter", filter());
	});

	user_effect(() => {
		dispatch("searched", searchText());
		set(selectedIndex, -1);
	});

	user_effect(() => {
		if (get$1(selectedIndex) === -1) {
			set(selectedIndex, get$1(results).length - 1);
		}
	});

	const callbacks = {
		getContext: () => $$props.context,
		close: () => dispatch("close"),
		setFilter: (newFilter) => {
			filter(newFilter);
			inputChanged("");
			appElement.querySelector("input")?.focus();
		},
		refresh: () => {
			set(results, get$1(controller).search(searchText(), filter()));
		},
		setInputText: (inputText) => {
			inputChanged(inputText);
			appElement.querySelector("input")?.focus();
		}
	};

	let controller = state(proxy(modeConfig[SearchMode.DOCUMENT].controller(callbacks)));

	user_pre_effect(() => {
		inputChanged(searchText());
	});

	let mainHint = derived$1(() => get$1(controller).hint ? loc(get$1(controller).hint) : filter()?.subTitle ?? ($$props.context?.mode === ContextMode.Insert ? loc("QUICKINSERT.ModeInsert") : "Quick Insert"));
	// Focus and keep-open
	let mouseOver = false;
	let inputFocused = true;
	let element;

	function getSelectedActionName() {
		const selectedId = get$1(selectedAction) || get$1(results)[get$1(selectedIndex)]?.defaultAction;
		const action = get$1(results)[get$1(selectedIndex)]?.actions?.find((a) => a.id === selectedId);

		if (action) {
			return loc(action.title);
		}

		return loc("QUICKINSERT.ActionSelect");
	}

	onMount(async () => {
		if (!QuickInsert.searchLib) {
			loadSearchIndex();
		}
	});

	function selectMode(nextMode) {
		if (get$1(mode) === nextMode) return;
		set(controller, proxy(modeConfig[nextMode].controller(callbacks)));
		set(mode, proxy(nextMode));
	}

	function inputChanged(textInput) {
		searchText(textInput);

		const availableModes = $$props.context?.mode === ContextMode.Insert ? Object.entries(modeConfig).filter(([, c]) => c.showInInsertMode) : Object.entries(modeConfig);
		const nextMode = filter() ? SearchMode.DOCUMENT : availableModes.find(([, c]) => c.prefix && textInput.startsWith(c.prefix))?.[0] || SearchMode.DOCUMENT;

		selectMode(nextMode);
		set(results, get$1(controller).search(searchText(), filter()));
	}

	function onAction(actionId, item, shiftKey) {
		get$1(controller).onAction(item, actionId, shiftKey);
	}

	const callAction = (action) => {
		const { actionId, item, shiftKey } = action;

		onAction(actionId, item, shiftKey);
	};

	function navigateUp() {
		set(selectedIndex, proxy(get$1(selectedIndex) == 0 ? get$1(results).length - 1 : get$1(selectedIndex) - 1));
		set(selectedAction, proxy(get$1(results)[get$1(selectedIndex)]?.defaultAction));
	}

	function navigateDown() {
		set(selectedIndex, proxy(get$1(selectedIndex) === get$1(results).length - 1 ? 0 : get$1(selectedIndex) + 1));
		set(selectedAction, proxy(get$1(results)[get$1(selectedIndex)]?.defaultAction));
	}

	function switchAction(event) {
		if (!get$1(results)[get$1(selectedIndex)]) {
			return;
		}

		const actions = get$1(results)[get$1(selectedIndex)].actions;

		if (!actions || actions.length == 0) {
			get$1(controller).onTab(get$1(results)[get$1(selectedIndex)]);
			return;
		}

		let idx;

		if (get$1(selectedAction)) {
			idx = actions.findIndex((a) => a.id == get$1(selectedAction));
		} else {
			idx = actions.findIndex((a) => a.id == get$1(results)[get$1(selectedIndex)].defaultAction);
		}

		const delta = event.detail.shiftKey ? -1 : 1;
		const nextIdx = (idx + delta) % actions.length;

		set(selectedAction, proxy(actions[nextIdx >= 0 ? nextIdx : actions.length - 1].id));
	}

	function submitInput(event) {
		if (!get$1(results)[get$1(selectedIndex)]) {
			return;
		}

		const { shiftKey } = event.detail;

		onAction(get$1(selectedAction) || get$1(results)[get$1(selectedIndex)].defaultAction, get$1(results)[get$1(selectedIndex)].item, shiftKey);
	}

	function mouseEnter() {
		mouseOver = true;
	}

	function mouseLeave(evt) {
		if (evt.shiftKey) return;
		mouseOver = false;
		checkFocus();
	}

	function inputFocus() {
		inputFocused = true;
	}

	function inputBlur() {
		inputFocused = false;
		checkFocus();
	}

	function checkFocus() {
		if (!inputFocused && !mouseOver) {
			dispatch("focusLost");
		}
	}

	function mouseDown(event) {
		if (event.target !== element) {
			return;
		}

		dispatch("moveStart", event);
	}

	var div = root$b();
	let classes;
	var node = child(div);

	SearchResults(node, {
		get searchMode() {
			return get$1(mode);
		},
		get tooltips() {
			return tooltips();
		},
		get selectedAction() {
			return get$1(selectedAction);
		},
		get results() {
			return get$1(results);
		},
		get selectedIndex() {
			return get$1(selectedIndex);
		},
		callAction
	});

	var div_1 = sibling(node, 2);
	var div_2 = child(div_1);
	var node_1 = child(div_2);
	const expression = derived$1(() => !embedded());
	const expression_1 = derived$1(() => $$props.context?.mode !== ContextMode.Insert && !filter());

	SearchInput(node_1, {
		get filter() {
			return filter();
		},
		get filterEditorOpen() {
			return filterEditorOpen();
		},
		get value() {
			return searchText();
		},
		get quickEditable() {
			return get$1(expression);
		},
		get showHelp() {
			return get$1(expression_1);
		},
		$$events: {
			inputChanged: (e) => inputChanged(e.detail),
			navigateUp,
			navigateDown,
			switchAction,
			submitInput,
			clearFilter: () => !embedded() && filter(undefined),
			focus: inputFocus,
			blur: inputBlur,
			close: () => dispatch("close"),
			openFilterEditor: () => dispatch("openFilterEditor", filter())
		}
	});

	var node_2 = sibling(div_2, 2);

	{
		var consequent_2 = ($$anchor) => {
			var div_3 = root_1$b();
			var span = child(div_3);
			var text$1 = child(span);

			var node_3 = sibling(span, 2);

			{
				var consequent_1 = ($$anchor) => {
					var fragment = root_2$6();
					var span_1 = first_child(fragment);
					var text_1 = child(span_1);
					var node_4 = sibling(text_1);

					KeyboardKey(node_4, {
						children: ($$anchor, $$slotProps) => {

							var text_2 = text('↩');

							append($$anchor, text_2);
						}});

					var node_5 = sibling(span_1, 2);

					{
						var consequent = ($$anchor) => {
							var fragment_1 = root_4$1();
							var span_2 = sibling(first_child(fragment_1), 2);
							var text_3 = child(span_2);
							var node_6 = sibling(text_3);

							KeyboardKey(node_6, {
								children: ($$anchor, $$slotProps) => {

									var text_4 = text('↹');

									append($$anchor, text_4);
								}});
							template_effect(($0) => set_text(text_3, `${$0 ?? ''} `), [() => loc("QUICKINSERT.ActionSwitch")]);
							append($$anchor, fragment_1);
						};

						if_block(node_5, ($$render) => {
							if ((get$1(results)[get$1(selectedIndex)]?.actions?.length || 0) > 1) $$render(consequent);
						});
					}

					template_effect(($0) => set_text(text_1, `${$0 ?? ''} `), [getSelectedActionName]);
					append($$anchor, fragment);
				};

				if_block(node_3, ($$render) => {
					if (get$1(results).length) $$render(consequent_1);
				});
			}
			template_effect(() => set_text(text$1, get$1(mainHint)));
			append($$anchor, div_3);
		};

		if_block(node_2, ($$render) => {
			if (get$1(showFooter)) $$render(consequent_2);
		});
	}
	bind_this(div_1, ($$value) => element = $$value, () => element);
	bind_this(div, ($$value) => appElement = $$value, () => appElement);

	template_effect(($0) => classes = set_class(div, 1, `quick-insert-app search-app density-${$density() ?? ''}`, 'svelte-cfqetz', classes, $0), [
		() => ({
			embedded: embedded(),
			application: !embedded()
		})
	]);

	event('pointerdown', div_1, mouseDown);
	event('mouseenter', div, mouseEnter);
	event('mouseleave', div, mouseLeave);
	transition(5, div, () => fade, () => ({ duration: 100 }));
	transition(6, div, () => blur, () => ({ duration: 100 }));
	append($$anchor, div);
	pop();
	$$cleanup();
}

var root_1$a = template(`<i></i>`);
var root_2$5 = template(`<i class="fas fa-caret-down svelte-1818bue" tabindex="0"></i>`);
var root$a = template(`<li tabindex="0"><span class="svelte-1818bue"><!> </span> <!></li>`);

const $$css$e = {
	hash: 'svelte-1818bue',
	code: 'li.svelte-1818bue {display:flex;align-items:center;line-height:1.8em;gap:0.3em;border-radius:4px;padding:0 0.6em;background:rgba(255, 255, 255, 0.2);cursor:pointer;justify-content:space-between;border:none;margin-bottom:0 !important;}li.svelte-1818bue:active {box-shadow:inset 0 0 0 1px #0004;}.more.svelte-1818bue {padding-right:0;}.square.svelte-1818bue {border-radius:0;}.disabled.svelte-1818bue {opacity:0.5;pointer-events:none;}li.svelte-1818bue:hover {background:rgba(255, 255, 255, 0.35);}.selected.svelte-1818bue {background:rgba(0, 0, 0, 0.5);color:var(--color-light-2);}.selected.svelte-1818bue:hover {background:rgba(0, 0, 0, 0.4);}\n\n  /** Alternative colored sausage */li.altcolor.svelte-1818bue {\n    /* background: rgba(255, 166, 166, 0.35); */\n    /* color: rgba(189, 0, 0, 0.66); */color:rgba(255, 166, 166, 0.7);background:transparent;}li.altcolor.svelte-1818bue:hover {background:rgba(255, 166, 166, 0.7);}.selected.altcolor.svelte-1818bue {background:rgba(189, 0, 0, 0.66);color:var(--color-light-2);}.selected.altcolor.svelte-1818bue:hover {background:rgba(189, 0, 0, 0.4);}.fa-caret-down.svelte-1818bue {border-radius:0 4px 4px 0;transition:background-color 150ms cubic-bezier(0.4, 0, 0.04, 1);background:#0002;display:flex;height:100%;align-items:center;justify-content:center;width:24px;flex-shrink:0;}.fa-caret-down.svelte-1818bue:hover {background:#0003;}.fa-caret-down.svelte-1818bue:active {box-shadow:inset 0 0 0 1px #0004;}span.svelte-1818bue {white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
};

function FilterOptionSausage($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$e);

	const dispatch = createEventDispatcher();
	var li = root$a();
	let classes;
	var span = child(li);
	var node = child(span);

	{
		var consequent = ($$anchor) => {
			var i = root_1$a();

			template_effect(() => set_class(i, 1, `fas ${$$props.icon ?? ''}`, 'svelte-1818bue'));
			append($$anchor, i);
		};

		if_block(node, ($$render) => {
			if ($$props.icon) $$render(consequent);
		});
	}

	var text = sibling(node);

	var node_1 = sibling(span, 2);

	{
		var consequent_1 = ($$anchor) => {
			var i_1 = root_2$5();

			template_effect(($0) => set_attribute(i_1, 'title', $0), [
				() => mloc("FilterEditorOptionMoreOptions")
			]);

			event('click', i_1, stopPropagation(() => !$$props.disabled && dispatch("clickMore")));
			append($$anchor, i_1);
		};

		if_block(node_1, ($$render) => {
			if ($$props.more) $$render(consequent_1);
		});
	}

	template_effect(
		($0) => {
			set_attribute(li, 'title', $$props.title);
			classes = set_class(li, 1, 'svelte-1818bue', null, classes, $0);
			set_text(text, ` ${$$props.title ?? ''}`);
		},
		[
			() => ({
				selected: $$props.selected,
				altcolor: $$props.altcolor,
				square: $$props.square,
				more: $$props.more,
				disabled: $$props.disabled
			})
		]
	);

	event('click', li, (evt) => !$$props.disabled && dispatch("click", evt));
	append($$anchor, li);
	pop();
}

var root$9 = template(`<h3 class="svelte-10fkv0i"> </h3> <ul class="svelte-10fkv0i"><!> <!> <!></ul>`, 1);

const $$css$d = {
	hash: 'svelte-10fkv0i',
	code: 'h3.svelte-10fkv0i {padding:0 1em 0.2em;border-bottom:2px solid rgba(255, 255, 255, 0.2);}ul.svelte-10fkv0i {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));margin:0;padding:0;margin-bottom:1em;gap:0.5em;padding:0.4em 1em;}'
};

function FilterSectionTypes($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$d);

	const [$$stores, $$cleanup] = setup_stores();
	const $enabledDocumentTypes = () => store_get(enabledDocumentTypes$1, '$enabledDocumentTypes', $$stores);
	let disabled = prop($$props, 'disabled', 3, false);
	const dispatch = createEventDispatcher();

	let documentTypes = derived$1(() => $enabledDocumentTypes().map((type) => {
		const selectedTypes = $$props.config.documentTypes.filter((s) => s.split(":")[0] === type);
		const title = selectedTypes.length ? selectedTypes.map((type) => typeLabel(type)).join(", ") : typeLabel(type);

		return {
			id: type,
			name: typeLabel(type),
			title,
			selected: $$props.config.documentTypes.findIndex((t) => t === type || t.split(":")[0] === type) !== -1
		};
	}));

	let actorType = derived$1(() => get$1(documentTypes).find((type) => type.id === DocumentType.ACTOR));
	let itemType = derived$1(() => get$1(documentTypes).find((type) => type.id === DocumentType.ITEM));

	function toggleType(type) {
		const types = new Set($$props.config.documentTypes);
		const matches = $$props.config.documentTypes.filter((t) => t === type || t.split(":")[0] === type);

		if (matches.length) {
			matches.forEach((t) => types.delete(t));
			types.delete(type);
		} else {
			types.add(type);
		}

		dispatch("change", { documentTypes: Array.from(types) });
	}

	var fragment = root$9();
	var h3 = first_child(fragment);
	var text = child(h3);

	var ul = sibling(h3, 2);
	var node = child(ul);

	{
		var consequent = ($$anchor) => {
			FilterOptionSausage($$anchor, {
				get selected() {
					return get$1(actorType).selected;
				},
				get title() {
					return get$1(actorType).title;
				},
				get icon() {
					return documentIcons[get$1(actorType).id];
				},
				more: true,
				get disabled() {
					return disabled();
				},
				$$events: {
					click: () => toggleType(DocumentType.ACTOR),
					clickMore: () => dispatch("openModal", "actors")
				}
			});
		};

		if_block(node, ($$render) => {
			if ($enabledDocumentTypes().includes(DocumentType.ACTOR)) $$render(consequent);
		});
	}

	var node_1 = sibling(node, 2);

	{
		var consequent_1 = ($$anchor) => {
			FilterOptionSausage($$anchor, {
				get selected() {
					return get$1(itemType).selected;
				},
				get title() {
					return get$1(itemType).title;
				},
				get icon() {
					return documentIcons[get$1(itemType).id];
				},
				more: true,
				get disabled() {
					return disabled();
				},
				$$events: {
					click: () => toggleType(DocumentType.ITEM),
					clickMore: () => dispatch("openModal", "items")
				}
			});
		};

		if_block(node_1, ($$render) => {
			if ($enabledDocumentTypes().includes(DocumentType.ITEM)) $$render(consequent_1);
		});
	}

	var node_2 = sibling(node_1, 2);

	each(node_2, 17, () => get$1(documentTypes), (type) => type.id, ($$anchor, type) => {
		var fragment_3 = comment();
		var node_3 = first_child(fragment_3);

		{
			var consequent_2 = ($$anchor) => {
				FilterOptionSausage($$anchor, {
					get selected() {
						return get$1(type).selected;
					},
					get title() {
						return get$1(type).title;
					},
					get icon() {
						return documentIcons[get$1(type).id];
					},
					get disabled() {
						return disabled();
					},
					$$events: {
						click: () => toggleType(get$1(type).id)
					}
				});
			};

			if_block(node_3, ($$render) => {
				if (get$1(type).id !== DocumentType.ACTOR && get$1(type).id !== DocumentType.ITEM) $$render(consequent_2);
			});
		}

		append($$anchor, fragment_3);
	});

	template_effect(($0) => set_text(text, $0), [
		() => mloc("FilterEditorSectionTypeSelection")
	]);

	append($$anchor, fragment);
	pop();
	$$cleanup();
}

function getCompendiumTitle(compendiums) {
    if (!compendiums.length) {
        return mloc("FilterEditorCompendium");
    }
    if (compendiums[0] === FILTER_COMPENDIUM_ALL) {
        return mloc("FilterEditorCompendiumAll");
    }
    if (compendiums.length === 1 && compendiums[0].length < 20) {
        return game.packs.get(compendiums[0])?.title || compendiums[0];
    }
    return ((compendiums.length === 1 && game.packs?.get(compendiums[0])?.title) ||
        mloc("FilterEditorCompendiumMany", {
            packCount: compendiums.length.toString(),
        }));
}
function getFolderTitle(folders) {
    if (!folders.length) {
        return mloc("FilterEditorDirectory");
    }
    if (folders[0] === FILTER_FOLDER_ROOT) {
        return mloc("FilterEditorFolderRoot");
    }
    if (folders.length === 1) {
        return game.folders?.get(folders[0])?.name || folders[0];
    }
    return ((folders.length === 1 && game.folders?.get(folders[0])?.name) ||
        mloc("FilterEditorFolderMany", {
            folderCount: folders.length.toString(),
        }));
}
// Get labels for what's selected in the config.
function getLabels(config) {
    const labels = {};
    if (config.documentTypes?.length) {
        if (config.documentTypes.length === 1) {
            labels.documentTypes = typeLabel(config.documentTypes[0]);
        }
        else {
            labels.documentTypes = mloc("FilterEditorTypeMany", {
                typeCount: config.documentTypes.length.toString(),
            });
        }
    }
    if (config.folders.length) {
        labels.folders = getFolderTitle(config.folders);
    }
    if (config.compendiums.length) {
        labels.packs = getCompendiumTitle(config.compendiums);
    }
    return labels;
}
function createFilter(tag, type, original) {
    const newId = randomId(30);
    const filterConfig = original
        ? cloneFilterConfig(original.filterConfig)
        : { compendiums: [], folders: [], documentTypes: [] };
    const subTitle = original ? `${original.subTitle} (Copy)` : tag;
    addFilter({
        id: newId,
        type,
        tag,
        subTitle,
        filterConfig,
        role: type === FilterType.Client
            ? CONST.USER_ROLES.PLAYER
            : original?.role || CONST.USER_ROLES.GAMEMASTER,
    });
    return newId;
}
function makeEmptyFilter() {
    const newId = randomId(30);
    const filterConfig = { compendiums: [], folders: [], documentTypes: [] };
    return {
        id: newId,
        type: FilterType.Temporary,
        tag: "~",
        subTitle: mloc("FilterPopupTitle"),
        filterConfig,
        role: CONST.USER_ROLES.PLAYER,
    };
}

var root$8 = template(`<h3 class="svelte-10fkv0i"> </h3> <ul class="selection svelte-10fkv0i"><!> <!></ul>`, 1);

const $$css$c = {
	hash: 'svelte-10fkv0i',
	code: 'h3.svelte-10fkv0i {padding:0 1em 0.2em;border-bottom:2px solid rgba(255, 255, 255, 0.2);}ul.svelte-10fkv0i {display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));margin:0;padding:0;margin-bottom:1em;gap:0.5em;padding:0.4em 1em;}'
};

function FilterSectionLocation($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$c);

	const disabled = prop($$props, 'disabled', 3, false);
	const dispatch = createEventDispatcher();
	let packTitle = derived$1(() => getCompendiumTitle($$props.config.compendiums));
	let folderTitle = derived$1(() => getFolderTitle($$props.config.folders));
	var fragment = root$8();
	var h3 = first_child(fragment);
	var text = child(h3);

	var ul = sibling(h3, 2);
	var node = child(ul);
	const expression = derived$1(() => Boolean($$props.config.folders.length));

	FilterOptionSausage(node, {
		get title() {
			return get$1(folderTitle);
		},
		icon: 'fa-folder',
		get selected() {
			return get$1(expression);
		},
		more: true,
		get disabled() {
			return disabled();
		},
		$$events: {
			click: () => dispatch("openModal", "folders"),
			clickMore: () => dispatch("openModal", "folders")
		}
	});

	var node_1 = sibling(node, 2);
	const expression_1 = derived$1(() => Boolean($$props.config.compendiums.length));

	FilterOptionSausage(node_1, {
		get title() {
			return get$1(packTitle);
		},
		icon: 'fa-atlas',
		get selected() {
			return get$1(expression_1);
		},
		more: true,
		get disabled() {
			return disabled();
		},
		$$events: {
			click: () => dispatch("openModal", "packs"),
			clickMore: () => dispatch("openModal", "packs")
		}
	});

	template_effect(($0) => set_text(text, $0), [
		() => mloc("FilterEditorSectionLocationSelection")
	]);

	append($$anchor, fragment);
	pop();
}

var root_1$9 = template(`<i></i>`);
var root_2$4 = template(`<ul class="svelte-7oc4bi"></ul>`);
var root$7 = template(`<li><span><i></i> </span> <!></li> <!>`, 1);

const $$css$b = {
	hash: 'svelte-7oc4bi',
	code: 'li.svelte-7oc4bi {display:flex;align-items:center;line-height:1.8em;flex-wrap:wrap;gap:0.3em;padding:0 0.6em;background:rgba(255, 255, 255, 0.15);cursor:pointer;justify-content:space-between;margin-left:10px !important;margin-bottom:0 !important;}li.svelte-7oc4bi:hover {background:rgba(255, 255, 255, 0.35);}.selected.svelte-7oc4bi {background:rgba(0, 0, 0, 0.5);color:var(--color-light-2);}.selected.svelte-7oc4bi:hover {background:rgba(0, 0, 0, 0.4);}ul.svelte-7oc4bi {margin:0 !important;width:100%;list-style:none;width:auto;margin-bottom:3px !important;}.folder-toggle.svelte-7oc4bi {width:15px;margin-left:3px;display:inline-flex;justify-content:center;border-radius:4px;padding:3px;transition:background-color 150ms cubic-bezier(0.4, 0, 0.04, 1);}.folder-toggle.svelte-7oc4bi:hover {background:#0003;}.folder-toggle.svelte-7oc4bi:active {box-shadow:inset 0 0 0 1px #0003;}'
};

function FolderTreeItem($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$b);

	let hasChildren = derived$1(() => Boolean($$props.folderNode.children?.length));
	let expanded = state(false);
	const dispatch = createEventDispatcher();
	var fragment = root$7();
	var li = first_child(fragment);
	let classes;
	var span = child(li);
	var i = child(span);
	var text = sibling(i);

	var node_1 = sibling(span, 2);

	{
		var consequent = ($$anchor) => {
			var i_1 = root_1$9();

			template_effect(() => set_class(i_1, 1, `fas fa-caret-${(get$1(expanded) ? 'up' : 'down') ?? ''} folder-toggle`, 'svelte-7oc4bi'));
			event('click', i_1, stopPropagation(() => set(expanded, !get$1(expanded))));
			append($$anchor, i_1);
		};

		if_block(node_1, ($$render) => {
			if (get$1(hasChildren)) $$render(consequent);
		});
	}

	var node_2 = sibling(li, 2);

	{
		var consequent_1 = ($$anchor) => {
			var ul = root_2$4();

			each(ul, 21, () => $$props.folderNode.children, (node) => node.folder.id, ($$anchor, node) => {
				var fragment_1 = comment();
				var node_3 = first_child(fragment_1);

				FolderTreeItem(node_3, {
					get folderNode() {
						return get$1(node);
					},
					$$events: {
						selectFolder($$arg) {
							bubble_event.call(this, $$props, $$arg);
						}
					}
				});

				append($$anchor, fragment_1);
			});
			append($$anchor, ul);
		};

		if_block(node_2, ($$render) => {
			if (get$1(expanded)) $$render(consequent_1);
		});
	}

	template_effect(
		($0) => {
			classes = set_class(li, 1, 'svelte-7oc4bi', null, classes, $0);
			set_class(i, 1, `fas ${documentIcons[$$props.folderNode.folder.type] ?? ''}`, 'svelte-7oc4bi');
			set_text(text, ` ${$$props.folderNode.folder.name ?? ''}`);
		},
		[
			() => ({ selected: $$props.folderNode.selected })
		]
	);

	event('click', li, () => dispatch("selectFolder", $$props.folderNode.folder.id));
	append($$anchor, fragment);
	pop();
}

var root$6 = template(`<div></div> <section><header class="svelte-1ampvy1"><h3 class="svelte-1ampvy1"><i class="fas fa-chevron-left svelte-1ampvy1"></i> <span class="svelte-1ampvy1"> </span></h3></header> <!> <footer class="svelte-1ampvy1"><!> <!></footer></section>`, 1);

const $$css$a = {
	hash: 'svelte-1ampvy1',
	code: 'section.svelte-1ampvy1 {display:none;position:absolute;top:0;bottom:0;left:0;right:0;background:var(--qiFilterAccent);overflow:auto;flex-direction:column;}.backdrop.svelte-1ampvy1 {display:none;position:absolute;top:0;bottom:0;left:0;right:0;background:rgba(0, 0, 0, 0.7);}header.svelte-1ampvy1 {padding:0 0.1em;border-bottom:2px solid #333;}h3.svelte-1ampvy1 {margin:0;border:none;display:flex;align-items:stretch;}span.svelte-1ampvy1 {flex-grow:1;padding:0.4em 0;}.fa-chevron-left.svelte-1ampvy1 {cursor:pointer;display:flex;justify-content:center;align-items:center;width:30px;}.open.svelte-1ampvy1 {display:flex;}footer.svelte-1ampvy1 {display:flex;padding:0.4em 1em;}'
};

function FilterModal($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$a);

	const dispatch = createEventDispatcher();
	const close = () => dispatch("close");
	var fragment = root$6();
	var div = first_child(fragment);
	let classes;
	var section = sibling(div, 2);
	let classes_1;
	var header = child(section);
	var h3 = child(header);
	var i = child(h3);

	set_attribute(i, 'title', "Back");

	var span = sibling(i, 2);

	set_attribute(span, 'title', "Back");

	var text$1 = child(span);

	var node = sibling(header, 2);

	slot(node, $$props, 'default', {});

	var footer = sibling(node, 2);
	var node_1 = child(footer);

	NiceButton(node_1, {
		$$events: { click: () => dispatch("close") },
		children: ($$anchor, $$slotProps) => {

			var text_1 = text();

			template_effect(($0) => set_text(text_1, $0), [() => mloc("FilterEditorDone")]);
			append($$anchor, text_1);
		},
		$$slots: { default: true }
	});

	var node_2 = sibling(node_1, 2);

	NiceButton(node_2, {
		$$events: { click: () => dispatch("clear") },
		children: ($$anchor, $$slotProps) => {

			var text_2 = text();

			template_effect(($0) => set_text(text_2, $0), [() => mloc("FilterEditorDeselectAll")]);
			append($$anchor, text_2);
		},
		$$slots: { default: true }
	});

	template_effect(
		($0, $1) => {
			classes = set_class(div, 1, 'backdrop svelte-1ampvy1', null, classes, $0);
			classes_1 = set_class(section, 1, 'svelte-1ampvy1', null, classes_1, $1);
			set_text(text$1, $$props.title);
		},
		[
			() => ({ open: $$props.open }),
			() => ({ open: $$props.open })
		]
	);

	event('click', div, close);
	event('click', i, close);
	event('click', span, close);
	append($$anchor, fragment);
	pop();
}

var root_1$8 = template(`<div class="filter-input svelte-1b2wrth"><input type="text" class="option-filter svelte-1b2wrth"> <i></i></div> <ul class="svelte-1b2wrth"><!> <!></ul>`, 1);

const $$css$9 = {
	hash: 'svelte-1b2wrth',
	code: 'ul.svelte-1b2wrth {overflow:auto;padding:0;flex-grow:1;margin:0;}.filter-input.svelte-1b2wrth {display:flex;align-items:center;position:relative;}.clear.svelte-1b2wrth {position:absolute;right:0;padding:0 0.5em;height:100%;display:flex;align-items:center;}.hide-clear.svelte-1b2wrth {opacity:0;}.option-filter.svelte-1b2wrth {border-radius:0 !important;border:none !important;border-radius:0 !important;padding:0 0.6em !important;flex-grow:1;color:var(--color-light-2) !important;}.option-filter.svelte-1b2wrth::placeholder {color:var(--color-light-2);opacity:0.6;}.option-filter.svelte-1b2wrth:focus {box-shadow:rgba(0, 0, 0, 0.25) 0px 0px 0px 2px inset;}'
};

function FilterModalFolders($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$9);

	const [$$stores, $$cleanup] = setup_stores();
	const $enabledDocumentTypes = () => store_get(enabledDocumentTypes$1, '$enabledDocumentTypes', $$stores);
	const $folders = () => store_get(folders, '$folders', $$stores);
	let open = prop($$props, 'open', 3, false);
	let folderFilter = state("");
	const folders = collectionStores.folders;
	const dispatch = createEventDispatcher();

	function buildTree(folders, parent = null) {
		if (!folders) return [];

		const [children, rest] = folders.reduce(([p, f], e) => e.folder === parent ? [[...p, e], f] : [p, [...f, e]], [[], []]);

		return children.map((f) => ({
			folder: f,
			selected: Boolean($$props.config.folders[0] === FILTER_FOLDER_ROOT || f.id && $$props.config.folders.includes(f.id)),
			children: buildTree(rest, f).sort(f.sorting === "a" ? (a, b) => a.folder.name?.localeCompare(b.folder.name || "") || 0 : (a, b) => a.folder.sort - b.folder.sort)
		}));
	}

	function sortByType(tree) {
		const baseTypes = new Set($$props.config.documentTypes.map((type) => type.split(":")[0]));
		const filterTypes = Boolean(baseTypes.size);
		const byType = Object.fromEntries($enabledDocumentTypes().filter((type) => !filterTypes || baseTypes.has(type)).map((t) => [t, []]));

		tree.forEach((node) => byType[node.folder.type]?.push(node));
		return Object.values(byType).flat();
	}

	function toggleAll() {
		if (!$$props.config.folders.length || $$props.config.folders[0] !== FILTER_FOLDER_ROOT) {
			dispatch("change", { folders: [FILTER_FOLDER_ROOT] });
		} else {
			dispatch("change", { folders: [] });
		}
	}

	function selectFolder(evt) {
		let updated = new Set($$props.config.folders);

		if ($$props.config.folders[0] === FILTER_FOLDER_ROOT) {
			updated = new Set([evt.detail]);
		} else if ($$props.config.folders.includes(evt.detail)) {
			updated.delete(evt.detail);
		} else {
			updated.add(evt.detail);
		}

		dispatch("change", { folders: Array.from(updated) });
	}

	function clear() {
		dispatch("change", { folders: [] });
	}

	let folderTree = derived$1(() => folders && $$props.config && sortByType(buildTree($folders())));
	const expression = derived$1(() => mloc("FilterEditorFolderSelectTitle"));

	FilterModal($$anchor, {
		get title() {
			return get$1(expression);
		},
		get open() {
			return open();
		},
		$$events: {
			close($$arg) {
				bubble_event.call(this, $$props, $$arg);
			},
			clear
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$8();
			var div = first_child(fragment_1);
			var input = child(div);

			var i = sibling(input, 2);

			var ul = sibling(div, 2);
			var node_1 = child(ul);
			const expression_1 = derived$1(() => $$props.config?.folders[0] === FILTER_FOLDER_ROOT);
			const expression_2 = derived$1(() => mloc("FilterEditorFolderRoot"));

			FilterOptionSausage(node_1, {
				get selected() {
					return get$1(expression_1);
				},
				get title() {
					return get$1(expression_2);
				},
				square: true,
				$$events: { click: toggleAll }
			});

			var node_2 = sibling(node_1, 2);

			{
				var consequent = ($$anchor) => {
					var fragment_2 = comment();
					var node_3 = first_child(fragment_2);

					each(node_3, 17, () => get$1(folderTree), (node) => node.folder.id, ($$anchor, node) => {
						FolderTreeItem($$anchor, {
							get folderNode() {
								return get$1(node);
							},
							$$events: { selectFolder }
						});
					});

					append($$anchor, fragment_2);
				};

				if_block(node_2, ($$render) => {
					if (get$1(folderTree)) $$render(consequent);
				});
			}

			template_effect(
				($0, $1) => {
					set_attribute(input, 'placeholder', $0);
					set_class(i, 1, `fas fa-xmark clear ${(get$1(folderFilter) ? '' : 'hide-clear') ?? ''}`, 'svelte-1b2wrth');
					set_attribute(i, 'title', $1);
				},
				[
					() => mloc("FilterEditorOptionFilter"),
					() => mloc("FilterEditorOptionFilterClear")
				]
			);

			bind_value(input, () => get$1(folderFilter), ($$value) => set(folderFilter, $$value));
			event('click', i, () => set(folderFilter, ""));
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	pop();
	$$cleanup();
}

var root_1$7 = template(`<div class="filter-input svelte-13y2jl8"><input type="text" class="option-filter svelte-13y2jl8"> <i></i></div> <ul class="svelte-13y2jl8"><!> <!></ul>`, 1);

const $$css$8 = {
	hash: 'svelte-13y2jl8',
	code: 'ul.svelte-13y2jl8 {overflow:auto;padding:0;flex-grow:1;margin:0;}.filter-input.svelte-13y2jl8 {display:flex;align-items:center;position:relative;}.clear.svelte-13y2jl8 {position:absolute;right:0;padding:0 0.5em;height:100%;display:flex;align-items:center;}.hide-clear.svelte-13y2jl8 {opacity:0;}.option-filter.svelte-13y2jl8 {border-radius:0 !important;border:none !important;border-radius:0 !important;padding:0 0.6em !important;flex-grow:1;color:var(--color-light-2) !important;}.option-filter.svelte-13y2jl8::placeholder {color:var(--color-light-2);opacity:0.6;}.option-filter.svelte-13y2jl8:focus {box-shadow:rgba(0, 0, 0, 0.25) 0px 0px 0px 2px inset;}ul.svelte-13y2jl8 li:not(:first-child) {margin-left:10px;}'
};

function FilterModalPacks($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$8);

	const [$$stores, $$cleanup] = setup_stores();
	const $enabledPacks = () => store_get(enabledPacks, '$enabledPacks', $$stores);
	const dispatch = createEventDispatcher();
	let open = prop($$props, 'open', 3, false);
	// Input filters
	let packFilter = state("");
	let allSelected = derived$1(() => $$props.config?.compendiums[0] === FILTER_COMPENDIUM_ALL);

	let packs = derived$1(() => $enabledPacks().map((pack) => ({
		id: pack.collection,
		title: pack.title,
		selected: Boolean($$props.config?.compendiums?.includes(pack.collection)),
		type: pack.documentName,
		icon: documentIcons[pack.documentName]
	})));

	let baseTypes = derived$1(() => new Set($$props.config.documentTypes.map((type) => type.split(":")[0])));
	let filterTypes = derived$1(() => Boolean(get$1(baseTypes).size));

	const filterItems = (filter, items) => {
		return items.filter((item) => (!get$1(filterTypes) || get$1(baseTypes).has(item.type)) && item.title.toLowerCase().includes(filter.toLowerCase()));
	};

	function toggleAll() {
		if (!get$1(allSelected)) {
			dispatch("change", { compendiums: [FILTER_COMPENDIUM_ALL] });
		} else {
			dispatch("change", { compendiums: [] });
		}
	}

	function selectPack(id) {
		let updated = new Set($$props.config.compendiums);

		if (get$1(allSelected)) {
			updated = new Set([id]);
		} else if ($$props.config.compendiums.includes(id)) {
			updated.delete(id);
		} else {
			updated.add(id);
		}

		dispatch("change", { compendiums: Array.from(updated) });
	}

	function clear() {
		dispatch("change", { compendiums: [] });
	}

	const expression = derived$1(() => mloc("FilterEditorCompendiumSelectTitle"));

	FilterModal($$anchor, {
		get title() {
			return get$1(expression);
		},
		get open() {
			return open();
		},
		$$events: {
			close($$arg) {
				bubble_event.call(this, $$props, $$arg);
			},
			clear
		},
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$7();
			var div = first_child(fragment_1);
			var input = child(div);

			var i = sibling(input, 2);

			var ul = sibling(div, 2);
			var node = child(ul);
			const expression_1 = derived$1(() => $$props.config?.compendiums[0] === FILTER_COMPENDIUM_ALL);
			const expression_2 = derived$1(() => mloc("FilterEditorCompendiumAll"));

			FilterOptionSausage(node, {
				get selected() {
					return get$1(expression_1);
				},
				get title() {
					return get$1(expression_2);
				},
				square: true,
				$$events: { click: toggleAll }
			});

			var node_1 = sibling(node, 2);

			each(node_1, 17, () => filterItems(get$1(packFilter), get$1(packs)), (pack) => pack.id, ($$anchor, pack) => {
				const expression_3 = derived$1(() => get$1(allSelected) || get$1(pack).selected);

				FilterOptionSausage($$anchor, {
					get selected() {
						return get$1(expression_3);
					},
					get title() {
						return get$1(pack).title;
					},
					get icon() {
						return get$1(pack).icon;
					},
					square: true,
					$$events: {
						click: () => selectPack(get$1(pack).id)
					}
				});
			});

			template_effect(
				($0, $1) => {
					set_attribute(input, 'placeholder', $0);
					set_class(i, 1, `fas fa-xmark clear ${(get$1(packFilter) ? '' : 'hide-clear') ?? ''}`, 'svelte-13y2jl8');
					set_attribute(i, 'title', $1);
				},
				[
					() => mloc("FilterEditorOptionFilter"),
					() => mloc("FilterEditorOptionFilterClear")
				]
			);

			bind_value(input, () => get$1(packFilter), ($$value) => set(packFilter, $$value));
			event('click', i, () => set(packFilter, ""));
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	pop();
	$$cleanup();
}

var root_1$6 = template(`<ul class="svelte-1p8zxnz"><!> <!></ul>`);

const $$css$7 = {
	hash: 'svelte-1p8zxnz',
	code: 'ul.svelte-1p8zxnz {overflow:auto;padding:0;flex-grow:1;margin:0;}ul.svelte-1p8zxnz li:not(:first-child) {margin-left:10px;}'
};

function FilterModalSubTypes($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$7);

	let open = prop($$props, 'open', 3, false);
	const dispatch = createEventDispatcher();
	const subTypes = getSubTypes($$props.thisType);
	let types = derived$1(() => new Set($$props.config.documentTypes));
	let mainSelected = derived$1(() => get$1(types).has($$props.thisType));

	function toggleAll() {
		let updated = new Set(get$1(types));

		if (get$1(types).has($$props.thisType)) {
			updated.delete($$props.thisType);
		} else {
			const other = $$props.config.documentTypes.filter((t) => t.split(":")[0] !== $$props.thisType);

			updated = new Set(other);
			updated.add($$props.thisType);
		}

		dispatch("change", { documentTypes: Array.from(updated) });
	}

	function selectSubType(subType) {
		const updated = new Set(get$1(types));

		if (get$1(types).has($$props.thisType)) {
			updated.delete($$props.thisType);
		}

		if (get$1(types).has(subType)) {
			updated.delete(subType);
		} else {
			updated.add(subType);
		}

		dispatch("change", { documentTypes: Array.from(updated) });
	}

	function clear() {
		const other = $$props.config.documentTypes.filter((t) => t.split(":")[0] !== $$props.thisType);

		dispatch("change", { documentTypes: other });
	}

	const expression = derived$1(() => typeLabel($$props.thisType));

	FilterModal($$anchor, {
		get title() {
			return get$1(expression);
		},
		get open() {
			return open();
		},
		$$events: {
			close($$arg) {
				bubble_event.call(this, $$props, $$arg);
			},
			clear
		},
		children: ($$anchor, $$slotProps) => {
			var ul = root_1$6();
			var node = child(ul);
			const expression_1 = derived$1(() => typeLabel($$props.thisType));

			FilterOptionSausage(node, {
				get selected() {
					return get$1(mainSelected);
				},
				get title() {
					return get$1(expression_1);
				},
				square: true,
				$$events: { click: toggleAll }
			});

			var node_1 = sibling(node, 2);

			each(node_1, 17, () => subTypes, index, ($$anchor, subType) => {
				const expression_2 = derived$1(() => get$1(mainSelected) || get$1(types).has(get$1(subType)));
				const expression_3 = derived$1(() => typeLabel(get$1(subType)));

				FilterOptionSausage($$anchor, {
					get selected() {
						return get$1(expression_2);
					},
					get title() {
						return get$1(expression_3);
					},
					square: true,
					$$events: {
						click: () => selectSubType(get$1(subType))
					}
				});
			});
			append($$anchor, ul);
		},
		$$slots: { default: true }
	});

	pop();
}

var root_1$5 = template(`<h2> </h2>`);
var root$5 = template(`<section class="qi-filter-editor svelte-niuzjk"><main class="svelte-niuzjk"><!> <!> <!> <footer class="svelte-niuzjk"><span class="svelte-niuzjk"></span> <!></footer></main> <!> <!> <!> <!></section>`);

const $$css$6 = {
	hash: 'svelte-niuzjk',
	code: ':root {display:flex;flex-direction:row;}section.svelte-niuzjk {position:relative;height:100%;width:100%;background:var(--qiFilterAccent);border-radius:6px;color:var(--color-light-2);overflow:hidden;--color-text-primary: var(--color-light-2);}section.svelte-niuzjk h3 {font-size:120%;margin:6px 0 !important;color:var(--color-light-2);text-shadow:none;}main.svelte-niuzjk {width:100%;height:100%;overflow:auto;display:flex;flex-direction:column;}footer.svelte-niuzjk {display:flex;flex-grow:1;align-items:end;}\n  /** Format like the button */span.svelte-niuzjk {height:30px;line-height:28px;width:100%;margin:6px;padding:1px 4px;opacity:0.6;text-align:center;}'
};

function FilterEditor($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$6);

	let disabled = prop($$props, 'disabled', 3, false);
	let modalOpen = state(void 0);
	const dispatch = createEventDispatcher();

	const updateFilter = (changes) => {
		if (!$$props.filterConfig) return;

		const newConfig = cloneFilterConfig($$props.filterConfig);

		Object.assign(newConfig, changes);
		dispatch("change", newConfig);
	};

	function closeModal() {
		set(modalOpen, undefined);
	}

	function openModal(event) {
		set(modalOpen, proxy(event.detail));
	}

	function clearFilter() {
		dispatch("change", {
			compendiums: [],
			folders: [],
			documentTypes: []
		});
	}

	var section = root$5();
	var main = child(section);
	var node = child(main);

	{
		var consequent = ($$anchor) => {
			var h2 = root_1$5();
			var text = child(h2);
			template_effect(() => set_text(text, $$props.title));
			append($$anchor, h2);
		};

		if_block(node, ($$render) => {
			if ($$props.title) $$render(consequent);
		});
	}

	var node_1 = sibling(node, 2);

	FilterSectionTypes(node_1, {
		get config() {
			return $$props.filterConfig;
		},
		get disabled() {
			return disabled();
		},
		$$events: {
			openModal,
			change: (event) => updateFilter(event.detail)
		}
	});

	var node_2 = sibling(node_1, 2);

	FilterSectionLocation(node_2, {
		get config() {
			return $$props.filterConfig;
		},
		get disabled() {
			return disabled();
		},
		$$events: {
			openModal,
			change: (event) => updateFilter(event.detail)
		}
	});

	var footer = sibling(node_2, 2);
	var node_3 = sibling(child(footer), 2);

	NiceButton(node_3, {
		$$events: { click: clearFilter },
		children: ($$anchor, $$slotProps) => {

			var text_1 = text();

			template_effect(($0) => set_text(text_1, $0), [() => mloc("FilterEditorResetFilter")]);
			append($$anchor, text_1);
		},
		$$slots: { default: true }
	});

	var node_4 = sibling(main, 2);
	const expression = derived$1(() => get$1(modalOpen) === "actors");

	FilterModalSubTypes(node_4, {
		thisType: 'Actor',
		get config() {
			return $$props.filterConfig;
		},
		get open() {
			return get$1(expression);
		},
		$$events: {
			close: closeModal,
			change: (event) => updateFilter(event.detail)
		}
	});

	var node_5 = sibling(node_4, 2);
	const expression_1 = derived$1(() => get$1(modalOpen) === "items");

	FilterModalSubTypes(node_5, {
		thisType: 'Item',
		get config() {
			return $$props.filterConfig;
		},
		get open() {
			return get$1(expression_1);
		},
		$$events: {
			close: closeModal,
			change: (event) => updateFilter(event.detail)
		}
	});

	var node_6 = sibling(node_5, 2);
	const expression_2 = derived$1(() => get$1(modalOpen) === "folders");

	FilterModalFolders(node_6, {
		get config() {
			return $$props.filterConfig;
		},
		get open() {
			return get$1(expression_2);
		},
		$$events: {
			close: closeModal,
			change: (event) => updateFilter(event.detail)
		}
	});

	var node_7 = sibling(node_6, 2);
	const expression_3 = derived$1(() => get$1(modalOpen) === "packs");

	FilterModalPacks(node_7, {
		get config() {
			return $$props.filterConfig;
		},
		get open() {
			return get$1(expression_3);
		},
		$$events: {
			close: closeModal,
			change: (event) => updateFilter(event.detail)
		}
	});
	append($$anchor, section);
	pop();
}

var root_2$3 = template(`<span> </span>`);
var root_3 = template(`<span class="config-label svelte-1l0yva1"> </span>`);
var root_4 = template(`<button class="svelte-1l0yva1"><i class="fas fa-trash svelte-1l0yva1"></i></button>`);
var root_1$4 = template(`<div><i></i> <div class="main svelte-1l0yva1"><span> </span> <span class="hint svelte-1l0yva1"><span class="tag svelte-1l0yva1"> </span> <!> <!> </span></div> <div class="extra svelte-1l0yva1"><button class="svelte-1l0yva1"><i></i></button> <button class="svelte-1l0yva1"><i class="fas fa-clone svelte-1l0yva1"></i></button> <!></div></div>`);
var root$4 = template(`<section></section>`);

const $$css$5 = {
	hash: 'svelte-1l0yva1',
	code: '.hidden.svelte-1l0yva1 {display:none;}section.svelte-1l0yva1 {display:flex;height:100%;overflow:auto;flex-direction:column;padding:0.7em;}.filter.svelte-1l0yva1 {display:flex;border:2px solid var(--color-light-6);border-radius:10px;padding:0.5em;cursor:pointer;}.filter.svelte-1l0yva1:hover {color:var(--color-text-primary);border-color:var(--color-light-5);}.filter.svelte-1l0yva1:focus {outline:3px solid var(--color-warm-2);outline-offset:-3px;}.filter.disabled.svelte-1l0yva1 {opacity:0.8;border-style:dotted;pointer-events:all;}.main.svelte-1l0yva1 {word-wrap:break-word;display:flex;flex-wrap:wrap;flex-grow:1;}.hint.svelte-1l0yva1 {width:100%;}.extra.svelte-1l0yva1 {font-size:120%;flex:0 0 85px;display:flex;justify-content:space-around;align-items:center;}.extra.svelte-1l0yva1 button:where(.svelte-1l0yva1) {display:flex;height:24px;align-items:center;justify-content:center;cursor:pointer;width:24px;border:none;}.extra.svelte-1l0yva1 button:where(.svelte-1l0yva1) i:where(.svelte-1l0yva1) {margin:0;}.tag.svelte-1l0yva1 {background:var(--qiFilterAccent);color:#f0f0e0;border-radius:3px;padding:1px 2px;}.config-label.svelte-1l0yva1 {background-color:#0003;border-radius:4px;padding:0 4px;white-space:nowrap;margin-right:3px;}.filter-icon.svelte-1l0yva1 {display:flex;align-items:center;padding:0.4em;font-size:150%;opacity:0.9;}'
};

function FilterList($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$5);

	const [$$stores, $$cleanup] = setup_stores();
	const $filterStore = () => store_get(filterStore, '$filterStore', $$stores);
	let types = prop($$props, 'types', 19, () => []);
	const dispatch = createEventDispatcher();
	const select = (id) => () => dispatch("selectFilter", { id });

	function getIcon(filter) {
		switch (filter.type) {
			case FilterType.Client:
				return "fa-user";

			case FilterType.World:
				return "fa-globe";

			case FilterType.Default:
				return "fa-lock";
		}
	}

	function getTypeName(filter) {
		switch (filter.type) {
			case FilterType.Client:
				return mloc("FilterListFilterScopeClient");

			case FilterType.World:
				return mloc("FilterListFilterScopeWorld");

			case FilterType.Default:
				return mloc("FilterListFilterScopeDefault");
		}
	}

	function getFilterConfigLabels(filter) {
		const labels = Object.values(getLabels(filter.filterConfig));

		return labels.length ? labels : ["Unfiltered!"];
	}

	function getRoleName(role) {
		switch (role) {
			case CONST.USER_ROLES.PLAYER:
				return loc("USER.RolePlayer");

			case CONST.USER_ROLES.TRUSTED:
				return loc("USER.RoleTrusted");

			case CONST.USER_ROLES.ASSISTANT:
				return loc("USER.RoleAssistant");

			case CONST.USER_ROLES.GAMEMASTER:
				return loc("USER.RoleGamemaster");
		}
	}

	var section = root$4();
	let classes;

	each(section, 5, () => Object.values($filterStore()).reverse().filter((f) => types().includes(f.type)), (filter) => filter.id, ($$anchor, filter) => {
		var div = root_1$4();
		var event_handler = derived$1(() => select(get$1(filter).id));
		let classes_1;
		var i = child(div);
		var div_1 = sibling(i, 2);
		var span = child(div_1);
		var text = child(span);

		var span_1 = sibling(span, 2);
		var span_2 = child(span_1);
		var text_1 = child(span_2);

		var node = sibling(span_2, 2);

		{
			var consequent = ($$anchor) => {
				var span_3 = root_2$3();
				var text_2 = child(span_3);
				template_effect(($0) => set_text(text_2, $0), [() => getTypeName(get$1(filter))]);
				append($$anchor, span_3);
			};

			if_block(node, ($$render) => {
				if (get$1(filter).type === FilterType.Default) $$render(consequent);
			});
		}

		var node_1 = sibling(node, 2);

		each(node_1, 16, () => getFilterConfigLabels(get$1(filter)), (label) => label, ($$anchor, label) => {
			var span_4 = root_3();
			var text_3 = child(span_4);
			template_effect(() => set_text(text_3, label));
			append($$anchor, span_4);
		});

		var text_4 = sibling(node_1);

		var div_2 = sibling(div_1, 2);
		var button = child(div_2);
		var i_1 = child(button);

		var button_1 = sibling(button, 2);
		var node_2 = sibling(button_1, 2);

		{
			var consequent_1 = ($$anchor) => {
				var button_2 = root_4();

				template_effect(($0) => set_attribute(button_2, 'title', $0), [() => loc("Delete")]);
				event('click', button_2, preventDefault(stopPropagation(() => dispatch("delete", get$1(filter).id))));
				append($$anchor, button_2);
			};

			if_block(node_2, ($$render) => {
				if (get$1(filter).type !== FilterType.Default) $$render(consequent_1);
			});
		}

		template_effect(
			($0, $1, $2, $3, $4, $5) => {
				classes_1 = set_class(div, 1, 'filter svelte-1l0yva1', null, classes_1, $0);
				set_class(i, 1, `fas ${$1 ?? ''} filter-icon`, 'svelte-1l0yva1');
				set_attribute(i, 'title', $2);
				set_text(text, get$1(filter).subTitle);
				set_text(text_1, `@${get$1(filter).tag ?? ''}`);
				set_text(text_4, ` ${$3 ?? ''}`);
				set_attribute(button, 'title', $4);
				set_class(i_1, 1, `fas ${(get$1(filter).disabled ? 'fa-eye-slash' : 'fa-eye') ?? ''}`, 'svelte-1l0yva1');
				set_attribute(button_1, 'title', $5);
			},
			[
				() => ({ disabled: get$1(filter).disabled }),
				() => getIcon(get$1(filter)),
				() => getTypeName(get$1(filter)),
				() => get$1(filter).type === FilterType.World ? getRoleName(get$1(filter).role) : "",
				() => get$1(filter).disabled ? mloc("FilterListOptionEnable") : mloc("FilterListOptionDisable"),
				() => loc("Duplicate")
			]
		);

		event('click', button, preventDefault(stopPropagation(() => dispatch("toggle", get$1(filter).id))));
		event('click', button_1, preventDefault(stopPropagation(() => dispatch("clone", get$1(filter).id))));

		event('click', div, preventDefault(function (...$$args) {
			get$1(event_handler)?.apply(this, $$args);
		}));

		append($$anchor, div);
	});
	template_effect(($0) => classes = set_class(section, 1, 'standard-form svelte-1l0yva1', null, classes, $0), [() => ({ hidden: $$props.selected })]);
	append($$anchor, section);
	pop();
	$$cleanup();
}

var root_1$3 = template(`<label for="qi-f-role" title="qi-f-role" class="svelte-1mxknvd"> </label> <select name="qi-f-role" id="qi-f-role"><option> </option><option> </option><option> </option><option> </option></select>`, 1);
var root_2$2 = template(`<span class="svelte-1mxknvd"> <i class="fas fa-trash"></i></span>`);
var root$3 = template(`<header class="svelte-1mxknvd"><div class="basics svelte-1mxknvd"><label class="option-label svelte-1mxknvd" for="filter-keyword"> </label> <div class="filter-keyword svelte-1mxknvd"><span class="filter-prefix svelte-1mxknvd">@</span> <input type="text" name="filter-keyword" id="filter-keyword" pattern="[A-Za-z0-9\\._\\-]+" minlength="1" maxlength="36" class="svelte-1mxknvd"></div> <label class="option-label svelte-1mxknvd" for="filter-title"> </label> <input class="filter-title svelte-1mxknvd" type="text" name="filter-title" id="filter-title" minlength="1" maxlength="96"></div> <div class="settings svelte-1mxknvd"><!></div> <div class="extra svelte-1mxknvd"><span class="svelte-1mxknvd"> <i></i></span> <span class="svelte-1mxknvd"> <i class="fas fa-clone"></i></span> <!></div></header>`);

const $$css$4 = {
	hash: 'svelte-1mxknvd',
	code: 'header.svelte-1mxknvd {display:flex;flex-direction:row;gap:6px;}.basics.svelte-1mxknvd {flex:2;}.settings.svelte-1mxknvd {flex:1;}.filter-keyword.svelte-1mxknvd {display:flex;position:relative;}.filter-prefix.svelte-1mxknvd {position:absolute;top:50%;left:3px;transform:translateY(-50%);pointer-events:none;}.filter-keyword.svelte-1mxknvd,\n  .filter-title.svelte-1mxknvd {display:flex;line-height:24px;margin:0;}.filter-keyword.svelte-1mxknvd input:where(.svelte-1mxknvd) {padding-left:15px;}.filter-keyword.svelte-1mxknvd input:where(.svelte-1mxknvd):invalid {border:1px solid red;}.filter-keyword.svelte-1mxknvd input:where(.svelte-1mxknvd)::placeholder {color:#f0f0e0;opacity:0.5;}label.svelte-1mxknvd {display:block;flex-grow:1;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;}.extra.svelte-1mxknvd {display:flex;flex-direction:column;line-height:1.6em;}.extra.svelte-1mxknvd span:where(.svelte-1mxknvd) {text-align:right;cursor:pointer;}'
};

function FilterMetaHeader($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$4);

	const dispatch = createEventDispatcher();

	function changeTag(evt) {
		const target = evt.target;

		if (target?.value && target?.checkValidity()) {
			dispatch("tagChange", target.value);
		}
	}

	function changeSubTitle(evt) {
		const target = evt.target;

		if (target?.value) {
			dispatch("subTitleChange", target.value);
		}
	}

	function changeRole(evt) {
		const target = evt.target;

		if (target?.value) {
			dispatch("roleChange", parseInt(target.value));
		}
	}

	var header = root$3();
	var div = child(header);
	var label = child(div);
	var text = child(label);

	var div_1 = sibling(label, 2);
	var input = sibling(child(div_1), 2);

	var label_1 = sibling(div_1, 2);
	var text_1 = child(label_1);

	var input_1 = sibling(label_1, 2);

	var div_2 = sibling(div, 2);
	var node = child(div_2);

	{
		var consequent = ($$anchor) => {
			var fragment = root_1$3();
			var label_2 = first_child(fragment);
			var text_2 = child(label_2);

			var select = sibling(label_2, 2);
			var option = child(select);

			option.value = null == (option.__value = CONST.USER_ROLES.PLAYER) ? '' : CONST.USER_ROLES.PLAYER;

			var text_3 = child(option);

			var option_1 = sibling(option);

			option_1.value = null == (option_1.__value = CONST.USER_ROLES.TRUSTED) ? '' : CONST.USER_ROLES.TRUSTED;

			var text_4 = child(option_1);

			var option_2 = sibling(option_1);

			option_2.value = null == (option_2.__value = CONST.USER_ROLES.ASSISTANT) ? '' : CONST.USER_ROLES.ASSISTANT;

			var text_5 = child(option_2);

			var option_3 = sibling(option_2);

			option_3.value = null == (option_3.__value = CONST.USER_ROLES.GAMEMASTER) ? '' : CONST.USER_ROLES.GAMEMASTER;

			var text_6 = child(option_3);

			template_effect(
				($0, $1, $2, $3, $4) => {
					set_text(text_2, $0);
					set_selected(option, $$props.filter.role === CONST.USER_ROLES.PLAYER);
					set_text(text_3, $1);
					set_selected(option_1, $$props.filter.role === CONST.USER_ROLES.TRUSTED);
					set_text(text_4, $2);
					set_selected(option_2, $$props.filter.role === CONST.USER_ROLES.ASSISTANT);
					set_text(text_5, $3);
					set_selected(option_3, $$props.filter.role === CONST.USER_ROLES.GAMEMASTER);
					set_text(text_6, $4);
				},
				[
					() => mloc("FilterListHeaderUserRole"),
					() => loc("USER.RolePlayer"),
					() => loc("USER.RoleTrusted"),
					() => loc("USER.RoleAssistant"),
					() => loc("USER.RoleGamemaster")
				]
			);

			event('change', select, changeRole);
			append($$anchor, fragment);
		};

		if_block(node, ($$render) => {
			if ($$props.filter.type === FilterType.World) $$render(consequent);
		});
	}

	var div_3 = sibling(div_2, 2);
	var span = child(div_3);
	var text_7 = child(span);
	var i = sibling(text_7);

	var span_1 = sibling(span, 2);
	var text_8 = child(span_1);

	var node_1 = sibling(span_1, 2);

	{
		var consequent_1 = ($$anchor) => {
			var span_2 = root_2$2();
			var text_9 = child(span_2);
			template_effect(($0) => set_text(text_9, `${$0 ?? ''} `), [() => loc("Delete")]);
			event('click', span_2, () => dispatch("delete", $$props.filter.id));
			append($$anchor, span_2);
		};

		if_block(node_1, ($$render) => {
			if ($$props.filter.type !== FilterType.Default) $$render(consequent_1);
		});
	}

	template_effect(
		($0, $1, $2, $3, $4, $5) => {
			set_text(text, $0);
			set_value(input, $$props.filter.tag);
			set_attribute(input, 'placeholder', $1);
			input.readOnly = $$props.filter.type === FilterType.Default;
			set_text(text_1, $2);
			set_value(input_1, $$props.filter.subTitle);
			set_attribute(input_1, 'placeholder', $3);
			input_1.readOnly = $$props.filter.type === FilterType.Default;
			set_text(text_7, `${$4 ?? ''} `);
			set_class(i, 1, `fas ${($$props.filter.disabled ? 'fa-eye-slash' : 'fa-eye') ?? ''}`);
			set_text(text_8, `${$5 ?? ''} `);
		},
		[
			() => mloc("FilterListHeaderTag"),
			() => mloc("FilterListFilterTagPlaceholder"),
			() => mloc("FilterListHeaderTitle"),
			() => mloc("FilterListFilterTitlePlaceholder"),
			() => $$props.filter.disabled ? mloc("FilterListOptionEnable") : mloc("FilterListOptionDisable"),
			() => loc("Duplicate")
		]
	);

	event('change', input, changeTag);
	event('change', input_1, changeSubTitle);
	event('click', span, () => dispatch("toggle", $$props.filter.id));
	event('click', span_1, () => dispatch("clone", $$props.filter.id));
	append($$anchor, header);
	pop();
}

function newDialog(original, createdCallback, type = FilterType.World) {
    new Dialog({
        title: original
            ? mloc("FilterListDuplicateFilterTitle", { original: original.tag })
            : mloc("FilterListNewFilterTitle"),
        content: `
        <div class="new-filter-name">
          @<input type="text" name="name" id="name" value="" placeholder="${mloc("FilterListFilterTagPlaceholder")}" pattern="[A-Za-z0-9\\._\\-]+" minlength="1" maxlength="36">
        </div>
      `,
        buttons: {
            apply: {
                icon: "<i class='fas fa-plus'></i>",
                label: mloc("FilterListCreateFilter"),
                callback: async (html) => {
                    if (!("find" in html))
                        return;
                    const input = html.find("input");
                    const val = html.find("input").val();
                    if (input.get(0)?.checkValidity() && val !== "") {
                        const newId = createFilter(val, type, original);
                        setTimeout(() => createdCallback?.(newId), 0);
                    }
                    else {
                        ui.notifications?.error(`Incorrect filter tag: "${val}"`);
                    }
                },
            },
        },
        default: "apply",
        close: () => {
            return;
        },
    }).render(true);
}
function deleteDialog(filter, deleteCallback) {
    new Dialog({
        title: `Delete filter ${filter.tag}`,
        content: `<p>Delete filter <strong>@${filter.tag} - ${filter.subTitle}</strong> permanently?</p>`,
        buttons: {
            delete: {
                icon: '<i class="fas fa-trash"></i>',
                label: "Delete",
                callback: () => {
                    deleteCallback?.();
                    deleteFilter(filter.id);
                },
            },
            cancel: {
                label: "Cancel",
                callback: () => {
                    return;
                },
            },
        },
        default: "delete",
    }).render(true);
}

var root_1$2 = template(`<header class="svelte-18xoz93"><h3 class="svelte-18xoz93"><i class="fas fa-chevron-left svelte-18xoz93"></i> </h3> <!></header> <section class="svelte-18xoz93"><main class="svelte-18xoz93"><!></main> <aside class="search-app-container svelte-18xoz93"><span class="try-me svelte-18xoz93"> <i class="fas fa-hand-point-down"></i></span> <!></aside></section>`, 1);
var root_2$1 = template(`<i class="fas fa-plus"></i> `, 1);
var root$2 = template(`<div role="tabpanel"><!> <div> <p> </p></div> <!> <menu><!></menu> <menu><div class="subtypes svelte-18xoz93"> <label class="svelte-18xoz93"><input type="checkbox" name="qi.includeDefaultType" id="includeDefaultType"> Types</label> <label class="svelte-18xoz93"><input type="checkbox" name="qi.includeDefaultSubtype" id="includeDefaultSubtype"> Subtypes</label> <label class="svelte-18xoz93"><input type="checkbox" name="qi.includeDefaultPack" id="includeDefaultPack"> Compendiums</label></div></menu></div>`);

const $$css$3 = {
	hash: 'svelte-18xoz93',
	code: '.header.svelte-18xoz93 {margin:0;padding:0.6em;border-bottom:2px solid #444;flex:auto;}label.svelte-18xoz93 {display:flex;align-items:center;white-space:nowrap;}.filters-tab.svelte-18xoz93 {height:100%;overflow:hidden;display:flex;flex-direction:column;}.hidden.svelte-18xoz93 {display:none;}header.svelte-18xoz93 {width:100%;padding:0.4em 0.7em;border-bottom:2px solid #333;background:rgba(0, 0, 0, 0.1);}h3.svelte-18xoz93 {border:none;margin:0;display:flex;align-items:center;padding:0.1em 0;color:var(--color-text-primary);text-shadow:none;width:fit-content;}section.svelte-18xoz93 {width:100%;display:flex;overflow:auto;flex-grow:1;}aside.svelte-18xoz93 {padding:0.4em;width:350px;border-left:1px solid rgba(0, 0, 0, 0.3);overflow:auto;flex-shrink:0;}aside.svelte-18xoz93 .search-app {border:1px solid #493a50;border-radius:6px;}main.svelte-18xoz93 {flex-grow:1;padding:0.4em;min-width:300px;max-width:calc(100% - 200px);display:flex;flex-direction:column;}.search-app-container.svelte-18xoz93 {display:flex;flex-direction:column;justify-content:end;}.try-me.svelte-18xoz93 {text-align:center;opacity:0.9;padding:0.5em;}menu.svelte-18xoz93 {display:flex;margin:0;padding:0.2em 1em;}.subtypes.svelte-18xoz93 {width:100%;display:flex;align-items:center;justify-content:center;white-space:nowrap;}.fa-chevron-left.svelte-18xoz93 {cursor:pointer;display:flex;align-items:center;width:25px;}'
};

function FiltersTab($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$3);

	const [$$stores, $$cleanup] = setup_stores();
	const $filterStore = () => store_get(filterStore, '$filterStore', $$stores);
	const $defaultsType = () => store_get(get$1(defaultsType), '$defaultsType', $$stores);
	const $defaultsSubtype = () => store_get(get$1(defaultsSubtype), '$defaultsSubtype', $$stores);
	const $defaultsPack = () => store_get(get$1(defaultsPack), '$defaultsPack', $$stores);
	let active = prop($$props, 'active', 3, false);
	let selectedId = state(void 0);
	let filter = derived$1(() => get$1(selectedId) && $filterStore()[get$1(selectedId)]);
	let defaultsType = derived$1(() => stores[ModuleSetting.FILTERS_ADD_DEFAULT_TYPE]);
	let defaultsSubtype = derived$1(() => stores[ModuleSetting.FILTERS_ADD_DEFAULT_SUBTYPE]);
	let defaultsPack = derived$1(() => stores[ModuleSetting.FILTERS_ADD_DEFAULT_PACKS]);

	function toggleDefaults(setting) {
		setSetting(setting, !getSetting(setting));
	}

	function selectFilter(event) {
		const { id } = event.detail;

		set(selectedId, proxy(id));
	}

	function clone(evt) {
		newDialog($filterStore()[evt.detail], (newId) => set(selectedId, proxy(newId)));
	}

	function toggle(evt) {
		toggleFilter(evt.detail);
	}

	function deleteId(evt) {
		deleteDialog($filterStore()[evt.detail], () => {
			if (evt.detail === get$1(selectedId)) set(selectedId, undefined);
		});
	}

	function onConfigChange(evt) {
		if (!get$1(filter) || get$1(filter).type === FilterType.Default) return;
		get$1(filter).filterConfig = evt.detail;
		updateFilter(get$1(filter));
	}

	function newFilter() {
		newDialog(undefined, (newId) => {
			set(selectedId, proxy(newId));
		});
	}

	function changeSubTitle(evt) {
		if (get$1(filter) && get$1(filter).type !== FilterType.Default) updateFilter({ ...get$1(filter), subTitle: evt.detail });
	}

	function changeTag(evt) {
		if (get$1(filter) && get$1(filter).type !== FilterType.Default) updateFilter({ ...get$1(filter), tag: evt.detail });
	}

	function changeRole(evt) {
		if (get$1(filter) && get$1(filter).type !== FilterType.Default) updateFilter({ ...get$1(filter), role: evt.detail });
	}

	var div = root$2();
	let classes;
	var node = child(div);

	{
		var consequent = ($$anchor) => {
			var fragment = root_1$2();
			var header = first_child(fragment);
			var h3 = child(header);
			var text = sibling(child(h3));

			var node_1 = sibling(h3, 2);

			FilterMetaHeader(node_1, {
				get filter() {
					return get$1(filter);
				},
				$$events: {
					clone,
					toggle,
					delete: deleteId,
					subTitleChange: changeSubTitle,
					tagChange: changeTag,
					roleChange: changeRole
				}
			});

			var section = sibling(header, 2);
			var main = child(section);
			var node_2 = child(main);

			FilterEditor(node_2, {
				get filterConfig() {
					return get$1(filter).filterConfig;
				},
				$$events: { change: onConfigChange }
			});

			var aside = sibling(main, 2);
			var span = child(aside);
			var text_1 = child(span);

			var node_3 = sibling(span, 2);

			SearchApp(node_3, {
				get filter() {
					return get$1(filter);
				},
				embedded: true
			});

			template_effect(
				($0) => {
					set_text(text, ` @${get$1(filter)?.tag ?? ''}`);
					set_text(text_1, `${$0 ?? ''} `);
				},
				[() => mloc("FilterEditorTryMe")]
			);

			event('click', h3, () => set(selectedId, undefined));
			append($$anchor, fragment);
		};

		if_block(node, ($$render) => {
			if (get$1(filter)) $$render(consequent);
		});
	}

	var div_1 = sibling(node, 2);
	let classes_1;
	var text_2 = child(div_1);
	var p = sibling(text_2);
	var text_3 = child(p);

	var node_4 = sibling(div_1, 2);
	const expression = derived$1(() => [FilterType.World, FilterType.Default]);

	FilterList(node_4, {
		get selected() {
			return get$1(selectedId);
		},
		get types() {
			return get$1(expression);
		},
		$$events: {
			selectFilter,
			clone,
			toggle,
			delete: deleteId
		}
	});

	var menu = sibling(node_4, 2);
	let classes_2;
	var node_5 = child(menu);

	NiceButton(node_5, {
		round: true,
		$$events: { click: newFilter },
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_2$1();
			var text_4 = sibling(first_child(fragment_1));

			template_effect(($0) => set_text(text_4, ` ${$0 ?? ''}`), [() => mloc("FilterListCreateFilter")]);
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	var menu_1 = sibling(menu, 2);
	let classes_3;
	var div_2 = child(menu_1);
	var text_5 = child(div_2);
	var label = sibling(text_5);
	var input = child(label);

	var label_1 = sibling(label, 2);
	var input_1 = child(label_1);

	var label_2 = sibling(label_1, 2);
	var input_2 = child(label_2);

	template_effect(
		($0, $1, $2, $3, $4, $5, $6) => {
			classes = set_class(div, 1, 'filters-tab svelte-18xoz93', null, classes, $0);
			classes_1 = set_class(div_1, 1, 'header notes svelte-18xoz93', null, classes_1, $1);
			set_text(text_2, `${$2 ?? ''} `);
			set_text(text_3, $3);
			classes_2 = set_class(menu, 1, 'svelte-18xoz93', null, classes_2, $4);
			classes_3 = set_class(menu_1, 1, 'svelte-18xoz93', null, classes_3, $5);
			set_text(text_5, `${$6 ?? ''} `);
			set_checked(input, $defaultsType());
			set_checked(input_1, $defaultsSubtype());
			set_checked(input_2, $defaultsPack());
		},
		[
			() => ({ hidden: !active() }),
			() => ({ hidden: get$1(selectedId) }),
			() => mloc("FilterListHeader"),
			() => mloc("FilterListGlobalNotes"),
			() => ({ hidden: get$1(selectedId) }),
			() => ({ hidden: get$1(selectedId) }),
			() => mloc("FilterListDefaultFilterSectionTitle")
		]
	);

	event('change', input, () => toggleDefaults(ModuleSetting.FILTERS_ADD_DEFAULT_TYPE));
	event('change', input_1, () => toggleDefaults(ModuleSetting.FILTERS_ADD_DEFAULT_SUBTYPE));
	event('change', input_2, () => toggleDefaults(ModuleSetting.FILTERS_ADD_DEFAULT_PACKS));
	append($$anchor, div);
	pop();
	$$cleanup();
}

var root_1$1 = template(`<header class="svelte-122qgpi"><h3 class="svelte-122qgpi"><i class="fas fa-chevron-left svelte-122qgpi"></i> </h3> <!></header> <section class="svelte-122qgpi"><main class="svelte-122qgpi"><!></main> <aside class="search-app-container svelte-122qgpi"><span class="try-me svelte-122qgpi"> <i class="fas fa-hand-point-down"></i></span> <!></aside></section>`, 1);
var root_2 = template(`<i class="fas fa-plus"></i> `, 1);
var root$1 = template(`<div role="tabpanel"><!> <div> <p> </p></div> <!> <menu><!></menu></div>`);

const $$css$2 = {
	hash: 'svelte-122qgpi',
	code: '.header.svelte-122qgpi {margin:0;padding:0.6em;border-bottom:2px solid #444;flex:auto;}.filters-tab.svelte-122qgpi {height:100%;overflow:hidden;display:flex;flex-direction:column;}.hidden.svelte-122qgpi {display:none;}header.svelte-122qgpi {width:100%;padding:0.4em 0.7em;border-bottom:2px solid #333;background:rgba(0, 0, 0, 0.1);}h3.svelte-122qgpi {border:none;margin:0;display:flex;align-items:center;padding:0.1em 0;color:var(--color-text-primary);text-shadow:none;width:fit-content;}section.svelte-122qgpi {width:100%;display:flex;overflow:auto;flex-grow:1;}aside.svelte-122qgpi {padding:0.4em;width:350px;border-left:1px solid rgba(0, 0, 0, 0.3);overflow:auto;flex-shrink:0;}aside.svelte-122qgpi .search-app {border:1px solid #493a50;border-radius:6px;}main.svelte-122qgpi {flex-grow:1;padding:0.4em;max-width:calc(100% - 200px);display:flex;flex-direction:column;}.search-app-container.svelte-122qgpi {display:flex;flex-direction:column;justify-content:end;}.try-me.svelte-122qgpi {text-align:center;opacity:0.9;padding:0.5em;}menu.svelte-122qgpi {display:flex;margin:0;padding:0.2em 1em;}.fa-chevron-left.svelte-122qgpi {cursor:pointer;display:flex;align-items:center;width:25px;}'
};

function ClientFiltersTab($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$2);

	const [$$stores, $$cleanup] = setup_stores();
	const $filterStore = () => store_get(filterStore, '$filterStore', $$stores);
	let active = prop($$props, 'active', 3, false);
	let selectedId = state(void 0);
	let filter = derived$1(() => get$1(selectedId) && $filterStore()[get$1(selectedId)]);

	function selectFilter(event) {
		const { id } = event.detail;

		set(selectedId, proxy(id));
	}

	function clone(evt) {
		newDialog($filterStore()[evt.detail], (newId) => set(selectedId, proxy(newId)), FilterType.Client);
	}

	function toggle(evt) {
		toggleFilter(evt.detail);
	}

	function deleteId(evt) {
		deleteDialog($filterStore()[evt.detail], () => {
			if (evt.detail === get$1(selectedId)) set(selectedId, undefined);
		});
	}

	function onConfigChange(evt) {
		if (!get$1(filter) || get$1(filter).type === FilterType.Default) return;
		get$1(filter).filterConfig = evt.detail;
		updateFilter(get$1(filter));
	}

	function newFilter() {
		newDialog(
			undefined,
			(newId) => {
				set(selectedId, proxy(newId));
			},
			FilterType.Client
		);
	}

	function changeSubTitle(evt) {
		if (get$1(filter) && get$1(filter).type !== FilterType.Default) updateFilter({ ...get$1(filter), subTitle: evt.detail });
	}

	function changeTag(evt) {
		if (get$1(filter) && get$1(filter).type !== FilterType.Default) updateFilter({ ...get$1(filter), tag: evt.detail });
	}

	function changeRole(evt) {
		if (get$1(filter) && get$1(filter).type !== FilterType.Default) updateFilter({ ...get$1(filter), role: evt.detail });
	}

	var div = root$1();
	let classes;
	var node = child(div);

	{
		var consequent = ($$anchor) => {
			var fragment = root_1$1();
			var header = first_child(fragment);
			var h3 = child(header);
			var text = sibling(child(h3));

			var node_1 = sibling(h3, 2);

			FilterMetaHeader(node_1, {
				get filter() {
					return get$1(filter);
				},
				$$events: {
					clone,
					toggle,
					delete: deleteId,
					subTitleChange: changeSubTitle,
					tagChange: changeTag,
					roleChange: changeRole
				}
			});

			var section = sibling(header, 2);
			var main = child(section);
			var node_2 = child(main);

			FilterEditor(node_2, {
				get filterConfig() {
					return get$1(filter).filterConfig;
				},
				$$events: { change: onConfigChange }
			});

			var aside = sibling(main, 2);
			var span = child(aside);
			var text_1 = child(span);

			var node_3 = sibling(span, 2);

			SearchApp(node_3, {
				get filter() {
					return get$1(filter);
				},
				embedded: true
			});

			template_effect(
				($0) => {
					set_text(text, ` @${get$1(filter)?.tag ?? ''}`);
					set_text(text_1, `${$0 ?? ''} `);
				},
				[() => mloc("FilterEditorTryMe")]
			);

			event('click', h3, () => set(selectedId, undefined));
			append($$anchor, fragment);
		};

		if_block(node, ($$render) => {
			if (get$1(filter)) $$render(consequent);
		});
	}

	var div_1 = sibling(node, 2);
	let classes_1;
	var text_2 = child(div_1);
	var p = sibling(text_2);
	var text_3 = child(p);

	var node_4 = sibling(div_1, 2);
	const expression = derived$1(() => [FilterType.Client]);

	FilterList(node_4, {
		get selected() {
			return get$1(selectedId);
		},
		get types() {
			return get$1(expression);
		},
		$$events: {
			selectFilter,
			clone,
			toggle,
			delete: deleteId
		}
	});

	var menu = sibling(node_4, 2);
	let classes_2;
	var node_5 = child(menu);

	NiceButton(node_5, {
		round: true,
		$$events: { click: newFilter },
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_2();
			var text_4 = sibling(first_child(fragment_1));

			template_effect(($0) => set_text(text_4, ` ${$0 ?? ''}`), [() => mloc("FilterListCreateClientFilter")]);
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});

	template_effect(
		($0, $1, $2, $3, $4) => {
			classes = set_class(div, 1, 'filters-tab svelte-122qgpi', null, classes, $0);
			classes_1 = set_class(div_1, 1, 'header notes svelte-122qgpi', null, classes_1, $1);
			set_text(text_2, `${$2 ?? ''} `);
			set_text(text_3, $3);
			classes_2 = set_class(menu, 1, 'svelte-122qgpi', null, classes_2, $4);
		},
		[
			() => ({ hidden: !active() }),
			() => ({ hidden: get$1(selectedId) }),
			() => mloc("FilterListHeader"),
			() => mloc("FilterListClientNotes"),
			() => ({ hidden: get$1(selectedId) })
		]
	);

	append($$anchor, div);
	pop();
	$$cleanup();
}

var root_1 = template(`<button role="tab" tabindex="0"><span><i></i> </span></button>`);
var root = template(`<nav class="tabs svelte-1k9pdje"></nav> <section class="svelte-1k9pdje"><!> <!> <!> <!> <!></section>`, 1);

const $$css$1 = {
	hash: 'svelte-1k9pdje',
	code: 'nav.tabs.svelte-1k9pdje {margin:0;padding:0;line-height:2.6;align-items:stretch;gap:0;border:none;}nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje) i:where(.svelte-1k9pdje) {font-size:inherit;}nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje) {color:var(--color-text-primary);display:block;background-color:rgba(0, 0, 0, 0.06);transition:border-color 300ms ease-out,\n      background-color 100ms ease-out;flex-grow:1;margin:0;border:none;border-radius:0;border-bottom:2px solid rgba(0, 0, 0, 0.1);cursor:pointer;}nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje):hover,\n  nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje):active,\n  nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje):focus,\n  nav.tabs.svelte-1k9pdje .item.active:where(.svelte-1k9pdje) {box-shadow:none !important;text-shadow:none;outline:none;border-color:rgba(0, 0, 0, 0.5);color:var(--color-text-primary);}nav.tabs.svelte-1k9pdje .item.active:where(.svelte-1k9pdje) {background-color:transparent;border-color:var(--color-warm-2);text-shadow:none;}nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje):hover,\n  nav.tabs.svelte-1k9pdje .item:where(.svelte-1k9pdje):focus {background:rgba(255, 255, 255, 0.05);}section.svelte-1k9pdje {display:flex;flex-direction:column;overflow:auto;flex-grow:1;position:relative;}'
};

function SettingsPage($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css$1);

	const tabs = [
		{
			id: "gm",
			title: "SettingsMenuTabGlobal",
			icon: "fas fa-globe",
			hide: !game.user?.isGM
		},
		{
			id: "user",
			title: "SettingsMenuTabUser",
			icon: "fas fa-user"
		},
		{
			id: "indexing",
			title: "SettingsMenuTabIndexing",
			icon: "fas fa-search",
			hide: !game.user?.isGM
		},
		{
			id: "filters",
			title: "SettingsMenuTabFilters",
			icon: "fas fa-filter",
			hide: !game.user?.isGM
		},
		{
			id: "client-filters",
			title: "SettingsMenuTabClientFilters",
			icon: "fas fa-filter"
		}
	].filter((tab) => !tab.hide);

	let selectedTab = state(proxy(tabs[0].id));
	const selectTab = (tabId) => () => set(selectedTab, proxy(tabId));
	var fragment = root();
	var nav = first_child(fragment);

	each(nav, 21, () => tabs, index, ($$anchor, tab) => {
		var button = root_1();
		var event_handler = derived$1(() => selectTab(get$1(tab).id));
		let classes;
		var span = child(button);
		let classes_1;
		var i = child(span);
		var text = sibling(i);

		template_effect(
			($0, $1, $2) => {
				set_attribute(button, 'aria-selected', get$1(selectedTab) === get$1(tab).id);
				classes = set_class(button, 1, 'item svelte-1k9pdje', null, classes, $0);
				classes_1 = set_class(span, 1, 'tab-link', null, classes_1, $1);
				set_class(i, 1, clsx(get$1(tab).icon), 'svelte-1k9pdje');
				set_text(text, ` ${$2 ?? ''}`);
			},
			[
				() => ({
					active: get$1(selectedTab) === get$1(tab).id
				}),
				() => ({
					active: get$1(selectedTab) === get$1(tab).id
				}),
				() => mloc(get$1(tab).title)
			]
		);

		event('click', button, preventDefault(function (...$$args) {
			get$1(event_handler)?.apply(this, $$args);
		}));

		append($$anchor, button);
	});

	var section = sibling(nav, 2);
	var node = child(section);
	const expression = derived$1(() => get$1(selectedTab) === "gm");

	GmTab(node, {
		get active() {
			return get$1(expression);
		}
	});

	var node_1 = sibling(node, 2);
	const expression_1 = derived$1(() => get$1(selectedTab) === "user");

	UserTab(node_1, {
		get active() {
			return get$1(expression_1);
		}
	});

	var node_2 = sibling(node_1, 2);
	const expression_2 = derived$1(() => get$1(selectedTab) === "indexing");

	IndexingTab(node_2, {
		get active() {
			return get$1(expression_2);
		}
	});

	var node_3 = sibling(node_2, 2);
	const expression_3 = derived$1(() => get$1(selectedTab) === "filters");

	FiltersTab(node_3, {
		get active() {
			return get$1(expression_3);
		}
	});

	var node_4 = sibling(node_3, 2);
	const expression_4 = derived$1(() => get$1(selectedTab) === "client-filters");

	ClientFiltersTab(node_4, {
		get active() {
			return get$1(expression_4);
		}
	});
	append($$anchor, fragment);
	pop();
}

const AppV2$1 = foundry.applications.api.ApplicationV2;
class SettingsApp extends AppV2$1 {
    static DEFAULT_OPTIONS = {
        id: "qi-settings-app",
        window: {
            title: "QUICKINSERT.SettingsMenuLabel",
            contentTag: "section",
            frame: true,
            positioned: true,
            minimizable: true,
            resizable: true,
        },
        position: {
            width: 750,
            height: 600,
        },
    };
    #unmount;
    constructor(options = {}) {
        super(options);
    }
    _onClose() {
        if (this.#unmount) {
            unmount(this.#unmount, { outro: false });
        }
    }
    async _renderFrame(options) {
        const frame = await super._renderFrame(options);
        const settingsLabel = mloc("AboutTitle");
        const openAboutPage = `<button type="button" class="header-control icon fa-solid fa-circle-info" data-action="openAboutPage"
                          data-tooltip="${settingsLabel}" aria-label="${settingsLabel}"></button>`;
        this.window?.close?.insertAdjacentHTML("beforebegin", openAboutPage);
        return frame;
    }
    _onClickAction(event, target) {
        const action = target.dataset.action;
        if (action === "openAboutPage") {
            openAboutApp();
        }
    }
    async _renderHTML() {
        return "";
    }
    _replaceHTML(result, content) {
        this.#unmount = mount(SettingsPage, { target: content });
    }
}
function openSettingsApp() {
    const app = new SettingsApp();
    return app.render(true);
}

const $$css = { hash: 'svelte-3kpd', code: '' };

function FilterPopup($$anchor, $$props) {
	push($$props, true);
	append_styles($$anchor, $$css);

	FilterEditor($$anchor, {
		get filterConfig() {
			return $$props.filter.filterConfig;
		},
		$$events: {
			change($$arg) {
				bubble_event.call(this, $$props, $$arg);
			}
		}
	});

	pop();
}

/* FilterPopupApp.svelte.ts generated by Svelte v5.23.2 */

const AppV2 = foundry.applications.api.ApplicationV2;
const WINDOW_WIDTH = 400;
const WINDOW_MARGIN = 5;

class FilterPopupApp extends AppV2 {
	static DEFAULT_OPTIONS = {
		id: "qi-filter-popup{id}",
		classes: ["application", "qi-filter-popup-app"],
		window: {
			title: "QUICKINSERT.FilterPopupTitle",
			frame: true,
			positioned: true,
			minimizable: true,
			resizable: true,
			content: false
		}
	};

	static get windowHeight() {
		return window.innerHeight / 2 + 30;
	}

	#unmount;
	#filter;
	#onChange;
	#onClose;
	#props = state(proxy({ filter: makeEmptyFilter() }));

	get props() {
		return get$1(this.#props);
	}

	set props(value) {
		set(this.#props, proxy(value));
	}

	constructor(filter, onChange, onClose, position) {
		const left = position?.left || window.innerWidth / 2 + 250;
		const top = position?.top || WINDOW_MARGIN;

		const options = {
			position: {
				top,
				left,
				width: 400,
				height: FilterPopupApp.windowHeight,
				scale: 1,
				zIndex: _maxZ
			}
		};

		super(options);
		this.#filter = filter;
		this.#onChange = onChange;
		this.#onClose = onClose;
	}

	_onClose() {
		this.#onClose();

		if (this.#unmount) {
			unmount(this.#unmount, { outro: false });
		}
	}

	async _renderHTML() {
		return "";
	}

	_replaceHTML(result, content) {
		this.props.filter = this.#filter;

		this.#unmount = mount(FilterPopup, {
			target: content,
			props: this.props,
			events: {
				close: () => this.close(),
				change: (event) => {
					const modifiedFilter = { ...this.#filter, filterConfig: event.detail };

					this.props.filter = modifiedFilter;
					this.#onChange(modifiedFilter);
				}
			}
		});
	}
}

async function openFilterPopup(filter, onChange, onClose, position) {
	const rightEdge = position.right + WINDOW_MARGIN;
	const leftEdge = position.left - WINDOW_WIDTH - WINDOW_MARGIN;
	const left = rightEdge + WINDOW_WIDTH + WINDOW_MARGIN * 2 > screen.width ? leftEdge : rightEdge;
	const top = position.bottom - FilterPopupApp.windowHeight;
	const app = new FilterPopupApp(filter, onChange, onClose, { left, top });

	await app.render(true);
	return app;
}

function createToggle(item) {
    return [
        // Enabled
        { ...item, icon: '<i class="fa-solid fa-check"></i>' },
        // Disabled
        {
            ...item,
            icon: '<i class="fa-solid"></i>',
            condition: (v) => typeof item.condition === "function" ? !item.condition(v) : false,
        },
    ];
}

/* SearchAppShell.svelte.ts generated by Svelte v5.23.2 */

class SearchAppShell {
	#savedPositon;
	#unmount;
	#filterEditor;
	#densitySub;
	// Rendering
	#rootElement;
	rendered = false;
	visible = false;
	rememberedText = "";
	rememberedFilter = undefined;
	attachedContext = null;

	get element() {
		return this.#rootElement?.firstElementChild || undefined;
	}

	#props = state(proxy({ context: undefined, filter: undefined }));

	get props() {
		return get$1(this.#props);
	}

	set props(value) {
		set(this.#props, proxy(value));
	}

	// Moving window state
	#moveInitial = { x: 0, y: 0, width: 0 };
	#movePosisition = { left: 0, bottom: 0 };

	// On mouse down, retain focus.
	#retainFocus() {
		const element = document.activeElement;

		if (element?.isConnected && element?.closest(".search-editable-input")) {
			setTimeout(() => element && element.focus());
		}
	}

	// Dragging search results
	#dragStart = (event) => {
		if (event.target?.closest(".quick-insert-result")) {
			this.#rootElement?.classList.add("dragging");
		}
	};

	#dragEnd = () => {
		this.#rootElement?.classList.remove("dragging");
	};

	#drop = (event) => {
		if (event.target?.closest(".quick-insert-app")) {
			return;
		}

		if (this.#rootElement?.classList.contains("dragging")) {
			this.#rootElement.classList.remove("dragging");

			if (!event.shiftKey) {
				this.close();
			}
		}
	};

	// Drag-move window drop/end
	#moveEnd = (event) => {
		event?.stopPropagation();
		event?.stopImmediatePropagation();
		window.removeEventListener("pointermove", this.#move);
		window.removeEventListener("pointerup", this.#moveEnd);

		if (this.#rootElement) {
			const position = {
				left: parseFloat(this.#rootElement.style.left),
				bottom: parseFloat(this.#rootElement.style.bottom)
			};

			if (this.attachedContext?.mode !== ContextMode.Insert) {
				this.#savedPositon = position;
			}
		}
	};

	// Drag-move window moving
	#move = (event) => {
		if (!this.#rootElement) {
			this.#moveEnd();
			return;
		}

		const diff = {
			x: event.clientX - this.#moveInitial.x,
			y: event.clientY - this.#moveInitial.y
		};

		const newPos = {
			left: this.#movePosisition.left + diff.x,
			bottom: this.#movePosisition.bottom - diff.y
		};

		this.setPosition(newPos);
	};

	// Drag-move window start
	#moveStart = (event) => {
		this.#retainFocus();

		if (!this.#rootElement) {
			return;
		}

		const rect = this.#rootElement.getBoundingClientRect();

		this.#moveInitial = {
			x: event.clientX,
			y: event.clientY,
			width: rect.width
		};

		this.#movePosisition = {
			left: rect.left,
			bottom: window.innerHeight - rect.bottom
		};

		window.addEventListener("pointermove", this.#move);
		window.addEventListener("pointerup", this.#moveEnd);
	};

	// TODO: Add persistence
	setPosition({ left, bottom }) {
		if (!this.#rootElement) {
			return;
		}

		left = Math.min(Math.max(left, 0), window.innerWidth - this.#moveInitial.width);
		bottom = Math.min(Math.max(bottom, 0), window.innerHeight - 150);
		this.#rootElement.style.left = `${left}px`;
		this.#rootElement.style.bottom = `${bottom}px`;
		this.#rootElement.style.maxHeight = `min(${window.innerHeight - bottom}px, calc(50vh + var(--input-height)))`;

		const tooltips = left !== undefined && left < 450 ? "RIGHT" : "LEFT";

		this.props.tooltips = tooltips;
	}

	async render(options) {
		if (this.rendered) {
			return;
		}

		if (options && options.context) {
			this.attachedContext = options.context;
		} else {
			// Try to infer context
			const target = document.activeElement;

			if (target) {
				this.attachedContext = identifyContext(target);
			}
		}

		this.renderContents();
	}

	close() {
		if (this.#filterEditor) {
			this.#filterEditor.close();
			this.#filterEditor = undefined;
		}

		this.attachedContext?.onClose?.();
		game.tooltip.deactivate();
		// Clear drag listeners
		document.removeEventListener("dragstart", this.#dragStart);
		document.removeEventListener("dragend", this.#dragEnd);
		document.removeEventListener("drop", this.#drop);

		if (this.#unmount) {
			unmount(this.#unmount, { outro: true }).then(() => {
				this.rendered = false;
				this.visible = false;

				if (this.#rootElement) {
					this.#rootElement.style.display = "none";
				}
			});
		}
	}

	async openFilterEditor(filter) {
		filter = filter || makeEmptyFilter();

		if (!this.#filterEditor) {
			this.props.filterEditorOpen = true;

			this.#filterEditor = await openFilterPopup(
				filter,
				(changedFilter) => this.props.filter = changedFilter,
				() => {
					this.#filterEditor = undefined;
					this.props.filterEditorOpen = false;
				},
				this.#rootElement.getBoundingClientRect()
			);
		}
	}

	closeFilterEditor() {
		this.#filterEditor?.close();
		this.#filterEditor = undefined;
		this.props.filterEditorOpen = false;
	}

	focus() {
		this.#rootElement?.querySelector("input")?.focus();
	}

	clickOutside() {
		if (this.visible && !this.#filterEditor) {
			this.close();
		}
	}

	renderContents() {
		if (!this.#rootElement) {
			this.#rootElement = document.createElement("div");
			this.#rootElement.id = "qi-search-appv3";
			document.body.appendChild(this.#rootElement);
		}

		if (getSetting(ModuleSetting.REMEMBER_BROWSE_INPUT) && this.attachedContext && this.attachedContext.mode === ContextMode.Browse) {
			this.attachedContext.startText = this.attachedContext.startText || this.rememberedText;
			this.attachedContext.filter = this.attachedContext.filter || this.rememberedFilter;
		}

		this.props.context = this.attachedContext || undefined;
		this.props.filter = this.attachedContext?.filter;

		this.#unmount = mount(SearchApp, {
			target: this.#rootElement,
			props: this.props,
			intro: true,
			events: {
				close: () => this.close(),
				focusLost: () => {},
				openFilterEditor: async (event) => {
					const filter = event.detail;

					if (this.#filterEditor) {
						this.closeFilterEditor();
					} else {
						this.openFilterEditor(filter);
					}
				},
				searched: (event) => {
					if (this.attachedContext?.mode === ContextMode.Browse) {
						this.rememberedText = event.detail || "";
					}
				},
				setFilter: (event) => {
					if (this.attachedContext?.mode === ContextMode.Browse) {
						this.rememberedFilter = event.detail || undefined;
					}
				},
				moveStart: (event) => {
					this.#moveStart(event.detail);
				}
			}
		});

		setTimeout(() => {
			this.focus();

			if (this.attachedContext?.mode === ContextMode.Browse) {
				this.#rootElement?.querySelector("input")?.select();
			}
		});

		if (!this.#rootElement) return;
		// (Re-)set position
		this.#rootElement.removeAttribute("style");
		// Load context
		this.applyContext();
		this.addContextMenu();
		// Setup drag listeners
		document.addEventListener("dragstart", this.#dragStart);
		document.addEventListener("dragend", this.#dragEnd);
		document.addEventListener("drop", this.#drop);

		if (!this.#densitySub) {
			this.#densitySub = stores[ModuleSetting.SEARCH_DENSITY].subscribe(() => this.updateDensity());
		} else {
			this.updateDensity();
		}

		this.rendered = true;
		setTimeout(() => this.visible = true);
		// Backwards compat
		Hooks.callAll("renderSearchAppV2", this);
		Hooks.callAll("renderSearchAppShell", this);
	}

	applyContext() {
		if (!this.#rootElement) return;

		if (this.attachedContext?.spawnCSS?.left && this.attachedContext?.spawnCSS?.bottom) {
			this.setPosition({
				left: this.attachedContext.spawnCSS.left || 0,
				bottom: this.attachedContext.spawnCSS.bottom || 0
			});
		} else if (this.#savedPositon) {
			this.setPosition(this.#savedPositon);
		}

		if (this.attachedContext?.spawnCSS?.width) {
			this.#rootElement.style.width = this.attachedContext.spawnCSS.width + "px";
		}

		this.attachedContext?.classes?.forEach((className) => this.#rootElement?.classList.add(className));
	}

	updateDensity() {
		const density = get(stores[ModuleSetting.SEARCH_DENSITY]);

		if (density) {
			this.#rootElement?.classList.remove("density-compact");
			this.#rootElement?.classList.remove("density-comfortable");
			this.#rootElement?.classList.remove("density-spacious");
			this.#rootElement?.classList.add("density-" + density);
		}
	}

	addContextMenu() {
		if (!foundry.utils.isNewerVersion(game.version, "13")) {
			return;
		}

		const menuItems = [
			...createToggle({
				name: "Footer",
				condition: () => getSetting(ModuleSetting.SEARCH_FOOTER),
				callback: () => setSetting(ModuleSetting.SEARCH_FOOTER, !getSetting(ModuleSetting.SEARCH_FOOTER))
			}),
			...createToggle({
				name: mloc("FilterPopupTitle"),
				condition: () => getSetting(ModuleSetting.QUICK_FILTER_EDIT),
				callback: () => setSetting(ModuleSetting.QUICK_FILTER_EDIT, !getSetting(ModuleSetting.QUICK_FILTER_EDIT))
			}),
			...createToggle({
				name: mloc("SettingsSearchDensityValueCompact"),
				group: "density",
				condition: () => getSetting(ModuleSetting.SEARCH_DENSITY) === "compact",
				callback: () => setSetting(ModuleSetting.SEARCH_DENSITY, "compact")
			}),
			...createToggle({
				name: mloc("SettingsSearchDensityValueComfortable"),
				group: "density",
				condition: () => getSetting(ModuleSetting.SEARCH_DENSITY) === "comfortable",
				callback: () => setSetting(ModuleSetting.SEARCH_DENSITY, "comfortable")
			}),
			...createToggle({
				name: mloc("SettingsSearchDensityValueSpacious"),
				group: "density",
				condition: () => getSetting(ModuleSetting.SEARCH_DENSITY) === "spacious",
				callback: () => setSetting(ModuleSetting.SEARCH_DENSITY, "spacious")
			}),
			{
				name: mloc("SettingsMenuLabel") + "...",
				group: "settings",
				icon: '<i class="fas fa-sliders-h"></i>',
				callback: () => openSettingsApp()
			}
		];

		//@ts-expect-error types not updated
		new foundry.applications.ux.ContextMenu.implementation(this.element, ".drag-container", menuItems, { jQuery: false, fixed: true });
	}
}

function getModuleSettings() {
    return {
        [ModuleSetting.GM_ONLY]: {
            name: "QUICKINSERT.SettingsGmOnly",
            hint: "QUICKINSERT.SettingsGmOnlyHint",
            type: Boolean,
            default: false,
            scope: "world",
        },
        [ModuleSetting.FILTERS_SHEETS_ENABLED]: {
            name: "QUICKINSERT.SettingsFiltersSheetsEnabled",
            hint: "QUICKINSERT.SettingsFiltersSheetsEnabledHint",
            type: Boolean,
            default: true,
            scope: "world",
        },
        [ModuleSetting.AUTOMATIC_INDEXING]: {
            name: "QUICKINSERT.SettingsAutomaticIndexing",
            hint: "QUICKINSERT.SettingsAutomaticIndexingHint",
            type: Number,
            choices: {
                3000: "QUICKINSERT.SettingsAutomaticIndexing3s",
                5000: "QUICKINSERT.SettingsAutomaticIndexing5s",
                10000: "QUICKINSERT.SettingsAutomaticIndexing10s",
                "-1": "QUICKINSERT.SettingsAutomaticIndexingOnFirstOpen",
            },
            default: -1,
            scope: "world",
        },
        [ModuleSetting.SEARCH_BUTTON]: {
            name: "QUICKINSERT.SettingsSearchButton",
            hint: "QUICKINSERT.SettingsSearchButtonHint",
            type: Boolean,
            default: false,
            scope: "world",
        },
        [ModuleSetting.ENABLE_GLOBAL_CONTEXT]: {
            name: "QUICKINSERT.SettingsEnableGlobalContext",
            hint: "QUICKINSERT.SettingsEnableGlobalContextHint",
            type: Boolean,
            default: true,
        },
        [ModuleSetting.DEFAULT_ACTION_SCENE]: {
            name: "QUICKINSERT.SettingsDefaultActionScene",
            hint: "QUICKINSERT.SettingsDefaultActionSceneHint",
            type: String,
            choices: {
                show: foundry.utils.isNewerVersion(game.version, "13")
                    ? "SCENE.Configure"
                    : "SCENES.Configure",
                viewScene: foundry.utils.isNewerVersion(game.version, "13")
                    ? "SCENE.View"
                    : "SCENES.View",
                activateScene: foundry.utils.isNewerVersion(game.version, "13")
                    ? "SCENE.Activate"
                    : "SCENES.Activate",
            },
            default: "show",
        },
        [ModuleSetting.DEFAULT_ACTION_ROLL_TABLE]: {
            name: "QUICKINSERT.SettingsDefaultActionRollTable",
            hint: "QUICKINSERT.SettingsDefaultActionRollTableHint",
            type: String,
            choices: {
                show: "QUICKINSERT.ActionEdit",
                roll: foundry.utils.isNewerVersion(game.version, "13")
                    ? "TABLE.ACTIONS.DrawResult"
                    : "TABLE.Roll",
            },
            default: "show",
        },
        [ModuleSetting.DEFAULT_ACTION_MACRO]: {
            name: "QUICKINSERT.SettingsDefaultActionMacro",
            hint: "QUICKINSERT.SettingsDefaultActionMacroHint",
            type: String,
            choices: {
                show: "QUICKINSERT.ActionEdit",
                execute: "QUICKINSERT.ActionExecute",
            },
            default: "show",
        },
        [ModuleSetting.SEARCH_TOOLTIPS]: {
            setting: ModuleSetting.SEARCH_TOOLTIPS,
            name: "QUICKINSERT.SettingsSearchTooltips",
            hint: "QUICKINSERT.SettingsSearchTooltipsHint",
            type: String,
            choices: {
                off: "QUICKINSERT.SettingsSearchTooltipsValueOff",
                text: "QUICKINSERT.SettingsSearchTooltipsValueText",
                image: "QUICKINSERT.SettingsSearchTooltipsValueImage",
                full: "QUICKINSERT.SettingsSearchTooltipsValueFull",
            },
            default: "text",
        },
        [ModuleSetting.EMBEDDED_INDEXING]: {
            setting: ModuleSetting.EMBEDDED_INDEXING,
            name: "QUICKINSERT.SettingsEmbeddedIndexing",
            hint: "QUICKINSERT.SettingsEmbeddedIndexingHint",
            type: Boolean,
            default: false,
            scope: "world",
        },
        [ModuleSetting.TOC_INDEXING]: {
            setting: ModuleSetting.TOC_INDEXING,
            name: "QUICKINSERT.SettingsTocIndexing",
            hint: "QUICKINSERT.SettingsTocIndexingHint",
            type: Boolean,
            default: false,
            scope: "world",
        },
        [ModuleSetting.INDEXING_DISABLED]: {
            name: "Things that have indexing disabled",
            type: Object,
            default: {
                entities: {
                    Macro: [1, 2],
                    Scene: [1, 2],
                    Playlist: [1, 2],
                    RollTable: [1, 2],
                },
                packs: {},
            },
            scope: "world",
        },
        [ModuleSetting.FILTERS_CLIENT]: {
            name: "Own filters",
            type: Object,
            default: {
                saveRev: SAVE_SETTINGS_REVISION,
                disabled: [],
                filters: [],
            },
        },
        [ModuleSetting.FILTERS_WORLD]: {
            name: "World filters",
            type: Object,
            default: {
                saveRev: SAVE_SETTINGS_REVISION,
                filters: [],
            },
            scope: "world",
        },
        [ModuleSetting.FILTERS_ADD_DEFAULT_SUBTYPE]: {
            name: "Add default filters for subtypes",
            type: Boolean,
            default: true,
            scope: "world",
        },
        [ModuleSetting.FILTERS_ADD_DEFAULT_PACKS]: {
            name: "Add default filters for compendiums",
            type: Boolean,
            default: false,
            scope: "world",
        },
        [ModuleSetting.FILTERS_ADD_DEFAULT_TYPE]: {
            name: "Add default filters for base types",
            type: Boolean,
            default: true,
            scope: "world",
        },
        [ModuleSetting.SEARCH_DENSITY]: {
            name: "Search Density",
            type: String,
            choices: {
                compact: "QUICKINSERT.SettingsSearchDensityValueCompact",
                comfortable: "QUICKINSERT.SettingsSearchDensityValueComfortable",
                spacious: "QUICKINSERT.SettingsSearchDensityValueSpacious",
            },
            default: "comfortable",
        },
        [ModuleSetting.ENHANCED_TOOLTIPS]: {
            name: "Enhanced tooltips",
            type: Boolean,
            default: true,
        },
        [ModuleSetting.SEARCH_ENGINE]: {
            name: "Search Engine",
            type: String,
            default: "fuzzysort",
            choices: {
                fuse: "QUICKINSERT.SettingsSearchEngineValueFuse",
                fuzzysort: "QUICKINSERT.SettingsSearchEngineValueFuzzysort",
            },
        },
        [ModuleSetting.QUICK_FILTER_EDIT]: {
            name: "QUICKINSERT.QuickFilterEdit",
            hint: "QUICKINSERT.QuickFilterEditHint",
            type: Boolean,
            default: false,
        },
        [ModuleSetting.REMEMBER_BROWSE_INPUT]: {
            name: "QUICKINSERT.SettingsRememberBrowseInput",
            hint: "QUICKINSERT.SettingsRememberBrowseInputHint",
            type: Boolean,
            default: true,
        },
        [ModuleSetting.SEARCH_FOOTER]: {
            name: "QUICKINSERT.SettingsSearchFooter",
            hint: "QUICKINSERT.SettingsSearchFooterHint",
            type: Boolean,
            default: true,
        },
        [ModuleSetting.SHOW_FOLDERS_IN_INDEXING_TAB]: {
            name: "Show folders in indexing tab",
            type: Boolean,
            default: false,
        },
    };
}
function registerSettings(callbacks = {}) {
    Object.entries(getModuleSettings()).forEach((entry) => {
        const [setting, item] = entry;
        registerSetting(setting, (value) => {
            stores[setting]?.load();
            callbacks[setting]?.(value);
        }, item);
    });
}

function mapKey(key) {
    if (key.startsWith("Key")) {
        return key[key.length - 1].toLowerCase();
    }
    return key;
}
function registerProseMirrorKeys() {
    const binds = game?.keybindings?.bindings?.get("quick-insert." + ModuleKeyBinds.TOGGLE_OPEN);
    if (!binds?.length) {
        console.info("Quick Insert | ProseMirror extension found no key binding");
        return;
    }
    function keyCallback(state, dispatch, view) {
        // Open window
        QuickInsert.open(new ProseMirrorContext(state, dispatch, view));
        return true;
    }
    const keyMap = Object.fromEntries(binds.map((bind) => {
        return [
            `${bind.modifiers?.map((m) => m + "-").join("")}${mapKey(bind.key)}`,
            keyCallback,
        ];
    }));
    ProseMirror.defaultPlugins.QuickInsert = ProseMirror.keymap(keyMap);
}

// Convert V2 config to V3 config
function v2ToV3(config) {
    if (!("entities" in config)) {
        return false;
    }
    // Entities -> documentTypes
    if (typeof config.entities !== "string") {
        const entities = config.entities;
        delete config.entities;
        config.documentTypes = entities;
    }
    else {
        delete config.entities;
        config.documentTypes = [];
    }
    // Compendiums
    if (typeof config.compendiums === "string" && config.compendiums === "any") {
        config.compendiums = [FILTER_COMPENDIUM_ALL];
    }
    // Folders
    if (typeof config.folders === "string" && config.folders === "any") {
        config.folders = [FILTER_FOLDER_ROOT];
    }
    return true;
}
function migrateConfig(config) {
    return v2ToV3(config);
}
function migrateFilter(filter) {
    let migrated = false;
    if (filter.role === undefined) {
        filter.role =
            filter.type === FilterType.Client
                ? CONST.USER_ROLES.PLAYER
                : CONST.USER_ROLES.GAMEMASTER;
        migrated = true;
    }
    migrated = migrateConfig(filter.filterConfig) || migrated;
    if (migrated) {
        console.log(`Quick Insert | migrated custom filter to V3: @${filter.tag}`, filter);
    }
    return migrated;
}
function migrateFilters() {
    let migratedClient = false;
    const clientFilters = getSetting(ModuleSetting.FILTERS_CLIENT);
    if (clientFilters?.filters?.length) {
        clientFilters.filters.forEach((filter) => (migratedClient = migrateFilter(filter) || migratedClient));
        if (migratedClient)
            setSetting(ModuleSetting.FILTERS_CLIENT, clientFilters);
    }
    if (game.user?.isGM) {
        let migratedWorld = false;
        const worldFilters = getSetting(ModuleSetting.FILTERS_WORLD);
        if (worldFilters?.filters?.length) {
            worldFilters.filters.forEach((filter) => (migratedWorld = migrateFilter(filter) || migratedWorld));
        }
        if (migratedWorld)
            setSetting(ModuleSetting.FILTERS_WORLD, worldFilters);
    }
}

function quickInsertDisabled() {
    return !game.user?.isGM && getSetting(ModuleSetting.GM_ONLY);
}
// Client is currently reindexing?
let reIndexing = false;
async function reIndex() {
    if (quickInsertDisabled())
        return;
    // Active users will start reindexing in deterministic order, once per 300ms
    if (reIndexing)
        return;
    reIndexing = true;
    if (game.users && game.userId !== null) {
        const order = [...game.users.contents]
            //@ts-expect-error not sure why it's missing
            .filter((u) => u.active)
            .map((u) => u.id)
            .indexOf(game.userId);
        await resolveAfter(order * 300);
    }
    await QuickInsert.forceIndex();
    reIndexing = false;
}
Hooks.once("init", async function () {
    registerSettings({
        [ModuleSetting.INDEXING_DISABLED]: () => reIndex(),
        [ModuleSetting.EMBEDDED_INDEXING]: () => reIndex(),
        [ModuleSetting.TOC_INDEXING]: () => reIndex(),
        [ModuleSetting.SEARCH_ENGINE]: () => reIndex(),
    });
    game.keybindings.register("quick-insert", ModuleKeyBinds.TOGGLE_OPEN, {
        name: "QUICKINSERT.SettingsQuickOpen",
        textInput: true,
        editable: [
            { key: "Space", modifiers: [KeyboardManager.MODIFIER_KEYS.CONTROL] },
        ],
        onDown: (ctx) => {
            QuickInsert.toggle(ctx._quick_insert_extra?.context);
            return true;
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
    game.keybindings.register("quick-insert", ModuleKeyBinds.OPEN_SETTINGS, {
        name: "QUICKINSERT.SettingsMenuLabel",
        editable: [],
        onDown: () => {
            new SettingsApp().render(true);
        },
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
    });
});
Hooks.once("ready", function () {
    if (quickInsertDisabled())
        return;
    registerMenu({
        namespace: "quick-insert",
        menu: "quickInsertSettings",
        key: "quickInsertSettings",
        name: "QUICKINSERT.SettingsMenu",
        label: "QUICKINSERT.SettingsMenuLabel",
        icon: "fas fa-sliders-h",
        type: SettingsApp,
        restricted: false,
    });
    console.log("Quick Insert | Initializing...");
    migrateFilters();
    QuickInsert.filters.init();
    QuickInsert.app = new SearchAppShell();
    registerTinyMCEPlugin();
    registerProseMirrorKeys();
    importSystemIntegration().then((systemIntegration) => {
        if (systemIntegration) {
            QuickInsert.systemIntegration = systemIntegration;
            QuickInsert.systemIntegration.init();
        }
    });
    document.addEventListener("keydown", (evt) => {
        // Allow in input fields...
        customKeybindHandler(evt);
    });
    document.addEventListener("click", (evt) => {
        if (evt.target &&
            QuickInsert.app?.rendered &&
            "closest" in evt.target &&
            !evt.shiftKey) {
            const target = evt.target;
            if (target.isConnected &&
                target.closest &&
                !target.closest(".quick-insert-app") &&
                !target.closest(".quick-insert-result")) {
                QuickInsert.app?.clickOutside();
            }
        }
    });
    setupDocumentHooks(QuickInsert);
    console.log("Quick Insert | Search Application ready");
    const indexDelay = getSetting(ModuleSetting.AUTOMATIC_INDEXING);
    if (indexDelay != -1) {
        setTimeout(() => {
            console.log("Quick Insert | Automatic indexing initiated");
            loadSearchIndex();
        }, indexDelay);
    }
});
Hooks.on("renderSceneControls", (controls, html) => {
    if (quickInsertDisabled() || !getSetting(ModuleSetting.SEARCH_BUTTON)) {
        return;
    }
    if (!(html instanceof HTMLElement)) {
        // Pre 13.x
        const searchBtn = $(`<li class="scene-control" title="Quick Insert" class="quick-insert-open">
            <i class="fas fa-search"></i>
        </li>`);
        html.children(".main-controls").append(searchBtn);
        searchBtn.on("click", () => QuickInsert.open());
    }
    else {
        // Post 13.x
        if (html.querySelector(".quick-insert-control") ||
            !html.firstElementChild) {
            return;
        }
        const button = `<li><button type="button" class="control ui-control layer icon fa-solid fa-search quick-insert-control" role="tab" data-action="control" data-control="" data-tooltip="Quick Insert" aria-pressed="false" aria-label="Quick Insert" aria-controls="scene-controls-tools"></button></li>`;
        html.firstElementChild.insertAdjacentHTML("beforeend", button);
        html.firstElementChild.lastElementChild?.addEventListener("click", () => QuickInsert.open());
    }
});
// Exports and API usage
//@ts-expect-error not defined
globalThis.QuickInsert = QuickInsert;

export { CharacterSheetContext, DocumentType, ModuleSetting, QuickInsert, BaseSearchContext as SearchContext, getSetting, systemDocumentActionCallbacks, systemDocumentActions, systemFields };
//# sourceMappingURL=quick-insert.js.map
