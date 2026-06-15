import { Card } from "../../../shared/ui";
import { DonutRoleChart, type DonutSegment } from "../../../shared/charts";
import type { JourneyRole } from "../types";

export type JourneyRoleDonutProps = {
  role: JourneyRole;
};

export function JourneyRoleDonut({ role }: JourneyRoleDonutProps) {
  const segments: DonutSegment[] = role.donut.map((s) => ({
    label: s.label,
    description: s.description,
    value: s.value,
    tone: s.tone,
  }));
  return (
    <Card>
      <Card.Header>
        <Card.Title>{role.title}</Card.Title>
        <Card.Description>{role.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body>
        <DonutRoleChart segments={segments} centerLabel="Papel principal" />
      </Card.Body>
    </Card>
  );
}
