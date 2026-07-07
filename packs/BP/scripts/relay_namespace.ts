import { Player, world } from "@minecraft/server";
import { err, ok, Result } from "neverthrow";
import {
  relayMaxGlobalNamespacesRule,
  relayMaxPlayerNamespacesRule,
} from "./addon_rules/addon_rules";

/**
 * A named group that relays can be assigned to. Relays bridge to every other
 * relay in the same namespace (see {@link relayNamespaceId} in `./relay`).
 * Namespaces are owned by a player and control which other players may assign
 * their relays to the namespace.
 */
export interface RelayNamespace {
  /** Globally unique, stable identifier. Relays store this on their entity. */
  id: string;
  /** Player-facing display name. */
  name: string;
  /** ID of the player who owns (created) this namespace. */
  owner: string;
  /**
   * Display name of the owner, captured at creation. Stored separately because
   * a player id cannot be resolved back to a name while that player is offline.
   */
  ownerName: string;
  /** Player names explicitly allowed access (used when not {@link open}). */
  allowlist: string[];
  /** Player names explicitly denied access. Overrides {@link open}/allowlist. */
  denylist: string[];
  /** If `true`, all players may access except those in {@link denylist}. */
  open: boolean;
}

/** Configuration for {@link createRelayNamespace}. */
export interface CreateRelayNamespaceConfig {
  name: string;
  open: boolean;
  allowlist: string[];
  denylist: string[];
}

/** An error from a namespace write (create or update). */
export type RelayNamespaceWriteError =
  | "globalLimitReached"
  | "playerLimitReached"
  | "storageFull"
  | "notFound";

/** World dynamic property the {@link RegistryData} is serialized to. */
const REGISTRY_PROPERTY = "fluffyalien_asn:relay_namespaces";

/**
 * Maximum serialized length of the registry. This is a hard, non-configurable
 * limit kept safely below the 32,767 character dynamic property cap; a write
 * that would exceed it is rejected rather than throwing on the dynamic property
 * write. The configurable namespace count limits (see addon rules) are normally
 * hit first, but this also guards against large allow/deny lists.
 */
const MAX_REGISTRY_LENGTH = 32000;

interface RegistryData {
  /** Monotonic counter backing namespace id allocation. */
  nextId: number;
  /** All namespaces, keyed by {@link RelayNamespace.id}. */
  namespaces: Record<string, RelayNamespace>;
}

function loadRegistry(): RegistryData {
  const raw = world.getDynamicProperty(REGISTRY_PROPERTY);
  if (typeof raw !== "string") {
    return { nextId: 0, namespaces: {} };
  }

  try {
    return JSON.parse(raw) as RegistryData;
  } catch {
    return { nextId: 0, namespaces: {} };
  }
}

function saveRegistry(data: RegistryData): void {
  world.setDynamicProperty(REGISTRY_PROPERTY, JSON.stringify(data));
}

/**
 * Serializes and saves the registry, returning `false` without writing if the
 * result would exceed {@link MAX_REGISTRY_LENGTH}. Use this for writes that grow
 * the registry; deletions can use {@link saveRegistry} directly since they only
 * shrink it (and must always succeed so storage can be freed).
 */
function trySaveRegistry(data: RegistryData): boolean {
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_REGISTRY_LENGTH) return false;

  world.setDynamicProperty(REGISTRY_PROPERTY, serialized);
  return true;
}

/** @returns the namespace with the given id, or `undefined` if none exists. */
export function getRelayNamespace(id: string): RelayNamespace | undefined {
  return loadRegistry().namespaces[id];
}

/** @returns every namespace owned by the given player id. */
export function getRelayNamespacesByOwner(ownerId: string): RelayNamespace[] {
  return Object.values(loadRegistry().namespaces).filter(
    (ns) => ns.owner === ownerId,
  );
}

/**
 * @returns `true` if `player` may assign their relays to `namespace`. The owner
 *   always has access; otherwise the denylist takes precedence, then `open`
 *   grants everyone access, and finally the allowlist is consulted.
 */
export function canAccessRelayNamespace(
  player: Player,
  namespace: RelayNamespace,
): boolean {
  if (namespace.owner === player.id) return true;
  if (namespace.denylist.includes(player.name)) return false;
  if (namespace.open) return true;
  return namespace.allowlist.includes(player.name);
}

/** @returns every namespace the given player may access. */
export function getAccessibleRelayNamespaces(player: Player): RelayNamespace[] {
  return Object.values(loadRegistry().namespaces).filter((ns) =>
    canAccessRelayNamespace(player, ns),
  );
}

/**
 * Creates a new namespace owned by `owner` and persists it.
 * @returns the created namespace, or an error if the global or per-player
 *   namespace limit has been reached, or the registry is full
 */
export function createRelayNamespace(
  owner: Player,
  config: CreateRelayNamespaceConfig,
): Result<RelayNamespace, RelayNamespaceWriteError> {
  const registry = loadRegistry();
  const all = Object.values(registry.namespaces);

  if (all.length >= relayMaxGlobalNamespacesRule.safeGet()) {
    return err("globalLimitReached");
  }

  const ownedCount = all.filter((ns) => ns.owner === owner.id).length;
  if (ownedCount >= relayMaxPlayerNamespacesRule.safeGet()) {
    return err("playerLimitReached");
  }

  const id = (registry.nextId++).toString();

  const namespace: RelayNamespace = {
    id,
    name: config.name,
    owner: owner.id,
    ownerName: owner.name,
    allowlist: config.allowlist,
    denylist: config.denylist,
    open: config.open,
  };

  registry.namespaces[id] = namespace;

  if (!trySaveRegistry(registry)) {
    return err("storageFull");
  }

  return ok(namespace);
}

/**
 * Updates the configurable fields of an existing namespace, leaving its id and
 * owner untouched.
 * @returns the updated namespace, or an error if no namespace has that id or the
 *   registry would no longer fit
 */
export function updateRelayNamespace(
  id: string,
  config: CreateRelayNamespaceConfig,
): Result<RelayNamespace, RelayNamespaceWriteError> {
  const registry = loadRegistry();

  if (!(id in registry.namespaces)) return err("notFound");

  const namespace = registry.namespaces[id];
  namespace.name = config.name;
  namespace.open = config.open;
  namespace.allowlist = config.allowlist;
  namespace.denylist = config.denylist;

  if (!trySaveRegistry(registry)) {
    return err("storageFull");
  }

  return ok(namespace);
}

/** Removes the namespace with the given id from the registry, if it exists. */
export function deleteRelayNamespace(id: string): void {
  const registry = loadRegistry();
  if (!(id in registry.namespaces)) return;

  delete registry.namespaces[id];

  saveRegistry(registry);
}
