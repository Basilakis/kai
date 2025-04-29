# Agent Prompts and Interaction Guide

This document provides guidance on how to effectively interact with KAI's agent system, including special commands that unlock advanced functionality.

## Introduction to Agent Interaction

KAI agents are specialized AI assistants designed to help with specific tasks. Each agent has expertise in a particular domain, such as material science, project planning, or image recognition. When communicating with agents, use natural language to express your needs and questions.

### Basic Interaction

Simply type your question or request, and the agent will respond with the most relevant and helpful information. For example:

```
What are the properties of porcelain tiles?
```

The agent will process your query using its knowledge base and respond with a detailed explanation.

## Commands

Commands are special instructions that trigger specific behaviors in the agent system. Commands always begin with a `/` prefix followed by the command name. Here is a reference of available commands:

### Hybrid Search Command

**Usage**: `/hybrid [search query]`

**Example**: `/hybrid white marble with gold veins`

**Description**: The hybrid search command initiates a specialized search process that combines traditional keyword-based search with vector similarity search for improved results. This is particularly useful for finding materials that are conceptually similar even when they don't share exact keywords.

**How Hybrid Search Works**:

When you use the `/hybrid` command, the system:

1. Performs a traditional text-based search using keywords and filters
2. Simultaneously performs a vector similarity search using embedding models
3. Combines the results with a weighted scoring system (40% text, 60% vector by default)
4. Returns materials that may not have been found with a single search method

#### Under the Hood: Embedding Technologies

The hybrid search leverages multiple embedding approaches:

1. **SBERT (Sentence-BERT)**
   - Currently implemented in our system
   - Uses the all-MiniLM-L6-v2 model for generating 384-dimensional embeddings
   - Offers a good balance between accuracy and performance
   - Excellent for capturing semantic relationships between terms

2. **Universal Sentence Encoder (USE)**
   - Can be integrated as an alternative embedding model
   - Lightweight and optimized for real-time applications
   - Provides strong cross-lingual capabilities
   - Particularly effective for multilingual queries

3. **OpenAI Embeddings**
   - Can be integrated for higher quality embeddings
   - Excellent for handling longer, more complex queries
   - Captures nuanced relationships between concepts
   - More computational resource intensive

The hybrid search implementation is designed with a modular architecture that allows for swapping or combining these embedding approaches:

```
# Embedding Generation Layer
Different embedding providers can be used to generate vector representations

# Storage Layer
Embeddings are stored in pgvector in PostgreSQL for efficient similarity search

# Search Layer
Combines traditional text search with vector similarity search
```

#### Benefits of Hybrid Search

- **Higher Quality Results**: Find materials that match your intent, not just your keywords
- **Semantic Understanding**: Captures conceptual similarities even with different terminology
- **Flexible Weighting**: Backend balances between text and vector search for optimal results
- **Multi-Modal Capabilities**: Works with text descriptions and can incorporate visual features

## Additional Agent Types

The command system can be extended to other agent types beyond the Material Expert. Each agent may support its own set of specialized commands relevant to its domain expertise.

## Best Practices

1. **Be Specific**: The more specific your query, the better the results
2. **Use Commands Deliberately**: Use the `/hybrid` command when you need to find conceptually similar materials, not just exact keyword matches
3. **Provide Context**: Including additional details helps the agent understand your needs
4. **Review and Refine**: If the initial results aren't what you expected, refine your query with more specific terms

## Technical Implementation

The hybrid search implementation combines multiple embedding approaches with traditional search:

1. **Direct API Integration**: Supports direct integration with embedding model APIs:
   ```python
   # OpenAI Embedding Example
   def get_openai_embedding(text):
       response = openai.Embedding.create(
           input=text,
           model="text-embedding-ada-002"
       )
       return response['data'][0]['embedding']
   
   # SBERT Example (Current Implementation)
   def get_sbert_embedding(text):
       model = SentenceTransformer('all-MiniLM-L6-v2')
       return model.encode(text)
   
   # Universal Sentence Encoder Example
   def get_use_embedding(text):
       use_model = hub.load("https://tfhub.dev/google/universal-sentence-encoder/4")
       return use_model([text]).numpy()[0]
   ```

2. **Database Integration with pgvector**:
   ```sql
   -- Combines vector and text search with weighted scoring
   CREATE OR REPLACE FUNCTION hybrid_search(
       query_text TEXT,
       query_embedding VECTOR(384),
       text_weight FLOAT DEFAULT 0.5,
       vector_weight FLOAT DEFAULT 0.5,
       match_count INT DEFAULT 10
   ) RETURNS TABLE (
       id UUID,
       similarity FLOAT,
       text_score FLOAT,
       vector_score FLOAT
   ) AS $$
       -- SQL implementation combining text and vector search
       -- With weighted scoring
   $$;
   ```

3. **Multi-Stage Search Pipeline**:
   ```python
   def hybrid_search(query, limit=10):
       # Stage 1: Fast recall with vector search
       embedding = embedding_model.encode(query)
       candidates = vector_db.search(embedding, limit=limit*3)
       
       # Stage 2: Re-rank with more precise methods
       documents = [retrieve_document(id) for id in candidates]
       reranked = text_reranker.rerank(query, documents)
       
       return reranked[:limit]
   ```

The agent system can dynamically adjust the weights between text and vector search based on the query characteristics and context, optimizing for the most relevant results.