import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

const c = colors.light;

export default () => {
  const i = useSafeAreaInsets(),
    { saved, applied, recommendations, profile } = useApp();

  const avgMatch =
    recommendations.length > 0
      ? Math.round(
          recommendations.reduce((acc: number, r: any) => acc + (r.match || 0), 0) /
            recommendations.length
        )
      : 85;

  const numSkills = profile?.skills?.length || 3;

  return (
    <View style={[s.container, { paddingTop: i.top + 20 }]}>
      <Text style={s.title}>Your progress</Text>
      <Text style={s.sub}>A clearer view of where your profile is landing.</Text>

      <View style={s.big}>
        <Text style={s.kicker}>AVERAGE MATCH</Text>
        <Text style={s.bigN}>
          {avgMatch}
          <Text style={s.pct}>%</Text>
        </Text>
        <View style={s.track}>
          <View style={[s.fill, { width: `${avgMatch}%` }]} />
        </View>
        <Text style={s.small}>Across your current recommendations</Text>
      </View>

      <Text style={s.kicker}>PROFILE SIGNALS</Text>
      <Text style={s.section}>What stands out</Text>
      <View style={s.grid}>
        <Stat n={String(numSkills)} t="strong skills" />
        <Stat n={String(saved.length)} t="saved roles" />
        <Stat n={String(applied.length)} t="applications" />
        <Stat n={String(recommendations.length || 4)} t="curated matches" />
      </View>

      <Text style={s.kicker}>SKILLS TO GROW</Text>
      <Text style={s.section}>Your next edge</Text>
      <View style={s.skill}>
        <Text style={s.skillN}>Design systems</Text>
        <View style={s.skillTrack}>
          <View style={s.skillFill} />
        </View>
        <Text style={s.small}>Build one case study to level up</Text>
      </View>
      <View style={s.skill}>
        <Text style={s.skillN}>Prototyping</Text>
        <View style={s.skillTrack}>
          <View style={[s.skillFill, { width: "62%", backgroundColor: c.accent }]} />
        </View>
        <Text style={s.small}>You’re almost there</Text>
      </View>
    </View>
  );
};

function Stat({ n, t }: { n: string; t: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statN}>{n}</Text>
      <Text style={s.statT}>{t}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: c.background },
  title: { fontFamily: "Inter_700Bold", fontSize: 30, color: c.foreground, marginTop: 28 },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: c.mutedForeground,
    marginTop: 5,
    marginBottom: 22,
  },
  big: { backgroundColor: c.foreground, borderRadius: 23, padding: 20, marginBottom: 28 },
  kicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: c.primary,
    marginBottom: 5,
  },
  bigN: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#FFF9F1" },
  pct: { fontSize: 21, color: "#B7C6D3" },
  track: { height: 7, backgroundColor: "#34455C", borderRadius: 4, marginTop: 7 },
  fill: { height: 7, backgroundColor: c.primary },
  small: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 9 },
  section: { fontFamily: "Inter_700Bold", fontSize: 23, color: c.foreground, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 28 },
  stat: {
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 14,
    width: "48%",
    borderWidth: 1,
    borderColor: "#EEE8DF",
  },
  statN: { fontFamily: "Inter_700Bold", fontSize: 25, color: c.foreground },
  statT: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground, marginTop: 3 },
  skill: {
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEE8DF",
  },
  skillN: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground },
  skillTrack: { height: 6, backgroundColor: c.muted, borderRadius: 4, marginTop: 12 },
  skillFill: { height: 6, width: "36%", backgroundColor: c.primary },
});