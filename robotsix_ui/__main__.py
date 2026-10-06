"""Command-line entry point for the robotsix-ui asset fetcher.

Usage::

    python -m robotsix_ui fetch --version v0.1.48 --dest static/

Downloads the ``style.css`` and ``vanilla.js`` release assets for a version
tag into a destination directory, using the same hardened downloader
(retry/backoff, version validation, empty-file guard) as
:func:`robotsix_ui.fetch_assets`.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from robotsix_ui import fetch_assets


def main(argv: Sequence[str] | None = None) -> int:
    """Run the ``robotsix_ui`` CLI.

    Args:
        argv: Argument list (defaults to ``sys.argv[1:]``).

    Returns:
        A process exit code (0 on success).
    """
    parser = argparse.ArgumentParser(
        prog="python -m robotsix_ui",
        description="Fetch robotsix-ui release assets without an npm toolchain.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_parser = subparsers.add_parser(
        "fetch",
        help="Download style.css and vanilla.js for a version tag into a directory.",
    )
    fetch_parser.add_argument(
        "--version",
        required=True,
        help="Version tag to fetch, e.g. v0.1.48.",
    )
    fetch_parser.add_argument(
        "--dest",
        required=True,
        help="Destination directory (created if it does not exist).",
    )

    args = parser.parse_args(argv)

    if args.command == "fetch":
        written = fetch_assets(args.dest, args.version)
        for path in written.values():
            print(f"wrote {path}")
        return 0

    parser.error(f"unknown command: {args.command}")
    return 2  # pragma: no cover - argparse.error exits before this returns


if __name__ == "__main__":
    sys.exit(main())
