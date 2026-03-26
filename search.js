require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializa clientes
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function searchDB(queryText, topK = 3) {
    if (queryText === "Exemplo de busca geral" && process.argv.length <= 2) {
        console.log("\n⚠️ Use o script passando sua pesquisa:");
        console.log("Exemplo: node search.js Onde está o cachorro vermelho?");
        console.log("------------------------------------------");
    }

    const index = pc.index(indexName);
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    try {
        console.log(`Buscando por: "${queryText}"...`);
        
        // 1. Converter pergunta numa representação vetorial (Embedding)
        const resultEmbed = await embeddingModel.embedContent(queryText);
        const queryVector = resultEmbed.embedding.values;

        // 2. Realizar Busca de Similaridade Cosine no Pinecone
        const queryResponse = await index.query({
            vector: queryVector,
            topK: topK,
            includeMetadata: true
        });

        // 3. Exibir Resultados Encontrados
        console.log(`\n=== 🔎 ENCONTRAMOS ${queryResponse.matches.length} RESULTADOS MAIS RELEVANTES ===\n`);
        queryResponse.matches.forEach((match, idx) => {
            const score = (match.score * 100).toFixed(2);
            const m = match.metadata;
            
            console.log(`[#${idx+1}] Similaridade: ${score}% | Tipo: ${m.type.toUpperCase()}`);
            console.log(`👉 Arquivo: ${m.filename}`);
            
            if (m.type === 'document') {
                console.log(`📝 Trecho do Texto:\n"${m.text.substring(0, 300)}..."\n`);
            } else {
                console.log(`👁️  Descrição Visual:\n"${m.description.substring(0, 300)}..."\n`);
            }
        });
        
        console.log("Fim da busca.");

    } catch (err) {
        console.error("Erro durante a busca:", err.message);
    }
}

const queryInfo = process.argv.slice(2).join(' ') || "Exemplo de busca geral";
searchDB(queryInfo).catch(console.error);
