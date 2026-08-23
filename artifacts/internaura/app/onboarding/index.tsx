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
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/context/AppContext";
import { authedFetch } from "@/lib/api";
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
  const { profile } = useApp();

  const [step, setStep] = useState(1);

  // Form State: Pre-populated from existing profile if available
  const [name, setName] = useState(profile?.name || "");
  const [degree, setDegree] = useState(profile?.degree || "");
  const [year, setYear] = useState(profile?.year || "");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(profile?.skills || []);
  const [customSkill, setCustomSkill] = useState("");
  const [careerGoal, setCareerGoal] = useState(profile?.goal || "");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests || []);
  const [location, setLocation] = useState(profile?.location || "");
  const [workMode, setWorkMode] = useState(profile?.workMode || "");
  const [stipendPreference, setStipendPreference] = useState(profile?.stipendPreference || "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStepValid = (s: number) => {
    if (s === 1) return name.trim().length > 0 && degree.trim().length > 0 && year !== "";
    if (s === 2) return selectedSkills.length >= 1;
    if (s === 3) return careerGoal.trim().length > 0 && selectedInterests.length >= 1;
    if (s === 4) return location.trim().length > 0 && workMode !== "" && stipendPreference !== "";
    return false;
  };

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
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await authedFetch("/api/students", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || "Student User",
          degree: degree.trim() || "Computer Science",
          year: year || "3rd year",
          careerGoal: careerGoal.trim() || "Software Developer",
          location: location.trim() || "India",
          workMode,
          stipendPreference,
          interests: selectedInterests,
          skills: selectedSkills,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to create profile (HTTP ${res.status})`);
      }

      const savedData = await res.json();
      if (savedData && savedData.id) {
        await AsyncStorage.setItem("studentId", savedData.id);
      }

      await AsyncStorage.setItem("hasOnboarded", "true");
      queryClient.invalidateQueries({ queryKey: ["/api/students/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("[Onboarding handleSubmit] Failed to create profile:", err);
      setErrorMsg(err.message || "Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
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

      {errorMsg && (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={16} color={c.destructive} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Main Content Area */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Tell us about your education</Text>
            <Text style={styles.stepSubtitle}>
              We personalize recommendations based on your background and academic trajectory.
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
              Select at least 1 skill to help our match engine evaluate skill gaps.
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
              <Text style={styles.label}>Add other skill</Text>
              <View style={styles.customSkillRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="e.g. Kotlin, Docker"
                  placeholderTextColor={c.mutedForeground}
                  value={customSkill}
                  onChangeText={setCustomSkill}
                  onSubmitEditing={addCustomSkill}
                />
                <Pressable onPress={addCustomSkill} style={styles.addSkillBtn}>
                  <Feather name="plus" size={20} color={c.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Where are you headed?</Text>
            <Text style={styles.stepSubtitle}>
              Specify your primary career target and industry interest areas.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Target Role</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Product Designer, ML Engineer"
                placeholderTextColor={c.mutedForeground}
                value={careerGoal}
                onChangeText={setCareerGoal}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Domains of Interest</Text>
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
            <Text style={styles.stepTitle}>Preferences & Logistics</Text>
            <Text style={styles.stepSubtitle}>
              Define where and how you want to work to filter relevant opportunities.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Location</Text>
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
              <Text style={styles.label}>Stipend Expectation</Text>
              <View style={styles.optionsWrap}>
                {STIPEND_OPTIONS.map((stipend) => {
                  const isSelected = stipendPreference === stipend;
                  return (
                    <Pressable
                      key={stipend}
                      onPress={() => setStipendPreference(stipend)}
                      style={[styles.chip, isSelected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {stipend}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} style={styles.backBtn}>
            <Feather name="chevron-left" size={18} color={c.mutedForeground} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}

        {step < 4 ? (
          <Pressable
            onPress={() => setStep((s) => s + 1)}
            disabled={!isStepValid(step)}
            style={[styles.nextBtn, !isStepValid(step) && styles.btnDisabled]}
          >
            <Text style={styles.nextBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFF" style={{ marginLeft: 6 }} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || !isStepValid(4)}
            style={[styles.nextBtn, (isSubmitting || !isStepValid(4)) && styles.btnDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>Complete Profile</Text>
                <Feather name="check" size={18} color="#FFF" style={{ marginLeft: 6 }} />
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
    justifyContent: "space-between",
    alignItems: "center",
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
    borderRadius: 6,
    backgroundColor: c.foreground,
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent,
  },
  brandText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: c.foreground,
  },
  stepCounter: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.mutedForeground,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#EEE8DF",
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: c.primary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.destructive,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  stepContainer: {
    paddingTop: 8,
  },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: c.foreground,
    lineHeight: 28,
  },
  stepSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: c.mutedForeground,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: c.foreground,
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: c.foreground,
  },
  optionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.foreground,
  },
  chipTextActive: {
    color: "#FFF",
  },
  customSkillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addSkillBtn: {
    backgroundColor: c.secondary,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEE8DF",
    backgroundColor: c.background,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: c.mutedForeground,
    marginLeft: 6,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  nextBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFF",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
