+++
# --- Step Metadata ---
step_id = "WF-REPOMIX-V2-04-GENERATE-README" # (String, Required) Unique ID for this step (e.g., "WF-REPOMIX-V2-01-ANALYZE").
title = "Step 04: Generate Summary README" # (String, Required) Title of this specific step.
description = """
Creates a README.md file in the task directory summarizing the Repomix run, including sources, outputs, and parameters used.
"""

# --- Flow Control ---
depends_on = ["WF-REPOMIX-V2-02-GENERATE-CODE"] # (Array of Strings, Required) step_ids this step needs completed first.
next_step = "03_review_code.md" # (String, Optional) Filename of the next step on successful completion. Can be empty if branching or finishing.
error_step = "EE_handle_error.md" # (String, Optional) Filename to jump to if this step fails.

# --- Execution ---
delegate_to = "spec-repomix" # (String, Optional) Mode responsible for executing the core logic of this step.

# --- Interface ---
inputs = [ # (Array of Strings, Optional) Data/artifacts needed. Can reference outputs from 'depends_on' steps.
    "Output from step WF-REPOMIX-V2-00-START: task_directory, task_name, source_list",
    "Output from step WF-REPOMIX-V2-01-GATHER-CONTEXT: final_source_paths",
    "Output from step WF-REPOMIX-V2-02-GENERATE-CODE: generation_summary, generated_code_artifact_paths, repomix_config_used",
]
outputs = [ # (Array of Strings, Optional) Data/artifacts produced by this step.
    "readme_path: Path to the generated README.md",
]

# --- Housekeeping ---
last_updated = "2025-04-29" # (String, Required) Date of last modification. Use placeholder.
template_schema_doc = ".ruru/templates/toml-md/25_workflow_step_standard.md" # (String, Required) Link to this template definition.
+++

# Step 04: Generate Summary README

## Actions

1.  Receive inputs: `task_directory`, `task_name`, `source_list`, `final_source_paths`, `generation_summary`, `generated_code_artifact_paths`, `repomix_config_used`.

2.  **Check for existing README files in `/readme/` folder:**
    *   Use `list_files` to scan the `/readme/` directory for existing README files
    *   Look for files that might be related to the current task based on:
        *   Similar naming patterns (e.g., matching `task_name` or related keywords)
        *   Content relevance (if file names suggest relation to current work)
    *   If related README files are found, note their paths for potential updates

3.  **Determine README strategy:**
    *   **If related existing README found:** Update the existing file by merging new information with existing content
    *   **If no related README found:** Create a new README file in the `/readme/` folder

4.  **Construct README content:**
    *   For **new README:** Create Markdown content including: Original sources (`source_list`), final paths used (`final_source_paths`), task name, task directory, generated artifacts (`generated_code_artifact_paths`), summary (`generation_summary`), and key parameters from `repomix_config_used` (like chunking strategy)
    *   For **existing README update:** Merge new information with existing content, preserving valuable existing documentation while adding new sections or updating relevant sections

5.  **Define README path:**
    *   **For new README:** Define `readme_path` as `/readme/[task_name]-[timestamp].md` or `/readme/[descriptive_name].md`
    *   **For existing README:** Use the path of the existing file to be updated

6.  **Save README file:**
    *   Use `write_to_file` (for new files) or `apply_diff` (for updates) to save content to `readme_path`
    *   Ensure the `/readme/` directory exists, create if necessary

## Acceptance Criteria

*   Existing README files in `/readme/` folder are checked for relevance
*   Related existing README files are updated with new information when found
*   New README files are created in `/readme/` folder (not in root or `/docs`)
*   The `readme_path` output points to the final README location in `/readme/` folder
*   README content appropriately reflects either new creation or thoughtful update of existing content

## Error Handling

*   If `/readme/` directory doesn't exist, create it before proceeding
*   If `list_files` fails on `/readme/` directory, proceed with new file creation
*   If `write_to_file` or `apply_diff` fails, proceed to `EE_handle_error.md` or report failure
*   If existing file update fails, fall back to creating a new file with timestamped name