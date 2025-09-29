import { useState, useMemo, useCallback, useEffect } from "react";
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
import { useEmailStore } from "@/stores/emailStore";
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

  // Use the centralized email store with pagination
  const {
    emails,
    loading,
    error,
    searchParams,
    totalCount,
    currentPage,
    pageSize,
    totalPages,
    fetchEmails,
    refreshEmails,
    categorizeEmail,
    setCurrentPage,
    setPageSize,
  } = useEmailStore();

  const availableAccounts = useMemo(() => {
    const accounts = new Set(emails.map((email) => email.account));
    return Array.from(accounts).sort();
  }, [emails]);

  const handleSearchChange = useCallback(
    async (newParams: SearchParams) => {
      setCurrentPage(1);
      await fetchEmails(newParams);
    },
    [fetchEmails]
  );

  const handlePageChange = useCallback(async (page: number) => {
    setCurrentPage(page);
    await fetchEmails(); 
  }, [setCurrentPage, fetchEmails]);

  const handlePageSizeChange = useCallback(async (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    await fetchEmails(); 
  }, [setPageSize, setCurrentPage, fetchEmails]);

  const handleEmailClick = useCallback(
    (email: EmailDocument) => {
      navigate(`/emails/${encodeURIComponent(email.id)}`);
    },
    [navigate]
  );

  const handleCategorizeEmail = useCallback(
    async (emailId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      await categorizeEmail(emailId);
    },
    [categorizeEmail]
  );

  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      fetchEmails(initialFilters);
    } else if (emails.length === 0 && !loading) {
      fetchEmails({});
    }
  }, [initialFilters, fetchEmails]);

  useEffect(() => {
    if (currentPage > 1 && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage, setCurrentPage]);

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
                {totalCount} email
                {totalCount !== 1 ? "s" : ""} found
                {searchParams.q && ` for "${searchParams.q}"`}
                {totalCount > emails.length && ` (showing ${emails.length})`}
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

        <div className="border rounded-lg overflow-hidden">
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
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/5">From</TableHead>
                      <TableHead className="w-2/5">Subject</TableHead>
                      <TableHead className="w-20 text-center">Date</TableHead>
                      <TableHead className="w-28 text-center">Category</TableHead>
                      <TableHead className="w-20 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emails.map((email) => (
                      <TableRow
                        key={email.id}
                        onClick={() => handleEmailClick(email)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="p-3 w-1/5">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
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
                              <p className="text-xs text-muted-foreground truncate">
                                {email.from.address}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="p-3 w-2/5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {email.subject || "(No Subject)"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {truncateText(getEmailPreview(email), 60)}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 px-1 w-20 text-center">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(email.date)}
                          </span>
                        </TableCell>

                        <TableCell className="py-3 px-1 w-28 text-center">
                          <div className="flex justify-center">
                            {email.category ? (
                              <EmailCategoryBadge category={email.category} />
                            ) : (
                              <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
                                Uncat.
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-3 px-1 w-20">
                          <div className="flex items-center justify-center space-x-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEmailClick(email);
                              }}
                              className="h-7 w-7 p-0"
                              title="View email"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>

                            {!email.category && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleCategorizeEmail(email.id, e)}
                                className="h-7 w-7 p-0"
                                title="Categorize email"
                              >
                                <Tag className="h-3 w-3" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 p-0"
                              title="More options"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden">
                <div className="divide-y divide-border">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => handleEmailClick(email)}
                      className="cursor-pointer hover:bg-muted/50 p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
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
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm text-muted-foreground">
                            {formatDate(email.date)}
                          </p>
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-foreground mb-1">
                          {email.subject || "(No Subject)"}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {truncateText(getEmailPreview(email), 120)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          {email.category ? (
                            <EmailCategoryBadge category={email.category} />
                          ) : (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              Uncategorized
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmailClick(email);
                            }}
                            className="h-8 w-8 p-0"
                            title="View email"
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
                            title="More options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {totalCount > 0 && (
          <EmailPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
