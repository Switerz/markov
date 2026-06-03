"""
Event-to-funnel-stage mapping based on Eventos Documentação.xlsx (Página1).

Funnel stages (ascending priority):
  1 = Low Intent       — session with no relevant product/cart/checkout event
  2 = Product Interest — session with view_item
  3 = Cart Intent      — session with add_to_cart, view_cart, or start_cart
  4 = Checkout         — session that reached begin_checkout or later checkout steps
  5 = Purchase         — session that contains a purchase event

Only events present and confirmed in events_v2 are included.
Removed: apply_coupon (supporting action, not funnel signal), view_item_list (listing browse).
"""

import re
from typing import Dict

# ---------------------------------------------------------------------------
# Mapping: event_name → funnel_stage
# ---------------------------------------------------------------------------
EVENT_STAGE_MAPPING: Dict[str, str] = {
    # --- Product Interest ---
    "view_item": "Product Interest",          # 83M events — item page view
    "search": "Product Interest",             # 5.7M events — site search (active intent)

    # --- Cart Intent ---
    "add_to_cart": "Cart Intent",             # 6.3M — added item to cart
    "view_cart": "Cart Intent",               # 12M  — viewed cart page
    "start_cart": "Cart Intent",              # 1.3M — loaded legacy cart page

    # --- Checkout ---
    "begin_checkout": "Checkout",             # 5.7M — clicked "finalize purchase"
    "checkout_view_address": "Checkout",      # 6.1M — address step
    "submit_checkout_adress": "Checkout",     # typo original; absent in table but kept for future
    "checkout_view_delivery": "Checkout",     # 3.4M — delivery step
    "checkout_view_payment": "Checkout",      # 1.7M — payment step

    # --- Purchase ---
    "purchase": "Purchase",                   # 726K — confirmed purchase
}

# ---------------------------------------------------------------------------
# Stage priority (higher = more advanced in funnel)
# ---------------------------------------------------------------------------
FUNNEL_STAGE_PRIORITY: Dict[str, int] = {
    "Low Intent": 1,
    "Product Interest": 2,
    "Cart Intent": 3,
    "Checkout": 4,
    "Purchase": 5,
}

FUNNEL_STAGES = ["Low Intent", "Product Interest", "Cart Intent", "Checkout", "Purchase"]


def assign_funnel_stage(event_names: list[str]) -> str:
    """
    Given a list of event names for a touch/session, return the highest
    funnel stage reached. Defaults to 'Low Intent' if no relevant events.
    """
    max_priority = 1
    for name in event_names:
        stage = EVENT_STAGE_MAPPING.get(name)
        if stage is not None:
            priority = FUNNEL_STAGE_PRIORITY[stage]
            if priority > max_priority:
                max_priority = priority
    for stage, p in FUNNEL_STAGE_PRIORITY.items():
        if p == max_priority:
            return stage
    return "Low Intent"


def build_funnel_state(channel: str, funnel_stage: str) -> str:
    """Combine channel and funnel stage into a composite Markov state."""
    return f"{channel} / {funnel_stage}"


# Regex anchored on known stage names — handles channels that contain " / "
# e.g. "Organic Social / Instagram / Product Interest" → ("Organic Social / Instagram", "Product Interest")
_STAGE_SUFFIX_RE = re.compile(
    r" / (" + "|".join(re.escape(s) for s in ["Low Intent", "Product Interest", "Cart Intent", "Checkout", "Purchase"]) + r")$"
)


def parse_funnel_state(state: str) -> tuple[str, str]:
    """
    Parse a composite state back into (channel, funnel_stage).
    Uses stage-anchored regex so channel names containing ' / ' are handled correctly.
    Returns (state, '') for non-composite states.
    """
    m = _STAGE_SUFFIX_RE.search(state)
    if m:
        return state[: m.start()], m.group(1)
    return state, ""


# ClickHouse SQL fragment: maps event name to funnel priority integer.
def _funnel_stage_sql_case(event_name_col: str = "name") -> str:
    """
    Returns a ClickHouse CASE expression that maps event names to priority ints.
    Priority 5=Purchase, 4=Checkout, 3=Cart Intent, 2=Product Interest, 1=Low Intent.
    """
    by_stage: Dict[str, list[str]] = {}
    for event, stage in EVENT_STAGE_MAPPING.items():
        by_stage.setdefault(stage, []).append(event)

    def _in_list(col: str, items: list[str]) -> str:
        quoted = ", ".join(f"'{e}'" for e in items)
        return f"{col} IN ({quoted})"

    # Build WHEN clauses in descending priority order
    lines = ["CASE"]
    for stage in sorted(FUNNEL_STAGE_PRIORITY, key=lambda s: -FUNNEL_STAGE_PRIORITY[s]):
        if stage == "Low Intent":
            continue  # handled by ELSE
        priority = FUNNEL_STAGE_PRIORITY[stage]
        events = by_stage.get(stage, [])
        if events:
            lines.append(f"    WHEN {_in_list(event_name_col, events)} THEN {priority}")
    lines.append("    ELSE 1")
    lines.append("END")
    return "\n".join(lines)


def _priority_to_stage_sql(priority_col: str = "max_stage_priority") -> str:
    """
    ClickHouse CASE expression: converts integer priority back to stage string.
    """
    lines = [f"CASE {priority_col}"]
    for stage, priority in sorted(FUNNEL_STAGE_PRIORITY.items(), key=lambda kv: -kv[1]):
        if stage == "Low Intent":
            continue
        lines.append(f"    WHEN {priority} THEN '{stage}'")
    lines.append("    ELSE 'Low Intent'")
    lines.append("END")
    return "\n".join(lines)
