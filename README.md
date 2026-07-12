# AI Investment Research Agent

**🔴 Live Demo:** [https://research-agent-psi.vercel.app/](https://research-agent-psi.vercel.app/)


## Overview
The AI Investment Research Agent is a full-stack web application that allows users to research publicly traded companies and generate comprehensive, AI-driven financial reports. It leverages a LangChain agent powered by Google Gemini to analyze financial data sourced from various APIs, providing actionable insights and generating a downloadable PDF report for the user.

## How to run it

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL Database
- Package manager (npm)

### Environment Variables
You need to set up environment variables for both the backend and frontend.

**Backend (`backend/.env`):**
```env
PORT=5000
DATABASE_URL="your_postgresql_database_url"
JWT_SECRET="your_secure_jwt_secret"
GEMINI_API_KEY="your_google_gemini_api_key"
# Add any other keys if used (e.g., TAVILY_API_KEY for search)
```

**Frontend (`frontend/.env`):**
```env
VITE_API_URL="http://localhost:5000" # Use your deployed backend URL in production
```

### Setup and Run Steps

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "Research agent"
   ```

2. **Setup Backend:**
   ```bash
   cd backend
   npm install
   npx prisma generate
   # Push schema to database
   npx prisma db push
   # Start the server
   node server.js
   ```

3. **Setup Frontend:**
   Open a new terminal and navigate to the frontend folder.
   ```bash
   cd frontend
   npm install
   # Start the development server
   npm run dev
   ```

## How it works (Approach & Architecture)
The architecture is divided into a Node.js/Express backend and a React/Vite frontend. 

- **Agentic Core**: The backend uses LangChain and the `@langchain/google-genai` model to instantiate an agent. The agent is provided with dynamic tools to fetch real-time financial data (e.g., Yahoo Finance).
- **Database**: PostgreSQL (via Prisma ORM) is used to store user accounts, authentication data, and the history of generated reports.
- **Frontend**: Built with React and Vite, it provides a clean interface for users to authenticate, input stock tickers, view research progress, and download PDF reports.
- **PDF Generation**: Handled on the backend using `PDFKit` to format the agent's markdown/text output into a professional, structured document.

## Key decisions & trade-offs
- **Model Choice (Google Gemini 2.5 Flash)**: Chosen for its blazing fast inference speed and cost-effectiveness while maintaining strong reasoning capabilities for financial analysis.
- **LangChain framework**: Used for its robust tool-calling abstractions, making it easier to scale the agent's capabilities in the future.
- **Prisma & PostgreSQL**: Selected for strong type safety and relational data modeling. We used the `@prisma/adapter-pg` for better compatibility and performance.
- **Trade-offs**: 
  - Opted for a synchronous REST API approach for simplicity. A WebSocket connection might provide better real-time streaming of the agent's thought process but would increase complexity.
  - PDF generation is done on the server rather than the client to ensure consistent, reliable formatting across all devices, even though this slightly increases server load.

## Example runs
*Note: Here is an example of what the agent outputs. You can test it out with your own tickers!*

- **Company: AAPL (Apple Inc.)**
  - **Output Summary**: The agent successfully fetched recent earnings data, summarized the key growth drivers (like Services revenue), and highlighted risks regarding smartphone market saturation in a structured PDF report.
- **Company: TSLA (Tesla Inc.)**
  - **Output Summary**: The agent analyzed recent vehicle delivery numbers and EV market competition, providing a balanced bull/bear case and generating a cohesive investment summary.

## What I would improve with more time
- **Real-time streaming (WebSockets)**: Implement WebSockets to stream the agent's thinking process and partial responses to the frontend in real-time.
- **More Financial Tools**: Add integrations for SEC EDGAR filings, sentiment analysis on recent news, and insider trading data.
- **Caching Layer**: Implement Redis to cache financial data requests (like stock prices) to reduce API latency and costs.
- **Containerization**: Add Dockerfiles and a `docker-compose.yml` for easier local development and one-click deployments.

## BONUS: LLM Chat Transcript
This project was built with the assistance of an advanced AI coding agent. The complete LLM chat transcripts—documenting the thought process, debugging steps (like fixing Render deployment ERESOLVE errors and updating API endpoints), and architectural decisions—are included to provide insight into the development process. 

*(Please find the transcript logs attached/uploaded alongside this project repository)*
