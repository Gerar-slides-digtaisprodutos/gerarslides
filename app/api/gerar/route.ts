import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { systemInstruction, promptParts, imageStyle, dinamica, isBlockRefinement, isElementRefinement, isSiteRefinement } = body;

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    let temImagem = false;
    let textoDoPrompt = "";
    
    // Junta todo o texto enviado para análise
    for (const part of promptParts) {
        if (part.inlineData) temImagem = true;
        if (part.text) textoDoPrompt += part.text + "\n";
    }

    // 1. DIRETRIZ DE MÍDIA PROFISSIONAL PARA SLIDES
    const regraImagens = `
=== SISTEMA DE MÍDIA PROFISSIONAL EXCLUSIVO (UNSPLASH API) ===
🚨 REGRA ABSOLUTA: É ESTRITAMENTE PROIBIDO usar links reais de imagens, loremflickr, ou tags genéricas.
Você DEVE utilizar a nossa tag de requisição para TODAS as imagens geradas.
Sintaxe exata: src="[UNSPLASH: resolucao: keywords_em_ingles]"

Tamanhos Obrigatórios de Resolução:
- 1280x720 (Paisagem/Landscape): Para fundos largos e imagens principais dos slides (16:9).
- 800x1200 (Retrato/Portrait): Para fotos de pessoas, equipe ou palestrantes.
- 800x800 (Quadrado/Squarish): Para ícones, logos ou avatares pequenos.

Keywords: Use 2 ou 3 palavras altamente precisas em inglês para definir o contexto (ex: business meeting, confident therapist).
Exemplo: <img src="[UNSPLASH: 1280x720: modern office]" class="w-full h-auto object-cover rounded-xl shadow-lg" alt="Office" />
`;
    
    let instrucaoDinamica = "";
    if (dinamica === 'suave') instrucaoDinamica = "- ANIMAÇÕES: Adicione classes tailwind de hover suave como hover:scale-105 transition-transform.";
    else if (dinamica === 'impacto') instrucaoDinamica = "- ANIMAÇÕES: Aplique Glassmorphism (bg-white/10 backdrop-blur-md) e sombras fortes shadow-2xl.";

    let regrasObrigatorias = "";
    
    if (isSiteRefinement) {
        regrasObrigatorias = `=== REGRA DE REFATORAÇÃO GLOBAL DE SLIDES ===\nModifique APENAS o que foi pedido pelo usuário e devolva TODO o código HTML estruturado no JSON. NÃO CORTE O CÓDIGO DA APRESENTAÇÃO.`;
    } else if (isElementRefinement) {
        regrasObrigatorias = `=== MICRO-OTIMIZAÇÃO DE SLIDE ===\nDevolva APENAS a Tag HTML do elemento fornecido perfeitamente otimizado, dentro do JSON. Sem explicações adicionais. Mantenha os IDs originais.`;
    } else {
        regrasObrigatorias = `
=== REGRA DE OURO 1: ARQUITETURA DE SLIDES 16:9 ===
Retorne EXCLUSIVAMENTE um objeto JSON contendo a chave "codigo_html".
🚨 ATENÇÃO: GERE UMA APRESENTAÇÃO DE SLIDES COMPLETA E PROFISSIONAL.
- O valor DEVE conter a estrutura completa dos slides.
- NÃO adicione <!DOCTYPE html> ou <body>. Devolva apenas o miolo, ou seja, as tags <section>.
- Cada slide DEVE obrigatoriamente ser uma tag <section> com as seguintes classes: "w-full min-h-screen flex flex-col justify-center items-center p-12 snap-center shrink-0 relative bg-white".
- Alterne a cor de fundo (ex: bg-slate-50, bg-slate-900) entre os slides para dar contraste.
- Force o espaçamento de UMA LINHA inteira entre títulos e parágrafos ('mb-4' ou 'mb-6').

=== REGRA DE OURO 2: CONTEÚDO DA APRESENTAÇÃO ===
- Crie NO MÍNIMO 5 slides completos (Ex: Capa, O Problema, A Solução, Casos de Sucesso, Contato/CTA).
- Use textos diretos, grandes e impactantes (text-3xl, text-5xl, text-7xl para títulos).
- Textos não devem ser blocos densos, use bullet points e divisões visuais claras.

${regraImagens}
${instrucaoDinamica}
`;
    }

    const systemInstructionFinal = (systemInstruction || '') + '\n\n' + regrasObrigatorias;
    let htmlCode = '';
    let provedorTextoUsado = 'Google Gemini 2.5 (Design/Estrutura)';

    // Se for uma refatoração de um único elemento de texto, usamos o GROK (xAI) para Copywriting Persuasivo
    const usarGrok = isElementRefinement && !body.isGeminiForced && !isSiteRefinement;

    if (!usarGrok) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: systemInstructionFinal, safetySettings });
        const result = await model.generateContent({ contents: [{ role: "user", parts: promptParts }], generationConfig: { temperature: isSiteRefinement ? 0.3 : 0.4 } });
        htmlCode = extrairHtmlDeJson(result.response.text());
    } else {
        provedorTextoUsado = 'Grok (xAI) - Copywriting';
        
        // Chamada direta para a API oficial do xAI (Grok)
        const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST", 
            headers: { 
                "Authorization": `Bearer ${process.env.GROK_API_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                model: "grok-beta", 
                messages: [
                    { role: "system", content: systemInstructionFinal }, 
                    { role: "user", content: textoDoPrompt }
                ], 
                response_format: { type: "json_object" }, 
                temperature: 0.7
            })
        });
        
        if (!grokResponse.ok) {
            throw new Error(`Erro na API do Grok: ${grokResponse.statusText}`);
        }
        
        const grokData = await grokResponse.json();
        htmlCode = extrairHtmlDeJson(grokData.choices[0].message.content);
    }

    if (!htmlCode || htmlCode.length < 50) throw new Error("A Inteligência Artificial falhou em gerar o código HTML. Tente refazer a requisição.");

    // 3. MOTOR DE IMAGENS BLINDADO (Unsplash API)
    const regexImgReq = /\[UNSPLASH:\s*(\d+x\d+)\s*:\s*([^\]]+)\]/g;
    let match;
    
    // ✨ A SOLUÇÃO DO SEU ERRO DO TYPESCRIPT ESTÁ AQUI
    let urlsToReplace: { fullMatch: string; dimensao: string; keywords: string }[] = [];
    
    while ((match = regexImgReq.exec(htmlCode)) !== null) {
        urlsToReplace.push({ fullMatch: match[0], dimensao: match[1], keywords: match[2] });
    }

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
            } catch (e) {
                console.log("Falha ao comunicar com Unsplash API.");
            }
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

// O NOVO EXTRATOR BLINDADO
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