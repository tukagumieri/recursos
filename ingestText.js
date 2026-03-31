require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Inicializa clientes
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Função simples para dividir texto em pedaços (chunks)
function chunkText(text, maxChars = 2000) {
    const chunks = [];
    let currentChunk = '';
    const paragraphs = text.split('\n');
    
    for (const p of paragraphs) {
        if (currentChunk.length + p.length > maxChars) {
            chunks.push(currentChunk);
            currentChunk = p + '\n';
        } else {
            currentChunk += p + '\n';
        }
    }
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
}

async function extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.txt' || ext === '.md') {
        return fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }
    return null;
}

function getAllFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        } else if (['.pdf', '.txt', '.md', '.docx'].includes(path.extname(entry.name).toLowerCase())) {
            files.push(fullPath);
        }
    }
    return files;
}

async function processDocuments() {
    const docsDir = path.join(__dirname, 'docs');
    if (!fs.existsSync(docsDir)) {
        console.log("Pasta 'docs' não encontrada. Criando...");
        fs.mkdirSync(docsDir);
        console.log("Coloque seus PDFs e TXTs na pasta 'docs' e rode o script novamente.");
        return;
    }

    const filePaths = getAllFiles(docsDir);

    if (filePaths.length === 0) {
        console.log("Nenhum documento encontrado na pasta 'docs'.");
        return;
    }

    const index = pc.index(indexName);
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

    for (const filePath of filePaths) {
        const file = path.relative(docsDir, filePath);
        console.log(`Processando documento: ${file}`);
        const safeId = file.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_\-]/g, "_");
        const text = await extractText(filePath);
        
        if (!text) continue;

        const chunks = chunkText(text);
        console.log(`- Dividido em ${chunks.length} partes.`);

        const vectors = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (chunk.trim() === '') continue;
            
            try {
                // Requisita o embedding do Gemini
                const result = await model.embedContent(chunk);
                const embedding = result.embedding.values;
                
                // Prepara o vetor para o Pinecone
                vectors.push({
                    id: `${safeId}_chunk_${i}`,
                    values: embedding,
                    metadata: {
                        type: "document",
                        filename: file,
                        text: chunk.substring(0, 1000) // Limita texto guardado no metadata
                    }
                });
            } catch (err) {
                console.error(`- Erro ao gerar vetor para chunk ${i}:`, err.message);
            }
        }
        
        if (vectors.length > 0) {
            console.log(`- Salvando ${vectors.length} vetores no Pinecone...`);
            const batchSize = 100;
            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize);
                const cleanBatch = batch.map(b => ({
                    id: String(b.id),
                    values: Array.from(b.values),
                    metadata: b.metadata
                }));
                // Tenta inserir como array diretamente e como { records } como fallback
                if (cleanBatch.length > 0) {
                    await index.upsert({ records: cleanBatch });
                }
            }
            console.log(`- Concluído: ${file}\n`);
        }
    }
    
    console.log("Processamento de documentos finalizado!");
}

processDocuments().catch(console.error);
