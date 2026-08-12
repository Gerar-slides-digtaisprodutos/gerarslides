import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const { systemInstruction, promptParts, imageStyle, dinamica, isBlockRefinement, isElementRefinement, isSiteRefinement, isEbook, formato, estiloCapitulo, useGrok } = body;

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

    // A MÁGICA DAS CORES: Instrui a IA a alterar o CSS baseado na imagem
    const instrucaoImagem = temImagem 
        ? "\n🚨 ATENÇÃO MÁXIMA E ABSOLUTA: O usuário anexou uma imagem de referência visual. VOCÊ DEVE EXTRAIR A PALETA DE CORES DA IMAGEM E MODIFICAR O BLOCO <style> SUBSTITUINDO AS VARIÁVEIS no :root { --primary-color: #cor_escura_da_imagem; --secondary-color: #cor_de_destaque; --accent-color: #cor_secundaria; } PARA QUE O EBOOK COMBINE 100% COM A IMAGEM. Extraia também o tema central da imagem para estruturar os capítulos." 
        : "";

    let regrasObrigatorias = "";
    const regraImagens = `
=== SISTEMA DE MÍDIA PROFISSIONAL EXCLUSIVO (UNSPLASH API) ===
🚨 REGRA ABSOLUTA: Use a sintaxe exata: src="[UNSPLASH: resolucao: keywords_em_ingles]"
🚨 RESTRIÇÃO DE ESTILO: Utilize APENAS fotografia humana realista. É estritamente PROIBIDO usar desenhos, gráficos animados ou elementos sci-fi.
Tamanhos:
- 1280x720 (Paisagem): Para imagens no meio do texto ou fundos horizontais.
- 800x1200 (Retrato): Para fundos inteiros de capa de capítulo.
`;

    if (isSiteRefinement) {
        regrasObrigatorias = `=== REGRA DE REFATORAÇÃO GLOBAL ===\nModifique APENAS o que foi pedido pelo usuário e devolva TODO o código HTML estruturado.`;
    } else if (isElementRefinement) {
        regrasObrigatorias = `=== MICRO-OTIMIZAÇÃO ===\nDevolva APENAS a Tag HTML do elemento perfeitamente otimizado.`;
    } else if (isEbook) {
        const formatoLivro = formato || 'a4'; 
        const estiloEbookEscolhido = estiloCapitulo || 'icone_centralizado';

        let widthStr = '210mm'; let heightStr = '297mm';
        if (formatoLivro === '14x21') { widthStr = '140mm'; heightStr = '210mm'; }
        if (formatoLivro === '15x21') { widthStr = '150mm'; heightStr = '210mm'; }

        const cssEbook = `<style>
:root { --bg-color: #ffffff; --text-color: #1a1a1a; --primary-color: #080c16; --secondary-color: #1a7a4c; --accent-color: #1d5c96; --font-heading: 'Playfair Display', serif; --font-body: 'Lato', sans-serif; }
#meu-ebook { display: flex; flex-direction: column; align-items: center; width: 100%; gap: 30px; padding: 20px 0; }
.page-container { width: ${widthStr}; height: ${heightStr}; max-height: ${heightStr}; background: var(--bg-color); box-sizing: border-box; position: relative; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.2); flex-shrink: 0; }
.normal-page { padding: 22mm 20mm 28mm 20mm; display: flex; flex-direction: column; }
.normal-page::after { content: ""; position: absolute; top: 5mm; bottom: 5mm; left: 6mm; right: 6mm; border: 1px solid var(--secondary-color); opacity: 0.3; pointer-events: none; z-index: 10; }
.normal-page::before { content: ""; position: absolute; top: 6.5mm; bottom: 6.5mm; left: 7.5mm; right: 7.5mm; border: 0.5px solid var(--primary-color); opacity: 0.15; pointer-events: none; z-index: 10; }
.page-header { position: absolute; top: 10mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 10pt; color: var(--primary-color); border-bottom: 1px solid var(--secondary-color); padding-bottom: 5px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; z-index: 20; }
.page-footer { position: absolute; bottom: 10mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 10pt; color: var(--primary-color); border-top: 1px solid var(--secondary-color); padding-top: 5px; z-index: 20; }
h1, h2, h3, h4 { font-family: var(--font-heading); color: var(--primary-color); margin-top: 0; margin-bottom: 1.5rem !important; }
p { font-size: 12pt !important; line-height: 1.5; text-align: justify; text-indent: 25px; margin-top: 0 !important; margin-bottom: 15px; color: var(--text-color); }
img { max-width: 100%; height: auto; border-radius: 8px; }
blockquote.quote { font-size: 11.5pt; font-style: italic; font-family: var(--font-heading); border-left: 5px solid var(--secondary-color); background: rgba(0,0,0,0.03); padding: 12px 18px; margin: 15px 0 20px 0; color: var(--primary-color); border-radius: 0 8px 8px 0;}

/* ESTILOS DE CAPÍTULO DINÂMICOS */
.chapter-cover-exclusive { background-color: var(--primary-color) !important; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: #ffffff; padding: 20mm !important; }
.chapter-cover-exclusive .chapter-icon { font-size: 60px; color: var(--secondary-color); margin-bottom: 20px; }
.chapter-cover-exclusive .chapter-number { font-family: var(--font-body); font-size: 14pt; letter-spacing: 5px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 20px; font-weight: 700; }
.chapter-cover-exclusive .chapter-title { font-family: var(--font-heading); font-size: 38pt; color: #ffffff; line-height: 1.2; max-width: 90%; margin: 0 auto; font-weight: 700; }

.chapter-cover-bg { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: #ffffff; padding: 20mm !important; background-size: cover; background-position: center; position: relative; z-index: 1;}
.chapter-cover-bg::before { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,0.65); z-index: -1; }
.chapter-cover-bg .chapter-title { font-family: var(--font-heading); font-size: 42pt; color: #ffffff; text-shadow: 2px 2px 10px rgba(0,0,0,0.8); }

.chapter-inline-title { font-family: var(--font-heading); font-size: 26pt; color: var(--primary-color); margin-bottom: 15px !important; text-align: left; font-weight: 700; }
.chapter-hero-image { width: 100%; height: 220px; object-fit: cover; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }

@page { size: ${formatoLivro === 'a4' ? 'A4 portrait' : widthStr + ' ' + heightStr}; margin: 0; }
@media print { html, body { background: #ffffff !important; padding: 0 !important; margin: 0 !important; display: block !important; width: ${widthStr} !important; height: auto !important; } #meu-ebook { display: block !important; gap: 0 !important; padding: 0 !important; } .page-container { width: ${widthStr} !important; height: ${heightStr} !important; box-sizing: border-box !important; margin: 0 !important; page-break-after: always !important; border: none !important; box-shadow: none !important; position: relative !important; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } }
</style>`;

        let instrucaoEstiloCapitulo = "";
        if (estiloEbookEscolhido === 'icone_centralizado') {
            instrucaoEstiloCapitulo = "Estilo de Capítulo: Crie uma página exclusiva (<div class='page-container chapter-cover-exclusive'>) com um grande ícone FontAwesome <i> combinando com o tema, o número do capítulo e o título do capítulo. O texto inicia na página seguinte em uma div normal-page.";
        } else if (estiloEbookEscolhido === 'imagem_abaixo') {
            instrucaoEstiloCapitulo = "Estilo de Capítulo: Não use páginas exclusivas de capa de capítulo. Coloque o Título do Capítulo (<h1 class='chapter-inline-title'>) no topo da página de texto e, LOGO ABAIXO dele, uma imagem gerada por IA (<img src='[UNSPLASH: 1280x720: keyword]' class='chapter-hero-image'>), seguida pelo texto do miolo.";
        } else if (estiloEbookEscolhido === 'fundo_total') {
            instrucaoEstiloCapitulo = "Estilo de Capítulo: Crie uma página exclusiva (<div class='page-container chapter-cover-bg' style='background-image: url([UNSPLASH: 800x1200: keyword]);'>) com o título centralizado sobre a imagem de fundo. O texto inicia na página seguinte em uma div normal-page.";
        } else if (estiloEbookEscolhido === 'exclusiva_imagem_depois') {
            instrucaoEstiloCapitulo = "Estilo de Capítulo: Crie uma página de título exclusiva simples (<div class='page-container chapter-cover-exclusive'>) SEM IMAGEM. NA PÁGINA SEGUINTE, inicie com uma imagem de IA (<img src='[UNSPLASH: 1280x720: keyword]' class='chapter-hero-image'>) antes de começar os parágrafos de texto.";
        } else {
            instrucaoEstiloCapitulo = "Estilo de Capítulo: Alterne de forma mista as capas com ícone e as páginas com título e imagem abaixo.";
        }

        regrasObrigatorias = `
=== REGRA DE OURO: ARQUITETURA DE EBOOK LITERÁRIO PREMIUM ===
Retorne EXCLUSIVAMENTE um objeto JSON contendo a chave "codigo_html".
1. OBRIGATÓRIO: Inicie o código HTML com o bloco <style> exato fornecido abaixo:
${cssEbook}

2. DIRETRIZ DE LAYOUT DE CAPÍTULO SELECIONADA PELO USUÁRIO:
${instrucaoEstiloCapitulo}

3. DIRETRIZ DE ESTRUTURA:
- Envolva todas as páginas na tag <div id="meu-ebook">.
- O texto do miolo deve usar SEMPRE: <div class="page-container normal-page">
- Crie capítulos literários, bem escritos, densos e bem divididos.

${instrucaoImagem}
${regraImagens}
`;
    } else {
        regrasObrigatorias = `
=== REGRA DE OURO: ARQUITETURA DE SLIDES 16:9 ===
Retorne EXCLUSIVAMENTE um objeto JSON contendo a chave "codigo_html".
- Cada slide DEVE ser uma tag <section> com as seguintes classes: "w-full min-h-screen flex flex-col justify-center items-center p-12 snap-center shrink-0 relative bg-white".
${instrucaoImagem}
${regraImagens}
`;
    }

    const systemInstructionFinal = (systemInstruction || '') + '\n\n' + regrasObrigatorias;
    let htmlCode = '';
    let provedorTextoUsado = 'Google Gemini 3.6 Flash';

    const usarGrokFinal = (useGrok === true) && !isSiteRefinement && !isEbook; 

    if (!usarGrokFinal) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash", systemInstruction: systemInstructionFinal, safetySettings });
        const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }], generationConfig: { temperature: isSiteRefinement ? 0.3 : 0.6 } });
        htmlCode = extrairHtmlDeJson(result.response.text());
    } else {
        provedorTextoUsado = 'Grok (xAI) - Copywriting';
        const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST", headers: { "Authorization": `Bearer ${process.env.GROK_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "grok-beta", messages: [{ role: "system", content: systemInstructionFinal }, { role: "user", content: textoDoPrompt }], response_format: { type: "json_object" }, temperature: 0.7 })
        });
        if (!grokResponse.ok) throw new Error(`Erro na API do Grok: ${grokResponse.statusText}`);
        const grokData = await grokResponse.json();
        htmlCode = extrairHtmlDeJson(grokData.choices[0].message.content);
    }

    if (!htmlCode || htmlCode.length < 50) throw new Error("A Inteligência Artificial falhou em gerar o código HTML.");

    const regexImgReq = /\[UNSPLASH:\s*(\d+x\d+)\s*:\s*([^\]]+)\]/g;
    let match; let urlsToReplace: { fullMatch: string; dimensao: string; keywords: string }[] = [];
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
                    if (uData.results && uData.results.length > 0) imagemFinal = uData.results[Math.floor(Math.random() * uData.results.length)].urls.regular;
                }
            } catch (e) {}
            htmlCode = htmlCode.replace(item.fullMatch, imagemFinal);
        }
    } else {
        htmlCode = htmlCode.replace(/\[UNSPLASH:[^\]]+\]/g, 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80');
    }

    return NextResponse.json({ success: true, html: htmlCode, provedorTexto: provedorTextoUsado });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function extrairHtmlDeJson(text: string): string {
  try {
      let clean = text.replace(/```json/gi, '').replace(/```html/gi, '').replace(/```/g, '').trim();
      const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
          const jsonString = clean.substring(start, end + 1); const json = JSON.parse(jsonString);
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