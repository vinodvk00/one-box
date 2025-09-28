import type { EmailCategory } from "@/types/email";
import { ThumbsUp, Calendar, ThumbsDown, Trash2, Coffee } from "lucide-react";
import { createElement } from "react";

export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  const now = new Date();
  const diffInMs = now.getTime() - d.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffInDays === 1) {
    return "Yesterday";
  } else if (diffInDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  } else if (diffInDays < 365) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } else {
    return d.toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
};

export const formatDateTime = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleString();
};

export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

export const extractEmailAddress = (email: string): string => {
  const match = email.match(/<(.+)>/);
  return match ? match[1] : email;
};

export const formatEmailName = (name: string, address: string): string => {
  if (name && name !== address) {
    return name;
  }
  return extractEmailAddress(address);
};

export const getCategoryColor = (category: EmailCategory): string => {
  const colors: Record<EmailCategory, string> = {
    Interested: "bg-green-100 text-green-800 border-green-200",
    "Meeting Booked": "bg-blue-100 text-blue-800 border-blue-200",
    "Not Interested": "bg-red-100 text-red-800 border-red-200",
    Spam: "bg-gray-100 text-gray-800 border-gray-200",
    "Out of Office": "bg-yellow-100 text-yellow-800 border-yellow-200",
  };
  return colors[category];
};

export const getCategoryIcon = (category: EmailCategory) => {
  const icons = {
    Interested: ThumbsUp,
    "Meeting Booked": Calendar,
    "Not Interested": ThumbsDown,
    Spam: Trash2,
    "Out of Office": Coffee,
  };
  const IconComponent = icons[category];
  return IconComponent
    ? createElement(IconComponent, { className: "h-5 w-5" })
    : null;
};

export const highlightSearchTerm = (
  text: string,
  searchTerm: string
): string => {
  if (!searchTerm.trim()) return text;

  const regex = new RegExp(
    `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
};

export const formatCount = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
};

export const formatConfidence = (confidence: number): string => {
  return `${Math.round(confidence * 100)}%`;
};

export const stripHtmlTags = (html: string): string => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
};

export const getEmailPreview = (email: {
  body: string;
  textBody?: string;
  htmlBody?: string;
}): string => {
  let preview = "";

  if (email.textBody) {
    preview = email.textBody;
  } else if (email.htmlBody) {
    preview = stripHtmlTags(email.htmlBody);
  } else {
    preview = stripHtmlTags(email.body);
  }

  return truncateText(preview.replace(/\s+/g, " ").trim(), 150);
};
