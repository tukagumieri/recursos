require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

// Inicializa clientes
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Função de espera para polling do vídeo
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processVideos() {
    const videosDir = path.join(__dirname, 'videos');
    if (!fs.existsSync(videosDir)) {
        console.log("Pasta 'videos' não encontrada. Criando...");
        fs.mkdirSync(videosDir);
        console.log("Coloque seus vídeos (.mp4) na pasta 'videos' e rode o script novamente.");
        return;
    }

    const files = fs.readdirSync(videosDir).filter(f => f.match(/\.(mp4|mov|avi)$/i));
    if (files.length === 0) {
        console.log("Nenhum vídeo encontrado na pasta 'videos'.");
        return;
    }

    const index = pc.index(indexName);
    const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Pro é melhor para vídeos
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    for (const file of files) {
        console.log(`Processando vídeo: ${file}`);
        const safeId = file.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_\-]/g, "_");
        const filePath = path.join(videosDir, file);
        let mimeType = 'video/mp4'; // Assume mp4 por padrão

        try {
            // 1. Fazer upload do vídeo pelo File API do Gemini
            console.log(`- Fazendo upload pro Gemini File API...`);
            const uploadResponse = await fileManager.uploadFile(filePath, {
                mimeType: mimeType,
                displayName: file,
            });
            const fileUri = uploadResponse.file.uri;
            const fileNameGemini = uploadResponse.file.name;
            console.log(`- Upload concluído (${fileUri})`);

            // 2. Aguardar o processamento do vídeo no servidor Google
            console.log('- Aguardando processamento do vídeo no Gemini...');
            let fileState = await fileManager.getFile(fileNameGemini);
            while (fileState.state === "PROCESSING") {
                process.stdout.write('.');
                await delay(5000);
                fileState = await fileManager.getFile(fileNameGemini);
            }
            if (fileState.state === "FAILED") {
                throw new Error("Falha no processamento do vídeo do lado do Gemini.");
            }
            console.log('\n- Vídeo pronto para análise.');

            // 3. Extrair descrição do vídeo (Eventos, personagens, falas)
            console.log('- Analisando conteúdo do vídeo...');
            const prompt = "Por favor, assista a esse vídeo e crie uma transcrição minuciosa e estruturada de tudo que acontece. Descreva o ambiente, os objetos, pessoas, ações realizadas quadro a quadro temporalmente, e transcreva qualquer fala/áudio importante. O objetivo é criar a melhor representação em texto possível deste vídeo para um sistema de busca.";
            
            const resultVision = await visionModel.generateContent([
                { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } },
                { text: prompt }
            ]);
            let description = resultVision.response.text();
            console.log(`- Compreensão gerada: "${description.substring(0, 80)}..."`);

            // 4. Transformar essa narrativa num Embedding (text-embedding-004)
            console.log(`- Gerando vetor com Embeddings-004...`);
            const resultEmbed = await embeddingModel.embedContent(description);
            const embeddingValues = resultEmbed.embedding.values;

            // 5. Upsert no Pinecone
            console.log(`- Salvando Pinecone...`);
            await index.upsert({
                records: [{
                    id: `vid_${safeId}`,
                    values: embeddingValues,
                    metadata: {
                        type: "video",
                        filename: file,
                        description: description.substring(0, 1000)
                    }
                }]
            });

            // 6. Apagar o arquivo da API do Gemini (liberar espaço)
            await fileManager.deleteFile(fileNameGemini);
            console.log(`- Vídeo salvo com sucesso (Arquivo temporário deletado da Cloud)\n`);

        } catch (err) {
            console.error(`- Erro ao processar o vídeo ${file}:`, err.message);
        }
    }
}

processVideos().catch(console.error);
