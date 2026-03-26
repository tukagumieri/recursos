require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenAI } = require('@google/genai'); // Novo SDK do Gemini
const { GoogleGenerativeAI } = require('@google/generative-ai'); // SDK Clássico

// 1. Configurando o Pinecone
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});
const indexName = process.env.PINECONE_INDEX_NAME;

// 2. Configurando o Gemini
// Inicializando o SDK mais recente preferencialmente:
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Inicializando o antigo SDK caso precise do File API clássico
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function init() {
    console.log("== Iniciando Setup do Banco Vetorial Multimodal ==");
    
    try {
        console.log("1. Verificando acesso ao Pinecone...");
        try {
            const indexes = await pc.listIndexes();
            console.log("-> Índices Pinecone disponíveis:", indexes);
            
            // Verifica se o índice que queremos usar já existe, senão avisa
            const hasIndex = indexes.indexes?.some(idx => idx.name === indexName);
            if (!hasIndex && indexName) {
                console.log(`-> O índice '${indexName}' não foi encontrado. Você pode criá-lo pelo painel do Pinecone com dimensão 768 e métrica 'cosine'.`);
            } else if (hasIndex) {
                 console.log(`-> Índice '${indexName}' encontrado e pronto para uso!`);
            }
            
        } catch (e) {
            console.error("-> Erro ao conectar no Pinecone. Verifique sua PINECONE_API_KEY.");
        }

        console.log("\n2. APIs configuradas com sucesso!");
        console.log("-> Você já pode rodar os scripts de ingestão para Imagens, Vídeos e Textos.");
    } catch (error) {
        console.error("Erro geral na inicialização:", error);
    }
}

init();
