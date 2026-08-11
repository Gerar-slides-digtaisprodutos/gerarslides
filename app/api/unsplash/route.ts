import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query) return NextResponse.json({ error: 'Faltou a palavra-chave' }, { status: 400 });

  try {
    // Busca as 15 melhores fotos, na horizontal, usando a sua API Key
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&client_id=${process.env.UNSPLASH_API_KEY}`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Sorteia uma das 15 fotos premium para não repetir sempre a mesma
      const randomIndex = Math.floor(Math.random() * data.results.length);
      // Pega a URL de alta qualidade (regular)
      const imgUrl = data.results[randomIndex].urls.regular;
      return NextResponse.json({ url: imgUrl });
    } else {
      // Fallback de segurança se não achar nada
      return NextResponse.json({ url: `https://images.unsplash.com/random/1200x800/?${query}` }); 
    }
  } catch (error) {
    return NextResponse.json({ url: `https://images.unsplash.com/random/1200x800/?${query}` }); 
  }
}