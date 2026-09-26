import AsyncStorage from "@react-native-async-storage/async-storage";
import { personalityTypes, type PersonalityType } from "./productModel";

/**
 * On-device persistence.
 *
 * v3 records whether each action was actually done. v2 wrote an entry either
 * way, so declining one ("i didn't do it — that's ok") still planted a sprout
 * in the garden and added a journal page — a record of something that did not
 * happen. The flag lets each reader ask its own question: the journal and the
 * garden want what you did, action selection wants what you were last offered.
 *
 * Everything here stays on the phone — the profile's "on-device only" row is
 * still true. The reflection text is kept because the journal is a record you
 * come back and read.
 *
 * What is still NEVER stored: the worry. It is the rawest thing the user types.
 * It is read once, in memory, to pick an action, and then it is gone. Keep it
 * that way.
 *
 * Nothing here throws. A corrupt or older payload means "treat this as a fresh
 * install", never a crash on launch, so every read is guarded and every write is
 * fire-and-forget.
 */

const KEY = "kizuku.state.v3";
/** v2 had entries but no `done`. v1 kept only tags. */
const KEY_V2 = "kizuku.state.v2";
const KEY_V1 = "kizuku.state.v1";

/** One day's page in the journal. */
export type Entry = {
  /** "YYYY-MM-DD" local */
  date: string;
  /** the action's tag, e.g. "rest" */
  tag: string;
  /** what the user wrote afterwards — empty if they skipped it */
  text: string;
  /** whether they did the action. false means it was offered and declined. */
  done: boolean;
};

export type StoredState = {
  version: 3;
  personality: PersonalityType;
  actionsDone: number;
  /** newest last; the journal reads this */
  entries: Entry[];
  /** what the user called their tree. Optional: installs from before naming
      existed are still valid and simply have no name yet. */
  plantName?: string;
  /** the real plant chosen at thirty, once it has been claimed. Optional:
      unset until then, and absent from every save made before it existed. */
  realPlant?: string;
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
    typeof entry.date === "string" &&
    typeof entry.tag === "string" &&
    typeof entry.text === "string" &&
    typeof entry.done === "boolean"
  );
}

function isValid(value: unknown): value is StoredState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<StoredState>;
  return (
    state.version === 3 &&
    typeof state.personality === "string" &&
    state.personality in personalityTypes &&
    typeof state.actionsDone === "number" &&
    Number.isFinite(state.actionsDone) &&
    Array.isArray(state.entries) &&
    state.entries.every(isEntry) &&
    (state.lastCompletedOn === null || typeof state.lastCompletedOn === "string") &&
    (state.plantName === undefined || typeof state.plantName === "string") &&
    (state.realPlant === undefined || typeof state.realPlant === "string") &&
    typeof state.onboarded === "boolean"
  );
}

function personalityOr(value: unknown, fallback: PersonalityType): PersonalityType {
  return typeof value === "string" && value in personalityTypes
    ? (value as PersonalityType)
    : fallback;
}

/**
 * v2 entries carry no `done`, and which ones were declines is not recoverable —
 * v2 wrote both the same way. They are marked done: true rather than dropped:
 * an existing garden should not lose sprouts on upgrade, and over-counting a
 * few past declines is kinder than deleting a record someone has watched grow.
 */
function migrateV2(raw: string): StoredState | null {
  try {
    const old = JSON.parse(raw) as Record<string, unknown>;
    if (old?.version !== 2) return null;
    const entries = Array.isArray(old.entries) ? (old.entries as unknown[]) : [];
    return {
      version: 3,
      personality: personalityOr(old.personality, "optimizer"),
      actionsDone: typeof old.actionsDone === "number" ? old.actionsDone : 0,
      entries: entries
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => ({
          date: typeof entry.date === "string" ? entry.date : "",
          tag: typeof entry.tag === "string" ? entry.tag : "",
          text: typeof entry.text === "string" ? entry.text : "",
          done: true
        })),
      plantName: typeof old.plantName === "string" ? old.plantName : undefined,
      lastCompletedOn: typeof old.lastCompletedOn === "string" ? old.lastCompletedOn : null,
      onboarded: old.onboarded === true
    };
  } catch {
    return null;
  }
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
      version: 3,
      personality: personalityOr(old.personality, "optimizer"),
      actionsDone: typeof old.actionsDone === "number" ? old.actionsDone : 0,
      entries: tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => ({ date: "", tag, text: "", done: true })),
      lastCompletedOn: typeof old.lastCompletedOn === "string" ? old.lastCompletedOn : null,
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

    // nothing at v3 — an older install is carried forward once, newest first
    for (const [key, migrate] of [
      [KEY_V2, migrateV2],
      [KEY_V1, migrateV1]
    ] as const) {
      const legacy = await AsyncStorage.getItem(key);
      if (!legacy) continue;
      const migrated = migrate(legacy);
      if (migrated) {
        await saveState(migrated);
        await AsyncStorage.removeItem(key);
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
    await AsyncStorage.multiRemove([KEY, KEY_V2, KEY_V1]);
  } catch {
    // nothing to do — the caller resets in-memory state either way
  }
}
