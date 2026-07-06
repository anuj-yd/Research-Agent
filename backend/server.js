const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { ChatOpenAI } = require('@langchain/openai');
const { StructuredOutputParser } = require('langchain/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');
const { z } = require('zod');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Dummy LangChain Setup Example
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    score: z.number().describe("Investment score out of 100"),
    swot: z.object({
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      opportunities: z.array(z.string()),
      threats: z.array(z.string())
    })
  })
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Example route calling LangChain
app.post('/api/analyze', async (req, res) => {
  try {
    const { query } = req.body;
    
    // NOTE: This will fail until OPENAI_API_KEY is configured in .env
    const model = new ChatOpenAI({ 
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo' 
    });

    const formatInstructions = parser.getFormatInstructions();
    const prompt = new PromptTemplate({
      template: "Analyze the investment potential of {query}.\n{format_instructions}",
      inputVariables: ["query"],
      partialVariables: { format_instructions: formatInstructions },
    });

    const input = await prompt.format({ query: query || "Apple Inc." });
    const response = await model.invoke(input);
    const structuredResponse = await parser.parse(response.content);

    res.json(structuredResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to analyze investment' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
