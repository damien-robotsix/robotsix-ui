import hashlib
import urllib.error

import pytest

from robotsix_ui import fetch_assets
from robotsix_ui.__main__ import main


class _FakeResponse:
    """Minimal context-manager stand-in for a urlopen response."""

    def __init__(self, data):
        self._data = data

    def read(self):
        return self._data

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _urlopen_returning(mapping_default):
    """Build a fake urlopen serving css/js bytes plus a matching SHA256SUMS."""

    def fake_urlopen(url):
        if url.endswith("SHA256SUMS"):
            css = mapping_default["css"]
            js = mapping_default["js"]
            manifest = (
                f"{hashlib.sha256(css).hexdigest()}  style.css\n"
                f"{hashlib.sha256(js).hexdigest()}  vanilla.js\n"
            ).encode()
            return _FakeResponse(manifest)
        if url.endswith("style.css"):
            return _FakeResponse(mapping_default["css"])
        return _FakeResponse(mapping_default["js"])

    return fake_urlopen


def test_fetch_assets_writes_both_files(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        _urlopen_returning({"css": b"body{color:red}", "js": b"export const x = 1;"}),
    )
    written = fetch_assets(tmp_path, "v0.1.48")

    assert (tmp_path / "style.css").read_bytes() == b"body{color:red}"
    assert (tmp_path / "vanilla.js").read_bytes() == b"export const x = 1;"
    assert set(written) == {"style.css", "vanilla.js"}
    assert written["style.css"] == tmp_path / "style.css"


def test_fetch_assets_creates_nested_dest(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        _urlopen_returning({"css": b"a", "js": b"b"}),
    )
    dest = tmp_path / "static" / "robotsix-ui"
    fetch_assets(dest, "v1.2.3")

    assert (dest / "style.css").exists()
    assert (dest / "vanilla.js").exists()


@pytest.mark.parametrize("bad", ["0.1.48", "v1.2", "v1.2.3.4", "latest", "", "v1.2.3-rc1"])
def test_fetch_assets_rejects_bad_version(tmp_path, bad):
    with pytest.raises(ValueError):
        fetch_assets(tmp_path, bad)


def test_fetch_assets_rejects_empty_body(tmp_path, monkeypatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda url: _FakeResponse(b""))
    with pytest.raises(RuntimeError):
        fetch_assets(tmp_path, "v0.1.48")


def test_download_retries_on_5xx_then_succeeds(tmp_path, monkeypatch):
    css = b"ok"
    js = b"js"
    manifest = (
        f"{hashlib.sha256(css).hexdigest()}  style.css\n{hashlib.sha256(js).hexdigest()}  vanilla.js\n"
    ).encode()
    calls = {"n": 0}

    def fake_urlopen(url):
        calls["n"] += 1
        if url.endswith("SHA256SUMS"):
            return _FakeResponse(manifest)
        if url.endswith("style.css") and calls["n"] < 4:
            raise urllib.error.HTTPError(url, 503, "Service Unavailable", None, None)
        if url.endswith("style.css"):
            return _FakeResponse(css)
        return _FakeResponse(js)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)

    fetch_assets(tmp_path, "v0.1.48")
    # SHA256SUMS (1) + style.css (2 failures + 1 success) + vanilla.js (1).
    assert calls["n"] == 5
    assert (tmp_path / "style.css").read_bytes() == css


def test_download_gives_up_after_max_attempts(tmp_path, monkeypatch):
    calls = {"n": 0}

    def fake_urlopen(url):
        calls["n"] += 1
        raise urllib.error.HTTPError(url, 500, "Internal Server Error", None, None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    monkeypatch.setattr("time.sleep", lambda _seconds: None)

    with pytest.raises(urllib.error.HTTPError):
        fetch_assets(tmp_path, "v0.1.48")
    assert calls["n"] == 5


def test_download_does_not_retry_on_4xx(tmp_path, monkeypatch):
    calls = {"n": 0}

    def fake_urlopen(url):
        calls["n"] += 1
        raise urllib.error.HTTPError(url, 404, "Not Found", None, None)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(urllib.error.HTTPError):
        fetch_assets(tmp_path, "v0.1.48")
    assert calls["n"] == 1


def test_fetch_assets_rejects_checksum_mismatch(tmp_path, monkeypatch):
    css = b"css"
    js = b"js"
    manifest = (f"{'0' * 64}  style.css\n{hashlib.sha256(js).hexdigest()}  vanilla.js\n").encode()

    def fake_urlopen(url):
        if url.endswith("SHA256SUMS"):
            return _FakeResponse(manifest)
        if url.endswith("style.css"):
            return _FakeResponse(css)
        return _FakeResponse(js)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(RuntimeError, match="SHA-256 mismatch for 'style.css'"):
        fetch_assets(tmp_path, "v0.1.48")
    # Nothing is written when verification fails.
    assert not (tmp_path / "style.css").exists()
    assert not (tmp_path / "vanilla.js").exists()


def test_fetch_assets_rejects_missing_checksum_entry(tmp_path, monkeypatch):
    css = b"css"
    js = b"js"
    manifest = f"{hashlib.sha256(js).hexdigest()}  vanilla.js\n".encode()

    def fake_urlopen(url):
        if url.endswith("SHA256SUMS"):
            return _FakeResponse(manifest)
        if url.endswith("style.css"):
            return _FakeResponse(css)
        return _FakeResponse(js)

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)

    with pytest.raises(RuntimeError, match="No SHA-256 checksum published for 'style.css'"):
        fetch_assets(tmp_path, "v0.1.48")


@pytest.mark.parametrize(
    "manifest",
    [
        b"not-a-hash  style.css\n",
        b"abc  style.css\n",
    ],
)
def test_fetch_assets_rejects_malformed_manifest(tmp_path, monkeypatch, manifest):
    monkeypatch.setattr("urllib.request.urlopen", lambda url: _FakeResponse(manifest))

    with pytest.raises(ValueError, match="SHA256SUMS"):
        fetch_assets(tmp_path, "v0.1.48")


def test_cli_fetch_writes_assets(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        _urlopen_returning({"css": b"css", "js": b"js"}),
    )
    rc = main(["fetch", "--version", "v0.1.48", "--dest", str(tmp_path)])

    assert rc == 0
    assert (tmp_path / "style.css").read_bytes() == b"css"
    assert (tmp_path / "vanilla.js").read_bytes() == b"js"
    out = capsys.readouterr().out
    assert "style.css" in out
    assert "vanilla.js" in out


def test_cli_fetch_rejects_bad_version(tmp_path, monkeypatch):
    monkeypatch.setattr("urllib.request.urlopen", lambda url: _FakeResponse(b"x"))
    with pytest.raises(ValueError):
        main(["fetch", "--version", "nope", "--dest", str(tmp_path)])
