/**
 * Type declarations for 'default_config.js'.
 *
 * 'default_config.js' does not exist in source — it is a build-time copy of the
 * user-editable '__config.js', made by the 'copy_default_config' filter (see
 * config.json) and bundled with the scripts to provide the trusted default
 * config values. Unlike '__config.js' (typed as 'unknown' because it is
 * hand-edited after install), these defaults are trusted, so the default export
 * is typed as {@link Config}.
 */

/** An add-on rule: its default value and whether it is locked from in-game changes. */
export interface ConfigRule<T extends number | boolean> {
  readonly default: T;
  readonly lock: boolean;
}

/** The add-on config. */
export interface Config {
  readonly giveTutorialBookOnSpawn: boolean;
  readonly customCommandNamespace: string;
  readonly rules: {
    readonly wirelessInterfaceRange: ConfigRule<number>;
    readonly useEnergy: ConfigRule<boolean>;
    readonly deviceEnergyConsumption: ConfigRule<number>;
    readonly wirelessInterfaceEnergyConsumption: ConfigRule<number>;
    readonly relayMaxGlobalNamespaces: ConfigRule<number>;
    readonly relayMaxPlayerNamespaces: ConfigRule<number>;
    readonly relayMaxNamespaceNameChars: ConfigRule<number>;
    readonly relayMaxNamespacePlayerListCount: ConfigRule<number>;
  };
}

declare const defaultConfig: Config;
export default defaultConfig;
