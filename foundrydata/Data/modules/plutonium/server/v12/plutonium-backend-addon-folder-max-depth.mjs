export default () => {
	const PATCHED_FOLDER_MAX_DEPTH = 9;

	if (CONST.FOLDER_MAX_DEPTH >= PATCHED_FOLDER_MAX_DEPTH) return;

	const CONST_ORIGINAL = globalThis.CONST;

	// Avoid proxying the real `CONST` object, as it is frozen, and `Proxy` respects this
	// See: https://262.ecma-international.org/8.0/#sec-proxy-object-internal-methods-and-internal-slots-get-p-receiver
	//      "The value reported for a property must be the same as the value of the corresponding
	//      target object property if the target object property is a non-writable, non-configurable
	//      own data property."
	globalThis.CONST = new Proxy({}, {
		get (proxiedObject, prop, proxy) {
			if (prop === "FOLDER_MAX_DEPTH") return PATCHED_FOLDER_MAX_DEPTH;
			return CONST_ORIGINAL[prop];
		},
	});
};
