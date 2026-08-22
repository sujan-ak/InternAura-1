import React, { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";

const c = colors.light;

export default () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { internships, saved, toggleSaved, applied, apply, logView } = useApp();

  const item = internships.find((x: any) => x.id === id) || internships[0] || {
    id: "10000000-0000-0000-0000-000000000001",
    title: "Product Design Intern",
    company: "Northstar Labs",
    domain: "Product & Design",
    location: "Bengaluru",
    mode: "Hybrid",
    duration: "6 months",
    stipend: "₹35k / month",
    description: "Shape the next generation of tools for creative teams.",
    match: 94,
    reasons: ["Your Figma and user research experience align with the team"],
    skills: [["Figma", "Strong"], ["User Research", "Strong"]],
  };

  useEffect(() => {
    if (item?.id) {
      logView(item.id);
    }
  }, [item?.id]);

  const r = useRouter();
  const i = useSafeAreaInsets();
  const isSaved = saved.includes(item.id);
  const isApplied = applied.includes(item.id);

  return (
    <ScrollView contentContainerStyle={[s.container, { paddingTop: i.top + 14 }]}>
      <View style={s.nav}>
        <Pressable onPress={() => r.back()}>
          <Feather name="arrow-left" size={22} color={c.foreground} />
        </Pressable>
        <Pressable onPress={() => toggleSaved(item.id)}>
          <Feather name="bookmark" size={22} color={isSaved ? c.primary : c.foreground} />
        </Pressable>
      </View>

      <Text style={s.company}>{item.company}</Text>
      <Text style={s.domain}>{item.domain}</Text>
      <Text style={s.title}>{item.title}</Text>

      <View style={s.matchRow}>
        <Text style={s.match}>{item.match}% match</Text>
        <Text style={s.fit}>A great fit for your profile</Text>
      </View>

      <View style={s.pills}>
        <Text style={s.pill}>{item.location}</Text>
        <Text style={s.pill}>{item.duration}</Text>
        <Text style={s.pill}>{item.mode}</Text>
      </View>

      <Text style={s.desc}>{item.description}</Text>

      <Text style={s.sec}>Why recommended</Text>
      <View style={s.box}>
        {(item.reasons || []).map((x: string) => (
          <View style={s.reason} key={x}>
            <Text style={s.check}>✓</Text>
            <Text style={s.reasonT}>{x}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sec}>Your skill fit</Text>
      <View style={s.box}>
        {(item.skills || []).map((x: any) => (
          <View style={s.skill} key={Array.isArray(x) ? x[0] : x}>
            <View
              style={[
                s.dot,
                {
                  backgroundColor:
                    (Array.isArray(x) ? x[1] : x) === "Strong"
                      ? "#58AE7F"
                      : (Array.isArray(x) ? x[1] : x) === "Partial"
                      ? c.accent
                      : "#C7CDD2",
                },
              ]}
            />
            <Text style={s.skillN}>{Array.isArray(x) ? x[0] : x}</Text>
            <Text style={s.level}>{Array.isArray(x) ? x[1] : "Strong"}</Text>
          </View>
        ))}
      </View>

      <View style={s.actions}>
        <Pressable style={s.save} onPress={() => toggleSaved(item.id)}>
          <Text style={s.saveT}>{isSaved ? "Saved" : "Save role"}</Text>
        </Pressable>
        <Pressable
          style={s.apply}
          onPress={() => {
            apply(item.id);
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
    lineHeight: 36,
    color: c.foreground,
    marginTop: 22,
  },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 15 },
  match: {
    backgroundColor: "#E4F2EC",
    color: "#267A56",
    fontFamily: "Inter_700Bold",
    padding: 9,
    borderRadius: 14,
  },
  fit: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#267A56" },
  pills: { flexDirection: "row", gap: 7, marginTop: 20 },
  pill: {
    backgroundColor: c.card,
    borderRadius: 11,
    padding: 9,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: c.secondaryForeground,
    marginTop: 22,
  },
  sec: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: c.foreground,
    marginTop: 29,
    marginBottom: 12,
  },
  box: {
    backgroundColor: c.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEE8DF",
  },
  reason: { flexDirection: "row", gap: 10, paddingVertical: 7 },
  check: { color: "#267A56", fontSize: 15 },
  reasonT: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: c.secondaryForeground,
    flex: 1,
  },
  skill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F0ECE5",
  },
  dot: { height: 9, width: 9, borderRadius: 5, marginRight: 10 },
  skillN: { fontFamily: "Inter_500Medium", fontSize: 13, color: c.foreground, flex: 1 },
  level: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: c.mutedForeground },
  actions: { flexDirection: "row", gap: 10, marginTop: 31 },
  save: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.input,
    alignItems: "center",
    justifyContent: "center",
  },
  saveT: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: c.foreground },
  apply: {
    flex: 1.3,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyT: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FFF" },
});