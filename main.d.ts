import type { parse as YAMLparse } from "yaml";

export type GetComponentFunction<T extends GetComponentOptions> = (
  componentUri: string,
  getComponentOptions?: T
) => Promise<{
  componentTemplate: string;
  componentScript?: string;
  componentSettings?: ReturnType<typeof YAMLparse>;
}>;

export const getComponentFromFs: GetComponentFunction<{
  basePath?: string;
  cacheOptions?: {
    disabled?: boolean;
  };
}>;

export function renderComponent<GetComponentOptions>(
  componentUri: string,
  customContext: Record<string, unknown> | null | undefined,
  renderingOptions: {
    descendant?: boolean;
    getComponent: GetComponentFunction;
    getComponentOptions?: GetComponentOptions;
  }
): Promise<string>;
