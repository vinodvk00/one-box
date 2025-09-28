import { useCategories } from "@/hooks/useCategories";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCount, getCategoryIcon } from "@/utils/formatters";
import { CATEGORY_INFO } from "@/utils/constants";
import { Loader2, RefreshCw, Play, Mail, Clock, Bot } from "lucide-react";

export function Dashboard() {
  const {
    stats,
    batchStatus,
    loading,
    error,
    refreshStats,
    startBatchCategorization,
  } = useCategories();

  const totalEmails = stats.reduce((sum, stat) => sum + stat.count, 0);
  const uncategorizedCount = batchStatus?.uncategorizedCount || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Email categorization overview</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={refreshStats} disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {uncategorizedCount > 0 && (
            <Button
              onClick={startBatchCategorization}
              disabled={batchStatus?.isRunning}
            >
              {batchStatus?.isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Categorize All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                Total Emails
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCount(totalEmails)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                Uncategorized
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCount(uncategorizedCount)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Bot className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">
                Categorization
              </p>
              <p className="text-2xl font-bold text-foreground">
                {batchStatus?.isRunning ? "Running" : "Ready"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Category Breakdown
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {stats.map((stat) => {
              const percentage =
                totalEmails > 0 ? (stat.count / totalEmails) * 100 : 0;
              const categoryKey = stat.category as keyof typeof CATEGORY_INFO;
              const info = CATEGORY_INFO[categoryKey];

              return (
                <div
                  key={stat.category}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">
                      {getCategoryIcon(categoryKey)}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">
                        {info?.label || stat.category}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {info?.description || ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {formatCount(stat.count)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {batchStatus?.isRunning && (
        <Card className="p-6 bg-primary/5 border-primary/20">
          <div className="flex items-center space-x-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium text-primary">
                Batch Categorization Running
              </p>
              <p className="text-primary/80">
                Processing {uncategorizedCount} uncategorized emails...
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
