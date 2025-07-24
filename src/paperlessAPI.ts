import {
    DocumentEditRequest,
    DocumentEditResponse,
    DocumentSearchResult,
    PaperlessConfig,
    PaperlessCorrespondent,
    PaperlessDocument,
    PaperlessDocumentType,
    PaperlessSearchResponse,
    PaperlessTag,
} from "./types.js";
import axios from "axios";
import { Logger } from "./logger.js";

export class PaperlessAPI {
    public paperlessConfig: PaperlessConfig;
    private logger: Logger;

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

        this.logger = Logger.getInstance();
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

    public async getDocumentAllParams(args: {
        id?: number;
        content__icontains?: string;
        title?: string;
        tag?: string;
        correspondent?: string;
        created__date__gte?: string;
        created__date__lte?: string;
        document_type?: string;
        limit?: number;
    }) {
        try {
            const {
                id,
                content__icontains,
                title,
                tag,
                correspondent,
                created__date__gte,
                created__date__lte,
                document_type,
                limit = 10,
            } = args;
            const headers = this.getPaperlessHeaders();

            // Build params object based on provided arguments
            const params: any = {
                page_size: limit,
            };

            // Add specific parameter mappings based on what's provided
            if (id !== undefined) {
                params.id = id;
            }

            if (content__icontains) {
                params.content__icontains = content__icontains;
            }

            if (title) {
                params.title__icontains = title;
            }

            if (tag) {
                params.tags__name__icontains = tag;
            }

            if (correspondent) {
                params.correspondent__name__icontains = correspondent;
            }

            if (created__date__gte) {
                params.created__date__gte = created__date__gte;
            }

            if (created__date__lte) {
                params.created__date__lte = created__date__lte;
            }

            if (document_type) {
                params.document_type__name__icontains = document_type;
            }

            const response = await axios.get<PaperlessSearchResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/`,
                {
                    headers,
                    params: params,
                }
            );

            return this.parseDocumentData(response.data);
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`,
                    },
                ],
            };
        }
    }

    public async getAllDocuments() {
        try {
            const headers = this.getPaperlessHeaders();
            const response = await axios.get<PaperlessSearchResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/`,
                {
                    headers,
                }
            );

            const documents = response.data.results.map(
                (doc: PaperlessDocument) => ({
                    id: doc.id,
                    document_type: doc.document_type,
                    title: doc.title,
                })
            );

            return documents;
        } catch (error: any) {
            throw new Error(`Get all documents error: ${error.message}`);
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

            let tags = response.data.results.map((tag: PaperlessTag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                document_count: tag.document_count,
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
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`,
                    },
                ],
            };
        }
    }

    //Helper Function to Format a Tag
    public formatCorrespondent(correspondent: PaperlessCorrespondent) {
        return `Tag ID: ${correspondent.id}, Name: ${correspondent.name}, Document with this Tag: ${correspondent.document_count}`;
    }

    public async listCorrespondents() {
        try {
            const headers = this.getPaperlessHeaders();
            const response = await axios.get(
                `${this.paperlessConfig.baseUrl}/api/correspondents/`,
                {
                    headers,
                }
            );

            let correspondent = response.data.results.map(
                (correspondent: PaperlessCorrespondent) => ({
                    id: correspondent.id,
                    name: correspondent.name,
                    document_count: correspondent.document_count,
                })
            );

            let formattedCorrespondents = correspondent.map(
                this.formatCorrespondent
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(formattedCorrespondents, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`,
                    },
                ],
            };
        }
    }

    //Helper Function to Format a DocumentType
    public formatDocumentType(documentType: PaperlessDocumentType) {
        return `DocumentType ID: ${documentType.id}, Name: ${documentType.name}, Document with this Tag: ${documentType.document_count}`;
    }

    public async listDocumentTypes() {
        try {
            const headers = this.getPaperlessHeaders();
            const response = await axios.get(
                `${this.paperlessConfig.baseUrl}/api/document_types/`,
                {
                    headers,
                }
            );

            let documentTypes = response.data.results.map(
                (type: PaperlessDocumentType) => ({
                    id: type.id,
                    name: type.name,
                    document_count: type.document_count,
                })
            );

            let formattedCorrespondents = documentTypes.map(
                this.formatDocumentType
            );

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(formattedCorrespondents, null, 2),
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`,
                    },
                ],
            };
        }
    }

    public async bulkEditDocuments(args: {
        documentIds: number[];
        method: string;
        correspondent_id?: number;
        document_type_id?: number;
        tag_id?: number;
        add_tags_ids?: number[];
        remove_tags_ids?: number[];
    }) {
        try {
            const {
                documentIds,
                method,
                correspondent_id,
                document_type_id,
                add_tags_ids,
                remove_tags_ids,
            } = args;

            const headers = this.getPaperlessHeaders();

            // Prepare the request body based on the method and parameters
            const requestBody: DocumentEditRequest = {
                documents: documentIds,
                method: method,
                parameters: {},
            };

            // Add method-specific parameters
            switch (method) {
                case "set_correspondent":
                    if (correspondent_id !== undefined) {
                        requestBody.parameters.correspondent = correspondent_id;
                    }
                    break;
                case "set_document_type":
                    if (document_type_id !== undefined) {
                        requestBody.parameters.document_type = document_type_id;
                    }
                    break;
                case "modify_tags":
                    if (add_tags_ids) {
                        requestBody.parameters.add_tags = add_tags_ids;
                    } else {
                        requestBody.parameters.add_tags = [];
                    }
                    if (remove_tags_ids) {
                        requestBody.parameters.remove_tags = remove_tags_ids;
                    } else {
                        requestBody.parameters.remove_tags = [];
                    }
                    break;
                case "delete":
                    // No additional parameters needed for delete
                    break;
            }

            this.logger.info(
                `bulk edit request body: ${JSON.stringify(requestBody, null, 2)}`
            );

            const response = await axios.post<DocumentEditResponse>(
                `${this.paperlessConfig.baseUrl}/api/documents/bulk_edit/`,
                requestBody,
                {
                    headers,
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: `edit completed successfully: ${response.data.result}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error: ${error.message}`,
                    },
                ],
            };
        }
    }
}
