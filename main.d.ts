export interface GetComponentOptions {
  baseDir?: string;
  cacheOptions?: {
    enabled?: boolean;
  };
}

export declare function renderComponent(
  context: {
    getComponent(
      componentDir: string,
      options?: GetComponentOptions
    ): Promise<{
      componentSettings: Record<string, unknown>;
      componentTemplate: string;
    }>;
    getComponentOptions?: GetComponentOptions;
  },
  componentUri: string,
  dataAsJson?: Record<string, unknown> | null
): Promise<string>;
