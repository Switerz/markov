"""
Event-to-funnel-stage mapping based on Eventos Documentação.xlsx (Página1).

Funnel stages (ascending priority):
  1 = Low Intent      — session with no relevant product/cart/checkout event
  2 = Product Interest — session with view_item or similar
  3 = Cart Intent      — session with add_to_cart, view_cart, begin_checkout, etc.
  4 = Purchase         — session that contains a purchase event

Only events marked as relevant for tracking (ok) in the documentation are included.
Events marked "não" for "Evento ok?" are deliberately excluded to avoid noise.
"""

from typing import Dict

# ---------------------------------------------------------------------------
# Mapping: event_name → funnel_stage
# ---------------------------------------------------------------------------
EVENT_STAGE_MAPPING: Dict[str, str] = {
    # --- Product Interest ---
    "view_item": "Product Interest",          # Funil=sim, ok
    "view_item_list": "Product Interest",     # Funil=não, ok (listing pages)

    # --- Cart Intent ---
    "add_to_cart": "Cart Intent",             # Funil=sim, ok
    "add_to_cart_from_recommendation": "Cart Intent",  # Funil=não, ok
    "view_cart": "Cart Intent",               # Funil=sim, ok
    "start_cart": "Cart Intent",              # Funil=não, ok (legacy cart page)
    "calculate_shipping": "Cart Intent",      # Funil=não, ok
    "apply_coupon": "Cart Intent",            # Funil=não, ok
    "begin_checkout": "Cart Intent",          # Funil=sim, ok — início de checkout
    "checkout_view_registration": "Cart Intent",   # Funil=não, ok
    "checkout_view_address": "Cart Intent",   # Funil=sim, ok
    "submit_checkout_adress": "Cart Intent",  # Funil=sim, ok (typo original preservado)
    "checkout_view_delivery": "Cart Intent",  # Funil=sim, ok
    "checkout_view_payment": "Cart Intent",   # Funil=não, ok

    # --- Purchase ---
    "purchase": "Purchase",                   # Funil=sim, ok
}

# ---------------------------------------------------------------------------
# Stage priority (higher = more advanced in funnel)
# ---------------------------------------------------------------------------
FUNNEL_STAGE_PRIORITY: Dict[str, int] = {
    "Low Intent": 1,
    "Product Interest": 2,
    "Cart Intent": 3,
    "Purchase": 4,
}

FUNNEL_STAGES = ["Low Intent", "Product Interest", "Cart Intent", "Purchase"]


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


def parse_funnel_state(state: str) -> tuple[str, str]:
    """
    Parse a composite state back into (channel, funnel_stage).
    Returns (state, '') for non-composite states.
    """
    if " / " in state:
        parts = state.split(" / ", 1)
        return parts[0], parts[1]
    return state, ""


# ClickHouse SQL fragment: maps event name to funnel priority integer.
# Used inside the funnel-enriched SQL query.
def _funnel_stage_sql_case(event_name_col: str = "name") -> str:
    """
    Returns a ClickHouse CASE expression that maps event names to priority ints.
    Priority 4 = Purchase, 3 = Cart Intent, 2 = Product Interest, 1 = Low Intent.
    """
    purchase_events = [k for k, v in EVENT_STAGE_MAPPING.items() if v == "Purchase"]
    cart_events = [k for k, v in EVENT_STAGE_MAPPING.items() if v == "Cart Intent"]
    product_events = [k for k, v in EVENT_STAGE_MAPPING.items() if v == "Product Interest"]

    def _in_list(col: str, items: list[str]) -> str:
        quoted = ", ".join(f"'{e}'" for e in items)
        return f"{col} IN ({quoted})"

    return (
        f"CASE\n"
        f"    WHEN {_in_list(event_name_col, purchase_events)} THEN 4\n"
        f"    WHEN {_in_list(event_name_col, cart_events)} THEN 3\n"
        f"    WHEN {_in_list(event_name_col, product_events)} THEN 2\n"
        f"    ELSE 1\n"
        f"END"
    )


def _priority_to_stage_sql(priority_col: str = "max_stage_priority") -> str:
    """
    ClickHouse CASE expression: converts integer priority back to stage string.
    """
    return (
        f"CASE {priority_col}\n"
        f"    WHEN 4 THEN 'Purchase'\n"
        f"    WHEN 3 THEN 'Cart Intent'\n"
        f"    WHEN 2 THEN 'Product Interest'\n"
        f"    ELSE 'Low Intent'\n"
        f"END"
    )
