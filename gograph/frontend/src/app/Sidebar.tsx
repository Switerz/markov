import { NavLink } from "react-router-dom";
import { NAV_ITEMS, BOTTOM_NAV } from "./nav";
import styles from "./Sidebar.module.css";
import { cn } from "../shared/ui/cn";

export function Sidebar() {
  return (
    <nav aria-label="Navegação principal" className={styles.sidebar}>
      <a href="/" className={styles.brand} aria-label="GoGraph — página inicial">
        <span className={styles.brandMark}>G</span>
        <span className={styles.brandName}>GoGraph</span>
      </a>

      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => cn(styles.link, isActive && styles.active)}
            >
              {({ isActive }) => (
                <>
                  <item.icon aria-hidden width={18} height={18} />
                  <span>{item.label}</span>
                  {isActive && <span aria-hidden className={styles.activeDot} />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <ul className={cn(styles.list, styles.bottom)}>
        {BOTTOM_NAV.map((item) => (
          <li key={item.id}>
            <NavLink
              to={item.to}
              className={({ isActive }) => cn(styles.link, isActive && styles.active)}
            >
              {({ isActive }) => (
                <>
                  <item.icon aria-hidden width={18} height={18} />
                  <span>{item.label}</span>
                  {isActive && <span aria-hidden className={styles.activeDot} />}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className={styles.user} aria-label="Usuário atual">
        <span className={styles.avatar} aria-hidden>AM</span>
        <span className={styles.userBody}>
          <span className={styles.userName}>Ana Martins</span>
          <span className={styles.userRole}>Analista de Growth</span>
        </span>
      </div>
    </nav>
  );
}
