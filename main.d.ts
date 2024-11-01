import type { JSDOM } from "jsdom";
import type { parse as YAMLparse } from "yaml";

export type GetComponentFunction<T extends GetComponentOptions> = (
  componentUri: string,
  getComponentOptions?: T
) => Promise<{
  componentTemplate: string;
  componentScript?: string;
  componentSettings?: ReturnType<typeof YAMLparse>;
}>;

export interface GetComponentFromFsOptions {
  basePath?: string;
  cacheOptions?: {
    disabled?: boolean;
  };
}

export const getComponentFromFs: GetComponentFunction<GetComponentFromFsOptions>;

export function renderComponent<GetComponentOptions>(
  componentUri: string,
  customContext: Record<string, any> | null | undefined,
  renderingOptions: {
    descendant?: boolean;
    getComponent: GetComponentFunction;
    getComponentOptions?: GetComponentOptions;
  }
): Promise<JSDOM>;
