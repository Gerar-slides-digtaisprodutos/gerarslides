import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const { systemInstruction, promptParts, imageStyle, dinamica, isBlockRefinement, isElementRefinement, isSiteRefinement, isEbook, formato, useGrok } = body;

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    let temImagem = false;
    let textoDoPrompt = "";
    
    for (const part of promptParts) {
        if (part.inlineData) temImagem = true;
        if (part.text) textoDoPrompt += part.text + "\n";
    }

    const instrucaoImagem = temImagem 
        ? "\n🚨 ATENÇÃO MÁXIMA: O usuário anexou uma imagem ou roteiro como base. VOCÊ DEVE EXTRAIR RIGOROSAMENTE AS INFORMAÇÕES, TEXTOS E CONTEXTO DESSA IMAGEM/ROTEIRO E GERAR TODO O CONTEÚDO DO PROJETO BASEADO EXCLUSIVAMENTE NELA. NÃO INVENTE ASSUNTOS ALEATÓRIOS." 
        : "";

    let regrasObrigatorias = "";
    const regraImagens = `
=== SISTEMA DE MÍDIA PROFISSIONAL EXCLUSIVO (UNSPLASH API) ===
🚨 REGRA ABSOLUTA: É ESTRITAMENTE PROIBIDO usar links reais de imagens, loremflickr, ou tags genéricas.
Você DEVE utilizar a nossa tag de requisição para TODAS as imagens geradas.
Sintaxe exata: src="[UNSPLASH: resolucao: keywords_em_ingles]"

Tamanhos Obrigatórios de Resolução:
- 1280x720 (Paisagem): Para fundos largos.
- 800x1200 (Retrato): Para fotos de pessoas, capas ou palestrantes.
- 800x800 (Quadrado): Para ícones, logos ou avatares pequenos.
Exemplo: <img src="[UNSPLASH: 800x1200: confident business professional]" alt="Cover" />
`;

    if (isSiteRefinement) {
        regrasObrigatorias = `=== REGRA DE REFATORAÇÃO GLOBAL ===\nModifique APENAS o que foi pedido pelo usuário e devolva TODO o código HTML estruturado no JSON. NÃO CORTE O CÓDIGO DA APRESENTAÇÃO.`;
    } else if (isElementRefinement) {
        regrasObrigatorias = `=== MICRO-OTIMIZAÇÃO ===\nDevolva APENAS a Tag HTML do elemento fornecido perfeitamente otimizado, dentro do JSON. Sem explicações adicionais. Mantenha os IDs originais.`;
    } else if (isEbook) {
        const formatoLivro = formato || 'a4'; 
        
        let widthStr = '210mm'; let heightStr = '297mm';
        if (formatoLivro === '14x21') { widthStr = '140mm'; heightStr = '210mm'; }
        if (formatoLivro === '15x21') { widthStr = '150mm'; heightStr = '210mm'; }

        const tipoCapa = formatoLivro === 'a4' 
            ? "Capa cheia preenchendo toda a primeira página digital." 
            : "Folha de Rosto tradicional (Título elegante e Nome do Autor centralizados, sem imagem de fundo chamativa, ideal para livro impresso).";

        const cssEbook = `<style>
:root { --bg-color: #ffffff; --text-color: #1a1a1a; --primary-color: #080c16; --secondary-color: #1a7a4c; --accent-color: #1d5c96; --font-heading: 'Playfair Display', serif; --font-body: 'Lato', sans-serif; }

/* Estrutura visual do Ebook na tela */
#meu-ebook { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 30px; padding: 20px 0; }

.page-container { width: ${widthStr}; height: ${heightStr}; max-height: ${heightStr}; padding: 22mm 20mm 28mm 20mm; background: var(--bg-color); box-sizing: border-box; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); flex-shrink: 0; }
.page-container:not(.page-cover):not(.chapter-cover)::after { content: ""; position: absolute; top: 5mm; bottom: 5mm; left: 6mm; right: 6mm; border: 1px solid rgba(29, 92, 150, 0.5); pointer-events: none; z-index: 10; }
.page-container:not(.page-cover):not(.chapter-cover)::before { content: ""; position: absolute; top: 6.5mm; bottom: 6.5mm; left: 7.5mm; right: 7.5mm; border: 0.5px solid rgba(8, 12, 22, 0.15); pointer-events: none; z-index: 10; }
.page-header { position: absolute; top: 10mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 10pt; color: var(--primary-color); border-bottom: 1px solid var(--secondary-color); padding-bottom: 5px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; z-index: 20; }
.page-footer { position: absolute; bottom: 10mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 10pt; color: var(--primary-color); border-top: 1px solid var(--secondary-color); padding-top: 5px; z-index: 20; }
h1, h2, h3, h4 { font-family: var(--font-heading); color: var(--primary-color); margin-top:0; }
h2.main-title { font-size: 24pt; text-align: center; margin-top: 20px; margin-bottom: 30px; }
h3.sub-title { font-size: 16pt; margin-top: 20px; margin-bottom: 10px; color: var(--accent-color); }
p { font-size: 12.5pt; line-height: 1.45; text-align: justify; text-indent: 25px; margin-bottom: 15px; }
blockquote.quote { font-size: 12pt; font-style: italic; font-family: var(--font-heading); border-left: 5px solid var(--secondary-color); background: rgba(29, 92, 150, 0.05); padding: 12px 18px; margin: 15px 0 20px 0; text-align: left; color: var(--primary-color); border-radius: 0 8px 8px 0; }
.page-cover { padding: 0 !important; display: flex; justify-content: center; align-items: center; background-color: var(--primary-color) !important; }
.page-cover img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 100; }
.page-index { background: linear-gradient(135deg, #ffffff 0%, rgba(26, 122, 76, 0.03) 100%) !important; }
.toc-title-main { font-size: 32pt; text-align: center; margin-top: 30px; margin-bottom: 40px; color: var(--primary-color); }
.toc-list { margin-top: 20px; padding: 0 15px; display: flex; flex-direction: column; gap: 15px; }
.toc-item { display: flex; justify-content: space-between; align-items: flex-end; font-size: 12.5pt; color: var(--primary-color); text-decoration: none; font-weight: bold; }
.toc-title { background: transparent; padding-right: 10px; z-index: 1; }
.toc-dots { flex-grow: 1; border-bottom: 2px dotted rgba(8, 12, 22, 0.3); margin: 0 10px; position: relative; top: -6px; }
.toc-page { background: transparent; padding-left: 10px; z-index: 1; }
.chapter-cover { display: flex; flex-direction: column; justify-content: center; align-items: center; background-color: var(--primary-color) !important; text-align: center; position: relative; overflow: hidden; }
.chapter-number { font-size: 14pt; letter-spacing: 4px; text-transform: uppercase; color: var(--accent-color); margin-bottom: 20px; z-index: 1; font-weight: bold; }
.chapter-title { font-size: 36pt; color: #ffffff; line-height: 1.2; max-width: 85%; z-index: 1; margin: 0 auto; text-shadow: 1px 1px 2px rgba(255,255,255,0.8);}

/* O SEU CÓDIGO DE EXPORTAÇÃO EM PDF */
@page { size: ${formatoLivro === 'a4' ? 'A4 portrait' : widthStr + ' ' + heightStr}; margin: 0; }
@media print {
    html, body { background: #ffffff !important; padding: 0 !important; margin: 0 !important; display: block !important; width: ${widthStr} !important; height: auto !important; }
    #meu-ebook { display: block !important; gap: 0 !important; padding: 0 !important; }
    .page-container { width: ${widthStr} !important; height: ${heightStr} !important; box-sizing: border-box !important; margin: 0 !important; padding: 22mm 20mm 28mm 20mm !important; page-break-after: always !important; border: none !important; box-shadow: none !important; overflow: hidden !important; position: relative !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
}
</style>`;

        regrasObrigatorias = `
=== REGRA DE OURO 1: ARQUITETURA DE EBOOK PREMIUM (${formatoLivro.toUpperCase()}) ===
Retorne EXCLUSIVAMENTE um objeto JSON contendo a chave "codigo_html".
Você está criando um Ebook completo, denso e literário, estruturado para leitura e impressão.

1. OBRIGATÓRIO: Inicie o código HTML EXATAMENTE com este bloco <style> (NÃO ALTERE AS CLASSES E INCLUA EXATAMENTE ESTE BLOCO):
${cssEbook}

2. ESTRUTURA DAS PÁGINAS (Você deve envelopar TUDO dentro de <div id="meu-ebook">):
<div id="meu-ebook">
    <!-- PÁGINA 1: ${tipoCapa} -->
    <div class="page-container page-cover"><img src="[UNSPLASH: 800x1200: cover book]" alt="Capa"></div>
    
    <!-- PÁGINA 2: ÍNDICE -->
    <div class="page-container page-index"><div class="page-header"><span>NOME DO LIVRO</span><span>Índice</span></div><h2 class="main-title toc-title-main">Índice</h2><div class="toc-list"><a href="#pg3" class="toc-item"><span class="toc-title">Capítulo 1</span><span class="toc-dots"></span><span class="toc-page">3</span></a></div><div class="page-footer"><span>Autor</span><span>2</span></div></div>
    
    <!-- PÁGINA DE CAPÍTULO -->
    <div class="page-container chapter-cover" id="pg3"><span class="chapter-number">Capítulo 1</span><h1 class="chapter-title">Título do Capítulo</h1></div>
    
    <!-- PÁGINA DE TEXTO (MIOLO) -->
    <div class="page-container" id="pg4"><div class="page-header"><span>Capítulo 1</span><span>Nome do Livro</span></div><h3 class="sub-title">Subtítulo</h3><p>Seu texto longo, denso e valioso aqui...</p><blockquote class="quote">Citação de destaque aqui.</blockquote><div class="page-footer"><span>Autor</span><span>4</span></div></div>
</div>

3. O CONTEÚDO (MUITO IMPORTANTE):
Transforme o tema fornecido em um texto DENSO, LONGO e PROFUNDO. Quebre os capítulos em múltiplas páginas (<div class="page-container">). Não crie páginas com apenas uma frase. Encha as páginas com conteúdo valioso! Crie NO MÍNIMO 6 a 8 páginas no total.
${instrucaoImagem}
${regraImagens}
`;
    } else {
        let instrucaoDinamica = "";
        if (dinamica === 'suave') instrucaoDinamica = "- ANIMAÇÕES: Adicione classes tailwind de hover suave como hover:scale-105 transition-transform.";
        else if (dinamica === 'impacto') instrucaoDinamica = "- ANIMAÇÕES: Aplique Glassmorphism (bg-white/10 backdrop-blur-md) e sombras fortes shadow-2xl.";

        regrasObrigatorias = `
=== REGRA DE OURO 1: ARQUITETURA DE SLIDES 16:9 ===
Retorne EXCLUSIVAMENTE um objeto JSON contendo a chave "codigo_html".
🚨 ATENÇÃO: GERE UMA APRESENTAÇÃO DE SLIDES COMPLETA E PROFISSIONAL.
- O valor DEVE conter a estrutura completa dos slides.
- NÃO adicione <!DOCTYPE html> ou <body>. Devolva apenas o miolo, ou seja, as tags <section>.
- Cada slide DEVE obrigatoriamente ser uma tag <section> com as seguintes classes: "w-full min-h-screen flex flex-col justify-center items-center p-12 snap-center shrink-0 relative bg-white".
- Alterne a cor de fundo (ex: bg-slate-50, bg-slate-900) entre os slides para dar contraste.
- Force o espaçamento de UMA LINHA inteira entre títulos e parágrafos ('mb-4' ou 'mb-6').
- Crie NO MÍNIMO 5 slides completos. Use textos diretos, grandes e impactantes.
${instrucaoImagem}
${regraImagens}
${instrucaoDinamica}
`;
    }

    const systemInstructionFinal = (systemInstruction || '') + '\n\n' + regrasObrigatorias;
    let htmlCode = '';
    let provedorTextoUsado = 'Google gemini-3.6-flash';

    const usarGrokFinal = (useGrok === true) && !isSiteRefinement && !isEbook; 

    if (!usarGrokFinal) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash", systemInstruction: systemInstructionFinal, safetySettings });
        const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }], generationConfig: { temperature: isSiteRefinement ? 0.3 : 0.6 } });
        htmlCode = extrairHtmlDeJson(result.response.text());
    } else {
        provedorTextoUsado = 'Grok (xAI) - Copywriting';
        const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST", 
            headers: { "Authorization": `Bearer ${process.env.GROK_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ 
                model: "grok-beta", 
                messages: [{ role: "system", content: systemInstructionFinal }, { role: "user", content: textoDoPrompt }], 
                response_format: { type: "json_object" }, 
                temperature: 0.7
            })
        });
        if (!grokResponse.ok) { throw new Error(`Erro na API do Grok: ${grokResponse.statusText}`); }
        const grokData = await grokResponse.json();
        htmlCode = extrairHtmlDeJson(grokData.choices[0].message.content);
    }

    if (!htmlCode || htmlCode.length < 50) throw new Error("A Inteligência Artificial falhou em gerar o código HTML. Tente refazer a requisição.");

    const regexImgReq = /\[UNSPLASH:\s*(\d+x\d+)\s*:\s*([^\]]+)\]/g;
    let match;
    let urlsToReplace: { fullMatch: string; dimensao: string; keywords: string }[] = [];
    
    while ((match = regexImgReq.exec(htmlCode)) !== null) { urlsToReplace.push({ fullMatch: match[0], dimensao: match[1], keywords: match[2] }); }

    if (urlsToReplace.length > 0 && process.env.UNSPLASH_ACCESS_KEY) {
        for (const item of urlsToReplace) {
            let orient = 'landscape';
            if (item.dimensao === '800x1200') orient = 'portrait';
            if (item.dimensao === '800x800') orient = 'squarish';
            const kwFormatada = encodeURIComponent(item.keywords.trim());
            let imagemFinal = `https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80`; 
            try {
                const uRes = await fetch(`https://api.unsplash.com/search/photos?query=${kwFormatada}&per_page=10&orientation=${orient}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`);
                if (uRes.ok) {
                    const uData = await uRes.json();
                    if (uData.results && uData.results.length > 0) {
                        imagemFinal = uData.results[Math.floor(Math.random() * uData.results.length)].urls.regular;
                    }
                }
            } catch (e) {}
            htmlCode = htmlCode.replace(item.fullMatch, imagemFinal);
        }
    } else {
        htmlCode = htmlCode.replace(/\[UNSPLASH:[^\]]+\]/g, 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80');
    }

    htmlCode = htmlCode.replace(/https:\/\/source\.unsplash\.com\/random\/\d+x\d+\/\?([^"&<>\s']+)/g, () => {
        return `https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80`;
    });

    return NextResponse.json({ success: true, html: htmlCode, provedorTexto: provedorTextoUsado });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function extrairHtmlDeJson(text: string): string {
  try {
      let clean = text.replace(/```json/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
          const jsonString = clean.substring(start, end + 1);
          const json = JSON.parse(jsonString);
          let extracted = json.codigo_html || json.html || Object.values(json)[0] || jsonString;
          if (typeof extracted === 'string') extracted = extracted.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
          return extracted;
      }
      return clean;
  } catch (e) {
      let fallback = text.replace(/```(html|json)?/gi, '').replace(/```/g, '').trim();
      if (fallback.toLowerCase().startsWith('json')) fallback = fallback.substring(4).trim();
      if (fallback.startsWith('{') && fallback.includes('"codigo_html":')) {
          const idx = fallback.indexOf('"codigo_html":');
          if (idx !== -1) {
              let rawHtml = fallback.substring(idx + 14).trim();
              if (rawHtml.startsWith('"')) rawHtml = rawHtml.substring(1);
              if (rawHtml.endsWith('}')) rawHtml = rawHtml.slice(0, -1).trim();
              if (rawHtml.endsWith('"')) rawHtml = rawHtml.slice(0, -1);
              return rawHtml.replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
      }
      return fallback;
  }
}