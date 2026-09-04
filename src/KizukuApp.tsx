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
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  actionTemplates,
  personalityTypes,
  quiz,
  stageFor,
  typeFrom,
  type GrowthStage,
  type PersonalityType
} from "./productModel";
import { clearState, loadState, saveState, todayKey, type Entry } from "./storage";
import { themes } from "./tokens";
import { color, elevation, font, motion, radius, space, target, text } from "./tokens";
import { Icon, type IconName } from "./Icon";
import { ThinkingOrb } from "./ThinkingOrb";
import { Watering } from "./Watering";
import { HoldButton } from "./HoldButton";
import { GrowthSequence, preloadGrowthFrames } from "./GrowthSequence";
import Svg, { Circle, G, Path } from "react-native-svg";
import KizukuMark from "../assets/kizuku-mark.svg";
import MeditatingFigure from "../assets/kizuku-meditating.svg";
import WateringCan from "../assets/kizuku-watering-can.svg";

type Screen =
  | "welcome"
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

/** Every type's own plant, both states, straight from the hi-fi file. */
const plants = {
  optimizer: {
    seed: require("../assets/optimiser-seed.png"),
    grown: require("../assets/optimiser-tree.png")
  },
  seeker: {
    seed: require("../assets/seeker-seed.png"),
    grown: require("../assets/seeker-tree.png")
  },
  planner: {
    seed: require("../assets/planner-seed.png"),
    grown: require("../assets/planner-tree.png")
  }
} as const;

function plantFor(personality: PersonalityType, stage: GrowthStage) {
  return plants[personality][stage];
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

  const chooseAction = () => {
    const score = [...worry].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    setActionIndex(Math.abs(score) % actionTemplates.length);
    setScreen("thinking");
  };

  const openTab = (tab: MainTab) => setScreen(tab);

  /** True while a __DEV__ URL jump is driving state, so it is never written back. */
  const devJump = __DEV__ && typeof window !== "undefined" && !!window.location.search;

  // Read once on launch. A returning user goes straight to the garden.
  useEffect(() => {
    let cancelled = false;
    loadState().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setPersonality(saved.personality);
        setActionsDone(saved.actionsDone);
        setEntries(saved.entries);
        setLastCompletedOn(saved.lastCompletedOn);
        setOnboarded(saved.onboarded);
        setPlantName(saved.plantName ?? "");
        if (saved.onboarded) setScreen("home");
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
      version: 2,
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
    if (!__DEV__ || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
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
    setEntries((pages) => [...pages, { date: todayKey(), tag: action.tag, text: reflection.trim() }]);
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
    <View style={styles.stage}>
      <SafeAreaView style={styles.device}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          {screen === "welcome" ? <WelcomeScreen onBegin={startQuiz} /> : null}

          {screen === "quiz" ? (
            <QuizScreen onDone={finishQuiz} onBack={() => setScreen("welcome")} />
          ) : null}

          {screen === "reveal" ? (
            <RevealScreen personality={personality} onDone={() => setScreen("naming")} />
          ) : null}

          {screen === "naming" ? (
            <NamingScreen
              personality={personality}
              onDone={(name) => {
                setPlantName(name);
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
              onContinue={chooseAction}
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
              onSwap={() => setActionIndex((index) => (index + 1) % actionTemplates.length)}
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
              onSkip={() => {
                setEntries((pages) => [...pages, { date: todayKey(), tag: action.tag, text: "" }]);
                setLastCompletedOn(todayKey());
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
      </SafeAreaView>
    </View>
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
  const frame = heroFrames[personality][stage];
  const reach = {
    dx: (frame.left ?? 0) + frame.width / 2 - (canvasWidth - 154 / 2),
    dy: frame.top + frame.height / 2 - (420 + 162 / 2)
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
      <View style={styles.homeHeader}>
        <View style={styles.brandBlock}>
          <View style={styles.brandRow}>
            <KizukuMark width={34} height={34} />
            <Text style={styles.brandName}>kizuku</Text>
          </View>
          <Text style={styles.homeTitle}>{plantName || personalityTypes[personality].name}</Text>
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
            pressed && styles.pressed
          ]}
        >
          <View style={styles.homeCardCopy}>
            <Text style={[styles.homeCardTitle, todayCompleted && styles.inverseText]}>
              {todayCompleted ? "today is tended." : "what's on your mind today?"}
            </Text>
            <Text style={[styles.homeCardBody, todayCompleted && styles.inverseMuted]}>
              {todayCompleted
                ? "come back whenever you need to."
                : "share a worry and get your action"}
            </Text>
          </View>
          <Icon
            name={todayCompleted ? "checkmark" : "arrow-forward"}
            size={25}
            color={todayCompleted ? "#F2F5E9" : color.stone[500]}
          />
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
  return (
    <GradientScreen personality={personality}>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <View style={styles.flowHeading}>
          <Eyebrow>today</Eyebrow>
          <Text style={styles.flowTitle}>what future worry is on your mind right now?</Text>
        </View>

        <Slip note="be specific. the more honest you are, the better your action will be." personality={personality}>
          <TextInput
            accessibilityLabel="Future worry"
            autoFocus
            multiline
            onChangeText={onChange}
            placeholder="write anything. this stays private."
            placeholderTextColor={color.stone[500]}
            style={styles.input}
            textAlignVertical="top"
            value={value}
          />
        </Slip>

        <View style={styles.inlineAction}>
          <PrimaryButton label="get my action" disabled={value.trim().length < 4} onPress={onContinue} />
        </View>
      </View>
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
    <LinearGradient colors={themes[personality].ritual} style={[styles.flex, styles.center]}>
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
  return (
    <GradientScreen personality={personality}>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <View style={styles.flowHeading}>
          <Eyebrow>your action for today</Eyebrow>
          <Text style={styles.flowTitle}>one thing. right now.</Text>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionTag}>
            <Icon name="sparkles" size={13} color={color.stone[500]} />
            <Text style={styles.actionTagText}>{action.tag}</Text>
          </View>
          <Text style={styles.actionCopy}>{action.text}</Text>
          <View style={styles.actionNote}>
            <Text style={styles.inputNoteText}>
              five minutes is enough. how well you do it doesn't matter.
            </Text>
          </View>
        </View>

        <View style={styles.inlineActionStack}>
          <HoldButton label="i'll do it now" onComplete={onCommit} />
          <SecondaryButton label="this doesn't feel right" onPress={onSwap} />
        </View>
      </View>
    </GradientScreen>
  );
}

function CommittingScreen({ personality, onDone }: { personality: PersonalityType; onDone: () => void }) {
  const reduceMotion = useReduceMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;
  const figurePulse = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const duration = reduceMotion ? 350 : 1900;
    const progressAnimation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true
    });
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(figurePulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(figurePulse, { toValue: 0, duration: 850, useNativeDriver: true })
      ])
    );

    progressAnimation.start(({ finished }) => finished && onDone());
    if (!reduceMotion) pulseAnimation.start();
    return () => {
      progressAnimation.stop();
      pulseAnimation.stop();
    };
  }, [figurePulse, onDone, progress, reduceMotion]);

  // width cannot be native-driven, so a full-width fill is translated instead — the
  // same move as HoldButton's progress line. This runs while GrowthScreen preloads
  // 26 frames, which is exactly when the JS thread has nothing to spare.
  const fillTransform = trackWidth
    ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth, 0] }) }]
    : [{ translateX: -9999 }];
  const figureScale = figurePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

  return (
    <LinearGradient colors={themes[personality].ritual} style={styles.flex}>
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
      <Animated.View style={[styles.commitFigure, { transform: [{ scale: figureScale }] }]}>
        <MeditatingFigure width="100%" height="100%" />
      </Animated.View>
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
  useEffect(() => {
    preloadGrowthFrames();
  }, []);

  return (
    <GradientScreen personality={personality}>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <ScrollView
          contentContainerStyle={styles.reflectionScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>you came back</Eyebrow>
          <Text style={styles.flowTitle}>what happened when you did it?</Text>
          <Slip note="your plant grows after you answer this." personality={personality}>
            <TextInput
              accessibilityLabel="Reflection"
              multiline
              onChangeText={onChange}
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
      <LinearGradient colors={themes[personality].growth} style={[styles.flex, styles.center]}>
        <View style={styles.growthStage}>
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
 */
function Journal({ entries }: { entries: Entry[] }) {
  const { width } = useWindowDimensions();
  const pages = useMemo(() => [...entries].reverse(), [entries]);
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
        {pages.map((entry, index) => (
          <View
            key={`${entry.date}-${index}`}
            style={[
              styles.journalPage,
              { width: pageWidth, marginRight: index === pages.length - 1 ? 0 : PAGE_GAP }
            ]}
          >
            <View style={styles.journalDateRow}>
              <Text style={styles.journalDate}>{prettyDate(entry.date)}</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{entry.tag}</Text>
              </View>
            </View>

            {entry.text ? (
              <Text style={styles.journalText}>{entry.text}</Text>
            ) : (
              <Text style={styles.journalBlank}>you skipped this one. that is allowed.</Text>
            )}
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
  const counts = new Map<string, number>();
  entries.forEach(({ tag }) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const most = ranked.length > 0 ? Math.max(...ranked.map(([, count]) => count)) : 1;

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
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
              you turn worry into plans.{"\n"}
              <Text style={styles.patternAccent}>step by step.</Text>
            </Text>

            <Journal entries={entries} />

            <View style={styles.insightCard}>
              <Eyebrow>moments of showing up</Eyebrow>
              <Text style={styles.momentCount}>{actionsDone}</Text>
              <Text style={styles.cardMeta}>no calendar, no streak. this number only ever goes up.</Text>
            </View>

            <GardenField entries={entries} personality={personality} />

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
              <Text style={styles.quote}>“every worry is a question waiting to be heard.”</Text>
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
  const type = personalityTypes[personality];
  const stage = stageFor(actionsDone);
  const rows: Array<{ icon: IconName; label: string; value: string }> = [
    { icon: "moon", label: "notifications", value: "gentle · 1x/day" },
    { icon: "eye", label: "theme", value: "forest" },
    { icon: "lock", label: "privacy", value: "on-device only" }
  ];

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileMark}>
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
                <Icon name={row.icon} size={17} color={color.stone[500]} />
                <Text style={styles.settingsLabelText}>{row.label}</Text>
              </View>
              <View style={styles.settingsValue}>
                <Text style={styles.settingsValueText}>{row.value}</Text>
                <Icon name="chevron-forward" size={14} color={color.stone[500]} />
              </View>
            </View>
          ))}
        </View>

        <SecondaryButton label="retake personality quiz" icon="refresh" onPress={onRetake} />
        <Pressable onPress={onReset} style={styles.resetButton}>
          <Text style={styles.resetText}>reset prototype</Text>
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
  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView contentContainerStyle={styles.welcomeContent} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeMark}>
          <KizukuMark width={30} height={30} />
        </View>

        <Text style={styles.welcomeGreeting}>hello,</Text>

        <Text style={styles.welcomeLetter}>
          this is a small app for the kind of worry that lives in the future — the meeting that
          has not happened, the message you have not sent, the year you cannot picture yet.
        </Text>
        <Text style={styles.welcomeLetter}>
          it will not ask you to feel better. it asks you for one worry, gives you{" "}
          <Text style={styles.welcomeEmphasis}>one small thing to do</Text>, and grows you a tree
          when you do it. that is the whole app.
        </Text>
        <Text style={styles.welcomeLetter}>
          there are no streaks here. a day you miss is a thinner ring, never a reset.
        </Text>

        <Text style={styles.welcomeSignoff}>
          you cannot plan a forest.{"\n"}you can only plant a tree.
        </Text>
        <Text style={styles.welcomeSignature}>Ayushman</Text>
      </ScrollView>

      <View style={styles.welcomeAction}>
        <PrimaryButton label="plant my first tree" onPress={onBegin} />
        <Text style={styles.welcomeNote}>no account · nothing leaves your phone · 60 seconds</Text>
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
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<PersonalityType[]>([]);
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

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <View style={styles.flowContent}>
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
          {question.options.map((option) => {
            const active = selected === option.type;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={option.type}
                onPress={() => choose(option.type)}
                style={({ pressed }) => [styles.option, active && styles.optionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.optionText, active && styles.optionTextSelected]}>{option.text}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inlineAction}>
          <PrimaryButton label={last ? "see my result" : "next"} disabled={!selected} onPress={advance} />
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
      <ScrollView contentContainerStyle={styles.revealContent} showsVerticalScrollIndicator={false}>
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
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={plantFor(personality, "grown")}
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
  personality
}: {
  children: React.ReactNode;
  note: string;
  personality: PersonalityType;
}) {
  const [listening, setListening] = useState(false);

  return (
    <View style={styles.slip}>
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
            size={17}
            color={listening ? "#FFFFFF" : color.stone[700]}
          />
        </Pressable>
      </View>
    </View>
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
function NamingScreen({
  personality,
  onDone
}: {
  personality: PersonalityType;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const theme = themes[personality];
  const type = personalityTypes[personality];

  return (
    <View style={[styles.flex, { backgroundColor: theme.surface }]}>
      <ScrollView contentContainerStyle={styles.namingContent} showsVerticalScrollIndicator={false}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={plantFor(personality, "seed")}
          style={styles.namingSeed}
        />

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
      </ScrollView>

      <View style={styles.bottomAction}>
        <PrimaryButton
          label={name.trim() ? `plant ${name.trim()}` : "plant it"}
          onPress={() => onDone(name.trim())}
        />
        <Pressable onPress={() => onDone("")} style={styles.namingSkip}>
          <Text style={[styles.namingSkipText, { color: theme.ink }]}>i will name it later</Text>
        </Pressable>
      </View>
    </View>
  );
}

function GradientScreen({
  personality,
  children
}: {
  personality: PersonalityType;
  children: React.ReactNode;
}) {
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
    <LinearGradient colors={themes[personality].ritual} style={styles.flex}>
      <Animated.View style={[styles.flex, { opacity: entrance, transform: [{ translateY: rise }] }]}>
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
      <Icon name={icon} size={18} color={color.stone[700]} />
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
      style={({ pressed }) => [styles.primaryButton, disabled && styles.primaryButtonDisabled, pressed && styles.pressed]}
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
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={17} color={color.forest[500]} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function BottomNav({ active, onSelect }: { active: MainTab; onSelect: (tab: MainTab) => void }) {
  const items: Array<{ id: MainTab; label: string; icon: IconName }> = [
    { id: "home", label: "garden", icon: "home" },
    { id: "patterns", label: "pattern", icon: "stats" },
    { id: "profile", label: "you", icon: "person" }
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="button"
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={styles.navItem}
          >
            <Icon name={item.icon} size={20} color={selected ? color.forest[500] : color.stone[400]} />
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
  iconButton: {
    width: target.min,
    height: target.min,
    borderRadius: target.min / 2,
    borderWidth: 1,
    borderColor: "rgba(123,113,96,0.18)",
    backgroundColor: "rgba(255,255,255,0.72)",
    alignItems: "center",
    justifyContent: "center"
  },
  heroOptimizerGrown: { position: "absolute", top: 205, left: -2, width: 326, height: 360, transformOrigin: "center bottom" },
  heroOptimizerSeed: { position: "absolute", top: 402, left: 96, width: 124, height: 163, transformOrigin: "center bottom" },
  heroSeekerGrown: { position: "absolute", top: 205, left: 11, width: 300, height: 360, transformOrigin: "center bottom" },
  heroSeekerSeed: { position: "absolute", top: 417, left: 86, width: 150, height: 148, transformOrigin: "center bottom" },
  heroPlannerGrown: { position: "absolute", top: 185, left: 22, width: 278, height: 380, transformOrigin: "center bottom" },
  heroPlannerSeed: { position: "absolute", top: 465, left: 76, width: 170, height: 100, transformOrigin: "center bottom" },
  heroTreeImage: { width: "100%", height: "100%" },
  heroWateringCan: { position: "absolute", top: 420, right: 0, width: 154, height: 162, zIndex: 2 },
  homeCardMotion: { position: "absolute", left: space.gutter, right: space.gutter, bottom: 146 },
  homeCard: {
    minHeight: 104,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,253,248,0.92)",
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios: { shadowColor: "#1C3C1C", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 18 },
      android: { elevation: 4 },
      default: { boxShadow: "0 8px 24px rgba(28,60,28,0.10)" }
    })
  },
  homeCardCompleted: { backgroundColor: "rgba(28,60,28,0.92)" },
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
    borderRadius: radius.group,
    borderWidth: 1,
    borderColor: color.paper[300],
    backgroundColor: color.paper.card,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: target.min
  },
  optionSelected: { borderWidth: 2, borderColor: color.forest[500], backgroundColor: color.forest[50] },
  optionText: { ...text.bodyLg, fontSize: 16, lineHeight: 24, color: color.stone[700] },
  optionTextSelected: { color: color.forest[600] },

  // type reveal
  revealContent: { paddingHorizontal: space.lg, paddingTop: space.xxl, paddingBottom: 108 },
  namingContent: { paddingHorizontal: space.gutter, paddingTop: space.xxxl, paddingBottom: 140, alignItems: "flex-start" },
  namingSeed: { width: 116, height: 132, alignSelf: "center", marginBottom: space.lg },
  namingTitle: { ...text.displayLg, marginTop: space.xxs },
  namingBody: { ...text.bodyLg, opacity: 0.78, marginTop: space.sm },
  namingField: {
    alignSelf: "stretch",
    marginTop: space.lg,
    backgroundColor: color.paper.card,
    borderRadius: radius.card,
    paddingHorizontal: space.md,
    ...elevation.lifted
  },
  /* the name is written in the hand, like everything else the user authors */
  namingInput: { ...text.journal, fontSize: 26, lineHeight: 40, color: color.stone[900], height: 68, padding: 0 },
  namingSkip: { alignSelf: "center", paddingVertical: space.sm, paddingHorizontal: space.md },
  namingSkipText: { ...text.caption, opacity: 0.72, textDecorationLine: "underline" },
  revealEmblem: { width: 168, height: 208, alignSelf: "center", marginBottom: space.xl },
  revealPlant: { width: "100%", height: "100%" },
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
    ...elevation.lifted
  },
  /* chips get a hairline instead of a shadow — on optimizer's yellow, fill alone
     only reaches 1.27:1, so the edge is what makes them read as objects */
  revealTag: { backgroundColor: color.paper.card, ...elevation.flat },
  revealPattern: { ...text.bodyLg, fontSize: 16, lineHeight: 26, marginTop: space.sm },
  revealTags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.md },

  // ritual flow — no tab bar, so the action sits a gutter off the bottom
  flowContent: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.lg },
  flowHeading: { marginTop: space.lg },
  eyebrow: { ...text.eyebrow, color: color.forest[500] },
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs
  },
  primaryButtonDisabled: { backgroundColor: "rgba(44,82,40,0.28)" },
  primaryButtonText: { ...text.label, fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
  secondaryButton: {
    width: "100%",
    height: target.control,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(44,82,40,0.24)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs
  },
  secondaryButtonText: { ...text.label, fontFamily: font.sansMedium, fontSize: 15, lineHeight: 20, color: color.forest[600] },

  // thinking + committing
  thinkingOrb: { width: 124, height: 124, marginBottom: 36 },
  thinkingText: { ...text.title, fontFamily: font.serifLight, color: color.forest[600], marginTop: space.sm },
  commitCopy: { position: "absolute", top: "28%", left: space.xl, right: space.xl, alignItems: "center" },
  commitTitle: { ...text.display, color: color.forest[600], textAlign: "center", marginTop: space.md },
  progressTrack: {
    position: "absolute",
    top: "58%",
    left: 62,
    right: 62,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(28,60,28,0.12)",
    overflow: "hidden"
  },
  progressFill: { height: 3, backgroundColor: color.forest[500] },
  commitFigure: { position: "absolute", width: 72, height: 128, bottom: 45, alignSelf: "center" },

  // action
  actionCard: { borderRadius: radius.card, backgroundColor: color.paper.card, padding: space.lg, marginTop: space.lg, ...elevation.lifted },
  actionTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionTagText: { ...text.eyebrow, color: color.stone[500] },
  actionCopy: { ...text.bodyLg, color: color.stone[700], marginTop: space.md },
  actionNote: { borderTopWidth: 1, borderStyle: "dashed", borderColor: color.line, paddingTop: space.sm, marginTop: space.md },

  // reflection
  reflectionScroll: { paddingTop: space.lg, paddingBottom: space.lg },
  skipButton: { alignSelf: "center", paddingVertical: space.md, paddingHorizontal: space.sm, minHeight: target.min },
  skipText: { ...text.label, fontFamily: font.sans, color: color.stone[700], textDecorationLine: "underline" },

  // growth
  // both layers stand on one ground line, so the plant rises out of the seed
  growthStage: { width: 300, height: 360, alignItems: "center", justifyContent: "flex-end" },
  growthPlantLayer: { position: "absolute", bottom: 0, width: 290, height: 356, transformOrigin: "center bottom" },
  growthSeedLayer: { position: "absolute", bottom: 0, width: 186, height: 168, transformOrigin: "center bottom" },
  growthTitle: { fontFamily: font.serifItalic, fontSize: 19, lineHeight: 28, color: color.forest[600], marginTop: space.lg },
  growthBody: { ...text.caption, color: color.stone[700], textAlign: "center", maxWidth: 280, marginTop: space.xs },

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
    ...elevation.raised
  },
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
    marginBottom: space.md,
    ...elevation.flat
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
    backgroundColor: "#F1E8C7",
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
  profileCard: { backgroundColor: color.paper.card, borderRadius: radius.group, padding: space.md, marginBottom: space.sm },
  settingsGroup: { backgroundColor: color.paper.card, borderRadius: radius.group, overflow: "hidden", marginBottom: space.sm },
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
    height: 96,
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
    gap: space.xxs
  },
  navLabel: { fontFamily: font.sansMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.3, color: color.stone[500] },
  navLabelActive: { fontFamily: font.sansSemibold, color: color.forest[500] }
});

/** Frames sized to each plant's own proportions, all sharing the horizon at 565. */
const heroFrames = {
  optimizer: { seed: styles.heroOptimizerSeed, grown: styles.heroOptimizerGrown },
  seeker: { seed: styles.heroSeekerSeed, grown: styles.heroSeekerGrown },
  planner: { seed: styles.heroPlannerSeed, grown: styles.heroPlannerGrown }
} as const;

function heroStageStyle(personality: PersonalityType, stage: GrowthStage) {
  return heroFrames[personality][stage];
}
