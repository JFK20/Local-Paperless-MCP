import { DocumentSearchResult, PaperlessConfig } from "./types/own_types";
import { components } from "./types/gen_paperless";
import axios from "axios";
import { Logger } from "./logger.js";
import { CachedMetadata } from "./cachedMetadata.js";

export class PaperlessAPI {
    public paperlessConfig: PaperlessConfig;
    private logger: Logger;
    private cachedMetadata: CachedMetadata = CachedMetadata.getInstance();

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
    public formatDocument = (doc: components["schemas"]["Document"]) => {
        const tags = this.cachedMetadata.getTagsByIds(doc.tags);
        const correspondent = this.cachedMetadata.getCorrespondentById(
            doc.correspondent
        );
        const documentType = this.cachedMetadata.getDocumentTypeById(
            doc.document_type
        );

        return `Title: ${doc.title} ID: ${doc.id} \n  Content: ${doc.content}... \n  Tags: ${tags?.map((t) => t.name).join(", ") || "N/A"}\n
    Correspondent: ${correspondent?.name || "N/A"} \n  Document Type: ${documentType?.name || "N/A"} \n created_date: ${doc.created_date} \n
    Archived File Name: ${doc.archived_file_name} \n  Owner: ${doc.owner} \n  Notes: ${doc.notes || "N/A"}`;
    };

    public parseDocumentData(
        result: components["schemas"]["PaginatedDocumentList"]
    ) {
        let formattedDocuments = result.results.map(this.formatDocument);

        const searchResult: DocumentSearchResult = {
            total: result.results.length,
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
        this.logger.debug("getDocumentAllParams called with args", args);
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

            const params: any = {
                page_size: limit,
            };

            if (id) {
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

            this.logger.info(
                `getDocumentAllParams request params: ${JSON.stringify(
                    params,
                    null,
                    2
                )}`
            );

            const response = await axios.get<
                components["schemas"]["PaginatedDocumentList"]
            >(`${this.paperlessConfig.baseUrl}/api/documents/`, {
                headers,
                params: params,
            });

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

    //Helper Function to Format a Tag
    public formatTag(tag: components["schemas"]["Tag"]) {
        return `Tag ID: ${tag.id}, Name: ${tag.name}, Color: ${tag.color}, Document with this Tag: ${tag.document_count ?? 0}`;
    }

    public async listTags() {
        try {
            let tags = await this.listTagsRaw();
            let formattedTags = tags.results.map(this.formatTag);

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

    public async listTagsRaw() {
        const headers = this.getPaperlessHeaders();
        const response = await axios.get<
            components["schemas"]["PaginatedTagList"]
        >(`${this.paperlessConfig.baseUrl}/api/tags/`, {
            headers,
        });
        return response.data;
    }

    //Helper Function to Format a Tag
    public formatCorrespondent(
        correspondent: components["schemas"]["Correspondent"]
    ) {
        return `Tag ID: ${correspondent.id}, Name: ${correspondent.name}, Document with this Tag: ${correspondent.document_count ?? 0}`;
    }

    public async listCorrespondents() {
        try {
            let correspondents = await this.listCorrespondentsRaw();
            let formattedCorrespondents = correspondents.results.map(
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

    public async listCorrespondentsRaw() {
        const headers = this.getPaperlessHeaders();
        const response = await axios.get<
            components["schemas"]["PaginatedCorrespondentList"]
        >(`${this.paperlessConfig.baseUrl}/api/correspondents/`, {
            headers,
        });
        return response.data;
    }

    //Helper Function to Format a DocumentType
    public formatDocumentType(
        documentType: components["schemas"]["DocumentType"]
    ) {
        return `DocumentType ID: ${documentType.id}, Name: ${documentType.name}, Document with this Tag: ${documentType.document_count ?? 0}`;
    }

    public async listDocumentTypes() {
        try {
            let documentTypes = await this.listDocumentTypesRaw();

            let formattedCorrespondents = documentTypes.results.map(
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

    public async listDocumentTypesRaw() {
        const headers = this.getPaperlessHeaders();
        const response = await axios.get<
            components["schemas"]["PaginatedDocumentTypeList"]
        >(`${this.paperlessConfig.baseUrl}/api/document_types/`, {
            headers,
        });
        return response.data;
    }

    public async bulkEditDocuments(args: {
        documentIds: number[];
        method: string;
        correspondent?: string;
        document_type?: string;
        tag_id?: number;
        add_tags?: string[];
        remove_tags?: string[];
    }) {
        try {
            const {
                documentIds,
                method,
                correspondent,
                document_type,
                add_tags,
                remove_tags,
            } = args;

            const headers = this.getPaperlessHeaders();

            const methodEnum = method as components["schemas"]["MethodEnum"];

            // Prepare the request body based on the method and parameters
            const requestBody: components["schemas"]["BulkEditRequest"] = {
                documents: documentIds,
                method: methodEnum,
                parameters: {},
            };

            // Add method-specific parameters
            switch (methodEnum) {
                case "set_correspondent":
                    if (correspondent !== undefined) {
                        let correspondentId =
                            this.cachedMetadata.getCorrespondentIDByName(
                                correspondent
                            );
                        if (correspondentId) {
                            requestBody.parameters.correspondent =
                                correspondent;
                        } else {
                            return {
                                isError: true,
                                content: [
                                    {
                                        type: "text",
                                        text: `Correspondent "${correspondent}" not found.`,
                                    },
                                ],
                            };
                        }
                    }
                    break;
                case "set_document_type":
                    if (document_type !== undefined) {
                        let documentTypeId =
                            this.cachedMetadata.getDocumentTypeIDByName(
                                document_type
                            );
                        if (documentTypeId) {
                            requestBody.parameters.document_type =
                                document_type;
                        } else {
                            return {
                                isError: true,
                                content: [
                                    {
                                        type: "text",
                                        text: `Document Type "${document_type}" not found.`,
                                    },
                                ],
                            };
                        }
                    }
                    break;
                case "modify_tags":
                    if (add_tags) {
                        const add_tag_ids: number[] = [];
                        for (const tag of add_tags) {
                            let result =
                                this.cachedMetadata.getTagIDByName(tag);
                            if (result !== undefined) {
                                add_tag_ids.push(result);
                            }
                        }
                        requestBody.parameters.add_tags = add_tag_ids;
                    } else {
                        requestBody.parameters.add_tags = [];
                    }
                    if (remove_tags) {
                        const remove_tag_ids: number[] = [];
                        for (const tag of remove_tags) {
                            let result =
                                this.cachedMetadata.getTagIDByName(tag);
                            if (result !== undefined) {
                                remove_tag_ids.push(result);
                            }
                        }
                        requestBody.parameters.remove_tags = remove_tag_ids;
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

            const response = await axios.post<
                components["schemas"]["BulkEditResult"]
            >(
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

    public async createCorrespondent(args: { name: string }) {
        try {
            const { name } = args;

            const requestBody: components["schemas"]["CorrespondentRequest"] = {
                name: name,
            };

            this.logger.info(
                `create correspondent request body: ${JSON.stringify(requestBody, null, 2)}`
            );

            const headers = this.getPaperlessHeaders();
            const response = await axios.post<
                components["schemas"]["Correspondent"]
            >(
                `${this.paperlessConfig.baseUrl}/api/correspondents/`,
                requestBody,
                { headers }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: `Correspondent created successfully: ${this.formatCorrespondent(response.data)}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error creating correspondent: ${error.message}`,
                    },
                ],
            };
        }
    }

    public async createDocumentType(args: { name: string }) {
        try {
            const { name } = args;

            const requestBody: components["schemas"]["DocumentTypeRequest"] = {
                name: name,
            };

            this.logger.info(
                `create document type request body: ${JSON.stringify(requestBody, null, 2)}`
            );

            const headers = this.getPaperlessHeaders();
            const response = await axios.post<
                components["schemas"]["DocumentType"]
            >(
                `${this.paperlessConfig.baseUrl}/api/document_types/`,
                requestBody,
                { headers }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: `Document Type created successfully: ${this.formatDocumentType(response.data)}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error creating document type: ${error.message}`,
                    },
                ],
            };
        }
    }

    public async createTag(args: { name: string; color?: string }) {
        try {
            const { name, color } = args;

            const requestBody: components["schemas"]["TagRequest"] = {
                name: name,
            };

            if (color) {
                requestBody.color = color;
            }

            this.logger.info(
                `create Tag request body: ${JSON.stringify(requestBody, null, 2)}`
            );

            const headers = this.getPaperlessHeaders();
            const response = await axios.post<components["schemas"]["Tag"]>(
                `${this.paperlessConfig.baseUrl}/api/tags/`,
                requestBody,
                { headers }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: `Tag created successfully: ${this.formatTag(response.data)}`,
                    },
                ],
            };
        } catch (error: any) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `Error creating tag: ${error.message}`,
                    },
                ],
            };
        }
    }
}
