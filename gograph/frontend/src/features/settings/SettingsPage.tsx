import { TopBar } from "../../app/TopBar";
import { Card } from "../../shared/ui";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  return (
    <>
      <TopBar title="Configurações" />
      <div className={styles.page}>
        <Card>
          <Card.Header>
            <Card.Title>Em breve</Card.Title>
            <Card.Description>
              As preferências de conta, integrações e parâmetros padrão do
              modelo serão configuráveis aqui.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <p className={styles.muted}>
              Esta página é um placeholder. Volte em breve.
            </p>
          </Card.Body>
        </Card>
      </div>
    </>
  );
}
