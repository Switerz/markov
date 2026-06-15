import * as RadixTabs from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "./cn";
import styles from "./Tabs.module.css";

export const Tabs = {
  Root: ({ className, ...p }: ComponentProps<typeof RadixTabs.Root>) => (
    <RadixTabs.Root className={cn(styles.root, className)} {...p} />
  ),
  List: ({ className, ...p }: ComponentProps<typeof RadixTabs.List>) => (
    <RadixTabs.List className={cn(styles.list, className)} {...p} />
  ),
  Trigger: ({ className, ...p }: ComponentProps<typeof RadixTabs.Trigger>) => (
    <RadixTabs.Trigger className={cn(styles.trigger, className)} {...p} />
  ),
  Content: ({ className, ...p }: ComponentProps<typeof RadixTabs.Content>) => (
    <RadixTabs.Content className={cn(styles.content, className)} {...p} />
  ),
};
