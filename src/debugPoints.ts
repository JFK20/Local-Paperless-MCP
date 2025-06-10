import express from "express";
import axios from "axios";
import { OllamaConfig } from "./types.js";
import { PaperlessAPI } from "./paperlessAPI.js";

export function setupDebugEndpoints(
    app: express.Application,
    ollamaConfig: OllamaConfig,
    paperlessAPI: PaperlessAPI
) {
    app.get("/debug/ollama", async (req, res) => {
        try {
            const modelsResponse = await axios.get(
                `${ollamaConfig.baseUrl}/api/tags`
            );
            res.json({
                status: "connected",
                baseUrl: ollamaConfig.baseUrl,
                configuredModel: ollamaConfig.model,
                availableModels: modelsResponse.data.models || [],
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: "error",
                baseUrl: ollamaConfig.baseUrl,
                configuredModel: ollamaConfig.model,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    });

    app.get("/debug/paperless", async (req, res) => {
        try {
            const headers = paperlessAPI.getPaperlessHeaders();
            const statusResponse = await axios.get(
                `${paperlessAPI.paperlessConfig.baseUrl}/api/`,
                { headers }
            );
            res.json({
                status: "connected",
                baseUrl: paperlessAPI.paperlessConfig.baseUrl,
                version: statusResponse.data,
                authMethod: paperlessAPI.paperlessConfig.token
                    ? "token"
                    : "username/password",
                timestamp: new Date().toISOString(),
            });
        } catch (error: any) {
            res.status(500).json({
                status: "error",
                baseUrl: paperlessAPI.paperlessConfig.baseUrl,
                error: error.message,
                authMethod: paperlessAPI.paperlessConfig.token
                    ? "token"
                    : "username/password",
                timestamp: new Date().toISOString(),
            });
        }
    });
}
