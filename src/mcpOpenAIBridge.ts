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
const isDevMode = process.env.NODE_ENV === "development";
import z from "zod";

export class McpOpenAIBridge {
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
                },
            }
        );

        this.setupMCPHandlers();
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

                return (
                    hasId ||
                    hasContent ||
                    hasTitle ||
                    hasTag ||
                    hasCorrespondent ||
                    hasCreatedDateGte ||
                    hasCreatedDateLte
                );
            },
            {
                message:
                    "At least one parameter (id, content__icontains, title, tag, correspondent, created__date__gte, created__date__lte) must be provided",
            }
        );

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
                        const tags = await this.paperlessAPI.listTags();
                        return tags;
                    case "list_correspondent":
                        return await this.paperlessAPI.listCorrespondents();
                    case "get_document":
                        args = this.getDocumentSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.getDocumentAllParams(
                            args
                        );
                    default:
                        this.logger.error(
                            `Unknown tool: ${request.params.name}`
                        );
                        throw new Error(`Unknown tool: ${request.params.name}`);
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
