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

    public searchDocumentsSchema = z.object({
        query: z.string().describe("Search query to find documents"),
        limit: z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of documents to return"),
    }) as z.ZodType<{ query: string; limit?: number }>;

    public getDocumentContentSchema = z.object({
        documentId: z.number().optional().describe("ID of the document to get content from"),
        documentTitle: z.string().optional().describe("Title of the document to get content from"),
    }).refine(data => data.documentId !== undefined || data.documentTitle !== undefined, {
        message: "Either documentId or documentTitle must be provided"
    });

    private setupMCPHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "search_documents",
                        description: "Search for documents in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description:
                                        "Search query to find documents",
                                },
                                limit: {
                                    type: "number",
                                    description:
                                        "Maximum number of documents to return (default: 10)",
                                    default: 10,
                                },
                            },
                            required: ["query"],
                        },
                    },
                ] as Tool[],
            };
        });

        //Helper Function to Format a Document
        function formatDocument(doc: PaperlessDocument) {
            return `Title: ${doc.title} ID: ${doc.id} \n  Content: ${doc.content.substring(0, 300)}... \n  Tags: ${doc.tags.join(", ")} \n  Correspondent: ${doc.correspondent || "N/A"} \n`;
        }

        // Handle tool calls
        this.server.setRequestHandler(
            CallToolRequestSchema,
            async (request: any) => {
                let args;
                switch (request.params.name) {
                    case "search_documents":
                        console.log("search documents");
                        args = this.searchDocumentsSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.searchDocuments(args);
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
