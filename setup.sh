#!/bin/bash

# Navigate to VSCode directory
cd "/Users/neo/VSCode/"

# Create the main project directory
mkdir -p "claude_todoist"
cd "claude_todoist"

# Create all subdirectories
mkdir -p src/{server,services,tools,types,utils,middleware}
mkdir -p {dist,tests/{unit,integration},docs,logs}

# Create all the main files
touch .env.example .env .gitignore package.json tsconfig.json README.md

# Create source files
touch src/index.ts
touch src/server/{mcp-server.ts,transport.ts}
touch src/services/{todoist.service.ts,base.service.ts}
touch src/tools/{tasks.tools.ts,projects.tools.ts,index.ts}
touch src/types/{todoist.types.ts,mcp.types.ts}
touch src/utils/{logger.ts,config.ts,validation.ts}
touch src/middleware/{auth.ts,error-handler.ts}
touch docs/{API.md,DEPLOYMENT.md}
touch tests/unit/.gitkeep tests/integration/.gitkeep

echo "✅ Project structure created at /Users/neo/VSCode/claude_todoist"
echo "📁 Current directory contents:"
ls -la

echo "🚀 Opening in VSCode..."
code "/Users/neo/VSCode/claude_todoist"