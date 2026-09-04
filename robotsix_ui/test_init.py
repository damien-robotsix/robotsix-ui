import pytest

from robotsix_ui import css_url, vanilla_js_url


@pytest.mark.parametrize(
    "version,expected",
    [
        ("v0.1.29", "https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.29/style.css"),
        ("v0.1.0", "https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.0/style.css"),
        ("v1.2.3", "https://github.com/damien-robotsix/robotsix-ui/releases/download/v1.2.3/style.css"),
    ],
)
def test_css_url(version, expected):
    """css_url builds the correct GitHub release asset URL for the stylesheet."""
    assert css_url(version) == expected


@pytest.mark.parametrize(
    "version,expected",
    [
        ("v0.1.34", "https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.34/vanilla.js"),
        ("v0.1.0", "https://github.com/damien-robotsix/robotsix-ui/releases/download/v0.1.0/vanilla.js"),
        ("v2.0.0", "https://github.com/damien-robotsix/robotsix-ui/releases/download/v2.0.0/vanilla.js"),
    ],
)
def test_vanilla_js_url(version, expected):
    """vanilla_js_url builds the correct GitHub release asset URL for the JS bundle."""
    assert vanilla_js_url(version) == expected
