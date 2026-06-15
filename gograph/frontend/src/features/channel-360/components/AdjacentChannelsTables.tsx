import { Card } from "../../../shared/ui";
import {
  channelIcon,
  channelInitial,
} from "../../../shared/icons/channelIcons";
import type { AdjacentChannels, AdjacentChannelsBlock } from "../types";
import styles from "./AdjacentChannelsTables.module.css";

export type AdjacentChannelsTablesProps = {
  tables: AdjacentChannelsBlock;
};

function AdjacentTable({ data }: { data: AdjacentChannels }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{data.title}</Card.Title>
        <Card.Description>{data.subtitle}</Card.Description>
      </Card.Header>
      <Card.Body>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.rank}>
                #
              </th>
              <th scope="col">Canal</th>
              <th scope="col" className={styles.right}>
                Participação
              </th>
              <th scope="col" className={styles.right}>
                Jornadas
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const icon = channelIcon(row.channel, 14);
              return (
                <tr key={`${row.rank}-${row.channel}`}>
                  <td className={styles.rank}>{row.rank}</td>
                  <td>
                    <span className={styles.channelCell}>
                      <span className={styles.channelIcon} aria-hidden>
                        {icon ?? channelInitial(row.channel)}
                      </span>
                      <span>{row.channel}</span>
                    </span>
                  </td>
                  <td className={styles.right}>{row.participation}</td>
                  <td className={styles.right}>{row.journeys}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card.Body>
    </Card>
  );
}

export function AdjacentChannelsTables({ tables }: AdjacentChannelsTablesProps) {
  return (
    <div className={styles.grid}>
      <AdjacentTable data={tables.channelsBefore} />
      <AdjacentTable data={tables.channelsAfter} />
    </div>
  );
}
