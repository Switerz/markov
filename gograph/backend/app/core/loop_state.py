"""
Loop-aware state expansion for the Markov attribution model.

Each position in a journey gets labeled with one of two loop segments:
  - 'Single': the channel appears once (or its consecutive run has length 1)
  - 'Loop':   the channel is part of a consecutive run of length >= 2

The composite state is "channel / segment":
  "Paid Meta Ads / Single"
  "Paid Meta Ads / Loop"
  "Google Ads / Single"
  "Google Ads / Loop"

Rationale: the (c) diagnostic showed loop_conversion_lift of 2-4x for most
active channels — repetition is a strong intent signal that the raw-channel
Markov averages away. Splitting each channel into Single/Loop states lets the
removal effect capture loop value separately, then we aggregate back at the
channel level for budget decisions.

Design parallels core/event_mapping.py (channel × funnel_stage) — same shape,
different dimension.
"""

from __future__ import annotations

import re
from typing import List, Tuple


LOOP_SEGMENTS = ["Single", "Loop"]


def annotate_loop_states(channels: List[str]) -> List[str]:
    """Label each position in a channel sequence with its loop segment.

    A position is 'Loop' iff its consecutive run length (looking both backward
    and forward at the same channel) is >= 2.

    Example:
      ['Meta', 'Meta', 'Meta', 'Google', 'Meta', 'Google', 'Google']
      → ['Meta / Loop', 'Meta / Loop', 'Meta / Loop',
         'Google / Single', 'Meta / Single', 'Google / Loop', 'Google / Loop']
    """
    n = len(channels)
    if n == 0:
        return []

    labels: List[str] = [""] * n
    i = 0
    while i < n:
        j = i + 1
        while j < n and channels[j] == channels[i]:
            j += 1
        run_len = j - i
        seg = "Loop" if run_len >= 2 else "Single"
        for k in range(i, j):
            labels[k] = build_loop_state(channels[k], seg)
        i = j
    return labels


def compress_loop_runs(loop_labels: List[str]) -> List[str]:
    """After annotation, consecutive identical labels (a Loop run) collapse to one node.

    This is the path transformation actually fed to the Markov chain — a Loop
    run becomes a single 'c / Loop' node, so the chain sees the loop as one
    state visit rather than n self-loops on c / Loop.
    """
    compressed: List[str] = []
    for label in loop_labels:
        if not compressed or compressed[-1] != label:
            compressed.append(label)
    return compressed


def build_loop_state(channel: str, segment: str) -> str:
    """Combine channel and loop segment into a composite Markov state."""
    return f"{channel} / {segment}"


_SEGMENT_SUFFIX_RE = re.compile(
    r" / (" + "|".join(re.escape(s) for s in LOOP_SEGMENTS) + r")$"
)


def parse_loop_state(state: str) -> Tuple[str, str]:
    """Parse a composite state back into (channel, segment).

    Channel names may legitimately contain ' / ' (e.g. 'Organic Social / Instagram'),
    so the regex anchors on the segment suffix to avoid splitting at the wrong slash.
    Returns (state, '') for non-composite states like '(start)' or 'Conversion'.
    """
    m = _SEGMENT_SUFFIX_RE.search(state)
    if m:
        return state[: m.start()], m.group(1)
    return state, ""
