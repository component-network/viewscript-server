export interface GetComponentFromFsOptions {
  baseDir?: string;
  cacheOptions?: {
    enabled?: boolean;
  };
}

export declare function getComponentFromFs(
  componentDir: string,
  options?: GetComponentFromFsOptions
): Promise<{
  componentSettings: Record<string, unknown>;
  componentTemplate: string;
}>;

export declare function renderComponent<GetComponentOptions>(
  componentUri: string,
  dataAsJson?: Record<string, unknown> | null,
  context: {
    getComponent(
      componentUri: string,
      options?: GetComponentOptions
    ): Promise<{
      componentSettings: Record<string, unknown>;
      componentTemplate: string;
    }>;
    getComponentOptions?: GetComponentOptions;
  }
): Promise<string>;
