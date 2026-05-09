"""Tool registry — OpenAI-compatible function-calling schemas + dispatch.

Read-only agents (chat, swarm) get the read tools.
Engineer agent additionally gets write/git/verify tools.
"""

from __future__ import annotations

import json
from typing import Any, Callable

from kimi.tools import fs, git, meta, search, shell, verify

# ─── Schemas ──────────────────────────────────────────────────────────

READ_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file or a specific 1-indexed line range. Always prefer a tight range over the whole file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Project-relative path."},
                    "start_line": {"type": "integer", "default": 1},
                    "end_line": {"type": "integer", "description": "Inclusive end line. Omit to read to EOF."},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List entries in a project-relative directory.",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "default": "."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "glob",
            "description": "Glob files recursively from project root. Use Unix-style patterns like 'src/**/*.tsx'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "max_results": {"type": "integer", "default": 200},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ripgrep",
            "description": "Search code with ripgrep. Returns file:line:context — much cheaper than reading whole files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "path": {"type": "string", "default": "."},
                    "file_type": {"type": "string", "description": "ripgrep file-type alias (e.g. 'ts', 'tsx', 'py')."},
                    "max_results": {"type": "integer", "default": 80},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "shell",
            "description": "Run a bash command from the project root. Output is capped to 8KB.",
            "parameters": {
                "type": "object",
                "properties": {
                    "cmd": {"type": "string"},
                    "timeout": {"type": "integer", "default": 180},
                },
                "required": ["cmd"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_status",
            "description": "Show git status (branch + short status).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_diff",
            "description": "Show working-tree diff (or staged with staged=true).",
            "parameters": {
                "type": "object",
                "properties": {
                    "staged": {"type": "boolean", "default": False},
                    "path": {"type": "string"},
                },
            },
        },
    },
]

META_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "propose_plan",
            "description": (
                "REQUIRED before any non-trivial work (edits, multi-step audits, swarms, commits). "
                "Show the user a structured plan and wait for their y/n/edit decision. Returns 'approved', "
                "'rejected[: reason]', or 'revise: <feedback>'. For trivial single-question reads, skip this."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string", "description": "1-3 sentences on the why."},
                    "steps": {"type": "array", "items": {"type": "string"}, "description": "Numbered steps you'll take."},
                    "files_to_touch": {"type": "array", "items": {"type": "string"}},
                    "needs_swarm": {"type": "boolean", "default": False},
                    "swarm_agents": {"type": "array", "items": {"type": "string"}, "description": "Named agents from the catalog."},
                    "will_verify": {"type": "boolean", "default": False, "description": "Will run lint+tsc+test+build."},
                    "will_commit": {"type": "boolean", "default": False},
                    "risks": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "summary", "steps"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_swarm",
            "description": (
                "Spawn a swarm of named agents on a shared prompt. Returns the synthesizer's "
                "ranked action list. Use for any audit that benefits from multiple perspectives "
                "(coherence + copy + sync + a11y …). NEVER call without `propose_plan` approval first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "agents": {"type": "array", "items": {"type": "string"}},
                    "prompt": {"type": "string"},
                    "collaborative": {"type": "boolean", "default": False, "description": "Sequential mode where each agent sees prior outputs."},
                },
                "required": ["agents", "prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "vision_attach",
            "description": "Grab a screenshot or the clipboard image and convert it to dense factual text via the VL model.",
            "parameters": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "enum": ["clipboard", "screenshot"], "default": "clipboard"},
                },
            },
        },
    },
]


WRITE_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a file. Refuses inside node_modules, .next, .git, .kimi, supabase/migrations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                    "allow_migration": {"type": "boolean", "default": False},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Exact string replace in a file. Refuses if old_string is not unique unless replace_all=true.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "old_string": {"type": "string"},
                    "new_string": {"type": "string"},
                    "replace_all": {"type": "boolean", "default": False},
                },
                "required": ["path", "old_string", "new_string"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_add",
            "description": "Stage a path (or '.' for everything).",
            "parameters": {
                "type": "object",
                "properties": {"path": {"type": "string", "default": "."}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_commit",
            "description": "Commit staged changes with a message. Auto-runs secret-scan; refuses if hits.",
            "parameters": {
                "type": "object",
                "properties": {"message": {"type": "string"}},
                "required": ["message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "verify",
            "description": "Run lint+tsc+vitest+next build with dummy Supabase env. Returns the failing step's output if any.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


# ─── Dispatch ─────────────────────────────────────────────────────────

def _dispatch(name: str, args: dict[str, Any]) -> str:
    if name == "read_file":
        return fs.read_file(args["path"], args.get("start_line", 1), args.get("end_line"))
    if name == "list_dir":
        return fs.list_dir(args.get("path", "."))
    if name == "glob":
        return fs.glob(args["pattern"], args.get("max_results", 200))
    if name == "ripgrep":
        return search.ripgrep(args["query"], args.get("path", "."), args.get("max_results", 80), args.get("file_type"))
    if name == "shell":
        return shell.run(args["cmd"], args.get("timeout", 180))
    if name == "git_status":
        return git.status()
    if name == "git_diff":
        return git.diff(args.get("staged", False), args.get("path"))
    if name == "write_file":
        return fs.write_file(args["path"], args["content"], args.get("allow_migration", False))
    if name == "edit_file":
        return fs.edit_file(args["path"], args["old_string"], args["new_string"], args.get("replace_all", False))
    if name == "git_add":
        return git.add(args.get("path", "."))
    if name == "git_commit":
        return git.commit(args["message"])
    if name == "verify":
        results = verify.run_all()
        lines = []
        for step, (code, out) in results.items():
            mark = "✓" if code == 0 else "✗"
            lines.append(f"{mark} {step} (exit {code})")
            if code != 0:
                lines.append(out)
        return "\n".join(lines) + ("\nALL_GREEN" if verify.all_passed(results) else "\nFAILED")
    if name == "propose_plan":
        return meta.propose_plan(args)
    if name == "run_swarm":
        return meta.run_swarm(args["agents"], args["prompt"], collaborative=args.get("collaborative", False))
    if name == "vision_attach":
        return meta.vision_attach(args.get("source", "clipboard"))
    return f"<unknown tool: {name}>"


def call(name: str, raw_args: str) -> str:
    """Parse JSON args and dispatch. Returns string output for the model."""
    try:
        args = json.loads(raw_args) if raw_args else {}
    except json.JSONDecodeError as e:
        return f"<bad JSON args: {e}>"
    try:
        return _dispatch(name, args)
    except Exception as e:  # noqa: BLE001
        return f"<tool error: {type(e).__name__}: {e}>"


def schemas(*, write: bool = False) -> list[dict[str, Any]]:
    return READ_TOOLS + META_TOOLS + (WRITE_TOOLS if write else [])
