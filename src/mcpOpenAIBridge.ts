import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { OllamaConfig, OpenAIChatRequest, OpenAIMessage } from "./types.js";
import axios from "axios";
import cors from "cors";
import { PaperlessAPI } from "./paperlessAPI.js";
import { testOllamaConnection, testPaperlessConnection } from "./startTests.js";
import "dotenv/config";
const isDevMode = process.env.NODE_ENV === "development";

export class McpOpenAIBridge {
    private app: express.Application;
    private server: Server;
    private ollamaConfig: OllamaConfig;
    private paperlessAPI: PaperlessAPI;
    private port: number;

    constructor() {
        this.app = express();
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

        this.setupExpress();
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

    private setupExpress() {
        this.app.use(cors());
        this.app.use(express.json());

        // OpenAI-compatible models endpoint
        this.app.get("/v1/models", (req, res) => {
            res.json({
                object: "list",
                data: [
                    {
                        id: "paperless-ollama-mcp",
                        object: "model",
                        created: Date.now(),
                        owned_by: "mcp-server",
                        permission: [],
                        root: "paperless-ollama-mcp",
                        parent: null,
                    },
                ],
            });
        });

        // OpenAI-compatible chat completions endpoint
        this.app.post("/v1/chat/completions", async (req, res) => {
            try {
                console.log("chat completion request");

                const chatRequest: OpenAIChatRequest = req.body;

                if (chatRequest.stream) {
                    // Handle streaming response
                    res.setHeader("Content-Type", "text/event-stream");
                    res.setHeader("Cache-Control", "no-cache");
                    res.setHeader("Connection", "keep-alive");

                    res.write("set headers");

                    const response =
                        await this.handleStreamingChat(chatRequest);

                    // Send streaming response
                    const chunks = this.createStreamingChunks(response);
                    for (const chunk of chunks) {
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    }
                    console.log("streaming response sent");
                    res.write("data: [DONE]\n\n");
                    res.end();
                } else {
                    // Handle non-streaming response
                    const response = await this.handleChat(chatRequest);
                    res.json(response);
                }
            } catch (error: any) {
                console.error("Chat completion error:", error);
                res.status(500).json({
                    error: {
                        message: error.message,
                        type: "internal_error",
                        code: "server_error",
                    },
                });
            }
        });

        // Health check endpoint
        this.app.get("/health", (req, res) => {
            res.json({
                status: "healthy",
                timestamp: new Date().toISOString(),
            });
        });

        // Add debug endpoints only in development mode
        if (isDevMode) {
            import("./debugPoints.js")
                .then((module) => {
                    module.setupDebugEndpoints(
                        this.app,
                        this.ollamaConfig,
                        this.paperlessAPI
                    );
                    console.log("Debug endpoints loaded in development mode");
                })
                .catch((err) => {
                    console.error("Failed to load debug endpoints:", err);
                });
        }
    }

    private setupMCPHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "chat_with_ollama",
                        description: "Send a message to Ollama model",
                        inputSchema: {
                            type: "object",
                            properties: {
                                message: {
                                    type: "string",
                                    description: "Message to send to the model",
                                },
                                model: {
                                    type: "string",
                                    description:
                                        "Ollama model to use (optional)",
                                    default: this.ollamaConfig.model,
                                },
                            },
                            required: ["message"],
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
                                        "ID of the document to retrieve",
                                },
                            },
                            required: ["documentId"],
                        },
                    },
                    {
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
                    },
                ] as Tool[],
            };
        });

        // Handle tool calls
        this.server.setRequestHandler(
            CallToolRequestSchema,
            async (request: any) => {
                switch (request.params.name) {
                    case "chat_with_ollama":
                        console.log("normal chat with ollama");
                        return await this.chatWithOllama(
                            request.params.arguments
                        );
                    case "search_documents":
                        console.log("search documents");
                        return await this.paperlessAPI.searchDocuments(
                            request.params.arguments
                        );
                    case "get_document":
                        console.log("get document");
                        return await this.paperlessAPI.getDocument(
                            request.params.arguments
                        );
                    case "get_document_content":
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
                        );
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

    private shouldSearchDocuments(message: string): {
        search: boolean;
        query?: string;
    } {
        console.log("should search documents y/n?");
        const searchTriggers = [
            "search for",
            "find documents",
            "look for",
            "documents about",
            "papers about",
            "files containing",
            "search documents",
            "find files",
            "document search",
            "paperless",
            "invoice",
            "receipt",
            "contract",
            "tax",
            "financial",
            "report",
            "paperless",
        ];

        const hasSearchTrigger = searchTriggers.some((trigger) =>
            message.includes(trigger)
        );

        console.log("has search trigger: ", hasSearchTrigger);

        return { search: hasSearchTrigger };
    }

    private extractSearchQuery(message: string): string {
        // Extract search terms from common patterns
        const patterns = [
            /search for (.+?)(?:\s+and|$)/i,
            /find documents?.*?about (.+?)(?:\s+and|$)/i,
            /look for (.+?)(?:\s+and|$)/i,
            /look for (.+?)(?:\s+and|$)/i,
            /documents?.*?containing (.+?)(?:\s+and|$)/i,
            /(invoice|receipt|contract|tax|financial|report)s?/i,
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }

        // Fallback: extract keywords
        const words = message
            .split(" ")
            .filter(
                (word) =>
                    word.length > 3 &&
                    !["search", "find", "documents", "about"].includes(
                        word.toLowerCase()
                    )
            );

        return words.slice(0, 3).join(" ") || "documents";
    }

    private extractQuestion(message: string): string | null {
        // Look for question patterns
        const questionPatterns = [
            /what (.+?)\?/i,
            /how (.+?)\?/i,
            /when (.+?)\?/i,
            /where (.+?)\?/i,
            /who (.+?)\?/i,
            /why (.+?)\?/i,
            /which (.+?)\?/i,
        ];

        for (const pattern of questionPatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[0];
            }
        }

        return null;
    }

    private async handleChat(chatRequest: OpenAIChatRequest) {
        // Convert OpenAI messages to a single prompt
        const prompt = this.convertMessagesToPrompt(chatRequest.messages);
        const lastMessage =
            chatRequest.messages[
                chatRequest.messages.length - 1
            ].content.toLowerCase();

        const needsSearch = this.shouldSearchDocuments(lastMessage);
        let responseText: string;

        if (needsSearch.search) {
            console.log("searching documents");
            // Extract search query and question from the message
            const query = this.extractSearchQuery(lastMessage);
            const question = this.extractQuestion(lastMessage) || lastMessage;

            console.log("query: ", query);
            console.log("question: ", question);

            try {
                const searchResponse = await this.searchAndAnalyze({
                    query: query,
                    question: question,
                    limit: 5,
                });

                const searchData = JSON.parse(searchResponse.content[0].text);

                responseText =
                    searchData.summary || "No relevant documents found.";
            } catch (error) {
                console.error("Document search failed:", error);
                responseText =
                    "I encountered an error searching documents. Let me try to help with general information instead.";

                // Fallback to regular Ollama chat
                const mcpResponse = await this.chatWithOllama({
                    message: prompt,
                });
                responseText = mcpResponse.content[0].text;
            }
        } else {
            // Regular chat without document search
            const mcpResponse = await this.chatWithOllama({ message: prompt });
            responseText = mcpResponse.content[0].text;
        }

        // Return OpenAI-compatible response
        return {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: chatRequest.model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: responseText,
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: Math.ceil(prompt.length / 4), // Rough estimate
                completion_tokens: Math.ceil(responseText.length / 4),
                total_tokens: Math.ceil(
                    (prompt.length + responseText.length) / 4
                ),
            },
        };
    }

    private async handleStreamingChat(chatRequest: OpenAIChatRequest) {
        // For now, we'll simulate streaming by calling the regular API
        // and breaking the response into chunks
        const response = await this.handleChat(chatRequest);
        return response.choices[0].message.content;
    }

    private createStreamingChunks(text: string) {
        const words = text.split(" ");
        const chunks = [];

        for (let i = 0; i < words.length; i++) {
            chunks.push({
                id: `chatcmpl-${Date.now()}-${i}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: "paperless-ollama-mcp",
                choices: [
                    {
                        index: 0,
                        delta: {
                            content: (i === 0 ? "" : " ") + words[i],
                        },
                        finish_reason: null,
                    },
                ],
            });
        }

        // Final chunk
        chunks.push({
            id: `chatcmpl-${Date.now()}-final`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "paperless-ollama-mcp",
            choices: [
                {
                    index: 0,
                    delta: {},
                    finish_reason: "stop",
                },
            ],
        });

        return chunks;
    }

    private convertMessagesToPrompt(messages: OpenAIMessage[]): string {
        return (
            messages
                .map((msg) => {
                    if (msg.role === "system") {
                        return `System: ${msg.content}`;
                    } else if (msg.role === "user") {
                        return `Human: ${msg.content}`;
                    } else {
                        return `Assistant: ${msg.content}`;
                    }
                })
                .join("\n\n") + "\n\nAssistant:"
        );
    }

    async start() {
        // Test connections first
        const ollamaConnected = await testOllamaConnection(this.ollamaConfig);
        const paperlessConnected = await testPaperlessConnection(
            this.paperlessAPI
        );

        if (!ollamaConnected) {
            console.error("Cannot start server: Ollama is not accessible");
            process.exit(1);
        }

        if (!paperlessConnected) {
            console.error(
                "Paperless NGX is not accessible - document features will not work"
            );
            process.exit(1);
        }

        // Start Express server
        this.app.listen(this.port, () => {
            console.log(
                `OpenAI-compatible MCP Bridge running on port ${this.port}`
            );
            console.log(`Base URL: http://localhost:${this.port}`);
            console.log(
                `OpenAI API endpoint: http://localhost:${this.port}/v1`
            );
            console.log(`Health: http://localhost:${this.port}/health`);
            if (isDevMode) {
                console.log(`Debug endpoints:`);
                console.log(
                    `   - Ollama: http://localhost:${this.port}/debug/ollama`
                );
                console.log(
                    `   - Paperless: http://localhost:${this.port}/debug/paperless`
                );
            }
        });
    }
}
