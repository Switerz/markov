import { QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, TooltipProvider } from "../shared/ui";
import { queryClient } from "./queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
