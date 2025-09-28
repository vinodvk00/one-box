import { EmailList } from "@/components/email/EmailList";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export function Emails() {
  return (
    <ErrorBoundary>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Emails</h1>
          <p className="text-muted-foreground">
            Browse and manage your email inbox
          </p>
        </div>

        <EmailList />
      </div>
    </ErrorBoundary>
  );
}
