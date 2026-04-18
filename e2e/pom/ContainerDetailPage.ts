import { type Page, type Locator } from "@playwright/test";

export type ContainerTab = "Logs" | "Info" | "Ports" | "Mounts" | "Environment";

export class ContainerDetailPage {
  readonly page: Page;
  readonly startButton: Locator;
  readonly stopButton: Locator;
  readonly restartButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly statusBadge: Locator;
  readonly execInput: Locator;
  readonly execRunButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startButton = page.getByRole("button", { name: "Start", exact: true });
    this.stopButton = page.getByRole("button", { name: "Stop", exact: true });
    this.restartButton = page.getByRole("button", { name: "Restart container" });
    this.editButton = page.getByRole("button", { name: "Edit container" });
    this.deleteButton = page.getByRole("button", { name: "Delete container" });
    this.statusBadge = page.getByTestId("status-badge");
    this.execInput = page.locator('input[placeholder="Enter command..."]');
    this.execRunButton = page.getByRole("button", { name: "Run" });
  }

  async goto(containerId: string): Promise<void> {
    await this.page.goto(`/containers/${containerId}`);
    await this.page.locator(".tab-bar").waitFor({ state: "visible" });
  }

  async selectTab(tab: ContainerTab): Promise<void> {
    await this.page.getByRole("button", { name: tab }).click();
  }

  async start(): Promise<void> {
    await this.startButton.click();
    await this.stopButton.waitFor({ state: "visible", timeout: 15_000 });
  }

  async stop(): Promise<void> {
    await this.stopButton.click();
    await this.startButton.waitFor({ state: "visible", timeout: 15_000 });
  }

  async restart(): Promise<void> {
    await this.restartButton.click();
    await this.stopButton.waitFor({ state: "visible", timeout: 15_000 });
  }

  async delete(confirm = true): Promise<void> {
    await this.deleteButton.click();
    await this.page
      .getByRole("heading", { name: "Delete Container" })
      .waitFor({ state: "visible" });
    if (confirm) {
      await this.page.getByRole("button", { name: "Delete" }).last().click();
      await this.page.waitForURL(/\/containers$/);
    } else {
      await this.page.getByRole("button", { name: "Cancel" }).click();
      await this.page
        .getByRole("heading", { name: "Delete Container" })
        .waitFor({ state: "hidden" });
    }
  }

  async execCommand(cmd: string): Promise<string> {
    await this.execInput.fill(cmd);
    await this.execRunButton.click();
    const output = this.page.locator("pre.log-viewer");
    await output.waitFor({ state: "visible", timeout: 15_000 });
    return (await output.textContent()) ?? "";
  }
}
