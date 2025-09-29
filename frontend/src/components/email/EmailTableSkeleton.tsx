import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface EmailTableSkeletonProps {
  rows?: number;
}

export function EmailTableSkeleton({ rows = 10 }: EmailTableSkeletonProps) {
  return (
    <>
      {/* Desktop Skeleton */}
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
            {Array.from({ length: rows }).map((_, index) => (
              <TableRow key={index}>
                <TableCell className="p-3 w-1/5">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="space-y-1 min-w-0 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-3 w-2/5">
                  <div className="space-y-1 min-w-0">
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </TableCell>
                <TableCell className="py-3 px-1 w-20 text-center">
                  <Skeleton className="h-3 w-12 mx-auto" />
                </TableCell>
                <TableCell className="py-3 px-1 w-28 text-center">
                  <div className="flex justify-center">
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </TableCell>
                <TableCell className="py-3 px-1 w-20">
                  <div className="flex items-center justify-center space-x-0.5">
                    <Skeleton className="h-7 w-7 rounded" />
                    <Skeleton className="h-7 w-7 rounded" />
                    <Skeleton className="h-7 w-7 rounded" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Skeleton */}
      <div className="block md:hidden">
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>

              <div className="space-y-2">
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>

              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-20 rounded-full" />
                <div className="flex items-center space-x-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
