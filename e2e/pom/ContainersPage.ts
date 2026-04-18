import { type Page, type Locator } from "@playwright/test";

export class ContainersPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly refreshButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Containers" });
    this.createButton = page.getByRole("link", { name: "Create", exact: true });
    this.refreshButton = page.getByRole("button", { name: "Refresh" });
    this.emptyState = page.getByText("No containers found");
  }

  async goto(): Promise<void> {
    await this.page.goto("/containers");
    await this.heading.waitFor({ state: "visible" });
  }

  getContainerCards(): Locator {
    return this.page
      .locator('a[href^="/containers/"]')
      .filter({ hasNot: this.page.locator('[href="/containers/create"]') });
  }

  getContainerCard(name: string): Locator {
    return this.getContainerCards().filter({ hasText: name });
  }

  getContainerStatus(name: string): Locator {
    return this.getContainerCard(name).getByTestId("status-badge");
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }

  async clickContainer(name: string): Promise<void> {
    await this.getContainerCard(name).click();
  }
}
