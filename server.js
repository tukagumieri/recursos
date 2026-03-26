require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX_NAME;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_MODEL = 'meta-llama/llama-3.3-70b-instruct';

const SYSTEM_PROMPT = `Você é um assistente jurídico especializado em recursos de multas de trânsito da Marco Despachante.
Você tem acesso a uma base de conhecimento com modelos, acórdãos e documentos jurídicos sobre recursos administrativos de trânsito.

Sua função é ajudar a elaborar recursos de multas de trânsito com linguagem técnica e jurídica adequada.
Sempre baseie suas respostas nos documentos da base de conhecimento quando disponíveis.

Ao elaborar um recurso:
- Use linguagem jurídica formal
- Inclua os fundamentos legais pertinentes (CTB, resoluções do CONTRAN, etc.)
- Estruture o recurso com: Preâmbulo, Dos Fatos, Do Direito, Do Pedido
- Seja objetivo e direto nos argumentos

Se o usuário pedir para elaborar um recurso, pergunte as informações necessárias:
- Número do auto de infração
- Artigo infringido
- Data da infração
- Descrição do ocorrido
- Nome do condutor/proprietário`;

async function searchKnowledgeBase(query, topK = 5) {
    try {
        const index = pc.index(indexName);
        const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

        const resultEmbed = await embeddingModel.embedContent(query);
        const queryVector = resultEmbed.embedding.values;

        const queryResponse = await index.query({
            vector: queryVector,
            topK,
            includeMetadata: true
        });

        return queryResponse.matches.map(match => ({
            score: match.score,
            type: match.metadata.type,
            filename: match.metadata.filename,
            content: match.metadata.text || match.metadata.description || ''
        }));
    } catch (err) {
        console.error('Erro ao buscar na base de conhecimento:', err.message);
        return [];
    }
}

// ── CONVERSAS ────────────────────────────────────────────────────────────────

// Listar todas as conversas
app.get('/api/conversas', async (req, res) => {
    const { data, error } = await supabase
        .from('conversas')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Criar nova conversa
app.post('/api/conversas', async (req, res) => {
    const { titulo = 'Nova Conversa' } = req.body;
    const { data, error } = await supabase
        .from('conversas')
        .insert({ titulo })
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Renomear conversa
app.patch('/api/conversas/:id', async (req, res) => {
    const { titulo } = req.body;
    const { data, error } = await supabase
        .from('conversas')
        .update({ titulo, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Deletar conversa
app.delete('/api/conversas/:id', async (req, res) => {
    const { error } = await supabase
        .from('conversas')
        .delete()
        .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Buscar mensagens de uma conversa
app.get('/api/conversas/:id/mensagens', async (req, res) => {
    const { data, error } = await supabase
        .from('mensagens')
        .select('*')
        .eq('conversa_id', req.params.id)
        .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Download da conversa como JSON
app.get('/api/conversas/:id/download', async (req, res) => {
    const { data: conversa, error: e1 } = await supabase
        .from('conversas')
        .select('*')
        .eq('id', req.params.id)
        .single();
    if (e1) return res.status(500).json({ error: e1.message });

    const { data: mensagens, error: e2 } = await supabase
        .from('mensagens')
        .select('*')
        .eq('conversa_id', req.params.id)
        .order('created_at', { ascending: true });
    if (e2) return res.status(500).json({ error: e2.message });

    const filename = `conversa_${conversa.titulo.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')}_${req.params.id.slice(0, 8)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({ conversa, mensagens });
});

// ── CHAT ─────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
    const { message, history = [], conversaId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Mensagem não fornecida.' });
    }

    try {
        // Cria conversa no Supabase se não existir
        let convId = conversaId;
        if (!convId) {
            // Usa as primeiras palavras da mensagem como título
            const titulo = message.length > 50 ? message.substring(0, 50) + '...' : message;
            const { data: novaConversa, error: errConv } = await supabase
                .from('conversas')
                .insert({ titulo })
                .select()
                .single();
            if (!errConv) convId = novaConversa.id;
        }

        // Salva mensagem do usuário no Supabase
        if (convId) {
            await supabase.from('mensagens').insert({
                conversa_id: convId,
                role: 'user',
                content: message,
                sources: []
            });
            // Atualiza updated_at da conversa
            await supabase
                .from('conversas')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', convId);
        }

        // Busca documentos relevantes no Pinecone
        const results = await searchKnowledgeBase(message);

        let contextText = '';
        if (results.length > 0) {
            contextText = '\n\n=== DOCUMENTOS RELEVANTES DA BASE DE CONHECIMENTO ===\n';
            results.forEach((r, i) => {
                if (r.score > 0.5) {
                    contextText += `\n[Documento ${i + 1}] (${r.filename}) - Similaridade: ${(r.score * 100).toFixed(0)}%\n`;
                    contextText += r.content.substring(0, 800) + '\n';
                }
            });
            contextText += '\n=== FIM DOS DOCUMENTOS ===\n';
        }

        const userMessageWithContext = contextText
            ? `${message}\n\nContexto disponível:${contextText}`
            : message;

        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })),
            { role: 'user', content: userMessageWithContext }
        ];

        const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Marco Despachante - IA Recursos'
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 2048
            })
        });

        if (!orResponse.ok) {
            const err = await orResponse.text();
            throw new Error(`OpenRouter: ${orResponse.status} – ${err}`);
        }

        const orData = await orResponse.json();
        const response = orData.choices[0].message.content;

        const sources = results
            .filter(r => r.score > 0.5)
            .map(r => ({ filename: r.filename, score: (r.score * 100).toFixed(0) }));

        // Salva resposta da IA no Supabase
        if (convId) {
            await supabase.from('mensagens').insert({
                conversa_id: convId,
                role: 'assistant',
                content: response,
                sources
            });
        }

        res.json({ message: response, model: GROQ_MODEL, sources, conversaId: convId });

    } catch (err) {
        console.error('Erro no chat:', err);
        res.status(500).json({ error: 'Erro ao processar mensagem: ' + err.message });
    }
});

// Exporta para o Vercel (serverless)
module.exports = app;

// Roda localmente se não for serverless
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
        console.log(`📚 Base de conhecimento: ${indexName}`);
        console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL}`);
    });
}
