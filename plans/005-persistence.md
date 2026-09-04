# 005 — Make the app remember you

- **Status**: TODO
- **Commit**: 4ad1ed7
- **Severity**: HIGH
- **Category**: Product — the gap between "the loop runs" and "shipped"
- **Estimated scope**: 1 new file (~120 lines), edits to `src/KizukuApp.tsx`, 1 dependency

## Problem

Kizuku forgets everything the moment it is closed. Relaunch and you are a new
person: back at the welcome screen, no type, no plant, no history. Every state
in `src/KizukuApp.tsx:93-102` lives only in React:

```tsx
export function KizukuApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [personality, setPersonality] = useState<PersonalityType>("optimizer");
  const [answers, setAnswers] = useState<PersonalityType[]>([]);
  const [worry, setWorry] = useState("");
  const [reflection, setReflection] = useState("");
  const [actionsDone, setActionsDone] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
```

This is the single largest gap between what the product does and what it claims.
The whole premise is a plant that grows a little each day; a plant that resets
every launch is a demo, not a product.

**Nothing is installed for storage.** `package.json` has no `async-storage`, no
`mmkv`, no `expo-secure-store`. This plan adds one dependency.

### Two traps this plan exists to avoid

**1. `todayCompleted` is a boolean with no date.** It is only ever set `true` on
completion (`:149`, `:221`) and `false` when a new run starts (`:178`). Persist
it as written and **"today is tended." becomes permanent** — the home card at
`:409-426` would never offer another action again, for the life of the install.
It has to become a *date*, compared against today, not a flag.

**2. The app promises privacy in three places** and the storage must not break
that promise:

- `src/KizukuApp.tsx:467` — placeholder: *"write anything. this stays private."*
- `src/KizukuApp.tsx:486` — *"private · stays on this device"*
- `src/KizukuApp.tsx:935` — profile row: privacy, *"on-device only"*

AsyncStorage **is** on-device, so persisting is consistent with the promise. But
note what the app already does right: `history` stores only `action.tag`
(`:148`), never the worry text. **Do not widen that.** Worry and reflection text
must stay in memory only.

## Target

A small typed persistence module and a hydration gate. No state manager, no
context — the app has exactly one stateful component.

### The stored shape

```ts
// src/storage.ts
export type StoredState = {
  version: 1;
  personality: PersonalityType;
  actionsDone: number;
  history: string[];        // action tags only — never worry or reflection text
  lastCompletedOn: string | null;  // "YYYY-MM-DD" local, or null
  onboarded: boolean;
};
```

**Persist**: `personality`, `actionsDone`, `history`, `lastCompletedOn`, `onboarded`.

**Never persist**: `worry`, `reflection` (privacy — see Trap 2), `answers` (only
needed to compute `personality`), `actionIndex`, `screen`.

### The API

```ts
const KEY = "kizuku.state.v1";

export async function loadState(): Promise<StoredState | null>;
export async function saveState(next: StoredState): Promise<void>;
export async function clearState(): Promise<void>;   // for the profile screen
```

`loadState` must **never throw**. Wrap the read, the `JSON.parse` and the shape
check in one try/catch and return `null` on anything unexpected — a corrupt or
older payload means "treat this as a fresh install", not a crash on launch.
Validate `version === 1` and that `personality` is a known key before trusting it.

`saveState` is fire-and-forget with a `.catch(() => {})`; a failed write must
never interrupt the ritual.

### "Today", correctly

```ts
export function todayKey(now = new Date()): string {
  // local date, not UTC — a user in IST finishing at 23:30 must not have it
  // count as the next day
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
```

`todayCompleted` becomes derived, not stored:

```tsx
const todayCompleted = lastCompletedOn === todayKey();
```

Completion sets `setLastCompletedOn(todayKey())` instead of
`setTodayCompleted(true)`. The "start a new run" reset at `:178` — currently
`setTodayCompleted(false)` — is **deleted**: a new run does not un-complete the
day, and the day rolls over on its own.

### Hydration, without a flash

The app must not paint the welcome screen and then jump to the garden. Gate the
first render:

```tsx
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  loadState().then((saved) => {
    if (saved) {
      setPersonality(saved.personality);
      setActionsDone(saved.actionsDone);
      setHistory(saved.history);
      setLastCompletedOn(saved.lastCompletedOn);
      if (saved.onboarded) setScreen("home");
    }
    setHydrated(true);
  });
}, []);
```

and return a bare themed ground — **not a spinner, and not the welcome screen** —
until `hydrated`:

```tsx
if (!hydrated) return <View style={[styles.stage, styles.hydrating]} />;
```

`styles.hydrating` is `{ backgroundColor: color.paper[50] }`. A read from
AsyncStorage is a few milliseconds; anything more elaborate would flash harder
than it hides.

### Writing

One effect, after hydration, that saves whenever the durable fields change:

```tsx
useEffect(() => {
  if (!hydrated) return;   // never write the defaults back over a real save
  saveState({
    version: 1,
    personality,
    actionsDone,
    history,
    lastCompletedOn,
    onboarded: true
  });
}, [hydrated, personality, actionsDone, history, lastCompletedOn]);
```

The `if (!hydrated) return` guard is load-bearing: without it the first render
writes `actionsDone: 0` over a real save before the read resolves.

`onboarded` is set `true` here because reaching a state worth saving means the
quiz is done. Do not add a separate setter.

### The dev jump must not corrupt real state

`src/KizukuApp.tsx:119-133` is a `__DEV__` URL jump that sets `personality` and
`actionsDone` from query params. With a save effect in place it would **write
those test values over a real install**. Add to the top of the save effect:

```tsx
if (__DEV__ && typeof window !== "undefined" && window.location.search) return;
```

## Repo conventions to follow

- **Types come from `src/productModel.ts`** — `PersonalityType`, `GrowthStage`.
  Import them; do not restate the union.
- **Colours from `src/tokens.ts`** (`color.paper[50]`). No literal hex.
- **Exemplar for a small typed module: `src/watering-logic.ts`.** It is
  dependency-free, pure, exports named functions with a documented constant, and
  is the house shape for "logic that is not a component". Follow it.
- **Async cleanup**: `src/KizukuApp.tsx:84-88` shows the house pattern for an
  effect with a subscription. A `loadState()` effect needs no cleanup, but do not
  set state after unmount — guard with a `cancelled` flag.
- Dependency to add: **`@react-native-async-storage/async-storage`**, installed
  with `npx expo install` (not plain `npm install`) so Expo picks the version
  matching SDK 57.

## Steps

1. `cd ~/Kizuku-app && npx expo install @react-native-async-storage/async-storage`
2. Create `src/storage.ts` with `StoredState`, `KEY`, `todayKey`, `loadState`,
   `saveState`, `clearState`, exactly as *Target* specifies.
3. In `src/KizukuApp.tsx`, replace the `todayCompleted` state with
   `const [lastCompletedOn, setLastCompletedOn] = useState<string | null>(null);`
   and derive `const todayCompleted = lastCompletedOn === todayKey();`.
4. Change `setTodayCompleted(true)` at `:149` and `:221` to
   `setLastCompletedOn(todayKey())`. **Delete** `setTodayCompleted(false)` at
   `:178`.
5. Add `hydrated` state and the hydration effect from *Target*.
6. Add the `styles.hydrating` gate before the main return.
7. Add the save effect, including the `!hydrated` guard and the `__DEV__` guard.
8. Wire `clearState()` to a "start over" row on `ProfileScreen` (function at
   `:908`) — it must clear storage **and** reset state to defaults and send the
   user to `welcome`. Put it behind a confirm (`Alert.alert` with a destructive
   style); this is the one irreversible action in the app.

## Boundaries

- **Do NOT persist `worry` or `reflection`.** Three lines of UI copy promise the
  user their writing stays on the device; storing only the tag is what makes that
  true today, and widening it is a product decision this plan does not have.
- **Do NOT persist `screen`.** Restoring someone mid-ritual — halfway through a
  worry they abandoned days ago — is worse than starting at the garden. `onboarded`
  sending them to `home` is the whole restoration.
- Do NOT add a state manager, context, or a reducer. One component owns this state.
- Do NOT touch the animation work from plans 002–004.
- Do NOT change any copy, colour, layout or the ritual's flow.
- Do NOT use `expo-secure-store` — this is not credential data, and its size
  limits and native prompts are the wrong trade.
- If a step does not match the code you find (drift since commit `4ad1ed7`), STOP
  and report.

## Verification

**Mechanical**
- `npx tsc --noEmit` → expect 0.
- `grep -n "worry\|reflection" src/storage.ts` → **no matches**. The privacy
  boundary is machine-checkable; check it.
- `grep -n "todayCompleted" src/KizukuApp.tsx` → should show only the derived
  const and its readers, never a setter.

**Behaviour — the point of the plan**
- Complete onboarding, do one action, force-quit, relaunch. You must land on the
  **garden**, with your type, your plant at the right stage, and no welcome screen.
- Relaunch again immediately: the home card still reads **"today is tended."**
- **The rollover test, which is what Trap 1 is about.** After completing a day,
  change the device clock to tomorrow and relaunch. The card must go back to
  *"what's on your mind today?"* and offer a new action. If it still says "tended",
  `lastCompletedOn` is being compared wrong or a boolean survived somewhere.
- Do a second action the next day and confirm `actionsDone` is 2 and the patterns
  screen shows both tags.
- **No flash on launch.** Watch the first 300ms: paper ground straight to the
  garden. If the welcome screen appears for a frame, the `hydrated` gate is wrong.
- **Fresh install still works**: clear storage, relaunch, and you get the welcome
  screen and the full quiz.
- **Corrupt payload does not crash.** Write junk into the key by hand
  (`AsyncStorage.setItem("kizuku.state.v1", "{oops")`) and relaunch: the app must
  treat it as a fresh install, not throw.
- **The dev jump is inert.** Open `?p=seeker&n=9` on web, then open the app with
  no query string: your real type and count must be intact, not seeker/9.
- **Start over** clears everything and returns to welcome, after a confirm.

**Done when**
- Closing and reopening the app preserves type, plant stage and history.
- The day rolls over correctly at local midnight.
- Worry and reflection text appear nowhere in storage.
- No welcome-screen flash on a returning launch, and no crash on a corrupt payload.
