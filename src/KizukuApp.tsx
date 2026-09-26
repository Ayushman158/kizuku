import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Asset } from "expo-asset";
import { LinearGradient } from "expo-linear-gradient";
import {
  actionTemplates,
  chooseAction,
  nextAction,
  startersFor,
  personalityTypes,
  quiz,
  stageFor,
  stageThresholds,
  typeFrom,
  type GrowthStage,
  type PersonalityType
} from "./productModel";
import { clearState, loadState, saveState, todayKey, type Entry } from "./storage";
import { journalPages } from "./journal";
import { themes } from "./tokens";
import { color, elevation, font, ink, motion, radius, space, stamp, target, text } from "./tokens";
import { Icon, type IconName } from "./Icon";
import { ThinkingOrb } from "./ThinkingOrb";
import { Watering } from "./Watering";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { HoldButton } from "./HoldButton";
import { Rays } from "./Rays";
import { GrowthSequence, preloadGrowthFrames } from "./GrowthSequence";
import Svg, { Circle, G, Path } from "react-native-svg";
import KizukuMark from "../assets/kizuku-mark.svg";
import WateringCan from "../assets/kizuku-watering-can.svg";

type Screen =
  | "welcome"
  | "promise"
  | "quiz"
  | "reveal"
  | "naming"
  | "home"
  | "worry"
  | "thinking"
  | "action"
  | "committing"
  | "reflection"
  | "growth"
  | "patterns"
  | "profile";

type MainTab = "home" | "patterns" | "profile";

const assets = {
  background: require("../assets/garden-background.png")
};

/**
 * The ragged top of a slip torn from a pad. Stretched to the card's width with
 * preserveAspectRatio="none", so the peaks stay put whatever the screen is.
 */
const TORN_EDGE =
  "M0 13 L0 5 L17 1.5 L36 6.5 L54 1 L73 5 L91 1.5 L110 7 L128 1 " +
  "L147 4.5 L165 1.5 L184 6.5 L202 1 L221 5 L239 1.5 L258 6 L276 1.5 " +
  "L300 4 L300 13 Z";

/*
 * How far the soil line sits above the bottom of the garden. Everything in the
 * scene is measured from it, the watering can included, so the composition
 * keeps its footing whatever the screen height.
 *
 * The art used to be measured from the top (a ground line at 565) while the
 * prompt card was measured from the bottom. In a browser the container is the
 * whole viewport and the two cleared each other; on a device SafeAreaView takes
 * roughly 93pt of insets out of that container, and the card climbed into the
 * plant and the watering can.
 */
const GROUND_ABOVE_FLOOR = 280;

/** Height of the nav's row of icons, before any home-indicator inset below it. */
const NAV_CONTENT = 82;

/** ray bursts, sized to overflow the screen edge so they never show a rim */
const REVEAL_RAYS = 460;
const GROWTH_RAYS = 600;

/**
 * Every type's tree at each of its six stages, straight from the design file.
 * Indexed by stage - 1, so plantFor() is the only place that arithmetic lives.
 */
const plants = {
  optimizer: [
    require("../assets/stages/optimiser-1.png"),
    require("../assets/stages/optimiser-2.png"),
    require("../assets/stages/optimiser-3.png"),
    require("../assets/stages/optimiser-4.png"),
    require("../assets/stages/optimiser-5.png"),
    require("../assets/stages/optimiser-6.png")
  ],
  seeker: [
    require("../assets/stages/seeker-1.png"),
    require("../assets/stages/seeker-2.png"),
    require("../assets/stages/seeker-3.png"),
    require("../assets/stages/seeker-4.png"),
    require("../assets/stages/seeker-5.png"),
    require("../assets/stages/seeker-6.png")
  ],
  planner: [
    require("../assets/stages/planner-1.png"),
    require("../assets/stages/planner-2.png"),
    require("../assets/stages/planner-3.png"),
    require("../assets/stages/planner-4.png"),
    require("../assets/stages/planner-5.png"),
    require("../assets/stages/planner-6.png")
  ]
} as const;

function plantFor(personality: PersonalityType, stage: GrowthStage) {
  return plants[personality][stage - 1]!;
}

function useReduceMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}

export function KizukuApp() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [personality, setPersonality] = useState<PersonalityType>("optimizer");
  const [answers, setAnswers] = useState<PersonalityType[]>([]);
  const [worry, setWorry] = useState("");
  const [reflection, setReflection] = useState("");
  const [actionsDone, setActionsDone] = useState(0);
  /*
   * A date, not a flag. As a boolean this could only ever be set true, so a
   * persisted "today is tended." would have been permanent and the app would
   * never have offered another action again. Stored as a local YYYY-MM-DD and
   * compared against today, it rolls over at midnight on its own.
   */
  const [lastCompletedOn, setLastCompletedOn] = useState<string | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [plantName, setPlantName] = useState<string>("");

  const todayCompleted = lastCompletedOn === todayKey();

  const action = actionTemplates[actionIndex % actionTemplates.length]!;

  /*
   * Three real inputs: who you are, what you wrote, and what you have already
   * been given. It used to be one fake one — the worry's character codes summed
   * and taken modulo six, which the thinking screen dressed up as deliberation
   * while personality was not consulted at all.
   *
   * The worry is read here and nowhere else. It is not stored, and it never
   * leaves this function.
   */
  const pickAction = () => {
    setActionIndex(chooseAction(personality, entries.map((entry) => entry.tag), worry));
    setScreen("thinking");
  };

  const openTab = (tab: MainTab) => setScreen(tab);

  /** True while a __DEV__ URL jump is driving state, so it is never written back. */
  /*
   * React Native defines a global `window`, so a `typeof window` check passes on
   * device and then `window.location` — which does not exist there — throws
   * during render. Gate on the platform, and read location defensively.
   */
  const devQuery =
    __DEV__ && Platform.OS === "web" ? (globalThis.location?.search ?? "") : "";
  const devJump = devQuery.length > 0;

  /*
   * Read once on launch. A returning user goes straight to the garden.
   *
   * The dev jump sets state synchronously on mount; this resolves after it, so a
   * saved install would otherwise win every field it touches — ?p=planner&n=0
   * would render whatever type and stage happen to be on the device. When a jump
   * is driving, the save is read only far enough to mark hydration done.
   */
  useEffect(() => {
    let cancelled = false;
    loadState().then(async (saved) => {
      if (cancelled) return;
      if (saved && !devJump) {
        setPersonality(saved.personality);
        setActionsDone(saved.actionsDone);
        setEntries(saved.entries);
        setLastCompletedOn(saved.lastCompletedOn);
        setOnboarded(saved.onboarded);
        setPlantName(saved.plantName ?? "");
        if (saved.onboarded) setScreen("home");
      }

      /*
       * Warm the garden's images before showing it. Without this the screen
       * appeared first and the landscape and the plant faded in behind it a
       * beat later, so the first thing a returning user saw was their garden
       * assembling itself — sometimes just a watering can on an empty field.
       *
       * Only what the first screen needs: the landscape, the stage they are on,
       * and the next one, because growth cuts to it. A failure here is not
       * worth blocking launch over — the images still load, just later.
       */
      const type = saved?.personality ?? "optimizer";
      const stage = stageFor(saved?.actionsDone ?? 0);
      await Asset.loadAsync([
        assets.background,
        plants[type][stage - 1]!,
        plants[type][Math.min(stage, 5)]!
      ]).catch(() => {});
      if (cancelled) return;

      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [devJump]);

  /*
   * Write on change, but never before the read resolves — without the guard the
   * first render would put actionsDone: 0 over a real save. The dev jump is
   * excluded too: ?p=seeker&n=9 must not overwrite somebody's actual install.
   */
  useEffect(() => {
    // Nothing is written until the quiz is finished. onboarded has to be real
    // state, not a hardcoded true: writing true on first paint marked a brand
    // new user as onboarded before they had answered anything, and they never
    // saw the welcome screen again.
    if (!hydrated || devJump || !onboarded) return;
    saveState({
      version: 3,
      personality,
      actionsDone,
      entries,
      lastCompletedOn,
      onboarded,
      plantName: plantName || undefined
    });
  }, [hydrated, devJump, onboarded, personality, actionsDone, entries, lastCompletedOn, plantName]);

  /**
   * Dev-only: jump straight to a screen. Used for capturing the real UI and
   * for reaching a state by hand without walking the whole loop. __DEV__ is
   * false in release builds, so this cannot ship.
   */
  useEffect(() => {
    if (!devJump) return;
    const q = new URLSearchParams(devQuery);
    const p = q.get("p") as PersonalityType | null;
    const n = q.get("n");
    const w = q.get("w");
    const target = q.get("s") as Screen | null;
    if (p && p in personalityTypes) setPersonality(p);
    if (n) setActionsDone(Number(n) || 0);
    if (w) {
      setWorry("i keep worrying that i will not finish this in time.");
      setReflection("i did it, and it was smaller than i feared.");
    }
    if (target) setScreen(target);
    // devQuery and devJump are constant for the life of the screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQuiz = () => {
    setAnswers([]);
    setScreen("quiz");
  };

  const finishQuiz = (given: PersonalityType[]) => {
    setAnswers(given);
    setPersonality(typeFrom(given));
    setOnboarded(true);
    setScreen("reveal");
  };

  const completeReflection = () => {
    setActionsDone((count) => count + 1);
    // the page the journal will show: what you did, and what you said about it
    setEntries((pages) => [...pages, { date: todayKey(), tag: action.tag, text: reflection.trim(), done: true }]);
    setLastCompletedOn(todayKey());
    setScreen("growth");
  };

  // A read is a few milliseconds; anything more elaborate would flash harder
  // than it hides. Never render "welcome" before we know whether they are new.
  if (!hydrated) {
    return (
      <View style={styles.stage}>
        <View style={[styles.device, styles.hydrating]} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.stage}>
      <View style={styles.device}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          {screen === "welcome" ? <WelcomeScreen onBegin={() => setScreen("promise")} /> : null}

          {screen === "promise" ? (
            <PromiseScreen onBegin={startQuiz} onBack={() => setScreen("welcome")} />
          ) : null}

          {screen === "quiz" ? (
            <QuizScreen onDone={finishQuiz} onBack={() => setScreen("promise")} />
          ) : null}

          {screen === "reveal" ? (
            <RevealScreen personality={personality} onDone={() => setScreen("naming")} />
          ) : null}

          {screen === "naming" ? (
            <NamingScreen
              personality={personality}
              current={plantName}
              onDone={(name) => {
                // retaking the quiz passes through here too; an empty answer
                // ("i will name it later") keeps the name the tree already has
                setPlantName(name || plantName);
                setScreen("home");
              }}
            />
          ) : null}

          {screen === "home" ? (
            <HomeScreen
              personality={personality}
              actionsDone={actionsDone}
              todayCompleted={todayCompleted}
              plantName={plantName}
              onStart={() => {
                setWorry("");
                setReflection("");
                setScreen("worry");
              }}
              onTab={openTab}
              onProfile={() => setScreen("profile")}
            />
          ) : null}

          {screen === "worry" ? (
            <WorryScreen
              personality={personality}
              value={worry}
              onChange={setWorry}
              onBack={() => setScreen("home")}
              onContinue={pickAction}
              onTab={openTab}
            />
          ) : null}

          {screen === "thinking" ? <ThinkingScreen personality={personality} onDone={() => setScreen("action")} /> : null}

          {screen === "action" ? (
            <ActionScreen
              personality={personality}
              action={action}
              onBack={() => setScreen("home")}
              onCommit={() => setScreen("committing")}
              onSwap={() => setActionIndex((index) => nextAction(personality, index))}
              onTab={openTab}
            />
          ) : null}

          {screen === "committing" ? (
            <CommittingScreen personality={personality} onDone={() => setScreen("reflection")} />
          ) : null}

          {screen === "reflection" ? (
            <ReflectionScreen
              personality={personality}
              value={reflection}
              onChange={setReflection}
              onBack={() => setScreen("action")}
              /*
               * "i didn't do it — that's ok". The entry is kept so the same
               * action is not handed straight back tomorrow, but it is marked
               * undone: it plants no sprout, writes no journal page, and does
               * not mark the day tended, which is what the home screen would
               * otherwise say to someone who just told us the opposite.
               */
              onSkip={() => {
                setEntries((pages) => [...pages, { date: todayKey(), tag: action.tag, text: "", done: false }]);
                setScreen("home");
              }}
              onContinue={completeReflection}
              onTab={openTab}
            />
          ) : null}

          {screen === "growth" ? (
            <GrowthScreen personality={personality} actionsDone={actionsDone} onDone={() => setScreen("home")} />
          ) : null}

          {screen === "patterns" ? (
            <PatternsScreen
              personality={personality}
              actionsDone={actionsDone}
              entries={entries}
              onTab={openTab}
            />
          ) : null}

          {screen === "profile" ? (
            <ProfileScreen
              personality={personality}
              actionsDone={actionsDone}
              onRetake={startQuiz}
              onTab={openTab}
              onReset={() => {
                /*
                 * This used to clear memory that was about to be lost anyway.
                 * Now it deletes something the user has actually accumulated, so
                 * it asks first. The type is kept — "retake personality quiz"
                 * directly above is the control for changing that.
                 */
                Alert.alert(
                  "Reset your progress?",
                  "Your plant goes back to a seed and your history is cleared. Your type stays. This cannot be undone.",
                  [
                    { text: "Keep it", style: "cancel" },
                    {
                      text: "Reset",
                      style: "destructive",
                      onPress: () => {
                        clearState();
                        setWorry("");
                        setReflection("");
                        setActionsDone(0);
                        setEntries([]);
                        setLastCompletedOn(null);
                        setPlantName("");
                        setScreen("home");
                      }
                    }
                  ]
                );
              }}
            />
          ) : null}
        </KeyboardAvoidingView>
      </View>
      </View>
    </SafeAreaProvider>
  );
}

function HomeScreen({
  personality,
  actionsDone,
  todayCompleted,
  plantName,
  onStart,
  onTab,
  onProfile
}: {
  personality: PersonalityType;
  actionsDone: number;
  todayCompleted: boolean;
  plantName: string;
  onStart: () => void;
  onTab: (tab: MainTab) => void;
  onProfile: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const { width } = useWindowDimensions();
  const stage = stageFor(actionsDone);
  const landscapeDrift = useRef(new Animated.Value(0)).current;
  const treeBreath = useRef(new Animated.Value(0)).current;
  const treeResponse = useRef(new Animated.Value(0)).current;
  const promptEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    promptEntrance.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    Animated.timing(promptEntrance, {
      toValue: 1,
      duration: motion.enterSoft,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    const landscapeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(landscapeDrift, {
          toValue: 1,
          duration: motion.ambientDrift,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(landscapeDrift, {
          toValue: 0,
          duration: motion.ambientDrift,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    const treeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(treeBreath, {
          toValue: 1,
          duration: motion.ambientBreath,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(treeBreath, {
          toValue: 0,
          duration: motion.ambientBreath,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );

    landscapeLoop.start();
    treeLoop.start();
    return () => {
      landscapeLoop.stop();
      treeLoop.stop();
    };
  }, [landscapeDrift, promptEntrance, reduceMotion, treeBreath]);

  const waterTree = () => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.timing(treeResponse, {
        toValue: 1,
        duration: motion.reactTap,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.spring(treeResponse, {
        toValue: 0,
        ...motion.reactSpring,
        useNativeDriver: true
      })
    ]).start();
  };

  // where the plant sits relative to the can, so a flick can be aimed at it
  const canvasWidth = Math.min(width, 430);
  const frame = heroFrames[personality][stage - 1]!;
  // from the can's centre to the plant's, both now measured up from the floor
  const reach = {
    dx: (frame.left ?? 0) + frame.width / 2 - (canvasWidth - 154 / 2),
    dy: GROUND_ABOVE_FLOOR - 17 + 162 / 2 - (GROUND_ABOVE_FLOOR + frame.height / 2)
  };

  const backgroundTranslate = landscapeDrift.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const treeScale = treeBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const treeReactionScale = treeResponse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });
  const promptTranslate = promptEntrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={styles.homeRoot}>
      <Animated.Image
        source={assets.background}
        resizeMode="stretch"
        style={[styles.homeBackground, { transform: [{ translateX: backgroundTranslate }] }]}
      />
      <View style={[styles.homeHeader, { paddingTop: insets.top + space.md }]}>
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <KizukuMark width={34} height={34} />
            <Text style={styles.brandName}>kizuku</Text>
          </View>
          <StageMeter
            actionsDone={actionsDone}
            name={plantName || personalityTypes[personality].plant}
          />
        </View>
        <IconButton icon="person" label="Open profile" onPress={onProfile} />
      </View>

      <Animated.View
        style={[
          heroStageStyle(personality, stage),
          { transform: [{ scale: treeScale }, { scale: treeReactionScale }] }
        ]}
      >
        <Image source={plantFor(personality, stage)} resizeMode="contain" style={styles.heroTreeImage} />
      </Animated.View>

      <Watering reach={reach} onWater={waterTree} style={styles.heroWateringCan} />

      <Animated.View
        style={[
          styles.homeCardMotion,
          { opacity: promptEntrance, transform: [{ translateY: promptTranslate }] }
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={({ pressed }) => [
            styles.homeCard,
            todayCompleted && styles.homeCardCompleted,
            pressed && { transform: [{ translateY: 3 }], ...stamp(todayCompleted ? color.forest[700] : ink.edge, 2) }
          ]}
        >
          <View style={styles.homeCardCopy}>
            <Text style={[styles.homeCardTitle, todayCompleted && styles.inverseText]}>
              {todayCompleted ? "today is tended." : "what's on your mind today?"}
            </Text>
            <Text style={[styles.homeCardBody, todayCompleted && styles.inverseMuted]}>
              {todayCompleted
                ? "if something else comes up, you can go again."
                : "share a worry and get your action"}
            </Text>
          </View>
          <View style={[styles.cardBadge, todayCompleted && styles.cardBadgeDone]}>
            <Icon
              name={todayCompleted ? "checkmark" : "arrow-forward"}
              size={20}
              weight={2.2}
              color={todayCompleted ? color.forest[600] : "#FFFFFF"}
            />
          </View>
        </Pressable>
      </Animated.View>

      <BottomNav active="home" onSelect={onTab} />
    </View>
  );
}

function WorryScreen({
  personality,
  value,
  onChange,
  onBack,
  onContinue,
  onTab
}: {
  personality: PersonalityType;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onTab: (tab: MainTab) => void;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const starters = useMemo(() => startersFor(personality), [personality]);

  /*
   * A suggestion fills the slip and hands over the keyboard with the cursor at
   * the end, so it reads as a start the user finishes, not an answer chosen
   * for them.
   */
  const startFrom = (text: string) => {
    onChange(text);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <GradientScreen personality={personality}>
      {/*
        Scrolls, like the reflection screen, because the keyboard takes half the
        screen once it is up. Everything used to
        sit in a fixed column: KeyboardAvoidingView's padding shrank the
        container, nothing inside could yield (the slip's height is a
        minHeight), and the content overflowed instead of moving, cutting "get
        my action" in half. A keyboard's height is not a constant to design
        around — predictive text, third-party keyboards and larger type all
        change it — so the content scrolls rather than being fitted to one.
        keyboardShouldPersistTaps means the button takes the first tap instead
        of spending it dismissing the keyboard.
      */}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.worryScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={onBack} />
        <View style={styles.flowHeading}>
          <Eyebrow>today</Eyebrow>
          <Text style={styles.flowTitle}>what future worry is on your mind right now?</Text>
        </View>

        <Slip note="be specific. the more honest you are, the better your action will be." personality={personality} focused={focused}>
          {/*
            No autoFocus. It used to raise the keyboard the moment the screen
            appeared, which covered everything below the slip — and below the
            slip is now where the suggestions are. Finch leaves its goal box
            unfocused for the same reason. Tapping the slip or a suggestion
            brings the keyboard up.
          */}
          <TextInput
            ref={inputRef}
            accessibilityLabel="Future worry"
            multiline
            onBlur={() => setFocused(false)}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            placeholder="write anything. this stays private."
            placeholderTextColor={color.stone[500]}
            style={styles.input}
            textAlignVertical="top"
            value={value}
          />
        </Slip>

        {value.trim().length === 0 ? (
          <View style={styles.starters}>
            <Eyebrow>a place to start</Eyebrow>
            {starters.map((text) => (
              <Pressable
                key={text}
                accessibilityHint="Starts your worry with this, for you to finish"
                accessibilityRole="button"
                onPress={() => startFrom(text)}
                style={({ pressed }) => [styles.starter, pressed && styles.stampPressed]}
              >
                <Text style={styles.starterText}>{text}</Text>
                <Icon name="arrow-forward" size={16} color={color.forest[500]} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.inlineAction}>
          <PrimaryButton label="get my action" disabled={value.trim().length < 4} onPress={onContinue} />
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

function ThinkingScreen({ personality, onDone }: { personality: PersonalityType; onDone: () => void }) {
  const [secondLine, setSecondLine] = useState(false);
  const reduceMotion = useReduceMotionPreference();
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const reveal = setTimeout(() => setSecondLine(true), 900);
    const finish = setTimeout(onDone, 2100);

    if (reduceMotion) {
      return () => {
        clearTimeout(reveal);
        clearTimeout(finish);
      };
    }

    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    breathing.start();
    return () => {
      clearTimeout(reveal);
      clearTimeout(finish);
      breathing.stop();
    };
  }, [breathe, onDone, reduceMotion]);

  const figureLift = breathe.interpolate({ inputRange: [0, 1], outputRange: [2, -2] });

  return (
    <LinearGradient colors={ritualGround(personality)} style={[styles.flex, styles.center]}>
      <Animated.View style={[styles.thinkingOrb, { transform: [{ translateY: figureLift }] }]}>
        <ThinkingOrb personality={personality} size={124} />
      </Animated.View>
      <Text style={styles.thinkingText}>sitting with what you wrote…</Text>
      <Text style={[styles.thinkingText, !secondLine && styles.hidden]}>picking one small thing…</Text>
    </LinearGradient>
  );
}

function ActionScreen({
  personality,
  action,
  onBack,
  onCommit,
  onSwap,
  onTab
}: {
  personality: PersonalityType;
  action: (typeof actionTemplates)[number];
  onBack: () => void;
  onCommit: () => void;
  onSwap: () => void;
  onTab: (tab: MainTab) => void;
}) {
  const reduceMotion = useReduceMotionPreference();
  const cardAnim = useRef(new Animated.Value(1)).current;

  const handleSwap = () => {
    if (reduceMotion) {
      onSwap();
      return;
    }
    Animated.timing(cardAnim, {
      toValue: 0,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start(({ finished }) => {
      // a second tap retargets the value and fires this callback with
      // finished:false — without the guard the interrupted run would swap and
      // fade in while the newer fade-out is still going
      if (!finished) return;
      onSwap();
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    });
  };

  return (
    <GradientScreen personality={personality}>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <View style={styles.flowHeading}>
          <Eyebrow>your action for today</Eyebrow>
          <Text style={styles.flowTitle}>one thing. right now.</Text>
        </View>

        <Animated.View
          style={[
            styles.actionCard,
            {
              opacity: cardAnim,
              transform: [
                {
                  translateY: cardAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0]
                  })
                }
              ]
            }
          ]}
        >
          <View style={styles.actionTag}>
            <Icon name="sparkles" size={15} weight={1.8} fill={pigment.amber} color={color.forest[600]} />
            <Text style={styles.actionTagText}>{action.tag}</Text>
          </View>
          <Text style={styles.actionCopy}>{action.text}</Text>
          <View style={styles.actionNote}>
            <Text style={styles.inputNoteText}>
              five minutes is enough. how well you do it doesn't matter.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.inlineActionStack}>
          <HoldButton label="i'll do it now" onComplete={onCommit} />
          <SecondaryButton label="this doesn't feel right" onPress={handleSwap} />
        </View>
      </View>
    </GradientScreen>
  );
}

function CommittingScreen({ personality, onDone }: { personality: PersonalityType; onDone: () => void }) {
  const reduceMotion = useReduceMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const duration = reduceMotion ? 350 : 1900;
    const progressAnimation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    });
    progressAnimation.start(({ finished }) => finished && onDone());
    return () => progressAnimation.stop();
  }, [onDone, progress, reduceMotion]);

  // width cannot be native-driven, so a full-width fill is translated instead — the
  // same move as HoldButton's progress line. This runs while GrowthScreen preloads
  // 26 frames, which is exactly when the JS thread has nothing to spare.
  const fillTransform = trackWidth
    ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth, 0] }) }]
    : [{ translateX: -9999 }];
  return (
    <LinearGradient colors={ritualGround(personality)} style={[styles.flex, styles.commitRoot]}>
      <View style={styles.commitCopy}>
        <Eyebrow>tending</Eyebrow>
        <Text style={styles.commitTitle}>a small thing,{"\n"}done with attention.</Text>
      </View>
      <View
        style={styles.progressTrack}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.progressFill, { width: "100%", transform: fillTransform }]} />
      </View>
    </LinearGradient>
  );
}

function ReflectionScreen({
  personality,
  value,
  onChange,
  onBack,
  onSkip,
  onContinue,
  onTab
}: {
  personality: PersonalityType;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onTab: (tab: MainTab) => void;
}) {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    preloadGrowthFrames();
  }, []);

  return (
    <GradientScreen personality={personality}>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.reflectionScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>you came back</Eyebrow>
          <Text style={styles.flowTitle}>what happened when you did it?</Text>
          <Slip note="your plant grows after you answer this." personality={personality} focused={focused}>
            <TextInput
              accessibilityLabel="Reflection"
              multiline
              onBlur={() => setFocused(false)}
              onChangeText={onChange}
              onFocus={() => setFocused(true)}
              placeholder="no judgement. just what happened."
              placeholderTextColor={color.stone[500]}
              style={styles.input}
              textAlignVertical="top"
              value={value}
            />
          </Slip>
          <View style={styles.inlineAction}>
            <PrimaryButton
              label="my plant is ready to grow"
              disabled={value.trim().length < 3}
              onPress={onContinue}
            />
          </View>
          <Pressable onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>i didn't do it — that's ok</Text>
          </Pressable>
        </ScrollView>
      </View>
    </GradientScreen>
  );
}

function GrowthScreen({
  personality,
  actionsDone,
  onDone
}: {
  personality: PersonalityType;
  actionsDone: number;
  onDone: () => void;
}) {
  const reduceMotion = useReduceMotionPreference();
  const previous = stageFor(actionsDone - 1);
  const current = stageFor(actionsDone);
  const transforms = previous !== current;

  const [grown, setGrown] = useState(false);
  const rise = useRef(new Animated.Value(0)).current;
  const settleIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      setGrown(true);

      if (reduceMotion) {
        rise.setValue(1);
        settleIn.setValue(1);
        return;
      }

      Animated.parallel([
        // the plant rises from where the seed stood — same ground, same centre
        Animated.spring(rise, { toValue: 1, ...motion.growSpring, useNativeDriver: true }),
        Animated.timing(settleIn, {
          toValue: 1,
          duration: 420,
          delay: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start();
    }, 900);

    return () => clearTimeout(timer);
  }, [reduceMotion, rise, settleIn]);

  // when the stage has not changed there is nothing to transform into, so the
  // plant acknowledges instead of pretending — the count is what grew
  const acknowledge = rise.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1.045, 1] });

  return (
    <Pressable accessibilityRole="button" onPress={grown ? onDone : undefined} style={styles.flex}>
      <LinearGradient colors={ritualGround(personality)} style={[styles.flex, styles.center]}>
        <View style={styles.growthStage}>
          <Animated.View style={[styles.growthRays, { opacity: settleIn }]}>
            <Rays size={GROWTH_RAYS} reduceMotion={reduceMotion} strength={0.4} />
          </Animated.View>
          {/* the optimiser's opening is drawn frame by frame; the other two
              types have no clip, so they use the spring rise */}
          {transforms && personality === "optimizer" ? (
            <GrowthSequence
              grownSource={plantFor(personality, current)}
              reduceMotion={reduceMotion}
            />
          ) : null}

          {transforms && personality !== "optimizer" ? (
            <Animated.Image
              source={plantFor(personality, previous)}
              resizeMode="contain"
              style={[
                styles.growthSeedLayer,
                {
                  opacity: rise.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.12, 0] }),
                  transform: [{ scale: rise.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }]
                }
              ]}
            />
          ) : null}

          {personality === "optimizer" && transforms ? null : (
          <Animated.Image
            source={plantFor(personality, current)}
            resizeMode="contain"
            style={[
              styles.growthPlantLayer,
              transforms
                ? {
                    opacity: rise.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 1] }),
                    transform: [{ scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.52, 1] }) }]
                  }
                : { transform: [{ scale: acknowledge }] }
            ]}
          />
          )}
        </View>

        <Animated.View
          style={{
            opacity: settleIn,
            transform: [{ translateY: settleIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }]
          }}
        >
          {grown ? (
            <>
              <Text style={styles.growthTitle}>something grew.</Text>
              <Text style={styles.growthBody}>
                your garden now holds {actionsDone} {actionsDone === 1 ? "moment" : "moments"} of showing up.
                tap anywhere to continue.
              </Text>
            </>
          ) : null}
        </Animated.View>

        {grown ? null : <Text style={styles.growthTitle}>planting…</Text>}
      </LinearGradient>
    </Pressable>
  );
}

/** how much of the next page stays visible, and the gutter between them */
const PEEK = 26;
const PAGE_GAP = 10;

/**
 * The journal: the reflections you have written, one dated page at a time.
 *
 * Paged rather than listed. A list turns your own words into rows of data to
 * scan; a page is one day, and you have to turn it to reach the next — which is
 * how you actually reread a diary. The page is the same paper as the slip you
 * wrote it on, and the text is set in the hand rather than the interface face,
 * because it is yours and not ours.
 *
 * Newest first: coming back, you want yesterday, not your first day.
 *
 * A page is a day, not an entry. Nothing stops someone facing a second hard
 * thing before bed — growth follows actions, never days — and when they did,
 * this used to print two pages under the same date. Same-day entries share a
 * page, in the order they happened.
 */
function Journal({ entries }: { entries: Entry[] }) {
  const { width } = useWindowDimensions();
  const pages = useMemo(() => journalPages(entries), [entries]);
  const [page, setPage] = useState(0);
  // leave PEEK visible of the page after this one
  const pageWidth = Math.min(width, 430) - space.gutter * 2 - PEEK;

  if (pages.length === 0) return null;

  const current = pages[Math.min(page, pages.length - 1)]!;

  return (
    <View style={styles.journal}>
      <View style={styles.journalHead}>
        <Eyebrow>your journal</Eyebrow>
        <Text style={styles.journalCount}>
          {page + 1} / {pages.length}
        </Text>
      </View>

      {/*
        The next page shows a sliver at the right rather than a fake stack drawn
        behind. Real depth, and it says "there is another one" without a hint.
        snapToInterval rather than pagingEnabled, because the page is narrower
        than the scroller.
      */}
      <ScrollView
        horizontal
        decelerationRate="fast"
        snapToInterval={pageWidth + PAGE_GAP}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setPage(Math.round(event.nativeEvent.contentOffset.x / (pageWidth + PAGE_GAP)))
        }
        style={styles.journalPages}
      >
        {pages.map((day, index) => (
          <View
            key={`${day.date}-${index}`}
            style={[
              styles.journalPage,
              { width: pageWidth, marginRight: index === pages.length - 1 ? 0 : PAGE_GAP }
            ]}
          >
            <View style={styles.journalDateRow}>
              <Text style={styles.journalDate}>{prettyDate(day.date)}</Text>
              {day.entries.length > 1 ? (
                <Text style={styles.journalCount}>{day.entries.length} moments</Text>
              ) : null}
            </View>

            {day.entries.map((entry, moment) => (
              <View key={moment} style={moment > 0 ? styles.journalMoment : undefined}>
                <View style={styles.journalTagRow}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{entry.tag}</Text>
                  </View>
                </View>

                {entry.text ? (
                  <Text style={styles.journalText}>{entry.text}</Text>
                ) : (
                  <Text style={styles.journalBlank}>you did this one, and left the page empty.</Text>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <Text style={styles.journalHint}>
        {pages.length > 1 ? "swipe to turn the page" : "one page so far"}
      </Text>
    </View>
  );
}

/** "4 September" — no year unless it is not this one. */
function prettyDate(iso: string) {
  if (!iso) return "an earlier day";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "an earlier day";
  const date = new Date(year, month - 1, day);
  const label = date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return year === new Date().getFullYear() ? label : `${label} ${year}`;
}

/**
 * The field: one mark per action, accumulating.
 *
 * From the Memory Garden pins — every entry becomes a small drawn thing, and a
 * year of them fills the screen. The bar chart this replaces measured the same
 * data and made it look like analytics; the point of Kizuku is that the record
 * is a garden, not a dashboard.
 *
 * Each mark is a sprout whose size and lean come from the entry itself, so no
 * two are identical and the field is genuinely yours. A day you wrote something
 * carries a seed head; a day you skipped is still a sprout, because a thin ring
 * is still a ring.
 */
function GardenField({ entries, personality }: { entries: Entry[]; personality: PersonalityType }) {
  const theme = themes[personality];
  const { width } = useWindowDimensions();
  const cols = 7;
  const cell = Math.floor((Math.min(width, 430) - space.gutter * 2 - space.md * 2) / cols);

  if (entries.length === 0) return null;

  return (
    <View style={styles.insightCard}>
      <Eyebrow>your field</Eyebrow>
      <View style={styles.field}>
        {entries.map((entry, index) => {
          // deterministic per entry, so a mark never changes once it is planted
          const seed = [...(entry.date + entry.tag)].reduce((sum, ch) => sum + ch.charCodeAt(0), index);
          const lean = ((seed % 9) - 4) * 1.6;
          const height = cell * (0.58 + ((seed >> 3) % 5) * 0.07);
          const wrote = entry.text.length > 0;
          return (
            <View key={`${entry.date}-${index}`} style={{ width: cell, height: cell, alignItems: "center", justifyContent: "flex-end" }}>
              <Svg width={cell} height={cell} viewBox={`0 0 ${cell} ${cell}`}>
                <G transform={`rotate(${lean} ${cell / 2} ${cell})`}>
                  <Path
                    d={`M${cell / 2} ${cell - 3} L${cell / 2} ${cell - height}`}
                    stroke={theme.edge}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                  />
                  <Path
                    d={`M${cell / 2} ${cell - height * 0.5} C${cell / 2 - 9} ${cell - height * 0.66} ${cell / 2 - 8} ${cell - height * 0.88} ${cell / 2} ${cell - height * 0.98}`}
                    stroke={theme.edge}
                    strokeWidth={1.4}
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* a second leaf on most of them, so the field is not a row of matchsticks */}
                  {seed % 3 !== 0 ? (
                    <Path
                      d={`M${cell / 2} ${cell - height * 0.34} C${cell / 2 + 8} ${cell - height * 0.46} ${cell / 2 + 8} ${cell - height * 0.64} ${cell / 2} ${cell - height * 0.72}`}
                      stroke={theme.edge}
                      strokeWidth={1.3}
                      fill="none"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {wrote ? <Circle cx={cell / 2} cy={cell - height - 2} r={2.6} fill={theme.edge} /> : null}
                </G>
              </Svg>
            </View>
          );
        })}
      </View>
      <Text style={styles.cardMeta}>
        one sprout for every action you finished. the ones with a seed head are the days you wrote
        something too.
      </Text>
    </View>
  );
}

function PatternsScreen({
  personality,
  actionsDone,
  entries,
  onTab
}: {
  personality: PersonalityType;
  actionsDone: number;
  entries: Entry[];
  onTab: (tab: MainTab) => void;
}) {
  const type = personalityTypes[personality];
  /*
   * Declined actions are stored so they are not re-offered immediately, but
   * nothing on this screen should count them: the garden records what you did,
   * and the tag list says so directly underneath itself.
   */
  const insets = useSafeAreaInsets();
  const done = entries.filter((entry) => entry.done);
  const counts = new Map<string, number>();
  done.forEach(({ tag }) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const most = ranked.length > 0 ? Math.max(...ranked.map(([, count]) => count)) : 1;

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView
        contentContainerStyle={[
          styles.tabScroll,
          // the nav grew by the home indicator, so the scroll has to clear it too
          { paddingTop: insets.top + space.xl, paddingBottom: 108 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>your pattern</Eyebrow>

        {actionsDone === 0 ? (
          <>
            <Text style={styles.patternTitle}>nothing to notice yet.</Text>
            <View style={styles.insightCard}>
              <Text style={styles.emptyBody}>
                your pattern shows up here after your first action. there is nothing to catch up on and nothing
                to miss.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.patternTitle}>
              {type.headline.lead}{"\n"}
              <Text style={styles.patternAccent}>{type.headline.accent}</Text>
            </Text>

            <Journal entries={done} />

            <View style={styles.insightCard}>
              <Eyebrow>moments of showing up</Eyebrow>
              <Text style={styles.momentCount}>{actionsDone}</Text>
              <Text style={styles.cardMeta}>no calendar, no streak. this number only ever goes up.</Text>
            </View>

            <GardenField entries={done} personality={personality} />

            {ranked.length > 0 ? (
              <View style={styles.insightCard}>
                <Eyebrow>what has helped you</Eyebrow>
                <View style={styles.tagRow}>
                  {ranked.map(([tag, count]) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>
                        {tag} {count > 1 ? `· ${count}` : ""}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.cardMeta}>drawn from the actions you finished, not from what you wrote.</Text>
              </View>
            ) : null}

            <View style={styles.insightCard}>
              <Eyebrow>{type.name}</Eyebrow>
              <View style={styles.tagRow}>
                {type.traits.map((trait) => (
                  <View key={trait} style={styles.tag}>
                    <Text style={styles.tagText}>{trait}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.quote}>“{type.mantra}”</Text>
            </View>
          </>
        )}
      </ScrollView>
      <BottomNav active="patterns" onSelect={onTab} />
    </View>
  );
}

function ProfileScreen({
  personality,
  actionsDone,
  onRetake,
  onTab,
  onReset
}: {
  personality: PersonalityType;
  actionsDone: number;
  onRetake: () => void;
  onTab: (tab: MainTab) => void;
  onReset: () => void;
}) {
  const insets = useSafeAreaInsets();
  const type = personalityTypes[personality];
  const stage = stageFor(actionsDone);
  /*
   * Facts about the app, not settings. They used to carry a chevron each, which
   * is the standard "tap to change this" affordance on rows that were plain
   * Views and did nothing. "notifications · gentle · 1x/day" went further and
   * described a schedule for a feature that does not exist — there is no
   * notification code in the app and no dependency that could send one.
   */
  const rows: Array<{ icon: IconName; label: string; value: string }> = [
    { icon: "eye", label: "theme", value: "forest" },
    { icon: "lock", label: "privacy", value: "on-device only" }
  ];

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView
        contentContainerStyle={[
          styles.profileScroll,
          // the nav grew by the home indicator, so the scroll has to clear it too
          { paddingTop: insets.top + space.xl, paddingBottom: 108 + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* the type's own colour — it was a fixed amber tint whatever the type */}
        <View style={[styles.profileMark, { backgroundColor: themes[personality].surface, borderColor: themes[personality].edge }]}>
          <Image source={plantFor(personality, stage)} resizeMode="contain" style={styles.profileSeed} />
        </View>
        <Text style={styles.profileTitle}>{type.name}</Text>
        <Text style={styles.profileSubtitle}>
          {actionsDone} small {actionsDone === 1 ? "action" : "actions"} noticed
        </Text>

        <View style={styles.profileCard}>
          <Text style={styles.profileQuote}>“{type.quote}”</Text>
          <Text style={styles.profilePattern}>{type.pattern}</Text>
        </View>

        <View style={styles.settingsGroup}>
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.settingsRow, index < rows.length - 1 && styles.settingsRowBorder]}>
              <View style={styles.settingsLabel}>
                <Icon name={row.icon} size={19} weight={1.9} fill={pigment.sage} color={color.forest[600]} />
                <Text style={styles.settingsLabelText}>{row.label}</Text>
              </View>
              <View style={styles.settingsValue}>
                <Text style={styles.settingsValueText}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <SecondaryButton label="retake personality quiz" icon="refresh" onPress={onRetake} />
        <Pressable onPress={onReset} style={styles.resetButton}>
          <Text style={styles.resetText}>reset my garden</Text>
        </Pressable>
      </ScrollView>
      <BottomNav active="profile" onSelect={onTab} />
    </View>
  );
}

function TypeEmblem({ personality, ink, edge }: { personality: PersonalityType; ink: string; edge: string }) {
  if (personality === "seeker") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 130 130">
        <Path d="M40 88 Q34 52 65 42 Q98 33 96 68 Q94 100 66 100 Q46 100 40 88Z" stroke={ink} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Circle cx={65} cy={66} r={13} stroke={edge} strokeWidth={2} fill="none" />
        <Path d="M65 24 L65 40" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  if (personality === "planner") {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 130 130">
        <Path d="M65 26 L65 104" stroke={ink} strokeWidth={2} strokeLinecap="round" />
        <Path d="M65 52 Q40 44 34 62 Q56 70 65 60" stroke={ink} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Path d="M65 74 Q90 66 96 84 Q74 92 65 82" stroke={edge} strokeWidth={2} fill="none" strokeLinejoin="round" />
        <Circle cx={65} cy={26} r={6} stroke={ink} strokeWidth={2} fill="none" />
      </Svg>
    );
  }

  return (
    <Svg width="100%" height="100%" viewBox="0 0 130 130">
      <Circle cx={58} cy={72} r={34} stroke={ink} strokeWidth={2} fill="none" />
      <Path d="M92 20 L92 62" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      <Path d="M74 38 L92 20 L110 38" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 96 Q58 78 88 96" stroke={edge} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * A letter, not a splash.
 *
 * The screen used to state a proverb at you. It says something now, from
 * someone, to you — and it is signed in the same hand the journal is set in, so
 * the first handwriting you see is ours and the next is your own. The quote it
 * replaced is kept as the line the letter closes on; it was the best sentence
 * on the screen and it earns more as a sign-off than as a headline.
 */
function WelcomeScreen({ onBegin }: { onBegin: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView
        contentContainerStyle={[styles.welcomeContent, { paddingTop: insets.top + space.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeMark}>
          <KizukuMark width={30} height={30} />
        </View>

        <Text style={styles.welcomeGreeting}>hello,</Text>

        <Text style={styles.welcomeLetter}>
          this is a small app for the kind of worry that lives in the future — the meeting that
          has not happened, the message you have not sent, the year you cannot picture yet.
        </Text>
        <Text style={styles.welcomeSignoff}>
          you cannot plan a forest.{"\n"}you can only plant a tree.
        </Text>
        <Text style={styles.welcomeSignature}>Ayushman</Text>
      </ScrollView>

      <View style={styles.welcomeAction}>
        <PrimaryButton label="what this is" onPress={onBegin} />
        <Text style={styles.welcomeNote}>no account · nothing leaves your phone</Text>
      </View>
    </View>
  );
}

function QuizOptionCard({
  text,
  active,
  onPress,
  reduceMotion
}: {
  text: string;
  active: boolean;
  onPress: () => void;
  reduceMotion: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.option,
          active && styles.optionSelected,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Text style={[styles.optionText, active && styles.optionTextSelected]}>{text}</Text>
        {/* a chosen answer should be readable at a glance, not inferred from a
            slightly different background — Finch marks its selection outright */}
        {active ? (
          <View style={styles.optionMark}>
            <Icon name="checkmark" size={13} color="#FFFFFF" />
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * What the app is, before it asks anything.
 *
 * The quiz used to be the second screen, so the third question — "what are you
 * most honestly afraid of?" — arrived about forty seconds in, before the app had
 * shown a single thing or earned the right to ask. This screen is the earning:
 * four plain promises, three of which are unusual enough to be worth reading,
 * and all four true of the build rather than aspirational.
 */
const PROMISES: Array<[string, string]> = [
  ["no account", "there is nothing to sign up for, and nothing to sign in to."],
  ["nothing leaves your phone", "the worry you write is read once, to pick your action, and never stored."],
  ["no streaks", "a day you miss is a thinner ring, never a reset."],
  ["stop whenever", "nothing here will chase you, and nothing is lost if you put it down."]
];

function PromiseScreen({ onBegin, onBack }: { onBegin: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView
        contentContainerStyle={[styles.promiseContent, { paddingTop: insets.top + space.md }]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={onBack} />

        <Text style={styles.promiseLead}>
          it asks you for one worry, and gives you{" "}
          <Text style={styles.welcomeEmphasis}>one small thing to do</Text>. it will not ask you to
          feel better. that is the whole app.
        </Text>

        <View style={styles.promiseList}>
          {PROMISES.map(([term, gloss]) => (
            <View key={term} style={styles.promiseRow}>
              <Text style={styles.promiseTerm}>{term}</Text>
              <Text style={styles.promiseGloss}>{gloss}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.welcomeAction}>
        <PrimaryButton label="plant my first tree" onPress={onBegin} />
        <Text style={styles.welcomeNote}>three questions · about 60 seconds</Text>
      </View>
    </View>
  );
}

function QuizScreen({
  onDone,
  onBack
}: {
  onDone: (answers: PersonalityType[]) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<PersonalityType[]>([]);
  const reduceMotion = useReduceMotionPreference();
  const question = quiz[index]!;
  const selected = answers[index];
  const last = index === quiz.length - 1;

  const choose = (type: PersonalityType) =>
    setAnswers((current) => {
      const next = [...current];
      next[index] = type;
      return next;
    });

  const advance = () => {
    if (!selected) return;
    if (last) onDone(answers);
    else setIndex(index + 1);
  };

  /*
   * The last question asks what you are most afraid of. The first two are about
   * what you do; this one is not, and requiring it is the one place onboarding
   * takes something rather than asks. Skipping leaves the answer unset and the
   * type is decided by the two that were given.
   */
  const declineLast = () => onDone(answers.slice(0, quiz.length - 1));

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <View style={[styles.flowContent, { paddingTop: insets.top + space.md }]}>
        <BackButton onPress={() => (index === 0 ? onBack() : setIndex(index - 1))} />

        <View style={styles.quizHead}>
          <View style={styles.progressDots}>
            {quiz.map((_, dot) => (
              <View key={dot} style={[styles.progressDot, dot === index && styles.progressDotActive]} />
            ))}
          </View>
          <Text style={styles.cardMeta}>
            {index + 1} of {quiz.length}
          </Text>
        </View>

        <Text style={styles.flowTitle}>{question.prompt}</Text>

        <View style={styles.optionList}>
          {question.options.map((option) => (
            <QuizOptionCard
              key={option.type}
              active={selected === option.type}
              onPress={() => choose(option.type)}
              reduceMotion={reduceMotion}
              text={option.text}
            />
          ))}
        </View>

        <View style={styles.inlineAction}>
          <PrimaryButton label={last ? "see my result" : "next"} disabled={!selected} onPress={advance} />
          {last ? (
            <Pressable onPress={declineLast} style={styles.quizDecline}>
              <Text style={styles.quizDeclineText}>i’d rather not say</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function RevealScreen({
  personality,
  onDone
}: {
  personality: PersonalityType;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const type = personalityTypes[personality];
  const theme = themes[personality];
  const reduceMotion = useReduceMotionPreference();
  const reveal = useRef(new Animated.Value(0)).current;

  /*
   * Seen exactly once per user, so it can afford ceremony the rest of the app
   * cannot. One driver, five slices — each element opens over its own stretch of
   * the same 0..1 timeline, in the order the screen is read. No spring and no
   * bounce: this is text settling, not the plant rising.
   */
  useEffect(() => {
    reveal.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    Animated.timing(reveal, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [reveal, reduceMotion]);

  const step = (from: number, to: number) => ({
    opacity: reveal.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: "clamp" as const }),
    transform: [
      {
        translateY: reveal.interpolate({
          inputRange: [from, to],
          outputRange: [14, 0],
          extrapolate: "clamp" as const
        })
      }
    ]
  });

  const emblem = step(0, 0.34);
  // 0.92, never 0 — nothing in the real world appears from nothing
  const emblemScale = reveal.interpolate({
    inputRange: [0, 0.34],
    outputRange: [0.92, 1],
    extrapolate: "clamp"
  });

  return (
    <View style={[styles.flex, { backgroundColor: theme.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.revealContent, { paddingTop: insets.top + space.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/*
          The real plant, not an abstract mark. Every type already has its own
          artwork in assets/ and the garden uses it — the reveal was the one
          screen drawing a 2px squiggle instead of showing you the thing you
          are about to grow.
        */}
        <Animated.View
          style={[
            styles.revealEmblem,
            { opacity: emblem.opacity, transform: [...emblem.transform, { scale: emblemScale }] }
          ]}
        >
          <View style={styles.revealRays}>
            <Rays size={REVEAL_RAYS} reduceMotion={reduceMotion} />
          </View>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={plantFor(personality, 6)}
            style={styles.revealPlant}
          />
        </Animated.View>

        {/* the label and the name are one unit and must not separate */}
        <Animated.View style={step(0.16, 0.52)}>
          <Text style={[styles.eyebrow, { color: theme.ink }]}>your type</Text>
          <Text style={[styles.revealName, { color: theme.ink }]}>{type.name}</Text>
        </Animated.View>

        <Animated.View style={step(0.3, 0.66)}>
          <Text style={[styles.revealQuote, { color: theme.ink }]}>“{type.quote}”</Text>
        </Animated.View>

        <Animated.View style={[styles.revealCard, step(0.44, 0.8)]}>
          <Text style={[styles.eyebrow, { color: theme.ink }]}>your pattern</Text>
          <Text style={[styles.revealPattern, { color: theme.ink }]}>{type.pattern}</Text>
        </Animated.View>

        {/* the container, not each tag — staggering nine chips would over-egg it */}
        <Animated.View style={[styles.revealTags, step(0.56, 0.92)]}>
          {type.traits.map((trait) => (
            <View key={trait} style={[styles.tag, styles.revealTag]}>
              <Text style={styles.tagText}>{trait}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* deliberately unanimated: ceremony must never gate the way out */}
      <View style={styles.bottomAction}>
        <PrimaryButton label="meet your plant" onPress={onDone} />
      </View>
    </View>
  );
}

/**
 * The wrapper for the three screens that ask something of you — worry, action,
 * reflection. They used to hard-cut in while the garden either side of them
 * faded and rose, so the ritual snapped exactly where it was asking for
 * attention. Same token, same curve, same 24px as HomeScreen's prompt.
 *
 * The gradient stays outside the animated view: it paints immediately and only
 * the content rises over it. Animating the gradient would be a paint animation
 * and could not use the native driver.
 */
/**
 * A slip torn from a pad — the surface for both screens that ask you to write
 * something down. Ragged top where it came away, ruled lines to write on, and
 * one fold above the footer. clip-path does not exist in React Native, so the
 * tear is an SVG filled with the paper colour and stretched to the card width.
 */
function Slip({
  children,
  note,
  personality,
  focused = false
}: {
  children: React.ReactNode;
  note: string;
  personality: PersonalityType;
  focused?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const reduceMotion = useReduceMotionPreference();
  const focusAnim = useRef(new Animated.Value(0)).current;

  /*
   * The pad lifts when you start writing.
   *
   * It cannot do that by animating shadowOpacity: the native driver handles only
   * transform and opacity, so a shadow tween has to run on the JS thread — and
   * this fires exactly when that thread is busiest, raising the keyboard and
   * relaying out the screen. It was also iOS-only, so on Android it burned
   * frames and moved nothing.
   *
   * Lifting the card instead reads the same and stays native: it rises 2pt and
   * grows by half a percent, so the static shadow underneath it reads deeper
   * without being animated at all.
   */
  useEffect(() => {
    if (reduceMotion) {
      focusAnim.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  }, [focusAnim, focused, reduceMotion]);

  const lift = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const swell = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.005] });

  return (
    <Animated.View
      style={[styles.slip, { transform: [{ translateY: lift }, { scale: swell }] }]}
    >
      <Svg width="100%" height={13} viewBox="0 0 300 13" preserveAspectRatio="none">
        <Path d={TORN_EDGE} fill={color.paper.card} />
      </Svg>

      <View style={styles.slipBody}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {[0, 1, 2].map((line) => (
            <View key={line} style={[styles.rule, { top: 34 * (line + 1) }]} />
          ))}
        </View>

        {listening ? (
          /* the orb takes the page while it listens — you are not reading, you
             are talking, so the ruled lines have nothing to hold yet */
          <View style={styles.slipListening}>
            <ThinkingOrb personality={personality} size={92} />
          </View>
        ) : (
          children
        )}
      </View>

      {/* the fold: a crease, not a border — shadow above, catchlight below */}
      <View style={styles.foldShadow} />
      <View style={styles.foldLight} />

      <View style={styles.slipFooter}>
        <Text style={styles.inputNoteText}>{listening ? "listening… tap to stop." : note}</Text>
        {/*
          The mic used to sit inside the writing area, a 44pt circle on top of
          the ruled lines with the first line of text running into it. It is a
          control, not part of the page, so it lives below the fold now and the
          rules run unbroken.
        */}
        <Pressable
          accessibilityLabel={listening ? "Stop listening" : "Dictate instead"}
          accessibilityRole="button"
          accessibilityState={{ selected: listening }}
          hitSlop={8}
          onPress={() => setListening((on) => !on)}
          style={({ pressed }) => [
            styles.micButton,
            listening && styles.micButtonActive,
            pressed && styles.pressed
          ]}
        >
          <Icon
            name={listening ? "circle" : "mic"}
            size={19}
            weight={2}
            fill={listening ? undefined : pigment.sky}
            color={listening ? "#FFFFFF" : color.forest[600]}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/**
 * Name your tree.
 *
 * From the plant-care pin, where the plants are called Janie and Gloria rather
 * than "Plant 1". A named thing is one you have a relationship with, and the
 * whole product rests on caring what happens to this tree.
 *
 * Skippable, and skipping is not a lesser path — some people will not want to
 * name it, and being nagged on day one is the opposite of what this app is for.
 */
/**
 * Names to offer. A blank field with "give it a name" is a small blank-page
 * problem at the exact moment the app wants the user to feel ownership; Finch
 * pre-fills a name and puts a shuffle beside it, so the zero-effort path still
 * ends with something that feels chosen. These are what you would plausibly
 * call a tree — trees, mostly, and the kind of word that survives being said
 * out loud every day.
 */
const PLANT_NAMES = [
  "Juniper", "Rowan", "Fern", "Ash", "Willow", "Cedar", "Sage", "Hazel",
  "Linden", "Moss", "Bracken", "Alder", "Briar", "Clover", "Laurel", "Reed",
  "Thistle", "Yarrow", "Birch", "Elm", "Sorrel", "Tansy"
];

function suggestName(avoid?: string): string {
  const pool = avoid ? PLANT_NAMES.filter((n) => n !== avoid) : PLANT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function NamingScreen({
  personality,
  current,
  onDone
}: {
  personality: PersonalityType;
  /** the tree's existing name, when this is reached by retaking the quiz */
  current?: string;
  onDone: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  // seeded once, not on every render, so it does not change under the user
  const [name, setName] = useState(() => current || suggestName());
  const theme = themes[personality];
  const type = personalityTypes[personality];
  const reduceMotion = useReduceMotionPreference();
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: motion.ambientBreath,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: motion.ambientBreath,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    breathing.start();
    return () => breathing.stop();
  }, [breath, reduceMotion]);

  const plantScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035]
  });

  return (
    <View style={[styles.flex, { backgroundColor: theme.surface }]}>
      {/*
        The actions live inside the scroll. They used to be absolutely pinned to
        the bottom while the input sat in the scroll above, so raising the
        keyboard slid the button up over the field the user was typing into.
        automaticallyAdjustKeyboardInsets lets iOS inset by the real keyboard
        height, and persistTaps lets the button take the first tap rather than
        spending it dismissing the keyboard.
      */}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.namingContent, { paddingTop: insets.top + space.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/*
          alignSelf lives on the wrapper, not the image. The breathing animation
          put an Animated.View between the image and the column, so centring the
          image only centred it inside a wrapper its own width — and the wrapper
          took the column's alignItems: "flex-start" and sat against the edge.
        */}
        <Animated.View style={[styles.namingSeedWrap, { transform: [{ scale: plantScale }] }]}>
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={plantFor(personality, 1)}
            style={styles.namingSeed}
          />
        </Animated.View>

        <Text style={[styles.eyebrow, { color: theme.ink }]}>your {type.plant}</Text>
        <Text style={[styles.namingTitle, { color: theme.ink }]}>what will you call it?</Text>
        <Text style={[styles.namingBody, { color: theme.ink }]}>
          you will be tending this one for a while. a name makes it yours — but it is fine to leave
          it as it is.
        </Text>

        <View style={styles.namingField}>
          <TextInput
            accessibilityLabel="Name your plant"
            autoCapitalize="words"
            maxLength={24}
            onChangeText={setName}
            onSubmitEditing={() => onDone(name.trim())}
            placeholder="give it a name"
            placeholderTextColor={color.stone[400]}
            returnKeyType="done"
            style={styles.namingInput}
            value={name}
          />
        </View>

        <View style={styles.namingActions}>
          <View style={styles.namingButtons}>
            <Pressable
              accessibilityLabel="Suggest another name"
              accessibilityRole="button"
              onPress={() => setName((current) => suggestName(current))}
              style={({ pressed }) => [styles.shuffleButton, pressed && styles.stampPressed]}
            >
              <Icon name="refresh" size={17} weight={2.1} color={color.forest[600]} />
              <Text style={styles.shuffleText}>shuffle</Text>
            </Pressable>

            <View style={styles.namingPrimary}>
              <PrimaryButton
                label={name.trim() ? `plant ${name.trim()}` : "plant it"}
                onPress={() => onDone(name.trim())}
              />
            </View>
          </View>

          <Pressable onPress={() => onDone("")} style={styles.namingSkip}>
            <Text style={[styles.namingSkipText, { color: theme.ink }]}>i will name it later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * The ground the daily ritual stands on: the type's own surface, deepening
 * into its raised shade.
 *
 * It used to be `themes[type].ritual`, a pale wash sampled from the hi-fi
 * frames — the reason the ritual read as washed out next to the reveal and
 * the naming screen, which already sat on the surface colour and were the two
 * screens that felt alive. Both colours are the type's existing tokens; the
 * only change is that the ritual now uses them. Everything drawn directly on
 * this ground is forest/600 or darker, which clears 5:1 on all three types.
 */
function ritualGround(personality: PersonalityType): [string, string] {
  const theme = themes[personality];
  return [theme.surface, theme.raised];
}

function GradientScreen({
  personality,
  children
}: {
  personality: PersonalityType;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;

    Animated.timing(entrance, {
      toValue: 1,
      duration: motion.enterSoft,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [entrance, reduceMotion]);

  const rise = entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <LinearGradient colors={ritualGround(personality)} style={styles.flex}>
      {/*
        The gradient fills the screen; the padding is on the content inside it,
        so colour reaches the status bar and the home indicator while the back
        button and the copy still clear them.
      */}
      <Animated.View
        style={[
          styles.flex,
          { paddingTop: insets.top, opacity: entrance, transform: [{ translateY: rise }] }
        ]}
      >
        {children}
      </Animated.View>
    </LinearGradient>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <IconButton icon="arrow-back" label="Go back" onPress={onPress} />;
}

/**
 * The tree's name and how far it has grown, on the garden.
 *
 * Finch keeps an adventure bar under its bird — "1st Adventure 0/15" — and it
 * is the one piece of its home screen that says the effort is going
 * somewhere. This is the same promise without its pressure: six segments, one
 * per stage the design file draws, and the current one fills by how far you
 * are through it. There is no countdown and no number of days, because
 * "no calendar, no streak" is the brand's own rule — a thin segment is a
 * record of what you have done, not a reminder of what you owe.
 */
function StageMeter({ actionsDone, name }: { actionsDone: number; name: string }) {
  const stage = stageFor(actionsDone);
  const from = stageThresholds[stage - 1]!;
  const to = (stageThresholds as readonly number[])[stage];
  const within = to === undefined ? 1 : Math.min(1, Math.max(0, (actionsDone - from) / (to - from)));

  return (
    <View style={styles.meter} accessible accessibilityLabel={`${name}, stage ${stage} of 6`}>
      <Text numberOfLines={1} style={styles.meterName}>{name}</Text>
      <View style={styles.meterRow}>
        <View style={styles.meterTrack}>
          {stageThresholds.map((_, index) => {
            const number = index + 1;
            const fill = number < stage ? 1 : number === stage ? Math.max(within, 0.18) : 0;
            return (
              <View key={index} style={styles.meterSegment}>
                <View style={[styles.meterFill, { width: `${fill * 100}%` }]} />
              </View>
            );
          })}
        </View>
        <Text style={styles.meterCaption}>{stage === 6 ? "fully grown" : `stage ${stage} of 6`}</Text>
      </View>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} size={20} weight={2} color={color.forest[600]} fill={icon === "person" ? pigment.sky : undefined} />
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.primaryButtonDisabled,
        pressed && !disabled && styles.primaryPressed
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Icon name="arrow-forward" size={17} color="#FFFFFF" />
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  icon
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.stampPressed]}>
      {icon ? <Icon name={icon} size={17} color={color.forest[500]} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Fills for sticker icons: the three type pigments, straight from the themes.
 * Each tab keeps one, so the bar reads as three coloured objects rather than
 * three grey outlines, and the colours are the ones the rest of the app
 * already teaches.
 */
const pigment = {
  sage: themes.planner.surface,
  amber: themes.optimizer.surface,
  sky: themes.seeker.surface
} as const;

function BottomNav({ active, onSelect }: { active: MainTab; onSelect: (tab: MainTab) => void }) {
  const insets = useSafeAreaInsets();
  const items: Array<{ id: MainTab; label: string; icon: IconName; fill: string }> = [
    { id: "home", label: "garden", icon: "home", fill: pigment.sage },
    { id: "patterns", label: "pattern", icon: "stats", fill: pigment.amber },
    { id: "profile", label: "you", icon: "person", fill: pigment.sky }
  ];

  return (
    /*
     * The row of icons is 82pt tall. It should rest directly on top of the home
     * indicator, so the padding below it IS the inset — not the inset plus the
     * old 14pt, which counted the same gap twice and floated the icons 48pt off
     * the bottom, further from the thumb than they were designed to be. Where
     * there is no indicator, the original 14pt still applies.
     */
    <View
      style={[
        styles.bottomNav,
        { height: NAV_CONTENT + Math.max(insets.bottom, 14), paddingBottom: Math.max(insets.bottom, 14) }
      ]}
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="button"
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.navItem, selected && styles.navItemActive]}
          >
            <Icon name={item.icon} size={26} weight={2} fill={item.fill} color={color.forest[600]} />
            <Text style={[styles.navLabel, selected && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { flex: 1, backgroundColor: "#1A1812", alignItems: "center" },
  device: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    overflow: "hidden",
    backgroundColor: color.paper[50],
    ...Platform.select({ web: { boxShadow: "0 24px 80px rgba(0,0,0,0.35)" } })
  },
  center: { alignItems: "center", justifyContent: "center" },
  paperScreen: { backgroundColor: color.paper[50] },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  hidden: { opacity: 0 },

  // home
  homeRoot: { flex: 1, overflow: "hidden", backgroundColor: color.paper[100] },
  homeBackground: { position: "absolute", top: -240, bottom: 0, left: -8, width: "105%", height: "120%" },
  homeHeader: {
    position: "absolute",
    top: 28,
    left: space.gutter,
    right: space.gutter,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    zIndex: 3
  },
  brandBlock: { gap: space.xxs },
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  brandName: { ...text.display, color: color.forest[500], fontFamily: font.serif },
  homeTitle: { ...text.label, fontFamily: font.sans, color: color.stone[700], marginLeft: 2 },
  meter: {
    alignSelf: "flex-start",
    marginTop: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 6,
    borderRadius: radius.group,
    borderWidth: 1.5,
    borderColor: ink.line,
    backgroundColor: color.paper.card,
    ...stamp(ink.edge, 3)
  },
  meterName: { ...text.journal, fontSize: 22, lineHeight: 24, color: color.forest[600] },
  meterRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  meterTrack: { flexDirection: "row", gap: 3 },
  meterSegment: { width: 16, height: 8, borderRadius: 4, backgroundColor: color.forest[100], overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: color.forest[500] },
  meterCaption: { ...text.caption, fontFamily: font.sansMedium, color: color.stone[700] },
  iconButton: {
    width: target.min,
    height: target.min,
    borderRadius: target.min / 2,
    borderWidth: 1.5,
    borderColor: ink.line,
    backgroundColor: color.paper.card,
    ...stamp(ink.edge, 2),
    alignItems: "center",
    justifyContent: "center"
  },
  heroTreeImage: { width: "100%", height: "100%" },
  // the can rests slightly forward of the soil line, as it did before
  heroWateringCan: { position: "absolute", bottom: GROUND_ABOVE_FLOOR - 17, right: 0, width: 154, height: 162, zIndex: 2 },
  homeCardMotion: { position: "absolute", left: space.gutter, right: space.gutter, bottom: 146 },
  cardBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.forest[500],
    alignItems: "center",
    justifyContent: "center",
    ...stamp(color.forest[700], 3)
  },
  cardBadgeDone: { backgroundColor: color.forest[50], ...stamp(color.forest[700], 3) },
  homeCard: {
    minHeight: 104,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: ink.line,
    // opaque, so the card reads as an object on the landscape rather than a frost over it
    backgroundColor: color.paper.card,
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...stamp(ink.edge, 5)
  },
  homeCardCompleted: { backgroundColor: color.forest[600], borderColor: color.forest[700], ...stamp(color.forest[700], 5) },
  homeCardCopy: { flex: 1, paddingRight: space.sm },
  homeCardTitle: { ...text.heading, color: color.forest[700] },
  homeCardBody: { ...text.label, fontFamily: font.sans, color: color.stone[500], marginTop: 7 },
  inverseText: { color: color.onDark },
  inverseMuted: { color: color.onDarkMuted },

  // onboarding
  welcomeContent: {
    flexGrow: 1,
    paddingHorizontal: space.gutter,
    paddingTop: space.xxxl,
    paddingBottom: space.lg,
    justifyContent: "center",
    gap: space.md
  },
  welcomeMark: { alignSelf: "flex-start", marginBottom: space.xs, opacity: 0.9 },
  starters: { marginTop: space.lg, gap: space.sm },
  starter: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: target.min + 4,
    paddingHorizontal: space.md,
    borderRadius: radius.group,
    borderWidth: 1.5,
    borderColor: ink.line,
    backgroundColor: color.paper.card,
    ...stamp(ink.edge, 3)
  },
  starterText: { ...text.body, flex: 1, color: color.stone[900] },
  quizDecline: { paddingVertical: space.md, alignItems: "center", minHeight: target.min },
  quizDeclineText: { ...text.caption, color: color.stone[500], textDecorationLine: "underline" },
  promiseContent: { flexGrow: 1, paddingHorizontal: space.gutter, paddingBottom: space.lg, justifyContent: "center", gap: space.xl },
  promiseLead: { ...text.bodyLg, color: color.stone[700] },
  promiseList: { gap: space.lg },
  promiseRow: { gap: 3 },
  promiseTerm: { ...text.label, fontFamily: font.sansMedium, color: color.forest[600] },
  promiseGloss: { ...text.body, color: color.stone[500] },
  welcomeGreeting: { ...text.title, color: color.forest[600] },
  /* the letter is set in the reading serif, not the interface sans — it is
     prose from a person, not interface copy */
  welcomeLetter: { ...text.bodyLg, color: color.stone[700] },
  welcomeEmphasis: { fontFamily: font.serif, color: color.forest[500] },
  welcomeSignoff: { ...text.bodyLg, fontFamily: font.serifItalic, color: color.stone[500], marginTop: space.sm },
  /* the same hand the journal is set in: ours first, then theirs */
  welcomeSignature: { ...text.journal, fontSize: 28, lineHeight: 34, color: color.forest[500] },
  welcomeAction: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: space.sm },
  welcomeNote: { ...text.caption, color: color.stone[500], textAlign: "center" },
  welcomeQuote: { ...text.display, color: color.forest[600] },
  quizHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.lg,
    marginBottom: space.md
  },
  progressDots: { flexDirection: "row", gap: space.xs },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.forest[100] },
  progressDotActive: { backgroundColor: color.forest[500] },
  optionList: { gap: space.sm, marginTop: space.lg },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.group,
    borderWidth: 1.5,
    borderColor: ink.line,
    backgroundColor: color.paper.card,
    ...stamp(ink.edge, 3),
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: target.min
  },
  optionSelected: { borderWidth: 2, borderColor: color.forest[500], backgroundColor: color.forest[50], ...stamp(color.forest[600], 3) },
  optionText: { ...text.bodyLg, flex: 1, fontSize: 16, lineHeight: 24, color: color.stone[700] },
  optionMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.forest[500],
    alignItems: "center",
    justifyContent: "center"
  },
  optionTextSelected: { color: color.forest[600] },

  // type reveal
  revealContent: { paddingHorizontal: space.lg, paddingTop: space.xxl, paddingBottom: 108 },
  namingContent: { paddingHorizontal: space.gutter, paddingTop: space.xxxl, paddingBottom: space.xl, alignItems: "flex-start" },
  namingActions: { alignSelf: "stretch", marginTop: space.xxl },
  namingButtons: { flexDirection: "row", alignItems: "center", gap: space.sm },
  namingPrimary: { flex: 1 },
  shuffleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    height: target.min,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ink.line,
    backgroundColor: color.paper.card,
    ...stamp(ink.edge, 3)
  },
  shuffleText: { ...text.label, fontFamily: font.sansMedium, color: color.forest[500] },
  namingSeedWrap: { alignSelf: "center", marginBottom: space.lg },
  namingSeed: { width: 116, height: 132 },
  namingTitle: { ...text.displayLg, marginTop: space.xxs },
  namingBody: { ...text.bodyLg, opacity: 0.78, marginTop: space.sm },
  namingField: {
    alignSelf: "stretch",
    marginTop: space.lg,
    backgroundColor: color.paper.card,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
    borderColor: ink.line,
    ...stamp(ink.edge, 4)
  },
  /* the name is written in the hand, like everything else the user authors */
  namingInput: { ...text.journal, fontSize: 26, lineHeight: 40, color: color.stone[900], height: 68, padding: 0 },
  namingSkip: { alignSelf: "center", paddingVertical: space.sm, paddingHorizontal: space.md },
  namingSkipText: { ...text.caption, opacity: 0.72, textDecorationLine: "underline" },
  revealEmblem: { width: 168, height: 208, alignSelf: "center", marginBottom: space.xl },
  revealPlant: { width: "100%", height: "100%" },
  // centred on the emblem (168x208); the burst spills past it on purpose
  revealRays: { position: "absolute", left: (168 - REVEAL_RAYS) / 2, top: (208 - REVEAL_RAYS) / 2 },
  hydrating: { backgroundColor: color.paper[50] },
  revealName: { ...text.displayLg, marginTop: space.xs },
  revealQuote: { fontFamily: font.serifItalic, fontSize: 17, lineHeight: 26, marginTop: space.sm },
  /*
   * Paper, not a tint of the surface. theme.raised against theme.surface measures
   * 1.12:1 on optimizer, 1.21 on seeker, 1.25 on planner — three near-invisible
   * cards. Paper lifts it to 1.42/1.74/1.89, and elevation.lifted does the rest,
   * which is exactly what actionCard already does on the same coloured grounds.
   */
  revealCard: {
    borderRadius: radius.card,
    padding: space.gutter,
    marginTop: space.lg,
    backgroundColor: color.paper.card,
    borderWidth: 1.5,
    borderColor: ink.line,
    ...stamp(ink.edge, 5)
  },
  /* chips get a hairline instead of a shadow — on optimizer's yellow, fill alone
     only reaches 1.27:1, so the edge is what makes them read as objects */
  revealTag: { backgroundColor: color.paper.card, borderWidth: 1.5, borderColor: ink.line, ...stamp(ink.edge, 2) },
  revealPattern: { ...text.bodyLg, fontSize: 16, lineHeight: 26, marginTop: space.sm },
  revealTags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },

  // ritual flow — no tab bar, so the action sits a gutter off the bottom
  flowContent: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.lg },
  /* the worry screen's scrolling twin. No flexGrow: the content container
     hugs its content, so the keyboard inset scrolls exactly as far as there
     is something to reach and no further. */
  worryScroll: { paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.lg },
  flowHeading: { marginTop: space.lg },
  // forest/600, not 500: 500 fell to 3.7:1 on the planner surface
  eyebrow: { ...text.eyebrow, color: color.forest[600] },
  flowTitle: { ...text.title, color: color.forest[600], marginTop: space.xs },
  /* the slip: no top radius and no border — a torn edge is the top boundary */
  slip: {
    borderRadius: radius.card,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: "transparent",
    marginTop: space.lg,
    ...elevation.raised
  },
  slipBody: {
    minHeight: 150,
    backgroundColor: color.paper.card,
    paddingHorizontal: space.gutter,
    paddingTop: 11
  },
  rule: { position: "absolute", left: space.gutter, right: space.gutter, height: 1, backgroundColor: "rgba(94,85,72,0.14)" },
  foldShadow: { height: 1, backgroundColor: "rgba(94,85,72,0.20)" },
  foldLight: { height: 6, backgroundColor: "rgba(255,255,255,0.65)" },
  slipFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    backgroundColor: color.paper.card,
    paddingHorizontal: space.gutter,
    paddingTop: space.xs,
    paddingBottom: space.sm,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card
  },
  slipListening: { minHeight: 102, alignItems: "center", justifyContent: "center" },
  /* lineHeight is the rule pitch, not the type's own 23 — on ruled paper the
     writing sits on the line, so the two have to be the same number */
  input: {
    flex: 1,
    minHeight: 102,
    ...text.body,
    lineHeight: 34,
    color: color.stone[900],
    padding: 0,
    ...Platform.select({
      web: { outlineColor: color.forest[500], outlineWidth: 2, outlineOffset: 4 },
      default: {}
    })
  },
  micButtonActive: { backgroundColor: color.forest[500] },
  micButton: {
    width: target.min,
    height: target.min,
    borderRadius: target.min / 2,
    backgroundColor: "rgba(123,113,96,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  inputNoteText: { ...text.caption, color: color.stone[500], flex: 1 },
  privateLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: space.md },
  privateText: { fontFamily: font.sansSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 0.4, color: color.forest[500] },
  /** the reveal scrolls, so its action stays a persistent footer */
  bottomAction: { position: "absolute", left: space.gutter, right: space.gutter, bottom: space.lg },
  /** everywhere else the action follows the card it belongs to */
  inlineAction: { marginTop: space.lg },
  inlineActionStack: { marginTop: space.lg, gap: space.sm },

  // controls
  primaryButton: {
    width: "100%",
    height: target.control,
    borderRadius: radius.pill,
    backgroundColor: color.forest[500],
    ...stamp(color.forest[700], 4),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs
  },
  // a disabled button has nothing to press into, so it loses its edge too
  primaryButtonDisabled: { backgroundColor: "rgba(44,82,40,0.28)", ...stamp("transparent", 0) },
  // the face drops onto its edge rather than fading — pressing is physical
  primaryPressed: { transform: [{ translateY: 3 }], ...stamp(color.forest[700], 1) },
  stampPressed: { transform: [{ translateY: 2 }], ...stamp(ink.edge, 1) },
  primaryButtonText: { ...text.label, fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
  secondaryButton: {
    width: "100%",
    height: target.control,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ink.line,
    backgroundColor: color.paper.card,
    ...stamp(ink.edge, 3),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs
  },
  secondaryButtonText: { ...text.label, fontFamily: font.sansMedium, fontSize: 15, lineHeight: 20, color: color.forest[600] },

  // thinking + committing
  thinkingOrb: { width: 124, height: 124, marginBottom: 36 },
  thinkingText: { ...text.title, fontFamily: font.serifLight, color: color.forest[600], marginTop: space.sm },
  /*
   * The copy and the line are one centred group. They used to be pinned at 28%
   * and 58% with an illustration at the bottom; without it those percentages
   * left the lower half of the screen empty.
   */
  commitRoot: { alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  commitCopy: { alignItems: "center" },
  commitTitle: { ...text.display, color: color.forest[600], textAlign: "center", marginTop: space.md },
  progressTrack: {
    marginTop: space.xxl,
    width: "100%",
    maxWidth: 278,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(28,60,28,0.12)",
    overflow: "hidden"
  },
  progressFill: { height: 3, backgroundColor: color.forest[500] },

  // action
  actionCard: { borderRadius: radius.card, backgroundColor: color.paper.card, padding: space.lg, marginTop: space.lg, borderWidth: 1.5, borderColor: ink.line, ...stamp(ink.edge, 5) },
  actionTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionTagText: { ...text.eyebrow, color: color.stone[500] },
  actionCopy: { ...text.bodyLg, color: color.stone[700], marginTop: space.md },
  actionNote: { borderTopWidth: 1, borderStyle: "dashed", borderColor: color.line, paddingTop: space.sm, marginTop: space.md },

  // reflection
  reflectionScroll: { paddingTop: space.lg, paddingBottom: space.lg },
  skipButton: { alignSelf: "center", paddingVertical: space.md, paddingHorizontal: space.sm, minHeight: target.min },
  skipText: { ...text.label, fontFamily: font.sans, color: color.forest[600], textDecorationLine: "underline" },

  // growth
  // both layers stand on one ground line, so the plant rises out of the seed
  growthStage: { width: 300, height: 360, alignItems: "center", justifyContent: "flex-end" },
  // centred on the plant's middle, not the stage's, so the light is behind it
  growthRays: { position: "absolute", left: (300 - GROWTH_RAYS) / 2, top: 190 - GROWTH_RAYS / 2 },
  growthPlantLayer: { position: "absolute", bottom: 0, width: 290, height: 356, transformOrigin: "center bottom" },
  growthSeedLayer: { position: "absolute", bottom: 0, width: 186, height: 168, transformOrigin: "center bottom" },
  growthTitle: { fontFamily: font.serifItalic, fontSize: 19, lineHeight: 28, color: color.forest[600], marginTop: space.lg, textAlign: "center" },
  growthBody: { ...text.caption, color: color.forest[600], textAlign: "center", maxWidth: 280, marginTop: space.xs },

  // pattern
  tabScroll: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: 108 },
  patternTitle: { ...text.display, color: color.stone[900], marginTop: space.sm, marginBottom: space.lg },
  patternAccent: { color: color.forest[500] },
  emptyBody: { ...text.bodyLg, color: color.stone[700] },
  momentCount: { ...text.displayLg, fontSize: 44, lineHeight: 52, color: color.forest[500], marginTop: space.xs, marginBottom: space.xs },
  rankList: { gap: space.sm, marginTop: space.sm, marginBottom: space.md },
  rankRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rankTag: { ...text.caption, color: color.stone[700], width: 92 },
  rankTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: color.paper[200], overflow: "hidden" },
  rankFill: { height: 6, borderRadius: 3, backgroundColor: color.forest[300] },
  rankCount: { ...text.caption, color: color.stone[500], width: 16, textAlign: "right" },
  field: { flexDirection: "row", flexWrap: "wrap", marginTop: space.xs, marginBottom: space.xs },
  journal: { marginBottom: space.lg },
  journalHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: space.xs },
  journalCount: { ...text.caption, color: color.stone[500] },
  /* two slivers peeking out, so it reads as a stack you are partway into */
  journalPages: { marginTop: space.xxs, overflow: "visible" },
  journalPage: {
    backgroundColor: color.paper.card,
    borderRadius: radius.group,
    padding: space.md,
    minHeight: 168,
    borderWidth: 1.5,
    borderColor: ink.line,
    ...stamp(ink.edge, 3)
  },
  journalTagRow: { flexDirection: "row", marginBottom: space.xs },
  journalMoment: { marginTop: space.md, borderTopWidth: 1, borderTopColor: color.paper[300], paddingTop: space.md },
  journalDateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, marginBottom: space.xs },
  journalDate: { ...text.label, color: color.stone[500] },
  /* the user's hand, not the interface face */
  journalText: { ...text.journal, color: color.stone[900] },
  journalBlank: { ...text.body, color: color.stone[400], fontStyle: "italic" },
  journalHint: { ...text.caption, color: color.stone[400], textAlign: "center", marginTop: space.xs },
  insightCard: {
    backgroundColor: color.paper.card,
    borderRadius: radius.group,
    padding: space.md,
    marginBottom: space.md + 3,
    borderWidth: 1.5,
    borderColor: ink.line,
    ...stamp(ink.edge, 3)
  },
  cardMeta: { ...text.caption, color: color.stone[500] },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  tag: { backgroundColor: "#EFF2E5", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 7 },
  tagText: { ...text.caption, fontFamily: font.sansMedium, color: color.stone[900] },
  quote: { fontFamily: font.serifItalic, fontSize: 15, lineHeight: 24, color: color.stone[700], marginTop: space.md },

  // you
  profileScroll: { paddingHorizontal: space.gutter, paddingTop: space.lg, paddingBottom: 108, alignItems: "stretch" },
  profileMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1.5,
    ...stamp(ink.edge, 3),
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: space.xxs
  },
  profileSeed: { width: 56, height: 66 },
  profileTitle: { ...text.display, color: color.stone[900], textAlign: "center", marginTop: space.sm },
  profileSubtitle: { ...text.caption, color: color.stone[500], textAlign: "center", marginTop: space.xxs, marginBottom: space.lg },
  profileQuote: { ...text.bodyLg, color: color.forest[600] },
  profilePattern: { ...text.caption, color: color.stone[500], marginTop: space.sm },
  profileCard: { backgroundColor: color.paper.card, borderRadius: radius.group, padding: space.md, marginBottom: space.md, borderWidth: 1.5, borderColor: ink.line, ...stamp(ink.edge, 3) },
  // no overflow: hidden — the rows carry no fill to clip, and on iOS it would clip the edge
  settingsGroup: { backgroundColor: color.paper.card, borderRadius: radius.group, marginBottom: space.md, borderWidth: 1.5, borderColor: ink.line, ...stamp(ink.edge, 3) },
  settingsRow: {
    minHeight: 56,
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: "rgba(123,113,96,0.1)" },
  settingsLabel: { flexDirection: "row", alignItems: "center", gap: space.sm },
  settingsLabelText: { ...text.label, fontFamily: font.sansMedium, color: color.stone[900] },
  settingsValue: { flexDirection: "row", alignItems: "center", gap: 5 },
  settingsValueText: { ...text.caption, color: color.stone[500] },
  resetButton: { paddingVertical: space.md, alignItems: "center", minHeight: target.min },
  resetText: { ...text.caption, color: color.clay, textDecorationLine: "underline" },

  // navigation
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: NAV_CONTENT + 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(123,113,96,0.1)",
    backgroundColor: "rgba(255,253,248,0.97)",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center"
  },
  navItem: {
    width: target.navItem.width,
    height: 66,
    minHeight: target.navItem.height,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xxs,
    borderRadius: radius.group,
    borderWidth: 1.5,
    borderColor: "transparent"
  },
  // the Finch move: the chosen tab sits in a tinted, outlined pill
  navItemActive: { backgroundColor: color.forest[50], borderColor: ink.line },
  navLabel: { fontFamily: font.sansMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.3, color: color.stone[500] },
  navLabelActive: { fontFamily: font.sansSemibold, color: color.forest[600] }
});

/** Frames sized to each plant's own proportions, all sharing the horizon at 565. */
/*
 * Where each stage sits on the garden canvas. Every frame shares the ground
 * line (bottom 565) and the centre (x 161) the two hand-tuned frames already
 * used, so a plant grows upward out of the same soil rather than jumping.
 * Heights follow the design file's own proportions between stages.
 */
const heroFrames = {
  optimizer: [
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 119, width: 84, height: 102, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 121, width: 80, height: 128, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 104, width: 115, height: 191, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 73, width: 177, height: 209, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 44, width: 235, height: 240, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 3, width: 317, height: 360, transformOrigin: "center bottom" }
  ],
  seeker: [
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 103, width: 115, height: 108, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 96, width: 130, height: 178, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 97, width: 127, height: 236, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 90, width: 142, height: 233, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 42, width: 238, height: 282, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 23, width: 275, height: 360, transformOrigin: "center bottom" }
  ],
  planner: [
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 102, width: 117, height: 68, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 72, width: 177, height: 113, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 52, width: 219, height: 187, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 23, width: 276, height: 300, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 30, width: 262, height: 322, transformOrigin: "center bottom" },
    { position: "absolute", bottom: GROUND_ABOVE_FLOOR, left: 7, width: 307, height: 380, transformOrigin: "center bottom" }
  ]
} as const;

function heroStageStyle(personality: PersonalityType, stage: GrowthStage) {
  return heroFrames[personality][stage - 1]!;
}
