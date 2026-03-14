import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "N/A";
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch (e) {
    return dateString;
  }
}

export function isEligible(nextEligibleDateStr: string | undefined | null) {
  if (!nextEligibleDateStr) return false;
  try {
    const nextDate = parseISO(nextEligibleDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return nextDate <= today;
  } catch (e) {
    return false;
  }
}
