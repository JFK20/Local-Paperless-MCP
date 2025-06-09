import {
    DocumentSearchResult,
    PaperlessConfig,
    PaperlessDocument,
    PaperlessSearchResponse,
} from "./types.js";
import axios from "axios";

export class PaperlessAPI {
    paperlessConfig: PaperlessConfig;

    constructor() {
        this.paperlessConfig = {
            baseUrl: process.env.PAPERLESS_BASE_URL,
            token: process.env.PAPERLESS_TOKEN,
        };

        if (!this.paperlessConfig.baseUrl || !this.paperlessConfig.token) {
            throw new Error(
                "Paperless configuration is missing. Please set PAPERLESS_BASE_URL and PAPERLESS_TOKEN environment variables."
            );
        }
    }

    public getPaperlessHeaders() {
        const headers: any = {
            "Content-Type": "application/json",
        };

        if (this.paperlessConfig.token) {
            headers["Authorization"] = `Token ${this.paperlessConfig.token}`;
        }

        return headers;
    }

    public async searchDocuments(args: { query: string; limit?: number }) {
        try {
            const { query, limit = 10 } = args;
            const headers = this.getPaperlessHeaders();

            const response = await axios.get<PaperlessSearchResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/`,
                {
                    headers,
                    params: {
                        query: query,
                        page_size: limit,
                    },
                }
            );

            const documents = response.data.results.map(
                (doc: PaperlessDocument) => ({
                    id: doc.id,
                    correspondent: doc.correspondent,
                    document_type: doc.document_type,
                    //storage_path: doc.storage_path,
                    title: doc.title,
                    content: doc.content?.substring(0, 400) + "...",
                    tags: doc.tags,
                    //created: doc.created,
                    created_date: doc.created_date,
                    //added: doc.added,
                    //archive_serial_number: doc.archive_serial_number,
                    //original_file_name: doc.original_file_name,
                    archived_file_name: doc.archived_file_name,
                    owner: doc.owner,
                    //user_can_change: doc.user_can_change,
                    //is_shared_by_requester: doc.is_shared_by_requester,
                    notes: doc.notes,
                    //custom_fields: doc.custom_fields,
                    //page_count: doc.page_count,
                    //mime_type: doc.mime_type,
                })
            );

            const searchResult: DocumentSearchResult = {
                total: response.data.count,
                documents: documents,
            };

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(searchResult, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Paperless search error: ${error.message}`);
        }
    }

    public async getDocument(args: { documentId: number }) {
        try {
            const { documentId } = args;
            const headers = this.getPaperlessHeaders();

            const response = await axios.get<PaperlessDocument>(
                `${this.paperlessConfig.baseUrl}/api/documents/${documentId}/`,
                {
                    headers,
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Paperless get document error: ${error.message}`);
        }
    }

    public async getDocumentContent(args: { documentId: number }) {
        try {
            const { documentId } = args;
            const headers = this.getPaperlessHeaders();

            const response = await axios.get<PaperlessDocument>(
                `${this.paperlessConfig.baseUrl}/api/documents/${documentId}/`,
                {
                    headers,
                }
            );

            const content = response.data.content || "No content available";

            return {
                content: [
                    {
                        type: "text",
                        text: content,
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Paperless get content error: ${error.message}`);
        }
    }

    public async listTags(args: any = {}) {
        try {
            const headers = this.getPaperlessHeaders();
            const response = await axios.get(
                `${this.paperlessConfig.baseUrl}/api/tags/`,
                {
                    headers,
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                tags: response.data.results.map((tag: any) => ({
                                    id: tag.id,
                                    name: tag.name,
                                    color: tag.colour,
                                    documentCount: tag.document_count,
                                })),
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`List tags error: ${error.message}`);
        }
    }

    public async getDocumentsByTag(args: { tagName: string; limit?: number }) {
        try {
            const { tagName, limit = 10 } = args;
            const headers = this.getPaperlessHeaders();

            const response = await axios.get<PaperlessSearchResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/`,
                {
                    headers,
                    params: {
                        tags__name__icontains: tagName,
                        page_size: limit,
                    },
                }
            );

            const documents = response.data.results.map(
                (doc: PaperlessDocument) => ({
                    id: doc.id,
                    correspondent: doc.correspondent,
                    document_type: doc.document_type,
                    //storage_path: doc.storage_path,
                    title: doc.title,
                    content: doc.content?.substring(0, 400) + "...",
                    tags: doc.tags,
                    //created: doc.created,
                    created_date: doc.created_date,
                    //added: doc.added,
                    //archive_serial_number: doc.archive_serial_number,
                    //original_file_name: doc.original_file_name,
                    archived_file_name: doc.archived_file_name,
                    owner: doc.owner,
                    //user_can_change: doc.user_can_change,
                    //is_shared_by_requester: doc.is_shared_by_requester,
                    notes: doc.notes,
                    //custom_fields: doc.custom_fields,
                    //page_count: doc.page_count,
                    //mime_type: doc.mime_type,
                })
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                tagName,
                                total: response.data.count,
                                documents: documents,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Get documents by tag error: ${error.message}`);
        }
    }
}
