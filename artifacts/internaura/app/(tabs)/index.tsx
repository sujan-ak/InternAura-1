import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import colors from "@/constants/colors";
import { Card } from "@/components";

const c = colors.light;

type Filters = {
  domains: string[];
  mode: string;
  location: string;
  stipend: number;
  duration: string;
  minMatch: number;
  skills: string[];
  skillMode: "ANY" | "ALL";
};

const empty: Filters = {
  domains: [],
  mode: "Any",
  location: "",
  stipend: 0,
  duration: "Any",
  minMatch: 0,
  skills: ["Figma", "User Research", "Visual Design"],
  skillMode: "ANY",
};

const stipendRanges = [0, 25000, 30000, 35000, 40000];
const durationOptions = ["Any", "<1 month", "1-3 months", "3-6 months", "6+ months"];
const modes = ["Any", "Remote", "On-site", "Hybrid"];

const SKIP_REASONS = [
  "Location doesn't match preference",
  "Stipend is lower than expected",
  "Skill gap is too wide",
  "Not interested in this domain",
  "Already applied elsewhere",
];

function stipendValue(x: string) {
  return Number((x.match(/[0-9]+/) || ["0"])[0]) * 1000;
}
function months(x: string) {
  return Number((x.match(/[0-9]+/) || ["0"])[0]);
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Brand() {
  return (
    <View style={s.brand}>
      <View style={s.mark}>
        <View style={s.dot} />
      </View>
      <Text style={s.brandT}>InternAura</Text>
    </View>
  );
}

function FilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  studentSkills,
  allInternships,
}: {
  visible: boolean;
  onClose: () => void;
  filters: Filters;
  onApply: (f: Filters) => void;
  studentSkills: string[];
  allInternships: any[];
}) {
  const [draft, setDraft] = useState(filters);
  const [skillSearch, setSkillSearch] = useState("");

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const domains = Array.from(new Set(allInternships.map((x) => x.domain)));
  const allSkills = Array.from(
    new Set([
      ...studentSkills,
      ...allInternships.flatMap((x) => [
        ...(x.requiredSkills || []),
        ...(x.preferredSkills || []),
      ]),
    ])
  );

  const visibleSkills = allSkills.filter(
    (x) => !skillSearch || x.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const toggle = (key: "domains", value: string) =>
    setDraft((x) => ({
      ...x,
      domains: x.domains.includes(value)
        ? x.domains.filter((d) => d !== value)
        : [...x.domains, value],
    }));

  const active =
    filters.domains.length +
    Number(filters.mode !== "Any") +
    Number(!!filters.location) +
    Number(filters.stipend > 0) +
    Number(filters.duration !== "Any") +
    Number(filters.minMatch > 0) +
    Number(filters.skills.length !== studentSkills.length);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <View>
              <Text style={s.sheetTitle}>Filter opportunities</Text>
              <Text style={s.sheetSub}>
                {active} active filter{active === 1 ? "" : "s"}
              </Text>
            </View>
            <Pressable onPress={onClose} style={s.close}>
              <Feather name="x" size={19} color={c.foreground} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.label}>DOMAIN</Text>
            <View style={s.chips}>
              {domains.map((x) => (
                <Chip
                  key={x}
                  label={x}
                  active={draft.domains.includes(x)}
                  onPress={() => toggle("domains", x)}
                />
              ))}
            </View>

            <Text style={s.label}>SKILLS</Text>
            <TextInput
              value={skillSearch}
              onChangeText={setSkillSearch}
              placeholder="Search or add a skill"
              placeholderTextColor={c.mutedForeground}
              style={s.input}
            />
            <View style={s.chips}>
              {visibleSkills.map((skill) => (
                <Chip
                  key={skill}
                  label={skill}
                  active={draft.skills.includes(skill)}
                  onPress={() =>
                    setDraft((v) => ({
                      ...v,
                      skills: v.skills.includes(skill)
                        ? v.skills.filter((x) => x !== skill)
                        : [...v.skills, skill],
                    }))
                  }
                />
              ))}
            </View>

            <View style={s.modeRow}>
              <Text style={s.modeLabel}>Match selected skills</Text>
              <View style={s.modeToggle}>
                <Chip
                  label="ANY"
                  active={draft.skillMode === "ANY"}
                  onPress={() => setDraft((v) => ({ ...v, skillMode: "ANY" }))}
                />
                <Chip
                  label="ALL"
                  active={draft.skillMode === "ALL"}
                  onPress={() => setDraft((v) => ({ ...v, skillMode: "ALL" }))}
                />
              </View>
            </View>

            <Text style={s.label}>WORK MODE</Text>
            <View style={s.chips}>
              {modes.map((x) => (
                <Chip
                  key={x}
                  label={x}
                  active={draft.mode === x}
                  onPress={() => setDraft((v) => ({ ...v, mode: x }))}
                />
              ))}
            </View>

            <Text style={s.label}>LOCATION</Text>
            <TextInput
              value={draft.location}
              onChangeText={(location) => setDraft((v) => ({ ...v, location }))}
              placeholder="Search a city or region"
              placeholderTextColor={c.mutedForeground}
              style={s.input}
            />

            <Text style={s.label}>MINIMUM STIPEND</Text>
            <View style={s.chips}>
              {stipendRanges.map((x) => (
                <Chip
                  key={x}
                  label={x === 0 ? "Any" : x >= 40000 ? "₹40k+" : "₹" + String(x / 1000) + "k+"}
                  active={draft.stipend === x}
                  onPress={() => setDraft((v) => ({ ...v, stipend: x }))}
                />
              ))}
            </View>

            <Text style={s.label}>DURATION</Text>
            <View style={s.chips}>
              {durationOptions.map((x) => (
                <Chip
                  key={x}
                  label={x}
                  active={draft.duration === x}
                  onPress={() => setDraft((v) => ({ ...v, duration: x }))}
                />
              ))}
            </View>

            <Text style={s.label}>MINIMUM MATCH · {draft.minMatch}%</Text>
            <View style={s.chips}>
              {[0, 70, 80, 90].map((x) => (
                <Chip
                  key={x}
                  label={x === 0 ? "Any" : x + "%+"}
                  active={draft.minMatch === x}
                  onPress={() => setDraft((v) => ({ ...v, minMatch: x }))}
                />
              ))}
            </View>
          </ScrollView>
          <View style={s.sheetActions}>
            <Pressable
              onPress={() => {
                setDraft(empty);
                onApply(empty);
              }}
            >
              <Text style={s.clear}>Clear all filters</Text>
            </Pressable>
            <Pressable
              style={s.apply}
              onPress={() => {
                onApply(draft);
                onClose();
              }}
            >
              <Text style={s.applyT}>Show internships</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SkipModal({
  item,
  onClose,
  onConfirm,
}: {
  item: any | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [selectedReason, setSelectedReason] = useState(SKIP_REASONS[0]);

  if (!item) return null;

  return (
    <Modal visible={!!item} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <View>
              <Text style={s.sheetTitle}>Pass on this role?</Text>
              <Text style={s.sheetSub}>{item.title} at {item.company}</Text>
            </View>
            <Pressable onPress={onClose} style={s.close}>
              <Feather name="x" size={19} color={c.foreground} />
            </Pressable>
          </View>
          <Text style={s.label}>SELECT A REASON FOR FEEDBACK</Text>
          <View style={s.chips}>
            {SKIP_REASONS.map((reason) => (
              <Chip
                key={reason}
                label={reason}
                active={selectedReason === reason}
                onPress={() => setSelectedReason(reason)}
              />
            ))}
          </View>
          <View style={s.sheetActions}>
            <Pressable onPress={onClose}>
              <Text style={s.clear}>Cancel</Text>
            </Pressable>
            <Pressable
              style={s.apply}
              onPress={() => {
                onConfirm(selectedReason);
                onClose();
              }}
            >
              <Text style={s.applyT}>Confirm Skip</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function Home() {
  const i = useSafeAreaInsets(),
    r = useRouter(),
    { profile, saved, internships, logSkip } = useApp();

  const [filters, setFilters] = useState<Filters>(empty);
  const [sort, setSort] = useState("Best Match");
  const [showFilters, setShowFilters] = useState(false);
  const [skipTarget, setSkipTarget] = useState<any | null>(null);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.multiGet(["internaura-filters", "internaura-sort"]).then((v) => {
      if (v[0][1]) setFilters(JSON.parse(v[0][1]));
      if (v[1][1]) setSort(v[1][1]);
    });
  }, []);

  const updateFilters = (f: Filters) => {
    setFilters(f);
    AsyncStorage.setItem("internaura-filters", JSON.stringify(f));
  };

  const updateSort = (v: string) => {
    setSort(v);
    AsyncStorage.setItem("internaura-sort", v);
  };

  const filtered = useMemo(() => {
    const result = internships.filter(
      (x: any) =>
        !skippedIds.includes(x.id) &&
        (!filters.domains.length || filters.domains.includes(x.domain)) &&
        (filters.mode === "Any" || x.mode === filters.mode) &&
        (!filters.location ||
          x.location.toLowerCase().includes(filters.location.toLowerCase())) &&
        stipendValue(x.stipend) >= filters.stipend &&
        (filters.minMatch === 0 || x.match >= filters.minMatch) &&
        (filters.duration === "Any" ||
          (filters.duration === "<1 month" && months(x.duration) < 1) ||
          (filters.duration === "1-3 months" &&
            months(x.duration) >= 1 &&
            months(x.duration) <= 3) ||
          (filters.duration === "3-6 months" &&
            months(x.duration) > 3 &&
            months(x.duration) <= 6) ||
          (filters.duration === "6+ months" && months(x.duration) > 6))
    );

    return [...result].sort((a: any, b: any) =>
      sort === "Highest Stipend"
        ? stipendValue(b.stipend) - stipendValue(a.stipend)
        : sort === "Shortest Duration"
        ? months(a.duration) - months(b.duration)
        : b.match - a.match
    );
  }, [filters, sort, internships, skippedIds]);

  const active =
    filters.domains.length +
    Number(filters.mode !== "Any") +
    Number(!!filters.location) +
    Number(filters.stipend > 0) +
    Number(filters.duration !== "Any") +
    Number(filters.minMatch > 0);

  const handleSkipConfirm = async (reason: string) => {
    if (skipTarget) {
      await logSkip(skipTarget.id, reason);
      setSkippedIds((prev) => [...prev, skipTarget.id]);
      setSkipTarget(null);
    }
  };

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(x) => x.id}
        contentContainerStyle={[
          s.container,
          { paddingTop: i.top + 18, paddingBottom: 105 },
        ]}
        ListHeaderComponent={
          <>
            <View style={s.header}>
              <Brand />
              <Feather name="bell" size={20} color={c.foreground} />
            </View>
            <Text style={s.greeting}>Good morning, {profile.name.split(" ")[0]}.</Text>
            <Text style={s.sub}>Here are opportunities with your name on them.</Text>
            <View style={s.hero}>
              <View style={{ flex: 1 }}>
                <Text style={s.kickerHero}>YOUR AURA SCORE</Text>
                <Text style={s.heroT}>
                  You’re building{"\n"}a strong profile.
                </Text>
                <Text style={s.heroB}>
                  Your profile is matching well with {profile.goal || "product and design"} roles.
                </Text>
              </View>
              <View style={s.score}>
                <Text style={s.scoreN}>82</Text>
                <Text style={s.scoreL}>/100</Text>
              </View>
            </View>
            <View style={s.listTools}>
              <Pressable onPress={() => setShowFilters(true)} style={s.filterButton}>
                <Feather name="sliders" size={15} color={c.foreground} />
                <Text style={s.filterText}>
                  Filters{active > 0 ? " (" + active + ")" : ""}
                </Text>
                {active > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeT}>{active}</Text>
                  </View>
                )}
              </Pressable>
              <View style={s.sortWrap}>
                <Feather name="arrow-down" size={13} color={c.mutedForeground} />
                <Text style={s.sortText}>{sort}</Text>
                <Pressable
                  onPress={() =>
                    updateSort(
                      sort === "Best Match"
                        ? "Highest Stipend"
                        : sort === "Highest Stipend"
                        ? "Shortest Duration"
                        : "Best Match"
                    )
                  }
                >
                  <Feather name="chevron-down" size={15} color={c.mutedForeground} />
                </Pressable>
              </View>
            </View>
            <Text style={s.count}>
              Showing {filtered.length} of {internships.length} internships
            </Text>
            <Text style={s.kicker}>CURATED FOR YOU</Text>
            <Text style={s.section}>Top matches</Text>
          </>
        }
        renderItem={({ item }) => (
          <Card
            item={item}
            saved={saved.includes(item.id)}
            selectedSkills={filters.skills}
            onPress={() => r.push(("/internship/" + item.id) as any)}
            onSkip={() => setSkipTarget(item)}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Feather name="sliders" size={20} color={c.primary} />
            </View>
            <Text style={s.emptyTitle}>No internships match these filters</Text>
            <Text style={s.emptySub}>Try widening your search to see more opportunities.</Text>
            <Pressable onPress={() => updateFilters(empty)} style={s.emptyButton}>
              <Text style={s.emptyButtonT}>Clear filters</Text>
            </Pressable>
          </View>
        }
      />
      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        studentSkills={profile.skills}
        allInternships={internships}
        onApply={updateFilters}
      />
      <SkipModal
        item={skipTarget}
        onClose={() => setSkipTarget(null)}
        onConfirm={handleSkipConfirm}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 20, backgroundColor: c.background },
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
  header: { flexDirection: "row", justifyContent: "space-between" },
  greeting: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: c.foreground,
    marginTop: 27,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: c.mutedForeground,
    marginTop: 5,
    marginBottom: 22,
  },
  hero: {
    backgroundColor: c.foreground,
    borderRadius: 24,
    padding: 19,
    flexDirection: "row",
    minHeight: 155,
    marginBottom: 25,
  },
  kickerHero: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: c.accent,
    marginBottom: 5,
  },
  heroT: { fontFamily: "Inter_700Bold", fontSize: 21, lineHeight: 25, color: "#FFF9F1" },
  heroB: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 17,
    color: "#B7C6D3",
    marginTop: 10,
    maxWidth: 190,
  },
  score: {
    height: 82,
    width: 82,
    borderRadius: 41,
    borderWidth: 7,
    borderColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  scoreN: { fontFamily: "Inter_700Bold", fontSize: 25, color: "#FFF9F1" },
  scoreL: { fontFamily: "Inter_500Medium", fontSize: 10, color: "#B7C6D3" },
  listTools: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 13,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: "#E3DED5",
  },
  filterText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: c.foreground },
  badge: {
    backgroundColor: c.primary,
    borderRadius: 8,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeT: { fontFamily: "Inter_700Bold", fontSize: 9, color: "#FFF" },
  sortWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  sortText: { fontFamily: "Inter_500Medium", fontSize: 11, color: c.mutedForeground },
  count: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.mutedForeground,
    marginBottom: 16,
  },
  kicker: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: c.primary,
    marginBottom: 5,
  },
  section: {
    fontFamily: "Inter_700Bold",
    fontSize: 23,
    color: c.foreground,
    marginBottom: 14,
  },
  empty: { alignItems: "center", paddingTop: 55, paddingHorizontal: 20 },
  emptyIcon: {
    height: 44,
    width: 44,
    borderRadius: 15,
    backgroundColor: "#FFF0E7",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: c.foreground,
    marginTop: 14,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: c.mutedForeground,
    marginTop: 6,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: c.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 16,
  },
  emptyButtonT: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FFF" },
  overlay: { flex: 1, backgroundColor: "rgba(21,35,59,.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 25,
    maxHeight: "88%",
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: c.foreground },
  sheetSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: c.mutedForeground,
    marginTop: 3,
  },
  close: {
    height: 35,
    width: 35,
    borderRadius: 12,
    backgroundColor: c.card,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.4,
    color: c.primary,
    marginTop: 16,
    marginBottom: 9,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.input,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: c.card,
  },
  chipActive: { backgroundColor: c.foreground, borderColor: c.foreground },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.secondaryForeground,
  },
  chipTextActive: { color: "#FFF9F1" },
  input: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: c.input,
    backgroundColor: c.card,
    paddingHorizontal: 13,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: c.foreground,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  modeLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: c.secondaryForeground,
  },
  modeToggle: { flexDirection: "row", gap: 6 },
  sheetActions: { flexDirection: "row", alignItems: "center", gap: 13, paddingTop: 16 },
  clear: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: c.primary,
    padding: 13,
  },
  apply: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  applyT: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FFF" },
});