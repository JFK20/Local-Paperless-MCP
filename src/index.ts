import { McpOpenAIBridge } from "./mcpOpenAIBridge";
import { Logger } from "./logger";
import "dotenv/config";

const logger = Logger.getInstance();

// Start the bridge
logger.info("Starting MCP OpenAI Bridge...");
const bridge = new McpOpenAIBridge();
bridge.start().catch((error) => {
    logger.error("Failed to start bridge", error);
    process.exit(1);
});
