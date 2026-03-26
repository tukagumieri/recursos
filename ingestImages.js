require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Inicializa clientes
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}

async function processImages() {
    const imagesDir = path.join(__dirname, 'imagens');
    if (!fs.existsSync(imagesDir)) {
        console.log("Pasta 'imagens' não encontrada. Criando...");
        fs.mkdirSync(imagesDir);
        console.log("Coloque suas imagens (.jpg, .png) na pasta 'imagens' e rode o script novamente.");
        return;
    }

    const files = fs.readdirSync(imagesDir).filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i));
    if (files.length === 0) {
        console.log("Nenhuma imagem encontrada na pasta 'imagens'.");
        return;
    }

    const index = pc.index(indexName);
    
    // Modelos
    const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    for (const file of files) {
        console.log(`Processando imagem: ${file}`);
        const safeId = file.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_\-]/g, "_");
        const filePath = path.join(imagesDir, file);
        
        let mimeType = 'image/jpeg';
        if (file.toLowerCase().endsWith('.png')) mimeType = 'image/png';
        if (file.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

        const imagePart = fileToGenerativePart(filePath, mimeType);

        try {
            // 1. Extrair descrição textual minuciosa da imagem usando Gemini Flash
            console.log(`- Gerando descrição detalhada com Gemini 1.5 Flash...`);
            const prompt = "Descreva esta imagem com o máximo de detalhes possível. Descreva cada parte, objetos presentes, textos escritos, cores, contexto, emoções ou dados relevantes.";
            const resultVision = await visionModel.generateContent([prompt, imagePart]);
            const description = resultVision.response.text();
            
            console.log(`- Descrição gerada: "${description.substring(0, 80)}..."`);
            
            // 2. Criar embedding dessa descrição detalhada
            console.log(`- Criando embedding para a descrição...`);
            const resultEmbed = await embeddingModel.embedContent(description);
            const embeddingValues = resultEmbed.embedding.values;

            // 3. Salvar no Pinecone
            console.log(`- Salvando no Pinecone...`);
            await index.upsert({
                records: [{
                    id: `img_${safeId}`,
                    values: embeddingValues,
                    metadata: {
                        type: "imagem",
                        filename: file,
                        description: description.substring(0, 1000)
                    }
                }]
            });
            
            console.log(`- Imagem salva com sucesso!\n`);
        } catch (err) {
            console.error(`- Erro ao processar ${file}:`, err.message);
        }
    }
    
    console.log("Processamento de imagens finalizado!");
}

processImages().catch(console.error);
