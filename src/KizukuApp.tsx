import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { actionTemplates } from "./productModel";
import { color, elevation, font, motion, radius, space, target, text } from "./tokens";
import KizukuMark from "../assets/kizuku-mark.svg";
import MeditatingFigure from "../assets/kizuku-meditating.svg";
import WateringCan from "../assets/kizuku-watering-can.svg";

type Screen =
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
  background: require("../assets/garden-background.png"),
  seed: require("../assets/optimiser-seed.png"),
  sapling: require("../assets/sapling.png"),
  tree: require("../assets/optimiser-tree.png")
};

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
  const [screen, setScreen] = useState<Screen>("home");
  const [worry, setWorry] = useState("");
  const [reflection, setReflection] = useState("");
  const [actionsDone, setActionsDone] = useState(0);
  const [todayCompleted, setTodayCompleted] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);

  const action = actionTemplates[actionIndex % actionTemplates.length]!;

  const chooseAction = () => {
    const score = [...worry].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    setActionIndex(Math.abs(score) % actionTemplates.length);
    setScreen("thinking");
  };

  const openTab = (tab: MainTab) => setScreen(tab);

  const completeReflection = () => {
    setActionsDone((count) => count + 1);
    setTodayCompleted(true);
    setScreen("growth");
  };

  return (
    <View style={styles.stage}>
      <SafeAreaView style={styles.device}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          {screen === "home" ? (
            <HomeScreen
              actionsDone={actionsDone}
              todayCompleted={todayCompleted}
              onStart={() => {
                setWorry("");
                setReflection("");
                setTodayCompleted(false);
                setScreen("worry");
              }}
              onTab={openTab}
              onProfile={() => setScreen("profile")}
            />
          ) : null}

          {screen === "worry" ? (
            <WorryScreen
              value={worry}
              onChange={setWorry}
              onBack={() => setScreen("home")}
              onContinue={chooseAction}
              onTab={openTab}
            />
          ) : null}

          {screen === "thinking" ? <ThinkingScreen onDone={() => setScreen("action")} /> : null}

          {screen === "action" ? (
            <ActionScreen
              action={action}
              onBack={() => setScreen("home")}
              onCommit={() => setScreen("committing")}
              onSwap={() => setActionIndex((index) => (index + 1) % actionTemplates.length)}
              onTab={openTab}
            />
          ) : null}

          {screen === "committing" ? (
            <CommittingScreen onDone={() => setScreen("reflection")} />
          ) : null}

          {screen === "reflection" ? (
            <ReflectionScreen
              value={reflection}
              onChange={setReflection}
              onBack={() => setScreen("action")}
              onSkip={() => {
                setTodayCompleted(true);
                setScreen("home");
              }}
              onContinue={completeReflection}
              onTab={openTab}
            />
          ) : null}

          {screen === "growth" ? (
            <GrowthScreen actionsDone={actionsDone} onDone={() => setScreen("home")} />
          ) : null}

          {screen === "patterns" ? (
            <PatternsScreen actionsDone={actionsDone} onTab={openTab} />
          ) : null}

          {screen === "profile" ? (
            <ProfileScreen
              actionsDone={actionsDone}
              onTab={openTab}
              onReset={() => {
                setWorry("");
                setReflection("");
                setActionsDone(0);
                setTodayCompleted(false);
                setScreen("home");
              }}
            />
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function HomeScreen({
  actionsDone,
  todayCompleted,
  onStart,
  onTab,
  onProfile
}: {
  actionsDone: number;
  todayCompleted: boolean;
  onStart: () => void;
  onTab: (tab: MainTab) => void;
  onProfile: () => void;
}) {
  const reduceMotion = useReduceMotionPreference();
  const landscapeDrift = useRef(new Animated.Value(0)).current;
  const treeBreath = useRef(new Animated.Value(0)).current;
  const treeResponse = useRef(new Animated.Value(0)).current;
  const promptEntrance = useRef(new Animated.Value(0)).current;
  const wateringPosition = useRef(new Animated.ValueXY()).current;

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
    if (!reduceMotion) {
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
    }
    Animated.spring(wateringPosition, {
      toValue: { x: 0, y: 0 },
      ...motion.returnSpring,
      useNativeDriver: true
    }).start();
  };

  const wateringPan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
        onPanResponderMove: (_, gesture) => {
          wateringPosition.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.hypot(gesture.dx, gesture.dy) > 36) waterTree();
          else {
            Animated.spring(wateringPosition, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true
            }).start();
          }
        },
        onPanResponderTerminate: waterTree
      }),
    [wateringPosition]
  );

  const backgroundTranslate = landscapeDrift.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const treeScale = treeBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.018] });
  const treeReactionScale = treeResponse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] });
  const wateringRotate = wateringPosition.x.interpolate({
    inputRange: [-140, 0, 140],
    outputRange: ["-18deg", "0deg", "12deg"],
    extrapolate: "clamp"
  });
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
          <Text style={styles.homeTitle}>the optimiser</Text>
        </View>
        <IconButton icon="person-outline" label="Open profile" onPress={onProfile} />
      </View>

      <Animated.View
        style={[
          styles.heroTree,
          { transform: [{ scale: treeScale }, { scale: treeReactionScale }] }
        ]}
      >
        <Image source={assets.tree} resizeMode="contain" style={styles.heroTreeImage} />
      </Animated.View>

      <Animated.View
        accessibilityHint="Drag it toward the tree"
        accessibilityLabel={`Water the optimiser tree. ${actionsDone} actions noticed.`}
        style={[
          styles.heroWateringCan,
          {
            transform: [
              { translateX: wateringPosition.x },
              { translateY: wateringPosition.y },
              { rotate: wateringRotate }
            ]
          }
        ]}
        {...wateringPan.panHandlers}
      >
        <WateringCan width="100%" height="100%" />
      </Animated.View>

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
          <Ionicons
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
  value,
  onChange,
  onBack,
  onContinue,
  onTab
}: {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onTab: (tab: MainTab) => void;
}) {
  return (
    <GradientScreen>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <View style={styles.flowHeading}>
          <Eyebrow>today</Eyebrow>
          <Text style={styles.flowTitle}>what future worry is on your mind right now?</Text>
        </View>

        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
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
            <View style={styles.micButton}>
              <Ionicons name="mic-outline" size={17} color={color.stone[700]} />
            </View>
          </View>
          <View style={styles.inputNote}>
            <Text style={styles.inputNoteText}>
              be specific. the more honest you are, the better your action will be.
            </Text>
          </View>
        </View>

        <View style={styles.privateLine}>
          <Ionicons name="lock-closed-outline" size={12} color={color.forest[500]} />
          <Text style={styles.privateText}>private · stays on this device</Text>
        </View>

        <View style={styles.bottomAction}>
          <PrimaryButton label="get my action" disabled={value.trim().length < 4} onPress={onContinue} />
        </View>
      </View>
    </GradientScreen>
  );
}

function ThinkingScreen({ onDone }: { onDone: () => void }) {
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

  const figureScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const figureLift = breathe.interpolate({ inputRange: [0, 1], outputRange: [2, -2] });

  return (
    <LinearGradient colors={["#E4EDDA", "#C8D9AC"]} style={[styles.flex, styles.center]}>
      <Animated.View style={[styles.thinkingFigure, { transform: [{ translateY: figureLift }, { scale: figureScale }] }]}>
        <MeditatingFigure width="100%" height="100%" />
      </Animated.View>
      <Text style={styles.thinkingText}>sitting with what you wrote…</Text>
      <Text style={[styles.thinkingText, !secondLine && styles.hidden]}>picking one small thing…</Text>
    </LinearGradient>
  );
}

function ActionScreen({
  action,
  onBack,
  onCommit,
  onSwap,
  onTab
}: {
  action: (typeof actionTemplates)[number];
  onBack: () => void;
  onCommit: () => void;
  onSwap: () => void;
  onTab: (tab: MainTab) => void;
}) {
  return (
    <GradientScreen>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <View style={styles.flowHeading}>
          <Eyebrow>your action for today</Eyebrow>
          <Text style={styles.flowTitle}>one thing. right now.</Text>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionTag}>
            <Ionicons name="sparkles-outline" size={13} color={color.stone[500]} />
            <Text style={styles.actionTagText}>{action.tag}</Text>
          </View>
          <Text style={styles.actionCopy}>{action.text}</Text>
          <View style={styles.actionNote}>
            <Text style={styles.inputNoteText}>
              five minutes is enough. how well you do it doesn't matter.
            </Text>
          </View>
        </View>

        <View style={styles.bottomActionStack}>
          <PrimaryButton label="i'll do it now" onPress={onCommit} />
          <SecondaryButton label="this doesn't feel right" onPress={onSwap} />
        </View>
      </View>
    </GradientScreen>
  );
}

function CommittingScreen({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReduceMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;
  const figurePulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = reduceMotion ? 350 : 1900;
    const progressAnimation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false
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

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const figureScale = figurePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

  return (
    <LinearGradient colors={["#E4EDDA", "#C8D9AC"]} style={styles.flex}>
      <View style={styles.commitCopy}>
        <Eyebrow>tending</Eyebrow>
        <Text style={styles.commitTitle}>a small thing,{"\n"}done with attention.</Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <Animated.View style={[styles.commitFigure, { transform: [{ scale: figureScale }] }]}>
        <MeditatingFigure width="100%" height="100%" />
      </Animated.View>
    </LinearGradient>
  );
}

function ReflectionScreen({
  value,
  onChange,
  onBack,
  onSkip,
  onContinue,
  onTab
}: {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onTab: (tab: MainTab) => void;
}) {
  return (
    <GradientScreen>
      <View style={styles.flowContent}>
        <BackButton onPress={onBack} />
        <ScrollView
          contentContainerStyle={styles.reflectionScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>you came back</Eyebrow>
          <Text style={styles.flowTitle}>what happened when you did it?</Text>
          <View style={styles.inputCard}>
            <View style={styles.inputRow}>
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
              <View style={styles.micButton}>
                <Ionicons name="mic-outline" size={17} color={color.stone[700]} />
              </View>
            </View>
            <View style={styles.inputNote}>
              <Text style={styles.inputNoteText}>your plant grows after you answer this.</Text>
            </View>
          </View>
          <Pressable onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>i didn't do it — that's ok</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.bottomAction}>
          <PrimaryButton
            label="my plant is ready to grow"
            disabled={value.trim().length < 3}
            onPress={onContinue}
          />
        </View>
      </View>
    </GradientScreen>
  );
}

function GrowthScreen({ actionsDone, onDone }: { actionsDone: number; onDone: () => void }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGrown(true), 1100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={["#F0F4E6", "#DDDCA5"]} style={[styles.flex, styles.center]}>
      <Image
        source={grown ? assets.sapling : assets.seed}
        resizeMode="contain"
        style={grown ? styles.growthSapling : styles.growthSeed}
      />
      <Text style={styles.growthTitle}>{grown ? "something grew." : "planting…"}</Text>
      {grown ? (
        <>
          <Text style={styles.growthBody}>
            small actions count. your garden now holds {actionsDone} {actionsDone === 1 ? "moment" : "moments"} of showing up.
          </Text>
          <View style={styles.growthButton}>
            <PrimaryButton label="see my garden" onPress={onDone} />
          </View>
        </>
      ) : null}
    </LinearGradient>
  );
}

function PatternsScreen({ actionsDone, onTab }: { actionsDone: number; onTab: (tab: MainTab) => void }) {
  const completedDays = Math.min(actionsDone, 4);
  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
        <Eyebrow>your pattern</Eyebrow>
        <Text style={styles.patternTitle}>you turn worry into plans.{"\n"}<Text style={styles.patternAccent}>step by step.</Text></Text>

        <View style={styles.insightCard}>
          <View style={styles.cardHeaderRow}>
            <Eyebrow>days you showed up</Eyebrow>
            <Text style={styles.cardMeta}>last 7 days</Text>
          </View>
          <View style={styles.weekRow}>
            {["m", "t", "w", "t", "f", "s", "s"].map((day, index) => (
              <View key={`${day}-${index}`} style={styles.dayColumn}>
                <View style={[styles.dayDot, index < completedDays && styles.dayDotDone]}>
                  {index < completedDays ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
                </View>
                <Text style={styles.dayLabel}>{day}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardMeta}>no streaks. just notice.</Text>
        </View>

        <View style={styles.insightCard}>
          <Eyebrow>traits seen most</Eyebrow>
          <View style={styles.tagRow}>
            {["curious", "adaptive", "forward-leaning"].map((tag) => (
              <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
          </View>
          <Text style={styles.quote}>“every worry is a question waiting to be heard.”</Text>
        </View>

        <View style={styles.rewardCard}>
          <View style={styles.rewardEyebrow}>
            <Ionicons name="gift-outline" size={14} color="#FFFFFF" />
            <Text style={styles.rewardEyebrowText}>something waiting</Text>
          </View>
          <Text style={styles.rewardCopy}>after thirty days of noticing, kizuku sends a small real plant to your door.</Text>
          <View style={styles.rewardButton}><Text style={styles.rewardButtonText}>preview the gift</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" /></View>
        </View>
      </ScrollView>
      <BottomNav active="patterns" onSelect={onTab} />
    </View>
  );
}

function ProfileScreen({
  actionsDone,
  onTab,
  onReset
}: {
  actionsDone: number;
  onTab: (tab: MainTab) => void;
  onReset: () => void;
}) {
  const rows: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = [
    { icon: "moon-outline", label: "notifications", value: "gentle · 1x/day" },
    { icon: "eye-outline", label: "theme", value: "forest" },
    { icon: "lock-closed-outline", label: "privacy", value: "on-device only" }
  ];

  return (
    <View style={[styles.flex, styles.paperScreen]}>
      <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileMark}>
          <Image source={assets.seed} resizeMode="contain" style={styles.profileSeed} />
        </View>
        <Text style={styles.profileTitle}>the optimiser</Text>
        <Text style={styles.profileSubtitle}>{actionsDone} small {actionsDone === 1 ? "action" : "actions"} noticed</Text>

        <View style={styles.profileCard}>
          <Eyebrow>things you carry</Eyebrow>
          <View style={styles.tagRow}>
            {["journal", "constant", "novel", "saved articles"].map((tag) => (
              <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.settingsGroup}>
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.settingsRow, index < rows.length - 1 && styles.settingsRowBorder]}>
              <View style={styles.settingsLabel}>
                <Ionicons name={row.icon} size={17} color={color.stone[500]} />
                <Text style={styles.settingsLabelText}>{row.label}</Text>
              </View>
              <View style={styles.settingsValue}>
                <Text style={styles.settingsValueText}>{row.value}</Text>
                <Ionicons name="chevron-forward" size={14} color={color.stone[500]} />
              </View>
            </View>
          ))}
        </View>

        <SecondaryButton label="retake personality quiz" icon="refresh-outline" onPress={() => {}} />
        <Pressable onPress={onReset} style={styles.resetButton}><Text style={styles.resetText}>reset prototype</Text></Pressable>
      </ScrollView>
      <BottomNav active="profile" onSelect={onTab} />
    </View>
  );
}

function GradientScreen({ children }: { children: React.ReactNode }) {
  return <LinearGradient colors={["#D4E2C4", "#DDD9A8"]} style={styles.flex}>{children}</LinearGradient>;
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
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={18} color={color.stone[700]} />
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
      <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
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
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      {icon ? <Ionicons name={icon} size={17} color={color.forest[500]} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function BottomNav({ active, onSelect }: { active: MainTab; onSelect: (tab: MainTab) => void }) {
  const items: Array<{ id: MainTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: "home", label: "garden", icon: "home-outline" },
    { id: "patterns", label: "pattern", icon: "stats-chart-outline" },
    { id: "profile", label: "you", icon: "person-outline" }
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
            <Ionicons name={item.icon} size={20} color={selected ? color.forest[500] : color.stone[400]} />
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
  heroTree: { position: "absolute", top: 205, left: -2, width: 326, height: 360, transformOrigin: "center bottom" },
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

  // ritual flow — no tab bar, so the action sits a gutter off the bottom
  flowContent: { flex: 1, paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.lg },
  flowHeading: { marginTop: space.lg },
  eyebrow: { ...text.eyebrow, color: color.forest[500] },
  flowTitle: { ...text.title, color: color.forest[600], marginTop: space.xs },
  inputCard: {
    minHeight: 194,
    borderRadius: radius.card,
    backgroundColor: "rgba(255,253,248,0.96)",
    borderWidth: 1,
    borderColor: color.hairline,
    padding: space.gutter,
    marginTop: space.lg,
    ...elevation.raised
  },
  inputRow: { flexDirection: "row", alignItems: "flex-start", gap: space.xs, flex: 1 },
  input: { flex: 1, minHeight: 116, ...text.body, color: color.stone[900], padding: 0 },
  micButton: {
    width: target.min,
    height: target.min,
    borderRadius: target.min / 2,
    backgroundColor: "rgba(123,113,96,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  inputNote: { borderTopWidth: 1, borderStyle: "dashed", borderColor: color.line, paddingTop: space.sm, marginTop: space.sm },
  inputNoteText: { ...text.caption, color: color.stone[500] },
  privateLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: space.md },
  privateText: { fontFamily: font.sansSemibold, fontSize: 11, lineHeight: 15, letterSpacing: 0.4, color: color.forest[500] },
  bottomAction: { position: "absolute", left: space.gutter, right: space.gutter, bottom: space.lg },
  bottomActionStack: { position: "absolute", left: space.gutter, right: space.gutter, bottom: space.lg, gap: space.sm },

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
  thinkingFigure: { width: 112, height: 200, marginBottom: 28 },
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
  reflectionScroll: { paddingTop: space.lg, paddingBottom: 120 },
  skipButton: { alignSelf: "center", paddingVertical: space.md, paddingHorizontal: space.sm, minHeight: target.min },
  skipText: { ...text.label, fontFamily: font.sans, color: color.stone[700], textDecorationLine: "underline" },

  // growth
  growthSeed: { width: 200, height: 240 },
  growthSapling: { width: 190, height: 300 },
  growthTitle: { ...text.displayLg, color: color.forest[600], marginTop: space.sm },
  growthBody: { ...text.bodyLg, color: color.stone[700], textAlign: "center", maxWidth: 300, marginTop: space.sm },
  growthButton: { position: "absolute", left: space.lg, right: space.lg, bottom: 54 },

  // pattern
  tabScroll: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: 108 },
  patternTitle: { ...text.display, color: color.stone[900], marginTop: space.sm, marginBottom: space.lg },
  patternAccent: { color: color.forest[500] },
  insightCard: {
    backgroundColor: color.paper.card,
    borderRadius: radius.group,
    padding: space.md,
    marginBottom: space.md,
    ...elevation.flat
  },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardMeta: { ...text.caption, color: color.stone[500] },
  weekRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: space.md },
  dayColumn: { alignItems: "center", gap: 7 },
  dayDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.paper[200], alignItems: "center", justifyContent: "center" },
  dayDotDone: { backgroundColor: color.forest[500] },
  dayLabel: { fontFamily: font.sans, fontSize: 11, lineHeight: 15, color: color.stone[500] },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.sm },
  tag: { backgroundColor: "#EFF2E5", borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 7 },
  tagText: { ...text.caption, fontFamily: font.sansMedium, color: color.stone[900] },
  quote: { fontFamily: font.serifItalic, fontSize: 15, lineHeight: 24, color: color.stone[700], marginTop: space.md },
  rewardCard: { backgroundColor: "#24511F", borderRadius: radius.group, padding: space.gutter },
  rewardEyebrow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  rewardEyebrowText: { ...text.eyebrow, color: "#FFFFFF" },
  rewardCopy: { ...text.body, color: "#FFFFFF", marginTop: space.sm },
  rewardButton: {
    alignSelf: "flex-start",
    marginTop: space.md,
    height: target.min,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: space.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  rewardButtonText: { ...text.caption, fontFamily: font.sansSemibold, color: "#FFFFFF" },

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
