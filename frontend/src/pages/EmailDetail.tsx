import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailCategoryBadge } from "@/components/email/EmailCategoryBadge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useEmailStore } from "@/stores/emailStore";
import { useReplySuggestions } from "@/hooks/useReplysuggestions";
import { useCategories } from "@/hooks/useCategories";
import {
  formatDateTime,
  formatEmailName,
  formatConfidence,
} from "@/utils/formatters";
import {
  ArrowLeft,
  Tag,
  MessageSquareReply,
  Copy,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { EmailDocument } from "@/types/email";

export function EmailDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState<EmailDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getEmailById } = useEmailStore();
  const { categorizeEmail } = useCategories();
  const {
    suggestion,
    loading: suggestionLoading,
    error: suggestionError,
    getReplySuggestion,
    clearSuggestion,
  } = useReplySuggestions();

  useEffect(() => {
    const loadEmail = async () => {
      if (!id) {
        setError("Email ID is required");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const decodedId = decodeURIComponent(id);
        const emailData = await getEmailById(decodedId);

        if (!emailData) {
          setError("Email not found");
        } else {
          setEmail(emailData);
        }
      } catch (err) {
        setError("Failed to load email");
        console.error("Error loading email:", err);
      } finally {
        setLoading(false);
      }
    };

    loadEmail();
  }, [id, getEmailById]);

  const handleCategorize = async () => {
    if (!email) return;

    const success = await categorizeEmail(email.id);
    if (success) {
      const updatedEmail = await getEmailById(email.id);
      if (updatedEmail) {
        setEmail(updatedEmail);
      }
    }
  };

  const handleGetReplySuggestion = async () => {
    if (!email) return;
    await getReplySuggestion(email.id);
  };

  const handleCopySuggestion = async () => {
    if (suggestion?.suggestion) {
      await navigator.clipboard.writeText(suggestion.suggestion);
    }
  };

  const handleBack = () => {
    navigate("/emails");
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error || "Email not found"}</span>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Emails
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              Email Details
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            {!email.category && (
              <Button onClick={handleCategorize} size="sm">
                <Tag className="h-4 w-4 mr-2" />
                Categorize
              </Button>
            )}
            <Button
              onClick={handleGetReplySuggestion}
              size="sm"
              variant="outline"
            >
              <MessageSquareReply className="h-4 w-4 mr-2" />
              Get Reply Suggestion
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <CardTitle className="text-xl">
                    {email.subject || "(No Subject)"}
                  </CardTitle>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {formatEmailName(email.from.name, email.from.address)
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {formatEmailName(email.from.name, email.from.address)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {email.from.address}
                        </p>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium">To:</span>{" "}
                        {email.to.map((contact) => contact.address).join(", ")}
                      </p>
                      <p>
                        <span className="font-medium">Date:</span>{" "}
                        {formatDateTime(email.date)}
                      </p>
                      <p>
                        <span className="font-medium">Account:</span>{" "}
                        {email.account}
                      </p>
                      <p>
                        <span className="font-medium">Folder:</span>{" "}
                        {email.folder}
                      </p>
                    </div>
                  </div>

                  {email.category && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">
                        Category:
                      </span>
                      <EmailCategoryBadge category={email.category} />
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="max-w-none">
                  {email.htmlBody ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: email.htmlBody }}
                      className="email-content"
                    />
                  ) : email.textBody ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground email-content">
                      {email.textBody}
                    </pre>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground email-content">
                      {email.body}
                    </pre>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Email Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    ID:
                  </span>
                  <p className="text-sm text-foreground font-mono break-all">
                    {email.id}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    UID:
                  </span>
                  <p className="text-sm text-foreground">{email.uid}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Flags:
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {email.flags.map((flag, index) => (
                      <span
                        key={index}
                        className="inline-block bg-muted text-muted-foreground text-xs px-2 py-1 rounded"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Reply Suggestion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {suggestionError ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{suggestionError}</AlertDescription>
                  </Alert>
                ) : suggestion ? (
                  <div className="space-y-3">
                    <div className="bg-primary/5 p-3 rounded-md">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {suggestion.suggestion}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Confidence: {formatConfidence(suggestion.confidence)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopySuggestion}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>

                    {suggestion.relevantContext.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Based on training data:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {suggestion.relevantContext.map((context, index) => (
                            <li key={index} className="truncate">
                              • {context}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearSuggestion();
                        handleGetReplySuggestion();
                      }}
                      className="w-full"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleGetReplySuggestion}
                    disabled={suggestionLoading}
                    className="w-full"
                  >
                    {suggestionLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquareReply className="h-4 w-4 mr-2" />
                    )}
                    Get Reply Suggestion
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
