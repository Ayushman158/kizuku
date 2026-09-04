import AsyncStorage from "@react-native-async-storage/async-storage";
import { personalityTypes, type PersonalityType } from "./productModel";

/**
 * On-device persistence.
 *
 * v2 keeps the reflection text, because the journal is a record you come back
 * and read. That is still on-device and nothing leaves the phone — the profile's
 * "on-device only" row stays true — but it is a deliberate widening of what is
 * kept, so it is worth naming here.
 *
 * What is still NEVER stored: the worry. It is the rawest thing the user types,
 * it is only needed to pick an action, and the journal has no use for it. Keep
 * it that way.
 *
 * Nothing here throws. A corrupt or older payload means "treat this as a fresh
 * install", never a crash on launch, so every read is guarded and every write is
 * fire-and-forget.
 */

const KEY = "kizuku.state.v2";
/** v1 kept only tags. Its entries are migrated with their text left empty. */
const KEY_V1 = "kizuku.state.v1";

/** One day's page in the journal. */
export type Entry = {
  /** "YYYY-MM-DD" local */
  date: string;
  /** the action's tag, e.g. "rest" */
  tag: string;
  /** what the user wrote afterwards — empty if they skipped it */
  text: string;
};

export type StoredState = {
  version: 2;
  personality: PersonalityType;
  actionsDone: number;
  /** newest last; the journal reads this */
  entries: Entry[];
  /** what the user called their tree. Optional: installs from before naming
      existed are still valid and simply have no name yet. */
  plantName?: string;
  /** "YYYY-MM-DD" in local time, or null if nothing has been completed */
  lastCompletedOn: string | null;
  onboarded: boolean;
};

/**
 * The local date, not UTC. Someone in IST finishing at 23:30 has completed
 * today, not tomorrow — toISOString() would get that wrong for half the world.
 */
export function todayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<Entry>;
  return (
    typeof entry.date === "string" && typeof entry.tag === "string" && typeof entry.text === "string"
  );
}

function isValid(value: unknown): value is StoredState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<StoredState>;
  return (
    state.version === 2 &&
    typeof state.personality === "string" &&
    state.personality in personalityTypes &&
    typeof state.actionsDone === "number" &&
    Number.isFinite(state.actionsDone) &&
    Array.isArray(state.entries) &&
    state.entries.every(isEntry) &&
    (state.lastCompletedOn === null || typeof state.lastCompletedOn === "string") &&
    (state.plantName === undefined || typeof state.plantName === "string") &&
    typeof state.onboarded === "boolean"
  );
}

/**
 * v1 stored a flat list of tags with no dates and no text. There is no way to
 * recover when each happened, so they are dated null-ish and left textless
 * rather than invented — a blank page is honest, a fabricated date is not.
 */
function migrateV1(raw: string): StoredState | null {
  try {
    const old = JSON.parse(raw) as Record<string, unknown>;
    if (old?.version !== 1) return null;
    const tags = Array.isArray(old.history) ? (old.history as unknown[]) : [];
    return {
      version: 2,
      personality: (typeof old.personality === "string" && old.personality in personalityTypes
        ? old.personality
        : "optimizer") as PersonalityType,
      actionsDone: typeof old.actionsDone === "number" ? old.actionsDone : 0,
      entries: tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => ({ date: "", tag, text: "" })),
      lastCompletedOn:
        typeof old.lastCompletedOn === "string" ? old.lastCompletedOn : null,
      onboarded: old.onboarded === true
    };
  } catch {
    return null;
  }
}

export async function loadState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) return parsed;
    }

    // nothing at v2 — an existing v1 install is carried forward once
    const legacy = await AsyncStorage.getItem(KEY_V1);
    if (legacy) {
      const migrated = migrateV1(legacy);
      if (migrated) {
        await saveState(migrated);
        await AsyncStorage.removeItem(KEY_V1);
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveState(next: StoredState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // a failed write must never interrupt the ritual
  }
}

export async function clearState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([KEY, KEY_V1]);
  } catch {
    // nothing to do — the caller resets in-memory state either way
  }
}
