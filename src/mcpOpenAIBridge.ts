import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import {
    OllamaConfig,
    PaperlessDocument,
} from "./types.js";
import axios from "axios";
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

    /*
     * Analyze a specific document using Ollama
     */
    private async analyzeDocument(args: any) {
        try {
            const { documentId, question } = args;

            // First get the document content
            const documentContent = await this.paperlessAPI.getDocumentContent({
                documentId,
            });
            const content = documentContent.content[0].text;

            // Create a prompt for analysis
            const analysisPrompt = `Analyze the following document and answer the question.

Document Content:
${content}

Question: ${question}

Please provide a detailed answer based on the document content:`;

            // Use Ollama to analyze
            const analysis = await this.chatWithOllama({
                message: analysisPrompt,
            });

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                documentId: documentId,
                                question: question,
                                analysis: analysis.content[0].text,
                                contentPreview:
                                    content.substring(0, 300) + "...",
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Document analysis error: ${error.message}`);
        }
    }

    /*
     * Searches for documents in Paperless NGX and analyzes them to answer a question.
     * The search query is derived from the user's message and given to Paperless NGX to find matching documents.
     * Then, each document is analyzed using Ollama.
     */
    private async searchAndAnalyze(args: any) {
        try {
            const { query, question, limit = 5 } = args;

            // First search for relevant documents
            const searchResults = await this.paperlessAPI.searchDocuments({
                query,
                limit,
            });
            const searchData = JSON.parse(searchResults.content[0].text);

            if (searchData.documents.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(
                                {
                                    query,
                                    question,
                                    result: "No documents found matching the search query.",
                                    documents: [],
                                },
                                null,
                                2
                            ),
                        },
                    ],
                };
            }

            // Get full content for each document and analyze
            const analyses = [];
            for (const doc of searchData.documents) {
                try {
                    const docContent =
                        await this.paperlessAPI.getDocumentContent({
                            documentId: doc.id,
                        });
                    const content = docContent.content[0].text;

                    // Create analysis prompt
                    const analysisPrompt = `Based on the following document, answer the question: "${question}"

Document Title: ${doc.title}
Document Content:
${content}

Please provide a focused answer based on this document:`;

                    const analysis = await this.chatWithOllama({
                        message: analysisPrompt,
                    });

                    console.log("analysed Document");

                    analyses.push({
                        documentId: doc.id,
                        title: doc.title,
                        analysis: analysis.content[0].text,
                        relevanceScore: content
                            .toLowerCase()
                            .includes(query.toLowerCase())
                            ? "high"
                            : "medium",
                    });
                } catch (error) {
                    console.error(`Error analyzing document ${doc.id}:`, error);
                    analyses.push({
                        documentId: doc.id,
                        title: doc.title,
                        analysis: "Error analyzing this document",
                        relevanceScore: "unknown",
                    });
                }
            }

            // Create final summary
            const summaryPrompt = `Based on the following analyses from multiple documents, provide a comprehensive answer to the question: "${question}"

Search Query: ${query}

Document Analyses:
${analyses
    .map(
        (a) => `
Document: ${a.title}
Analysis: ${a.analysis}
`
    )
    .join("\n")}

Please provide a synthesized answer that combines insights from all relevant documents:`;

            const finalSummary = await this.chatWithOllama({
                message: summaryPrompt,
            });

            console.log("final summary now returning answer");

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                query,
                                question,
                                totalDocuments: searchData.total,
                                analyzedDocuments: analyses.length,
                                summary: finalSummary.content[0].text,
                                individualAnalyses: analyses,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Search and analyze error: ${error.message}`);
        }
    }

    public getDocumentSchema = z.object({
        documentId: z.number().describe("Document ID to search for"),
    }) as z.ZodType<{ documentId: number }>;

    public searchDocumentsSchema = z.object({
        query: z.string().describe("Search query to find documents"),
        limit: z
            .number()
            .optional()
            .default(10)
            .describe("Maximum number of documents to return"),
    }) as z.ZodType<{ query: string; limit?: number }>;

    private setupMCPHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "get_document",
                        description:
                            "Get detailed information about a specific document",
                        inputSchema: {
                            type: "object",
                            properties: {
                                documentId: {
                                    type: "number",
                                    description:
                                        "Id of the document to retrieve",
                                },
                            },
                            required: ["documentId"],
                        },
                    },
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
                    /*{
                        name: "get_document_content",
                        description:
                            "Get the full text content of a specific document",
                        inputSchema: {
                            type: "object",
                            properties: {
                                documentId: {
                                    type: "number",
                                    description:
                                        "ID of the document to get content from",
                                },
                            },
                            required: ["documentId"],
                        },
                    },
                    {
                        name: "analyze_document",
                        description:
                            "Analyze a specific document with Ollama and answer questions about it",
                        inputSchema: {
                            type: "object",
                            properties: {
                                documentId: {
                                    type: "number",
                                    description:
                                        "ID of the document to analyze",
                                },
                                question: {
                                    type: "string",
                                    description:
                                        "Question to ask about the document",
                                },
                            },
                            required: ["documentId", "question"],
                        },
                    },
                    {
                        name: "search_and_analyze",
                        description:
                            "Search for documents and analyze them to answer a question",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description:
                                        "Search query to find relevant documents",
                                },
                                question: {
                                    type: "string",
                                    description:
                                        "Question to answer based on the found documents",
                                },
                                limit: {
                                    type: "number",
                                    description:
                                        "Maximum number of documents to analyze (default: 5)",
                                    default: 5,
                                },
                            },
                            required: ["query", "question"],
                        },
                    },
                    {
                        name: "list_tags",
                        description: "List all available tags in Paperless NGX",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "get_documents_by_tag",
                        description: "Get documents that have a specific tag",
                        inputSchema: {
                            type: "object",
                            properties: {
                                tagName: {
                                    type: "string",
                                    description:
                                        "Name of the tag to search for",
                                },
                                limit: {
                                    type: "number",
                                    description:
                                        "Maximum number of documents to return (default: 10)",
                                    default: 10,
                                },
                            },
                            required: ["tagName"],
                        },
                    },*/
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
                    case "get_document":
                        console.log("get document");
                        args = this.getDocumentSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.getDocument(args);
                    case "search_documents":
                        console.log("search documents");
                        args = this.searchDocumentsSchema.parse(
                            request.params.arguments
                        );
                        return await this.paperlessAPI.searchDocuments(args);
                    /*case "get_document_content":
                        console.log("get document content");
                        return await this.paperlessAPI.getDocumentContent(
                            request.params.arguments
                        );
                    case "analyze_document":
                        console.log("analyze document");
                        return await this.analyzeDocument(
                            request.params.arguments
                        );
                    case "search_and_analyze":
                        console.log("search and analyze");
                        return await this.searchAndAnalyze(
                            request.params.arguments
                        );
                    case "list_tags":
                        console.log("list tags");
                        return await this.paperlessAPI.listTags(
                            request.params.arguments
                        );
                    case "get_documents_by_tag":
                        console.log("get documents by tag");
                        return await this.paperlessAPI.getDocumentsByTag(
                            request.params.arguments
                        );*/
                    default:
                        throw new Error(`Unknown tool: ${request.params.name}`);
                }
            }
        );
    }

    private async chatWithOllama(args: any) {
        try {
            const { message, model = this.ollamaConfig.model } = args;

            console.log("chat with ollama: ");

            const response = await axios.post(
                `${this.ollamaConfig.baseUrl}/api/generate`,
                {
                    model: model,
                    prompt: message,
                    stream: false,
                }
            );

            return {
                content: [
                    {
                        type: "text",
                        text: response.data.response,
                    },
                ],
            };
        } catch (error: any) {
            throw new Error(`Ollama API error: ${error.message}`);
        }
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
