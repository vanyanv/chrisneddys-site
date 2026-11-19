import { PageFade } from "@/components/counter/PageFade";

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageFade>{children}</PageFade>;
}
