// playwright.config.ts will provide baseURL and testDir
import { test, expect } from "@playwright/test";

/**
 * Full‑flow E2E test for Azura Gastrosense.
 * Steps:
 *   1️⃣  Login as admin
 *   2️⃣  Register a new product
 *   3️⃣  Transfer product to central stock
 *   4️⃣  Create a ficha (technical sheet) for the product
 *   5️⃣  Start a production order using the ficha
 *   6️⃣  Verify AI UI features (theme toggle & toast notifications)
 */

test.describe("Full flow: product → stock → ficha → production", () => {
    const productName = `TestProduct-${Date.now()}`;
    const productCode = `TP${Math.floor(Math.random() * 1000)}`;
    const productPrice = "9.99";

    test.beforeEach(async ({ page }) => {
        // ---- 1️⃣ Login -----------------------------------------------------
        await page.goto("/auth");
        await page.fill("#email", "admin@example.com");
        await page.fill("#password", "adminpassword");
        await page.click("button:has-text('Entrar')");
        // Wait for dashboard to load
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test("register product, move to stock, create ficha and start production", async ({ page }) => {
        // ---- 2️⃣ Register product ------------------------------------------
        await page.click("nav >> text=Produtos");
        await page.click("button:has-text('Novo Produto')");
        await page.fill("input[name='name']", productName);
        await page.fill("input[name='code']", productCode);
        await page.fill("input[name='price']", productPrice);
        await page.click("button:has-text('Salvar')");
        // Verify toast appears
        await expect(page.locator(".sonner-toast")).toContainText("Produto criado");

        // ---- 3️⃣ Transfer to central stock ---------------------------------
        await page.click("nav >> text=Estoque Central");
        // Find the product row (by name) and click Transfer button
        const productRow = page.locator(`tr:has-text("${productName}")`);
        await productRow.locator("button:has-text('Transferir')").click();
        await page.fill("input[name='quantity']", "10");
        await page.click("button:has-text('Confirmar')");
        await expect(page.locator(".sonner-toast")).toContainText("Transferência concluída");

        // ---- 4️⃣ Create ficha ----------------------------------------------
        await page.click("nav >> text=Fichas");
        await page.click("button:has-text('Nova Ficha')");
        await page.selectOption("select[name='product']", { label: productName });
        // Fill minimal technical details (adjust selectors as needed)
        await page.fill("textarea[name='ingredients']", "Water, Salt");
        await page.fill("textarea[name='preparation']", "Mix and heat.");
        await page.click("button:has-text('Salvar')");
        await expect(page.locator(".sonner-toast")).toContainText("Ficha criada");

        // ---- 5️⃣ Start production ------------------------------------------
        await page.click("nav >> text=Produção");
        await page.click("button:has-text('Nova Produção')");
        await page.selectOption("select[name='ficha']", { label: productName });
        await page.fill("input[name='quantity']", "5");
        await page.click("button:has-text('Iniciar')");
        await expect(page.locator(".sonner-toast")).toContainText("Produção iniciada");
        // Verify production appears in list with status "Em andamento"
        await expect(page.locator(`tr:has-text("${productName}") >> td.status`)).toHaveText("Em andamento");

        // ---- 6️⃣ Verify AI UI features -------------------------------------
        // Theme toggle (sun/moon button) – located in sidebar
        const themeButton = page.locator("button:has([data-icon='sun']), button:has([data-icon='moon'])");
        const initialTheme = await page.evaluate(() => document.documentElement.classList.contains("dark"));
        await themeButton.click();
        const toggledTheme = await page.evaluate(() => document.documentElement.classList.contains("dark"));
        // Theme should have toggled
        expect(toggledTheme).not.toBe(initialTheme);
    });
});
