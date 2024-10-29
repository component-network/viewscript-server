export interface ComponentSettings {
  context?: Record<string, unknown>;
  overrides?: Record<string, Record<string, unknown>>;
}

export interface ComponentEntity {
  componentTemplate: string;
  componentSettings?: ComponentSettings;
  componentScript?: string;
}

export interface GetComponentFromFsOptions {
  baseDir?: string;
  cacheOptions?: {
    disabled?: boolean;
  };
}

export declare type GetComponentFunction<Options extends GetComponentOptions> =
  (componentUri: string, options?: Options) => Promise<ComponentEntity>;

export declare const getComponentFromFs: GetComponentFunction<GetComponentFromFsOptions>;

export declare function renderComponent<GetComponentOptions>(
  componentUri: string,
  customData: Record<string, unknown> | null | undefined,
  context: {
    componentSettings?: ComponentSettings;
    getComponent: GetComponentFunction;
    getComponentOptions?: GetComponentOptions;
    isDescendantComponent?: boolean;
    renderComponent?: typeof renderComponent;
  }
): Promise<string>;
