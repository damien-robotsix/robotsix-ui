import { describe, it, expect, beforeEach } from "vitest";
import { mountAppShell } from "./appshell.js";

let host: HTMLElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

describe("mountAppShell", () => {
  it("renders the brand and ordered nav items with active highlighting", () => {
    const shell = mountAppShell(host, {
      brand: "File Hub",
      navItems: [
        { label: "Files", href: "/files", icon: "📁" },
        { label: "Jobs", href: "/jobs", active: true },
      ],
    });

    expect(shell.element).toBe(host.querySelector(".rsu-appshell"));
    expect(host.querySelector(".rsu-appshell-brand")?.textContent).toBe("File Hub");

    const links = host.querySelectorAll(".rsu-appshell-link");
    expect(links).toHaveLength(2);
    expect((links[0] as HTMLAnchorElement).getAttribute("href")).toBe("/files");
    expect(links[0].querySelector(".rsu-appshell-icon")?.textContent).toBe("📁");
    expect(links[1].classList.contains("rsu-appshell-link--active")).toBe(true);
    expect(links[1].getAttribute("aria-current")).toBe("page");
    expect(links[0].getAttribute("aria-current")).toBeNull();
  });

  it("shows the settings link only when settingsHref is provided", () => {
    const shell = mountAppShell(host, { settingsHref: "/settings" });
    const settings = host.querySelector(".rsu-appshell-settings") as HTMLAnchorElement;
    expect(settings.hidden).toBe(false);
    expect(settings.getAttribute("href")).toBe("/settings");

    shell.destroy();
    mountAppShell(host, {});
    expect((host.querySelector(".rsu-appshell-settings") as HTMLAnchorElement).hidden).toBe(true);
  });

  it("renders nav labels and right-slot strings as text, never as markup", () => {
    mountAppShell(host, {
      navItems: [{ label: "<b>Files</b>", href: "/files?a=1&b=2" }],
      rightSlot: "<b>Healthy</b>",
    });

    const link = host.querySelector(".rsu-appshell-link") as HTMLAnchorElement;
    expect(link.querySelector("b")).toBeNull();
    expect(link.textContent).toBe("<b>Files</b>");

    const slot = host.querySelector(".rsu-appshell-slot") as HTMLElement;
    expect(slot.querySelector("b")).toBeNull();
    expect(slot.textContent).toBe("<b>Healthy</b>");
  });

  it("appends a right-slot element", () => {
    const badge = document.createElement("span");
    badge.className = "rsu-badge rsu-badge--success";
    badge.textContent = "Healthy";
    mountAppShell(host, { rightSlot: badge });

    const slot = host.querySelector(".rsu-appshell-slot") as HTMLElement;
    expect(slot.contains(badge)).toBe(true);
    expect(slot.querySelector(".rsu-badge--success")?.textContent).toBe("Healthy");
  });

  it("toggles the collapsed nav through the hamburger button", () => {
    mountAppShell(host, { navItems: [{ label: "Files", href: "/files" }] });
    const root = host.querySelector(".rsu-appshell") as HTMLElement;
    const toggle = host.querySelector(".rsu-appshell-toggle") as HTMLButtonElement;

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(root.classList.contains("rsu-appshell--open")).toBe(false);

    toggle.click();
    expect(root.classList.contains("rsu-appshell--open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();
    expect(root.classList.contains("rsu-appshell--open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears the container on destroy", () => {
    const shell = mountAppShell(host, { brand: "File Hub" });
    expect(host.querySelector(".rsu-appshell")).not.toBeNull();

    shell.destroy();
    expect(host.querySelector(".rsu-appshell")).toBeNull();
  });
});
