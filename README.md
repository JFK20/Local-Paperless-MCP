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

# Paperless-NGX Configuration
PAPERLESS_BASE_URL=http://your-paperless-url:port
PAPERLESS_TOKEN=your-paperless-api-token

# MCPO Configuration
MCPO_API_KEY=your-secret-key

# Logging Configuration
LOGGER_LEVEL=1
```

### 3. Start with Docker Compose:
```bash
docker-compose up --build
```

## Logging Configuration

Supports different logging levels controlled by the `LOGGER_LEVEL` environment variable:

- **0**: No logging (except errors which are always shown)
- **1**: INFO level and above (default) - Shows general information and errors
- **2**: DEBUG level and above - Shows detailed debugging information, INFO messages, and errors

Log levels work hierarchically — setting level 2 will show DEBUG, INFO, and ERROR messages, while level 1 shows only INFO and ERROR messages.

### Creating Paperless-NGX API Token

1. Log in to your Paperless-NGX installation
2. Go to Settings → API Tokens
3. Create a new token
4. Copy the token to your `docker.env` file

## Usage

### As MCP Server

The server provides the following MCP tools:

#### Available Tools

- **`list_tags`** - Lists all tags in Paperless NGX
- **`list_correspondents`** - Lists all correspondents in Paperless NGX  
- **`list_document_types`** - Lists all document types in Paperless NGX
- **`get_documents`** - Gets documents from Paperless NGX with various search filters
- **`edit_documents`** - Edit documents or their metadata like tags, correspondents in Paperless NGX
- **`create_correspondent`** - Creates a new correspondent in Paperless NGX
- **`create_document_type`** - Creates a new document type in Paperless NGX
- **`create_tag`** - Creates a new tag in Paperless NGX

### Integration with AI Models

This MCP server is tested and used with Open WebUI when deployed with mcpo.

### Project Structure

```
src/
├── index.ts             # Main entry point
├── mcpOpenAPIBridge.ts   # MCP Server implementation
├── paperlessAPI.ts      # Paperless-NGX API client
├── own_types.d.ts       # TypeScript definitions
├── startTests.ts        # Connection tests
└── debugPoints.ts       # Debug helper functions
```
