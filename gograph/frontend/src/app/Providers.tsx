import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "../shared/ui";
import { queryClient } from "./queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
