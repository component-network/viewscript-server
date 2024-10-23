export interface ComponentSettings {
  data: Record<string, unknown>;
  imports: Record<string, string>;
  plugins: {
    tailwindcss?: Record<string, unknown>;
  };
}

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
  componentSettings: ComponentSettings;
  componentTemplate: string;
  componentEnhancements?: string;
}>;

export declare function renderComponent<GetComponentOptions>(
  componentUri: string,
  customData: Record<string, unknown> | null | undefined,
  context: {
    componentSettings?: ComponentSettings;
    getComponent(
      componentUri: string,
      options?: GetComponentOptions
    ): Promise<{
      componentSettings: ComponentSettings;
      componentTemplate: string;
    }>;
    getComponentOptions?: GetComponentOptions;
    isDescendantComponent?: boolean;
    renderComponent?: typeof renderComponent;
  }
): Promise<string>;
