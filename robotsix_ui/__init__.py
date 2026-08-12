"""robotsix-ui CSS URL resolver for non-JS consumers.

Provides a single ``css_url()`` function that returns the raw GitHub
release download URL for a given version tag, so Python services can
fetch the compiled stylesheet at build or deploy time without needing
npm.
"""


def css_url(version: str) -> str:
    """Return the raw GitHub release URL for the robotsix-ui stylesheet.

    Args:
        version: A version tag string, e.g. ``"v0.1.29"``.

    Returns:
        The raw download URL, e.g.
        ``"https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.29/style.css"``.
    """
    return (
        f"https://github.com/damien-robotsix/robotsix-ui/"
        f"releases/download/{version}/style.css"
    )