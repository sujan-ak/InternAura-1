import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useCreateOrUpdateStudent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import colors from "@/constants/colors";

const c = colors.light;

const YEAR_OPTIONS = ["1st year", "2nd year", "3rd year", "4th year", "Postgraduate"];
const WORK_MODES = ["Hybrid", "Remote", "On-site"];
const STIPEND_OPTIONS = ["Any stipend", "₹20k+/month", "₹30k+/month", "₹40k+/month"];
const COMMON_SKILLS = [
  "Figma",
  "User Research",
  "Visual Design",
  "Prototyping",
  "Design Systems",
  "JavaScript",
  "React",
  "TypeScript",
  "Python",
  "Node.js",
  "SQL",
  "Excel",
  "Content Writing",
  "SEO",
];
const COMMON_INTERESTS = [
  "AI & ML",
  "Product Strategy",
  "Developer Tools",
  "Fintech",
  "Creator Economy",
  "Sustainability",
  "E-commerce",
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);

  // Form State
  const [name, setName] = useState("");
  const [degree, setDegree] = useState("");
  const [year, setYear] = useState("3rd year");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([
    "Figma",
    "User Research",
    "Visual Design",
  ]);
  const [customSkill, setCustomSkill] = useState("");
  const [careerGoal, setCareerGoal] = useState("Product Designer");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    "AI & ML",
    "Product Strategy",
  ]);
  const [location, setLocation] = useState("Bengaluru");
  const [workMode, setWorkMode] = useState("Hybrid");
  const [stipendPreference, setStipendPreference] = useState("₹30k+/month");

  const createStudentMutation = useCreateOrUpdateStudent();

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addCustomSkill = () => {
    if (customSkill.trim() && !selectedSkills.includes(customSkill.trim())) {
      setSelectedSkills((prev) => [...prev, customSkill.trim()]);
      setCustomSkill("");
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async () => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";
    console.log("[Onboarding handleSubmit] Submitting profile...", {
      resolvedApiUrl: apiUrl,
      fullTargetEndpoint: `${apiUrl}/api/students/me`,
    });

    try {
      await createStudentMutation.mutateAsync({
        data: {
          name: name.trim() || "Aarav Mehta",
          degree: degree.trim() || "B.Des · Interaction Design",
          year,
          careerGoal: careerGoal.trim() || "Product Designer",
          location: location.trim() || "Bengaluru",
          workMode,
          stipendPreference,
          interests: selectedInterests,
          skills: selectedSkills,
        },
      });

      await AsyncStorage.setItem("hasOnboarded", "true");
      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      router.replace("/(tabs)");
    } catch (err) {
      console.error("[Onboarding handleSubmit] Failed to create profile:", err);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      {/* Progress Indicator */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <View style={styles.brandDot} />
          </View>
          <Text style={styles.brandText}>InternAura</Text>
        </View>
        <Text style={styles.stepCounter}>Step {step} of 4</Text>
      </View>

      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(step / 4) * 100}%` }]} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Tell us about your background</Text>
            <Text style={styles.stepSubtitle}>
              We'll personalize internship recommendations based on your education.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Aarav Mehta"
                placeholderTextColor={c.mutedForeground}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Degree / Program</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. B.Des · Interaction Design"
                placeholderTextColor={c.mutedForeground}
                value={degree}
                onChangeText={setDegree}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Year of Study</Text>
              <View style={styles.optionsWrap}>
                {YEAR_OPTIONS.map((item) => {
                  const isSelected = year === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setYear(item)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What are your top skills?</Text>
            <Text style={styles.stepSubtitle}>
              Select at least 3 skills to help our match engine evaluate skill gaps.
            </Text>

            <View style={styles.optionsWrap}>
              {COMMON_SKILLS.map((skill) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <Pressable
                    key={skill}
                    onPress={() => toggleSkill(skill)}
                    style={[styles.chip, isSelected && styles.chipActive]}
                  >
                    {isSelected && (
                      <Feather name="check" size={14} color="#FFF" style={{ marginRight: 6 }} />
                    )}
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {skill}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Add Other Skill</Text>
              <View style={styles.customSkillRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g. Storybook"
                  placeholderTextColor={c.mutedForeground}
                  value={customSkill}
                  onChangeText={setCustomSkill}
                  onSubmitEditing={addCustomSkill}
                />
                <Pressable onPress={addCustomSkill} style={styles.addSkillBtn}>
                  <Feather name="plus" size={18} color={c.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Career Goal & Focus</Text>
            <Text style={styles.stepSubtitle}>
              What role are you targeting, and what domains interest you most?
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Career Goal</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Product Designer, Frontend Engineer"
                placeholderTextColor={c.mutedForeground}
                value={careerGoal}
                onChangeText={setCareerGoal}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Industry Interests</Text>
              <View style={styles.optionsWrap}>
                {COMMON_INTERESTS.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  return (
                    <Pressable
                      key={interest}
                      onPress={() => toggleInterest(interest)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      {isSelected && (
                        <Feather name="check" size={14} color="#FFF" style={{ marginRight: 6 }} />
                      )}
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {interest}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Preferences & Location</Text>
            <Text style={styles.stepSubtitle}>
              Set your preferred location, work model, and stipend expectation.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred City / Region</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Bengaluru, Mumbai, Remote"
                placeholderTextColor={c.mutedForeground}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Work Mode</Text>
              <View style={styles.optionsWrap}>
                {WORK_MODES.map((mode) => {
                  const isSelected = workMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setWorkMode(mode)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {mode}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Minimum Stipend Preference</Text>
              <View style={styles.optionsWrap}>
                {STIPEND_OPTIONS.map((pref) => {
                  const isSelected = stipendPreference === pref;
                  return (
                    <Pressable
                      key={pref}
                      onPress={() => setStipendPreference(pref)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {pref}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color={c.mutedForeground} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}

        {step < 4 ? (
          <Pressable onPress={() => setStep((s) => s + 1)} style={styles.nextBtn}>
            <Text style={styles.nextBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 6 }} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={createStudentMutation.isPending}
            style={[styles.nextBtn, createStudentMutation.isPending && styles.btnDisabled]}
          >
            {createStudentMutation.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>Find My Matches</Text>
                <Feather name="zap" size={18} color="#FFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFF",
  },
  brandText: {
    fontSize: 16,
    fontWeight: "700",
    color: c.foreground,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: "600",
    color: c.mutedForeground,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: c.muted,
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: c.primary,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 20,
  },
  stepContainer: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: c.foreground,
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: c.mutedForeground,
    lineHeight: 20,
    marginTop: -8,
  },
  inputGroup: {
    marginTop: 8,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: c.mutedForeground,
  },
  input: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: c.foreground,
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: c.mutedForeground,
  },
  chipTextActive: {
    color: "#FFF",
    fontWeight: "600",
  },
  customSkillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addSkillBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.mutedForeground,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
