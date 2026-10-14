import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AppShell } from "./AppShell.js";

describe("AppShell (React wrapper)", () => {
  it("mounts the shared shell and renders brand and nav items", () => {
    const { container } = render(
      <AppShell
        brand="File Hub"
        navItems={[{ label: "Files", href: "/files", active: true }]}
        settingsHref="/settings"
      />,
    );

    expect(container.querySelector(".rsu-appshell")).not.toBeNull();
    expect(container.querySelector(".rsu-appshell-brand")?.textContent).toBe("File Hub");
    expect(container.querySelectorAll(".rsu-appshell-link")).toHaveLength(1);
    expect(container.querySelector(".rsu-appshell-link--active")).not.toBeNull();
    expect(container.querySelector(".rsu-appshell-settings")?.getAttribute("href")).toBe(
      "/settings",
    );
  });

  it("portals the rightSlot React node into the shell", () => {
    const { container } = render(
      <AppShell brand="File Hub" rightSlot={<span className="badge">Healthy</span>} />,
    );

    expect(container.querySelector(".rsu-appshell-slot .badge")?.textContent).toBe("Healthy");
  });

  it("passes the className through to the host element", () => {
    const { container } = render(<AppShell brand="File Hub" className="mine" />);
    expect(container.firstElementChild?.className).toBe("mine");
  });

  it("tears the shell down on unmount", () => {
    const { container, unmount } = render(<AppShell brand="File Hub" />);
    expect(container.querySelector(".rsu-appshell")).not.toBeNull();

    unmount();
    expect(container.querySelector(".rsu-appshell")).toBeNull();
  });
});
