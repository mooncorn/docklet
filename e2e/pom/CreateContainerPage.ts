import { type Page, type Locator } from "@playwright/test";

export class CreateContainerPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly imageInput: Locator;
  readonly createButton: Locator;
  readonly loadTemplateButton: Locator;
  readonly saveTemplateButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByLabel("Container Name");
    this.imageInput = page.getByLabel("Image");
    this.createButton = page.getByRole("button", { name: "Create" });
    this.loadTemplateButton = page.getByRole("button", { name: "Load Template" });
    this.saveTemplateButton = page.getByRole("button", { name: "Save Template" });
    this.errorMessage = page.getByTestId("error-message");
  }

  async goto(): Promise<void> {
    await this.page.goto("/containers/create");
    await this.page.getByText("Create Container").waitFor({ state: "visible" });
  }

  async fillBasic(name: string, image: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.imageInput.fill(image);
  }

  async addPort(
    hostPort: string,
    containerPort: string,
    protocol: "TCP" | "UDP" = "TCP"
  ): Promise<void> {
    await this.page.getByRole("button", { name: "Add Port" }).click();
    const lastHostInput = this.page.getByPlaceholder("Host Port").last();
    await lastHostInput.fill(hostPort);
    const row = lastHostInput.locator("..");
    await row.getByPlaceholder("Container Port").fill(containerPort);
    if (protocol === "UDP") {
      await row.locator("select").selectOption("udp");
    }
  }

  async addEnvVar(key: string, value: string): Promise<void> {
    await this.page.getByRole("button", { name: "Add Variable" }).click();
    const lastKeyInput = this.page.getByPlaceholder("KEY").last();
    await lastKeyInput.fill(key);
    const row = lastKeyInput.locator("..");
    await row.getByPlaceholder("value").fill(value);
  }

  async submit(): Promise<void> {
    await this.createButton.click();
  }

  async loadTemplate(templateName: string): Promise<void> {
    await this.loadTemplateButton.click();
    await this.page.getByRole("heading", { name: "Load Template" }).waitFor({ state: "visible" });
    await this.page.getByRole("button", { name: templateName }).click();
  }

  async saveAsTemplate(templateName: string): Promise<void> {
    await this.saveTemplateButton.click();
    await this.page.getByRole("heading", { name: "Save Template" }).waitFor({ state: "visible" });
    await this.page.getByLabel("Template Name").fill(templateName);
    await this.page.getByRole("button", { name: "Save", exact: true }).click();
    await this.page.getByRole("heading", { name: "Save Template" }).waitFor({ state: "hidden" });
  }
}
