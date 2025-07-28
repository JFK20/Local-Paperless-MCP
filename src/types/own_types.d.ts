export interface PaperlessConfig {
    baseUrl: string;
    token: string;
}

export interface DocumentSearchResult {
    total: number;
    documents: string[];
}