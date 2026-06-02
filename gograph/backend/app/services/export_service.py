"""Export helpers for reusable GoGraph model results."""

from pathlib import Path

import pandas as pd

from gograph.backend.app.schemas import ModelRunResult


def export_model_run_to_excel(
    result: ModelRunResult,
    output_path: str | Path,
) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        pd.DataFrame([result.summary()]).to_excel(
            writer,
            sheet_name="Overview",
            index=False,
        )
        result.roas_results.to_excel(
            writer,
            sheet_name="Attribution & ROAS",
            index=False,
        )
        result.diagnostics.to_excel(
            writer,
            sheet_name="Channel Diagnostics",
            index=False,
        )
        result.top_paths.to_excel(
            writer,
            sheet_name="Top Paths",
            index=False,
        )
        result.data_quality.to_excel(
            writer,
            sheet_name="Data Quality",
            index=False,
        )
        result.transition_counts["converting"].to_excel(
            writer,
            sheet_name="Converting Transitions",
            index=False,
        )
        result.transition_counts["nonconverting"].to_excel(
            writer,
            sheet_name="Non-Conv Transitions",
            index=False,
        )
        result.transition_matrix.to_excel(
            writer,
            sheet_name="Transition Matrix",
        )

    return path
