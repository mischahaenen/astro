import type { AstroConfig } from '../@types/astro.js';

import { fileURLToPath } from 'node:url';
import os from 'node:os';
import process from 'node:process';
import path from 'node:path';

import dget from 'dlv';
import { DEFAULT_PREFERENCES, type Preferences } from './defaults.js';
import { PreferenceStore } from './store.js';

type DotKeys<T> = T extends object ? { [K in keyof T]:
  `${Exclude<K, symbol>}${DotKeys<T[K]> extends never ? "" : `.${DotKeys<T[K]>}`}`
}[keyof T] : never

export type GetDotKey<
  T extends Record<string | number, any>,
  K extends string
> = K extends `${infer U}.${infer Rest}` ? GetDotKey<T[U], Rest> : T[K]

export interface PreferenceOptions {
	location?: 'global' | 'project';
}

export interface AstroPreferences {
	get<Key extends DotKeys<Preferences>>(key: Key, opts?: PreferenceOptions): GetDotKey<Preferences, Key>;
	set<Key extends DotKeys<Preferences>>(key: Key, value: GetDotKey<Preferences, Key>, opts?: PreferenceOptions): void;
}

export function isValidKey(key: string): key is DotKeys<Preferences> {
	return dget(DEFAULT_PREFERENCES, key) !== undefined;
}
export function coerce(key: string, value: string | number) {
	const type = typeof dget(DEFAULT_PREFERENCES, key);
	switch (type) {
		case 'string': return value;
		case 'number': return Number(value);
		case 'boolean': {
			if (value === 'true' || value === 1) return true;
			if (value === 'false' || value === 0) return false;
		}
	}
	throw new Error(`Unable to convert "${value}" to a ${type} for "${key}".`)
}

export default function createPreferences(config: AstroConfig): AstroPreferences {
	const global = new PreferenceStore(getGlobalPreferenceDir());
	const project = new PreferenceStore(fileURLToPath(new URL('./.astro/', config.root)));
	const stores = { global, project };

	return {
		get(key, { location } = {}) {
			if (!location) return project.get(key) ?? global.get(key) ?? dget(DEFAULT_PREFERENCES, key);
			return stores[location].get(key);
		},
		set(key, value, { location = 'project' } = {}) {
			stores[location].set(key, value);
		}
	}
}


// Adapted from https://github.com/sindresorhus/env-paths
export function getGlobalPreferenceDir() {
	const name = 'astro';
	const homedir = os.homedir();
	const macos = () => path.join(homedir, 'Library', 'Preferences', name);
	const win = () => {
		const { APPDATA = path.join(homedir, 'AppData', 'Roaming') } = process.env;
		return path.join(APPDATA, name, 'Config');
	};
	const linux = () => {
		const { XDG_CONFIG_HOME = path.join(homedir, '.config') } = process.env;
		return path.join(XDG_CONFIG_HOME, name);
	};
	switch (process.platform) {
		case 'darwin':
			return macos();
		case 'win32':
			return win();
		default:
			return linux();
	}
}
