"""robotsix-ui release-asset URL resolvers for non-JS consumers.

Every version tag publishes the two files a server-rendered UI needs to
mount the shared config panel — the compiled stylesheet and the
framework-free JS bundle — as GitHub Release assets. These helpers build
their download URLs so Python services can fetch them at build or deploy
time without needing npm.
"""

_RELEASE_BASE = "https://github.com/damien-robotsix/robotsix-ui/releases/download"


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
