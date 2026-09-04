import AsyncStorage from "@react-native-async-storage/async-storage";
import { personalityTypes, type PersonalityType } from "./productModel";

/**
 * On-device persistence.
 *
 * The app tells the user three times that what they write stays on this device
 * — the worry placeholder, the line under the input, and the privacy row on the
 * profile. Today that is true because history keeps only the action's tag and
 * never the worry itself. This module keeps it that way: `worry` and
 * `reflection` are deliberately absent from StoredState and must stay absent.
 *
 * Nothing here throws. A corrupt or older payload means "treat this as a fresh
 * install", never a crash on launch, so every read is guarded and every write is
 * fire-and-forget.
 */

const KEY = "kizuku.state.v1";

export type StoredState = {
  version: 1;
  personality: PersonalityType;
  actionsDone: number;
  /** action tags only — never the worry or reflection text */
  history: string[];
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

function isValid(value: unknown): value is StoredState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<StoredState>;
  return (
    state.version === 1 &&
    typeof state.personality === "string" &&
    state.personality in personalityTypes &&
    typeof state.actionsDone === "number" &&
    Number.isFinite(state.actionsDone) &&
    Array.isArray(state.history) &&
    state.history.every((tag) => typeof tag === "string") &&
    (state.lastCompletedOn === null || typeof state.lastCompletedOn === "string") &&
    typeof state.onboarded === "boolean"
  );
}

export async function loadState(): Promise<StoredState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
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
    await AsyncStorage.removeItem(KEY);
  } catch {
    // nothing to do — the caller resets in-memory state either way
  }
}
