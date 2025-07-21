import { McpOpenAPIBridge } from "./mcpOpenAPIBridge.js";
import { Logger } from "./logger.js";
import "dotenv/config";

const logger = Logger.getInstance();

// Start the bridge
logger.info("Starting MCP OpenAI Bridge...");
const bridge = new McpOpenAPIBridge();
bridge.start().catch((error) => {
    logger.error("Failed to start bridge", error);
    process.exit(1);
});
