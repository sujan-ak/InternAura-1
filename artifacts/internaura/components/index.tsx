import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import colors from "@/constants/colors";

const c = colors.light;

export function Brand() {
  return (
    <View style={s.brand}>
      <View style={s.mark}>
        <View style={s.dot} />
      </View>
      <Text style={s.brandT}>InternAura</Text>
    </View>
  );
}

export function Card({
  item,
  onPress,
  onSkip,
  saved,
  selectedSkills = [],
}: {
  item: any;
  onPress: () => void;
  onSkip?: () => void;
  saved?: boolean;
  selectedSkills?: string[];
}) {
  const own = (item.requiredSkills || []).filter((x: string) => selectedSkills.includes(x));
  const gap = (item.preferredSkills || []).filter((x: string) => selectedSkills.includes(x));

  return (
    <Pressable onPress={onPress} style={s.card}>
      <View style={s.row}>
        <View style={s.logo}>
          <Text style={s.logoT}>{item.company?.[0] ?? "?"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.company}>{item.company}</Text>
          <Text style={s.role}>{item.title}</Text>
        </View>
        <View style={s.match}>
          <Text style={s.matchN}>{item.atsScore || item.matchScore || item.match}%</Text>
          <Text style={s.matchL}>ATS Score</Text>
        </View>
      </View>
      {(own.length > 0 || gap.length > 0) && (
        <View style={s.skillTags}>
          <Text style={s.matches}>Matches:</Text>
          {own.map((x: string) => (
            <Text style={s.skillTag} key={x}>
              {x}
            </Text>
          ))}
          {gap.map((x: string) => (
            <Text style={s.gapTag} key={x}>
              {x}
            </Text>
          ))}
        </View>
      )}
      <View style={s.meta}>
        <Text style={s.metaT}>{item.domain}</Text>
        <Text style={s.metaT}>{item.location}</Text>
      </View>
      <View style={s.foot}>
        <Text style={s.duration}>
          {item.duration} · {item.stipend}
        </Text>
        <View style={s.actions}>
          {onSkip && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              style={s.skipBtn}
            >
              <Feather name="slash" size={15} color={c.mutedForeground} />
              <Text style={s.skipT}>Skip</Text>
            </Pressable>
          )}
          <Feather
            name={saved ? "bookmark" : "arrow-up-right"}
            size={18}
            color={saved ? c.primary : c.mutedForeground}
          />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  brandT: { fontFamily: "Inter_700Bold", fontSize: 21, color: c.foreground },
  card: {
    backgroundColor: c.card,
    borderRadius: 22,
    padding: 17,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEE8DF",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#E4EEF6",
    alignItems: "center",
    justifyContent: "center",
  },
  logoT: { fontFamily: "Inter_700Bold", fontSize: 17, color: c.secondaryForeground },
  company: { fontFamily: "Inter_500Medium", fontSize: 12, color: c.mutedForeground },
  role: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: c.foreground, marginTop: 3 },
  match: {
    backgroundColor: "#E4F2EC",
    borderRadius: 14,
    padding: 7,
    alignItems: "center",
    minWidth: 53,
  },
  matchN: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#267A56" },
  matchL: { fontFamily: "Inter_500Medium", fontSize: 9, color: "#267A56" },
  skillTags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, marginTop: 12 },
  matches: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: c.mutedForeground },
  skillTag: {
    backgroundColor: "#E4F2EC",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#267A56",
  },
  gapTag: {
    backgroundColor: "#F0F0EF",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: c.mutedForeground,
  },
  meta: { flexDirection: "row", gap: 15, marginTop: 14 },
  metaT: { fontFamily: "Inter_400Regular", fontSize: 11, color: c.mutedForeground },
  foot: {
    borderTopWidth: 1,
    borderTopColor: "#F0ECE5",
    marginTop: 16,
    paddingTop: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  duration: { fontFamily: "Inter_500Medium", fontSize: 11, color: c.secondaryForeground },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2 },
  skipT: { fontFamily: "Inter_500Medium", fontSize: 11, color: c.mutedForeground },
});