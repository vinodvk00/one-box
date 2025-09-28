import { Badge } from "@/components/ui/badge";
import { getCategoryIcon } from "@/utils/formatters";
import type { EmailCategory } from "@/types/email";

interface EmailCategoryBadgeProps {
  category: EmailCategory;
  className?: string;
}

export function EmailCategoryBadge({
  category,
  className,
}: EmailCategoryBadgeProps) {
  const getVariant = (cat: EmailCategory) => {
    switch (cat) {
      case "Interested":
        return "default" as const; // Green-ish
      case "Meeting Booked":
        return "secondary" as const; // Blue-ish
      case "Not Interested":
        return "destructive" as const; // Red
      case "Spam":
        return "outline" as const; // Gray
      case "Out of Office":
        return "secondary" as const; // Yellow-ish
      default:
        return "outline" as const;
    }
  };

  const getCustomStyles = (cat: EmailCategory) => {
    switch (cat) {
      case "Interested":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-200";
      case "Meeting Booked":
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200";
      case "Not Interested":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-200";
      case "Spam":
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200";
      case "Out of Office":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200";
      default:
        return "";
    }
  };

  return (
    <Badge
      variant={getVariant(category)}
      className={`${getCustomStyles(category)} ${className || ""}`}
    >
      <span className="mr-1">{getCategoryIcon(category)}</span>
      {category}
    </Badge>
  );
}
