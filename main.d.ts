export declare const renderComponent = (
  context: {
    getComponent: (componentUri: string) => Promise<{
      componentSettings: Record<string, unknown>;
      componentTemplate: string;
    }>;
  },
  componentUri: string,
  dataAsJson?: Record<string, unknown> | null
) => string;
