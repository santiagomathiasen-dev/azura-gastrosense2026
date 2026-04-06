/**
 * DriveDataService — manages user data stored as JSON files in Google Drive.
 * Each user has their own "AzuraGastroSense" folder with JSON files per module.
 *
 * Modules:
 *   stock.json     — stock_items, stock_movements
 *   recipes.json   — technical_sheets (with ingredients, stages, steps)
 *   production.json — productions, finished_productions_stock, produced_inputs_stock
 *   sales.json     — sale_products, sale_product_components, sales, sales_forecasts
 *   suppliers.json — suppliers, purchase_list_items
 *   losses.json    — losses
 *   settings.json  — user preferences and metadata
 */

export interface DriveModuleMap {
  stock: {
    stock_items: any[];
    stock_movements: any[];
  };
  recipes: {
    technical_sheets: any[];
  };
  production: {
    productions: any[];
    finished_productions_stock: any[];
    produced_inputs_stock: any[];
  };
  sales: {
    sale_products: any[];
    sale_product_components: any[];
    sales: any[];
    sales_forecasts: any[];
    forecast_production_orders: any[];
  };
  suppliers: {
    suppliers: any[];
    purchase_list_items: any[];
  };
  losses: {
    losses: any[];
  };
  settings: {
    preferences: Record<string, any>;
    last_sync: string | null;
  };
}

export type ModuleName = keyof DriveModuleMap;

const MODULE_FILES: Record<ModuleName, string> = {
  stock: 'stock.json',
  recipes: 'recipes.json',
  production: 'production.json',
  sales: 'sales.json',
  suppliers: 'suppliers.json',
  losses: 'losses.json',
  settings: 'settings.json',
};

const DEFAULT_DATA: DriveModuleMap = {
  stock: { stock_items: [], stock_movements: [] },
  recipes: { technical_sheets: [] },
  production: { productions: [], finished_productions_stock: [], produced_inputs_stock: [] },
  sales: { sale_products: [], sale_product_components: [], sales: [], sales_forecasts: [], forecast_production_orders: [] },
  suppliers: { suppliers: [], purchase_list_items: [] },
  losses: { losses: [] },
  settings: { preferences: {}, last_sync: null },
};

interface DriveApiOptions {
  action: string;
  fileName?: string;
  fileId?: string;
  data?: any;
}

async function callDriveApi(options: DriveApiOptions): Promise<any> {
  const res = await fetch('/api/drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Drive API error: ${error}`);
  }

  return res.json();
}

export class DriveDataService {
  private folderId: string | null = null;
  private fileIds: Partial<Record<ModuleName, string>> = {};
  private cache: Partial<DriveModuleMap> = {};
  private initialized = false;

  /** Initialize: get or create app folder and discover existing files */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await callDriveApi({ action: 'init' });
      this.folderId = result.folderId;

      // Discover existing module files
      const files = await callDriveApi({ action: 'list' });
      if (Array.isArray(files)) {
        for (const file of files) {
          for (const [module, fileName] of Object.entries(MODULE_FILES)) {
            if (file.name === fileName) {
              this.fileIds[module as ModuleName] = file.id;
            }
          }
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('DriveDataService: init failed', error);
      throw error;
    }
  }

  /** Read a module's data from Drive */
  async readModule<T extends ModuleName>(module: T): Promise<DriveModuleMap[T]> {
    await this.init();

    // Return from cache if available
    if (this.cache[module]) {
      return this.cache[module] as DriveModuleMap[T];
    }

    const fileId = this.fileIds[module];
    if (!fileId) {
      // File doesn't exist yet — return defaults
      const defaults = { ...DEFAULT_DATA[module] };
      this.cache[module] = defaults;
      return defaults as DriveModuleMap[T];
    }

    try {
      const data = await callDriveApi({ action: 'read', fileId });
      this.cache[module] = data;
      return data as DriveModuleMap[T];
    } catch (error) {
      console.error(`DriveDataService: read ${module} failed`, error);
      return { ...DEFAULT_DATA[module] } as DriveModuleMap[T];
    }
  }

  /** Write a module's data to Drive */
  async writeModule<T extends ModuleName>(module: T, data: DriveModuleMap[T]): Promise<void> {
    await this.init();

    const fileName = MODULE_FILES[module];
    const existingFileId = this.fileIds[module];

    try {
      const result = await callDriveApi({
        action: 'save',
        fileName,
        fileId: existingFileId,
        data,
      });

      // Store the file ID for future updates
      if (result?.id) {
        this.fileIds[module] = result.id;
      }

      // Update cache
      this.cache[module] = data;
    } catch (error) {
      console.error(`DriveDataService: write ${module} failed`, error);
      throw error;
    }
  }

  /** Read a specific collection within a module */
  async readCollection<T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T,
    collection: K
  ): Promise<DriveModuleMap[T][K]> {
    const moduleData = await this.readModule(module);
    return moduleData[collection];
  }

  /** Update a specific collection within a module */
  async writeCollection<T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T,
    collection: K,
    items: DriveModuleMap[T][K]
  ): Promise<void> {
    const moduleData = await this.readModule(module);
    const updated = { ...moduleData, [collection]: items };
    await this.writeModule(module, updated);
  }

  /** Add an item to a collection (with auto-generated ID) */
  async addItem<T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T,
    collection: K,
    item: any
  ): Promise<any> {
    const items = (await this.readCollection(module, collection)) as any[];
    const newItem = {
      ...item,
      id: item.id || crypto.randomUUID(),
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await this.writeCollection(module, collection, [...items, newItem] as any);
    return newItem;
  }

  /** Update an item in a collection by ID */
  async updateItem<T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T,
    collection: K,
    id: string,
    updates: any
  ): Promise<any> {
    const items = (await this.readCollection(module, collection)) as any[];
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) throw new Error(`Item ${id} not found in ${String(collection)}`);

    const updated = { ...items[index], ...updates, updated_at: new Date().toISOString() };
    const newItems = [...items];
    newItems[index] = updated;
    await this.writeCollection(module, collection, newItems as any);
    return updated;
  }

  /** Delete an item from a collection by ID */
  async deleteItem<T extends ModuleName, K extends keyof DriveModuleMap[T]>(
    module: T,
    collection: K,
    id: string
  ): Promise<void> {
    const items = (await this.readCollection(module, collection)) as any[];
    const filtered = items.filter((item: any) => item.id !== id);
    await this.writeCollection(module, collection, filtered as any);
  }

  /** Load all modules at once (for initial sync) */
  async loadAll(): Promise<DriveModuleMap> {
    await this.init();

    const modules = Object.keys(MODULE_FILES) as ModuleName[];
    const results = await Promise.allSettled(
      modules.map(async (module) => ({
        module,
        data: await this.readModule(module),
      }))
    );

    const fullData = { ...DEFAULT_DATA };
    for (const result of results) {
      if (result.status === 'fulfilled') {
        (fullData as any)[result.value.module] = result.value.data;
      }
    }

    return fullData;
  }

  /** Clear cache (force re-read from Drive on next access) */
  clearCache(): void {
    this.cache = {};
  }

  /** Check if Drive is connected */
  get isConnected(): boolean {
    return this.initialized && this.folderId !== null;
  }
}

// Singleton instance
export const driveDataService = new DriveDataService();
