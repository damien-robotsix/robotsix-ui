"""robotsix-ui release-asset URL resolvers and fetcher for non-JS consumers.

Every version tag publishes the two files a server-rendered UI needs to
mount the shared config panel — the compiled stylesheet and the
framework-free JS bundle — as GitHub Release assets, along with a
``SHA256SUMS`` manifest of their digests. These helpers build their
download URLs, and :func:`fetch_assets` downloads both to disk with
retry/backoff, version-tag validation, an empty-file guard and SHA-256
verification against the published manifest, so Python services can
fetch them at build or deploy time without needing npm and without
re-implementing a hardened downloader in every consumer.
"""

from __future__ import annotations

import hashlib
import time
import urllib.error
import urllib.request
from pathlib import Path
from re import compile as _re_compile

__all__ = ["css_url", "fetch_assets", "vanilla_js_url"]

_RELEASE_BASE = "https://github.com/damien-robotsix/robotsix-ui/releases/download"

#: Accepted version-tag shape, e.g. ``v0.1.48``.
_VERSION_RE = _re_compile(r"^v\d+\.\d+\.\d+$")

#: Number of download attempts before giving up on a server (5xx) error.
_MAX_ATTEMPTS = 5

#: Base delay (seconds) for exponential backoff between retries.
_BACKOFF_BASE_SECONDS = 1.0


def css_url(version: str) -> str:
    """Return the raw GitHub release URL for the robotsix-ui stylesheet.

    Args:
        version: A version tag string, e.g. ``"v0.1.29"``.

    Returns:
        The raw download URL, e.g.
        ``"https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.29/style.css"``.
    """
    return f"{_RELEASE_BASE}/{version}/style.css"


def vanilla_js_url(version: str) -> str:
    """Return the raw GitHub release URL for the framework-free JS bundle.

    This is the ``@robotsix/ui/vanilla`` build — an ES module exporting
    ``mountConfigPanel``, loadable straight from a ``<script type="module">``
    with no bundler and no React.

    Args:
        version: A version tag string, e.g. ``"v0.1.34"``.

    Returns:
        The raw download URL, e.g.
        ``"https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.34/vanilla.js"``.
    """
    return f"{_RELEASE_BASE}/{version}/vanilla.js"


#: Release-asset filename -> URL builder. The written filenames match the
#: published GitHub Release asset names.
_ASSET_BUILDERS = {
    "style.css": css_url,
    "vanilla.js": vanilla_js_url,
}

#: Release-asset filename of the SHA-256 checksum manifest published with
#: each release. Formatted like ``sha256sum`` output.
_CHECKSUMS_FILENAME = "SHA256SUMS"


def _checksums_url(version: str) -> str:
    """Return the raw GitHub release URL for the ``SHA256SUMS`` manifest."""
    return f"{_RELEASE_BASE}/{version}/{_CHECKSUMS_FILENAME}"


def _sha256_hex(data: bytes) -> str:
    """Return the lower-case hex SHA-256 digest of ``data``."""
    return hashlib.sha256(data).hexdigest()


def _parse_checksums(manifest: bytes) -> dict[str, str]:
    """Parse a ``SHA256SUMS`` manifest into ``{filename: hex digest}``.

    Each line follows the standard ``sha256sum`` output format::

        <64-hex-digest>  <filename>

    Blank lines and ``#`` comment lines are ignored. A malformed line, a
    digest that is not 64 hex characters, or a duplicated filename raises
    :class:`ValueError`.

    Args:
        manifest: Raw bytes of the checksum manifest.

    Returns:
        A mapping of asset filename to its expected lower-case SHA-256 digest.

    Raises:
        ValueError: If the manifest contains a malformed or duplicate entry.
    """
    checksums: dict[str, str] = {}
    for lineno, raw in enumerate(manifest.decode("utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2 or len(parts[0]) != 64:
            raise ValueError(f"Malformed SHA256SUMS entry on line {lineno}: {raw!r}")
        digest, filename = parts
        if filename in checksums:
            raise ValueError(f"Duplicate SHA256SUMS entry for {filename!r}")
        checksums[filename] = digest.lower()
    return checksums


def _download(url: str) -> bytes:
    """Download ``url`` with retry/backoff on 5xx and an empty-file guard.

    Server errors (HTTP status >= 500) are retried up to ``_MAX_ATTEMPTS``
    times with exponential backoff. Client errors (4xx) fail immediately.
    A successful response with an empty body is rejected — a zero-byte
    asset is never valid.

    Args:
        url: The asset URL to fetch.

    Returns:
        The response body bytes.

    Raises:
        urllib.error.HTTPError: If the server keeps returning 5xx after all
            attempts, or on any non-retryable (4xx) status.
        urllib.error.URLError: On a transport-level failure.
        RuntimeError: If the downloaded body is empty.
    """
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url) as response:
                data: bytes = response.read()
        except urllib.error.HTTPError as exc:
            if exc.code >= 500 and attempt < _MAX_ATTEMPTS:
                time.sleep(_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)))
                continue
            raise
        if not data:
            raise RuntimeError(f"Downloaded empty file from {url}")
        return data
    raise RuntimeError(f"Exhausted {_MAX_ATTEMPTS} attempts fetching {url}")


def fetch_assets(dest_dir: str | Path, version: str) -> dict[str, Path]:
    """Download the robotsix-ui release assets for ``version`` into ``dest_dir``.

    Fetches both ``style.css`` and ``vanilla.js`` from the GitHub Release for
    the given tag and writes them into ``dest_dir`` under their published
    names. Each download is hardened: the version tag is validated, transient
    server (5xx) errors are retried with exponential backoff, empty responses
    are rejected, and every asset's SHA-256 digest is verified against the
    ``SHA256SUMS`` manifest published with the same release. Verification
    fails closed — a missing, malformed or mismatching manifest aborts the
    fetch rather than writing an unverified asset.

    Args:
        dest_dir: Directory to write the assets into. Created (with parents)
            if it does not exist.
        version: A version tag string, e.g. ``"v0.1.48"``.

    Returns:
        A mapping of asset filename to the :class:`~pathlib.Path` written.

    Raises:
        ValueError: If ``version`` is not a ``vMAJOR.MINOR.PATCH`` tag, or the
            downloaded ``SHA256SUMS`` manifest is malformed.
        urllib.error.URLError: On a download failure that outlasts retries.
        RuntimeError: If a downloaded asset is empty, its SHA-256 digest does
            not match the published manifest, or no checksum is published for
            it.
    """
    if not _VERSION_RE.match(version):
        raise ValueError(
            f"Invalid version tag {version!r}; expected a 'vMAJOR.MINOR.PATCH' string, e.g. 'v0.1.48'."
        )
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    expected = _parse_checksums(_download(_checksums_url(version)))
    written: dict[str, Path] = {}
    for filename, url_builder in _ASSET_BUILDERS.items():
        if filename not in expected:
            raise RuntimeError(f"No SHA-256 checksum published for {filename!r} in release {version}")
        data = _download(url_builder(version))
        digest = _sha256_hex(data)
        if digest != expected[filename]:
            raise RuntimeError(
                f"SHA-256 mismatch for {filename!r}: expected {expected[filename]}, got {digest}"
            )
        target = dest / filename
        target.write_bytes(data)
        written[filename] = target
    return written
