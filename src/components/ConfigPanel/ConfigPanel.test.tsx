import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ConfigPanel } from "./ConfigPanel.js";
import type { ConfigClient } from "../../config/client.js";

const schema = {
  type: "object",
  properties: { log_level: { type: "string", enum: ["info", "debug"], default: "info" } },
};

function fakeClient(): ConfigClient {
  return {
    getConfig: vi.fn().mockResolvedValue({ config: { log_level: "debug" }, schema, version: 4 }),
    putConfig: vi.fn(),
    getVersions: vi.fn().mockResolvedValue({ versions: [] }),
    rollback: vi.fn(),
  } as unknown as ConfigClient;
}

describe("ConfigPanel (React wrapper)", () => {
  it("mounts the shared panel and renders the same fields", async () => {
    const client = fakeClient();
    const { container, findByRole } = render(<ConfigPanel client={client} title="Panel" />);

    // By role, not by text: the tab strip also carries a "Settings" label.
    await findByRole("heading", { name: "Panel" });
    // The wrapper delegates entirely to the framework-free core.
    expect(container.querySelector(".rsu-config-panel")).not.toBeNull();
    expect(client.getConfig).toHaveBeenCalled();
  });

  it("passes the className through to the host element", () => {
    const { container } = render(<ConfigPanel client={fakeClient()} className="mine" />);
    expect(container.firstElementChild?.className).toBe("mine");
  });

  it("tears the panel down on unmount", () => {
    const { container, unmount } = render(<ConfigPanel client={fakeClient()} />);
    expect(container.querySelector(".rsu-config-panel")).not.toBeNull();

    unmount();
    expect(container.querySelector(".rsu-config-panel")).toBeNull();
  });
});
