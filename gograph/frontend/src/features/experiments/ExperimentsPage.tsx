import { TopBar } from "../../app/TopBar";

export function ExperimentsPage() {
  return (
    <>
      <TopBar title="Experimentos" subtitle="Em construção." />
      <div style={{ padding: "var(--gg-space-6)" }}>
        <p style={{ color: "var(--gg-text-secondary)", fontSize: 14 }}>
          Esta tela será construída em uma fase posterior do refactor.
        </p>
      </div>
    </>
  );
}
