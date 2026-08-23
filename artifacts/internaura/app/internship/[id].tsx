import React, { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp, RecommendationView } from "@/context/AppContext";
import colors from "@/constants/colors";

const c = colors.light;

export default () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    internships,
    recommendations,
    profile,
    savedIds,
    toggleSave,
    appliedIds,
    applyToInternship,
    logView,
  } = useApp();
  const r = useRouter();
  const i = useSafeAreaInsets();

  const recItem = (recommendations || []).find((x) => x.id === id);
  const rawItem = (internships || []).find((x) => x.id === id);

  const item: RecommendationView | null = recItem || (rawItem ? {
    id: rawItem.id,
    title: rawItem.title,
    company: rawItem.company,
    domain: rawItem.domain,
    location: rawItem.location,
    workMode: rawItem.workMode,
    duration: rawItem.duration,
    stipend: rawItem.stipend,
    description: rawItem.description,
    atsScore: null,
    atsBreakdown: null,
    reasons: [],
    skillGaps: (rawItem.requiredSkills || []).map((s: string) => ({ skill: s, status: "Missing" as const })),
    requiredSkills: rawItem.requiredSkills || [],
    preferredSkills: rawItem.preferredSkills || [],
    experienceLevel: rawItem.experienceLevel || "",
    redirectUrl: rawItem.redirectUrl || null,
    source: rawItem.source || "internal",
  } : null);

  useEffect(() => {
    if (item?.id) {
      logView(item.id);
    }
  }, [item?.id]);

  if (!item) {
    return (
      <View style={[s.container, { paddingTop: i.top + 40, flex: 1, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={48} color={c.mutedForeground} style={{ marginBottom: 16 }} />
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 18, color: c.foreground }}>Internship Not Found</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginTop: 8, textAlign: "center" }}>
          This listing could not be found or is no longer available.
        </Text>
        <Pressable onPress={() => r.back()} style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: c.primary, borderRadius: 12 }}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isSaved = savedIds.includes(item.id);
  const isApplied = appliedIds.includes(item.id);

  const reasonsList = item.reasons && item.reasons.length > 0
    ? item.reasons
    : [];

  const skillGapsList = item.skillGaps && item.skillGaps.length > 0
    ? item.skillGaps
    : [];

  const scoreDisplay = item.atsScore ?? null;

  return (
    <ScrollView contentContainerStyle={[s.container, { paddingTop: i.top + 14 }]}>
      <View style={s.nav}>
        <Pressable onPress={() => r.back()}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <Pressable onPress={() => toggleSave(item.id)}>
          <Feather name="bookmark" size={22} color={isSaved ? c.primary : c.foreground} />
        </Pressable>
      </View>

      <Text style={s.company}>{item.company}</Text>
      <Text style={s.domain}>{item.domain}</Text>
      <Text style={s.title}>{item.title}</Text>

      <View style={s.matchRow}>
        <Text style={s.match}>ATS Score {scoreDisplay !== null ? `${scoreDisplay}%` : "—"}</Text>
        <Text style={s.fit}>Based on Skill Match + Embeddings + Assessment Score</Text>
      </View>

      {/* ATS Score Breakdown Card */}
      <View style={s.atsCard}>
        <Text style={s.atsCardTitle}>ATS Score Breakdown</Text>
        <View style={s.atsRow}>
          <Text style={s.atsLabel}>Skill Match (25%)</Text>
          <Text style={s.atsVal}>{item.atsBreakdown?.skillMatchPct != null ? `${item.atsBreakdown.skillMatchPct}%` : "—"}</Text>
        </View>
        <View style={s.atsRow}>
          <Text style={s.atsLabel}>Semantic Similarity ({item.atsBreakdown?.semanticMethodUsed || "Embeddings"})</Text>
          <Text style={s.atsVal}>{item.atsBreakdown?.semanticSimPct != null ? `${item.atsBreakdown.semanticSimPct}%` : "—"}</Text>
        </View>
        <View style={s.atsRow}>
          <Text style={s.atsLabel}>Assessment Performance (25%)</Text>
          <Text style={s.atsVal}>
            {item.atsBreakdown?.hasAssessments
              ? `${item.atsBreakdown.assessmentPerfPct}%`
              : item.atsBreakdown ? "Redistributed (No Assessments)" : "—"}
          </Text>
        </View>
      </View>

      <View style={s.pills}>
        <Text style={s.pill}>{item.location}</Text>
        <Text style={s.pill}>{item.duration}</Text>
        <Text style={s.pill}>{item.workMode}</Text>
      </View>

      <Text style={s.desc}>{item.description}</Text>

      {reasonsList.length > 0 && (
        <>
          <Text style={s.sec}>Why recommended</Text>
          <View style={s.box}>
            {reasonsList.map((x: string, idx: number) => (
              <View style={s.reason} key={idx}>
                <Text style={s.check}>✓</Text>
                <Text style={s.reasonT}>{x}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {skillGapsList.length > 0 && (
        <>
          <Text style={s.sec}>Your skill fit</Text>
          <View style={s.box}>
            {skillGapsList.map((sg, idx) => {
              const skillName = sg.skill;
              const level = sg.status;

              return (
                <View style={s.skill} key={idx}>
                  <View
                    style={[
                      s.dot,
                      {
                        backgroundColor:
                          level === "Strong"
                            ? "#58AE7F"
                            : level === "Partial"
                            ? c.accent
                            : "#C7CDD2",
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={s.skillN}>{skillName}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[s.level, level === "Missing" && { color: c.destructive }]}>
                      {level}
                    </Text>
                    {(level === "Missing" || level === "Partial") && (
                      <Pressable
                        style={s.takeAssessmentBtn}
                        onPress={() => r.push(`/assessment/${encodeURIComponent(skillName)}`)}
                      >
                        <Text style={s.takeAssessmentText}>Take Assessment</Text>
                        <Feather name="chevron-right" size={12} color={c.primary} />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={s.actions}>
        <Pressable style={s.save} onPress={() => toggleSave(item.id)}>
          <Text style={s.saveT}>{isSaved ? "Saved" : "Save role"}</Text>
        </Pressable>
        <Pressable
          style={s.apply}
          onPress={() => {
            applyToInternship(item.id);
            Alert.alert(
              "Application tracked",
              isApplied
                ? "Already in your tracker."
                : "Nice work — this role is now in your tracker."
            );
          }}
        >
          <Text style={s.applyT}>{isApplied ? "Applied" : "Track application"}</Text>
          <Feather name="arrow-up-right" size={17} color="#FFF" />
        </Pressable>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    backgroundColor: c.background,
    paddingBottom: 40,
  },
  nav: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  company: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground },
  domain: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, marginTop: 4 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 31,
    lineHeight: 38,
    color: c.foreground,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    marginBottom: 20,
  },
  match: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: c.primary,
  },
  fit: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.mutedForeground,
    flex: 1,
  },
  atsCard: {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  atsCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: c.foreground,
    marginBottom: 12,
  },
  atsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  atsLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.mutedForeground,
  },
  atsVal: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.foreground,
  },
  pills: { flexDirection: "row", gap: 8, marginBottom: 28 },
  pill: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: "#E8E2D9",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.foreground,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 25,
    color: c.foreground,
    marginBottom: 32,
  },
  sec: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: c.foreground,
    marginBottom: 14,
  },
  box: {
    backgroundColor: c.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#EEE8DF",
  },
  reason: { flexDirection: "row", gap: 10, marginBottom: 12 },
  check: { color: c.primary, fontWeight: "bold", fontSize: 13 },
  reasonT: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.foreground,
    flex: 1,
    lineHeight: 19,
  },
  skill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F4EFEA",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  skillN: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground },
  level: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
  takeAssessmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  takeAssessmentText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: c.primary,
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 10 },
  save: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#DDD7CD",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.card,
  },
  saveT: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: c.foreground },
  apply: {
    flex: 2,
    backgroundColor: c.primary,
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyT: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#FFF" },
});