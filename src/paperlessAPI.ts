import {
    DocumentSearchResult,
    PaperlessConfig,
    PaperlessDocument,
    PaperlessSearchResponse,
    PaperlessTag,
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

    //Helper Function to Format a Document
    public formatDocument(doc: PaperlessDocument) {
        return `Title: ${doc.title} ID: ${doc.id} \n  Content: ${doc.content}... \n  Tags: ${doc.tags.join(", ")}\n 
        Correspondent: ${doc.correspondent || "N/A"} \n  Document Type: ${doc.document_type || "N/A"} \n created_date: ${doc.created_date} \n 
        Archived File Name: ${doc.archived_file_name} \n  Owner: ${doc.owner} \n  Notes: ${doc.notes || "N/A"}`;
    }

    public parseDocumentData(result: PaperlessSearchResponse) {
        const documents = result.results.map((doc: PaperlessDocument) => ({
            id: doc.id,
            correspondent: doc.correspondent,
            document_type: doc.document_type,
            storage_path: doc.storage_path,
            title: doc.title,
            content: doc.content,
            tags: doc.tags,
            created: doc.created,
            created_date: doc.created_date,
            modified: doc.modified,
            added: doc.added,
            deleted_at: doc.deleted_at,
            archive_serial_number: doc.archive_serial_number,
            original_file_name: doc.original_file_name,
            archived_file_name: doc.archived_file_name,
            owner: doc.owner,
            user_can_change: doc.user_can_change,
            is_shared_by_requester: doc.is_shared_by_requester,
            notes: doc.notes,
            custom_fields: doc.custom_fields,
            page_count: doc.page_count,
            mime_type: doc.mime_type,
        }));

        let formattedDocuments = documents.map(this.formatDocument);

        const searchResult: DocumentSearchResult = {
            total: result.count,
            documents: formattedDocuments,
        };

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(searchResult, null, 2),
                },
            ],
        };
    }

    public async searchDocuments(args: { title: string; limit?: number }) {
        try {
            const { title, limit = 10 } = args;
            const headers = this.getPaperlessHeaders();

            const response = await axios.get<PaperlessSearchResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/`,
                {
                    headers,
                    params: {
                        query: title,
                        page_size: limit,
                    },
                }
            );

            return this.parseDocumentData(response.data);
        } catch (error: any) {
            throw new Error(`Paperless search error: ${error.message}`);
        }
    }

    //Helper Function to Format a Tag
    public formatTag(tag: PaperlessTag) {
        return `Tag ID: ${tag.id}, Name: ${tag.name}, Color: ${tag.color}, Document with this Tag: ${tag.document_count}`;
    }

    public async listTags() {
        try {
            const headers = this.getPaperlessHeaders();
            const response = await axios.get(
                `${this.paperlessConfig.baseUrl}/api/tags/`,
                {
                    headers,
                }
            );

            const tags = response.data.results.map((tag: PaperlessTag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                documentCount: tag.document_count,
            }));

            let formattedTags = tags.map(this.formatTag);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(formattedTags, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`List tags error: ${error.message}`);
        }
    }

    public async searchDocumentsByTag(args: { tag: string; limit?: number }) {
        try {
            const { tag, limit = 10 } = args;
            const headers = this.getPaperlessHeaders();

            const response = await axios.get<PaperlessSearchResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/`,
                {
                    headers,
                    params: {
                        tags__name__icontains: tag,
                        page_size: limit,
                    },
                }
            );

            return this.parseDocumentData(response.data);
        } catch (error: any) {
            throw new Error(`Paperless search error: ${error.message}`);
        }
    }
}
