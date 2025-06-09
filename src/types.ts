export interface OllamaConfig {
    baseUrl: string;
    model: string;
}

export interface PaperlessConfig {
    baseUrl: string;
    token: string;
}

export interface OpenAIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface OpenAIChatRequest {
    model: string;
    messages: OpenAIMessage[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
}

//Sinnvolle heraussuchen
export interface PaperlessDocument {
    id: number;
    correspondent?: number | null;
    document_type?: number | null;
    storage_path?: number | null;
    title: string;
    content: string;
    tags: number[];
    created: string;
    created_date?: string;
    modified: string;
    added: string;
    deleted_at?: string | null;
    archive_serial_number: number | null;
    original_file_name?: string;
    archived_file_name?: string;
    owner?: number;
    user_can_change?: boolean;
    is_shared_by_requester?: boolean;
    notes?: any[];
    custom_fields?: any[];
    page_count: number;
    mime_type: string;

}

export interface PaperlessSearchResponse {
    count: number;
    next: string | null;
    previous: string | null;
    all?: number[];
    results: PaperlessDocument[];
}

export interface DocumentSearchResult {
    total: number;
    documents: Partial<PaperlessDocument>[];
}
