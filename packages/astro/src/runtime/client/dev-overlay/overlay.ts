/* eslint-disable no-console */
import type { DevOverlayPlugin as DevOverlayPluginDefinition } from '../../../@types/astro.js';
import { settings } from './settings.js';
import { getIconElement, isDefinedIcon, type Icon } from './ui-library/icons.js';

export type DevOverlayPlugin = DevOverlayPluginDefinition & {
	builtIn: boolean;
	active: boolean;
	status: 'ready' | 'loading' | 'error';
	notification: {
		state: boolean;
	};
	eventTarget: EventTarget;
};

const WS_EVENT_NAME = 'astro-dev-overlay';

export class AstroDevOverlay extends HTMLElement {
	shadowRoot: ShadowRoot;
	hoverTimeout: number | undefined;
	isHidden: () => boolean = () => this.devOverlay?.hasAttribute('data-hidden') ?? true;
	isActive: () => boolean = () => this.devOverlay?.hasAttribute('data-active-plugin') ?? false;
	devOverlay: HTMLDivElement | undefined;
	plugins: DevOverlayPlugin[] = [];
	HOVER_DELAY = 2 * 1000;
	hasBeenInitialized = false;
	customPluginsToShow = 3;

	constructor() {
		super();
		this.shadowRoot = this.attachShadow({ mode: 'open' });
	}

	// Happens whenever the component is connected to the DOM
	// When view transitions are enabled, this happens every time the view changes
	async connectedCallback() {
		if (!this.hasBeenInitialized) {
			this.shadowRoot.innerHTML = `
			<style>	
			:host {
				/* Important! Reset all inherited styles to initial */
				all: initial;
				z-index: 999999;
				view-transition-name: astro-dev-overlay;
				display: contents;
			}

			::view-transition-old(astro-dev-overlay),
			::view-transition-new(astro-dev-overlay) {
				animation: none;
			}

			#dev-overlay {
				position: fixed;
				bottom: 16px;
				left: 50%;
				transform: translate(-50%, 0%);
				z-index: 9999999999;
				display: flex;
				gap: 8px;
				align-items: center;
				transition: bottom 0.35s cubic-bezier(0.485, -0.050, 0.285, 1.505);
				pointer-events: none;
			}

			#dev-overlay[data-hidden] {
				bottom: -28px;
			}

			#dev-overlay[data-hidden] #dev-bar .item {
				opacity: 0;
			}
			
			#dev-bar-hitbox {
				height: 42px;
				width: 100%;
				position: absolute;
				top: -40px;
				left: 0;
				pointer-events: auto;
			}
			#dev-bar {
				height: 40px;
				overflow: hidden;
				pointer-events: auto;
				background: linear-gradient(180deg, #13151A 0%, rgba(19, 21, 26, 0.88) 100%);
				border: 1px solid #343841;
				border-radius: 9999px;
				box-shadow: 0px 0px 0px 0px rgba(19, 21, 26, 0.30), 0px 1px 2px 0px rgba(19, 21, 26, 0.29), 0px 4px 4px 0px rgba(19, 21, 26, 0.26), 0px 10px 6px 0px rgba(19, 21, 26, 0.15), 0px 17px 7px 0px rgba(19, 21, 26, 0.04), 0px 26px 7px 0px rgba(19, 21, 26, 0.01);
			}

			#dev-bar .item {
				display: flex;
				justify-content: center;
				align-items: center;
				width: 42px;
				border: 0;
				background: transparent;
				color: white;
				font-family: system-ui, sans-serif;
				font-size: 1rem;
				line-height: 1.2;
				white-space: nowrap;
				text-decoration: none;
				padding: 0;
				margin: 0;
				overflow: hidden;
				transition: opacity 0.2s ease-out 0s;
			}

			#dev-bar #bar-container .item:hover, #dev-bar #bar-container .item:focus-visible {
				background: #FFFFFF20;
				cursor: pointer;
				outline-offset: -3px;
			}

			#dev-bar .item:first-of-type {
				border-top-left-radius: 9999px;
				border-bottom-left-radius: 9999px;
				width: 40px;
				padding-left: 4px;
			}

			#dev-bar .item:last-of-type {
				border-top-right-radius: 9999px;
				border-bottom-right-radius: 9999px;
				width: 40px;
				padding-right: 4px;
			}
			#dev-bar #bar-container .item.active {
				background: rgba(71, 78, 94, 1);
			}

			#dev-bar .item-tooltip {
				background: linear-gradient(0deg, #13151A, #13151A), linear-gradient(0deg, #343841, #343841);
				border: 1px solid rgba(52, 56, 65, 1);
				border-radius: 4px;
				padding: 4px 8px;
				position: absolute;
				top: -36px;
				opacity: 0;
				transition: opacity 0.2s ease-in-out 0s;
				pointer-events: none;
			}

			#dev-bar .item-tooltip::after{
				content: '';
				position: absolute;
				left: calc(50% - 5px);
				bottom: -6px;
				border-left: 5px solid transparent;
				border-right: 5px solid transparent;
				border-top: 5px solid #343841;
			}

			#dev-bar .item:hover .item-tooltip, #dev-bar .item:not(.active):focus-visible .item-tooltip {
				transition: opacity 0.2s ease-in-out 200ms;
				opacity: 1;
			}

			#dev-bar #bar-container .item.active .notification {
				border-color: rgba(71, 78, 94, 1);
			}

			#dev-bar .item .icon {
				position: relative;
				max-width: 18px;
				max-height: 18px;
				user-select: none;
			}

			#dev-bar .item svg {
				width: 18px;
				height: 18px;
				display: block;
				margin: auto;
			}

			#dev-bar .item .notification {
				display: none;
				position: absolute;
				top: -4px;
				right: -6px;
				width: 8px;
				height: 8px;
				border-radius: 9999px;
				border: 1px solid rgba(19, 21, 26, 1);
				background: #B33E66;
			}

			#dev-bar .item .notification[data-active] {
				display: block;
			}

			#dev-bar #bar-container {
				height: 100%;
				display: flex;
			}

			#dev-bar .separator {
				background: rgba(52, 56, 65, 1);
				width: 1px;
			}
		</style>

		<div id="dev-overlay" data-hidden>
			<div id="dev-bar">
				<div id="dev-bar-hitbox"></div>
				<div id="bar-container">
					${this.plugins
						.filter(
							(plugin) => plugin.builtIn && !['astro:settings', 'astro:more'].includes(plugin.id)
						)
						.map((plugin) => this.getPluginTemplate(plugin))
						.join('')}
					${
						this.plugins.filter((plugin) => !plugin.builtIn).length > 0
							? `<div class="separator"></div>${this.plugins
									.filter((plugin) => !plugin.builtIn)
									.slice(0, this.customPluginsToShow)
									.map((plugin) => this.getPluginTemplate(plugin))
									.join('')}`
							: ''
					}
					${
						this.plugins.filter((plugin) => !plugin.builtIn).length > this.customPluginsToShow
							? this.getPluginTemplate(
									this.plugins.find((plugin) => plugin.builtIn && plugin.id === 'astro:more')!
								)
							: ''
					}
					<div class="separator"></div>
					${this.getPluginTemplate(
						this.plugins.find((plugin) => plugin.builtIn && plugin.id === 'astro:settings')!
					)}
				</div>
			</div>
		</div>`;
			this.devOverlay = this.shadowRoot.querySelector<HTMLDivElement>('#dev-overlay')!;
			this.attachEvents();
		}

		// Create plugin canvases
		this.plugins.forEach(async (plugin) => {
			if (!this.hasBeenInitialized) {
				if (settings.config.verbose) console.log(`Creating plugin canvas for ${plugin.id}`);

				const pluginCanvas = document.createElement('astro-dev-overlay-plugin-canvas');
				pluginCanvas.dataset.pluginId = plugin.id;
				this.shadowRoot?.append(pluginCanvas);
			}

			await this.togglePluginStatus(plugin, plugin.active);
		});

		// Init plugin lazily - This is safe to do here because only plugins that are not initialized yet will be affected
		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(async () => {
				await this.initAllPlugins();
			});
		} else {
			// Fallback to setTimeout for.. Safari...
			setTimeout(async () => {
				await this.initAllPlugins();
			}, 200);
		}

		this.hasBeenInitialized = true;
	}

	attachEvents() {
		const items = this.shadowRoot.querySelectorAll<HTMLDivElement>('.item');
		items.forEach((item) => {
			item.addEventListener('click', async (e) => {
				const target = e.currentTarget;
				if (!target || !(target instanceof HTMLElement)) return;

				const id = target.dataset.pluginId;
				if (!id) return;

				const plugin = this.getPluginById(id);
				if (!plugin) return;

				if (plugin.status === 'loading') {
					await this.initPlugin(plugin);
				}

				if (this.isActive()) {
					const currentPluginId = this.devOverlay?.getAttribute('data-active-plugin')!;
					if (currentPluginId !== plugin.id) {
						const currentPlugin = this.getPluginById(currentPluginId)!;
						await this.togglePluginStatus(currentPlugin);
					}
				}

				await this.togglePluginStatus(plugin);
			});
		});


		const devBar = this.shadowRoot.querySelector<HTMLDivElement>('#dev-bar');
		if (devBar) {
			(['mouseenter', 'focusin'] as const).forEach((event) => {
				devBar.addEventListener(event, () => {
					if (this.hoverTimeout) {
						window.clearTimeout(this.hoverTimeout);
					}

					if (this.isHidden()) {
						this.toggleOverlay(true);
					}
				});
			});

			devBar.addEventListener('mouseleave', () => {
				if (this.hoverTimeout) {
					window.clearTimeout(this.hoverTimeout);
				}
				if (this.isActive() || this.isHidden()) {
					return;
				}
				this.hoverTimeout = window.setTimeout(() => {
					this.toggleOverlay(false);
				}, this.HOVER_DELAY);
			});

			// On click, show the overlay if it's hidden, it's likely the user wants to interact with it
			this.shadowRoot.addEventListener('click', () => {
				if (!this.isHidden()) return;
				this.toggleOverlay(true);
			});

			devBar.addEventListener('keyup', (event) => {
				if (event.code === 'Space' || event.code === 'Enter') {
					if (!this.isHidden()) return;
					this.toggleOverlay(true);
				}
				if (event.key === 'Escape') {
					if (this.isHidden()) return;
					if (this.isActive()) return;
					this.toggleOverlay(false);
				}
			});

			document.addEventListener('keyup', (event) => {
				if (event.key == 'Escape') {
					if (this.isHidden()) return;
					if (this.isActive()) {
						const id = this.devOverlay?.getAttribute('data-active-plugin')!;
						const plugin = this.getPluginById(id)!;
						this.togglePluginStatus(plugin);
					} else {
						this.toggleOverlay(false);
					}
				}
			});

			document.addEventListener('click', (event) => {
				if (this.isHidden()) return;
				if (this.isActive()) return;
				if (this.shadowRoot.contains(event.target as Node)) return;
				this.toggleOverlay(false);
			});
		}
	}

	async initAllPlugins() {
		await Promise.all(
			this.plugins
				.filter((plugin) => plugin.status === 'loading')
				.map((plugin) => this.initPlugin(plugin))
		);
	}

	async initPlugin(plugin: DevOverlayPlugin) {
		if (plugin.status === 'ready') return;

		const shadowRoot = this.getPluginCanvasById(plugin.id)!.shadowRoot!;

		try {
			if (settings.config.verbose) console.info(`Initializing plugin ${plugin.id}`);

			await plugin.init?.(shadowRoot, plugin.eventTarget);
			plugin.status = 'ready';

			if (import.meta.hot) {
				import.meta.hot.send(`${WS_EVENT_NAME}:${plugin.id}:initialized`);
			}
		} catch (e) {
			console.error(`Failed to init plugin ${plugin.id}, error: ${e}`);
			plugin.status = 'error';
		}
	}

	getPluginTemplate(plugin: DevOverlayPlugin) {
		return `<button class="item" data-plugin-id="${plugin.id}">
				<div class="icon">${this.getPluginIcon(plugin.icon)}<div class="notification"></div></div>
				<span class="item-tooltip">${plugin.name}</span>
			</button>`;
	}

	getPluginIcon(icon: Icon) {
		if (isDefinedIcon(icon)) {
			return getIconElement(icon)?.outerHTML;
		}

		return icon;
	}

	getPluginById(id: string) {
		return this.plugins.find((plugin) => plugin.id === id);
	}

	getPluginCanvasById(id: string) {
		return this.shadowRoot.querySelector<HTMLElement>(
			`astro-dev-overlay-plugin-canvas[data-plugin-id="${id}"]`
		);
	}

	/**
	 * @param plugin The plugin to toggle the status of
	 * @param newStatus Optionally, force the plugin into a specific state
	 */
	async togglePluginStatus(plugin: DevOverlayPlugin, newStatus?: boolean) {
		const pluginCanvas = this.getPluginCanvasById(plugin.id);
		if (!pluginCanvas) return;

		if (plugin.active && !newStatus && plugin.beforeTogglingOff) {
			const shouldToggleOff = await plugin.beforeTogglingOff(pluginCanvas.shadowRoot!);

			// If the plugin returned false, don't toggle it off, maybe the plugin showed a confirmation dialog or similar
			if (!shouldToggleOff) return;
		}

		plugin.active = newStatus ?? !plugin.active;
		const mainBarButton = this.shadowRoot.querySelector(`[data-plugin-id="${plugin.id}"]`);
		const moreBarButton = this.getPluginCanvasById('astro:more')?.shadowRoot?.querySelector(
			`[data-plugin-id="${plugin.id}"]`
		);

		if (mainBarButton) {
			mainBarButton.classList.toggle('active', plugin.active);
		}

		if (moreBarButton) {
			moreBarButton.classList.toggle('active', plugin.active);
		}

		window.clearTimeout(this.hoverTimeout);
		if (plugin.active) {
			pluginCanvas.style.display = 'block';
			this.devOverlay?.setAttribute('data-active-plugin', plugin.id);
		} else {
			pluginCanvas.style.display = 'none';
			this.devOverlay?.removeAttribute('data-active-plugin');
			if (!this.isHidden()) {
				this.hoverTimeout = window.setTimeout(() => {
					this.toggleOverlay(false);
				}, this.HOVER_DELAY);
			}
		}

		window.requestAnimationFrame(() => {
			pluginCanvas.toggleAttribute('data-active', plugin.active);
			plugin.eventTarget.dispatchEvent(
				new CustomEvent('plugin-toggled', {
					detail: {
						state: plugin.active,
						plugin,
					},
				})
			);
		});

		if (import.meta.hot) {
			import.meta.hot.send(`${WS_EVENT_NAME}:${plugin.id}:toggled`, { state: plugin.active });
		}
	}


	toggleOverlay(newStatus?: boolean) {
		const barContainer = this.shadowRoot.querySelector<HTMLDivElement>('#bar-container');
		const devBar = this.shadowRoot.querySelector<HTMLDivElement>('#dev-bar');

		if (newStatus !== undefined) {
			if (newStatus === true) {
				this.devOverlay?.removeAttribute('data-hidden');
				barContainer?.removeAttribute('inert');
				devBar?.removeAttribute('tabindex');
			} else {
				this.devOverlay?.setAttribute('data-hidden', '');
				barContainer?.setAttribute('inert', '');
				devBar?.setAttribute('tabindex', '0');
			}
		} else {
			this.devOverlay?.toggleAttribute('data-hidden');
			barContainer?.toggleAttribute('inert');
			if (this.isHidden()) {
				devBar?.setAttribute('tabindex', '0');
			} else {
				devBar?.removeAttribute('tabindex');
			}
		}
	}
}

export class DevOverlayCanvas extends HTMLElement {
	shadowRoot: ShadowRoot;

	constructor() {
		super();
		this.shadowRoot = this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = `
		<style>
			:host {
				position: absolute;
				top: 0;
				left: 0;
			}
		</style>`;
	}
}
