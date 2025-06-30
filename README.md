# Local Paperless MCP

A Model Context Protocol (MCP) Server that provides a bridge between Paperless-NGX and Open Web Ui. This project enables AI models to directly access and search documents in your Paperless-NGX installation.

## Features

- **Document Search**: Search your Paperless-NGX documents via MCP
- **Document Content**: Retrieve full content of documents
- **Docker Support**: Fully containerized for easy deployment

## Prerequisites

- Docker & Docker Compose
- Paperless-NGX installation
- Open WebUI

## Installation With Docker

### 1. Clone the repository:
```bash
git clone <repository-url>
cd Local-Paperless-MCP
```

### 2. Configure environment variables:
```bash
cp .env.dev .env
```

#### Configuration

edit the `.env` file for Docker with the following variables:

```env
# Server Configuration
BRIDGE_PORT=3001
NODE_ENV=development

# Paperless-NGX Configuration
PAPERLESS_BASE_URL=http://your-paperless-url:port
PAPERLESS_TOKEN=your-paperless-api-token
```

### 3. Start with Docker Compose:
```bash
docker-compose up --build
```



### Creating Paperless-NGX API Token

1. Log in to your Paperless-NGX installation
2. Go to Settings → API Tokens
3. Create a new token
4. Copy the token to your `docker.env` file

## Usage

### As MCP Server

The server provides the following MCP tools:

#### `get_documents`
Searches documents in Paperless-NGX based on title.

**Parameters:**
- `title` (required): Title of the documents to search for
- `limit` (optional): Maximum number of documents to return (default: 10)

**Example:**
```json
{
  "name": "get_documents",
  "arguments": {
    "title": "Invoice",
    "limit": 5
  }
}
```

### Integration with AI Models

This MCP server is tested and used with Open WebUI when deployed with mcpo.

### Project Structure

```
src/
├── index.ts             # Main entry point
├── mcpOpenAIBridge.ts   # MCP Server implementation
├── paperlessAPI.ts      # Paperless-NGX API client
├── types.ts             # TypeScript definitions
├── startTests.ts        # Connection tests
└── debugPoints.ts       # Debug helper functions
```
