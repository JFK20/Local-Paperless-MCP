import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { OllamaConfig, PaperlessDocument } from "./types.js";
import { PaperlessAPI } from "./paperlessAPI.js";
import { testPaperlessConnection } from "./startTests.js";
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const isDevMode = process.env.NODE_ENV === "development";
import z from "zod";

export class McpOpenAIBridge {
    private server: Server;
    private ollamaConfig: OllamaConfig;
    private paperlessAPI: PaperlessAPI;
    private port: number;

    constructor() {
        this.port = parseInt(process.env.BRIDGE_PORT || "3001");
        this.paperlessAPI = new PaperlessAPI();

        this.ollamaConfig = {
            baseUrl: process.env.OLLAMA_BASE_URL,
            model: process.env.OLLAMA_MODEL,
        };

        if (!this.ollamaConfig.baseUrl || !this.ollamaConfig.model) {
            throw new Error(
                "OLLAMA_BASE_URL and OLLAMA_MODEL environment variables must be set"
            );
        }

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

    public getDocumentsSchema = z.object({
        title: z.string().describe("title of the documents to find"),
        limit: z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of documents to return"),
    }) as z.ZodType<{ title: string; limit?: number }>;

    private setupMCPHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "get_documents",
                        description:
                            "find documents in Paperless NGX. IMPORTANT: You must provide a 'title' parameter.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                title: {
                                    type: "string",
                                    description:
                                        "title of the documents to find",
                                },
                                limit: {
                                    type: "number",
                                    description:
                                        "Maximum number of documents to return (default: 10)",
                                    default: 10,
                                },
                            },
                            required: ["title"],
                        },
                    },
                    {
                        name: "list_tags",
                        description: "List all tags in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
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
                let args;
                switch (request.params.name) {
                    case "get_documents":
                        console.log("get_documents");
                        args = this.getDocumentsSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.searchDocuments(args);
                    case "list_tags":
                        console.log("list_tags");
                        const tags = await this.paperlessAPI.listTags();
                        return tags;
                    default:
                        throw new Error(`Unknown tool: ${request.params.name}`);
                }
            }
        );
    }

    async start() {
        // Test connections first
        const paperlessConnected = await testPaperlessConnection(
            this.paperlessAPI
        );

        if (!paperlessConnected) {
            console.error(
                "Paperless NGX is not accessible - document features will not work"
            );
            process.exit(1);
        }
        console.log("Starting");
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
}
