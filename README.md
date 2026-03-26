# Banco de Dados Vetorial Multimodal (Pinecone + Gemini)

Este projeto contém os scripts criados para processar, embutir (embedding) e buscar dados multimodais usando a arquitetura de **Metadados e RAG com IA Generativa**.

## 🚀 Como Inicializar

1. O arquivo `.env` já foi criado com placeholders. Substitua com suas chaves reais:
   - `GEMINI_API_KEY`: Acesse [Google AI Studio](https://aistudio.google.com/app/apikey) para gerar.
   - `PINECONE_API_KEY`: Crie um índice no Pinecone com dimensão **3072** e métrica **Cosine**. Depois, adicione o nome do índice e a sua API KEY no `.env`.

2. Teste a conexão inicial:
   ```bash
   node index.js
   ```

## 🗂️ Como Ingerir Dados

Primeiro, coloque seus arquivos nos devidos diretórios (criados automaticamente):
- `docs/` para arquivos `.txt` e `.pdf`
- `imagens/` para fotos (`.jpg`, `.png`, `.webp`)
- `videos/` para vídeos (`.mp4`, `.mov`)

Depois, execute os scripts de indexação:
```bash
node ingestText.js
node ingestImages.js
node ingestVideos.js
```
*(Para vídeos, o script fará upload e usará a API avançada do Gemini 1.5 Pro. Espere concluir).*

## 🔍 Como Fazer Buscas Semânticas

Depois de todos os dados inseridos, pergunte ao banco de dados:
```bash
node search.js "onde o cachorro está correndo?"
node search.js "resume para mim os lucros do ano passado que estão no pdf"
```

O Gemini cruzará sua pergunta com os vetores criados, e o Pinecone devolverá as maiores correlações (tanto descritivas visuais quanto trechos de manuais/textos).
