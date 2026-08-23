/**
 * Insights screen — CORRECTED
 * REPLACES: artifacts/internaura/app/(tabs)/analytics.tsx
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX #15 — THE SCREEN INVENTED NUMBERS FOR EMPTY ACCOUNTS
 * ─────────────────────────────────────────────────────────────────────────────
 *   line 70   : 85;                              -> "85% average ATS score" with
 *                                                   ZERO recommendations
 *   line 72   profile?.skills?.length || 3       -> "3 strong skills" with none
 *   line 166  recommendations.length || 7        -> "7 curated matches" with none
 *   line 48   Math.max(1, ...)                   -> every missing skill showed at
 *                                                   least "+1% ATS gain"
 *
 * A brand-new user saw a confident dashboard describing nobody. All four are
 * gone; empty state is now an actual empty state.
 *
 * FIX #16 — the local calculateSkillImpact() (lines 9-51) weighted skill match at
 * ×20 while the server weights it at ×0.25 (or ×0.3333 without assessments), so
 * "+7% ATS gain" here and the real delta on Discover were unrelated numbers.
 * There were FOUR copies of this maths in the repo. This screen now reads the
 * server's numbers and computes nothing.
 */

import React, { useMemo } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import { authedFetch } from "@/lib/api";
import { useColors } from "@/hooks/useColors"; // fix #27: was `colors.light`

interface SkillImpact {
  skill: string;
  delta: number;
  currentScore: number;
  projectedScore: number;
  bestRoleTitle: string;
  bestCompany: string;
  occurrences: number;
  status: "Missing" | "Partial";
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const { savedIds, appliedIds, recommendations, profile, isLoading } = useApp();

  /**
   * Skill impact now comes from the server, which runs the SAME
   * calculateHybridScore that produced the score on the card. See
   * patches/lib-db/src/hybrid-scorer.ts -> calculateSkillGapImpact().
   */
  const { data: skillImpacts = [], isLoading: impactsLoading } = useQuery<SkillImpact[]>({
    queryKey: ["skill-impact", profile?.id],
    queryFn: async () => {
      const res = await authedFetch("/api/skill-impact?limit=4");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: Boolean(profile?.id) && recommendations.length > 0,
    staleTime: 60_000,
  });

  // Only real scores count. No `|| 85` anywhere.
  const scored = recommendations
    .map((r) => r.atsScore)
    .filter((n): n is number => typeof n === "number");

  const avgMatch =
    scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  const skillCount = profile?.skills?.length ?? 0;

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const hasData = recommendations.length > 0;

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top + 20 }]}
      contentContainerStyle={{ paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>Your progress</Text>
      <Text style={s.sub}>A clearer view of where your profile is landing.</Text>

      {/* --- Average ATS --- */}
      <View style={s.big}>
        <Text style={s.kicker}>AVERAGE ATS SCORE</Text>
        {avgMatch !== null ? (
          <>
            <Text style={s.bigN}>
              {avgMatch}
              <Text style={s.pct}>%</Text>
            </Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${avgMatch}%` }]} />
            </View>
            <Text style={s.small}>
              Across {scored.length} scored recommendation{scored.length === 1 ? "" : "s"}
            </Text>
          </>
        ) : (
          <>
            <Text style={s.bigDash}>—</Text>
            <Text style={s.small}>
              No scored matches yet. Complete your profile to see your ATS score.
            </Text>
          </>
        )}
      </View>

      {/* --- Signals --- */}
      <Text style={s.kicker}>PROFILE SIGNALS</Text>
      <Text style={s.section}>What stands out</Text>
      <View style={s.grid}>
        <Stat s={s} n={String(skillCount)} t={skillCount === 1 ? "skill" : "skills"} />
        <Stat s={s} n={String(savedIds.length)} t="saved roles" />
        <Stat s={s} n={String(appliedIds.length)} t="applications" />
        <Stat s={s} n={String(recommendations.length)} t="curated matches" />
      </View>

      {/* --- Skills to grow --- */}
      <Text style={s.kicker}>SKILLS TO GROW</Text>
      <Text style={s.section}>Your next edge</Text>

      {impactsLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginVertical: 24 }} />
      ) : skillImpacts.length > 0 ? (
        skillImpacts.map((item) => (
          <View key={item.skill} style={s.skill}>
            <View style={s.skillHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.skillN}>{item.skill}</Text>
                <Text style={s.impactBadge}>+{item.delta}% ATS gain</Text>
              </View>
              <View
                style={[s.statusBadge, item.status === "Partial" ? s.statusPartial : s.statusMissing]}
              >
                <Text
                  style={[
                    s.statusText,
                    item.status === "Partial" ? s.statusTextPartial : s.statusTextMissing,
                  ]}
                >
                  {item.status === "Partial" ? "Partial Match" : "Missing Skill"}
                </Text>
              </View>
            </View>
            <View style={s.skillTrack}>
              <View
                style={[
                  s.skillFill,
                  {
                    width: `${Math.min(100, item.projectedScore)}%`,
                    backgroundColor: item.status === "Partial" ? c.accent : c.primary,
                  },
                ]}
              />
            </View>
            <Text style={s.small}>
              {item.bestRoleTitle} @ {item.bestCompany}: {item.currentScore}% →{" "}
              {item.projectedScore}%
              {item.occurrences > 1 ? ` · appears in ${item.occurrences} roles` : ""}
            </Text>
          </View>
        ))
      ) : (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>
            {hasData ? "No measurable skill gaps" : "Nothing to analyse yet"}
          </Text>
          <Text style={s.emptySub}>
            {hasData
              ? "Your current skills already cover the requirements in your recommendations."
              : "Complete onboarding and upload a resume to start seeing insights."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ s, n, t }: { s: any; n: string; t: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statT}>{t}</Text>
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background },
    container: { flex: 1, paddingHorizontal: 20, backgroundColor: c.background },
    title: { fontFamily: "Inter_700Bold", fontSize: 30, color: c.foreground, marginTop: 28 },
    sub: { fontFamily: "Inter_400Regular", fontSize: 14, color: c.mutedForeground, marginTop: 5, marginBottom: 22 },
    big: { backgroundColor: c.foreground, borderRadius: 23, padding: 20, marginBottom: 28 },
    kicker: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.5, color: c.primary, marginBottom: 5 },
    bigN: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#FFF9F1" },
    bigDash: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#5A6B80" },
    pct: { fontSize: 21, color: "#B7C6D3" },
    track: { height: 7, backgroundColor: "#34455C", borderRadius: 4, marginTop: 7 },
    fill: { height: 7, backgroundColor: c.primary, borderRadius: 4 },
    small: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 9 },
    section: { fontFamily: "Inter_700Bold", fontSize: 23, color: c.foreground, marginBottom: 14 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
    stat: { backgroundColor: c.card, borderRadius: 18, padding: 14, width: "48%", borderWidth: 1, borderColor: c.border },
    statN: { fontFamily: "Inter_700Bold", fontSize: 25, color: c.foreground },
    statT: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 3 },
    skill: { backgroundColor: c.card, borderRadius: 18, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: c.border },
    skillHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    skillN: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground },
    impactBadge: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#059669", marginTop: 2 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusPartial: { backgroundColor: "#FEF3C7" },
    statusMissing: { backgroundColor: "#FEE2E2" },
    statusText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
    statusTextPartial: { color: "#92400E" },
    statusTextMissing: { color: c.destructive },
    skillTrack: { height: 6, backgroundColor: c.muted, borderRadius: 4, marginTop: 10, overflow: "hidden" },
    skillFill: { height: 6, borderRadius: 4 },
    emptyBox: { backgroundColor: c.card, borderRadius: 18, padding: 20, alignItems: "center", borderWidth: 1, borderColor: c.border, marginBottom: 20 },
    emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: c.foreground, marginBottom: 4 },
    emptySub: { fontFamily: "Inter_400Regular", fontSize: 12, color: c.mutedForeground, textAlign: "center" },
  });
