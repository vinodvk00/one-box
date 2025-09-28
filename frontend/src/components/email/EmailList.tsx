import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailFilters } from "./EmailFilters";
import { EmailCategoryBadge } from "./EmailCategoryBadge";
import { EmailTableSkeleton } from "./EmailTableSkeleton";
import { EmailPagination } from "./EmailPagination";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useEmails } from "@/hooks/useEmails";
import { useCategories } from "@/hooks/useCategories";
import {
  formatDate,
  formatEmailName,
  getEmailPreview,
  truncateText,
} from "@/utils/formatters";
import { UI_CONFIG } from "@/utils/constants";
import { MoreHorizontal, Eye, Tag, RefreshCw, AlertCircle } from "lucide-react";
import type { EmailDocument, SearchParams } from "@/types/email";

interface EmailListProps {
  initialFilters?: SearchParams;
  className?: string;
}

export function EmailList({
  initialFilters = {},
  className = "",
}: EmailListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] =
    useState<SearchParams>(initialFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(UI_CONFIG.EMAILS_PER_PAGE);

  const { emails, loading, error, searchEmails, refreshEmails } = useEmails();
  const { categorizeEmail } = useCategories();

  const availableAccounts = useMemo(() => {
    const accounts = new Set(emails.map((email) => email.account));
    return Array.from(accounts).sort();
  }, [emails]);

  const paginatedEmails = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return emails.slice(startIndex, endIndex);
  }, [emails, currentPage, pageSize]);

  const totalPages = Math.ceil(emails.length / pageSize);

  const handleSearchChange = useCallback(
    async (newParams: SearchParams) => {
      setSearchParams(newParams);
      setCurrentPage(1);
      await searchEmails(newParams);
    },
    [searchEmails]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  }, []);

  const handleEmailClick = useCallback(
    (email: EmailDocument) => {
      navigate(`/emails/${encodeURIComponent(email.id)}`);
    },
    [navigate]
  );

  const handleCategorizeEmail = useCallback(
    async (emailId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      const success = await categorizeEmail(emailId);
      if (success) {
        await refreshEmails();
      }
    },
    [categorizeEmail, refreshEmails]
  );

  if (error && !loading) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => refreshEmails()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`space-y-6 ${className}`}>
        <EmailFilters
          searchParams={searchParams}
          onSearchChange={handleSearchChange}
          availableAccounts={availableAccounts}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {loading ? (
              <span>Loading emails...</span>
            ) : (
              <span>
                {emails.length} email
                {emails.length !== 1 ? "s" : ""} found
                {searchParams.q && ` for "${searchParams.q}"`}
              </span>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshEmails()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="border rounded-lg">
          {loading ? (
            <EmailTableSkeleton rows={pageSize} />
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="mb-4">
                <svg
                  className="mx-auto h-12 w-12 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                No emails found
              </h3>
              <p className="text-muted-foreground">
                {Object.keys(searchParams).length > 0
                  ? "Try adjusting your search filters"
                  : "No emails have been synced yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[140px]">Category</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEmails.map((email) => (
                  <TableRow
                    key={email.id}
                    onClick={() => handleEmailClick(email)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {formatEmailName(
                              email.from.name,
                              email.from.address
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {formatEmailName(
                              email.from.name,
                              email.from.address
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {email.from.address}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {email.subject || "(No Subject)"}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {truncateText(getEmailPreview(email), 80)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(email.date)}
                      </span>
                    </TableCell>

                    <TableCell>
                      {email.category ? (
                        <EmailCategoryBadge category={email.category} />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Uncategorized
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEmailClick(email);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {!email.category && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleCategorizeEmail(email.id, e)}
                            className="h-8 w-8 p-0"
                            title="Categorize email"
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                          className="h-8 w-8 p-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {emails.length > 0 && (
          <EmailPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={emails.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
