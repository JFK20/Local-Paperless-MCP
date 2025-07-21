import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PaperlessAPI } from "./paperlessAPI.js";
import { testPaperlessConnection } from "./startTests.js";
import { Logger } from "./logger.js";
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

export class McpOpenAPIBridge {
    private server: Server;
    private paperlessAPI: PaperlessAPI;
    private logger: Logger;

    constructor() {
        this.paperlessAPI = new PaperlessAPI();
        this.logger = Logger.getInstance();

        this.server = new Server(
            {
                name: "paperless-ollama-mcp",
                version: "0.0.1",
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                },
            }
        );

        this.setupMCPResources();
        this.setupMCPTools();
    }

    public getDocumentSchema = z
        .object({
            id: z
                .number()
                .optional()
                .describe("ID of the document to retrieve"),
            content__icontains: z
                .string()
                .optional()
                .describe("Content to search for in the document"),
            title: z
                .string()
                .optional()
                .describe("title of the documents to find"),
            tag: z.string().optional().describe("tag of the documents to find"),
            correspondent: z
                .string()
                .optional()
                .describe("correspondent of the documents to find"),
            created__date__gte: z
                .string()
                .optional()
                .describe(
                    "creation date greater than or equal to the specified date"
                ),
            created__date__lte: z
                .string()
                .optional()
                .describe(
                    "creation date lesser than or equal to the specified date"
                ),
            document_type: z
                .string()
                .optional()
                .describe("Document type to search for"),
            limit: z
                .number()
                .optional()
                .default(10)
                .describe("Maximum number of documents to return"),
        })
        .refine(
            (data) => {
                const hasId = data.id !== undefined;
                const hasContent = data.content__icontains !== undefined;
                const hasTitle = data.title !== undefined;
                const hasTag = data.tag !== undefined;
                const hasCorrespondent = data.correspondent !== undefined;
                const hasCreatedDateGte = data.created__date__gte !== undefined;
                const hasCreatedDateLte = data.created__date__lte !== undefined;
                const hasDocumentTypeName = data.document_type !== undefined;

                return (
                    hasId ||
                    hasContent ||
                    hasTitle ||
                    hasTag ||
                    hasCorrespondent ||
                    hasCreatedDateGte ||
                    hasCreatedDateLte ||
                    hasDocumentTypeName
                );
            },
            {
                message:
                    "At least one parameter (id, content__icontains, title, tag, correspondent, created__date__gte, created__date__lte, document_type__name__icontains) must be provided",
            }
        );

    public bulkEditSchema = z.object({
        documentIds: z
            .array(z.number())
            .describe("IDs of the documents to edit"),
        method: z.enum([
            "set_correspondent",
            "set_document_type",
            //'set_storage_path',
            //'add_tag',
            //'remove_tag',
            "modify_tags",
            "delete",
            //'reprocess',
            //'merge',
            //'split',
            //'rotate',
            //'delete_pages'
        ]),
        correspondent_id: z
            .number()
            .optional()
            .describe("ID of the correspondent to set"),
        document_type_id: z
            .number()
            .optional()
            .describe("ID of the document type to set"),
        add_tags_ids: z
            .array(z.number())
            .optional()
            .describe("IDs of the tags to add"),
        remove_tags_ids: z
            .array(z.number())
            .optional()
            .describe("IDs of the tags to remove"),
        //tag_id: z.number().optional().describe("ID of the tag to set"),
        /*permissions: z
            .object({
                owner_id: z.number().nullable().optional().describe("ID of the owner to set"),
                set_permissions: z
                    .object({
                        view: z.object({
                            users: z.array(z.number()).describe("IDs of the users to set as viewers"),
                            groups: z.array(z.number()).describe("IDs of the groups to set as viewers")
                        }),
                        change: z.object({
                            users: z.array(z.number()),
                            groups: z.array(z.number())
                        })
                    })
                    .optional(),
                merge: z.boolean().optional().default(false).describe("Whether to merge or overwrite permissions"),
            })
            .optional(),*/
        //metadata_document_id: z.number().optional(),
        //delete_originals: z.boolean().optional(),
        //pages: z.string().optional(),
        //degrees: z.number().optional()
    });

    private setupMCPTools() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "list_tags",
                        description: "Lists all tags in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "list_correspondent",
                        description:
                            "Lists all correspondents in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "list_document_types",
                        description:
                            "Lists all document types in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                    },
                    {
                        name: "get_document",
                        description: "Gets a document in Paperless NGX.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "number",
                                    description:
                                        "ID of the document to retrieve",
                                },
                                content__icontains: {
                                    type: "string",
                                    description:
                                        "Content to search for in the document",
                                },
                                title: {
                                    type: "string",
                                    description:
                                        "Title of the documents to find",
                                },
                                tag: {
                                    type: "string",
                                    description: "Tag of the documents to find",
                                },
                                correspondent: {
                                    type: "string",
                                    description:
                                        "Correspondent of the documents to find",
                                },
                                created__date__gte: {
                                    type: "string",
                                    format: "date",
                                    description:
                                        "creation date greater than or equal to the specified date",
                                },
                                created__date__lte: {
                                    type: "string",
                                    format: "date",
                                    description:
                                        "creation date lesser than or equal to the specified date",
                                },
                                document_type: {
                                    type: "string",
                                    description: "Document type to search for",
                                },
                                limit: {
                                    type: "number",
                                    default: 10,
                                    description:
                                        "Maximum number of documents to return",
                                },
                            },
                            required: [],
                        },
                    },
                    {
                        name: "edit_documents",
                        description:
                            "edit documents or their Metadata like Tags, Correspondents in Paperless NGX.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                documentIds: {
                                    type: "array",
                                    items: { type: "number" },
                                    description: "IDs of the documents to edit",
                                },
                                method: {
                                    type: "string",
                                    enum: [
                                        "set_correspondent",
                                        "set_document_type",
                                        //'set_storage_path',
                                        //'add_tag',
                                        //'remove_tag',
                                        "modify_tags",
                                        //'delete',
                                        //'reprocess',
                                        //'merge',
                                        //'split',
                                        //'rotate',
                                        //'delete_pages'
                                    ],
                                    description:
                                        "Method to use for editing documents, available methods: set_correspondent, set_document_type, modify_tags",
                                },
                                correspondent_id: {
                                    type: "number",
                                    description:
                                        "ID of the correspondent to set",
                                },
                                document_type_id: {
                                    type: "number",
                                    description:
                                        "ID of the document type to set",
                                },
                                add_tags_ids: {
                                    type: "array",
                                    items: { type: "number" },
                                    description: "IDs of the tags to add",
                                },
                                remove_tags_ids: {
                                    type: "array",
                                    items: { type: "number" },
                                    description: "IDs of the tags to remove",
                                },
                            },
                            required: ["documentIds", "method"],
                        },
                    },
                ] as Tool[],
            };
        });

        // Handle tool calls
        this.server.setRequestHandler(
            CallToolRequestSchema,
            async (request: any) => {
                this.logger.info(`Tool called: ${request.params.name}`, {
                    arguments: request.params.arguments,
                });

                let args;
                switch (request.params.name) {
                    case "list_tags":
                        return await this.paperlessAPI.listTags();
                    case "list_correspondent":
                        return await this.paperlessAPI.listCorrespondents();
                    case "list_document_types":
                        return await this.paperlessAPI.listDocumentTypes();
                    case "get_document":
                        args = this.getDocumentSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.getDocumentAllParams(
                            args
                        );
                    case "edit_documents":
                        args = this.bulkEditSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.bulkEditDocuments(args);
                    default:
                        this.logger.error(
                            `Unknown tool: ${request.params.name}`
                        );
                        throw new Error(`Unknown tool: ${request.params.name}`);
                }
            }
        );
    }

    private setupMCPResources() {
        this.logger.info("MCP Resources setup initiated.");

        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            try {
                const documents = await this.paperlessAPI.getAllDocuments();
                this.logger.info(`Found ${documents.length} documents`);

                return {
                    resources: documents.map((doc) => ({
                        uri: `paperless://documents/${doc.id}`,
                        name: doc.title || `Document ${doc.id}`,
                        description: `Paperless NGX document: ${doc.title || `Document ${doc.id}`}`,
                        mimeType: "application/json",
                    })),
                };
            } catch (error) {
                this.logger.error("Error listing resources:", error);
                return { resources: [] };
            }
        });

        this.server.setRequestHandler(
            ReadResourceRequestSchema,
            async (request) => {
                this.logger.info(
                    `ReadResourceRequestSchema handler called for URI: ${request.params.uri}`
                );
                try {
                    const uri = request.params.uri;
                    const documentIdMatch = uri.match(
                        /paperless:\/\/documents\/(\d+)$/
                    );

                    if (!documentIdMatch) {
                        throw new Error(`Invalid document URI: ${uri}`);
                    }

                    const documentId = parseInt(documentIdMatch[1]);
                    const response =
                        await this.paperlessAPI.getDocumentAllParams({
                            id: documentId,
                            limit: 1, // muss eigentlich immer 1 zurück kommen auch ohne diese angabe weil ID eindeutig ist
                        });

                    return {
                        contents: [
                            {
                                uri,
                                mimeType: "application/json",
                                text: JSON.stringify(response.content),
                            },
                        ],
                    };
                } catch (error) {
                    this.logger.error("Error reading resource:", error);
                    throw new Error(
                        `Failed to read document: ${error.message}`
                    );
                }
            }
        );
    }

    async start() {
        this.logger.info("Testing Paperless connection...");

        // Test connections first
        const paperlessConnected = await testPaperlessConnection(
            this.paperlessAPI
        );

        if (!paperlessConnected) {
            this.logger.error(
                "Paperless NGX is not accessible - document features will not work"
            );
            process.exit(1);
        }

        this.logger.info("Starting MCP server transport...");
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info("MCP server connected successfully");
    }
}
