import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { systemInstruction, promptParts, isElementRefinement, isSiteRefinement, useGrok } = body;

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
        ? "\n🚨 ATENÇÃO MÁXIMA E ABSOLUTA: O usuário anexou uma imagem de referência visual. VOCÊ DEVE COPIAR FIELMENTE AS CORES, A PALETA, O TOM E O ESTILO VISUAL DESSA IMAGEM PARA OS SLIDES." 
        : "";

    const regraImagens = `
=== SISTEMA DE MÍDIA PROFISSIONAL EXCLUSIVO (UNSPLASH API) ===
🚨 REGRA ABSOLUTA: Use a sintaxe exata: src="[UNSPLASH: 1280x720 : keywords_em_ingles]"
🚨 RESTRIÇÃO DE ESTILO: Utilize APENAS fotografia humana realista. É estritamente PROIBIDO usar desenhos, gráficos animados ou elementos sci-fi.
`;

   let regrasObrigatorias = "";
    if (isSiteRefinement) {
        regrasObrigatorias = `=== REGRA DE OURO PARA REFATORAÇÃO GLOBAL ===\nO usuário enviou a apresentação atual. Modifique APENAS o que foi pedido, mas **MANTENHA TODOS OS OUTROS SLIDES (SEÇÕES) INTEGRAIS** do código original. NUNCA apague os slides que não foram mencionados. Retorne a apresentação completa.`;
    } else if (isElementRefinement) {
        regrasObrigatorias = `=== MICRO-OTIMIZAÇÃO ===\nDevolva APENAS a Tag HTML do elemento perfeitamente otimizado, preservando rigorosamente o ID original.`;
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
    let provedorTextoUsado = '';

    // LÊ A CHAVE TANTO COM 'Q' QUANTO COM 'K'
    const chaveGroq = process.env.GROQ_API_KEY || process.env.GROK_API_KEY;

    if (useGrok && chaveGroq) {
        provedorTextoUsado = 'Groq (Llama 3.3)';
        const apiKey = chaveGroq;

        const url = "https://api.groq.com/openai/v1/chat/completions";
        const model = "llama-3.3-70b-versatile";

        const groqResponse = await fetch(url, {
            method: "POST", 
            headers: { 
                "Authorization": `Bearer ${apiKey}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                model: model, 
                messages: [
                    { role: "system", content: systemInstructionFinal }, 
                    { role: "user", content: textoDoPrompt || "Gere a apresentação de slides conforme instruído." }
                ], 
                
                temperature: 0.7 
            })
        });

        if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            throw new Error(`Erro na API do Groq (${groqResponse.status}): ${errText}`);
        }
        
        const groqData = await groqResponse.json();
        htmlCode = extrairHtmlDeJson(groqData.choices[0].message.content);
        
    } else {
        provedorTextoUsado = 'Google Gemini 3.6 Flash';
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.6-flash", 
            systemInstruction: systemInstructionFinal, 
            safetySettings 
        });
        
        const result = await model.generateContent({ 
            contents: [{ role: "user", parts: promptParts }], 
            generationConfig: { temperature: isSiteRefinement ? 0.3 : 0.6 } 
        });
        
        htmlCode = extrairHtmlDeJson(result.response.text());
    }

    if (!htmlCode || htmlCode.length < 50) {
        throw new Error("A Inteligência Artificial falhou em gerar o código HTML dos slides.");
    }

    // Processamento de Imagens Unsplash
    const regexImgReq = /\[UNSPLASH:\s*(\d+x\d+)\s*:\s*([^\]]+)\]/g;
    let match; 
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
            let imagemFinal = `https://images.unsplash.com/photo-1497215728101-856f4ea42174?fit=crop&w=1200&q=80`; 
            
            try {
                const uRes = await fetch(`https://api.unsplash.com/search/photos?query=${kwFormatada}&per_page=10&orientation=${orient}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`);
                if (uRes.ok) {
                    const uData = await uRes.json();
                    if (uData.results && uData.results.length > 0) {
                        imagemFinal = uData.results[Math.floor(Math.random() * uData.results.length)].urls.regular;
                    }
                }
            } catch (e) {
                // Ignora silenciosamente e mantém o fallback
            }
            htmlCode = htmlCode.replace(item.fullMatch, imagemFinal);
        }
    } else {
        htmlCode = htmlCode.replace(/\[UNSPLASH:[^\]]+\]/g, 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?fit=crop&w=1200&q=80');
    }

    return NextResponse.json({ success: true, html: htmlCode, provedorTexto: provedorTextoUsado });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function extrairHtmlDeJson(text: string): string {
  try {
      // REGEX CORRIGIDO: Sem quebras de linha que travam o TypeScript
      let clean = text.replace(/(\`\`\`html|\`\`\`json|\`\`\`)/gi, '').trim();
      
      const start = clean.indexOf('{'); 
      const end = clean.lastIndexOf('}');
      
      if (start !== -1 && end !== -1) {
          const jsonString = clean.substring(start, end + 1); 
          const json = JSON.parse(jsonString);
          let extracted = json.codigo_html || json.html || Object.values(json)[0] || jsonString;
          
          if (typeof extracted === 'string') {
              extracted = extracted.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
          }
          return extracted;
      }
      return clean;
  } catch (e) {
      // REGEX CORRIGIDO: Sem quebras de linha que travam o TypeScript
      let fallback = text.replace(/(\`\`\`html|\`\`\`json|\`\`\`)/gi, '').trim();
      
      if (fallback.toLowerCase().startsWith('json')) {
          fallback = fallback.substring(4).trim();
      }
      
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