import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";
import { EMAIL_CATEGORIES, CATEGORY_INFO } from "@/utils/constants";
import type { SearchParams } from "@/types/email";

interface EmailFiltersProps {
  searchParams: SearchParams;
  onSearchChange: (params: SearchParams) => void;
  availableAccounts?: string[];
  className?: string;
}

export function EmailFilters({
  searchParams,
  onSearchChange,
  availableAccounts = [],
  className = "",
}: EmailFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchParams.q || "");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      return;
    }

    const timer = setTimeout(() => {
      onSearchChange({ ...searchParams, q: localSearch });
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange({ ...searchParams, q: "" });
  };

  const handleClearFilters = () => {
    setLocalSearch("");
    onSearchChange({});
  };

  const hasActiveFilters = Boolean(
    searchParams.q ||
      searchParams.category ||
      searchParams.account ||
      searchParams.folder
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search emails by subject, body, or sender..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {localSearch && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filters:</span>
        </div>

        <div className="min-w-[160px]">
          <Select
            value={searchParams.category || ""}
            onValueChange={(value) =>
              onSearchChange({
                ...searchParams,
                category: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EMAIL_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  <div className="flex items-center gap-2">
                    <span>{CATEGORY_INFO[category]?.label || category}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {availableAccounts.length > 0 && (
          <div className="min-w-[200px]">
            <Select
              value={searchParams.account || ""}
              onValueChange={(value) =>
                onSearchChange({
                  ...searchParams,
                  account: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {availableAccounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="min-w-[120px]">
          <Select
            value={searchParams.folder || ""}
            onValueChange={(value) =>
              onSearchChange({
                ...searchParams,
                folder: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              <SelectItem value="INBOX">Inbox</SelectItem>
              <SelectItem value="Sent">Sent</SelectItem>
              <SelectItem value="Drafts">Drafts</SelectItem>
              <SelectItem value="Spam">Spam</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Showing:</span>
          {searchParams.q && (
            <span className="bg-primary/10 text-primary px-2 py-1 rounded">
              "{searchParams.q}"
            </span>
          )}
          {searchParams.category && (
            <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded">
              {searchParams.category}
            </span>
          )}
          {searchParams.account && (
            <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-1 rounded">
              {searchParams.account}
            </span>
          )}
          {searchParams.folder && (
            <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded">
              {searchParams.folder}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
