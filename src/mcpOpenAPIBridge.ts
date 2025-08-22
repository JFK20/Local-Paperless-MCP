import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { PaperlessAPI } from "./paperlessAPI.js";
import { testPaperlessConnection } from "./startTests.js";
import { Logger } from "./logger.js";
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import { CachedMetadata } from "./cachedMetadata.js";

export class McpOpenAPIBridge {
    private server: Server;
    private paperlessAPI: PaperlessAPI;
    private logger: Logger;
    private cachedMetadata: CachedMetadata;

    constructor() {
        this.paperlessAPI = new PaperlessAPI();
        this.logger = Logger.getInstance();
        this.cachedMetadata = CachedMetadata.getInstance();

        this.server = new Server(
            {
                name: "paperless-ollama-mcp",
                version: "0.0.1",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupMCPHandlers();
    }

    public listDocumentSchemas = z.object({
        limit: z
            .int()
            .min(1)
            .optional()
            .describe("Maximum number of documents to return"),
    });

    public getDocumentSchema = z
        .object({
            id: z
                .int()
                .min(1)
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
            .array(z.string().min(1))
            .describe("IDs of the documents to edit"),
        method: z.enum([
            "set_correspondent",
            "set_document_type",
            "modify_tags",
            "delete",
        ]).describe("The bulk edit method to apply. Available options: set_correspondent (change document correspondent), set_document_type (change document type), modify_tags (add/remove tags), delete (delete documents)"),
        correspondent: z
            .string()
            .optional()
            .describe("Name of the correspondent (required when method is 'set_correspondent')"),
        document_type: z
            .string()
            .optional()
            .describe("Name of the Document type (required when method is 'set_document_type')"),
        add_tags: z
            .array(z.string())
            .optional()
            .describe("Names of the tags to add (used with 'modify_tags' method) always formatted as a list of strings"),
        remove_tags: z
            .array(z.string())
            .optional()
            .describe("Names of the tags to remove (used with 'modify_tags' method) always formatted as a list of strings"),
    }).refine(
        (data) => {
            if (data.method === "set_correspondent" && !data.correspondent) {
                return false;
            }
            if (data.method === "set_document_type" && !data.document_type) {
                return false;
            }
            if (data.method === "modify_tags" && !data.add_tags && !data.remove_tags) {
                return false;
            }
            return true;
        },
        {
            message: "Required parameters missing for the selected method"
        }
    );

    public createCorrespondentSchema = z.object({
        name: z.string().describe("Name of the correspondent"),
    });

    public createDocumentTypeSchema = z.object({
        name: z.string().describe("Name of the document type"),
    });

    public createTagSchema = z.object({
        name: z.string().describe("Name of the tag"),
        color: z
            .string()
            .max(7)
            .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
            .optional()
            .describe("Color of the tag in hex format (e.g., #FF5733)"),
    });

    private setupMCPHandlers() {
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
                        annotations: {
                            title: "List tags",
                            readOnlyHint: true,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "list_correspondents",
                        description:
                            "Lists all correspondents in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                        annotations: {
                            title: "List correspondents",
                            readOnlyHint: true,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "list_document_types",
                        description:
                            "Lists all document types in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                        annotations: {
                            title: "List document types",
                            readOnlyHint: true,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "list_documents",
                        description: "Lists documents in Paperless NGX.",
                        inputSchema: z.toJSONSchema(this.listDocumentSchemas),
                        annotations: {
                            title: "List Documents",
                            readOnlyHint: true,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "get_documents",
                        description: "Gets documents from Paperless NGX.",
                        inputSchema: z.toJSONSchema(this.getDocumentSchema),
                        annotations: {
                            title: "get Documents",
                            readOnlyHint: true,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "edit_documents",
                        description:
                            "Bulk edit documents in Paperless NGX. Supported methods: 'set_correspondent', 'set_document_type', 'modify_tags', 'delete'. Use 'set_correspondent' to change the correspondent, 'set_document_type' to change document type, 'modify_tags' to add/remove tags, or 'delete' to remove documents.",
                        inputSchema: z.toJSONSchema(this.bulkEditSchema),
                        annotations: {
                            title: "Edit Documents",
                            readOnlyHint: false,
                            destructiveHint: true,
                            idempotentHint: true,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "create_correspondent",
                        description:
                            "Creates a new correspondent in Paperless NGX.",
                        inputSchema: z.toJSONSchema(
                            this.createCorrespondentSchema
                        ),
                        annotations: {
                            title: "Create Correspondent",
                            readOnlyHint: false,
                            destructiveHint: false,
                            idempotentHint: false,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "create_document_type",
                        description:
                            "Creates a new document type in Paperless NGX.",
                        inputSchema: z.toJSONSchema(
                            this.createDocumentTypeSchema
                        ),
                        annotations: {
                            title: "Create Document Type",
                            readOnlyHint: false,
                            destructiveHint: false,
                            idempotentHint: false,
                            openWorldHint: true,
                        },
                    },
                    {
                        name: "create_tag",
                        description: "Creates a new tag in Paperless NGX.",
                        inputSchema: z.toJSONSchema(this.createTagSchema),
                        annotations: {
                            title: "Create Tag",
                            readOnlyHint: false,
                            destructiveHint: false,
                            idempotentHint: false,
                            openWorldHint: true,
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
                let result;
                switch (request.params.name) {
                    case "list_tags":
                        await this.cachedMetadata.refreshTags(
                            this.paperlessAPI
                        );
                        return await this.paperlessAPI.listTags();
                    case "list_correspondents":
                        await this.cachedMetadata.refreshCorrespondents(
                            this.paperlessAPI
                        );
                        return await this.paperlessAPI.listCorrespondents();
                    case "list_document_types":
                        await this.cachedMetadata.refreshDocumentTypes(
                            this.paperlessAPI
                        );
                        return await this.paperlessAPI.listDocumentTypes();
                    case "list_documents":
                        args = this.listDocumentSchemas.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.listDocuments(args);
                    case "get_documents":
                        args = this.getDocumentSchema.parse(
                            request.params.arguments
                        );
                        this.logger.debug(
                            "Parsed arguments for get_documents",
                            args
                        );
                        return await this.paperlessAPI.getDocumentAllParams(
                            args
                        );
                    case "edit_documents":
                        args = this.bulkEditSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.bulkEditDocuments(args);
                    case "create_correspondent":
                        args = this.createCorrespondentSchema.parse(
                            request.params.arguments
                        );
                        result =
                            await this.paperlessAPI.createCorrespondent(args);
                        await this.cachedMetadata.refreshCorrespondents(
                            this.paperlessAPI
                        );
                        return result;
                    case "create_document_type":
                        args = this.createDocumentTypeSchema.parse(
                            request.params.arguments
                        );
                        result =
                            await this.paperlessAPI.createDocumentType(args);
                        await this.cachedMetadata.refreshDocumentTypes(
                            this.paperlessAPI
                        );
                        return result;
                    case "create_tag":
                        args = this.createTagSchema.parse(
                            request.params.arguments
                        );
                        result = await this.paperlessAPI.createTag(args);
                        await this.cachedMetadata.refreshTags(
                            this.paperlessAPI
                        );
                        return result;
                    default:
                        this.logger.error(
                            `Unknown tool: ${request.params.name}`
                        );
                        return {
                            jsonrpc: "2.0",
                            error: {
                                code: -32602,
                                message: "Unknown tool: invalid_tool_name",
                            },
                        };
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

        if (paperlessConnected) {
            this.logger.info("Paperless connection started");

            // Initialize cached metadata
            this.logger.info("Initializing cached metadata...");
            await this.cachedMetadata.initialize(this.paperlessAPI);
        }

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
