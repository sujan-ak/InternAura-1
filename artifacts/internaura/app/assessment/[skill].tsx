import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";
import { authedFetch } from "@/lib/api";

const c = colors.light;

export interface QuestionItem {
  id: string;
  type: string;
  prompt: string;
  options?: string[] | null;
  code_snippet?: string | null;
  starter_code?: string | null;
  difficulty: string;
}

export interface CategoryScoreItem {
  category: string;
  score: number;
  max_score: number;
  percentage: number;
  weight: number;
}

export interface EvaluationResult {
  skill: string;
  total_score: number;
  max_score: number;
  percentage: number;
  weighted_score: number;
  competency_level: string;
  proficiency_tier: string;
  category_scores: CategoryScoreItem[];
  question_evaluations: any[];
  demonstrated_concepts: string[];
  missing_concepts: string[];
  strengths: string[];
  growth_areas: string[];
  recommendations: string[];
}

type StepState = "intro" | "generating" | "questions" | "evaluating" | "results";

export default function SkillAssessmentScreen() {
  const { skill: skillParam } = useLocalSearchParams<{ skill: string }>();
  const rawSkill = String(skillParam || "Python").trim();
  const skill = decodeURIComponent(rawSkill);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useApp();

  const [step, setStep] = useState<StepState>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questionSource, setQuestionSource] = useState<string>("ai");
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingText, setLoadingText] = useState("Preparing assessment questions...");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  // Handle back navigation confirmation if in active quiz
  const handleBack = () => {
    if (step === "questions" && Object.keys(answers).length > 0) {
      Alert.alert(
        "Leave Assessment?",
        "Your current answers will be discarded.",
        [
          { text: "Stay", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  // Start Assessment: Create Session
  const handleStart = async () => {
    setStep("generating");
    setError(null);
    setLoadingText("Generating 10 questions for " + skill + "...");

    try {
      const res = await authedFetch("/api/assessment/sessions", {
        method: "POST",
        body: JSON.stringify({ skill, level: "Intermediate" }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to start assessment (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.sessionId && Array.isArray(data.questions) && data.questions.length > 0) {
        setSessionId(data.sessionId);
        setQuestions(data.questions);
        setQuestionSource(data.questionSource || "ai");
        setCurrentIndex(0);
        setAnswers({});
        setStep("questions");
      } else {
        throw new Error("No questions received from assessment service.");
      }
    } catch (err: any) {
      console.warn("[Assessment Session Create Catch]", err?.name, err?.message);
      setError(err.message || "Could not generate questions. Please try again.");
      setStep("intro");
    }
  };

  // Answer selected for current question
  const currentQ = questions[currentIndex];
  const handleSelectOption = (option: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
  };

  const handleTextAnswer = (text: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
  };

  // Submit all answers for evaluation
  const handleSubmit = async () => {
    if (!sessionId) {
      setError("Assessment session expired or invalid. Please start again.");
      setStep("intro");
      return;
    }

    setStep("evaluating");
    setError(null);
    setLoadingText("Evaluating technical answers...");

    try {
      const res = await authedFetch(`/api/assessment/sessions/${sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to evaluate assessment (HTTP ${res.status})`);
      }

      const data: EvaluationResult = await res.json();
      setResult(data);
      setStep("results");

      // Invalidate queries so recommendations update with new skill status
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
    } catch (err: any) {
      console.warn("[Assessment Submit Catch]", err?.name, err?.message);
      setError(err.message || "Failed to evaluate answers. Please try again.");
      setStep("questions");
    }
  };

  // --------------------------------------------------
  // RENDER STEP 1: INTRO
  // --------------------------------------------------
  if (step === "intro") {
    return (
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + 14 }]}>
        <View style={s.nav}>
          <Pressable onPress={handleBack}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
        </View>

        <View style={s.badgeRow}>
          <View style={s.skillTag}>
            <Text style={s.skillTagT}>{skill}</Text>
          </View>
          <Text style={s.levelTag}>Competency Assessment</Text>
        </View>

        <Text style={s.title}>Test your {skill} skills</Text>
        <Text style={s.subtitle}>
          Complete a 10-question evaluation suite to measure your technical proficiency and upgrade your skill fit on internship applications.
        </Text>

        {error && (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={16} color={c.destructive} />
            <Text style={s.errorT}>{error}</Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.secTitle}>Assessment Structure (10 Questions)</Text>
          <View style={s.structRow}>
            <Text style={s.structBullet}>•</Text>
            <Text style={s.structT}>5 Fundamental MCQs (20% weight)</Text>
          </View>
          <View style={s.structRow}>
            <Text style={s.structBullet}>•</Text>
            <Text style={s.structT}>2 Conceptual Architecture questions (20% weight)</Text>
          </View>
          <View style={s.structRow}>
            <Text style={s.structBullet}>•</Text>
            <Text style={s.structT}>2 Code Debugging questions (20% weight)</Text>
          </View>
          <View style={s.structRow}>
            <Text style={s.structBullet}>•</Text>
            <Text style={s.structT}>1 Practical Problem Scenario (40% weight)</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.secTitle}>Passing Threshold</Text>
          <Text style={s.descText}>
            Scoring 60% or higher (Intermediate Tier+) upgrades your skill gap status and boosts your match score across all matching internships.
          </Text>
        </View>

        <Pressable style={s.primaryBtn} onPress={handleStart}>
          <Text style={s.primaryBtnT}>Start Assessment</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </Pressable>
      </ScrollView>
    );
  }

  // --------------------------------------------------
  // RENDER STEP 2: GENERATING QUESTIONS
  // --------------------------------------------------
  if (step === "generating") {
    return (
      <View style={[s.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={s.loadingT}>{loadingText}</Text>
        <Text style={s.loadingSubT}>Preparing 10 technical questions for {skill}...</Text>
      </View>
    );
  }

  // --------------------------------------------------
  // RENDER STEP 3: QUESTION BY QUESTION FORM
  // --------------------------------------------------
  if (step === "questions") {
    if (!currentQ) {
      return (
        <View style={[s.loadingContainer, { paddingTop: insets.top }]}>
          <Text style={s.errorT}>No questions available.</Text>
          <Pressable style={s.primaryBtn} onPress={() => setStep("intro")}>
            <Text style={s.primaryBtnT}>Go Back</Text>
          </Pressable>
        </View>
      );
    }

    const currentAnswer = answers[currentQ.id] || "";
    const isLastQ = currentIndex === questions.length - 1;
    const progressPct = ((currentIndex + 1) / questions.length) * 100;

    return (
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + 14 }]}>
        <View style={s.nav}>
          <Pressable onPress={handleBack}>
            <Feather name="arrow-left" size={22} color={c.foreground} />
          </Pressable>
          <Text style={s.stepIndicator}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progressPct}%` }]} />
        </View>

        {/* Meta badges */}
        <View style={s.metaRow}>
          <View style={s.qTypeBadge}>
            <Text style={s.qTypeT}>{currentQ.type.toUpperCase()}</Text>
          </View>
          <View style={s.diffBadge}>
            <Text style={s.diffT}>{currentQ.difficulty}</Text>
          </View>
          <View style={[s.diffBadge, { backgroundColor: questionSource === "ai" ? "#ECFDF5" : "#F1F5F9" }]}>
            <Text style={[s.diffT, { color: questionSource === "ai" ? "#059669" : c.mutedForeground }]}>
              {questionSource === "ai" ? "AI Generated" : "Curated Bank"}
            </Text>
          </View>
        </View>

        {/* Question Prompt */}
        <Text style={s.qPrompt}>{currentQ.prompt}</Text>

        {/* Code snippet if present */}
        {currentQ.code_snippet && (
          <View style={s.codeBox}>
            <Text style={s.codeText}>{currentQ.code_snippet}</Text>
          </View>
        )}

        {/* Starter code if present */}
        {currentQ.starter_code && (
          <View style={s.codeBox}>
            <Text style={s.codeText}>{currentQ.starter_code}</Text>
          </View>
        )}

        {/* Options / Text Input */}
        {currentQ.options && currentQ.options.length > 0 ? (
          <View style={s.optionsList}>
            {currentQ.options.map((opt, idx) => {
              const selected = currentAnswer === opt;
              return (
                <Pressable
                  key={idx}
                  style={[s.optionItem, selected && s.optionItemSelected]}
                  onPress={() => handleSelectOption(opt)}
                >
                  <View style={[s.radioCircle, selected && s.radioCircleSelected]}>
                    {selected && <View style={s.radioInner} />}
                  </View>
                  <Text style={[s.optionText, selected && s.optionTextSelected]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={s.inputContainer}>
            <Text style={s.inputLabel}>Your Technical Solution / Analysis:</Text>
            <TextInput
              style={s.textArea}
              placeholder="Type your explanation, reasoning, or code solution here..."
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={6}
              value={currentAnswer}
              onChangeText={handleTextAnswer}
            />
          </View>
        )}

        {error && (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={16} color={c.destructive} />
            <Text style={s.errorT}>{error}</Text>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={s.btnRow}>
          {currentIndex > 0 && (
            <Pressable
              style={s.secBtn}
              onPress={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            >
              <Feather name="chevron-left" size={18} color={c.foreground} />
              <Text style={s.secBtnT}>Previous</Text>
            </Pressable>
          )}

          {isLastQ ? (
            <Pressable
              style={[s.primaryBtn, { flex: 1, marginLeft: currentIndex > 0 ? 10 : 0 }]}
              onPress={handleSubmit}
            >
              <Text style={s.primaryBtnT}>Submit Assessment</Text>
              <Feather name="check" size={18} color="#FFF" />
            </Pressable>
          ) : (
            <Pressable
              style={[s.primaryBtn, { flex: 1, marginLeft: currentIndex > 0 ? 10 : 0 }]}
              onPress={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            >
              <Text style={s.primaryBtnT}>Next Question</Text>
              <Feather name="chevron-right" size={18} color="#FFF" />
            </Pressable>
          )}
        </View>
      </ScrollView>
    );
  }

  // --------------------------------------------------
  // RENDER STEP 4: EVALUATING
  // --------------------------------------------------
  if (step === "evaluating") {
    return (
      <View style={[s.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={s.loadingT}>{loadingText}</Text>
        <Text style={s.loadingSubT}>Analyzing code logic, concepts, and calculating weighted score...</Text>
      </View>
    );
  }

  // --------------------------------------------------
  // RENDER STEP 5: RESULTS SCREEN
  // --------------------------------------------------
  if (step === "results" && result) {
    const isPass = result.weighted_score >= 60;
    const tierColor =
      result.proficiency_tier === "Expert Tier"
        ? "#059669"
        : result.proficiency_tier === "Proficient Tier"
        ? "#2563EB"
        : result.proficiency_tier === "Intermediate Tier"
        ? "#D97706"
        : "#DC2626";

    return (
      <ScrollView contentContainerStyle={[s.container, { paddingTop: insets.top + 14 }]}>
        <View style={s.nav}>
          <Pressable onPress={() => router.replace("/(tabs)")}>
            <Feather name="x" size={22} color={c.foreground} />
          </Pressable>
          <Text style={s.stepIndicator}>Assessment Complete</Text>
        </View>

        {/* Score Header Card */}
        <View style={[s.resultCard, { borderColor: tierColor }]}>
          <View style={s.tierBadge}>
            <Text style={[s.tierText, { color: tierColor }]}>{result.proficiency_tier}</Text>
          </View>

          <Text style={s.scoreBig}>{result.weighted_score}%</Text>
          <Text style={s.scoreSub}>Weighted Proficiency Score for {result.skill}</Text>

          <View style={[s.statusPill, { backgroundColor: isPass ? "#ECFDF5" : "#FEF2F2" }]}>
            <Feather
              name={isPass ? "check-circle" : "alert-circle"}
              size={14}
              color={isPass ? "#059669" : "#DC2626"}
            />
            <Text style={[s.statusText, { color: isPass ? "#059669" : "#DC2626" }]}>
              {isPass ? "Skill Verified & Boosted" : "Skill Gap Identified"}
            </Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={s.card}>
          <Text style={s.secTitle}>Category Performance</Text>
          {result.category_scores &&
            result.category_scores.map((cat, idx) => (
              <View key={idx} style={s.catRow}>
                <View style={s.catInfo}>
                  <Text style={s.catName}>{cat.category}</Text>
                  <Text style={s.catWeight}>Weight: {Math.round(cat.weight * 100)}%</Text>
                </View>
                <View style={s.catScoreBox}>
                  <Text style={s.catScoreText}>
                    {cat.score} / {cat.max_score}
                  </Text>
                  <Text style={s.catPct}>{Math.round(cat.percentage)}%</Text>
                </View>
              </View>
            ))}
        </View>

        {/* Strengths & Growth Areas */}
        {result.strengths && result.strengths.length > 0 && (
          <View style={s.card}>
            <Text style={s.secTitle}>Demonstrated Strengths</Text>
            {result.strengths.map((str, idx) => (
              <View key={idx} style={s.bulletRow}>
                <Feather name="check" size={14} color="#059669" style={{ marginTop: 2 }} />
                <Text style={s.bulletText}>{str}</Text>
              </View>
            ))}
          </View>
        )}

        {result.growth_areas && result.growth_areas.length > 0 && (
          <View style={s.card}>
            <Text style={s.secTitle}>Key Growth Areas</Text>
            {result.growth_areas.map((area, idx) => (
              <View key={idx} style={s.bulletRow}>
                <Feather name="arrow-up-right" size={14} color={c.primary} style={{ marginTop: 2 }} />
                <Text style={s.bulletText}>{area}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Button */}
        <Pressable
          style={s.primaryBtn}
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
            queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
            router.replace("/(tabs)");
          }}
        >
          <Text style={s.primaryBtnT}>Return to Internship Matches</Text>
          <Feather name="arrow-right" size={18} color="#FFF" />
        </Pressable>
      </ScrollView>
    );
  }

  return null;
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    backgroundColor: c.background,
    paddingBottom: 40,
  },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  stepIndicator: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.mutedForeground,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  skillTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  skillTagT: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: c.foreground,
  },
  levelTag: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.mutedForeground,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 32,
    color: c.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: c.mutedForeground,
    marginBottom: 20,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  secTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: c.foreground,
    marginBottom: 10,
  },
  descText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: c.mutedForeground,
  },
  structRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  structBullet: {
    color: c.primary,
    fontWeight: "bold",
  },
  structT: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.foreground,
    flex: 1,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  primaryBtnT: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFF",
  },
  secBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  secBtnT: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: c.foreground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
    backgroundColor: c.background,
  },
  loadingT: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: c.foreground,
    marginTop: 20,
    textAlign: "center",
  },
  loadingSubT: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 8,
    textAlign: "center",
  },
  progressBg: {
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: c.primary,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  qTypeBadge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qTypeT: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#4F46E5",
  },
  diffBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  diffT: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: c.mutedForeground,
    textTransform: "capitalize",
  },
  qPrompt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    color: c.foreground,
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    color: "#E2E8F0",
  },
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  optionItemSelected: {
    borderColor: c.primary,
    backgroundColor: "#F0FDF4",
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    borderColor: c.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
  },
  optionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.foreground,
    flex: 1,
    lineHeight: 18,
  },
  optionTextSelected: {
    color: c.primary,
    fontFamily: "Inter_600SemiBold",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: c.mutedForeground,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: c.foreground,
    textAlignVertical: "top",
    minHeight: 120,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  errorT: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.destructive,
    flex: 1,
  },
  resultCard: {
    backgroundColor: c.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 16,
  },
  tierBadge: {
    marginBottom: 8,
  },
  tierText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreBig: {
    fontFamily: "Inter_700Bold",
    fontSize: 52,
    color: c.foreground,
    lineHeight: 58,
  },
  scoreSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 4,
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  catRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  catInfo: {
    flex: 1,
  },
  catName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.foreground,
  },
  catWeight: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
  },
  catScoreBox: {
    alignItems: "flex-end",
  },
  catScoreText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.foreground,
  },
  catPct: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  bulletText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: c.foreground,
    flex: 1,
  },
});
