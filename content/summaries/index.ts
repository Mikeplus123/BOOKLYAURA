// Local demo content. Used when Supabase is not configured, and by `npm run seed`.
// Add new JSON files here (or upload them through /admin once Supabase is connected).
import type { SummaryDocument } from "@/lib/types";
import smallHabits from "./small-habits-big-changes.json";
import deepFocus from "./deep-focus-for-students.json";

export const LOCAL_SUMMARIES = [smallHabits, deepFocus] as unknown as SummaryDocument[];
