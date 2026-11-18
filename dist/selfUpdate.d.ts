export interface SelfUpdateResult {
    status: number;
    body: Record<string, any>;
}
export declare function selfUpdate(opts: {
    body: Record<string, any>;
    apiKey: string;
    autoRestart: boolean;
}): Promise<SelfUpdateResult>;
