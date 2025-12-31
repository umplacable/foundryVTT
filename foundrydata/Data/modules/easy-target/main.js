'use strict';

const EasyTarget = {
	activeToolTarget: false,

	getTemplateShape: function (template) {
		let shape = template.document.t;
		shape = shape[0].toUpperCase() + shape.substring(1);

		const fn = MeasuredTemplate[`get${shape}Shape`];
		const {direction, distance, angle, width} = template.document;

		switch (shape) {
			case 'Circle': return fn(distance);
			case 'Cone': return fn(distance, direction, angle);
			case 'Rect': return fn(distance, direction);
			case 'Ray': return fn(distance, direction, width);
		}
	},

	onCanvasClickLeft: function (event) {
		const oe = event.data.originalEvent;
		const selectState = event.data._selectState;

		if (oe.altKey) {
			EasyTarget.activeToolTarget = true;
		}

		if (oe.altKey && selectState !== 2) {
			const {x: ox, y: oy} = event.getLocalPosition(canvas.stage);
			const templates = canvas.templates.objects.children.filter(template => {
				const {x: cx, y: cy} = template.center;
				return template.shape.contains(ox - cx, oy - cy);
			});

			EasyTarget.targetTokensInArea(templates, EasyTarget.releaseBehaviour(oe));
		}

		EasyTarget.activeToolTarget = false;
	},

	onCreateMeasuredTemplate: function (createdTemplate, options, userId) {
		if (game.userId !== userId || !game.keyboard.isModifierActive('Alt')) {
			return;
		}

		const releaseOthers = EasyTarget.releaseBehaviour();
		const hookId = Hooks.on('refreshMeasuredTemplate', template => {
			if (template.id === createdTemplate.id) {
				EasyTarget.targetTokensInArea([template], releaseOthers);
				Hooks.off('refreshMeasuredTemplate', hookId);
			}
		});
	},

	patch: function () {
		const releaseOthersMap = new WeakMap();

		const tokenSetTarget = function (wrapped, ...args) {
			const releaseOthers = releaseOthersMap.get(this);
			if (releaseOthers !== undefined) {
				args[1].releaseOthers = releaseOthers;
			}

			return wrapped(...args);
		}

		const tokenOnClickLeft = function (wrapped, ...args) {
			const [ event ] = args;
			const oe = event.data.originalEvent;

			if (oe.altKey) {
				EasyTarget.activeToolTarget = true;
			}

			if (EasyTarget.activeToolTarget) {
				releaseOthersMap.set(this, EasyTarget.releaseBehaviour(oe));
			}

			wrapped(...args);

			releaseOthersMap.delete(this);

			EasyTarget.activeToolTarget = false;
		}

		const tokenCanControl = function (wrapped, ...args) {
			const [, event] = args;

			if (!event) {
				return wrapped(...args);
			}

			const oe = event.data.originalEvent;

			if (oe.altKey) {
				EasyTarget.activeToolTarget = true;
			}

			const canControl = wrapped(...args);

			EasyTarget.activeToolTarget = false;

			return canControl;
		};

		const tokenLayerTargetObjects = function (wrapped, ...args) {
			const releaseOthers = releaseOthersMap.get(this);

			if (releaseOthers !== undefined) {
				args[1].releaseOthers = releaseOthers;
			}

			return wrapped(...args);
		}

		if (game.modules.get('lib-wrapper')?.active) {
			libWrapper.register('easy-target', 'Token.prototype.setTarget', tokenSetTarget, 'WRAPPER');
			libWrapper.register('easy-target', 'Token.prototype._onClickLeft', tokenOnClickLeft, 'WRAPPER');
			libWrapper.register('easy-target', 'Token.prototype._canControl', tokenCanControl, 'WRAPPER');
			libWrapper.register('easy-target', 'TokenLayer.prototype.targetObjects', tokenLayerTargetObjects, 'WRAPPER');
		} else {
			const cachedTokenSetTarget = Token.prototype.setTarget;
			Token.prototype.setTarget = function () {
				return tokenSetTarget.call(this, cachedTokenSetTarget.bind(this), ...arguments);
			};

			const cachedTokenOnClickLeft = Token.prototype._onClickLeft;
			Token.prototype._onClickLeft = function () {
				return tokenOnClickLeft.call(this, cachedTokenOnClickLeft.bind(this), ...arguments);
			};

			const cachedTokenCanControl = Token.prototype._canControl;
			Token.prototype._canControl = function () {
				return tokenCanControl.call(this, cachedTokenCanControl.bind(this), ...arguments);
			};

			const cachedTokenLayerTargetObjects = TokenLayer.prototype.targetObjects;
			TokenLayer.prototype.targetObjects = function () {
				return tokenLayerTargetObjects.call(this, cachedTokenLayerTargetObjects.bind(this), ...arguments);
			};
		}
	},

	patchActiveTool: function () {
		if (game) {
			const originalActiveTool =
				Object.getOwnPropertyDescriptor(game.constructor.prototype, 'activeTool');

			Object.defineProperty(game, 'activeTool', {
				get () {
					if (EasyTarget.activeToolTarget) {
						return 'target';
					}

					return originalActiveTool.get.call(game);
				}
			});
		}
	},

	releaseBehaviour: function (oe) {
		const shiftKey = oe?.shiftKey ?? game.keyboard.isModifierActive('Shift');
		const altKey = oe?.altKey ?? game.keyboard.isModifierActive('Alt');
		const mode = game.settings.get('easy-target', 'release');
		if (mode === 'sticky') {
			return !shiftKey && !altKey;
		}

		return !shiftKey;
	},

	targetTokensInArea: function (templates, releaseOthers) {
		if (releaseOthers) {
			game.user.targets.forEach(token => token.setTarget(false, {releaseOthers: false, groupSelection: true}));
		}

		canvas.tokens.objects.children.filter(token => {
			const {x: ox, y: oy} = token.center;
			return templates.some(template => {
				const {x: cx, y: cy} = template.center;
				return template.shape.contains(ox - cx, oy - cy);
			});
		}).forEach(token => token.setTarget(true, {releaseOthers: false, groupSelection: true}));
		game.user.broadcastActivity({targets: game.user.targets.ids});
	}
};

Hooks.once('init', () => {
	EasyTarget.patch();
	game.keybindings.register('easy-target', 'clear-targets', {
		name: 'EASYTGT.ClearAllTargets',
		editable: [{key: 'KeyC', modifiers: ['Alt', 'Shift']}],
		onDown: () => {
			game.user.targets.forEach(token =>
				token.setTarget(false, {releaseOthers: false, groupSelection: true}));
			game.user.broadcastActivity({targets: game.user.targets.ids});
			return true;
		}
	});
});

Hooks.on('canvasReady', function () {
	canvas.stage.on("pointerdown", EasyTarget.onCanvasClickLeft);
});

Hooks.on('createMeasuredTemplate', EasyTarget.onCreateMeasuredTemplate);

Hooks.once('ready', function () {
	EasyTarget.patchActiveTool();
	game.settings.register('easy-target', 'release', {
		name: 'EASYTGT.ReleaseBehaviour',
		hint: 'EASYTGT.ReleaseBehaviourHint',
		scope: 'user',
		config: true,
		default: 'sticky',
		type: String,
		choices: {
			'sticky': 'EASYTGT.Sticky',
			'standard': 'EASYTGT.Standard'
		}
	});
});
